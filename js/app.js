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
import {
    cPage, fPage, manageProject, wfN, wfB, selCT, selFL, completePayment,
    saveProfile, saveFProfile, saveRating, handleMultiFileUpload,
    removeProjectFile, viewFreelancerPortfolio, downloadEditedVideo,
    submitReview, acceptProject, handleFinalUpload, viewProjectDetails,
    rejectProject, sendNegotiation, toggleNegotiationCard, acceptNegotiation,
    rejectNegotiation, reviseOffer, triggerApproveAndPay, handleProfilePhotoUpload
} from './screens/dashboard.js';

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
window.switchChat = switchChat;
window.sendMsg = sendMsg;
window.handleChatUpload = handleChatUpload;

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
    const firstName = fullName.split(' ')[0];

    await syncDataFromSupabase(u);

    if (u.role === 'creator') {
        showScreen('screen-creator');

        const navName = document.getElementById('c-nav-name');
        const sbName = document.getElementById('c-sb-name');
        const sbRole = document.getElementById('c-sb-role');
        const sbAvatar = document.getElementById('c-sb-avatar');

        if (navName) navName.textContent = firstName;
        if (sbName) sbName.textContent = fullName;
        if (sbRole) sbRole.textContent = 'Creator';
        if (sbAvatar) sbAvatar.textContent = fullName.charAt(0).toUpperCase();

        setTimeout(() => {
            cPage(
                'home',
                document.querySelector('#screen-creator .nav-item[data-page="home"]') ||
                document.querySelector('#screen-creator .nav-item')
            );
        }, 50);
    } else {
        showScreen('screen-freelancer');

        const navName = document.getElementById('f-nav-name');
        const sbName = document.getElementById('f-sb-name');
        const sbRole = document.getElementById('f-sb-role');
        const sbAvatar = document.getElementById('f-sb-avatar');

        if (navName) navName.textContent = firstName;
        if (sbName) sbName.textContent = fullName;
        if (sbRole) sbRole.textContent = 'Freelancer';
        if (sbAvatar) sbAvatar.textContent = fullName.charAt(0).toUpperCase();

        setTimeout(() => {
            fPage(
                'home',
                document.querySelector('#screen-freelancer .nav-item[data-page="home"]') ||
                document.querySelector('#screen-freelancer .nav-item')
            );
        }, 50);
    }

    initChatRealtime(u.id);

    if (supaClient && !AppState.realtimeInitialized) {
        AppState.realtimeInitialized = true;
        const masterChannel = supaClient.channel('aalynex_master');
        masterChannel
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
                syncDataFromSupabase(AppState.CU);
            })
            .subscribe((status) => {
                console.log('🌐 Master Realtime Status:', status);
            });
    }
};

window.logout = function() {
    showModal('Log Out', 'Are you sure you want to log out?', async () => {
        if (supaClient) {
            try { await supaClient.auth.signOut(); } catch (e) {}
        }
        DB.logout();
        AppState.CU = null;
        AppState.realtimeInitialized = false;
        showScreen('screen-landing');
        showToast('Logged out successfully', 'info');
    });
};

window.addEventListener('load', async () => {
    initSupabase();

    if (supaClient) {
        try {
            const { data: { session } } = await supaClient.auth.getSession();
            if (session) {
                const { data: profile } = await supaClient
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .maybeSingle();

                if (profile) {
                    const u = {
                        id: profile.id,
                        name: profile.name || session.user.email.split('@')[0],
                        full_name: profile.name || '',
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
        } catch (e) {
            console.error(e);
        }
    }

    showScreen('screen-landing');
});
