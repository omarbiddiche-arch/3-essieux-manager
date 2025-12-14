// Initialize Supabase Client using global config
if (!window.AppConfig) {
    console.error("Configuration missing! Make sure config.js is loaded before supabaseClient.js");
} else {
    window.supabaseClient = window.supabase.createClient(window.AppConfig.SUPABASE_URL, window.AppConfig.SUPABASE_ANON_KEY);
    // Backward compatibility if some code uses 'supabase' variable
    window.supabase = window.supabaseClient;
}
