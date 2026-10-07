/* Dev-only demo control: jumps between the states of the page it sits on (Payouts, Referrals, Settings)
   and sets the developer's KYC status (Analytics, SDK, Payouts).
   Not product UI — remove its <script> tag from the page to hide it.
   To add a page: give it a PAGES entry. `states` + `url` jump between states; `accounts` switches which
   accounts the demo login has; `kyc` adds the KYC status select (developer account only). */
(function () {
  if (!Cashful.app) return;
  var ui = Cashful.ui;
  var api = Cashful.api;
  var page = document.body.dataset.page;

  var user = Cashful.app.user;
  var BOTH = ['personal', 'developer'];

  // When the demo login becomes a developer it keeps a real KYC value, never "not started"
  function keptKyc() { var s = api.kyc.status(); return s === 'not_started' ? 'in_review' : s; }

  var PAGES = {
    payouts: {
      title: 'Dev only · Payouts',
      url: 'payouts.html',
      states: Cashful.payouts && Cashful.payouts.SCENARIOS,
      current: function () { return ui.params.get('state') || 'default'; },
      kyc: true,
      accounts: [
        { id: 'personal', label: 'Personal', accounts: BOTH, active: 'personal' },
        { id: 'developer', label: 'Developer', accounts: BOTH, active: 'developer', dev: function () { return { kycStatus: keptKyc() }; } }
      ],
      currentAccount: function () { return Cashful.app.account === 'personal' ? 'personal' : 'developer'; }
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
      kyc: true,
      extras: true,
      states: Cashful.settings && Cashful.settings.PRESETS,
      current: function () { return Cashful.settings.preset(ui.params.get('state')); },
      // The "Account type" card has three states, set by the developer account of this login
      accounts: [
        { id: 'dev-none', label: 'Developer: not started', accounts: ['personal'], active: 'personal' },
        { id: 'dev-draft', label: 'Developer: setup in progress', accounts: BOTH, active: 'personal', dev: { kycStatus: 'not_started', started: true, step: 'apps' } },
        { id: 'dev-submitted', label: 'Developer: submitted', accounts: BOTH, active: 'personal', dev: { kycStatus: 'in_review', step: 'review' } }
      ],
      currentAccount: function () {
        if (user.accounts.indexOf('developer') < 0 || !user.dev) return 'dev-none';
        if (user.dev.kycStatus === 'not_started') return user.dev.started ? 'dev-draft' : 'dev-none';
        return 'dev-submitted';
      }
    },
    apps: {
      title: 'Dev only · Apps',
      url: 'apps.html',
      param: 'data',
      states: Cashful.apps && Cashful.apps.SCENARIOS,
      // The demo resets the shared apps, so the current value is read back from what the store holds
      current: function () {
        var list = Cashful.apps.all();
        if (!list.length) return 'no-apps';
        if (list.every(function (a) { return a.status === 'draft'; })) return 'only-drafts';
        if (list.every(function (a) { return a.status === 'active'; })) return 'only-active';
        return 'default';
      },
      stateLabel: 'Apps data',
      kyc: true
    },
    app: { title: 'Dev only · KYC', kyc: true },
    analytics: {
      title: 'Dev only · Analytics',
      url: 'analytics.html',
      param: 'data',
      states: Cashful.analytics && Cashful.analytics.SCENARIOS,
      current: function () {
        var d = ui.params.get('data');
        return Cashful.analytics.SCENARIOS.some(function (s) { return s.id === d; }) ? d : 'data';
      },
      stateLabel: 'Analytics data',
      kyc: true
    },
    sdk: {
      title: 'Dev only · SDK',
      url: 'sdk.html',
      param: 'data',
      states: Cashful.sdk && Cashful.sdk.SCENARIOS,
      current: function () { return Cashful.sdk.scenarioFrom(location.search); },
      stateLabel: 'SDK state',
      kyc: true
    }
  };
  var cfg = PAGES[page];
  if (!cfg) return;  var isDevPage = Cashful.app.account === 'developer';
  // The Personal presets and account switch only apply to a Personal Settings page
  if (page === 'settings' && isDevPage) { cfg = Object.assign({}, cfg, { states: null, accounts: null }); }
  var hasStates = !!cfg.states;
  var showKyc = !!cfg.kyc && isDevPage;
  if (!hasStates && !showKyc) return;

  function select(id, label, options, value) {
    return '<div class="cf-input"><label class="cf-input__label" for="' + id + '">' + label + '</label>' +
      '<div class="cf-field cf-field--select"><select class="cf-field__input" id="' + id + '">' +
      options.map(function (o) { return '<option value="' + o.id + '"' + (o.id === value ? ' selected' : '') + '>' + ui.esc(o.label) + '</option>'; }).join('') +
      '</select><cf-icon name="chevron-down" size="20"></cf-icon></div></div>';
  }

  var KYC_OPTIONS = [
    { id: 'not_started', label: 'Not started' }, { id: 'in_review', label: 'In review' },
    { id: 'changes_requested', label: 'Changes requested' }, { id: 'approved', label: 'Approved' }
  ];
  function kycOptions() { return KYC_OPTIONS; }

  // Developer Settings: the Developer Agreement and whether this login also has a Personal account
  var showExtras = !!cfg.extras && Cashful.app.account === 'developer';
  var AGREEMENT_OPTIONS = [{ id: 'unsigned', label: 'Unsigned' }, { id: 'signed', label: 'Signed' }];
  var PERSONAL_OPTIONS = [{ id: 'exists', label: 'Exists' }, { id: 'none', label: 'None' }];

  var currentAccount = cfg.accounts ? cfg.currentAccount() : null;

  var el = document.createElement('div');
  el.className = 'demo';
  el.innerHTML =
    '<button type="button" class="demo__toggle" aria-expanded="false" aria-controls="page-demo">Demo · ' + ui.esc(page) + '</button>' +
    '<div class="demo__panel" id="page-demo" hidden>' +
      '<div class="demo__title">' + ui.esc(cfg.title) + '</div>' +
      (cfg.accounts ? select('demo-account', 'Account', cfg.accounts, currentAccount) : '') +
      (showKyc ? select('demo-kyc', 'KYC status', kycOptions(), api.kyc.status()) : '') +
      (showExtras ? select('demo-agreement', 'Developer Agreement', AGREEMENT_OPTIONS, api.kyc.signed('developer-agreement') ? 'signed' : 'unsigned') +
        select('demo-personal', 'Personal account', PERSONAL_OPTIONS, user.accounts.indexOf('personal') > -1 ? 'exists' : 'none') : '') +
      (hasStates ? select('demo-state', cfg.stateLabel || 'State', cfg.states, cfg.current()) : '') +
      '<div class="demo__actions"><button type="button" class="cf-btn cf-btn--ghost cf-btn--sm" id="demo-reset">' +
        (hasStates ? 'Reset this state' : 'Reset: KYC in review') + '</button></div>' +
    '</div>';
  document.body.appendChild(el);

  var toggle = ui.$('.demo__toggle', el);
  var panel = ui.$('.demo__panel', el);
  toggle.addEventListener('click', function () {
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
  });

  /* KYC: changes apply at once, in both directions (the pages listen to api.kyc) */
  if (showKyc) {
    var kycSelect = ui.$('#demo-kyc', el);
    // The alert's X can change the status too — keep the select in step
    api.kyc.onChange(function () {
      kycSelect.value = api.kyc.status();
      var ag = ui.$('#demo-agreement', el);
      if (ag) ag.value = api.kyc.signed('developer-agreement') ? 'signed' : 'unsigned';
    });
  }

  el.addEventListener('change', function (e) {
    if (e.target.id === 'demo-kyc') { api.kyc.set(e.target.value); return; }
    if (e.target.id === 'demo-agreement') {
      if (e.target.value === 'signed') api.kyc.sign('developer-agreement', user.name || 'Demo Developer'); else api.kyc.unsign('developer-agreement');
      return;
    }
    if (e.target.id === 'demo-personal') {
      api.demo.setPersonalAccount(e.target.value === 'exists');
      location.reload();   // the sidebar's account switcher is drawn once
      return;
    }
    var accountSelect = ui.$('#demo-account', el);
    var state = hasStates ? ui.$('#demo-state', el).value : null;
    if (accountSelect && accountSelect.value !== currentAccount) {
      var o = cfg.accounts.filter(function (a) { return a.id === accountSelect.value; })[0];
      var dev = typeof o.dev === 'function' ? o.dev() : o.dev;
      api.demo.signInWith(o.accounts, { account: o.active, dev: dev || { kycStatus: keptKyc() } });
    }
    location.href = cfg.url + '?' + (cfg.param || 'state') + '=' + state;
  });

  ui.$('#demo-reset', el).addEventListener('click', function () {
    if (hasStates) location.reload(); else api.kyc.set('in_review');
  });
})();
