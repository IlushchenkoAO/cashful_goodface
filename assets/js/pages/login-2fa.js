/* Second login step: authenticator code or a backup code. */
(function () {
  var ui = Cashful.ui;
  var api = Cashful.api;

  // Opened directly from the screen map → pretend the password step just passed
  if (!api.getChallenge()) api.demo.seedChallenge();

  var totpForm = ui.$('#totp-form');
  var backupForm = ui.$('#backup-form');
  var backup = ui.$('#backup');

  var otp = ui.otp(ui.$('#otp'), { onComplete: function () { totpForm.requestSubmit(); } });
  otp.focus();

  ui.$$('[data-switch]').forEach(function (b) {
    b.addEventListener('click', function () {
      ui.showView(b.dataset.switch);
      if (b.dataset.switch === 'totp') otp.focus();
    });
  });

  function done(res) {
    if (res.ok) ui.go(res.redirect);
    return res;
  }

  totpForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (api.strict && !otp.isComplete()) { otp.setError('Enter all 6 digits.'); return; }
    var btn = ui.$('button[type="submit"]', totpForm);
    ui.withLoading(btn, function () {
      return api.verify2FA(otp.value(), 'totp', totpForm.trust.checked).then(done).then(function (res) {
        if (!res.ok) otp.setError('That code isn’t right. Codes change every 30 seconds — use the latest one.');
      });
    });
  });

  backupForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (api.strict && !backup.value.trim()) { ui.setError(backup, 'Enter a backup code.'); return; }
    var btn = ui.$('button[type="submit"]', backupForm);
    ui.withLoading(btn, function () {
      return api.verify2FA(backup.value, 'backup', backupForm.trust.checked).then(done).then(function (res) {
        if (!res.ok) ui.setError(backup, 'This code isn’t valid or was already used.');
      });
    });
  });
})();
