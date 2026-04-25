// js/services/authService.js
import { supaClient } from './supabase.js';
import { DB } from '../state.js';

export async function registerUser(email, password, name, phone, role = 'creator') {
    const { data, error } = await supaClient.auth.signUp({
        email, password,
        options: { data: { full_name: name, phone } }
    });
    if (error) throw error;

    // ✅ profiles table me bhi insert karo
    if (data.user) {
        await supaClient.from('profiles').insert({
            id: data.user.id,
            full_name: name,
            phone,
            email,
            role
        });
    }
    return data;
}

export async function loginUser(email, password) {
    const { data, error } = await supaClient.auth.signInWithPassword({
        email, password
    });
    if (error) throw error;
    return data;
}

export async function syncDataFromSupabase(u) {
    if (!supaClient || !u) return;
    try {
        const { data: { user } } = await supaClient.auth.getUser();
        if (!user) return;

        const { data: profile } = await supaClient
            .from('profiles')
            .select('*').eq('id', user.id).maybeSingle();
        if (profile) DB.setCurrentUser(profile);

        // ✅ Role ke hisaab se projects fetch karo
        const role = profile?.role || u.role || 'creator';
        const { data: projects } = await supaClient
            .from('projects')
            .select('*')
            .eq(role === 'creator' ? 'creator_id' : 'freelancer_id', user.id);
        if (projects) DB.saveProjects(projects);

        // ✅ Saare users sync karo
        const { data: users } = await supaClient
            .from('profiles').select('*');
        if (users) DB.saveUsers(users);

    } catch(e) { console.error("Sync failed", e); }
}
