/* ============================================================
   js/config.js
   Single place to change API URL between local and production.
   Every other JS file imports from here — never hardcode URLs.
   ============================================================ */

const CONFIG = {

  // ── API Base URL ────────────────────────────────────────
  // Change this ONE line when you deploy FastAPI to production.
  // Local dev:   "http://localhost:8000"
  // Production:  "https://your-api.onrender.com"  (or wherever)
  API_BASE: "http://localhost:8000",

  // ── Refresh interval ────────────────────────────────────
  // How often the dashboard polls the API for new data (ms).
  // 60000 = 60 seconds, matching your pipeline's 30min cron
  // (no point refreshing faster than the data changes)
  REFRESH_INTERVAL_MS: 60000,

  // ── Chart heights ────────────────────────────────────────
  // Keep in sync with --chart-h-main and --chart-h-sub in tokens.css
  CHART_H_MAIN: 590,
  CHART_H_SUB:  310,

  // ── Carbon gauge calibration ─────────────────────────────
  // These values are carried over exactly from your Streamlit gauge.
  GAUGE_VALUE_MIN:     0,
  GAUGE_VALUE_MAX:     150,
  GAUGE_ARC_LENGTH:    527.8,   // π × 168 (actual semicircle arc length)
  GAUGE_VISUAL_SCALE:  0.65,    // calibrated in Streamlit, keep this

  // ── Zone names (matches your Python ZONE_NAMES dict) ────
  ZONE_NAMES: {
    1:  "Northland",
    2:  "Auckland",
    3:  "Hamilton",
    4:  "Edgecumbe",
    5:  "Rotorua",
    6:  "Hawkes Bay",
    7:  "Bunnythorpe",
    8:  "Wellington",
    9:  "Nelson",
    10: "Christchurch",
    11: "Canterbury",
    12: "Waitaki",
    13: "Otago",
    14: "Invercargill",
  },

  // ── Node colors (matches your Python NODE_COLORS dict) ──
  NODE_COLORS: {
    "OTA2201": "#14b8a6",
    "HAY2201": "#10b981",
    "BEN2201": "#3b82f6",
    "WKM2201": "#f59e0b",
    "KIK2201": "#8b5cf6",
    "ISL2201": "#ef4444",
  },

  NODE_NAMES: {
    "OTA2201": "Auckland",
    "HAY2201": "Wellington",
    "BEN2201": "Benmore",
    "WKM2201": "Waikato",
    "KIK2201": "Kikiwhenua",
    "ISL2201": "Islington",
  },

  // ── Plotly shared layout ──────────────────────────────────
  // Mirrors your Python COMMON_LAYOUT dict exactly.
  // Import this into charts.js so all charts share the same look.
  PLOTLY_LAYOUT: {
    paper_bgcolor: "#0d1520",
    plot_bgcolor:  "#0d1520",
    font: {
      color:  "#e8f0f8",
      family: "'Space Mono', monospace",
      size:   10,
    },
    hovermode: "x unified",
    legend_title_text: "",
    hoverlabel: {
      bgcolor:     "#0a0f1a",
      bordercolor: "#1e3448",
      font: {
        family: "'Space Mono', monospace",
        size:   10,
      },
    },
  },

  // ── Plotly grid config ────────────────────────────────────
  // Mirrors your Python GRID dict.
  PLOTLY_GRID: {
    gridcolor:     "#152338",
    zerolinecolor: "#152338",
  },

};

// Freeze so nothing accidentally mutates it
Object.freeze(CONFIG);