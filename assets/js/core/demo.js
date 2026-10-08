/* Prototype panel: demo credentials for the current page, screen map link, data reset.
   Not part of the product UI — remove the script tag to hide it. */
(function () {
  var cfg = Cashful.config;
  var d = cfg.demo;
  var u = cfg.seedUsers;

  var ANY = 'Prototype mode: <b>any input works</b>. Error states are on the screen map.';
  var stage = function (s, label) { return '<a href="dashboard.html?state=' + s + '">' + label + '</a>'; };

  var LENIENT_HINTS = {
    'auth': [ANY + ' An empty email is the only thing it refuses.', 'Existing accounts: <b>' + u[0].email + '</b> (Personal, 2FA) and <b>' + u[1].email + '</b> (Developer). Any other email starts sign-up.', 'Providers: Google logs in the Personal demo · GitHub asks to link (Developer demo) · Apple is a new account.', 'To show <b>log in</b> with any email: set “Any typed email is…” below, or open <a href="auth.html?entry=login">?entry=login</a>.', 'Site CTAs: <a href="auth.html?type=developer">?type=developer</a> · <a href="auth.html?type=peer">?type=peer</a> · <a href="auth.html?ref=JORDAN24">?ref=JORDAN24</a>'],
    'verify-email': [ANY + ' Six digits submit automatically.'],
    'login-2fa': [ANY],
    'forgot-password': [ANY],
    'reset-password': [ANY],
    'earn-handoff': ['<a href="earn-handoff.html?token=expired">Expired link</a>'],
    'overview': [
      'Overview stage: ' + stage('new', 'New') + ' · ' + stage('day1', 'Day 1') + ' · ' + stage('active', '2 months') + ' · ' + stage('payout', 'Payout ready'),
      'On <b>New</b>: Add a device → Close, and the first device connects.',
      '<a href="dashboard.html?state=new&amp;referrals=no-devices">No devices, no referrals</a> · <a href="dashboard.html?state=new&amp;referrals=default">No devices, with referrals</a>',
      '“Become a developer” in the sidebar adds the second account.'
    ],
    'download': ['Hover a tile to see “How to install”.', 'Hero for another OS: <a href="download.html?os=windows">Windows</a> · <a href="download.html?os=macos">macOS</a>'],
    'developer-verification': [ANY, 'Progress is saved after each step — log out and back in to see “Welcome back”.', 'Jump to: <a href="#type">type</a> · <a href="#details">details</a> · <a href="#apps">apps</a> · <a href="#agreements">agreements</a> · <a href="#kyc">identity</a>'],
    'analytics': ['Review result: <a href="analytics.html?state=review">In review</a> · <a href="analytics.html?state=approved">Approved</a> · <a href="analytics.html?state=action">Action needed</a>']
  };

  var HINTS = {
    'auth': [
      'Existing: <b>' + u[0].email + '</b> / <b>' + u[0].password + '</b> (Personal + 2FA), <b>' + u[1].email + '</b> / <b>' + u[1].password + '</b> (Developer)',
      'Any other email starts sign-up. Valid referral code: <b>JORDAN24</b>',
      'Wrong password ' + cfg.rules.maxLoginAttempts + ' times → locked for ' + cfg.rules.lockMinutes + ' min',
      'Providers: Google logs in the Personal demo · GitHub asks to link · Apple is a new account'
    ],
    'verify-email': ['Correct code: <b>' + d.emailCode + '</b>', 'Any other code shows the error state.'],
    'login-2fa': ['Authenticator code: <b>' + d.totpCode + '</b>', 'Backup code: <b>' + d.backupCode + '</b>'],
    'forgot-password': ['Use <b>' + u[0].email + '</b> to get a working reset link.'],
    'reset-password': ['Password needs 8+ characters and a number.'],
    'earn-handoff': ['<a href="earn-handoff.html?token=expired">Expired link</a>']
  };

  /** Log in or sign up? The entry screen decides from the email; this forces one, to show either flow on purpose. */
  function entryControl() {
    var mode = Cashful.api.entryMode();
    var opts = [['auto', 'By the email (default)'], ['login', 'Always an existing account (log in)'], ['signup', 'Always a new account (sign up)']];
    return '<div class="cf-input demo__field"><label class="cf-input__label" for="demo-entry">Any typed email is…</label>' +
      '<div class="cf-field cf-field--select"><select class="cf-field__input" id="demo-entry">' +
      opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === mode ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
      '</select><cf-icon name="chevron-down" size="20"></cf-icon></div><div class="cf-input__helper">Use “existing” to show log in with any email.</div></div>';
  }

  function render() {
    var page = document.body.dataset.page;
    var hints = (cfg.strictValidation ? HINTS[page] : LENIENT_HINTS[page]) || LENIENT_HINTS[page] || [];
    var el = document.createElement('div');
    el.className = 'demo';
    el.innerHTML =
      '<button type="button" class="demo__toggle" aria-expanded="false">Prototype</button>' +
      '<div class="demo__panel" hidden>' +
        '<div class="demo__title">Demo data</div>' +
        (hints.length ? '<ul class="demo__list">' + hints.map(function (h) { return '<li>' + h + '</li>'; }).join('') + '</ul>' : '<p class="demo__muted">Nothing to enter on this screen.</p>') +
        (page === 'auth' ? entryControl() : '') +
        '<div class="demo__actions">' +
          '<a class="cf-btn cf-btn--secondary cf-btn--sm" href="screens.html">Screen map</a>' +
          '<button type="button" class="cf-btn cf-btn--ghost cf-btn--sm" data-demo-reset>Reset data</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);

    var toggle = el.querySelector('.demo__toggle');
    var panel = el.querySelector('.demo__panel');
    toggle.addEventListener('click', function () {
      panel.hidden = !panel.hidden;
      var entrySel = el.querySelector('#demo-entry');
      if (entrySel) entrySel.value = Cashful.api.entryMode();   // ?entry= may have changed it after the panel was drawn
      toggle.setAttribute('aria-expanded', String(!panel.hidden));
    });
    var entry = el.querySelector('#demo-entry');
    if (entry) entry.addEventListener('change', function () { Cashful.api.entryMode(entry.value); Cashful.ui.toast('Typed emails are now: ' + entry.options[entry.selectedIndex].text.toLowerCase()); });
    el.querySelector('[data-demo-reset]').addEventListener('click', function () {
      Cashful.store.reset();
      Cashful.ui.toast('Demo data reset');
      setTimeout(function () { location.reload(); }, 600);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
