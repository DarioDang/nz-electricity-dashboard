/* ============================================================
   js/ecg.js
   ECG heartbeat — strictly one card at a time, in order.
   Card 1 → pause → Card 2 → pause → Card 3 → Card 4 → repeat.
   Low opacity so it acts as a background effect only.
   ============================================================ */

function initECG() {
  const cards = document.querySelectorAll('.kpi-card');
  if (!cards.length) return;

  // Hide old flow lines
  document.querySelectorAll('.kpi-flow-line').forEach(el => {
    el.style.display = 'none';
  });

  // Clean up previous SVGs
  document.querySelectorAll('.ecg-card-svg').forEach(el => el.remove());

  // ── Timing ───────────────────────────────────────────────
  const SWEEP_DUR  = 1800;   // ms — sweep duration per card
  const CARD_PAUSE = 200;    // ms — gap between cards
  const END_PAUSE  = 2400;   // ms — pause after last card before restart
  // Total cycle = 4 sweeps + 3 gaps + end pause
  const TOTAL_CYCLE = cards.length * SWEEP_DUR
                    + (cards.length - 1) * CARD_PAUSE
                    + END_PAUSE;

  // Start time of each card within one cycle
  const cardStarts = [];
  for (let i = 0; i < cards.length; i++) {
    cardStarts.push(i * (SWEEP_DUR + CARD_PAUSE));
  }

  // ── ECG path builder ─────────────────────────────────────
  function buildPath(W, H) {
    const midY  = H * 0.52;
    const spike = H * 0.30;
    const pts = [
      [0,        midY],
      [W * 0.18, midY],
      [W * 0.25, midY - H * 0.04],   // P wave
      [W * 0.31, midY],
      [W * 0.36, midY + H * 0.03],   // Q
      [W * 0.41, midY - spike],       // R spike
      [W * 0.45, midY + H * 0.12],   // S dip
      [W * 0.51, midY],
      [W * 0.57, midY - H * 0.06],   // T wave
      [W * 0.66, midY],
      [W,        midY],
    ];
    return 'M ' + pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L ');
  }

  // ── Create one SVG per card ───────────────────────────────
  const pathEls = [];
  const dotEls  = [];

  cards.forEach((card, idx) => {
    card.style.position = 'relative';

    const W = card.offsetWidth  || 200;
    const H = card.offsetHeight || 140;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('ecg-card-svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 0;
      overflow: hidden;
    `;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', buildPath(W, H));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#14b8a6');
    path.setAttribute('stroke-width', '1.2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.style.opacity = '0';

    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('r', '2.5');
    dot.setAttribute('fill', '#14b8a6');
    dot.style.cssText = `
      filter: drop-shadow(0 0 4px #14b8a6);
      opacity: 0;
    `;

    svg.appendChild(path);
    svg.appendChild(dot);
    card.insertBefore(svg, card.firstChild);

    const len = path.getTotalLength();
    path.style.strokeDasharray  = len;
    path.style.strokeDashoffset = len;

    pathEls.push({ path, dot, len });
  });

  // ── Single shared rAF loop ────────────────────────────────
  // All cards driven from one timer so they're perfectly in sync.

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  // MAX opacity — low enough to be background, visible enough to see
  const MAX_OPACITY = 0.20;

  let epochStart = null;

  function loop(ts) {
    if (!epochStart) epochStart = ts;

    const elapsed = (ts - epochStart) % TOTAL_CYCLE;

    pathEls.forEach(({ path, dot, len }, idx) => {
      const cs = cardStarts[idx];           // when this card starts
      const ce = cs + SWEEP_DUR;            // when this card ends

      // Is this card currently active?
      if (elapsed < cs || elapsed >= ce) {
        // Not active — fully hide and reset
        path.style.opacity = '0';
        dot.style.opacity  = '0';
        path.style.strokeDashoffset = len;
        return;
      }

      // Active — compute progress 0→1 within this card's window
      const rawT  = (elapsed - cs) / SWEEP_DUR;
      const drawT = easeInOut(rawT);

      // Draw line left to right
      path.style.strokeDashoffset = len * (1 - drawT);

      // Opacity: fade in first 10%, hold, fade out last 18%
      let opacity = 1;
      if (rawT < 0.10) opacity = rawT / 0.10;
      if (rawT > 0.82) opacity = 1 - (rawT - 0.82) / 0.18;
      const finalOp = Math.max(0, Math.min(1, opacity)) * MAX_OPACITY;

      path.style.opacity = finalOp;

      // Move glow dot to tip
      try {
        const pt = path.getPointAtLength(len * drawT);
        dot.setAttribute('cx', pt.x);
        dot.setAttribute('cy', pt.y);
        // Dot slightly brighter than line but still subtle
        dot.style.opacity = finalOp > 0.01 ? Math.min(finalOp * 2.5, 0.55) : '0';
      } catch (_) {}
    });

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  // Rebuild on resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(initECG, 300);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initECG, 900);
});