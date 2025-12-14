# 📸 Guide Visuel - Publier sur GitHub

## Étape 1 : Créer un compte GitHub (si pas déjà fait)

1. Allez sur **https://github.com**
2. Cliquez sur **"Sign up"** en haut à droite
3. Suivez les instructions pour créer votre compte

---

## Étape 2 : Créer un nouveau repository

### 2.1 Cliquez sur le bouton "+"

Une fois connecté sur GitHub :
- En haut à droite, à côté de votre photo de profil
- Cliquez sur le bouton **"+"**
- Dans le menu déroulant, cliquez sur **"New repository"**

```
┌─────────────────────────────────────┐
│  GitHub                    🔔  +  👤│  ← Cliquez sur le "+"
└─────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ New repository   │  ← Cliquez ici
                    │ Import repository│
                    │ New gist         │
                    └──────────────────┘
```

### 2.2 Remplissez le formulaire

Sur la page "Create a new repository" :

```
Repository name *
┌────────────────────────────────────┐
│ 3-essieux-manager                  │  ← Entrez le nom
└────────────────────────────────────┘

Description (optional)
┌────────────────────────────────────┐
│ Gestion de flotte de véhicules    │  ← Description
└────────────────────────────────────┘

○ Public    ● Private  ← Choisissez

☐ Add a README file  ← NE COCHEZ PAS (vous en avez déjà un)
☐ Add .gitignore     ← NE COCHEZ PAS (vous en avez déjà un)
☐ Choose a license   ← Optionnel

┌────────────────────────────────────┐
│    Create repository               │  ← Cliquez ici
└────────────────────────────────────┘
```

**IMPORTANT** : Ne cochez RIEN car vous avez déjà README.md et .gitignore !

---

## Étape 3 : Upload vos fichiers

### 3.1 Vous êtes sur la page de votre nouveau repository

Vous verrez cette page :

```
┌─────────────────────────────────────────────────────┐
│ votre-username / 3-essieux-manager                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Quick setup — if you've done this kind of thing   │
│  before                                             │
│                                                     │
│  ...or create a new repository on the command line │
│                                                     │
│  ...or push an existing repository from the        │
│  command line                                       │
│                                                     │
│  ...or import code from another repository         │
│                                                     │
│  ┌──────────────────────────────────────┐          │
│  │  uploading an existing file          │  ← Cliquez ici !
│  └──────────────────────────────────────┘          │
└─────────────────────────────────────────────────────┘
```

**Cliquez sur le lien bleu "uploading an existing file"**

### 3.2 Page d'upload

Vous arrivez sur cette page :

```
┌─────────────────────────────────────────────────────┐
│ Add files to 3-essieux-manager                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │                                               │ │
│  │   Drag files here to add them to your        │ │
│  │   repository                                  │ │
│  │                                               │ │
│  │   or choose your files                        │ │  ← Cliquez ici
│  │                                               │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  Commit changes                                     │
│  ┌──────────────────────────────────────┐          │
│  │ Add files via upload                 │          │
│  └──────────────────────────────────────┘          │
│                                                     │
│  ┌──────────────────────────────────────┐          │
│  │  Commit changes                      │  ← Puis cliquez ici
│  └──────────────────────────────────────┘          │
└─────────────────────────────────────────────────────┘
```

### 3.3 Sélectionnez vos fichiers

1. **Cliquez sur "choose your files"**
2. **Naviguez vers** : `c:\Users\Utilisateur\.gemini\antigravity\playground\ionic-horizon`
3. **Sélectionnez TOUS les fichiers** (Ctrl+A) **SAUF** :
   - ❌ `supabaseClient.js` (TRÈS IMPORTANT !)
   - ❌ Dossier `node_modules` (si présent)
   - ❌ Fichiers `.log`

4. **Cliquez sur "Ouvrir"**

### 3.4 Commit les fichiers

En bas de la page :

```
Commit changes
┌────────────────────────────────────┐
│ Add files via upload               │  ← Message de commit
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ (optional extended description)    │
└────────────────────────────────────┘

● Commit directly to the main branch

┌────────────────────────────────────┐
│    Commit changes                  │  ← Cliquez ici !
└────────────────────────────────────┘
```

**Cliquez sur "Commit changes"**

---

## ✅ C'est fait !

Votre code est maintenant sur GitHub ! 🎉

Vous pouvez le voir à :
```
https://github.com/votre-username/3-essieux-manager
```

---

## 🔍 Vérification finale

Vérifiez que **`supabaseClient.js` n'apparaît PAS** dans la liste des fichiers !

Si vous le voyez, **SUPPRIMEZ-LE IMMÉDIATEMENT** :
1. Cliquez sur le fichier
2. Cliquez sur l'icône poubelle (🗑️) en haut à droite
3. Commit la suppression

---

## 📱 Alternative : GitHub Desktop (Plus facile)

Si vous trouvez ça compliqué, installez **GitHub Desktop** :

1. Téléchargez : https://desktop.github.com
2. Installez et connectez-vous
3. Cliquez sur "Add" > "Add existing repository"
4. Sélectionnez votre dossier
5. Cliquez sur "Publish repository"

C'est beaucoup plus simple ! 😊
