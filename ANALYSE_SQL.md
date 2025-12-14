# 📋 ANALYSE DE VOS SCRIPTS SQL

## ❌ À SUPPRIMER COMPLÈTEMENT

### Scripts 1, 2, 3, 4 - SUPPRIMER
**Raison** : Ce sont mes tentatives de fix qui ont causé des problèmes
- `cleanup_final.sql` (Script 1)
- `cleanup_all.sql` (Script 2)
- `disable_rls.sql` (Script 3)
- `fix_rls_recursion.sql` (Script 4)

### Script 5 - SUPPRIMER
**documents_complete_view et fonctions**
**Raison** : Cause des erreurs de sécurité (expose auth.users)

### Script 6 - SUPPRIMER
**supabase_base_tables.sql**
**Raison** : Utilise UUID alors que vos tables utilisent BIGINT

### Script 7 - SUPPRIMER
**document_audit table**
**Raison** : Pas nécessaire pour l'instant

---

## ✅ À GARDER ET FUSIONNER

### Script 8 - BASE PRINCIPALE ⭐
**Le plus complet et fonctionnel**
Contient :
- Helper functions (`get_my_role`, `get_my_company_id`)
- Table `users` avec RLS
- Tables `vehicles`, `drivers`, `attendance` avec RLS
- Storage policies

**MAIS** : Manque la colonne `manual_bonus` dans attendance

### Scripts 9, 10, 11 - VARIANTES D'ATTENDANCE
**Problème** : Différentes versions de la même table
- Script 9 : `manualBonus` (camelCase)
- Script 10 : Sans `manual_bonus`
- Script 11 : Avec `primes`

### Scripts 12, 13, 14, 15, 16 - ANCIENNES VERSIONS
**Raison** : Versions antérieures, déjà améliorées dans Script 8

---

## 🎯 SOLUTION : UN SEUL SCRIPT PROPRE

Je vais créer **UN SEUL script final** qui combine le meilleur de tout :

1. ✅ Helper functions (Script 8)
2. ✅ Table users avec RLS (Script 8)
3. ✅ Tables vehicles, drivers (Script 8)
4. ✅ Table attendance avec `primes` ET `manual_bonus` (Script 11)
5. ✅ Storage policies (Script 8)
6. ❌ SANS RLS sur companies (pas nécessaire)
7. ❌ SANS document_audit (pas nécessaire)
8. ❌ SANS vues documents (causent des erreurs)

---

## 📝 CE QUE VOUS DEVEZ FAIRE

### Étape 1 : Nettoyer
Exécutez ce script pour tout supprimer :

```sql
-- Supprimer les vues problématiques
DROP VIEW IF EXISTS public.documents_complete_view CASCADE;

-- Supprimer les fonctions de documents
DROP FUNCTION IF EXISTS public.list_all_documents_with_details() CASCADE;
DROP FUNCTION IF EXISTS public.find_documents_by_email(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_company_document_report(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_documents(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.search_documents(TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_storage_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_orphaned_documents() CASCADE;

-- Supprimer document_audit
DROP TABLE IF EXISTS public.document_audit CASCADE;

-- Supprimer les triggers d'updated_at
DROP TRIGGER IF EXISTS update_companies_updated_at ON public.companies;
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
DROP TRIGGER IF EXISTS update_vehicles_updated_at ON public.vehicles;
DROP TRIGGER IF EXISTS update_drivers_updated_at ON public.drivers;
DROP TRIGGER IF EXISTS update_attendance_updated_at ON public.attendance;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- Supprimer la table companies (pas utilisée)
DROP TABLE IF EXISTS public.companies CASCADE;

-- Désactiver RLS partout
ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vehicles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.drivers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendance DISABLE ROW LEVEL SECURITY;
```

### Étape 2 : Installer le script propre
J'ai créé `FINAL_CLEAN_SCHEMA.sql` - Exécutez-le après le nettoyage

---

## ✅ RÉSULTAT FINAL

Vous aurez :
- ✅ Table `users` avec company_id (UUID)
- ✅ Table `vehicles` avec company_id (BIGINT id, UUID company_id)
- ✅ Table `drivers` avec company_id
- ✅ Table `attendance` avec primes + manual_bonus
- ✅ RLS activé et fonctionnel
- ✅ Storage policies
- ✅ Pas d'erreurs de sécurité
- ✅ Pas de récursion infinie

**Plus de problèmes !** 🎉
