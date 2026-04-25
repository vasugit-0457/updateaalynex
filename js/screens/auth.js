// js/screens/auth.js
import { AppState, uid } from '../state.js';
import { showToast, setBtn } from '../components/toast.js';
import { loginUser, registerUser } from '../services/authService.js';

export function switchTab(t) {
    document.getElementById('login-email').value = '';
    document.getElementById('login-pw').value = '';
    document.getElementById('su-name').value = '';
    document.getElementById('su-phone').value = '';
    document.getElementById('su-email').value = '';
    document.getElementById('su-pw').value = '';

    document.getElementById('form-login').style.display = t === 'login' ? '' : 'none';
    document.getElementById('form-signup').style.display = t === 'signup' ? '' : 'none';
    document.getElementById('tab-login').className = 'auth-tab' + (t === 'login' ? ' active' : '');
    document.getElementById('tab-signup').className = 'auth-tab' + (t === 'signup' ? ' active' : '');
    document.getElementById('login-err').style.display = 'none';
    document.getElementById('signup-err').style.display = 'none';
}

export function setLRole(r) {
    if (AppState.loginRole !== r) {
        document.getElementById('login-email').value = '';
        document.getElementById('login-pw').value = '';
        document.getElementById('login-err').style.display = 'none';
    }

    AppState.loginRole = r;
    document.getElementById('lr-c').className = 'role-btn' + (r === 'creator' ? ' ac' : '');
    document.getElementById('lr-f').className = 'role-btn' + (r === 'freelancer' ? ' af' : '');
}

export function setSRole(r) {
    if (AppState.signupRole !== r) {
        document.getElementById('su-name').value = '';
        document.getElementById('su-phone').value = '';
        document.getElementById('su-email').value = '';
        document.getElementById('su-pw').value = '';
        document.getElementById('signup-err').style.display = 'none';
    }

    AppState.signupRole = r;
    document.getElementById('sr-c').className = 'role-btn' + (r === 'creator' ? ' ac' : '');
    document.getElementById('sr-f').className = 'role-btn' + (r === 'freelancer' ? ' af' : '');
    document.getElementById('su-creator-extra').style.display = r === 'creator' ? '' : 'none';
    document.getElementById('su-freelancer-extra').style.display = r === 'freelancer' ? '' : 'none';
}

export async function handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const pw = document.getElementById('login-pw').value;
    const errEl = document.getElementById('login-err');
    errEl.style.display = 'none';

    if (!email || !pw) {
        errEl.textContent = 'Please fill in all fields.';
        errEl.style.display = 'flex';
        return;
    }

    setBtn('login-btn', true, 'Logging in…');

    try {
        const { user, session } = await loginUser(email, pw);
        if (!user || !session) throw new Error('Invalid Login Credentials');

        const { data: profile } = await window.supaClient
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (!profile) throw new Error('Profile not found');

        if (profile.role && profile.role !== AppState.loginRole) {
            await window.supaClient.auth.signOut();
            throw new Error('Invalid Login Credentials');
        }

        const u = {
            id: profile.id,
            name: profile.name || email.split('@')[0],
            full_name: profile.name || '',
            email: profile.email || email,
            role: profile.role || AppState.loginRole,
            platform: profile.platform || '',
            profession: profile.profession || '',
            phone: profile.phone || '',
            avatar: (profile.name || 'U').charAt(0).toUpperCase(),
            createdAt: profile.created_at ? new Date(profile.created_at).getTime() : Date.now()
        };

        window.loginSuccess(u);
        window.showToast('Welcome back, ' + u.name.split(' ')[0] + '!', 'ok');
    } catch (e) {
        errEl.textContent = 'Invalid Login Credentials';
        errEl.style.display = 'flex';
        document.getElementById('login-email').value = '';
        document.getElementById('login-pw').value = '';
    } finally {
        setBtn('login-btn', false);
    }
}

export async function handleSignup() {
    const name = document.getElementById('su-name').value.trim();
    const phone = document.getElementById('su-phone').value.trim();
    const email = document.getElementById('su-email').value.trim();
    const pw = document.getElementById('su-pw').value;
    const profession = document.getElementById('su-profession').value;
    const platform = document.getElementById('su-platform')?.value || '';
    const errEl = document.getElementById('signup-err');

    errEl.style.display = 'none';
    if (!name || !email || !pw) {
        errEl.textContent = 'Please fill in all required fields.';
        errEl.style.display = 'flex';
        return;
    }
    if (pw.length < 6) {
        errEl.textContent = 'Password must be at least 6 characters.';
        errEl.style.display = 'flex';
        return;
    }

    setBtn('signup-btn', true, 'Creating account...');

    try {
        const { user, session } = await registerUser(
            email,
            pw,
            name,
            phone,
            AppState.signupRole,
            profession,
            platform
        );

        if (!session || !user) {
            showToast('Account created! Please confirm your email.', 'info');
            switchTab('login');
            document.getElementById('login-email').value = email;
            return;
        }

        const u = {
            id: user.id,
            name,
            full_name: name,
            email,
            role: AppState.signupRole,
            platform,
            profession,
            phone,
            avatar: name.charAt(0).toUpperCase(),
            createdAt: Date.now()
        };

        window.loginSuccess(u);
        showToast('Welcome, ' + name.split(' ')[0] + '!', 'ok');
    } catch (e) {
        errEl.textContent = e.message || 'Something went wrong. Please try again.';
        errEl.style.display = 'flex';
    } finally {
        setBtn('signup-btn', false);
    }
}
