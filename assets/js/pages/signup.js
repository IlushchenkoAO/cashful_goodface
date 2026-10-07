/* Sign up — personal (signup.html) and developer (signup-developer.html).
   States: default · email taken · referral from link (?ref=CODE) · referral not found.
   "Change email" on the verify screen pre-fills the email via store.flash('signupEmail'). */
(function () {
  var ui = Cashful.ui;
  var api = Cashful.api;

  var form = ui.$('#signup-form');
  var type = form.dataset.accountType;
  var email = ui.$('#email');
  var password = ui.$('#password');
  var referral = ui.$('#referral');
  var referralField = ui.$('#referral-field');
  var referralOpen = ui.$('#referral-open');
  var terms = ui.$('#terms');
  var takenActions = ui.$('#taken-actions');
  var submit = ui.$('button[type="submit"]', form);

  function openReferral() {
    referralOpen.hidden = true;
    referralField.hidden = false;
  }

  referralOpen.addEventListener('click', function () {
    openReferral();
    referral.focus();
  });

  email.addEventListener('input', function () { takenActions.hidden = true; });

  /* Referral link: /signup?ref=JORDAN24 pre-fills the code and shows who invited.
     The code is remembered for the attribution window, so it still applies if the visitor comes back later.
     Personal sign-up only, and only while referrals are on. */
  var R = Cashful.referral;
  var managed = !!R && type === 'personal';                 // the Referrals config applies here
  var referralsOn = managed && R.settings().enabled;
  if (managed && !referralsOn) referralOpen.hidden = true;  // referrals are off: no code field

  var refParam = ui.params.get('ref');
  if (referralsOn) {
    if (refParam) R.attribution.save(refParam);
    else {
      var saved = R.attribution.get();
      if (saved) refParam = saved.code;
    }
  }
  if (refParam && (!managed || referralsOn)) {
    openReferral();
    referral.value = refParam.toUpperCase();
    var referrer = api.findReferral(refParam);
    if (referrer) {
      var invite = ui.$('#invite');
      if (invite) {
        invite.hidden = false;
        ui.$('#invite-avatar').textContent = referrer.initials;
        ui.$('#invite-name').textContent = referrer.name;
        if (referralsOn) ui.$('#invite-sub').textContent = 'Connect a device and start earning. ' + referrer.name + '’s reward is paid by Cashful and never reduces yours.';
      }
      ui.setHelper(referral, referralsOn
        ? 'Code applied. ' + referrer.name + ' earns a reward when you start earning. It never reduces your earnings.'
        : 'Code applied.');
    } else {
      ui.setError(referral, 'We couldn’t find this code. Check it or leave the field empty.');
    }
  }

  var prefill = Cashful.store.takeFlash('signupEmail');
  if (prefill) email.value = prefill;

  ui.$('#taken-login').addEventListener('click', function () {
    Cashful.store.flash('loginEmail', email.value.trim());
  });

  function showTaken() {
    ui.setError(email, 'An account with this email already exists.');
    takenActions.hidden = false;
    email.focus();
  }

  function validate() {
    if (!api.strict) return true;   // prototype mode: any input is fine
    var ok = true;
    if (!email.value.trim()) { ui.setError(email, 'Enter your email.'); ok = false; }
    else if (!ui.isEmail(email.value)) { ui.setError(email, 'Enter a valid email, like you@example.com.'); ok = false; }

    if (!ui.isStrongPassword(password.value)) {
      ui.setError(password, 'Use 8 or more characters with at least one number.');
      ok = false;
    }
    if (!terms.checked) { ui.setError(terms, 'Accept the terms to create an account.'); ok = false; }
    return ok;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    takenActions.hidden = true;
    if (!validate()) {
      var firstError = ui.$('.is-error input', form);
      if (firstError) firstError.focus();
      return;
    }

    ui.withLoading(submit, function () {
      return api.signUp({
        type: type,
        email: email.value,
        password: password.value,
        referral: referralField.hidden ? '' : referral.value,
        terms: terms.checked
      }).then(function (res) {
        if (res.ok) return ui.go(res.redirect);
        if (res.error === 'taken') showTaken();
        if (res.error === 'referral_not_found') {
          ui.setError(referral, 'We couldn’t find this code. Check it or leave the field empty.');
          referral.focus();
        }
      });
    });
  });

  /* Demo states: ?demo=taken, ?demo=ref-error (with ?ref=CODE) */
  var demo = ui.params.get('demo');
  if (demo === 'taken') {
    email.value = Cashful.config.seedUsers[type === 'developer' ? 1 : 0].email;
    showTaken();
  }
  if (demo === 'ref-error') {
    var invite = ui.$('#invite');
    if (invite) invite.hidden = true;
    openReferral();
    ui.setError(referral, 'We couldn’t find this code. Check it or leave the field empty.');
  }
})();
