/* Settings — Personal accounts. Stacked cards that save on their own:
   Profile · Security (password, two-factor) · Notifications · Account type · Legal · Delete account.
   Business values come from settings.config.js. Passwords and 2FA codes are never logged or stored.
   ?state=<preset> opens a state for review (see PRESETS in data/settings.js). */
(function () {
  if (!Cashful.app) return;
  var ui = Cashful.ui;
  var api = Cashful.api;
  var fmt = Cashful.fmt;
  var S = Cashful.settings;
  var P = Cashful.payouts;
  var esc = ui.esc;

  var user = Cashful.app.user;
  var presetId = S.preset(ui.params.get('state'));
  var c = S.settings(presetId);
  var state = S.createState(presetId, user);
  var root = ui.$('#settings');

  function later(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
  function icon(name, size) { return '<cf-icon name="' + name + '" size="' + (size || 20) + '"></cf-icon>'; }
  function body(id) { return ui.$('[data-body="' + id + '"]', root); }

  /* ---------- Shared bits ---------- */

  function actions(label) {
    return '<div class="set-actions"><span class="set-saved" role="status"></span>' +
      '<button type="submit" class="cf-btn cf-btn--primary" disabled>' + label + '</button></div>';
  }
  function setSaved(form, text) {
    ui.$('.set-saved', form).innerHTML = text ? icon('check-circle', 16) + '<span>' + esc(text) + '</span>' : '';
  }
  function firstInvalid(form) { return ui.$('.cf-input.is-error .cf-field__input', form); }

  function card(id, title, desc, extraClass) {
    return '<section class="cf-card set-card' + (extraClass ? ' ' + extraClass : '') + '" id="set-' + id + '" aria-labelledby="set-' + id + '-title">' +
      '<div class="set-card__head"><h2 class="cf-card__title" id="set-' + id + '-title">' + title + '</h2>' +
      (desc ? '<p class="t-muted">' + desc + '</p>' : '') + '</div>' +
      '<div data-body="' + id + '"></div></section>';
  }

  /* ---------- Profile ---------- */

  function renderProfile(savedText) {
    var p = state.profile;
    var pending = state.emailPending;

    var country = c.countryEditable
      ? ui.selectHtml({ id: 'set-country', name: 'country', label: 'Country', options: S.COUNTRIES, value: p.country })
      : ui.fieldHtml({ id: 'set-country', name: 'country', label: 'Country', value: p.country, disabled: true,
          helperHtml: '<a href="mailto:' + esc(c.supportEmail) + '?subject=' + encodeURIComponent('Change my country') + '">Contact support to change</a>' });

    var pendingBox = pending
      ? '<div class="set-pending">' +
          ui.alertHtml({ tone: 'info', title: 'Verification sent to ' + pending, text: 'Your current email stays active until you verify the new one.' }) +
          '<div class="set-pending__actions"><button type="button" class="cf-btn cf-btn--secondary cf-btn--sm" data-act="resend">Resend</button>' +
          '<button type="button" class="cf-btn cf-btn--ghost cf-btn--sm" data-act="cancel-email">Cancel change</button></div></div>'
      : '';

    body('profile').innerHTML = '<form class="set-form" id="profile-form" novalidate>' +
      ui.fieldHtml({ id: 'set-name', name: 'name', label: 'Name', value: p.name, autocomplete: 'name' }) +
      ui.fieldHtml({ id: 'set-email', name: 'email', label: 'Email', value: p.email, type: 'email', autocomplete: 'email', spellcheck: false, disabled: !!pending,
        helper: pending ? '' : 'If you change it, we send a link to confirm the new address.' }) +
      pendingBox + country + actions('Save changes') + '</form>';

    var form = ui.$('#profile-form', root);
    var save = ui.$('button[type="submit"]', form);
    if (savedText) setSaved(form, savedText);

    function dirty() {
      var v = readProfile();
      return v.name !== p.name || (!pending && v.email !== p.email) || (c.countryEditable && v.country !== p.country);
    }
    function readProfile() {
      return {
        name: form.elements.name.value.trim(),
        email: form.elements.email.value.trim(),
        country: c.countryEditable ? form.elements.country.value : p.country
      };
    }
    function sync() { save.disabled = !dirty(); setSaved(form, ''); }
    form.addEventListener('input', sync);
    form.addEventListener('change', sync);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = readProfile();
      var emailChanged = !pending && v.email !== p.email;
      ui.setError(form.elements.name, v.name ? '' : 'Enter your name.');
      ui.setError(form.elements.email, emailChanged && !ui.isEmail(v.email) ? 'Enter a valid email, like you@example.com.' : '');
      var bad = firstInvalid(form);
      if (bad) { bad.focus(); return; }

      ui.withLoading(save, function () { return later(400); }).then(function () {
        p.name = v.name;
        p.country = v.country;
        if (emailChanged) state.emailPending = v.email;
        var nameEl = ui.$('.cf-usercard__name');
        if (nameEl) nameEl.textContent = p.name;
        renderProfile(emailChanged ? 'Saved. Verify your new email to finish.' : 'Changes saved.');
      });
    });

    ui.$$('[data-act]', form).forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.act === 'resend') {
          ui.toast('Verification email sent again');
        } else {
          state.emailPending = null;
          renderProfile();
          ui.$('#set-email', root).focus();
        }
      });
    });
  }

  /* ---------- Security: password ---------- */

  var PASSWORD_HELP = 'Use at least 8 characters.';

  function renderPassword() {
    body('security').querySelector('[data-part="password"]').innerHTML =
      '<h3 class="set-sub">Password</h3>' +
      '<form class="set-form" id="password-form" novalidate>' +
        ui.fieldHtml({ id: 'pw-current', name: 'current', label: 'Current password', type: 'password', autocomplete: 'current-password' }) +
        ui.fieldHtml({ id: 'pw-new', name: 'next', label: 'New password', type: 'password', autocomplete: 'new-password', helper: PASSWORD_HELP }) +
        ui.fieldHtml({ id: 'pw-confirm', name: 'confirm', label: 'Confirm new password', type: 'password', autocomplete: 'new-password' }) +
        actions('Update password') + '</form>';

    var form = ui.$('#password-form', root);
    var save = ui.$('button[type="submit"]', form);
    var fields = { current: form.elements.current, next: form.elements.next, confirm: form.elements.confirm };

    form.addEventListener('input', function (e) {
      save.disabled = !(fields.current.value || fields.next.value || fields.confirm.value);
      setSaved(form, '');
      if (e.target === fields.next) {
        ui.setHelper(fields.next, fields.next.value ? S.passwordStrength(fields.next.value).hint : PASSWORD_HELP);
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = { current: fields.current.value, next: fields.next.value, confirm: fields.confirm.value };
      var errors = S.validatePassword(v);
      Object.keys(fields).forEach(function (k) { ui.setError(fields[k], errors[k] || ''); });
      var bad = firstInvalid(form);
      if (bad) { bad.focus(); return; }

      ui.withLoading(save, function () { return later(600); }).then(function () {
        // Mock: this exact value stands in for a wrong current password
        if (v.current === 'wrong-password') {
          ui.setError(fields.current, 'Current password is incorrect.');
          fields.current.focus();
          save.disabled = false;
          return;
        }
        renderPassword();
        setSaved(ui.$('#password-form', root), 'Password updated.');
      });
    });
  }

  /* ---------- Security: two-factor ---------- */

  function renderTfa() {
    var el = body('security').querySelector('[data-part="tfa"]');
    if (!c.twoFactorEnabled) { el.hidden = true; return; }
    var on = state.tfa.enabled;
    el.hidden = false;
    el.innerHTML = '<div class="set-row">' +
      '<div class="set-row__text"><h3 class="set-sub">Two-factor authentication ' +
        '<span class="cf-badge cf-badge--' + (on ? 'success' : 'neutral') + '"><span class="cf-badge__dot"></span>' + (on ? 'On' : 'Off') + '</span></h3>' +
        '<p class="t-muted">' + (on ? 'You’ll enter a code from your authenticator app each time you sign in.' : 'Protect your earnings with a second step at sign-in.') + '</p></div>' +
      '<button type="button" class="cf-btn ' + (on ? 'cf-btn--secondary' : 'cf-btn--primary') + '" data-act="' + (on ? 'tfa-disable' : 'tfa-enable') + '">' + (on ? 'Disable' : 'Enable') + '</button>' +
    '</div>';
    ui.$('[data-act]', el).addEventListener('click', function (e) {
      if (e.currentTarget.dataset.act === 'tfa-enable') openTfaSetup(); else openTfaDisable();
    });
  }

  var CODE_ERROR = 'That code didn’t work. Check your authenticator app and try again.';

  /** Shared 6-digit check: any 6 digits pass, "000000" simulates a wrong code. */
  function checkCode(otp) {
    var code = otp.value();
    if (code.length < 6) { otp.setError('Enter the 6-digit code.'); return false; }
    if (code === '000000') { otp.clear(); otp.setError(CODE_ERROR); return false; }
    return true;
  }

  function openTfaSetup(opts) {
    opts = opts || {};
    var m = ui.modal({
      title: 'Enable two-factor authentication',
      width: 480,
      body: setupStep1(),
      footer: '<button type="button" class="cf-btn cf-btn--secondary" data-close>Cancel</button><button type="button" class="cf-btn cf-btn--primary" data-act="next">Continue</button>'
    });
    var otp = null;

    function verify() {
      if (!checkCode(otp)) return;
      state.tfa.enabled = true;
      renderTfa();
      m.update({
        title: 'Two-factor authentication enabled',
        body: ui.alertHtml({ tone: 'success', title: 'Enabled', text: 'We’ll ask for a code from your authenticator app each time you sign in.' }),
        footer: '<button type="button" class="cf-btn cf-btn--primary" data-close>Done</button>'
      });
    }
    function step2() {
      m.update({
        title: 'Enter the 6-digit code',
        body: '<p class="cf-modal__desc">Open your authenticator app and enter the code it shows for Cashful.</p><div class="cf-otp" id="tfa-otp"></div>',
        footer: '<button type="button" class="cf-btn cf-btn--secondary" data-act="back">Back</button><button type="button" class="cf-btn cf-btn--primary" data-act="verify">Verify</button>'
      });
      otp = ui.otp(ui.$('#tfa-otp', m.el), { onComplete: verify, onEnter: verify });
      otp.focus();
    }

    m.el.addEventListener('click', function (e) {
      var act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'next') step2();
      else if (act.dataset.act === 'back') m.update({ title: 'Enable two-factor authentication', body: setupStep1(), footer: '<button type="button" class="cf-btn cf-btn--secondary" data-close>Cancel</button><button type="button" class="cf-btn cf-btn--primary" data-act="next">Continue</button>' });
      else if (act.dataset.act === 'verify') verify();
    });

    if (opts.wrongCode) { step2(); otp.set('000000'); verify(); }
  }

  function setupStep1() {
    return '<p class="cf-modal__desc">Scan this code with an authenticator app, or enter the setup key by hand.</p>' +
      '<div class="set-qr-wrap">' + S.qrPlaceholder() + '</div>' +
      '<div class="stack-4"><span class="t-caption t-secondary">Setup key</span>' + ui.copyField(S.SETUP_KEY) + '</div>';
  }

  function openTfaDisable() {
    var m = ui.modal({
      title: 'Disable two-factor authentication?',
      width: 480,
      body: '<p class="cf-modal__desc">Your account will only be protected by your password. Enter a code from your authenticator app to confirm.</p><div class="cf-otp" id="tfa-otp"></div>',
      footer: '<button type="button" class="cf-btn cf-btn--secondary" data-close>Cancel</button><button type="button" class="cf-btn cf-btn--destructive" data-act="disable">Disable</button>'
    });
    var otp = ui.otp(ui.$('#tfa-otp', m.el), { onComplete: disable, onEnter: disable });
    otp.focus();

    function disable() {
      if (!checkCode(otp)) return;
      state.tfa.enabled = false;
      m.close();
      renderTfa();
      ui.toast('Two-factor authentication is off');
      ui.$('[data-part="tfa"] [data-act]', root).focus();
    }
    m.el.addEventListener('click', function (e) { if (e.target.closest('[data-act="disable"]')) disable(); });
  }

  /* ---------- Notifications ---------- */

  function renderNotifications(savedText) {
    var rows = S.NOTIFICATIONS.map(function (n) {
      var locked = c.notifications[n.key].locked;
      var id = 'n-' + n.key;
      var desc = locked ? n.lockedText : n.text;
      var control = locked
        ? '<span class="cf-badge cf-badge--neutral">Always on</span>'
        : '<label class="cf-check"><input class="cf-check__input" type="checkbox" role="switch" name="' + n.key + '" aria-labelledby="' + id + '-title" aria-describedby="' + id + '-desc"' + (state.notifications[n.key] ? ' checked' : '') + '>' +
          '<span class="cf-toggle__box"><span class="cf-toggle__knob"></span></span></label>';
      return '<div class="set-toggle"><div class="set-toggle__text"><span class="set-toggle__title" id="' + id + '-title">' + esc(n.title) + '</span>' +
        '<span class="set-toggle__desc" id="' + id + '-desc">' + esc(desc) + (n.helper && !locked ? ' ' + esc(n.helper) : '') + '</span></div>' + control + '</div>';
    }).join('');

    body('notifications').innerHTML = '<form class="set-form" id="notifications-form">' + rows + actions('Save preferences') + '</form>';
    var form = ui.$('#notifications-form', root);
    var save = ui.$('button[type="submit"]', form);
    if (savedText) setSaved(form, savedText);

    function current() {
      var v = {};
      S.NOTIFICATIONS.forEach(function (n) {
        v[n.key] = c.notifications[n.key].locked ? true : form.elements[n.key].checked;
      });
      return v;
    }
    form.addEventListener('change', function () {
      var v = current();
      save.disabled = !S.NOTIFICATIONS.some(function (n) { return v[n.key] !== state.notifications[n.key]; });
      setSaved(form, '');
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      ui.withLoading(save, function () { return later(400); }).then(function () {
        state.notifications = current();
        renderNotifications('Preferences saved.');
      });
    });
  }

  /* ---------- Account type ---------- */

  function renderAccountType() {
    var hasDev = user.accounts.indexOf('developer') > -1;
    body('account-type').innerHTML = '<div class="set-row">' +
      '<span class="set-row__icon">' + icon('code') + '</span>' +
      '<div class="set-row__text"><h3 class="set-sub">Developer account</h3><p class="t-muted">' +
        (hasDev
          ? 'You have a developer account on this login. Switch to manage your apps and developer earnings.'
          : 'Monetize your own app with the Cashful SDK. You keep one login and switch between accounts in the sidebar. Your personal earnings aren’t affected.') +
      '</p></div>' +
      '<button type="button" class="cf-btn ' + (hasDev ? 'cf-btn--primary' : 'cf-btn--secondary') + '" data-act="' + (hasDev ? 'switch' : 'create') + '">' + (hasDev ? 'Switch to Developer' : 'Create developer account') + '</button></div>';

    ui.$('[data-act]', body('account-type')).addEventListener('click', function (e) {
      if (e.currentTarget.dataset.act === 'switch') ui.go(api.switchAccount('developer'));
      else Cashful.app.openBecomeDeveloper();
    });
  }

  /* ---------- Legal ---------- */

  function renderLegal() {
    var l = c.legal;
    var accepted = fmt.date(new Date(l.acceptedAt + 'T12:00:00').getTime());
    body('legal').innerHTML = '<ul class="set-links">' + [
      ['Terms of Service', l.termsUrl], ['Privacy Policy', l.privacyUrl], ['Acceptable Use Policy', l.aupUrl]
    ].map(function (x) {
      return '<li><a href="' + esc(x[1]) + '" data-soon="' + esc(x[0]) + '">' + esc(x[0]) + icon('external-link', 16) + '</a></li>';
    }).join('') + '</ul>' +
      '<p class="t-muted">You accepted version ' + esc(l.acceptedVersion) + ' on ' + accepted + '.</p>';
  }

  /* ---------- Delete account ---------- */

  function renderDelete() {
    body('delete').innerHTML = '<p class="t-muted">Deleting your account is permanent. We remove your profile, your devices, your earnings history and your payout methods, and you can’t get them back.</p>' +
      '<div><button type="button" class="cf-btn cf-btn--destructive" data-act="delete">Delete account</button></div>';
    ui.$('[data-act="delete"]', root).addEventListener('click', openDelete);
  }

  function openDelete() {
    var d = c.deletion;
    var payouts = P.loadState(null);
    var blocked = d.blockedWhenPayoutInProgress && !!P.inProgress(payouts);
    var total = payouts.balance.available + payouts.balance.pending;
    var warn = total > fmt.toCents(d.warnWhenBalanceAbove);
    var deleted = false;

    if (blocked) {
      ui.modal({
        title: 'Delete account',
        body: ui.alertHtml({ tone: 'warning', title: 'You have a payout in progress.', text: 'You can delete your account after it completes.' }),
        footer: '<button type="button" class="cf-btn cf-btn--secondary" data-close>Close</button>'
      });
      return;
    }

    var m = ui.modal({
      title: 'Delete account',
      width: 480,
      body: '<form class="set-form" id="delete-form" novalidate>' +
        '<p class="cf-modal__desc">This permanently deletes your account, your earnings history and your payout methods. You can’t undo it.</p>' +
        (warn ? ui.alertHtml({ tone: 'warning', title: 'You still have ' + fmt.money(total) + ' in your balance',
          text: fmt.money(payouts.balance.available) + ' available and ' + fmt.money(payouts.balance.pending) + ' pending. Withdraw it first, because it is lost when the account is deleted.' }) +
          '<a href="payouts.html">Go to Payouts</a>' : '') +
        ui.fieldHtml({ id: 'del-confirm', name: 'confirm', label: 'Type ' + d.confirmWord + ' to confirm', autocomplete: 'off', spellcheck: false, autofocus: true }) +
        '</form>',
      footer: '<button type="button" class="cf-btn cf-btn--secondary" data-close>Cancel</button>' +
        '<button type="submit" form="delete-form" class="cf-btn cf-btn--destructive" id="del-go" disabled>Delete account</button>',
      onClose: function () { if (deleted) ui.go('index.html'); }
    });

    var input = ui.$('#del-confirm', m.el);
    var go = ui.$('#del-go', m.el);
    input.addEventListener('input', function () { go.disabled = input.value !== d.confirmWord; });
    ui.$('#delete-form', m.el).addEventListener('submit', function (e) {
      e.preventDefault();
      if (input.value !== d.confirmWord) return;
      ui.withLoading(go, function () { return later(700); }).then(function () {
        deleted = true;
        api.logOut();
        m.update({
          title: 'Account deleted',
          body: ui.alertHtml({ tone: 'success', title: 'Your account has been deleted.', text: 'We’re sorry to see you go.' }),
          footer: '<a href="index.html" class="cf-btn cf-btn--primary">Back to start</a>'
        });
      });
    });
  }

  /* ---------- Page ---------- */

  function render() {
    root.innerHTML =
      '<header class="cf-pagehead"><div class="cf-pagehead__row"><div class="cf-pagehead__titles">' +
        '<h1 class="cf-pagehead__title">Settings</h1>' +
        '<p class="cf-pagehead__desc">Manage your profile, security and notifications.</p></div></div></header>' +
      '<div class="set-stack">' +
        card('profile', 'Profile', 'How you appear in Cashful.') +
        card('security', 'Security', 'Keep your account and your earnings safe.') +
        card('notifications', 'Notifications', 'Choose which emails you get.') +
        card('account-type', 'Account type') +
        card('legal', 'Legal') +
        card('delete', 'Delete account', '', 'set-danger') +
      '</div>';
    body('security').innerHTML = '<div data-part="password"></div><div class="set-divider" role="separator"></div><div data-part="tfa"></div>';
    renderProfile();
    renderPassword();
    renderTfa();
    if (!c.twoFactorEnabled) ui.$('.set-divider', root).hidden = true;
    renderNotifications();
    renderAccountType();
    renderLegal();
    renderDelete();
  }

  render();

  /* ---------- Presets: open a state straight away ---------- */

  function fillPassword(current, next) {
    var f = ui.$('#password-form', root);
    f.elements.current.value = current;
    f.elements.next.value = next;
    f.elements.confirm.value = next;
    f.dispatchEvent(new Event('input', { bubbles: true }));
    f.requestSubmit();
  }
  function setPayouts(name, tweak) {
    var s = P.createState(name);
    if (tweak) tweak(s);
    P.saveState(s);
  }

  if (presetId === 'profile-dirty') {
    var nameInput = ui.$('#set-name', root);
    nameInput.value = 'Alex Morgan';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (presetId === 'password-error') fillPassword('wrong-password', 'new-password-1');
  else if (presetId === 'password-success') fillPassword('old-password-1', 'new-password-1');
  else if (presetId === '2fa-setup') openTfaSetup();
  else if (presetId === '2fa-wrong-code') openTfaSetup({ wrongCode: true });
  else if (presetId === 'delete-blocked') { setPayouts('in-progress'); openDelete(); }
  else if (presetId === 'delete-balance') { setPayouts('default'); openDelete(); }
  else if (presetId === 'delete-zero') { setPayouts('default', function (s) { s.balance.available = 0; s.balance.pending = 0; }); openDelete(); }
})();
