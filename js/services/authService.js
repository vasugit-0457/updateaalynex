// js/services/authService.js
import { supaClient } from './supabase.js';
import { DB } from '../state.js';

export async function registerUser(email, password, name, phone, role = 'creator', profession = '', platform = '') {
    const { data, error } = await supaClient.auth.signUp({
        email,
        password,
        options: { data: { full_name: name, phone } }
    });
    if (error) throw error;

    if (data.user) {
        const { error: profileErr } = await supaClient.from('profiles').insert({
            id: data.user.id,
            name,
            phone,
            email,
            role,
            profession,
            platform
        });
        if (profileErr) throw profileErr;
    }

    return {
        user: data.user,
        session: data.session
    };
}

export async function loginUser(email, password) {
    const { data, error } = await supaClient.auth.signInWithPassword({
        email,
        password
    });
    if (error) throw error;
    return {
        user: data.user,
        session: data.session
    };
}

export async function syncDataFromSupabase(u) {
    if (!supaClient || !u) return;
    try {
        const { data: { user } } = await supaClient.auth.getUser();
        if (!user) return;

        const { data: profile } = await supaClient
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

        if (profile) {
            DB.setCurrentUser({
                ...profile,
                name: profile.name,
                full_name: profile.name,
                role: profile.role
            });
        }

        const role = profile?.role || u.role || 'creator';
        const { data: projects, error: projErr } = await supaClient
            .from('projects')
            .select('*')
            .eq(role === 'creator' ? 'creator_id' : 'freelancer_id', user.id);
        if (projErr) throw projErr;

        if (projects) {
            const mapped = projects.map(dp => ({
                id: dp.id,
                creatorId: dp.creator_id,
                title: dp.title,
                description: dp.description,
                budget: dp.budget,
                contentType: dp.content_type,
                deadline: dp.deadline,
                priority: dp.priority,
                freelancerId: dp.freelancer_id,
                invitedfreelancers: dp.invitedfreelancers,
                status: dp.status,
                createdAt: new Date(dp.created_at).getTime(),
                files: [],
                editedUploaded: dp.editeduploaded || false,
                paid: dp.paid || false,
                rating: dp.rating || 0,
                review: dp.review || ''
            }));
            DB.saveProjects(mapped);
        }

        const { data: users, error: usersErr } = await supaClient.from('profiles').select('*');
        if (usersErr) throw usersErr;
        if (users) DB.saveUsers(users.map(u => ({
            ...u,
            full_name: u.name,
            role: u.role
        })));

    } catch (e) {
        console.error('Sync failed', e);
    }
}
