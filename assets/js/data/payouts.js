/* Payouts — mock data and rules. No DOM here: the page (pages/payouts.js) renders what this returns.
   Everything lives in memory; reloading the page restores the scenario from ?state=.
   Money is kept in integer cents. Business values come from payouts.config.js. */
(function () {
  var cfg = Cashful.payoutsConfig;
  var DAY = 24 * 60 * 60 * 1000;

  var fmt = Cashful.fmt;

  var TYPES = {
    ach:    { label: 'Bank account (ACH)', icon: 'banknote', blurb: 'US bank transfer' },
    wise:   { label: 'Wise',               icon: 'globe',    blurb: 'Transfer to your Wise account' },
    paypal: { label: 'PayPal',             icon: 'wallet',   blurb: 'Send to your PayPal balance' },
    crypto: { label: 'Crypto wallet',      icon: 'code',     blurb: 'Stablecoins to your own wallet' }
  };
  var TYPE_ORDER = ['ach', 'wise', 'paypal', 'crypto'];

  var STATUSES = ['Requested', 'Processing', 'Paid', 'Failed', 'Rejected'];
  var STATUS_TONE = { Requested: 'neutral', Processing: 'warning', Paid: 'success', Failed: 'error', Rejected: 'error' };
  var IN_PROGRESS = ['Requested', 'Processing'];

  var PERIODS = [
    { label: 'All time', days: 0 },
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 30 days', days: 30 },
    { label: 'Last 90 days', days: 90 }
  ];

  /* ---------- Formatting ---------- */

  var toCents = fmt.toCents;
  var money = fmt.money;
  var date = fmt.date;

  function maskEmail(email) {
    var at = email.indexOf('@');
    return email.charAt(0) + '••••' + email.slice(at);
  }
  function shortAddress(a) { return a.length > 12 ? a.slice(0, 4) + '…' + a.slice(-4) : a; }

  /** Display strings for a method (also stored on payouts, so history survives removing the method). */
  function describe(m) {
    var d = m.details;
    if (m.type === 'ach') return { title: TYPES.ach.label, detail: '•••• ' + d.last4 + ' · ' + d.accountType };
    if (m.type === 'wise') return { title: 'Wise', detail: maskEmail(d.email) };
    if (m.type === 'paypal') return { title: 'PayPal', detail: maskEmail(d.email) };
    return { title: TYPES.crypto.label, detail: d.currency + ' · ' + d.network + ' · ' + shortAddress(d.address) };
  }

  /* ---------- Fees ---------- */

  function feeFor(type, amountCents) {
    var f = cfg.methods[type].fee;
    var fee = f.type === 'percent' ? Math.round(amountCents * f.value / 100) : toCents(f.value);
    return Math.min(fee, amountCents);
  }
  /** Short description for pickers: "No fee", "$1.00", "2%". */
  function feeLabel(type) {
    var f = cfg.methods[type].fee;
    if (f.type === 'percent') return f.value + '%';
    return f.value === 0 ? 'No fee' : money(toCents(f.value));
  }
  /** Fee for a concrete amount: "$1.00" or "$1.00 (2%)". */
  function feeText(type, amountCents) {
    var f = cfg.methods[type].fee;
    var text = money(feeFor(type, amountCents));
    return f.type === 'percent' ? text + ' (' + f.value + '%)' : text;
  }

  /* ---------- Validation ---------- */

  function parseAmount(str) {
    var s = String(str || '').replace(/[$,\s]/g, '');
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    return toCents(parseFloat(s));
  }

  var ADDRESS = {
    'TRC-20': /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
    'ERC-20': /^0x[0-9a-fA-F]{40}$/,
    'Polygon': /^0x[0-9a-fA-F]{40}$/
  };
  var ADDRESS_ANY = /^[A-Za-z0-9]{26,64}$/;
  var ADDRESS_HINT = {
    'TRC-20': 'A TRC-20 address starts with T and has 34 characters.',
    'ERC-20': 'An ERC-20 address starts with 0x and has 42 characters.',
    'Polygon': 'A Polygon address starts with 0x and has 42 characters.'
  };

  function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }

  /** @returns {field: message} — empty object when valid. `v` holds trimmed strings. */
  function validateMethod(type, v) {
    var e = {};
    if (type === 'ach') {
      if (v.holder.length < 2) e.holder = 'Enter the account holder’s full name.';
      if (!/^\d{9}$/.test(v.routing)) e.routing = 'A routing number has exactly 9 digits.';
      if (!/^\d{4,17}$/.test(v.account)) e.account = 'An account number has 4 to 17 digits.';
    } else if (type === 'wise' || type === 'paypal') {
      if (!v.email) e.email = 'Enter the email of your ' + TYPES[type].label + ' account.';
      else if (!isEmail(v.email)) e.email = 'Enter a valid email address.';
    } else {
      var pattern = ADDRESS[v.network] || ADDRESS_ANY;
      if (!v.address) e.address = 'Enter your wallet address.';
      else if (!pattern.test(v.address)) e.address = ADDRESS_HINT[v.network] || 'This doesn’t look like a valid wallet address.';
    }
    return e;
  }

  /** What is stored for a method — account numbers are reduced to the last 4 digits. */
  function buildDetails(type, v) {
    if (type === 'ach') return { holder: v.holder, last4: v.account.slice(-4), accountType: v.accountType };
    if (type === 'crypto') return { currency: v.currency, network: v.network, address: v.address };
    return { email: v.email };
  }

  /* ---------- State ---------- */

  function inProgress(state) {
    return state.payouts.filter(function (p) { return IN_PROGRESS.indexOf(p.status) > -1; })[0] || null;
  }
  function isMethodBusy(state, methodId) {
    return state.payouts.some(function (p) { return p.methodId === methodId && IN_PROGRESS.indexOf(p.status) > -1; });
  }

  function nextPayoutId(state) {
    var max = state.payouts.reduce(function (m, p) { return Math.max(m, parseInt(p.id.slice(3), 10)); }, 100400);
    return 'PO-' + (max + 1);
  }

  function addMethod(state, type, details) {
    var m = { id: 'm' + Date.now(), type: type, status: 'Active', isDefault: state.methods.length === 0, details: details };
    state.methods.push(m);
    return m;
  }

  function setDefault(state, id) {
    state.methods.forEach(function (m) { m.isDefault = m.id === id; });
  }

  /** The next method becomes the default when the default one is removed. */
  function removeMethod(state, id) {
    var wasDefault = state.methods.some(function (m) { return m.id === id && m.isDefault; });
    state.methods = state.methods.filter(function (m) { return m.id !== id; });
    if (wasDefault && state.methods.length) state.methods[0].isDefault = true;
  }

  function requestPayout(state, amountCents, methodId) {
    var m = state.methods.filter(function (x) { return x.id === methodId; })[0];
    var fee = feeFor(m.type, amountCents);
    var info = describe(m);
    var payout = {
      id: nextPayoutId(state), date: Date.now(), amount: amountCents, fee: fee, receive: amountCents - fee,
      methodId: m.id, method: info, status: 'Requested', reason: null
    };
    var first = state.payouts.length === 0;
    state.payouts.unshift(payout);
    state.balance.available -= amountCents;
    state.balance.pending += amountCents;
    // Prototype: the first withdrawal also fills the history with one payout in every other state
    // (Processing, Paid, Failed, Rejected), so the whole table can be shown.
    if (first) {
      state.payouts = state.payouts.concat(demoHistory());
      state.balance.paid = totalPaid(state.payouts);
    }
    return payout;
  }

  /* ---------- Seeds ---------- */

  function seedMethods() {
    return [
      { id: 'm1', type: 'ach', status: 'Active', isDefault: true, details: { holder: 'Alex Morgan', last4: '1234', accountType: 'Checking' } },
      { id: 'm2', type: 'wise', status: 'Active', isDefault: false, details: { email: 'alex.morgan@gmail.com' } },
      { id: 'm3', type: 'crypto', status: 'Active', isDefault: false, details: { currency: 'USDC', network: 'Polygon', address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F' } }
    ];
  }

  // A PayPal method that was removed later: the history keeps its label
  var REMOVED_PAYPAL = { type: 'paypal', details: { email: 'jordan.m@outlook.com' } };

  function seedPayouts(methods) {
    function by(id) { return methods.filter(function (m) { return m.id === id; })[0]; }
    // [days ago, amount in dollars, method, status, reason]
    var rows = [
      [12, 60.00, by('m1'), 'Paid'],
      [26, 35.50, by('m2'), 'Paid'],
      [41, 20.00, by('m3'), 'Failed', 'The network rejected the transfer to this wallet. The funds were returned to your balance.'],
      [55, 75.25, by('m1'), 'Paid'],
      [70, 22.00, REMOVED_PAYPAL, 'Rejected', 'We couldn’t verify that this PayPal account belongs to you. Contact support to review the payout.'],
      [84, 48.00, by('m2'), 'Paid'],
      [99, 30.00, by('m1'), 'Paid'],
      [118, 25.00, by('m3'), 'Paid'],
      [137, 20.00, by('m1'), 'Failed', 'Your bank returned the transfer: the account number didn’t match the account holder. The funds were returned to your balance.']
    ];
    return rows.map(function (r, i) {
      var amount = toCents(r[1]);
      var fee = feeFor(r[2].type, amount);
      return {
        id: 'PO-' + (100480 - i * 17),
        date: Date.now() - r[0] * DAY - (i % 3) * 3600 * 1000,
        amount: amount, fee: fee, receive: amount - fee,
        methodId: r[2].id || null, method: describe(r[2]), status: r[3], reason: r[4] || null
      };
    });
  }

  /** One payout in every state a payout can be in: Processing, Paid, Failed and Rejected. */
  function demoHistory() {
    var methods = seedMethods();
    var rows = seedPayouts(methods);
    var processing = { id: 'PO-100471', date: Date.now() - 2 * DAY, amount: toCents(40), fee: feeFor('wise', toCents(40)), receive: toCents(40) - feeFor('wise', toCents(40)),
      methodId: null, method: describe(methods[1]), status: 'Processing', reason: null };
    return [processing].concat(rows);
  }

  function totalPaid(payouts) {
    return payouts.filter(function (p) { return p.status === 'Paid'; })
      .reduce(function (sum, p) { return sum + p.amount; }, 0);
  }

  var SCENARIOS = [
    { id: 'default', label: 'Default (nothing yet: no methods, no history)' },
    { id: 'full', label: 'Full (three methods, every payout state)' },
    { id: 'no-methods', label: 'No payout methods' },
    { id: 'below-minimum', label: 'Balance below the minimum' },
    { id: 'in-progress', label: 'Payout in progress' },
    { id: 'empty-history', label: 'Empty history' },
    { id: 'no-earnings', label: 'No earnings yet (zero balance)' }
  ];

  /**
   * The balance follows what was earned: a Personal account has money once a device is connected, a Developer once an
   * app is Active. `earned` is { available, pending, key } in cents (see earnedFor); nothing earned is zero.
   * The default state has no payout methods and an empty history: the person adds a method, and the first withdrawal
   * fills the history. The other scenarios start from a full set of methods and payouts.
   */
  function createState(name, earned) {
    var e = earned || { available: 0, pending: 0, key: 'none' };
    var methods = seedMethods();
    var payouts = seedPayouts(methods);
    if (!name || name === 'default') {
      return { balance: { available: e.available, pending: e.pending, paid: 0 }, methods: [], payouts: [], earnedKey: e.key, _virtual: true };
    }
    var state = { balance: { available: toCents(128.40), pending: toCents(14.60), paid: 0 }, methods: methods, payouts: payouts };

    if (name === 'no-methods') { state.methods = []; state.payouts = []; }
    if (name === 'empty-history') state.payouts = [];
    if (name === 'no-earnings') { state.methods = []; state.payouts = []; state.balance.available = 0; state.balance.pending = 0; }
    if (name === 'below-minimum') state.balance.available = toCents(12.35);
    if (name === 'in-progress') {
      var amount = toCents(50);
      var fee = feeFor('ach', amount);
      state.payouts.unshift({
        id: 'PO-100497', date: Date.now() - 2 * DAY, amount: amount, fee: fee, receive: amount - fee,
        methodId: 'm1', method: describe(methods[0]), status: 'Processing', reason: null
      });
      state.balance.available -= amount;
      state.balance.pending += amount;
    }
    state.balance.paid = totalPaid(state.payouts);
    return state;
  }

  /** What an account has earned so far: Personal by how far the devices have come, Developer by Active apps. */
  var PEER_EARNED = { new: [0, 0], day1: [52.4, 6.15], active: [86.2, 9.4], payout: [128.4, 14.6] };
  function earnedFor(user, account) {
    var pair = [0, 0], key = 'none';
    if (user && account === 'developer') {
      var apps = Cashful.apps ? Cashful.apps.all() : [];
      if (apps.some(function (a) { return a.status === 'active'; })) { pair = [128.4, 14.6]; key = 'apps'; }
    } else if (user) {
      key = user.peerStage || 'new';
      pair = PEER_EARNED[key] || [0, 0];
    }
    return { available: toCents(pair[0]), pending: toCents(pair[1]), key: key };
  }

  /* ---------- Shared state ----------
     The Payouts state lives in the prototype store, so other pages (Settings → delete account) read the same
     balance and the same payout in progress. A page that is opened with ?state= starts that scenario afresh. */

  // Each account type has its own payouts (a Personal and a Developer account don't share a balance or methods)
  function saveState(state, account) {
    var copy = JSON.parse(JSON.stringify(state));
    delete copy._virtual;
    Cashful.store.update(function (db) { db.demo = db.demo || {}; db.demo.payoutsBy = db.demo.payoutsBy || {}; db.demo.payoutsBy[account || 'personal'] = copy; });
  }

  /** `scenarioName` (from ?state=) starts a scenario; without it the saved state continues. */
  function loadState(scenarioName, earned, account) {
    if (scenarioName && SCENARIOS.some(function (s) { return s.id === scenarioName; })) {
      var fresh = createState(scenarioName, earned);
      if (!fresh._virtual) saveState(fresh, account);
      return fresh;
    }
    var saved = Cashful.store.get().demo;
    var state = saved && saved.payoutsBy && saved.payoutsBy[account || 'personal'];
    if (!state) return createState('default', earned);
    // Nothing was withdrawn yet: the balance still follows what was earned (a device was connected since)
    if (state.earnedKey && earned && state.earnedKey !== earned.key && !state.payouts.length) {
      state.balance.available = earned.available; state.balance.pending = earned.pending; state.earnedKey = earned.key;
    }
    return state;
  }

  Cashful.payouts = {
    config: cfg,
    loadState: loadState, saveState: saveState, earnedFor: earnedFor,
    TYPES: TYPES, TYPE_ORDER: TYPE_ORDER, STATUSES: STATUSES, STATUS_TONE: STATUS_TONE, PERIODS: PERIODS, SCENARIOS: SCENARIOS,
    money: money, date: date, toCents: toCents, describe: describe,
    feeFor: feeFor, feeLabel: feeLabel, feeText: feeText,
    parseAmount: parseAmount, validateMethod: validateMethod, buildDetails: buildDetails,
    inProgress: inProgress, isMethodBusy: isMethodBusy,
    createState: createState, addMethod: addMethod, setDefault: setDefault, removeMethod: removeMethod, requestPayout: requestPayout
  };
})();
