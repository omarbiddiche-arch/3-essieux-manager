// ⚠️ EXEMPLE DE CONFIGURATION SUPABASE
// 
// 1. Copiez ce fichier en "supabaseClient.js"
// 2. Remplacez les valeurs par vos vraies clés Supabase
// 3. NE COMMITEZ JAMAIS supabaseClient.js sur GitHub !

const supabaseUrl = 'https://VOTRE-PROJET.supabase.co';
const supabaseAnonKey = 'VOTRE_CLE_ANON_ICI';

const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
