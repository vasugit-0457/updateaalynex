// js/services/supabase.js

const SUPABASE_URL = "https://sfzbrygqpodjinhpagaz.supabase.co";
const SUPABASE_KEY = "sb_publishable_h1rmGWdbBlMWPhkKugtOQw_6tP5ArtI";

export let supaClient = null;

export function initSupabase() {
    try {
        if (!window.supabaseClient && window.supabase) {
            supaClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            window.supabaseClient = supaClient;
            console.log("✅ Supabase client initialized");
        } else if (window.supabaseClient) {
            supaClient = window.supabaseClient;
        }
    } catch(e) {
        console.warn("Supabase init failed:", e);
        supaClient = null;
    }
    return supaClient;
}