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
    
    if (el) {
        el.classList.add('active');
    } else {
        const fallbackEl = document.querySelector(`#screen-creator .nav-item[data-page="${p}"]`);
        if (fallbackEl) fallbackEl.classList.add('active');
    }
    
    closeSidebar('creator');
    
    if (p === 'new') { 
        if (isForceNew) AppState.activeManageProjectId = null;
        
        if(!AppState.activeManageProjectId) { 
            AppState.wfStep = 0; 
            AppState.selContent = ''; 
            AppState.selFreelancerIds = []; 
            AppState.selFreelancerName = null; 
            AppState.newProjectDraft = {}; 
            AppState.newProjectFiles = []; 
        }
    } else { 
        AppState.activeManageProjectId = null; 
    }
    
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

// ─── SCREENS ───
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
                <div class="pinfo">
                    <div class="ptitle">${p.title}</div>
                    <div class="pmeta">${p.freelancerId ? 'Editor assigned' : 'Waiting for acceptance'} · ₹${fmt(p.budget)}</div>
                </div>
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
          <select id="wf-priority">
            <option ${AppState.newProjectDraft.priority === 'Normal' ? 'selected' : ''}>Normal</option>
            <option ${AppState.newProjectDraft.priority === 'Urgent (+20% budget)' ? 'selected' : ''}>Urgent (+20% budget)</option>
            <option ${AppState.newProjectDraft.priority === 'Flexible' ? 'selected' : ''}>Flexible</option>
          </select>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-ghost" onclick="window.wfB()">&larr; Back</button>
          <button class="btn btn-primary" onclick="window.wfN()">Next &rarr;</button>
        </div>`;

    if (AppState.wfStep === 3) return `
        <h3>Upload Project Files</h3>
        <p style="color:var(--text-3);font-size:.8rem;margin-bottom:14px;">Upload all videos, images, and music for this project. Editors will see this before accepting.</p>
        <label class="upload-area-lg" for="multi-file-input" id="multi-drop-zone">
          <div class="upload-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.25)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
          </div>
          <div class="upload-label">Drag & drop files or click to select</div>
          <div class="upload-sub">Videos, Images, Audio</div>
          <input type="file" id="multi-file-input" multiple accept="video/*,audio/*,image/*" style="display:none;" onchange="window.handleMultiFileUpload(this)"/>
        </label>
        <div id="file-list-preview" style="display:flex;flex-direction:column;gap:8px;margin-top:12px;"></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;">
          <button class="btn btn-ghost" onclick="window.wfB()">&larr; Back</button>
          <button class="btn btn-primary" onclick="window.wfN()">Next &rarr;</button>
        </div>`;

    if (AppState.wfStep === 4) {
        let editors = [];
        if (supaClient) {
          try {
            const { data, error } = await supaClient.from("profiles").select("*").eq("role", "freelancer");
            if (!error && data) editors = data;
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
        <p style="color:var(--text-3);font-size:.8rem;margin-bottom:14px;">Select multiple freelancers. First to accept gets the job!</p>
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
              <div style="margin-top:10px;">
                <button class="btn btn-outline-f btn-xs full-btn" onclick="event.stopPropagation(); window.viewFreelancerPortfolio('${f.id}')">View Portfolio</button>
              </div>
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
    const flId = proj ? proj.freelancerId : null;
    const isCompleted = proj ? (proj.status === 'completed' || proj.paid) : false;

    if (AppState.wfStep === 5) return `
        <h3>Chat with ${AppState.selFreelancerName || 'Editor'}</h3>
        ${renderCreatorChat()}
        ${!isCompleted ? `
        <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-primary" onclick="window.wfN()">Go To Workflow Step &rarr;</button>
        </div>` : ''}`;

    if (AppState.wfStep === 6) {
        if (proj && !proj.editedUploaded) {
            return `
            <h3>Receive &amp; Review Edited Video</h3>
            <div class="alert alert-i">Waiting for <strong>${AppState.selFreelancerName || 'Your editor'}</strong> to upload the final edited video. You will be notified in chat once it's ready.</div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <button class="btn btn-ghost" onclick="window.wfB()">&larr; Back</button>
            </div>`;
        }
        return `
          <h3>Receive &amp; Review Edited Video</h3>
          <div class="alert alert-s"><strong>${AppState.selFreelancerName || 'Your editor'}</strong> has uploaded the edited video!</div>
          <div style="background:var(--bg2);border:1px solid var(--glass-border);border-radius:var(--radius);padding:16px;margin-bottom:14px;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
              <div style="font-size:1.8rem;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent2)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="15" height="13" rx="2"/><polygon points="22 7 17 10 22 13 22 7"/></svg>
              </div>
              <div>
                <div style="font-weight:500;font-size:.88rem;color:var(--text);">Final_Delivered_Video</div>
                <div style="color:var(--text-3);font-size:.75rem;">Requires Payment to Download</div>
              </div>
              <button class="btn btn-ghost btn-sm" style="margin-left:auto;" onclick="window.downloadEditedVideo('${AppState.activeManageProjectId}')">Download</button>
            </div>
            <div class="pb"><div class="pf" style="width:100%;"></div></div>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn btn-primary" onclick="window.wfN()">Approve &amp; Pay &rarr;</button>
          </div>`;
    }

    if (AppState.wfStep === 7) {
        const p = DB.projects().find(x => x.id === AppState.activeManageProjectId);
        const budget = p ? p.budget : 0;
        const fee = Math.round(budget * 0.05);
        const total = budget + fee;
        const eName = AppState.selFreelancerName || (p ? DB.users().find(u => u.id === p.freelancerId)?.name : 'Editor');
        const cType = AppState.selContent || (p ? p.contentType : 'Video');

        return `
        <h3>Complete Payment &amp; Rate</h3>
        <div class="two-col">
          <div>
            <div class="section-title">Payment Summary</div>
            <div class="det-card" style="margin-bottom:14px;">
              <div class="info-row"><span class="key">Editor</span><span>${eName}</span></div>
              <div class="info-row"><span class="key">Content Type</span><span>${cType}</span></div>
              <div class="info-row"><span class="key">Base Amount</span><span id="pay-base">₹${fmt(budget)}</span></div>
              <div class="info-row"><span class="key">Platform Fee (5%)</span><span id="pay-fee">₹${fmt(fee)}</span></div>
              <div class="info-row" style="font-weight:600;"><span style="color:var(--accent);">Total</span><span id="pay-total" style="color:var(--accent);">₹${fmt(total)}</span></div>
            </div>
            <div class="fg"><label>Payment Method</label>
              <select><option>UPI</option><option>Net Banking</option><option>Credit/Debit Card</option><option>Wallet</option></select>
            </div>
            <button class="btn btn-green-btn full-btn" onclick="window.completePayment()">Pay Now &rarr;</button>
          </div>
          <div>
            <div class="section-title">Rate ${eName}</div>
            <div class="det-card">
              <p style="margin-bottom:10px;">How was your experience?</p>
              <div class="star-rating" id="sr1">${[1,2,3,4,5].map(n => `<span onclick="window.rateStar('sr1',${n})">&#9733;</span>`).join('')}</div>
              <div class="fg" style="margin-top:10px;"><label>Write a Review</label><input id="review-text" placeholder="Amazing work, delivered on time!"/></div>
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
    showToast('Payment successful!', 'ok');
    cPage('projects', document.querySelector('[data-page="projects"]'));
}

// ─── FILE UPLOAD & PREVIEW LOGIC ───
function getMediaDuration(file) {
    return new Promise((resolve) => {
        if (!file.type.startsWith('video/') && !file.type.startsWith('audio/')) {
            resolve(null); return;
        }
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
    
    for (let file of newFiles) {
        file.displayDuration = await getMediaDuration(file);
    }
    
    AppState.newProjectFiles = [...(AppState.newProjectFiles || []), ...newFiles];
    renderFileList();
    input.value = ''; 
}

export function removeProjectFile(index) {
    AppState.newProjectFiles.splice(index, 1);
    renderFileList();
}

function renderFileList() {
    const container = document.getElementById('file-list-preview');
    if (!container) return;

    if (!AppState.newProjectFiles || AppState.newProjectFiles.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = AppState.newProjectFiles.map((file, idx) => {
        const sizeStr = fmtFileSize(file.size);
        let iconSvg = '';
        
        if (file.type.startsWith('video/')) {
            iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>`;
        } else if (file.type.startsWith('audio/')) {
            iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
        } else {
            iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
        }

        const durationHtml = file.displayDuration 
            ? ` <span style="margin:0 5px;color:rgba(0,0,0,0.15);">&bull;</span> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px;margin-right:3px;vertical-align:-1px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${file.displayDuration}` 
            : '';

        return `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--surface);border:1px solid var(--glass-border);border-radius:var(--radius-sm);box-shadow:var(--shadow-xs);">
            <div style="width:38px;height:38px;border-radius:8px;background:var(--bg2);display:flex;align-items:center;justify-content:center;color:var(--text-2);flex-shrink:0;">
                ${iconSvg}
            </div>
            <div style="flex:1;min-width:0;">
                <div style="font-weight:500;font-size:.85rem;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${file.name}</div>
                <div style="font-size:.7rem;color:var(--text-3);margin-top:2px;display:flex;align-items:center;">
                    ${sizeStr} ${durationHtml}
                </div>
            </div>
            <div style="color:var(--red);cursor:pointer;font-family:sans-serif;font-weight:bold;font-size:.9rem;padding:4px 8px;transition:transform 0.2s;" onclick="window.removeProjectFile(${idx})" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">
                x
            </div>
        </div>`;
    }).join('');
}

// ─── REAL SCREENS FOR PAYMENT, RATE, PROFILE ───
function cPayment() {
    const projs   = DB.projects().filter(p => p.creatorId === AppState.CU.id);
    const paid    = projs.filter(p => p.paid).reduce((s,p) => s+p.budget, 0);
    const pending = projs.filter(p => !p.paid && p.status==='completed').reduce((s,p) => s+p.budget, 0);
    return `
    <div class="page-head"><h2>Payments</h2></div>
    <div class="cards-grid">
        <div class="mc a"><div class="label">Pending</div><div class="value">₹${fmt(pending)}</div></div>
        <div class="mc g"><div class="label">Total Paid</div><div class="value">₹${fmt(paid)}</div></div>
        <div class="mc"><div class="label">Projects</div><div class="value">${projs.length}</div></div>
    </div>
    <div class="section-title">Transactions</div>
    <div class="project-list">
        ${projs.length ? projs.map(p => `
            <div class="pc">
                <div class="pico"><svg class="pico-icon" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>
                <div class="pinfo"><div class="ptitle">${p.title}</div><div class="pmeta">₹${fmt(p.budget)} · ${fmtDate(p.createdAt)}</div></div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <div class="pstatus ${p.paid?'s-co':'s-pe'}">${p.paid?'Paid':'Pending'}</div>
                    ${!p.paid && p.status==='completed' ? `<button class="btn btn-green-btn btn-xs" onclick="window.manageProject('${p.id}')">Pay Now</button>` : ''}
                </div>
            </div>`).join('') : '<div style="color:var(--text-3);font-size:.85rem;padding:20px 0;">No transactions yet.</div>'}
    </div>`;
}

function cRate() {
    const projs = DB.projects().filter(p => p.creatorId===AppState.CU.id && p.status==='completed' && p.rating===0);
    return `
    <div class="page-head"><h2>Rate Freelancers</h2></div>
    ${projs.length ? projs.map(p => `
        <div class="det-card">
            <h4>${p.title}</h4><p>Completed &middot; ₹${fmt(p.budget)}</p>
            <div class="star-rating" id="sr-${p.id}">${[1,2,3,4,5].map(n => `<span onclick="window.rateStar('sr-${p.id}',${n})">&#9733;</span>`).join('')}</div>
            <div class="fg" style="margin-top:10px;"><label>Write a Review</label><input id="rev-${p.id}" placeholder="Great work!"/></div>
            <button class="btn btn-primary btn-sm" onclick="window.saveRating('${p.id}')">Submit Rating</button>
        </div>`).join('') : '<div class="alert alert-i">You\'ve rated all completed projects!</div>'}`;
}

export async function saveRating(pid) {
    const rating = document.querySelectorAll(`#sr-${pid} span.lit`).length;
    if (!rating) { showToast('Please select a star rating', 'err'); return; }
    const review = document.getElementById('rev-'+pid)?.value || '';
    const projs = DB.projects(), p = projs.find(x => x.id === pid);
    if (p) {
        p.rating = rating; p.review = review; DB.saveProjects(projs);
        if (supaClient) await supaClient.from('projects').update({ rating: rating, review: review }).eq('id', pid);
        showToast(`Rating submitted! ${rating} stars`, 'ok');
    }
    renderC('rate');
}

function cProfile() {
    const u = AppState.CU;
    return `
    <div class="page-head"><h2>My Profile</h2></div>
    <div class="two-col">
        <div style="display:flex; flex-direction:column; gap:16px;">
            <div class="det-card">
                <div class="section-title">Personal Info</div>
                <div class="fg"><label>Full Name</label><input id="prof-name" value="${u.name}"/></div>
                <div class="fg"><label>Email</label><input value="${u.email}" disabled style="opacity:.5;"/></div>
                <div class="fg"><label>Phone</label><input id="prof-phone" value="${u.phone||''}"/></div>
                <div class="fg"><label>Primary Platform</label>
                    <select id="prof-platform">${['YouTube','Instagram','TikTok','LinkedIn','Multiple'].map(p => `<option${u.platform===p?' selected':''}>${p}</option>`).join('')}</select>
                </div>
                <button class="btn btn-primary" onclick="window.saveProfile()">Save Changes</button>
            </div>
            
            <div class="det-card">
                <div class="section-title">Account Stats</div>
                ${[['Projects Posted', DB.projects().filter(p=>p.creatorId===AppState.CU.id).length],
                   ['Completed',       DB.projects().filter(p=>p.creatorId===AppState.CU.id&&p.status==='completed').length],
                   ['Member Since',    new Date(u.createdAt).toLocaleDateString('en-IN',{month:'long',year:'numeric'})],
                   ['Role',            u.role.charAt(0).toUpperCase()+u.role.slice(1)]]
                  .map(([k,v]) => `<div class="info-row"><span class="key">${k}</span><span>${v}</span></div>`).join('')}
            </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:16px;">
            <div class="det-card" style="text-align:center;">
                <div class="section-title" style="text-align:left;">Profile Photo</div>
                <div style="width:80px; height:80px; border-radius:50%; background:var(--bg2); margin:0 auto 16px; overflow:hidden; display:flex; align-items:center; justify-content:center; border:1px solid var(--glass-border);">
                    ${u.photo_url ? `<img src="${u.photo_url}" style="width:100%;height:100%;object-fit:cover;">` : `<span style="font-size:2.5rem; color:var(--text-3); font-family: 'Outfit', sans-serif; font-weight:700;">${u.avatar}</span>`}
                </div>
                <label class="btn btn-ghost btn-sm" style="cursor:pointer; display:inline-block;">
                    Upload New Photo
                    <input type="file" accept="image/*" style="display:none;" onchange="window.handleProfilePhotoUpload(this)">
                </label>
            </div>

            <div class="det-card">
                <div class="section-title">Social Links</div>
                <div class="fg"><label>Instagram Profile Link</label><input id="c-prof-insta" value="${u.instaLink || ''}" placeholder="https://instagram.com/yourhandle"/></div>
                <div class="fg"><label>YouTube Channel Link</label><input id="c-prof-yt" value="${u.ytLink || ''}" placeholder="https://youtube.com/@yourchannel"/></div>
                <div class="fg"><label>Website / Work Link</label><input id="c-prof-work" value="${u.workLink || ''}" placeholder="https://yourwebsite.com"/></div>
                <button class="btn btn-primary" onclick="window.saveProfile()">Save Links</button>
            </div>
        </div>
    </div>`;
}

export function saveProfile() {
    const name = document.getElementById('prof-name')?.value?.trim();
    if (!name) { window.showToast('Name cannot be empty', 'err'); return; }
    const phone    = document.getElementById('prof-phone')?.value?.trim();
    const platform = document.getElementById('prof-platform')?.value;
    
    const instaLink = document.getElementById('c-prof-insta')?.value?.trim() || '';
    const ytLink = document.getElementById('c-prof-yt')?.value?.trim() || '';
    const workLink = document.getElementById('c-prof-work')?.value?.trim() || '';

    const users = DB.users(), u = users.find(x => x.id === AppState.CU.id);
    
    if (u) { 
        u.name = name; u.phone = phone; u.platform = platform; u.avatar = name.charAt(0).toUpperCase(); 
        u.instaLink = instaLink; u.ytLink = ytLink; u.workLink = workLink;
        DB.saveUsers(users); 
    }
    AppState.CU = {...AppState.CU, name, phone, platform, instaLink, ytLink, workLink}; 
    DB.setCurrentUser(AppState.CU);
    
    const navName = document.getElementById('c-nav-name');
    const sbName = document.getElementById('c-sb-name');
    const sbAvatar = document.getElementById('c-sb-avatar');
    
    if(navName) navName.textContent  = name.split(' ')[0];
    if(sbName) sbName.textContent   = name;
    if(sbAvatar) sbAvatar.textContent = name.charAt(0).toUpperCase();
    
    if (supaClient && AppState.CU.id) {
        supaClient.from('profiles').update({ 
            name, phone, platform, insta_link: instaLink, yt_link: ytLink, work_link: workLink 
        }).eq('id', AppState.CU.id).then(() => {});
    }
    
    window.showToast('Profile updated', 'ok');
    
    if (AppState.CU.role === 'creator') {
        window.cPage('profile', document.querySelector('[data-page="profile"]'));
    } else {
        window.fPage('profile', document.querySelector('[data-page="profile"]'));
    }
}

// ─── FREELANCER ROUTING & SCREENS ───
export function fPage(p, el) {
    document.querySelectorAll('#screen-freelancer .nav-item').forEach(n => n.classList.remove('active'));
    if (el) el.classList.add('active');
    closeSidebar('freelancer');
    renderF(p);
}
export function renderF(p) {
    const m = document.getElementById('f-main');
    if (!m) return;

    if (p === 'home')          m.innerHTML = fHome();
    else if (p === 'browse')   m.innerHTML = fBrowse();
    else if (p === 'ongoing')  m.innerHTML = fOngoing();
    else if (p === 'upload')   m.innerHTML = fUpload();
    else if (p === 'profile')  m.innerHTML = fProfile();
    else if (p === 'earnings') m.innerHTML = fEarnings();
    else if (p === 'chat')     m.innerHTML = renderFreelancerChat();
    else if (p === 'negotiate') m.innerHTML = fNegotiate(); 
    else m.innerHTML = `<div class="page-head"><h2>Freelancer ${p}</h2><p>Coming soon...</p></div>`;

    if (p !== 'chat') { m.classList.remove('fade-in'); void m.offsetWidth; m.classList.add('fade-in'); }
}

function fHome() {
    const projs = DB.projects().filter(p => p.freelancerId === AppState.CU.id);
    const ongoingProjs = projs.filter(p => p.status === 'ongoing');
    const ongoingCount = ongoingProjs.length;
    const doneCount = projs.filter(p => p.status === 'completed').length;
    const earned = projs.filter(p => p.paid).reduce((s, p) => s + p.budget, 0);
    const requestsCount = DB.projects().filter(p => p.status === 'open' && p.invited_freelancers && p.invited_freelancers.includes(AppState.CU.id)).length;

    return `
    <div class="page-head"><h2>Dashboard</h2><p>Your freelancing overview</p></div>
    
    <div style="display:flex; gap:12px; margin-bottom:24px; flex-wrap:wrap;">
        <div style="background:rgba(224,92,42,.04); border:1px solid rgba(224,92,42,.2); border-radius:10px; padding:12px 16px; flex:1; min-width:110px; max-width:160px;">
            <div style="font-size:.75rem; color:var(--text-3); margin-bottom:2px;">Ongoing</div>
            <div style="font-family:'Outfit',sans-serif; font-size:1.4rem; font-weight:700; color:var(--accent);">${ongoingCount}</div>
        </div>
        <div style="background:rgba(22,163,74,.04); border:1px solid rgba(22,163,74,.2); border-radius:10px; padding:12px 16px; flex:1; min-width:130px; max-width:180px;">
            <div style="font-size:.75rem; color:var(--text-3); margin-bottom:2px;">Total Earned</div>
            <div style="font-family:'Outfit',sans-serif; font-size:1.4rem; font-weight:700; color:var(--green);">₹${fmt(earned)}</div>
        </div>
        <div style="background:rgba(124,58,237,.04); border:1px solid rgba(124,58,237,.2); border-radius:10px; padding:12px 16px; flex:1; min-width:110px; max-width:160px;">
            <div style="font-size:.75rem; color:var(--text-3); margin-bottom:2px;">Completed</div>
            <div style="font-family:'Outfit',sans-serif; font-size:1.4rem; font-weight:700; color:var(--accent2);">${doneCount}</div>
        </div>
        <div style="background:rgba(29,78,216,.04); border:1px solid rgba(29,78,216,.2); border-radius:10px; padding:12px 16px; flex:1; min-width:110px; max-width:160px;">
            <div style="font-size:.75rem; color:var(--text-3); margin-bottom:2px;">Requests</div>
            <div style="font-family:'Outfit',sans-serif; font-size:1.4rem; font-weight:700; color:var(--blue);">${requestsCount}</div>
        </div>
    </div>

    <div class="section-title">Your Ongoing Projects</div>
    <div class="project-list" style="margin-bottom:20px;">
        ${ongoingProjs.length ? ongoingProjs.map(p => {
            const creator = DB.users().find(u => u.id === p.creatorId);
            const cName = creator ? creator.name.split(' ')[0] : 'Creator';
            return `
            <div class="pc" style="padding:16px 20px; border-radius:12px;">
                <div class="pico" style="background:var(--bg2); border:1px solid var(--glass-border); color:var(--text-2);">${contentIconSvg(p.contentType)}</div>
                <div class="pinfo">
                    <div class="ptitle" style="font-size:.95rem;">${p.title}</div>
                    <div class="pmeta" style="margin-top:3px;">From ${cName} &middot; ₹${fmt(p.budget)}</div>
                </div>
                <div style="padding:4px 12px; border-radius:99px; font-size:.7rem; font-weight:600; background:rgba(224,92,42,.1); color:var(--accent);">
                    In Progress
                </div>
            </div>`;
        }).join('') : '<div style="color:var(--text-3);font-size:.85rem;padding:20px 0;">No ongoing projects right now.</div>'}
    </div>
    
    <div style="display:flex; gap:12px; flex-wrap:wrap;">
        <button class="btn btn-purple" onclick="window.fPage('browse', document.querySelector('[data-page=browse]'))">Browse Requests</button>
        <button class="btn btn-ghost" onclick="window.fPage('ongoing', document.querySelector('[data-page=ongoing]'))">Manage Ongoing &rarr;</button>
    </div>`;
}

function fBrowse() {
    const myId = String(AppState.CU.id).toLowerCase();
    
    const projs = DB.projects().filter(p => {
        if (p.status !== 'open') return false;
        
        let invited = p.invited_freelancers;
        if (typeof invited === 'string') {
            try { invited = JSON.parse(invited); } catch(e) { return false; }
        }
        if (!Array.isArray(invited)) return false;

        return invited.some(id => String(id).toLowerCase() === myId);
    });

    return `
    <div class="page-head"><h2>Browse Projects</h2><p>Invitations from creators</p></div>
    <div class="project-list">
        ${projs.length ? projs.map(p => `
            <div class="pc" style="padding:16px 20px; border-radius:12px; display:flex; flex-wrap:wrap; gap:16px; align-items:center; justify-content:space-between; background:var(--surface); border:1px solid var(--glass-border);">
                <div style="display:flex; align-items:center; gap:16px;">
                    <div class="pico" style="background:var(--bg2); border:1px solid var(--glass-border);">${contentIconSvg(p.contentType || p.content_type)}</div>
                    <div class="pinfo">
                        <div class="ptitle" style="font-size:1.05rem;">${p.title}</div>
                        <div class="pmeta" style="margin-top:4px;">₹${fmt(p.budget)} &middot; ${p.contentType || p.content_type}</div>
                    </div>
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button class="btn btn-ghost btn-sm" style="border:1px solid var(--glass-border);" onclick="window.viewProjectDetails('${p.id}')">View Details</button>
                    <button class="btn btn-danger btn-sm" style="background:rgba(239,68,68,.1); color:#ef4444; border:none;" onclick="window.rejectProject('${p.id}')">Reject</button>
                    <button class="btn btn-primary btn-sm" onclick="window.acceptProject('${p.id}')">Accept Job</button>
                </div>
            </div>`).join('') : '<div style="color:var(--text-3);font-size:.85rem;padding:20px 0;">No project invitations right now.</div>'}
    </div>`;
}

export async function viewProjectDetails(pid) {
    const p = DB.projects().find(x => x.id === pid);
    if(!p) return;
    const creator = DB.users().find(u => u.id === p.creatorId) || {name: 'Creator'};

    let files = p.files || [];
    
    if (files.length === 0 && supaClient) {
        const { data: attachments } = await supaClient.from('project_attachments').select('*').eq('project_id', pid);
        if (attachments && attachments.length > 0) {
            files = attachments.map(a => ({
                name: a.file_name,
                displaySize: (a.file_size / (1024*1024)).toFixed(2) + ' MB',
                duration: a.duration || 'Media'
            }));
        }
    }

    let filesHtml = `<div style="padding:16px; text-align:center; color:var(--text-3); font-size:.85rem; border:1px dashed var(--glass-border); border-radius:8px;">No extra files attached.</div>`;

    if (files.length > 0) {
        filesHtml = files.map(f => `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 14px; background:var(--surface); border:1px solid var(--glass-border); border-radius:8px; opacity:0.8; cursor:not-allowed;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="color:var(--text-3);"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>
                    <div>
                        <div style="font-size:.85rem; font-weight:600; color:var(--text);">${f.name}</div>
                        <div style="font-size:.7rem; color:var(--text-3); margin-top:2px;">${f.displaySize} &middot; ${f.duration}</div>
                    </div>
                </div>
                <div title="Accept job to unlock">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
            </div>
        `).join('');
    }

    const modalId = 'proj-modal-' + Date.now();
    const overlay = document.createElement('div');
    overlay.id = modalId;
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px; box-sizing:border-box; backdrop-filter:blur(4px);';

    overlay.innerHTML = `
        <div style="background:var(--bg); width:100%; max-width:550px; border-radius:16px; box-shadow:0 10px 30px rgba(0,0,0,0.3); overflow:hidden; display:flex; flex-direction:column; max-height:90vh; border:1px solid var(--glass-border);">
            <div style="padding:20px 24px; border-bottom:1px solid var(--glass-border); display:flex; justify-content:space-between; align-items:center; background:var(--surface);">
                <h3 style="margin:0; font-family:'Outfit', sans-serif; font-size:1.2rem;">Project Details</h3>
                <button onclick="document.getElementById('${modalId}').remove()" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:var(--text-3); line-height:1;">&times;</button>
            </div>
            <div style="padding:24px; overflow-y:auto;">
                <div style="margin-bottom:20px;">
                    <div style="font-size:1.3rem; font-weight:700; color:var(--text);">${p.title}</div>
                    <div style="color:var(--text-3); font-size:.85rem; margin-top:4px;">From: ${creator.name} &middot; Budget: <span style="color:var(--green); font-weight:600;">₹${fmt(p.budget)}</span></div>
                </div>
                <div style="margin-bottom:24px;">
                    <div style="font-size:.75rem; font-weight:700; color:var(--text-3); text-transform:uppercase; margin-bottom:8px;">Description</div>
                    <div style="font-size:.9rem; color:var(--text-2); line-height:1.5; background:var(--bg2); padding:12px; border-radius:8px; border:1px solid var(--glass-border);">
                        ${p.description || 'No description provided.'}
                    </div>
                </div>
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <div style="font-size:.75rem; font-weight:700; color:var(--text-3); text-transform:uppercase;">Raw Files Attached</div>
                        <div style="font-size:.7rem; color:var(--accent); background:rgba(224,92,42,.1); padding:4px 8px; border-radius:99px; font-weight:600;"><span style="margin-right:4px;">🔒</span>Unlock by Accepting</div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:8px;">${filesHtml}</div>
                </div>
            </div>
            <div style="padding:16px 24px; border-top:1px solid var(--glass-border); display:flex; justify-content:flex-end; gap:12px; background:var(--surface);">
                <button class="btn btn-danger" style="background:rgba(239,68,68,.1); color:#ef4444; border:none;" onclick="window.rejectProject('${p.id}')">Reject</button>
                <button class="btn btn-primary" onclick="window.acceptProject('${p.id}'); document.getElementById('${modalId}').remove();">Accept Job &rarr;</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

export async function rejectProject(pid) {
    const projs = DB.projects();
    const p = projs.find(x => x.id === pid);
    if (p && p.invited_freelancers) {
        p.invited_freelancers = p.invited_freelancers.filter(id => id !== AppState.CU.id);
        DB.saveProjects(projs); 
        
        if (supaClient) {
            const { error } = await supaClient.from('projects').update({ invited_freelancers: p.invited_freelancers }).eq('id', pid);
            if (error) console.error("Reject Sync Error:", error);
        }
        
        window.showToast('Project rejected and removed.', 'info');
        
        const modals = document.querySelectorAll('[id^="proj-modal-"]');
        modals.forEach(m => m.remove());

        window.fPage('browse', document.querySelector('[data-page=browse]'));
    }
}

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
        if(submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Posting... Please wait';
        }

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

            if (supaClient) {
                const { error: projErr } = await supaClient.from('projects').insert([{
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

                        const { data: uploadData, error: upErr } = await supaClient.storage.from(targetBucket).upload(path, f);
                        let fileUrl = '';
                        if (!upErr && uploadData) {
                            const { data: urlData } = supaClient.storage.from(targetBucket).getPublicUrl(uploadData.path);
                            fileUrl = urlData.publicUrl;
                        }
                        dbAttachments.push({
                            project_id: newP.id, creator_id: AppState.CU.id, file_name: f.name,
                            file_url: fileUrl || 'upload_failed', file_type: f.type ? f.type.split('/')[0] : 'file',
                            file_size: f.size, duration: f.displayDuration || null
                        });
                    }
                    await supaClient.from('project_attachments').insert(dbAttachments);
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

function fOngoing() {
    const projs = DB.projects().filter(p => p.freelancerId === AppState.CU.id && p.status === 'ongoing');
    return `
    <div class="page-head">
        <h2>Ongoing Projects</h2>
        <p style="color:var(--text-3); font-size:.85rem;">Projects you are currently working on</p>
    </div>
    
    <div style="display:flex; flex-direction:column; gap:16px;">
        ${projs.length ? projs.map(p => {
            const creator = DB.users().find(u => u.id === p.creatorId);
            const cName = creator ? creator.name.split(' ')[0] : 'Creator';
            
            const progress = p.editedUploaded ? '100%' : '50%';
            
            return `
            <div class="det-card" style="padding: 24px; border-radius:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <div style="font-weight:700; font-size:1.1rem; color:var(--text);">${p.title}</div>
                    <div style="padding:4px 12px; border-radius:99px; font-size:.7rem; font-weight:600; background:rgba(224,92,42,.1); color:var(--accent);">
                        In Progress
                    </div>
                </div>
                
                <div style="display:flex; flex-direction:column; gap:14px; margin-bottom:24px;">
                    <div style="display:flex; justify-content:space-between; font-size:.85rem; padding-bottom:8px; border-bottom:1px solid var(--glass-border);">
                        <span style="color:var(--text-3);">Client</span>
                        <span style="font-weight:500; color:var(--text);">${cName}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:.85rem; padding-bottom:8px; border-bottom:1px solid var(--glass-border);">
                        <span style="color:var(--text-3);">Budget</span>
                        <span style="font-weight:500; color:var(--text);">₹${fmt(p.budget)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:.85rem; padding-bottom:8px; border-bottom:1px solid var(--glass-border);">
                        <span style="color:var(--text-3);">Raw Files</span>
                        <span style="color:var(--green); font-weight:500; padding:2px 8px; background:rgba(22,163,74,.1); border-radius:4px; font-size:.75rem;">Received</span>
                    </div>
                </div>
                
                <div style="margin-bottom:24px;">
                    <div style="display:flex; justify-content:space-between; font-size:.75rem; color:var(--text-3); margin-bottom:8px;">
                        <span>Progress</span>
                        <span>${progress}</span>
                    </div>
                    <div style="width:100%; height:6px; background:var(--bg2); border-radius:99px; overflow:hidden;">
                        <div style="width:${progress}; height:100%; background:linear-gradient(90deg, var(--accent), var(--accent2)); border-radius:99px; transition: width 0.3s ease;"></div>
                    </div>
                </div>
                
                <div style="display:flex; gap:12px; flex-wrap:wrap;">
                    <button class="btn btn-ghost btn-sm" style="border:1px solid var(--glass-border);" onclick="window.fPage('chat', document.querySelector('[data-page=chat]')); setTimeout(()=>window.switchChat('${AppState.CU.id}', '${p.creatorId}'), 100);">Chat</button>
                    <button class="btn btn-primary btn-sm" onclick="window.fPage('upload', document.querySelector('[data-page=upload]'))">Upload Final</button>
                    <button class="btn btn-ghost btn-sm" style="border:1px solid var(--glass-border);" onclick="window.fPage('negotiate', document.querySelector('[data-page=negotiate]'))">Negotiate</button>
                </div>
            </div>`;
        }).join('') : '<div style="color:var(--text-3);font-size:.85rem;padding:20px 0;">No ongoing projects right now.</div>'}
    </div>`;
}

function fUpload() {
    const projs = DB.projects().filter(p => p.freelancerId === AppState.CU.id && p.status === 'ongoing' && !p.editedUploaded);
    return `
    <div class="page-head"><h2>Upload Final Work</h2><p>Submit your final edits for approval</p></div>
    ${projs.length ? `
        <div class="fg">
            <label>Select Project</label>
            <select id="f-up-proj">${projs.map(p => `<option value="${p.id}">${p.title}</option>`).join('')}</select>
        </div>
        <label class="upload-area-lg" for="f-final-upload" style="margin-top:20px;">
          <div class="upload-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>
          <div class="upload-label">Select final edited video</div>
          <input type="file" id="f-final-upload" accept="video/*" style="display:none;" onchange="window.handleFinalUpload(this)"/>
        </label>
    ` : '<div class="alert alert-i">You have no pending uploads right now! All caught up.</div>'}
    `;
}

export async function handleFinalUpload(input, projectId) {
    if (!input.files || !input.files.length) return;

    let finalProjId = projectId;
    if (!finalProjId || typeof finalProjId === 'object') {
        const visibleSelects = Array.from(document.querySelectorAll('select')).filter(el => el.offsetParent !== null);
        if (visibleSelects.length > 0) {
            finalProjId = visibleSelects[0].value;
        }
    }

    if (!finalProjId || finalProjId === 'disabled' || finalProjId === '') {
        window.showToast('Please select a project first!', 'err');
        input.value = ''; 
        return;
    }

    finalProjId = String(finalProjId).trim();

    const projs = DB.projects() || [];
    let proj = projs.find(p => String(p.id).trim() === finalProjId);
    if (!proj) proj = projs.find(p => p.title && String(p.title).trim().toLowerCase() === finalProjId.toLowerCase());
    if (!proj) proj = projs.find(p => p.title && String(p.title).trim().toLowerCase().includes(finalProjId.toLowerCase()));

    if (!proj) {
        window.showToast(`Error: Can't find "${finalProjId}" in DB`, 'err');
        input.value = '';
        return;
    }

    window.showToast('Uploading Final Work to Cloud... Please wait.', 'info');

    try {
        let fileUrl = null;
        
        if (supaClient) {
            const path = `final_delivery/${AppState.CU.id}/${Date.now()}_${input.files[0].name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
            const { data: uploadData, error: uploadErr } = await supaClient.storage.from('videos').upload(path, input.files[0]);
            if (uploadErr) throw uploadErr;
            
            const { data: urlData } = supaClient.storage.from('videos').getPublicUrl(uploadData.path);
            fileUrl = urlData?.publicUrl;
        }

        await window.sendMsg(AppState.CU.id, proj.creatorId, fileUrl, input.files[0].name, 'Final Delivery');

        window.showToast('Final work sent to creator for review!', 'ok');
        input.value = ''; 
        
        setTimeout(() => {
            const msgTab = document.querySelector('[data-page=messages]');
            if(msgTab) window.fPage('messages', msgTab);
        }, 1000);

    } catch (err) {
        console.error("Final Upload Error:", err);
        window.showToast('Upload failed: ' + err.message, 'err');
    }
}

function fProfile() {
    const u = AppState.CU;
    const memberSince = new Date(u.createdAt || Date.now()).toLocaleDateString('en-IN', {month:'long', year:'numeric'});

    return `
    <div class="page-head"><h2>My Profile</h2></div>
    <div class="two-col">
        <div style="display:flex; flex-direction:column; gap:16px;">
            <div class="det-card">
                <div class="section-title">Personal Info</div>
                <div class="fg"><label>Full Name</label><input id="f-prof-name" value="${u.name}"/></div>
                <div class="fg"><label>Email</label><input value="${u.email}" disabled style="opacity:.5;"/></div>
                <div class="fg"><label>Phone</label><input id="f-prof-phone" value="${u.phone||''}"/></div>
                <div class="fg"><label>Profession</label><input id="f-prof-title" value="${u.profession||'editor'}"/></div>
                <button class="btn btn-primary" onclick="window.saveFProfile()">Save Changes</button>
            </div>

            <div class="det-card">
                <div class="section-title">Account Details</div>
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
                    <div class="sb-avatar sb-av-freelancer" style="width:48px;height:48px;font-size:1.2rem;">${u.avatar}</div>
                    <div>
                        <div style="font-weight:600; font-size:1rem;">${u.name}</div>
                        <div class="tag pu" style="margin-top:4px;">Freelancer</div>
                    </div>
                </div>
                <div class="info-row"><span class="key">Profession</span><span>${u.profession||'editor'}</span></div>
                <div class="info-row"><span class="key">Member Since</span><span>${memberSince}</span></div>
            </div>

            <div class="det-card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <div class="section-title" style="margin:0;">Experience</div>
                    <button class="btn btn-primary btn-xs" onclick="window.showToast('Add Experience coming soon', 'info')">+ Add Experience</button>
                </div>
                <div style="border:1px solid var(--glass-border); border-radius:var(--radius-sm); padding:12px;">
                    <div style="display:flex; justify-content:space-between;">
                        <div>
                            <div style="font-weight:600; font-size:.9rem;">senior content editor</div>
                            <div style="font-size:.75rem; color:var(--text-3); margin-top:4px;">pw | jan-2025 to april-2026</div>
                        </div>
                        <div style="display:flex; gap:6px;">
                            <button class="btn btn-ghost btn-xs">Edit</button>
                            <button class="btn btn-danger btn-xs">Del</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:16px;">
            <div class="det-card" style="text-align:center;">
                <div class="section-title" style="text-align:left;">Profile Photo</div>
                <div style="width:80px; height:80px; border-radius:50%; background:var(--bg2); margin:0 auto 16px; overflow:hidden; display:flex; align-items:center; justify-content:center; border:1px solid var(--glass-border);">
                    ${u.photo_url ? `<img src="${u.photo_url}" style="width:100%;height:100%;object-fit:cover;">` : `<span style="font-size:2.5rem; color:var(--text-3); font-family: 'Outfit', sans-serif; font-weight:700;">${u.avatar}</span>`}
                </div>
                <label class="btn btn-ghost btn-sm" style="cursor:pointer; display:inline-block;">
                    Upload New Photo
                    <input type="file" accept="image/*" style="display:none;" onchange="window.handleProfilePhotoUpload(this)">
                </label>
            </div>

            <div class="det-card">
                <div class="section-title">My Skills</div>
                <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
                    <span class="tag pu">Video Editing &times;</span>
                    <span class="tag pu">Color Grading &times;</span>
                    <span class="tag pu">Motion Graphics &times;</span>
                    <span class="tag pu">Thumbnail Design &times;</span>
                    <span class="tag pu">CapCut &times;</span>
                </div>
                <div style="display:flex; gap:8px; margin-bottom:16px;">
                    <input type="text" class="chat-inp" placeholder="Add a new skill..." style="flex:1;">
                    <button class="btn btn-primary">Add</button>
                </div>
                <div style="text-align:center; font-size:.7rem; color:var(--text-3); margin-bottom:8px; position:relative;">
                    <span style="background:var(--surface); padding:0 8px; position:relative; z-index:1;">Suggested</span>
                    <div style="position:absolute; top:50%; left:0; right:0; height:1px; background:var(--glass-border); z-index:0;"></div>
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:8px; justify-content:center;">
                    <span class="btn btn-ghost btn-xs" style="border-radius:99px; cursor:pointer;">Video Editing</span>
                    <span class="btn btn-ghost btn-xs" style="border-radius:99px; cursor:pointer;">Color Grading</span>
                    <span class="btn btn-ghost btn-xs" style="border-radius:99px; cursor:pointer;">Premiere Pro</span>
                    <span class="btn btn-ghost btn-xs" style="border-radius:99px; cursor:pointer;">After Effects</span>
                    <span class="btn btn-ghost btn-xs" style="border-radius:99px; cursor:pointer;">DaVinci Resolve</span>
                </div>
            </div>

            <div class="det-card">
            <div class="section-title">Portfolio & Work Links</div>
                <div class="fg"><label>Instagram Profile Link</label><input id="f-prof-insta" value="${u.instaLink || ''}" placeholder="https://instagram.com/yourhandle"/></div>
                <div class="fg"><label>YouTube Channel Link</label><input id="f-prof-yt" value="${u.ytLink || ''}" placeholder="https://youtube.com/@yourchannel"/></div>
                <div class="fg"><label>Work Video Link (Best Work)</label><input id="f-prof-work" value="${u.workLink || ''}" placeholder="Paste a link to your best work (YouTube/Drive/Vimeo)"/></div>
                <button class="btn btn-primary" onclick="window.saveFProfile()">Save Links</button>
            </div> 
        </div>
    </div>`;
}


function fEarnings() {
    const projs = DB.projects().filter(p => p.freelancerId === AppState.CU.id);
    const received = projs.filter(p => p.paid).reduce((s,p) => s + p.budget, 0);
    const pending = projs.filter(p => p.status === 'completed' && !p.paid).reduce((s,p) => s + p.budget, 0);
    const totalProjs = projs.length;
    const displayProjs = projs.filter(p => p.status === 'completed' || p.paid).sort((a,b) => b.createdAt - a.createdAt);

    return `
    <div class="page-head"><h2>Earnings</h2></div>
    
    <div style="display:flex; gap:12px; margin-bottom:24px; flex-wrap:wrap;">
        <div style="background:rgba(22,163,74,.05); border:1px solid rgba(22,163,74,.2); border-radius:10px; padding:12px 16px; flex:1; min-width:140px; max-width:200px;">
            <div style="font-size:.75rem; color:var(--text-3); margin-bottom:2px;">Total Received</div>
            <div style="font-family:'Outfit',sans-serif; font-size:1.4rem; font-weight:700; color:var(--green);">₹${fmt(received)}</div>
        </div>
        
        <div style="background:rgba(224,92,42,.05); border:1px solid rgba(224,92,42,.2); border-radius:10px; padding:12px 16px; flex:1; min-width:140px; max-width:200px;">
            <div style="font-size:.75rem; color:var(--text-3); margin-bottom:2px;">Pending Payout</div>
            <div style="font-family:'Outfit',sans-serif; font-size:1.4rem; font-weight:700; color:var(--accent);">₹${fmt(pending)}</div>
        </div>
        
        <div style="background:var(--surface); border:1px solid var(--glass-border); border-radius:10px; padding:12px 16px; flex:1; min-width:110px; max-width:150px; box-shadow:var(--shadow-xs);">
            <div style="font-size:.75rem; color:var(--text-3); margin-bottom:2px;">Projects</div>
            <div style="font-family:'Outfit',sans-serif; font-size:1.4rem; font-weight:700; color:var(--text);">${totalProjs}</div>
        </div>
    </div>

    <div class="section-title">Transaction History</div>
    <div class="project-list">
        ${displayProjs.length ? displayProjs.map(p => {
            const creator = DB.users().find(u => u.id === p.creatorId);
            const cName = creator ? creator.name.split(' ')[0] : 'Creator';
            const dateStr = fmtDate(p.createdAt || Date.now()); 
            
            return `
            <div class="pc" style="padding:16px 20px; border-radius:12px;">
                <div style="width:40px; height:40px; border-radius:10px; background:var(--bg2); display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:1.2rem; color:var(--text-3); border:1px solid var(--glass-border); font-family:sans-serif;">
                    $
                </div>
                <div class="pinfo">
                    <div class="ptitle" style="font-size:.95rem;">${p.title}</div>
                    <div class="pmeta" style="margin-top:3px;">From ${cName} &middot; ${dateStr}</div>
                </div>
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="font-weight:600; font-size:1rem; color:var(--text);">₹${fmt(p.budget)}</div>
                    <div style="padding:4px 10px; border-radius:99px; font-size:.7rem; font-weight:600; ${p.paid ? 'background:rgba(22,163,74,.1); color:var(--green);' : 'background:rgba(29,78,216,.1); color:var(--blue);'}">
                        ${p.paid ? 'Received' : 'Pending'}
                    </div>
                </div>
            </div>`;
        }).join('') : '<div style="color:var(--text-3);font-size:.85rem;padding:20px 0;">No transactions yet. Complete projects to get paid!</div>'}
    </div>`;
}

function fNegotiate() {
    const myId = String(AppState.CU.id).toLowerCase();

    setTimeout(async () => {
        const supa = window.supaClient || window.supabaseClient || window.supabase;
        if (supa) {
            try {
                const { data } = await supa.from('projects').select('*').eq('status', 'ongoing').eq('freelancer_id', myId);
                if (data) {
                    let updated = false;
                    const localDB = DB.projects();
                    data.forEach(dp => {
                        const existing = localDB.find(x => x.id === dp.id);
                        if (!existing) {
                            localDB.push({
                                id: dp.id, creatorId: dp.creator_id, title: dp.title, description: dp.description,
                                budget: dp.budget, contentType: dp.content_type, deadline: dp.deadline, priority: dp.priority,
                                freelancerId: dp.freelancer_id, status: dp.status, createdAt: new Date(dp.created_at).getTime()
                            });
                            updated = true;
                        } else if (existing.budget !== dp.budget || existing.deadline !== dp.deadline) {
                            existing.budget = dp.budget;
                            existing.deadline = dp.deadline;
                            updated = true;
                        }
                    });
                    if (updated) {
                        DB.saveProjects(localDB);
                        if (document.querySelector('[data-page="negotiate"]')?.classList.contains('active')) {
                            window.fPage('negotiate', document.querySelector('[data-page="negotiate"]'));
                        }
                    }
                }
            } catch(e) {}
        }
    }, 100);

    const projs = DB.projects().filter(p => p.status === 'ongoing' && String(p.freelancerId).toLowerCase() === myId);

    if (!projs.length) {
        return `
        <div class="page-head"><h2>Negotiate Price & Deadline</h2><p>Request changes for ongoing projects</p></div>
        <div style="padding:20px 0; color:var(--text-3); font-size:0.9rem;">
            <div class="alert alert-i">You have no ongoing projects to negotiate right now. First, accept a project to request changes!</div>
        </div>`;
    }

    return `
    <div class="page-head" style="margin-bottom:20px;">
        <h2>Negotiate Price & Deadline</h2>
        <p style="color:var(--text-3); font-size:0.85rem; margin-top:4px;">Select an ongoing project to request budget/deadline changes</p>
    </div>

    <div class="fg" style="margin-bottom:24px;">
        <label style="display:block; font-size:0.75rem; font-weight:700; color:var(--text-3); margin-bottom:8px; text-transform:uppercase;">Select Project</label>
        <select id="neg-project-select" style="width:100%; max-width:100%; padding:12px; border-radius:8px; border:1px solid var(--glass-border); background:var(--bg); color:var(--text); outline:none; cursor:pointer; font-family:inherit; font-size:0.9rem;" onchange="window.toggleNegotiationCard(this.value)">
            <option value="" disabled selected>-- Choose an ongoing project --</option>
            ${projs.map(p => `<option value="${p.id}">${p.title} (Current Budget: ₹${fmt(p.budget)})</option>`).join('')}
        </select>
    </div>

    <div id="neg-cards-container" style="width:100%;">
        ${projs.map(p => `
            <div id="neg-card-${p.id}" class="det-card neg-card-item" style="display:none; padding:24px; border-radius:12px; background:var(--surface); border:1px solid var(--glass-border); box-shadow:0 4px 12px rgba(0,0,0,0.03); animation: fadeIn 0.3s ease;">
                <h3 style="margin-top:0; margin-bottom:6px; font-size:1.2rem; color:var(--text); font-weight:700;">${p.title}</h3>
                <div style="font-size:.85rem; color:var(--text-3); margin-bottom:24px;">
                    Current Budget: <strong style="color:var(--text);">₹${fmt(p.budget)}</strong> &middot; Current Deadline: ${fmtDate(p.deadline)}
                </div>
                
                <div style="display:flex; gap:20px; flex-wrap:wrap; margin-bottom:20px;">
                    <div class="fg" style="flex:1; min-width:200px; margin:0;">
                        <label style="display:block; font-size:0.8rem; font-weight:600; color:var(--text-2); margin-bottom:8px;">New Request Price (₹)</label>
                        <input type="number" id="neg-price-${p.id}" value="${p.budget}" style="width:100%; padding:12px 14px; background:var(--bg); border:1px solid var(--glass-border); border-radius:8px; font-size:0.9rem; outline:none;">
                    </div>
                    <div class="fg" style="flex:1; min-width:200px; margin:0;">
                        <label style="display:block; font-size:0.8rem; font-weight:600; color:var(--text-2); margin-bottom:8px;">New Proposed Deadline</label>
                        <input type="date" id="neg-date-${p.id}" value="${p.deadline || ''}" style="width:100%; padding:12px 14px; background:var(--bg); border:1px solid var(--glass-border); border-radius:8px; font-size:0.9rem; outline:none;">
                    </div>
                </div>
                
                <div class="fg" style="margin-bottom:24px;">
                    <label style="display:block; font-size:0.8rem; font-weight:600; color:var(--text-2); margin-bottom:8px;">Reason / Message to Client</label>
                    <input type="text" id="neg-msg-${p.id}" placeholder="I need more budget/time because..." style="width:100%; padding:12px 14px; background:var(--bg); border:1px solid var(--glass-border); border-radius:8px; font-size:0.9rem; outline:none;">
                </div>
                
                <div style="display:flex; gap:12px;">
                    <button class="btn" style="background:#e85d2e; color:white; border:none; padding:12px 24px; font-weight:600; border-radius:8px; cursor:pointer;" onclick="window.sendNegotiation('${p.id}')">Send Request to Client</button>
                </div>
            </div>
        `).join('')}
    </div>
    `;
}

export function toggleNegotiationCard(pid) {
    document.querySelectorAll('.neg-card-item').forEach(el => el.style.display = 'none');
    const selected = document.getElementById('neg-card-' + pid);
    if (selected) selected.style.display = 'block';
}

export function viewFreelancerPortfolio(id) {
    const f = DB.users().find(u => u.id === id);
    if (!f) {
        window.showToast('Freelancer details not found!', 'err');
        return;
    }

    const isSelected = AppState.selFreelancerIds.includes(id);
    const projs = DB.projects().filter(p => p.freelancerId === id && p.status === 'completed');
    const rated = projs.filter(p => p.rating && p.rating > 0);
    const avgRating = rated.length > 0 ? (rated.reduce((s, p) => s + p.rating, 0) / rated.length).toFixed(1) : 'New';
    
    const ratingNum = avgRating !== 'New' ? parseFloat(avgRating) : 0;
    let starsHtml = '';
    for(let i=1; i<=5; i++) {
        starsHtml += `<span style="color: ${i <= Math.round(ratingNum) ? '#f59e0b' : '#d1d5db'}; font-size:1rem;">&#9733;</span>`;
    }

    const avatarHtml = f.photo_url
        ? `<img src="${f.photo_url}" style="width:100%;height:100%;object-fit:cover;">`
        : `<span style="font-size:1.8rem; color:var(--text-3); font-family:'Outfit',sans-serif; font-weight:700;">${f.avatar || f.name.charAt(0).toUpperCase()}</span>`;

    const modalId = 'portfolio-modal-' + Date.now();
    const overlay = document.createElement('div');
    overlay.id = modalId;
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.4); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px; box-sizing:border-box; backdrop-filter:blur(3px);';

    const safeName = f.name.replace(/'/g, "\\'");

    overlay.innerHTML = `
        <div style="background:var(--bg); width:100%; max-width:420px; border-radius:16px; box-shadow:0 10px 30px rgba(0,0,0,0.15); overflow:hidden; display:flex; flex-direction:column; max-height:90vh; padding: 24px; font-family: 'Outfit', sans-serif; box-sizing:border-box;">
            
            <h3 style="margin:0 0 20px 0; font-size:1.1rem; color:var(--text);">Freelancer Profile</h3>
            
            <div style="text-align:center; margin-bottom:24px;">
                <div style="width:70px; height:70px; border-radius:50%; background:var(--bg2); margin:0 auto 8px auto; display:flex; align-items:center; justify-content:center; overflow:hidden; border:1px solid var(--glass-border);">
                    ${avatarHtml}
                </div>
                <div style="font-weight:700; font-size:1.2rem; color:var(--text);">${f.name}</div>
                <div style="color:#8b5cf6; font-size:.85rem; font-weight:600; margin-bottom:6px;">${f.profession || 'editor'}</div>
                <div style="display:flex; align-items:center; justify-content:center; gap:6px; font-size:.8rem; color:var(--text-3);">
                    <div style="display:flex; gap:2px;">${starsHtml}</div>
                    <span>(${avgRating} &middot; ${projs.length} Projects)</span>
                </div>
            </div>

            <div style="overflow-y:auto; padding-right:4px;">
                <div style="margin-bottom:20px;">
                    <div style="font-size:.7rem; font-weight:700; color:var(--text-3); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">About</div>
                    <div style="background:var(--surface); padding:12px 14px; border-radius:8px; font-size:.85rem; color:var(--text-2); border:1px solid var(--glass-border);">
                        Available for freelance video editing projects.
                    </div>
                </div>

                <div style="margin-bottom:20px;">
                    <div style="font-size:.7rem; font-weight:700; color:var(--text-3); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">Tools & Skills</div>
                    <div style="display:flex; flex-wrap:wrap; gap:8px;">
                        <span style="border:1px solid #c4b5fd; color:#8b5cf6; background:#f5f3ff; padding:4px 12px; border-radius:99px; font-size:.75rem; font-weight:600;">Video Editing</span>
                        <span style="border:1px solid #c4b5fd; color:#8b5cf6; background:#f5f3ff; padding:4px 12px; border-radius:99px; font-size:.75rem; font-weight:600;">Color Grading</span>
                        <span style="border:1px solid #c4b5fd; color:#8b5cf6; background:#f5f3ff; padding:4px 12px; border-radius:99px; font-size:.75rem; font-weight:600;">Motion Graphics</span>
                        <span style="border:1px solid #c4b5fd; color:#8b5cf6; background:#f5f3ff; padding:4px 12px; border-radius:99px; font-size:.75rem; font-weight:600;">Thumbnail Design</span>
                        <span style="border:1px solid #c4b5fd; color:#8b5cf6; background:#f5f3ff; padding:4px 12px; border-radius:99px; font-size:.75rem; font-weight:600;">CapCut</span>
                    </div>
                </div>

                <div style="margin-bottom:24px;">
                    <div style="font-size:.7rem; font-weight:700; color:var(--text-3); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">Experience</div>
                    <div>
                        <div style="font-weight:700; font-size:.9rem; color:var(--text);">senior content editor</div>
                        <div style="font-size:.75rem; color:var(--text-3); margin-top:2px;">pw | jan-2025 to april-2026</div>
                    </div>
                </div>

                <div style="text-align:center; margin-bottom:20px;">
                    <button style="background:#e85d2e; color:white; border:none; padding:8px 20px; border-radius:99px; font-size:.85rem; font-weight:600; cursor:pointer;">View Resume</button>
                </div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:auto;">
                <button onclick="document.getElementById('${modalId}').remove()" style="background:transparent; border:1px solid var(--glass-border); color:var(--text-2); padding:8px 20px; border-radius:8px; font-size:.85rem; font-weight:600; cursor:pointer;">Cancel</button>
                
                <button onclick="document.getElementById('${modalId}').remove(); window.selFL('${id}', '${safeName}')" style="background:${isSelected ? '#9ca3af' : '#e85d2e'}; border:none; color:white; padding:8px 20px; border-radius:8px; font-size:.85rem; font-weight:600; cursor:pointer;">
                    ${isSelected ? 'Deselect Editor' : 'Select ' + f.name.split(' ')[0]}
                </button>
            </div>
            
        </div>
    `;

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

        if (supaClient) {
            await supaClient.from('projects').update({ freelancer_id: AppState.CU.id, status: 'ongoing' }).eq('id', pid);
            const { data: attachments } = await supaClient.from('project_attachments').select('*').eq('project_id', pid);

            if (attachments && attachments.length > 0) {
                fileLinksText = attachments.map(f => {
                    const size = f.file_size ? (f.file_size / (1024*1024)).toFixed(2) + ' MB' : 'Unknown Size';
                    if (f.file_url && f.file_url.startsWith('http')) {
                        return `<div style="background:rgba(255,255,255,0.15); padding:10px 14px; border-radius:8px; margin-bottom:8px; border:1px solid rgba(255,255,255,0.2);">
                            <div style="font-weight:600; font-size:0.85rem; margin-bottom:8px; word-break:break-all; line-height:1.3;">📁 ${f.file_name} <span style="font-weight:normal; font-size:0.75rem; opacity:0.8;">(${size})</span></div>
                            <a href="${f.file_url}" target="_blank" download style="display:inline-block; background:var(--bg); color:var(--text); padding:6px 14px; border-radius:6px; font-size:0.75rem; font-weight:700; text-decoration:none; box-shadow:var(--shadow-sm);">⬇ Download File</a>
                        </div>`;
                    } else {
                        return `<div style="background:rgba(239,68,68,0.1); padding:10px; border-radius:8px; margin-bottom:8px; border:1px solid rgba(239,68,68,0.3);">
                            <div style="font-weight:600; font-size:0.85rem;">📁 ${f.file_name}</div>
                            <div style="color:var(--red); font-size:0.75rem; margin-top:4px;">❌ File failed to upload</div>
                        </div>`;
                    }
                }).join('');
            } else if (p.files && p.files.length > 0) {
                fileLinksText = p.files.map(f => `📁 <b>${f.name}</b> (${f.displaySize})<br>❌ <span style="color:var(--red);">Cloud link unavailable</span>`).join('<br><br>');
            }

            let convoId = null;
            const { data: convos } = await supaClient.from('conversations').select('id, user1_id, user2_id').or(`user1_id.eq.${AppState.CU.id},user2_id.eq.${AppState.CU.id}`);

            if (convos && convos.length > 0) {
                const existing = convos.find(c => (c.user1_id === p.creatorId && c.user2_id === AppState.CU.id) || (c.user1_id === AppState.CU.id && c.user2_id === p.creatorId));
                if (existing) convoId = existing.id;
            }

            if (!convoId) {
                const { data: newConvo } = await supaClient.from('conversations').insert([{ user1_id: AppState.CU.id, user2_id: p.creatorId }]).select('id').single();
                if (newConvo) convoId = newConvo.id;
            }

            const finalMessage = `I have accepted the project "${p.title}"! ✅<br><br>I can now access the raw files:<br><br>${fileLinksText}`;

            if (convoId) {
                await supaClient.from('messages').insert([{
                    conversation_id: convoId, sender_id: AppState.CU.id, text: finalMessage
                }]);
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
        window.showToast('Error syncing chat, check console.', 'err');
    }
}

export async function triggerApproveAndPay(projectId) {
    if (!projectId || projectId === 'undefined') {
        window.showToast('Error: Project ID missing', 'err');
        return;
    }
    window.showToast('Processing Payment...', 'info');
    try {
        const projs = DB.projects();
        const proj = projs.find(p => p.id === projectId);
        if (!proj) {
            window.showToast('Project not found!', 'err');
            return;
        }

        proj.status = 'completed';
        proj.paid = true;
        DB.saveProjects(projs);

        if (supaClient) {
            await supaClient.from('projects').update({ status: 'completed', paid: true }).eq('id', projectId);
        }

        const successMsg = "✅ Project Approved & Paid! Perfect video edit. Great working with you.";
        await window.sendMsg(AppState.CU.id, proj.freelancerId, null, null, successMsg);

        window.showToast('Payment Successful & Project Completed!', 'ok');
        setTimeout(() => {
            const msgTab = document.querySelector('[data-page=messages]');
            if(msgTab) window.fPage('messages', msgTab);
        }, 500);
    } catch (e) {
        console.error("Payment error:", e);
        window.showToast('Error processing payment.', 'err');
    }
}

export function wfB() { 
    AppState.wfStep = Math.max(0, AppState.wfStep - 1); 
    if(typeof renderC === 'function') renderC('new'); 
}

export function selCT(t) { 
    AppState.selContent = t; 
    if(typeof renderC === 'function') renderC('new'); 
}

export function selFL(id, name) { 
    if (AppState.selFreelancerIds.includes(id)) {
        AppState.selFreelancerIds = AppState.selFreelancerIds.filter(x => x !== id);
        if (AppState.selFreelancerName === name) AppState.selFreelancerName = null;
    } else {
        AppState.selFreelancerIds.push(id);
        AppState.selFreelancerName = name;
    }
    if(typeof renderC === 'function') renderC('new'); 
}

// ─── NEGOTIATION FUNCTIONS (BULLETPROOF UI) ───

export async function sendNegotiation(pid) {
    const p = DB.projects().find(x => x.id === pid);
    if (!p) return;

    const newPrice = document.getElementById(`neg-price-${pid}`)?.value || p.budget;
    const newDate = document.getElementById(`neg-date-${pid}`)?.value || p.deadline;
    const note = document.getElementById(`neg-msg-${pid}`)?.value || '';
    
    const negId = 'neg_' + Date.now();

    // 💥 MAGIC UI 2.0: Ultra-Safe 'onerror' Hack
    const negText = `
        <div id="${negId}" style="border: 1px solid var(--glass-border); padding: 16px; border-radius: 10px; background: var(--bg2); margin-top:8px; box-shadow:var(--shadow-sm);">
            <div style="font-weight:bold; font-size:1rem; margin-bottom: 12px; color:var(--text);">🔄 Counter Offer Details</div>
            <div style="font-size:0.85rem; margin-bottom: 16px; color:var(--text-2); line-height:1.5;">
                Project: <b>${p.title}</b><br/>
                New Budget: <b style="color:var(--green); font-size:1.05rem;">₹${fmt(newPrice)}</b><br/>
                Proposed Deadline: <b>${fmtDate(newDate)}</b><br/>
                Note: <i>"${note}"</i>
            </div>
            
            <div class="neg-action-area">
                <img src="x" onerror="
                    try {
                        var isCreator = String(window.AppState.CU.id) === '${p.creatorId}';
                        if(isCreator) {
                            this.parentElement.querySelector('.c-btns').style.display = 'flex';
                        } else {
                            this.parentElement.querySelector('.f-wait').style.display = 'block';
                        }
                    } catch(e){}
                    this.remove();
                " style="display:none;" />
                
                <div class="c-btns" style="display:none; gap:10px; flex-wrap:wrap;">
                    <button onclick="window.acceptNegotiation('${pid}', '${newPrice}', '${newDate}', '${AppState.CU.id}', this, '${negId}')" style="background:#16a34a; color:white; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-size:0.8rem; font-weight:600; flex:1;">✅ Accept</button>
                    <button onclick="window.rejectNegotiation('${pid}', '${AppState.CU.id}', this, '${negId}')" style="background:#ef4444; color:white; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-size:0.8rem; font-weight:600; flex:1;">❌ Reject</button>
                </div>
                
                <div class="f-wait" style="display:none; color:var(--text-3); font-size:0.85rem; font-style:italic; padding: 8px; background: rgba(0,0,0,0.05); border-radius: 6px; text-align:center;">
                    ⏳ Waiting for Creator to review this offer...
                </div>
            </div>
        </div>
    `;

    window.showToast('Sending counter-offer...', 'info');

    try {
        const supa = window.supaClient || window.supabaseClient || window.supabase;
        if (supa) {
            let convoId = null;
            const { data: convos } = await supa.from('conversations').select('id, user1_id, user2_id').or(`user1_id.eq.${AppState.CU.id},user2_id.eq.${AppState.CU.id}`);

            if (convos && convos.length > 0) {
                const existing = convos.find(c => (c.user1_id === p.creatorId && c.user2_id === AppState.CU.id) || (c.user1_id === AppState.CU.id && c.user2_id === p.creatorId));
                if (existing) convoId = existing.id;
            }

            if (!convoId) {
                const { data: newConvo } = await supa.from('conversations').insert([{ user1_id: AppState.CU.id, user2_id: p.creatorId }]).select('id').single();
                if (newConvo) convoId = newConvo.id;
            }

            if (convoId) {
                await supa.from('messages').insert([{ conversation_id: convoId, sender_id: AppState.CU.id, text: negText }]);
            }
        }

        if (typeof DB.messages === 'function') {
            const key = [AppState.CU.id, p.creatorId].sort().join('_');
            let allMsgs = DB.messages() || {};
            if (!allMsgs[key]) allMsgs[key] = [];
            allMsgs[key].push({ from: AppState.CU.id, text: negText, time: Date.now() });
            if (typeof DB.saveMessages === 'function') DB.saveMessages(allMsgs);
        }

        window.showToast('Counter-offer sent to creator!', 'ok');
        window.fPage('chat', document.querySelector('[data-page=chat]'));
        setTimeout(() => window.switchChat(AppState.CU.id, p.creatorId), 100);

    } catch(e) {
        console.error(e);
        window.showToast('Failed to send offer. Check console.', 'err');
    }
    
    document.querySelectorAll('.neg-card-item').forEach(el => el.style.display = 'none');
    const select = document.getElementById('neg-project-select');
    if(select) select.value = "";
}

export async function acceptNegotiation(pid, newPrice, newDate, freelancerId, btnElement, negId) {
    if (btnElement) {
        const actionArea = btnElement.closest('.neg-action-area');
        if (actionArea) actionArea.innerHTML = `<div style="background:rgba(22,163,74,.1); color:var(--green); padding:8px 12px; border-radius:6px; font-weight:bold; font-size:0.85rem; width:100%; text-align:center;">✅ Offer Accepted Successfully</div>`;
    }

    try {
        const projs = DB.projects();
        const p = projs.find(x => x.id === pid);
        if (p) {
            p.budget = parseInt(newPrice);
            p.deadline = newDate;
            p.freelancerId = freelancerId;
            p.status = 'ongoing';
            DB.saveProjects(projs);
        }
        
        const supa = window.supaClient || window.supabaseClient || window.supabase;
        if (supa) {
            await supa.from('projects').update({ budget: parseInt(newPrice), deadline: newDate, freelancer_id: freelancerId, status: 'ongoing' }).eq('id', pid);
            
            if (negId) {
                const { data: msgs } = await supa.from('messages').select('id, text').ilike('text', `%${negId}%`);
                if (msgs && msgs.length > 0) {
                    const newText = msgs[0].text.split('<div class="neg-action-area">')[0] + '<div class="neg-action-area"><div style="background:rgba(22,163,74,.1); color:var(--green); padding:8px 12px; border-radius:6px; font-weight:bold; font-size:0.85rem; width:100%; text-align:center;">✅ Offer Accepted Successfully</div></div></div>';
                    await supa.from('messages').update({ text: newText }).eq('id', msgs[0].id);
                }
            }
        }

        if (typeof DB.messages === 'function' && negId) {
            const key = [AppState.CU.id, freelancerId].sort().join('_');
            let allMsgs = DB.messages();
            if (allMsgs[key]) {
                allMsgs[key] = allMsgs[key].map(m => {
                    if (m.text && m.text.includes(negId)) {
                        return { ...m, text: m.text.split('<div class="neg-action-area">')[0] + '<div class="neg-action-area"><div style="background:rgba(22,163,74,.1); color:var(--green); padding:8px 12px; border-radius:6px; font-weight:bold; font-size:0.85rem; width:100%; text-align:center;">✅ Offer Accepted Successfully</div></div></div>' };
                    }
                    return m;
                });
                DB.saveMessages(allMsgs);
            }
        }
        
        const msgText = `🎉 **Great News!** I have Accepted your counter-offer. The budget is now officially **₹${fmt(newPrice)}**. Let's start working!`;
        await window.sendMsg(AppState.CU.id, freelancerId, null, null, msgText);
        window.showToast('Offer Accepted! Project & Budget Updated.', 'ok');
        
    } catch(e) {
        console.error(e);
        window.showToast('Error accepting offer.', 'err');
    }
}

export async function rejectNegotiation(pid, freelancerId, btnElement, negId) {
    if (btnElement) {
        const actionArea = btnElement.closest('.neg-action-area');
        if (actionArea) actionArea.innerHTML = `<div style="background:rgba(239,68,68,.1); color:var(--red); padding:8px 12px; border-radius:6px; font-weight:bold; font-size:0.85rem; width:100%; text-align:center;">❌ Offer Rejected</div>`;
    }

    try {
        const supa = window.supaClient || window.supabaseClient || window.supabase;
        if (supa && negId) {
            const { data: msgs } = await supa.from('messages').select('id, text').ilike('text', `%${negId}%`);
            if (msgs && msgs.length > 0) {
                const newText = msgs[0].text.split('<div class="neg-action-area">')[0] + '<div class="neg-action-area"><div style="background:rgba(239,68,68,.1); color:var(--red); padding:8px 12px; border-radius:6px; font-weight:bold; font-size:0.85rem; width:100%; text-align:center;">❌ Offer Rejected</div></div></div>';
                await supa.from('messages').update({ text: newText }).eq('id', msgs[0].id);
            }
        }

        if (typeof DB.messages === 'function' && negId) {
            const key = [AppState.CU.id, freelancerId].sort().join('_');
            let allMsgs = DB.messages();
            if (allMsgs[key]) {
                allMsgs[key] = allMsgs[key].map(m => {
                    if (m.text && m.text.includes(negId)) {
                        return { ...m, text: m.text.split('<div class="neg-action-area">')[0] + '<div class="neg-action-area"><div style="background:rgba(239,68,68,.1); color:var(--red); padding:8px 12px; border-radius:6px; font-weight:bold; font-size:0.85rem; width:100%; text-align:center;">❌ Offer Rejected</div></div></div>' };
                    }
                    return m;
                });
                DB.saveMessages(allMsgs);
            }
        }

        const msgText = `❌ I cannot accept this offer. We can stick to the original price or you can submit a new offer.`;
        await window.sendMsg(AppState.CU.id, freelancerId, null, null, msgText);
        window.showToast('Offer Rejected.', 'info');
        
    } catch(e) { 
        console.error(e); 
    }
}

// ─── REAL DOWNLOAD & REVIEW LOGIC ───

export async function downloadEditedVideo(pid) {
    window.showToast('Fetching final video...', 'info');
    
    const p = DB.projects().find(x => x.id === pid);
    if (!p || !p.freelancerId) {
        window.showToast('Error: Project or Editor not found', 'err');
        return;
    }
    
    let foundUrl = null;
    
    // Chat messages mein se Final Delivery wala URL dhoondh nikalega
    if (typeof DB.messages === 'function') {
        const key = [AppState.CU.id, p.freelancerId].sort().join('_');
        const msgs = DB.messages()[key] || [];
        
        // Ulta loop (latest message pehle check karega)
        for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].text && (msgs[i].text.includes('Final Delivery') || msgs[i].text.includes('href='))) {
                const match = msgs[i].text.match(/href="([^"]+)"/);
                if (match && match[1]) {
                    foundUrl = match[1];
                    break;
                }
            }
        }
    }
    
    if (foundUrl) {
        window.showToast('Starting Download...', 'ok');
        window.open(foundUrl, '_blank'); // Naye tab mein video khol dega/download karega
    } else {
        window.showToast('Video link not found. Please check Chat messages.', 'err');
    }
}

export async function submitReview() {
    const pid = AppState.activeManageProjectId;
    if (!pid) return;

    // Stars aur Text ki value nikalna
    const rating = document.querySelectorAll(`#sr1 span.lit`).length;
    const reviewText = document.getElementById('review-text')?.value || '';
    
    if (!rating) {
        window.showToast('Please select a star rating first!', 'err');
        return;
    }
    
    window.showToast('Saving review to Cloud...', 'info');
    
    try {
        // 1. Local DB Update
        const projs = DB.projects();
        const p = projs.find(x => x.id === pid);
        if (p) {
            p.rating = rating;
            p.review = reviewText;
            DB.saveProjects(projs);
        }
        
        // 2. Supabase Cloud DB Update
        const supa = window.supaClient || window.supabaseClient || window.supabase;
        if (supa) {
            await supa.from('projects').update({ rating: rating, review: reviewText }).eq('id', pid);
        }
        
        window.showToast('Review submitted successfully!', 'ok');
        
        // Review ke baad wapas projects list pe bhej do
        window.cPage('projects', document.querySelector('[data-page="projects"]'));
        
    } catch (err) {
        console.error(err);
        window.showToast('Error saving review to database.', 'err');
    }
}

export function reviseOffer(pid) {
    window.fPage('negotiate', document.querySelector('[data-page=negotiate]'));
    setTimeout(() => {
        const select = document.getElementById('neg-project-select');
        if(select) {
            select.value = pid;
            window.toggleNegotiationCard(pid);
        }
    }, 200);
}
// ─── PROFILE PHOTO UPLOAD LOGIC ───

export async function handleProfilePhotoUpload(input) {
    if (!input.files || !input.files.length) return;
    const file = input.files[0];

    window.showToast('Uploading photo...', 'info');

    try {
        const supa = window.supaClient || window.supabaseClient || window.supabase || supaClient;
        if (!supa) throw new Error("Supabase connection not found");

        const fileExt = file.name.split('.').pop();
        const fileName = `${AppState.CU.id}_${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        // 1. Supabase Storage me upload
        const { data: uploadData, error: uploadErr } = await supa.storage.from('avatars').upload(filePath, file);
        if (uploadErr) throw uploadErr;

        // 2. Public URL nikalna
        const { data: urlData } = supa.storage.from('avatars').getPublicUrl(uploadData.path);
        const photoUrl = urlData?.publicUrl;

        // 3. Local State aur Database update karna
        AppState.CU.photo_url = photoUrl;
        const users = DB.users();
        const u = users.find(x => x.id === AppState.CU.id);
        if (u) { 
            u.photo_url = photoUrl; 
            DB.saveUsers(users); 
        }
        DB.setCurrentUser(AppState.CU);

        // 4. Supabase Profiles table me update
        await supa.from('profiles').update({ photo_url: photoUrl }).eq('id', AppState.CU.id);

        window.showToast('Profile photo updated!', 'ok');
        
        // 5. Smart Refresh (Creator aur Freelancer dono ke liye)
        if (AppState.CU.role === 'creator') {
            window.cPage('profile', document.querySelector('[data-page="profile"]'));
        } else {
            window.fPage('profile', document.querySelector('[data-page="profile"]'));
        }

    } catch (err) {
        console.error("Photo upload error:", err);
        window.showToast('Upload failed. Try again.', 'err');
    } finally {
        input.value = ''; 
    }
}// ─── FREELANCER PROFILE SAVE LOGIC ───

export function saveFProfile() {
    const name = document.getElementById('f-prof-name')?.value?.trim();
    if (!name) { window.showToast('Name cannot be empty', 'err'); return; }
    const phone = document.getElementById('f-prof-phone')?.value?.trim();
    const prof = document.getElementById('f-prof-title')?.value?.trim();
    
    const instaLink = document.getElementById('f-prof-insta')?.value?.trim() || '';
    const ytLink = document.getElementById('f-prof-yt')?.value?.trim() || '';
    const workLink = document.getElementById('f-prof-work')?.value?.trim() || '';
    
    const users = DB.users();
    const u = users.find(x => x.id === AppState.CU.id);
    
    if (u) { 
        u.name = name; 
        u.phone = phone; 
        u.profession = prof; 
        u.avatar = name.charAt(0).toUpperCase(); 
        u.instaLink = instaLink;
        u.ytLink = ytLink;
        u.workLink = workLink;
        DB.saveUsers(users); 
    }
    
    AppState.CU = {...AppState.CU, name, phone, profession: prof, instaLink, ytLink, workLink}; 
    DB.setCurrentUser(AppState.CU);
    
    const navName = document.getElementById('f-nav-name');
    const sbName = document.getElementById('f-sb-name');
    const sbAvatar = document.getElementById('f-sb-avatar');
    if(navName) navName.textContent = name.split(' ')[0];
    if(sbName) sbName.textContent = name;
    if(sbAvatar) sbAvatar.textContent = name.charAt(0).toUpperCase();
    
    const supa = window.supaClient || window.supabaseClient || window.supabase;
    if (supa && AppState.CU.id) {
        supa.from('profiles').update({ 
            name, phone, profession: prof, insta_link: instaLink, yt_link: ytLink, work_link: workLink 
        }).eq('id', AppState.CU.id).then(() => {});
    }
    
    window.showToast('Profile updated successfully!', 'ok');
    window.fPage('profile', document.querySelector('[data-page="profile"]'));
}
