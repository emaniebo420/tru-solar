/**
 * TruSolar sizing & savings model.
 *
 * Single source of truth for every number the site shows (calculator,
 * homepage example card, ROI section). Loaded before the page scripts.
 *
 * All constants are estimates. Edit them here and both pages update.
 */
(function (global) {
  'use strict';

  const CONFIG = Object.freeze({
    RATE_PER_KWH: 15.551,      // Meralco overall residential rate, Nov 2026 (PHP/kWh); update monthly
    DAYS_PER_MONTH: 30,
    PEAK_SUN_HOURS: 5.0,       // Philippine average
    SYSTEM_DERATE: 0.85,       // inverter, wiring and temperature losses
    PANEL_WATTS: 400,
    VAT: 0.12,
    LIFETIME_YEARS: 25,
    MAX_BILL: 10_000_000,      // sanity ceilings for fat-fingered input
    MAX_DAILY_KWH: 30_000,
    // Share of daily usage the system is sized to offset.
    OFFSET_BY_TYPE: Object.freeze({ residential: 0.45, commercial: 0.60 }),
    // Relative yield by mounting type.
    YIELD_BY_PROJECT: Object.freeze({ Roof: 1.00, Ground: 1.08, Canopy: 1.04 }),
    // Roof-mount derate (Roof projects only).
    YIELD_BY_ROOF: Object.freeze({ Metal: 1.00, Shingles: 0.98, Tiles: 0.95, Flatroof: 0.97 }),
    // PHP per kWp
    // Estimate, before VAT (~PHP 67k/kWp incl. VAT). Not a quote: replace with TruSolar's real pricing.
    COST_PER_KWP: Object.freeze({ panels: 27_000, inverter: 15_000, install: 18_000 }),
  });

  const isPositive = (n) => typeof n === 'number' && Number.isFinite(n) && n > 0;

  function billToDailyKwh(bill) {
    return bill / CONFIG.RATE_PER_KWH / CONFIG.DAYS_PER_MONTH;
  }

  function dailyKwhToBill(kwh) {
    return kwh * CONFIG.DAYS_PER_MONTH * CONFIG.RATE_PER_KWH;
  }

  /**
   * @param {{type?:'residential'|'commercial', bill?:number, dailyKwh?:number,
   *          project?:'Roof'|'Ground'|'Canopy', roofType?:string}} input
   * @returns {object|null} null when there is no usable usage figure
   */
  function compute(input) {
    const i = input || {};
    let dailyKwh = isPositive(i.dailyKwh) ? i.dailyKwh : null;
    let bill = isPositive(i.bill) ? i.bill : null;
    if (dailyKwh === null && bill === null) return null;
    if (dailyKwh === null) dailyKwh = billToDailyKwh(bill);
    if (bill === null) bill = dailyKwhToBill(dailyKwh);

    const type = i.type === 'commercial' ? 'commercial' : 'residential';
    const project = CONFIG.YIELD_BY_PROJECT[i.project] ? i.project : 'Roof';

    let yieldMult = CONFIG.YIELD_BY_PROJECT[project];
    if (project === 'Roof' && CONFIG.YIELD_BY_ROOF[i.roofType]) {
      yieldMult *= CONFIG.YIELD_BY_ROOF[i.roofType];
    }

    const efficiency = CONFIG.SYSTEM_DERATE * yieldMult;
    const offset = CONFIG.OFFSET_BY_TYPE[type];
    const kwp = (dailyKwh * offset) / (CONFIG.PEAK_SUN_HOURS * efficiency);
    const panels = Math.ceil((kwp * 1000) / CONFIG.PANEL_WATTS);

    const monthlySavings = bill * offset;
    const annualSavings = monthlySavings * 12;
    const futureBill = bill - monthlySavings;

    const c = CONFIG.COST_PER_KWP;
    const panelsCost = kwp * c.panels;
    const inverterCost = kwp * c.inverter;
    const installCost = kwp * c.install;
    const subtotal = panelsCost + inverterCost + installCost;
    const vat = subtotal * CONFIG.VAT;
    const total = subtotal + vat;

    return {
      type, project, roofType: i.roofType || null,
      bill, dailyKwh, offset, kwp, panels,
      monthlySavings, annualSavings, futureBill,
      lifetimeSavings: annualSavings * CONFIG.LIFETIME_YEARS,
      paybackYears: total / annualSavings,
      cost: { panels: panelsCost, inverter: inverterCost, install: installCost, vat, total },
      productionKwh: dailyKwh * offset,
      importKwh: dailyKwh - dailyKwh * offset,
    };
  }

  /** Whole-peso currency string. Negative values render as -₱1,234. */
  function formatPeso(n) {
    const v = Math.round(n);
    const s = Math.abs(v).toLocaleString('en-PH');
    return (v < 0 ? '-' : '') + '₱' + s;
  }

  global.TruSolar = Object.freeze({ CONFIG, compute, formatPeso, billToDailyKwh, dailyKwhToBill });
})(window);
