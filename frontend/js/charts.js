/* ============================================================
   js/charts.js
   All Plotly chart builders for the dashboard.
     renderPrice24Chart(rows)   ← Step 6  ✅
     renderSummaryChart(rows)   ← Step 7A ✅
     renderTrendChart(rows)     ← Step 7B ✅
     renderSpreadChart(rows)    ← Step 7C ✅
   ============================================================ */

// ── Shared Plotly layout defaults ───────────────────────────

const CHART_BASE_LAYOUT = {
  paper_bgcolor: 'transparent',
  plot_bgcolor:  'transparent',
  font: {
    family: 'Space Mono, monospace',
    color:  '#7a9bb5',
    size:   11,
  },
  margin: { t: 12, r: 16, b: 48, l: 56 },
  xaxis: {
    gridcolor:  'rgba(255,255,255,0.04)',
    linecolor:  'rgba(255,255,255,0.08)',
    tickcolor:  'rgba(255,255,255,0.08)',
    showgrid:   true,
    zeroline:   false,
    tickfont:   { size: 10, color: '#4a6a7a' },
  },
  yaxis: {
    gridcolor:  'rgba(255,255,255,0.04)',
    linecolor:  'rgba(255,255,255,0.08)',
    tickcolor:  'rgba(255,255,255,0.08)',
    showgrid:   true,
    zeroline:   false,
    tickfont:   { size: 10, color: '#4a6a7a' },
    tickprefix: '$',
    ticksuffix: '',
  },
  legend: {
    bgcolor:     'transparent',
    borderwidth: 0,
    orientation: 'h',
    x:           0,
    y:           -0.22,
    font:        { size: 10, color: '#7a9bb5' },
    itemclick:   'toggle',
  },
  hovermode: 'x unified',
  hoverlabel: {
    bgcolor:     '#0d1f2d',
    bordercolor: '#1e3a4a',
    font:        { family: 'Space Mono, monospace', size: 11, color: '#e2e8f0' },
  },
};

const PLOTLY_CONFIG = {
  displayModeBar: false,
  responsive:     true,
  scrollZoom:     false,
};

// ── Node colour palette ──────────────────────────────────────

const NODE_COLORS = {
  OTA2201: '#14b8a6',
  HAY2201: '#3b82f6',
  BEN2201: '#f59e0b',
  WKM2201: '#10b981',
  KIK2201: '#8b5cf6',
  ISL2201: '#ef4444',
};

const FALLBACK_COLORS = ['#94a3b8', '#64748b', '#475569'];

function nodeColor(nodeId, index) {
  return NODE_COLORS[nodeId] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

// ── Utilities ────────────────────────────────────────────────

function groupBy(rows, key) {
  return rows.reduce((acc, row) => {
    const k = row[key];
    if (!acc[k]) acc[k] = [];
    acc[k].push(row);
    return acc;
  }, {});
}

function renderNoData(containerId, message = 'No data available') {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `
    <div style="
      display:flex; align-items:center; justify-content:center;
      height:220px; color:#4a6a7a; font-family:'Space Mono',monospace;
      font-size:12px; flex-direction:column; gap:8px;
    ">
      <span style="font-size:24px; opacity:0.4;">📊</span>
      <span>${message}</span>
    </div>`;
}

function watchResize(containerId) {
  const el = document.getElementById(containerId);
  if (!el || !window.ResizeObserver) return;
  const ro = new ResizeObserver(() => Plotly.Plots.resize(el));
  ro.observe(el.parentElement || el);
}

// ── Animation helpers ────────────────────────────────────────

function animatedPlot(containerId, traces, layout, delay = 120) {
  const emptyTraces = traces.map(t => ({ ...t, y: [] }));
  Plotly.newPlot(containerId, emptyTraces, layout, PLOTLY_CONFIG);
  setTimeout(() => {
    Plotly.react(containerId, traces, layout, PLOTLY_CONFIG);
  }, delay);
}

function animatedSpreadPlot(containerId, traces, layout, delay = 150) {
  const emptyTraces = traces.map(t =>
    t.type === 'bar'
      ? { ...t, y: t.y.map(() => 0) }
      : { ...t, y: [] }
  );
  Plotly.newPlot(containerId, emptyTraces, layout, PLOTLY_CONFIG);
  setTimeout(() => {
    Plotly.react(containerId, traces, layout, PLOTLY_CONFIG);
  }, delay);
}

// ── Animation 2: Scroll entrance ────────────────────────────

function initChartScrollAnimations() {
  const chartIds = [
    'chart-price24',
    'chart-summary',
    'chart-trend',
    'chart-spread',
  ];

  if (window._chartScrollInitDone) return;
  window._chartScrollInitDone = true;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const delay = (entry.target.dataset.chartIndex || 0) * 80;
        entry.target.style.transition =
          `opacity 0.55s cubic-bezier(0.4,0,0.2,1) ${delay}ms,
           transform 0.55s cubic-bezier(0.4,0,0.2,1) ${delay}ms`;
        entry.target.style.opacity   = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
        const plotEl = entry.target;
        setTimeout(() => Plotly.Plots.resize(plotEl), 560);
      }
    });
  }, { threshold: 0.10, rootMargin: '0px 0px -32px 0px' });

  chartIds.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.dataset.chartIndex = i;
    el.style.opacity      = '0';
    el.style.transform    = 'translateY(24px)';
    observer.observe(el);
  });
}

// ── Animation 3: Panel hover glow ────────────────────────────

function injectChartPanelHoverStyles() {
  if (document.getElementById('chart-panel-hover-style')) return;
  const style = document.createElement('style');
  style.id = 'chart-panel-hover-style';
  style.textContent = `
    .chart-panel {
      transition: border-color 0.3s ease, box-shadow 0.3s ease, transform 0.2s ease;
    }
    .chart-panel:hover {
      border-color: rgba(20, 184, 166, 0.40) !important;
      box-shadow:   0 0 28px rgba(20, 184, 166, 0.08),
                    0 8px 32px rgba(0, 0, 0, 0.30) !important;
      transform:    translateY(-2px);
    }
    .chart-panel::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 2px;
      background: linear-gradient(90deg, #14b8a6, transparent);
      opacity: 0.4;
      transition: opacity 0.3s ease;
      border-radius: 14px 14px 0 0;
    }
    .chart-panel:hover::before {
      opacity: 1;
    }
  `;
  document.head.appendChild(style);
}

function initChartAnimations() {
  injectChartPanelHoverStyles();
  initChartScrollAnimations();
}


/* ============================================================
   Step 6 — Price Last 24 Hours
   ============================================================ */

function renderPrice24Chart(rows) {
  const containerId = 'chart-price24';
  if (!rows || rows.length === 0) {
    renderNoData(containerId, 'No price data available');
    return;
  }

  const byNode  = groupBy(rows, 'node_id');
  const nodeIds = Object.keys(byNode);

  const traces = nodeIds.map((nodeId, idx) => {
    const nodeRows = byNode[nodeId]
      .slice()
      .sort((a, b) => a.timestamp_nzt.localeCompare(b.timestamp_nzt));

    const x         = nodeRows.map(r => r.timestamp_nzt);
    const y         = nodeRows.map(r => r.price_nzd_mwh);
    const sample    = nodeRows[0];
    const label     = sample.city_name
      ? `${sample.city_name} (${sample.island})`
      : nodeId;
    const color     = nodeColor(nodeId, idx);
    const isRefNode = sample.is_reference_node;

    return {
      type: 'scatter', mode: 'lines',
      name: label, x, y,
      line: {
        color,
        width:     isRefNode ? 2 : 1.5,
        dash:      isRefNode ? 'solid' : 'dot',
        shape:     'spline',
        smoothing: 0.6,
      },
      opacity: isRefNode ? 1 : 0.7,
      hovertemplate:
        `<b>${label}</b><br>%{x|%d %b %H:%M} NZST<br><b>$%{y:.2f}/MWh</b><extra></extra>`,
    };
  });

  const priceBandShapes = [
    {
      type: 'rect', xref: 'paper', yref: 'y',
      x0: 0, x1: 1, y0: 0, y1: 80,
      fillcolor: 'rgba(16,185,129,0.04)', line: { width: 0 }, layer: 'below',
    },
    {
      type: 'rect', xref: 'paper', yref: 'y',
      x0: 0, x1: 1, y0: 80, y1: 200,
      fillcolor: 'rgba(245,158,11,0.04)', line: { width: 0 }, layer: 'below',
    },
    {
      type: 'line', xref: 'paper', yref: 'y',
      x0: 0, x1: 1, y0: 80, y1: 80,
      line: { color: 'rgba(245,158,11,0.25)', width: 1, dash: 'dash' },
    },
    {
      type: 'line', xref: 'paper', yref: 'y',
      x0: 0, x1: 1, y0: 200, y1: 200,
      line: { color: 'rgba(239,68,68,0.25)', width: 1, dash: 'dash' },
    },
  ];

  const bandAnnotations = [
    {
      xref: 'paper', yref: 'y', x: 1.01, y: 40,
      text: 'LOW', showarrow: false, xanchor: 'left',
      font: { size: 9, color: 'rgba(16,185,129,0.5)', family: 'Space Mono,monospace' },
    },
    {
      xref: 'paper', yref: 'y', x: 1.01, y: 140,
      text: 'MED', showarrow: false, xanchor: 'left',
      font: { size: 9, color: 'rgba(245,158,11,0.5)', family: 'Space Mono,monospace' },
    },
    {
      xref: 'paper', yref: 'y', x: 1.01, y: 220,
      text: 'HIGH', showarrow: false, xanchor: 'left',
      font: { size: 9, color: 'rgba(239,68,68,0.5)', family: 'Space Mono,monospace' },
    },
  ];

  const layout = {
    ...CHART_BASE_LAYOUT,
    margin: { t: 12, r: 40, b: 56, l: 56 },
    xaxis: {
      ...CHART_BASE_LAYOUT.xaxis,
      type:        'date',
      tickformat:  '%H:%M\n%d %b',
      dtick:       6 * 3600 * 1000,
      hoverformat: '%d %b %H:%M NZST',
    },
    yaxis: {
      ...CHART_BASE_LAYOUT.yaxis,
      tickprefix: '$',
      title: { text: '$/MWh', font: { size: 10, color: '#4a6a7a' }, standoff: 8 },
    },
    shapes:      priceBandShapes,
    annotations: bandAnnotations,
    legend: { ...CHART_BASE_LAYOUT.legend, y: -0.28 },
  };

  animatedPlot(containerId, traces, layout, 120);
  watchResize(containerId);
}


/* ============================================================
   Step 7A — Daily Market Summary
   Rolling 7-day window ending today.
   If less than 7 days of data exists, shows all available days
   without leaving empty space on the right.
   ============================================================ */

function renderSummaryChart(rows) {
  const containerId = 'chart-summary';
  if (!rows || rows.length === 0) {
    renderNoData(containerId, 'No summary data available');
    return;
  }

  const sorted = rows.slice().sort((a, b) => a.date_nzt.localeCompare(b.date_nzt));

  // ── Rolling 7-day window ──────────────────────────────────
  // Window end = latest date in data (not necessarily today).
  // Window start = 6 days before that, OR earliest available.
  // This means:
  //   - If 3 days of data: shows all 3, ticks every day
  //   - If 30 days of data: shows last 7, ticks every day
  //   - As new days arrive, window rolls forward automatically

  const latestDate  = new Date(sorted[sorted.length - 1].date_nzt + 'T00:00:00Z');
  const windowStart = new Date(latestDate);
  windowStart.setUTCDate(windowStart.getUTCDate() - 6);   // 7 days inclusive

  // Filter to window (use all data if less than 7 days)
  const earliestDate = new Date(sorted[0].date_nzt + 'T00:00:00Z');
  const effectiveStart = earliestDate > windowStart ? earliestDate : windowStart;

  const windowed = sorted.filter(r => {
    const d = new Date(r.date_nzt + 'T00:00:00Z');
    return d >= effectiveStart && d <= latestDate;
  });

  const x            = windowed.map(r => r.date_nzt);
  const avgPrice     = windowed.map(r => r.avg_price_ota);
  const avgCarbon    = windowed.map(r => r.avg_carbon_gkwh);
  const avgRenewable = windowed.map(r => r.avg_renewable_pct);

  // How many days of data do we actually have in the window?
  const dayCount = windowed.length;

  const traces = [
    {
      type: 'scatter', mode: 'lines+markers',
      name: 'Avg Price OTA', x, y: avgPrice, yaxis: 'y',
      line:   { color: '#14b8a6', width: 2.5, shape: 'spline', smoothing: 0.6 },
      marker: { size: 4, color: '#14b8a6' },
      hovertemplate: '<b>Avg Price</b>: $%{y:.2f}/MWh<extra></extra>',
    },
    {
      type: 'scatter', mode: 'lines',
      name: 'Carbon g/kWh', x, y: avgCarbon, yaxis: 'y',
      line: { color: '#f59e0b', width: 2, dash: 'dash', shape: 'spline', smoothing: 0.6 },
      hovertemplate: '<b>Carbon</b>: %{y:.1f} g/kWh<extra></extra>',
    },
    {
      type: 'scatter', mode: 'lines+markers',
      name: 'Renewable %', x, y: avgRenewable, yaxis: 'y2',
      line:   { color: '#10b981', width: 2, dash: 'dot', shape: 'spline', smoothing: 0.6 },
      marker: { size: 4, color: '#10b981' },
      hovertemplate: '<b>Renewable</b>: %{y:.1f}%<extra></extra>',
    },
  ];

  // ── X-axis range: fit exactly to data, no empty space ────
  // Add half-day padding on each side so first/last points
  // aren't clipped at the edge.
  const padMs      = 12 * 3600 * 1000;   // 12 hours padding
  const xRangeMin  = new Date(effectiveStart.getTime() - padMs).toISOString();
  const xRangeMax  = new Date(latestDate.getTime()    + padMs).toISOString();

  const layout = {
    ...CHART_BASE_LAYOUT,
    margin: { t: 12, r: 52, b: 64, l: 52 },
    xaxis: {
      ...CHART_BASE_LAYOUT.xaxis,
      type:        'date',
      tickformat:  '%d %b',
      // Always tick every day — Plotly skips if crowded
      dtick:       24 * 3600 * 1000,
      // Constrain to actual data range — no whitespace
      range:       [xRangeMin, xRangeMax],
      hoverformat: '%d %b %Y',
      // Limit visible ticks to 7 max
      nticks:      7,
    },
    yaxis: {
      ...CHART_BASE_LAYOUT.yaxis,
      tickprefix: '$',
      title: { text: '$/MWh · g/kWh', font: { size: 10, color: '#4a6a7a' }, standoff: 6 },
    },
    yaxis2: {
      overlaying: 'y', side: 'right', range: [0, 100],
      gridcolor:  'rgba(255,255,255,0.0)', zeroline: false,
      tickfont:   { size: 10, color: '#4a6a7a' }, ticksuffix: '%',
      title: { text: 'Renewable %', font: { size: 10, color: '#4a6a7a' }, standoff: 6 },
    },
    legend: { ...CHART_BASE_LAYOUT.legend, y: -0.32 },
  };

  animatedPlot(containerId, traces, layout, 160);
  watchResize(containerId);
}


/* ============================================================
   Step 7B — Carbon & Renewable Trend
   ============================================================ */

function renderTrendChart(rows) {
  const containerId = 'chart-trend';
  if (!rows || rows.length === 0) {
    renderNoData(containerId, 'No trend data available');
    return;
  }

  const sorted    = rows.slice().sort((a, b) => a.timestamp_nzt.localeCompare(b.timestamp_nzt));
  const x         = sorted.map(r => r.timestamp_nzt);
  const carbon    = sorted.map(r => r.nz_carbon_gkwh);
  const renewable = sorted.map(r => r.renewable_pct);

  const traces = [
    {
      type: 'scatter', mode: 'lines',
      name: 'Carbon g/kWh', x, y: carbon, yaxis: 'y',
      fill: 'tozeroy', fillcolor: 'rgba(245,158,11,0.08)',
      line: { color: '#f59e0b', width: 2.5, shape: 'spline', smoothing: 0.6 },
      hovertemplate: '<b>Carbon</b>: %{y:.1f} g/kWh<extra></extra>',
    },
    {
      type: 'scatter', mode: 'lines',
      name: 'Renewable %', x, y: renewable, yaxis: 'y2',
      fill: 'tozeroy', fillcolor: 'rgba(20,184,166,0.06)',
      line: { color: '#14b8a6', width: 2.5, shape: 'spline', smoothing: 0.6 },
      hovertemplate: '<b>Renewable</b>: %{y:.1f}%<extra></extra>',
    },
  ];

  const layout = {
    ...CHART_BASE_LAYOUT,
    margin: { t: 12, r: 52, b: 64, l: 52 },
    xaxis: {
      ...CHART_BASE_LAYOUT.xaxis,
      type:        'date',
      tickformat:  '%d %b\n%H:%M',
      dtick:       24 * 3600 * 1000,
      hoverformat: '%d %b %H:%M NZST',
    },
    yaxis: {
      ...CHART_BASE_LAYOUT.yaxis,
      tickprefix: '', ticksuffix: '',
      title: { text: 'Carbon g/kWh', font: { size: 10, color: '#4a6a7a' }, standoff: 6 },
    },
    yaxis2: {
      overlaying: 'y', side: 'right', range: [0, 100],
      gridcolor:  'rgba(255,255,255,0.0)', zeroline: false,
      tickfont:   { size: 10, color: '#4a6a7a' }, ticksuffix: '%',
      title: { text: 'Renewable %', font: { size: 10, color: '#4a6a7a' }, standoff: 6 },
    },
    legend: { ...CHART_BASE_LAYOUT.legend, y: -0.32 },
  };

  animatedPlot(containerId, traces, layout, 200);
  watchResize(containerId);
}


/* ============================================================
   Step 7C — NI/SI Price Spread
   ============================================================ */

function renderSpreadChart(rows) {
  const containerId = 'chart-spread';
  if (!rows || rows.length === 0) {
    renderNoData(containerId, 'No spread data available');
    return;
  }

  const sorted = rows.slice().sort((a, b) => a.timestamp_nzt.localeCompare(b.timestamp_nzt));
  const x      = sorted.map(r => r.timestamp_nzt);
  const ota    = sorted.map(r => r.ota_price);
  const ben    = sorted.map(r => r.ben_price);
  const spread = sorted.map(r => r.ni_si_spread);

  const barColors = spread.map(v =>
    v > 0 ? 'rgba(239,68,68,0.45)' : 'rgba(16,185,129,0.45)'
  );

  const traces = [
    {
      type: 'scatter', mode: 'lines',
      name: 'Auckland (OTA)', x, y: ota, yaxis: 'y',
      line: { color: '#14b8a6', width: 2, shape: 'spline', smoothing: 0.6 },
      hovertemplate: '<b>Auckland</b>: $%{y:.2f}/MWh<extra></extra>',
    },
    {
      type: 'scatter', mode: 'lines',
      name: 'Benmore (BEN)', x, y: ben, yaxis: 'y',
      line: { color: '#3b82f6', width: 2, shape: 'spline', smoothing: 0.6 },
      hovertemplate: '<b>Benmore</b>: $%{y:.2f}/MWh<extra></extra>',
    },
    {
      type: 'bar',
      name: 'NI/SI Spread', x, y: spread, yaxis: 'y2',
      marker: { color: barColors },
      hovertemplate: '<b>Spread</b>: $%{y:.2f}/MWh<extra></extra>',
    },
  ];

  const layout = {
    ...CHART_BASE_LAYOUT,
    margin:  { t: 12, r: 52, b: 64, l: 52 },
    barmode: 'overlay',
    xaxis: {
      ...CHART_BASE_LAYOUT.xaxis,
      type:        'date',
      tickformat:  '%H:%M\n%d %b',
      dtick:       6 * 3600 * 1000,
      hoverformat: '%d %b %H:%M NZST',
    },
    yaxis: {
      ...CHART_BASE_LAYOUT.yaxis,
      tickprefix: '$',
      title: { text: '$/MWh', font: { size: 10, color: '#4a6a7a' }, standoff: 6 },
    },
    yaxis2: {
      overlaying:    'y', side: 'right',
      gridcolor:     'rgba(255,255,255,0.0)',
      zeroline:      true, zerolinecolor: 'rgba(255,255,255,0.08)',
      tickfont:      { size: 10, color: '#4a6a7a' }, tickprefix: '$',
      title: { text: 'Spread $/MWh', font: { size: 10, color: '#4a6a7a' }, standoff: 6 },
    },
    legend: { ...CHART_BASE_LAYOUT.legend, y: -0.32 },
  };

  animatedSpreadPlot(containerId, traces, layout, 150);
  watchResize(containerId);
}