// js/state.js

const MemDB = { users: [], projects: [], msgs: {}, attachments: [], currentUser: null };

export const DB = {
  users: () => MemDB.users,
  saveUsers: (data) => { MemDB.users = data; },
  projects: () => MemDB.projects,
  saveProjects: (data) => { MemDB.projects = data; },
  messages: () => MemDB.msgs,
  saveMessages: (data) => { MemDB.msgs = data; },
  attachments: () => MemDB.attachments,
  saveAttachments: (data) => { MemDB.attachments = data; },
  currentUser: () => MemDB.currentUser || null,
  setCurrentUser: (data) => { MemDB.currentUser = data; },
  logout: () => {
    MemDB.currentUser = null;
    MemDB.users = [];
    MemDB.projects = [];
    MemDB.msgs = {};
    MemDB.attachments = [];
  }
};

export const AppState = {
  CU: null,
  wfStep: 0,
  selContent: '',
  selFreelancerName: null,
  selFreelancerIds: [], 
  activeManageProjectId: null, 
  newProjectDraft: {}, 
  newProjectFiles: [],
  currentChatUserId: null, 
  onlineUsers: new Set(),
  loginRole: 'creator',
  signupRole: 'creator',
  realtimeInitialized: false
};

// --- Utilities / Helpers ---
export function uid()  { return 'u' + Date.now() + Math.random().toString(36).slice(2,7); }
export function pid() { 
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
export function fmt(n) { return new Intl.NumberFormat('en-IN').format(n); }
export function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'short' }); }
export function fmtTime(t) { return new Date(t).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }); }
export function fmtFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  if (bytes < 1024*1024*1024) return (bytes/(1024*1024)).toFixed(1) + ' MB';
  return (bytes/(1024*1024*1024)).toFixed(2) + ' GB';
}