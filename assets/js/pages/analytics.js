/* Developer Analytics — read-only. Filters (App, Period) and the view (metric, group by, split) live in the URL,
   so a reload and Back / Forward restore the exact view. Nothing here depends on KYC.
   Business values and texts come from data/analytics.config.js; the mock data is in data/analytics.js.
   ?data=<scenario> switches the demo data (see the demo control). The old ?state=review|approved|action
   links still set the KYC status for the alert at the top. */
(function () {
  if (!Cashful.app) return;
  var ui = Cashful.ui;
  var api = Cashful.api;
  var A = Cashful.analytics;
  var C = Cashful.controls;
  var fmt = Cashful.fmt;
  var cfg = A.config;
  var T = cfg.texts;
  var esc = ui.esc;

  // Analytics belongs to Developer accounts; a Personal account goes to its Overview
  if (Cashful.app.account !== 'developer') { location.replace(api.homeFor(Cashful.app.user, 'personal')); return; }

  var LEGACY_KYC = { review: 'in_review', approved: 'approved', action: 'changes_requested' };
  var legacy = LEGACY_KYC[ui.params.get('state')];
  if (legacy) api.kyc.set(legacy);

  function icon(name, size) { return '<cf-icon name="' + name + '" size="' + (size || 20) + '"></cf-icon>'; }
  var badge = Cashful.apps.badge;

  /* ---------- Page frame ---------- */

  var host = ui.$('#analytics');
  host.innerHTML = '<div data-kyc-alert></div><div class="u-contents" id="an-root"></div>';
  Cashful.kyc.mountAlert(ui.$('[data-kyc-alert]', host));
  var root = ui.$('#an-root', host);
  root.innerHTML =
    '<header class="cf-pagehead"><div class="cf-pagehead__row"><div class="cf-pagehead__titles">' +
      '<h1 class="cf-pagehead__title">Analytics</h1><p class="cf-pagehead__desc">Nodes, connected IPs and earnings across your apps.</p></div></div></header>' +
    '<div class="an-filters" id="an-filters">' +
      '<div id="an-app"></div>' +
      '<div class="an-period" id="an-period-wrap"><span class="cf-input__label" id="an-period-label">Period</span><div id="an-period"></div></div>' +
      '<div class="an-custom" id="an-custom" hidden></div>' +
    '</div>' +
    '<div class="u-contents" id="an-body" aria-live="polite"></div>';
  var body = ui.$('#an-body', root);

  /* ---------- State ---------- */

  function scenarioFromUrl() {
    var d = new URLSearchParams(location.search).get('data');
    return A.SCENARIOS.some(function (s) { return s.id === d; }) ? d : 'data';
  }
  var apps = A.appsFor(scenarioFromUrl());
  var st = A.parseUrl(location.search, apps);
  var model = null;          // last loaded data
  var token = 0;             // ignores answers of a load that was replaced
  var view = { sort: null, page: 1 };

  function writeUrl(replace) {
    var url = A.buildUrl(st);
    if (url !== location.pathname + location.search) history[replace ? 'replaceState' : 'pushState'](null, '', url);
  }

  /** Applies a change to the state. `quick` changes (metric, group, split) only re-draw the loaded data. */
  function go(partial, quick) {
    st = Object.assign({}, st, partial);
    st = A.parseUrl(A.buildUrl(st).split('?')[1], apps);   // normalise combinations like "group by App" for one app
    writeUrl(false);
    if (quick && model) { view.page = 1; model = A.compute(st, apps); renderData(); return; }
    render();
  }

  window.addEventListener('popstate', function () {
    apps = A.appsFor(scenarioFromUrl());
    st = A.parseUrl(location.search, apps);
    render();
  });

  /* ---------- Filters ---------- */

  var appDd = null, periodSeg = null;

  function appOptions() {
    return [{ value: 'all', label: 'All apps' }].concat(apps.map(function (a) {
      var active = Cashful.apps.isActive(a);
      return { value: a.id, label: a.name, html: '<span>' + esc(a.name) + '</span>' + badge(a), disabled: !active, tooltip: active ? '' : cfg.statusHints.notActive };
    }));
  }

  function mountFilters() {
    appDd = C.dropdown(ui.$('#an-app', root), {
      label: 'App', options: appOptions(), value: st.app,
      onChange: function (v) { go({ app: v }); }
    });
    periodSeg = C.segmented(ui.$('#an-period', root), {
      label: 'Period', options: A.PERIODS.map(function (p) { return { value: p.value, label: p.label }; }), value: st.period,
      onChange: function (v) {
        if (v === 'custom') {
          var today = A.todayDay();
          go({ period: 'custom', from: A.iso(today - 29), to: A.iso(today) });
        } else go({ period: v, from: null, to: null });
      }
    });
    ui.$('#an-period-wrap', root).setAttribute('role', 'group');
    ui.$('#an-period-wrap', root).setAttribute('aria-labelledby', 'an-period-label');
  }

  function renderCustom() {
    var el = ui.$('#an-custom', root);
    if (st.period !== 'custom') { el.hidden = true; el.innerHTML = ''; return; }
    var max = A.iso(A.todayDay());
    if (!ui.$('#an-from', el)) {
      el.hidden = false;
      el.innerHTML =
        '<div class="cf-input"><label class="cf-input__label" for="an-from">From</label><div class="cf-field"><input class="cf-field__input" type="date" id="an-from" max="' + max + '"></div></div>' +
        '<div class="cf-input"><label class="cf-input__label" for="an-to">To</label><div class="cf-field"><input class="cf-field__input" type="date" id="an-to" max="' + max + '"></div></div>' +
        '<p class="an-custom__error" id="an-custom-error" role="alert"></p>';
      el.addEventListener('change', onCustomChange);
    }
    el.hidden = false;
    ui.$('#an-from', el).value = st.from;
    ui.$('#an-to', el).value = st.to;
    ui.$('#an-custom-error', el).textContent = '';
  }

  function onCustomChange() {
    var from = A.parseIso(ui.$('#an-from', root).value), to = A.parseIso(ui.$('#an-to', root).value);
    var error = '';
    if (from === null || to === null) error = 'Choose both dates.';
    else if (to > A.todayDay()) error = 'Dates can’t be in the future.';
    else if (from > to) error = 'The start date must be before the end date.';
    else if (to - from + 1 > cfg.maxCustomRangeDays) error = 'Choose a range of up to ' + cfg.maxCustomRangeDays + ' days.';
    ui.$('#an-custom-error', root).textContent = error;
    if (!error) go({ period: 'custom', from: A.iso(from), to: A.iso(to) });
  }

  function syncFilters(kind) {
    var filters = ui.$('#an-filters', root);
    // No apps, or none Active: no filter makes sense. A not-Active app from the URL keeps only the App select.
    filters.hidden = kind === 'no-apps' || kind === 'none-active' || kind === 'unverified';
    ui.$('#an-period-wrap', root).hidden = kind === 'app-not-active';
    appDd.setOptions(appOptions(), st.app);
    periodSeg.setValue(st.period);
    if (kind === 'app-not-active') ui.$('#an-custom', root).hidden = true; else renderCustom();
  }

  /* ---------- Empty states ---------- */

  /** What to do next for an app that isn't Active: a link to that app's page. */
  function appAction(a) {
    var label = cfg.statusActions[a.status];
    if (!label) return '';
    var href = 'app.html?id=' + encodeURIComponent(a.id) + (a.status === 'changes_requested' ? '#feedback' : '');
    return a.status === 'in_review'
      ? '<a class="an-apps__wait" href="' + href + '">' + esc(label) + '</a>'
      : '<a class="cf-btn cf-btn--secondary cf-btn--sm" href="' + href + '">' + esc(label) + '</a>';
  }

  function emptyCard(chip, title, text, extra) {
    return '<section class="cf-card" aria-live="polite"><div class="cf-empty">' +
      '<span class="cf-tile__chip">' + icon(chip, 24) + '</span>' +
      '<h2 class="cf-empty__title">' + esc(title) + '</h2>' + (text ? '<p class="cf-empty__desc">' + esc(text) + '</p>' : '') + (extra || '') +
    '</div></section>';
  }

  /** Before the account is approved there is nothing to show: say why, and what to do (or that we are looking at it). */
  function stateUnverified() {
    var status = api.kyc.status();
    var dsc = Cashful.developerSettingsConfig;
    var begun = !!(api.currentUser().dev && api.currentUser().dev.started);
    var copy = {
      not_started: ['Analytics will appear after verification', 'Complete verification to unlock your account. Once you are approved and an app is Active, nodes, connected IPs and earnings show up here.', begun ? 'Continue verification' : 'Start verification'],
      in_review: ['Your account is in review', 'We are checking your details, usually within ' + dsc.kyc.reviewTime + '. Analytics unlocks as soon as you are approved. We will email you.', 'See the status'],
      changes_requested: ['Your verification needs one more thing', 'Update your information so we can finish the review. Analytics stays empty until you are approved.', 'Update information'],
      rejected: ['Your verification wasn’t approved', 'Analytics stays empty for now. See why and what you can do next.', 'See details']
    }[status];
    return emptyCard(status === 'in_review' ? 'clock' : 'lock', copy[0], copy[1], '<a href="settings.html#verification" class="cf-btn cf-btn--primary">' + esc(copy[2]) + '</a>' + (status === 'in_review' ? Cashful.kyc.approveButton() : ''));
  }

  function stateNoApps() {
    return emptyCard('chart', T.noAppsTitle, T.noAppsText,'<a href="apps.html?create=1" class="cf-btn cf-btn--primary">' + esc(T.noAppsAction) + '</a>');
  }
  function stateNoneActive() {
    return emptyCard('chart', T.noneActiveTitle, T.noneActiveText,
      '<ul class="an-apps">' + apps.map(function (a) { return '<li><span class="an-apps__name">' + esc(a.name) + '</span>' + badge(a) + appAction(a) + '</li>'; }).join('') + '</ul>');
  }
  function stateAppNotActive(app) {
    return emptyCard('chart', app.name + ' is ' + Cashful.apps.label(app) + '.', T.appNotActiveText,
      '<div class="an-empty-actions">' + badge(app) + appAction(app) + '</div>');
  }
  function stateNoNodes() {
    return emptyCard('globe', T.noNodesTitle, T.noNodesText, '<a href="sdk.html" class="cf-btn cf-btn--secondary">' + esc(T.noNodesAction) + icon('arrow-right') + '</a>');
  }
  function stateNoPeriod() {
    return emptyCard('calendar', T.noPeriodTitle, T.noPeriodText, '<button type="button" class="cf-btn cf-btn--secondary" data-act="reset-period">' + esc(T.noPeriodAction) + '</button>');
  }
  function stateError() {
    return emptyCard('alert', T.errorTitle, T.errorText, '<button type="button" class="cf-btn cf-btn--primary" data-act="retry">' + esc(T.errorAction) + '</button>');
  }
  function stateLoading() {
    return '<div class="an-skel-cards" role="status" aria-label="Loading analytics">' +
        '<span class="cf-skel"></span><span class="cf-skel"></span><span class="cf-skel"></span><span class="cf-skel"></span></div>' +
      '<span class="cf-skel an-skel-chart"></span><span class="cf-skel an-skel-table"></span>';
  }

  /* ---------- Data blocks ---------- */

  function changeProps(c, days) {
    if (c === null) return { delta: 'New', trend: 'flat', caption: 'No earlier period to compare' };
    var pct = Math.round(c * 100);
    var sign = pct > 0 ? '+' : pct < 0 ? '−' : '';
    return { delta: sign + Math.abs(pct) + '%', trend: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat', caption: 'vs previous ' + days + ' days' };
  }

  function cardsHtml() {
    var c = model.cards, days = model.range.days, d = cfg.metricDefinitions;
    var live = cfg.liveLabelEnabled ? '<span class="cf-live"><span class="cf-live__dot"></span>Live</span>' : '';
    return '<div class="cf-grid cf-grid--4">' +
      ui.statCard({ label: 'Online now', value: A.fmtInt(c.online), icon: 'wifi', info: d.nodesOnline, badgeHtml: live,
        footHtml: '<span class="cf-stat__caption">Updated ' + c.updatedMinutesAgo + ' min ago</span>' }) +
      ui.statCard(Object.assign({ label: 'Avg nodes online / day', value: A.fmtInt(c.avgNodes.value), icon: 'globe', info: d.nodesOnline }, changeProps(c.avgNodes.change, days))) +
      ui.statCard(Object.assign({ label: 'Connected IPs', value: A.fmtInt(c.ips.value), icon: 'monitor', info: d.connectedIps }, changeProps(c.ips.change, days))) +
      ui.statCard(Object.assign({ label: 'Earnings', value: fmt.money(c.earnings.value), icon: 'banknote', info: d.earnings,
        footHtml: '<a href="payouts.html">Go to Payouts</a>' }, changeProps(c.earnings.change, days))) +
    '</div>';
  }

  function metricInfo() { return A.METRICS.filter(function (m) { return m.value === st.metric; })[0]; }

  function chartHtml() {
    var m = metricInfo();
    var split = st.app === 'all'
      ? '<label class="cf-check"><input class="cf-check__input" type="checkbox" role="switch" id="an-split"' + (st.split ? ' checked' : '') + '>' +
        '<span class="cf-toggle__box"><span class="cf-toggle__knob"></span></span><span class="cf-check__label">Split by app</span></label>'
      : '';
    return '<section class="cf-card an-chart" aria-labelledby="an-chart-title">' +
      '<div class="an-card-head"><h2 class="cf-card__title" id="an-chart-title">' + esc(m.label) + ' per day</h2>' +
        '<div class="an-tools"><div id="an-metric"></div>' + split + '</div></div>' +
      '<div id="an-chart"></div>' +
    '</section>';
  }

  var chart = null;
  function drawChart() {
    var m = metricInfo();
    var money = st.metric === 'earnings';
    var last = model.series[0].points[model.series[0].points.length - 1];
    var scope = st.app === 'all' ? 'all apps' : model.series[0].label;
    var opts = {
      series: model.series,
      metricLabel: m.series,
      yFormat: function (v) { return money ? '$' + new Intl.NumberFormat('en-US').format(v / 100) : A.fmtInt(v); },
      valueFormat: function (v) { return money ? fmt.money(v) : A.fmtInt(v); },
      partialLabel: 'Today (partial)',
      ariaLabel: m.label + ' per day for ' + scope + ' from ' + model.range.from + ' to ' + model.range.to +
        (last && last.value != null ? '. Latest value ' + (money ? fmt.money(last.value) : A.fmtInt(last.value)) : '') + '. The breakdown table below lists every value'
    };
    var el = ui.$('#an-chart', body);
    if (chart) chart.destroy();
    chart = Cashful.charts.timeSeries(el, opts);
  }

  /* ---- Table ---- */

  function defaultSort() { return st.groupBy === 'day' ? { key: 'date', dir: 'desc' } : { key: 'cents', dir: 'desc' }; }

  function sortedRows() {
    var s = view.sort || defaultSort();
    var dir = s.dir === 'asc' ? 1 : -1;
    return model.rows.slice().sort(function (a, b) {
      var x = a[s.key], y = b[s.key];
      var r = typeof x === 'number' ? x - y : String(x).localeCompare(String(y));
      if (r === 0 && s.key === 'date') r = String(a.app).localeCompare(String(b.app));
      return r * dir;
    });
  }

  function cellHtml(col, row) {
    if (col.kind === 'money') return fmt.money(row.cents);
    if (col.kind === 'int') return A.fmtInt(row[col.key]);
    if (col.key === 'date') return esc(fmt.date(new Date(row.date + 'T12:00:00').getTime())) + (row.partial ? '<span class="cf-badge cf-badge--neutral an-partial">Today (partial)</span>' : '');
    if (col.key === 'app' && st.groupBy === 'app') return '<button type="button" class="an-rowlink" data-app="' + row.appId + '" aria-label="Show only ' + esc(row.app) + '">' + esc(row.app) + '</button>';
    return esc(row[col.key]);
  }

  function renderTable() {
    var s = view.sort || defaultSort();
    var cols = model.columns;
    var rows = sortedRows();
    var size = cfg.tablePageSize;
    var pages = Math.max(1, Math.ceil(rows.length / size));
    view.page = Math.min(view.page, pages);
    var slice = rows.slice((view.page - 1) * size, view.page * size);

    var head = cols.map(function (c) {
      var on = s.key === c.key;
      return '<th scope="col"' + (c.num ? ' class="is-right"' : '') + (on ? ' aria-sort="' + (s.dir === 'asc' ? 'ascending' : 'descending') + '"' : '') + '>' +
        '<button type="button" class="an-sort" data-sort="' + c.key + '">' + esc(c.label) + icon(on && s.dir === 'asc' ? 'chevron-up' : 'chevron-down', 16) + '</button></th>';
    }).join('');

    var bodyRows = slice.map(function (r) {
      return '<tr' + (st.groupBy === 'app' ? ' class="is-clickable" data-app="' + r.appId + '"' : '') + '>' +
        cols.map(function (c) { return '<td' + (c.num ? ' class="is-right"' : '') + '>' + cellHtml(c, r) + '</td>'; }).join('') + '</tr>';
    }).join('');

    var label = cols.filter(function (c) { return !c.num; }).length;   // columns that hold text: the total label spans them
    var tot = '<tr><td colspan="' + label + '">Period total</td>' + cols.filter(function (c) { return c.num; }).map(function (c) {
      if (c.key === 'cents') return '<td class="is-right">' + fmt.money(model.totals.cents) + '</td>';
      var avg = c.key === 'nodes';
      return '<td class="is-right">' + A.fmtInt(model.totals[c.key]) + (avg ? '<div class="cf-table__sub">avg per day</div>' : '') + '</td>';
    }).join('') + '</tr>';

    var from = (view.page - 1) * size + 1, to = Math.min(rows.length, view.page * size);
    var pager = rows.length > size
      ? '<nav class="cf-pagination an-pagination" aria-label="Table pages"><span class="cf-pagination__info" role="status">Showing ' + from + '–' + to + ' of ' + rows.length + '</span>' +
        '<div class="cf-pagination__pages"><button type="button" class="cf-btn cf-btn--secondary cf-btn--sm" data-pager="prev"' + (view.page === 1 ? ' disabled' : '') + '>' + icon('chevron-left', 16) + '<span>Previous</span></button>' +
        '<span class="t-caption">Page ' + view.page + ' of ' + pages + '</span>' +
        '<button type="button" class="cf-btn cf-btn--secondary cf-btn--sm" data-pager="next"' + (view.page === pages ? ' disabled' : '') + '><span>Next</span>' + icon('chevron-right', 16) + '</button></div></nav>'
      : '';

    var groupLabel = A.GROUPS.filter(function (g) { return g.value === st.groupBy; })[0].label.toLowerCase();
    ui.$('#an-table', body).innerHTML =
      '<div class="cf-table-wrap"><table class="cf-table"><caption class="sr-only">Breakdown by ' + groupLabel + ': ' + rows.length + ' rows, sorted by ' +
        esc(cols.filter(function (c) { return c.key === s.key; })[0].label) + ' ' + (s.dir === 'asc' ? 'ascending' : 'descending') + '. It lists the values shown in the chart.</caption>' +
        '<thead><tr>' + head + '</tr></thead><tbody>' + bodyRows + '</tbody><tfoot>' + tot + '</tfoot></table></div>' + pager;
  }

  function tableHtml() {
    return '<section class="cf-card cf-card--flush an-table" aria-labelledby="an-table-title">' +
      '<div class="cf-card__head"><h2 class="cf-card__title" id="an-table-title">Breakdown</h2>' +
        '<div class="an-tools"><div id="an-group"></div>' +
        (cfg.exportCsvEnabled ? '<button type="button" class="cf-btn cf-btn--secondary cf-btn--sm" data-act="export">' + icon('download', 16) + '<span>Export CSV</span></button>' : '') + '</div></div>' +
      '<div id="an-table"></div></section>';
  }

  function exportCsv() {
    var csv = A.toCsv(model.columns, sortedRows());
    var appName = st.app === 'all' ? 'all' : A.slug(model.series[0].label);
    var name = 'analytics-' + appName + '-' + model.range.from + '_' + model.range.to + '.csv';
    ui.downloadFile(name, csv, 'text/csv;charset=utf-8');
    ui.toast('CSV exported: ' + name);
  }

  function renderData() {
    body.setAttribute('aria-busy', 'false');
    body.innerHTML = cardsHtml() + chartHtml() + tableHtml();
    C.segmented(ui.$('#an-metric', body), {
      label: 'Metric', options: A.METRICS.map(function (m) { return { value: m.value, label: m.label }; }), value: st.metric,
      onChange: function (v) { go({ metric: v }, true); }
    });
    var groups = A.GROUPS.filter(function (g) { return !(g.value === 'app' && st.app !== 'all'); });
    C.segmented(ui.$('#an-group', body), {
      label: 'Group by', options: groups.map(function (g) { return { value: g.value, label: g.label }; }), value: st.groupBy,
      onChange: function (v) { view.sort = null; go({ groupBy: v }, true); }
    });
    var split = ui.$('#an-split', body);
    if (split) split.addEventListener('change', function () { go({ split: split.checked }, true); });
    drawChart();
    renderTable();
  }

  /* ---------- Rendering by state ---------- */

  function render() {
    token++;
    view = { sort: null, page: 1 };
    var active = apps.filter(Cashful.apps.isActive);
    var selected = apps.filter(function (a) { return a.id === st.app; })[0];

    var kind = !api.kyc.approved() ? 'unverified' : !apps.length ? 'no-apps' : !active.length ? 'none-active' : (selected && !Cashful.apps.isActive(selected)) ? 'app-not-active' : 'data';
    syncFilters(kind);
    model = null;
    if (chart) { chart.destroy(); chart = null; }

    if (kind === 'unverified') { body.innerHTML = stateUnverified(); return; }
    if (kind === 'no-apps') { body.innerHTML = stateNoApps(); return; }
    if (kind === 'none-active') { body.innerHTML = stateNoneActive(); return; }
    if (kind === 'app-not-active') { body.innerHTML = stateAppNotActive(selected); return; }

    var sel = st.app === 'all' ? active : active.filter(function (a) { return a.id === st.app; });
    if (sel.every(function (a) { return a.noData; })) { body.innerHTML = stateNoNodes(); return; }

    body.setAttribute('aria-busy', 'true');
    body.innerHTML = stateLoading();
    var mine = token;
    A.load(st, apps).then(function (m) {
      if (mine !== token) return;
      model = m;
      if (!m.hasData) { body.setAttribute('aria-busy', 'false'); body.innerHTML = stateNoPeriod(); return; }
      renderData();
    }, function () {
      if (mine !== token) return;
      body.setAttribute('aria-busy', 'false');
      body.innerHTML = stateError();
    });
  }

  /* ---------- Events ---------- */

  body.addEventListener('click', function (e) {
    var act = e.target.closest('[data-act]');
    if (act) {
      if (act.dataset.act === 'retry') render();
      else if (act.dataset.act === 'reset-period') go({ period: A.defaultPeriod(), from: null, to: null });
      else if (act.dataset.act === 'export') exportCsv();
      return;
    }
    var sort = e.target.closest('[data-sort]');
    if (sort) {
      var cur = view.sort || defaultSort();
      view.sort = { key: sort.dataset.sort, dir: cur.key === sort.dataset.sort && cur.dir === 'desc' ? 'asc' : 'desc' };
      view.page = 1;
      renderTable();
      var again = ui.$('[data-sort="' + sort.dataset.sort + '"]', body);
      if (again) again.focus();
      return;
    }
    var pg = e.target.closest('[data-pager]');
    if (pg) {
      view.page += pg.dataset.pager === 'next' ? 1 : -1;
      renderTable();
      var btn = ui.$('[data-pager="' + pg.dataset.pager + '"]', body) || ui.$('[data-pager]:not([disabled])', body);
      if (btn) btn.focus();
      return;
    }
    // Group by App: a row sets the App filter to that app
    var row = e.target.closest('[data-app]');
    if (row) go({ app: row.dataset.app });
  });

  mountFilters();
  writeUrl(true);
  render();

  // Approving (or any status change) swaps the empty state for the data at once
  api.kyc.onChange(render);

  // Apps and statuses come from the shared store: a change made on the Apps pages (another tab) shows up here
  Cashful.apps.onChange(function () {
    apps = A.appsFor(scenarioFromUrl());
    st = A.parseUrl(location.search, apps);
    render();
  });
})();
