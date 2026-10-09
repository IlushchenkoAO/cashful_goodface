/* Payouts — one page for both accounts (Personal and Developer).
   Sections: balance, payout methods, payout history. Flows (modals): request payout, add method, remove method.
   A Developer account is locked until KYC is approved. State lives in the prototype store — see data/payouts.js. */
(function () {
  if (!Cashful.app) return;
  var ui = Cashful.ui;
  var P = Cashful.payouts;
  var esc = ui.esc;
  var cfg = P.config;

  var isDeveloper = Cashful.app.account === 'developer';

  // ?state= starts a scenario; without it the saved state continues (shared with Settings).
  // Nothing saved: an empty page. The balance follows what was earned (a connected device, an Active app), there are
  // no payout methods and no history. It is only saved once the person changes something (adds a method, withdraws).
  var state = P.loadState(ui.params.get('state'), P.earnedFor(Cashful.app.user, Cashful.app.account), Cashful.app.account);
  var persist = !state._virtual;
  function touch() { persist = true; }
  function earnedNothing() { return state.balance.available + state.balance.pending === 0 && !state.payouts.length; }

  // A Developer account can't request payouts until KYC is approved. The value comes from api.kyc and is
  // re-read on every render, so approving KYC (the alert's X, the demo control) unlocks the page at once.
  var locked = false;
  function refreshLock() { locked = isDeveloper && !Cashful.api.kyc.featuresUnlocked(); }

  var filters = { status: 'All', period: 'All time' };
  var expanded = {};

  // The KYC alert has its own slot above the page, so it can animate away while the page re-renders
  var host = ui.$('#payouts');
  host.innerHTML = '<div data-kyc-alert></div><div class="u-contents" id="payouts-body"></div>';
  var root = ui.$('#payouts-body', host);
  if (isDeveloper) Cashful.kyc.mountAlert(ui.$('[data-kyc-alert]', host));

  function later(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
  function icon(name, size) { return '<cf-icon name="' + name + '" size="' + (size || 20) + '"></cf-icon>'; }
  function minCents() { return P.toCents(cfg.minPayout); }

  /** Moves focus to a heading or control after a section is re-rendered. */
  function focusOn(selector) {
    var el = ui.$(selector, root);
    if (el) el.focus();
  }

  /* ---------- Form helpers ---------- */

  var field = ui.fieldHtml;
  var selectField = ui.selectHtml;
  var selectOptions = ui.selectOptions;

  function readValues(form) {
    var v = {};
    Array.prototype.forEach.call(form.elements, function (el) { if (el.name) v[el.name] = el.value.trim(); });
    return v;
  }

  var CANCEL = '<button type="button" class="cf-btn cf-btn--secondary" data-close>Cancel</button>';

  /* ---------- Page ---------- */

  function render() {
    refreshLock();
    if (persist) P.saveState(state, Cashful.app.account);
    root.innerHTML =
      '<header class="cf-pagehead"><div class="cf-pagehead__row"><div class="cf-pagehead__titles">' +
        '<h1 class="cf-pagehead__title">Payouts</h1>' +
        '<p class="cf-pagehead__desc">Withdraw your earnings to a bank account, Wise, PayPal or a crypto wallet.</p>' +
      '</div></div></header>' +
      balanceHtml() + (locked ? lockedHtml() : methodsHtml()) + historyHtml();
    renderHistoryBody();
  }

  function balanceHtml() {
    var b = state.balance;
    var busy = P.inProgress(state);
    var below = b.available < minCents();

    var action;
    var notes = '';
    if (locked) {
      action = '';
      notes = '<span class="pay-note">' + icon('shield', 16) + (Cashful.api.kyc.lockReason() === 'agreement' ? Cashful.developerSettingsConfig.agreementLockHint : Cashful.api.kyc.lockReason() === 'rejected' ? 'Payouts are off because your verification wasn’t approved' : 'Payouts unlock after your KYC is approved') + '.</span>';
    } else {
      action = '<button type="button" class="cf-btn cf-btn--primary" data-act="request" aria-describedby="pay-notes"' + (busy || below ? ' disabled' : '') + '>' +
        icon('banknote') + '<span>Request payout</span></button>';
      if (!isDeveloper && !Cashful.api.peerKyc.approved()) {
        notes += '<a class="pay-badge" href="settings.html#verification">' + icon('shield', 16) + '<span>Identity verification is needed for your first withdrawal</span><span class="pay-badge__go">Verify</span></a>';
      }
      if (busy) notes += '<span class="pay-note">' + icon('clock', 16) + 'You have a payout in progress.</span>';
      if (below) {
        var pct = Math.max(0, Math.min(100, Math.floor(b.available / minCents() * 100)));
        notes += '<div class="pay-progress"><div class="pay-progress__label"><span>' + P.money(b.available) + ' of ' + P.money(minCents()) + '</span><span>minimum payout</span></div>' +
          '<div class="cf-progress" role="progressbar" aria-label="Progress to the minimum payout" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '">' +
          '<div class="cf-progress__bar" style="width:' + pct + '%"></div></div></div>';
      }
    }

    return '<section class="cf-card pay-balance" aria-labelledby="pay-balance-title">' +
      '<h2 class="sr-only" id="pay-balance-title">Balance</h2>' +
      '<div class="pay-fig pay-fig--lead">' +
        '<span class="pay-fig__label">Available</span>' +
        '<div class="pay-fig__row"><span class="pay-fig__value">' + P.money(b.available) + '</span>' + action + '</div>' +
        '<div class="pay-notes" id="pay-notes">' + notes + '</div>' +
      '</div>' +
      '<div class="pay-fig"><span class="pay-fig__label">Pending</span><span class="pay-fig__value pay-fig__value--sm">' + P.money(b.pending) + '</span><span class="pay-fig__hint">On hold, or in a payout in progress</span></div>' +
      '<div class="pay-fig"><span class="pay-fig__label">Total paid</span><span class="pay-fig__value pay-fig__value--sm">' + P.money(b.paid) + '</span><span class="pay-fig__hint">Since you joined</span></div>' +
    '</section>';
  }

  function lockedHtml() {
    return '<section class="cf-card" aria-labelledby="pay-locked-title"><div class="cf-empty">' +
      '<span class="cf-tile__chip">' + icon('shield', 24) + '</span>' +
      '<h2 class="cf-empty__title" id="pay-locked-title" tabindex="-1">' + (Cashful.api.kyc.lockReason() === 'agreement' ? Cashful.developerSettingsConfig.agreementLockHint + ' to request payouts' : Cashful.api.kyc.lockReason() === 'rejected' ? 'Payouts are off for now' : 'Complete KYC to request payouts') + '</h2>' +
      '<p class="cf-empty__desc">Payout methods and payout requests unlock once your developer account is approved. Your balance and history stay visible.</p>' +
      '<a href="settings.html#' + (Cashful.api.kyc.lockReason() === 'agreement' ? 'agreements' : 'verification') + '" class="cf-btn cf-btn--primary">Go to Settings</a>' +
    '</div></section>';
  }

  /* ---------- Methods ---------- */

  function methodsHtml() {
    var head = '<div class="cf-card__head"><h2 class="cf-card__title" id="pay-methods-title" tabindex="-1">Payout methods</h2>' +
      (state.methods.length ? '<button type="button" class="cf-btn cf-btn--secondary cf-btn--sm" data-act="add-method">' + icon('plus', 16) + '<span>Add method</span></button>' : '') + '</div>';
    var body;
    if (!state.methods.length) {
      body = '<div class="cf-empty"><span class="cf-tile__chip">' + icon('wallet', 24) + '</span>' +
        '<h3 class="cf-empty__title">No payout methods yet</h3>' +
        '<p class="cf-empty__desc">Add a bank account, Wise, PayPal or a crypto wallet. You need one before you can request a payout.</p>' +
        '<button type="button" class="cf-btn cf-btn--primary" data-act="add-method">' + icon('plus') + '<span>Add method</span></button></div>';
    } else {
      body = '<ul class="pay-methods">' + state.methods.map(methodRow).join('') + '</ul>';
    }
    return '<section class="cf-card cf-card--flush" aria-labelledby="pay-methods-title">' + head + body + '</section>';
  }

  function methodRow(m) {
    var info = P.describe(m);
    var name = info.title + ', ' + info.detail;
    var busy = P.isMethodBusy(state, m.id);
    return '<li class="pay-method">' +
      '<span class="pay-method__icon">' + icon(P.TYPES[m.type].icon) + '</span>' +
      '<div class="pay-method__body">' +
        '<div class="pay-method__title">' + esc(info.title) + (m.isDefault ? ' <span class="cf-badge cf-badge--brand">Default</span>' : '') + '</div>' +
        '<div class="pay-method__detail">' + esc(info.detail) + '</div>' +
      '</div>' +
      '<span class="cf-badge cf-badge--success"><span class="cf-badge__dot"></span>' + esc(m.status) + '</span>' +
      '<div class="pay-method__actions">' +
        (m.isDefault ? '' : '<button type="button" class="cf-btn cf-btn--ghost cf-btn--sm" data-act="set-default" data-id="' + m.id + '" aria-label="Set ' + esc(name) + ' as default">Set as default</button>') +
        '<span' + (busy ? ' title="You can’t remove this method while a payout to it is in progress."' : '') + '>' +
          '<button type="button" class="cf-btn cf-btn--ghost cf-btn--sm pay-danger" data-act="remove" data-id="' + m.id + '" aria-label="Remove ' + esc(name) + '"' + (busy ? ' disabled' : '') + '>Remove</button>' +
        '</span>' +
      '</div></li>';
  }

  /* ---------- History ---------- */

  function historyHtml() {
    var has = state.payouts.length > 0;
    var filtersHtml = has
      ? '<div class="pay-filters">' +
          '<div class="cf-input pay-filter"><label class="sr-only" for="f-status">Status</label><div class="cf-field cf-field--select"><select class="cf-field__input" id="f-status" data-filter="status">' +
            selectOptions([{ value: 'All', label: 'All statuses' }].concat(P.STATUSES), filters.status) + '</select>' + icon('chevron-down') + '</div></div>' +
          '<div class="cf-input pay-filter"><label class="sr-only" for="f-period">Period</label><div class="cf-field cf-field--select"><select class="cf-field__input" id="f-period" data-filter="period">' +
            selectOptions(P.PERIODS.map(function (p) { return p.label; }), filters.period) + '</select>' + icon('chevron-down') + '</div></div>' +
        '</div>'
      : '';
    return '<section class="cf-card cf-card--flush" aria-labelledby="pay-history-title">' +
      '<div class="cf-card__head"><h2 class="cf-card__title" id="pay-history-title" tabindex="-1">Payout history</h2>' + filtersHtml + '</div>' +
      '<div id="pay-history-body"></div></section>';
  }

  function filteredPayouts() {
    var days = P.PERIODS.filter(function (p) { return p.label === filters.period; })[0].days;
    var since = days ? Date.now() - days * 24 * 60 * 60 * 1000 : 0;
    return state.payouts.filter(function (p) {
      return (filters.status === 'All' || p.status === filters.status) && p.date >= since;
    });
  }

  function renderHistoryBody() {
    var el = ui.$('#pay-history-body', root);
    if (!state.payouts.length) {
      el.innerHTML = '<div class="cf-empty"><span class="cf-tile__chip">' + icon('clock', 24) + '</span>' +
        '<h3 class="cf-empty__title">No payouts yet</h3>' +
        '<p class="cf-empty__desc">' + (earnedNothing()
          ? (isDeveloper ? 'You haven’t earned anything yet. Earnings start once an app is Active and people opt in.' : 'You haven’t earned anything yet. Earnings start once a device is connected.')
          : 'Your payouts show up here after you request your first one.') + '</p>' +
        (earnedNothing() ? '<a href="' + (isDeveloper ? 'apps.html' : 'dashboard.html') + '" class="cf-btn cf-btn--secondary">' + (isDeveloper ? 'Go to Apps' : 'Go to Overview') + '</a>' : '') + '</div>';
      return;
    }
    var rows = filteredPayouts();
    if (!rows.length) {
      el.innerHTML = '<div class="cf-empty"><h3 class="cf-empty__title">No payouts match these filters</h3>' +
        '<p class="cf-empty__desc">Try another status or a longer period.</p>' +
        '<button type="button" class="cf-btn cf-btn--secondary" data-act="clear-filters">Clear filters</button></div>';
      return;
    }
    el.innerHTML = '<div class="cf-table-wrap"><table class="cf-table pay-table">' +
      '<thead><tr><th scope="col">Date</th><th scope="col" class="is-right">Amount</th><th scope="col">Method</th><th scope="col">Status</th><th scope="col">ID</th><th scope="col"><span class="sr-only">Details</span></th></tr></thead>' +
      '<tbody>' + rows.map(historyRow).join('') + '</tbody></table></div>' +
      '<div class="pay-count" role="status">Showing ' + rows.length + ' of ' + state.payouts.length + ' payouts</div>';
  }

  function historyRow(p) {
    var open = !!expanded[p.id];
    var badge = '<span class="cf-badge cf-badge--' + P.STATUS_TONE[p.status] + '"' + (p.reason ? ' title="' + esc(p.reason) + '"' : '') + '>' +
      '<span class="cf-badge__dot"></span>' + p.status + '</span>';
    var toggle = p.reason
      ? '<button type="button" class="cf-ibtn cf-ibtn--ghost cf-ibtn--sm" data-act="toggle-reason" data-id="' + p.id + '" aria-expanded="' + open + '" aria-controls="reason-' + p.id + '" aria-label="' + (open ? 'Hide' : 'Show') + ' reason for ' + p.id + '">' + icon(open ? 'chevron-up' : 'chevron-down') + '</button>'
      : '';
    return '<tr>' +
      '<td>' + P.date(p.date) + '</td>' +
      '<td class="is-right"><div class="cf-table__amount">' + P.money(p.amount) + '</div><div class="cf-table__sub">You receive ' + P.money(p.receive) + '</div></td>' +
      '<td><div class="cf-table__primary">' + esc(p.method.title) + '</div><div class="cf-table__sub">' + esc(p.method.detail) + '</div></td>' +
      '<td>' + badge + '</td>' +
      '<td class="cf-mono">' + p.id + '</td>' +
      '<td class="is-right">' + toggle + '</td></tr>' +
      (p.reason && open ? '<tr class="pay-reason" id="reason-' + p.id + '"><td colspan="6"><div class="pay-reason__box">' + icon('info') + '<span><strong>' + (p.status === 'Failed' ? 'Why it failed' : 'Why it was rejected') + '.</strong> ' + esc(p.reason) + '</span></div></td></tr>' : '');
  }

  /* ---------- Request payout ---------- */

  function openRequest() {
    if (locked) return;
    if (!state.methods.length) return openRequestEmpty();

    var def = state.methods.filter(function (m) { return m.isDefault; })[0] || state.methods[0];
    var options = state.methods.map(function (m) {
      var info = P.describe(m);
      return { value: m.id, label: info.title + ' · ' + info.detail + (m.isDefault ? ' (Default)' : '') };
    });
    var avail = state.balance.available;

    var m = ui.modal({
      title: 'Request payout',
      body:
        '<form class="pay-form" id="req-form" novalidate>' +
          '<div class="cf-input"><label class="cf-input__label" for="req-amount">Amount</label>' +
            '<div class="cf-field"><span class="cf-field__suffix" aria-hidden="true">$</span>' +
              '<input class="cf-field__input" id="req-amount" name="amount" inputmode="decimal" autocomplete="off" placeholder="0.00" data-autofocus data-no-sample>' +
              '<button type="button" class="cf-btn cf-btn--ghost cf-btn--sm" data-act="max">Max</button></div>' +
            '<div class="cf-input__helper">Minimum ' + P.money(minCents()) + ' · Available ' + P.money(avail) + '</div></div>' +
          selectField({ id: 'req-method', name: 'method', label: 'Payout method', options: options, value: def.id }) +
          '<dl class="pay-summary" id="req-summary" aria-live="polite"></dl>' +
        '</form>',
      footer: CANCEL + '<button type="submit" form="req-form" class="cf-btn cf-btn--primary" id="req-confirm">Confirm payout</button>'
    });

    var form = ui.$('#req-form', m.el);
    var amountInput = form.elements.amount;
    var methodSelect = form.elements.method;

    function currentMethod() { return state.methods.filter(function (x) { return x.id === methodSelect.value; })[0]; }

    function syncSummary() {
      var cents = P.parseAmount(amountInput.value);
      var ok = cents !== null && cents > 0;
      var type = currentMethod().type;
      var fee = ok ? P.feeFor(type, cents) : 0;
      var rows = [
        ['Amount', ok ? P.money(cents) : '—'],
        ['Fee', ok ? P.feeText(type, cents) : '—'],
        ['You receive', ok ? P.money(cents - fee) : '—', true],
        ['Arrives in', cfg.methods[type].eta]
      ];
      ui.$('#req-summary', m.el).innerHTML = rows.map(function (r) {
        return '<div class="pay-summary__row' + (r[2] ? ' is-total' : '') + '"><dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd></div>';
      }).join('');
    }
    syncSummary();

    form.addEventListener('input', syncSummary);
    form.addEventListener('change', syncSummary);
    m.el.addEventListener('click', function (e) {
      if (!e.target.closest('[data-act="max"]')) return;
      amountInput.value = (avail / 100).toFixed(2);
      ui.setError(amountInput, '');
      syncSummary();
      amountInput.focus();
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!amountInput.value.trim()) amountInput.value = (Math.min(avail, Math.max(minCents(), 5000)) / 100).toFixed(2);   // nothing is required: a sample amount
      syncSummary();
      var cents = P.parseAmount(amountInput.value);
      var error = '';
      if (!amountInput.value.trim()) error = 'Enter an amount.';
      else if (cents === null || cents <= 0) error = 'Enter a valid amount, like 25.00.';
      else if (cents < minCents()) error = 'The minimum payout is ' + P.money(minCents()) + '.';
      else if (cents > avail) error = 'You only have ' + P.money(avail) + ' available.';
      ui.setError(amountInput, error);
      if (error) { amountInput.focus(); return; }

      var btn = ui.$('#req-confirm', m.el);
      ui.withLoading(btn, function () { return later(500); }).then(function () {
        var payout = P.requestPayout(state, cents, methodSelect.value);
        touch();
        m.close();
        render();
        ui.toast('Payout of ' + P.money(payout.amount) + ' requested');
        focusOn('#pay-history-title');
      });
    });
  }

  function openRequestEmpty() {
    var m = ui.modal({
      title: 'Request payout',
      body: '<div class="cf-empty pay-modal-empty"><span class="cf-tile__chip">' + icon('wallet', 24) + '</span>' +
        '<h3 class="cf-empty__title">Add a payout method first</h3>' +
        '<p class="cf-empty__desc">Tell us where to send your money. It takes a minute, and then you can request your payout.</p></div>',
      footer: CANCEL + '<button type="button" class="cf-btn cf-btn--primary" data-act="add-first">Add method</button>'
    });
    m.el.addEventListener('click', function (e) {
      if (!e.target.closest('[data-act="add-first"]')) return;
      m.close();
      openAddMethod({ thenRequest: true });
    });
  }

  /* ---------- Add method ---------- */

  function typeBody() {
    return '<p class="cf-modal__desc">Choose how you want to get paid.</p><div class="pay-types">' +
      P.TYPE_ORDER.map(function (t) {
        var cm = cfg.methods[t];
        return '<button type="button" class="cf-choice pay-type" data-type="' + t + '">' +
          '<span class="cf-choice__icon">' + icon(P.TYPES[t].icon, 24) + '</span>' +
          '<span class="cf-choice__body"><span class="cf-choice__title">' + esc(P.TYPES[t].label) + '</span>' +
          '<span class="cf-choice__text">' + esc(P.TYPES[t].blurb) + '</span>' +
          '<span class="cf-choice__text">Fee: ' + esc(P.feeLabel(t)) + ' · Arrives in ' + esc(cm.eta) + '</span></span>' +
          '<span class="cf-choice__chevron">' + icon('chevron-right') + '</span></button>';
      }).join('') + '</div>';
  }

  function networkOptions(currency) { return cfg.crypto[currency]; }
  // A valid address for the chosen network, so an empty field can be filled with something that passes
  function addressSample(network) { return network === 'TRC-20' ? 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf' : '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'; }

  function formBody(type, v) {
    var fields;
    if (type === 'ach') {
      fields = field({ id: 'pm-holder', name: 'holder', label: 'Account holder name', value: v.holder, placeholder: 'Full name on the account', autocomplete: 'name', autofocus: true, sample: 'Alex Morgan' }) +
        field({ id: 'pm-routing', name: 'routing', label: 'Routing number', value: v.routing, placeholder: '9 digits', inputmode: 'numeric', maxlength: 9, sample: '021000021', helper: 'The 9-digit number on your checks or in your bank app.' }) +
        field({ id: 'pm-account', name: 'account', label: 'Account number', value: v.account, placeholder: 'Account number', inputmode: 'numeric', maxlength: 17, sample: '000123456789', helper: 'We only keep the last 4 digits.' }) +
        selectField({ id: 'pm-account-type', name: 'accountType', label: 'Account type', options: ['Checking', 'Savings'], value: v.accountType });
    } else if (type === 'wise' || type === 'paypal') {
      fields = field({ id: 'pm-email', name: 'email', label: P.TYPES[type].label + ' account email', value: v.email, placeholder: 'you@example.com', autocomplete: 'email', spellcheck: false, autofocus: true, sample: 'alex.morgan@gmail.com', helper: 'The email you use to sign in to ' + P.TYPES[type].label + '.' });
    } else {
      var currency = v.currency || Object.keys(cfg.crypto)[0];
      var network = networkOptions(currency).indexOf(v.network) > -1 ? v.network : networkOptions(currency)[0];
      fields = selectField({ id: 'pm-currency', name: 'currency', label: 'Currency', options: Object.keys(cfg.crypto), value: currency }) +
        selectField({ id: 'pm-network', name: 'network', label: 'Network', options: networkOptions(currency), value: network }) +
        field({ id: 'pm-address', name: 'address', label: 'Wallet address', value: v.address, placeholder: 'Paste your wallet address', spellcheck: false, sample: addressSample(network) }) +
        ui.alertHtml({ tone: 'warning', title: 'Make sure the network matches your wallet.', text: 'Funds sent to the wrong network can’t be recovered.' });
    }
    return '<form class="pay-form" id="pm-form" novalidate>' + fields + '</form>';
  }

  function confirmBody(v) {
    var rows = [['Currency', v.currency], ['Network', v.network]];
    return '<p class="cf-modal__desc">Check the address one more time. We can’t recover funds sent to the wrong address or network.</p>' +
      '<dl class="pay-summary">' + rows.map(function (r) {
        return '<div class="pay-summary__row"><dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd></div>';
      }).join('') + '</dl>' +
      '<div class="pay-address"><span class="pay-address__label">Wallet address</span><span class="pay-address__value cf-mono" data-autofocus tabindex="-1">' + esc(v.address) + '</span></div>' +
      ui.alertHtml({ tone: 'warning', title: 'Double-check the network.', text: 'Your wallet must support ' + v.currency + ' on ' + v.network + '.' });
  }

  function openAddMethod(opts) {
    opts = opts || {};
    var draft = { type: null, values: {} };
    var m = ui.modal({ title: 'Add payout method', body: typeBody(), footer: CANCEL, width: 520 });

    function showType() { m.update({ title: 'Add payout method', body: typeBody(), footer: CANCEL }); }
    function showForm() {
      var isCrypto = draft.type === 'crypto';
      m.update({
        title: 'Add ' + P.TYPES[draft.type].label,
        body: formBody(draft.type, draft.values),
        footer: '<button type="button" class="cf-btn cf-btn--secondary" data-act="back-type">Back</button>' +
          '<button type="submit" form="pm-form" class="cf-btn cf-btn--primary">' + (isCrypto ? 'Continue' : 'Add method') + '</button>'
      });
    }
    function showConfirm() {
      m.update({
        title: 'Confirm wallet details',
        body: confirmBody(draft.values),
        footer: '<button type="button" class="cf-btn cf-btn--secondary" data-act="back-form">Back</button>' +
          '<button type="button" class="cf-btn cf-btn--primary" data-act="save">Confirm and add</button>'
      });
    }

    function save(btn) {
      ui.withLoading(btn, function () { return later(400); }).then(function () {
        var first = !state.methods.length;
        P.addMethod(state, draft.type, P.buildDetails(draft.type, draft.values));
        touch();
        m.close();
        render();
        ui.toast(first ? 'Method added and set as default' : 'Method added');
        if (opts.thenRequest) openRequest(); else focusOn('#pay-methods-title');
      });
    }

    m.el.addEventListener('click', function (e) {
      var typeBtn = e.target.closest('[data-type]');
      if (typeBtn) {
        if (draft.type !== typeBtn.dataset.type) draft.values = {};
        draft.type = typeBtn.dataset.type;
        showForm();
        return;
      }
      var act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'back-type') {
        draft.values = readValues(ui.$('#pm-form', m.el));
        showType();
      } else if (act.dataset.act === 'back-form') showForm();
      else if (act.dataset.act === 'save') save(act);
    });

    // The networks depend on the chosen currency
    m.el.addEventListener('change', function (e) {
      if (e.target.id === 'pm-currency') {
        var network = ui.$('#pm-network', m.el);
        network.innerHTML = selectOptions(networkOptions(e.target.value), null);
      }
      if (e.target.id === 'pm-currency' || e.target.id === 'pm-network') {
        var addr = ui.$('#pm-address', m.el);
        if (addr) addr.dataset.sample = addressSample(ui.$('#pm-network', m.el).value);
      }
    });

    m.el.addEventListener('submit', function (e) {
      e.preventDefault();
      var form = e.target;
      var v = readValues(form);
      var errors = P.validateMethod(draft.type, v);
      var firstBad = null;
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name) return;
        ui.setError(el, errors[el.name] || '');
        if (errors[el.name] && !firstBad) firstBad = el;
      });
      if (firstBad) { firstBad.focus(); return; }
      draft.values = v;
      if (draft.type === 'crypto') showConfirm();
      else save(ui.$('.cf-modal__foot [type="submit"]', m.el));
    });
  }

  /* ---------- Remove / default ---------- */

  function openRemove(id) {
    var method = state.methods.filter(function (x) { return x.id === id; })[0];
    if (!method || P.isMethodBusy(state, id)) return;
    var info = P.describe(method);
    var m = ui.modal({
      title: 'Remove payout method?',
      body: '<p class="cf-modal__desc"><strong>' + esc(info.title) + '</strong> · ' + esc(info.detail) + ' will be removed. Your past payouts stay in the history.' +
        (method.isDefault && state.methods.length > 1 ? ' Your next method becomes the default.' : '') + '</p>',
      footer: CANCEL + '<button type="button" class="cf-btn cf-btn--destructive" data-act="confirm-remove">Remove method</button>'
    });
    m.el.addEventListener('click', function (e) {
      if (!e.target.closest('[data-act="confirm-remove"]')) return;
      P.removeMethod(state, id);
      touch();
      m.close();
      render();
      ui.toast('Method removed');
      focusOn('#pay-methods-title');
    });
  }

  /* ---------- Verification before the first withdrawal (Personal) ----------
     Nobody is asked at sign-up. The first time a Personal account tries to withdraw, it learns that identity
     verification is needed and is sent to Settings → Verification. A Developer account is already gated by KYC. */

  function guardRequest(next) {
    if (isDeveloper || Cashful.api.peerKyc.approved()) { next(); return; }
    var m = ui.modal({
      title: 'Verify your identity to withdraw',
      width: 480,
      body: '<p class="cf-modal__desc">Before your first withdrawal we check your ID. It’s a legal requirement for paying out money, and you only do it once.</p>' +
        '<div class="feature"><span class="feature__icon">' + icon('shield') + '</span><span class="feature__text"><span class="feature__title">A partner does the check</span><span class="feature__desc">Cashful never keeps your document photos.</span></span></div>' +
        '<div class="feature"><span class="feature__icon">' + icon('clock') + '</span><span class="feature__text"><span class="feature__title">About 3 minutes</span><span class="feature__desc">You need a government ID and a camera. The result is usually instant.</span></span></div>' +
        '<p class="t-caption t-secondary">Your balance is safe and keeps growing while you wait.</p>',
      footer: CANCEL + '<a class="cf-btn cf-btn--primary" href="settings.html#verification" data-act-go>Start verification</a>'
    });
    m.el.addEventListener('click', function (e) { if (e.target.closest('[data-act-go]')) m.close(); });
  }

  /* ---------- Events ---------- */

  root.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    var act = b.dataset.act;
    if (act === 'request') guardRequest(openRequest);
    else if (act === 'add-method') openAddMethod();
    else if (act === 'remove') openRemove(b.dataset.id);
    else if (act === 'set-default') {
      P.setDefault(state, b.dataset.id);
      touch();
      render();
      ui.toast('Default method updated');
      focusOn('#pay-methods-title');
    } else if (act === 'toggle-reason') {
      expanded[b.dataset.id] = !expanded[b.dataset.id];
      renderHistoryBody();
      focusOn('[data-act="toggle-reason"][data-id="' + b.dataset.id + '"]');
    } else if (act === 'clear-filters') {
      filters = { status: 'All', period: 'All time' };
      ui.$('#f-status', root).value = 'All';
      ui.$('#f-period', root).value = 'All time';
      renderHistoryBody();
      focusOn('#f-status');
    }
  });

  root.addEventListener('change', function (e) {
    var f = e.target.closest('[data-filter]');
    if (!f) return;
    filters[f.dataset.filter] = f.value;
    renderHistoryBody();
  });

  render();
  if (isDeveloper) Cashful.api.kyc.onChange(render);
})();
