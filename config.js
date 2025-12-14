// Global configuration object
const Config = {
    // API URL for the backend server
    // Change this if your server runs on a different host/port
    API_URL: window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : 'https://api.yourdomain.com', // Replace with production URL

    // Supabase Configuration
    // These should match the values in your Supabase project
    SUPABASE_URL: 'https://aivstjuqrqdfohoratwe.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpdnN0anVxcnFkZm9ob3JhdHdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNjg4MzAsImV4cCI6MjA4MDk0NDgzMH0.0AebBzzNKmz0ZsqDfctVkLB7WXiFrUrQ_TcD3XcbOt4'
};

window.AppConfig = Config;
