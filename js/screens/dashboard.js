// js/screens/dashboard.js
import { AppState, DB, fmt, fmtDate, uid, pid, fmtFileSize } from '../state.js';
import { closeSidebar } from '../components/navbar.js';
import { showToast } from '../components/toast.js';
import { showModal } from '../components/modal.js';
import { renderCreatorChat, renderFreelancerChat } from './chat.js';
import { supaClient } from '../services/supabase.js';

// ─── HELPER ICONS ───
function contentIconSvg(t) {
    const icons = {
        'YouTube Long-form': `<svg class="pico-icon" viewBox="0 0 24 24"><rect x="2" y="3" width="15" height="13" rx="2"/><polygon points="22 7 17 10 22 13 22 7"/></svg>`,
        'Instagram Reel':    `<svg class="pico-icon" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/></svg>`,
        'YouTube Shorts':    `<svg class="pico-icon" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
    };
    return icons[t] || `<svg class="pico-icon" viewBox="0 0 24 24"><rect x="2" y="3" width="15" height="13" rx="2"/><polygon points="22 7 17 10 22 13 22 7"/></svg>`;
}
function statusClass(s)  { return { open:'s-pe', ongoing:'s-on', completed:'s-co', cancelled:'s-wa' }[s] || 's-pe'; }
function statusLabel(s)  { return { open:'Open', ongoing:'In Progress', completed:'Completed', cancelled:'Cancelled' }[s] || s; }

export function rateStar(id, n) { document.querySelectorAll('#'+id+' span').forEach((s, i) => s.className = i < n ? 'lit' : ''); }

export function cPage(p, el, isForceNew = false) {
    document.querySelectorAll('#screen-creator .nav-item').forEach(n => n.classList.remove('active'));
    if (el) el.classList.add('active');
    else {
        const fallbackEl = document.querySelector(`#screen-creator .nav-item[data-page="${p}"]`);
        if (fallbackEl) fallbackEl.classList.add('active');
    }
    closeSidebar('creator');
    if (p === 'new') { 
        if (isForceNew) AppState.activeManageProjectId = null;
        if(!AppState.activeManageProjectId) { 
            AppState.wfStep = 0; AppState.selContent = ''; AppState.selFreelancerIds = []; 
            AppState.selFreelancerName = null; AppState.newProjectDraft = {}; AppState.newProjectFiles = []; 
        }
    } else { AppState.activeManageProjectId = null; }
    renderC(p);
}

export function renderC(p) {
    const m = document.getElementById('c-main');
    if (!m) return;
    if      (p === 'home')     m.innerHTML = cHome();
    else if (p === 'new')      m.innerHTML = cNew();
    else if (p === 'projects') m.innerHTML = cProjects();
    else if (p === 'chat')     m.innerHTML = renderCreatorChat();
    else if (p === 'payment')  m.innerHTML = cPayment();
    else if (p === 'rate')     m.innerHTML = cRate();
    else if (p === 'profile')  m.innerHTML = cProfile();
    if (p !== 'chat') { m.classList.remove('fade-in'); void m.offsetWidth; m.classList.add('fade-in'); }
}

// ─── CREATOR SCREENS ───
function cHome() {
    const projs  = DB.projects().filter(p => p.creatorId === AppState.CU.id);
    const active = projs.filter(p => p.status === 'ongoing').length;
    const done   = projs.filter(p => p.status === 'completed').length;
    const recent = projs.slice(-4).reverse();
    return `
    <div class="page-head"><h2>Dashboard</h2><p>Overview of your creator activity</p></div>
    <div class="cards-grid">
        <div class="mc a"><div class="label">Active Projects</div><div class="value">${active}</div><div class="sub">Currently ongoing</div></div>
        <div class="mc g"><div class="label">Completed</div><div class="value">${done}</div><div class="sub">All time</div></div>
        <div class="mc b"><div class="label">Total Projects</div><div class="value">${projs.length}</div><div class="sub">Ever posted</div></div>
    </div>
    <div class="section-title">Recent Projects</div>
    <div class="project-list">
        ${recent.length ? recent.map(p => `
            <div class="pc" style="cursor:pointer;" onclick="window.manageProject('${p.id}')">
                <div class="pico">${contentIconSvg(p.contentType)}</div>
                <div class="pinfo"><div class="ptitle">${p.title}</div><div class="pmeta">${p.freelancerId ? 'Editor assigned' : 'Waiting for acceptance'} · ₹${fmt(p.budget)}</div></div>
                <div class="pstatus ${statusClass(p.status)}">${statusLabel(p.status)}</div>
            </div>`).join('') : '<div style="color:var(--text-3);font-size:.85rem;padding:16px 0;">No projects yet — post your first one!</div>'}
    </div>
    <div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn btn-primary" onclick="window.cPage('new', null, true)">+ Post New Project</button>
        <button class="btn btn-ghost" onclick="window.cPage('projects',null)">View All Projects &rarr;</button>
    </div>`;
}

function cProjects() {
    const projs = DB.projects().filter(p => p.creatorId === AppState.CU.id);
    return `
    <div class="page-head"><h2>My Projects</h2><p>All ${projs.length} projects you've posted</p></div>
    <div class="project-list" id="proj-list">
        ${projs.length ? projs.slice().reverse().map(p => `
            <div class="pc" style="cursor:pointer;" onclick="window.manageProject('${p.id}')">
                <div class="pico">${contentIconSvg(p.contentType)}</div>
                <div class="pinfo"><div class="ptitle">${p.title}</div><div class="pmeta">₹${fmt(p.budget)} · Due ${fmtDate(p.deadline)} · ${p.contentType}</div></div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
                    <div class="pstatus ${statusClass(p.status)}">${p.status === 'open' ? '🔒 Waiting' : statusLabel(p.status)}</div>
                    ${p.status !== 'open' ? `<button class="btn btn-primary btn-xs">Manage</button>` : ''}
                </div>
            </div>`).join('') : '<div style="color:var(--text-3);font-size:.85rem;padding:20px 0;text-align:center;">No projects yet.</div>'}
    </div>`;
}

export function manageProject(pid) {
    const p = DB.projects().find(x => x.id === pid);
    if(!p) return;
    AppState.activeManageProjectId = pid;
    AppState.selFreelancerIds = p.invited_freelancers || [];
    AppState.selContent = p.contentType;
    if (p.status === 'open') { showToast('Waiting for freelancers to accept...', 'info'); return; }
    if (p.status === 'ongoing' && !p.editedUploaded) AppState.wfStep = 5; 
    else if (p.status === 'ongoing' && p.editedUploaded) AppState.wfStep = 6; 
    else AppState.wfStep = 7; 
    cPage('new', document.querySelector('[data-page="new"]'));
}

function cNew() {
    const steps = ['Details','Content','Deadline','Upload Files','Freelancer','Chat','Review','Payment'];
    const stepper = steps.map((s, i) => `<div class="step"><div class="step-dot ${AppState.wfStep === i ? 'active' : (AppState.wfStep > i ? 'done' : '')}">${AppState.wfStep > i ? '✓' : (i + 1)}</div>${i < steps.length - 1 ? `<div class="step-line ${AppState.wfStep > i ? 'done' : ''}"></div>` : ''}</div>`).join('');
    setTimeout(async () => {
        const el = document.getElementById("wf-body");
        if (el) el.innerHTML = await wfContent();
    }, 0);
    return `<div class="page-head"><h2>${AppState.activeManageProjectId ? 'Manage Project' : 'Post a New Project'}</h2></div><div class="wf-stepper">${stepper}</div><div class="wf-body" id="wf-body"></div>`;
}

async function wfContent() {
    if (AppState.wfStep === 0) return `
        <h3>Project Details</h3>
        <div class="fg"><label>Project Title *</label><input id="wf-title" value="${AppState.newProjectDraft.title || ''}" placeholder="e.g. YouTube Vlog Edit – Travel Series EP5"/></div>
        <div class="fg"><label>Description</label><textarea id="wf-desc" placeholder="Describe what you need edited…">${AppState.newProjectDraft.desc || ''}</textarea></div>
        <div class="fg"><label>Budget (₹) *</label><input id="wf-budget" type="number" value="${AppState.newProjectDraft.budget || ''}" placeholder="5000" min="100"/></div>
        <button class="btn btn-primary" onclick="window.wfN()">Next &rarr;</button>`;

    if (AppState.wfStep === 1) return `
        <h3>Choose Content Type</h3>
        <div class="ct-list" style="margin-bottom:18px;">
          ${['YouTube Long-form','Instagram Reel','YouTube Shorts','TikTok','LinkedIn Video','Brand Video','Documentary','Podcast Edit']
              .map(t => `<div class="ct-pill${t===AppState.selContent?' active':''}" onclick="window.selCT('${t}')">${t}</div>`).join('')}
        </div>
        ${AppState.selContent ? `<div class="alert alert-s">Selected: <strong>${AppState.selContent}</strong></div>` : ''}
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-ghost" onclick="window.wfB()">&larr; Back</button>
          <button class="btn btn-primary" onclick="window.wfN()">Next &rarr;</button>
        </div>`;

    if (AppState.wfStep === 2) return `
        <h3>Set Deadline &amp; Priority</h3>
        <div class="fg"><label>Deadline Date *</label><input type="date" id="wf-deadline" value="${AppState.newProjectDraft.deadline || ''}" min="${new Date().toISOString().split('T')[0]}"/></div>
        <div class="fg"><label>Priority Level</label>
          <select id="wf-priority"><option ${AppState.newProjectDraft.priority === 'Normal' ? 'selected' : ''}>Normal</option><option ${AppState.newProjectDraft.priority === 'Urgent (+20% budget)' ? 'selected' : ''}>Urgent (+20% budget)</option><option ${AppState.newProjectDraft.priority === 'Flexible' ? 'selected' : ''}>Flexible</option></select>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-ghost" onclick="window.wfB()">&larr; Back</button>
          <button class="btn btn-primary" onclick="window.wfN()">Next &rarr;</button>
        </div>`;

    if (AppState.wfStep === 3) return `
        <h3>Upload Project Files</h3>
        <label class="upload-area-lg" for="multi-file-input" id="multi-drop-zone">
          <div class="upload-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.25)" stroke-width="1.5"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg></div>
          <div class="upload-label">Drag & drop files or click to select</div>
          <input type="file" id="multi-file-input" multiple accept="video/*,audio/*,image/*" style="display:none;" onchange="window.handleMultiFileUpload(this)"/>
        </label>
        <div id="file-list-preview" style="display:flex;flex-direction:column;gap:8px;margin-top:12px;"></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;">
          <button class="btn btn-ghost" onclick="window.wfB()">&larr; Back</button>
          <button class="btn btn-primary" onclick="window.wfN()">Next &rarr;</button>
        </div>`;

    if (AppState.wfStep === 4) {
        let editors = [];
        if (window.supaClient) {
          try {
            const { data } = await window.supaClient.from("profiles").select("*").eq("role", "freelancer");
            if (data) editors = data;
          } catch (e) {}
        }
        if (!editors || editors.length === 0) editors = DB.users().filter(u => u.role === "freelancer");

        const allProjects = DB.projects();
        const getFreelancerStats = (fid) => {
          const completed = allProjects.filter(p => p.freelancerId === fid && p.status === 'completed');
          const rated = completed.filter(p => p.rating && p.rating > 0);
          const avgRating = rated.length > 0 ? (rated.reduce((s, p) => s + p.rating, 0) / rated.length).toFixed(1) : null;
          return { completedCount: completed.length, avgRating };
        };

        return `
        <h3>Choose Editors to Request</h3>
        <div class="f-grid">
          ${(editors && editors.length > 0) ? editors.map(f => {
            const stats = getFreelancerStats(f.id);
            const ratingDisplay = stats.avgRating ? stats.avgRating : 'New';
            const starsHtml = stats.avgRating ? Array.from({length:5}, (_,i) => `<span style="color:${i < Math.round(stats.avgRating) ? 'var(--yellow)' : 'rgba(0,0,0,0.12)'}">&#9733;</span>`).join('') : `<span style="color:var(--text-3);font-size:.65rem;">No ratings yet</span>`;
            return `
            <div class="f-card${AppState.selFreelancerIds.includes(f.id)?' sel':''}" onclick="window.selFL('${f.id}','${f.name}')">
              <div class="f-avatar" style="${f.photo_url ? 'background:transparent;' : ''}">
                ${f.photo_url ? `<img src="${f.photo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : (f.avatar || 'F')}
              </div>
              <div class="f-name">${f.name}</div>
              <div class="stars">${starsHtml}</div>
              <div class="f-rate">${ratingDisplay} &middot; ${stats.completedCount} Projects</div>
              <div class="f-spec">${f.profession || 'Editor'}</div>
              <div style="margin-top:10px;"><button class="btn btn-outline-f btn-xs full-btn" onclick="event.stopPropagation(); window.viewFreelancerPortfolio('${f.id}')">View Portfolio</button></div>
            </div>`;
          }).join('') : `<div style="color:var(--text-3);font-size:.82rem;grid-column:1/-1;padding:16px 0;">No editors available.</div>`}
        </div><br/>
        ${AppState.selFreelancerIds.length > 0 ? `<div class="alert alert-s">Selected: <strong>${AppState.selFreelancerIds.length} Editors</strong></div>` : ''}
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-ghost" onclick="window.wfB()">&larr; Back</button>
          <button class="btn btn-primary" onclick="window.wfN()">Send Requests &amp; Post &rarr;</button>
        </div>`;
    }

    const proj = DB.projects().find(x => x.id === AppState.activeManageProjectId);
    const isCompleted = proj ? (proj.status === 'completed' || proj.paid) : false;

    if (AppState.wfStep === 5) return `
        <h3>Chat with ${AppState.selFreelancerName || 'Editor'}</h3>
        ${renderCreatorChat()}
        ${!isCompleted ? `<div style="margin-top:14px;"><button class="btn btn-primary" onclick="window.wfN()">Go To Workflow Step &rarr;</button></div>` : ''}`;

    if (AppState.wfStep === 6) {
        if (proj && !proj.editedUploaded) {
            return `<h3>Receive &amp; Review Edited Video</h3><div class="alert alert-i">Waiting for <strong>${AppState.selFreelancerName || 'Your editor'}</strong> to upload the final edited video.</div><button class="btn btn-ghost" onclick="window.wfB()">&larr; Back</button>`;
        }
        return `
          <h3>Receive &amp; Review Edited Video</h3>
          <div class="alert alert-s"><strong>${AppState.selFreelancerName || 'Your editor'}</strong> has uploaded the edited video!</div>
          <div style="background:var(--bg2);border:1px solid var(--glass-border);border-radius:var(--radius);padding:16px;margin-bottom:14px;display:flex;align-items:center;gap:12px;">
              <div style="font-size:1.8rem;"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent2)" stroke-width="1.6"><rect x="2" y="3" width="15" height="13" rx="2"/><polygon points="22 7 17 10 22 13 22 7"/></svg></div>
              <div><div style="font-weight:500;font-size:.88rem;color:var(--text);">Final_Delivered_Video</div><div style="color:var(--text-3);font-size:.75rem;">Requires Payment to Download</div></div>
          </div>
          <button class="btn btn-primary" onclick="window.wfN()">Approve &amp; Pay &rarr;</button>`;
    }

    if (AppState.wfStep === 7) {
        const p = DB.projects().find(x => x.id === AppState.activeManageProjectId);
        const budget = p ? p.budget : 0;
        const fee = Math.round(budget * 0.05);
        const eName = AppState.selFreelancerName || (p ? DB.users().find(u => u.id === p.freelancerId)?.name : 'Editor');
        return `
        <h3>Complete Payment &amp; Rate</h3>
        <div class="two-col">
          <div>
            <div class="section-title">Payment Summary</div>
            <div class="det-card" style="margin-bottom:14px;">
              <div class="info-row"><span class="key">Editor</span><span>${eName}</span></div>
              <div class="info-row"><span class="key">Base Amount</span><span id="pay-base">₹${fmt(budget)}</span></div>
              <div class="info-row"><span class="key">Platform Fee (5%)</span><span id="pay-fee">₹${fmt(fee)}</span></div>
              <div class="info-row" style="font-weight:600;"><span style="color:var(--accent);">Total</span><span id="pay-total" style="color:var(--accent);">₹${fmt(budget+fee)}</span></div>
            </div>
            <button class="btn btn-green-btn full-btn" onclick="window.completePayment()">Pay Now &rarr;</button>
          </div>
          <div>
            <div class="section-title">Rate ${eName}</div>
            <div class="det-card">
              <div class="star-rating" id="sr1">${[1,2,3,4,5].map(n => `<span onclick="window.rateStar('sr1',${n})">&#9733;</span>`).join('')}</div>
              <div class="fg" style="margin-top:10px;"><input id="review-text" placeholder="Amazing work!"/></div>
              <button class="btn btn-primary full-btn" onclick="window.submitReview()">Submit Review</button>
            </div>
          </div>
        </div>`;
    }
    return '';
}

export async function completePayment() {
    const p = DB.projects().find(x => x.id === AppState.activeManageProjectId);
    if (p) { p.paid = true; p.status = 'completed'; DB.saveProjects(DB.projects()); }
    window.showToast('Payment successful!', 'ok');
    cPage('projects', document.querySelector('[data-page="projects"]'));
}

// ─── WORKFLOW HELPERS ───
export async function wfN() {
    if (AppState.wfStep === 0) {
        AppState.newProjectDraft.title = document.getElementById('wf-title')?.value;
        AppState.newProjectDraft.desc = document.getElementById('wf-desc')?.value;
        AppState.newProjectDraft.budget = document.getElementById('wf-budget')?.value;
        if (!AppState.newProjectDraft.title) { window.showToast('Enter Title', 'err'); return; }
    }
    if (AppState.wfStep === 1 && !AppState.selContent) { window.showToast('Select Type', 'err'); return; }
    if (AppState.wfStep === 2) {
        AppState.newProjectDraft.deadline = document.getElementById('wf-deadline')?.value;
        if (!AppState.newProjectDraft.deadline) { window.showToast('Select Deadline', 'err'); return; }
    }
    
    if (AppState.wfStep === 4) {
        if (AppState.selFreelancerIds.length === 0) { window.showToast('Select Editor', 'err'); return; }
        
        const submitBtn = document.querySelector('button[onclick="window.wfN()"]');
        if(submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = 'Posting...'; }

        window.showToast('Project upload ho raha hai...', 'info');
        
        try {
            const pidValue = pid(); 
            const fileMeta = (AppState.newProjectFiles || []).map(f => ({
                name: f.name, size: f.size, displaySize: (f.size / (1024 * 1024)).toFixed(2) + ' MB',
                duration: f.displayDuration || 'Media', type: f.type
            }));

            const newP = { 
                id: pidValue, creatorId: AppState.CU.id, title: AppState.newProjectDraft.title, 
                description: AppState.newProjectDraft.desc, budget: parseInt(AppState.newProjectDraft.budget) || 0, 
                contentType: AppState.selContent, deadline: AppState.newProjectDraft.deadline, 
                priority: 'Normal', invited_freelancers: AppState.selFreelancerIds, 
                status: 'open', createdAt: Date.now(), files: fileMeta,
                editedUploaded: false, paid: false, rating: 0, review: ''
            };

            if (window.supaClient) {
                const { error: projErr } = await window.supaClient.from('projects').insert([{
                    id: newP.id, creator_id: newP.creatorId, title: newP.title, description: newP.description,
                    budget: newP.budget, content_type: newP.contentType, deadline: newP.deadline,
                    invited_freelancers: newP.invited_freelancers, status: 'open', created_at: new Date().toISOString()
                }]);
                if (projErr) throw projErr;
                
                if (AppState.newProjectFiles && AppState.newProjectFiles.length > 0) {
                    const dbAttachments = [];
                    for (let f of AppState.newProjectFiles) {
                        const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                        const path = `project_raw_files/${AppState.CU.id}/${Date.now()}_${safeName}`;
                        let targetBucket = 'videos';
                        if (f.type && f.type.startsWith('audio/')) targetBucket = 'music';
                        else if (f.type && f.type.startsWith('image/')) targetBucket = 'images';

                        const { data: uploadData, error: upErr } = await window.supaClient.storage.from(targetBucket).upload(path, f);
                        let fileUrl = '';
                        if (!upErr && uploadData) {
                            const { data: urlData } = window.supaClient.storage.from(targetBucket).getPublicUrl(uploadData.path);
                            fileUrl = urlData.publicUrl;
                        }
                        dbAttachments.push({
                            project_id: newP.id, creator_id: AppState.CU.id, file_name: f.name,
                            file_url: fileUrl || 'upload_failed', file_type: f.type ? f.type.split('/')[0] : 'file',
                            file_size: f.size, duration: f.displayDuration || null
                        });
                    }
                    await window.supaClient.from('project_attachments').insert(dbAttachments);
                }
            }

            const projs = DB.projects(); projs.push(newP); DB.saveProjects(projs);
            window.showToast('Project Successfully Posted!', 'ok');
            
            AppState.newProjectDraft = {}; AppState.newProjectFiles = []; AppState.selFreelancerIds = []; AppState.wfStep = 0;
            setTimeout(() => { window.cPage('projects', document.querySelector('[data-page="projects"]')); }, 500);
            return; 
        } catch(e) {
            console.error(e);
            window.showToast('Error: ' + e.message, 'err');
            if(submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Send Requests & Post →"; }
            return;
        }
    }
    AppState.wfStep++;
    renderC('new');
}

export function wfB() { AppState.wfStep = Math.max(0, AppState.wfStep - 1); if(typeof renderC === 'function') renderC('new'); }
export function selCT(t) { AppState.selContent = t; if(typeof renderC === 'function') renderC('new'); }
export function selFL(id, name) { 
    if (AppState.selFreelancerIds.includes(id)) {
        AppState.selFreelancerIds = AppState.selFreelancerIds.filter(x => x !== id);
        if (AppState.selFreelancerName === name) AppState.selFreelancerName = null;
    } else {
        AppState.selFreelancerIds.push(id); AppState.selFreelancerName = name;
    }
    if(typeof renderC === 'function') renderC('new'); 
}

// ─── FILE UPLOAD LOGIC ───
function getMediaDuration(file) {
    return new Promise((resolve) => {
        if (!file.type.startsWith('video/') && !file.type.startsWith('audio/')) { resolve(null); return; }
        const media = document.createElement(file.type.startsWith('video/') ? 'video' : 'audio');
        media.preload = 'metadata';
        media.onloadedmetadata = () => {
            URL.revokeObjectURL(media.src);
            const mins = Math.floor(media.duration / 60);
            const secs = Math.floor(media.duration % 60).toString().padStart(2, '0');
            resolve(`${mins}:${secs} mins`);
        };
        media.onerror = () => resolve(null);
        media.src = URL.createObjectURL(file);
    });
}
export async function handleMultiFileUpload(input) {
    if (!input.files || !input.files.length) return;
    const newFiles = Array.from(input.files);
    for (let file of newFiles) { file.displayDuration = await getMediaDuration(file); }
    AppState.newProjectFiles = [...(AppState.newProjectFiles || []), ...newFiles];
    renderFileList();
    input.value = ''; 
}
export function removeProjectFile(index) { AppState.newProjectFiles.splice(index, 1); renderFileList(); }
function renderFileList() {
    const container = document.getElementById('file-list-preview');
    if (!container) return;
    if (!AppState.newProjectFiles || AppState.newProjectFiles.length === 0) { container.innerHTML = ''; return; }
    container.innerHTML = AppState.newProjectFiles.map((file, idx) => {
        return `<div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--surface);border:1px solid var(--glass-border);border-radius:var(--radius-sm);">
            <div style="flex:1;font-size:.85rem;">${file.name} (${fmtFileSize(file.size)})</div>
            <div style="color:var(--red);cursor:pointer;font-weight:bold;" onclick="window.removeProjectFile(${idx})">x</div>
        </div>`;
    }).join('');
}

// ─── PROFILE LOGIC ───
function cPayment() { return `<div class="page-head"><h2>Payments</h2><p>Coming soon...</p></div>`; }
function cRate() { return `<div class="page-head"><h2>Rate Freelancers</h2><p>Coming soon...</p></div>`; }
export async function saveRating(pid) {}
export function downloadEditedVideo(id) { window.showToast('Download starting...', 'ok'); }
export function submitReview() { window.showToast('Review submitted!', 'ok'); window.cPage('projects', document.querySelector('[data-page="projects"]')); }
function cProfile() { return `<div class="page-head"><h2>My Profile</h2></div>`; }
export function saveProfile() {}

// ─── FREELANCER SCREENS ───
export function fPage(p, el) {
    document.querySelectorAll('#screen-freelancer .nav-item').forEach(n => n.classList.remove('active'));
    if (el) el.classList.add('active');
    closeSidebar('freelancer');
    renderF(p);
}
export function renderF(p) {
    const m = document.getElementById('f-main');
    if (!m) return;
    if      (p === 'home')      m.innerHTML = fHome();
    else if (p === 'browse')    m.innerHTML = fBrowse();
    else if (p === 'ongoing')   m.innerHTML = fOngoing();
    else if (p === 'upload')    m.innerHTML = fUpload();
    else if (p === 'profile')   m.innerHTML = `<div class="page-head"><h2>My Profile</h2></div>`;
    else if (p === 'earnings')  m.innerHTML = `<div class="page-head"><h2>Earnings</h2></div>`;
    else if (p === 'chat')      m.innerHTML = renderFreelancerChat();
    else if (p === 'negotiate') m.innerHTML = fNegotiate(); 
    if (p !== 'chat') { m.classList.remove('fade-in'); void m.offsetWidth; m.classList.add('fade-in'); }
}

function fHome() {
    const projs = DB.projects().filter(p => p.freelancerId === AppState.CU.id);
    return `<div class="page-head"><h2>Dashboard</h2><p>Your freelancing overview</p></div>`;
}

function fBrowse() {
    const myId = String(AppState.CU.id).toLowerCase();
    
    // SIMPLE LOCAL DB FILTER (Purana fast system)
    const projs = DB.projects().filter(p => {
        if (p.status !== 'open') return false;
        let invited = p.invited_freelancers;
        if (typeof invited === 'string') { try { invited = JSON.parse(invited); } catch(e) { return false; } }
        if (!Array.isArray(invited)) return false;
        return invited.some(id => String(id).toLowerCase() === myId);
    });

    return `
    <div class="page-head"><h2>Browse Projects</h2><p>Invitations from creators</p></div>
    <div class="project-list">
        ${projs.length ? projs.map(p => `
            <div class="pc" style="padding:16px; border-radius:12px; display:flex; justify-content:space-between; background:var(--surface); border:1px solid var(--glass-border);">
                <div>
                    <div style="font-size:1.05rem;font-weight:bold;">${p.title}</div>
                    <div style="font-size:.85rem;color:var(--text-3);">₹${fmt(p.budget)} &middot; ${p.contentType || 'Video'}</div>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="btn btn-ghost btn-sm" onclick="window.viewProjectDetails('${p.id}')">View Details</button>
                    <button class="btn btn-primary btn-sm" onclick="window.acceptProject('${p.id}')">Accept Job</button>
                </div>
            </div>`).join('') : '<div style="color:var(--text-3);font-size:.85rem;padding:20px 0;">No project invitations right now.</div>'}
    </div>`;
}

function fOngoing() {
    const projs = DB.projects().filter(p => p.freelancerId === AppState.CU.id && p.status === 'ongoing');
    return `
    <div class="page-head"><h2>Ongoing Projects</h2></div>
    <div style="display:flex; flex-direction:column; gap:16px;">
        ${projs.length ? projs.map(p => `
            <div class="det-card" style="padding: 24px; border-radius:12px;">
                <div style="font-weight:700; font-size:1.1rem; color:var(--text);">${p.title}</div>
                <div style="margin-top:14px; display:flex; gap:12px;">
                    <button class="btn btn-ghost btn-sm" onclick="window.fPage('chat', document.querySelector('[data-page=chat]')); setTimeout(()=>window.switchChat('${AppState.CU.id}', '${p.creatorId}'), 100);">Chat</button>
                    <button class="btn btn-primary btn-sm" onclick="window.fPage('upload', document.querySelector('[data-page=upload]'))">Upload Final</button>
                </div>
            </div>`).join('') : '<div style="color:var(--text-3);font-size:.85rem;padding:20px 0;">No ongoing projects right now.</div>'}
    </div>`;
}

function fNegotiate() {
    const myId = String(AppState.CU.id).toLowerCase();
    const projs = DB.projects().filter(p => {
        if (p.status !== 'open') return false;
        let invited = p.invited_freelancers;
        if (typeof invited === 'string') { try { invited = JSON.parse(invited); } catch(e) { return false; } }
        if (!Array.isArray(invited)) return false;
        return invited.some(id => String(id).toLowerCase() === myId);
    });

    return `
    <div class="page-head"><h2>Negotiate Price</h2></div>
    <div style="margin-bottom:24px;">
        <select id="neg-project-select" style="width:100%; padding:12px; border-radius:8px; border:1px solid var(--glass-border); outline:none;" onchange="window.toggleNegotiationCard(this.value)">
            <option value="" disabled selected>-- Choose a project --</option>
            ${projs.map(p => `<option value="${p.id}">${p.title} (Offer: ₹${fmt(p.budget)})</option>`).join('')}
        </select>
    </div>
    <div id="neg-cards-container">
        ${projs.map(p => `
            <div id="neg-card-${p.id}" class="det-card neg-card-item" style="display:none; padding:24px;">
                <h3>${p.title}</h3>
                <div class="fg"><label>Counter Price</label><input type="number" id="neg-price-${p.id}" value="${Math.round(p.budget * 1.15)}"></div>
                <button class="btn" style="background:#e85d2e; color:white;" onclick="window.sendNegotiation('${p.id}')">Send Offer</button>
            </div>
        `).join('')}
    </div>`;
}
export function toggleNegotiationCard(pid) {
    document.querySelectorAll('.neg-card-item').forEach(el => el.style.display = 'none');
    const selected = document.getElementById('neg-card-' + pid);
    if (selected) selected.style.display = 'block';
}

export async function sendNegotiation(pid) {
    window.showToast('Offer sent to creator!', 'ok');
}

export async function viewProjectDetails(pid) {
    const p = DB.projects().find(x => x.id === pid);
    if(!p) return;
    
    let filesHtml = p.files ? p.files.map(f => `<div>📁 ${f.name} (${f.displaySize})</div>`).join('') : 'No extra files attached.';
    
    const modalId = 'proj-modal-' + Date.now();
    const overlay = document.createElement('div');
    overlay.id = modalId;
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;';
    overlay.innerHTML = `
        <div style="background:var(--bg); width:100%; max-width:550px; border-radius:16px; padding:24px;">
            <h3>${p.title}</h3>
            <p>${p.description || 'No description provided.'}</p>
            <div style="background:rgba(224,92,42,.1); padding:10px; border-radius:8px; font-size:0.8rem; color:var(--accent);">🔒 Accept Job to Unlock Files</div>
            <div style="margin-top:20px; display:flex; justify-content:flex-end; gap:12px;">
                <button class="btn btn-ghost" onclick="document.getElementById('${modalId}').remove()">Close</button>
                <button class="btn btn-primary" onclick="window.acceptProject('${p.id}'); document.getElementById('${modalId}').remove();">Accept Job</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
}

export async function acceptProject(pid) {
    try {
        const projs = DB.projects();
        const p = projs.find(x => x.id === pid);
        if (!p) return;

        p.freelancerId = AppState.CU.id;
        p.status = 'ongoing';
        DB.saveProjects(projs);
        
        let fileLinksText = "No raw files were attached.";

        if (window.supaClient) {
            await window.supaClient.from('projects').update({ freelancer_id: AppState.CU.id, status: 'ongoing' }).eq('id', pid);
            const { data: attachments } = await window.supaClient.from('project_attachments').select('*').eq('project_id', pid);

            if (attachments && attachments.length > 0) {
                fileLinksText = attachments.map(f => {
                    const size = f.file_size ? (f.file_size / (1024*1024)).toFixed(2) + ' MB' : '';
                    if (f.file_url && f.file_url.startsWith('http')) {
                        return `<div style="background:rgba(255,255,255,0.15); padding:10px; border-radius:8px; margin-bottom:8px;">
                            <div style="font-weight:600; font-size:0.85rem; margin-bottom:8px;">📁 ${f.file_name} <span style="font-weight:normal; opacity:0.8;">(${size})</span></div>
                            <a href="${f.file_url}" target="_blank" download style="display:inline-block; background:var(--bg); color:var(--text); padding:6px 14px; border-radius:6px; font-size:0.75rem; font-weight:700; text-decoration:none;">⬇ Download File</a>
                        </div>`;
                    }
                    return '';
                }).join('');
            } else if (p.files && p.files.length > 0) {
                fileLinksText = p.files.map(f => `📁 <b>${f.name}</b> (${f.displaySize})<br>❌ <span style="color:var(--red);">Cloud link unavailable</span>`).join('<br><br>');
            }

            let convoId = null;
            const { data: convos } = await window.supaClient.from('conversations').select('id, user1_id, user2_id').or(`user1_id.eq.${AppState.CU.id},user2_id.eq.${AppState.CU.id}`);
            if (convos && convos.length > 0) {
                const existing = convos.find(c => (c.user1_id === p.creatorId && c.user2_id === AppState.CU.id) || (c.user1_id === AppState.CU.id && c.user2_id === p.creatorId));
                if (existing) convoId = existing.id;
            }
            if (!convoId) {
                const { data: newConvo } = await window.supaClient.from('conversations').insert([{ user1_id: AppState.CU.id, user2_id: p.creatorId }]).select('id').single();
                if (newConvo) convoId = newConvo.id;
            }

            const finalMessage = `I have accepted the project "${p.title}"! ✅<br><br>I can now access the raw files:<br><br>${fileLinksText}`;
            if (convoId) {
                await window.supaClient.from('messages').insert([{ conversation_id: convoId, sender_id: AppState.CU.id, text: finalMessage }]);
            }
            
            if (typeof DB.messages === 'function') {
                const key = [AppState.CU.id, p.creatorId].sort().join('_');
                let allMsgs = DB.messages() || {};
                if (!allMsgs[key]) allMsgs[key] = [];
                allMsgs[key].push({ from: AppState.CU.id, text: finalMessage, time: Date.now() });
                if (typeof DB.saveMessages === 'function') DB.saveMessages(allMsgs);
            }
        }

        window.showToast('Project Accepted! Files unlocked in Chat.', 'ok');
        window.fPage('ongoing', document.querySelector('[data-page=ongoing]'));
    } catch (error) {
        console.error("Accept Error Details:", error);
        window.showToast('Error syncing chat.', 'err');
    }
}

export async function rejectProject(pid) {
    const projs = DB.projects();
    const p = projs.find(x => x.id === pid);
    if (p && p.invited_freelancers) {
        p.invited_freelancers = p.invited_freelancers.filter(id => id !== AppState.CU.id);
        DB.saveProjects(projs); 
        window.showToast('Project rejected.', 'info');
        window.fPage('browse', document.querySelector('[data-page=browse]'));
    }
}

function fUpload() {
    const projs = DB.projects().filter(p => p.freelancerId === AppState.CU.id && p.status === 'ongoing' && !p.editedUploaded);
    return `
    <div class="page-head"><h2>Upload Final Work</h2></div>
    ${projs.length ? `
        <div class="fg">
            <select id="f-up-proj">${projs.map(p => `<option value="${p.id}">${p.title}</option>`).join('')}</select>
        </div>
        <label class="upload-area-lg" for="f-final-upload">
          <div class="upload-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg></div>
          <div class="upload-label">Select final edited video</div>
          <input type="file" id="f-final-upload" accept="video/*" style="display:none;" onchange="window.handleFinalUpload(this)"/>
        </label>
    ` : '<div class="alert alert-i">You have no pending uploads right now!</div>'}
    `;
}

export async function handleFinalUpload(input, projectId) {
    if (!input.files || !input.files.length) return;
    let finalProjId = projectId;
    if (!finalProjId || typeof finalProjId === 'object') {
        const visibleSelects = Array.from(document.querySelectorAll('select')).filter(el => el.offsetParent !== null);
        if (visibleSelects.length > 0) finalProjId = visibleSelects[0].value;
    }
    if (!finalProjId) return;

    window.showToast('Uploading Final Work...', 'info');
    try {
        let fileUrl = null;
        if (window.supaClient) {
            const path = `final_delivery/${AppState.CU.id}/${Date.now()}_${input.files[0].name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
            const { data: uploadData } = await window.supaClient.storage.from('videos').upload(path, input.files[0]);
            if (uploadData) {
                const { data: urlData } = window.supaClient.storage.from('videos').getPublicUrl(uploadData.path);
                fileUrl = urlData?.publicUrl;
            }
        }
        
        const projs = DB.projects();
        const p = projs.find(x => String(x.id) === String(finalProjId));
        if(p) { p.editedUploaded = true; DB.saveProjects(projs); }

        await window.sendMsg(AppState.CU.id, p.creatorId, fileUrl, input.files[0].name, 'Final Delivery');
        window.showToast('Final work sent!', 'ok');
        input.value = ''; 
    } catch (err) { window.showToast('Upload failed', 'err'); }
}

export async function triggerApproveAndPay(projectId) {
    window.showToast('Processing Payment...', 'info');
    try {
        const projs = DB.projects();
        const proj = projs.find(p => p.id === projectId);
        if (!proj) return;

        proj.status = 'completed'; proj.paid = true; DB.saveProjects(projs);
        if (window.supaClient) await window.supaClient.from('projects').update({ status: 'completed', paid: true }).eq('id', projectId);
        
        await window.sendMsg(AppState.CU.id, proj.freelancerId, null, null, "✅ Project Approved & Paid!");
        window.showToast('Payment Successful!', 'ok');
    } catch (e) { window.showToast('Payment error.', 'err'); }
}

export function saveFProfile() {}
export function viewFreelancerPortfolio(id) {
    const f = DB.users().find(u => u.id === id);
    if (!f) return;
    const modalId = 'portfolio-modal-' + Date.now();
    const overlay = document.createElement('div');
    overlay.id = modalId;
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.4); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px; box-sizing:border-box; backdrop-filter:blur(3px);';
    overlay.innerHTML = `
        <div style="background:var(--bg); width:100%; max-width:420px; border-radius:16px; padding: 24px;">
            <h3>Freelancer Profile</h3>
            <div style="font-weight:700; font-size:1.2rem; color:var(--text);">${f.name}</div>
            <div style="margin-top:20px; display:flex; justify-content:flex-end; gap:10px;">
                <button onclick="document.getElementById('${modalId}').remove()" class="btn btn-ghost">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}
export async function handleProfilePhotoUpload(input) {}
