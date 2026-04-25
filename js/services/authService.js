// js/services/authService.js
import { supaClient } from './supabase.js';
import { DB } from '../state.js';

export async function registerUser(email, password, name, phone) {
    const { data, error } = await supaClient.auth.signUp({
        email,
        password,
        options: { data: { full_name: name, phone } }
    });
    if (error) throw error;
    return data;
}

export async function loginUser(email, password) {
    const { data, error } = await supaClient.auth.signInWithPassword({
        email,
        password
    });
    if (error) throw error;
    return data;
}

export async function syncDataFromSupabase() {
    if (!supaClient) return;
    try {
        const { data: { user } } = await supaClient.auth.getUser();
        if (!user) return;
        const { data: profile } = await supaClient
            .from('users').select('*').eq('id', user.id).maybeSingle();
        if (profile) DB.setUser(profile);
    } catch(e) { console.error("Sync failed", e); }
}
