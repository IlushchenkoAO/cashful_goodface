/* Peer Overview.
   One screen, four data stages over time:
     new    — no devices yet (DashboardPersonal)
     day1   — first devices connected (PeerDay1 / PeerConnected)
     active — two months in, period tabs and chart tooltip (PeerActive)
     payout — balance over the payout minimum (PeerPayoutReady)
   "Add device" opens the install modal; for a new account, closing it simulates the
   first device signing in a moment later (PeerConnected). */
(function () {
  if (!Cashful.app) return;
  var ui = Cashful.ui;
  var api = Cashful.api;
  var esc = ui.esc;
  var DATA = Cashful.data.peer;
  var EARNINGS = Cashful.data.earnings;
  var STATUS = Cashful.data.deviceStatus;

  var root = ui.$('#overview');
  var user = Cashful.app.user;

  var forced = ui.params.get('state');
  if (forced && DATA[forced]) api.setPeerStage(forced);
  var stage = (forced && DATA[forced]) ? forced : (user.peerStage || 'new');

  var justVerified = Cashful.store.takeFlash('justVerified');
  var personalAdded = Cashful.store.takeFlash('personalAdded');
  var period = null;      // selected period tab
  var hover = null;       // hovered chart bar

  /* ---------- Building blocks ---------- */

  var alertHtml = ui.alertHtml;
  var stat = ui.statCard;

  function header(withAction) {
    var head = '<header class="cf-pagehead"><div class="cf-pagehead__row"><div class="cf-pagehead__titles">' +
      '<h1 class="cf-pagehead__title">Overview</h1><p class="cf-pagehead__desc">Your earnings and devices at a glance.</p></div></div></header>';
    if (!withAction) return head;
    return '<div class="page-top">' + head +
      '<button type="button" class="cf-btn cf-btn--primary" data-add-device><cf-icon name="plus" size="20"></cf-icon><span>Add device</span></button></div>';
  }

  /* ---------- Stage: new ---------- */

  function emptyCard() {
    return '<section class="cf-card empty-card">' +
      '<cf-mascot character="main" size="104"></cf-mascot>' +
      '<div class="empty-card__text"><h2 class="empty-card__title">Connect your first device</h2>' +
        '<p class="empty-card__desc">Install Cashful on a phone, computer or router. It runs in the background and earns while you’re online. Only one device per IP address earns at a time.</p></div>' +
      '<div class="empty-card__actions"><button type="button" class="cf-btn cf-btn--primary" data-add-device><cf-icon name="plus" size="20"></cf-icon><span>Add a device</span></button>' +
        '<span class="t-caption t-secondary">Android, iOS, Windows, macOS, Linux, Raspberry Pi and routers</span></div>' +
    '</section>';
  }

  function renderNew() {
    var name = user.name || user.email.split('@')[0];
    root.innerHTML =
      (justVerified ? alertHtml({ tone: 'success', title: 'Your email is verified', text: 'Welcome to Cashful, ' + name + '. Add a device to start earning.' }) : '') +
      (personalAdded ? alertHtml({ tone: 'success', title: 'Personal account added', text: 'Install the Cashful app on your devices to start earning. Switch accounts any time in the sidebar.' }) : '') +
      header(false) +
      '<div class="cf-grid cf-grid--4">' +
        stat({ label: 'Balance', value: DATA.new.balance, icon: 'wallet', caption: 'Payouts from $[X]', brand: true }) +
        stat({ label: 'Earned this month', value: '$0.00', icon: 'banknote' }) +
        stat({ label: 'Devices online', value: '0', icon: 'wifi' }) +
        stat({ label: 'Traffic shared', value: '0.0 GB', icon: 'chart' }) +
      '</div>' +
      // Only the device-dependent blocks (chart, devices list) are replaced by this empty state.
      // The referral card doesn't depend on devices: it keeps its column on the right, as in the other stages.
      (referralCardOn() ? '<div class="cf-grid cf-grid--2-1">' + emptyCard() + referralCard() + '</div>' : emptyCard());
    bindReferralCard();
  }

  /* ---------- Stages with devices ---------- */

  function renderActive() {
    var d = DATA[stage];
    period = period && d.periods.indexOf(period) > -1 ? period : d.period;

    var top = '';
    if (d.payoutBanner) {
      top = '<div class="banner"><span class="banner__icon"><cf-icon name="check-circle" size="24"></cf-icon></span>' +
        '<div class="banner__text"><span class="banner__title">You can request your first payout</span>' +
        '<span class="t-muted">Your balance passed the $[X] minimum. Payouts go to ACH, Wise, PayPal or crypto.</span></div>' +
        '<a href="#" class="cf-btn cf-btn--primary" data-soon="Payouts">Request payout</a></div>';
    } else if (d.alert) {
      top = alertHtml(d.alert);
    }

    root.innerHTML = top + header(true) +
      '<div class="cf-grid cf-grid--4" id="stats"></div>' +
      (referralCardOn()
        ? '<div class="cf-grid cf-grid--2-1">' + earningsCard() + referralCard() + '</div>'
        : earningsCard()) +
      devicesTable(d);

    ui.tabs(ui.$('#periods'), d.periods, period, function (p) { period = p; hover = null; renderPeriod(); });
    renderPeriod();
    bindReferralCard();
  }

  function earningsCard() {
    return '<section class="cf-card earnings">' +
      '<div class="earnings__top"><div class="earnings__sum"><h3 class="cf-card__title">Earnings</h3>' +
        '<span class="earnings__total" id="total"></span><span class="t-muted" id="total-caption"></span></div>' +
        '<div id="periods"></div></div>' +
      '<div class="cf-chart" id="chart"></div>' +
    '</section>';
  }

  /* Referral card: code, total earned and a way into the Referrals page. Hidden when referrals are off. */
  function referralCardOn() { return !!Cashful.referral && Cashful.referral.settings().enabled; }

  function referralCard() {
    var R = Cashful.referral;
    return '<section class="cf-card" aria-labelledby="ref-card-title">' +
      '<h3 class="cf-card__title" id="ref-card-title">Invite friends</h3>' +
      '<p class="t-muted">' + esc(R.summaryLine()) + '</p>' +
      '<div class="cf-copy"><span class="cf-copy__value cf-mono">' + esc(R.CODE) + '</span>' +
        '<button type="button" class="cf-btn cf-btn--secondary cf-btn--sm" data-ref-copy><cf-icon name="copy" size="16"></cf-icon><span>Copy</span></button></div>' +
      '<div class="ref-mini-card__earned"><span class="t-muted">Earned from referrals</span><strong>' + Cashful.fmt.money(R.summary().total) + '</strong></div>' +
      '<a href="referrals.html">See your referrals</a>' +
    '</section>';
  }

  function bindReferralCard() {
    var btn = ui.$('[data-ref-copy]', root);
    if (!btn) return;
    btn.addEventListener('click', function () {
      var done = function () {
        Cashful.track('referral_code_copied', { source: 'overview' });
        ui.toast('Referral code copied');
        var label = ui.$('span', btn);
        label.textContent = 'Copied';
        setTimeout(function () { label.textContent = 'Copy'; }, 1600);
      };
      var p = navigator.clipboard && navigator.clipboard.writeText(Cashful.referral.CODE);
      if (p) p.then(done, done); else done();
    });
  }

  function renderPeriod() {
    var d = DATA[stage];
    var e = EARNINGS[stage][period];
    ui.$('#stats').innerHTML =
      stat({ label: 'Balance', value: d.balance, icon: 'wallet', caption: d.balanceCaption, brand: true }) +
      stat({ label: e.earnedLabel, value: e.earned, icon: 'banknote', delta: e.delta, trend: e.trend, caption: e.earnedCaption }) +
      stat({ label: 'Devices earning', value: d.devicesStat.value, icon: 'wifi', caption: d.devicesStat.caption }) +
      stat({ label: e.trafficLabel, value: e.traffic, icon: 'chart', delta: e.trafficDelta, trend: e.trend, caption: e.trafficCaption });
    ui.$('#total').textContent = e.total;
    ui.$('#total-caption').textContent = e.totalCaption;
    renderChart(e);
  }

  /* ---------- Chart with hover tooltip ---------- */

  function renderChart(e) {
    var chart = ui.$('#chart');
    var n = e.chartData.length;
    var max = e.chartMax || 1;
    chart.innerHTML =
      '<div class="cf-chart__y">' + e.chartTicks.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>' +
      '<div class="cf-chart__plot">' +
        '<div class="cf-chart__bars" aria-label="Earnings by ' + (period === 'Today' ? 'hour' : 'day') + '">' +
          e.chartData.map(function (v, i) {
            var h = Math.max(v / max * 100, v > 0 ? 1.5 : 0);
            return '<div class="chart-col" data-i="' + i + '"><div class="cf-chart__bar' + (i === n - 1 ? ' is-hl' : '') + '" style="height:' + h + '%"></div></div>';
          }).join('') +
          '<div class="chart-tip" hidden></div>' +
        '</div>' +
        '<div class="cf-chart__x">' + e.chartLabels.map(function (l) { return '<span>' + esc(l) + '</span>'; }).join('') + '</div>' +
      '</div>';

    var bars = ui.$('.cf-chart__bars', chart);
    var tip = ui.$('.chart-tip', chart);
    var cols = ui.$$('.chart-col', chart);

    function highlight(i) {
      cols.forEach(function (c, k) {
        c.classList.toggle('is-hover', k === i);
        c.firstChild.classList.toggle('is-hl', i === null ? k === n - 1 : k === i);
      });
      if (i === null) { tip.hidden = true; return; }
      var t = e.chartTips[i];
      var pos = (i + 0.5) / n;
      tip.hidden = false;
      tip.style.left = (pos * 100) + '%';
      tip.style.transform = 'translateX(' + (pos < 0.2 ? '0%' : pos > 0.8 ? '-100%' : '-50%') + ')';
      tip.innerHTML = '<span class="chart-tip__label">' + esc(t.label) + '</span>' +
        '<span class="chart-tip__row"><span>Earned</span><strong>' + esc(t.earned) + '</strong></span>' +
        '<span class="chart-tip__row"><span>Traffic shared</span><strong>' + esc(t.traffic) + '</strong></span>' +
        '<span class="chart-tip__row"><span>Devices earning</span><strong>' + esc(t.devices) + '</strong></span>';
    }

    bars.addEventListener('mouseover', function (ev) {
      var col = ev.target.closest('.chart-col');
      if (col) { hover = +col.dataset.i; highlight(hover); }
    });
    bars.addEventListener('mouseleave', function () { hover = null; highlight(null); });
  }

  /* ---------- Devices ---------- */

  function devicesTable(d) {
    var rows = d.devices.map(function (dv) {
      var s = STATUS[dv.status];
      return '<tr>' +
        '<td><div class="device"><span class="device__icon"><cf-icon name="' + dv.icon + '" size="20"></cf-icon></span>' +
          '<div><div class="cf-table__primary">' + esc(dv.name) + '</div><div class="cf-table__sub">' + esc(dv.os) + '</div></div></div></td>' +
        '<td><div>' + esc(dv.network) + '</div><div class="cf-table__sub cf-mono">' + esc(dv.ip) + '</div></td>' +
        '<td><div class="device-status"><span class="cf-badge cf-badge--' + s.tone + '"><span class="cf-badge__dot"></span>' + s.label + '</span>' +
          '<span class="cf-table__sub">' + esc(dv.note) + '</span></div></td>' +
        '<td class="cf-table__amount is-right">' + esc(dv.traffic) + '</td>' +
        '<td class="cf-table__amount is-right">' + esc(dv.earned) + '</td>' +
      '</tr>';
    }).join('');
    return '<section class="cf-card cf-card--flush">' +
      '<div class="cf-card__head"><h3 class="cf-card__title">Devices</h3><span class="cf-card__meta">' + esc(d.summary) + '</span></div>' +
      '<div class="cf-table-wrap"><table class="cf-table"><thead><tr>' +
        '<th>Device</th><th>Network and IP</th><th>Status</th>' +
        '<th class="is-right">Traffic ' + d.tableScope + '</th><th class="is-right">Earned ' + d.tableScope + '</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
      (d.tip ? '<div class="table-tip">' + esc(d.tip) + '</div>' : '') +
    '</section>';
  }

  /* ---------- Add device ---------- */

  root.addEventListener('click', function (e) {
    if (!e.target.closest('[data-add-device]')) return;
    var wasNew = stage === 'new';
    Cashful.install.openAddDevice(function () {
      if (!wasNew) return;
      // The prototype pretends the person installed the app and signed in on their phone
      api.waitForFirstDevice().then(function (dev) {
        stage = 'day1';
        justVerified = personalAdded = false;
        render();
        ui.notice({ title: dev.device + ' is connected', text: dev.network + ' · It starts earning right away.' });
      });
    });
  });

  function render() {
    if (stage === 'new') renderNew();
    else renderActive();
  }

  render();
  if (ui.params.get('modal') === 'add-device') ui.$('[data-add-device]').click();
})();
