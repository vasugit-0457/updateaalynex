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

export async function syncDataFromSupabase(u) {
    if (!supaClient || !u) return;
    try {
        const { data: { user } } = await supaClient.auth.getUser();
        if (!user) return;

        // ✅ 'users' nahi, 'profiles' hai
        const { data: profile } = await supaClient
            .from('profiles')
            .select('*').eq('id', user.id).maybeSingle();
        if (profile) DB.setUser(profile);

        // ✅ Projects bhi fetch karo refresh ke baad
        const { data: projects } = await supaClient
            .from('projects')
            .select('*').eq('creator_id', user.id);
        if (projects) DB.setProjects(projects);

    } catch(e) { console.error("Sync failed", e); }
}
