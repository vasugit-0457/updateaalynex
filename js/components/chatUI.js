// js/components/chatUI.js
import { DB, AppState, fmtTime, fmtDate, fmt } from '../state.js';
import { supaClient } from '../services/supabase.js'; 

const getSupa = () => window.supaClient || supaClient;

function getSafeMessages() {
    let msgs = DB.messages();
    if (!msgs || Array.isArray(msgs)) { msgs = {}; DB.saveMessages(msgs); }
    return msgs;
}

let chatSubscription = null;
let presenceChannel = null;
let currentRealtimeUserId = null; // Lock ko ID based kar diya hai

export function initChatRealtime(myId) {
    const supa = getSupa();
    if (!supa || !myId) return;

    // Agar SAME user already connected hai, tabhi block karo
    if (currentRealtimeUserId === myId) return; 
    
    currentRealtimeUserId = myId; // Naye user ki ID set karo
    console.log("🚀 Realtime Connection Shuru ho raha hai for:", myId);

    // 🟢 PRESENCE
    if (presenceChannel) { supa.removeChannel(presenceChannel); }
    presenceChannel = supa.channel('global_presence', { config: { presence: { key: myId } } });

    presenceChannel.on('presence', { event: 'sync' }, () => {
        const newState = presenceChannel.presenceState();
        AppState.onlineUsers = new Set(Object.keys(newState));
        updateChatHeaderPresence(); 
    });

    presenceChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await presenceChannel.track({ online: true });
    });

    // 📨 MESSAGES REALTIME
    if (chatSubscription) { supa.removeChannel(chatSubscription); }
    chatSubscription = supa.channel('realtime-messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
            console.log("🔔 Cloud se Message Aaya! Payload:", payload.new);
            
            const newMsg = payload.new;
            if (!newMsg || !newMsg.sender_id) return;
            
            if (String(newMsg.sender_id).toLowerCase() === String(myId).toLowerCase()) return; 

            try {
                const { data: convo, error } = await supa.from('conversations').select('*').eq('id', newMsg.conversation_id).maybeSingle();
                if (error) return;
                
                if (convo) {
                    const otherId = convo.user1_id === myId ? convo.user2_id : convo.user1_id;
                    const key = [myId, otherId].sort().join('_');
                    
                    const safeMsgs = getSafeMessages();
                    if (!safeMsgs[key]) safeMsgs[key] = [];

                    const msgTime = new Date(newMsg.created_at).getTime();
                    const isDup = safeMsgs[key].some(m => m.text === newMsg.text && Math.abs(m.time - msgTime) < 2000);

                    if (!isDup) {
                        safeMsgs[key].push({
                            from: newMsg.sender_id,
                            text: newMsg.text || '',
                            file_url: newMsg.file_url || null,
                            time: msgTime
                        });
                        DB.saveMessages(safeMsgs);
                        
                        if (String(AppState.currentChatUserId) === String(otherId)) {
                            const chatArea = document.getElementById('chat-msgs-el');
                            if (chatArea) {
                                chatArea.innerHTML = renderMsgs(safeMsgs[key], myId);
                                chatArea.scrollTop = chatArea.scrollHeight;
                            }
                        }
                        updateChatSidebarPreviews();
                    }
                }
            } catch (err) {
                console.error("Realtime Error:", err);
            }
        }).subscribe();
}

export function updateChatHeaderPresence() {
    if (!AppState.currentChatUserId) return;
    const dot = document.getElementById('chat-online-dot');
    const statusText = document.getElementById('chat-status-text');
    if (!dot || !statusText) return;

    const targetId = String(AppState.currentChatUserId).toLowerCase();
    let isOnline = false;
    
    if (AppState.onlineUsers) {
        AppState.onlineUsers.forEach(id => {
            if (String(id).toLowerCase() === targetId) isOnline = true;
        });
    }

    if (isOnline) {
        dot.style.background = 'var(--green)'; statusText.textContent = 'Online'; statusText.style.color = 'var(--green)';
    } else {
        dot.style.background = 'var(--text-3)'; statusText.textContent = 'Offline'; statusText.style.color = 'var(--text-3)';
    }
}

export function updateChatSidebarPreviews() {
    if(!AppState.CU) return;
    const safeMsgs = getSafeMessages();
    document.querySelectorAll('.cc-item').forEach(el => {
        const uid = el.getAttribute('data-uid');
        if(uid) {
            const key = [AppState.CU.id, uid].sort().join('_');
            const msgs = safeMsgs[key] || [];
            const last = msgs[msgs.length-1];
            let previewText = 'No messages yet';
            if (last) {
                if (last.file_url || last.fileUrl) previewText = '🎥 Video Attachment';
                else if (last.text && last.text.includes('[NEGOTIATION_REQ]')) previewText = '🤝 New Negotiation Offer';
                else if (last.text && last.text.includes('[NEGOTIATION_ACCEPTED]')) previewText = '✅ Offer Accepted!';
                else if (last.text && last.text.includes('[NEGOTIATION_REJECTED]')) previewText = '❌ Offer Rejected';
                else if (last.text && last.text.includes('I have accepted the project')) previewText = '✅ Project Accepted';
                else previewText = last.text.replace(/<[^>]*>?/gm, '').substring(0, 40) + '...';
            }
            const prevEl = el.querySelector('.cc-prev');
            if(prevEl) prevEl.textContent = previewText;
        }
    });
}

export function buildChat(myId, otherDefaultId) {
    initChatRealtime(myId);

    const myProjects = DB.projects().filter(p => (p.creatorId === myId || p.freelancerId === myId) && p.status !== 'open');
    const relatedUserIds = [...new Set(myProjects.map(p => p.creatorId === myId ? p.freelancerId : p.creatorId).filter(id => id))];
    const allUsers = DB.users().filter(u => relatedUserIds.includes(u.id));

    const safeMsgs = getSafeMessages();
    const conversations = allUsers.map(u => {
        const key  = [myId, u.id].sort().join('_');
        const msgs = safeMsgs[key] || [];
        const last = msgs[msgs.length-1];
        let previewText = 'No messages yet';
        if (last) {
            if (last.file_url || last.fileUrl) previewText = '🎥 Video Attachment';
            else if (last.text && last.text.includes('I have accepted the project')) previewText = '✅ Project Accepted';
            else previewText = last.text.replace(/<[^>]*>?/gm, '').substring(0, 40) + '...';
        }
        return { user: u, key, msgs, last, previewText };
    });
    
    const activeConvo = conversations.find(c => c.user.id === otherDefaultId) || conversations[0];
    const activeKey   = activeConvo?.key || (otherDefaultId ? [myId, otherDefaultId].sort().join('_') : '');

    if (activeConvo) {
        AppState.currentChatUserId = activeConvo.user.id;
        setTimeout(() => updateChatHeaderPresence(), 200);
    }

    return `
    <div class="chat-wrap">
        <div class="chat-list">
            ${conversations.map(c => `
                <div class="cc-item${c.key===activeKey?' active':''}" data-uid="${c.user.id}" onclick="window.switchChat('${myId}','${c.user.id}', event)">
                    <div class="c-av">${c.user.avatar}</div>
                    <div style="min-width:0;">
                        <div class="cc-name">${c.user.name}</div>
                        <div class="cc-prev" style="font-size:0.75rem; color:var(--text-3); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.previewText}</div>
                    </div>
                </div>`).join('') || `<div style="padding:14px;font-size:.78rem;color:var(--text-3);">You must accept a project first</div>`}
        </div>
        <div class="chat-area">
            ${activeConvo ? `
                <div class="ch-header">
                    <div class="c-av" style="width:28px;height:28px;font-size:.7rem;">${activeConvo.user.avatar}</div>
                    <div class="online-dot" id="chat-online-dot"></div>
                    <span style="margin-right:8px;">${activeConvo.user.name}</span>
                    <span id="chat-status-text" style="font-size:0.7rem; color:var(--text-3);">Offline</span>
                </div>
                <div class="chat-msgs" id="chat-msgs-el">${renderMsgs(activeConvo.msgs, myId)}</div>
                <div class="chat-inp-bar">
                    <label for="chat-upload-${activeConvo.user.id}" style="cursor:pointer; display:flex; align-items:center; margin-right:4px; color:var(--text-3); transition:color .2s;">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                    </label>
                    <input type="file" id="chat-upload-${activeConvo.user.id}" accept="video/*" style="display:none;" onchange="window.handleChatUpload(this, '${myId}', '${activeConvo.user.id}')"/>
                    <input class="chat-inp" id="chat-inp-el" placeholder="Type a message…" onkeydown="if(event.key==='Enter') window.sendMsg('${myId}','${activeConvo.user.id}')"/>
                    <button class="btn btn-primary btn-sm" onclick="window.sendMsg('${myId}','${activeConvo.user.id}')">Send</button>
                </div>`
            : '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-3);font-size:.85rem;">No active conversations</div>'}
        </div>
    </div>`;
}

export function renderMsgs(msgs, myId) {
    if (!msgs || !msgs.length) return '<div style="text-align:center;color:var(--text-3);font-size:.78rem;padding:20px 0;">Start the conversation!</div>';
    const isCreator = AppState.CU.role === 'creator';

    return msgs.map((m, idx) => {
        const senderId = m.from || m.sender_id || m.senderId;
        const isMine = String(senderId).toLowerCase() === String(myId).toLowerCase();
        const timeAlign = isMine ? 'text-align:right' : '';
        const flexAlign = isMine ? 'flex-end' : 'flex-start';
        const msgTime = m.time || m.created_at || m.createdAt || Date.now();
        const fileUrl = m.file_url || m.fileUrl;
        const textContent = (m.text || '').replace(/\n/g, '<br>');

        if (fileUrl) {
            const fname = (m.text || '').replace('Raw Video: ', '').replace('Video: ', '').replace('Final Delivery: ', '').replace('Final Delivery', '') || 'video';
            let downloadBtn = '', actionBtns = '', restrictDownloadAttr = '';
            
            if (!isMine && isCreator) {
                let proj = DB.projects().find(p => p.creatorId === myId && p.freelancerId === senderId && p.status !== 'completed');
                if (!proj) proj = DB.projects().find(p => p.creatorId === myId && p.freelancerId === senderId);
                const isPaid = proj ? proj.paid : false;
                const isFinal = m.text && m.text.includes('Final Delivery');
                
                if (!isPaid) {
                    restrictDownloadAttr = 'controlsList="nodownload" oncontextmenu="return false;"';
                    downloadBtn = `<button class="btn btn-ghost btn-xs" style="margin-top:6px; font-size:0.65rem;" onclick="window.showToast('❌ You must Approve & Pay to download.', 'err')">⬇ Download Locked</button>`;
                    if (isFinal) actionBtns += `<button class="btn btn-green-btn btn-xs" style="margin-top:6px; font-size:0.65rem; margin-right:6px;" onclick="window.triggerApproveAndPay('${proj?.id}')">✅ Approve & Pay</button>`;
                } else {
                    downloadBtn = `<a href="${fileUrl}" target="_blank" download class="btn btn-ghost btn-xs" style="margin-top:6px; display:inline-block; font-size:0.65rem;">⬇ Download File</a>`;
                }
            } else {
                downloadBtn = `<a href="${fileUrl}" target="_blank" download class="btn btn-ghost btn-xs" style="margin-top:6px; display:inline-block; font-size:0.65rem;">⬇ Download File</a>`;
            }

            return `
            <div style="display:flex; flex-direction:column; align-items:${flexAlign}; margin-bottom:8px; width:100%;">
                <div class="msg-video ${isMine ? 'sent-video' : ''}">
                    <div class="msg-video-inner">
                        <div class="msg-video-label">
                            <div class="vico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="2" y="3" width="15" height="13" rx="2"/><polygon points="22 7 17 10 22 13 22 7"/></svg></div>
                            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px;">${fname}</span>
                        </div>
                        <video class="msg-video-player" controls preload="metadata" src="${fileUrl}" ${restrictDownloadAttr}>Video not supported.</video>
                        <div class="msg-video-footer"><span>${isMine ? 'You' : 'Sent'}</span><span>${fmtTime(msgTime)}</span></div>
                    </div>
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">${downloadBtn}${actionBtns}</div>
                </div>
            </div>`;
        }
        return `<div style="display:flex; flex-direction:column; align-items:${flexAlign}; margin-bottom:8px; width:100%;"><div class="msg ${isMine ? 'sent' : 'received'}">${textContent}</div><div class="msg-time" style="${timeAlign}; width:100%; margin-top:2px;">${fmtTime(msgTime)}</div></div>`;
    }).join('');
}

export function switchChat(myId, otherId, eventObj) {
    AppState.currentChatUserId = otherId; 
    const key   = [myId, otherId].sort().join('_');
    const safeMsgs = getSafeMessages();
    const msgs  = safeMsgs[key] || [];
    const other = DB.users().find(u => u.id === otherId);
    
    document.querySelectorAll('.cc-item').forEach(el => el.classList.remove('active'));
    if (eventObj && eventObj.currentTarget) eventObj.currentTarget.classList.add('active');
    
    const area = document.querySelector('.chat-area');
    if (area && other) {
        area.innerHTML = `
        <div class="ch-header">
            <div class="c-av" style="width:28px;height:28px;font-size:.7rem;">${other.avatar}</div>
            <div class="online-dot" id="chat-online-dot"></div>
            <span style="margin-right:8px;">${other.name}</span>
            <span id="chat-status-text" style="font-size:0.7rem; color:var(--text-3);">Offline</span>
        </div>
        <div class="chat-msgs" id="chat-msgs-el">${renderMsgs(msgs, myId)}</div>
        <div class="chat-inp-bar">
            <label for="chat-upload-${otherId}" style="cursor:pointer; display:flex; align-items:center; margin-right:4px; color:var(--text-3); transition:color .2s;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            </label>
            <input type="file" id="chat-upload-${otherId}" accept="video/*" style="display:none;" onchange="window.handleChatUpload(this, '${myId}', '${otherId}')"/>
            <input class="chat-inp" id="chat-inp-el" placeholder="Type a message…" onkeydown="if(event.key==='Enter') window.sendMsg('${myId}','${otherId}')"/>
            <button class="btn btn-primary btn-sm" onclick="window.sendMsg('${myId}','${otherId}')">Send</button>
        </div>`;
        const el = document.getElementById('chat-msgs-el');
        if (el) el.scrollTop = el.scrollHeight;
        updateChatHeaderPresence();
    }
}

export async function handleChatUpload(input, myId, otherId) {
    if (!input.files || !input.files.length) return;
    const file = input.files[0];
    if (file.size > 10 * 1024 * 1024 * 1024) { window.showToast('File too large.', 'err'); return; }
    
    window.showToast('Uploading...', 'info');
    let fileUrl = null;
    try {
        const supa = getSupa();
        if (supa) {
            const path = `chat/${myId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
            const { data: uploadData, error } = await supa.storage.from('videos').upload(path, file);
            if (error) throw error;
            const { data: urlData } = supa.storage.from('videos').getPublicUrl(uploadData.path);
            fileUrl = urlData?.publicUrl || null;
        }
        await sendMsg(myId, otherId, fileUrl, file.name);
        window.showToast('Video sent!', 'ok');
    } catch(e) { window.showToast('Upload failed', 'err'); }
    input.value = ''; 
}

export async function sendMsg(myId, otherId, overrideFileUrl = null, overrideFileName = null, overrideText = null) {
    let text = overrideText || '';
    const inp = document.getElementById('chat-inp-el');
    if (!overrideText && !overrideFileUrl) {
        if (!inp || !inp.value.trim()) return;
        text = inp.value.trim(); inp.value = '';
    } else if (overrideFileUrl) text = 'Video: ' + overrideFileName;

    const key = [myId, otherId].sort().join('_');
    const allMsgs = getSafeMessages();
    if (!allMsgs[key]) allMsgs[key] = [];
    allMsgs[key].push({ from: myId, text: text, file_url: overrideFileUrl, time: Date.now() });
    DB.saveMessages(allMsgs);

    const el = document.getElementById('chat-msgs-el');
    if (el) { el.innerHTML = renderMsgs(allMsgs[key], myId); el.scrollTop = el.scrollHeight; }
    updateChatSidebarPreviews();

    const supa = getSupa();
    if (supa) {
        try {
            const uid1 = [myId, otherId].sort()[0], uid2 = [myId, otherId].sort()[1];
            let { data: convo } = await supa.from('conversations').select('id').eq('user1_id', uid1).eq('user2_id', uid2).maybeSingle();
            if (!convo) {
                const { data: newC } = await supa.from('conversations').insert({ user1_id: uid1, user2_id: uid2 }).select('id').single();
                convo = newC;
            }
            const { error } = await supa.from('messages').insert({ conversation_id: convo.id, sender_id: myId, text, file_url: overrideFileUrl });
            if(error) console.error("Message send failed:", error);
        } catch(e) { console.error(e); }
    }
}
