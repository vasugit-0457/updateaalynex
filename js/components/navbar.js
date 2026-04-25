// js/components/navbar.js

export function toggleSidebar(role) {
    const p = role[0]; // 'c' for creator, 'f' for freelancer
    const sb = document.getElementById(p+'-sidebar');
    const ov = document.getElementById(p+'-overlay');
    const hb = document.getElementById(p+'-hamburger');
    
    if(!sb || !ov || !hb) return;
    
    const open = sb.classList.contains('mobile-open');
    if (open) { 
        sb.classList.remove('mobile-open'); 
        ov.classList.remove('show'); 
        hb.classList.remove('open'); 
    } else { 
        sb.classList.add('mobile-open');    
        ov.classList.add('show');    
        hb.classList.add('open'); 
    }
}

export function closeSidebar(role) {
    const p = role[0];
    const sb = document.getElementById(p+'-sidebar');
    const ov = document.getElementById(p+'-overlay');
    const hb = document.getElementById(p+'-hamburger');
    
    if(sb) sb.classList.remove('mobile-open');
    if(ov) ov.classList.remove('show');
    if(hb) hb.classList.remove('open');
}