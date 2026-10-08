/* Verify email after sign-up.
   States: waiting (resend countdown) · wrong/expired code · new code sent.
   Demo: ?demo=error | ?demo=resent, ?type=developer when opened without a sign-up. */
(function () {
  var ui = Cashful.ui;
  var api = Cashful.api;

  // Opened directly (screen map, refresh after storage reset) → create a demo sign-up
  if (!api.getPending()) api.demo.seedPending(ui.params.get('type') === 'developer' ? 'developer' : 'personal');
  var pending = api.getPending();

  ui.$$('aside[data-for]').forEach(function (a) { a.hidden = a.dataset.for !== pending.type; });
  ui.$$('[data-email]').forEach(function (el) { el.textContent = pending.email; });
  ui.$('#ttl').textContent = Cashful.config.rules.emailCodeTtlMin;

  var form = ui.$('#verify-form');
  var submit = ui.$('button[type="submit"]', form);
  var alertSlot = ui.$('#alert-slot');
  var resendBtn = ui.$('#resend');
  var resendWait = ui.$('#resend-wait');
  var stopTimer = null;

  var otp = ui.otp(ui.$('#otp'), {
    onComplete: function () { form.requestSubmit(); }
  });
  otp.focus();

  function startResendTimer(until) {
    if (stopTimer) stopTimer();
    resendBtn.hidden = true;
    resendWait.hidden = false;
    stopTimer = ui.countdown(until, function (left) {
      ui.$('#resend-timer').textContent = ui.formatTime(left);
    }, function () {
      resendWait.hidden = true;
      resendBtn.hidden = false;
    });
  }
  startResendTimer(pending.resendAt);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (api.strict && !otp.isComplete()) { otp.setError('Enter all 6 digits.'); otp.focus(); return; }
    ui.withLoading(submit, function () {
      return api.verifyEmail(otp.value()).then(function (res) {
        if (res.ok) {
          Cashful.store.flash('justVerified', true);
          return ui.go(res.redirect);
        }
        ui.alert(alertSlot, null);
        if (res.error === 'expired') otp.setError('This code has expired. Request a new one.');
        else otp.setError('That code isn’t right. Check the latest email or request a new code.');
        // After a wrong code, resending is allowed right away
        if (stopTimer) stopTimer();
        resendWait.hidden = true;
        resendBtn.hidden = false;
      });
    });
  });

  resendBtn.addEventListener('click', function () {
    resendBtn.disabled = true;
    api.resendCode().then(function (res) {
      resendBtn.disabled = false;
      if (!res.ok) return;
      ui.alert(alertSlot, { tone: 'success', title: 'New code sent', text: 'Check ' + res.pending.email + '. Earlier codes no longer work.' });
      otp.clear();
      startResendTimer(res.pending.resendAt);
    });
  });

  ui.$('#change-email').addEventListener('click', function (e) {
    e.preventDefault();
    var p = api.cancelPending();
    Cashful.store.flash('authEmail', p ? p.email : '');
    ui.go('auth.html' + (p ? '?type=' + (p.type === 'developer' ? 'developer' : 'peer') : ''));
  });

  /* Demo states */
  var demo = ui.params.get('demo');
  if (demo === 'error') {
    otp.set('123456');
    otp.setError('That code isn’t right. Check the latest email or request a new code.');
    if (stopTimer) stopTimer();
    resendWait.hidden = true;
    resendBtn.hidden = false;
  }
  if (demo === 'resent') { resendBtn.hidden = false; resendBtn.click(); }
})();
