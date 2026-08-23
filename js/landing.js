// Progress bar
window.addEventListener('scroll', () => {
  const pct = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
  document.getElementById('pbar').style.width = Math.min(pct, 100) + '%';
});

// Mobile nav
function toggleMobileNav() {
  const open = document.getElementById('mobileNav').classList.toggle('open');
  const btn = document.getElementById('navToggle');
  btn.classList.toggle('is-open', open);
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function closeMobileNav() {
  document.getElementById('mobileNav').classList.remove('open');
  const btn = document.getElementById('navToggle');
  btn.classList.remove('is-open');
  btn.setAttribute('aria-expanded', 'false');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeMobileNav();
});

document.addEventListener('click', e => {
  const nav = document.getElementById('mobileNav');
  const toggle = document.getElementById('navToggle');
  if (nav.classList.contains('open') && !nav.contains(e.target) && !toggle.contains(e.target)) {
    closeMobileNav();
  }
});

// FAQ
function toggleFaq(btn) {
  const open = btn.parentElement.classList.toggle('open');
  btn.setAttribute('aria-expanded', open);
}

// Client tabs
function switchClient(id, btn) {
  document.querySelectorAll('.client-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.client-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('cp-' + id).classList.add('active');
  btn.classList.add('active');
}

// Contact form — opens the visitor's email client with the inquiry pre-filled
function setFieldError(inputId, errorId, isInvalid) {
  document.getElementById(inputId).classList.toggle('input-error', isInvalid);
  document.getElementById(errorId).classList.toggle('show', isInvalid);
}

function submitForm() {
  const nameInput  = document.getElementById('f-name');
  const phoneInput = document.getElementById('f-phone');
  const name  = nameInput.value.trim();
  const phone = phoneInput.value.trim();

  const nameInvalid  = !name;
  const phoneInvalid = !phone;
  setFieldError('f-name', 'err-name', nameInvalid);
  setFieldError('f-phone', 'err-phone', phoneInvalid);
  if (nameInvalid || phoneInvalid) {
    (nameInvalid ? nameInput : phoneInput).focus();
    return;
  }

  const email = document.getElementById('f-email').value.trim();
  const location = document.getElementById('f-location').value.trim();
  const type = document.getElementById('f-type').value;
  const message = document.getElementById('f-message').value.trim();

  const subject = `Solar inquiry from ${name}`;
  const bodyLines = [
    `Name: ${name}`,
    `Phone: ${phone}`,
    email && `Email: ${email}`,
    location && `Location: ${location}`,
    type && `Type of inquiry: ${type}`,
    message && `Message: ${message}`,
  ].filter(Boolean);
  const mailto = `mailto:trusolarph@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join('\n'))}`;

  window.location.href = mailto;
  document.getElementById('form-body').style.display = 'none';
  document.getElementById('form-success').classList.add('show');
}

document.addEventListener('DOMContentLoaded', () => {
  [['f-name', 'err-name'], ['f-phone', 'err-phone']].forEach(([inputId, errorId]) => {
    document.getElementById(inputId).addEventListener('input', () => setFieldError(inputId, errorId, false));
  });
});

// Footer copyright year
document.addEventListener('DOMContentLoaded', () => {
  const yearEl = document.getElementById('copy-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});

// ROI comparison — populated from the visitor's last completed calculator run
function fmtPeso(n) { return '₱' + Math.round(n).toLocaleString(); }

document.addEventListener('DOMContentLoaded', () => {
  let saved;
  try { saved = JSON.parse(localStorage.getItem('trusolar_proposal')); } catch (e) { return; }
  if (!saved || !(saved.bill > 0)) return;

  const { bill, futureBill, total, aSave } = saved;

  document.getElementById('roi-5').textContent  = fmtPeso(aSave * 5 - total);
  document.getElementById('roi-10').textContent = fmtPeso(aSave * 10 - total);
  document.getElementById('roi-25').textContent = fmtPeso(aSave * 25 - total);

  [5, 25].forEach(years => {
    const withCost    = total + futureBill * 12 * years;
    const withoutCost = bill * 12 * years;
    const max = Math.max(withCost, withoutCost);
    const withBar    = document.getElementById('bw' + years);
    const withoutBar = document.getElementById('bwo' + years);
    withBar.style.width    = Math.max(15, (withCost / max) * 100) + '%';
    withBar.textContent    = 'With TruSolar — ' + fmtPeso(withCost);
    withoutBar.style.width = Math.max(15, (withoutCost / max) * 100) + '%';
    withoutBar.textContent = 'Without solar — ' + fmtPeso(withoutCost);
  });

  document.getElementById('roi-empty').style.display = 'none';
  document.getElementById('roi-chart').classList.add('show');
});
