
const supabaseUrl = 'https://aivstjuqrqdfohoratwe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpdnN0anVxcnFkZm9ob3JhdHdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNjg4MzAsImV4cCI6MjA4MDk0NDgzMH0.0AebBzzNKmz0ZsqDfctVkLB7WXiFrUrQ_TcD3XcbOt4';

// Initialize and expose globally
window.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

console.log("Supabase client initialized", window.supabaseClient);
