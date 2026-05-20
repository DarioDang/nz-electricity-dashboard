/* ============================================================
   js/dashboard.js
   Main app entry point — fetches data and wires every component.
   ============================================================ */

// ── Helpers ─────────────────────────────────────────────────

function safeFloat(val, fallback = 0) {
  const n = parseFloat(val);
  return isNaN(n) ? fallback : n;
}

function toNZT(utcStr) {
  try {
    const dt = new Date(utcStr);
    return new Intl.DateTimeFormat('en-NZ', {
      timeZone: 'Pacific/Auckland',
      hour: '2-digit', minute: '2-digit',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour12: false,
    }).format(dt).replace(',', '');
  } catch { return '--'; }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setHTML(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = value;
}

// ── Step 3A: Update header ───────────────────────────────────

function updateHeader(carbon) {
  if (!carbon) return;
  const ts = toNZT(carbon.timestamp_utc);
  setText('last-updated', `Updated ${ts} NZST`);
  const chip = document.getElementById('grid-status-chip');
  if (chip) {
    const status = carbon.grid_status || '--';
    chip.textContent = status;
    chip.className = 'status-chip';
    if (status.toLowerCase().includes('dirty'))    chip.classList.add('dirty');
    if (status.toLowerCase().includes('moderate')) chip.classList.add('moderate');
  }
  const sub = document.getElementById('gauge-subtitle');
  if (sub) sub.textContent = `Last updated ${ts}`;
  const p24 = document.getElementById('price24-subtitle');
  if (p24) p24.textContent = `Last updated ${ts}`;
}

// ── Step 3B: KPI Card 1 — Renewable Generation ──────────────

function updateRenewableCard(carbon) {
  if (!carbon) return;
  const pct        = safeFloat(carbon.renewable_pct);
  const status     = carbon.grid_status || '--';
  const barPct     = Math.min(pct, 100);
  const colorClass = pct >= 80 ? 'green' : pct >= 50 ? 'amber' : 'red';
  const valEl = document.getElementById('kpi-renewable-val');
  if (valEl) {
    valEl.textContent = `${pct.toFixed(1)}%`;
    valEl.className   = `kpi-value kpi-number ${colorClass}`;
  }
  setText('kpi-renewable-sub', status);
  const bar = document.getElementById('kpi-renewable-bar');
  if (bar) setTimeout(() => { bar.style.width = `${barPct}%`; }, 300);
  const ring  = document.getElementById('ring-renewable');
  const label = document.getElementById('ring-label');
  if (ring) {
    const offset = Math.round(100 - barPct);
    setTimeout(() => {
      ring.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)';
      ring.setAttribute('stroke-dashoffset', offset);
    }, 400);
  }
  if (label) label.textContent = Math.round(barPct);
}

// ── Step 3C: KPI Card 2 — Carbon Intensity ──────────────────

function updateCarbonCard(carbon) {
  if (!carbon) return;
  const val    = safeFloat(carbon.nz_carbon_gkwh);
  const status = carbon.carbon_status || '--';
  const trend  = carbon.carbon_trend  || 'Stable';
  const vsMon  = safeFloat(carbon.vs_month_avg_pct);
  setHTML('kpi-carbon-val', `${val.toFixed(1)} <span class="kpi-unit">gCO₂/kWh</span>`);
  setText('kpi-carbon-sub', status);
  const trendEl = document.getElementById('kpi-carbon-trend');
  if (trendEl) {
    let icon  = '→', color = '#f59e0b';
    if (trend === 'Improving') { icon = '↓'; color = '#10b981'; }
    if (trend === 'Worsening') { icon = '↑'; color = '#ef4444'; }
    trendEl.textContent      = `${icon} ${trend}`;
    trendEl.style.color      = color;
    trendEl.style.border     = `1px solid ${color}40`;
    trendEl.style.background = `${color}15`;
  }
  const sign = vsMon >= 0 ? '+' : '';
  setText('kpi-carbon-context', `${sign}${vsMon.toFixed(1)}% vs month avg`);
}

// ── Step 3D: KPI Card 3 — NI/SI Spread ──────────────────────

function updateSpreadCard(spread) {
  if (!spread) return;
  const val       = safeFloat(spread.ni_si_spread);
  const direction = spread.spread_direction || '--';
  const spreadSt  = spread.spread_status    || '--';
  const ota       = safeFloat(spread.ota_price);
  const ben       = safeFloat(spread.ben_price);
  let color = '#7a9bb5', icon = '—';
  if (val > 0) { color = '#ef4444'; icon = '▲'; }
  if (val < 0) { color = '#10b981'; icon = '▼'; }
  const valEl = document.getElementById('kpi-spread-val');
  if (valEl) {
    valEl.style.color = color;
    valEl.innerHTML   = `${icon} $${Math.abs(val).toFixed(2)} <span class="kpi-unit">/MWh</span>`;
  }
  setText('kpi-spread-sub', direction);
  const badge = document.getElementById('kpi-spread-badge');
  if (badge) {
    badge.textContent      = spreadSt;
    badge.style.color      = color;
    badge.style.border     = `1px solid ${color}40`;
    badge.style.background = `${color}15`;
  }
  setText('kpi-spread-context', `OTA $${ota.toFixed(2)} · BEN $${ben.toFixed(2)}`);
}

// ── Step 3E: KPI Card 4 — Grid Reserves ─────────────────────

function updateReservesCard(reserves) {
  if (!reserves || reserves.length === 0) return;
  const ni = reserves.find(r => r.region === 'NI') || {};
  const si = reserves.find(r => r.region === 'SI') || {};
  const stress = ni.grid_stress || si.grid_stress || '--';
  let stressColor = '#14b8a6';
  if (stress === 'High')   stressColor = '#ef4444';
  if (stress === 'Medium') stressColor = '#f59e0b';
  const valEl = document.getElementById('kpi-reserves-val');
  if (valEl) {
    valEl.textContent    = stress;
    valEl.style.color    = stressColor;
    valEl.style.fontSize = '22px';
  }
  const dot = document.querySelector('#reserves-blink .blink-dot');
  if (dot) dot.style.background = stressColor;
  const stressLabel = document.getElementById('reserves-stress-label');
  if (stressLabel) {
    stressLabel.textContent = stress;
    stressLabel.style.color = stressColor;
  }
  const niFir = safeFloat(ni.fir_price);
  const niSir = safeFloat(ni.sir_price);
  const siFir = safeFloat(si.fir_price);
  const siSir = safeFloat(si.sir_price);
  setText('ni-fir', `$${niFir.toFixed(2)}`);
  setText('ni-sir', `$${niSir.toFixed(2)}`);
  setText('si-fir', `$${siFir.toFixed(2)}`);
  setText('si-sir', `$${siSir.toFixed(2)}`);
  const niBar = document.getElementById('ni-bar');
  const siBar = document.getElementById('si-bar');
  if (niBar) setTimeout(() => { niBar.style.width = `${Math.min(niFir / 20 * 100, 100)}%`; }, 300);
  if (siBar) setTimeout(() => { siBar.style.width = `${Math.min(siFir / 20 * 100, 100)}%`; }, 400);
}

// ── Step 8: Pipeline section ─────────────────────────────────

function renderPipeline() {
  const section = document.getElementById('pipeline-section');
  if (!section) return;

  const STEPS = [
    { icon: 'static/em6-icon.png',            name: 'Energy Market Service', desc: 'Free API<br>5 endpoints<br>30 min intervals' },
    { icon: 'static/github-action-icon.png',  name: 'GitHub Actions',        desc: 'Cron scheduler<br>ETL trigger<br>Free tier' },
    { icon: 'static/fast-api-icon.png',       name: 'FastAPI',               desc: 'Python backend<br>REST endpoints<br>Pydantic models' },
    { icon: 'static/neon-postgres-icon.png',  name: 'Neon Postgres',         desc: 'Cloud database<br>ap-southeast-2<br>Always free' },
    { icon: 'static/dbt-icon.png',            name: 'dbt',                   desc: 'Staging views<br>Mart tables<br>82 data tests' },
  ];

  const INFO = [
    'Every 30 min · em6 API → Neon raw tables',
    'Nightly · dbt run → mart refresh → 7-day purge',
    '82 data quality tests on every run',
    'Neon Postgres Database · cloud free tier',
  ];

  const ARROW = `
    <div class="pipe-arrow">
      <div class="pipe-arrow-dash"></div>
      <div class="pipe-arrow-gap"></div>
      <div class="pipe-arrow-dash"></div>
      <div class="pipe-arrow-gap"></div>
      <div class="pipe-arrow-head"></div>
    </div>`;

  const stepsHTML = STEPS.map((step, i) =>
    `<div class="pipe-step" style="animation-delay:${(i+1)*0.1}s;">
      <img src="${step.icon}" alt="${step.name}" />
      <div class="pipe-step-name">${step.name}</div>
      <div class="pipe-step-desc">${step.desc}</div>
    </div>`
  ).join(ARROW);

  const infoHTML = INFO.map(text =>
    `<div class="pipe-info-item"><div class="pipe-info-dot"></div>${text}</div>`
  ).join('');

  section.innerHTML = `
    <div class="section-divider">
      <div class="divider-line left"></div>
      <div class="divider-label">Data Pipeline Architecture</div>
      <div class="divider-line right"></div>
    </div>
    <div class="pipeline-steps">${stepsHTML}</div>
    <div class="pipe-info-bar">${infoHTML}</div>`;

  const steps = section.querySelectorAll('.pipe-step');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity   = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  steps.forEach((el, i) => {
    el.style.opacity    = '0';
    el.style.transform  = 'translateY(20px)';
    el.style.transition = `opacity 0.5s ease ${i*0.08}s, transform 0.5s ease ${i*0.08}s`;
    observer.observe(el);
  });
}

// ── Step 9: Profile section ──────────────────────────────────
// Redesigned layout — no icon circles (avoids clipping).
// Three horizontal cards, each with a free-standing icon,
// text block, and animated accent line on hover.

function renderProfile() {
  const section = document.getElementById('profile-section');
  if (!section) return;

  const STACK = [
    'Python', 'FastAPI', 'PostgreSQL', 'dbt', 'GitHub Actions',
    'Plotly', 'HTML · CSS · JS', 'Neon', 'em6 API',
  ];

  // Icon-only links — no labels, no cards, just the icon as a clickable link
  const LINKS = [
    { icon: 'static/linkedin-icon.png',   label: 'LinkedIn',  url: 'https://www.linkedin.com/in/dario-dang-89049020a/', color: '#0a66c2' },
    { icon: 'static/github-icon.png',     label: 'GitHub',    url: 'https://github.com/DarioDang',                      color: '#e2e8f0' },
    { icon: 'static/portfolio-icon.png',  label: 'Portfolio', url: 'https://dariodang.github.io/',                      color: '#14b8a6' },
  ];

  const stackHTML = STACK.map(tag =>
    `<span class="profile-tag">${tag}</span>`
  ).join('');

  // Clean icon-only links — no background, no text
  const iconsHTML = LINKS.map((link, i) => `
    <a class="pf-icon-link"
       href="${link.url}"
       target="_blank"
       rel="noopener noreferrer"
       title="${link.label}"
       style="--ic:${link.color}; animation-delay:${0.6 + i * 0.1}s;">
      <img src="${link.icon}" alt="${link.label}" />
    </a>`
  ).join('');

  section.innerHTML = `
    <div class="section-divider">
      <div class="divider-line left"></div>
      <div class="divider-label">About the Builder</div>
      <div class="divider-line right"></div>
    </div>

    <div class="profile-wrap">
      <!-- Bio — top area, same as before -->
      <div class="profile-bio">
        <div class="profile-eyebrow">Data Engineering · Portfolio Project</div>
        <h2 class="profile-name">Dario Dang</h2>
        <p class="profile-desc">
          Built this dashboard to demonstrate an end-to-end data engineering
          pipeline — from live API ingestion through cloud warehousing and dbt
          modelling, to a real-time frontend served without any paid compute.
        </p>
        <div class="profile-tags">${stackHTML}</div>
      </div>

      <!-- Icon row — pinned to bottom center of the card -->
      <div class="pf-icon-row">
        <div class="pf-icon-divider"></div>
        <div class="pf-icons">${iconsHTML}</div>
      </div>
    </div>`;

  // Inject styles once
  if (document.getElementById('profile-styles')) return;
  const style = document.createElement('style');
  style.id = 'profile-styles';
  style.textContent = `

    /* ── Outer card — single column, bio stacked above icons ── */
    .profile-wrap {
      display: flex;
      flex-direction: column;
      gap: 0;
      max-width: 860px;
      margin: 0 auto;
      background: linear-gradient(135deg, rgba(17,29,46,0.6), rgba(10,15,26,0.85));
      border: 1px solid var(--border-base);
      border-radius: var(--radius-xl);
      padding: 40px 44px 32px;
      position: relative;
      overflow: hidden;
    }

    /* top teal accent line */
    .profile-wrap::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; height: 2px;
      background: linear-gradient(90deg, transparent, var(--teal), #10b981, transparent);
    }

    /* slow shimmer sweep */
    .profile-wrap::after {
      content: '';
      position: absolute;
      top: 0; left: -70%; width: 40%; height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent);
      animation: profileShine 6s ease-in-out infinite;
      pointer-events: none;
    }

    /* ── Bio ── */
    .profile-eyebrow {
      font-family: var(--font-mono);
      font-size: 10px; font-weight: 700;
      letter-spacing: 2.5px; text-transform: uppercase;
      color: var(--teal); margin-bottom: 10px;
    }

    .profile-name {
      font-family: var(--font-mono);
      font-size: 28px; font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 14px; line-height: 1.1;
    }

    .profile-desc {
      font-family: var(--font-sans);
      font-size: 13px; color: var(--text-secondary);
      line-height: 1.75; margin: 0 0 20px;
    }

    .profile-tags {
      display: flex; flex-wrap: wrap; gap: 8px;
    }

    .profile-tag {
      font-family: var(--font-mono);
      font-size: 10px; font-weight: 700;
      color: var(--teal);
      background: rgba(20,184,166,0.08);
      border: 1px solid rgba(20,184,166,0.25);
      border-radius: var(--radius-full);
      padding: 4px 12px; letter-spacing: 0.5px;
      transition: background 0.2s ease, border-color 0.2s ease;
    }

    .profile-tag:hover {
      background: rgba(20,184,166,0.16);
      border-color: rgba(20,184,166,0.55);
    }

    /* ── Icon row — pinned to bottom of card ── */
    .pf-icon-row {
      margin-top: 32px;
      position: relative;
      z-index: 1;
    }

    /* thin separator line above icons */
    .pf-icon-divider {
      height: 1px;
      background: linear-gradient(90deg,
        transparent, var(--border-base), transparent);
      margin-bottom: 24px;
    }

    /* Icon links row — centered */
    .pf-icons {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 32px;
    }

    /* Each icon link — no bg, no border, just the image */
    .pf-icon-link {
      display: flex;
      align-items: center;
      justify-content: center;
      text-decoration: none !important;
      opacity: 0.65;
      animation: fadeInUp 0.5s ease both;
      transition: opacity 0.25s ease, transform 0.25s ease, filter 0.25s ease;
    }

    .pf-icon-link img {
      width: 36px; height: 36px;
      object-fit: contain;
      display: block;
      filter: drop-shadow(0 2px 6px rgba(0,0,0,0.3));
      transition: filter 0.25s ease, transform 0.25s ease;
    }

    /* Hover: icon brightens, scales up, gets brand colour glow */
    .pf-icon-link:hover {
      opacity: 1;
      transform: translateY(-3px);
    }

    .pf-icon-link:hover img {
      filter: drop-shadow(0 0 10px var(--ic, #14b8a6))
              drop-shadow(0 4px 12px rgba(0,0,0,0.4));
      transform: scale(1.15);
    }

    /* ── Responsive ── */
    @media (max-width: 700px) {
      .profile-wrap { padding: 28px 24px 24px; }
      .pf-icons { gap: 24px; }
      .pf-icon-link img { width: 30px; height: 30px; }
    }
  `;
  document.head.appendChild(style);

  // scroll entrance
  const wrap = section.querySelector('.profile-wrap');
  if (wrap && window.IntersectionObserver) {
    wrap.style.opacity   = '0';
    wrap.style.transform = 'translateY(24px)';
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        wrap.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        wrap.style.opacity    = '1';
        wrap.style.transform  = 'translateY(0)';
        obs.unobserve(wrap);
      }
    }, { threshold: 0.1 });
    obs.observe(wrap);
  }
}

// ── Main init ────────────────────────────────────────────────

async function init() {
  startClock();

  try {
    const data = await API.fetchAll();
    console.log('✅ API data loaded:', data);

    updateHeader(data.carbon);
    updateRenewableCard(data.carbon);
    updateCarbonCard(data.carbon);
    updateSpreadCard(data.spread);
    updateReservesCard(data.reserves);

    renderGauge(data.carbon);

    renderPrice24Chart(data.priceNodes);
    renderSummaryChart(data.priceSummary);
    renderTrendChart(data.carbonTrend);
    renderSpreadChart(data.spreadTrend);

    renderPipeline();
    renderProfile();

    setTimeout(initChartAnimations, 80);

  } catch (err) {
    console.error('❌ Dashboard init error:', err);
  } finally {
    const loading   = document.getElementById('loading-screen');
    const dashboard = document.getElementById('dashboard');
    if (loading)   loading.style.display = 'none';
    if (dashboard) dashboard.classList.remove('hidden');
    document.body.classList.add('ready');

    setInterval(async () => {
      try {
        const live = await API.fetchLive();
        updateHeader(live.carbon);
        updateRenewableCard(live.carbon);
        updateCarbonCard(live.carbon);
        updateSpreadCard(live.spread);
        updateReservesCard(live.reserves);
        console.log('🔄 Live data refreshed');
      } catch (err) {
        console.warn('⚠️ Refresh failed:', err);
      }
    }, CONFIG.REFRESH_INTERVAL_MS);
  }
}

document.addEventListener('DOMContentLoaded', init);