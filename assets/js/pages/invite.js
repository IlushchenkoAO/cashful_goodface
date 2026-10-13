/* Joining a Developer account by invitation. ?token=<invitation> (demo-new | demo-existing | demo-expired for the demo panel).

     landing ──► (the email has an account)  sign in ──► accept ──► the account opens (Analytics)
            └─► (no account yet)            sign up, email locked ──► the account opens; a Personal account is made as well
     invalid  (expired, revoked, already used, unknown) — "This invitation is no longer valid"

   Already signed in as the invited email: straight to Accept invitation. Signed in as someone else: log out first.
   Two-step sign-in (2FA) comes back here afterwards (flash inviteToken). Any password is accepted in prototype mode. */
(function () {
  var ui = Cashful.ui;
  var api = Cashful.api;
  var esc = ui.esc;
  var view = ui.$('#auth-view');

  var tokenId = ui.params.get('token') || '';
  api.team.ensureDemo(tokenId);          // the demo links are made again every time
  var info = api.team.getInvite(tokenId);
  var inv = info.invite, org = info.org;
  var ROLE = Cashful.ROLE_LABELS;
  var ROLE_TEXT = {
    admin: 'As an Admin you can manage apps, payouts, the team and company details.',
    member: 'As a Member you can see analytics and work on apps and the SDK. Payouts and team management stay with admins.'
  };

  function head(title, lead) {
    return '<div class="auth__head"><h1 class="auth__title" id="auth-title" tabindex="-1">' + esc(title) + '</h1>' + (lead ? '<p class="auth__lead">' + lead + '</p>' : '') + '</div>';
  }
  function slot() { return '<div id="alert-slot" hidden></div>'; }
  function alertIn(a) { ui.alert(ui.$('#alert-slot', view), a); }
  function summary() {
    var by = info.inviter ? info.inviter.name || info.inviter.email : 'An account admin';
    return '<div class="auth__invite"><span class="cf-avatar">' + esc(initials(org.name)) + '</span><div class="auth__invite-text">' +
      '<strong class="t-body">' + esc(by) + ' invited you</strong>' +
      '<span class="t-body t-secondary">Role: <strong>' + esc(ROLE[inv.role]) + '</strong>. ' + esc(ROLE_TEXT[inv.role]) + '</span></div></div>';
  }
  function initials(name) { return name.split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase(); }

  function show(html, after) {
    view.innerHTML = html;
    if (after) after();
    var first = ui.$('input:not([disabled])', view);
    if (first) first.focus(); else { var h = ui.$('#auth-title', view); if (h) h.focus(); }
  }

  /* ---------- No longer valid ---------- */

  function invalid() {
    show(head('This invitation is no longer valid', 'It may have expired, been revoked, or already been used. Ask an admin of the account to send you a new one.') +
      '<a class="cf-btn cf-btn--primary cf-btn--block" href="auth.html">Go to Cashful</a>');
  }

  /* ---------- Landing ---------- */

  function landing() {
    var exists = info.hasAccount;
    show(head('Join ' + org.name + ' on Cashful', 'You were invited to work on this developer account.') + summary() +
      '<p class="t-body t-secondary">The invitation is for <strong>' + esc(inv.email) + '</strong>.</p>' +
      '<button type="button" class="cf-btn cf-btn--primary cf-btn--block" data-act="go">' + (exists ? 'Sign in to join' : 'Create account and join') + '</button>', function () {
        ui.$('[data-act="go"]', view).addEventListener('click', exists ? signIn : signUp);
      });
  }

  /* ---------- Has an account: sign in, then accept ---------- */

  function signIn() {
    show(head('Sign in to join ' + org.name, 'Sign in as <strong>' + esc(inv.email) + '</strong> to accept the invitation.') + slot() +
      '<form class="auth__fields" id="signin-form" novalidate>' +
        ui.fieldHtml({ id: 'email', name: 'email', label: 'Email', type: 'email', value: inv.email, noSample: true }) +
        '<div class="cf-input"><label class="cf-input__label" for="password">Password</label><div class="cf-field"><input class="cf-field__input" id="password" name="password" type="password" autocomplete="current-password"></div><div class="cf-input__helper"></div></div>' +
        '<button type="submit" class="cf-btn cf-btn--primary cf-btn--block" id="submit">Sign in</button>' +
      '</form>', function () {
        var form = ui.$('#signin-form', view), pw = ui.$('#password', form), submit = ui.$('#submit', form);
        ui.setDisabled(ui.$('#email', form), true);
        pw.focus();
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          if (api.strict && !pw.value) { ui.setError(pw, 'Enter your password.'); pw.focus(); return; }
          alertIn(null);
          ui.withLoading(submit, function () { return api.logIn({ email: inv.email, password: pw.value, remember: false }); }).then(function (res) {
            if (res.status === 'ok') return accept();
            if (res.status === '2fa') { Cashful.store.flash('inviteToken', tokenId); return ui.go('login-2fa.html'); }
            if (res.status === 'locked') return alertIn({ tone: 'error', title: 'Too many attempts', text: 'Logging in is paused for a few minutes.' });
            alertIn({ tone: 'error', title: 'Wrong email or password' });
            ui.setError(pw, 'Wrong email or password.');
          });
        });
      });
  }

  function accept() {
    show(head('Accept invitation', 'Join <strong>' + esc(org.name) + '</strong> as ' + (inv.role === 'admin' ? 'an Admin' : 'a Member') + '.') + summary() + slot() +
      '<button type="button" class="cf-btn cf-btn--primary cf-btn--block" id="accept">Accept invitation</button>' +
      '<p class="t-caption t-secondary">The account will appear in your account switcher. Your Personal account stays as it is.</p>', function () {
        var btn = ui.$('#accept', view);
        btn.addEventListener('click', function () {
          ui.withLoading(btn, function () { return new Promise(function (r) { setTimeout(r, 400); }); }).then(function () {
            var res = api.team.accept(tokenId);
            if (!res.ok) return invalid();
            ui.go(res.redirect);
          });
        });
      });
  }

  /* ---------- No account: sign up with the locked email ---------- */

  function signUp() {
    show(head('Create your account', 'You’ll join <strong>' + esc(org.name) + '</strong> right after. We also set up your Personal account.') + slot() +
      '<form class="auth__fields" id="signup-form" novalidate>' +
        ui.fieldHtml({ id: 'email', name: 'email', label: 'Email', type: 'email', value: inv.email, noSample: true, helper: 'This is the email the invitation was sent to.' }) +
        '<div class="cf-input"><label class="cf-input__label" for="password">Create a password</label><div class="cf-field"><input class="cf-field__input" id="password" name="password" type="password" autocomplete="new-password"></div><div class="cf-input__helper">At least 8 characters.</div></div>' +
        '<button type="submit" class="cf-btn cf-btn--primary cf-btn--block" id="submit">Create account and join</button>' +
      '</form>' +
      '<p class="auth__legal">By continuing, you agree to the <a href="#">Terms</a>, <a href="#">Acceptable use policy</a> and <a href="#">Privacy policy</a>.</p>', function () {
        var form = ui.$('#signup-form', view), pw = ui.$('#password', form), submit = ui.$('#submit', form);
        ui.setDisabled(ui.$('#email', form), true);
        pw.focus();
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var value = pw.value || (api.strict ? '' : 'prototype-password');
          if (api.strict && value.length < 8) { ui.setError(pw, 'Use at least 8 characters.'); pw.focus(); return; }
          ui.withLoading(submit, function () { return api.signUpFromInvite(tokenId, value); }).then(function (res) {
            if (res.ok) return ui.go(res.redirect);
            if (res.error === 'has_account') return signIn();
            invalid();
          });
        });
      });
  }

  /* ---------- Start ---------- */

  if (info.state !== 'ok') { invalid(); return; }

  var me = api.currentUser();
  if (me && me.email === inv.email) { accept(); return; }
  if (me) {
    show(head('Join ' + org.name + ' on Cashful', 'The invitation is for <strong>' + esc(inv.email) + '</strong>, but you’re signed in as <strong>' + esc(me.email) + '</strong>.') + summary() +
      '<button type="button" class="cf-btn cf-btn--primary cf-btn--block" data-act="out">Log out and continue</button>', function () {
        ui.$('[data-act="out"]', view).addEventListener('click', function () { api.logOut().then(function () { location.reload(); }); });
      });
    return;
  }
  landing();
})();
