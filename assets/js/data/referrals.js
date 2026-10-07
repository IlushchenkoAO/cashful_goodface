/* Referrals — mock data, rules and the copy generated from referrals.config.js. No page rendering here.
   The chosen demo scenario is kept in the prototype store, so the Overview card, the navigation and the
   sign-up screen agree with the Referrals page. Money is in integer cents. */
(function () {
  var cfg = Cashful.referralConfig;
  var fmt = Cashful.fmt;
  var store = Cashful.store;
  var DAY = 24 * 60 * 60 * 1000;

  var CODE = 'ALEX24';
  var LINK = 'https://cashful.com/r/' + CODE;

  var STATUS_TONE = { 'Signed up': 'neutral', 'Connected': 'brand', 'Qualified': 'success', 'Reward ended': 'neutral', 'Not counted': 'warning' };
  var REASONS = {
    'same-ip': { label: 'Same IP address', text: 'This friend signed up from the same IP address as you.' },
    'same-payout': { label: 'Same payout method', text: 'This friend uses the same payout method as you.' },
    'same-account': { label: 'Same account', text: 'This sign-up is linked to your own account.' }
  };

  var SCENARIOS = [
    { id: 'default', label: 'Default (all statuses)' },
    { id: 'empty', label: 'No referrals yet' },
    { id: 'early', label: 'Only Signed up and Connected' },
    { id: 'qualified', label: 'Qualified, earning' },
    { id: 'reward-ended', label: 'Reward ended' },
    { id: 'not-counted', label: 'Not counted (every reason)' },
    { id: 'milestones-off', label: 'Milestones off' },
    { id: 'disabled', label: 'Referrals off' }
  ];

  /* ---------- Scenario and effective settings ---------- */

  function scenario() {
    var d = store.get().demo;
    var id = d && d.referralState;
    return SCENARIOS.some(function (s) { return s.id === id; }) ? id : 'default';
  }

  function setScenario(id) {
    store.update(function (db) { db.demo = db.demo || {}; db.demo.referralState = id; });
  }

  /** The config as the UI should see it: the demo states "Referrals off" and "Milestones off" overlay it. */
  function settings() {
    var s = scenario();
    return Object.assign({}, cfg, {
      enabled: cfg.enabled && s !== 'disabled',
      milestonesEnabled: cfg.milestonesEnabled && s !== 'milestones-off'
    });
  }

  // The Referrals page decides the scenario from ?state=, before the sidebar reads the settings
  if (document.body && document.body.dataset.page === 'referrals') {
    var fromUrl = new URLSearchParams(location.search).get('state');
    if (fromUrl && SCENARIOS.some(function (s) { return s.id === fromUrl; })) setScenario(fromUrl);
  }

  /* ---------- Money and text helpers ---------- */

  function dollars(x) { return fmt.money(fmt.toCents(x)); }
  function months(n) { return n + (n === 1 ? ' month' : ' months'); }
  function days(n) { return n + (n === 1 ? ' day' : ' days'); }
  function percent(c) { return c.rewardPercent + '%'; }
  function maskEmail(email) {
    var at = email.indexOf('@');
    return email.charAt(0) + '***' + email.slice(at);
  }

  /* ---------- Copy generated from the config ---------- */

  var TRUST = 'Referral rewards are paid by Cashful. They never reduce your friend’s earnings.';

  function bonusSentence(c) {
    return c.oneTimeBonus > 0 ? ' You also get a one-time ' + dollars(c.oneTimeBonus) + ' bonus when they qualify.' : '';
  }

  function summaryLine(c) {
    c = c || settings();
    return 'You earn ' + percent(c) + ' of what your friend earns for ' + months(c.rewardDurationMonths) +
      ', once they’ve earned ' + dollars(c.qualificationEarnings) + '.' + bonusSentence(c);
  }

  function steps(c) {
    c = c || settings();
    return [
      { icon: 'external-link', title: '1. Share your link', text: 'Send your link or code to friends. It stays linked to you for ' + days(c.attributionWindowDays) + ' after a click.' },
      { icon: 'smartphone', title: '2. Your friend joins and connects a device', text: 'They sign up and install Cashful on a phone, computer or router.' },
      { icon: 'banknote', title: '3. You earn the reward', text: 'After they earn ' + dollars(c.qualificationEarnings) + ', you get ' + percent(c) + ' of their earnings for ' + months(c.rewardDurationMonths) + '.' + bonusSentence(c) }
    ];
  }

  function milestoneList(c) {
    return c.milestones.map(function (m) { return dollars(m.bonus) + ' at ' + m.qualified; }).join(', ');
  }

  function rules(c) {
    c = c || settings();
    var list = [
      { title: 'How rewards are calculated', text: 'You earn ' + percent(c) + ' of what each qualified friend earns from sharing bandwidth. Cashful pays it, so it never reduces your friend’s earnings.' },
      { title: 'Qualification', text: 'A friend qualifies after earning ' + dollars(c.qualificationEarnings) + '. Until then they show as Signed up or Connected, and you don’t earn yet.' },
      { title: 'Duration', text: 'You earn for ' + months(c.rewardDurationMonths) + ' after a friend qualifies. After that the status changes to Reward ended.' },
      { title: 'Attribution', text: 'Your link counts for ' + days(c.attributionWindowDays) + ' after someone clicks it. If they sign up in that time, they’re linked to you.' },
      { title: 'What isn’t counted', text: 'Sign-ups from your own account, from the same IP address as you, or with the same payout method as you aren’t counted. They show as Not counted, with the reason.' }
    ];
    if (c.oneTimeBonus > 0) list.push({ title: 'Qualification bonus', text: 'You get a one-time ' + dollars(c.oneTimeBonus) + ' bonus each time a friend qualifies.' });
    if (c.milestonesEnabled) list.push({ title: 'Milestone bonuses', text: 'One-time bonuses for reaching a number of qualified friends: ' + milestoneList(c) + '. They’re added to what you’ve earned.' });
    list.push({ title: 'Payment', text: 'Rewards go into your Available balance, the same one you withdraw from on the Payouts page.' });
    return list;
  }

  /** Hover text for a status badge. */
  function statusHint(r, c) {
    c = c || settings();
    if (r.status === 'Signed up') return 'Signed up, but hasn’t connected a device yet.';
    if (r.status === 'Connected') return 'Connected a device. Qualifies after earning ' + dollars(c.qualificationEarnings) + '.';
    if (r.status === 'Qualified') return 'Earned ' + dollars(c.qualificationEarnings) + '. You earn ' + percent(c) + ' of their earnings until ' + fmt.date(r.rewardEndsAt) + '.';
    if (r.status === 'Reward ended') return 'The reward period (' + months(c.rewardDurationMonths) + ') ended on ' + fmt.date(r.rewardEndsAt) + '.';
    return REASONS[r.reason].text;
  }

  function shareMessage(c) {
    c = c || settings();
    return c.shareMessage.replace('{link}', LINK);
  }

  /* ---------- Seed data ---------- */

  // fe / fm: what the friend earned in total / this month (cents). The reward is a percent of it.
  var BASE = [
    { id: 'r1',  email: 'ivan.k@gmail.com',          joined: 2,   status: 'Signed up' },
    { id: 'r2',  email: 'nina@hey.com',              joined: 4,   status: 'Signed up' },
    { id: 'r3',  email: 'paul.d@gmail.com',          joined: 6,   status: 'Connected', progress: 210 },
    { id: 'r4',  email: 'kate.b@yahoo.com',          joined: 9,   status: 'Connected', progress: 455 },
    { id: 'r5',  email: 'omar.s@proton.me',          joined: 13,  status: 'Connected', progress: 80 },
    { id: 'r6',  email: 'tom.hill@icloud.com',       joined: 17,  status: 'Not counted', reason: 'same-ip' },
    { id: 'r7',  email: 'alexa.r@gmail.com',         joined: 24,  status: 'Qualified', qualifiedAgo: 20, fe: 18200, fm: 4100 },
    { id: 'r8',  email: 'mike.t@outlook.com',        joined: 39,  status: 'Qualified', qualifiedAgo: 33, fe: 14750, fm: 3350 },
    { id: 'r9',  email: 'sara_k@yahoo.com',          joined: 52,  status: 'Not counted', reason: 'same-payout' },
    { id: 'r10', email: 'lena.m@gmail.com',          joined: 71,  status: 'Qualified', qualifiedAgo: 64, fe: 12300, fm: 2800 },
    { id: 'r11', email: 'jo.wu@gmail.com',           joined: 96,  status: 'Qualified', qualifiedAgo: 90, fe: 9850,  fm: 1900 },
    { id: 'r12', email: 'ben@fastmail.com',          joined: 120, status: 'Qualified', qualifiedAgo: 110, fe: 6100, fm: 900 },
    { id: 'r13', email: 'alex.morgan.alt@gmail.com', joined: 150, status: 'Not counted', reason: 'same-account' },
    { id: 'r14', email: 'mark.s@outlook.com',        joined: 430, status: 'Reward ended', qualifiedAgo: 420, fe: 15200, fm: 0 }
  ];

  var PICK = {
    'default': null,
    'milestones-off': null,
    'disabled': null,
    'empty': [],
    'early': ['r1', 'r2', 'r3', 'r4', 'r5'],
    'qualified': ['r7', 'r8', 'r10', 'r11', 'r12'],
    'reward-ended': ['r7', 'r8', 'r14'],
    'not-counted': ['r1', 'r6', 'r9', 'r13']
  };
  var VISITS = { 'default': 120, 'milestones-off': 120, 'disabled': 120, 'empty': 18, 'early': 40, 'qualified': 85, 'reward-ended': 70, 'not-counted': 30 };

  function isQualified(r) { return r.status === 'Qualified' || r.status === 'Reward ended'; }

  function createState(name) {
    var c = settings();
    var ids = PICK[name];
    var rows = BASE.filter(function (b) { return !ids || ids.indexOf(b.id) > -1; }).map(function (b) {
      var r = { id: b.id, email: b.email, joined: Date.now() - b.joined * DAY, status: b.status, reason: b.reason || null, progress: b.progress || 0, earnings: 0, month: 0 };
      if (isQualified(b)) {
        var q = new Date(Date.now() - b.qualifiedAgo * DAY);
        r.qualifiedAt = q.getTime();
        q.setMonth(q.getMonth() + c.rewardDurationMonths);
        r.rewardEndsAt = q.getTime();
        r.earnings = Math.round(b.fe * c.rewardPercent / 100) + fmt.toCents(c.oneTimeBonus);
        r.month = Math.round(b.fm * c.rewardPercent / 100);
      }
      return r;
    });
    return { rows: rows, visits: VISITS[name] };
  }

  /* ---------- Numbers shown on the page ---------- */

  function stats(state) {
    var c = settings();
    var rows = state.rows;
    var qualified = rows.filter(isQualified).length;
    var connected = rows.filter(function (r) { return r.status === 'Connected' || isQualified(r); }).length;

    var achieved = c.milestonesEnabled ? c.milestones.filter(function (m) { return qualified >= m.qualified; }) : [];
    var next = c.milestonesEnabled ? c.milestones.filter(function (m) { return qualified < m.qualified; })[0] || null : null;
    var bonus = achieved.reduce(function (sum, m) { return sum + fmt.toCents(m.bonus); }, 0);
    var fromRows = rows.reduce(function (sum, r) { return sum + r.earnings; }, 0);

    return {
      total: fromRows + bonus,
      bonus: bonus,
      month: rows.reduce(function (sum, r) { return sum + r.month; }, 0),
      funnel: { visits: state.visits, signups: rows.length, connected: connected, qualified: qualified },
      qualified: qualified,
      achieved: achieved,
      next: next
    };
  }

  /** Numbers for the current scenario — used by the Overview card. */
  function summary() { return stats(createState(scenario())); }

  /* ---------- Attribution (sign-up screen) ---------- */

  var attribution = {
    save: function (code) {
      store.update(function (db) { db.refAttribution = { code: String(code).toUpperCase(), at: Date.now() }; });
    },
    /** The saved code while it is inside the attribution window. */
    get: function () {
      var a = store.get().refAttribution;
      return a && Date.now() - a.at < settings().attributionWindowDays * DAY ? a : null;
    }
  };

  Cashful.referral = {
    CODE: CODE, LINK: LINK, SCENARIOS: SCENARIOS, STATUS_TONE: STATUS_TONE, REASONS: REASONS,
    scenario: scenario, setScenario: setScenario, settings: settings,
    dollars: dollars, months: months, days: days, percent: percent, maskEmail: maskEmail,
    TRUST: TRUST, summaryLine: summaryLine, steps: steps, rules: rules, statusHint: statusHint, shareMessage: shareMessage,
    createState: createState, stats: stats, summary: summary, isQualified: isQualified,
    attribution: attribution
  };
})();
