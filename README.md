# 🚛 3 Essieux Manager

Application web de gestion de flotte de véhicules lourds (tracteurs et semi-remorques).

## ✨ Fonctionnalités

- 🚛 **Gestion des véhicules** : Tracteurs, semi-remorques avec suivi kilométrique
- 👥 **Gestion des chauffeurs** : Informations, permis, visites médicales
- 📅 **Suivi des présences** : Calendrier mensuel avec primes et bonus
- 📄 **Gestion des documents** : Assurance, contrôle technique, permis, etc.
- 📊 **Analyse tachygraphes** : Import et analyse des fichiers .ddd, .c1b
- ✅ **Liste de tâches** : Suivi des tâches et alertes automatiques
- 🔔 **Alertes** : Notifications pour documents expirés ou à renouveler

## 🛠️ Technologies

- **Frontend** : HTML5, CSS3, JavaScript (Vanilla)
- **Backend** : Supabase (PostgreSQL, Authentication, Storage)
- **Serveur** : Node.js + Express (pour parsing tachygraphes)
- **Sécurité** : Row Level Security (RLS) sur toutes les tables

## 🚀 Installation

### Prérequis

- Compte Supabase (gratuit)
- Node.js 14+ (pour le serveur de parsing)
- Navigateur moderne (Chrome, Firefox, Edge)

### Configuration

1. **Clonez le repository** :
```bash
git clone https://github.com/votre-username/3-essieux-manager.git
cd 3-essieux-manager
```

2. **Configurez Supabase** :
   - Créez un projet sur https://supabase.com
   - Copiez `supabaseClient.example.js` en `supabaseClient.js`
   - Ajoutez vos clés Supabase (URL + Anon Key)

3. **Exécutez le script SQL** :
   - Ouvrez Supabase SQL Editor
   - Exécutez le contenu de `FINAL_CLEAN_SCHEMA.sql`
   - Vérifiez que les tables sont créées

4. **Créez votre premier utilisateur** :
   - Ouvrez `index.html` dans votre navigateur
   - Cliquez sur "S'inscrire"
   - Créez votre compte (sera automatiquement OWNER_ADMIN)

5. **Lancez le serveur** (optionnel, pour tachygraphes) :
```bash
npm install
node server.js
```

6. **Ouvrez l'application** :
   - Ouvrez `index.html` dans votre navigateur
   - Ou utilisez un serveur local : `npx serve`

## 📖 Documentation

- [Guide d'installation](INSTALLATION_GUIDE.md)
- [Guide GitHub](GUIDE_GITHUB.md)
- [Analyse SQL](ANALYSE_SQL.md)

## 🏗️ Structure du projet

```
3-essieux-manager/
├── index.html              # Page principale
├── style.css               # Styles
├── app.js                  # Logique principale
├── storage-manager.js      # Gestion des documents
├── server.js               # Serveur Node.js (parsing tachy)
├── supabaseClient.js       # Config Supabase (non versionné)
├── supabaseClient.example.js  # Exemple de config
├── FINAL_CLEAN_SCHEMA.sql  # Script SQL de création
├── .gitignore              # Fichiers à ignorer
└── README.md               # Ce fichier
```

## 🔐 Sécurité

⚠️ **IMPORTANT** : Ne jamais commiter :
- `supabaseClient.js` (contient vos clés API)
- Fichiers de configuration avec secrets
- Données sensibles

✅ Le fichier `.gitignore` protège automatiquement vos secrets.

## 🗄️ Base de données

### Tables principales

- **users** : Utilisateurs avec rôles (OWNER_ADMIN, ADMIN, DRIVER)
- **vehicles** : Véhicules avec documents et alertes
- **drivers** : Chauffeurs avec permis et visites médicales
- **attendance** : Présences avec primes et bonus

### Sécurité

- Row Level Security (RLS) activé sur toutes les tables
- Isolation par company_id (multi-tenant)
- Politiques strictes par rôle

## 🎨 Captures d'écran

*(Ajoutez vos captures d'écran ici)*

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
- Ouvrir une issue pour signaler un bug
- Proposer une amélioration
- Soumettre une pull request

## 📄 Licence

MIT License - Voir le fichier LICENSE pour plus de détails

## 👤 Auteur

Créé avec ❤️ pour la gestion de flotte de véhicules lourds

## 🙏 Remerciements

- Supabase pour le backend
- Google Fonts pour la typographie
- La communauté open source

---

**Besoin d'aide ?** Ouvrez une issue sur GitHub !
