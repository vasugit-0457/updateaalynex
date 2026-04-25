// js/services/chatService.js
import { supaClient } from './supabase.js';
import { DB } from '../state.js';

export async function sendMessageToDB(myId, otherId, text, fileUrl) {
    const key = [myId, otherId].sort().join('_');
    const allMsgs = DB.messages();
    if (!allMsgs[key]) allMsgs[key] = [];
    
    allMsgs[key].push({ from: myId, text: text, file_url: fileUrl, time: Date.now() });
    DB.saveMessages(allMsgs);

    if (supaClient) {
        try {
            const uid1 = [myId, otherId].sort()[0];
            const uid2 = [myId, otherId].sort()[1];
            let { data: convo } = await supaClient.from('conversations').select('id').eq('user1_id', uid1).eq('user2_id', uid2).maybeSingle();
            if (!convo) {
                const { data: newC } = await supaClient.from('conversations').insert({ user1_id: uid1, user2_id: uid2 }).select('id').single();
                convo = newC;
            }
            if (convo) {
                await supaClient.from('messages').insert({ conversation_id: convo.id, sender_id: myId, text, file_url: fileUrl });
            }
        } catch(e) {
            console.error("Message sync failed", e);
            throw e;
        }
    }
    return allMsgs[key];
}

export async function uploadChatVideo(file, myId) {
    if (!supaClient) throw new Error("No DB connection");
    const path = `chat/${myId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
    const { data, error } = await supaClient.storage.from('videos').upload(path, file);
    if (error) throw error;
    const { data: urlData } = supaClient.storage.from('videos').getPublicUrl(data.path);
    return urlData.publicUrl;
}
