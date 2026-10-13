/* Settings — one route, content by account type. Stacked cards that save on their own.
   Personal:  Profile · Security (password, two-factor) · Verification · Notifications · Legal · Delete account.
   Developer: Verification · Business details · Agreements · Members · Profile · Security · Notifications · Leave account or
              Danger zone, with a sticky anchor navigation (#verification, #business, …). What shows depends on the person's role in
              the Developer account (Cashful.can): a Member has no Members and no Danger zone, and cannot edit company data.
   Profile, Security and Notifications are the same components for both: name, photo, email change, 2FA and the
   notification choices are kept on the login, so a change in one account type shows in the other.
   Business values: settings.config.js (Personal) and developer-settings.config.js (Developer).
   Passwords, 2FA codes and typed signature names are never logged. ?state=<preset> is for Personal (data/settings.js). */
(function () {
  if (!Cashful.app) return;
  var ui = Cashful.ui;
  var api = Cashful.api;
  var fmt = Cashful.fmt;
  var S = Cashful.settings;
  var P = Cashful.payouts;
  var track = Cashful.track;
  var esc = ui.esc;

  var user = Cashful.app.user;
  var account = Cashful.app.account;
  var isDev = account === 'developer';
  var org = Cashful.app.org;          // the Developer account in use (null on Personal)
  var role = Cashful.app.role;        // 'owner' | 'admin' | 'member' (null on Personal)
  function canEdit() { return Cashful.can(role, 'company.edit'); }
  var DS = Cashful.developerSettingsConfig;
  var presetId = isDev ? 'default' : S.preset(ui.params.get('state'));
  var c = S.settings(presetId);
  var state = S.createState(presetId, user, account);
  var root = ui.$('#settings');

  // A preset opens a state; the parts that live on the login are written there so every page agrees
  if (presetId === 'email-pending') api.updateProfile({ emailPending: state.emailPending });
  if (presetId === '2fa-on') api.updateProfile({ tfaEnabled: true });
  if (presetId === 'verification-none') api.peerKyc.set('not_started');
  if (presetId === 'verification-review') api.peerKyc.set('in_review');
  if (presetId === 'verification-done') api.peerKyc.set('approved');
  function persistNotifications() {
    var all = Object.assign({}, user.notif || {});
    all[account] = state.notifications;
    user.notif = all;
    api.updateProfile({ notif: all });
  }
  if (presetId === 'notifications-on' || presetId === 'notifications-off') persistNotifications();

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
    return '<section class="cf-card set-card' + (extraClass ? ' ' + extraClass : '') + '" id="' + id + '" aria-labelledby="set-' + id + '-title">' +
      '<div class="set-card__head"><h2 class="cf-card__title" id="set-' + id + '-title" tabindex="-1">' + title + '</h2>' +
      (desc ? '<p class="t-muted">' + desc + '</p>' : '') + '</div>' +
      '<div data-body="' + id + '"></div></section>';
  }

  /* ---------- Profile ---------- */

  function renderProfile(savedText) {
    var p = state.profile;
    var pending = state.emailPending;

    // Developers have no Country here: their country is part of the business details
    var hasCountry = !isDev;
    var country = !hasCountry ? '' : c.countryEditable
      ? ui.selectHtml({ id: 'set-country', name: 'country', label: 'Country', options: S.COUNTRIES, value: p.country })
      : ui.fieldHtml({ id: 'set-country', name: 'country', label: 'Country', value: p.country, disabled: true,
          helperHtml: '<a href="mailto:' + esc(c.supportEmail) + '?subject=' + encodeURIComponent('Change my country') + '">Contact support to change</a>' });

    var pendingBox = pending
      ? '<div class="set-pending">' +
          ui.alertHtml({ tone: 'info', title: 'Verification sent to ' + pending, text: 'Your current email stays active until you verify the new one.' }) +
          '<div class="set-pending__actions"><button type="button" class="cf-btn cf-btn--secondary cf-btn--sm" data-act="resend">Resend</button>' +
          '<button type="button" class="cf-btn cf-btn--ghost cf-btn--sm" data-act="cancel-email">Cancel change</button></div></div>'
      : '';

    var phone = ui.fieldHtml({ id: 'set-phone', name: 'phone', label: 'Phone number', type: 'tel', value: p.phone || '', autocomplete: 'tel', placeholder: '+1 415 555 0132',
      spellcheck: false, noSample: true, helper: 'We text a code to this number to confirm payouts.' });

    body('profile').innerHTML = '<form class="set-form" id="profile-form" novalidate>' +
      ui.fieldHtml({ id: 'set-name', name: 'name', label: 'Name', value: p.name, autocomplete: 'name' }) +
      ui.fieldHtml({ id: 'set-email', name: 'email', label: 'Email', value: p.email, type: 'email', autocomplete: 'email', spellcheck: false, disabled: !!pending,
        helper: pending ? '' : 'If you change it, we send a link to confirm the new address.' }) +
      phone + pendingBox + country + actions('Save changes') + '</form>';

    var form = ui.$('#profile-form', root);
    var save = ui.$('button[type="submit"]', form);
    if (savedText) setSaved(form, savedText);

    function dirty() {
      var v = readProfile();
      return v.name !== p.name || (!pending && v.email !== p.email) || (hasCountry && c.countryEditable && v.country !== p.country) ||
        v.phone !== (p.phone || '');
    }
    function readProfile() {
      return {
        name: form.elements.name.value.trim(),
        email: form.elements.email.value.trim(),
        phone: form.elements.phone.value.trim(),
        country: hasCountry && c.countryEditable ? form.elements.country.value : p.country
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
      ui.setError(form.elements.phone, v.phone && !/^\+?[\d\s().-]{7,}$/.test(v.phone) ? 'Enter a valid phone number, like +1 415 555 0132.' : '');
      var bad = firstInvalid(form);
      if (bad) { bad.focus(); return; }

      ui.withLoading(save, function () { return later(400); }).then(function () {
        p.name = v.name;
        p.country = v.country;
        p.phone = v.phone;
        if (emailChanged) state.emailPending = v.email;
        // Saved on the login, so the user card on every page (and the other account type) shows the same data
        api.updateProfile({ name: p.name, phone: p.phone || null, emailPending: state.emailPending });
        Cashful.app.refreshUser();
        renderProfile(emailChanged ? 'Saved. Verify your new email to finish.' : 'Changes saved.');
      });
    });

    form.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'resend') {
        ui.toast('Verification email sent again');
      } else if (b.dataset.act === 'cancel-email') {
        state.emailPending = null;
        api.updateProfile({ emailPending: null });
        renderProfile();
        ui.$('#set-email', root).focus();
      }
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
        '<p class="t-muted">' + (on ? 'You’ll enter a code from your authenticator app each time you log in. Nothing else in Cashful asks for it.' : 'Add a second step to logging in, so a stolen password isn’t enough.') + '</p></div>' +
      '<button type="button" class="cf-btn ' + (on ? 'cf-btn--secondary' : 'cf-btn--primary') + '" data-act="' + (on ? 'tfa-disable' : 'tfa-enable') + '">' + (on ? 'Disable' : 'Enable') + '</button>' +
    '</div>';
    ui.$('[data-act]', el).addEventListener('click', function (e) {
      if (e.currentTarget.dataset.act === 'tfa-enable') openTfaSetup(); else openTfaDisable();
    });
  }

  /* ---------- Security: connected sign-in providers (Google, GitHub, Apple) ---------- */

  var PROVIDERS = [['google', 'Google'], ['github', 'GitHub'], ['apple', 'Apple']];

  function renderSso() {
    var el = body('security').querySelector('[data-part="sso"]');
    var sso = (api.currentUser() || {}).sso || {};
    el.innerHTML = '<h3 class="set-sub">Connected sign-in providers</h3>' +
      '<p class="t-muted">Connect an account to log in with one click. Your password keeps working.</p>' +
      '<ul class="set-providers">' + PROVIDERS.map(function (p) {
        var on = !!sso[p[0]];
        return '<li class="set-provider"><cf-brand-icon name="' + p[0] + '"></cf-brand-icon><span class="set-provider__name">' + p[1] + '</span>' +
          badgeOf(on) + '<button type="button" class="cf-btn cf-btn--' + (on ? 'ghost' : 'secondary') + ' cf-btn--sm" data-provider="' + p[0] + '" data-on="' + on +
          '" aria-label="' + (on ? 'Disconnect ' : 'Connect ') + p[1] + '">' + (on ? 'Disconnect' : 'Connect') + '</button></li>';
      }).join('') + '</ul>';
    ui.$$('[data-provider]', el).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.dataset.provider, next = Object.assign({}, (api.currentUser() || {}).sso);
        var name = PROVIDERS.filter(function (p) { return p[0] === id; })[0][1];
        if (b.dataset.on === 'true') delete next[id]; else next[id] = true;
        api.updateProfile({ sso: Object.keys(next).length ? next : null });
        renderSso();
        ui.toast(name + (next[id] ? ' connected' : ' disconnected'));
        ui.$('[data-provider="' + id + '"]', body('security')).focus();
      });
    });
  }
  function badgeOf(on) { return '<span class="cf-badge cf-badge--' + (on ? 'success' : 'neutral') + '"><span class="cf-badge__dot"></span>' + (on ? 'Connected' : 'Not connected') + '</span>'; }

  var CODE_ERROR ='That code didn’t work. Check your authenticator app and try again.';

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
      api.updateProfile({ tfaEnabled: true });
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

  /**
   * Turning 2FA off is the one risky step, so it asks for proof you still hold the second factor: a code from the
   * authenticator app, or a backup code when the phone is lost. It says what changes and that an email follows.
   */
  function openTfaDisable() {
    var backupMode = false;
    var m = ui.modal({
      title: 'Turn off two-factor authentication?',
      width: 480,
      body: ui.alertHtml({ tone: 'warning', title: 'Logging in will only need your password', text: 'Anyone who gets your password could log in. We’ll email you to say it was turned off.' }) +
        '<div id="tfa-proof"></div>',
      footer: '<button type="button" class="cf-btn cf-btn--secondary" data-close>Keep it on</button><button type="button" class="cf-btn cf-btn--destructive" data-act="disable">Turn off</button>'
    });
    var otp = null;

    function drawProof() {
      var box = ui.$('#tfa-proof', m.el);
      if (backupMode) {
        box.innerHTML = '<p class="cf-modal__desc">Enter one of your backup codes.</p>' +
          ui.fieldHtml({ id: 'tfa-backup', name: 'backup', label: 'Backup code', autocomplete: 'off', spellcheck: false, autofocus: true }) +
          '<button type="button" class="cf-link" data-act="use-app">Use my authenticator app instead</button>';
        ui.$('#tfa-backup', m.el).focus();
        otp = null;
      } else {
        box.innerHTML = '<p class="cf-modal__desc">Enter the 6-digit code from your authenticator app to confirm.</p><div class="cf-otp" id="tfa-otp"></div>' +
          '<button type="button" class="cf-link" data-act="use-backup">Lost your phone? Use a backup code</button>';
        otp = ui.otp(ui.$('#tfa-otp', m.el), { onComplete: disable, onEnter: disable });
        otp.focus();
      }
    }

    function proven() {
      if (!backupMode) return checkCode(otp);
      var f = ui.$('#tfa-backup', m.el);
      var v = f.value.trim();
      var ok = v && (!api.strict || v.toUpperCase() === Cashful.config.demo.backupCode);
      ui.setError(f, ok ? '' : (v ? 'This backup code isn’t valid or was already used.' : 'Enter a backup code.'));
      if (!ok) f.focus();
      return !!ok;
    }

    function disable() {
      if (!proven()) return;
      state.tfa.enabled = false;
      api.updateProfile({ tfaEnabled: null });
      m.close();
      renderTfa();
      ui.toast('Two-factor authentication is off. We’ve emailed you.');
      ui.$('[data-part="tfa"] [data-act]', root).focus();
    }

    m.el.addEventListener('click', function (e) {
      var act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'disable') disable();
      else if (act.dataset.act === 'use-backup') { backupMode = true; drawProof(); }
      else if (act.dataset.act === 'use-app') { backupMode = false; drawProof(); }
    });
    m.el.addEventListener('keydown', function (e) { if (e.key === 'Enter' && backupMode && e.target.id === 'tfa-backup') { e.preventDefault(); disable(); } });
    drawProof();
  }

  /* ---------- Notifications ---------- */

  function renderNotifications(savedText) {
    var list = S.notificationList(account);
    var conf = S.notificationConfig(account);
    var rows = list.map(function (n) {
      var locked = conf[n.key].locked;
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
      list.forEach(function (n) {
        v[n.key] = conf[n.key].locked ? true : form.elements[n.key].checked;
      });
      return v;
    }
    form.addEventListener('change', function () {
      var v = current();
      save.disabled = !list.some(function (n) { return v[n.key] !== state.notifications[n.key]; });
      setSaved(form, '');
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      ui.withLoading(save, function () { return later(400); }).then(function () {
        state.notifications = current();
        persistNotifications();
        renderNotifications('Preferences saved.');
      });
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
    var impact = api.deletionImpact();
    // An account the person owns that still holds money blocks deleting the person
    var heldBack = impact.owned.map(function (o) { return { name: o.name, cents: P.balanceFor(user, o.id) }; }).filter(function (o) { return o.cents > 0; });
    if (heldBack.length) {
      ui.modal({
        title: 'Delete account',
        width: 480,
        body: ui.alertHtml({ tone: 'warning', title: 'Withdraw the balance of your developer accounts first',
          text: 'Deleting your Personal account deletes you, and the developer accounts you own with you. These still hold money:' }) +
          '<ul class="set-consequences">' + heldBack.map(function (o) { return '<li><strong>' + esc(o.name) + '</strong>: ' + fmt.money(o.cents) + '</li>'; }).join('') + '</ul>' +
          '<p class="t-muted">Switch to each account, open Payouts and withdraw its balance. Then come back here.</p>',
        footer: '<button type="button" class="cf-btn cf-btn--secondary" data-close>Close</button>'
      });
      return;
    }
    var payouts = P.loadState(null, P.earnedFor(user, 'personal'), 'personal');
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
        '<p class="cf-modal__desc">This permanently deletes you: your Personal account, your earnings history and your payout methods. You can’t undo it.</p>' +
        (impact.owned.length || impact.member.length ? '<div class="set-impact">' +
          (impact.owned.length ? '<p><strong>These developer accounts are deleted with you</strong>, as you own them:</p><ul class="set-consequences">' + impact.owned.map(function (o) { return '<li>' + esc(o.name) + '</li>'; }).join('') + '</ul>' : '') +
          (impact.member.length ? '<p><strong>You are removed as a member from</strong>:</p><ul class="set-consequences">' + impact.member.map(function (o) { return '<li>' + esc(o.name) + ' (' + esc(Cashful.ROLE_LABELS[o.role]) + ')</li>'; }).join('') + '</ul>' : '') + '</div>' : '') +
        (warn ? ui.alertHtml({ tone: 'warning', title: 'You still have ' + fmt.money(total) + ' in your balance',
          text: fmt.money(payouts.balance.available) + ' available and ' + fmt.money(payouts.balance.pending) + ' pending. Withdraw it first, because it is lost when the account is deleted.' }) +
          '<a href="payouts.html">Go to Payouts</a>' : '') +
        ui.fieldHtml({ id: 'del-confirm', name: 'confirm', label: 'Type ' + d.confirmWord + ' to confirm', autocomplete: 'off', spellcheck: false, autofocus: true, noSample: true }) +
        '</form>',
      footer: '<button type="button" class="cf-btn cf-btn--secondary" data-close>Cancel</button>' +
        '<button type="submit" form="delete-form" class="cf-btn cf-btn--destructive" id="del-go" disabled>Delete account</button>',
      onClose: function () { if (deleted) ui.go('auth.html'); }
    });

    var input = ui.$('#del-confirm', m.el);
    var go = ui.$('#del-go', m.el);
    input.addEventListener('input', function () { go.disabled = input.value !== d.confirmWord; });
    ui.$('#delete-form', m.el).addEventListener('submit', function (e) {
      e.preventDefault();
      if (input.value !== d.confirmWord) return;
      ui.withLoading(go, function () { return later(700); }).then(function () {
        deleted = true;
        api.deleteUser();
        m.update({
          title: 'Account deleted',
          body: ui.alertHtml({ tone: 'success', title: 'Your account has been deleted.', text: 'We’re sorry to see you go.' }),
          footer: '<a href="index.html" class="cf-btn cf-btn--primary">Back to start</a>'
        });
      });
    });
  }

  /* ---------- Personal: Verification (identity check, needed only to withdraw) ---------- */

  var PEER_STATUS = { not_started: ['neutral', 'Not started'], in_review: ['warning', 'In review'], approved: ['success', 'Verified'] };

  function renderPeerVerification() {
    var status = api.peerKyc.status();
    var u = api.currentUser();
    var m = PEER_STATUS[status];
    var text = {
      not_started: 'You don’t need this to earn. We ask once, before your first withdrawal. It takes about 3 minutes.',
      in_review: 'We’re checking your ID. This is usually instant, and we’ll email you if we need anything else.',
      approved: 'Verified' + (u.peerKycAt ? ' on ' + fmt.date(u.peerKycAt) : '') + '. You can withdraw whenever you reach the minimum.'
    }[status];
    body('verification').innerHTML =
      '<div class="set-row"><div class="set-row__text"><h3 class="set-sub">Status <span class="cf-badge cf-badge--' + m[0] + '"><span class="cf-badge__dot"></span>' + m[1] + '</span></h3><p class="t-muted">' + esc(text) + '</p></div>' +
        (status === 'not_started' ? '<a class="cf-btn cf-btn--primary" href="kyc.html" data-act="peer-kyc-start">Start verification</a>' : '') + '</div>' +
      (status === 'in_review' ? '<div><button type="button" class="cf-link kyc-sim" data-peer-approve>Approve (Prototype)</button></div>' : '') +
      (status === 'approved' ? '' : ui.alertHtml({ tone: 'info', title: 'Who sees your documents', text: 'Our verification partner collects your ID. Cashful only receives the result. We never sell this data.' })) +
      '<div class="set-unlocks"><h3 class="set-sub">What this unlocks:</h3><ul class="set-unlocks__list"><li>' + icon(status === 'approved' ? 'check-circle' : 'lock', 16) + '<span>Withdrawals' + (status === 'approved' ? ' — unlocked' : '') + '</span></li></ul></div>';
  }
  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-peer-approve]')) return;
    api.peerKyc.set('approved');
    ui.toast('Verified (prototype). You can withdraw.');
  });
  window.addEventListener('cashful:peer-kyc', function () { if (!isDev && ui.$('[data-body="verification"]', root)) renderPeerVerification(); });

  /* ---------- Developer: shared bits ---------- */

  function devNow() { var u = api.currentUser(); return (u && u.dev) || {}; }
  function mailto(subject) { return 'mailto:' + DS.supportEmail + '?subject=' + encodeURIComponent(subject); }
  function badgeHtml(tone, text) { return '<span class="cf-badge cf-badge--' + tone + '"><span class="cf-badge__dot"></span>' + esc(text) + '</span>'; }
  function dateOf(ms) { return fmt.date(typeof ms === 'string' ? new Date(ms + 'T12:00:00').getTime() : ms); }

  var STATUS_META = {
    not_started: { tone: 'neutral', label: 'Not started' },
    in_progress: { tone: 'brand', label: 'In progress' },
    in_review: { tone: 'warning', label: 'Pending' },
    changes_requested: { tone: 'error', label: 'Changes requested' },
    rejected: { tone: 'error', label: 'Rejected' },
    approved: { tone: 'success', label: 'Verified' }
  };
  // "In progress" is Not started with the onboarding begun
  function shownStatus(status) { return status === 'not_started' && devNow().started ? 'in_progress' : status; }
  function statusBadge(status) { var m = STATUS_META[shownStatus(status)]; return badgeHtml(m.tone, m.label); }

  /** Which stage is where. Every stage says its state in words, not only by colour or icon. */
  var STAGE_STATE = { done: 'Done', current: 'In progress', attention: 'Needs action', failed: 'Not approved', todo: 'To do' };
  function stageListHtml(status) {
    var L = DS.kyc.stageLabels;
    var stages = [
      { label: L.details, st: status === 'changes_requested' ? 'attention' : status === 'not_started' ? (devNow().started ? 'done' : 'todo') : 'done' },
      { label: L.agreements, st: api.kyc.signed('developer-agreement') ? 'done' : 'todo' },
      { label: L.review, st: status === 'in_review' ? 'current' : status === 'approved' ? 'done' : status === 'rejected' ? 'failed' : 'todo', approvable: status === 'in_review' },
      { label: L.approved, st: status === 'approved' ? 'done' : 'todo' }
    ];
    return '<ol class="set-stages" aria-label="Verification progress">' + stages.map(function (s, i) {
      var mark = s.st === 'done' ? icon('check', 14) : (s.st === 'attention' || s.st === 'failed' ? '!' : String(i + 1));
      return '<li class="set-stage is-' + s.st + '"><span class="set-stage__mark" aria-hidden="true">' + mark + '</span>' +
        '<span class="set-stage__label">' + esc(s.label) + '</span><span class="set-stage__state">' + STAGE_STATE[s.st] + '</span>' +
        (s.approvable ? Cashful.kyc.approveButton() : '') + '</li>';
    }).join('') + '</ol>';
  }

  /* ---------- Developer: verification ---------- */

  function renderVerification() {
    var status = api.kyc.status();
    var d = devNow();
    var inProgress = status === 'not_started' && !!d.started;
    var time = DS.kyc.reviewTime;
    var text = {
      not_started: inProgress ? 'You’ve started. Your answers are saved, so you can pick up where you left off.' : 'Verify your business to start earning from your apps. It takes about 5 minutes.',
      in_review: 'We’re reviewing your details. This usually takes ' + time + ', and we’ll email you. You don’t need to do anything.',
      changes_requested: 'A reviewer needs one more thing. Update your information and we’ll look again, usually within ' + time + '.',
      rejected: 'We couldn’t approve this application.',
      approved: 'Verified' + (d.approvedAt ? ' on ' + dateOf(d.approvedAt) : '') + '. You’re all set.'
    }[status];
    var comment = status === 'changes_requested'
      ? ui.alertHtml({ tone: 'error', title: 'Action required: a reviewer left a comment', text: d.reviewerComment || S.SAMPLE_FEEDBACK }) : '';
    if (status === 'rejected') {
      comment = ui.alertHtml({ tone: 'error', title: 'Why it wasn’t approved', text: d.rejectionReason || DS.kyc.rejection.reason }) +
        '<div class="set-next"><h3 class="set-sub">What you can do next</h3><p class="t-muted">' + esc(DS.kyc.rejection.nextStep) + '</p>' +
        '<div><a class="cf-btn cf-btn--secondary" data-act="kyc-support" href="' + esc(mailto('Question about my verification')) + '">Contact support</a></div></div>';
    }
    // Where the documents go: said at the moment people hesitate most
    var trust = (status === 'not_started' || status === 'changes_requested')
      ? ui.alertHtml({ tone: 'info', title: 'Who sees your documents', text: 'Our verification partner collects your ID and address. Cashful only receives the result. We never sell this data.' }) : '';
    var action = status === 'not_started'
      ? '<button type="button" class="cf-btn cf-btn--primary" data-act="kyc-start">' + (inProgress ? 'Continue verification' : 'Start verification') + '</button>'
      : status === 'changes_requested'
        ? '<button type="button" class="cf-btn cf-btn--primary" data-act="kyc-update">Update information</button>' : '';
    comment = comment + trust;
    var readonly = !canEdit();
    if (readonly) { action = ''; comment = comment.replace(trust, ''); }

    body('verification').innerHTML =
      '<div class="set-row"><div class="set-row__text"><h3 class="set-sub">Status ' + statusBadge(status) + '</h3><p class="t-muted">' + esc(text) + '</p></div>' + action + '</div>' +
      comment + (readonly && (status === 'not_started' || status === 'changes_requested') ? '<p class="t-muted">Only an account admin can complete verification.</p>' : '') + stageListHtml(status) +
      '<div class="set-unlocks"><h3 class="set-sub">What this unlocks:</h3><ul class="set-unlocks__list">' +
        DS.kyc.unlocks.map(function (u) {
          return '<li>' + icon(status === 'approved' ? 'check-circle' : 'lock', 16) + '<span>' + esc(u) + (status === 'approved' ? ' — unlocked' : '') + '</span></li>';
        }).join('') + '</ul></div>';

    var start = ui.$('[data-act="kyc-start"]', body('verification'));
    if (start) start.addEventListener('click', function () { track('kyc_start_clicked'); ui.go('kyc.html'); });
    var upd = ui.$('[data-act="kyc-update"]', body('verification'));
    if (upd) upd.addEventListener('click', function () { track('kyc_update_info_clicked'); ui.go('kyc.html?mode=update'); });
  }

  /* ---------- Developer: business details ---------- */

  /** Cashful serves the US and the EU; a country saved earlier that is outside the list stays selectable. */
  function countryOptions(current) {
    var list = Cashful.config.eligibility.supported.slice();
    if (current && list.indexOf(current) < 0) list.push(current);
    return list;
  }

  function renderBusiness(savedText) {
    var status = api.kyc.status();
    var memberOnly = !canEdit();
    var locked = memberOnly || DS.businessDetails.lockedStatuses.indexOf(status) > -1;
    var b = S.businessOf(api.currentUser());
    var indie = b.kind === 'indie';

    body('business').innerHTML = '<form class="set-form" id="business-form" novalidate>' +
      (memberOnly ? ui.alertHtml({ tone: 'info', title: 'Only account admins can change these details', text: 'You can see them, but not edit them.' }) : locked ? ui.alertHtml({ tone: 'info', title: status === 'approved' ? 'Your business is verified' : status === 'rejected' ? 'Your application wasn’t approved' : 'Your details are being reviewed',
        text: 'These details are read-only. To change them, contact support.' }) +
        '<div><a href="' + esc(mailto('Change my business details')) + '">Contact support</a></div>' : '') +
      ui.selectHtml({ id: 'biz-kind', name: 'kind', label: 'Account type', options: S.BUSINESS_KINDS, value: b.kind }) +
      ui.fieldHtml({ id: 'biz-name', name: 'name', label: indie ? 'Legal name' : 'Company name', value: b.name, autocomplete: 'organization' }) +
      ui.selectHtml({ id: 'biz-country', name: 'country', label: 'Country', options: countryOptions(b.country), value: b.country }) +
      ui.fieldHtml({ id: 'biz-street', name: 'street', label: 'Street address', value: b.street, autocomplete: 'street-address' }) +
      '<div class="set-grid">' +
        ui.fieldHtml({ id: 'biz-city', name: 'city', label: 'City', value: b.city, autocomplete: 'address-level2' }) +
        ui.fieldHtml({ id: 'biz-postal', name: 'postal', label: 'Postal code', value: b.postal, autocomplete: 'postal-code' }) +
      '</div><div class="set-grid">' +
        ui.fieldHtml({ id: 'biz-apps', name: 'apps', label: 'Number of apps', value: b.apps, inputmode: 'numeric', helper: 'A whole number, 0 or more.' }) +
        ui.fieldHtml({ id: 'biz-installs', name: 'installs', label: 'Total installs', value: b.installs, inputmode: 'numeric', helper: 'A whole number, 0 or more.' }) +
      '</div>' + (locked ? '' : actions('Save details')) + '</form>';

    var form = ui.$('#business-form', root);
    var keys = ['kind', 'name', 'country', 'street', 'city', 'postal', 'apps', 'installs'];
    if (savedText) setSaved(form, savedText);
    if (locked) {
      keys.forEach(function (k) { ui.setDisabled(form.elements[k], true); });
      return;
    }
    var save = ui.$('button[type="submit"]', form);
    function read() {
      var v = {};
      keys.forEach(function (k) { v[k] = form.elements[k].value.trim(); });
      return v;
    }
    form.addEventListener('input', sync);
    form.addEventListener('change', sync);
    function sync() {
      var v = read();
      ui.$('label[for="biz-name"]', form).textContent = v.kind === 'indie' ? 'Legal name' : 'Company name';
      save.disabled = !keys.some(function (k) { return v[k] !== String(b[k]); });
      setSaved(form, '');
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = read();
      var errors = S.validateBusiness(v);
      keys.forEach(function (k) { ui.setError(form.elements[k], errors[k] || ''); });
      var bad = firstInvalid(form);
      if (bad) { bad.focus(); return; }
      ui.withLoading(save, function () { return later(500); }).then(function () {
        api.updateDev({ business: v });
        track('business_details_saved');
        renderBusiness('Business details saved.');
      });
    });
  }

  /* ---------- Developer: agreements ---------- */

  function renderAgreements() {
    var rows = DS.agreements.map(function (a) {
      var sig = a.kind === 'signable' ? api.kyc.signature(a.id) : null;
      var meta, badge, act;
      if (a.kind === 'signable') {
        badge = sig ? badgeHtml('success', 'Signed') : badgeHtml('warning', 'Not signed');
        meta = sig ? 'Version ' + a.version + ' · signed by ' + esc(sig.name) + ' on ' + dateOf(sig.at) : 'Version ' + a.version + ' · needs your signature';
        act = '<button type="button" class="cf-btn ' + (sig ? 'cf-btn--secondary' : 'cf-btn--primary') + '" data-agreement="' + a.id + '">' + (sig || !canEdit() ? 'View' : 'Review and sign') + '</button>';
      } else {
        badge = badgeHtml('success', 'Accepted');
        meta = 'Version ' + a.version + ' · accepted on ' + dateOf(a.acceptedAt);
        act = '<a class="cf-btn cf-btn--secondary" href="' + esc(a.url) + '" data-view="' + a.id + '" data-soon="' + esc(a.title) + '">View' + icon('external-link', 16) + '</a>';
      }
      return '<li class="set-agreement"><div class="set-row__text"><h3 class="set-sub">' + esc(a.title) + ' ' + badge + '</h3><p class="t-muted">' + meta + '</p></div>' + act + '</li>';
    }).join('');
    body('agreements').innerHTML = '<ul class="set-agreements">' + rows + '</ul>';

    ui.$$('[data-agreement]', root).forEach(function (b) {
      b.addEventListener('click', function () { openAgreement(b.dataset.agreement); });
    });
    ui.$$('[data-view]', root).forEach(function (a) {
      a.addEventListener('click', function () { track('agreement_viewed', { id: a.dataset.view }); });
    });
  }

  function openAgreement(id) {
    var a = DS.agreements.filter(function (x) { return x.id === id; })[0];
    var sig = api.kyc.signature(id);
    track('agreement_viewed', { id: id });
    var text = '<pre class="set-contract" tabindex="0" aria-label="' + esc(a.title) + ' text">' + esc(a.bodyText) + '</pre>';

    if (sig || !canEdit()) {
      ui.modal({ title: a.title, width: 560, body: text + (sig ? '<p class="t-muted">Signed by ' + esc(sig.name) + ' on ' + dateOf(sig.at) + '.</p>' : '<p class="t-muted">Not signed yet. An account admin signs it.</p>'),
        footer: '<button type="button" class="cf-btn cf-btn--primary" data-close>Close</button>' });
      return;
    }
    var m = ui.modal({
      title: a.title,
      width: 560,
      body: '<form class="set-form" id="sign-form" novalidate>' + text +
        '<label class="cf-check"><input class="cf-check__input" type="checkbox" name="agree">' +
          '<span class="cf-checkbox__box"><cf-icon name="check" size="14" stroke-width="2.75"></cf-icon></span>' +
          '<span class="cf-check__label">I have read and agree to the ' + esc(a.title) + '</span></label>' +
        ui.fieldHtml({ id: 'sign-name', name: 'name', label: 'Full name', autocomplete: 'name', sample: 'Alex Morgan', helper: 'Type your full name to sign.' }) + '</form>',
      footer: '<button type="button" class="cf-btn cf-btn--secondary" data-close>Cancel</button>' +
        '<button type="submit" form="sign-form" class="cf-btn cf-btn--primary" id="sign-go">Sign agreement</button>'
    });
    var form = ui.$('#sign-form', m.el);
    var go = ui.$('#sign-go', m.el);
    // Nothing is required in the prototype: an empty name takes a sample and the box is ticked for the person
    function valid() { return true; }
    function sync() { /* the button is always available */ }
    form.elements.name.addEventListener('blur', function () {
      var v = form.elements.name.value.trim();
      ui.setError(form.elements.name, v && v.length < 2 ? 'Enter your full name (at least 2 characters).' : '');
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      form.elements.agree.checked = true;
      var name = form.elements.name.value.trim();
      ui.withLoading(go, function () { return later(500); }).then(function () {
        api.kyc.sign(id, name);   // the typed name is stored, never logged
        track('agreement_signed', { id: id });
        m.close();
        renderAgreements();
        renderVerification();
        ui.toast('Agreement signed');
      });
    });
  }

  /* ---------- Developer: members ----------
     The team of the Developer account: the Owner first, then the others, then pending invitations. Owner and Admin manage it. */

  var ROLE_HELP = {
    admin: 'Can manage apps, payouts, the team and company details.',
    member: 'Can see analytics and work on apps and the SDK. No payouts, no team management.'
  };
  var EMAIL_ERRORS = {
    invalid: 'Enter a valid email, like name@company.com.',
    member: 'This person is already on the team.',
    pending: 'There is already a pending invitation for this email.'
  };

  function roleChoices(selected) {
    return '<div class="auth__stack" role="radiogroup" aria-label="Role">' + ['admin', 'member'].map(function (r) {
      return '<label class="cf-radio-card"><span class="cf-check"><input class="cf-check__input" type="radio" name="role" value="' + r + '"' + (r === selected ? ' checked' : '') + '><span class="cf-radio__box"></span></span>' +
        '<span class="cf-radio-card__text"><span class="cf-radio-card__title">' + Cashful.ROLE_LABELS[r] + '</span><span class="cf-radio-card__desc">' + ROLE_HELP[r] + '</span></span></label>';
    }).join('') + '</div>';
  }

  function memberRow(r) {
    var mine = r.kind === 'member' && r.email === user.email;
    var who = r.kind === 'member'
      ? '<span class="mem-who"><span class="mem-avatar" aria-hidden="true">' + esc(Cashful.app.initials(r.name || r.email)) + '</span><span class="mem-who__text"><span class="mem-who__name">' + esc(r.name) + (mine ? ' <span class="mem-you">You</span>' : '') + '</span><span class="mem-who__email">' + esc(r.email) + '</span></span></span>'
      : '<span class="mem-who"><span class="mem-avatar is-pending" aria-hidden="true">' + icon('clock', 16) + '</span><span class="mem-who__text"><span class="mem-who__name">' + esc(r.email) + '</span><span class="mem-who__email">Invitation sent</span></span></span>';
    var items = '';
    if (r.kind === 'invite') {
      items = '<button type="button" role="menuitem" data-mem="resend" data-token="' + esc(r.token) + '">Resend invite</button>' +
        '<button type="button" role="menuitem" data-mem="revoke" data-token="' + esc(r.token) + '">Revoke invite</button>' +
        '<button type="button" role="menuitem" data-mem="open-invite" data-token="' + esc(r.token) + '">Open the invitation (prototype)</button>';
    } else if (r.role !== 'owner' && !mine) {
      items = '<button type="button" role="menuitem" data-mem="change-role" data-email="' + esc(r.email) + '">Change role</button>' +
        '<button type="button" role="menuitem" data-mem="remove" data-email="' + esc(r.email) + '">Remove</button>';
    }
    var label = r.kind === 'member' ? r.name : r.email;
    return '<tr><td>' + who + '</td><td>' + esc(Cashful.ROLE_LABELS[r.role]) + '</td>' +
      '<td>' + (r.status === 'active' ? badgeHtml('success', 'Active') : badgeHtml('warning', 'Pending invite')) + '</td>' +
      '<td>' + fmt.date(r.at) + '</td>' +
      '<td class="is-right">' + (items ? '<span class="mem-menu-wrap"><button type="button" class="cf-ibtn cf-ibtn--ghost cf-ibtn--sm" data-mem-menu aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ' + esc(label) + '">' + icon('more', 20) + '</button>' +
        '<div class="mem-menu" role="menu" hidden>' + items + '</div></span>' : '') + '</td></tr>';
  }

  function renderMembers() {
    var rows = api.team.rows(org.id);
    var active = rows.filter(function (r) { return r.kind === 'member'; }).length;
    var pending = rows.length - active;
    body('members').innerHTML =
      '<div class="set-row"><div class="set-row__text"><p class="t-muted" role="status">' + active + (active === 1 ? ' member' : ' members') + (pending ? ' and ' + pending + ' pending ' + (pending === 1 ? 'invitation' : 'invitations') : '') + '.</p></div>' +
        '<button type="button" class="cf-btn cf-btn--primary" data-act="invite">' + icon('plus', 16) + '<span>Invite member</span></button></div>' +
      '<div class="cf-table-wrap"><table class="cf-table mem-table"><caption class="sr-only">Members of ' + esc(org.name) + '</caption>' +
        '<thead><tr><th scope="col">Name</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Added</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>' +
        '<tbody>' + rows.map(memberRow).join('') + '</tbody></table></div>';
  }

  function openInvite() {
    var m = ui.modal({
      title: 'Invite member',
      width: 500,
      body: '<form class="set-form" id="invite-form" novalidate>' +
        '<p class="cf-modal__desc">They get an email with a link to join ' + esc(org.name) + '.</p>' +
        ui.fieldHtml({ id: 'inv-email', name: 'email', label: 'Email', type: 'email', placeholder: 'name@company.com', autocomplete: 'off', spellcheck: false, noSample: true, autofocus: true }) +
        roleChoices('member') + '</form>',
      footer: '<button type="button" class="cf-btn cf-btn--secondary" data-close>Cancel</button><button type="submit" form="invite-form" class="cf-btn cf-btn--primary" id="inv-go">Send invitation</button>'
    });
    var form = ui.$('#invite-form', m.el);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = form.elements.email.value.trim();
      var role = form.querySelector('input[name="role"]:checked').value;
      var res = api.team.invite(org.id, email, role);
      if (!res.ok) { ui.setError(form.elements.email, EMAIL_ERRORS[res.error] || 'Something went wrong.'); form.elements.email.focus(); return; }
      track('member_invited', { role: role });
      m.close();
      renderMembers();
      ui.toast('Invitation sent');
    });
  }

  function openChangeRole(email) {
    var row = api.team.rows(org.id).filter(function (r) { return r.kind === 'member' && r.email === email; })[0];
    if (!row) return;
    var m = ui.modal({
      title: 'Change role',
      width: 500,
      body: '<form class="set-form" id="role-form" novalidate><p class="cf-modal__desc">' + esc(row.name) + ' (' + esc(row.email) + ')</p>' + roleChoices(row.role) + '</form>',
      footer: '<button type="button" class="cf-btn cf-btn--secondary" data-close>Cancel</button><button type="submit" form="role-form" class="cf-btn cf-btn--primary">Save role</button>'
    });
    ui.$('#role-form', m.el).addEventListener('submit', function (e) {
      e.preventDefault();
      var role = e.target.querySelector('input[name="role"]:checked').value;
      api.team.changeRole(org.id, email, role);
      track('member_role_changed', { role: role });
      m.close();
      renderMembers();
      ui.toast(row.name + ' is now ' + (role === 'admin' ? 'an Admin' : 'a Member'));
    });
  }

  function openRemove(email) {
    var row = api.team.rows(org.id).filter(function (r) { return r.kind === 'member' && r.email === email; })[0];
    if (!row) return;
    var m = ui.modal({
      title: 'Remove ' + row.name + '?',
      width: 460,
      body: '<p class="cf-modal__desc">They will lose access to ' + esc(org.name) + ' right away: its apps, analytics and settings. Their own Personal account isn’t affected.</p>',
      footer: '<button type="button" class="cf-btn cf-btn--secondary" data-close>Cancel</button><button type="button" class="cf-btn cf-btn--destructive" data-confirm>Remove</button>'
    });
    ui.$('[data-confirm]', m.el).addEventListener('click', function () {
      api.team.remove(org.id, email);
      track('member_removed', {});
      m.close();
      renderMembers();
      ui.toast('Member removed');
    });
  }

  function closeRowMenus(except) {
    ui.$$('.mem-menu', root).forEach(function (menu) {
      if (menu === except) return;
      menu.hidden = true;
      var btn = ui.$('[data-mem-menu]', menu.parentNode);
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  }

  if (isDev) {
    root.addEventListener('click', function (e) {
      var mb = e.target.closest('[data-mem-menu]');
      if (mb) {
        var menu = ui.$('.mem-menu', mb.parentNode);
        closeRowMenus(menu);
        menu.hidden = !menu.hidden;
        mb.setAttribute('aria-expanded', String(!menu.hidden));
        if (!menu.hidden) { var first = ui.$('button', menu); if (first) first.focus(); }
        return;
      }
      var act = e.target.closest('[data-mem]');
      if (act) {
        closeRowMenus(null);
        var kind = act.dataset.mem;
        if (kind === 'change-role') openChangeRole(act.dataset.email);
        else if (kind === 'remove') openRemove(act.dataset.email);
        else if (kind === 'resend') { api.team.resend(act.dataset.token); track('member_invite_resent', {}); renderMembers(); ui.toast('Invitation sent again'); }
        else if (kind === 'revoke') { api.team.revoke(act.dataset.token); track('member_invite_revoked', {}); renderMembers(); ui.toast('Invitation revoked'); }
        else if (kind === 'open-invite') ui.go('invite.html?token=' + encodeURIComponent(act.dataset.token));
        return;
      }
      if (e.target.closest('[data-act="invite"]')) { openInvite(); return; }
      closeRowMenus(null);
    });
    root.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeRowMenus(null); });
  }

  /* ---------- Developer: leaving the account (Admin, Member) and deleting it (Owner) ---------- */

  function renderLeave() {
    var block = api.team.leaveBlock(org.id, user.email);
    var button = '<button type="button" class="cf-btn cf-btn--secondary" data-act="leave"' + (block ? ' disabled' : '') + '>Leave account</button>';
    body('leave').innerHTML =
      '<p class="t-muted">You will lose access to ' + esc(org.name) + ': its apps, analytics and settings. Your Personal account and your other accounts stay as they are.</p>' +
      (block === 'last_admin'
        ? '<div><span class="mem-tip" tabindex="0" title="You are the only admin and the owner is inactive. Make another member an admin before you leave." aria-describedby="leave-why">' + button + '</span></div>' +
          '<p class="t-caption t-secondary" id="leave-why">You are the only admin and the owner is inactive. Make another member an admin before you leave.</p>'
        : '<div>' + button + '</div>');
    var go = ui.$('[data-act="leave"]', root);
    if (go && !block) go.addEventListener('click', openLeave);
  }

  function openLeave() {
    var m = ui.modal({
      title: 'Leave ' + org.name + '?',
      width: 460,
      body: '<p class="cf-modal__desc">You will lose access to its apps, analytics and settings. To come back, an admin has to invite you again.</p>',
      footer: '<button type="button" class="cf-btn cf-btn--secondary" data-close>Cancel</button><button type="button" class="cf-btn cf-btn--destructive" data-confirm>Leave account</button>'
    });
    ui.$('[data-confirm]', m.el).addEventListener('click', function () {
      var res = api.team.leave(org.id);
      if (!res.ok) { m.close(); return; }
      track('account_left', {});
      Cashful.store.flash('shellToast', 'You left ' + org.name);
      ui.go('dashboard.html');
    });
  }

  function renderDanger() {
    var cents = P.balanceFor(user, org.id);
    var blocked = cents > 0;
    body('danger').innerHTML =
      '<p class="t-muted">Deleting ' + esc(org.name) + ' is permanent. Your Personal account and your other developer accounts are not affected.</p>' +
      (blocked
        ? ui.alertHtml({ tone: 'warning', title: 'Withdraw your remaining balance of ' + fmt.money(cents) + ' before deleting this account', text: 'The balance is lost when the account is deleted.' }) +
          '<div><a href="payouts.html">Go to Payouts</a></div>'
        : '') +
      '<div><button type="button" class="cf-btn cf-btn--destructive" data-act="delete-org"' + (blocked ? ' disabled' : '') + '>Delete account</button></div>';
    var go = ui.$('[data-act="delete-org"]', root);
    if (go && !blocked) go.addEventListener('click', openDeleteOrg);
  }

  function openDeleteOrg() {
    var apps = Cashful.apps ? Cashful.apps.forOrg(org.id).length : 0;
    var members = api.team.rows(org.id).filter(function (r) { return r.kind === 'member' && r.role !== 'owner'; }).length;
    var m = ui.modal({
      title: 'Delete ' + org.name + '?',
      width: 500,
      body: '<form class="set-form" id="delete-org-form" novalidate>' +
        '<p class="cf-modal__desc">This permanently deletes the account. You can’t undo it. What goes with it:</p>' +
        '<ul class="set-consequences">' +
          '<li>' + apps + (apps === 1 ? ' app' : ' apps') + ' and their analytics</li>' +
          '<li>' + members + (members === 1 ? ' team member loses' : ' team members lose') + ' access</li>' +
          '<li>The SDK keys: SDK integrations of this account stop working</li>' +
          '<li>Payout methods and payout history</li></ul>' +
        ui.fieldHtml({ id: 'del-org-name', name: 'confirm', label: 'Type ' + org.name + ' to confirm', autocomplete: 'off', spellcheck: false, noSample: true, autofocus: true }) + '</form>',
      footer: '<button type="button" class="cf-btn cf-btn--secondary" data-close>Cancel</button><button type="submit" form="delete-org-form" class="cf-btn cf-btn--destructive" id="del-org-go" disabled>Delete account</button>'
    });
    var input = ui.$('#del-org-name', m.el), go = ui.$('#del-org-go', m.el);
    input.addEventListener('input', function () { go.disabled = input.value.trim() !== org.name; });
    ui.$('#delete-org-form', m.el).addEventListener('submit', function (e) {
      e.preventDefault();
      if (input.value.trim() !== org.name) return;
      ui.withLoading(go, function () { return later(600); }).then(function () {
        var res = api.deleteOrg(org.id);
        if (!res.ok) { m.close(); return; }
        track('developer_account_deleted', {});
        Cashful.store.flash('shellToast', org.name + ' was deleted');
        ui.go('dashboard.html');
      });
    });
  }

  /* ---------- Billing information (Personal and Developer accounts) ---------- */

  function renderBilling() {
    var has = Cashful.billing.has();
    body('billing').innerHTML = (has ? Cashful.billing.summaryHtml() : '<p class="t-muted">Not added yet. We need it before your first payout.</p>') +
      '<div><button type="button" class="cf-btn cf-btn--secondary" data-act="billing-edit">' + (has ? 'Edit billing information' : 'Add billing information') + '</button></div>';
    ui.$('[data-act="billing-edit"]', root).addEventListener('click', function () {
      Cashful.billing.open({ onSaved: function () { renderBilling(); ui.toast('Billing information saved'); } });
    });
  }

  /* ---------- Developer: anchor navigation ---------- */

  /* The sections of this page in two groups: the account in use, and the person (the same in every account). */
  function sectionGroups() {
    var account = [['verification', 'Verification']];
    if (isDev) account.push(['business', 'Business details'], ['agreements', 'Agreements']);
    if (!isDev || Cashful.can(role, 'payouts')) account.push(['billing', 'Billing information']);
    if (isDev && Cashful.can(role, 'members')) account.push(['members', 'Members']);
    if (isDev && Cashful.can(role, 'account.leave')) account.push(['leave', 'Leave account']);
    if (isDev && Cashful.can(role, 'account.delete')) account.push(['danger', 'Danger zone']);
    var user = [['profile', 'Profile'], ['security', 'Security'], ['notifications', 'Notifications']];
    if (!isDev) user.push(['legal', 'Legal'], ['delete', 'Delete account']);
    return [
      { title: 'Account settings', hint: isDev ? org.name : 'Personal account', items: account },
      { title: 'User settings', hint: 'The same in every account', items: user }
    ];
  }
  var GROUPS = sectionGroups();
  var DEV_SECTIONS = GROUPS.reduce(function (all, g) { return all.concat(g.items); }, []);

  function anchorNavHtml() {
    return '<nav class="set-anchors" aria-label="Settings sections">' + GROUPS.map(function (g) {
      return '<p class="set-anchors__group">' + esc(g.title) + '</p><ul>' + g.items.map(function (s) {
        return '<li><a href="#' + s[0] + '" data-anchor="' + s[0] + '">' + s[1] + '</a></li>';
      }).join('') + '</ul>';
    }).join('') + '</nav>';
  }

  /** A small heading above the first card of a group. */
  function groupHead(i) {
    var g = GROUPS[i];
    return '<div class="set-group"><h2 class="set-group__title">' + esc(g.title) + '</h2><span class="set-group__hint">' + esc(g.hint) + '</span></div>';
  }

  function setupAnchors() {
    var links = ui.$$('[data-anchor]', root);
    function mark(id) {
      links.forEach(function (a) {
        if (a.dataset.anchor === id) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
      });
    }
    function spy() {
      var current = DEV_SECTIONS[0][0];
      DEV_SECTIONS.forEach(function (s) {
        if (document.getElementById(s[0]).getBoundingClientRect().top <= 140) current = s[0];
      });
      // At the very bottom the last section wins even if it is short
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) current = DEV_SECTIONS[DEV_SECTIONS.length - 1][0];
      mark(current);
    }
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; spy(); });
    }, { passive: true });

    function goTo(id, smooth) {
      var sec = document.getElementById(id);
      if (!sec) return;
      sec.scrollIntoView({ behavior: smooth && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto', block: 'start' });
      var h = ui.$('.cf-card__title', sec);
      if (h) h.focus({ preventScroll: true });
      mark(id);
    }
    root.addEventListener('click', function (e) {
      var a = e.target.closest('[data-anchor]');
      if (!a) return;
      e.preventDefault();
      history.replaceState(null, '', '#' + a.dataset.anchor);
      track('settings_anchor_clicked', { section: a.dataset.anchor });
      goTo(a.dataset.anchor, true);
    });
    window.addEventListener('hashchange', function () { goTo(location.hash.slice(1), false); });
    spy();
    // After the browser's own hash handling, so the heading keeps the focus
    if (location.hash && document.getElementById(location.hash.slice(1))) setTimeout(function () { goTo(location.hash.slice(1), false); }, 0);
  }

  /* ---------- Page ---------- */

  function renderDeveloper() {
    var billing = Cashful.can(role, 'payouts');
    root.innerHTML =
      '<header class="cf-pagehead"><div class="cf-pagehead__row"><div class="cf-pagehead__titles">' +
        '<h1 class="cf-pagehead__title">Settings</h1>' +
        '<p class="cf-pagehead__desc">' + esc(org.name) + ': verification, business details, agreements' + (billing ? ', billing' : '') + (Cashful.can(role, 'members') ? ', team' : '') + ' and your profile.</p></div></div></header>' +
      '<div class="set-layout">' + anchorNavHtml() + '<div class="set-stack">' + groupHead(0) +
        card('verification', 'Verification', 'Verify your business to unlock SDK download and payouts.') +
        card('business', 'Business details', 'The business behind your apps.') +
        card('agreements', 'Agreements', 'What you have accepted and signed.') +
        (billing ? card('billing', 'Billing information', 'Who we pay, and where. Needed before your first payout.') : '') +
        (Cashful.can(role, 'members') ? card('members', 'Members', 'The people who can work in ' + esc(org.name) + '.') : '') +
        (Cashful.can(role, 'account.leave') ? card('leave', 'Leave account', 'Stop being part of this account.') : '') +
        (Cashful.can(role, 'account.delete') ? card('danger', 'Danger zone', '', 'set-danger') : '') +
        groupHead(1) +
        card('profile', 'Profile', 'How you appear in Cashful.') +
        card('security', 'Security', 'Keep your account and your earnings safe.') +
        card('notifications', 'Notifications', 'Choose which emails you get.') +
      '</div></div>';
    body('security').innerHTML = '<div data-part="password"></div><div class="set-divider" role="separator"></div><div data-part="tfa"></div>' +
      '<div class="set-divider" role="separator"></div><div data-part="sso"></div>';
    renderVerification();
    renderBusiness();
    renderAgreements();
    if (billing) renderBilling();
    renderProfile();
    renderPassword();
    renderTfa();
    renderSso();
    if (!c.twoFactorEnabled) ui.$('.set-divider', root).hidden = true;
    renderNotifications();
    if (Cashful.can(role, 'members')) renderMembers();
    if (Cashful.can(role, 'account.leave')) renderLeave();
    if (Cashful.can(role, 'account.delete')) renderDanger();
    setupAnchors();
    if (Cashful.store.takeFlash('kycDone')) ui.toast('Verification complete. Apps, the SDK download and payouts are unlocked.');
  }

  // The demo control changes the KYC status or the signature: refresh the parts that depend on them
  if (isDev) {
    api.kyc.onChange(function () {
      if (document.querySelector('.cf-overlay')) return;   // never rebuild under an open dialog
      renderVerification();
      renderBusiness();
      renderAgreements();
    });
  }

  function render() {
    if (isDev) { renderDeveloper(); return; }
    root.innerHTML =
      '<header class="cf-pagehead"><div class="cf-pagehead__row"><div class="cf-pagehead__titles">' +
        '<h1 class="cf-pagehead__title">Settings</h1>' +
        '<p class="cf-pagehead__desc">Your Personal account, and your profile, security and notifications.</p></div></div></header>' +
      '<div class="set-layout">' + anchorNavHtml() + '<div class="set-stack">' + groupHead(0) +
        card('verification', 'Verification', 'Needed only when you withdraw money.') +
        card('billing', 'Billing information', 'Who we pay, and where. Needed before your first payout.') +
        groupHead(1) +
        card('profile', 'Profile', 'How you appear in Cashful.') +
        card('security', 'Security', 'Keep your account and your earnings safe.') +
        card('notifications', 'Notifications', 'Choose which emails you get.') +
        card('legal', 'Legal') +
        card('delete', 'Delete account', '', 'set-danger') +
      '</div></div>';
    body('security').innerHTML = '<div data-part="password"></div><div class="set-divider" role="separator"></div><div data-part="tfa"></div>' +
      '<div class="set-divider" role="separator"></div><div data-part="sso"></div>';
    renderProfile();
    renderPassword();
    renderTfa();
    renderSso();
    if (!c.twoFactorEnabled) ui.$('.set-divider', root).hidden = true;
    renderPeerVerification();
    renderBilling();
    if (Cashful.store.takeFlash('kycDone')) ui.toast('Verification complete. You can withdraw.');
    renderNotifications();
    renderLegal();
    renderDelete();
    setupAnchors();
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
  }
    else if (presetId === 'password-error') fillPassword('wrong-password', 'new-password-1');
  else if (presetId === 'password-success') fillPassword('old-password-1', 'new-password-1');
  else if (presetId === '2fa-setup') openTfaSetup();
  else if (presetId === '2fa-wrong-code') openTfaSetup({ wrongCode: true });
  else if (presetId === 'delete-blocked') { setPayouts('in-progress'); openDelete(); }
  else if (presetId === 'delete-balance') { setPayouts('full'); openDelete(); }
  else if (presetId === 'delete-zero') { setPayouts('full', function (s) { s.balance.available = 0; s.balance.pending = 0; }); openDelete(); }
})();
