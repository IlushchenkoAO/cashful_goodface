/* Developer apps — the shared mock store. Analytics, SDK and the Apps pages all read apps and statuses from here,
   so a change on one page is what the others show (they also listen to the "cashful:apps" event).
   Apps live in the prototype store (localStorage); the first read seeds them. Status ids:
   draft | in_review | changes_requested | active. Only Active apps have analytics.
   `base`, `weekend`, `split`, `activeDaysAgo` shape the mock traffic in data/analytics.js (seeded Active apps only):
   an app without them, like a newly approved one, has no data yet. */
window.Cashful = window.Cashful || {};
(function () {
  var store = Cashful.store;
  var DAY = 24 * 60 * 60 * 1000;

  var STATUSES = [
    { id: 'draft', label: 'Draft', tone: 'neutral', order: 2 },
    { id: 'in_review', label: 'In review', tone: 'warning', order: 3 },
    { id: 'changes_requested', label: 'Changes requested', tone: 'error', order: 1 },
    { id: 'active', label: 'Active', tone: 'success', order: 4 }
  ];
  function statusOf(app) { return STATUSES.filter(function (s) { return s.id === app.status; })[0] || STATUSES[0]; }

  var SCENARIOS = [
    { id: 'default', label: 'Default (mixed statuses)' },
    { id: 'no-apps', label: 'No apps' },
    { id: 'only-drafts', label: 'Only Drafts' },
    { id: 'only-active', label: 'Only Active' }
  ];

  /* ---------- Seed ---------- */

  /** A small drawn placeholder standing in for an uploaded screenshot. */
  function shot(name, color) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><rect width="640" height="400" fill="' + color + '"/>' +
      '<rect x="40" y="40" width="560" height="64" rx="12" fill="#ffffff" opacity=".9"/><rect x="40" y="132" width="360" height="228" rx="16" fill="#ffffff" opacity=".8"/>' +
      '<rect x="424" y="132" width="176" height="104" rx="16" fill="#ffffff" opacity=".55"/><rect x="424" y="256" width="176" height="104" rx="16" fill="#ffffff" opacity=".35"/>' +
      '<text x="64" y="82" font-family="sans-serif" font-size="28" font-weight="700" fill="#1c1a1b">' + name + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function seedApps() {
    var now = Date.now();
    function ago(d, h) { return now - d * DAY - (h || 0) * 3600 * 1000; }
    var REVIEW_COMMENT = 'The screenshot doesn’t show the app’s main screen. Please upload one that does, and make sure the app link points to the public store page.';
    return [
      { id: '3b1f6d2a-8c4e-4f1a-9d57-1a2b3c4d5e01', name: 'Pixel Quest', type: 'Game', description: 'A relaxed pixel-art puzzle game with a new level every day.',
        platforms: ['Android'], status: 'active', appLink: 'https://play.example.com/store/apps/details?id=pixelquest', screenshot: shot('Pixel Quest', '#7760E7'),
        activeDaysAgo: 320, base: 1800, weekend: 0.12, createdAt: ago(334), updatedAt: ago(320),
        history: [{ type: 'created', at: ago(334) }, { type: 'submitted', at: ago(331) }, { type: 'approved', at: ago(320) }] },
      { id: '3b1f6d2a-8c4e-4f1a-9d57-1a2b3c4d5e02', name: 'SnapLite', type: 'Mobile app', description: 'A lightweight photo editor with filters and one-tap fixes.',
        platforms: ['iOS'], status: 'active', appLink: 'https://apps.example.com/app/snaplite', screenshot: shot('SnapLite', '#FFBF40'),
        activeDaysAgo: 170, base: 950, weekend: 0.07, createdAt: ago(185), updatedAt: ago(170),
        history: [{ type: 'created', at: ago(185) }, { type: 'submitted', at: ago(182) }, { type: 'approved', at: ago(170) }] },
      { id: '3b1f6d2a-8c4e-4f1a-9d57-1a2b3c4d5e03', name: 'DeskSync', type: 'Desktop app', description: 'Keeps your folders in sync between your computers.',
        platforms: ['Windows', 'macOS'], status: 'active', appLink: 'https://desksync.example.com', screenshot: shot('DeskSync', '#5A4AA6'),
        activeDaysAgo: 21, base: 520, weekend: -0.25, split: { Windows: 0.62, macOS: 0.38 }, createdAt: ago(40), updatedAt: ago(21),
        history: [{ type: 'created', at: ago(40) }, { type: 'submitted', at: ago(34) }, { type: 'changes_requested', at: ago(28), reviewer: 'Cashful review team', comment: 'Please add a link to your privacy policy on the website.' },
          { type: 'resubmitted', at: ago(24) }, { type: 'approved', at: ago(21) }] },
      { id: '3b1f6d2a-8c4e-4f1a-9d57-1a2b3c4d5e04', name: 'Voice Notes', type: 'Utility', description: 'Record, trim and share short voice notes.',
        platforms: ['Android'], status: 'draft', appLink: '', screenshot: null, createdAt: ago(6), updatedAt: ago(2),
        history: [{ type: 'created', at: ago(6) }] },
      { id: '3b1f6d2a-8c4e-4f1a-9d57-1a2b3c4d5e05', name: 'Trip Planner', type: 'Mobile app', description: 'Plan trips with friends: routes, bookings and a shared budget.',
        platforms: ['iOS'], status: 'in_review', appLink: 'https://apps.example.com/app/tripplanner', screenshot: shot('Trip Planner', '#FD83FB'), createdAt: ago(9), updatedAt: ago(3),
        history: [{ type: 'created', at: ago(9) }, { type: 'submitted', at: ago(3) }] },
      { id: '3b1f6d2a-8c4e-4f1a-9d57-1a2b3c4d5e06', name: 'Photo Booth', type: 'Desktop app', description: 'Take photos with fun frames, straight from your webcam.',
        platforms: ['Windows'], status: 'changes_requested', appLink: 'https://photobooth.example.com', screenshot: shot('Photo Booth', '#F6562C'), createdAt: ago(15), updatedAt: ago(4),
        history: [{ type: 'created', at: ago(15) }, { type: 'submitted', at: ago(11) }, { type: 'changes_requested', at: ago(4), reviewer: 'Cashful review team', comment: REVIEW_COMMENT }] }
    ];
  }

  /** Two more Drafts for the "Only Drafts" demo: one complete (ready to submit) and one incomplete. */
  function extraDrafts() {
    var now = Date.now();
    return [
      { id: '3b1f6d2a-8c4e-4f1a-9d57-1a2b3c4d5e07', name: 'Quick Scan', type: 'Utility', description: 'Scan documents and save them as tidy PDFs.',
        platforms: ['iOS'], status: 'draft', appLink: 'https://apps.example.com/app/quickscan', screenshot: shot('Quick Scan', '#047954'), createdAt: now - 3 * DAY, updatedAt: now - DAY,
        history: [{ type: 'created', at: now - 3 * DAY }] },
      { id: '3b1f6d2a-8c4e-4f1a-9d57-1a2b3c4d5e08', name: 'Tile Match', type: 'Game', description: '',
        platforms: ['Android'], status: 'draft', appLink: '', screenshot: null, createdAt: now - DAY, updatedAt: now - DAY,
        history: [{ type: 'created', at: now - DAY }] }
    ];
  }

  function seedFor(scenario) {
    var all = seedApps();
    if (scenario === 'no-apps') return [];
    if (scenario === 'only-active') return all.filter(function (a) { return a.status === 'active'; });
    if (scenario === 'only-drafts') return [all[3]].concat(extraDrafts());
    return all;
  }

  /* ---------- Store ---------- */

  function read() {
    var db = store.get();
    if (!db.apps) {
      var seeded = seedApps();
      store.update(function (d) { d.apps = seeded; });
      return seeded;
    }
    return db.apps;
  }
  function write(apps) { store.update(function (db) { db.apps = apps; }); emit(); }
  function emit() { window.dispatchEvent(new CustomEvent('cashful:apps')); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function find(apps, id) { return apps.filter(function (a) { return a.id === id; })[0]; }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }

  var FIELDS = ['name', 'type', 'description', 'platforms', 'appLink', 'screenshot'];

  var Apps = {
    STATUSES: STATUSES, SCENARIOS: SCENARIOS,
    all: function () { return clone(read()); },
    get: function (id) { var a = find(read(), id); return a ? clone(a) : null; },
    isActive: function (a) { return a.status === 'active'; },
    isEditable: function (a) { return a.status === 'draft' || a.status === 'changes_requested'; },
    label: function (a) { return statusOf(a).label; },
    tone: function (a) { return statusOf(a).tone; },
    /** The status badge: always a text label, never colour alone. */
    badge: function (a) { return '<span class="cf-badge cf-badge--' + statusOf(a).tone + '">' + statusOf(a).label + '</span>'; },
    statusOrder: function (a) { return statusOf(a).order; },

    create: function (f) {
      var apps = read();
      var now = Date.now();
      var app = { id: uuid(), name: f.name, type: f.type, description: f.description || '', platforms: [f.platform], status: 'draft',
        appLink: '', screenshot: null, createdAt: now, updatedAt: now, history: [{ type: 'created', at: now }] };
      apps.push(app);
      write(apps);
      return clone(app);
    },
    /** Saves the editable fields of a Draft or Changes requested app. */
    update: function (id, patch) {
      var apps = read();
      var app = find(apps, id);
      if (!app || !Apps.isEditable(app)) return null;
      FIELDS.forEach(function (k) { if (k in patch) app[k] = patch[k]; });
      app.updatedAt = Date.now();
      write(apps);
      return clone(app);
    },
    /** Draft → In review, Changes requested → In review (resubmit). */
    submit: function (id) {
      var apps = read();
      var app = find(apps, id);
      if (!app || !Apps.isEditable(app)) return null;
      var resubmit = app.status === 'changes_requested';
      app.status = 'in_review';
      app.updatedAt = Date.now();
      app.history.push({ type: resubmit ? 'resubmitted' : 'submitted', at: app.updatedAt });
      write(apps);
      return clone(app);
    },
    /** The review simulation (the real review is not part of the MVP): 'approve' or 'changes'. */
    review: function (id, outcome, comment, reviewer) {
      var apps = read();
      var app = find(apps, id);
      if (!app || app.status !== 'in_review') return null;
      app.updatedAt = Date.now();
      if (outcome === 'approve') {
        app.status = 'active';
        app.history.push({ type: 'approved', at: app.updatedAt });
      } else {
        app.status = 'changes_requested';
        app.history.push({ type: 'changes_requested', at: app.updatedAt, reviewer: reviewer || null, comment: comment });
      }
      write(apps);
      return clone(app);
    },
    /**
     * Status simulation (the real review is not part of the MVP): any status, from any status.
     * opts.comment: the reviewer's words for Changes requested. opts.data (Active only, default true): give the app mock
     * traffic so it shows up in Analytics; false leaves it Active with no data yet.
     */
    setStatus: function (id, status, opts) {
      opts = opts || {};
      var apps = read();
      var app = find(apps, id);
      if (!app || !STATUSES.some(function (s) { return s.id === status; })) return null;
      var now = Date.now();
      app.status = status;
      app.updatedAt = now;
      if (status === 'in_review') app.history.push({ type: 'submitted', at: now });
      else if (status === 'changes_requested') app.history.push({ type: 'changes_requested', at: now, reviewer: 'Cashful review team', comment: opts.comment || 'Please check the app details and send it again.' });
      else if (status === 'active') {
        app.history.push({ type: 'approved', at: now });
        if (opts.data !== false) {
          // A traffic profile like the seeded apps have (see data/analytics.js), so the app has numbers to show
          var n = app.name.length;
          app.base = 420 + (n * 37) % 700;
          app.weekend = 0.08;
          app.activeDaysAgo = 45;
        } else { delete app.base; delete app.weekend; delete app.activeDaysAgo; }
      }
      write(apps);
      return clone(app);
    },
    /**
     * The status badge of an app that is In review turns into a dropdown: the prototype's way to choose the review
     * result (Active, or Changes requested with a sample comment). Everything else keeps a plain badge.
     */
    statusControl: function (a) {
      if (a.status !== 'in_review' && a.status !== 'active') return Apps.badge(a);
      var opts = [['in_review', 'In review'], ['active', 'Active'], ['changes_requested', 'Changes requested']];
      return '<span class="status-select status-select--' + a.status + '"><label class="sr-only" for="rs-' + a.id + '">Review result (prototype)</label>' +
        '<select class="status-select__input" id="rs-' + a.id + '" data-review-result="' + a.id + '" title="Prototype: choose the review result">' +
        opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === a.status ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
        '</select><cf-icon name="chevron-down" size="14"></cf-icon></span>';
    },
    /** Applies the result chosen in that dropdown: Active (with mock traffic, so it shows in Analytics), back In review, or Changes requested. */
    applyReview: function (id, value) {
      var a = Apps.get(id);
      if (!a || a.status === value) return null;
      if (value === 'active') return Apps.setStatus(id, 'active', { data: true });
      if (value === 'in_review') return Apps.setStatus(id, 'in_review');
      if (value === 'changes_requested') return Apps.setStatus(id, 'changes_requested', { comment: Cashful.appsConfig.sampleFeedback });
      return null;
    },
    /** The prototype's "approve everything": every app that is In review becomes Active (with data). */
    approveAll: function () {
      var ids = read().filter(function (a) { return a.status === 'in_review'; }).map(function (a) { return a.id; });
      ids.forEach(function (id) { Apps.setStatus(id, 'active', { data: true }); });
      return ids.length;
    },
    /** Only Drafts can be deleted. */
    remove: function (id) {
      var apps = read();
      var app = find(apps, id);
      if (!app || app.status !== 'draft') return false;
      write(apps.filter(function (a) { return a.id !== id; }));
      return true;
    },
    /** Replaces all apps with a demo set (the "Apps data" demo control). */
    seed: function (scenario) { write(seedFor(scenario)); },

    counts: function (list) {
      var c = { all: list.length };
      STATUSES.forEach(function (s) { c[s.id] = list.filter(function (a) { return a.status === s.id; }).length; });
      return c;
    },
    platformLabel: function (a) { return a.platforms.join(', '); },
    /** The latest reviewer feedback, or null. */
    feedback: function (a) {
      var h = a.history.filter(function (x) { return x.type === 'changes_requested'; });
      return h.length ? h[h.length - 1] : null;
    },
    onChange: function (fn) {
      function handler() { fn(); }
      window.addEventListener('cashful:apps', handler);
      window.addEventListener('storage', handler);
      return function () { window.removeEventListener('cashful:apps', handler); window.removeEventListener('storage', handler); };
    }
  };

  Cashful.apps = Apps;
})();
