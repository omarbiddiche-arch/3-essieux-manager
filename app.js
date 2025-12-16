// ==============================================
// 3 ESSIEUX MANAGER - APPLICATION PRINCIPALE
// ==============================================

const supabase = window.supabaseClient;

// --- STATE ---
const App = {
    user: null,
    vehicles: [],
    drivers: [],
    attendance: [],
    currentView: 'dashboard'
};

// --- INIT ---
window.addEventListener('DOMContentLoaded', async () => {
    console.log("App starting...");
    await checkAuth();

    window.onclick = (e) => {
        const modal = document.getElementById('modal');
        if (e.target === modal) closeModal();
    };
});

// --- MOBILE MENU ---
window.toggleMenu = () => {
    const menu = document.getElementById('navMenu');
    menu.classList.toggle('active');
};

window.closeMenu = () => {
    const menu = document.getElementById('navMenu');
    if (menu) menu.classList.remove('active');
};

// --- AUTH ---
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    await handleSession(session);

    supabase.auth.onAuthStateChange((_event, session) => {
        handleSession(session);
    });
}

async function handleSession(session) {
    if (session) {
        const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

        App.user = {
            ...session.user,
            ...profile,
            companyId: profile?.company_id
        };

        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'block';

        await initData();
    } else {
        document.getElementById('auth-container').style.display = 'block';
        document.getElementById('app-container').style.display = 'none';
    }
}

async function login(event) {
    event.preventDefault();
    const email = event.target.email.value;
    const password = event.target.password.value;

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert("Erreur: " + error.message);
}

window.toggleAuth = (mode) => {
    document.getElementById('loginForm').style.display = mode === 'login' ? 'block' : 'none';
    document.getElementById('registerForm').style.display = mode === 'register' ? 'block' : 'none';
    const resetForm = document.getElementById('resetPasswordForm');
    if (resetForm) resetForm.style.display = mode === 'reset' ? 'block' : 'none';
};

window.resetPassword = async (event) => {
    event.preventDefault();
    const email = event.target.email.value;

    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin,
        });
        if (error) throw error;

        alert("Si cet email existe, un lien de réinitialisation a été envoyé.");
        toggleAuth('login');
    } catch (err) {
        alert("Erreur: " + err.message);
    }
};

window.register = async (event) => {
    event.preventDefault();
    const email = event.target.email.value;
    const password = event.target.password.value;
    const confirmPassword = event.target.confirmPassword.value;

    if (password !== confirmPassword) {
        alert("Les mots de passe ne correspondent pas");
        return;
    }

    try {
        const btn = event.target.querySelector('button');
        const originalText = btn.innerText;
        btn.disabled = true;
        btn.innerText = "Creation en cours...";

        const response = await fetch('http://localhost:3000/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Erreur lors de l'inscription");
        }

        alert("Compte cree ! Vous pouvez maintenant vous connecter.");
        toggleAuth('login');

    } catch (err) {
        alert("Erreur: " + err.message);
    } finally {
        const btn = event.target.querySelector('button');
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Creer un compte";
        }
    }
};

async function logout() {
    await supabase.auth.signOut();
    location.reload();
}

// --- DATA LOADING ---
async function initData() {
    if (!App.user?.companyId) return;

    try {
        console.log("Loading data...");

        const { data: vehicles, error: vErr } = await supabase
            .from('vehicles')
            .select('*')
            .eq('company_id', App.user.companyId);
        if (vErr) throw vErr;
        App.vehicles = vehicles || [];

        const { data: drivers, error: dErr } = await supabase
            .from('drivers')
            .select('*')
            .eq('company_id', App.user.companyId);
        if (dErr) throw dErr;
        App.drivers = drivers || [];

        const { data: attendanceRaw, error: aErr } = await supabase
            .from('attendance')
            .select('*')
            .eq('company_id', App.user.companyId)
            .limit(3000);
        if (aErr) throw aErr;

        App.attendance = (attendanceRaw || []).map(a => ({
            ...a,
            driverId: a.driver_id,
            manualBonus: a.manual_bonus || 0
        }));

        console.log("Data loaded:", App.vehicles.length, "vehicles,", App.drivers.length, "drivers,", App.attendance.length, "attendance");

        route();
    } catch (err) {
        console.error("Error loading data:", err);
        alert("Erreur chargement: " + err.message);
    }
}

// --- ROUTING ---
function route() {
    closeMenu(); // Close mobile menu if open
    const hash = window.location.hash.substring(1) || 'dashboard';
    const content = document.getElementById('mainContent');

    if (!content) {
        console.error("mainContent not found!");
        return;
    }

    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const activeLink = document.querySelector(`a[href="#${hash}"]`);
    if (activeLink) activeLink.classList.add('active');

    switch (hash) {
        case 'dashboard': content.innerHTML = renderDashboard(); break;
        case 'vehicles': content.innerHTML = renderVehicles(); break;
        case 'drivers': content.innerHTML = renderDrivers(); break;
        case 'attendance': content.innerHTML = renderAttendance(); break;
        case 'tachydrive': content.innerHTML = renderTachyDrive(); break;
        case 'todo': content.innerHTML = renderTodo(); break;
        default: content.innerHTML = renderDashboard();
    }
}

window.addEventListener('hashchange', route);

// --- DASHBOARD ---
function renderDashboard() {
    // Calculate alerts
    const vehicleAlerts = App.vehicles.filter(v => validateVehicle(v).length > 0);
    const driverAlerts = App.drivers.filter(d => validateDriver(d).length > 0);

    // Document expiry alerts (60 days)
    const documentAlerts = [];
    const checkDocExpiry = (entity, type) => {
        if (!entity.documents) return;
        entity.documents.forEach(doc => {
            if (!doc.expiryDate) return;
            const expiry = new Date(doc.expiryDate);
            const today = new Date();
            const daysUntil = Math.floor((expiry - today) / (1000 * 60 * 60 * 24));

            if (daysUntil <= 60 && daysUntil >= 0) {
                documentAlerts.push({
                    entity: type === 'vehicle' ? entity.plate : entity.name,
                    type,
                    docName: doc.name,
                    daysUntil,
                    expiryDate: doc.expiryDate
                });
            } else if (daysUntil < 0) {
                documentAlerts.push({
                    entity: type === 'vehicle' ? entity.plate : entity.name,
                    type,
                    docName: doc.name,
                    daysUntil,
                    expiryDate: doc.expiryDate,
                    expired: true
                });
            }
        });
    };

    App.vehicles.forEach(v => checkDocExpiry(v, 'vehicle'));
    App.drivers.forEach(d => checkDocExpiry(d, 'driver'));

    // Calculate today presences
    const today = new Date().toISOString().split('T')[0];
    const todayPresent = App.attendance.filter(a => a.date === today && a.status === 'present').length;

    return `
        <div class="fade-in">
            <h2 style="margin-bottom: 2rem; font-size: 2rem; font-weight: 700;">Tableau de Bord</h2>
            
            <!-- Stats Cards -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                <div class="card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <p style="opacity: 0.9; margin-bottom: 0.5rem; font-size: 0.9rem;">Vehicules</p>
                            <h3 style="font-size: 2.5rem; margin: 0;">${App.vehicles.length}</h3>
                            ${vehicleAlerts.length > 0 ? `<p style="margin-top: 0.5rem; font-size: 0.85rem; opacity: 0.9;">⚠️ ${vehicleAlerts.length} alerte(s)</p>` : ''}
                        </div>
                        <div style="font-size: 3rem; opacity: 0.3;">🚛</div>
                    </div>
                </div>
                
                <div class="card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; border: none;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <p style="opacity: 0.9; margin-bottom: 0.5rem; font-size: 0.9rem;">Chauffeurs</p>
                            <h3 style="font-size: 2.5rem; margin: 0;">${App.drivers.length}</h3>
                            ${driverAlerts.length > 0 ? `<p style="margin-top: 0.5rem; font-size: 0.85rem; opacity: 0.9;">⚠️ ${driverAlerts.length} alerte(s)</p>` : ''}
                        </div>
                        <div style="font-size: 3rem; opacity: 0.3;">👥</div>
                    </div>
                </div>
                
                <div class="card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; border: none;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <p style="opacity: 0.9; margin-bottom: 0.5rem; font-size: 0.9rem;">Presents Aujourdhui</p>
                            <h3 style="font-size: 2.5rem; margin: 0;">${todayPresent}</h3>
                            <p style="margin-top: 0.5rem; font-size: 0.85rem; opacity: 0.9;">sur ${App.drivers.length} chauffeurs</p>
                        </div>
                        <div style="font-size: 3rem; opacity: 0.3;">✅</div>
                    </div>
                </div>
            </div>
            
            <!-- Alerts Section -->
            ${vehicleAlerts.length > 0 || driverAlerts.length > 0 || documentAlerts.length > 0 ? `
                <div class="card" style="border-left: 4px solid var(--warning);">
                    <h3 style="color: var(--warning); margin-bottom: 1rem;">⚠️ Alertes & Notifications</h3>
                    
                    ${documentAlerts.length > 0 ? `
                        <div style="margin-bottom: 1.5rem;">
                            <h4 style="font-size: 1rem; margin-bottom: 0.75rem; color: var(--text-secondary);">Documents</h4>
                            ${documentAlerts.map(alert => `
                                <div class="alert ${alert.expired ? 'alert-danger' : 'alert-warning'}" style="margin-bottom: 0.5rem;">
                                    <strong>${alert.entity}</strong> - ${alert.docName}: 
                                    ${alert.expired ? 'EXPIRE' : `Expire dans ${alert.daysUntil} jours`} (${alert.expiryDate})
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    ${vehicleAlerts.length > 0 ? `
                        <div style="margin-bottom: 1.5rem;">
                            <h4 style="font-size: 1rem; margin-bottom: 0.75rem; color: var(--text-secondary);">Vehicules</h4>
                            ${vehicleAlerts.map(v => {
        const errors = validateVehicle(v);
        return `
                                    <div class="alert alert-warning" style="margin-bottom: 0.5rem;">
                                        <strong>${v.plate}</strong> - ${errors.join(', ')}
                                    </div>
                                `;
    }).join('')}
                        </div>
                    ` : ''}
                    
                    ${driverAlerts.length > 0 ? `
                        <div>
                            <h4 style="font-size: 1rem; margin-bottom: 0.75rem; color: var(--text-secondary);">Chauffeurs</h4>
                            ${driverAlerts.map(d => {
        const errors = validateDriver(d);
        return `
                                    <div class="alert alert-warning" style="margin-bottom: 0.5rem;">
                                        <strong>${d.name}</strong> - ${errors.join(', ')}
                                    </div>
                                `;
    }).join('')}
                        </div>
                    ` : ''}
                </div>
            ` : `
                <div class="card" style="border-left: 4px solid var(--secondary);">
                    <div style="text-align: center; padding: 2rem;">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">✅</div>
                        <h3 style="color: var(--secondary);">Tout est en ordre !</h3>
                        <p style="color: var(--text-secondary); margin-top: 0.5rem;">Aucune alerte a signaler</p>
                    </div>
                </div>
            `}
        </div>
    `;
}

// --- VEHICLES ---
// Add global variable for vehicle search
window.vehicleSearchTerm = '';

window.updateVehicleSearch = (input) => {
    window.vehicleSearchTerm = input.value;
    const term = window.vehicleSearchTerm.toLowerCase();
    const filteredVehicles = App.vehicles.filter(v =>
        v.plate.toLowerCase().includes(term) ||
        (v.model && v.model.toLowerCase().includes(term)) ||
        (v.type && v.type.toLowerCase().includes(term))
    );
    document.getElementById('vehicleTableBody').innerHTML = renderVehicleRows(filteredVehicles);
};

function renderVehicleRows(vehicles) {
    if (vehicles.length === 0) {
        return '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #888;">Aucun vehicule trouve</td></tr>';
    }
    return vehicles.map(v => {
        const errors = validateVehicle(v);
        const hasAlerts = errors.length > 0;
        return `
            <tr style="${hasAlerts ? 'background: #fff3cd;' : ''} cursor: pointer;" onclick="openVehicleDetail(${v.id})" title="Cliquer pour voir les details">
                <td data-label="Plaque"><strong>${v.plate}</strong></td>
                <td data-label="Modele">${v.model || '-'}</td>
                <td data-label="Type">${v.type || '-'}</td>
                <td data-label="Km">${v.km || 0} km</td>
                <td data-label="Actions" onclick="event.stopPropagation()">
                    ${hasAlerts ? '<span style="color: red;">⚠️</span>' : ''}
                    <button class="btn btn-sm btn-danger" onclick="deleteVehicle(${v.id})">🗑️</button>
                </td>
            </tr>
            ${hasAlerts ? `<tr><td colspan="5" style="background: #fff3cd; font-size: 0.85rem; color: #856404;">${errors.join(', ')}</td></tr>` : ''}
        `;
    }).join('');
}

function renderVehicles() {
    const term = window.vehicleSearchTerm.toLowerCase();
    const filteredVehicles = App.vehicles.filter(v =>
        v.plate.toLowerCase().includes(term) ||
        (v.model && v.model.toLowerCase().includes(term)) ||
        (v.type && v.type.toLowerCase().includes(term))
    );

    return `
        <div id="vehicles-view" class="card fade-in">
            <!-- Header Responsive -->
            <div class="page-header-responsive">
                <div class="header-group">
                    <h2 style="margin: 0;">Vehicules</h2>
                    <input type="text" 
                        placeholder="Rechercher..." 
                        class="form-control" 
                        style="width: 200px; padding: 0.4rem;"
                        value="${window.vehicleSearchTerm}"
                        oninput="updateVehicleSearch(this)"
                    >
                </div>
                <button class="btn btn-primary btn-add-responsive" onclick="openVehicleModal()">+ Ajouter</button>
            </div>

            <!-- DESKTOP VIEW -->
            <div class="desktop-view">
                <table class="custom-table">
                    <thead>
                        <tr>
                            <th>Plaque</th>
                            <th>Modele</th>
                            <th>Type</th>
                            <th>Km</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="vehicleTableBody">
                        ${renderVehicleRows(filteredVehicles)}
                    </tbody>
                </table>
            </div>

            <!-- MOBILE VIEW -->
            <div class="mobile-view">
                ${renderVehicleCards(filteredVehicles)}
            </div>
        </div>
    `;
}

// Nouvelle fonction pour générer les cartes Mobile Véhicules
function renderVehicleCards(vehicles) {
    if (vehicles.length === 0) {
        return '<p style="text-align: center; color: #888; padding: 1rem;">Aucun vehicule trouvé</p>';
    }
    return vehicles.map(v => {
        const errors = validateVehicle(v);
        const hasAlerts = errors.length > 0;
        return `
            <div class="mobile-card" onclick="openVehicleDetail(${v.id})">
                <div class="mobile-card-header">
                    <strong>${v.plate}</strong>
                    <span>${v.km || 0} km</span>
                </div>
                <div class="mobile-card-body">
                    <div class="mobile-card-row">
                        <span>Modele:</span>
                        <span>${v.model || '-'}</span>
                    </div>
                    <div class="mobile-card-row">
                        <span>Type:</span>
                        <span>${v.type || '-'}</span>
                    </div>
                </div>
                <div class="mobile-card-footer">
                    ${hasAlerts ? '<span style="color: red;">⚠️ Attention requise</span>' : '<span></span>'}
                    <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteVehicle(${v.id})">🗑️ Supprimer</button>
                </div>
            </div>
        `;
    }).join('');
}

window.openVehicleModal = () => {
    showModal(`
        <h3>Nouveau Vehicule</h3>
        <form onsubmit="saveVehicle(event)">
            <div class="form-group">
                <label>Plaque</label>
                <input type="text" name="plate" required class="form-control">
            </div>
            <div class="form-group">
                <label>Modele</label>
                <input type="text" name="model" class="form-control">
            </div>
            <div class="form-group">
                <label>Type</label>
                <input type="text" name="type" class="form-control">
            </div>
            <div class="form-group">
                <label>Kilometrage</label>
                <input type="number" name="km" value="0" class="form-control">
            </div>
            <button type="submit" class="btn btn-primary">Enregistrer</button>
        </form>
    `);
};

window.saveVehicle = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
        company_id: App.user.companyId,
        plate: fd.get('plate'),
        model: fd.get('model'),
        type: fd.get('type'),
        km: parseInt(fd.get('km')) || 0
    };

    try {
        const { data, error } = await supabase.from('vehicles').insert(payload).select().single();
        if (error) throw error;
        App.vehicles.push(data);
        closeModal();
        route();
    } catch (err) {
        alert("Erreur: " + err.message);
    }
};

window.deleteVehicle = async (id) => {
    if (!confirm("Supprimer ce vehicule ?")) return;
    try {
        const { error } = await supabase.from('vehicles').delete().eq('id', id);
        if (error) throw error;
        App.vehicles = App.vehicles.filter(v => v.id !== id);
        route();
    } catch (err) {
        alert("Erreur: " + err.message);
    }
};

// --- DRIVERS ---
window.driverSearchTerm = '';

window.updateDriverSearch = (input) => {
    window.driverSearchTerm = input.value;
    const term = window.driverSearchTerm.toLowerCase();
    const filteredDrivers = App.drivers.filter(d =>
        d.name.toLowerCase().includes(term) ||
        (d.phone && d.phone.includes(term))
    );
    document.getElementById('driverTableBody').innerHTML = renderDriverRows(filteredDrivers);
};

function renderDriverRows(drivers) {
    if (drivers.length === 0) {
        return '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #888;">Aucun chauffeur trouve</td></tr>';
    }
    return drivers.map(d => {
        const errors = validateDriver(d);
        const hasAlerts = errors.length > 0;
        return `
            <tr style="${hasAlerts ? 'background: #fff3cd;' : ''} cursor: pointer;" onclick="openDriverDetail(${d.id})" title="Cliquer pour voir les details">
                <td data-label="Nom"><strong>${d.name}</strong></td>
                <td data-label="Telephone">${d.phone || '-'}</td>
                <td data-label="Permis">${d.license_type || '-'}</td>
                <td data-label="Expir. Permis">${d.license_expiry || '-'}</td>
                <td data-label="Visite Med.">${d.medical_expiry || '-'}</td>
                <td data-label="Statut"><span class="badge badge-success">${d.status || 'available'}</span></td>
                <td data-label="Actions" onclick="event.stopPropagation()">
                    ${hasAlerts ? '<span style="color: red;">⚠️</span>' : ''}
                    <button class="btn btn-sm btn-danger" onclick="deleteDriver(${d.id})">🗑️</button>
                </td>
            </tr>
            ${hasAlerts ? `<tr><td colspan="7" style="background: #fff3cd; font-size: 0.85rem; color: #856404;">${errors.join(', ')}</td></tr>` : ''}
        `;
    }).join('');
}

function renderDrivers() {
    const term = window.driverSearchTerm.toLowerCase();
    const filteredDrivers = App.drivers.filter(d =>
        d.name.toLowerCase().includes(term) ||
        (d.phone && d.phone.includes(term))
    );

    return `
        <div class="card fade-in">
            <!-- Header Responsive -->
            <div class="page-header-responsive">
                <div class="header-group">
                    <h2 style="margin: 0;">Chauffeurs</h2>
                    <input type="text" 
                        placeholder="Rechercher..." 
                        class="form-control" 
                        style="width: 200px; padding: 0.4rem;"
                        value="${window.driverSearchTerm}"
                        oninput="updateDriverSearch(this)"
                    >
                </div>
                <button class="btn btn-primary btn-add-responsive" onclick="openDriverModal()">+ Ajouter</button>
            </div>

            <!-- DESKTOP VIEW (Tableau) -->
            <div class="desktop-view">
                <table class="custom-table">
                    <thead>
                        <tr>
                            <th>Nom</th>
                            <th>Telephone</th>
                            <th>Permis</th>
                            <th>Expir. Permis</th>
                            <th>Visite Med.</th>
                            <th>Statut</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="driverTableBody">
                        ${renderDriverRows(filteredDrivers)}
                    </tbody>
                </table>
            </div>

            <!-- MOBILE VIEW (Cartes) -->
            <div class="mobile-view">
                ${renderDriverCards(filteredDrivers)}
            </div>
        </div>
    `;
}

// Nouvelle fonction pour générer les cartes Mobile
function renderDriverCards(drivers) {
    if (drivers.length === 0) {
        return '<p style="text-align: center; color: #888; padding: 1rem;">Aucun chauffeur trouvé</p>';
    }
    return drivers.map(d => {
        const errors = validateDriver(d);
        const hasAlerts = errors.length > 0;
        return `
            <div class="mobile-card" onclick="openDriverDetail(${d.id})">
                <div class="mobile-card-header">
                    <strong>${d.name}</strong>
                    <span class="badge badge-success">${d.status || 'available'}</span>
                </div>
                <div class="mobile-card-body">
                    <div class="mobile-card-row">
                        <span>Telephone:</span>
                        <span>${d.phone || '-'}</span>
                    </div>
                    <div class="mobile-card-row">
                        <span>Permis:</span>
                        <span>${d.license_type || '-'}</span>
                    </div>
                    <div class="mobile-card-row">
                        <span>Expir. Permis:</span>
                        <span style="${hasAlerts ? 'color: red; font-weight: bold;' : ''}">${d.license_expiry || '-'}</span>
                    </div>
                </div>
                <div class="mobile-card-footer">
                    ${hasAlerts ? '<span style="color: red;">⚠️ Attention requise</span>' : '<span></span>'}
                    <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteDriver(${d.id})">🗑️ Supprimer</button>
                </div>
            </div>
        `;
    }).join('');
}

window.openDriverModal = () => {
    showModal(`
        <h3>Nouveau Chauffeur</h3>
        <form onsubmit="saveDriver(event)">
            <div class="form-group">
                <label>Nom complet</label>
                <input type="text" name="name" required class="form-control">
            </div>
            <div class="form-group">
                <label>Telephone</label>
                <input type="text" name="phone" class="form-control">
            </div>
            <div class="form-group">
                <label>Type de permis</label>
                <div style="max-height: 150px; overflow-y: auto; border: 1px solid #ced4da; padding: 0.5rem; border-radius: 0.25rem; background: #fff;">
                    ${['A1', 'A2', 'A', 'B1', 'B', 'C1', 'C', 'D1', 'D', 'BE', 'C1E', 'CE', 'D1E', 'DE'].map(type => `
                        <label style="display: flex; align-items: center; margin-bottom: 0.25rem; cursor: pointer;">
                            <input type="checkbox" name="license_type" value="${type}" style="margin-right: 0.5rem;"> 
                            ${type}
                        </label>
                    `).join('')}
                </div>
            </div>
            <button type="submit" class="btn btn-primary">Enregistrer</button>
        </form>
    `);
};

window.saveDriver = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const selectedLicenses = Array.from(e.target.querySelectorAll('input[name="license_type"]:checked')).map(cb => cb.value);

    const payload = {
        company_id: App.user.companyId,
        name: fd.get('name'),
        phone: fd.get('phone'),
        license_type: selectedLicenses.join(', ')
    };

    try {
        const { data, error } = await supabase.from('drivers').insert(payload).select().single();
        if (error) throw error;
        App.drivers.push(data);
        closeModal();
        route();
    } catch (err) {
        alert("Erreur: " + err.message);
    }
};

window.deleteDriver = async (id) => {
    if (!confirm("Supprimer ce chauffeur ?")) return;
    try {
        const { error } = await supabase.from('drivers').delete().eq('id', id);
        if (error) throw error;
        App.drivers = App.drivers.filter(d => d.id !== id);
        route();
    } catch (err) {
        alert("Erreur: " + err.message);
    }
};

// --- ATTENDANCE ---
window.attendanceDate = new Date();
window.attendanceTool = 'select';
window.attendanceSearchTerm = '';

// Helper to render a single row (used for init and updates)
function renderAttendanceRow(driver, year, month, daysInMonth) {
    // Sticky Name Column
    let rowHtml = `<td class="sticky-col-left col-driver-name" title="${driver.name}">${driver.name}</td>`;

    // Calculate Stats
    let workDays = 0; // Mon-Fri
    let saturdays = 0; // Sat
    let totalBonus = 0;

    for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(year, month, day);
        // Fix timezone issue
        const offset = d.getTimezoneOffset();
        const localD = new Date(d.getTime() - (offset * 60 * 1000));
        const dateStr = localD.toISOString().split('T')[0];

        const entry = App.attendance.find(a => a.driverId === driver.id && a.date === dateStr);
        const statusIcon = getStatusIcon(entry?.status, d.getDay());

        // Count Days
        if (entry?.status === 'present') {
            const dayNum = d.getDay();
            if (dayNum === 6) {
                saturdays++;
            } else if (dayNum !== 0) {
                workDays++;
            }
        }

        // Calculate Bonuses
        if (entry) {
            // Add manual bonus (legacy)
            if (entry.manualBonus) totalBonus += parseFloat(entry.manualBonus);

            // Add specific primes
            if (entry.primes) {
                totalBonus += (parseFloat(entry.primes.lunch) || 0);
                totalBonus += (parseFloat(entry.primes.morning) || 0);
                totalBonus += (parseFloat(entry.primes.noon) || 0);
                totalBonus += (parseFloat(entry.primes.evening) || 0);
                totalBonus += (parseFloat(entry.primes.night) || 0);
                totalBonus += (parseFloat(entry.primes.exceptional) || 0);
            }
        }

        // Determine Cell Style
        let cellStyle = "cursor: pointer; text-align: center; border: 1px solid #eee; min-width: 30px;";
        if (d.getDay() === 0 || d.getDay() === 6) cellStyle += " background: #f8f9fa;"; // Weekend color

        rowHtml += `<td onclick="handleAttendanceClick(event, ${driver.id}, '${dateStr}')" 
                    style="${cellStyle}"
                    data-driver="${driver.id}" data-date="${dateStr}">
                    ${statusIcon}
                </td>`;
    }

    // Sticky Stats Columns (Right side)
    // We use a container independent sticky approach or just fixed width assumptions. 
    // Since we are in a single TR, we can use right sticky values relative to the table container.
    // Widths: TotalPrimes(80), Sam(50), Ouv(50). 
    // Accumulate right offsets: Primes=0, Sam=80, Ouv=130.

    rowHtml += `<td class="sticky-col-right col-stat-work">${workDays}</td>`;
    rowHtml += `<td class="sticky-col-right col-stat-sat">${saturdays}</td>`;
    rowHtml += `<td class="sticky-col-right col-stat-total">${totalBonus.toFixed(2)}€</td>`;

    return rowHtml;
}
window.attendanceSearchTerm = '';

window.updateAttendanceSearch = (input) => {
    window.attendanceSearchTerm = input.value;
    const term = window.attendanceSearchTerm.toLowerCase();

    // Filter rows based on driver name
    const rows = document.querySelectorAll('#attendanceTableBody tr');
    rows.forEach(row => {
        const driverName = row.cells[0].innerText.toLowerCase();
        if (driverName.includes(term)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
};

// --- NEW ATTENDANCE SYSTEM (Planning React style) ---

const AttendanceManager = {
    weekStart: null,
    data: {}, // { driverId: { dateISO: { status, panier, decouche, exceptionnelle } } }

    init() {
        if (!this.weekStart) {
            this.weekStart = this.startOfWeekMonday(new Date());
        }
        if (window.attendanceData) {
            this.data = window.attendanceData;
        } else {
            // Tentative de migration des anciennes données si nécessaire, sinon vide
            this.data = {};
        }
    },

    startOfWeekMonday(d = new Date()) {
        const date = new Date(d);
        const day = date.getDay();
        const diff = (day === 0 ? -6 : 1) - day;
        date.setDate(date.getDate() + diff);
        date.setHours(0, 0, 0, 0);
        return date;
    },

    addDays(date, n) {
        const d = new Date(date);
        d.setDate(d.getDate() + n);
        return d;
    },

    isoDate(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    },

    fmtDay(date) {
        return date.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" });
    },

    emptyDay() {
        return {
            status: "present",
            panier: { matin: false, midi: false, soir: false },
            decouche: false,
            exceptionnelle: { amount: 0, note: "" },
        };
    },

    getDayData(driverId, dateISO) {
        if (!this.data[driverId]) this.data[driverId] = {};
        if (!this.data[driverId][dateISO]) this.data[driverId][dateISO] = this.emptyDay();
        return this.data[driverId][dateISO];
    },

    updateDayData(driverId, dateISO, newData) {
        if (!this.data[driverId]) this.data[driverId] = {};
        this.data[driverId][dateISO] = newData;
        saveGlobalAttendance();
    },

    shiftWeek(delta) {
        this.weekStart = this.addDays(this.weekStart, delta * 7);
        // On force le rafraichissement en rappelant route() ou en injectant le HTML
        document.getElementById('mainContent').innerHTML = renderAttendance();
        reAttachListeners(); // Si on avait des listeners spécifiques, ici on utilise onclick inline donc ça va.
    },

    setToday() {
        this.weekStart = this.startOfWeekMonday(new Date());
        document.getElementById('mainContent').innerHTML = renderAttendance();
    },

    getStatusMeta(key) {
        const STATUSES = [
            { key: "present", label: "Présent", class: "bg-emerald-100 text-emerald-700 ring-emerald-200" },
            { key: "absent", label: "Absent", class: "bg-rose-100 text-rose-700 ring-rose-200" },
            { key: "conge", label: "Congé", class: "bg-amber-100 text-amber-700 ring-amber-200" },
            { key: "vacances", label: "Vacances", class: "bg-sky-100 text-sky-700 ring-sky-200" },
            { key: "maladie", label: "Maladie", class: "bg-orange-100 text-orange-700 ring-orange-200" }
        ];
        return STATUSES.find(s => s.key === key) || STATUSES[0];
    },

    getTotals(driverId) {
        const row = this.data[driverId] || {};
        const days = Array.from({ length: 7 }, (_, i) => this.addDays(this.weekStart, i));

        let paniers = { matin: 0, midi: 0, soir: 0 };
        let decouches = 0;
        let primesEx = 0;

        days.forEach(day => {
            const k = this.isoDate(day);
            const d = row[k] || this.emptyDay();
            if (d.panier && d.panier.matin) paniers.matin++;
            if (d.panier && d.panier.midi) paniers.midi++;
            if (d.panier && d.panier.soir) paniers.soir++;
            if (d.decouche) decouches++;
            if (d.exceptionnelle) primesEx += (parseFloat(d.exceptionnelle.amount) || 0);
        });

        return { paniers, decouches, primesEx: primesEx.toFixed(2) };
    }
};

// Render Function
// --- RENDER ATTENDANCE (Delegated) ---
function renderAttendance() {
    if (typeof AttManager !== 'undefined') {
        return AttManager.renderMain();
    }
    return '<div style="padding:20px; text-align:center">Chargement du module de présence...</div>';
}


// (Deleted)

// (Old modals deleted)


// (Residue deleted)


window.saveGlobalAttendance = async () => {
    if (!confirm("Sauvegarder les donnees du mois ?")) return;

    const viewDate = window.attendanceDate;
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const monthEntries = App.attendance.filter(a => {
        const d = new Date(a.date);
        return d.getMonth() === month && d.getFullYear() === year;
    });

    const payload = monthEntries.map(a => ({
        company_id: App.user.companyId,
        driver_id: a.driverId,
        date: a.date,
        status: a.status,
        primes: a.primes || {},
        bonus: a.bonus || 0,
        manual_bonus: a.manualBonus || 0
    }));

    try {
        const startDate = new Date(year, month, 1).toISOString().split('T')[0];
        const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

        const { error: delErr } = await supabase.from('attendance')
            .delete()
            .eq('company_id', App.user.companyId)
            .gte('date', startDate)
            .lte('date', endDate);
        if (delErr) throw delErr;

        if (payload.length > 0) {
            const { error: insErr } = await supabase.from('attendance').insert(payload);
            if (insErr) throw insErr;
        }

        alert("Saved successfully!");
    } catch (err) {
        console.error(err);
        alert("Error: " + err.message);
    }
};

// --- TACHYDRIVE ---
function renderTachyDrive() {
    return `
        <div class="card fade-in">
            <h2>TachyDrive</h2>
            <p>Feature in development...</p>
        </div>
    `;
}

// --- TODO ---
function renderTodo() {
    return `
        <div class="card fade-in">
            <h2>To-Do List</h2>
            <p>Feature in development...</p>
        </div>
    `;
}

// --- MODAL UTILS ---
function initDatePickers(container) {
    if (typeof flatpickr !== 'undefined') {
        const inputs = container.querySelectorAll('input[type="date"]');
        if (inputs.length > 0) {
            flatpickr(inputs, {
                dateFormat: "Y-m-d",
                locale: "fr",
                allowInput: true
            });
        }
    }
}

function showModal(content) {
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modalBody');
    if (!modal || !modalBody) {
        alert("Error: Modal not found");
        return;
    }
    modalBody.innerHTML = content;
    initDatePickers(modalBody);
    modal.style.display = 'flex';
}

function closeModal() {
    const modal = document.getElementById('modal');
    if (modal) modal.style.display = 'none';
}

// ========================================
// TACHYDRIVE - COMPLETE IMPLEMENTATION
// ========================================

window.tachoData = null; // Store loaded data globally

function renderTachyDrive() {
    return `
        <div class="fade-in">
            <h2 style="margin-bottom: 2rem;">TachyDrive - Analyse Tachygraphe</h2>
            
            <!-- Upload Section -->
            <div class="card">
                <h3>Importer un fichier</h3>
                <div class="form-group">
                    <label>Fichier carte (.ddd, .c1b, .tgd, .v1b)</label>
                    <input type="file" id="tachoFileInput" accept=".ddd,.c1b,.tgd,.v1b" class="form-control">
                </div>
                <button class="btn btn-primary" onclick="uploadTachoFile()">📤 Analyser</button>
            </div>
            
            <!-- Filters Section (hidden until data loaded) -->
            <div id="tachoFilters" style="display: none; margin-top: 1.5rem;">
                <div class="card">
                    <h3>Filtres & Export</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                        <div class="form-group" style="margin: 0;">
                            <label>Date debut</label>
                            <input type="date" id="tachoDateStart" class="form-control" onchange="filterTachoData()">
                        </div>
                        <div class="form-group" style="margin: 0;">
                            <label>Date fin</label>
                            <input type="date" id="tachoDateEnd" class="form-control" onchange="filterTachoData()">
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-secondary" onclick="resetTachoFilters()">🔄 Reinitialiser</button>
                        <button class="btn btn-success" onclick="downloadTachoCSV()">📥 Telecharger CSV</button>
                        <button class="btn btn-primary" onclick="downloadTachoPDF()">📄 Telecharger PDF</button>
                    </div>
                </div>
            </div>
            
            <!-- Results Section -->
            <div id="tachoResults" style="margin-top: 1.5rem;"></div>
        </div>
    `;
}

window.uploadTachoFile = async () => {
    const fileInput = document.getElementById('tachoFileInput');
    const file = fileInput.files[0];

    if (!file) {
        alert("Selectionnez un fichier");
        return;
    }

    const formData = new FormData();
    formData.append('card', file);

    try {
        document.getElementById('tachoResults').innerHTML = '<div class="card"><p>Analyse en cours...</p><div class="loading"></div></div>';

        const response = await fetch('http://localhost:3000/api/upload-card', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Upload failed');

        const data = await response.json();

        // Store data globally
        window.tachoData = data;

        // Show filters
        document.getElementById('tachoFilters').style.display = 'block';

        // Set default date range (first and last day)
        if (data.days && data.days.length > 0) {
            const dates = data.days.map(d => d.date.split('T')[0]).sort();
            document.getElementById('tachoDateStart').value = dates[0];
            document.getElementById('tachoDateEnd').value = dates[dates.length - 1];

            // Initialize modern date pickers
            setTimeout(() => initTachoDatePickers(), 100);
        }

        displayTachoResults(data);
    } catch (err) {
        document.getElementById('tachoResults').innerHTML = `<div class="alert alert-danger">Erreur: ${err.message}</div>`;
    }
};

function displayTachoResults(data) {
    const resultsDiv = document.getElementById('tachoResults');

    console.log("Tacho data received:", data);

    let days = data.days || data.activities || [];

    if (days.length === 0) {
        resultsDiv.innerHTML = '<div class="alert alert-warning">Aucune activite trouvee dans le fichier</div>';
        return;
    }

    // Get filter dates
    const startDate = document.getElementById('tachoDateStart')?.value;
    const endDate = document.getElementById('tachoDateEnd')?.value;

    // Filter days
    if (startDate) {
        days = days.filter(d => d.date.split('T')[0] >= startDate);
    }
    if (endDate) {
        days = days.filter(d => d.date.split('T')[0] <= endDate);
    }

    // Filter infractions to match selected period
    let infractions = data.infractions || [];
    if (startDate || endDate) {
        infractions = infractions.filter(inf => {
            if (!inf.date) return true; // Keep infractions without date
            const infDate = inf.date.split('T')[0];
            if (startDate && infDate < startDate) return false;
            if (endDate && infDate > endDate) return false;
            return true;
        });
    }

    let html = `
        <div class="card" style="margin-top: 1rem;">
            <h3>Activites - ${days.length} jours</h3>
            ${data.driver ? `<p style="color: var(--text-secondary); margin-bottom: 1rem;">Chauffeur: <strong>${data.driver.name}</strong></p>` : ''}
            
            <table class="custom-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Conduite</th>
                        <th>Autre Travail</th>
                        <th>Disponible</th>
                        <th>Repos</th>
                        <th>Total Travail</th>
                    </tr>
                </thead>
                <tbody>
    `;

    days.forEach(day => {
        const driving = day.drivingHours || 0;
        const work = day.otherWorkHours || 0;
        const available = day.availableHours || 0;
        const rest = day.restHours || 0;
        const total = day.totalWorkHours || (driving + work);

        html += `
            <tr>
                <td><strong>${day.date.split('T')[0]}</strong></td>
                <td>${formatHours(driving)}</td>
                <td>${formatHours(work)}</td>
                <td>${formatHours(available)}</td>
                <td>${formatHours(rest)}</td>
                <td><strong>${formatHours(total)}</strong></td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    // Add infractions if any (filtered)
    if (infractions && infractions.length > 0) {
        html += `
            <div class="card" style="margin-top: 1rem; border-left: 4px solid var(--danger);">
                <h3 style="color: var(--danger);">⚠️ Infractions detectees (${infractions.length})</h3>
                ${infractions.map(inf => `
                    <div class="alert alert-danger" style="margin-bottom: 0.5rem;">
                        <strong>${inf.type}</strong> - ${inf.description}
                        ${inf.date ? `<br><small>Date: ${inf.date}</small>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }

    resultsDiv.innerHTML = html;
}

function formatHours(hours) {
    if (!hours || hours === 0) return '-';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h${m.toString().padStart(2, '0')}`;
}

// ========================================
// TODO LIST - COMPLETE IMPLEMENTATION
// ========================================

// --- TODO LIST REWORKED & PERSISTENT ---

// 1. Initialisation (Lecture du LocalStorage)
try {
    window.todos = JSON.parse(localStorage.getItem('app_todos') || '[]');
} catch (e) {
    window.todos = [];
}

// 2. Helper Sauvegarde
function persistTodos() {
    localStorage.setItem('app_todos', JSON.stringify(window.todos));
}

// 3. Rendu (Nouveau Design)
function renderTodo() {
    return `
        <div class="card fade-in" style="min-height: 80vh;">
            <div class="page-header-responsive" style="margin-bottom: 2rem;">
                <div class="header-group">
                    <h2 style="margin: 0;">📝 Ma To-Do List</h2>
                    <span class="badge badge-secondary">${window.todos.filter(t => !t.completed).length} restantes</span>
                </div>
                <button class="btn btn-primary btn-add-responsive" onclick="openTodoModal()">+ Nouvelle Tâche</button>
            </div>

            ${window.todos.length === 0 ? `
                <div style="text-align: center; padding: 4rem 2rem; color: var(--text-muted);">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">🎉</div>
                    <p style="font-size: 1.2rem;">Tout est propre !<br>Aucune tâche à faire.</p>
                </div>
            ` : `
                <div class="todo-container" style="display: flex; flex-direction: column; gap: 1rem;">
                    ${window.todos.map(t => `
                        <div class="todo-card ${t.completed ? 'completed' : ''}" 
                             style="
                                background: ${t.completed ? '#f8f9fa' : '#fff'}; 
                                border: 1px solid ${t.completed ? '#e9ecef' : '#dee2e6'}; 
                                border-left: 4px solid ${t.completed ? '#28a745' : '#3b82f6'};
                                padding: 1rem; 
                                border-radius: 8px; 
                                display: flex; 
                                align-items: flex-start; 
                                gap: 1rem;
                                transition: all 0.2s;
                                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                             ">
                            
                            <!-- Checkbox Custom -->
                            <div style="padding-top: 0.25rem;">
                                <input type="checkbox" 
                                    ${t.completed ? 'checked' : ''} 
                                    onchange="toggleTodo(${t.id})"
                                    style="width: 20px; height: 20px; cursor: pointer;"
                                >
                            </div>

                            <!-- Contenu Texte (Sécurisé contre débordement) -->
                            <div style="flex: 1; min-width: 0;">
                                <h4 style="
                                    margin: 0 0 0.25rem 0; 
                                    font-size: 1.1rem; 
                                    text-decoration: ${t.completed ? 'line-through' : 'none'};
                                    color: ${t.completed ? '#6c757d' : '#212529'};
                                    overflow-wrap: anywhere;
                                    word-break: break-word; /* IMPORTANT */
                                    white-space: normal;
                                ">${t.title}</h4>
                                
                                ${t.description ? `
                                    <p style="
                                        margin: 0; 
                                        color: #6c757d; 
                                        font-size: 0.95rem;
                                        overflow-wrap: anywhere;
                                        word-break: break-word; /* IMPORTANT */
                                        white-space: pre-wrap;
                                    ">${t.description}</p>
                                ` : ''}
                                
                                <div style="margin-top: 0.5rem; font-size: 0.8rem; color: #adb5bd;">
                                    Créé le ${new Date(t.createdAt).toLocaleDateString()}
                                </div>
                            </div>

                            <!-- Actions -->
                            <button onclick="deleteTodo(${t.id})" 
                                class="btn-icon" 
                                style="
                                    background: none; 
                                    border: none; 
                                    font-size: 1.2rem; 
                                    cursor: pointer; 
                                    opacity: 0.5;
                                    padding: 0.25rem;
                                " 
                                onmouseover="this.style.opacity=1" 
                                onmouseout="this.style.opacity=0.5"
                                title="Supprimer"
                            >❌</button>
                        </div>
                    `).join('')}
                </div>
            `}
        </div>
    `;
}

// 4. Modal Ajout
window.openTodoModal = () => {
    showModal(`
        <h3>Nouvelle Tâche</h3>
        <form onsubmit="saveTodo(event)">
            <div class="form-group">
                <label>Titre de la tâche</label>
                <input type="text" name="title" required class="form-control" placeholder="Ex: Appeler le client...">
            </div>
            <div class="form-group">
                <label>Description (Optionnel)</label>
                <textarea name="description" class="form-control" rows="3" placeholder="Détails supplémentaires..."></textarea>
            </div>
            <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem;">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn-primary">Ajouter</button>
            </div>
        </form>
    `);
};

// 5. Logique des Actions (avec Persistance)

window.saveTodo = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const todo = {
        id: Date.now(),
        title: fd.get('title'),
        description: fd.get('description'),
        completed: false,
        createdAt: new Date().toISOString()
    };

    window.todos.unshift(todo); // Ajoute au début
    persistTodos(); // Sauvegarde
    closeModal();
    route();
};

window.toggleTodo = (id) => {
    const todo = window.todos.find(t => t.id === id);
    if (todo) {
        todo.completed = !todo.completed;
        persistTodos(); // Sauvegarde
        route();
    }
};

window.deleteTodo = (id) => {
    if (!confirm("Supprimer cette tâche ?")) return;
    window.todos = window.todos.filter(t => t.id !== id);
    persistTodos(); // Sauvegarde
    route();
};

// ========================================
// DOCUMENT UPLOADS - COMPLETE IMPLEMENTATION
// ========================================

window.uploadDocument = async (type, entityId, file) => {
    const fileName = `${type}_${entityId}_${Date.now()}_${file.name}`;
    const filePath = `${App.user.companyId}/${fileName}`;

    try {
        const { data, error } = await supabase.storage
            .from('documents')
            .upload(filePath, file);

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
            .from('documents')
            .getPublicUrl(filePath);

        return {
            name: file.name,
            url: publicUrl,
            uploadedAt: new Date().toISOString()
        };
    } catch (err) {
        console.error("Upload error:", err);
        throw err;
    }
};

window.openDocumentUploadModal = (type, entityId) => {
    showModal(`
        <h3>Ajouter un document</h3>
        <form onsubmit="handleDocumentUpload(event, '${type}', ${entityId})">
            <div class="form-group">
                <label>Fichier (PDF, Image)</label>
                <input type="file" name="file" accept=".pdf,.jpg,.jpeg,.png" required class="form-control">
            </div>
            <button type="submit" class="btn btn-primary">Upload</button>
        </form>
    `);
};

window.handleDocumentUpload = async (e, type, entityId) => {
    e.preventDefault();
    const file = e.target.file.files[0];

    if (!file) return;

    try {
        const doc = await uploadDocument(type, entityId, file);

        // Update entity with new document
        const table = type === 'vehicle' ? 'vehicles' : 'drivers';
        const entity = type === 'vehicle' ? App.vehicles.find(v => v.id === entityId) : App.drivers.find(d => d.id === entityId);

        if (!entity.documents) entity.documents = [];
        entity.documents.push(doc);

        const { error } = await supabase
            .from(table)
            .update({ documents: entity.documents })
            .eq('id', entityId);

        if (error) throw error;

        alert("Document uploade avec succes!");
        closeModal();
        route();
    } catch (err) {
        alert("Erreur upload: " + err.message);
    }
};

// ========================================
// ATTENDANCE VALIDATIONS & CONDITIONS
// ========================================

window.validateAttendanceEntry = (entry) => {
    const errors = [];

    // Check date is not in future
    const entryDate = new Date(entry.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (entryDate > today) {
        errors.push("La date ne peut pas etre dans le futur");
    }

    // Check manual bonus is reasonable
    if (entry.manualBonus && (entry.manualBonus < 0 || entry.manualBonus > 1000)) {
        errors.push("Le bonus manuel doit etre entre 0 et 1000 EUR");
    }

    return errors;
};

window.calculateMonthlyStats = (driverId, month, year) => {
    const entries = App.attendance.filter(a => {
        const d = new Date(a.date);
        return a.driverId === driverId && d.getMonth() === month && d.getFullYear() === year;
    });

    const stats = {
        totalDays: entries.length,
        presentDays: entries.filter(e => e.status === 'present').length,
        absentDays: entries.filter(e => e.status === 'absent').length,
        totalBonus: entries.reduce((sum, e) => sum + (e.manualBonus || 0), 0),
        saturdaysWorked: entries.filter(e => {
            const d = new Date(e.date);
            return d.getDay() === 6 && e.status === 'present';
        }).length,
        weekdaysWorked: entries.filter(e => {
            const d = new Date(e.date);
            return d.getDay() >= 1 && d.getDay() <= 5 && e.status === 'present';
        }).length
    };

    return stats;
};

// ========================================
// VEHICLE VALIDATIONS
// ========================================

window.validateVehicle = (vehicle) => {
    const errors = [];

    if (!vehicle.plate || vehicle.plate.trim().length === 0) {
        errors.push("La plaque est obligatoire");
    }

    if (vehicle.km && vehicle.km < 0) {
        errors.push("Le kilometrage ne peut pas etre negatif");
    }

    // Check insurance expiry
    if (vehicle.insurance_expiry) {
        const expiry = new Date(vehicle.insurance_expiry);
        const today = new Date();
        const daysUntilExpiry = Math.floor((expiry - today) / (1000 * 60 * 60 * 24));

        if (daysUntilExpiry < 0) {
            errors.push("ALERTE: Assurance expiree!");
        } else if (daysUntilExpiry < 30) {
            errors.push("ATTENTION: Assurance expire dans " + daysUntilExpiry + " jours");
        }
    }

    return errors;
};

// ========================================
// DRIVER VALIDATIONS
// ========================================

window.validateDriver = (driver) => {
    const errors = [];

    if (!driver.name || driver.name.trim().length === 0) {
        errors.push("Le nom est obligatoire");
    }

    // Check license expiry
    if (driver.license_expiry) {
        const expiry = new Date(driver.license_expiry);
        const today = new Date();
        const daysUntilExpiry = Math.floor((expiry - today) / (1000 * 60 * 60 * 24));

        if (daysUntilExpiry < 0) {
            errors.push("ALERTE: Permis expire!");
        } else if (daysUntilExpiry < 30) {
            errors.push("ATTENTION: Permis expire dans " + daysUntilExpiry + " jours");
        }
    }

    // Check medical expiry
    if (driver.medical_expiry) {
        const expiry = new Date(driver.medical_expiry);
        const today = new Date();
        const daysUntilExpiry = Math.floor((expiry - today) / (1000 * 60 * 60 * 24));

        if (daysUntilExpiry < 0) {
            errors.push("ALERTE: Visite medicale expiree!");
        } else if (daysUntilExpiry < 30) {
            errors.push("ATTENTION: Visite medicale expire dans " + daysUntilExpiry + " jours");
        }
    }

    return errors;
};

console.log("All features loaded successfully!");






// ========================================
// TACHYDRIVE - FILTERS & EXPORT
// ========================================

window.filterTachoData = () => {
    if (!window.tachoData) return;

    const startDate = document.getElementById('tachoDateStart').value;
    const endDate = document.getElementById('tachoDateEnd').value;

    let filteredDays = window.tachoData.days || [];

    if (startDate) {
        filteredDays = filteredDays.filter(d => d.date >= startDate);
    }

    if (endDate) {
        filteredDays = filteredDays.filter(d => d.date <= endDate);
    }

    const filteredData = {
        ...window.tachoData,
        days: filteredDays
    };

    displayTachoResults(filteredData);
};

window.resetTachoFilters = () => {
    document.getElementById('tachoDateStart').value = '';
    document.getElementById('tachoDateEnd').value = '';
    if (window.tachoData) {
        displayTachoResults(window.tachoData);
    }
};

window.downloadTachoCSV = () => {
    if (!window.tachoData || !window.tachoData.days) {
        alert("Aucune donnee a exporter");
        return;
    }

    const startDate = document.getElementById('tachoDateStart').value;
    const endDate = document.getElementById('tachoDateEnd').value;

    let days = window.tachoData.days;

    if (startDate) days = days.filter(d => d.date >= startDate);
    if (endDate) days = days.filter(d => d.date <= endDate);

    // CSV Header
    let csv = 'Date,Conduite (h),Autre Travail (h),Disponible (h),Repos (h),Total Travail (h)\n';

    // CSV Rows
    days.forEach(day => {
        const driving = (day.drivingHours || 0).toFixed(2);
        const work = (day.otherWorkHours || 0).toFixed(2);
        const available = (day.availableHours || 0).toFixed(2);
        const rest = (day.restHours || 0).toFixed(2);
        const total = (day.totalWorkHours || 0).toFixed(2);

        csv += `${day.date.split('T')[0]},${driving},${work},${available},${rest},${total}\n`;
    });

    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const driverName = window.tachoData.driver ? window.tachoData.driver.name.replace(/\s/g, '_') : 'chauffeur';
    const filename = `tachydrive_${driverName}_${new Date().toISOString().split('T')[0]}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.downloadTachoPDF = () => {
    if (!window.tachoData || !window.tachoData.days) {
        alert("Aucune donnee a exporter");
        return;
    }

    const startDate = document.getElementById('tachoDateStart').value;
    const endDate = document.getElementById('tachoDateEnd').value;

    let days = window.tachoData.days;

    if (startDate) days = days.filter(d => d.date >= startDate);
    if (endDate) days = days.filter(d => d.date <= endDate);

    // Create printable HTML
    const driverName = window.tachoData.driver ? window.tachoData.driver.name : 'Chauffeur';
    const period = startDate && endDate ? `${startDate} au ${endDate}` : 'Toutes les dates';

    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>TachyDrive - ${driverName}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { color: #333; border-bottom: 2px solid #4F46E5; padding-bottom: 10px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background: #4F46E5; color: white; }
                tr:nth-child(even) { background: #f9f9f9; }
                .header { margin-bottom: 20px; }
                .footer { margin-top: 30px; font-size: 0.9em; color: #666; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>TachyDrive - Rapport d'Activite</h1>
                <p><strong>Chauffeur:</strong> ${driverName}</p>
                <p><strong>Periode:</strong> ${period}</p>
                <p><strong>Nombre de jours:</strong> ${days.length}</p>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Conduite</th>
                        <th>Autre Travail</th>
                        <th>Disponible</th>
                        <th>Repos</th>
                        <th>Total Travail</th>
                    </tr>
                </thead>
                <tbody>
    `;

    days.forEach(day => {
        const driving = formatHours(day.drivingHours || 0);
        const work = formatHours(day.otherWorkHours || 0);
        const available = formatHours(day.availableHours || 0);
        const rest = formatHours(day.restHours || 0);
        const total = formatHours(day.totalWorkHours || 0);

        html += `
            <tr>
                <td>${day.date.split('T')[0]}</td>
                <td>${driving}</td>
                <td>${work}</td>
                <td>${available}</td>
                <td>${rest}</td>
                <td><strong>${total}</strong></td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
    `;

    // Filter infractions for selected period
    let pdfInfractions = window.tachoData.infractions || [];
    if (startDate || endDate) {
        pdfInfractions = pdfInfractions.filter(inf => {
            if (!inf.date) return true;
            const infDate = inf.date.split('T')[0];
            if (startDate && infDate < startDate) return false;
            if (endDate && infDate > endDate) return false;
            return true;
        });
    }

    // Add infractions section
    if (pdfInfractions && pdfInfractions.length > 0) {
        html += `
            <div style="margin-top: 30px; page-break-before: auto;">
                <h2 style="color: #EF4444; border-bottom: 2px solid #EF4444; padding-bottom: 10px;">
                    Infractions RSE Detectees (${pdfInfractions.length})
                </h2>
                <table>
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Type</th>
                            <th>Description</th>
                            <th>Date</th>
                            <th>Gravite</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        pdfInfractions.forEach(inf => {
            const severityColor = {
                'TRES_GRAVE': '#DC2626',
                'GRAVE': '#EF4444',
                'MOYENNE': '#F59E0B',
                'LEGERE': '#10B981'
            }[inf.severity] || '#6B7280';

            html += `
                <tr>
                    <td><strong>${inf.code}</strong></td>
                    <td>${inf.type}</td>
                    <td>${inf.description}</td>
                    <td>${inf.date || '-'}</td>
                    <td style="color: ${severityColor}; font-weight: bold;">${inf.severity || 'MOYENNE'}</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
                
                <div style="margin-top: 20px; padding: 15px; background: #FEF3C7; border-left: 4px solid #F59E0B;">
                    <h3 style="margin-top: 0; color: #92400E;">Rappel Reglementation RSE (CE 561/2006)</h3>
                    <ul style="margin: 0; padding-left: 20px; color: #92400E;">
                        <li><strong>Conduite continue:</strong> Max 4h30 sans pause de 45min (ou 15min+30min)</li>
                        <li><strong>Conduite journaliere:</strong> Max 9h (10h possible 2x/semaine)</li>
                        <li><strong>Conduite hebdomadaire:</strong> Max 56h/semaine, 90h/2 semaines</li>
                        <li><strong>Repos journalier:</strong> Min 11h (9h reduit 3x/semaine)</li>
                        <li><strong>Repos hebdomadaire:</strong> Min 45h avant fin 6 jours de conduite</li>
                    </ul>
                </div>
            </div>
        `;
    } else {
        html += `
            <div style="margin-top: 30px; padding: 20px; background: #D1FAE5; border-left: 4px solid #10B981; text-align: center;">
                <h3 style="color: #065F46; margin: 0;">Aucune infraction detectee</h3>
                <p style="color: #065F46; margin: 10px 0 0 0;">Toutes les regles RSE sont respectees</p>
            </div>
        `;
    }

    html += `
            <div class="footer">
                <p>Genere le ${new Date().toLocaleDateString('fr-FR')} par 3 Essieux Manager</p>
                <p style="font-size: 0.8em; color: #999;">Conforme au Reglement (CE) n 561/2006 relatif aux temps de conduite et de repos</p>
            </div>
        </body>
        </html>
    `;

    // Open in new window for printing
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();

    // Auto-print after load
    printWindow.onload = () => {
        printWindow.print();
    };
};




// ========================================
// TACHYDRIVE - MODERN DATE PICKER
// ========================================

window.initTachoDatePickers = () => {
    // Initialize Flatpickr for date inputs
    if (typeof flatpickr !== 'undefined') {
        flatpickr("#tachoDateStart", {
            dateFormat: "Y-m-d",
            locale: "fr",
            onChange: function (selectedDates, dateStr, instance) {
                filterTachoData();
            }
        });

        flatpickr("#tachoDateEnd", {
            dateFormat: "Y-m-d",
            locale: "fr",
            onChange: function (selectedDates, dateStr, instance) {
                filterTachoData();
            }
        });
    }
};




// ========================================
// VEHICLE DETAIL VIEW WITH DOCUMENTS
// ========================================

window.openVehicleDetail = (vehicleId) => {
    const vehicle = App.vehicles.find(v => v.id === vehicleId);
    if (!vehicle) return;

    const documents = vehicle.documents || [];
    const alerts = validateVehicle(vehicle);

    // Calculate days until expiration for each document
    const getExpiryStatus = (expiryDate) => {
        if (!expiryDate) return { text: '-', color: '#6B7280' };
        const expiry = new Date(expiryDate);
        const today = new Date();
        const daysUntil = Math.floor((expiry - today) / (1000 * 60 * 60 * 24));

        if (daysUntil < 0) return { text: 'EXPIRE', color: '#DC2626' };
        if (daysUntil <= 60) return { text: `${daysUntil} jours`, color: '#F59E0B' };
        return { text: `${daysUntil} jours`, color: '#10B981' };
    };

    showModal(`
        <div style="max-width: 800px;">
            <h2>🚛 ${vehicle.plate}</h2>
            
            <!-- Vehicle Info -->
            <div class="card" style="margin-bottom: 1rem; background: var(--bg-secondary);">
                <div class="page-header-responsive">
                    <h3 style="margin: 0;">Informations</h3>
                    <button class="btn btn-sm btn-primary btn-add-responsive" onclick="openEditVehicleModal(${vehicleId})">✏️ Modifier</button>
                </div>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                    <div>
                        <label style="font-size: 0.85rem; color: var(--text-secondary);">Modele</label>
                        <p style="margin: 0; font-weight: 600;">${vehicle.model || '-'}</p>
                    </div>
                    <div>
                        <label style="font-size: 0.85rem; color: var(--text-secondary);">Type</label>
                        <p style="margin: 0; font-weight: 600;">${vehicle.type || '-'}</p>
                    </div>
                    <div>
                        <label style="font-size: 0.85rem; color: var(--text-secondary);">Kilometrage</label>
                        <p style="margin: 0; font-weight: 600;">${vehicle.km || 0} km</p>
                    </div>
                    <div>
                        <label style="font-size: 0.85rem; color: var(--text-secondary);">Statut</label>
                        <p style="margin: 0; font-weight: 600;">${vehicle.status || 'active'}</p>
                    </div>
                </div>
            </div>
            
            <!-- Alerts -->
            ${alerts.length > 0 ? `
                <div class="alert alert-warning" style="margin-bottom: 1rem;">
                    <strong>⚠️ Alertes:</strong><br>
                    ${alerts.join('<br>')}
                </div>
            ` : ''}
            
            <!-- Documents Section -->
            <div class="card">
                <div class="page-header-responsive">
                    <h3 style="margin: 0;">Documents (${documents.length})</h3>
                    <button class="btn btn-primary btn-sm btn-add-responsive" onclick="openAddDocumentModal(${vehicleId}, 'vehicle')">
                        + Ajouter Document
                    </button>
                </div>
                
                ${documents.length > 0 ? `
                    <!-- DESKTOP VIEW -->
                    <div class="desktop-view">
                        <table class="custom-table">
                            <thead>
                                <tr>
                                    <th>Nom</th>
                                    <th>Date Expiration</th>
                                    <th>Statut</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${documents.map((doc, idx) => {
        const status = getExpiryStatus(doc.expiryDate);
        return `
                                        <tr>
                                            <td><strong>${doc.name}</strong></td>
                                            <td>${doc.expiryDate || '-'}</td>
                                            <td><span style="color: ${status.color}; font-weight: 600;">${status.text}</span></td>
                                            <td>
                                                <a href="${doc.url}" target="_blank" class="btn btn-sm btn-light">📄 Voir</a>
                                                <button class="btn btn-sm btn-danger" onclick="deleteDocument(${vehicleId}, 'vehicle', ${idx})">🗑️</button>
                                            </td>
                                        </tr>
                                    `;
    }).join('')}
                            </tbody>
                        </table>
                    </div>

                    <!-- MOBILE VIEW -->
                    <div class="mobile-view">
                        ${documents.map((doc, idx) => {
        const status = getExpiryStatus(doc.expiryDate);
        return `
                                <div class="mobile-card" style="margin-bottom: 0.75rem;">
                                    <div class="mobile-card-header" style="border-bottom: 1px solid #eee; padding-bottom: 0.5rem; margin-bottom: 0.5rem;">
                                        <strong>${doc.name}</strong>
                                        <span style="color: ${status.color}; font-weight: 600; font-size: 0.85rem;">${status.text}</span>
                                    </div>
                                    <div class="mobile-card-body" style="margin-bottom: 0.5rem;">
                                        <div class="mobile-card-row">
                                            <span>Expiration:</span>
                                            <span>${doc.expiryDate || '-'}</span>
                                        </div>
                                    </div>
                                    <div class="mobile-card-footer" style="padding-top: 0.5rem; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 0.5rem;">
                                        <a href="${doc.url}" target="_blank" class="btn btn-sm btn-light" style="flex: 1; text-align: center;">📄 Voir</a>
                                        <button class="btn btn-sm btn-danger" style="flex: 1;" onclick="deleteDocument(${vehicleId}, 'vehicle', ${idx})">🗑️ Supprimer</button>
                                    </div>
                                </div>
                            `;
    }).join('')}
                    </div>
                ` : '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">Aucun document</p>'}
            </div>
            
            <div style="margin-top: 1.5rem; display: flex; gap: 0.5rem; justify-content: flex-end;">
                <button class="btn btn-secondary" onclick="closeModal()">Fermer</button>
            </div>
        </div>
    `);
};

window.openAddDocumentModal = (entityId, entityType) => {
    showModal(`
        <h3>Ajouter un Document</h3>
        <form onsubmit="handleAddDocument(event, ${entityId}, '${entityType}')">
            <div class="form-group">
                <label>Nom du document *</label>
                <input type="text" name="docName" required class="form-control" placeholder="Ex: Assurance, Carte Grise, Controle Technique">
            </div>
            
            <div class="form-group">
                <label>Date d'expiration</label>
                <input type="date" name="expiryDate" class="form-control">
                <small style="color: var(--text-muted);">Alerte 60 jours avant expiration</small>
            </div>
            
            <div class="form-group">
                <label>Fichier (PDF, Image) *</label>
                <input type="file" name="file" accept=".pdf,.jpg,.jpeg,.png" required class="form-control">
            </div>
            
            <div style="display: flex; gap: 0.5rem; margin-top: 1.5rem;">
                <button type="submit" class="btn btn-primary">📤 Uploader</button>
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Annuler</button>
            </div>
        </form>
    `);
};

window.handleAddDocument = async (e, entityId, entityType) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const docName = formData.get('docName');
    const expiryDate = formData.get('expiryDate');
    const file = formData.get('file');

    if (!file) {
        alert("Sélectionnez un fichier");
        return;
    }

    try {
        // Show loading
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<div class="loading"></div> Upload...';

        // Utiliser StorageManager pour l'upload
        const entityTypeFolder = entityType === 'vehicle' ? 'vehicles' : 'drivers';
        const document = await StorageManager.uploadDocument(
            entityTypeFolder,
            entityId,
            file,
            {
                name: docName,
                expiryDate: expiryDate || null
            }
        );

        console.log("Document uploadé:", document);

        // Update entity dans la base de données
        const table = entityType === 'vehicle' ? 'vehicles' : 'drivers';
        const entity = entityType === 'vehicle'
            ? App.vehicles.find(v => v.id === entityId)
            : App.drivers.find(d => d.id === entityId);

        if (!entity.documents) entity.documents = [];
        entity.documents.push(document);

        const { error: updateError } = await supabase
            .from(table)
            .update({ documents: entity.documents })
            .eq('id', entityId);

        if (updateError) throw updateError;

        alert("✅ Document ajouté avec succès!");
        closeModal();

        // Reopen detail view
        if (entityType === 'vehicle') {
            openVehicleDetail(entityId);
        } else {
            openDriverDetail(entityId);
        }

    } catch (err) {
        console.error("Upload error:", err);
        alert("Erreur upload: " + err.message);
    }
};

window.deleteDocument = async (entityId, entityType, docIndex) => {
    if (!confirm("Supprimer ce document ?")) return;

    try {
        const table = entityType === 'vehicle' ? 'vehicles' : 'drivers';
        const entity = entityType === 'vehicle'
            ? App.vehicles.find(v => v.id === entityId)
            : App.drivers.find(d => d.id === entityId);

        entity.documents.splice(docIndex, 1);

        const { error } = await supabase
            .from(table)
            .update({ documents: entity.documents })
            .eq('id', entityId);

        if (error) throw error;

        alert("Document supprime");
        closeModal();

        if (entityType === 'vehicle') {
            openVehicleDetail(entityId);
        } else {
            openDriverDetail(entityId);
        }

    } catch (err) {
        alert("Erreur: " + err.message);
    }
};

// ========================================
// DRIVER DETAIL VIEW (SAME AS VEHICLE)
// ========================================

window.openDriverDetail = (driverId) => {
    const driver = App.drivers.find(d => d.id === driverId);
    if (!driver) return;

    const documents = driver.documents || [];
    const alerts = validateDriver(driver);

    const getExpiryStatus = (expiryDate) => {
        if (!expiryDate) return { text: '-', color: '#6B7280' };
        const expiry = new Date(expiryDate);
        const today = new Date();
        const daysUntil = Math.floor((expiry - today) / (1000 * 60 * 60 * 24));

        if (daysUntil < 0) return { text: 'EXPIRE', color: '#DC2626' };
        if (daysUntil <= 60) return { text: `${daysUntil} jours`, color: '#F59E0B' };
        return { text: `${daysUntil} jours`, color: '#10B981' };
    };

    showModal(`
        <div style="max-width: 800px;">
            <h2>👤 ${driver.name}</h2>
            
            <div class="card" style="margin-bottom: 1rem; background: var(--bg-secondary);">
                <div class="page-header-responsive">
                    <h3 style="margin: 0;">Informations</h3>
                    <button class="btn btn-sm btn-primary btn-add-responsive" onclick="openEditDriverModal(${driverId})">✏️ Modifier</button>
                </div>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                    <div>
                        <label style="font-size: 0.85rem; color: var(--text-secondary);">Telephone</label>
                        <p style="margin: 0; font-weight: 600;">${driver.phone || '-'}</p>
                    </div>
                    <div>
                        <label style="font-size: 0.85rem; color: var(--text-secondary);">Type Permis</label>
                        <p style="margin: 0; font-weight: 600;">${driver.license_type || '-'}</p>
                    </div>
                    <div>
                        <label style="font-size: 0.85rem; color: var(--text-secondary);">Expiration Permis</label>
                        <p style="margin: 0; font-weight: 600;">${driver.license_expiry || '-'}</p>
                    </div>
                    <div>
                        <label style="font-size: 0.85rem; color: var(--text-secondary);">Visite Medicale</label>
                        <p style="margin: 0; font-weight: 600;">${driver.medical_expiry || '-'}</p>
                    </div>
                </div>
            </div>
            
            ${alerts.length > 0 ? `
                <div class="alert alert-warning" style="margin-bottom: 1rem;">
                    <strong>⚠️ Alertes:</strong><br>
                    ${alerts.join('<br>')}
                </div>
            ` : ''}
            
            <div class="card">
                <div class="page-header-responsive">
                    <h3 style="margin: 0;">Documents (${documents.length})</h3>
                    <button class="btn btn-primary btn-sm btn-add-responsive" onclick="openAddDocumentModal(${driverId}, 'driver')">
                        + Ajouter Document
                    </button>
                </div>
                
                ${documents.length > 0 ? `
                    <!-- DESKTOP VIEW -->
                    <div class="desktop-view">
                        <table class="custom-table">
                            <thead>
                                <tr>
                                    <th>Nom</th>
                                    <th>Date Expiration</th>
                                    <th>Statut</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${documents.map((doc, idx) => {
        const status = getExpiryStatus(doc.expiryDate);
        return `
                                        <tr>
                                            <td><strong>${doc.name}</strong></td>
                                            <td>${doc.expiryDate || '-'}</td>
                                            <td><span style="color: ${status.color}; font-weight: 600;">${status.text}</span></td>
                                            <td>
                                                <a href="${doc.url}" target="_blank" class="btn btn-sm btn-light">📄 Voir</a>
                                                <button class="btn btn-sm btn-danger" onclick="deleteDocument(${driverId}, 'driver', ${idx})">🗑️</button>
                                            </td>
                                        </tr>
                                    `;
    }).join('')}
                            </tbody>
                        </table>
                    </div>

                    <!-- MOBILE VIEW -->
                    <div class="mobile-view">
                        ${documents.map((doc, idx) => {
        const status = getExpiryStatus(doc.expiryDate);
        return `
                                <div class="mobile-card" style="margin-bottom: 0.75rem;">
                                    <div class="mobile-card-header" style="border-bottom: 1px solid #eee; padding-bottom: 0.5rem; margin-bottom: 0.5rem;">
                                        <strong>${doc.name}</strong>
                                        <span style="color: ${status.color}; font-weight: 600; font-size: 0.85rem;">${status.text}</span>
                                    </div>
                                    <div class="mobile-card-body" style="margin-bottom: 0.5rem;">
                                        <div class="mobile-card-row">
                                            <span>Expiration:</span>
                                            <span>${doc.expiryDate || '-'}</span>
                                        </div>
                                    </div>
                                    <div class="mobile-card-footer" style="padding-top: 0.5rem; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 0.5rem;">
                                        <a href="${doc.url}" target="_blank" class="btn btn-sm btn-light" style="flex: 1; text-align: center;">📄 Voir</a>
                                        <button class="btn btn-sm btn-danger" style="flex: 1;" onclick="deleteDocument(${driverId}, 'driver', ${idx})">🗑️ Supprimer</button>
                                    </div>
                                </div>
                            `;
    }).join('')}
                    </div>
                ` : '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">Aucun document</p>'}
            </div>
            
            <div style="margin-top: 1.5rem; display: flex; gap: 0.5rem; justify-content: flex-end;">
                <button class="btn btn-secondary" onclick="closeModal()">Fermer</button>
            </div>
        </div>
    `);
};




// ========================================
// EDIT VEHICLE/DRIVER
// ========================================

window.openEditVehicleModal = (vehicleId) => {
    const vehicle = App.vehicles.find(v => v.id === vehicleId);
    if (!vehicle) return;

    showModal(`
        <h3>Modifier le Vehicule</h3>
        <form onsubmit="saveVehicleEdit(event, ${vehicleId})">
            <div class="form-group">
                <label>Plaque</label>
                <input type="text" name="plate" value="${vehicle.plate}" required class="form-control">
            </div>
            <div class="form-group">
                <label>Modele</label>
                <input type="text" name="model" value="${vehicle.model || ''}" class="form-control">
            </div>
            <div class="form-group">
                <label>Type</label>
                <input type="text" name="type" value="${vehicle.type || ''}" class="form-control">
            </div>
            <div class="form-group">
                <label>Kilometrage</label>
                <input type="number" name="km" value="${vehicle.km || 0}" class="form-control">
            </div>
            <div class="form-group">
                <label>Statut</label>
                <select name="status" class="form-control">
                    <option value="active" ${vehicle.status === 'active' ? 'selected' : ''}>Actif</option>
                    <option value="maintenance" ${vehicle.status === 'maintenance' ? 'selected' : ''}>Maintenance</option>
                    <option value="inactive" ${vehicle.status === 'inactive' ? 'selected' : ''}>Inactif</option>
                </select>
            </div>
            <div style="display: flex; gap: 0.5rem; margin-top: 1.5rem;">
                <button type="submit" class="btn btn-primary">💾 Enregistrer</button>
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Annuler</button>
            </div>
        </form>
    `);
};

window.saveVehicleEdit = async (e, vehicleId) => {
    e.preventDefault();
    const fd = new FormData(e.target);

    const updates = {
        plate: fd.get('plate'),
        model: fd.get('model'),
        type: fd.get('type'),
        km: parseInt(fd.get('km')) || 0,
        status: fd.get('status')
    };

    try {
        const { error } = await supabase
            .from('vehicles')
            .update(updates)
            .eq('id', vehicleId);

        if (error) throw error;

        // Update local state
        const vehicle = App.vehicles.find(v => v.id === vehicleId);
        Object.assign(vehicle, updates);

        // --- RAFRAICHISSEMENT DE LA VUE LISTE EN ARRIÈRE-PLAN ---
        // 1. Ré-appliquer le filtre actuel
        const term = (window.vehicleSearchTerm || '').toLowerCase();
        const filteredVehicles = App.vehicles.filter(v =>
            v.plate.toLowerCase().includes(term) ||
            (v.model && v.model.toLowerCase().includes(term)) ||
            (v.type && v.type.toLowerCase().includes(term))
        );

        // 2. Mettre à jour le Tableau Desktop
        const tbody = document.getElementById('vehicleTableBody');
        if (tbody) tbody.innerHTML = renderVehicleRows(filteredVehicles);

        // 3. Mettre à jour les Cartes Mobile
        const mobileContainer = document.querySelector('#vehicles-view .mobile-view');
        if (mobileContainer) mobileContainer.innerHTML = renderVehicleCards(filteredVehicles);
        // ---------------------------------------------------------

        alert("✅ Vehicule modifie!");
        closeModal();
        openVehicleDetail(vehicleId);

    } catch (err) {
        alert("Erreur: " + err.message);
    }
};

window.openEditDriverModal = (driverId) => {
    const driver = App.drivers.find(d => d.id === driverId);
    if (!driver) return;

    showModal(`
        <h3>Modifier le Chauffeur</h3>
        <form onsubmit="saveDriverEdit(event, ${driverId})">
            <div class="form-group">
                <label>Nom</label>
                <input type="text" name="name" value="${driver.name}" required class="form-control">
            </div>
            <div class="form-group">
                <label>Telephone</label>
                <input type="text" name="phone" value="${driver.phone || ''}" class="form-control">
            </div>
            <div class="form-group">
                <label>Type Permis</label>
                <div style="max-height: 150px; overflow-y: auto; border: 1px solid #ced4da; padding: 0.5rem; border-radius: 0.25rem; background: #fff;">
                    ${(() => {
            const currentLicenses = (driver.license_type || '').split(',').map(s => s.trim());
            return ['A1', 'A2', 'A', 'B1', 'B', 'C1', 'C', 'D1', 'D', 'BE', 'C1E', 'CE', 'D1E', 'DE'].map(type => `
                            <label style="display: flex; align-items: center; margin-bottom: 0.25rem; cursor: pointer;">
                                <input type="checkbox" name="license_type" value="${type}" 
                                    ${currentLicenses.includes(type) ? 'checked' : ''} 
                                    style="margin-right: 0.5rem;"
                                > 
                                ${type}
                            </label>
                        `).join('');
        })()}
                </div>
            </div>
            <div class="form-group">
                <label>Expiration Permis</label>
                <input type="date" name="license_expiry" value="${driver.license_expiry || ''}" class="form-control">
            </div>
            <div class="form-group">
                <label>Visite Medicale</label>
                <input type="date" name="medical_expiry" value="${driver.medical_expiry || ''}" class="form-control">
            </div>
            <div class="form-group">
                <label>Statut</label>
                <select name="status" class="form-control">
                    <option value="available" ${driver.status === 'available' ? 'selected' : ''}>Disponible</option>
                    <option value="on_mission" ${driver.status === 'on_mission' ? 'selected' : ''}>En mission</option>
                    <option value="on_leave" ${driver.status === 'on_leave' ? 'selected' : ''}>En conge</option>
                    <option value="inactive" ${driver.status === 'inactive' ? 'selected' : ''}>Inactif</option>
                </select>
            </div>
            <div style="display: flex; gap: 0.5rem; margin-top: 1.5rem;">
                <button type="submit" class="btn btn-primary">💾 Enregistrer</button>
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Annuler</button>
            </div>
        </form>
    `);
};

window.saveDriverEdit = async (e, driverId) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const selectedLicenses = Array.from(e.target.querySelectorAll('input[name="license_type"]:checked')).map(cb => cb.value);

    const updates = {
        name: fd.get('name'),
        phone: fd.get('phone'),
        license_type: selectedLicenses.join(', '),
        license_expiry: fd.get('license_expiry') || null,
        medical_expiry: fd.get('medical_expiry') || null,
        status: fd.get('status')
    };

    try {
        const { error } = await supabase
            .from('drivers')
            .update(updates)
            .eq('id', driverId);

        if (error) throw error;

        // Update local state
        const driver = App.drivers.find(d => d.id === driverId);
        Object.assign(driver, updates);

        alert("✅ Chauffeur modifie!");
        closeModal();
        openDriverDetail(driverId);

    } catch (err) {
        alert("Erreur: " + err.message);
    }
};

// ============================================

async function renderDocumentsPage() {
    const content = document.getElementById('mainContent');

    // Afficher un loader
    content.innerHTML = `
        <div class="card fade-in">
            <h2>📁 Documents</h2>
            <div style="text-align: center; padding: 3rem;">
                <div class="loading" style="margin: 0 auto;"></div>
                <p style="margin-top: 1rem; color: var(--text-secondary);">Chargement des documents...</p>
            </div>
        </div>
    `;

    try {
        // Récupérer tous les documents via la vue SQL
        const { data: allDocs, error } = await supabase
            .from('documents_complete_view')
            .select('*')
            .order('uploaded_at', { ascending: false });

        if (error) throw error;

        // Récupérer les stats
        const stats = await StorageManager.getStorageStats();

        // Grouper par type
        const vehicleDocs = allDocs.filter(d => d.entity_type === 'vehicles');
        const driverDocs = allDocs.filter(d => d.entity_type === 'drivers');
        const tachoDocs = allDocs.filter(d => d.entity_type === 'tachographs');

        content.innerHTML = `
            <div class="fade-in">
                <!-- Header avec stats -->
                <div class="card" style="margin-bottom: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                        <h2 style="margin: 0;">📁 Mes Documents</h2>
                        <div style="display: flex; gap: 1rem; align-items: center;">
                            <input type="text" 
                                id="docSearch" 
                                placeholder="Rechercher..." 
                                class="form-control" 
                                style="width: 250px;"
                                oninput="filterDocuments(this.value)">
                        </div>
                    </div>

                    <!-- Stats cards -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 1.5rem; border-radius: var(--radius-lg); color: white;">
                            <div style="font-size: 0.85rem; opacity: 0.9;">Total Documents</div>
                            <div style="font-size: 2rem; font-weight: 700; margin: 0.5rem 0;">${stats.total_files || 0}</div>
                            <div style="font-size: 0.85rem; opacity: 0.9;">${stats.total_size_mb || 0} MB utilisés</div>
                        </div>

                        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 1.5rem; border-radius: var(--radius-lg); color: white;">
                            <div style="font-size: 0.85rem; opacity: 0.9;">Véhicules</div>
                            <div style="font-size: 2rem; font-weight: 700; margin: 0.5rem 0;">${stats.vehicle_files || 0}</div>
                            <div style="font-size: 0.85rem; opacity: 0.9;">${vehicleDocs.length} documents</div>
                        </div>

                        <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 1.5rem; border-radius: var(--radius-lg); color: white;">
                            <div style="font-size: 0.85rem; opacity: 0.9;">Chauffeurs</div>
                            <div style="font-size: 2rem; font-weight: 700; margin: 0.5rem 0;">${stats.driver_files || 0}</div>
                            <div style="font-size: 0.85rem; opacity: 0.9;">${driverDocs.length} documents</div>
                        </div>

                        <div style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); padding: 1.5rem; border-radius: var(--radius-lg); color: white;">
                            <div style="font-size: 0.85rem; opacity: 0.9;">Tachygraphes</div>
                            <div style="font-size: 2rem; font-weight: 700; margin: 0.5rem 0;">${stats.tacho_files || 0}</div>
                            <div style="font-size: 0.85rem; opacity: 0.9;">${tachoDocs.length} fichiers</div>
                        </div>
                    </div>
                </div>

                <!-- Tabs -->
                <div class="card">
                    <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; border-bottom: 2px solid var(--border); padding-bottom: 0.5rem;">
                        <button class="tab-btn active" onclick="switchDocTab('all')" data-tab="all" style="padding: 0.5rem 1rem; border: none; background: var(--primary); color: white; border-radius: var(--radius); cursor: pointer; font-weight: 600;">
                            Tous (${allDocs.length})
                        </button>
                        <button class="tab-btn" onclick="switchDocTab('vehicles')" data-tab="vehicles" style="padding: 0.5rem 1rem; border: none; background: var(--bg-tertiary); color: var(--text-primary); border-radius: var(--radius); cursor: pointer;">
                            🚛 Véhicules (${vehicleDocs.length})
                        </button>
                        <button class="tab-btn" onclick="switchDocTab('drivers')" data-tab="drivers" style="padding: 0.5rem 1rem; border: none; background: var(--bg-tertiary); color: var(--text-primary); border-radius: var(--radius); cursor: pointer;">
                            👥 Chauffeurs (${driverDocs.length})
                        </button>
                        <button class="tab-btn" onclick="switchDocTab('tachographs')" data-tab="tachographs" style="padding: 0.5rem 1rem; border: none; background: var(--bg-tertiary); color: var(--text-primary); border-radius: var(--radius); cursor: pointer;">
                            📊 Tachygraphes (${tachoDocs.length})
                        </button>
                    </div>

                    <!-- Documents table -->
                    <div id="documentsTableContainer">
                        ${renderDocumentsTable(allDocs)}
                    </div>
                </div>
            </div>
        `;

        // Stocker les docs pour le filtrage
        window.allDocuments = allDocs;

    } catch (error) {
        console.error('Error loading documents:', error);
        content.innerHTML = `
            <div class="card fade-in">
                <h2>📁 Documents</h2>
                <div style="text-align: center; padding: 3rem;">
                    <p style="color: var(--danger); font-size: 1.2rem;">❌ Erreur de chargement</p>
                    <p style="color: var(--text-secondary);">${error.message}</p>
                    <button class="btn btn-primary" onclick="renderDocumentsPage()">Réessayer</button>
                </div>
            </div>
        `;
    }
}

function renderDocumentsTable(docs) {
    if (!docs || docs.length === 0) {
        return `
            <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
                <div style="font-size: 3rem; margin-bottom: 1rem;">📄</div>
                <h3>Aucun document</h3>
                <p>Les documents uploadés apparaîtront ici</p>
            </div>
        `;
    }

    return `
        <div style="overflow-x: auto;">
            <table class="custom-table">
                <thead>
                    <tr>
                        <th>Fichier</th>
                        <th>Type</th>
                        <th>Entité</th>
                        <th>Taille</th>
                        <th>Uploadé le</th>
                        <th>Par</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="documentsTableBody">
                    ${docs.map(doc => `
                        <tr>
                            <td>
                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                    ${getFileIcon(doc.file_name)}
                                    <strong>${doc.file_name}</strong>
                                </div>
                            </td>
                            <td>
                                <span class="badge ${doc.entity_type === 'vehicles' ? 'badge-success' : 'badge-warning'}">
                                    ${doc.entity_type === 'vehicles' ? '🚛 Véhicule' : doc.entity_type === 'drivers' ? '👥 Chauffeur' : '📊 Tachy'}
                                </span>
                            </td>
                            <td>
                                ${doc.vehicle_plate ? `<strong>${doc.vehicle_plate}</strong> ${doc.vehicle_model || ''}` : ''}
                                ${doc.driver_name ? `<strong>${doc.driver_name}</strong>` : ''}
                                ${!doc.vehicle_plate && !doc.driver_name ? '-' : ''}
                            </td>
                            <td>${doc.file_size_mb ? doc.file_size_mb.toFixed(2) + ' MB' : '-'}</td>
                            <td>${doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString('fr-FR') : '-'}</td>
                            <td>
                                <small style="color: var(--text-secondary);">
                                    ${doc.uploaded_by_email || 'N/A'}
                                </small>
                            </td>
                            <td>
                                <div style="display: flex; gap: 0.25rem;">
                                    <button class="btn btn-sm btn-light" onclick="downloadDocumentFromPath('${doc.file_path}')" title="Télécharger">
                                        ⬇️
                                    </button>
                                    <button class="btn btn-sm btn-danger" onclick="deleteDocumentFromPath('${doc.file_path}')" title="Supprimer">
                                        🗑️
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function getFileIcon(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const icons = {
        'pdf': '📄',
        'jpg': '🖼️',
        'jpeg': '🖼️',
        'png': '🖼️',
        'doc': '📝',
        'docx': '📝',
        'xls': '📊',
        'xlsx': '📊'
    };
    return icons[ext] || '📎';
}

window.switchDocTab = (tab) => {
    // Update active tab
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = 'var(--bg-tertiary)';
        btn.style.color = 'var(--text-primary)';
        if (btn.dataset.tab === tab) {
            btn.classList.add('active');
            btn.style.background = 'var(--primary)';
            btn.style.color = 'white';
        }
    });

    // Filter documents
    let filteredDocs = window.allDocuments;
    if (tab !== 'all') {
        filteredDocs = window.allDocuments.filter(d => d.entity_type === tab);
    }

    // Update table
    document.getElementById('documentsTableContainer').innerHTML = renderDocumentsTable(filteredDocs);
};

window.filterDocuments = (searchTerm) => {
    const term = searchTerm.toLowerCase();
    const activeTab = document.querySelector('.tab-btn.active').dataset.tab;

    let filteredDocs = window.allDocuments;

    // Apply tab filter
    if (activeTab !== 'all') {
        filteredDocs = filteredDocs.filter(d => d.entity_type === activeTab);
    }

    // Apply search filter
    if (term) {
        filteredDocs = filteredDocs.filter(d =>
            d.file_name.toLowerCase().includes(term) ||
            (d.vehicle_plate && d.vehicle_plate.toLowerCase().includes(term)) ||
            (d.driver_name && d.driver_name.toLowerCase().includes(term)) ||
            (d.uploaded_by_email && d.uploaded_by_email.toLowerCase().includes(term))
        );
    }

    document.getElementById('documentsTableContainer').innerHTML = renderDocumentsTable(filteredDocs);
};

window.downloadDocumentFromPath = async (filePath) => {
    try {
        await StorageManager.downloadDocument(filePath);
    } catch (error) {
        alert('Erreur lors du téléchargement: ' + error.message);
    }
};

window.deleteDocumentFromPath = async (filePath) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) return;

    try {
        await StorageManager.deleteDocument(filePath);
        alert('✅ Document supprimé');
        renderDocumentsPage(); // Refresh
    } catch (error) {
        alert('Erreur lors de la suppression: ' + error.message);
    }
};
