// js/components/toast.js

export function showToast(msg, type = 'ok', icon = '') {
    const wrap = document.getElementById('toast-wrap');
    if (!wrap) return;
    
    const t = document.createElement('div');
    const colors = { ok:'var(--green)', err:'var(--red)', info:'var(--accent)', warn:'var(--yellow)' };
    
    t.className = 'toast';
    t.innerHTML = `<span class="toast-icon" style="color:${colors[type]||colors.ok}">${icon}</span><span>${msg}</span>`;
    
    wrap.appendChild(t);
    setTimeout(() => { 
        t.classList.add('hide'); 
        setTimeout(() => t.remove(), 300); 
    }, 3200);
}

export function setBtn(id, loading, text) {
    const btn = document.getElementById(id);
    if (!btn) return;
    if (loading) { 
        btn.classList.add('btn-loading'); 
        btn.disabled = true; 
        btn.textContent = text || '...'; 
    } else { 
        btn.classList.remove('btn-loading'); 
        btn.disabled = false; 
    }
}