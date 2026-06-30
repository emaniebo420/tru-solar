// ── State ──
let step = 1;
let totalSteps = 5;
let state = {
  type: null,        // residential / commercial
  bill: null,        // monthly ₱
  dailyKwh: null,
  project: null,     // Roof / Ground / Canopy
  roofType: null,    // Metal / Shingles / Tiles / Flatroof
  address: '',
  graphMode: 'day',
};
const RATE = 12;      // ₱/kWh

// ── Navigation ──
function updateUI(moveFocus = true) {
  // Show/hide panels
  for (let i = 1; i <= totalSteps; i++) {
    document.getElementById('step' + i).style.display = i === step ? 'block' : 'none';
    const vis = document.getElementById('vis' + i);
    if (vis) { vis.classList.toggle('active', i === step); }
  }

  // Progress bar
  const pct = Math.round((step / totalSteps) * 100);
  document.getElementById('progressHeader').style.display = step > 1 && step < 5 ? 'flex' : 'none';
  document.getElementById('stepLabel').textContent = `Step ${step} of ${totalSteps}`;
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('pctLabel').textContent = pct + '%';

  // Back button
  document.getElementById('btnBack').style.display = step > 1 ? 'inline-block' : 'none';

  // Proposal top bar
  document.getElementById('proposalTopbar').classList.toggle('show', step === 5);

  // Footer on step 5
  const footer = document.getElementById('wizardFooter');
  if (step === 5) {
    footer.innerHTML = `
      <button class="btn-back" onclick="goBack()">‹ Back</button>
      <button class="btn-book" onclick="bookVisit()">Book Site Visit</button>
    `;
  } else {
    footer.innerHTML = `
      <button class="btn-back" id="btnBack" onclick="goBack()" style="${step > 1 ? '' : 'display:none'}">Back</button>
      <button class="btn-next" id="btnNext" onclick="goNext()" ${canProceed() ? '' : 'disabled'}>Next</button>
    `;
  }

  // Move focus to the new step's heading so screen reader users get an announcement
  // (skipped on the initial page render so we don't steal focus on load)
  if (moveFocus) {
    const heading = document.querySelector('#step' + step + ' .w-title');
    if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus(); }
  }
}

function canProceed() {
  if (step === 1) return !!state.type;
  if (step === 2) return !!(state.bill || state.dailyKwh);
  if (step === 3) return !!state.project;
  if (step === 4) return state.address.length > 3;
  return true;
}

function goNext() {
  if (!canProceed()) return;
  if (step === 3 && state.project === 'Roof' && !state.roofType) {
    openModal(); return;
  }
  if (step < totalSteps) { step++; updateUI(); }
  if (step === 5) buildProposal();
}

function goBack() {
  if (step > 1) { step--; updateUI(); }
}

function onWizardInputKeydown(e) {
  if (e.key === 'Enter') { e.preventDefault(); goNext(); }
}

// ── Step 1 ──
function selectType(t, el) {
  state.type = t;
  document.querySelectorAll('#step1 .choice-btn').forEach(b => {
    b.classList.remove('selected');
    b.setAttribute('aria-pressed', 'false');
  });
  el.classList.add('selected');
  el.setAttribute('aria-pressed', 'true');
  updateUI(false);
}

// ── Step 2 ──
let inputMode = 'bill'; // bill | kwh
function toggleInputMode() {
  inputMode = inputMode === 'bill' ? 'kwh' : 'bill';
  document.getElementById('bill-mode').style.display = inputMode === 'bill' ? 'block' : 'none';
  document.getElementById('kwh-mode').style.display  = inputMode === 'kwh'  ? 'block' : 'none';
}

function onBillInput() {
  const input = document.getElementById('billInput');
  const v = parseFloat(input.value);
  if (v > 0) {
    state.bill     = v;
    state.dailyKwh = (v / RATE) / 30;
  } else { state.bill = null; state.dailyKwh = null; }
  setInputValidity(input, input.value !== '' && !(v > 0));
  drawGraph();
  updateUI(false);
}

function onKwhInput() {
  const input = document.getElementById('kwhInput');
  const v = parseFloat(input.value);
  if (v > 0) {
    state.dailyKwh = v;
    state.bill     = v * 30 * RATE;
  } else { state.dailyKwh = null; state.bill = null; }
  setInputValidity(input, input.value !== '' && !(v > 0));
  drawGraph();
  updateUI(false);
}

function setInputValidity(input, isInvalid) {
  input.classList.toggle('input-error', isInvalid);
  input.setAttribute('aria-invalid', isInvalid ? 'true' : 'false');
}

// ── Graph ──
// Reference (relative) load shapes — scaled to the visitor's actual daily kWh below,
// so the chart reflects what they entered rather than a fixed demo curve.
const GRAPH_PROFILES = {
  day:    [4,4,4.5,5,12,13,12,12,12,4,4.5,4.5],
  night:  [8,10,11,8,3,2,2,2,3,8,12,14],
  '24h':  [6,7,7,6,8,9,9,9,8,8,9,8],
  custom: [4,3,4,6,10,11,9,10,11,9,7,6],
};

function setGraphMode(mode, el) {
  state.graphMode = mode;
  document.querySelectorAll('.graph-tab').forEach(t => {
    t.classList.remove('active');
    t.setAttribute('aria-pressed', 'false');
  });
  el.classList.add('active');
  el.setAttribute('aria-pressed', 'true');
  drawGraph();
}

function drawGraph() {
  const canvas = document.getElementById('usageChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || 600;
  const H = canvas.offsetHeight || 300;
  canvas.width = W; canvas.height = H;
  ctx.clearRect(0, 0, W, H);

  const hours = ['12AM','2AM','4AM','6AM','8AM','10AM','12PM','2PM','4PM','6PM','8PM','10PM'];
  const base = GRAPH_PROFILES[state.graphMode] || GRAPH_PROFILES.day;
  const daily = state.dailyKwh || 20;
  const baseSum = base.reduce((a, b) => a + b, 0);
  // Scale the reference shape so its 2-hour blocks sum to roughly the visitor's daily kWh.
  const data = base.map(v => (v / baseSum) * daily);
  const maxV = Math.max(...data);
  const pad = { t:20, r:20, b:36, l:48 };
  const cW = W - pad.l - pad.r;
  const cH = H - pad.t - pad.b;
  const axisMax = maxV * 1.3;

  // Grid lines — labeled with the actual kWh scale of the rendered data
  ctx.strokeStyle = '#F0F0F0'; ctx.lineWidth = 1;
  const gridSteps = 5;
  for (let i = 0; i <= gridSteps; i++) {
    const v = (axisMax * i) / gridSteps;
    const y = pad.t + cH - (v / axisMax) * cH;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + cW, y); ctx.stroke();
    ctx.fillStyle = '#9CA3AF'; ctx.font = '10px Inter'; ctx.textAlign = 'right';
    ctx.fillText(v.toFixed(1) + ' kWh', pad.l - 6, y + 3);
  }

  // X labels
  ctx.fillStyle = '#9CA3AF'; ctx.font = '10px Inter'; ctx.textAlign = 'center';
  hours.forEach((h, i) => {
    const x = pad.l + (i / (hours.length - 1)) * cW;
    ctx.fillText(h, x, H - 6);
  });

  // Area chart
  const pts = data.map((v, i) => ({
    x: pad.l + (i / (data.length - 1)) * cW,
    y: pad.t + cH - (v / axisMax) * cH,
  }));

  // Fill
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pad.t + cH);
  pts.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length-1].x, pad.t + cH);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + cH);
  grad.addColorStop(0, 'rgba(59,130,246,.35)');
  grad.addColorStop(1, 'rgba(59,130,246,.03)');
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.strokeStyle = '#3B82F6'; ctx.lineWidth = 2.5; ctx.stroke();

  // Dots
  pts.forEach(p => {
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.strokeStyle = '#3B82F6'; ctx.lineWidth = 2; ctx.stroke();
  });
}

// ── Step 3 ──
const PROJECT_VISUALS = {
  Roof: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="prRoofGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--navy2)"/><stop offset="1" stop-color="var(--navy)"/>
      </linearGradient>
      <linearGradient id="prPanelGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="var(--navy2)"/><stop offset="1" stop-color="#070D24"/>
      </linearGradient>
      <clipPath id="prPanelClip"><rect x="93" y="61" width="50" height="20" rx="2"/></clipPath>
    </defs>
    <ellipse cx="100" cy="170" rx="78" ry="6" fill="var(--navy)" opacity=".08"/>
    <line x1="20" y1="168" x2="180" y2="168" stroke="var(--navy)" stroke-width="3" stroke-linecap="round" opacity=".25"/>
    <path d="M40,100 L100,42 L160,100 Z" fill="url(#prRoofGrad)"/>
    <rect x="55" y="100" width="90" height="60" rx="3" fill="var(--off)" stroke="var(--navy)" stroke-width="3"/>
    <rect x="66" y="112" width="18" height="16" rx="2" fill="#fff" stroke="var(--navy)" stroke-width="2"/>
    <rect x="116" y="112" width="18" height="16" rx="2" fill="#fff" stroke="var(--navy)" stroke-width="2"/>
    <rect x="92" y="128" width="16" height="32" rx="2" fill="var(--navy)"/>
    <g transform="rotate(42 118 71)">
      <rect x="93" y="61" width="50" height="20" rx="2" fill="url(#prPanelGrad)" stroke="var(--gold)" stroke-width="2"/>
      <g clip-path="url(#prPanelClip)"><polygon points="93,81 106,61 114,61 101,81" fill="#fff" opacity=".14"/></g>
      <line x1="110" y1="61" x2="110" y2="81" stroke="var(--off)" stroke-width="1" opacity=".4"/>
      <line x1="127" y1="61" x2="127" y2="81" stroke="var(--off)" stroke-width="1" opacity=".4"/>
      <line x1="93" y1="71" x2="143" y2="71" stroke="var(--off)" stroke-width="1" opacity=".4"/>
    </g>
  </svg>`,
  Ground: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="pgPanelGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="var(--navy2)"/><stop offset="1" stop-color="#070D24"/>
      </linearGradient>
      <clipPath id="pgPanelClip"><rect x="55" y="93" width="90" height="34" rx="3"/></clipPath>
    </defs>
    <ellipse cx="63" cy="161" rx="14" ry="4" fill="var(--navy)" opacity=".12"/>
    <ellipse cx="147" cy="161" rx="14" ry="4" fill="var(--navy)" opacity=".12"/>
    <line x1="20" y1="160" x2="180" y2="160" stroke="var(--navy)" stroke-width="3" stroke-linecap="round" opacity=".25"/>
    <path d="M30,160 L34,150 M38,160 L34,150" stroke="var(--navy)" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".6"/>
    <path d="M158,160 L162,150 M166,160 L162,150" stroke="var(--navy)" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".6"/>
    <line x1="63" y1="160" x2="63" y2="140" stroke="var(--navy)" stroke-width="5" stroke-linecap="round"/>
    <line x1="147" y1="160" x2="147" y2="113" stroke="var(--navy)" stroke-width="5" stroke-linecap="round"/>
    <g transform="rotate(-18 100 110)">
      <rect x="55" y="93" width="90" height="34" rx="3" fill="url(#pgPanelGrad)" stroke="var(--gold)" stroke-width="2.5"/>
      <g clip-path="url(#pgPanelClip)"><polygon points="55,127 80,93 92,93 67,127" fill="#fff" opacity=".12"/></g>
      <line x1="77.5" y1="93" x2="77.5" y2="127" stroke="var(--off)" stroke-width="1" opacity=".4"/>
      <line x1="100" y1="93" x2="100" y2="127" stroke="var(--off)" stroke-width="1" opacity=".4"/>
      <line x1="122.5" y1="93" x2="122.5" y2="127" stroke="var(--off)" stroke-width="1" opacity=".4"/>
      <line x1="55" y1="110" x2="145" y2="110" stroke="var(--off)" stroke-width="1" opacity=".4"/>
    </g>
  </svg>`,
  Canopy: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="pcPanelGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="var(--navy2)"/><stop offset="1" stop-color="#070D24"/>
      </linearGradient>
      <linearGradient id="pcCarGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--navy2)"/><stop offset="1" stop-color="var(--navy)"/>
      </linearGradient>
      <clipPath id="pcPanelClip"><rect x="40" y="55" width="120" height="26" rx="3"/></clipPath>
    </defs>
    <ellipse cx="100" cy="171" rx="62" ry="5" fill="var(--navy)" opacity=".1"/>
    <line x1="20" y1="170" x2="180" y2="170" stroke="var(--navy)" stroke-width="3" stroke-linecap="round" opacity=".25"/>
    <rect x="58" y="80" width="10" height="88" fill="var(--navy)"/>
    <rect x="132" y="80" width="10" height="88" fill="var(--navy)"/>
    <rect x="40" y="55" width="120" height="26" rx="3" fill="url(#pcPanelGrad)" stroke="var(--gold)" stroke-width="2.5"/>
    <g clip-path="url(#pcPanelClip)"><polygon points="40,81 70,55 85,55 55,81" fill="#fff" opacity=".12"/></g>
    <line x1="64" y1="55" x2="64" y2="81" stroke="var(--off)" stroke-width="1" opacity=".35"/>
    <line x1="88" y1="55" x2="88" y2="81" stroke="var(--off)" stroke-width="1" opacity=".35"/>
    <line x1="112" y1="55" x2="112" y2="81" stroke="var(--off)" stroke-width="1" opacity=".35"/>
    <line x1="136" y1="55" x2="136" y2="81" stroke="var(--off)" stroke-width="1" opacity=".35"/>
    <path d="M84,128 L92,112 L116,112 L122,128 Z" fill="var(--navy2)" opacity=".85"/>
    <rect x="72" y="128" width="56" height="20" rx="8" fill="url(#pcCarGrad)"/>
    <circle cx="86" cy="150" r="9" fill="var(--navy2)"/>
    <circle cx="86" cy="150" r="3" fill="var(--off)"/>
    <circle cx="114" cy="150" r="9" fill="var(--navy2)"/>
    <circle cx="114" cy="150" r="3" fill="var(--off)"/>
  </svg>`,
};

function selectProject(type, el) {
  state.project = type;
  document.querySelectorAll('#step3 .choice-btn').forEach(b => {
    b.classList.remove('selected');
    b.setAttribute('aria-pressed', 'false');
  });
  el.classList.add('selected');
  el.setAttribute('aria-pressed', 'true');
  document.getElementById('vis3Icon').innerHTML = PROJECT_VISUALS[type] || PROJECT_VISUALS.Roof;
  document.getElementById('vis3Label').textContent = type + ' solar installation';
  updateUI(false);
  if (type === 'Roof') setTimeout(openModal, 300);
}

// ── Modal ──
let selectedRoofType = null;
let modalReturnFocusEl = null;
function openModal() {
  modalReturnFocusEl = document.activeElement;
  const modal = document.getElementById('roofModal');
  modal.classList.add('show');
  selectedRoofType = null;
  document.getElementById('modalSelectBtn').disabled = true;
  document.querySelectorAll('.modal-opt').forEach(o => {
    o.classList.remove('selected');
    o.setAttribute('aria-pressed', 'false');
  });
  document.addEventListener('keydown', onModalKeydown);
  const firstOpt = modal.querySelector('.modal-opt');
  if (firstOpt) firstOpt.focus();
}
function closeModal() {
  document.getElementById('roofModal').classList.remove('show');
  document.removeEventListener('keydown', onModalKeydown);
  if (modalReturnFocusEl) { modalReturnFocusEl.focus(); modalReturnFocusEl = null; }
}
function onModalKeydown(e) {
  if (e.key === 'Escape') { closeModal(); return; }
  if (e.key !== 'Tab') return;
  const modal = document.getElementById('roofModal');
  const focusable = modal.querySelectorAll('button, [tabindex]:not([tabindex="-1"])');
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
const ROOF_TYPE_VISUALS = {
  Metal: `<svg viewBox="0 0 300 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="metalSheen" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".35"/>
        <stop offset=".5" stop-color="#fff" stop-opacity="0"/>
        <stop offset="1" stop-color="var(--navy)" stop-opacity=".1"/>
      </linearGradient>
    </defs>
    <rect width="300" height="160" fill="var(--off)"/>
    <rect x="25" width="25" height="160" fill="var(--line)"/>
    <rect x="75" width="25" height="160" fill="var(--line)"/>
    <rect x="125" width="25" height="160" fill="var(--line)"/>
    <rect x="175" width="25" height="160" fill="var(--line)"/>
    <rect x="225" width="25" height="160" fill="var(--line)"/>
    <rect x="275" width="25" height="160" fill="var(--line)"/>
    <g stroke="var(--navy)" stroke-width="2.5">
      <line x1="0" y1="0" x2="0" y2="160"/><line x1="25" y1="0" x2="25" y2="160"/>
      <line x1="50" y1="0" x2="50" y2="160"/><line x1="75" y1="0" x2="75" y2="160"/>
      <line x1="100" y1="0" x2="100" y2="160"/><line x1="125" y1="0" x2="125" y2="160"/>
      <line x1="150" y1="0" x2="150" y2="160"/><line x1="175" y1="0" x2="175" y2="160"/>
      <line x1="200" y1="0" x2="200" y2="160"/><line x1="225" y1="0" x2="225" y2="160"/>
      <line x1="250" y1="0" x2="250" y2="160"/><line x1="275" y1="0" x2="275" y2="160"/>
      <line x1="300" y1="0" x2="300" y2="160"/>
    </g>
    <rect width="300" height="160" fill="url(#metalSheen)"/>
  </svg>`,
  Shingles: `<svg viewBox="0 0 300 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="shingleGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--navy2)"/><stop offset="1" stop-color="var(--navy)"/>
      </linearGradient>
      <linearGradient id="shingleShade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".12"/>
        <stop offset="1" stop-color="#000" stop-opacity=".12"/>
      </linearGradient>
    </defs>
    <rect width="300" height="160" fill="var(--off)"/>
    <g fill="url(#shingleGrad)" stroke="var(--off)" stroke-width="2">
      <rect x="-10" y="0" width="40" height="34" rx="2"/><rect x="32" y="0" width="40" height="34" rx="2"/>
      <rect x="74" y="0" width="40" height="34" rx="2"/><rect x="116" y="0" width="40" height="34" rx="2"/>
      <rect x="158" y="0" width="40" height="34" rx="2"/><rect x="200" y="0" width="40" height="34" rx="2"/>
      <rect x="242" y="0" width="40" height="34" rx="2"/><rect x="284" y="0" width="40" height="34" rx="2"/>
      <rect x="10" y="36" width="40" height="34" rx="2"/><rect x="52" y="36" width="40" height="34" rx="2"/>
      <rect x="94" y="36" width="40" height="34" rx="2"/><rect x="136" y="36" width="40" height="34" rx="2"/>
      <rect x="178" y="36" width="40" height="34" rx="2"/><rect x="220" y="36" width="40" height="34" rx="2"/>
      <rect x="262" y="36" width="40" height="34" rx="2"/>
      <rect x="-10" y="72" width="40" height="34" rx="2"/><rect x="32" y="72" width="40" height="34" rx="2"/>
      <rect x="74" y="72" width="40" height="34" rx="2"/><rect x="116" y="72" width="40" height="34" rx="2"/>
      <rect x="158" y="72" width="40" height="34" rx="2"/><rect x="200" y="72" width="40" height="34" rx="2"/>
      <rect x="242" y="72" width="40" height="34" rx="2"/><rect x="284" y="72" width="40" height="34" rx="2"/>
      <rect x="10" y="108" width="40" height="34" rx="2"/><rect x="52" y="108" width="40" height="34" rx="2"/>
      <rect x="94" y="108" width="40" height="34" rx="2"/><rect x="136" y="108" width="40" height="34" rx="2"/>
      <rect x="178" y="108" width="40" height="34" rx="2"/><rect x="220" y="108" width="40" height="34" rx="2"/>
      <rect x="262" y="108" width="40" height="34" rx="2"/>
      <rect x="-10" y="144" width="40" height="20" rx="2"/><rect x="32" y="144" width="40" height="20" rx="2"/>
      <rect x="74" y="144" width="40" height="20" rx="2"/><rect x="116" y="144" width="40" height="20" rx="2"/>
      <rect x="158" y="144" width="40" height="20" rx="2"/><rect x="200" y="144" width="40" height="20" rx="2"/>
      <rect x="242" y="144" width="40" height="20" rx="2"/><rect x="284" y="144" width="40" height="20" rx="2"/>
    </g>
    <rect width="300" height="160" fill="url(#shingleShade)"/>
  </svg>`,
  Tiles: `<svg viewBox="0 0 300 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="tileGradTop" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--navy2)"/><stop offset="1" stop-color="var(--navy)"/>
      </linearGradient>
      <linearGradient id="tileGradBottom" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--navy)"/><stop offset="1" stop-color="#0A1638"/>
      </linearGradient>
    </defs>
    <rect width="300" height="160" fill="var(--off)"/>
    <g fill="url(#tileGradTop)">
      <rect x="5" y="-10" width="26" height="90" rx="13"/><rect x="41" y="-10" width="26" height="90" rx="13"/>
      <rect x="77" y="-10" width="26" height="90" rx="13"/><rect x="113" y="-10" width="26" height="90" rx="13"/>
      <rect x="149" y="-10" width="26" height="90" rx="13"/><rect x="185" y="-10" width="26" height="90" rx="13"/>
      <rect x="221" y="-10" width="26" height="90" rx="13"/><rect x="257" y="-10" width="26" height="90" rx="13"/>
      <rect x="293" y="-10" width="26" height="90" rx="13"/>
    </g>
    <g fill="url(#tileGradBottom)" opacity=".85">
      <rect x="23" y="60" width="26" height="100" rx="13"/><rect x="59" y="60" width="26" height="100" rx="13"/>
      <rect x="95" y="60" width="26" height="100" rx="13"/><rect x="131" y="60" width="26" height="100" rx="13"/>
      <rect x="167" y="60" width="26" height="100" rx="13"/><rect x="203" y="60" width="26" height="100" rx="13"/>
      <rect x="239" y="60" width="26" height="100" rx="13"/><rect x="275" y="60" width="26" height="100" rx="13"/>
    </g>
  </svg>`,
  Flatroof: `<svg viewBox="0 0 300 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="flatParapetGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--navy2)"/><stop offset="1" stop-color="var(--navy)"/>
      </linearGradient>
    </defs>
    <rect width="300" height="160" fill="var(--off)"/>
    <rect x="0" y="0" width="300" height="14" fill="url(#flatParapetGrad)"/>
    <g stroke="var(--line)" stroke-width="3">
      <line x1="0" y1="44" x2="300" y2="44"/><line x1="0" y1="74" x2="300" y2="74"/>
      <line x1="0" y1="104" x2="300" y2="104"/><line x1="0" y1="134" x2="300" y2="134"/>
    </g>
    <ellipse cx="220" cy="124" rx="38" ry="6" fill="var(--navy)" opacity=".1"/>
    <rect x="190" y="80" width="60" height="40" rx="4" fill="url(#flatParapetGrad)"/>
    <line x1="200" y1="90" x2="240" y2="90" stroke="var(--off)" stroke-width="3"/>
    <line x1="200" y1="100" x2="240" y2="100" stroke="var(--off)" stroke-width="3"/>
    <line x1="200" y1="110" x2="240" y2="110" stroke="var(--off)" stroke-width="3"/>
    <rect x="60" y="60" width="14" height="60" rx="4" fill="var(--navy2)"/>
    <ellipse cx="67" cy="60" rx="10" ry="4" fill="var(--navy2)"/>
  </svg>`,
};

function selectRoofType(t, el) {
  selectedRoofType = t;
  document.querySelectorAll('.modal-opt').forEach(o => {
    o.classList.remove('selected');
    o.setAttribute('aria-pressed', 'false');
  });
  el.classList.add('selected');
  el.setAttribute('aria-pressed', 'true');
  document.getElementById('modalSelectBtn').disabled = false;
  document.getElementById('modalRoofImg').innerHTML = ROOF_TYPE_VISUALS[t];
}
function confirmRoofType() {
  state.roofType = selectedRoofType;
  closeModal();
  updateUI(false);
}

// ── Step 4 ──
let mapDebounceTimer = null;
function onAddrInput() {
  state.address = document.getElementById('addrInput').value;
  updateUI(false);
  clearTimeout(mapDebounceTimer);
  mapDebounceTimer = setTimeout(updateMap, 600);
}

function updateMap() {
  const frame = document.getElementById('mapFrame');
  const query = state.address.trim() || 'Philippines';
  frame.src = `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

// ── Step 5: Proposal ──
function buildProposal() {
  const daily   = state.dailyKwh || 20;
  const monthly = daily * 30;
  const bill    = state.bill || monthly * RATE;
  const sun     = 5.0, eff = 0.85;
  const off     = 0.53; // target self-consumption offset — drives both system sizing and savings
  const kwp     = (daily * off) / (sun * eff);
  const panels  = Math.ceil((kwp * 1000) / 400);
  const mSave   = bill * off;
  const aSave   = mSave * 12;
  const solarCost = kwp * 18000;
  const inverter  = kwp * 8000;
  const install   = kwp * 7000;
  const subtotal  = solarCost + inverter + install;
  const vat       = subtotal * 0.12;
  const total     = subtotal + vat;
  const pbk       = total / aSave;
  const lifetime  = aSave * 25;
  const monthly36 = total / 36;
  const futureBill = bill - mSave;
  const prodKwh = daily * off;
  const importKwh = daily - prodKwh;
  const score = Math.round(off * 100 + 20);

  // Top bar
  document.getElementById('ptbSavings').textContent = fmt(mSave);
  document.getElementById('ptbCost').textContent    = fmt(monthly36);
  document.getElementById('ptbPct').textContent     = Math.round(off*100)+'%';
  const arc = document.getElementById('ptbArc');
  const circ = 2 * Math.PI * 19;
  arc.setAttribute('stroke-dasharray', circ);
  arc.setAttribute('stroke-dashoffset', circ - circ * off);

  // Bill bars (normalize to max height 100%)
  const maxBill = Math.max(bill, futureBill);
  const curH  = (bill / maxBill * 75).toFixed(0);
  const solH  = ((mSave / bill) * (bill / maxBill * 75)).toFixed(0);
  document.getElementById('bar-current').style.height = curH + '%';
  document.getElementById('bar-future-bg').style.height = (bill / maxBill * 75) + '%';
  document.getElementById('bar-future-solar').style.height = solH + '%';
  document.getElementById('lbl-current').textContent = fmt(bill);
  document.getElementById('lbl-future').textContent  = fmt(futureBill);

  // Energy stats
  document.getElementById('es-usage').textContent  = daily.toFixed(2) + ' kWh';
  document.getElementById('es-prod').textContent   = prodKwh.toFixed(2) + ' kWh';
  document.getElementById('es-import').textContent = importKwh.toFixed(2) + ' kWh';
  document.getElementById('scoreVal').textContent  = score + '%';
  const sArc = document.getElementById('scoreArc');
  const sc = 2 * Math.PI * 18;
  sArc.setAttribute('stroke-dasharray', sc);
  sArc.setAttribute('stroke-dashoffset', sc - sc * (score/100));
  document.getElementById('energyFill').style.width = Math.round(off*100) + '%';

  // Spec accordion
  document.getElementById('spec-kwp').textContent    = kwp.toFixed(2) + ' kWp';
  document.getElementById('spec-panels').textContent = panels + ' panels';

  // Savings accordion
  document.getElementById('acc-monthly').textContent  = fmt(mSave);
  document.getElementById('acc-daily').textContent    = fmt(mSave / 30);
  document.getElementById('acc-weekly').textContent   = fmt(mSave / 4.3);
  document.getElementById('acc-lifetime').textContent = fmt(lifetime);
  document.getElementById('acc-roi').textContent      = pbk.toFixed(1) + ' years';

  // Pricing
  document.getElementById('p-solar').textContent    = fmt(solarCost);
  document.getElementById('p-inverter').textContent = fmt(inverter);
  document.getElementById('p-install').textContent  = fmt(install);
  document.getElementById('p-vat').textContent      = fmt(vat);
  document.getElementById('p-total').textContent    = fmt(total);
}

function toggleAcc(btn) {
  const open = btn.classList.toggle('open');
  btn.nextElementSibling.classList.toggle('open');
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function bookVisit() {
  window.location.href = 'index.html#contact';
}

function fmt(n) { return '₱' + Math.round(n).toLocaleString(); }

// ── Init ──
updateUI(false);

// Redraw graph on resize
window.addEventListener('resize', () => {
  if (step === 2 && (state.bill || state.dailyKwh)) drawGraph();
});
