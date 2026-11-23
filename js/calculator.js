(function () {
  'use strict';

  const { CONFIG, compute, formatPeso, billToDailyKwh, dailyKwhToBill } = window.TruSolar;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const STORAGE_KEY = 'trusolar_proposal';
  const TOTAL_STEPS = 5;

  /* ── State ─────────────────────────────────────────────────────── */
  const state = {
    step: 1,
    type: null,        // residential | commercial
    bill: null,        // PHP per month
    dailyKwh: null,
    project: null,     // Roof | Ground | Canopy
    roofType: null,    // Metal | Shingles | Tiles | Flatroof
    address: '',
    graphMode: 'day',
    inputMode: 'bill', // bill | kwh
    batteryKwh: 0,
    panels: null,      // null = recommended
    customKey: null,
  };

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function wireCustomize() {
    const pIn = $('#panelsInput'), bIn = $('#batteryInput');
    const setPanels = (v) => { if (Number.isFinite(v)) { state.panels = clamp(Math.round(v), 1, 200); buildProposal(); } };
    const setBattery = (v) => { if (Number.isFinite(v)) { state.batteryKwh = clamp(Math.round(v * 2) / 2, 0, 60); buildProposal(); } };
    $('#panelsMinus').addEventListener('click', () => setPanels(Number(pIn.value) - 1));
    $('#panelsPlus').addEventListener('click', () => setPanels(Number(pIn.value) + 1));
    pIn.addEventListener('change', () => setPanels(Number(pIn.value)));
    $('#batteryMinus').addEventListener('click', () => setBattery(Number(bIn.value) - 0.5));
    $('#batteryPlus').addEventListener('click', () => setBattery(Number(bIn.value) + 0.5));
    bIn.addEventListener('change', () => setBattery(Number(bIn.value)));
    $('#customReset').addEventListener('click', () => { state.panels = null; state.batteryKwh = 0; buildProposal(); });
  }
  document.addEventListener('DOMContentLoaded', wireCustomize);

  /* ── Elements ──────────────────────────────────────────────────── */
  const el = {
    back: $('#btnBack'), next: $('#btnNext'), book: $('#btnBook'),
    progress: $('#progressHeader'), progressBar: $('#progressBar'), progressFill: $('#progressFill'),
    stepLabel: $('#stepLabel'), pctLabel: $('#pctLabel'), topbar: $('#proposalTopbar'),
    bill: $('#billInput'), kwh: $('#kwhInput'), addr: $('#addrInput'),
    billErr: $('#billErr'), kwhErr: $('#kwhErr'),
    modal: $('#roofModal'), roofConfirm: $('#roofConfirm'), roofHint: $('#roofHint'), roofImg: $('#modalRoofImg'),
    roofSummary: $('#roofSummary'), canvas: $('#usageChart'),
  };

  function canProceed() {
    switch (state.step) {
      case 1: return !!state.type;
      case 2: return !!(state.bill || state.dailyKwh);
      case 3: return !!state.project && (state.project !== 'Roof' || !!state.roofType);
      case 4: return state.address.trim().length > 3;
      default: return true;
    }
  }

  /* ── Rendering ─────────────────────────────────────────────────── */
  function render({ moveFocus = true } = {}) {
    for (let i = 1; i <= TOTAL_STEPS; i++) {
      $('#step' + i).hidden = i !== state.step;
      $('#vis' + i).classList.toggle('is-active', i === state.step);
    }

    const pct = Math.round((state.step / TOTAL_STEPS) * 100);
    el.progress.hidden = !(state.step > 1 && state.step < TOTAL_STEPS);
    el.stepLabel.textContent = `Step ${state.step} of ${TOTAL_STEPS}`;
    el.pctLabel.textContent = pct + '%';
    el.progressFill.style.width = pct + '%';
    el.progressBar.setAttribute('aria-valuenow', String(pct));
    el.topbar.hidden = state.step !== TOTAL_STEPS;

    const final = state.step === TOTAL_STEPS;
    el.back.hidden = state.step === 1;
    el.next.hidden = final;
    el.book.hidden = !final;
    el.next.disabled = !canProceed();

    if (moveFocus) {
      const heading = $(`#step${state.step} .w-title`);
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: false }); }
    }
    if (state.step === 2) drawGraph();
  }

  /* ── Navigation ────────────────────────────────────────────────── */
  function goNext() {
    if (!canProceed()) {
      if (state.step === 3 && state.project === 'Roof' && !state.roofType) openRoofModal();
      return;
    }
    if (state.step >= TOTAL_STEPS) return;
    state.step += 1;
    if (state.step === TOTAL_STEPS) buildProposal();
    render();
  }

  function goBack() {
    if (state.step > 1) { state.step -= 1; render(); }
  }

  /* ── Generic single-choice button groups ───────────────────────── */
  function choose(buttons, active) {
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === active)));
  }

  /* Step 1 */
  $$('[data-type]').forEach((btn) => btn.addEventListener('click', () => {
    state.type = btn.dataset.type;
    choose($$('[data-type]'), btn);
    render({ moveFocus: false });
  }));

  /* Step 2 */
  function showInputMode(mode) {
    state.inputMode = mode;
    $('#bill-mode').hidden = mode !== 'bill';
    $('#kwh-mode').hidden = mode !== 'kwh';
    (mode === 'bill' ? el.bill : el.kwh).focus();
  }
  $$('[data-toggle-mode]').forEach((b) => b.addEventListener('click', () => showInputMode(state.inputMode === 'bill' ? 'kwh' : 'bill')));

  function setInvalid(input, errorEl, invalid) {
    input.setAttribute('aria-invalid', String(invalid));
    errorEl.hidden = !invalid;
  }

  el.bill.addEventListener('input', () => {
    const v = parseFloat(el.bill.value);
    const valid = v > 0 && v <= CONFIG.MAX_BILL;
    state.bill = valid ? v : null;
    state.dailyKwh = valid ? billToDailyKwh(v) : null;
    setInvalid(el.bill, el.billErr, el.bill.value !== '' && !valid);
    drawGraph();
    render({ moveFocus: false });
  });

  el.kwh.addEventListener('input', () => {
    const v = parseFloat(el.kwh.value);
    const valid = v > 0 && v <= CONFIG.MAX_DAILY_KWH;
    state.dailyKwh = valid ? v : null;
    state.bill = valid ? dailyKwhToBill(v) : null;
    setInvalid(el.kwh, el.kwhErr, el.kwh.value !== '' && !valid);
    drawGraph();
    render({ moveFocus: false });
  });

  [el.bill, el.kwh, el.addr].forEach((input) => input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); goNext(); }
  }));

  /* Usage graph */
  const GRAPH_PROFILES = {
    day:    [4, 4, 4.5, 5, 12, 13, 12, 12, 12, 4, 4.5, 4.5],
    night:  [8, 10, 11, 8, 3, 2, 2, 2, 3, 8, 12, 14],
    '24h':  [6, 7, 7, 6, 8, 9, 9, 9, 8, 8, 9, 8],
    custom: [4, 3, 4, 6, 10, 11, 9, 10, 11, 9, 7, 6],
  };
  const HOURS = ['12AM', '2AM', '4AM', '6AM', '8AM', '10AM', '12PM', '2PM', '4PM', '6PM', '8PM', '10PM'];

  $$('[data-mode]').forEach((btn) => btn.addEventListener('click', () => {
    state.graphMode = btn.dataset.mode;
    $$('[data-mode]').forEach((b) => {
      const on = b === btn;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    drawGraph();
  }));

  function drawGraph() {
    const canvas = el.canvas;
    if (!canvas || !canvas.offsetWidth) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const base = GRAPH_PROFILES[state.graphMode];
    const daily = state.dailyKwh || 20;
    const sum = base.reduce((a, b) => a + b, 0);
    const data = base.map((v) => (v / sum) * daily);
    const pad = { t: 16, r: 16, b: 32, l: 56 };
    const cW = W - pad.l - pad.r;
    const cH = H - pad.t - pad.b;
    const axisMax = Math.max(...data) * 1.3;
    const font = '11px Inter, system-ui, sans-serif';

    ctx.font = font;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const v = (axisMax * i) / 5;
      const y = pad.t + cH - (v / axisMax) * cH;
      ctx.strokeStyle = '#E3E6EE';
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + cW, y); ctx.stroke();
      ctx.fillStyle = '#6B7280'; ctx.textAlign = 'right';
      ctx.fillText(v.toFixed(1) + ' kWh', pad.l - 8, y + 4);
    }

    ctx.textAlign = 'center'; ctx.fillStyle = '#6B7280';
    const every = W < 480 ? 2 : 1;
    HOURS.forEach((h, i) => {
      if (i % every === 0) ctx.fillText(h, pad.l + (i / (HOURS.length - 1)) * cW, H - 8);
    });

    const pts = data.map((v, i) => ({ x: pad.l + (i / (data.length - 1)) * cW, y: pad.t + cH - (v / axisMax) * cH }));

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pad.t + cH);
    pts.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, pad.t + cH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + cH);
    grad.addColorStop(0, 'rgba(27,45,107,.28)');
    grad.addColorStop(1, 'rgba(27,45,107,.02)');
    ctx.fillStyle = grad; ctx.fill();

    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.strokeStyle = '#1B2D6B'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();

    pts.forEach((p) => {
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.strokeStyle = '#F0B429'; ctx.lineWidth = 2.5; ctx.stroke();
    });

    canvas.setAttribute('aria-label',
      `Estimated usage by time of day, about ${daily.toFixed(1)} kilowatt-hours in total per day. Illustrative shape.`);
  }

  /* Step 3 */
  const PROJECT_VISUALS = {
    Roof: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs><linearGradient id="prRoofGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0F1D4A"/><stop offset="1" stop-color="#1B2D6B"/></linearGradient>
      <linearGradient id="prPanelGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#31509F"/><stop offset="1" stop-color="#0F1D4A"/></linearGradient></defs>
      <ellipse cx="100" cy="170" rx="78" ry="6" fill="#1B2D6B" opacity=".08"/>
      <line x1="20" y1="168" x2="180" y2="168" stroke="#1B2D6B" stroke-width="3" stroke-linecap="round" opacity=".25"/>
      <path d="M40,100 L100,42 L160,100 Z" fill="url(#prRoofGrad)"/>
      <rect x="55" y="100" width="90" height="60" rx="3" fill="#F6F7FB" stroke="#1B2D6B" stroke-width="3"/>
      <rect x="66" y="112" width="18" height="16" rx="2" fill="#fff" stroke="#1B2D6B" stroke-width="2"/>
      <rect x="116" y="112" width="18" height="16" rx="2" fill="#fff" stroke="#1B2D6B" stroke-width="2"/>
      <rect x="92" y="128" width="16" height="32" rx="2" fill="#1B2D6B"/>
      <g transform="rotate(42 118 71)"><rect x="93" y="61" width="50" height="20" rx="2" fill="url(#prPanelGrad)" stroke="#F0B429" stroke-width="2"/>
      <line x1="110" y1="61" x2="110" y2="81" stroke="#F6F7FB" stroke-width="1" opacity=".4"/><line x1="127" y1="61" x2="127" y2="81" stroke="#F6F7FB" stroke-width="1" opacity=".4"/><line x1="93" y1="71" x2="143" y2="71" stroke="#F6F7FB" stroke-width="1" opacity=".4"/></g></svg>`,
    Ground: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs><linearGradient id="pgPanelGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#31509F"/><stop offset="1" stop-color="#0F1D4A"/></linearGradient></defs>
      <ellipse cx="63" cy="161" rx="14" ry="4" fill="#1B2D6B" opacity=".12"/><ellipse cx="147" cy="161" rx="14" ry="4" fill="#1B2D6B" opacity=".12"/>
      <line x1="20" y1="160" x2="180" y2="160" stroke="#1B2D6B" stroke-width="3" stroke-linecap="round" opacity=".25"/>
      <line x1="63" y1="160" x2="63" y2="140" stroke="#1B2D6B" stroke-width="5" stroke-linecap="round"/><line x1="147" y1="160" x2="147" y2="113" stroke="#1B2D6B" stroke-width="5" stroke-linecap="round"/>
      <g transform="rotate(-18 100 110)"><rect x="55" y="93" width="90" height="34" rx="3" fill="url(#pgPanelGrad)" stroke="#F0B429" stroke-width="2.5"/>
      <line x1="77.5" y1="93" x2="77.5" y2="127" stroke="#F6F7FB" stroke-width="1" opacity=".4"/><line x1="100" y1="93" x2="100" y2="127" stroke="#F6F7FB" stroke-width="1" opacity=".4"/><line x1="122.5" y1="93" x2="122.5" y2="127" stroke="#F6F7FB" stroke-width="1" opacity=".4"/><line x1="55" y1="110" x2="145" y2="110" stroke="#F6F7FB" stroke-width="1" opacity=".4"/></g></svg>`,
    Canopy: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs><linearGradient id="pcPanelGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#31509F"/><stop offset="1" stop-color="#0F1D4A"/></linearGradient>
      <linearGradient id="pcCarGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0F1D4A"/><stop offset="1" stop-color="#1B2D6B"/></linearGradient></defs>
      <ellipse cx="100" cy="171" rx="62" ry="5" fill="#1B2D6B" opacity=".1"/>
      <line x1="20" y1="170" x2="180" y2="170" stroke="#1B2D6B" stroke-width="3" stroke-linecap="round" opacity=".25"/>
      <rect x="58" y="80" width="10" height="88" fill="#1B2D6B"/><rect x="132" y="80" width="10" height="88" fill="#1B2D6B"/>
      <rect x="40" y="55" width="120" height="26" rx="3" fill="url(#pcPanelGrad)" stroke="#F0B429" stroke-width="2.5"/>
      <line x1="64" y1="55" x2="64" y2="81" stroke="#F6F7FB" stroke-width="1" opacity=".35"/><line x1="88" y1="55" x2="88" y2="81" stroke="#F6F7FB" stroke-width="1" opacity=".35"/><line x1="112" y1="55" x2="112" y2="81" stroke="#F6F7FB" stroke-width="1" opacity=".35"/><line x1="136" y1="55" x2="136" y2="81" stroke="#F6F7FB" stroke-width="1" opacity=".35"/>
      <path d="M84,128 L92,112 L116,112 L122,128 Z" fill="#0F1D4A" opacity=".85"/><rect x="72" y="128" width="56" height="20" rx="8" fill="url(#pcCarGrad)"/>
      <circle cx="86" cy="150" r="9" fill="#0F1D4A"/><circle cx="86" cy="150" r="3" fill="#F6F7FB"/><circle cx="114" cy="150" r="9" fill="#0F1D4A"/><circle cx="114" cy="150" r="3" fill="#F6F7FB"/></svg>`,
  };

  $$('[data-project]').forEach((btn) => btn.addEventListener('click', () => {
    state.project = btn.dataset.project;
    if (state.project !== 'Roof') state.roofType = null;
    choose($$('[data-project]'), btn);
    $('#vis3Icon').innerHTML = PROJECT_VISUALS[state.project];
    updateProjectLabels();
    render({ moveFocus: false });
    if (state.project === 'Roof') openRoofModal();
  }));

  function updateProjectLabels() {
    const roofText = state.project === 'Roof' && state.roofType
      ? `${state.roofType === 'Flatroof' ? 'Flat' : state.roofType} roof selected.` : '';
    $('#vis3Label').textContent = state.project
      ? `${state.project} solar installation${state.roofType ? ' · ' + (state.roofType === 'Flatroof' ? 'Flat' : state.roofType) + ' roof' : ''}`
      : 'Select your project type';
    el.roofSummary.hidden = !roofText;
    el.roofSummary.textContent = roofText;
  }

  /* Roof dialog (native <dialog>: focus trap, Esc and backdrop handled by the browser) */
  const ROOF_IMAGES = {
    Metal: `<svg viewBox="0 0 300 160" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="160" fill="#F6F7FB"/>${[25, 75, 125, 175, 225, 275].map((x) => `<rect x="${x}" width="25" height="160" fill="#E3E6EE"/>`).join('')}<g stroke="#1B2D6B" stroke-width="2.5">${Array.from({ length: 13 }, (_, i) => `<line x1="${i * 25}" y1="0" x2="${i * 25}" y2="160"/>`).join('')}</g></svg>`,
    Shingles: `<svg viewBox="0 0 300 160" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="160" fill="#F6F7FB"/><g fill="#1B2D6B" stroke="#F6F7FB" stroke-width="2">${[0, 1, 2, 3, 4].map((r) => Array.from({ length: 8 }, (_, c) => `<rect x="${c * 42 - (r % 2 ? 20 : 10)}" y="${r * 36}" width="40" height="34" rx="2"/>`).join('')).join('')}</g></svg>`,
    Tiles: `<svg viewBox="0 0 300 160" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="160" fill="#F6F7FB"/><g fill="#1B2D6B">${Array.from({ length: 9 }, (_, i) => `<rect x="${5 + i * 36}" y="-10" width="26" height="90" rx="13"/>`).join('')}</g><g fill="#0F1D4A" opacity=".85">${Array.from({ length: 8 }, (_, i) => `<rect x="${23 + i * 36}" y="60" width="26" height="100" rx="13"/>`).join('')}</g></svg>`,
    Flatroof: `<svg viewBox="0 0 300 160" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="160" fill="#F6F7FB"/><rect width="300" height="14" fill="#1B2D6B"/><g stroke="#E3E6EE" stroke-width="3">${[44, 74, 104, 134].map((y) => `<line x1="0" y1="${y}" x2="300" y2="${y}"/>`).join('')}</g><rect x="190" y="80" width="60" height="40" rx="4" fill="#1B2D6B"/><g stroke="#F6F7FB" stroke-width="3"><line x1="200" y1="90" x2="240" y2="90"/><line x1="200" y1="100" x2="240" y2="100"/><line x1="200" y1="110" x2="240" y2="110"/></g><rect x="60" y="60" width="14" height="60" rx="4" fill="#0F1D4A"/></svg>`,
  };
  let pendingRoof = null;

  function openRoofModal() {
    pendingRoof = state.roofType;
    $$('.modal__opt').forEach((o) => o.setAttribute('aria-pressed', String(o.dataset.roof === pendingRoof)));
    if (pendingRoof) el.roofImg.innerHTML = ROOF_IMAGES[pendingRoof];
    el.roofConfirm.disabled = !pendingRoof;
    el.roofHint.hidden = !!pendingRoof;
    if (typeof el.modal.showModal === 'function') el.modal.showModal(); else el.modal.setAttribute('open', '');
  }
  function closeRoofModal() {
    if (typeof el.modal.close === 'function') el.modal.close(); else el.modal.removeAttribute('open');
  }

  $$('.modal__opt').forEach((btn) => btn.addEventListener('click', () => {
    pendingRoof = btn.dataset.roof;
    $$('.modal__opt').forEach((o) => o.setAttribute('aria-pressed', String(o === btn)));
    el.roofImg.innerHTML = ROOF_IMAGES[pendingRoof];
    el.roofConfirm.disabled = false;
    el.roofHint.hidden = true;
  }));
  $('#roofClose').addEventListener('click', closeRoofModal);
  el.modal.addEventListener('click', (e) => { if (e.target === el.modal) closeRoofModal(); });
  el.roofConfirm.addEventListener('click', () => {
    state.roofType = pendingRoof;
    closeRoofModal();
    updateProjectLabels();
    render({ moveFocus: false });
    el.next.focus();
  });

  /* Step 4 */
  let mapTimer = null;
  el.addr.addEventListener('input', () => {
    state.address = el.addr.value;
    render({ moveFocus: false });
    clearTimeout(mapTimer);
    mapTimer = setTimeout(() => {
      const q = state.address.trim() || 'Philippines';
      $('#mapFrame').src = `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
    }, 600);
  });

  /* ── Step 5: proposal ──────────────────────────────────────────── */
  function setText(id, text) { document.getElementById(id).textContent = text; }

  function buildProposal() {
    const r = compute({ type: state.type, bill: state.bill, dailyKwh: state.dailyKwh, project: state.project, roofType: state.roofType, batteryKwh: state.batteryKwh });
    if (!r) return;
    const key = [state.type, state.bill, state.dailyKwh, state.project, state.roofType].join('|');
    if (state.customKey !== key) { state.customKey = key; state.panels = null; state.batteryKwh = 0; }
    const base = compute({ type: state.type, bill: state.bill, dailyKwh: state.dailyKwh, project: state.project, roofType: state.roofType });
    state.recPanels = base.recommendedPanels;
    const r2 = compute({ type: state.type, bill: state.bill, dailyKwh: state.dailyKwh, project: state.project, roofType: state.roofType, panels: state.panels, batteryKwh: state.batteryKwh });
    Object.assign(r, r2);
    const pIn = $('#panelsInput'), bIn = $('#batteryInput');
    pIn.value = r.panels; bIn.value = state.batteryKwh;
    const note = $('#customNote');
    const needFull = Math.ceil(r.dailyKwh / (r.productionKwh / r.panels));
    note.textContent = r.panels > needFull
      ? `Panels beyond ${needFull} would produce more than you use, so they add cost but no bill savings here.`
      : `Recommended: ${base.recommendedPanels} panels. Battery adds backup, not extra savings, so payback gets longer.`;
    const pct = Math.round(r.offset * 100);
    const billPct = Math.round((r.monthlySavings / r.bill) * 100);

    setText('ptbSavings', formatPeso(r.monthlySavings));
    setText('ptbPct', billPct + '%');
    const circ = 2 * Math.PI * 19;
    const arc = $('#ptbArc');
    arc.setAttribute('stroke-dasharray', circ.toFixed(2));
    arc.setAttribute('stroke-dashoffset', (circ * (1 - billPct / 100)).toFixed(2));

    $('#barCurrent').style.height = '100%';
    $('#barFuture').style.height = (100 - billPct) + '%';
    $('#barSaved').style.height = billPct + '%';
    setText('lblCurrent', formatPeso(r.bill));
    setText('lblFuture', formatPeso(r.futureBill));

    setText('esUsage', r.dailyKwh.toFixed(1) + ' kWh');
    setText('esProd', r.productionKwh.toFixed(1) + ' kWh');
    setText('esImport', r.importKwh.toFixed(1) + ' kWh');
    setText('esShare', pct + '%');
    $('#energyFill').style.width = pct + '%';

    setText('specKwp', r.kwp.toFixed(2) + ' kWp');
    setText('specPanels', r.panels + ' panels');
    setText('accMonthly', formatPeso(r.monthlySavings));
    setText('accDaily', formatPeso(r.monthlySavings / CONFIG.DAYS_PER_MONTH));
    setText('accWeekly', formatPeso(r.monthlySavings / 4.345));
    setText('accPayback', r.paybackYears.toFixed(1) + ' years');
    setText('accLifetime', formatPeso(r.lifetimeSavings));

    setText('pSolar', formatPeso(r.cost.panels));
    setText('pInverter', formatPeso(r.cost.inverter));
    setText('pInstall', formatPeso(r.cost.install));
    const batRow = document.getElementById('rowBattery');
    if (batRow) { batRow.hidden = !r.batteryKwh; setText('pBattery', formatPeso(r.cost.battery)); }
    setText('pVat', formatPeso(r.cost.vat));
    setText('pTotal', formatPeso(r.cost.total));

    // Inputs only; the homepage recomputes from the same model so numbers can never drift apart.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        v: 2,
        input: { type: state.type, bill: state.bill, dailyKwh: state.dailyKwh, project: state.project, roofType: state.roofType, address: state.address.trim(), panels: state.panels, batteryKwh: state.batteryKwh },
      }));
    } catch (e) { /* storage unavailable (private mode / quota): homepage projection simply stays hidden */ }
  }

  /* Accordions */
  $$('.acc__head').forEach((head) => head.addEventListener('click', () => {
    const open = head.getAttribute('aria-expanded') !== 'true';
    head.setAttribute('aria-expanded', String(open));
    document.getElementById(head.getAttribute('aria-controls')).hidden = !open;
  }));

  /* Footer actions */
  el.next.addEventListener('click', goNext);
  el.back.addEventListener('click', goBack);
  el.book.addEventListener('click', () => { window.location.href = 'index.html?from=calculator#contact'; });

  window.addEventListener('resize', () => { if (state.step === 2) drawGraph(); });

  render({ moveFocus: false });
})();
