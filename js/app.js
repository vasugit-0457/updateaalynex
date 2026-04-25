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
import { switchChat, sendMsg, handleChatUpload, initChatRealtime } from './components/chatUI.js';
import { cPage, fPage, manageProject, wfN, wfB, selCT, selFL, completePayment, saveProfile, saveFProfile, saveRating, handleMultiFileUpload, removeProjectFile, viewFreelancerPortfolio, downloadEditedVideo, submitReview, acceptProject, handleFinalUpload, viewProjectDetails, rejectProject, sendNegotiation, toggleNegotiationCard, acceptNegotiation, rejectNegotiation, reviseOffer, triggerApproveAndPay, handleProfilePhotoUpload } from './screens/dashboard.js';


// ── 1. GLOBAL WINDOW BINDINGS ──
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

// Chat Bindings — ✅ Sirf ek baar assign karo
window.initChatRealtime = initChatRealtime;
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
window.triggerApproveAndPay = triggerApproveAndPay;
window.handleProfilePhotoUpload = handleProfilePhotoUpload;

window.cPageMobile = function(page, el) {
    document.querySelectorAll('#c-bottom-nav .bn-item').forEach(i => i.classList.remove('active'));
    if (el) el.classList.add('active');
    cPage(page, document.querySelector(`#screen-creator .nav-item[data-page="${page}"]`));
    closeSidebar('creator');
};

window.fPageMobile = function(page, el) {
    document.querySelectorAll('#f-bottom-nav .bn-item').forEach(i => i.classList.remove('active'));
    if (el) el.classList.add('active');
    fPage(page, document.querySelector(`#screen-freelancer .nav-item[data-page="${page}"]`));
    closeSidebar('freelancer');
};

// ── 2. LOGIN SUCCESS ──
window.loginSuccess = async function(u) {
    AppState.CU = u;
    DB.setCurrentUser(u);

    if (u.role === 'creator') {
        const navName = document.getElementById('c-nav-name');
        const sbName = document.getElementById('c-sb-name');
        const sbAvatar = document.getElementById('c-sb-avatar');
        if (navName) navName.textContent = u.name.split(' ')[0];
        if (sbAvatar) sbAvatar.textContent = u.avatar || u.name.charAt(0).toUpperCase();
        if (sbName) {
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
        if (navName) navName.textContent = (u.full_name || u.name || 'User').split(' ')[0];
        if (sbAvatar) sbAvatar.textContent = u.avatar || (u.full_name || u.name || 'U').charAt(0).toUpperCase();
        if (sbName) {
            sbName.innerHTML = `
                <div style="font-weight:600; color:var(--text); line-height:1.2;">${u.full_name || u.name || 'User'}</div>
                <div style="font-size:0.75rem; color:var(--text-3); font-weight:normal; margin-top:4px; text-transform:capitalize;">Freelancer &middot; ${u.profession || 'Editor'}</div>
            `;
        }
        window.showScreen('screen-freelancer');
        setTimeout(() => { window.fPage('home', document.querySelector('#screen-freelancer .nav-item[data-page="home"]') || document.querySelector('#screen-freelancer .nav-item')); }, 50);
    }

    // ✅ FIX 3: Pehle data sync karo, PHIR realtime start karo
    await syncDataFromSupabase(u);
    initChatRealtime(u.id);

    // ✅ FIX 1 + 2: window.supabaseClient sahi naam, aur messages listener HATA diya
    // (chatUI.js already messages handle kar raha hai — double listener conflict tha)
    if (window.supabaseClient && !AppState.realtimeInitialized) {
        AppState.realtimeInitialized = true;
        const masterChannel = window.supabaseClient.channel('aalynex_master');

        masterChannel
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
                // Sirf projects sync karo — messages chatUI.js handle karega
                syncDataFromSupabase(AppState.CU);
            })
            // ✅ FIX 2: messages wala listener REMOVE kar diya — clash hota tha!
            .subscribe((status) => {
                console.log("🌐 Master Realtime Status:", status);
            });
    }
};


// ── 3. LOGOUT ──
window.logout = function() {
    showModal('Log Out', 'Are you sure you want to log out?', async () => {
        if (supaClient) { try { await supaClient.auth.signOut(); } catch(e) {} }
        DB.logout();
        AppState.CU = null;
        AppState.realtimeInitialized = false; // ✅ Reset flag on logout
        showScreen('screen-landing');
        showToast('Logged out successfully', 'info');
    });
};


// ── 4. APP INITIALIZATION ──
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
        } catch(e) { console.error(e); }
    }
    showScreen('screen-landing');
});
