// js/screens/auth.js ke top imports
import { AppState, uid } from '../state.js';
import { showToast, setBtn } from '../components/toast.js'; // ui.js ki jagah toast.js
import { loginUser, registerUser } from '../services/authService.js';

export function switchTab(t) {
    // ─── CLEAR FIELDS ON TAB SWITCH ───
    document.getElementById('login-email').value = '';
    document.getElementById('login-pw').value = '';
    document.getElementById('su-name').value = '';
    document.getElementById('su-phone').value = '';
    document.getElementById('su-email').value = '';
    document.getElementById('su-pw').value = '';
    
    document.getElementById('form-login').style.display  = t === 'login'  ? '' : 'none';
    document.getElementById('form-signup').style.display = t === 'signup' ? '' : 'none';
    document.getElementById('tab-login').className  = 'auth-tab' + (t==='login'  ? ' active' : '');
    document.getElementById('tab-signup').className = 'auth-tab' + (t==='signup' ? ' active' : '');
    document.getElementById('login-err').style.display  = 'none';
    document.getElementById('signup-err').style.display = 'none';
}

export function setLRole(r) {
    // ─── CLEAR FIELDS ON ROLE SWITCH (LOGIN) ───
    if (AppState.loginRole !== r) {
        document.getElementById('login-email').value = '';
        document.getElementById('login-pw').value = '';
        document.getElementById('login-err').style.display = 'none';
    }
    
    AppState.loginRole = r;
    document.getElementById('lr-c').className = 'role-btn' + (r==='creator'    ? ' ac' : '');
    document.getElementById('lr-f').className = 'role-btn' + (r==='freelancer' ? ' af' : '');
}

export function setSRole(r) {
    // ─── CLEAR FIELDS ON ROLE SWITCH (SIGNUP) ───
    if (AppState.signupRole !== r) {
        document.getElementById('su-name').value = '';
        document.getElementById('su-phone').value = '';
        document.getElementById('su-email').value = '';
        document.getElementById('su-pw').value = '';
        document.getElementById('signup-err').style.display = 'none';
    }

    AppState.signupRole = r;
    document.getElementById('sr-c').className = 'role-btn' + (r==='creator'    ? ' ac' : '');
    document.getElementById('sr-f').className = 'role-btn' + (r==='freelancer' ? ' af' : '');
    document.getElementById('su-creator-extra').style.display  = r==='creator'    ? '' : 'none';
    document.getElementById('su-freelancer-extra').style.display = r==='freelancer' ? '' : 'none';
}


export async function handleLogin() {
    const email  = document.getElementById('login-email').value.trim();
    const pw     = document.getElementById('login-pw').value;
    const errEl  = document.getElementById('login-err');
    errEl.style.display = 'none';

    if (!email || !pw) { 
        errEl.textContent = 'Please fill in all fields.'; 
        errEl.style.display = 'flex'; 
        return; 
    }
    
    setBtn('login-btn', true, 'Logging in…'); 

    try {
        const user = await loginUser(email, pw, AppState.loginRole);

        // ─── STRICT ROLE VALIDATION LOGIC ───
        if (user.role && user.role !== AppState.loginRole) {
            // Background me jo galti se login session ban gaya, usko turant delete (signOut) kar do
            if (window.supaClient) {
                await window.supaClient.auth.signOut();
            }
            // Ab error throw karo
            throw new Error("Invalid Login Credentials");
        }
        // ────────────────────────────────────

        window.loginSuccess(user);
        window.showToast('Welcome back, ' + user.name.split(' ')[0] + '!', 'ok');
    } catch(e) {
        // Yahan humne STRICT rule laga diya hai. Error chahe kuch bhi ho, text yahi aayega:
        errEl.textContent = "Invalid Login Credentials";
        errEl.style.display = 'flex';
        
        // ─── CLEAR FIELDS ON ERROR ───
        document.getElementById('login-email').value = '';
        document.getElementById('login-pw').value = '';
        
    } finally {
        setBtn('login-btn', false);
    }
}
export async function handleSignup() {
    const name       = document.getElementById('su-name').value.trim();
    const phone      = document.getElementById('su-phone').value.trim();
    const email      = document.getElementById('su-email').value.trim();
    const pw         = document.getElementById('su-pw').value;
    const profession = document.getElementById('su-profession').value;
    const platform   = document.getElementById('su-platform')?.value || '';
    const errEl      = document.getElementById('signup-err');

    errEl.style.display = 'none';
    if (!name || !email || !pw) { errEl.textContent = 'Please fill in all required fields.'; errEl.style.display = 'flex'; return; }
    if (pw.length < 6)          { errEl.textContent = 'Password must be at least 6 characters.'; errEl.style.display = 'flex'; return; }

    setBtn('signup-btn', true, 'Creating account...');

    try {
        const { session, user } = await registerUser(email, pw, name, phone, AppState.signupRole, profession, platform);
        if (!session) {
            showToast('Account created! Please confirm your email.', 'info');
            switchTab('login');
            document.getElementById('login-email').value = email;
        } else {
            window.loginSuccess(user);
            showToast('Welcome, ' + name.split(' ')[0] + '!', 'ok');
        }
    } catch(e) {
        errEl.textContent = e.message || 'Something went wrong. Please try again.';
        errEl.style.display = 'flex';
    } finally {
        setBtn('signup-btn', false);
    }
}
}
