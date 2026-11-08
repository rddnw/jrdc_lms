/* JRDC Lab Management System – sample tracking, dashboards and admin pages. */
'use strict';

/* ================= Samples: cross-lab search & register (heads/admins) ================= */
VIEWS.samples = function (q) {
  if (!isHead()) return VIEWS.home();
  const nav = S.nav;
  $('#app').innerHTML = `<div class="page-head"><div><h1>Sample tracking</h1><p>Search a Sample ID to see its results from every lab.</p></div>
    <button class="btn primary" onclick="sampleModal()">${ico('plus')} Register sample</button></div>
    <form class="card row" onsubmit="event.preventDefault();location.hash='#/samples/'+encodeURIComponent(val('sq').toUpperCase())">
      <input id="sq" list="sampleList" placeholder="Enter Sample ID, e.g. JRDC-2026-001" value="${esc(q || '')}" style="flex:1;min-width:200px;text-transform:uppercase">
      <button class="btn primary">${ico('search')} Search</button>${q ? `<a class="btn" href="#/samples">All samples</a>` : ''}</form>
    <div id="smp"><div class="card empty">Loading…</div></div>`;
  if (q) call('searchSample', q).then(r => { if (alive(nav)) drawSample(r); }).catch(() => { $('#smp').innerHTML = ''; });
  else call('listSamples').then(l => { S.samples = l; if (alive(nav)) drawSampleList(); }).catch(() => {});
};
function drawSample(r) {
  if (!r.found) {
    $('#smp').innerHTML = `<div class="card"><h2>No sample "${esc(r.query)}"</h2>${r.matches.length ? `<p>Did you mean:</p><div class="row">${r.matches.map(m => `<a class="btn sm" href="#/samples/${encodeURIComponent(m)}">${esc(m)}</a>`).join('')}</div>` : '<p class="muted">Check the ID and try again.</p>'}</div>`;
    return;
  }
  const s = r.sample, q = r.queue, done = q.filter(x => x.status === 'Done').length;
  S.recRows = r.records; S.queueRows = q;
  $('#smp').innerHTML = `
    <div class="card"><div class="row between"><div><h2 style="margin:0">${esc(s.id)}</h2><p class="muted" style="margin:2px 0 0">${esc(s.desc || '')}</p></div>
      <div class="row">${badge(s.status)}${s.priority && s.priority !== 'Normal' ? badge(s.priority) : ''}
      <button class="btn sm noprint" onclick='sampleModal(${js(s)})'>${ico('edit')} Edit / route</button><button class="btn sm noprint" onclick="window.print()">${ico('print')} Print</button></div></div>
      <dl class="kv">${s.source ? `<dt>Source</dt><dd>${esc(s.source)}</dd>` : ''}${s.received ? `<dt>Received</dt><dd>${esc(fmtDate(s.received))}</dd>` : ''}
        ${s.due ? `<dt>Due</dt><dd class="${s.due < todayStr() && s.status !== 'Completed' ? 'overdue' : ''}">${esc(fmtDate(s.due))}</dd>` : ''}
        <dt>Records</dt><dd>${r.records.length} in ${new Set(r.records.map(x => x.labId)).size} lab(s)</dd>${s.notes ? `<dt>Notes</dt><dd>${esc(s.notes)}</dd>` : ''}</dl>
      ${q.length ? `<div class="row"><div class="prog" style="flex:1"><div style="width:${Math.round(done / q.length * 100)}%"></div></div><small>${done}/${q.length} lab steps done</small></div>` : ''}</div>
    ${q.length ? `<div class="card"><h3>Route through labs</h3>${queueTable(q)}</div>` : ''}
    <div class="card"><h3>Results timeline (all labs)</h3>${r.records.length ? `<div class="tl">${r.records.map((x, i) => `
      <div class="t st-${esc(x.status)}"><div class="h">${esc(fmtTs(x.ts))} · <b>${esc(x.lab)}</b> · ${esc(x.machine)} · ${esc(x.user)} ${badge(x.status)}</div>
        <div><b>${esc(x.test || 'Record')}</b>${x.params ? ` <small>(${esc(x.params)})</small>` : ''}</div>
        <div class="res">${esc(x.result || '—')}</div>
        <div class="row" style="margin-top:4px">${linkBtn(x.file, 'Result file')}<button class="btn sm noprint" onclick="openRecord(${i})">Details</button></div></div>`).join('')}</div>`
      : '<div class="empty">No results recorded yet.</div>'}</div>
    ${r.bookings.length ? `<div class="card"><h3>Bookings for this sample</h3>${bookingTable(r.bookings, false)}</div>` : ''}`;
}
function drawSampleList() {
  const f = S.smpFilter, q = (val('sfilter') || '').toLowerCase();
  const l = (S.samples || []).filter(s => (f === 'All' || (f === 'Overdue' ? s.overdue : s.status === f)) &&
    (!q || [s.id, s.desc, s.source, s.labs.join(' ')].join(' ').toLowerCase().indexOf(q) >= 0));
  const html = `<div class="card"><div class="row between" style="margin-bottom:10px">
      <div class="seg">${['All', 'Received', 'In progress', 'Completed', 'Overdue'].map(x => `<button class="${x === f ? 'on' : ''}" onclick="S.smpFilter='${x}';drawSampleList()">${x}</button>`).join('')}</div>
      <input id="sfilter" placeholder="Filter…" style="max-width:240px" value="${esc(q)}" oninput="drawSampleList()"></div>
    ${l.length ? `<div class="tblwrap"><table class="tbl"><thead><tr><th>Sample</th><th>Labs</th><th>Due</th><th>Progress</th><th>Status</th></tr></thead><tbody>
      ${l.map(s => `<tr class="click" onclick="location.hash='#/samples/'+encodeURIComponent(${js(s.id)})"><td><b>${esc(s.id)}</b><br><small>${esc(s.desc)}</small></td>
        <td><small>${esc(s.labs.join(', ') || '–')}</small></td><td class="${s.overdue ? 'overdue' : ''}" style="white-space:nowrap">${s.due ? esc(fmtShort(s.due)) : '–'}</td>
        <td>${s.total ? `<div class="prog"><div style="width:${Math.round(s.done / s.total * 100)}%"></div></div><small>${s.done}/${s.total} steps · ${s.records} records</small>` : `<small>${s.records} records</small>`}</td>
        <td>${badge(s.status)}${s.priority !== 'Normal' ? ' ' + badge(s.priority) : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No samples.</div>'}</div>`;
  const had = document.activeElement && document.activeElement.id === 'sfilter';
  $('#smp').innerHTML = html;
  if (had) { const e = $('#sfilter'); e.focus(); e.setSelectionRange(e.value.length, e.value.length); }
}
function sampleModal(s) {
  s = s || {};
  openModal(`<h2>${s.id ? 'Edit sample ' + esc(s.id) : 'Register a sample'}</h2>
    <div class="fgrid">
      <label class="f"><span>Sample ID *</span><input id="sId" value="${esc(s.id || '')}" ${s.id ? 'disabled' : ''} style="text-transform:uppercase" placeholder="Used in every lab"></label>
      <label class="f"><span>Description</span><input id="sDesc" value="${esc(s.desc || '')}"></label>
      <label class="f"><span>Source / client</span><input id="sSrc" value="${esc(s.source || '')}"></label>
      <label class="f"><span>Priority</span><select id="sPri">${['Low', 'Normal', 'High', 'Urgent'].map(p => `<option ${p === (s.priority || 'Normal') ? 'selected' : ''}>${p}</option>`).join('')}</select></label>
      <label class="f"><span>Received</span><input type="date" id="sRec" value="${esc(s.received || todayStr())}"></label>
      <label class="f"><span>Due date</span><input type="date" id="sDue" value="${esc(s.due || '')}"></label>
      <label class="f full"><span>Notes</span><input id="sNotes" value="${esc(s.notes || '')}"></label>
    </div>
    <div class="f"><span>Send to labs / machines <small>(adds it to their "to finish" list)</small></span>
      ${labs().filter(l => l.Active).map(l => `<div style="margin:8px 0"><b style="font-size:13px">${esc(l.Name)}</b><div class="checks">
        <label><input type="checkbox" class="rt" data-l="${esc(l.LabID)}" data-m=""> Any machine</label>
        ${machines().filter(m => m.LabID === l.LabID && m.Active).map(m => `<label><input type="checkbox" class="rt" data-l="${esc(l.LabID)}" data-m="${esc(m.MachineID)}"> ${esc(m.Name)}</label>`).join('')}</div></div>`).join('')}</div>
    <div class="actions"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="saveSampleModal()">Save</button></div>`, true);
}
async function saveSampleModal() {
  const route = [...document.querySelectorAll('.rt:checked')].map(c => ({ LabID: c.dataset.l, MachineID: c.dataset.m }));
  const r = await call('saveSample', { SampleID: val('sId'), Description: val('sDesc'), Source: val('sSrc'), Priority: val('sPri'),
    ReceivedDate: val('sRec'), DueDate: val('sDue'), Notes: val('sNotes') }, route);
  closeModal(); toast('Sample saved');
  if (!S.boot.samples.some(x => x.id === r.id)) { S.boot.samples.push({ id: r.id, d: r.desc }); setBoot(S.boot); }
  const h = '#/samples/' + encodeURIComponent(r.id);
  if (location.hash === h) render(); else location.hash = h;
}

/* ================= Dashboard (heads & admins) ================= */
VIEWS.dashboard = function (labParam) {
  if (!isHead()) return VIEWS.home();
  const own = isAdmin() ? labs().filter(l => l.Active) : myLabs();
  if (!S.dash) S.dash = { lab: isAdmin() || own.length !== 1 ? '' : own[0].LabID, period: '30', from: '', to: '' };
  if (labParam !== undefined) S.dash.lab = labParam;
  drawDashShell(own);
};
function dashRange() {
  const d = S.dash, t = todayStr();
  if (d.period === 'custom') return [d.from || addDays(t, -29), d.to || t];
  return [addDays(t, -(Number(d.period) - 1)), t];
}
async function drawDashShell(own) {
  const d = S.dash, nav = S.nav, [from, to] = dashRange();
  own = own || (isAdmin() ? labs().filter(l => l.Active) : myLabs());
  $('#app').innerHTML = `<div class="page-head"><div><h1>${d.lab ? esc((labById(d.lab) || {}).Name || 'Lab') + ' dashboard' : (isAdmin() ? 'All labs – monitoring' : 'My labs dashboard')}</h1>
      <p>${esc(fmtDate(from))} – ${esc(fmtDate(to))}</p></div>
    <div class="row noprint"><button class="btn" onclick="exportDash()">${ico('download')} Export CSV</button><button class="btn" onclick="window.print()">${ico('print')} Print</button></div></div>
    <div class="card row noprint">
      <select style="width:auto" onchange="S.dash.lab=this.value;drawDashShell()">${own.length > 1 || isAdmin() ? `<option value="">${isAdmin() ? 'All labs' : 'All my labs'}</option>` : ''}${own.map(l => `<option value="${esc(l.LabID)}" ${l.LabID === d.lab ? 'selected' : ''}>${esc(l.Name)}</option>`).join('')}</select>
      <div class="seg">${[['7', '7 days'], ['30', '30 days'], ['90', '90 days'], ['custom', 'Custom']].map(([k, l]) => `<button class="${d.period === k ? 'on' : ''}" onclick="S.dash.period='${k}';drawDashShell()">${l}</button>`).join('')}</div>
      ${d.period === 'custom' ? `<input type="date" style="width:auto" value="${from}" onchange="S.dash.from=this.value;drawDashShell()"> – <input type="date" style="width:auto" value="${to}" onchange="S.dash.to=this.value;drawDashShell()">` : ''}
    </div><div id="dash"><div class="card empty">Loading…</div></div>`;
  const key = 'dash:' + [d.lab, from, to].join('|');
  if (S.cache[key]) drawDash(S.cache[key]);
  try { const r = await call('getDashboard', d.lab, from, to); S.cache[key] = r; if (alive(nav)) drawDash(r); } catch (e) {}
}
function bars(rows, valKey, label, altKey) {
  if (!rows.length) return '<div class="empty">No data in this period.</div>';
  const max = Math.max(1, ...rows.map(r => r[valKey]));
  return `<div class="bars">${rows.map(r => `<div class="b"><span class="n" title="${esc(r.name)}">${esc(r.name)}</span>
    <div class="track"><div class="fill" style="width:${r[valKey] / max * 100}%"></div></div><span class="val">${r[valKey]}${label}${altKey && r[altKey] ? ` <small>· ${r[altKey]}h</small>` : ''}</span></div>`).join('')}</div>`;
}
function drawDash(r) {
  const k = r.kpi, max = Math.max(1, ...r.days.map(x => x.count));
  const kp = (v, l, cls) => `<div class="kpi ${cls || ''}"><div class="v">${v}</div><div class="l">${l}</div></div>`;
  S.queueRows = r.queue; S.recRows = r.recent;
  $('#dash').innerHTML = `
    <div class="kpis">
      ${kp(k.records, 'Records')}${kp(k.done, 'Finished tests', 'ok')}${kp(k.samples, 'Samples handled')}
      ${kp(k.pending, 'Still to finish', k.pending ? 'warn' : '')}${kp(k.overdue, 'Overdue', k.overdue ? 'bad' : '')}${kp(k.dueSoon, 'Due in 3 days', k.dueSoon ? 'warn' : '')}
      ${kp(k.hours + ' h', 'Machine run time')}${kp(k.booked + ' h', 'Booked time')}
      ${kp(k.guidancePending, 'Guidance waiting', k.guidancePending ? 'warn' : '')}${kp(k.machinesDown + '/' + k.machines, 'Machines down', k.machinesDown ? 'bad' : '')}
      ${k.failed ? kp(k.failed, 'Failed tests', 'bad') : ''}
      ${k.bugsOpen !== undefined ? kp(k.bugsOpen, 'Open problem reports', k.bugsOpen ? 'bad' : '') + kp(k.users, 'Active users') + kp(r.logins, 'Logins in period') : ''}
    </div>
    ${r.byLab ? `<div class="card"><h3>Labs</h3><div class="tblwrap"><table class="tbl"><thead><tr><th>Lab</th><th class="num">Records</th><th class="num">Finished</th><th class="num">To finish</th><th class="num">Overdue</th><th class="num">Run time</th><th class="num">Machines down</th></tr></thead><tbody>
      ${r.byLab.map(l => `<tr class="click" onclick="S.dash.lab=${js(l.id)};drawDashShell()"><td><b>${esc(l.name)}</b></td><td class="num">${l.records}</td><td class="num">${l.done}</td><td class="num">${l.pending}</td>
        <td class="num ${l.overdue ? 'overdue' : ''}">${l.overdue}</td><td class="num">${l.hours} h</td><td class="num ${l.down ? 'overdue' : ''}">${l.down}/${l.machines}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
    <div class="card"><h3>Records per day</h3><div class="cols">${r.days.map(x => `<div class="c" style="height:${x.count / max * 100}%" title="${esc(fmtShort(x.date))}: ${x.count}"></div>`).join('')}</div>
      <div class="cols-x"><span>${esc(fmtShort(r.from))}</span><span>${esc(fmtShort(r.to))}</span></div></div>
    <div class="grid g2">
      <div class="card"><h3>Usage by machine</h3>${bars(r.byMachine, 'records', ' rec', 'hours')}</div>
      <div class="card"><h3>Work by person</h3>${bars(r.byUser, 'records', ' rec', 'hours')}</div>
    </div>
    <div class="card"><h3>Machines</h3><div class="tblwrap"><table class="tbl"><thead><tr><th>Machine</th>${r.byLab ? '<th>Lab</th>' : ''}<th>Status</th><th class="num">Records</th><th class="num">Run time</th><th class="num">Booked</th><th class="num">Waiting</th></tr></thead><tbody>
      ${r.byMachine.map(m => `<tr class="click" onclick="location.hash='#/machine/'+encodeURIComponent(${js(m.id)})"><td><b>${esc(m.name)}</b></td>${r.byLab ? `<td>${esc(m.lab)}</td>` : ''}
        <td>${badge(m.status)}${m.note ? `<br><small>${esc(m.note)}</small>` : ''}</td><td class="num">${m.records}</td><td class="num">${m.hours} h</td><td class="num">${m.booked} h</td><td class="num">${m.pending}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="card"><h3>Samples still to finish (${r.queue.length})</h3>${queueTable(r.queue)}</div>
    <div class="card"><h3>Latest records</h3>${recordTable(r.recent, true)}</div>`;
}
async function exportDash() {
  const [from, to] = dashRange();
  const csv = await call('exportCsv', S.dash.lab, from, to);
  download(`records_${S.dash.lab || 'all'}_${from}_${to}.csv`, csv);
}

/* ================= Admin ================= */
const ADMIN_TABS = [['labs', 'Labs'], ['machines', 'Machines'], ['users', 'Users'], ['branding', 'Layout & branding'], ['bugs', 'Problem reports'], ['audit', 'Activity log']];
VIEWS.admin = function (sub) {
  if (!isAdmin()) return VIEWS.home();
  sub = ADMIN_TABS.some(t => t[0] === sub) ? sub : 'labs';
  $('#app').innerHTML = `<div class="page-head"><div><h1>Administration</h1><p>Manage labs, machines, staff, layout and monitor the system.</p></div></div>
    <div class="subtabs">${ADMIN_TABS.map(([k, l]) => `<button class="${k === sub ? 'on' : ''}" onclick="location.hash='#/admin/${k}'">${l}</button>`).join('')}</div><div id="adm"></div>`;
  ADMIN[sub]();
};
const ADMIN = {};

ADMIN.labs = function () {
  const ls = labs();
  $('#adm').innerHTML = `<div class="card"><div class="row between" style="margin-bottom:10px"><h2 style="margin:0">Labs (${ls.length})</h2><button class="btn primary" onclick="editLab()">${ico('plus')} Add lab</button></div>
    <div class="tblwrap"><table class="tbl"><thead><tr><th></th><th>Lab</th><th>Code</th><th>Head</th><th class="num">Machines</th><th class="num">Order</th><th>Visible</th><th></th></tr></thead><tbody>
    ${ls.map(l => `<tr><td><span class="thumb" style="background:${labColor(l)};width:28px;height:28px"></span></td><td><b>${esc(l.Name)}</b><br><small>${esc(l.LabID)}</small></td><td>${esc(l.Code)}</td>
      <td>${esc(userName(l.HeadUserID) || '–')}</td><td class="num">${machines().filter(m => m.LabID === l.LabID && m.Active).length}</td><td class="num">${esc(l.Order)}</td>
      <td>${l.Active ? badge('Yes') : '<span class="badge b-bad">Hidden</span>'}</td>
      <td style="white-space:nowrap"><button class="btn sm" onclick="editLab(${js(l.LabID)})">${ico('edit')} Edit</button> <a class="btn sm" href="#/lab/${encodeURIComponent(l.LabID)}">Open</a></td></tr>`).join('')}</tbody></table></div></div>`;
};
function editLab(id) {
  const l = id ? labById(id) : { Color: validColor(S.boot.settings.ThemeColor) || '#0b5d7a', Active: true, Order: String(labs().length + 1) };
  const heads = S.boot.users.filter(u => u.role === 'Head' || u.role === 'Admin');
  openModal(`<h2>${id ? 'Edit lab' : 'Add a lab'}</h2><div class="fgrid">
    <label class="f"><span>Lab name *</span><input id="lName" value="${esc(l.Name || '')}"></label>
    <label class="f"><span>Short code</span><input id="lCode" value="${esc(l.Code || '')}" placeholder="e.g. L1, MCL"></label>
    <label class="f full"><span>Description</span><textarea id="lDesc" rows="2">${esc(l.Description || '')}</textarea></label>
    <label class="f"><span>Lab head</span><select id="lHead"><option value="">—</option>${heads.map(u => `<option value="${esc(u.id)}" ${u.id === l.HeadUserID ? 'selected' : ''}>${esc(u.name)} (${esc(u.role)})</option>`).join('')}</select>
      <div class="hint">Gets guidance requests by email. Add the person first in Users with role "Head".</div></label>
    <label class="f"><span>Colour</span><input type="color" id="lColor" value="${esc(validColor(l.Color) || '#0b5d7a')}"></label>
    <label class="f"><span>Order on the home page</span><input type="number" id="lOrder" value="${esc(l.Order || '')}" min="1"></label>
    <label class="f"><span>Visible</span><select id="lActive"><option value="1">Yes</option><option value="0" ${l.Active === false ? 'selected' : ''}>No (hidden)</option></select></label>
    <div class="full">${uploadField('lCover', 'Cover image', 'image', l.CoverImage, 'image/*', 'Shown on the lab card. Landscape photo works best.')}</div></div>
    <div class="actions"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="saveLabModal(${js(id || '')})">Save</button></div>`);
}
async function saveLabModal(id) {
  await call('saveLab', { LabID: id, Name: val('lName'), Code: val('lCode'), Description: val('lDesc'), HeadUserID: val('lHead'),
    Color: val('lColor'), Order: val('lOrder'), Active: val('lActive') === '1', CoverImage: val('lCover') });
  closeModal(); toast('Lab saved'); await refreshBoot(); render();
}

ADMIN.machines = function () {
  const f = S.admLab;
  const ms = machines().filter(m => !f || m.LabID === f);
  $('#adm').innerHTML = `<div class="card"><div class="row between" style="margin-bottom:10px">
      <div class="row"><h2 style="margin:0">Machines</h2><select style="width:auto" onchange="S.admLab=this.value;ADMIN.machines()"><option value="">All labs</option>${labs().map(l => `<option value="${esc(l.LabID)}" ${l.LabID === f ? 'selected' : ''}>${esc(l.Name)}</option>`).join('')}</select></div>
      <button class="btn primary" onclick="editMachine('', S.admLab)">${ico('plus')} Add machine</button></div>
    <div class="tblwrap"><table class="tbl"><thead><tr><th></th><th>Machine</th><th>Lab</th><th>Status</th><th>Media</th><th class="num">Order</th><th></th></tr></thead><tbody>
    ${ms.map(m => `<tr style="${m.Active ? '' : 'opacity:.55'}"><td>${thumb(m)}</td><td><b>${esc(m.Name)}</b><br><small>${esc([m.Maker, m.Model].filter(Boolean).join(' · '))}</small></td>
      <td>${esc((labById(m.LabID) || {}).Name || m.LabID)}</td><td>${m.Active ? badge(m.Status || 'Available') : '<span class="badge b-bad">Removed</span>'}</td>
      <td><small>${[m.Image ? 'Photo' : '', m.VideoURL ? 'Video' : '', m.ManualURL ? 'Manual' : ''].filter(Boolean).join(' · ') || '<span class="overdue">none</span>'}</small></td>
      <td class="num">${esc(m.Order)}</td>
      <td style="white-space:nowrap"><button class="btn sm" onclick="editMachine(${js(m.MachineID)})">${ico('edit')} Edit</button>
        ${m.Active ? `<button class="btn sm danger" onclick="removeMachine(${js(m.MachineID)})">Remove</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">No machines.</td></tr>'}</tbody></table></div></div>`;
};
function editMachine(id, labId) {
  const m = id ? machineById(id) : { LabID: labId || (labs()[0] || {}).LabID, Status: 'Available', Active: true };
  const ls = labs().filter(l => headOf(l.LabID));
  openModal(`<h2>${id ? 'Edit machine' : 'Add a machine'}</h2><div class="fgrid">
    <label class="f"><span>Lab *</span><select id="mLab">${ls.map(l => `<option value="${esc(l.LabID)}" ${l.LabID === m.LabID ? 'selected' : ''}>${esc(l.Name)}</option>`).join('')}</select></label>
    <label class="f"><span>Machine name *</span><input id="mName" value="${esc(m.Name || '')}"></label>
    <label class="f"><span>Maker / brand</span><input id="mMaker" value="${esc(m.Maker || '')}"></label>
    <label class="f"><span>Model</span><input id="mModel" value="${esc(m.Model || '')}"></label>
    <label class="f"><span>Type / category</span><input id="mCat" value="${esc(m.Category || '')}"></label>
    <label class="f"><span>Order in the lab</span><input type="number" id="mOrder" value="${esc(m.Order || '')}" min="1"></label>
    <label class="f full"><span>Description</span><textarea id="mDesc" rows="3">${esc(m.Description || '')}</textarea></label>
    <label class="f"><span>Status</span><select id="mStatus">${MSTATUS.map(s => `<option ${s === (m.Status || 'Available') ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
    <label class="f"><span>Status note</span><input id="mNote" value="${esc(m.StatusNote || '')}"></label>
    <div class="full">${uploadField('mImg', 'Machine photo (used as the button)', 'image', m.Image, 'image/*', 'A clear photo of the machine. Square or 4:3 works best.')}</div>
    <div class="full">${uploadField('mVideo', 'Training video', 'video', m.VideoURL, 'video/*', 'Best: a YouTube link (can be "Unlisted"). Small videos (&lt; 30 MB) can be uploaded to Drive.')}</div>
    <div class="full">${uploadField('mManual', 'User manual (PDF)', 'manual', m.ManualURL, 'application/pdf,.pdf,.doc,.docx', 'Shown inside the machine page.')}</div>
    ${isAdmin() ? `<label class="f"><span>Visible</span><select id="mActive"><option value="1">Yes</option><option value="0" ${m.Active === false ? 'selected' : ''}>No (removed)</option></select></label>` : ''}
    </div><div class="actions"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="saveMachineModal(${js(id || '')})">Save</button></div>`, true);
}
async function saveMachineModal(id) {
  const m = await call('saveMachine', { MachineID: id, LabID: val('mLab'), Name: val('mName'), Maker: val('mMaker'), Model: val('mModel'),
    Category: val('mCat'), Order: val('mOrder'), Description: val('mDesc'), Status: val('mStatus'), StatusNote: val('mNote'),
    Image: val('mImg'), VideoURL: val('mVideo'), ManualURL: val('mManual'), Active: $('#mActive') ? val('mActive') === '1' : true });
  closeModal(); toast('Machine saved'); delete S.cache['m:' + m.MachineID]; await refreshBoot(); render();
}
async function removeMachine(id) {
  if (!confirm('Remove this machine? It will be hidden; its records are kept.')) return;
  await call('deleteMachine', id); toast('Machine removed'); await refreshBoot(); render();
}

ADMIN.users = async function () {
  const nav = S.nav;
  $('#adm').innerHTML = '<div class="card empty">Loading…</div>';
  const us = await call('listUsers'); if (!alive(nav)) return;
  S.admUsers = us;
  const ln = ids => ids.map(id => (labById(id) || {}).Name || id).join(', ');
  $('#adm').innerHTML = `<div class="card"><div class="row between" style="margin-bottom:10px"><h2 style="margin:0">Users (${us.filter(u => u.Active).length} active)</h2>
      <div class="row"><input id="uf" placeholder="Filter…" style="width:180px" oninput="document.querySelectorAll('#ut tr').forEach(r=>r.style.display=r.textContent.toLowerCase().includes(this.value.toLowerCase())?'':'none')">
      <button class="btn primary" onclick="editUser()">${ico('plus')} Add user</button></div></div>
    <div class="note">Roles: <b>Assistant</b> – adds records, books machines, requests guidance in their labs. <b>Head</b> – also manages the lab, answers guidance requests, assigns samples, sees dashboards and searches samples in all labs. <b>Admin</b> – everything.</div>
    <div class="tblwrap"><table class="tbl"><thead><tr><th>User ID</th><th>Name</th><th>Role</th><th>Labs</th><th>Contact</th><th>Active</th><th></th></tr></thead><tbody id="ut">
    ${us.map((u, i) => `<tr style="${u.Active ? '' : 'opacity:.55'}"><td><b>${esc(u.UserID)}</b></td><td>${esc(u.Name)}</td><td>${badge(u.Role)}</td><td><small>${esc(u.Role === 'Admin' ? 'All' : ln(u.LabIDs) || '–')}</small></td>
      <td><small>${esc(u.Email)}${u.Phone ? '<br>' + esc(u.Phone) : ''}</small></td><td>${u.Active ? 'Yes' : 'No'}</td>
      <td><button class="btn sm" onclick="editUser(${i})">${ico('edit')} Edit</button></td></tr>`).join('')}</tbody></table></div></div>`;
};
function editUser(i) {
  const u = i === undefined ? { Role: 'Assistant', LabIDs: S.admLab ? [S.admLab] : [], Active: true } : S.admUsers[i];
  const isNew = i === undefined;
  openModal(`<h2>${isNew ? 'Add a user' : 'Edit ' + esc(u.Name)}</h2><div class="fgrid">
    <label class="f"><span>User ID * <small>(used to log in)</small></span><input id="uId" value="${esc(u.UserID || '')}" ${isNew ? '' : 'disabled'} style="text-transform:uppercase" placeholder="e.g. NIMESHA or JRDC012"></label>
    <label class="f"><span>Full name *</span><input id="uName" value="${esc(u.Name || '')}"></label>
    <label class="f"><span>Role</span><select id="uRole">${['Assistant', 'Head', 'Admin'].map(r => `<option ${r === u.Role ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
    <label class="f"><span>${isNew ? 'PIN * (4–6 digits)' : 'New PIN (leave empty to keep)'}</span><input id="uPin" inputmode="numeric" autocomplete="off"></label>
    <label class="f"><span>Email <small>(for alerts)</small></span><input id="uEmail" type="email" value="${esc(u.Email || '')}"></label>
    <label class="f"><span>Phone</span><input id="uPhone" value="${esc(u.Phone || '')}"></label>
    <div class="f full"><span>Labs</span><div class="checks">${labs().map(l => `<label><input type="checkbox" class="ul" value="${esc(l.LabID)}" ${u.LabIDs.indexOf(l.LabID) >= 0 ? 'checked' : ''}> ${esc(l.Name)}</label>`).join('')}</div></div>
    <label class="f"><span>Active</span><select id="uActive"><option value="1">Yes</option><option value="0" ${u.Active === false ? 'selected' : ''}>No (cannot log in)</option></select></label></div>
    <div class="actions"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="saveUserModal(${isNew})">Save</button></div>`);
}
async function saveUserModal(isNew) {
  await call('saveUser', { UserID: val('uId'), Name: val('uName'), Role: val('uRole'), PIN: val('uPin'), Email: val('uEmail'), Phone: val('uPhone'),
    LabIDs: [...document.querySelectorAll('.ul:checked')].map(c => c.value), Active: val('uActive') === '1' }, isNew);
  closeModal(); toast('User saved'); await refreshBoot(); render();
}

ADMIN.branding = function () {
  const s = S.boot.settings;
  $('#adm').innerHTML = `<div class="card"><h2>Layout & branding</h2><div class="fgrid">
    <label class="f"><span>Short name (top bar)</span><input id="stName" value="${esc(s.InstituteName)}"></label>
    <label class="f"><span>Full institute name</span><input id="stFull" value="${esc(s.InstituteFull)}"></label>
    <label class="f"><span>Subtitle</span><input id="stSub" value="${esc(s.Subtitle)}"></label>
    <label class="f"><span>System title</span><input id="stTitle" value="${esc(s.AppTitle)}"></label>
    <label class="f"><span>Theme colour</span><input type="color" id="stColor" value="${esc(validColor(s.ThemeColor) || '#0b5d7a')}" oninput="applyBrand(Object.assign({},S.boot.settings,{ThemeColor:this.value}))"></label>
    <label class="f"><span>Email alerts</span><select id="stEmail"><option value="TRUE">On</option><option value="FALSE" ${String(s.EmailOn).toUpperCase() === 'FALSE' ? 'selected' : ''}>Off</option></select><div class="hint">Gmail allows about 100 emails a day.</div></label>
    <label class="f full"><span>Welcome text on the home page</span><input id="stBanner" value="${esc(s.BannerText)}"></label>
    <label class="f full"><span>App link (used in emails)</span><input id="stLink" value="${esc(s.AppLink)}" placeholder="https://your-name.github.io/"></label>
    <div>${uploadField('stLogo', 'Logo', 'branding', s.Logo, 'image/*', 'Square image, shown in the top bar and on the login page.')}</div>
    <div>${uploadField('stBannerImg', 'Home page banner image', 'branding', s.BannerImage, 'image/*', 'Wide photo of the institute or labs.')}</div>
    </div><div class="actions" style="justify-content:flex-start"><button class="btn primary" onclick="saveBranding()">Save</button></div></div>
    <div class="card"><h3>Order of labs and machines</h3><p class="muted">Change the "Order" number in Labs and Machines to arrange the home page and each lab page. Lab colour and cover photo are set per lab.</p></div>`;
};
async function saveBranding() {
  const s = await call('saveSettings', { InstituteName: val('stName'), InstituteFull: val('stFull'), Subtitle: val('stSub'), AppTitle: val('stTitle'),
    ThemeColor: val('stColor'), EmailOn: val('stEmail'), BannerText: val('stBanner'), AppLink: val('stLink'), Logo: val('stLogo'), BannerImage: val('stBannerImg') });
  S.boot.settings = s; store(K_BOOT, S.boot); store(K_PUB, s); applyBrand(s); updateChrome(); toast('Saved');
}

ADMIN.bugs = async function () {
  const nav = S.nav;
  $('#adm').innerHTML = '<div class="card empty">Loading…</div>';
  const bs = await call('listBugs'); if (!alive(nav)) return;
  $('#adm').innerHTML = `<div class="card"><h2>Problem reports & suggestions</h2>${bs.length ? `<div class="list">${bs.map(b => `<div class="item"><div class="grow">
    <div class="row between"><b>${esc(b.user)}</b>${badge(b.status)}</div><small>${esc(fmtTs(b.ts))} · page ${esc(b.page)}</small><p>${esc(b.desc)}</p>
    <div class="row" style="margin-top:8px"><select style="width:auto" id="bs_${esc(b.id)}">${['Open', 'In progress', 'Fixed', 'Closed'].map(s => `<option ${s === b.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <input id="bn_${esc(b.id)}" value="${esc(b.note)}" placeholder="Note to the reporter" style="flex:1;min-width:160px"><button class="btn sm primary" onclick="saveBug(${js(b.id)})">Save</button></div></div></div>`).join('')}</div>`
    : '<div class="empty">No reports. 🎉</div>'}</div>`;
};
async function saveBug(id) { await call('updateBug', id, val('bs_' + id), val('bn_' + id)); toast('Saved'); ADMIN.bugs(); }

ADMIN.audit = async function () {
  const nav = S.nav;
  $('#adm').innerHTML = '<div class="card empty">Loading…</div>';
  const a = await call('listAudit', 1000); if (!alive(nav)) return;
  $('#adm').innerHTML = `<div class="card"><div class="row between" style="margin-bottom:10px"><h2 style="margin:0">Activity log</h2>
    <div class="row"><input placeholder="Filter (name, action, sample…)" style="width:240px" oninput="document.querySelectorAll('#at tr').forEach(r=>r.style.display=r.textContent.toLowerCase().includes(this.value.toLowerCase())?'':'none')">
    <button class="btn" onclick="exportAudit()">${ico('download')} CSV</button></div></div>
    <div class="tblwrap"><table class="tbl"><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Details</th></tr></thead><tbody id="at">
    ${a.map(x => `<tr><td style="white-space:nowrap">${esc(x.ts)}</td><td>${esc(x.user)}</td><td><b>${esc(x.action)}</b></td><td><small>${esc(x.details)}</small></td></tr>`).join('')}</tbody></table></div></div>`;
  S.audit = a;
};
function exportAudit() {
  const q = v => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
  download('activity_log.csv', '﻿' + ['Time,User,Action,Details'].concat((S.audit || []).map(x => [x.ts, x.user, x.action, x.details].map(q).join(','))).join('\r\n'));
}
