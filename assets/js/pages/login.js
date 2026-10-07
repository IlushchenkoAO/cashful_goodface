/* Log in.
   States: default · wrong email or password · locked after N failures (live countdown) · logged out.
   Demo: ?state=logged-out | ?demo=error | ?demo=locked
   In prototype mode (config.strictValidation = false) any email and password log in. */
(function () {
  var ui = Cashful.ui;
  var api = Cashful.api;
  var rules = Cashful.config.rules;

  var form = ui.$('#login-form');
  var email = ui.$('#email');
  var password = ui.$('#password');
  var remember = ui.$('#remember');
  var submit = ui.$('#submit');
  var lockedReset = ui.$('#locked-reset');
  var alertSlot = ui.$('#alert-slot');
  var stopLock = null;

  var prefill = Cashful.store.takeFlash('loginEmail');
  if (prefill) email.value = prefill;

  if (ui.params.get('state') === 'logged-out') {
    ui.alert(alertSlot, { tone: 'success', title: 'You’ve logged out', text: 'Log in again any time. Your devices keep earning in the meantime.' });
  }

  // "Forgot password?" carries the typed email to the reset form
  ui.$$('[data-carry-email]').forEach(function (a) {
    a.addEventListener('click', function () { Cashful.store.flash('resetEmail', email.value.trim()); });
  });

  function setLocked(until) {
    if (stopLock) stopLock();
    [email, password, remember].forEach(function (i) { ui.setDisabled(i, true); });
    ui.setError(password, '');
    lockedReset.hidden = false;
    submit.disabled = true;
    ui.alert(alertSlot, {
      tone: 'error',
      title: 'Too many attempts',
      text: 'For your security, logging in is paused for ' + rules.lockMinutes + ' minutes. You can reset your password now.'
    });
    stopLock = ui.countdown(until, function (left) {
      submit.textContent = 'Try again in ' + ui.formatTime(left);
    }, unlock);
  }

  function unlock() {
    [email, password, remember].forEach(function (i) { ui.setDisabled(i, false); });
    lockedReset.hidden = true;
    submit.disabled = false;
    submit.textContent = 'Log in';
    ui.alert(alertSlot, null);
    password.value = '';
    password.focus();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (api.strict) {
      var ok = true;
      if (!ui.isEmail(email.value)) { ui.setError(email, 'Enter a valid email.'); ok = false; }
      if (!password.value) { ui.setError(password, 'Enter your password.'); ok = false; }
      if (!ok) return;
    }

    ui.withLoading(submit, function () {
      return api.logIn({ email: email.value, password: password.value, remember: remember.checked });
    }).then(function (res) {
      if (res.status === 'ok') return ui.go(res.redirect);
      if (res.status === '2fa') return ui.go('login-2fa.html');
      if (res.status === 'locked') return setLocked(res.until);
      showWrongPassword();
    });
  });

  function showWrongPassword() {
    ui.alert(alertSlot, {
      tone: 'error',
      title: 'Wrong email or password',
      text: 'Check both and try again. After ' + rules.maxLoginAttempts + ' failed attempts, logging in pauses for ' + rules.lockMinutes + ' minutes.'
    });
    ui.setError(password, 'Wrong email or password.');
  }

  // Lock survives reloads: check the typed email whenever it changes
  email.addEventListener('change', function () {
    var until = api.lockState(email.value);
    if (until) setLocked(until);
  });

  /* Demo states */
  var demo = ui.params.get('demo');
  var demoEmail = Cashful.config.seedUsers[0].email;
  if (demo === 'error') {
    email.value = demoEmail;
    password.value = 'wrong-password';
    showWrongPassword();
  }
  if (demo === 'locked') {
    email.value = demoEmail;
    password.value = '••••••••';
    api.demo.lock(demoEmail);
  }

  var lockedUntil = email.value && api.lockState(email.value);
  if (lockedUntil) setLocked(lockedUntil);
})();
