// js/services/authService.js
import { supaClient } from './supabase.js';
import { DB, AppState, uid } from '../state.js';

function formatProfile(p, email, roleFallback) {
    return {
        id: p.id, name: p.name || 'User', email: email || '', phone: p.phone || '',
        role: p.role || roleFallback, profession: p.profession || '',
        platform: p.platform || '', avatar: (p.name || 'U').charAt(0).toUpperCase(),
        createdAt: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
        skills: p.skills || [], portfolio_links: p.portfolio_links || {},
        resume_url: p.resume_url || '', photo_url: p.photo_url || '', experience: p.experience || []
    };
}

export async function loginUser(email, password, role) {
    if (!supaClient) throw new Error("No database connection");
    const { data, error } = await supaClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    
    let { data: profile, error: pErr } = await supaClient.from('profiles').select('*').eq('id', data.user.id).single();
    
    if (pErr || !profile) {
        const name = email.split('@')[0];
        const newProfile = { id: data.user.id, name, role: role, profession: '', platform: '', avatar: name.charAt(0).toUpperCase() };
        await supaClient.from('profiles').insert(newProfile);
        profile = { ...newProfile, created_at: Date.now() };
    }
    
    return formatProfile(profile, data.user.email, role);
}

export async function registerUser(email, password, name, phone, role, profession, platform) {
    if (!supaClient) throw new Error("No database connection");
    const { data, error } = await supaClient.auth.signUp({
        email, password, options: { data: { name, phone, role, profession, platform } }
    });
    if (error) throw error;
    
    const authUser = data.user;
    if (authUser) {
        await supaClient.from('profiles').upsert({
            id: authUser.id, name, phone, role, profession, platform, avatar: name.charAt(0).toUpperCase()
        }, { onConflict: 'id' });
    }
    
    return { 
        session: data.session, 
        user: { id: authUser?.id || uid(), name, email, phone, role, profession, platform, avatar: name.charAt(0).toUpperCase(), createdAt: Date.now() }
    };
}

export async function syncDataFromSupabase(u) {
    if (!supaClient) return;
    try {
        const { data: profiles } = await supaClient.from('profiles').select('*');
        if (profiles) {
            const localUsers = DB.users();
            profiles.forEach(p => {
                const exists = localUsers.find(x => x.id === p.id);
                const mapped = formatProfile(p, '', p.role);
                if (!exists) localUsers.push(mapped); else Object.assign(exists, mapped);
            });
            DB.saveUsers(localUsers);
        }

        const { data: projects } = await supaClient.from('projects').select('*');
        if (projects) {
            const mapped = projects.map(p => ({
                id: p.id, creatorId: p.creator_id, freelancerId: p.freelancer_id || null,
                invited_freelancers: p.invited_freelancers || [], 
                title: p.title || '', description: p.description || '', budget: p.budget || 0,
                contentType: p.content_type || '', deadline: p.deadline || '', priority: p.priority || 'Normal',
                status: p.status || 'open', rawShared: p.raw_shared || false,
                editedUploaded: p.edited_uploaded || false, paid: p.paid || false,
                rating: p.rating || 0, review: p.review || '', createdAt: new Date(p.created_at).getTime()
            }));
            DB.saveProjects(mapped);
        }

        const { data: attachments } = await supaClient.from('project_attachments').select('*');
        if (attachments) {
            DB.saveAttachments(attachments.map(a => ({ id: a.id, projectId: a.project_id, name: a.file_name, type: a.file_type, size: a.file_size, duration: a.duration })));
        }

        const { data: convos } = await supaClient.from('conversations').select('*').or(`user1_id.eq.${u.id},user2_id.eq.${u.id}`);
        if (convos && convos.length > 0) {
            const convoIds = convos.map(c => c.id);
            const { data: messages } = await supaClient.from('messages').select('*').in('conversation_id', convoIds).order('created_at', { ascending: true });
            if (messages) {
                const msgMap = {};
                messages.forEach(m => {
                    const c = convos.find(x => x.id === m.conversation_id);
                    if (c) {
                        const otherId = c.user1_id === u.id ? c.user2_id : c.user1_id;
                        const key = [u.id, otherId].sort().join('_');
                        if (!msgMap[key]) msgMap[key] = [];
                        msgMap[key].push({ from: m.sender_id, text: m.text, file_url: m.file_url || null, time: new Date(m.created_at).getTime() });
                    }
                });
                DB.saveMessages(msgMap);
            }
        }
    } catch(e) { console.warn('Sync failed:', e); }
}