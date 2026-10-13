/* Dev-only demo control: jumps between the states of the page it sits on (Payouts, Referrals, Settings)
   and sets the developer's KYC status (Analytics, SDK, Payouts).
   Not product UI — remove its <script> tag from the page to hide it.
   To add a page: give it a PAGES entry. `states` + `url` jump between states; `accounts` switches which
   accounts the demo login has; `kyc` adds the KYC status select (developer account only). */
(function () {
  var ui = Cashful.ui;
  var api = Cashful.api;
  var page = document.body.dataset.page;

  // Cashful.app is missing on a "no access" screen: the panel still has to be there, or a Member could not change their role back
  var user = api.currentUser();
  if (!user) return;
  var hasApp = !!Cashful.app;
  var BOTH = ['personal', 'developer'];

  // When the demo login becomes a developer it keeps a real KYC value, never "not started"
  function keptKyc() { var s = api.kyc.status(); return s === 'not_started' ? 'in_review' : s; }

  var PAGES = {
    payouts: {
      title: 'Dev only · Payouts',
      url: 'payouts.html',
      states: Cashful.payouts && Cashful.payouts.SCENARIOS,
      current: function () { return ui.params.get('state') || 'default'; },
      kyc: true
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
      current: function () { return Cashful.settings.preset(ui.params.get('state')); }
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
  var cfg = PAGES[page] || { title: 'Dev only · ' + page, kyc: true };
  var org = api.activeOrg();                       // the Developer account in use (null on Personal)
  var isDevPage = !!org;
  // The Personal presets only apply to a Personal Settings page
  if (page === 'settings' && isDevPage) { cfg = Object.assign({}, cfg, { states: null, accounts: null }); }
  var hasStates = !!cfg.states && hasApp;
  var showKyc = !!cfg.kyc && isDevPage;
  var role = org ? api.role() : null;

  function select(id, label, options, value) {
    return '<div class="cf-input"><label class="cf-input__label" for="' + id + '">' + label + '</label>' +
      '<div class="cf-field cf-field--select"><select class="cf-field__input" id="' + id + '">' +
      options.map(function (o) { return '<option value="' + o.id + '"' + (o.id === value ? ' selected' : '') + '>' + ui.esc(o.label) + '</option>'; }).join('') +
      '</select><cf-icon name="chevron-down" size="20"></cf-icon></div></div>';
  }

  // "In progress" is Not started with the onboarding begun (dev.started). The labels are the ones the product shows.
  var KYC_OPTIONS = [
    { id: 'not_started', label: 'Not started' }, { id: 'in_progress', label: 'In progress' }, { id: 'in_review', label: 'Pending' },
    { id: 'changes_requested', label: 'Changes requested' }, { id: 'rejected', label: 'Rejected' }, { id: 'approved', label: 'Verified' }
  ];
  function kycOptions() { return KYC_OPTIONS; }
  function kycValue() {
    var s = api.kyc.status(), u = api.currentUser();
    return s === 'not_started' && u && u.dev && u.dev.started ? 'in_progress' : s;
  }
  function setKyc(value) {
    var started = value === 'in_progress';
    api.updateDev({ started: started });
    api.kyc.set(started ? 'not_started' : value);
  }

  // Developer Settings: whether the Developer Agreement is signed
  var showExtras = !!cfg.extras && isDevPage && hasApp;
  var AGREEMENT_OPTIONS = [{ id: 'unsigned', label: 'Unsigned' }, { id: 'signed', label: 'Signed' }];

  /* The account in use: the role of the signed-in person, the balance and the team, and the invitation screens */
  var ROLE_OPTIONS = [{ id: 'owner', label: 'Owner' }, { id: 'admin', label: 'Admin' }, { id: 'member', label: 'Member' }];
  var BALANCE_OPTIONS = [{ id: 'zero', label: 'Zero' }, { id: 'positive', label: 'More than zero' }];
  function balanceValue() {
    var holder = org || user;
    if (holder.demoBalance) return holder.demoBalance;
    if (Cashful.payouts) return Cashful.payouts.balanceFor(user, org ? org.id : 'personal') > 0 ? 'positive' : 'zero';
    // Pages without the payouts data: an account earns when it has an Active app, a login once a device is connected
    return (org ? api.orgHasActiveApps(org) : user.peerStage && user.peerStage !== 'new') ? 'positive' : 'zero';
  }
  function accountSection() {
    if (!org) return '<div class="demo__group"><div class="demo__subtitle">Account: Personal</div>' + select('demo-balance', 'Balance', BALANCE_OPTIONS, balanceValue()) + '</div>';
    var inactive = !!org.ownerInactive;
    return '<div class="demo__group"><div class="demo__subtitle">Account: ' + ui.esc(org.name) + '</div>' +
      select('demo-role', 'Your role here', ROLE_OPTIONS, role) +
      select('demo-balance', 'Balance', BALANCE_OPTIONS, balanceValue()) +
      '<label class="demo__check"><input type="checkbox" id="demo-owner-inactive"' + (inactive ? ' checked' : '') + '> Owner is inactive</label></div>';
  }
  function inviteLinks() {
    return '<div class="demo__group"><div class="demo__subtitle">Invitation screens</div>' +
      '<a class="demo__link" href="invite.html?token=demo-new">New to Cashful (sign up)</a>' +
      '<a class="demo__link" href="invite.html?token=demo-existing">Has an account (sign in)</a>' +
      '<a class="demo__link" href="invite.html?token=demo-expired">Expired invitation</a></div>';
  }

  var el = document.createElement('div');
  el.className = 'demo';
  el.innerHTML =
    '<button type="button" class="demo__toggle" aria-expanded="false" aria-controls="page-demo">Demo · ' + ui.esc(page) + '</button>' +
    '<div class="demo__panel" id="page-demo" hidden>' +
      '<div class="demo__title">' + ui.esc(cfg.title) + '</div>' +
      accountSection() +
      (showKyc ? select('demo-kyc', 'KYC status', kycOptions(), kycValue()) : '') +
      (showExtras ? select('demo-agreement', 'Developer Agreement', AGREEMENT_OPTIONS, api.kyc.signed('developer-agreement') ? 'signed' : 'unsigned') : '') +
      (hasStates ? select('demo-state', cfg.stateLabel || 'State', cfg.states, cfg.current()) : '') +
      inviteLinks() +
      '<div class="demo__actions">' + (showKyc && !hasStates ? '<button type="button" class="cf-btn cf-btn--ghost cf-btn--sm" id="demo-reset">Reset: KYC pending</button>' : hasStates ? '<button type="button" class="cf-btn cf-btn--ghost cf-btn--sm" id="demo-reset">Reset this state</button>' : '') + '</div>' +
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
      kycSelect.value = kycValue();
      var ag = ui.$('#demo-agreement', el);
      if (ag) ag.value = api.kyc.signed('developer-agreement') ? 'signed' : 'unsigned';
    });
  }

  el.addEventListener('change', function (e) {
    var id = e.target.id;
    // Role, balance and "owner inactive" change what the page shows: the page is drawn again
    if (id === 'demo-role') { api.demo.setRole(e.target.value); location.reload(); return; }
    if (id === 'demo-balance') { api.demo.setBalance(e.target.value); location.reload(); return; }
    if (id === 'demo-owner-inactive') { api.demo.setOwnerInactive(e.target.checked); location.reload(); return; }
    if (id === 'demo-kyc') { setKyc(e.target.value); if (!hasApp) location.reload(); return; }
    if (id === 'demo-agreement') {
      if (e.target.value === 'signed') api.kyc.sign('developer-agreement', user.name || 'Demo Developer'); else api.kyc.unsign('developer-agreement');
      return;
    }
    if (id === 'demo-state' && hasStates) location.href = cfg.url + '?' + (cfg.param || 'state') + '=' + e.target.value;
  });

  var reset = ui.$('#demo-reset', el);
  if (reset) reset.addEventListener('click', function () {
    if (hasStates) location.reload(); else setKyc('in_review');
  });
})();
