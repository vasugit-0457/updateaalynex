// js/screens/landing.js
import { showScreen } from '../router.js';
import { switchTab, setLRole, setSRole } from './auth.js';

export function goAuth(tab, role) {
    showScreen('screen-auth');
    switchTab(tab);
    if (role) { 
        tab === 'signup' ? setSRole(role) : setLRole(role); 
    }
}