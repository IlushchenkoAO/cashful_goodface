/* Prototype panel: demo credentials for the current page, screen map link, data reset.
   Not part of the product UI — remove the script tag to hide it. */
(function () {
  var cfg = Cashful.config;
  var d = cfg.demo;
  var u = cfg.seedUsers;

  var ANY = 'Prototype mode: <b>any input works</b>. Error states are on the screen map.';
  var stage = function (s, label) { return '<a href="dashboard.html?state=' + s + '">' + label + '</a>'; };

  var LENIENT_HINTS = {
    'choose-type': ['Pick an account type to start sign-up.'],
    'signup-personal': [ANY, 'Referral link: <a href="signup.html?ref=JORDAN24">signup.html?ref=JORDAN24</a>'],
    'signup-developer': [ANY],
    'verify-email': [ANY + ' Six digits submit automatically.'],
    'login': [ANY, '<b>dev@studio.dev</b> opens the developer flow.'],
    'login-2fa': [ANY],
    'forgot-password': [ANY],
    'reset-password': [ANY],
    'earn-handoff': ['<a href="earn-handoff.html?token=expired">Expired link</a>'],
    'overview': [
      'Overview stage: ' + stage('new', 'New') + ' · ' + stage('day1', 'Day 1') + ' · ' + stage('active', '2 months') + ' · ' + stage('payout', 'Payout ready'),
      'On <b>New</b>: Add a device → Close, and the first device connects.',
      '“Become a developer” in the sidebar adds the second account.'
    ],
    'download': ['Hover a tile to see “How to install”.', 'Hero for another OS: <a href="download.html?os=windows">Windows</a> · <a href="download.html?os=macos">macOS</a>'],
    'developer-verification': [ANY, 'Progress is saved after each step — log out and back in to see “Welcome back”.', 'Jump to: <a href="#type">type</a> · <a href="#details">details</a> · <a href="#apps">apps</a> · <a href="#agreements">agreements</a> · <a href="#kyc">identity</a>'],
    'analytics': ['Review result: <a href="analytics.html?state=review">In review</a> · <a href="analytics.html?state=approved">Approved</a> · <a href="analytics.html?state=action">Action needed</a>']
  };

  var HINTS = {
    'choose-type': ['Pick an account type to start sign-up.'],
    'signup-personal': [
      'Taken email: <b>' + u[0].email + '</b>',
      'Valid referral code: <b>JORDAN24</b>',
      'Referral link: <a href="signup.html?ref=JORDAN24">signup.html?ref=JORDAN24</a>'
    ],
    'signup-developer': ['Taken email: <b>' + u[1].email + '</b>', 'Valid referral code: <b>JORDAN24</b>'],
    'verify-email': ['Correct code: <b>' + d.emailCode + '</b>', 'Any other code shows the error state.'],
    'login': [
      'Personal + 2FA: <b>' + u[0].email + '</b> / <b>' + u[0].password + '</b>',
      'Developer, unfinished verification: <b>' + u[1].email + '</b> / <b>' + u[1].password + '</b>',
      'Wrong password ' + cfg.rules.maxLoginAttempts + ' times → locked for ' + cfg.rules.lockMinutes + ' min'
    ],
    'login-2fa': ['Authenticator code: <b>' + d.totpCode + '</b>', 'Backup code: <b>' + d.backupCode + '</b>'],
    'forgot-password': ['Use <b>' + u[0].email + '</b> to get a working reset link.'],
    'reset-password': ['Password needs 8+ characters and a number.'],
    'earn-handoff': ['<a href="earn-handoff.html?token=expired">Expired link</a>']
  };

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
      toggle.setAttribute('aria-expanded', String(!panel.hidden));
    });
    el.querySelector('[data-demo-reset]').addEventListener('click', function () {
      Cashful.store.reset();
      Cashful.ui.toast('Demo data reset');
      setTimeout(function () { location.reload(); }, 600);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
