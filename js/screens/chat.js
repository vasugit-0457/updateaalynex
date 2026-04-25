// js/screens/chat.js — ORIGINAL RAKHNA HAI, MERA WALA DELETE KARO
import { DB, AppState } from '../state.js';
import { buildChat } from '../components/chatUI.js';

export function renderCreatorChat() {
    const myProjects = DB.projects().filter(p => (p.creatorId === AppState.CU.id || p.freelancerId === AppState.CU.id) && p.status !== 'open');
    const relatedUserIds = [...new Set(myProjects.map(p => p.creatorId === AppState.CU.id ? p.freelancerId : p.creatorId).filter(id => id))];
    
    let defaultOther = AppState.currentChatUserId;
    if (!defaultOther || !relatedUserIds.includes(defaultOther)) defaultOther = relatedUserIds[0] || '';
    AppState.currentChatUserId = defaultOther;

    return `<div class="page-head"><h2>Messages</h2><p>Chat with your editors</p></div>${buildChat(AppState.CU.id, defaultOther)}`;
}

export function renderFreelancerChat() {
    const myProjects = DB.projects().filter(p => (p.creatorId === AppState.CU.id || p.freelancerId === AppState.CU.id) && p.status !== 'open');
    const relatedUserIds = [...new Set(myProjects.map(p => p.creatorId === AppState.CU.id ? p.freelancerId : p.creatorId).filter(id => id))];
    
    let defaultOther = AppState.currentChatUserId;
    if (!defaultOther || !relatedUserIds.includes(defaultOther)) defaultOther = relatedUserIds[0] || '';
    AppState.currentChatUserId = defaultOther;

    return `<div class="page-head"><h2>Messages</h2></div>${buildChat(AppState.CU.id, defaultOther)}`;
}
