/* Reset password from the emailed link.
   ?token=<from forgot-password> | ?token=demo (always valid) | ?token=expired
   Demo: ?token=demo&demo=done */
(function () {
  var ui = Cashful.ui;
  var api = Cashful.api;

  var token = ui.params.get('token') || '';
  var form = ui.$('#reset-form');
  var password = ui.$('#password');
  var confirm = ui.$('#confirm');
  var logoutOthers = ui.$('#logout-others');
  var submit = ui.$('button[type="submit"]', form);

  var link = api.checkResetToken(token);
  if (!link) {
    ui.$('#back-link').hidden = false;
    ui.showView('expired');
    return;
  }

  ui.$$('[data-email]').forEach(function (el) { el.textContent = link.email; });
  ui.$('[data-email-input]').value = link.email;
  ui.showView('form');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var ok = true;
    if (api.strict && !ui.isStrongPassword(password.value)) {
      ui.setError(password, 'Use 8 or more characters with at least one number.');
      ok = false;
    }
    if (api.strict && confirm.value !== password.value) {
      ui.setError(confirm, 'Passwords don’t match.');
      ok = false;
    }
    if (!ok) return;

    ui.withLoading(submit, function () {
      return api.resetPassword(token, password.value, logoutOthers.checked);
    }).then(function (res) {
      if (!res.ok) { ui.showView('expired'); return; }
      ui.$('#done-logout').hidden = !logoutOthers.checked;
      ui.$('#done-login').addEventListener('click', function () { Cashful.store.flash('loginEmail', res.email); });
      ui.showView('done');
    });
  });

  if (ui.params.get('demo') === 'done') {
    password.value = confirm.value = 'cashful123';
    form.requestSubmit();
  }
})();
