/* Dev-only demo control: jumps between the states of the page it sits on (Payouts, Referrals, Settings).
   Not product UI — remove its <script> tag from the page to hide it.
   To add a page: give it a PAGES entry with its states and `url`. A page that depends on the login
   (accounts, KYC) also gets an `accounts` list: each option says which accounts the demo login has. */
(function () {
  if (!Cashful.app) return;
  var ui = Cashful.ui;
  var api = Cashful.api;
  var page = document.body.dataset.page;

  var user = Cashful.app.user;
  var devStatus = (user.dev && user.dev.status) || 'approved';
  var BOTH = ['personal', 'developer'];

  var PAGES = {
    payouts: {
      title: 'Dev only · Payouts states',
      url: 'payouts.html',
      states: Cashful.payouts && Cashful.payouts.SCENARIOS,
      current: function () { return ui.params.get('state') || 'default'; },
      // Developer payouts depend on KYC, so the account is part of the demo
      accounts: [
        { id: 'personal', label: 'Personal', accounts: BOTH, active: 'personal' },
        { id: 'dev-kyc', label: 'Developer · KYC required', accounts: BOTH, active: 'developer', devStatus: 'in_review' },
        { id: 'dev-ok', label: 'Developer · KYC approved', accounts: BOTH, active: 'developer', devStatus: 'approved' }
      ],
      currentAccount: function () { return Cashful.app.account === 'personal' ? 'personal' : (devStatus === 'approved' ? 'dev-ok' : 'dev-kyc'); }
    },
    referrals: {
      title: 'Dev only · Referrals states',
      url: 'referrals.html',
      states: Cashful.referral && Cashful.referral.SCENARIOS,
      current: function () { return Cashful.referral.scenario(); }
    },
    settings: {
      title: 'Dev only · Settings states',
      url: 'settings.html',
      states: Cashful.settings && Cashful.settings.PRESETS,
      current: function () { return Cashful.settings.preset(ui.params.get('state')); },
      // "Account type" shows a different button depending on whether a developer account exists
      accounts: [
        { id: 'personal-only', label: 'Personal only (no developer account)', accounts: ['personal'], active: 'personal' },
        { id: 'both', label: 'Personal + Developer account', accounts: BOTH, active: 'personal', devStatus: 'approved' }
      ],
      currentAccount: function () { return user.accounts.indexOf('developer') > -1 ? 'both' : 'personal-only'; }
    }
  };
  var cfg = PAGES[page];
  if (!cfg || !cfg.states) return;

  function select(id, label, options, value) {
    return '<div class="cf-input"><label class="cf-input__label" for="' + id + '">' + label + '</label>' +
      '<div class="cf-field cf-field--select"><select class="cf-field__input" id="' + id + '">' +
      options.map(function (o) { return '<option value="' + o.id + '"' + (o.id === value ? ' selected' : '') + '>' + ui.esc(o.label) + '</option>'; }).join('') +
      '</select><cf-icon name="chevron-down" size="20"></cf-icon></div></div>';
  }

  var currentAccount = cfg.accounts ? cfg.currentAccount() : null;

  var el = document.createElement('div');
  el.className = 'demo';
  el.innerHTML =
    '<button type="button" class="demo__toggle" aria-expanded="false" aria-controls="page-demo">Demo · ' + ui.esc(page) + '</button>' +
    '<div class="demo__panel" id="page-demo" hidden>' +
      '<div class="demo__title">' + ui.esc(cfg.title) + '</div>' +
      (cfg.accounts ? select('demo-account', 'Account', cfg.accounts, currentAccount) : '') +
      select('demo-state', 'State', cfg.states, cfg.current()) +
      '<div class="demo__actions"><button type="button" class="cf-btn cf-btn--ghost cf-btn--sm" id="demo-reset">Reset this state</button></div>' +
    '</div>';
  document.body.appendChild(el);

  var toggle = ui.$('.demo__toggle', el);
  var panel = ui.$('.demo__panel', el);
  toggle.addEventListener('click', function () {
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
  });

  function apply() {
    var accountSelect = ui.$('#demo-account', el);
    var state = ui.$('#demo-state', el).value;
    if (accountSelect && accountSelect.value !== currentAccount) {
      var o = cfg.accounts.filter(function (a) { return a.id === accountSelect.value; })[0];
      api.demo.signInWith(o.accounts, { account: o.active, dev: { status: o.devStatus || devStatus } });
    }
    location.href = cfg.url + '?state=' + state;
  }
  el.addEventListener('change', apply);
  ui.$('#demo-reset', el).addEventListener('click', function () { location.reload(); });
})();
