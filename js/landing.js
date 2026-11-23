(function () {
  'use strict';

  const { compute, formatPeso } = window.TruSolar;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const STORAGE_KEY = 'trusolar_proposal';
  const CONTACT_EMAIL = 'trusolarph@gmail.com';

  /* ── Mobile navigation ─────────────────────────────────────────── */
  function initNav() {
    const toggle = $('#nav-toggle');
    const nav = $('#site-nav');
    if (!toggle || !nav) return;

    const setOpen = (open) => {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
    };

    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); toggle.focus(); }
    });
    document.addEventListener('click', (e) => {
      if (nav.classList.contains('is-open') && !nav.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
    });
    window.matchMedia('(min-width: 821px)').addEventListener('change', () => setOpen(false));
  }

  /* ── Tabs (WAI-ARIA tabs pattern with arrow-key support) ───────── */
  function initTabs() {
    $$('[data-tabs]').forEach((root) => {
      const tabs = $$('[role="tab"]', root);
      const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));

      const select = (index, focus) => {
        tabs.forEach((tab, i) => {
          const active = i === index;
          tab.setAttribute('aria-selected', String(active));
          tab.tabIndex = active ? 0 : -1;
          panels[i].hidden = !active;
        });
        if (focus) tabs[index].focus();
      };

      tabs.forEach((tab, i) => {
        tab.addEventListener('click', () => select(i, false));
        tab.addEventListener('keydown', (e) => {
          const last = tabs.length - 1;
          const moves = { ArrowRight: i === last ? 0 : i + 1, ArrowLeft: i === 0 ? last : i - 1, Home: 0, End: last };
          if (e.key in moves) { e.preventDefault(); select(moves[e.key], true); }
        });
      });
    });
  }

  /* ── Saved calculator run (shared with calculator.js) ──────────── */
  function loadSavedInput() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return saved && saved.v === 2 && saved.input ? saved.input : null;
    } catch (e) {
      return null;
    }
  }

  /* ── Example estimate (hero card + calculator promo) ───────────── */
  const EXAMPLE = { type: 'residential', bill: 7500, project: 'Roof', roofType: 'Metal' };

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function initExample() {
    const range = document.getElementById('bill-range');
    if (!range) return;
    const update = () => {
      const bill = Number(range.value);
      const r = compute({ ...EXAMPLE, bill });
      if (!r) return;
      const pct = ((bill - range.min) / (range.max - range.min)) * 100;
      range.style.setProperty('--fill', pct + '%');
      range.setAttribute('aria-valuetext', formatPeso(bill) + ' per month');
      setText('bill-now', formatPeso(bill));
      setText('bill-after', formatPeso(r.futureBill));
      setText('bill-save', formatPeso(r.monthlySavings));
      setText('bill-kwp', `${r.kwp.toFixed(2)} kWp · ${r.panels} panels`);
      setText('bill-payback', r.paybackYears.toFixed(1) + ' years');
      const after = document.getElementById('bar-after');
      if (after) after.style.width = Math.round((r.futureBill / bill) * 100) + '%';
    };
    range.addEventListener('input', update);
    update();
  }

  /* ── Savings projection (from the visitor's last calculator run) ─ */
  function initRoi() {
    const input = loadSavedInput();
    const r = input && compute(input);
    if (!r) return;

    const net = (years) => r.annualSavings * years - r.cost.total;
    [5, 10, 25].forEach((years) => {
      const el = document.getElementById('roi-' + years);
      const value = net(years);
      el.textContent = formatPeso(value);
      el.classList.toggle('is-negative', value < 0);
    });

    [5, 25].forEach((years) => {
      const withSolar = r.cost.total + r.futureBill * 12 * years;
      const without = r.bill * 12 * years;
      const max = Math.max(withSolar, without);
      const bars = [
        ['bw' + years, withSolar, 'With TruSolar: '],
        ['bwo' + years, without, 'Without solar: '],
      ];
      bars.forEach(([id, value, label]) => {
        const bar = document.getElementById(id);
        bar.style.width = Math.max(18, (value / max) * 100) + '%';
        bar.textContent = label + formatPeso(value);
      });
    });

    $('#roi-empty').hidden = true;
    $('#roi-chart').hidden = false;
  }

  /* ── Contact form ──────────────────────────────────────────────── */
  function initContactForm() {
    const form = $('#contact-form');
    if (!form) return;
    const success = $('#form-success');
    const fields = {
      name: { input: $('#f-name'), error: $('#err-name') },
      phone: { input: $('#f-phone'), error: $('#err-phone') },
    };

    const setInvalid = (key, invalid) => {
      const { input, error } = fields[key];
      input.setAttribute('aria-invalid', String(invalid));
      error.hidden = !invalid;
    };

    Object.keys(fields).forEach((key) => {
      fields[key].input.addEventListener('input', () => setInvalid(key, false));
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const trimmed = (v) => (v || '').trim();

      const invalid = { name: !trimmed(data.name), phone: !trimmed(data.phone) };
      Object.keys(invalid).forEach((key) => setInvalid(key, invalid[key]));
      const firstBad = Object.keys(invalid).find((key) => invalid[key]);
      if (firstBad) { fields[firstBad].input.focus(); return; }

      const lines = [
        `Name: ${trimmed(data.name)}`,
        `Phone: ${trimmed(data.phone)}`,
        trimmed(data.email) && `Email: ${trimmed(data.email)}`,
        trimmed(data.location) && `Location: ${trimmed(data.location)}`,
        data.type && `Type of inquiry: ${data.type}`,
        trimmed(data.message) && `\nMessage:\n${trimmed(data.message)}`,
      ].filter(Boolean);

      const subject = `Solar inquiry from ${trimmed(data.name)}`;
      const href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;

      form.hidden = true;
      success.hidden = false;
      success.focus();
      window.location.href = href;
    });

    $('#form-reset').addEventListener('click', () => {
      success.hidden = true;
      form.hidden = false;
      fields.name.input.focus();
    });

    prefillFromCalculator(form);
  }

  /** When arriving from "Book Site Visit", carry the proposal over so the visitor does not retype it. */
  function prefillFromCalculator(form) {
    if (new URLSearchParams(window.location.search).get('from') !== 'calculator') return;
    const input = loadSavedInput();
    const r = input && compute(input);
    if (!r) return;

    const set = (id, value) => { const el = document.getElementById(id); if (el && !el.value) el.value = value; };
    if (input.address) set('f-location', input.address);
    set('f-type', r.type === 'commercial' ? 'Commercial installation' : 'Residential installation');
    set('f-message', [
      'I used the online calculator and would like a site assessment.',
      `Monthly bill: ${formatPeso(r.bill)}`,
      `Project: ${r.project}${r.roofType ? ' (' + r.roofType + ' roof)' : ''}`,
      `Estimated system: ${r.kwp.toFixed(2)} kWp, ${r.panels} panels`,
    ].join('\n'));
  }

  /* ── Footer year ───────────────────────────────────────────────── */
  function initYear() {
    const el = $('#copy-year');
    if (el) el.textContent = String(new Date().getFullYear());
  }

  document.addEventListener('DOMContentLoaded', () => {
    initNav();
    initTabs();
    initExample();
    initRoi();
    initContactForm();
    initYear();
  });
})();
