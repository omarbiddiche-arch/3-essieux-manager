# 🚀 Guide d'Installation - Système de Stockage Multi-Client

## 📋 Prérequis

- Un compte Supabase actif
- Accès au projet Supabase
- Les tables `companies`, `users`, `vehicles`, `drivers` déjà créées

## ⚙️ Installation en 5 étapes

### Étape 1: Créer le Bucket Storage

1. Connectez-vous à votre dashboard Supabase
2. Allez dans **Storage** (menu de gauche)
3. Cliquez sur **New Bucket**
4. Configurez le bucket :
   - **Name**: `documents`
   - **Public**: ❌ **NON** (décoché)
   - **File size limit**: `52428800` (50 MB)
   - **Allowed MIME types**: 
     ```
     application/pdf
     image/jpeg
     image/jpg
     image/png
     application/octet-stream
     ```
5. Cliquez sur **Create bucket**

### Étape 2: Exécuter le Script SQL

1. Allez dans **SQL Editor** (menu de gauche)
2. Cliquez sur **New query**
3. Copiez-collez le contenu du fichier `supabase_storage_complete.sql`
4. Cliquez sur **Run** (ou Ctrl+Enter)
5. Vérifiez qu'il n'y a pas d'erreurs

### Étape 3: Vérifier les Politiques RLS

1. Allez dans **Storage** > **Policies**
2. Sélectionnez le bucket `documents`
3. Vous devriez voir 4 politiques :
   - ✅ Users can upload to their company folder
   - ✅ Users can view their company files
   - ✅ Users can update their company files
   - ✅ Users can delete their company files

### Étape 4: Tester les Fonctions SQL

Dans le SQL Editor, testez les fonctions :

```sql
-- Test 1: Récupérer les documents d'un utilisateur
SELECT * FROM get_user_documents('votre@email.com');

-- Test 2: Stats de stockage (remplacez par votre company_id)
SELECT * FROM get_storage_stats('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');

-- Test 3: Voir la vue des documents
SELECT * FROM documents_with_metadata LIMIT 10;
```

### Étape 5: Intégrer dans l'Application

Le fichier `storage-manager.js` est déjà inclus dans `index.html`.

Testez l'upload depuis l'application :

```javascript
// Dans la console du navigateur (F12)
const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
StorageManager.uploadDocument('vehicles', 'vehicle-id-here', testFile, {
  name: 'Test Document',
  expiryDate: '2025-12-31'
}).then(result => console.log('Upload success:', result));
```

## 🧪 Tests de Validation

### Test 1: Isolation des Companies

1. Créez 2 comptes utilisateurs avec 2 companies différentes
2. Uploadez un document avec le compte 1
3. Connectez-vous avec le compte 2
4. Vérifiez que le document du compte 1 n'est PAS visible

### Test 2: Upload et Récupération

```javascript
// Upload
const file = document.querySelector('input[type="file"]').files[0];
const doc = await StorageManager.uploadDocument('vehicles', vehicleId, file, {
  name: 'Assurance',
  expiryDate: '2025-12-31'
});
console.log('Document uploadé:', doc);

// Récupération
const docs = await StorageManager.getUserDocuments();
console.log('Tous mes documents:', docs);
```

### Test 3: Recherche

```javascript
const results = await StorageManager.searchDocuments('assurance');
console.log('Documents trouvés:', results);
```

### Test 4: Statistiques

```javascript
const stats = await StorageManager.getStorageStats();
console.log('Statistiques:', stats);
// Devrait afficher: total_files, total_size_mb, vehicle_files, etc.
```

## 📊 Monitoring et Maintenance

### Voir les logs d'audit

```sql
SELECT 
  action,
  file_path,
  user_email,
  created_at
FROM document_audit
ORDER BY created_at DESC
LIMIT 50;
```

### Nettoyer les fichiers orphelins

```sql
SELECT * FROM cleanup_orphaned_documents();
```

### Statistiques globales

```sql
SELECT 
  c.name as company_name,
  COUNT(o.*) as total_files,
  ROUND(SUM((o.metadata->>'size')::BIGINT) / 1024.0 / 1024.0, 2) as total_mb
FROM storage.objects o
JOIN companies c ON c.id = (regexp_split_to_array(o.name, '/'))[1]::UUID
WHERE o.bucket_id = 'documents'
GROUP BY c.id, c.name
ORDER BY total_mb DESC;
```

## 🔒 Sécurité

### Points de sécurité vérifiés

- ✅ RLS activé sur le bucket
- ✅ Isolation par company_id
- ✅ Authentification requise
- ✅ Validation des chemins de fichiers
- ✅ Audit trail complet
- ✅ URLs signées avec expiration

### Bonnes pratiques

1. **Ne jamais** exposer les company_id dans l'URL
2. **Toujours** valider les fichiers côté client ET serveur
3. **Limiter** la taille des fichiers (50 MB max)
4. **Nettoyer** régulièrement les fichiers orphelins
5. **Monitorer** l'utilisation du storage

## 🆘 Dépannage

### Erreur: "new row violates row-level security policy"

**Cause**: L'utilisateur n'a pas de company_id ou la politique RLS bloque l'accès.

**Solution**:
```sql
-- Vérifier le company_id de l'utilisateur
SELECT u.id, u.email, u.company_id 
FROM users u 
JOIN auth.users au ON au.id = u.id 
WHERE au.email = 'votre@email.com';
```

### Erreur: "The resource already exists"

**Cause**: Un fichier avec le même nom existe déjà.

**Solution**: Le StorageManager ajoute automatiquement un timestamp. Vérifiez que vous n'avez pas désactivé cette fonctionnalité.

### Les fichiers ne s'affichent pas

**Cause**: Les URLs signées ont expiré.

**Solution**:
```javascript
// Régénérer l'URL signée
const newUrl = await StorageManager.getSignedUrl(filePath, 3600);
```

## 📈 Optimisations

### Cache des URLs signées

```javascript
// Dans app.js, ajouter un cache simple
const urlCache = new Map();

async function getCachedSignedUrl(filePath) {
  if (urlCache.has(filePath)) {
    const cached = urlCache.get(filePath);
    if (Date.now() < cached.expires) {
      return cached.url;
    }
  }
  
  const url = await StorageManager.getSignedUrl(filePath, 3600);
  urlCache.set(filePath, {
    url,
    expires: Date.now() + 3500000 // 58 minutes
  });
  
  return url;
}
```

### Compression des images

```javascript
// Avant upload, compresser les images
async function compressImage(file) {
  if (!file.type.startsWith('image/')) return file;
  
  // Utiliser une lib comme browser-image-compression
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920
  };
  
  return await imageCompression(file, options);
}
```

## ✅ Checklist Finale

- [ ] Bucket "documents" créé (privé)
- [ ] Script SQL exécuté sans erreurs
- [ ] 4 politiques RLS actives
- [ ] Fonctions SQL testées
- [ ] storage-manager.js inclus dans index.html
- [ ] Test d'upload réussi
- [ ] Test d'isolation entre companies réussi
- [ ] Audit trail fonctionnel
- [ ] Documentation lue et comprise

## 🎯 Résultat Final

Vous avez maintenant un système de stockage :
- ✅ **Multi-tenant** : Chaque company isolée
- ✅ **Sécurisé** : RLS + authentification
- ✅ **Organisé** : Structure de dossiers claire
- ✅ **Auditable** : Logs de toutes les actions
- ✅ **Performant** : URLs signées + cache
- ✅ **Scalable** : Supporte des milliers de clients

**Félicitations ! 🎉**
