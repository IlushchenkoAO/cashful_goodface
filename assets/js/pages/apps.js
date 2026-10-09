/* Developer Apps list. Nothing here depends on KYC. Apps and statuses come from the shared store (data/apps.js).
   The view lives in the URL: ?status=&q=&sort=&page=, and ?create=1 opens the Create app panel.
   ?data=default|no-apps|only-drafts|only-active resets the demo apps (see the demo control). */
(function () {
  if (!Cashful.app) return;
  var ui = Cashful.ui;
  var api = Cashful.api;
  var A = Cashful.apps;
  var C = Cashful.controls;
  var fmt = Cashful.fmt;
  var track = Cashful.track;
  var cfg = Cashful.appsConfig;
  var esc = ui.esc;

  // Apps belong to Developer accounts; a Personal account goes to its Overview
  if (Cashful.app.account !== 'developer') { location.replace(api.homeFor(Cashful.app.user, 'personal')); return; }

  function icon(name, size) { return '<cf-icon name="' + name + '" size="' + (size || 20) + '"></cf-icon>'; }
  function shortId(id) { return id.slice(0, 8) + '…' + id.slice(-4); }

  /* ---------- Demo data ---------- */

  var demo = ui.params.get('data');
  if (demo && A.SCENARIOS.some(function (s) { return s.id === demo; })) {
    A.seed(demo);
    var rest = new URLSearchParams(location.search); rest.delete('data');
    history.replaceState(null, '', location.pathname + (rest.toString() ? '?' + rest.toString() : ''));
  }

  /* ---------- Frame ---------- */

  var host = ui.$('#apps');
  host.innerHTML = '<div data-kyc-alert></div><div class="u-contents" id="apps-root"></div>';
  Cashful.kyc.mountAlert(ui.$('[data-kyc-alert]', host));
  var root = ui.$('#apps-root', host);
  // Apps wait for an approved verification. Until then the page says so, and follows the status live.
  var unlockedAtLoad = api.kyc.featuresUnlocked();
  api.kyc.onChange(function () { if (api.kyc.featuresUnlocked() !== unlockedAtLoad) location.reload(); });
  if (!unlockedAtLoad) { root.innerHTML = Cashful.kyc.lockedPageHtml('Apps', 'apps and sending them for review'); return; }

  root.innerHTML =
    '<div class="sr-only" role="status" aria-live="polite" id="apps-live"></div>' +
    '<div class="page-top"><header class="cf-pagehead"><div class="cf-pagehead__row"><div class="cf-pagehead__titles">' +
      '<h1 class="cf-pagehead__title">Apps</h1><p class="cf-pagehead__desc">Create your apps, send them for review and follow their status.</p></div></div></header>' +
      '<button type="button" class="cf-btn cf-btn--primary" id="apps-create">' + icon('plus') + '<span>Create app</span></button></div>' +
    '<div class="u-contents" id="apps-attention"></div>' +
    '<div class="apps-controls" id="apps-controls"></div>' +
    '<div class="u-contents" id="apps-body"></div>';

  function announce(text) {
    var live = ui.$('#apps-live', root);
    live.textContent = '';
    setTimeout(function () { live.textContent = text; }, 30);
  }

  var toastText = Cashful.store.takeFlash('appToast');
  if (toastText) ui.toast(toastText);

  /* ---------- URL state ---------- */

  var SORTS = [{ value: 'updated', label: 'Recently updated' }, { value: 'name', label: 'Name A–Z' }, { value: 'status', label: 'Status' }];

  function parse(search) {
    var p = new URLSearchParams(search);
    var status = p.get('status');
    var sort = p.get('sort');
    var page = parseInt(p.get('page'), 10);
    return {
      status: status === 'all' || A.STATUSES.some(function (s) { return s.id === status; }) ? status : 'all',
      q: (p.get('q') || '').trim().slice(0, 100),
      sort: SORTS.some(function (s) { return s.value === sort; }) ? sort : 'updated',
      page: page > 0 ? page : 1,
      create: p.get('create') === '1'
    };
  }
  function build(st) {
    var p = new URLSearchParams();
    if (st.status !== 'all') p.set('status', st.status);
    if (st.q) p.set('q', st.q);
    if (st.sort !== 'updated') p.set('sort', st.sort);
    if (st.page > 1) p.set('page', String(st.page));
    if (st.create) p.set('create', '1');
    return location.pathname + (p.toString() ? '?' + p.toString() : '');
  }

  var st = parse(location.search);

  function go(partial, replace) {
    st = parse(build(Object.assign({}, st, partial)).split('?')[1] || '');
    var url = build(st);
    if (url !== location.pathname + location.search) history[replace ? 'replaceState' : 'pushState'](null, '', url);
    renderBody();
  }

  window.addEventListener('popstate', function () { st = parse(location.search); renderControls(); renderBody(); syncCreate(); });

  /* ---------- Controls ---------- */

  var chips = null;

  function renderControls() {
    var list = A.all();
    var counts = A.counts(list);
    var el = ui.$('#apps-controls', root);
    el.innerHTML =
      '<div id="apps-chips"></div>' +
      '<div class="apps-search cf-input"><label class="sr-only" for="apps-q">Search apps by name</label>' +
        '<div class="cf-field"><span class="cf-field__icon">' + icon('search') + '</span><input class="cf-field__input" id="apps-q" type="search" placeholder="Search by name" autocomplete="off" value="' + esc(st.q) + '"></div></div>' +
      '<div class="apps-sort cf-input"><label class="cf-input__label" for="apps-sort">Sort by</label>' +
        '<div class="cf-field cf-field--select"><select class="cf-field__input" id="apps-sort">' + ui.selectOptions(SORTS, st.sort) + '</select><cf-icon name="chevron-down" size="20"></cf-icon></div></div>';
    chips = C.segmented(ui.$('#apps-chips', el), {
      label: 'Filter by status',
      options: [{ value: 'all', label: 'All (' + counts.all + ')' }].concat(A.STATUSES.map(function (s) { return { value: s.id, label: s.label + ' (' + counts[s.id] + ')' }; })),
      value: st.status,
      onChange: function (v) { go({ status: v, page: 1 }); }
    });
    var q = ui.$('#apps-q', el);
    var timer = null;
    q.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { go({ q: q.value.trim(), page: 1 }, true); }, 220);
    });
    ui.$('#apps-sort', el).addEventListener('change', function (e) { go({ sort: e.target.value, page: 1 }); });
  }

  /* ---------- Body ---------- */

  function filtered(list) {
    var q = st.q.toLowerCase();
    var out = list.filter(function (a) { return (st.status === 'all' || a.status === st.status) && (!q || a.name.toLowerCase().indexOf(q) > -1); });
    out.sort(function (a, b) {
      if (st.sort === 'name') return a.name.localeCompare(b.name);
      if (st.sort === 'status') return A.statusOrder(a) - A.statusOrder(b) || b.updatedAt - a.updatedAt;
      return b.updatedAt - a.updatedAt;
    });
    return out;
  }

  function action(a) {
    var id = encodeURIComponent(a.id);
    if (a.status === 'draft') return '<a class="cf-btn cf-btn--secondary cf-btn--sm" href="app.html?id=' + id + '">Continue</a>';
    if (a.status === 'in_review') return '<a class="cf-btn cf-btn--secondary cf-btn--sm" href="app.html?id=' + id + '">View</a>';
    if (a.status === 'changes_requested') return '<a class="cf-btn cf-btn--secondary cf-btn--sm" href="app.html?id=' + id + '#feedback">View feedback</a>';
    return '<a class="cf-btn cf-btn--secondary cf-btn--sm" href="analytics.html?app=' + id + '&amp;period=30d">View analytics</a>';
  }

  var freshId = null;   // the app just created: its row is highlighted for a moment

  function row(a) {
    var href = 'app.html?id=' + encodeURIComponent(a.id);
    return '<tr class="is-clickable' + (a.id === freshId ? ' is-fresh' : '') + '" data-href="' + href + '">' +
      '<td><a class="apps-name" href="' + href + '">' + esc(a.name) + '</a></td>' +
      '<td>' + esc(A.platformLabel(a)) + '</td><td>' + esc(a.type) + '</td>' +
      '<td>' + A.statusControl(a) + '</td>' +
      '<td><span class="apps-id"><code class="cf-mono" title="' + esc(a.id) + '">' + esc(shortId(a.id)) + '</code>' +
        '<button type="button" class="cf-btn cf-btn--ghost cf-btn--sm" data-copy-id="' + esc(a.id) + '" aria-label="Copy App ID of ' + esc(a.name) + '">' + icon('copy', 16) + '<span>Copy</span></button></span></td>' +
      '<td>' + fmt.date(a.updatedAt) + '</td>' +
      '<td class="is-right">' + action(a) + '</td></tr>';
  }

  function emptyAll() {
    var e = cfg.emptyState;
    return '<section class="cf-card"><div class="cf-empty">' +
      '<span class="cf-tile__chip">' + icon('apps', 24) + '</span><h2 class="cf-empty__title">' + esc(e.title) + '</h2>' +
      '<ol class="apps-steps">' + e.steps.map(function (s, i) { return '<li><span class="step__num">' + (i + 1) + '</span><span>' + esc(s) + '</span></li>'; }).join('') + '</ol>' +
      '<button type="button" class="cf-btn cf-btn--primary" data-act="create">' + icon('plus') + '<span>Create app</span></button></div></section>';
  }
  function emptyFiltered() {
    return '<section class="cf-card"><div class="cf-empty"><h2 class="cf-empty__title">No apps match</h2>' +
      '<p class="cf-empty__desc">Try another search or status.</p>' +
      '<button type="button" class="cf-btn cf-btn--secondary" data-act="clear">Clear filters</button></div></section>';
  }

  function attention(list) {
    var n = A.counts(list).changes_requested;
    var el = ui.$('#apps-attention', root);
    if (!n) { el.innerHTML = ''; return; }
    el.innerHTML = '<div class="cf-alert cf-alert--error" role="status"><cf-icon class="cf-alert__icon" name="alert" size="20"></cf-icon>' +
      '<div class="cf-alert__text"><div class="cf-alert__title">' + n + (n === 1 ? ' app needs' : ' apps need') + ' your attention</div>' +
      '<div class="cf-alert__desc">The review team asked for changes.</div></div>' +
      (st.status === 'changes_requested' ? '' : '<button type="button" class="cf-btn cf-btn--secondary cf-btn--sm" data-act="attention">Show ' + (n === 1 ? 'it' : 'them') + '</button>') + '</div>';
  }

  function renderBody() {
    var list = A.all();
    attention(list);
    var body = ui.$('#apps-body', root);
    if (!list.length) { ui.$('#apps-controls', root).hidden = true; body.innerHTML = emptyAll(); return; }
    ui.$('#apps-controls', root).hidden = false;
    chips.setValue(st.status);

    var rows = filtered(list);
    if (!rows.length) { body.innerHTML = emptyFiltered(); announce('No apps match the filters'); return; }

    var size = cfg.pageSize;
    var pages = Math.max(1, Math.ceil(rows.length / size));
    if (st.page > pages) { st.page = pages; history.replaceState(null, '', build(st)); }
    var slice = rows.slice((st.page - 1) * size, st.page * size);
    var from = (st.page - 1) * size + 1, to = Math.min(rows.length, st.page * size);

    body.innerHTML = '<section class="cf-card cf-card--flush" aria-label="Apps"><div class="cf-table-wrap"><table class="cf-table apps-table">' +
      '<caption class="sr-only">Your apps, ' + rows.length + ' shown</caption>' +
      '<thead><tr><th scope="col">Name</th><th scope="col">Platform</th><th scope="col">Type</th><th scope="col">Status</th><th scope="col">App ID</th><th scope="col">Updated</th><th scope="col"><span class="sr-only">Action</span></th></tr></thead>' +
      '<tbody>' + slice.map(row).join('') + '</tbody></table></div>' +
      (rows.length > size
        ? '<nav class="cf-pagination apps-pagination" aria-label="Pages"><span class="cf-pagination__info" role="status">Showing ' + from + '–' + to + ' of ' + rows.length + '</span>' +
          '<div class="cf-pagination__pages"><button type="button" class="cf-btn cf-btn--secondary cf-btn--sm" data-pager="prev"' + (st.page === 1 ? ' disabled' : '') + '>' + icon('chevron-left', 16) + '<span>Previous</span></button>' +
          '<span class="t-caption">Page ' + st.page + ' of ' + pages + '</span>' +
          '<button type="button" class="cf-btn cf-btn--secondary cf-btn--sm" data-pager="next"' + (st.page === pages ? ' disabled' : '') + '><span>Next</span>' + icon('chevron-right', 16) + '</button></div></nav>'
        : '') + '</section>' +
      // Prototype shortcut: approve every app that is waiting for the team's review
      (A.counts(list).in_review ? '<div class="apps-sim"><button type="button" class="cf-link kyc-sim" data-act="approve-all">Approve all apps in review (Prototype)</button></div>' : '');
  }

  /* ---------- Create app ---------- */

  var createModal = null;

  function platformOptions() {
    return Cashful.sdkConfig.platforms.filter(function (p) { return p.status === 'available'; }).map(function (p) { return p.name; });
  }

  function openCreate() {
    if (createModal) return;
    track('app_create_started', {});
    var count = cfg.descriptionMaxLength;
    var m = ui.modal({
      title: 'Create app',
      width: 520,
      body: '<form class="apps-form" id="create-form" novalidate>' +
        ui.fieldHtml({ id: 'ap-name', name: 'name', label: 'Name', maxlength: cfg.nameMaxLength, autocomplete: 'off', autofocus: true, sample: 'My new app', helper: 'Up to ' + cfg.nameMaxLength + ' characters.' }) +
        ui.selectHtml({ id: 'ap-type', name: 'type', label: 'Type', options: [{ value: '', label: 'Select a type' }].concat(cfg.types), value: '' }) +
        '<div class="cf-input"><label class="cf-input__label" for="ap-desc">Description</label>' +
          '<div class="cf-field cf-field--area"><textarea class="cf-field__input" id="ap-desc" name="description" rows="3" data-sample="A short description of my app." maxlength="' + count + '" aria-describedby="ap-count"></textarea></div>' +
          '<div class="cf-input__helper"></div><div class="apps-count" id="ap-count">0 / ' + count + '</div></div>' +
        ui.selectHtml({ id: 'ap-platform', name: 'platform', label: 'Platform', options: [{ value: '', label: 'Select a platform' }].concat(platformOptions()), value: '' }) +
      '</form>',
      footer: '<button type="button" class="cf-btn cf-btn--secondary" data-close>Cancel</button>' +
        '<button type="submit" form="create-form" class="cf-btn cf-btn--primary" id="ap-submit">Create app</button>',
      onClose: function () {
        createModal = null;
        if (st.create) { st.create = false; history.replaceState(null, '', build(st)); }
      }
    });
    createModal = m;
    var form = ui.$('#create-form', m.el);
    var touched = {};
    var submit = ui.$('#ap-submit', m.el);

    function errors() {
      var v = { name: form.elements.name.value.trim(), type: form.elements.type.value, platform: form.elements.platform.value };
      var e = {};
      if (v.name.length > cfg.nameMaxLength) e.name = 'Use at most ' + cfg.nameMaxLength + ' characters.';
      return e;
    }
    function sync() {
      var e = errors();
      ['name', 'type', 'platform'].forEach(function (k) { ui.setError(form.elements[k], touched[k] && e[k] ? e[k] : ''); });
      ui.$('#ap-count', m.el).textContent = form.elements.description.value.length + ' / ' + count;
    }
    form.addEventListener('input', sync);
    form.addEventListener('change', sync);
    form.addEventListener('focusout', function (e) { if (e.target.name) { touched[e.target.name] = true; sync(); } });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (Object.keys(errors()).length) return;
      var app = A.create({ name: form.elements.name.value.trim(), type: form.elements.type.value, description: form.elements.description.value.trim(), platform: form.elements.platform.value });
      track('app_created', { type: app.type, platform: form.elements.platform.value });
      createModal = null;
      m.close();
      // Back on the list, where the new Draft stands out; the Draft's page explains what to add next
      freshId = app.id;
      st.status = 'all'; st.q = ''; st.page = 1;
      renderControls(); renderBody();
      ui.toast('App created. Open it to add the link and a screenshot.');
      var again = ui.$('tr.is-fresh a.apps-name', root);
      if (again) again.focus();
      setTimeout(function () { freshId = null; renderBody(); }, 4500);
    });
  }

  function syncCreate() { if (st.create) openCreate(); else if (createModal) createModal.close(); }

  /* ---------- Events ---------- */

  root.addEventListener('click', function (e) {
    var act = e.target.closest('[data-act]');
    if (act) {
      if (act.dataset.act === 'create') openCreate();
      else if (act.dataset.act === 'clear') { go({ status: 'all', q: '', page: 1 }); renderControls(); }
      else if (act.dataset.act === 'attention') go({ status: 'changes_requested', page: 1 });
      else if (act.dataset.act === 'approve-all') { var n = A.approveAll(); ui.toast(n + (n === 1 ? ' app approved' : ' apps approved') + '. They are Active and show in Analytics.'); }
      return;
    }
    if (e.target.closest('#apps-create')) { openCreate(); return; }

    var copy = e.target.closest('[data-copy-id]');
    if (copy) {
      ui.copyText(copy.dataset.copyId).then(function (ok) {
        if (!ok) { announce('Couldn’t copy the App ID.'); return; }
        track('app_id_copied', { source: 'list' });
        announce('App ID copied');
        ui.flashCopied(copy);
      });
      return;
    }

    var pager = e.target.closest('[data-pager]');
    if (pager) {
      go({ page: st.page + (pager.dataset.pager === 'next' ? 1 : -1) });
      var again = ui.$('[data-pager="' + pager.dataset.pager + '"]', root) || ui.$('[data-pager]:not([disabled])', root);
      if (again) again.focus();
      return;
    }

    // The whole row opens the app; links and buttons inside it do their own thing
    var tr = e.target.closest('tr[data-href]');
    if (tr && !e.target.closest('a, button, select, label')) ui.go(tr.dataset.href);
  });

  // Prototype: the dropdown on an In review badge picks the review result
  root.addEventListener('change', function (e) {
    var sel = e.target.closest('[data-review-result]');
    if (!sel) return;
    A.applyReview(sel.dataset.reviewResult, sel.value);
    ui.toast(sel.value === 'active' ? 'App approved. It is now Active and shows in Analytics.' : sel.value === 'in_review' ? 'Back in review.' : 'Changes requested. Open the app to see the comments.');
  });

  // A URL with unknown values is tidied to what is actually shown
  if (build(st) !== location.pathname + location.search) history.replaceState(null, '', build(st));

  renderControls();
  renderBody();
  syncCreate();
  A.onChange(function () { renderControls(); renderBody(); });
})();
