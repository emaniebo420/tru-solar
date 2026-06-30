// Progress bar
window.addEventListener('scroll', () => {
  const pct = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
  document.getElementById('pbar').style.width = Math.min(pct, 100) + '%';
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
function submitForm() {
  const name = document.getElementById('f-name').value.trim();
  const phone = document.getElementById('f-phone').value.trim();
  if (!name || !phone) { alert('Please enter your name and phone number.'); return; }

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

// Footer copyright year
document.addEventListener('DOMContentLoaded', () => {
  const yearEl = document.getElementById('copy-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});
