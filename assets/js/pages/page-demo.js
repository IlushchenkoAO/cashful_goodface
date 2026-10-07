/* Dev-only demo control: jumps between the states of the page it sits on (Payouts, Referrals).
   Not product UI — remove its <script> tag from the page to hide it.
   To add a page: give it a PAGES entry with its states and `url`. */
(function () {
  if (!Cashful.app) return;
  var ui = Cashful.ui;
  var api = Cashful.api;
  var page = document.body.dataset.page;

  var user = Cashful.app.user;
  var devStatus = (user.dev && user.dev.status) || 'approved';

  var PAGES = {
    payouts: {
      title: 'Dev only · Payouts states',
      url: 'payouts.html',
      states: Cashful.payouts && Cashful.payouts.SCENARIOS,
      current: function () { return ui.params.get('state') || 'default'; },
      // Developer payouts depend on KYC, so the account is part of the demo
      accounts: [
        { id: 'personal', label: 'Personal' },
        { id: 'dev-kyc', label: 'Developer · KYC required' },
        { id: 'dev-ok', label: 'Developer · KYC approved' }
      ]
    },
    referrals: {
      title: 'Dev only · Referrals states',
      url: 'referrals.html',
      states: Cashful.referral && Cashful.referral.SCENARIOS,
      current: function () { return Cashful.referral.scenario(); }
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

  var currentAccount = Cashful.app.account === 'personal' ? 'personal' : (devStatus === 'approved' ? 'dev-ok' : 'dev-kyc');

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
      var account = accountSelect.value;
      api.demo.signInWith(['personal', 'developer'], {
        account: account === 'personal' ? 'personal' : 'developer',
        dev: { status: account === 'dev-kyc' ? 'in_review' : (account === 'dev-ok' ? 'approved' : devStatus) }
      });
    }
    location.href = cfg.url + '?state=' + state;
  }
  el.addEventListener('change', apply);
  ui.$('#demo-reset', el).addEventListener('click', function () { location.reload(); });
})();
