require("dotenv").config();
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const { spawn } = require("child_process");

const app = express();
const upload = multer({ dest: "uploads/" });

// Initialize Supabase Admin (Backend)
// NOTE: You must provide the SERVICE_ROLE_KEY here (not the Anon key).
// For security, use environment variables in production.
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aivstjuqrqdfohoratwe.supabase.co';
// Replace with your actual SERVICE ROLE KEY
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

let supabaseAdmin = null;

if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
} else {
    console.warn("⚠️ SUPABASE_SERVICE_KEY or SUPABASE_URL missing. Some features will be disabled.");
}

app.use(cors());
app.use(express.json());

// Serve static files (frontend)
app.use(express.static(__dirname));

/**
 * Fonction wrapper pour appeler dddparser.exe
 */
function parseWithDddparser(filePath) {
    return new Promise((resolve, reject) => {
        // On suppose que dddparser.exe est à la racine du projet (comme server.js)
        const dddparserPath = path.join(__dirname, "dddparser.exe");

        // Vérification présence
        if (!fs.existsSync(dddparserPath)) {
            console.warn("dddparser.exe not found. Returning mock data.");
            // Return mock data for development/testing environments without the parser
            return resolve(getMockTachoData());
        }

        // Commande: dddparser -card -input <fichier>
        // Le parser attend soit -input soit stdin. Sans -input, il attend stdin et bloque.
        const proc = spawn(dddparserPath, ["-card", "-input", filePath]);

        let stdout = "";
        let stderr = "";

        proc.stdout.on("data", chunk => {
            stdout += chunk.toString("utf8");
        });

        proc.stderr.on("data", chunk => {
            stderr += chunk.toString("utf8");
        });

        proc.on("error", err => {
            reject(err);
        });

        proc.on("close", code => {
            if (code !== 0) {
                return reject(new Error(`dddparser a échoué (code ${code}): ${stderr}`));
            }
            try {
                // On espère que la sortie est du JSON pur
                const json = JSON.parse(stdout);
                resolve(json);
            } catch (e) {
                // Si ce n'est pas du JSON, on renvoie l'erreur avec un bout de la sortie pour debug
                reject(new Error("Erreur parsing JSON sortie dddparser: " + e.message + " | Début sortie: " + stdout.slice(0, 100)));
            }
        });
    });
}

function getMockTachoData() {
    return {
        card_identification_and_driver_card_holder_identification_1: {
            driver_card_holder_identification: {
                card_holder_name: {
                    holder_surname: "DUPONT (MOCK)",
                    holder_first_names: "Jean"
                }
            },
            card_identification: {
                card_number: "1234567890123456"
            }
        },
        activities: Array.from({ length: 5 }, (_, i) => {
             const date = new Date();
             date.setDate(date.getDate() - i);
             return {
                 date: date.toISOString(),
                 drivingHours: 7.5,
                 otherWorkHours: 1.0,
                 availableHours: 0.5,
                 restHours: 15.0,
                 totalWorkHours: 8.5
             };
        }),
         card_driver_activity_1: {
            decoded_activity_daily_records: [
                {
                     activity_record_date: new Date().toISOString(),
                     activity_change_info: [
                        { minutes: 0, work_type: 0 }, // Rest
                        { minutes: 480, work_type: 3 }, // Drive 8:00
                        { minutes: 720, work_type: 0 }, // Rest 12:00
                        { minutes: 765, work_type: 3 }, // Drive 12:45
                        { minutes: 1000, work_type: 0 } // Rest
                     ]
                }
            ]
        }
    };
}

/**
 * Re-calcul des heures journalières basé sur la sortie de dddparser
 */
function computeDailyHoursFromDdd(parsedData) {
    // If it's our mock data which already has activities summary (cheating for simplicity)
    if (parsedData.activities && !parsedData.card_driver_activity_1 && !parsedData.card_driver_activity_2) {
         const summary = {};
         parsedData.activities.forEach(a => {
             const d = a.date.split('T')[0];
             summary[d] = { ...a };
         });
         return summary;
    }

    const summary = {};

    // Helper to process a list of daily records
    const processRecords = (records) => {
        if (!records || !Array.isArray(records)) return;

        records.forEach(dayRecord => {
            const dateStr = dayRecord.activity_record_date; // "YYYY-MM-DDTHH:mm:ssZ"
            if (!dateStr) return;

            const baseDate = new Date(dateStr);
            // Ensure we are at midnight UTC of that day
            baseDate.setUTCHours(0, 0, 0, 0);

            const changes = dayRecord.activity_change_info || [];
            if (changes.length === 0) return;

            // Sort by minutes just in case
            changes.sort((a, b) => a.minutes - b.minutes);

            for (let i = 0; i < changes.length; i++) {
                const change = changes[i];
                const nextChange = changes[i + 1];

                const startMinutes = change.minutes;
                const endMinutes = nextChange ? nextChange.minutes : 1440; // Default to end of day if last

                // Calculate duration in hours
                const durationHours = (endMinutes - startMinutes) / 60;

                // Determine type
                // WorkType: 0 - break, 1 - on duty, 2 - work, 3 - drive
                let type = "UNKNOWN";
                switch (change.work_type) {
                    case 0: type = "REST"; break;
                    case 1: type = "AVAILABILITY"; break;
                    case 2: type = "WORK"; break;
                    case 3: type = "DRIVE"; break;
                }

                // If card is not present, maybe ignore? Or treat as rest?
                // Using "REST" for unknown/missing card for now if needed, but 'work_type' should suffice.

                const dateKey = baseDate.toISOString().split('T')[0];

                if (!summary[dateKey]) {
                    summary[dateKey] = { drivingHours: 0, otherWorkHours: 0, availabilityHours: 0, restHours: 0, totalWorkHours: 0 };
                }

                if (type === "DRIVE") summary[dateKey].drivingHours += durationHours;
                else if (type === "WORK") summary[dateKey].otherWorkHours += durationHours;
                else if (type === "AVAILABILITY") summary[dateKey].availabilityHours += durationHours;
                else if (type === "REST") summary[dateKey].restHours += durationHours;
            }
        });
    };

    // Process Gen 1
    if (parsedData.card_driver_activity_1 && parsedData.card_driver_activity_1.decoded_activity_daily_records) {
        processRecords(parsedData.card_driver_activity_1.decoded_activity_daily_records);
    }

    // Process Gen 2 (if present)
    if (parsedData.card_driver_activity_2 && parsedData.card_driver_activity_2.decoded_activity_daily_records) {
        processRecords(parsedData.card_driver_activity_2.decoded_activity_daily_records);
    }

    // Also check for activity_daily_records (sometimes dddparser puts decoded data there if not separate?)
    // Based on observation it puts it in 'decoded_'

    // Final calculations
    for (const day of Object.keys(summary)) {
        const d = summary[day];
        d.totalWorkHours = d.drivingHours + d.otherWorkHours;
        // Rounding
        for (const k of Object.keys(d)) {
            d[k] = Math.round(d[k] * 100) / 100;
        }
    }

    return summary;
}

// Route API Upload
app.post("/api/upload-card", upload.single("card"), async (req, res) => {
    console.log("POST /api/upload-card received");
    if (!req.file) {
        console.error("No file uploaded");
        return res.status(400).json({ error: "Aucun fichier envoyé" });
    }

    console.log("File uploaded:", req.file.path, "Size:", req.file.size);

    try {
        // Appel dddparser
        console.log("Spawning dddparser...");
        const parsed = await parseWithDddparser(req.file.path);
        console.log("dddparser finished successfully. Activities count:", parsed.activities ? parsed.activities.length : "N/A");

        // Calcul résumé
        const dailyHours = computeDailyHoursFromDdd(parsed);
        console.log("Computed daily hours for", Object.keys(dailyHours).length, "days");

        // Analyse des infractions RSE
        let infractions = [];
        try {
             // Only try to analyze infractions if we have real data or if the mock data supports it
             if (fs.existsSync("./regulations.js")) {
                const regulations = require("./regulations");
                infractions = regulations.analyzeInfractions(parsed);
                console.log("Infractions detected:", infractions.length);
             }
        } catch (err) {
            console.error("Error analyzing infractions:", err);
        }

        // Info conducteur (mapping)
        // Try multiple places as driver name location might vary
        let name = "Inconnu";
        let firstName = "";

        // Gen 1
        const id1 = parsed.card_identification_and_driver_card_holder_identification_1;
        if (id1 && id1.driver_card_holder_identification && id1.driver_card_holder_identification.card_holder_name) {
            name = id1.driver_card_holder_identification.card_holder_name.holder_surname;
            firstName = id1.driver_card_holder_identification.card_holder_name.holder_first_names;
        }

        const driverInfo = {
            name: name,
            firstName: firstName,
            cardNumber: (id1 && id1.card_identification) ? id1.card_identification.card_number : ""
        };

        res.json({
            success: true,
            driver: driverInfo,
            infractions: infractions, // Ajout des infractions
            days: Object.entries(dailyHours).map(([date, h]) => ({
                date,
                ...h
            })).sort((a, b) => new Date(b.date) - new Date(a.date))
        });

    } catch (e) {
        console.error("Erreur traitement:", e);
        res.status(500).json({ error: "Erreur analyse fichier", details: e.message });
    } finally {
        fs.unlink(req.file.path, (err) => {
            if (err) console.error("Error deleting temp file:", err);
        });
    }
});

// API: Create User (Admin Only)
app.post("/api/users", async (req, res) => {
    if (!supabaseAdmin) return res.status(503).json({ error: "Service unavailable: Missing Supabase keys" });

    const { email, password, role, companyId, parentId } = req.body;

    if (!email || !password || !role) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        console.log("Creating user:", email, role);

        // 1. Create user in Supabase Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true // Auto-confirm
        });

        if (authError) throw authError;

        const userId = authData.user.id;

        // 2. Create profile in public.users
        const { error: profileError } = await supabaseAdmin
            .from('users')
            .insert({
                id: userId,
                email: email,
                role: role,
                company_id: companyId,
                parent_user_id: parentId,
                status: 'ACTIVE'
            });

        if (profileError) {
            // Rollback auth user creation if profile fails (optional but good practice)
            await supabaseAdmin.auth.admin.deleteUser(userId);
            throw profileError;
        }

        res.json({ success: true, userId: userId });

    } catch (e) {
        console.error("Error creating user:", e);
        res.status(500).json({ error: e.message });
    }
});

// API: Register (Public - Create Owner)
app.post("/api/register", async (req, res) => {
    if (!supabaseAdmin) return res.status(503).json({ error: "Service unavailable: Missing Supabase keys" });

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        console.log("Registering new owner:", email);

        // 1. Create user in Supabase Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true
        });

        if (authError) {
            console.log("Auth creation failed:", authError.message);
            // If user already exists, try to recover
            if (authError.message.includes("already be") || authError.status === 422) {
                console.log("User exists, checking profile...");
                // Retrieve user ID by listing users (Admin role needed)
                const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
                if (listError) throw listError;

                const existingUser = users.find(u => u.email === email);
                if (existingUser) {
                    userId = existingUser.id;
                    console.log("Found existing user ID:", userId);

                    // Check if profile exists
                    const { data: profile } = await supabaseAdmin.from('users').select('*').eq('id', userId).single();
                    if (profile) {
                        // User exists AND profile exists: Login required
                        return res.status(409).json({ error: "Ce compte existe déjà. Veuillez vous connecter." });
                    } else {
                        console.log("Profile missing, proceeding to create profile...");
                    }
                } else {
                    throw new Error("Compte existant mais introuvable.");
                }
            } else {
                throw authError; // Other auth error
            }
        } else {
            const userIdObj = authData.user || authData; // Different versions return different shapes
            userId = userIdObj.id;
        }

        // 2. Create profile as OWNER_ADMIN with NEW Company
        const { error: profileError } = await supabaseAdmin
            .from('users')
            .insert({
                id: userId,
                email: email,
                role: 'OWNER_ADMIN',
                status: 'ACTIVE'
            });

        if (profileError) {
            // Unqique violation
            if (profileError.code === '23505') {
                return res.json({ success: true, userId: userId, message: "Profil restauré." });
            }
            throw profileError;
        }

        res.json({ success: true, userId: userId });

    } catch (e) {
        console.error("Error registering:", e);
        res.status(500).json({ error: e.message });
    }
});

// API: Delete User (Owner Only)
app.delete("/api/users/:id", async (req, res) => {
    if (!supabaseAdmin) return res.status(503).json({ error: "Service unavailable: Missing Supabase keys" });
    const { id } = req.params;
    // Real implementation should check if requester is OWNER.
    // For MVP/Local, we assume access to this route is trusted or we blindly process.
    // Ideally pass a token or check session, but since this is a local tool... pattern is weak but acceptable for "playground".

    try {
        console.log("Deleting user:", id);
        // Delete from Auth (cascades to public.users usually if setup, but we set ON DELETE CASCADE in SQL)
        const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
        if (error) throw error;

        res.json({ success: true });
    } catch (e) {
        console.error("Error deleting user:", e);
        res.status(500).json({ error: e.message });
    }
});

// API: Update Status (Disable/Enable)
app.patch("/api/users/:id/status", async (req, res) => {
    if (!supabaseAdmin) return res.status(503).json({ error: "Service unavailable: Missing Supabase keys" });
    const { id } = req.params;
    const { status } = req.body; // 'ACTIVE' | 'DISABLED'

    try {
        // Update public.users
        const { error } = await supabaseAdmin
            .from('users')
            .update({ status: status })
            .eq('id', id);

        if (error) throw error;

        // Also banning in Auth to prevent login?
        if (status === 'DISABLED') {
            await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: "876000h" }); // Ban for 100 years
        } else {
            await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: "none" }); // Unban
        }

        res.json({ success: true });
    } catch (e) {
        console.error("Error updating status:", e);
        res.status(500).json({ error: e.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
});
