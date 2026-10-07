/* Developer Analytics — mock dataset, aggregation, URL state and CSV. No rendering here.
   The dataset is deterministic: every value is a function of the app, the platform and the calendar day,
   so a reload never changes a number. History is 120+ days; DeskSync became Active 21 days ago.
   Today's point is partial (fixed factors), and the UI marks it. */
(function () {
  var cfg = Cashful.analyticsConfig;
  var fmt = Cashful.fmt;
  var DAY = 24 * 60 * 60 * 1000;

  var SCENARIOS = [
    { id: 'data', label: 'Data' },
    { id: 'no-apps', label: 'No apps' },
    { id: 'none-active', label: 'Apps but none Active' },
    { id: 'no-data', label: 'Active app, no data yet' },
    { id: 'empty-period', label: 'Empty period' },
    { id: 'loading', label: 'Loading' },
    { id: 'error', label: 'Error' }
  ];
  var METRICS = [
    { value: 'nodes', label: 'Nodes online', def: 'nodesOnline', series: 'Nodes online' },
    { value: 'ips', label: 'Connected IPs', def: 'connectedIps', series: 'Connected IPs' },
    { value: 'earnings', label: 'Earnings', def: 'earnings', series: 'Earnings' }
  ];
  var GROUPS = [{ value: 'day', label: 'Day' }, { value: 'app', label: 'App' }, { value: 'platform', label: 'Platform' }];
  var PERIODS = [
    { value: '7d', label: '7 days', days: 7 },
    { value: '30d', label: '30 days', days: 30 },
    { value: '90d', label: '90 days', days: 90 },
    { value: 'custom', label: 'Custom' }
  ];

  /* ---------- Days ---------- */

  function todayDay() {
    var d = new Date();
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
  }
  function iso(day) { return new Date(day * DAY).toISOString().slice(0, 10); }
  function parseIso(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return null;
    var t = Date.parse(s + 'T00:00:00Z');
    if (isNaN(t)) return null;
    var day = Math.floor(t / DAY);
    return iso(day) === s ? day : null;   // rejects 2026-02-31
  }

  /* ---------- Mock traffic ---------- */

  function hash(a, b, c) {
    var h = Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  var PLATFORM_ID = { Android: 1, iOS: 2, Windows: 3, macOS: 4 };
  var RATE = { Android: 2.1, iOS: 3.4, Windows: 4.5, macOS: 5.0 };   // cents per node per day
  var PARTIAL = { nodes: 0.62, cents: 0.45 };                          // today is incomplete

  var memo = {};
  function cell(app, platform, day) {
    var key = app.id + platform + day;
    if (memo[key]) return memo[key];
    var idx = parseInt(app.id.slice(-2), 10);
    var age = day - (todayDay() - app.activeDaysAgo);
    var out = { nodes: 0, ips: 0, cents: 0 };
    if (age >= 0 && !app.noData) {
      var share = app.split ? app.split[platform] : 1;
      var weekday = new Date(day * DAY).getUTCDay();
      var weekend = weekday === 0 || weekday === 6;
      var growth = 1 + Math.min(age, 365) / 365 * 0.35;
      var ramp = Math.min(1, (age + 1) / 14);
      var season = 1 + 0.05 * Math.sin(day / 9 + idx);
      var noise = 0.94 + 0.12 * hash(idx, PLATFORM_ID[platform], day);
      var nodes = Math.round(app.base * share * growth * ramp * season * (weekend ? 1 + app.weekend : 1) * noise);
      var ips = Math.min(nodes, Math.round(nodes * (0.9 + 0.08 * hash(idx + 7, PLATFORM_ID[platform], day))));
      var cents = Math.round(nodes * RATE[platform]);
      if (day === todayDay()) { nodes = Math.round(nodes * PARTIAL.nodes); ips = Math.round(ips * PARTIAL.nodes); cents = Math.round(cents * PARTIAL.cents); }
      out = { nodes: nodes, ips: ips, cents: cents };
    }
    memo[key] = out;
    return out;
  }

  function isLive(app, day) { return !app.noData && day >= todayDay() - app.activeDaysAgo; }

  /** One app on one day, platforms summed. */
  function appDay(app, day) {
    var r = { nodes: 0, ips: 0, cents: 0, active: isLive(app, day) };
    if (!r.active) return r;
    app.platforms.forEach(function (p) { var c = cell(app, p, day); r.nodes += c.nodes; r.ips += c.ips; r.cents += c.cents; });
    return r;
  }

  /** Daily totals for a set of apps over [from, to] (day numbers). */
  function perDay(apps, from, to) {
    var out = [];
    for (var d = from; d <= to; d++) {
      var t = { day: d, date: iso(d), nodes: 0, ips: 0, cents: 0, active: false, partial: d === todayDay() };
      apps.forEach(function (a) {
        var r = appDay(a, d);
        if (r.active) { t.active = true; t.nodes += r.nodes; t.ips += r.ips; t.cents += r.cents; }
      });
      out.push(t);
    }
    return out;
  }

  /** Unique IPs over several days is more than one day's count but less than the sum (IPs come back). */
  function uniqueIps(avgDaily, days) {
    return Math.round(avgDaily * (1 + 0.9 * (1 - Math.exp(-days / 25))));
  }

  function summarize(days) {
    var live = days.filter(function (d) { return d.active; });
    var n = live.length;
    var sum = function (k) { return live.reduce(function (s, d) { return s + d[k]; }, 0); };
    var avgNodes = n ? Math.round(sum('nodes') / n) : 0;
    var avgIps = n ? sum('ips') / n : 0;
    return { days: n, avgNodes: avgNodes, ips: n ? uniqueIps(avgIps, n) : 0, cents: sum('cents'), hasData: n > 0 && (sum('nodes') > 0 || sum('cents') > 0) };
  }

  /* ---------- Scenarios ---------- */

  function appsFor(scenario) {
    var all = Cashful.apps.all();
    // An app approved after the seed has no traffic profile: Active, but no data yet (nothing is made up for it)
    all.forEach(function (a) { if (!a.base) a.noData = true; });
    if (scenario === 'no-apps') return [];
    if (scenario === 'none-active') return all.filter(function (a) { return !Cashful.apps.isActive(a); });
    if (scenario === 'no-data') return all.map(function (a) { if (Cashful.apps.isActive(a)) a.noData = true; return a; });
    return all;
  }

  /* ---------- URL state ---------- */

  function rangeOf(state) {
    var to = todayDay();
    if (state.period === 'custom') return { from: parseIso(state.from), to: parseIso(state.to) };
    var days = PERIODS.filter(function (p) { return p.value === state.period; })[0].days;
    return { from: to - days + 1, to: to };
  }

  function defaultPeriod() {
    return ['7d', '30d', '90d'].indexOf(cfg.defaultPeriod) > -1 ? cfg.defaultPeriod : '30d';
  }

  /** Reads the URL into a valid state. Unknown or invalid params fall back to defaults, never to an error. */
  function parseUrl(search, apps) {
    var p = new URLSearchParams(search);
    var st = { app: 'all', period: defaultPeriod(), from: null, to: null, metric: 'nodes', groupBy: 'day', split: false, data: 'data' };

    var data = p.get('data');
    if (SCENARIOS.some(function (s) { return s.id === data; })) st.data = data;

    var appId = p.get('app');
    if (appId && appId !== 'all' && apps.some(function (a) { return a.id === appId; })) st.app = appId;

    var period = p.get('period');
    if (PERIODS.some(function (x) { return x.value === period; })) st.period = period;

    if (st.period === 'custom') {
      var from = parseIso(p.get('from')), to = parseIso(p.get('to'));
      var ok = from !== null && to !== null && from <= to && to <= todayDay() && (to - from + 1) <= cfg.maxCustomRangeDays;
      if (ok) { st.from = iso(from); st.to = iso(to); } else st.period = defaultPeriod();
    }
    // "Empty period" demo: opens on dates before any app existed, unless a period was asked for
    if (st.data === 'empty-period' && !p.has('period')) {
      st.period = 'custom'; st.from = iso(todayDay() - 364); st.to = iso(todayDay() - 335);
    }

    var metric = p.get('metric');
    if (METRICS.some(function (m) { return m.value === metric; })) st.metric = metric;
    var group = p.get('groupBy');
    if (GROUPS.some(function (g) { return g.value === group; })) st.groupBy = group;
    if (st.app !== 'all' && st.groupBy === 'app') st.groupBy = 'day';   // that grouping is hidden for one app
    st.split = st.app === 'all' && (p.get('split') === '1' || p.get('split') === 'true');
    return st;
  }

  function buildUrl(st) {
    var p = new URLSearchParams();
    if (st.app !== 'all') p.set('app', st.app);
    p.set('period', st.period);
    if (st.period === 'custom') { p.set('from', st.from); p.set('to', st.to); }
    if (st.metric !== 'nodes') p.set('metric', st.metric);
    if (st.groupBy !== 'day') p.set('groupBy', st.groupBy);
    if (st.split) p.set('split', '1');
    if (st.data !== 'data') p.set('data', st.data);
    return location.pathname + '?' + p.toString();
  }

  /* ---------- The model the page renders ---------- */

  function change(cur, prev) { return prev > 0 ? (cur - prev) / prev : null; }

  function columns(group, allMode) {
    if (group === 'app') return [
      { key: 'app', label: 'App' }, { key: 'platform', label: 'Platform' },
      { key: 'nodes', label: 'Avg nodes online', num: true, kind: 'int' }, { key: 'ips', label: 'Connected IPs', num: true, kind: 'int' },
      { key: 'cents', label: 'Earnings', num: true, kind: 'money' }];
    if (group === 'platform') return [
      { key: 'platform', label: 'Platform' },
      { key: 'nodes', label: 'Avg nodes online', num: true, kind: 'int' }, { key: 'ips', label: 'Connected IPs', num: true, kind: 'int' },
      { key: 'cents', label: 'Earnings', num: true, kind: 'money' }];
    return [{ key: 'date', label: 'Date' }].concat(allMode ? [{ key: 'app', label: 'App' }] : []).concat([
      { key: 'nodes', label: 'Nodes online', num: true, kind: 'int' }, { key: 'ips', label: 'Connected IPs', num: true, kind: 'int' },
      { key: 'cents', label: 'Earnings', num: true, kind: 'money' }]);
  }

  function tableRows(state, sel, range) {
    var allMode = state.app === 'all';
    var rows = [];
    if (state.groupBy === 'day') {
      for (var d = range.to; d >= range.from; d--) {
        sel.forEach(function (a) {
          var r = appDay(a, d);
          if (r.active) rows.push({ date: iso(d), app: a.name, appId: a.id, nodes: r.nodes, ips: r.ips, cents: r.cents, partial: d === todayDay() });
        });
      }
      return rows;
    }
    if (state.groupBy === 'app') {
      sel.forEach(function (a) {
        var s = summarize(perDay([a], range.from, range.to));
        if (s.hasData) rows.push({ app: a.name, appId: a.id, platform: a.platforms.join(', '), nodes: s.avgNodes, ips: s.ips, cents: s.cents });
      });
      return rows;
    }
    // Platform: add the apps up per platform and per calendar day, then summarise each platform
    var byPlatform = {};
    sel.forEach(function (a) {
      a.platforms.forEach(function (pf) {
        var b = byPlatform[pf] = byPlatform[pf] || {};
        for (var d = range.from; d <= range.to; d++) {
          if (!isLive(a, d)) continue;
          var c = cell(a, pf, d);
          b[d] = b[d] || { active: true, nodes: 0, ips: 0, cents: 0 };
          b[d].nodes += c.nodes; b[d].ips += c.ips; b[d].cents += c.cents;
        }
      });
    });
    Object.keys(byPlatform).forEach(function (pf) {
      var s = summarize(Object.keys(byPlatform[pf]).map(function (d) { return byPlatform[pf][d]; }));
      if (s.hasData) rows.push({ platform: pf, nodes: s.avgNodes, ips: s.ips, cents: s.cents });
    });
    return rows;
  }

  /** Everything the page needs for a filter state. */
  function compute(state, apps) {
    var active = apps.filter(Cashful.apps.isActive);
    var sel = state.app === 'all' ? active : active.filter(function (a) { return a.id === state.app; });
    var range = rangeOf(state);
    var len = range.to - range.from + 1;

    var curDays = perDay(sel, range.from, range.to);
    var prevDays = perDay(sel, range.from - len, range.from - 1);
    var cur = summarize(curDays), prev = summarize(prevDays);

    var today = todayDay();
    var todayNodes = sel.reduce(function (s, a) { var r = appDay(a, today); return s + (r.active ? r.nodes : 0); }, 0);
    var online = Math.round(todayNodes / PARTIAL.nodes * 0.6);   // "now" is a steady share of a full day

    var cards = {
      online: online,
      updatedMinutesAgo: 3,
      avgNodes: { value: cur.avgNodes, change: change(cur.avgNodes, prev.avgNodes) },
      ips: { value: cur.ips, change: change(cur.ips, prev.ips) },
      earnings: { value: cur.cents, change: change(cur.cents, prev.cents) }
    };

    var key = { nodes: 'nodes', ips: 'ips', earnings: 'cents' }[state.metric];
    function pointsFor(apps2) {
      var days = perDay(apps2, range.from, range.to);
      return days.map(function (d) { return { date: d.date, value: d.active ? d[key] : null, partial: d.partial }; });
    }
    var series = state.split && state.app === 'all'
      ? sel.map(function (a) { return { id: a.id, label: a.name, points: pointsFor([a]) }; })
      : [{ id: 'total', label: state.app === 'all' ? 'All apps' : (sel[0] ? sel[0].name : ''), points: pointsFor(sel) }];

    var rows = tableRows(state, sel, range);
    var totals = { nodes: cur.avgNodes, ips: cur.ips, cents: cur.cents };

    return { sel: sel, range: { from: iso(range.from), to: iso(range.to), days: len }, hasData: cur.hasData, cards: cards, series: series, rows: rows, totals: totals, columns: columns(state.groupBy, state.app === 'all') };
  }

  /* ---------- Loading ---------- */

  var errorServed = false;
  /** Simulated request. "Loading" never finishes; "Error" fails once, then Retry succeeds. */
  function load(state, apps) {
    return new Promise(function (resolve, reject) {
      if (state.data === 'loading') return;
      setTimeout(function () {
        if (state.data === 'error' && !errorServed) { errorServed = true; reject(new Error('mock failure')); return; }
        resolve(compute(state, apps));
      }, 450);
    });
  }

  /* ---------- CSV ---------- */

  function cellValue(col, row) {
    if (col.kind === 'money') return (row.cents / 100).toFixed(2);
    return row[col.key] == null ? '' : String(row[col.key]);
  }
  function csvEscape(v) { return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }

  /** CSV of every row (not just the current page), in the order the table shows them. */
  function toCsv(columns2, rows) {
    var header = columns2.map(function (c) { return csvEscape(c.label + (c.kind === 'money' ? ' (USD)' : '')); }).join(',');
    var lines = rows.map(function (r) { return columns2.map(function (c) { return csvEscape(cellValue(c, r)); }).join(','); });
    return [header].concat(lines).join('\r\n') + '\r\n';
  }

  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  Cashful.analytics = {
    config: cfg, SCENARIOS: SCENARIOS, METRICS: METRICS, GROUPS: GROUPS, PERIODS: PERIODS,
    appsFor: appsFor, parseUrl: parseUrl, buildUrl: buildUrl, rangeOf: rangeOf, defaultPeriod: defaultPeriod,
    compute: compute, load: load, toCsv: toCsv, slug: slug,
    iso: iso, todayDay: todayDay, parseIso: parseIso,
    fmtInt: function (n) { return new Intl.NumberFormat('en-US').format(n); },
    fmtMoney: fmt.money
  };
})();
