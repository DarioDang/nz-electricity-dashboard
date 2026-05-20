/* js/clock.js — NZ live clock */
function startClock() {
  function tick() {
    const el = document.getElementById('nz-live-clock');
    if (!el) return;
    const now = new Date();
    const timeStr = new Intl.DateTimeFormat('en-NZ', {
      timeZone: 'Pacific/Auckland',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).format(now);
    const dateStr = new Intl.DateTimeFormat('en-NZ', {
      timeZone: 'Pacific/Auckland',
      day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(now);
    const tzName = new Intl.DateTimeFormat('en-NZ', {
      timeZone: 'Pacific/Auckland', timeZoneName: 'short',
    }).formatToParts(now).find(p => p.type === 'timeZoneName')?.value || 'NZST';
    el.textContent = `${timeStr} ${tzName} ${dateStr}`;
  }
  tick();
  setInterval(tick, 1000);
}