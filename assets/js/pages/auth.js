/* One entry for log in and sign up (identifier-first).
   The person never chooses "Log in" or "Sign up": they give an email or use a provider, and the server decides.

     entry ──► welcome (existing email, password)      ──► dashboard  (or login-2fa.html)
           │         └─► link-sent ("email me a login link")
           ├─► link    (a provider whose email already has a password account: log in once to link it)
           └─► type ──► create ──► verify-email.html  (new email; "type" is skipped when ?type= came from the site;
                          └─► unsupported            the verify step is skipped for provider sign-ups)

   ?type=peer|developer   the CTA's account type, kept through the whole flow (and across pages, see auth-common.js).
                          Only a NEW user is ever asked for a type, and only when this is missing. A log in never asks.
   ?ref=CODE              referral link (Personal sign-up).
   ?entry=login|signup    forces what any typed email is: an existing account (log in) or a new one (sign up). Prototype only.
   ?geo=Brazil            tries another detected country. The country is read on the server (here: a mock) and never asked.
                          A country outside the US and EU stops a new sign-up with its own screen.
   ?state=logged-out      the "you've logged out" notice.
   ?demo=wrong-password | locked | link | link-sent | type | create | unsupported | sso-cancelled | network | rate-limit | ref-error
                          states for the screen map (the ones behind a typed email start from a ready one).
   Nothing here logs passwords. Any input is accepted in prototype mode, except an empty email. */
(function () {
  var ui = Cashful.ui;
  var api = Cashful.api;
  var cfg = Cashful.config;
  var rules = cfg.rules;
  var E = cfg.eligibility;
  var R = Cashful.referral;
  var esc = ui.esc;

  var view = ui.$('#auth-view');
  var PROVIDERS = { google: 'Google', github: 'GitHub', apple: 'Apple' };
  var TYPES = {
    personal: { label: 'Personal', context: 'Signing up to earn from your devices' },
    developer: { label: 'Developer', context: 'Signing up to monetize your app' }
  };

  /* ---------- State ---------- */

  function normType(t) { return t === 'developer' ? 'developer' : t === 'peer' || t === 'personal' ? 'personal' : null; }

  // ?entry=login|signup|auto forces what a typed email is (prototype only, see api.identify)
  if (ui.params.get('entry')) api.entryMode(ui.params.get('entry'));

  var typeFromUrl = normType(ui.params.get('type'));
  try { if (typeFromUrl) sessionStorage.setItem('cashful.authType', typeFromUrl); } catch (e) { /* storage may be blocked */ }

  // The one-shot demo switches: a forced error shows once, so the person can still get through afterwards
  var demo = ui.params.get('demo');
  function takeDemo(name) { if (demo === name) { demo = null; return name; } return null; }

  var geo = allCountries().indexOf(ui.params.get('geo')) > -1 ? ui.params.get('geo') : E.geoGuess;
  function allCountries() { return E.supported.concat(E.unsupported); }
  function supported(c) { return E.supported.indexOf(c) > -1; }

  var S = {
    step: 'entry',
    email: Cashful.store.takeFlash('authEmail') || '',
    type: typeFromUrl,          // 'personal' | 'developer' | null
    provider: null,             // set when a provider identity is in play
    info: null,                 // what the lookup said about the email
    country: geo,
    waitDone: false
  };

  // Referral link: the code is remembered for the attribution window, Personal sign-up only, while referrals are on
  var referralsOn = !!R && R.settings().enabled;
  var refParam = ui.params.get('ref');
  if (referralsOn) {
    if (refParam) R.attribution.save(refParam);
    else { var savedRef = R.attribution.get(); if (savedRef) refParam = savedRef.code; }
  } else { refParam = null; }
  var referrer = refParam ? api.findReferral(refParam) : null;

  /* ---------- Pieces ---------- */

  function icon(name, size) { return '<cf-icon name="' + name + '" size="' + (size || 20) + '"></cf-icon>'; }
  function head(title, lead) {
    return '<div class="auth__head"><h1 class="auth__title" id="auth-title" tabindex="-1">' + esc(title) + '</h1>' + (lead ? '<p class="auth__lead">' + lead + '</p>' : '') + '</div>';
  }
  function slot() { return '<div id="alert-slot" hidden></div>'; }
  function chip(html, action, label) {
    return '<div class="auth__chip"><span class="auth__chip-text">' + html + '</span><button type="button" class="cf-link" data-act="' + action + '">' + (label || 'Change') + '</button></div>';
  }
  function emailChip(prefix) { return chip((prefix ? esc(prefix) + ' ' : '') + '<strong>' + esc(S.email) + '</strong>', 'change-email'); }
  function backLink(text, act) { return '<button type="button" class="cf-link auth__back" data-act="' + act + '">' + esc(text) + '</button>'; }
  function legal() {
    return '<p class="auth__legal">By continuing, you agree to the <a href="#">Terms</a>, <a href="#">Acceptable use policy</a> and <a href="#">Privacy policy</a>.</p>';
  }
  function social(prefixAction) {
    return '<div class="auth__social">' + Object.keys(PROVIDERS).map(function (p) {
      return '<button type="button" class="cf-btn cf-btn--secondary cf-btn--block" data-social="' + p + '">' +
        '<cf-brand-icon name="' + p + '"></cf-brand-icon><span>Continue with ' + PROVIDERS[p] + '</span></button>';
    }).join('') + '</div>';
  }
  function invite() {
    if (!referrer) return '';
    return '<div class="auth__invite"><span class="cf-avatar">' + esc(referrer.initials) + '</span><div class="auth__invite-text">' +
      '<strong class="t-body">' + esc(referrer.name) + ' invited you to Cashful</strong>' +
      '<span class="t-body t-secondary">Connect a device and start earning. ' + esc(referrer.name) + '’s reward is paid by Cashful and never reduces yours.</span></div></div>';
  }
  function alertIn(a) { ui.alert(ui.$('#alert-slot', view), a); }

  function networkAlert(retry) {
    alertIn({ tone: 'error', title: 'We couldn’t reach Cashful', text: 'Check your connection and try again.' });
    var slotEl = ui.$('#alert-slot', view);
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'cf-btn cf-btn--secondary cf-btn--sm'; b.textContent = 'Try again';
    b.addEventListener('click', retry);
    slotEl.appendChild(b);
  }

  /* ---------- Navigation: every step is a history entry, so Back works ---------- */

  var stopTimer = null;
  function snapshot() { return { step: S.step, email: S.email, type: S.type, provider: S.provider, info: S.info, country: S.country }; }

  function go(step, opts) {
    S.step = step;
    if (!(opts && opts.silent)) history.pushState(snapshot(), '', location.pathname + location.search + '#' + step);
    render();
  }
  window.addEventListener('popstate', function (e) {
    if (stopTimer) { stopTimer(); stopTimer = null; }
    if (e.state && e.state.step) { Object.assign(S, e.state); render(); }
    else { S.step = 'entry'; render(); }
  });

  var STEPS = { entry: entry, welcome: welcome, 'link-sent': linkSent, type: pickType, create: create, unsupported: unsupported, link: link };

  function render() {
    if (stopTimer) { stopTimer(); stopTimer = null; }
    if (S.step === 'create' && !S.type) S.step = 'type';   // a Back into the form without a type
    if ((S.step === 'create' || S.step === 'type') && !supported(S.country)) S.step = 'unsupported';
    view.innerHTML = STEPS[S.step]();
    var after = AFTER[S.step];
    if (after) after();
    var first = ui.$('input:not([disabled]):not([type="checkbox"]):not([hidden]), select', view);
    if (first && S.step !== 'type') first.focus(); else { var h = ui.$('#auth-title', view); if (h) h.focus(); }
  }
  var AFTER = {};

  /* ---------- After a successful log in ---------- */

  /** A Developer CTA from a Personal login starts the Developer onboarding inside the same account. */
  function arrive(redirect) {
    api.applyIntent(S.type).then(function (url) { ui.go(url || redirect); });
  }
  function toTwoFactor() {
    Cashful.store.flash('authIntent', S.type || '');
    ui.go('login-2fa.html');
  }

  /* ---------- 01 Log in or sign up ---------- */

  function entry() {
    return (S.type ? '<div><span class="cf-badge cf-badge--brand"><span class="cf-badge__dot"></span>' + esc(TYPES[S.type].context) + '</span></div>' : '') +
      invite() +
      head('Log in or sign up', 'Use your email or a connected account. We’ll take you to the right place.') +
      slot() + social() + '<div class="auth__divider">or</div>' +
      '<form class="auth__fields" id="entry-form" novalidate>' +
        ui.fieldHtml({ id: 'email', name: 'email', label: 'Email', type: 'email', value: S.email, placeholder: 'you@example.com', autocomplete: 'email', spellcheck: false }) +
        '<button type="submit" class="cf-btn cf-btn--primary cf-btn--block">Continue</button>' +
      '</form>' + legal();
  }
  AFTER.entry = function () {
    if (ui.params.get('state') === 'logged-out' && !S.shownLoggedOut) {
      S.shownLoggedOut = true;
      alertIn({ tone: 'success', title: 'You’ve logged out', text: 'Log in again any time. Your devices keep earning in the meantime.' });
    }
    bindSocial();
    var form = ui.$('#entry-form', view);
    var email = ui.$('#email', form);
    var submit = ui.$('button[type="submit"]', form);

    function submitEmail() {
      var v = email.value.trim();
      if (!v) { ui.setError(email, 'Enter your email.'); email.focus(); return; }
      if (api.strict && !ui.isEmail(v)) { ui.setError(email, 'Enter a valid email, like you@example.com.'); email.focus(); return; }
      alertIn(null);
      ui.withLoading(submit, function () { return api.identify(v, { demo: takeDemo('network') || takeDemo('rate-limit') }); }).then(function (res) {
        if (!res.ok) return failedLookup(res, submit, submitEmail);
        S.email = v;
        S.info = res;
        S.provider = null;
        if (res.exists) go('welcome'); else go(newUserStep());
      });
    }
    form.addEventListener('submit', function (e) { e.preventDefault(); submitEmail(); });

    // The demo states that start on this screen
    if (demo === 'sso-cancelled') { /* shown when a provider button is pressed */ }
    if (demo === 'rate-limit') { demo = null; failedLookup({ error: 'rate_limited', retryIn: 45 }, submit, submitEmail); }
    if (demo === 'network') { demo = null; failedLookup({ error: 'network' }, submit, submitEmail); }
  };

  function failedLookup(res, submit, retry) {
    if (res.error === 'rate_limited') {
      // Neutral wording: the same message whatever was typed
      var until = Date.now() + res.retryIn * 1000;
      submit.disabled = true;
      alertIn({ tone: 'warning', title: 'Too many attempts', text: 'Wait a moment, then try again.' });
      stopTimer = ui.countdown(until, function (left) { submit.textContent = 'Try again in ' + ui.formatTime(left); }, function () {
        submit.disabled = false; submit.textContent = 'Continue'; alertIn(null);
      });
      return;
    }
    networkAlert(retry);
  }

  /** A new person: not served in this country → the dedicated screen, else the type (when the CTA gave none) or the form. */
  function newUserStep() { return !supported(S.country) ? 'unsupported' : S.type ? 'create' : 'type'; }

  /* ---------- Providers ---------- */

  function bindSocial() {
    ui.$$('[data-social]', view).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var p = btn.dataset.social;
        alertIn(null);
        ui.withLoading(btn, function () {
          return api.social(p, { demo: takeDemo('sso-cancelled') || takeDemo('network') });
        }).then(function (res) {
          if (res.status === 'ok') return arrive(res.redirect);
          if (res.status === '2fa') return toTwoFactor();
          if (res.status === 'cancelled') return alertIn({ tone: 'warning', title: PROVIDERS[p] + ' sign-in was cancelled', text: 'Try again, or use your email instead.' });
          if (res.status === 'network') return networkAlert(function () { btn.click(); });
          S.email = res.email;
          S.provider = p;
          S.info = null;
          if (res.status === 'link_required') return go('link');
          go(newUserStep());   // a provider account that is new here: no password step
        });
      });
    });
  }

  /* ---------- 02 Welcome back ---------- */

  function welcome() {
    var providers = (S.info && S.info.providers) || [];
    var noPassword = S.info && !S.info.hasPassword;
    return head('Welcome back', noPassword
      ? 'This email signs in with ' + (providers.length ? esc(PROVIDERS[providers[0]]) : 'a connected account') + '.'
      : 'Enter your password to log in.') +
      emailChip() + slot() +
      (noPassword
        ? '<div class="auth__social">' + (providers.length ? providers.map(function (p) {
            return '<button type="button" class="cf-btn cf-btn--secondary cf-btn--block" data-social="' + p + '"><cf-brand-icon name="' + p + '"></cf-brand-icon><span>Continue with ' + PROVIDERS[p] + '</span></button>';
          }).join('') : '') + '</div>' +
          '<button type="button" class="cf-btn cf-btn--secondary cf-btn--block" data-act="email-link">Email me a login link instead</button>'
        : '<form class="auth__fields" id="login-form" novalidate>' +
            '<div class="cf-input" id="pw-wrap"><div class="auth__row"><label class="cf-input__label" for="password">Password</label>' +
              '<a href="forgot-password.html" id="forgot" class="t-caption">Forgot password?</a></div>' +
              '<div class="cf-field"><input class="cf-field__input" id="password" name="password" type="password" autocomplete="current-password"></div>' +
              '<div class="cf-input__helper"></div></div>' +
            '<button type="submit" class="cf-btn cf-btn--primary cf-btn--block" id="submit">Log in</button>' +
            '<button type="button" class="cf-btn cf-btn--secondary cf-btn--block" data-act="email-link">Email me a login link instead</button>' +
          '</form>');
  }
  AFTER.welcome = function () {
    bindSocial();
    var form = ui.$('#login-form', view);
    if (!form) return;
    var password = ui.$('#password', form);
    var submit = ui.$('#submit', form);
    var locks = [password];

    ui.$('#forgot', view).addEventListener('click', function () { Cashful.store.flash('resetEmail', S.email); });

    function setLocked(until) {
      locks.forEach(function (i) { ui.setDisabled(i, true); });
      submit.disabled = true;
      alertIn({ tone: 'error', title: 'Too many attempts', text: 'For your security, logging in is paused for ' + rules.lockMinutes + ' minutes. You can reset your password now.' });
      stopTimer = ui.countdown(until, function (left) { submit.textContent = 'Try again in ' + ui.formatTime(left); }, function () {
        locks.forEach(function (i) { ui.setDisabled(i, false); });
        submit.disabled = false; submit.textContent = 'Log in'; alertIn(null); password.focus();
      });
    }
    function wrong(left) {
      alertIn({ tone: 'error', title: 'Wrong email or password',
        text: (left != null ? 'You have ' + left + ' attempt' + (left === 1 ? '' : 's') + ' left. ' : '') + 'After ' + rules.maxLoginAttempts + ' failed attempts, logging in pauses for ' + rules.lockMinutes + ' minutes.' });
      ui.setError(password, 'Wrong email or password.');
      password.focus();
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (api.strict && !password.value) { ui.setError(password, 'Enter your password.'); password.focus(); return; }
      alertIn(null);
      ui.withLoading(submit, function () { return api.logIn({ email: S.email, password: password.value, remember: false, link: S.provider }); }).then(function (res) {
        if (res.status === 'ok') return arrive(res.redirect);
        if (res.status === '2fa') return toTwoFactor();
        if (res.status === 'locked') return setLocked(res.until);
        wrong(res.attemptsLeft);
      });
    });

    // Demo states: a wrong password, or a locked email
    if (demo === 'wrong-password') { demo = null; password.value = 'wrong-password'; wrong(rules.maxLoginAttempts - 1); }
    var until = api.lockState(S.email);
    if (demo === 'locked') { demo = null; api.demo.lock(S.email); until = api.lockState(S.email); }
    if (until) setLocked(until);
  };

  /* ---------- Log in by email link ---------- */

  function sendLink(btn, fromStep) {
    ui.withLoading(btn, function () { return api.sendLoginLink(S.email); }).then(function () {
      if (fromStep === 'link-sent') { alertIn({ tone: 'success', title: 'New link sent', text: 'Earlier links no longer work.' }); startLinkTimer(); }
      else go('link-sent');
    });
  }

  function linkSent() {
    return head('Check your email', 'We sent a login link to <strong>' + esc(S.email) + '</strong>. It works for ' + rules.loginLinkTtlMin + ' minutes.') +
      slot() +
      '<p class="auth__note" id="link-wait">Didn’t get it? You can resend it in <span id="link-timer">1:00</span></p>' +
      '<button type="button" class="cf-btn cf-btn--secondary cf-btn--block" data-act="resend-link" hidden>Resend link</button>' +
      '<button type="button" class="cf-btn cf-btn--primary cf-btn--block" data-act="open-link">Open the link <span class="t-caption">(prototype)</span></button>' +
      backLink('Use your password instead', 'to-welcome') + backLink('Wrong email? Change', 'change-email');
  }
  function startLinkTimer() {
    var wait = ui.$('#link-wait', view), resend = ui.$('[data-act="resend-link"]', view);
    resend.hidden = true; wait.hidden = false;
    if (stopTimer) stopTimer();
    stopTimer = ui.countdown(Date.now() + rules.resendCooldownSec * 1000, function (left) {
      ui.$('#link-timer', view).textContent = ui.formatTime(left);
    }, function () { wait.hidden = true; resend.hidden = false; });
  }
  AFTER['link-sent'] = startLinkTimer;

  /* ---------- 03 New user: pick the account type ---------- */

  function pickType() {
    function card(id, eyebrow, title, text, note) {
      return '<button type="button" class="cf-choice" data-type="' + id + '">' +
        '<span class="cf-choice__icon">' + icon(id === 'personal' ? 'smartphone' : 'code', 24) + '</span>' +
        '<span class="cf-choice__body"><span class="cf-choice__eyebrow">' + eyebrow + '</span><span class="cf-choice__title">' + title + '</span>' +
        '<span class="cf-choice__text">' + text + '</span>' + (note ? '<span class="cf-choice__text"><strong>' + note + '</strong></span>' : '') + '</span>' +
        '<span class="cf-choice__chevron">' + icon('chevron-right', 20) + '</span></button>';
    }
    return head('How do you want to earn?', 'Pick one to start. You can add the other account later from the account switcher.') +
      chip('Creating an account for <strong>' + esc(S.email) + '</strong>', 'change-email') +
      '<div class="auth__stack">' +
        card('personal', 'Personal', 'Earn from my devices', 'Install the Cashful app on your phone, computer or router and get paid for bandwidth you don’t use.') +
        card('developer', 'Developer', 'Monetize my app', 'Add the Cashful SDK to your app and earn from users who opt in.', 'Requires identity verification before you get the SDK') +
      '</div>';
  }
  AFTER.type = function () {
    ui.$$('[data-type]', view).forEach(function (b) {
      b.addEventListener('click', function () { S.type = b.dataset.type; go('create'); });
    });
  };

  /* ---------- 04 New user: create account ---------- */

  function create() {
    var p = S.provider;
    return head('Create your account', p ? 'You’re signing in with ' + esc(PROVIDERS[p]) + '. One more step.' : 'It takes less than a minute.') +
      chip(esc(TYPES[S.type].label) + ' account', 'change-type') +
      (S.type === 'personal' ? invite() : '') +
      slot() +
      '<form class="auth__fields" id="create-form" novalidate>' +
        ui.fieldHtml({ id: 'email', name: 'email', label: 'Email', type: 'email', value: S.email, disabled: true, helper: p ? 'From your ' + PROVIDERS[p] + ' account.' : '' }) +
        (p ? '' : ui.fieldHtml({ id: 'password', name: 'password', label: 'Password', type: 'password', placeholder: 'At least 8 characters', autocomplete: 'new-password', helper: 'Use 8 or more characters with at least one number.' })) +
        (S.type === 'personal' && referralsOn
          ? '<button type="button" class="cf-link" id="referral-open" style="align-self:flex-start;text-decoration:none"' + (refParam ? ' hidden' : '') + '>Have a referral code?</button>' +
            '<div class="cf-input" id="referral-field"' + (refParam ? '' : ' hidden') + '><label class="cf-input__label" for="referral">Referral code</label>' +
              '<div class="cf-field"><input class="cf-field__input" id="referral" name="referral" placeholder="e.g. JORDAN24" autocomplete="off" value="' + esc((refParam || '').toUpperCase()) + '"></div>' +
              '<div class="cf-input__helper">Optional. You can only add a code when you sign up.</div></div>'
          : '') +
        '<div class="cf-check-group"><label class="cf-check"><input class="cf-check__input" type="checkbox" id="terms" name="terms">' +
          '<span class="cf-checkbox__box"><cf-icon name="check" size="14" stroke-width="2.75"></cf-icon></span>' +
          '<span class="cf-check__label">I agree to the <a href="#">Terms</a>, <a href="#">Acceptable use policy</a> and <a href="#">Privacy policy</a></span></label>' +
          '<div class="cf-check-group__error"></div></div>' +
        '<button type="submit" class="cf-btn cf-btn--primary cf-btn--block">Create account</button>' +
        '<p class="auth__note">No ID or business details now. You add them inside the dashboard, when you’re ready.</p>' +
      '</form>';
  }
  AFTER.create = function () {
    var form = ui.$('#create-form', view);
    var password = ui.$('#password', form);
    var terms = ui.$('#terms', form);
    var referral = ui.$('#referral', form);
    var submit = ui.$('button[type="submit"]', form);

    var open = ui.$('#referral-open', form);
    if (open) open.addEventListener('click', function () { open.hidden = true; ui.$('#referral-field', form).hidden = false; referral.focus(); });
    if (referral && refParam && !referrer) ui.setError(referral, 'We couldn’t find this code. Check it or leave the field empty.');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (api.strict) {
        var ok = true;
        if (password && !ui.isStrongPassword(password.value)) { ui.setError(password, 'Use 8 or more characters with at least one number.'); ok = false; }
        if (!terms.checked) { ui.setError(terms, 'Accept the terms to create an account.'); ok = false; }
        if (!ok) { var bad = ui.$('.is-error input', form); if (bad) bad.focus(); return; }
      }
      ui.withLoading(submit, function () {
        return api.signUp({
          type: S.type, email: S.email, password: password ? password.value : '', sso: S.provider || undefined,
          referral: referral && !ui.$('#referral-field', form).hidden ? referral.value : '', country: S.country, terms: terms.checked
        }).then(function (res) {
          if (res.ok) return ui.go(res.redirect);
          if (res.error === 'unsupported_country') return go('unsupported');
          if (res.error === 'referral_not_found') { ui.setError(referral, 'We couldn’t find this code. Check it or leave the field empty.'); referral.focus(); }
        });
      });
    });
    if (demo === 'ref-error' && referral) { demo = null; open && (open.hidden = true); ui.$('#referral-field', form).hidden = false; ui.setError(referral, 'We couldn’t find this code. Check it or leave the field empty.'); }
  };

  /* ---------- Country not served yet ---------- */

  function unsupported() {
    var where = S.country;
    return head('Cashful isn’t available in ' + where + ' yet', 'We work in the US and EU for now. Leave your email and we’ll tell you the day we open in your country. We use it for nothing else.') +
      slot() +
      (S.waitDone
        ? '<div class="cf-alert cf-alert--success" role="status"><cf-icon class="cf-alert__icon" name="check-circle" size="20"></cf-icon><div class="cf-alert__text"><div class="cf-alert__title">You’re on the list</div><div class="cf-alert__desc">We’ll email you the day Cashful opens in your country.</div></div></div>'
        : '<form class="auth__fields" id="wait-form" novalidate>' +
            ui.fieldHtml({ id: 'wait-email', name: 'email', label: 'Email', type: 'email', value: S.email, autocomplete: 'email', spellcheck: false }) +
            '<button type="submit" class="cf-btn cf-btn--primary cf-btn--block">Notify me</button></form>') +
      backLink('Use a different email', 'change-email');
  }
  AFTER.unsupported = function () {
    var form = ui.$('#wait-form', view);
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var w = ui.$('#wait-email', form);
      if (!w.value.trim() || (api.strict && !ui.isEmail(w.value))) { ui.setError(w, 'Enter a valid email, like you@example.com.'); w.focus(); return; }
      ui.withLoading(ui.$('button[type="submit"]', form), function () { return new Promise(function (r) { setTimeout(r, 500); }); }).then(function () {
        S.waitDone = true; render();
      });
    });
  };

  /* ---------- 06 Existing email, new provider ---------- */

  function link() {
    var name = PROVIDERS[S.provider];
    return head('You already have an account', '<strong>' + esc(S.email) + '</strong> is registered with a password. Log in once to link ' + esc(name) + ', then use either to sign in.') +
      slot() +
      '<form class="auth__fields" id="login-form" novalidate>' +
        '<div class="cf-input"><div class="auth__row"><label class="cf-input__label" for="password">Password</label>' +
          '<a href="forgot-password.html" id="forgot" class="t-caption">Forgot password?</a></div>' +
          '<div class="cf-field"><input class="cf-field__input" id="password" name="password" type="password" autocomplete="current-password"></div>' +
          '<div class="cf-input__helper"></div></div>' +
        '<button type="submit" class="cf-btn cf-btn--primary cf-btn--block" id="submit">Log in and link ' + esc(name) + '</button>' +
        '<button type="button" class="cf-btn cf-btn--secondary cf-btn--block" data-act="different-account">Use a different account</button>' +
      '</form>';
  }
  AFTER.link = function () { AFTER.welcome(); };

  /* ---------- Shared actions ---------- */

  view.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var act = b.dataset.act;
    if (act === 'change-email') { S.provider = null; S.info = null; go('entry'); }
    else if (act === 'change-type') go('type');
    else if (act === 'to-welcome') go('welcome');
    else if (act === 'different-account') { S.provider = null; S.email = ''; go('entry'); }
    else if (act === 'email-link') sendLink(b, S.step);
    else if (act === 'resend-link') sendLink(b, 'link-sent');
    else if (act === 'open-link') {
      ui.withLoading(b, function () { return api.logInWithLink(S.email); }).then(function (res) {
        if (res.status === 'ok') arrive(res.redirect); else if (res.status === '2fa') toTwoFactor();
      });
    }
  });

  /* ---------- Start ---------- */

  // Screen map: states that sit behind a typed email start from a ready one
  var existing = cfg.seedUsers[0].email;
  var STARTS = {
    'wrong-password': function () { S.email = existing; S.info = { exists: true, hasPassword: true, providers: [] }; S.step = 'welcome'; },
    locked: function () { S.email = existing; S.info = { exists: true, hasPassword: true, providers: [] }; S.step = 'welcome'; },
    link: function () { S.email = cfg.seedUsers[1].email; S.provider = 'github'; S.step = 'link'; },
    'link-sent': function () { S.email = existing; S.step = 'link-sent'; },
    type: function () { S.email = 'new.person@example.com'; S.step = 'type'; },
    create: function () { S.email = 'new.person@example.com'; S.type = S.type || 'personal'; S.step = 'create'; },
    unsupported: function () { S.email = 'new.person@example.com'; S.type = S.type || 'personal'; S.country = allCountries().indexOf(ui.params.get('geo')) > -1 ? ui.params.get('geo') : 'Brazil'; S.step = 'unsupported'; }
  };
  if (STARTS[demo] && !location.hash) { var startDemo = demo; if (demo === 'link-sent' || demo === 'type' || demo === 'create' || demo === 'unsupported' || demo === 'link') demo = null; STARTS[startDemo](); }

  history.replaceState(snapshot(), '', location.pathname + location.search + location.hash);
  render();
})();
