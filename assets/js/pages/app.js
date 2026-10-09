/* Developer App details (app.html?id=<UUID>). The whole Apps area waits for an approved verification (a locked page explains it until then).
   Nothing is required to send an app; a Draft explains what the review looks for. Sending goes back to the list.
   Statuses: draft and changes_requested are editable; in_review and active are read-only. Delete is for Drafts only.
   Apps come from the shared store (data/apps.js). The review itself is not part of the MVP: the dev-only block in
   the status dropdown on an In review badge (also in the list) picks the review result. */
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

  var id = ui.params.get('id');
  var app = A.get(id);
  var d = null;                    // the values in the form (not saved yet)
  var selfWrite = false;           // this page's own writes don't need a re-render from the store event
  var dropzone = null;

  var host = ui.$('#app');
  host.innerHTML = '<div data-kyc-alert></div><div class="u-contents" id="app-root"></div>';
  Cashful.kyc.mountAlert(ui.$('[data-kyc-alert]', host));
  var root = ui.$('#app-root', host);
  // Apps wait for an approved verification. Until then the page says so, and follows the status live.
  var unlockedAtLoad = api.kyc.featuresUnlocked();
  api.kyc.onChange(function () { if (api.kyc.featuresUnlocked() !== unlockedAtLoad) location.reload(); });
  if (!unlockedAtLoad) { root.innerHTML = Cashful.kyc.lockedPageHtml('Apps', 'apps and sending them for review'); return; }


  var toastText = Cashful.store.takeFlash('appToast');
  var highlight = Cashful.store.takeFlash('appHighlight') === id;
  if (toastText) ui.toast(toastText);

  function announce(text) {
    var live = ui.$('#app-live', root);
    if (!live) return;
    live.textContent = '';
    setTimeout(function () { live.textContent = text; }, 30);
  }

  /* ---------- Validation ---------- */

  function platformNames() {
    return Cashful.sdkConfig.platforms.filter(function (p) { return p.status === 'available'; }).map(function (p) { return p.name; });
  }
  function validUrl(v) {
    try { var u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:'; } catch (e) { return false; }
  }

  /** Field problems for what's typed. Nothing is required: only what is typed has to make sense. */
  function problems(strict) {
    var e = {};
    if (d.name.length > cfg.nameMaxLength) e.name = 'Use at most ' + cfg.nameMaxLength + ' characters.';
    if (d.description.length > cfg.descriptionMaxLength) e.description = 'Use at most ' + cfg.descriptionMaxLength + ' characters.';
    if (d.appLink && !validUrl(d.appLink)) e.appLink = 'Enter a link that starts with http:// or https://.';
    return e;
  }

  var FIELD_IDS = { name: 'app-name', type: 'app-type', description: 'app-desc', platform: 'app-platform', appLink: 'app-link' };

  function showErrors(e) {
    Object.keys(FIELD_IDS).forEach(function (k) {
      var input = ui.$('#' + FIELD_IDS[k], root);
      if (input) ui.setError(input, e[k] || '');
    });
    if (dropzone) dropzone.setError(e.screenshot || '');
  }

  function checklist() {
    return [
      { label: 'Name', ok: !!d.name.trim() },
      { label: 'Type', ok: !!d.type },
      { label: 'Description', ok: !!d.description.trim() },
      { label: 'Platform', ok: !!d.platform },
      { label: 'App link', ok: !!d.appLink && validUrl(d.appLink) },
      { label: 'Screenshot', ok: !!d.screenshot }
    ];
  }

  function isDirty() {
    return d.name !== app.name || d.type !== app.type || d.description !== app.description ||
      d.platform !== (app.platforms[0] || '') || d.appLink !== app.appLink || d.screenshot !== app.screenshot;
  }

  /** The Save and Submit buttons, the dirty marker and the checklist follow what is typed. */
  function updateDerived() {
    var dirty = isDirty();
    var marker = ui.$('#app-dirty', root);
    if (marker) marker.innerHTML = dirty ? '<span class="app-dirty__dot" aria-hidden="true"></span>Unsaved changes' : '';
    var save = ui.$('#app-save', root);
    if (save) save.disabled = !dirty;
    var items = checklist();
    var list = ui.$('#app-checklist', root);
    if (list) {
      list.innerHTML = items.map(function (it) {
        return '<li class="' + (it.ok ? 'is-done' : 'is-missing') + '">' + icon(it.ok ? 'check-circle' : 'clock', 16) +
          '<span>' + esc(it.label) + '</span><span class="sr-only">' + (it.ok ? ' — done' : ' — missing') + '</span></li>';
      }).join('');
    }
    // Nothing blocks sending the app: the list above only shows what the review team will look for
    var ready = ui.$('#app-ready', root);
    if (ready) ready.textContent = items.some(function (it) { return !it.ok; }) ? '' : 'Everything is in place.';
  }

  /* ---------- Sections ---------- */

  function headerHtml() {
    return '<div class="sr-only" role="status" aria-live="polite" id="app-live"></div>' +
      '<div class="app-head"><a href="apps.html" class="cf-pagehead__back">' + icon('chevron-left', 16) + '<span>Apps</span></a>' +
      '<div class="app-head__row"><h1 class="cf-pagehead__title">' + esc(app.name) + '</h1>' + A.statusControl(app) + '</div>' +
      '<div class="app-head__id"><span class="cf-input__label" id="app-id-label">App ID</span><div class="cf-copy"><span class="cf-copy__value cf-mono" aria-labelledby="app-id-label">' + esc(app.id) + '</span>' +
        '<button type="button" class="cf-btn cf-btn--secondary cf-btn--sm" data-copy-id>' + icon('copy', 16) + '<span>Copy</span></button></div></div></div>';
  }

  function bannerHtml() {
    var text = cfg.statusBanners[app.status];
    var tone = { draft: 'info', in_review: 'warning', changes_requested: 'error', active: 'success' }[app.status];
    var extra = '';
    var fb = A.feedback(app);
    if (app.status === 'in_review' && cfg.reviewEtaText) extra = cfg.reviewEtaText;
    var html = ui.alertHtml({ tone: tone, title: text, text: extra });
    if (app.status === 'changes_requested' && fb) {
      html += '<div class="app-feedback" id="feedback" tabindex="-1"><div class="app-feedback__head"><strong>' + esc(fb.reviewer || cfg.reviewerFallback) + '</strong>' +
        '<time>' + fmt.date(fb.at) + '</time></div><p>' + esc(fb.comment || '') + '</p>' +
        '<button type="button" class="cf-btn cf-btn--primary" data-act="edit">Fix and resubmit</button></div>';
    }
    if (app.status === 'active') {
      html += '<div class="app-links"><a class="cf-btn cf-btn--secondary" href="analytics.html?app=' + encodeURIComponent(app.id) + '&amp;period=30d">View analytics</a>' +
        '<a class="cf-btn cf-btn--secondary" href="sdk.html?app=' + encodeURIComponent(app.id) + '">Open SDK page</a></div>';
    }
    return html;
  }

  function detailsHtml(editable) {
    if (!editable) {
      return '<section class="cf-card" id="app-details" aria-labelledby="app-details-title"><h2 class="cf-card__title" id="app-details-title">Details</h2>' +
        '<dl class="app-dl"><div><dt>Name</dt><dd>' + esc(app.name) + '</dd></div><div><dt>Type</dt><dd>' + esc(app.type) + '</dd></div>' +
        '<div><dt>Platform</dt><dd>' + esc(A.platformLabel(app)) + '</dd></div>' +
        '<div class="is-wide"><dt>Description</dt><dd>' + (app.description ? esc(app.description) : '—') + '</dd></div></dl></section>';
    }
    var types = cfg.types.indexOf(d.type) > -1 ? cfg.types : cfg.types.concat(d.type ? [d.type] : []);
    return '<section class="cf-card" id="app-details" aria-labelledby="app-details-title">' +
      '<div class="app-card-head"><h2 class="cf-card__title" id="app-details-title">Details</h2><span class="app-dirty" id="app-dirty" role="status"></span></div>' +
      '<div class="apps-form">' +
        ui.fieldHtml({ id: 'app-name', name: 'name', label: 'Name', value: d.name, maxlength: cfg.nameMaxLength, autocomplete: 'off' }) +
        ui.selectHtml({ id: 'app-type', name: 'type', label: 'Type', options: [{ value: '', label: 'Select a type' }].concat(types), value: d.type }) +
        '<div class="cf-input"><label class="cf-input__label" for="app-desc">Description</label><div class="cf-field cf-field--area">' +
          '<textarea class="cf-field__input" id="app-desc" name="description" rows="3" maxlength="' + cfg.descriptionMaxLength + '" aria-describedby="app-count">' + esc(d.description) + '</textarea></div>' +
          '<div class="cf-input__helper"></div><div class="apps-count" id="app-count">' + d.description.length + ' / ' + cfg.descriptionMaxLength + '</div></div>' +
        ui.selectHtml({ id: 'app-platform', name: 'platform', label: 'Platform', options: [{ value: '', label: 'Select a platform' }].concat(platformNames()), value: d.platform }) +
      '</div>' +
      '<div class="app-actions"><span class="set-saved" id="app-saved" role="status"></span><button type="button" class="cf-btn cf-btn--primary" id="app-save" data-act="save" disabled>Save changes</button></div>' +
    '</section>';
  }

  function reviewHtml(editable) {
    if (!editable) {
      return '<section class="cf-card" id="app-review" aria-labelledby="app-review-title"><h2 class="cf-card__title" id="app-review-title">Review submission</h2>' +
        '<dl class="app-dl"><div class="is-wide"><dt>App link</dt><dd>' + (app.appLink ? '<a href="' + esc(app.appLink) + '" target="_blank" rel="noopener noreferrer">' + esc(app.appLink) + '</a>' : '—') + '</dd></div>' +
        '<div class="is-wide"><dt>Screenshot</dt><dd><div id="app-shot"></div></dd></div></dl></section>';
    }
    var resubmit = app.status === 'changes_requested';
    return '<section class="cf-card' + (highlight ? ' is-highlight' : '') + '" id="app-review" aria-labelledby="app-review-title">' +
      '<h2 class="cf-card__title" id="app-review-title">Review submission</h2>' +
      (resubmit ? '' : '<div class="app-before"><strong>' + esc(cfg.beforeSubmit.title) + '</strong><ol>' + cfg.beforeSubmit.steps.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>' +
        '<a href="sdk.html?app=' + encodeURIComponent(app.id) + '" class="cf-btn cf-btn--secondary cf-btn--sm"><span>Open the SDK page</span>' + icon('arrow-right', 16) + '</a></div>') +
      '<div class="apps-form">' +
        ui.fieldHtml({ id: 'app-link', name: 'appLink', label: 'App link', type: 'url', value: d.appLink, placeholder: 'https://', autocomplete: 'off', spellcheck: false, helper: 'The store page or the website of your app, with the SDK integrated.' }) +
        '<div class="cf-input"><span class="cf-input__label" id="app-shot-label">Screenshot</span><div id="app-shot" aria-labelledby="app-shot-label"></div></div>' +
      '</div>' +
      '<div class="app-submit"><div class="app-submit__col"><button type="button" class="cf-btn cf-btn--primary" id="app-submit" data-act="submit" aria-describedby="app-checklist">' + (resubmit ? 'Resubmit for review' : 'Submit for review') + '</button>' +
        '<span class="t-caption app-ready" id="app-ready" role="status"></span></div>' +
        '<ul class="app-checklist" id="app-checklist" aria-label="What the review team looks for"></ul></div>' +
    '</section>';
  }

  var HISTORY = {
    created: { title: 'Created' },
    submitted: { title: 'Submitted for review' },
    changes_requested: { title: 'Changes requested', tone: 'error' },
    resubmitted: { title: 'Resubmitted' },
    approved: { title: 'Approved', tone: 'success' }
  };
  function historyHtml() {
    var items = app.history.map(function (h) {
      var m = HISTORY[h.type];
      return { title: m.title, tone: m.tone, date: fmt.date(h.at), meta: h.type === 'changes_requested' ? (h.reviewer || cfg.reviewerFallback) : '', text: h.comment || '' };
    });
    return '<section class="cf-card" aria-labelledby="app-history-title"><h2 class="cf-card__title" id="app-history-title">History</h2>' + ui.timeline(items) + '</section>';
  }

  function deleteHtml() {
    if (app.status === 'draft') {
      return '<section class="cf-card" aria-labelledby="app-delete-title"><h2 class="cf-card__title" id="app-delete-title">Delete app</h2>' +
        '<p class="t-muted">Deleting a Draft removes it for good. This can’t be undone.</p>' +
        '<div><button type="button" class="cf-btn cf-btn--destructive" data-act="delete">Delete app</button></div></section>';
    }
    return '<p class="t-muted">Apps that were sent for review can’t be deleted here. <a href="mailto:' + esc(cfg.supportEmail) + '?subject=' + encodeURIComponent('Remove app: ' + app.name) + '">Contact support to remove this app</a></p>';
  }

  function notFoundHtml() {
    return '<section class="cf-card" aria-labelledby="app-nf-title"><div class="cf-empty"><span class="cf-tile__chip">' + icon('apps', 24) + '</span>' +
      '<h1 class="cf-empty__title" id="app-nf-title">App not found</h1><p class="cf-empty__desc">This app doesn’t exist, or it was deleted.</p>' +
      '<a href="apps.html" class="cf-btn cf-btn--secondary">Back to Apps</a></div></section>';
  }

  /* ---------- Render ---------- */

  function renderPage() {
    if (!app) { root.innerHTML = notFoundHtml(); document.title = 'App not found · Cashful'; return; }
    document.title = app.name + ' · Cashful';
    var editable = A.isEditable(app);
    d = { name: app.name, type: app.type, description: app.description, platform: app.platforms[0] || '', appLink: app.appLink, screenshot: app.screenshot };
    root.innerHTML = headerHtml() + bannerHtml() + detailsHtml(editable) + reviewHtml(editable) + historyHtml() + deleteHtml() + '<div id="app-review-sim"></div>';

    dropzone = C.fileDropzone(ui.$('#app-shot', root), {
      label: 'Screenshot',
      accept: shotTypes(),
      maxSizeMb: cfg.screenshot.maxSizeMb,
      value: d.screenshot,
      editable: editable,
      hint: formatsText() + ', up to ' + cfg.screenshot.maxSizeMb + ' MB.',
      formatError: 'Use a ' + formatsText() + ' image.',
      sizeError: 'Image must be under ' + cfg.screenshot.maxSizeMb + ' MB.',
      onChange: function (v) { d.screenshot = v; updateDerived(); },
      onUploaded: function () { track('app_screenshot_uploaded', { app: app.id }); announce('Screenshot added'); }
    });
    updateDerived();
    window.dispatchEvent(new CustomEvent('cashful:app-rendered'));   // dev-only blocks (review simulation) re-attach to the new DOM
    if (highlight) {
      var card = ui.$('#app-review', root);
      if (card && card.scrollIntoView) card.scrollIntoView({ block: 'center' });
      highlight = false;
    }
  }

  var MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  var LABEL = { jpg: 'JPG', png: 'PNG', webp: 'WebP' };
  function shotTypes() { return cfg.screenshot.formats.map(function (f) { return MIME[f]; }); }
  function formatsText() {
    var n = cfg.screenshot.formats.map(function (f) { return LABEL[f] || f.toUpperCase(); });
    return n.length > 1 ? n.slice(0, -1).join(', ') + ' or ' + n[n.length - 1] : n[0];
  }

  /* ---------- Actions ---------- */

  function persist() {
    selfWrite = true;
    app = A.update(id, { name: d.name.trim(), type: d.type, description: d.description.trim(), platforms: [d.platform], appLink: d.appLink.trim(), screenshot: d.screenshot });
    selfWrite = false;
  }

  function save() {
    var e = problems(false);
    showErrors(e);
    if (Object.keys(e).length) { var bad = ui.$('.cf-input.is-error .cf-field__input', root); if (bad) bad.focus(); return; }
    persist();
    track('app_details_saved', { app: id });
    var note = ui.$('#app-saved', root);
    d = { name: app.name, type: app.type, description: app.description, platform: app.platforms[0] || '', appLink: app.appLink, screenshot: app.screenshot };
    updateDerived();
    if (note) note.innerHTML = icon('check-circle', 16) + '<span>Changes saved.</span>';
    announce('Changes saved');
  }

  function submit() {
    var e = problems(false);
    showErrors(e);
    if (Object.keys(e).length) { var bad = ui.$('.cf-input.is-error .cf-field__input', root); if (bad) bad.focus(); return; }
    var resubmit = app.status === 'changes_requested';
    persist();
    selfWrite = true;
    app = A.submit(id);
    selfWrite = false;
    track('app_submitted_for_review', { app: id, resubmit: resubmit });
    // Back to the list, where the badge now says In review; a short notice says it went through
    Cashful.store.flash('appToast', resubmit ? 'Sent for review again. You’ll see the result here.' : 'Sent for review. You’ll see the result here.');
    ui.go('apps.html');
  }

  function confirmDelete() {
    var m = ui.modal({
      title: 'Delete app?',
      body: '<p class="cf-modal__desc">“<strong>' + esc(app.name) + '</strong>” will be deleted for good. This can’t be undone.</p>',
      footer: '<button type="button" class="cf-btn cf-btn--secondary" data-close>Cancel</button><button type="button" class="cf-btn cf-btn--destructive" data-confirm>Delete app</button>'
    });
    ui.$('[data-confirm]', m.el).addEventListener('click', function () {
      selfWrite = true;
      A.remove(id);
      selfWrite = false;
      track('app_deleted', { app: id });
      Cashful.store.flash('appToast', 'App deleted');
      m.close();
      ui.go('apps.html');
    });
  }

  root.addEventListener('input', function (e) {
    var t = e.target;
    if (!t.name || !(t.name in d)) return;
    d[t.name] = t.value;
    if (t.name === 'description') ui.$('#app-count', root).textContent = t.value.length + ' / ' + cfg.descriptionMaxLength;
    var note = ui.$('#app-saved', root); if (note) note.innerHTML = '';
    updateDerived();
  });
  root.addEventListener('change', function (e) {
    var t = e.target;
    if (t.matches && t.matches('[data-review-result]')) {
      if (t.value === 'in_review') return;
      A.applyReview(id, t.value);   // the page re-draws from the store event
      ui.toast(t.value === 'active' ? 'App approved. It is now Active and shows in Analytics.' : 'Changes requested. The comments are below.');
      return;
    }
    if (t.name && t.name in d && t.tagName === 'SELECT') { d[t.name] = t.value; updateDerived(); }
  });

  root.addEventListener('click', function (e) {
    var act = e.target.closest('[data-act]');
    if (act) {
      if (act.dataset.act === 'save') save();
      else if (act.dataset.act === 'submit') submit();
      else if (act.dataset.act === 'delete') confirmDelete();
      else if (act.dataset.act === 'edit') {
        var first = ui.$('#app-name', root) || ui.$('#app-link', root);
        var card = ui.$('#app-details', root);
        if (card && card.scrollIntoView) card.scrollIntoView({ block: 'start' });
        if (first) first.focus();
      }
      return;
    }
    var copy = e.target.closest('[data-copy-id]');
    if (copy) {
      ui.copyText(app.id).then(function (ok) {
        if (!ok) { announce('Couldn’t copy the App ID.'); return; }
        track('app_id_copied', { source: 'details' });
        announce('App ID copied');
        ui.flashCopied(copy);
      });
    }
  });

  renderPage();

  // Another page or tab changed the app (a review result, say): show it
  A.onChange(function () {
    if (selfWrite) return;
    app = A.get(id);
    renderPage();
  });

  // Opening the page from "View feedback" lands on the feedback block
  if (location.hash === '#feedback') { var fb = ui.$('#feedback', root); if (fb) { fb.scrollIntoView({ block: 'center' }); fb.focus(); } }
})();
