/* JRDC Lab Management System – app core, labs, machines, my work, calendar, guidance.
   Talks to the Apps Script backend (config.js → JRDC_API_URL). */
'use strict';

const API_URL = (window.JRDC_API_URL || '').trim();
const K_TOKEN = 'jrdc_token', K_BOOT = 'jrdc_boot', K_PUB = 'jrdc_public';
const S = { token: null, user: null, boot: null, nav: 0, cache: {}, mtab: null, cal: null, dash: null,
            admLab: '', reqFilter: 'Pending', smpFilter: 'All' };

/* ================= Helpers ================= */
const $ = s => document.querySelector(s);
const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const js = v => esc(JSON.stringify(v));
const val = id => { const e = document.getElementById(id); return e ? String(e.value).trim() : ''; };
const alive = n => n === S.nav;
function store(k, v) {
  try {
    if (v === undefined) return JSON.parse(localStorage.getItem(k));
    if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v));
  } catch (e) { return null; }
}
let loadingN = 0;
function loading(on) { loadingN = Math.max(0, loadingN + (on ? 1 : -1)); $('#loader').style.display = loadingN ? 'block' : 'none'; }
function toast(msg, err) { const t = $('#toast'); t.textContent = msg; t.className = 'show' + (err ? ' err' : ''); clearTimeout(t._h); t._h = setTimeout(() => t.className = '', err ? 4500 : 2600); }

async function rawApi(fn, args, quiet) {
  if (!API_URL || API_URL.indexOf('PASTE') >= 0) { if (!quiet) toast('App not set up: put the Apps Script URL in config.js', true); throw new Error('NO_API'); }
  if (!quiet) loading(true);
  try {
    const r = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ fn, args }) });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'Server error');
    return j.result;
  } catch (e) {
    const m = (e && e.message) || String(e);
    if (m.indexOf('SESSION_EXPIRED') >= 0) { toast('Please log in again', true); doLogout(true); }
    else if (!quiet) {
      if (/Failed to fetch|NetworkError|Load failed/.test(m)) toast('No connection – showing saved data', true);
      else if (m !== 'NO_API') toast(m.replace(/^Exception:\s*/, ''), true);
    }
    throw e;
  } finally { if (!quiet) loading(false); }
}
const api = (fn, ...args) => rawApi(fn, args);
const call = (fn, ...args) => rawApi(fn, [S.token, ...args]);
const callQuiet = (fn, ...args) => rawApi(fn, [S.token, ...args], true);

/* Dates: 'yyyy-MM-dd' strings, local time */
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const todayStr = () => ymd(new Date());
function addDays(s, n) { const [y, m, d] = s.split('-').map(Number); return ymd(new Date(y, m - 1, d + n)); }
function parseYmd(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function fmtDate(s) { if (!s) return ''; return parseYmd(String(s).slice(0, 10)).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }); }
function fmtShort(s) { if (!s) return ''; return parseYmd(String(s).slice(0, 10)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); }
function fmtTs(ts) { if (!ts) return ''; const s = String(ts); return fmtShort(s) + (s.length > 11 ? ', ' + s.slice(11, 16) : ''); }
function nowLocal() { const d = new Date(); return ymd(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
const dtText = s => s ? String(s).replace('T', ' ') : '';

/* Colours */
const validColor = c => /^#[0-9a-f]{6}$/i.test(String(c || '')) ? c : '';
function shade(hex, pct) { // pct > 0 lighter, < 0 darker
  const c = validColor(hex) || '#0b5d7a', n = parseInt(c.slice(1), 16);
  const f = x => Math.round(pct > 0 ? x + (255 - x) * pct / 100 : x * (1 + pct / 100));
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(f).map(x => pad(Math.max(0, Math.min(255, x)).toString(16))).join('');
}

/* Icons (stroke SVG) */
const P = {
  flask: '<path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3"/><path d="M7 15h10"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 12h6M9 16h4"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  chart: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m22 8-6 4 6 4z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  check: '<path d="M20 6 9 17l-5-5"/>'
};
const ico = (n, cls) => `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;

/* Lookups & roles */
const labs = () => (S.boot && S.boot.labs) || [];
const machines = () => (S.boot && S.boot.machines) || [];
const labById = id => labs().find(l => l.LabID === id);
const machineById = id => machines().find(m => m.MachineID === id);
const userName = id => { const u = ((S.boot && S.boot.users) || []).find(x => x.id === id); return u ? u.name : (id || ''); };
const role = () => S.user ? S.user.role : '';
const isAdmin = () => role() === 'Admin';
const isHead = () => role() === 'Head' || isAdmin();
const inLab = id => isAdmin() || !!(S.user && S.user.labs.indexOf(id) >= 0);
const headOf = id => isAdmin() || (role() === 'Head' && inLab(id));
const myLabs = () => labs().filter(l => l.Active && inLab(l.LabID));
const labColor = l => validColor(l && l.Color) || validColor(S.boot && S.boot.settings.ThemeColor) || '#0b5d7a';

const ST = { Available: 'b-ok', 'In use': 'b-info', Maintenance: 'b-warn', 'Out of order': 'b-bad', Done: 'b-ok', 'In progress': 'b-info',
  Pending: 'b-warn', Failed: 'b-bad', Approved: 'b-ok', Declined: 'b-bad', Booked: 'b-info', Open: 'b-bad', Fixed: 'b-ok',
  Completed: 'b-ok', Received: 'b-warn', High: 'b-warn', Urgent: 'b-bad', Admin: 'b-bad', Head: 'b-info', Assistant: 'b-ok' };
const badge = t => t ? `<span class="badge ${ST[t] || ''}">${esc(t)}</span>` : '';
const MSTATUS = ['Available', 'In use', 'Maintenance', 'Out of order'];
const RSTATUS = ['Done', 'In progress', 'Pending', 'Failed'];

/* Media: Drive / YouTube links */
const safeUrl = u => /^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '';
function driveId(url) { const s = String(url || ''); const m = s.match(/\/d\/([\w-]{20,})/) || s.match(/[?&]id=([\w-]{20,})/); return m ? m[1] : ''; }
// Photos bundled with the app (img/…) are allowed as relative paths.
function imgSrc(url) { const id = driveId(url); if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w1600`; const s = String(url || '').trim(); return /^img\/[\w.-]+$/.test(s) ? s : safeUrl(s); }
function cssUrl(u) { return String(u).replace(/["'()\\\s]/g, c => encodeURIComponent(c)); }
function ytId(url) { const m = String(url || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/); return m ? m[1] : ''; }
function embedHtml(url, doc) {
  url = safeUrl(url); if (!url) return '';
  const y = ytId(url);
  if (y) return `<div class="embed"><iframe src="https://www.youtube.com/embed/${y}" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`;
  const d = driveId(url);
  if (d) return `<div class="embed ${doc ? 'doc' : ''}"><iframe src="https://drive.google.com/file/d/${d}/preview" allow="autoplay; fullscreen" allowfullscreen></iframe></div>`;
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) return `<div class="embed"><video src="${esc(url)}" controls preload="metadata"></video></div>`;
  if (doc && /\.pdf(\?|$)/i.test(url)) return `<div class="embed doc"><iframe src="${esc(url)}"></iframe></div>`;
  return '';
}
function shortName(name) {
  const w = String(name || '?').split(/\s+/), num = (String(name).match(/#\s*(\d+)\s*$/) || [])[1];
  const base = /^[a-z]?[A-Z0-9-]{2,7}$/.test(w[0]) ? w[0].toUpperCase() : w.filter(x => /^[A-Za-z0-9]/.test(x)).slice(0, 3).map(x => x[0]).join('').toUpperCase();
  return base + (num ? ' ' + num : '');
}
function machineImg(m, withBadge) {
  const c = labColor(labById(m.LabID));
  const src = m.Image ? imgSrc(m.Image) : '';
  return `<div class="mimg"><div class="ph" style="background:linear-gradient(135deg,${c},${shade(c, 35)})"><div>${ico('flask')}<b>${esc(shortName(m.Name))}</b></div></div>` +
    (src ? `<img src="${esc(src)}" alt="${esc(m.Name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : '') +
    (withBadge ? badge(m.Status || 'Available') : '') + '</div>';
}
function thumb(m) {
  const c = labColor(labById(m.LabID)), src = m.Image ? imgSrc(m.Image) : '';
  return src ? `<img class="thumb" src="${esc(src)}" alt="" referrerpolicy="no-referrer" onerror="this.outerHTML='<span class=thumb style=background:${c}>${esc(shortName(m.Name)).slice(0, 4)}</span>'">`
             : `<span class="thumb" style="background:${c}">${esc(shortName(m.Name)).slice(0, 4)}</span>`;
}
const linkBtn = (url, label, icon) => safeUrl(url) ? `<a class="btn sm" href="${esc(safeUrl(url))}" target="_blank" rel="noopener">${ico(icon || 'file')}${esc(label)}</a>` : '';

function openModal(html, wide) { $('#modalBody').innerHTML = html; $('#modalBody').className = 'modal-box' + (wide ? ' wide' : ''); $('#modal').classList.remove('hidden'); const f = $('#modalBody input:not([type=hidden]):not([disabled]),#modalBody textarea'); if (f && window.innerWidth > 700) f.focus(); }
function closeModal() { $('#modal').classList.add('hidden'); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function fileB64(f) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(f); }); }
async function uploadOne(file, kind) {
  if (file.size > 30 * 1024 * 1024) { toast('File is larger than 30 MB. Upload it to YouTube/Drive and paste the link.', true); throw new Error('big'); }
  toast('Uploading ' + file.name + '…');
  const b64 = await fileB64(file);
  return call('uploadFile', kind, file.name, file.type || 'application/octet-stream', b64);
}
/** Upload widget: text box for a link + an Upload button that fills it. */
function uploadField(id, label, kind, value, accept, hint) {
  return `<div class="f"><span>${esc(label)}</span><div class="upl"><input id="${id}" value="${esc(value || '')}" placeholder="Paste a link or upload" oninput="pvUpdate('${id}','${kind}')">
    <label class="btn sm" style="margin:0">Upload<input type="file" accept="${accept}" hidden onchange="doUpload(this,'${id}','${kind}')"></label></div>
    ${hint ? `<div class="hint">${hint}</div>` : ''}<div id="${id}_pv">${pvHtml(value, kind)}</div></div>`;
}
function pvHtml(v, kind) {
  if (!v) return '';
  if (kind === 'image' || kind === 'branding') return imgSrc(v) ? `<img class="preview-img" src="${esc(imgSrc(v))}" referrerpolicy="no-referrer" alt="">` : '';
  return safeUrl(v) ? `<div class="hint"><a href="${esc(safeUrl(v))}" target="_blank" rel="noopener">Open file ↗</a></div>` : '';
}
function pvUpdate(id, kind) { const e = $('#' + id + '_pv'); if (e) e.innerHTML = pvHtml(val(id), kind); }
async function doUpload(input, targetId, kind) {
  const f = input.files[0]; if (!f) return;
  try { const r = await uploadOne(f, kind); $('#' + targetId).value = r.url; pvUpdate(targetId, kind); toast('Uploaded'); }
  catch (e) { /* toast already shown */ } finally { input.value = ''; }
}
function download(name, text, mime) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime || 'text/csv;charset=utf-8' }));
  a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
const machineOptions = (labFilter, sel, includeEmpty) => {
  const ls = labs().filter(l => l.Active && labFilter(l));
  return (includeEmpty ? `<option value="">${esc(includeEmpty)}</option>` : '') + ls.map(l => `<optgroup label="${esc(l.Name)}">` +
    machines().filter(m => m.LabID === l.LabID && m.Active).map(m => `<option value="${esc(m.MachineID)}" ${m.MachineID === sel ? 'selected' : ''}>${esc(m.Name)}</option>`).join('') + '</optgroup>').join('');
};

/* ================= Branding ================= */
function applyBrand(s) {
  if (!s) return;
  const c = validColor(s.ThemeColor) || '#1f3c88', root = document.documentElement.style;
  root.setProperty('--brand', c);
  root.setProperty('--brand-2', shade(c, matchMedia('(prefers-color-scheme: dark)').matches ? 35 : 12));
  const tc = document.querySelector('meta[name=theme-color]'); if (tc) tc.content = c;
  $('#hName').textContent = s.InstituteName || 'JRDC';
  $('#hSub').textContent = s.AppTitle || 'Lab Management System';
  $('#hLogo').src = s.Logo ? imgSrc(s.Logo) : 'logo.png';
  document.title = (s.InstituteName || 'JRDC') + ' Lab Management';
}

/* ================= Start / login ================= */
function start() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  applyBrand(store(K_PUB));
  S.token = store(K_TOKEN);
  const boot = store(K_BOOT);
  window.addEventListener('hashchange', () => { if (S.token && S.boot) render(); });
  if (S.token && boot) {
    setBoot(boot); showShell(); render();
    refreshBoot().then(() => { if (['home', 'lab', ''].indexOf(route()[0]) >= 0) render(); }).catch(() => {});
  } else if (S.token) {
    refreshBoot().then(() => { showShell(); render(); }).catch(() => renderLogin());
  } else renderLogin();
  setInterval(pollUnread, 120000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pollUnread(); });
}

async function refreshBoot() {
  const b = await call('getBootstrap');
  setBoot(b); store(K_BOOT, b); store(K_PUB, b.settings);
  return b;
}
function setBoot(b) {
  S.boot = b; S.user = b.user; applyBrand(b.settings);
  $('#sampleList').innerHTML = (b.samples || []).slice().reverse().map(s => `<option value="${esc(s.id)}">${esc(s.d || '')}</option>`).join('');
  updateChrome();
}
async function pollUnread() {
  if (!S.token || !S.boot || document.hidden) return;
  try { const r = await callQuiet('getUnread'); S.boot.unread = r.unread; S.boot.pendingGuidance = r.pendingGuidance; updateChrome(); } catch (e) {}
}

function renderLogin() {
  document.body.classList.add('out'); $('#shell').classList.add('hidden');
  const s = store(K_PUB) || {};
  $('#app').innerHTML = `<div class="login-wrap"><form class="login" onsubmit="doLogin(event)">
    <img class="logo" id="lLogo" src="${esc(s.Logo ? imgSrc(s.Logo) : 'logo.png')}" alt="" referrerpolicy="no-referrer">
    <h1 id="lName">${esc(s.InstituteName || 'JRDC')} Lab Management</h1>
    <div class="sub" id="lSub">${esc(s.InstituteFull || 'China–Sri Lanka Joint Research and Demonstration Centre for Water Technology')}<br>${esc(s.Subtitle || 'Meewathura, Peradeniya · Sri Lanka')}</div>
    <label class="f"><span>User ID</span><input id="lid" autocomplete="username" autocapitalize="characters" spellcheck="false" required></label>
    <label class="f"><span>PIN</span><input id="lpin" type="password" inputmode="numeric" autocomplete="current-password" required></label>
    <button class="btn primary block" id="lbtn">Log in</button>
    <div class="foot">Forgot your PIN? Ask a system admin.</div>
    <div class="partners" aria-label="Partners"><img src="img/p-gosl.png" alt="Government of Sri Lanka"><img src="img/p-chinaaid.png" alt="China Aid"><img src="img/p-cas.png" alt="Chinese Academy of Sciences"><img src="img/p-uop.png" alt="University of Peradeniya"></div>
  </form></div>`;
  rawApi('getPublic', [], true).then(p => {
    store(K_PUB, p); applyBrand(p);
    if ($('#lName')) { $('#lName').textContent = (p.InstituteName || 'JRDC') + ' Lab Management'; $('#lSub').innerHTML = esc(p.InstituteFull) + '<br>' + esc(p.Subtitle); if (p.Logo) $('#lLogo').src = imgSrc(p.Logo); }
  }).catch(() => {});
}
async function doLogin(e) {
  e.preventDefault();
  const b = $('#lbtn'); b.disabled = true;
  try {
    const r = await api('login', val('lid'), val('lpin'));
    S.token = r.token; store(K_TOKEN, r.token);
    await refreshBoot();
    showShell();
    if (location.hash && location.hash !== '#/home' && location.hash !== '#/') render(); else { location.hash = '#/home'; render(); }
  } catch (err) { b.disabled = false; }
}
function doLogout(silent) {
  [K_TOKEN, K_BOOT].forEach(k => store(k, null));
  S.token = null; S.user = null; S.boot = null; S.cache = {};
  if (!silent) rawApi('logout', [], true).catch(() => {});
  closeModal(); renderLogin();
}
function showShell() { document.body.classList.remove('out'); $('#shell').classList.remove('hidden'); updateChrome(); }

/* ================= Chrome: nav, bell, user ================= */
function navItems() {
  const it = [['home', 'Labs', 'flask']];
  if (!isAdmin()) it.push(['mywork', 'My work', 'clipboard']);
  it.push(['calendar', 'Calendar', 'calendar']);
  it.push(['requests', 'Guidance', 'help', isHead() ? (S.boot && S.boot.pendingGuidance) : 0]);
  if (isHead()) { it.push(['samples', 'Samples', 'search']); it.push(['dashboard', 'Dashboard', 'chart']); }
  if (isAdmin()) it.push(['admin', 'Admin', 'sliders']);
  return it;
}
function updateChrome() {
  if (!S.user || !S.boot) return;
  const cur = route()[0] || 'home';
  $('#nav').innerHTML = navItems().map(([k, l, i, n]) =>
    `<a href="#/${k}" class="${cur === k || (cur === 'lab' || cur === 'machine') && k === 'home' ? 'on' : ''}">${ico(i)}<span class="lbl">${l}</span>${n ? `<span class="cnt">${n}</span>` : ''}</a>`).join('') +
    `<div class="navfoot">${esc(S.boot.settings.InstituteFull)}<br>${esc(S.boot.settings.Subtitle)}</div>`;
  const u = S.boot.unread || 0;
  $('#bell').innerHTML = ico('bell') + (u ? `<span class="dot">${u > 99 ? '99+' : u}</span>` : '');
  const ini = S.user.name.split(/\s+/).filter(w => /^[A-Za-z]/.test(w) && !/^(Dr|Mr|Mrs|Ms|Prof)\.?$/.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  $('#who').innerHTML = `<span class="avatar">${esc(ini)}</span><span class="nm">${esc(S.user.name)}<small>${esc(S.user.role)}</small></span>`;
}

function openUserMenu() {
  const u = S.user;
  openModal(`<h2>${esc(u.name)}</h2>
    <div class="row" style="margin-bottom:12px">${badge(u.role)} <small>ID: ${esc(u.id)}</small></div>
    <p class="muted" style="margin-top:0">Labs: ${isAdmin() ? 'All labs (admin)' : esc(u.labs.map(id => (labById(id) || {}).Name || id).join(', ') || 'none')}</p>
    <div class="menu-list">
      <button onclick="openChangePin()">${ico('edit')} Change my PIN</button>
      <button onclick="openBugReport()">${ico('help')} Report a problem / suggestion</button>
      <button onclick="closeModal();refreshBoot().then(render).then(()=>toast('Data refreshed'))">${ico('download')} Refresh data</button>
      <button onclick="doLogout()" style="color:var(--bad)">${ico('back')} Log out</button>
    </div>`);
}
function openChangePin() {
  openModal(`<h2>Change my PIN</h2>
    <label class="f"><span>Current PIN</span><input id="pOld" type="password" inputmode="numeric"></label>
    <label class="f"><span>New PIN (4–6 digits)</span><input id="pNew" type="password" inputmode="numeric"></label>
    <label class="f"><span>New PIN again</span><input id="pNew2" type="password" inputmode="numeric"></label>
    <div class="actions"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="saveMyPin()">Save PIN</button></div>`);
}
async function saveMyPin() {
  if (val('pNew') !== val('pNew2')) return toast('The new PINs do not match', true);
  await call('changeMyPin', val('pOld'), val('pNew')); closeModal(); toast('PIN changed');
}
function openBugReport() {
  openModal(`<h2>Report a problem or suggestion</h2>
    <p class="muted" style="margin-top:0">Tell the system admins what went wrong or what you would like changed.</p>
    <label class="f"><span>Description</span><textarea id="bugD" rows="5" placeholder="What happened? What did you expect?"></textarea></label>
    <div class="actions"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="sendBug()">Send</button></div>`);
}
async function sendBug() { await call('reportBug', location.hash || '#/home', val('bugD')); closeModal(); toast('Thank you – the admins have been notified'); }

async function openNotifications() {
  openModal(`<div class="row between"><h2 style="margin:0">Notifications</h2><button class="btn sm" onclick="markAllRead()">${ico('check')} Mark all read</button></div><div id="nList" style="margin-top:12px"><div class="empty">Loading…</div></div>`);
  try {
    const list = await call('getNotifications');
    S.notifs = list;
    $('#nList').innerHTML = list.length ? list.map((n, i) => `<div class="notif ${n.read ? '' : 'unread'}" onclick="openNotif(${i})">
      <div class="row between"><b>${esc(n.type)}</b><span class="ts">${esc(fmtTs(n.ts))}</span></div><p>${esc(n.text)}</p></div>`).join('')
      : '<div class="empty">No notifications yet.</div>';
  } catch (e) { $('#nList').innerHTML = '<div class="empty">Could not load notifications.</div>'; }
}
async function openNotif(i) {
  const n = S.notifs[i]; if (!n) return;
  if (!n.read) { callQuiet('markRead', [n.id]).then(pollUnread).catch(() => {}); S.boot.unread = Math.max(0, (S.boot.unread || 1) - 1); updateChrome(); }
  closeModal();
  if (n.link && n.link.indexOf('#/') === 0) location.hash = n.link;
}
async function markAllRead() { await call('markRead', 'all'); S.boot.unread = 0; updateChrome(); closeModal(); toast('All marked as read'); }

/* ================= Router ================= */
function route() { const h = location.hash.replace(/^#\/?/, ''); return h ? h.split('/').map(x => decodeURIComponent(x)) : ['home']; }
const VIEWS = {};
function render() {
  if (!S.token || !S.boot) return renderLogin();
  const r = route(); S.nav++;
  updateChrome(); closeModal(); window.scrollTo(0, 0);
  const v = VIEWS[r[0]] || VIEWS.home;
  try { v.apply(null, r.slice(1)); }
  catch (e) { console.error(e); $('#app').innerHTML = `<div class="card empty">Something went wrong: ${esc(e.message)}</div>`; }
}
const notFound = what => { $('#app').innerHTML = `<a class="back" href="#/home">${ico('back')} Labs</a><div class="card empty">${esc(what)} not found. It may have been removed.</div>`; };

/* ================= Home: lab portfolios ================= */
VIEWS.home = function () {
  const b = S.boot, s = b.settings;
  const ls = labs().filter(l => l.Active || isAdmin());
  const mine = ls.filter(l => inLab(l.LabID) && !isAdmin()), other = ls.filter(l => !mine.includes(l));
  const bg = s.BannerImage ? `style="background-image:url('${cssUrl(imgSrc(s.BannerImage))}')"` : '';
  const hi = new Date().getHours(), greet = hi < 12 ? 'Good morning' : hi < 17 ? 'Good afternoon' : 'Good evening';
  $('#app').innerHTML = `
    <section class="hero" ${bg}>
      <h1>${esc(s.InstituteFull)}</h1>
      <p>${esc(s.Subtitle)} · ${esc(s.AppTitle)}</p>
      <p style="margin-top:10px">${greet}, <b>${esc(S.user.name)}</b>. ${esc(s.BannerText || '')}</p>
      <div class="chips">
        ${b.unread ? `<a class="chip" href="javascript:openNotifications()">${b.unread} new notification${b.unread > 1 ? 's' : ''}</a>` : ''}
        ${isHead() && b.pendingGuidance ? `<a class="chip" href="#/requests">${b.pendingGuidance} guidance request${b.pendingGuidance > 1 ? 's' : ''} waiting</a>` : ''}
        ${!isAdmin() ? `<a class="chip" href="#/mywork">My work</a>` : ''}
        <a class="chip" href="#/calendar">Calendar</a>
        ${isHead() ? `<a class="chip" href="#/samples">Find a sample</a>` : ''}
      </div>
    </section>
    ${mine.length ? `<h2>My lab${mine.length > 1 ? 's' : ''}</h2><div class="grid g3" style="margin-bottom:24px">${mine.map(labCard).join('')}</div>` : ''}
    ${other.length ? `<h2>${mine.length ? 'Other labs' : 'Laboratories'}</h2><div class="grid g3">${other.map(labCard).join('')}</div>` : ''}
    ${!ls.length ? `<div class="card empty">No labs yet.${isAdmin() ? ' Add one in <a href="#/admin/labs">Admin → Labs</a>.' : ''}</div>` : ''}`;
};
function labCard(l) {
  const ms = machines().filter(m => m.LabID === l.LabID && m.Active);
  const avail = ms.filter(m => (m.Status || 'Available') === 'Available').length;
  const c = labColor(l);
  const cover = l.CoverImage ? `background-image:linear-gradient(0deg,rgba(0,0,0,.45),rgba(0,0,0,0) 60%),url('${cssUrl(imgSrc(l.CoverImage))}')`
                             : `background:linear-gradient(135deg,${c},${shade(c, 35)})`;
  return `<a class="card labcard" href="#/lab/${encodeURIComponent(l.LabID)}">
    <div class="labcover" style="${cover}"><span class="code">${esc(l.Code || shortName(l.Name))}</span>${inLab(l.LabID) && !isAdmin() ? '<span class="badge plain">My lab</span>' : ''}${!l.Active ? '<span class="badge plain">Hidden</span>' : ''}</div>
    <div class="body"><h3 style="margin:0">${esc(l.Name)}</h3><p>${esc(l.Description || '')}</p>
    <div class="row"><small>${ms.length} machine${ms.length === 1 ? '' : 's'}</small>${ms.length ? `<span class="badge ${avail === ms.length ? 'b-ok' : 'b-warn'}">${avail} available</span>` : ''}
    </div>${l.HeadUserID ? `<small style="display:block;margin-top:6px">Head: ${esc(userName(l.HeadUserID))}</small>` : ''}</div></a>`;
}

/* ================= Lab portfolio ================= */
VIEWS.lab = function (id) {
  const l = labById(id); if (!l) return notFound('Lab');
  const ms = machines().filter(m => m.LabID === id && (m.Active || headOf(id)));
  const c = labColor(l);
  $('#app').innerHTML = `
    <a class="back" href="#/home">${ico('back')} All labs</a>
    <div class="page-head" style="border-left:5px solid ${c};padding-left:14px">
      <div><h1>${esc(l.Name)}</h1><p>${esc(l.Description || '')}</p>
      <p>${l.HeadUserID ? 'Lab head: <b>' + esc(userName(l.HeadUserID)) + '</b> · ' : ''}${ms.filter(m => m.Active).length} machines</p></div>
      <div class="row">
        <a class="btn" href="#/calendar/${encodeURIComponent(id)}">${ico('calendar')} Lab calendar</a>
        ${headOf(id) ? `<a class="btn" href="#/dashboard/${encodeURIComponent(id)}">${ico('chart')} Dashboard</a>` : ''}
        ${headOf(id) ? `<button class="btn" onclick="editMachine('', ${js(id)})">${ico('plus')} Add machine</button>` : ''}
        ${isAdmin() ? `<button class="btn" onclick="editLab(${js(id)})">${ico('edit')} Edit lab</button>` : ''}
      </div>
    </div>
    ${!inLab(id) ? `<div class="note">You can view this lab, but you are not assigned to it, so you cannot add records or book its machines.</div>` : ''}
    ${ms.length ? `<div class="grid g4">${ms.map(m => `
      <a class="card mtile" href="#/machine/${encodeURIComponent(m.MachineID)}" title="Open ${esc(m.Name)}">
        ${machineImg(m, true)}
        <div class="body"><b>${esc(m.Name)}</b><small>${esc([m.Maker, m.Model].filter(Boolean).join(' · ') || m.Category || '')}</small>
        ${m.StatusNote && m.Status !== 'Available' ? `<small style="color:var(--warn)">${esc(m.StatusNote)}</small>` : ''}
        ${!m.Active ? '<small class="overdue">Removed (hidden)</small>' : ''}</div>
      </a>`).join('')}</div>` : `<div class="card empty">No machines in this lab yet.</div>`}`;
};

/* ================= Machine portfolio ================= */
VIEWS.machine = function (id, tab, preSample) {
  const m = machineById(id); if (!m) return notFound('Machine');
  const l = labById(m.LabID) || {}, nav = S.nav, can = inLab(m.LabID), head = headOf(m.LabID);
  const bookable = m.Status !== 'Maintenance' && m.Status !== 'Out of order';
  const tabs = [];
  if (can) tabs.push(['record', 'Add record']);
  tabs.push(['records', 'Records'], ['media', 'Video & manual'], ['book', 'Bookings'], ['guide', 'Guidance']);
  const t = tabs.some(x => x[0] === tab) ? tab : (can ? 'record' : 'media');
  S.mid = id;
  $('#app').innerHTML = `
    <a class="back" href="#/lab/${encodeURIComponent(m.LabID)}">${ico('back')} ${esc(l.Name || 'Lab')}</a>
    <div class="card"><div class="mhero">
      ${machineImg(m, false)}
      <div>
        <div class="row between"><h1 style="margin:0">${esc(m.Name)}</h1>${badge(m.Status || 'Available')}</div>
        <dl class="kv">
          ${m.Maker ? `<dt>Maker</dt><dd>${esc(m.Maker)}</dd>` : ''}${m.Model ? `<dt>Model</dt><dd>${esc(m.Model)}</dd>` : ''}
          ${m.Category ? `<dt>Type</dt><dd>${esc(m.Category)}</dd>` : ''}<dt>Lab</dt><dd>${esc(l.Name || m.LabID)}</dd>
          ${m.StatusNote ? `<dt>Status note</dt><dd>${esc(m.StatusNote)}</dd>` : ''}
        </dl>
        <p style="white-space:pre-wrap;color:var(--ink2)">${esc(m.Description || '')}</p>
        <div class="row">
          ${can ? `<button class="btn primary" onclick="mTab('record')">${ico('plus')} Add record</button>` : ''}
          ${can && bookable ? `<button class="btn" onclick="mTab('book')">${ico('calendar')} Book</button>` : ''}
          <button class="btn" onclick="mTab('guide')">${ico('help')} Request guidance</button>
          ${m.VideoURL ? `<button class="btn" onclick="mTab('media')">${ico('video')} Video</button>` : ''}
          ${m.ManualURL ? `<button class="btn" onclick="mTab('media')">${ico('file')} Manual</button>` : ''}
          ${head ? `<button class="btn" onclick="editMachine(${js(id)})">${ico('edit')} Edit machine</button>` : ''}
        </div>
        ${head ? `<div class="row" style="margin-top:14px;padding-top:14px;border-top:1px solid var(--line)">
          <b style="font-size:13px">Machine status</b>
          <select id="msSel" style="width:auto">${MSTATUS.map(x => `<option ${x === (m.Status || 'Available') ? 'selected' : ''}>${x}</option>`).join('')}</select>
          <input id="msNote" placeholder="Note (e.g. reason, expected date)" value="${esc(m.StatusNote || '')}" style="flex:1;min-width:160px">
          <button class="btn sm primary" onclick="saveMStatus(${js(id)})">Update</button></div>` : ''}
      </div></div></div>
    <div class="subtabs">${tabs.map(([k, lb]) => `<button data-t="${k}" class="${k === t ? 'on' : ''}" onclick="mTab('${k}')">${lb}<span id="cnt_${k}"></span></button>`).join('')}</div>
    <div id="p_record" class="card ${t === 'record' ? '' : 'hidden'}">${can ? recordForm(m, preSample) : ''}</div>
    <div id="p_records" class="card ${t === 'records' ? '' : 'hidden'}">
      <div class="row between" style="margin-bottom:8px"><h3 style="margin:0">Records</h3><input id="recFilter" placeholder="Filter by sample, test, result, person…" style="max-width:320px" oninput="drawMRecords()"></div>
      <div id="mRecords"><div class="empty">Loading…</div></div></div>
    <div id="p_media" class="${t === 'media' ? '' : 'hidden'}">${mediaPanel(m, head)}</div>
    <div id="p_book" class="card ${t === 'book' ? '' : 'hidden'}">
      ${can ? (bookable ? bookingForm(m) : `<div class="note warn">This machine is "${esc(m.Status)}" and cannot be booked right now.</div>`) : '<div class="note">Only staff of this lab can book this machine.</div>'}
      <h3>Upcoming bookings</h3><div id="mBookings"><div class="empty">Loading…</div></div></div>
    <div id="p_guide" class="card ${t === 'guide' ? '' : 'hidden'}">
      <h3>Request a guidance session</h3>
      <p class="muted" style="margin-top:0">The lab head gets an alert (in the app and by email) and will give you a date and time.</p>
      <div class="fgrid">
        <label class="f"><span>Preferred date (optional)</span><input type="date" id="gDate" min="${todayStr()}"></label>
        <label class="f"><span>Preferred time (optional)</span><input type="time" id="gTime"></label>
        <label class="f full"><span>What do you need help with?</span><textarea id="gMsg" rows="3" placeholder="e.g. First time using this machine, need help with calibration…"></textarea></label>
      </div>
      <div class="actions" style="justify-content:flex-start"><button class="btn primary" onclick="sendGuidance(${js(id)})">${ico('help')} Send request</button></div>
      <h3 style="margin-top:20px">${head ? 'Requests for this machine' : 'My requests'}</h3><div id="mGuide"><div class="empty">Loading…</div></div></div>`;
  const cached = S.cache['m:' + id];
  if (cached) fillMachine(cached);
  call('getMachine', id).then(d => {
    S.cache['m:' + id] = d;
    const i = machines().findIndex(x => x.MachineID === id); if (i >= 0) S.boot.machines[i] = d.machine;
    if (alive(nav)) fillMachine(d);
  }).catch(() => {});
};
function mTab(k) {
  document.querySelectorAll('.subtabs button').forEach(b => b.classList.toggle('on', b.dataset.t === k));
  ['record', 'records', 'media', 'book', 'guide'].forEach(x => { const p = $('#p_' + x); if (p) p.classList.toggle('hidden', x !== k); });
  history.replaceState(null, '', '#/machine/' + encodeURIComponent(S.mid) + '/' + k);
  const p = $('#p_' + k); if (p && window.innerWidth < 900) p.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function recordForm(m, pre) {
  const store_ = /freezer|storage|refrigerator|fridge/i.test(m.Name + ' ' + m.Category);
  return `<h3>Add a record – ${esc(m.Name)}</h3>
    <form id="recForm" onsubmit="submitRecord(event,${js(m.MachineID)})" autocomplete="off">
    <div class="fgrid">
      <label class="f"><span>Sample ID *</span><input id="rSid" list="sampleList" required value="${esc(pre || '')}" placeholder="Same ID in every lab" style="text-transform:uppercase"><div class="hint">The same Sample ID is used in all labs, so results can be traced.</div></label>
      <label class="f"><span>Sample description <small>(for new samples)</small></span><input id="rSdesc" placeholder="e.g. Activated carbon, batch 3"></label>
      <label class="f"><span>${store_ ? 'Action' : 'Test / method'}</span><input id="rTest" list="testList" placeholder="${store_ ? 'Stored / Removed' : 'e.g. BET surface area'}"><datalist id="testList">${store_ ? '<option>Stored</option><option>Removed</option><option>Moved</option>' : ''}</datalist></label>
      <label class="f"><span>Status</span><select id="rStatus">${RSTATUS.map(s => `<option>${s}</option>`).join('')}</select></label>
      <label class="f"><span>Start</span><input type="datetime-local" id="rStart" value="${nowLocal()}"></label>
      <label class="f"><span>End</span><input type="datetime-local" id="rEnd"></label>
      <label class="f full"><span>${store_ ? 'Location (rack / box / position)' : 'Parameters / conditions'}</span><textarea id="rParams" rows="2"></textarea></label>
      <label class="f full"><span>Result</span><textarea id="rResult" rows="3" placeholder="${store_ ? 'e.g. Stored at −80 °C' : 'Main result / values'}"></textarea></label>
      <label class="f"><span>Result file (optional)</span><input type="file" id="rFile"><div class="hint">Report, data file, photo… (max 30 MB)</div></label>
      <label class="f"><span>Notes</span><input id="rNotes"></label>
    </div>
    <div class="actions" style="justify-content:flex-start"><button class="btn primary" id="rBtn">${ico('check')} Save record</button><span id="rLast" class="muted"></span></div>
    </form>`;
}
async function submitRecord(e, mid) {
  e.preventDefault();
  const btn = $('#rBtn'); btn.disabled = true;
  try {
    let file = '';
    const f = $('#rFile').files[0];
    if (f) file = (await uploadOne(f, 'result')).url;
    const r = await call('addRecord', { MachineID: mid, SampleID: val('rSid'), SampleDesc: val('rSdesc'), Test: val('rTest'),
      Status: val('rStatus'), StartTime: val('rStart'), EndTime: val('rEnd'), Parameters: val('rParams'), Result: val('rResult'),
      ResultFileURL: file, Notes: val('rNotes') });
    toast('Record saved for ' + r.sampleId);
    if (!S.boot.samples.some(s => s.id === r.sampleId)) { S.boot.samples.push({ id: r.sampleId, d: val('rSdesc') }); setBoot(S.boot); }
    ['rSid', 'rSdesc', 'rParams', 'rResult', 'rNotes', 'rEnd'].forEach(id => { $('#' + id).value = ''; });
    $('#rFile').value = ''; $('#rStart').value = nowLocal();
    $('#rLast').textContent = 'Last saved: ' + r.sampleId + ' at ' + r.ts.slice(11);
    const d = S.cache['m:' + mid]; if (d) { d.records.unshift(r); fillMachine(d); }
  } catch (err) { } finally { btn.disabled = false; }
}
function mediaPanel(m, head) {
  const v = embedHtml(m.VideoURL, false), d = embedHtml(m.ManualURL, true);
  return `<div class="grid g2">
    <div class="card"><div class="row between"><h3 style="margin:0">${ico('video')} Training video</h3>${linkBtn(m.VideoURL, 'Open', 'video')}</div><div style="margin-top:10px">
      ${v || (m.VideoURL ? '<div class="note">Open the video with the button above.</div>' : `<div class="empty">No video yet.${head ? ' Add a YouTube or Drive link with "Edit machine".' : ''}</div>`)}</div></div>
    <div class="card"><div class="row between"><h3 style="margin:0">${ico('file')} User manual</h3>${linkBtn(m.ManualURL, 'Open / download', 'download')}</div><div style="margin-top:10px">
      ${d || (m.ManualURL ? '<div class="note">Open the manual with the button above.</div>' : `<div class="empty">No manual yet.${head ? ' Upload a PDF with "Edit machine".' : ''}</div>`)}</div></div></div>`;
}
function bookingForm(m) {
  return `<h3>Book this machine</h3><div class="fgrid">
    <label class="f"><span>Date</span><input type="date" id="bDate" min="${todayStr()}" value="${todayStr()}"></label>
    <label class="f"><span>From</span><input type="time" id="bStart" value="09:00"></label>
    <label class="f"><span>To</span><input type="time" id="bEnd" value="10:00"></label>
    <label class="f"><span>Sample ID (optional)</span><input id="bSid" list="sampleList" style="text-transform:uppercase"></label>
    <label class="f full"><span>Purpose</span><input id="bPurpose" placeholder="e.g. BET analysis of 3 samples"></label></div>
    <div class="actions" style="justify-content:flex-start;margin-bottom:16px"><button class="btn primary" onclick="bookMachine(${js(m.MachineID)})">${ico('calendar')} Book</button></div>`;
}
async function bookMachine(mid, fromModal) {
  await call('saveBooking', { MachineID: mid || val('bMachine'), Date: val('bDate'), Start: val('bStart'), End: val('bEnd'),
    SampleID: val('bSid'), Purpose: val('bPurpose') });
  toast('Booked');
  if (fromModal) { closeModal(); render(); return; }
  const d = await call('getMachine', mid); S.cache['m:' + mid] = d; fillMachine(d);
}
function fillMachine(d) {
  S.mdata = d;
  drawMRecords();
  const tests = [...new Set(d.records.map(r => r.test).filter(Boolean))];
  const tl = $('#testList'); if (tl && tests.length) tl.innerHTML = tests.map(x => `<option value="${esc(x)}">`).join('');
  const setC = (k, n) => { const e = $('#cnt_' + k); if (e) e.textContent = n ? ` (${n})` : ''; };
  setC('records', d.records.length); setC('book', d.bookings.length); setC('guide', d.guidance.filter(g => g.status === 'Pending').length);
  $('#mBookings').innerHTML = bookingTable(d.bookings, true);
  $('#mGuide').innerHTML = d.guidance.length ? `<div class="list">${d.guidance.map(guidanceItem).join('')}</div>` : '<div class="empty">No requests yet.</div>';
}
function drawMRecords() {
  const d = S.mdata; if (!d || !$('#mRecords')) return;
  const q = val('recFilter').toLowerCase();
  const rs = d.records.filter(r => !q || [r.sampleId, r.test, r.result, r.user, r.params, r.notes, r.status].join(' ').toLowerCase().indexOf(q) >= 0);
  if (!d.canRecord && !isHead()) { $('#mRecords').innerHTML = '<div class="empty">Records are visible to the staff of this lab.</div>'; return; }
  $('#mRecords').innerHTML = recordTable(rs, false);
}
function recordTable(rs, showMachine) {
  if (!rs.length) return '<div class="empty">No records yet.</div>';
  S.recRows = rs;
  return `<div class="tblwrap"><table class="tbl"><thead><tr><th>Date</th><th>Sample</th>${showMachine ? '<th>Lab / machine</th>' : ''}<th>Test</th><th>Result</th><th>Status</th><th>By</th><th></th></tr></thead><tbody>
    ${rs.map((r, i) => `<tr class="click" onclick="openRecord(${i})"><td style="white-space:nowrap">${esc(fmtTs(r.ts))}</td><td><b>${esc(r.sampleId)}</b></td>
      ${showMachine ? `<td>${esc(r.lab)}<br><small>${esc(r.machine)}</small></td>` : ''}<td>${esc(r.test)}</td><td class="clip">${esc(r.result)}</td><td>${badge(r.status)}</td>
      <td>${esc(r.user)}</td><td>${safeUrl(r.file) ? ico('file') : ''}</td></tr>`).join('')}</tbody></table></div>`;
}
function openRecord(i) {
  const r = S.recRows[i]; if (!r) return;
  const canEdit = r.userId === S.user.id || headOf(r.labId), canDel = headOf(r.labId);
  openModal(`<h2>Record – ${esc(r.sampleId)}</h2>
    <dl class="kv"><dt>Lab</dt><dd>${esc(r.lab)}</dd><dt>Machine</dt><dd>${esc(r.machine)}</dd><dt>Saved</dt><dd>${esc(r.ts)} by ${esc(r.user)}</dd>
    ${r.hours ? `<dt>Duration</dt><dd>${r.hours} h</dd>` : ''}</dl>
    ${canEdit ? `<div class="fgrid">
      <label class="f"><span>Test / method</span><input id="eTest" value="${esc(r.test)}"></label>
      <label class="f"><span>Status</span><select id="eStatus">${RSTATUS.map(s => `<option ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      <label class="f"><span>Start</span><input type="datetime-local" id="eStart" value="${esc(r.start)}"></label>
      <label class="f"><span>End</span><input type="datetime-local" id="eEnd" value="${esc(r.end)}"></label>
      <label class="f full"><span>Parameters</span><textarea id="eParams" rows="2">${esc(r.params)}</textarea></label>
      <label class="f full"><span>Result</span><textarea id="eResult" rows="3">${esc(r.result)}</textarea></label>
      <div class="full">${uploadField('eFile', 'Result file', 'result', r.file, '*/*')}</div>
      <label class="f full"><span>Notes</span><input id="eNotes" value="${esc(r.notes)}"></label></div>`
    : `<dl class="kv"><dt>Test</dt><dd>${esc(r.test)}</dd><dt>Status</dt><dd>${badge(r.status)}</dd><dt>Start</dt><dd>${esc(dtText(r.start))}</dd><dt>End</dt><dd>${esc(dtText(r.end))}</dd>
       <dt>Parameters</dt><dd style="white-space:pre-wrap">${esc(r.params)}</dd><dt>Result</dt><dd style="white-space:pre-wrap">${esc(r.result)}</dd><dt>Notes</dt><dd>${esc(r.notes)}</dd></dl>
       ${linkBtn(r.file, 'Result file')}`}
    <div class="actions">${canDel ? `<button class="btn danger" onclick="delRecord(${js(r.id)})">Delete</button><span class="spacer"></span>` : ''}
      ${isHead() ? `<a class="btn" href="#/samples/${encodeURIComponent(r.sampleId)}">${ico('search')} Sample journey</a>` : ''}
      <button class="btn" onclick="closeModal()">Close</button>${canEdit ? `<button class="btn primary" onclick="saveRecordEdit(${js(r.id)})">Save changes</button>` : ''}</div>`);
}
async function saveRecordEdit(id) {
  await call('updateRecord', id, { Test: val('eTest'), Status: val('eStatus'), StartTime: val('eStart'), EndTime: val('eEnd'),
    Parameters: val('eParams'), Result: val('eResult'), ResultFileURL: val('eFile'), Notes: val('eNotes') });
  closeModal(); toast('Record updated'); S.cache = {}; render();
}
async function delRecord(id) {
  if (!confirm('Delete this record permanently? (It is kept in the activity log.)')) return;
  await call('deleteRecord', id); closeModal(); toast('Record deleted'); S.cache = {}; render();
}
async function saveMStatus(id) {
  const m = await call('setMachineStatus', id, val('msSel'), val('msNote'));
  const i = machines().findIndex(x => x.MachineID === id); if (i >= 0) S.boot.machines[i] = m;
  store(K_BOOT, S.boot); toast('Status updated'); render();
}
async function sendGuidance(mid) {
  await call('requestGuidance', mid, val('gDate'), val('gTime'), val('gMsg'));
  toast('Request sent to the lab head');
  $('#gMsg').value = ''; $('#gDate').value = ''; $('#gTime').value = '';
  const d = await call('getMachine', mid); S.cache['m:' + mid] = d; fillMachine(d);
}

function bookingTable(bs, onMachine) {
  if (!bs.length) return '<div class="empty">No upcoming bookings.</div>';
  return `<div class="tblwrap"><table class="tbl"><thead><tr><th>Date</th><th>Time</th>${onMachine ? '' : '<th>Machine</th>'}<th>Booked by</th><th>Purpose</th><th></th></tr></thead><tbody>
    ${bs.map(b => `<tr><td style="white-space:nowrap">${esc(fmtDate(b.date))}</td><td style="white-space:nowrap">${esc(b.start)}–${esc(b.end)}</td>
      ${onMachine ? '' : `<td><a href="#/machine/${encodeURIComponent(b.machineId)}">${esc(b.machine)}</a><br><small>${esc(b.lab)}</small></td>`}
      <td>${esc(b.user)}</td><td>${esc(b.purpose)}${b.sampleId ? `<br><small>Sample ${esc(b.sampleId)}</small>` : ''}</td>
      <td>${b.userId === S.user.id || headOf(b.labId) ? `<button class="btn sm danger" onclick="cancelBk(${js(b.id)})">Cancel</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
}
async function cancelBk(id) {
  if (!confirm('Cancel this booking?')) return;
  await call('cancelBooking', id); toast('Booking cancelled'); S.cache = {}; render();
}
function openBookModal(date, mid) {
  const ok = l => inLab(l.LabID);
  if (!myLabs().length) return toast('You are not assigned to any lab', true);
  openModal(`<h2>Book a machine</h2><div class="fgrid">
    <label class="f full"><span>Machine</span><select id="bMachine">${machineOptions(ok, mid)}</select></label>
    <label class="f"><span>Date</span><input type="date" id="bDate" min="${todayStr()}" value="${esc(date && date >= todayStr() ? date : todayStr())}"></label>
    <label class="f"><span>From</span><input type="time" id="bStart" value="09:00"></label>
    <label class="f"><span>To</span><input type="time" id="bEnd" value="10:00"></label>
    <label class="f"><span>Sample ID (optional)</span><input id="bSid" list="sampleList" style="text-transform:uppercase"></label>
    <label class="f full"><span>Purpose</span><input id="bPurpose"></label></div>
    <div class="actions"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="bookMachine('', true)">Book</button></div>`);
}

/* ================= Guidance requests ================= */
function guidanceItem(g) {
  return `<div class="item"><div class="grow">
    <div class="row between"><b><a href="#/machine/${encodeURIComponent(g.machineId)}">${esc(g.machine)}</a> <small>· ${esc(g.lab)}</small></b>${badge(g.status)}</div>
    <small>${esc(g.user)} · asked ${esc(fmtTs(g.ts))}${g.prefDate ? ' · preferred ' + esc(fmtDate(g.prefDate)) + ' ' + esc(g.prefTime) : ''}</small>
    <p>${esc(g.message)}</p>
    ${g.status === 'Approved' || g.status === 'Done' ? `<p><b>Session: ${esc(fmtDate(g.schedDate))} ${esc(g.schedTime)}</b></p>` : ''}
    ${g.reply ? `<p style="color:var(--info)">↳ ${esc(g.handledBy || 'Lab head')}: ${esc(g.reply)}</p>` : ''}
    ${(g.canRespond !== undefined ? g.canRespond : headOf(g.labId)) ? `<div class="row" style="margin-top:8px">
      ${g.status === 'Pending' ? `<button class="btn sm ok" onclick="respondModal(${js(g.id)},'Approved',${js(g.prefDate)},${js(g.prefTime)})">Approve & schedule</button>
        <button class="btn sm danger" onclick="respondModal(${js(g.id)},'Declined')">Decline</button>` : ''}
      ${g.status === 'Approved' ? `<button class="btn sm ok" onclick="respond(${js(g.id)},'Done')">Mark done</button>
        <button class="btn sm" onclick="respondModal(${js(g.id)},'Approved',${js(g.schedDate)},${js(g.schedTime)})">Reschedule</button>` : ''}</div>` : ''}
  </div></div>`;
}
function respondModal(id, status, date, time) {
  openModal(`<h2>${status === 'Approved' ? 'Schedule guidance session' : 'Decline request'}</h2><div class="fgrid">
    ${status === 'Approved' ? `<label class="f"><span>Date</span><input type="date" id="rsDate" value="${esc(date || todayStr())}"></label>
      <label class="f"><span>Time</span><input type="time" id="rsTime" value="${esc(time || '10:00')}"></label>` : ''}
    <label class="f full"><span>Message to the assistant (optional)</span><textarea id="rsReply" rows="3"></textarea></label></div>
    <div class="actions"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn ${status === 'Approved' ? 'ok' : 'danger'}" onclick="respond(${js(id)},${js(status)},true)">${status === 'Approved' ? 'Approve' : 'Decline'}</button></div>`);
}
async function respond(id, status, fromModal) {
  await call('respondGuidance', id, status, fromModal ? val('rsDate') : '', fromModal ? val('rsTime') : '', fromModal ? val('rsReply') : '');
  closeModal(); toast('Request ' + status.toLowerCase()); S.cache = {};
  pollUnread(); render();
}
VIEWS.requests = function () {
  const nav = S.nav;
  $('#app').innerHTML = `<div class="page-head"><div><h1>Guidance sessions</h1><p>${isHead() ? 'Requests from your lab staff, and your own requests.' : 'Your requests for help with a machine.'}</p></div>
    <button class="btn primary" onclick="newGuidanceModal()">${ico('plus')} New request</button></div>
    <div class="seg" style="margin-bottom:12px">${['Pending', 'Approved', 'Done', 'Declined', 'All'].map(f => `<button class="${S.reqFilter === f ? 'on' : ''}" onclick="S.reqFilter='${f}';drawReq()">${f}</button>`).join('')}</div>
    <div class="card"><div id="reqList"><div class="empty">Loading…</div></div></div>`;
  call('listGuidance').then(list => { S.reqs = list; if (alive(nav)) drawReq(); }).catch(() => {});
};
function drawReq() {
  document.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.textContent === S.reqFilter));
  const l = (S.reqs || []).filter(g => S.reqFilter === 'All' || g.status === S.reqFilter);
  $('#reqList').innerHTML = l.length ? `<div class="list">${l.map(guidanceItem).join('')}</div>` : `<div class="empty">No ${S.reqFilter === 'All' ? '' : S.reqFilter.toLowerCase() + ' '}requests.</div>`;
}
function newGuidanceModal() {
  openModal(`<h2>Request a guidance session</h2><div class="fgrid">
    <label class="f full"><span>Machine</span><select id="ngM">${machineOptions(l => true, '')}</select></label>
    <label class="f"><span>Preferred date</span><input type="date" id="gDate" min="${todayStr()}"></label>
    <label class="f"><span>Preferred time</span><input type="time" id="gTime"></label>
    <label class="f full"><span>What do you need help with?</span><textarea id="gMsg" rows="3"></textarea></label></div>
    <div class="actions"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="sendGuidanceModal()">Send request</button></div>`);
}
async function sendGuidanceModal() { await call('requestGuidance', val('ngM'), val('gDate'), val('gTime'), val('gMsg')); closeModal(); toast('Request sent to the lab head'); render(); }

/* ================= My work ================= */
VIEWS.mywork = function () {
  const nav = S.nav;
  $('#app').innerHTML = `<div class="page-head"><div><h1>My work</h1><p>Samples waiting in your lab${S.user.labs.length > 1 ? 's' : ''}, your bookings and your records.</p></div>
    <button class="btn" onclick="openBookModal()">${ico('calendar')} Book a machine</button></div><div id="mw"><div class="card empty">Loading…</div></div>`;
  call('listMyWork').then(d => { if (alive(nav)) drawMyWork(d); }).catch(() => {});
};
function drawMyWork(d) {
  const overdue = d.queue.filter(q => q.overdue).length;
  S.queueRows = d.queue;
  $('#mw').innerHTML = `
    <div class="kpis">
      <div class="kpi ${d.queue.length ? 'warn' : 'ok'}"><div class="v">${d.queue.length}</div><div class="l">Samples to finish</div></div>
      <div class="kpi ${overdue ? 'bad' : ''}"><div class="v">${overdue}</div><div class="l">Overdue</div></div>
      <div class="kpi"><div class="v">${d.bookings.length}</div><div class="l">Upcoming bookings</div></div>
      <div class="kpi ok"><div class="v">${d.doneThisWeek}</div><div class="l">Records done (7 days)</div></div>
    </div>
    <div class="card"><h2>Samples to finish</h2>${queueTable(d.queue)}</div>
    <div class="card"><h2>My upcoming bookings</h2>${bookingTable(d.bookings, false)}</div>
    <div class="card"><h2>My recent records</h2>${recordTable(d.records, true)}</div>`;
}
function queueTable(q) {
  if (!q.length) return '<div class="empty">Nothing waiting. 🎉</div>';
  S.queueRows = q;
  return `<div class="tblwrap"><table class="tbl"><thead><tr><th>Sample</th><th>Lab / machine</th><th>Due</th><th>Status</th><th>Assigned</th><th></th></tr></thead><tbody>
    ${q.map((x, i) => `<tr><td><b>${esc(x.sampleId)}</b>${x.notes ? `<br><small>${esc(x.notes)}</small>` : ''}</td><td>${esc(x.lab)}<br><small>${esc(x.machine || 'Any machine')}</small></td>
      <td class="${x.overdue ? 'overdue' : ''}" style="white-space:nowrap">${x.due ? esc(fmtShort(x.due)) + (x.overdue ? ' · overdue' : '') : '–'}</td><td>${badge(x.status)}</td><td>${esc(x.assigned || '–')}</td>
      <td style="white-space:nowrap">${inLab(x.labId) ? `<button class="btn sm primary" onclick="queueRecord(${i})">Add record</button>` : ''}
        ${headOf(x.labId) ? `<button class="btn sm" onclick="assignModal(${i})">Assign</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
}
function queueRecord(i) {
  const q = S.queueRows[i];
  if (q.machineId) { location.hash = '#/machine/' + encodeURIComponent(q.machineId) + '/record/' + encodeURIComponent(q.sampleId); return; }
  openModal(`<h2>Choose the machine</h2><label class="f"><span>Machine in ${esc(q.lab)}</span><select id="qm">${machineOptions(l => l.LabID === q.labId, '')}</select></label>
    <div class="actions"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="location.hash='#/machine/'+encodeURIComponent(val('qm'))+'/record/'+encodeURIComponent(${js(q.sampleId)})">Continue</button></div>`);
}
function assignModal(i) {
  const q = S.queueRows[i];
  const staff = ((S.boot && S.boot.users) || []).filter(u => u.labs.indexOf(q.labId) >= 0 || u.role === 'Admin');
  openModal(`<h2>Sample ${esc(q.sampleId)} – ${esc(q.lab)}</h2><div class="fgrid">
    <label class="f"><span>Assigned to</span><select id="aTo"><option value="">Unassigned</option>${staff.map(u => `<option value="${esc(u.id)}" ${u.id === q.assignedTo ? 'selected' : ''}>${esc(u.name)} (${esc(u.role)})</option>`).join('')}</select></label>
    <label class="f"><span>Machine</span><select id="aM">${machineOptions(l => l.LabID === q.labId, q.machineId, 'Any machine')}</select></label>
    <label class="f"><span>Due date</span><input type="date" id="aDue" value="${esc(q.due)}"></label>
    <label class="f"><span>Status</span><select id="aSt">${['Pending', 'In progress', 'Done'].map(s => `<option ${s === q.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
    <label class="f full"><span>Notes</span><input id="aNotes" value="${esc(q.notes)}"></label></div>
    <div class="actions"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="saveAssign(${js(q.id)})">Save</button></div>`);
}
async function saveAssign(id) {
  await call('assignQueue', id, { AssignedTo: val('aTo'), MachineID: val('aM'), DueDate: val('aDue'), Status: val('aSt'), Notes: val('aNotes') });
  closeModal(); toast('Saved'); render();
}

/* ================= Calendar ================= */
VIEWS.calendar = function (labParam) {
  const t = todayStr();
  if (!S.cal) S.cal = { mode: 'month', anchor: t, sel: t, lab: myLabs().length === 1 && !isAdmin() ? myLabs()[0].LabID : '' };
  if (labParam !== undefined) S.cal.lab = labParam;
  drawCalendar();
};
function calRange() {
  const c = S.cal, a = parseYmd(c.anchor);
  if (c.mode === 'week') { const dow = (a.getDay() + 6) % 7, from = addDays(c.anchor, -dow); return [from, addDays(from, 6)]; }
  const first = new Date(a.getFullYear(), a.getMonth(), 1), dow = (first.getDay() + 6) % 7, from = addDays(ymd(first), -dow);
  return [from, addDays(from, 41)];
}
function calMove(n) {
  const c = S.cal, a = parseYmd(c.anchor);
  c.anchor = c.mode === 'week' ? addDays(c.anchor, 7 * n) : ymd(new Date(a.getFullYear(), a.getMonth() + n, 1));
  if (n === 0) { c.anchor = todayStr(); c.sel = c.anchor; }
  drawCalendar();
}
async function drawCalendar() {
  const c = S.cal, nav = S.nav, [from, to] = calRange(), a = parseYmd(c.anchor);
  const title = c.mode === 'week' ? `${fmtShort(from)} – ${fmtShort(to)} ${parseYmd(to).getFullYear()}` : a.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const key = [from, to, c.lab].join('|');
  $('#app').innerHTML = `<div class="page-head"><div><h1>Calendar</h1><p>Machine bookings, guidance sessions and sample due dates.</p></div>
    <div class="row">${myLabs().length ? `<button class="btn primary" onclick="openBookModal(S.cal.sel)">${ico('plus')} Book a machine</button>` : ''}</div></div>
    <div class="card">
      <div class="row between" style="margin-bottom:12px">
        <div class="row"><button class="btn sm" onclick="calMove(-1)">‹</button><button class="btn sm" onclick="calMove(0)">Today</button><button class="btn sm" onclick="calMove(1)">›</button><h2 style="margin:0 6px">${esc(title)}</h2></div>
        <div class="row"><select style="width:auto" onchange="S.cal.lab=this.value;drawCalendar()"><option value="">All labs</option>${labs().filter(l => l.Active).map(l => `<option value="${esc(l.LabID)}" ${l.LabID === c.lab ? 'selected' : ''}>${esc(l.Name)}</option>`).join('')}</select>
        <div class="seg"><button class="${c.mode === 'month' ? 'on' : ''}" onclick="S.cal.mode='month';drawCalendar()">Month</button><button class="${c.mode === 'week' ? 'on' : ''}" onclick="S.cal.mode='week';S.cal.anchor=S.cal.sel;drawCalendar()">Week</button></div></div>
      </div>
      <div class="legend" style="margin-bottom:10px"><span><i style="background:#1d6fb8"></i>Machine booking</span><span><i style="background:#7a3e9d"></i>Guidance session</span><span><i style="background:#c2410c"></i>Sample due</span><span><i style="background:#ffd166"></i>Mine</span></div>
      <div id="calBody"><div class="empty">Loading…</div></div></div>
    <div class="card" id="dayPanel"></div>`;
  const draw = ev => { if (!alive(nav)) return; S.calEv = ev; c.mode === 'week' ? drawWeek(from, ev) : drawMonth(from, ev); drawDay(); };
  if (S.cache['cal:' + key]) draw(S.cache['cal:' + key]);
  try { const ev = await call('getCalendar', from, to, c.lab); S.cache['cal:' + key] = ev; draw(ev); } catch (e) {}
}
const evChip = e => `<div class="ev ${e.type} ${e.mine ? 'mine' : ''}" title="${esc(e.title + ' ' + (e.start || '') + (e.end ? '–' + e.end : ''))}">${e.start ? esc(e.start) + ' ' : ''}${esc(e.title)}</div>`;
function drawMonth(from, ev) {
  const c = S.cal, month = parseYmd(c.anchor).getMonth(), t = todayStr();
  let h = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<div class="dh">${d}</div>`).join('');
  for (let i = 0; i < 42; i++) {
    const d = addDays(from, i), es = ev.filter(e => e.date === d);
    h += `<div class="d ${parseYmd(d).getMonth() !== month ? 'out' : ''} ${d === t ? 'today' : ''} ${d === c.sel ? 'sel' : ''}" onclick="S.cal.sel='${d}';document.querySelectorAll('.cal .d').forEach(x=>x.classList.remove('sel'));this.classList.add('sel');drawDay()">
      <div class="n">${parseYmd(d).getDate()}</div>${es.slice(0, 3).map(evChip).join('')}${es.length > 3 ? `<div class="more">+${es.length - 3} more</div>` : ''}</div>`;
  }
  $('#calBody').innerHTML = `<div class="cal">${h}</div>`;
}
function drawWeek(from, ev) {
  const t = todayStr();
  $('#calBody').innerHTML = `<div class="week">${[0, 1, 2, 3, 4, 5, 6].map(i => { const d = addDays(from, i), es = ev.filter(e => e.date === d);
    return `<div class="wd ${d === t ? 'today' : ''}" onclick="S.cal.sel='${d}';drawDay()" style="cursor:pointer"><h4>${esc(fmtDate(d).replace(/ \d{4}$/, ''))}</h4>${es.map(e => `${evChip(e)}<div class="hint" style="margin:-1px 0 6px">${esc(e.detail || '')}</div>`).join('') || '<small class="muted">—</small>'}</div>`; }).join('')}</div>`;
}
function drawDay() {
  const d = S.cal.sel, es = (S.calEv || []).filter(e => e.date === d);
  const p = $('#dayPanel'); if (!p) return;
  const tl = { booking: 'Booking', guidance: 'Guidance session', due: 'Sample due' };
  p.innerHTML = `<div class="row between"><h2 style="margin:0">${esc(fmtDate(d))}</h2>${myLabs().length && d >= todayStr() ? `<button class="btn sm" onclick="openBookModal(${js(d)})">${ico('plus')} Book on this day</button>` : ''}</div>
    ${es.length ? `<div class="list">${es.map(e => `<div class="item"><span class="ev ${e.type}" style="width:10px;height:38px;padding:0;flex:none"></span><div class="grow">
      <b>${e.start ? esc(e.start) + (e.end ? '–' + esc(e.end) : '') + ' · ' : ''}${esc(e.title)}</b> <small>${tl[e.type]}</small>
      <p>${esc(e.lab)}${e.detail ? ' · ' + esc(e.detail) : ''}</p></div>
      ${e.machineId ? `<a class="btn sm" href="#/machine/${encodeURIComponent(e.machineId)}">Machine</a>` : ''}
      ${e.type === 'booking' && (e.mine || headOf(e.labId)) && d >= todayStr() ? `<button class="btn sm danger" onclick="cancelBk(${js(e.id)})">Cancel</button>` : ''}</div>`).join('')}</div>`
      : '<div class="empty">Nothing on this day.</div>'}`;
}

document.addEventListener('DOMContentLoaded', start);
