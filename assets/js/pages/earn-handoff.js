/* Handoff from the mobile earn app: exchange a one-time token for a session, then open Payouts. */
(function () {
  var ui = Cashful.ui;
  var api = Cashful.api;

  var token = ui.params.get('token') || 'demo';
  var bar = ui.$('#bar');
  var progress = bar.parentElement;
  var pct = 0;

  // Creeps towards 90% while the request is in flight
  var timer = setInterval(function () {
    pct = Math.min(90, pct + (90 - pct) * 0.15);
    bar.style.width = pct + '%';
    progress.setAttribute('aria-valuenow', Math.round(pct));
  }, 120);

  // If it hangs, let the person continue manually
  var slow = setTimeout(function () { ui.$('#continue').hidden = false; }, 4000);

  api.handoff(token).then(function (res) {
    clearInterval(timer);
    clearTimeout(slow);
    if (!res.ok) { ui.showView('expired'); return; }
    ui.$('#device').textContent = res.device;
    bar.style.width = '100%';
    ui.go(res.redirect, 400);
  });
})();
