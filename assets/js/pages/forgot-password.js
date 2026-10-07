/* Forgot password → "check your email".
   The answer is the same whether or not the account exists. Demo: ?demo=sent */
(function () {
  var ui = Cashful.ui;
  var api = Cashful.api;

  var form = ui.$('#forgot-form');
  var email = ui.$('#email');
  var submit = ui.$('button[type="submit"]', form);
  var openLink = ui.$('#open-link');

  var prefill = Cashful.store.takeFlash('resetEmail');
  if (prefill) email.value = prefill;

  function send() {
    return api.requestReset(email.value).then(function (res) {
      ui.$('#sent-email').textContent = email.value.trim() || Cashful.config.seedUsers[0].email;
      // No account → no email would arrive, so the prototype has no link to open
      openLink.hidden = !res.token;
      if (res.token) openLink.href = 'reset-password.html?token=' + res.token;
      ui.showView('sent');
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (api.strict && !ui.isEmail(email.value)) { ui.setError(email, 'Enter a valid email, like you@example.com.'); email.focus(); return; }
    ui.withLoading(submit, send);
  });

  ui.$('#send-again').addEventListener('click', function (e) {
    var btn = e.currentTarget;
    btn.disabled = true;
    send().then(function () {
      ui.toast('Reset link sent again');
      setTimeout(function () { btn.disabled = false; }, 3000);
    });
  });

  if (ui.params.get('demo') === 'sent') {
    email.value = Cashful.config.seedUsers[0].email;
    form.requestSubmit();
  }
})();
