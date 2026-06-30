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
const CPK  = 55000;   // ₱/kWp installed

// ── Navigation ──
function updateUI() {
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

// ── Step 1 ──
function selectType(t, el) {
  state.type = t;
  document.querySelectorAll('#step1 .choice-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  updateUI();
}

// ── Step 2 ──
let inputMode = 'bill'; // bill | kwh
function toggleInputMode() {
  inputMode = inputMode === 'bill' ? 'kwh' : 'bill';
  document.getElementById('bill-mode').style.display = inputMode === 'bill' ? 'block' : 'none';
  document.getElementById('kwh-mode').style.display  = inputMode === 'kwh'  ? 'block' : 'none';
}

function onBillInput() {
  const v = parseFloat(document.getElementById('billInput').value);
  if (v > 0) {
    state.bill     = v;
    state.dailyKwh = (v / RATE) / 30;
  } else { state.bill = null; state.dailyKwh = null; }
  drawGraph();
  updateUI();
}

function onKwhInput() {
  const v = parseFloat(document.getElementById('kwhInput').value);
  if (v > 0) {
    state.dailyKwh = v;
    state.bill     = v * 30 * RATE;
  } else { state.dailyKwh = null; state.bill = null; }
  drawGraph();
  updateUI();
}

// ── Graph ──
let graphMode = 'day';
function setGraphMode(mode, el) {
  graphMode = mode;
  document.querySelectorAll('.graph-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
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
  const profiles = {
    day:    [4,4,4.5,5,12,13,12,12,12,4,4.5,4.5],
    night:  [8,10,11,8,3,2,2,2,3,8,12,14],
    '24h':  [6,7,7,6,8,9,9,9,8,8,9,8],
    custom: [4,3,4,6,10,11,9,10,11,9,7,6],
  };
  const data = profiles[graphMode] || profiles.day;
  const maxV = Math.max(...data);
  const pad = { t:20, r:20, b:36, l:40 };
  const cW = W - pad.l - pad.r;
  const cH = H - pad.t - pad.b;

  // Grid lines
  ctx.strokeStyle = '#F0F0F0'; ctx.lineWidth = 1;
  [0,.05,.1,.12,.14,.16,.18,.20].forEach(v => {
    const pct = v / 0.20;
    const y = pad.t + cH - pct * cH;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + cW, y); ctx.stroke();
    ctx.fillStyle = '#9CA3AF'; ctx.font = '10px Inter'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(v * 100) + '%', pad.l - 4, y + 3);
  });

  // X labels
  ctx.fillStyle = '#9CA3AF'; ctx.font = '10px Inter'; ctx.textAlign = 'center';
  hours.forEach((h, i) => {
    const x = pad.l + (i / (hours.length - 1)) * cW;
    ctx.fillText(h, x, H - 6);
  });

  // Area chart
  const pts = data.map((v, i) => ({
    x: pad.l + (i / (data.length - 1)) * cW,
    y: pad.t + cH - (v / (maxV * 1.3)) * cH,
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
function selectProject(type, el) {
  state.project = type;
  document.querySelectorAll('#step3 .choice-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  const icons = { Roof:'🏠', Ground:'🌿', Canopy:'🏗️' };
  document.getElementById('vis3Icon').textContent = icons[type] || '🏗️';
  document.getElementById('vis3Label').textContent = type + ' solar installation';
  updateUI();
  if (type === 'Roof') setTimeout(openModal, 300);
}

// ── Modal ──
let selectedRoofType = null;
function openModal() {
  document.getElementById('roofModal').classList.add('show');
  selectedRoofType = null;
  document.getElementById('modalSelectBtn').disabled = true;
  document.querySelectorAll('.modal-opt').forEach(o => o.classList.remove('selected'));
}
function closeModal() { document.getElementById('roofModal').classList.remove('show'); }
function selectRoofType(t, el) {
  selectedRoofType = t;
  document.querySelectorAll('.modal-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('modalSelectBtn').disabled = false;
  const imgs = { Metal:'🔩', Shingles:'🏘️', Tiles:'🧱', Flatroof:'🏢' };
  document.getElementById('modalRoofImg').textContent = imgs[t];
}
function confirmRoofType() {
  state.roofType = selectedRoofType;
  closeModal();
  updateUI();
}

// ── Step 4 ──
function onAddrInput() {
  state.address = document.getElementById('addrInput').value;
  updateUI();
}

// ── Step 5: Proposal ──
function buildProposal() {
  const daily   = state.dailyKwh || 20;
  const monthly = daily * 30;
  const bill    = state.bill || monthly * RATE;
  const sun     = 5.0, eff = 0.85;
  const kwp     = daily / (sun * eff);
  const panels  = Math.ceil((kwp * 1000) / 400);
  const off     = 0.53; // 53% offset
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
  const futH  = (futureBill / maxBill * 75).toFixed(0);
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
  document.getElementById('acc-roi').textContent      = pbk.toFixed(0) + ' years';

  // Pricing
  document.getElementById('p-solar').textContent    = fmt(solarCost);
  document.getElementById('p-inverter').textContent = fmt(inverter);
  document.getElementById('p-install').textContent  = fmt(install);
  document.getElementById('p-vat').textContent      = fmt(vat);
  document.getElementById('p-total').textContent    = fmt(total);
}

function toggleAcc(btn) {
  btn.classList.toggle('open');
  btn.nextElementSibling.classList.toggle('open');
}

function bookVisit() {
  window.location.href = 'index.html#contact';
}

function fmt(n) { return '₱' + Math.round(n).toLocaleString(); }

// ── Init ──
updateUI();

// Redraw graph on resize
window.addEventListener('resize', () => {
  if (step === 2 && (state.bill || state.dailyKwh)) drawGraph();
});
