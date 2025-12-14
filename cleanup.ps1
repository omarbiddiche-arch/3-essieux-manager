# Script de nettoyage - Version simple
Write-Host "Nettoyage en cours..." -ForegroundColor Cyan

# Liste des fichiers a supprimer
$files = @(
    "cleanup_final.sql",
    "cleanup_all.sql",
    "CLEANUP_FIRST.sql",
    "disable_rls.sql",
    "fix_rls_recursion.sql",
    "fix_companies.sql",
    "supabase_base_tables.sql",
    "supabase_storage_complete.sql",
    "supabase_documents_tracking.sql",
    "supabase_documents_tracking_fixed.sql",
    "INTERFACE_DOCUMENTS_DONE.md",
    "ORDRE_INSTALLATION.md",
    "INSTALL_TRACKING_RAPIDE.md",
    "EXEMPLES_RESULTATS.md",
    "DOCUMENTS_TRACKING_GUIDE.md",
    "SUPABASE_STORAGE_SETUP.md"
)

$count = 0
foreach ($file in $files) {
    if (Test-Path $file) {
        Remove-Item $file -Force
        Write-Host "Supprime: $file" -ForegroundColor Green
        $count++
    }
}

Write-Host "`nTermine! $count fichiers supprimes." -ForegroundColor Green
Write-Host "Vous pouvez maintenant uploader sur GitHub!" -ForegroundColor Cyan
