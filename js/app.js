// js/app.js
import { initSupabase, supaClient } from './services/supabase.js';
import { DB, AppState } from './state.js';
import { syncDataFromSupabase } from './services/authService.js';
import { showScreen } from './router.js';
import { goAuth } from './screens/landing.js';
import { switchTab, setLRole, setSRole, handleLogin, handleSignup } from './screens/auth.js';
import { toggleSidebar, closeSidebar } from './components/navbar.js';
import { showToast } from './components/toast.js';
import { showModal, closeModal } from './components/modal.js';
import { switchChat, sendMsg, handleChatUpload, initChatRealtime} from './components/chatUI.js';import { cPage, fPage, manageProject, wfN, wfB, selCT, selFL, completePayment, saveProfile, saveFProfile, saveRating, handleMultiFileUpload, removeProjectFile, viewFreelancerPortfolio, downloadEditedVideo, submitReview, acceptProject, handleFinalUpload, viewProjectDetails, rejectProject,  sendNegotiation, toggleNegotiationCard, acceptNegotiation, rejectNegotiation, reviseOffer, triggerApproveAndPay} from './screens/dashboard.js';


// ── 1. GLOBAL WINDOW BINDINGS (For HTML OnClicks) ──
window.goAuth = goAuth;
window.switchTab = switchTab;
window.setLRole = setLRole;
window.setSRole = setSRole;
window.doLogin = handleLogin;
window.doSignup = handleSignup;

window.showScreen = showScreen;
window.showToast = showToast;
window.showModal = showModal;
window.closeModal = closeModal;
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.initChatRealtime = initChatRealtime;

// Chat Bindings
window.switchChat = switchChat;
window.sendMsg = sendMsg;
window.handleChatUpload = handleChatUpload;


// Dashboard Bindings
window.cPage = cPage;
window.fPage = fPage;
window.manageProject = manageProject;
window.wfN = wfN;
window.wfB = wfB;
window.selCT = selCT;
window.selFL = selFL;
window.completePayment = completePayment;
window.saveProfile = saveProfile;
window.saveRating = saveRating;
window.handleMultiFileUpload = handleMultiFileUpload;
window.viewFreelancerPortfolio = viewFreelancerPortfolio;
window.downloadEditedVideo = downloadEditedVideo;
window.submitReview = submitReview;
window.removeProjectFile = removeProjectFile;
window.acceptProject = acceptProject;
window.handleFinalUpload = handleFinalUpload;
window.saveFProfile = saveFProfile;
window.viewProjectDetails = viewProjectDetails;
window.rejectProject = rejectProject;
window.sendNegotiation = sendNegotiation;
window.toggleNegotiationCard = toggleNegotiationCard;
window.acceptNegotiation = acceptNegotiation;
window.rejectNegotiation = rejectNegotiation;
window.reviseOffer = reviseOffer;
window.initChatRealtime = initChatRealtime;
window.sendMsg = sendMsg;            // <-- ISKE BINA SEND BUTTON KAAM NAHI KAREGA!
window.initChatRealtime = initChatRealtime;
window.triggerApproveAndPay = triggerApproveAndPay;

// ─── LOGIN SUCCESS LOGIC ───
window.loginSuccess = async function(u) {
    AppState.CU = u;
    DB.setCurrentUser(u);
if (window.initChatRealtime) {
        window.initChatRealtime(AppState.CU.id);
}

    if (u.role === 'creator') {
        const navName = document.getElementById('c-nav-name');
        const sbName = document.getElementById('c-sb-name');
        const sbAvatar = document.getElementById('c-sb-avatar');
        
        if(navName) navName.textContent = u.name.split(' ')[0];
        if(sbAvatar) sbAvatar.textContent = u.avatar || u.name.charAt(0).toUpperCase();
        
        // Creator ka Name aur Subtitle dono dynamically set kar rahe hain
        if(sbName) {
            sbName.innerHTML = `
                <div style="font-weight:600; color:var(--text); line-height:1.2;">${u.name}</div>
                <div style="font-size:0.75rem; color:var(--text-3); font-weight:normal; margin-top:4px; text-transform:capitalize;">Creator &middot; ${u.platform || 'YouTube'}</div>
            `;
        }
        
        window.showScreen('screen-creator');
        setTimeout(() => { window.cPage('home', document.querySelector('#screen-creator .nav-item[data-page="home"]') || document.querySelector('#screen-creator .nav-item')); }, 50);
        
    } else {
        const navName = document.getElementById('f-nav-name');
        const sbName = document.getElementById('f-sb-name');
        const sbAvatar = document.getElementById('f-sb-avatar');
        
        if(navName) navName.textContent = u.name.split(' ')[0];
        if(sbAvatar) sbAvatar.textContent = u.avatar || u.name.charAt(0).toUpperCase();
        
        // Freelancer ka Name aur Subtitle dono dynamically set kar rahe hain
        if(sbName) {
            sbName.innerHTML = `
                <div style="font-weight:600; color:var(--text); line-height:1.2;">${u.name}</div>
                <div style="font-size:0.75rem; color:var(--text-3); font-weight:normal; margin-top:4px; text-transform:capitalize;">Freelancer &middot; ${u.profession || 'Editor'}</div>
            `;
        }
        
        window.showScreen('screen-freelancer');
        setTimeout(() => { window.fPage('home', document.querySelector('#screen-freelancer .nav-item[data-page="home"]') || document.querySelector('#screen-freelancer .nav-item')); }, 50);
    }
    
    await syncDataFromSupabase(u);

    // Master Realtime Channel Configuration
    if (window.supaClient && !AppState.realtimeInitialized) {
        AppState.realtimeInitialized = true;
        const masterChannel = window.supaClient.channel('aalynex_master');
        
        masterChannel
          .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, payload => {
              syncDataFromSupabase(AppState.CU);
          })
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
              syncDataFromSupabase(AppState.CU);
          })
          .subscribe(async (status) => {
             console.log("Realtime Status:", status);
          });
    }
};

window.logout = function() {
    showModal('Log Out', 'Are you sure you want to log out?', async () => {
        if (supaClient) { try { await supaClient.auth.signOut(); } catch(e) {} }
        DB.logout();
        AppState.CU = null;
        showScreen('screen-landing');
        showToast('Logged out successfully', 'info');
    });
};

// ── 3. APP INITIALIZATION ──
window.addEventListener('load', async () => {
    initSupabase();
    if (supaClient) {
        try {
            const { data: { session } } = await supaClient.auth.getSession();
            if (session) {
                const { data: profile } = await supaClient.from('profiles').select('*').eq('id', session.user.id).single();
                if (profile) {
                    const u = {
    id: profile.id, 
    name: profile.name || session.user.email.split('@')[0], 
    email: session.user.email,
    role: profile.role || 'creator', 
    platform: profile.platform || '', 
    avatar: (profile.name || 'U').charAt(0).toUpperCase(),
    createdAt: profile.created_at ? new Date(profile.created_at).getTime() : Date.now()
};
                    window.loginSuccess(u);
                    return;
                }
            }
        } catch(e) { console.error(e) }
    }
    showScreen('screen-landing');
});