/* Proposal tracker snippet. Paste inline before </body>, after the two meta tags:
 *   <meta name="pt-endpoint" content="https://<worker>.workers.dev">
 *   <meta name="pt-id" content="<proposal-id>">
 * Each recipient gets their own link: <proposal-url>?r=<token>.
 * Mark slides worth watching with data-track="pricing" (or any name) on the <section class="slide">,
 * and buttons/links with data-track="<label>". Silent on file://, in print, in headless Chrome,
 * and for the owner (open once with ?pt=off to mute this browser, ?pt=on to undo).
 */
(function () {
  var q = new URLSearchParams(location.search);
  var ep = (document.querySelector('meta[name="pt-endpoint"]') || {}).content;
  var id = (document.querySelector('meta[name="pt-id"]') || {}).content;
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  if (q.get('pt') === 'off') ls('pt_owner', '1');
  if (q.get('pt') === 'on') ls('pt_owner', null);
  if (!ep || !id || location.protocol === 'file:' || navigator.webdriver || ls('pt_owner') === '1') return;
  if (/HeadlessChrome|bot|crawler|spider|preview/i.test(navigator.userAgent)) return;

  // Keep the recipient token for the whole visit, even if the page rewrites its URL.
  var r = q.get('r') || sessionStorage.getItem('pt_r') || '';
  try { sessionStorage.setItem('pt_r', r); } catch (e) {}
  function rid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
  var v = ls('pt_v'); if (!v) { v = rid(); ls('pt_v', v); }
  var s = rid();
  var queue = [{ t: 'open' }];

  function send() {
    if (!queue.length) return;
    var body = JSON.stringify({ p: id, r: r, v: v, s: s, ev: queue.splice(0, 50) });
    // text/plain keeps it a "simple" request: no CORS preflight, works with sendBeacon.
    var blob = new Blob([body], { type: 'text/plain' });
    if (!(navigator.sendBeacon && navigator.sendBeacon(ep + '/e', blob))) {
      fetch(ep + '/e', { method: 'POST', body: body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(function () {});
    }
  }

  // Time on each slide: counted only while the slide is mostly on screen AND the tab is visible.
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var shown = {}, since = {}, acc = {};
  function now() { return Date.now(); }
  function stop(i) { if (since[i]) { acc[i] = (acc[i] || 0) + now() - since[i]; since[i] = 0; } }
  function start(i) { if (shown[i] && !document.hidden && !since[i]) since[i] = now(); }
  function flushSlides() {
    slides.forEach(function (el, i) {
      stop(i);
      if (acc[i] >= 1000) queue.push({ t: 'slide', i: i, l: el.getAttribute('data-track') || el.id || null, ms: acc[i] });
      acc[i] = 0;
      start(i);
    });
  }
  if ('IntersectionObserver' in window && slides.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var i = slides.indexOf(e.target);
        shown[i] = e.intersectionRatio >= 0.5;
        if (shown[i]) start(i); else stop(i);
      });
    }, { threshold: [0, 0.5, 1] });
    slides.forEach(function (el) { io.observe(el); });
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-track]:not(.slide)');
    if (el) { queue.push({ t: 'cta', l: el.getAttribute('data-track') }); flushSlides(); send(); }
  }, true);

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { flushSlides(); queue.push({ t: 'close' }); send(); }
    else slides.forEach(function (_, i) { start(i); });
  });
  window.addEventListener('pagehide', function () { flushSlides(); send(); });
  setInterval(function () { if (!document.hidden) { flushSlides(); send(); } }, 15000);
  send();
})();
