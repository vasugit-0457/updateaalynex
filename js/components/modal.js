// js/components/modal.js

export function showModal(title, bodyHtml, onConfirm) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML  = bodyHtml;
    document.getElementById('modal-bg').classList.add('show');
    
    const confirmBtn = document.getElementById('modal-confirm');
    confirmBtn.onclick = () => { 
        closeModal(); 
        if(onConfirm) onConfirm(); 
    };
}

export function closeModal() { 
    document.getElementById('modal-bg').classList.remove('show'); 
}