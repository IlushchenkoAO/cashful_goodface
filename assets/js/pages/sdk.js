/* Developer SDK. The whole page is readable regardless of KYC; only the download buttons are locked until
   KYC is approved (and the Developer Agreement is signed, when the config asks for it). The lock reads api.kyc.featuresUnlocked() on every render and re-renders on api.kyc.onChange, so the
   KYC alert's X and the demo control unlock it without a reload.
   Platform and app live in the URL (?platform=android&app=<id>); Back / Forward restore them.
   Business values and texts come from data/sdk.config.js. */
(function () {
  if (!Cashful.app) return;
  var ui = Cashful.ui;
  var api = Cashful.api;
  var S = Cashful.sdk;
  var C = Cashful.controls;
  var fmt = Cashful.fmt;
  var track = Cashful.track;
  var cfg = S.config;
  var T = cfg.texts;
  var esc = ui.esc;

  // The SDK belongs to Developer accounts; a Personal account goes to its Overview
  if (Cashful.app.account !== 'developer') { location.replace(api.homeFor(Cashful.app.user, 'personal')); return; }

  function icon(name, size) { return '<cf-icon name="' + name + '" size="' + (size || 20) + '"></cf-icon>'; }
  var badge = Cashful.apps.badge;

  /* ---------- Frame ---------- */

  var host = ui.$('#sdk');
  host.innerHTML = '<div data-kyc-alert></div><div class="u-contents" id="sdk-root"></div>';
  Cashful.kyc.mountAlert(ui.$('[data-kyc-alert]', host));
  var root = ui.$('#sdk-root', host);
  root.innerHTML =
    '<div class="sr-only" role="status" aria-live="polite" id="sdk-live"></div>' +
    '<div class="u-contents" id="sdk-header"></div>' +
    '<section class="cf-card" aria-labelledby="sdk-plat-title"><h2 class="cf-card__title" id="sdk-plat-title">Platform</h2><div id="sdk-picker"></div></section>' +
    '<section class="cf-card sdk-platform" id="sdk-platform-card" aria-label="Selected platform"></section>' +
    '<section class="cf-card" id="sdk-app-card" aria-labelledby="sdk-app-title"></section>' +
    '<section class="cf-card" id="sdk-steps-card" aria-labelledby="sdk-steps-title"></section>' +
    '<section class="cf-card" id="sdk-consent-card" aria-labelledby="sdk-consent-title"></section>' +
    '<p class="t-muted" id="sdk-support"></p>';

  function announce(text) {
    var live = ui.$('#sdk-live', root);
    live.textContent = '';
    setTimeout(function () { live.textContent = text; }, 30);
  }

  /* ---------- State ---------- */

  var scenario = S.scenarioFrom(location.search);
  var apps = S.appsFor(scenario);
  var st = S.parseUrl(location.search, apps, scenario);

  function appById(id) { return apps.filter(function (a) { return a.id === id; })[0] || null; }
  function platform() { return S.platformById(st.platform); }

  function go(partial) {
    st = S.parseUrl(S.buildUrl(Object.assign({}, st, partial)).split('?')[1], apps, scenario);
    var url = S.buildUrl(st);
    if (url !== location.pathname + location.search) history.pushState(null, '', url);
  }

  window.addEventListener('popstate', function () {
    scenario = S.scenarioFrom(location.search);
    apps = S.appsFor(scenario);
    st = S.parseUrl(location.search, apps, scenario);
    renderAll();
  });

  /* ---------- Sections ---------- */

  function renderHeader() {
    ui.$('#sdk-header', root).innerHTML =
      '<header class="cf-pagehead"><div class="cf-pagehead__row"><div class="cf-pagehead__titles">' +
        '<h1 class="cf-pagehead__title">SDK</h1><p class="cf-pagehead__desc">' + esc(T.subtitle) + '</p></div>' +
        (apps.length ? '' : '<a href="apps.html?create=1" class="cf-btn cf-btn--secondary">' + icon('plus') + '<span>' + esc(T.noAppsLink) + '</span></a>') +
      '</div></header>';
  }

  function renderPicker() {
    ui.$('#sdk-picker', root).innerHTML = '<fieldset class="sdk-plats"><legend class="sr-only">Platform</legend>' +
      cfg.platforms.map(function (p) {
        var soon = p.status !== 'available';
        return '<label class="sdk-plat' + (soon ? ' is-soon' : '') + '">' +
          '<input class="sdk-plat__input" type="radio" name="sdk-platform" value="' + p.id + '"' + (p.id === st.platform ? ' checked' : '') +
            (soon ? ' disabled aria-describedby="soon-' + p.id + '"' : '') + '>' +
          '<span class="sdk-plat__card"><span class="sdk-plat__icon">' + icon(p.icon, 24) + '</span>' +
          '<span class="sdk-plat__text"><span class="sdk-plat__name">' + esc(p.name) + '</span>' +
          (soon ? '<span class="cf-badge cf-badge--neutral" id="soon-' + p.id + '">Coming soon</span>' : '') + '</span></span></label>';
      }).join('') + '</fieldset>';
  }

  /** Locked buttons stay focusable (aria-disabled) so their reason is announced and a click can be tracked. */
  /** The reason text depends on what is missing: the signature (when the config asks for it) or the KYC approval. */
  function lockText() { return api.kyc.lockReason() === 'agreement' ? Cashful.developerSettingsConfig.agreementLockHint : T.lockedHint; }
  function lockedHint(id) {
    var target = api.kyc.lockReason() === 'agreement' ? 'agreements' : 'verification';
    return '<span class="sdk-lock" id="' + id + '">' + icon('lock', 16) + '<span>' + esc(lockText()) + '</span> · ' +
      '<a href="settings.html#' + target + '">' + esc(T.lockedLink) + '</a></span>';
  }

  function renderPlatformCard() {
    var p = platform();
    var approved = api.kyc.featuresUnlocked();
    ui.$('#sdk-platform-card', root).innerHTML =
      '<div class="sdk-platform__top"><span class="sdk-plat__icon is-lg">' + icon(p.icon, 28) + '</span>' +
        '<div><h2 class="cf-card__title">' + esc(p.name) + ' SDK</h2><p class="t-muted">Version ' + esc(p.version) + ' · Released ' + fmt.date(new Date(p.releasedAt + 'T12:00:00').getTime()) + '</p></div></div>' +
      '<dl class="sdk-meta"><div><dt>Requirements</dt><dd>' + esc(p.requirements) + '</dd></div>' +
        '<div><dt>Documentation</dt><dd><a href="' + esc(p.docsUrl) + '" data-soon="Documentation">Open the ' + esc(p.name) + ' documentation</a></dd></div></dl>' +
      '<div class="sdk-download">' +
        (approved
          ? '<button type="button" class="cf-btn cf-btn--primary" id="sdk-download">' + icon('download') + '<span>Download SDK</span></button>'
          : '<button type="button" class="cf-btn cf-btn--primary" id="sdk-download" aria-disabled="true" aria-describedby="sdk-lock-hint">' + icon('lock') + '<span>Download SDK</span></button>' + lockedHint('sdk-lock-hint')) +
      '</div>';
  }

  var appDd = null;
  function renderApp() {
    var el = ui.$('#sdk-app-card', root);
    var app = appById(st.app);
    if (!apps.length) {
      el.innerHTML = '<h2 class="cf-card__title" id="sdk-app-title">App ID</h2>' +
        '<p class="t-muted">' + esc(T.noAppsText) + '. The snippets below show <code class="cf-mono">' + esc(cfg.appIdPlaceholder) + '</code> until you do.</p>' +
        '<div><a href="apps.html?create=1" class="cf-btn cf-btn--secondary">' + icon('plus') + '<span>' + esc(T.noAppsLink) + '</span></a></div>';
      appDd = null;
      return;
    }
    el.innerHTML = '<h2 class="cf-card__title" id="sdk-app-title">App ID</h2>' +
      '<p class="t-muted">Pick the app you are integrating. Its ID is filled into the snippets below.</p>' +
      '<div class="sdk-app"><div id="sdk-app-dd"></div>' +
        '<div class="sdk-app__id"><span class="cf-input__label" id="sdk-uuid-label">App ID</span>' +
          '<div class="cf-copy"><span class="cf-copy__value cf-mono" id="sdk-uuid" aria-labelledby="sdk-uuid-label">' + esc(st.app) + '</span>' +
          '<button type="button" class="cf-btn cf-btn--secondary cf-btn--sm" data-copy-app>' + icon('copy', 16) + '<span>Copy</span></button></div></div></div>' +
      '<div id="sdk-app-note"></div>';
    appDd = C.dropdown(ui.$('#sdk-app-dd', el), {
      label: 'App',
      options: apps.map(function (a) { return { value: a.id, label: a.name, html: '<span>' + esc(a.name) + '</span>' + badge(a) }; }),
      value: st.app,
      onChange: function (v) {
        go({ app: v });
        renderApp(); renderSteps();
        var trig = ui.$('#sdk-app-dd .cf-dd__trigger', root);
        if (trig) trig.focus();
      }
    });
    ui.$('#sdk-app-note', el).innerHTML = app && !Cashful.apps.isActive(app)
      ? '<p class="t-body sdk-note">' + icon('info', 16) + esc(T.appNotActiveNote) + '</p>' : '';
  }

  function renderSteps() {
    var p = platform();
    var app = appById(st.app);
    var items = cfg.steps.map(function (s, i) {
      var code = (cfg.snippets[p.id] || {})[s.id]
        ? ui.codeBlock({ code: S.snippet(p.id, s.id, st.app), label: p.name + ' · ' + s.title, id: s.id }) : '';
      var extra = '';
      if (s.id === 'test') {
        extra = '<div class="sdk-step__links"><a href="' + (app ? 'app.html?id=' + encodeURIComponent(app.id) : 'apps.html') + '" class="cf-btn cf-btn--secondary cf-btn--sm">Submit for review</a>' +
          (app && Cashful.apps.isActive(app) ? '<a href="analytics.html?app=' + esc(app.id) + '" class="cf-btn cf-btn--ghost cf-btn--sm"><span>View analytics</span>' + icon('arrow-right', 16) + '</a>' : '') + '</div>';
      }
      return '<li class="sdk-step"><span class="step__num">' + (i + 1) + '</span><div class="sdk-step__body">' +
        '<h3 class="step__title">' + esc(s.title) + '</h3><p class="step__desc">' + esc(s.description) + '</p>' + code + extra + '</div></li>';
    }).join('');
    ui.$('#sdk-steps-card', root).innerHTML = '<h2 class="cf-card__title" id="sdk-steps-title">Integration steps</h2>' +
      '<p class="t-caption t-secondary sdk-snippet-note">' + esc(T.snippetNote) + '</p><ol class="sdk-steps">' + items + '</ol>';
  }

  function renderConsent() {
    var approved = api.kyc.featuresUnlocked();
    var locked = cfg.consentTemplateRequiresKyc && !approved;
    ui.$('#sdk-consent-card', root).innerHTML =
      '<h2 class="cf-card__title" id="sdk-consent-title">Consent screen</h2>' +
      '<p class="t-muted">Show people this screen before the SDK starts. Use the template, or build your own that meets the same requirements.</p>' +
      '<div class="sdk-consent">' +
        '<div class="sdk-consent__preview" role="group" aria-label="Example consent screen">' +
          '<span class="cf-badge cf-badge--neutral">' + esc(T.consentPreviewNote) + '</span>' +
          '<h3 class="sdk-consent__title">' + esc(T.consentTitle) + '</h3><p>' + esc(T.consentText) + '</p>' +
          '<div class="sdk-consent__buttons"><button type="button" class="cf-btn cf-btn--primary" data-act="preview">' + esc(T.consentAllow) + '</button>' +
            '<button type="button" class="cf-btn cf-btn--secondary" data-act="preview">' + esc(T.consentDeny) + '</button></div>' +
          '<p class="t-caption t-secondary">' + esc(T.consentOff) + '</p></div>' +
        '<div class="sdk-consent__side"><h3 class="step__title">Requirements</h3>' +
          '<ul class="sdk-reqs">' + cfg.consent.requirements.map(function (r) { return '<li>' + icon('check-circle', 16) + '<span>' + esc(r) + '</span></li>'; }).join('') + '</ul>' +
          '<div class="sdk-download">' +
            (locked
              ? '<button type="button" class="cf-btn cf-btn--secondary" id="sdk-template" aria-disabled="true" aria-describedby="sdk-template-hint">' + icon('lock') + '<span>Download template</span></button>' + lockedHint('sdk-template-hint')
              : '<button type="button" class="cf-btn cf-btn--secondary" id="sdk-template">' + icon('download') + '<span>Download template</span></button>') +
          '</div></div>' +
      '</div>';
  }

  function renderSupport() {
    ui.$('#sdk-support', root).innerHTML = 'Questions about the SDK? <a href="mailto:' + esc(cfg.supportEmail) + '">Contact support</a>';
  }

  function renderAll() {
    renderHeader(); renderPicker(); renderPlatformCard(); renderApp(); renderSteps(); renderConsent(); renderSupport();
  }

  /* ---------- Events ---------- */

  root.addEventListener('change', function (e) {
    if (e.target.name !== 'sdk-platform') return;
    go({ platform: e.target.value });
    track('sdk_platform_selected', { platform: st.platform });
    renderPlatformCard();
    renderSteps();
  });

  root.addEventListener('click', function (e) {
    var p = platform();

    var dl = e.target.closest('#sdk-download');
    if (dl) {
      if (dl.getAttribute('aria-disabled') === 'true') {
        track('sdk_download_blocked_clicked', { platform: p.id });
        announce(lockText() + '.');
        return;
      }
      var file = S.sdkFile(p);
      ui.downloadFile(file.name, file.text);
      track('sdk_download_clicked', { platform: p.id, version: p.version });
      ui.toast('Download started');
      return;
    }

    var tpl = e.target.closest('#sdk-template');
    if (tpl) {
      if (tpl.getAttribute('aria-disabled') === 'true') { announce(lockText() + '.'); return; }
      var tfile = S.consentFile();
      ui.downloadFile(tfile.name, tfile.text);
      track('sdk_consent_template_downloaded', {});
      ui.toast('Download started');
      return;
    }

    var codeCopy = e.target.closest('[data-code-copy]');
    if (codeCopy) {
      var block = codeCopy.closest('.cf-code-block');
      var step = block.dataset.code;
      ui.copyText(ui.$('code', block).textContent).then(function (ok) {
        if (!ok) { announce('Couldn’t copy. Select the code and copy it yourself.'); return; }
        track('sdk_snippet_copied', { platform: p.id, step: step });
        announce('Snippet copied: ' + block.getAttribute('aria-label'));
        ui.flashCopied(codeCopy);
      });
      return;
    }

    var appCopy = e.target.closest('[data-copy-app]');
    if (appCopy) {
      ui.copyText(st.app).then(function (ok) {
        if (!ok) { announce('Couldn’t copy the App ID.'); return; }
        track('sdk_app_id_copied', {});
        announce('App ID copied');
        ui.flashCopied(appCopy);
      });
      return;
    }

    if (e.target.closest('[data-act="preview"]')) ui.toast('This is only an example', 'info');
  });

  renderAll();
  history.replaceState(null, '', S.buildUrl(st));

  // The lock follows the shared KYC status live
  api.kyc.onChange(function () { renderPlatformCard(); renderConsent(); });

  // Apps and statuses come from the shared store: a change made on the Apps pages (another tab) shows up here
  Cashful.apps.onChange(function () {
    scenario = S.scenarioFrom(location.search);
    apps = S.appsFor(scenario);
    st = S.parseUrl(location.search, apps, scenario);
    renderAll();
  });
})();
