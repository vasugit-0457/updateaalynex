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

window.loginSuccess = async function(u) {
    AppState.CU = u;
    DB.setCurrentUser(u);
    const fullName = u.full_name || u.name || 'User';
    // ✅ PEHLE sync karo — projects load ho jayein
    await syncDataFromSupabase(u);

if (u.role === 'creator') {
    const navName = document.getElementById('c-nav-name');
    if (navName) navName.textContent = fullName.split(' ')[0];
} else {
    const navName = document.getElementById('f-nav-name');
    if (navName) navName.textContent = fullName.split(' ')[0];
}

    // Realtime baad me
    initChatRealtime(u.id);

    if (window.supabaseClient && !AppState.realtimeInitialized) {
        AppState.realtimeInitialized = true;
        const masterChannel = window.supabaseClient.channel('aalynex_master');
        masterChannel
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
                syncDataFromSupabase(AppState.CU);
            })
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
    name: profile.name || session.user.email.split('@')[0], // ✅ sirf name
    full_name: profile.name || '',  // ✅ compatibility ke liye
    email: session.user.email,
    role: profile.role || 'creator',
    platform: profile.platform || '',
    profession: profile.profession || '',
    phone: profile.phone || '',
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
