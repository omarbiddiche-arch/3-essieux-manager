// --- ATTENDANCE MANAGER (Standalone Module) ---
// Gère toute la logique du planning des chauffeurs, stockage et UI.

const AttManager = {
    state: {
        weekStartISO: null,
        planning: {}, // { driverId: { dateISO: { status, panier, decouche, exceptionnelle } } }
    },

    init() {
        if (!this.state.weekStartISO) {
            this.state.weekStartISO = this.isoDate(this.startOfWeekMonday(new Date()));
        }

        // Charger depuis localStorage
        try {
            const stored = localStorage.getItem('planning_chauffeurs_vanilla_v1');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.planning) this.state.planning = parsed.planning;
                // Optionnel: restaurer la semaine affichée
                // if (parsed.weekStartISO) this.state.weekStartISO = parsed.weekStartISO;
            } else if (window.attendanceData) {
                // Migration depuis ancienne variable globale si besoin
                this.state.planning = window.attendanceData;
            }
        } catch (e) { console.error("Erreur chargement planning", e); }

        this.ensureWeekData();
    },

    // --- Helpers Date ---
    startOfWeekMonday(d) {
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
    fmtWeekLabel(date) {
        return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
    },

    // --- Helpers Data ---
    emptyDay() {
        return {
            status: "",
            panier: { matin: false, midi: false, soir: false },
            decouche: false,
            exceptionnelle: { amount: 0, note: "" }
        };
    },

    getWeekStartDate() {
        if (!this.state.weekStartISO) this.init();
        const [y, m, d] = this.state.weekStartISO.split("-").map(Number);
        return new Date(y, m - 1, d);
    },

    setWeekStartDate(date) {
        this.state.weekStartISO = this.isoDate(this.startOfWeekMonday(date));
        this.ensureWeekData();
        this.saveState();
        this.refreshUI();
    },

    getDays() {
        const ws = this.getWeekStartDate();
        return Array.from({ length: 7 }, (_, i) => this.addDays(ws, i));
    },
    getDayKeys() {
        return this.getDays().map(d => this.isoDate(d));
    },

    ensureWeekData() {
        if (typeof App === 'undefined' || !App.drivers) return; // Sécurité
        const keys = this.getDayKeys();
        App.drivers.forEach(dr => {
            if (!this.state.planning[dr.id]) this.state.planning[dr.id] = {};
            keys.forEach(k => {
                if (!this.state.planning[dr.id][k]) this.state.planning[dr.id][k] = this.emptyDay();
            });
        });
    },

    saveState() {
        const toSave = {
            weekStartISO: this.state.weekStartISO,
            planning: this.state.planning
        };
        localStorage.setItem('planning_chauffeurs_vanilla_v1', JSON.stringify(toSave));
        // Synchro avec variable globale pour compatibilité ancienne logique si besoin
        window.attendanceData = this.state.planning;
    },

    updateDay(driverId, dateKey, updater) {
        const currentData = this.state.planning?.[driverId]?.[dateKey] || this.emptyDay();
        // Clone
        const current = JSON.parse(JSON.stringify(currentData));
        const updated = updater(current);

        if (!this.state.planning[driverId]) this.state.planning[driverId] = {};
        this.state.planning[driverId][dateKey] = updated;

        this.saveState();
        this.refreshUI();
        this.closeModal();
    },

    getTotals(driverId) {
        const keys = this.getDayKeys();
        const row = this.state.planning[driverId] || {};
        let paniers = { matin: 0, midi: 0, soir: 0 };
        let decouches = 0;
        let primesEx = 0;

        keys.forEach(k => {
            const d = row[k] || this.emptyDay(); // Ici on ne compte que si présent/défini? On compte tout ce qui est coché.
            if (d.panier.matin) paniers.matin++;
            if (d.panier.midi) paniers.midi++;
            if (d.panier.soir) paniers.soir++;
            if (d.decouche) decouches++;
            primesEx += (parseFloat(d.exceptionnelle.amount) || 0);
        });

        return { paniers, decouches, primesEx: primesEx.toFixed(2) };
    },

    // --- UI Methods ---
    refreshUI() {
        const main = document.getElementById('mainContent');
        if (main) main.innerHTML = this.renderMain();
    },

    renderMain() {
        this.init();
        if (typeof App === 'undefined' || !App.drivers) return "<div class='p-4'>Chargement des chauffeurs...</div>";

        const ws = this.getWeekStartDate();
        const days = this.getDays();
        const dayKeys = this.getDayKeys();
        const weekLabel = this.fmtWeekLabel(ws);

        // --- Badge Helper ---
        const badgeHTML = (status) => {
            if (!status) return `<span class="att-badge" style="background:var(--att-bg-tertiary); color:var(--att-muted); border:1px solid var(--att-border); min-width:30px; justify-content:center">-</span>`;
            const MAP = {
                present: { cls: "b-present", lbl: "Présent" },
                absent: { cls: "b-absent", lbl: "Absent" },
                conge: { cls: "b-conge", lbl: "Congé" },
                vacances: { cls: "b-vacances", lbl: "Vacances" },
                maladie: { cls: "b-maladie", lbl: "Maladie" }
            };
            const item = MAP[status] || { cls: "b-present", lbl: status || "Présent" }; // Fallback safe
            return `<span class="att-badge ${item.cls}">${item.lbl}</span>`;
        };


        // --- Desktop Rows ---
        const desktopRows = App.drivers.map(dr => {
            const totals = this.getTotals(dr.id);
            const cells = dayKeys.map((k, i) => {
                const d = this.state.planning?.[dr.id]?.[k] || this.emptyDay();
                const exTxt = d.exceptionnelle.amount > 0 ? `${d.exceptionnelle.amount}€` : '';
                return `
                <td>
                    <button class="att-cell-btn" onclick="AttManager.openModal('${dr.id}', '${k}')">
                        <div class="att-spaced" style="display:flex; align-items:center; margin-bottom:6px">
                            ${badgeHTML(d.status)}
                            <span style="font-size:14px; opacity:0.3">✎</span>
                        </div>
                        <div class="att-cell-meta">
                            ${(d.panier.matin || d.panier.midi || d.panier.soir) ?
                        `<div>🍽️ ${d.panier.matin ? "Ma " : ""}${d.panier.midi ? "Mi " : ""}${d.panier.soir ? "So" : ""}</div>` : ''}
                            ${d.decouche ? `<div style="color:#7e22ce">🌙 Découché</div>` : ''}
                            ${exTxt ? `<div style="color:#059669">💰 <b>${exTxt}</b></div>` : ''}
                        </div>
                    </button>
                </td>`;
            }).join('');

            return `
            <tr>
                <td class="att-sticky" style="padding:16px 12px; font-weight:700; font-size:14px; color:var(--att-text); vertical-align:middle">
                    ${dr.name}
                </td>
                ${cells}
                <td style="vertical-align:middle">
                    <div class="att-totals-box">
                        <div style="font-weight:700; margin-bottom:4px; color:var(--att-text)">Totaux</div>
                        <div>🍽️ ${totals.paniers.matin}/${totals.paniers.midi}/${totals.paniers.soir}</div>
                        <div>🌙 ${totals.decouches}</div>
                        <div>💰 ${totals.primesEx}€</div>
                    </div>
                </td>
            </tr>`;
        }).join('');

        // --- Mobile Cards ---
        const mobileCards = App.drivers.map(dr => {
            const totals = this.getTotals(dr.id);
            const dayRows = dayKeys.map((k, i) => {
                const d = this.state.planning?.[dr.id]?.[k] || this.emptyDay();
                const dateObj = days[i];
                const exTxt = d.exceptionnelle.amount > 0 ? `${d.exceptionnelle.amount}€` : '';

                return `
                <button class="att-day-btn" onclick="AttManager.openModal('${dr.id}', '${k}')">
                    <div class="att-spaced" style="display:flex; align-items:center; margin-bottom:8px">
                        <div style="font-weight:700; font-size:14px">${this.fmtDay(dateObj)}</div>
                        ${badgeHTML(d.status)}
                    </div>
                    <div class="att-grid2">
                        <div>🍽️ ${d.panier.matin ? "Ma " : ""}${d.panier.midi ? "Mi " : ""}${d.panier.soir ? "So" : ""}</div>
                        <div>🌙 ${d.decouche ? "Oui" : "-"}</div>
                        <div style="grid-column: 1 / -1; text-align:right">💰 ${exTxt || '-'}</div>
                    </div>
                </button>`;
            }).join('');

            return `
            <div class="att-card att-driver-card">
                <div class="att-spaced att-row" style="border-bottom:1px solid var(--att-border); padding-bottom:12px; margin-bottom:12px">
                    <div>
                        <div style="font-weight:800; font-size:18px; color:var(--att-text)">${dr.name}</div>
                        <div style="font-size:13px; color:#6b7280; margin-top:4px">
                            TOT: 🍽️ ${totals.paniers.matin}/${totals.paniers.midi}/${totals.paniers.soir} · 🌙 ${totals.decouches} · 💰 ${totals.primesEx}€
                        </div>
                    </div>
                </div>
                <div style="display:grid; gap:8px">
                    ${dayRows}
                </div>
            </div>`;
        }).join('');

        // --- Final Structure ---
        return `
        <div class="att-container fade-in">
            <header class="att-row att-spaced" style="margin-bottom: 24px;">
                <div>
                    <h1 style="font-size:24px; font-weight:800; margin:0; color:var(--att-text)">Planning Chauffeurs</h1>
                    <div style="color:#6b7280; font-size:14px; margin-top:4px">Semaine du <span style="font-weight:600; color:var(--att-text)">${weekLabel}</span></div>
                </div>
                <div class="att-row" style="gap:8px">
                    <button class="att-btn" onclick="AttManager.setWeekStartDate(AttManager.addDays(AttManager.getWeekStartDate(), -7))">← Sem -1</button>
                    <button class="att-btn" onclick="AttManager.setWeekStartDate(new Date())">Aujourd'hui</button>
                    <button class="att-btn" onclick="AttManager.setWeekStartDate(AttManager.addDays(AttManager.getWeekStartDate(), 7))">Sem +1 →</button>
                </div>
            </header>

            <div class="att-table-wrap">
                <table class="att-table">
                    <thead>
                        <tr>
                            <th class="att-sticky">Chauffeur</th>
                            ${days.map(d => `<th>${this.fmtDay(d)}</th>`).join('')}
                            <th>Totaux Semaine</th>
                        </tr>
                    </thead>
                    <tbody>${desktopRows}</tbody>
                </table>
            </div>
            
            <div class="att-mobile-wrap">
                ${mobileCards}
            </div>
            
            <!-- Save button removed -->


            <!-- MODAL CONTAINER (Directly embedded) -->
            <div class="att-modal-overlay" id="attModalOverlay" onclick="if(event.target===this) AttManager.closeModal()">
                <div class="att-modal">
                    <div class="att-modal-head">
                        <div class="att-modal-title" id="attModalTitle">Éditer</div>
                        <button class="att-modal-close" onclick="AttManager.closeModal()">✕</button>
                    </div>
                    <div class="att-modal-body" id="attModalBody"></div>
                </div>
            </div>
        </div>
        `;
    },

    // --- Modal Logic ---
    openModal(driverId, dateKey) {
        const modalOverlay = document.getElementById('attModalOverlay');
        const modalBody = document.getElementById('attModalBody');
        const modalTitle = document.getElementById('attModalTitle');

        if (!modalOverlay || !modalBody) { console.error("Modal not found"); return; }

        const driver = App.drivers.find(d => d.id == driverId);
        const d = this.state.planning?.[driverId]?.[dateKey] || this.emptyDay();

        modalTitle.textContent = `Éditer – ${driver ? driver.name : "Chauffeur"} – ${dateKey}`; // Améliorer format date si possible

        // --- Modal Content HTML ---
        const STATUSES = [
            { key: "present", label: "Présent" },
            { key: "absent", label: "Absent" },
            { key: "conge", label: "Congé" },
            { key: "vacances", label: "Vacances" },
            { key: "maladie", label: "Maladie" }
        ];

        const renderCheckbox = (id, label, checked) => `
            <label class="att-checkbox">
                <input type="checkbox" id="${id}" ${checked ? "checked" : ""}>
                <span style="font-size:14px; font-weight:500">${label}</span>
            </label>
        `;

        modalBody.innerHTML = `
            <div>
                <div class="att-section" style="margin-top:0">
                    <div class="att-section-title">Statut de la journée</div>
                    <div class="att-status-row">
                        ${STATUSES.map(s => `
                            <button class="att-status-btn ${d.status === s.key ? "active" : ""}" 
                                onclick="this.parentNode.querySelectorAll('.att-status-btn').forEach(b=>b.classList.remove('active')); this.classList.add('active');"
                                data-status="${s.key}">
                                ${s.label}
                            </button>
                        `).join("")}
                    </div>
                </div>

                <div class="att-section">
                    <div class="att-section-title">Primes Paniers</div>
                    <div class="att-status-row">
                        ${renderCheckbox("panier_matin", "🥣 Matin", d.panier.matin)}
                        ${renderCheckbox("panier_midi", "☀️ Midi", d.panier.midi)}
                        ${renderCheckbox("panier_soir", "🌙 Soir", d.panier.soir)}
                    </div>
                </div>

                <div class="att-section">
                    <div class="att-status-row" style="justify-content:space-between; align-items:center">
                        <div class="att-section-title" style="margin:0">Découché</div>
                        ${renderCheckbox("decouche", "Oui, nuit hors domicile", d.decouche)}
                    </div>
                </div>

                <div class="att-section">
                    <div class="att-section-title">Prime Exceptionnelle</div>
                    <div style="display:flex; gap:12px; align-items:center">
                        <div style="position:relative; width:140px">
                             <input id="exAmount" class="att-input" type="number" step="0.5" min="0" value="${d.exceptionnelle.amount || 0}" style="padding-right:24px; font-weight:bold">
                             <span style="position:absolute; right:10px; top:50%; transform:translateY(-50%); color:#6b7280">€</span>
                        </div>
                        <input id="exNote" class="att-input" type="text" placeholder="Motif (ex: Péage...)" value="${d.exceptionnelle.note || ""}" style="flex:1">
                    </div>
                </div>

                <div class="att-footer-btns">
                    <button class="att-btn" onclick="AttManager.closeModal()">Annuler</button>
                    <button class="att-btn att-btn-dark" id="btnSaveModal">Enregistrer</button>
                </div>
            </div>
        `;

        modalOverlay.style.display = 'flex';

        // Save Handler
        document.getElementById('btnSaveModal').onclick = () => {
            const statusBtn = modalBody.querySelector('.att-status-btn.active');
            const status = statusBtn ? statusBtn.dataset.status : d.status;

            const newData = {
                status: status,
                panier: {
                    matin: document.getElementById('panier_matin').checked,
                    midi: document.getElementById('panier_midi').checked,
                    soir: document.getElementById('panier_soir').checked
                },
                decouche: document.getElementById('decouche').checked,
                exceptionnelle: {
                    amount: document.getElementById('exAmount').value,
                    note: document.getElementById('exNote').value
                }
            };

            this.updateDay(driverId, dateKey, () => newData); // Callback updater simple
        };
    },

    closeModal() {
        const modalOverlay = document.getElementById('attModalOverlay');
        if (modalOverlay) modalOverlay.style.display = 'none';
    }
};

// Expose globale
window.AttManager = AttManager;
