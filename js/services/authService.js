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
        } catch (e) {
            console.error("Message sync failed", e);
            throw e;
        }
    }
    return allMsgs[key];
}


export async function uploadChatVideo(file, myId) {
    if (!supaClient) throw new Error("No DB connection");
    const path = `chat/${myId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { data, error } = await supaClient.storage.from('videos').upload(path, file);
    if (error) throw error;
    const { data: urlData } = supaClient.storage.from('videos').getPublicUrl(data.path);
    return urlData.publicUrl;
}


// ✅ NEW: Real-time subscribe
export function subscribeToMessages(myId, otherId, onNewMessage) {
    if (!supaClient) {
        console.warn("⚠️ Supabase not ready, realtime disabled");
        return null;
    }

    const uid1 = [myId, otherId].sort()[0];
    const uid2 = [myId, otherId].sort()[1];
    const key = [myId, otherId].sort().join('_');

    const channel = supaClient
        .channel(`chat-${uid1}-${uid2}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages'
            },
            (payload) => {
                const newMsg = payload.new;

                // Sirf isi conversation ke messages process karo
                const allMsgs = DB.messages();
                if (!allMsgs[key]) allMsgs[key] = [];

                // Duplicate check — jo hum khud bhej chuke wo dobara mat add karo
                const isDuplicate = allMsgs[key].some(m =>
                    m.text === newMsg.text &&
                    m.from === newMsg.sender_id &&
                    Math.abs((m.time || 0) - new Date(newMsg.created_at).getTime()) < 3000
                );

                if (!isDuplicate) {
                    allMsgs[key].push({
                        from: newMsg.sender_id,
                        text: newMsg.text,
                        file_url: newMsg.file_url,
                        time: new Date(newMsg.created_at).getTime()
                    });
                    DB.saveMessages(allMsgs);
                    onNewMessage(allMsgs[key]); // UI ko updated messages do
                }
            }
        )
        .subscribe((status) => {
            console.log(`🟢 Realtime [${uid1} <-> ${uid2}]:`, status);
        });

    return channel;
}


// ✅ NEW: Unsubscribe — page switch pe zaroor call karo
export function unsubscribeFromMessages(channel) {
    if (supaClient && channel) {
        supaClient.removeChannel(channel);
        console.log("🔴 Realtime channel closed");
    }
}
