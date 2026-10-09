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
    '<section class="cf-card" id="sdk-integration-card" aria-labelledby="sdk-int-title"><h2 class="cf-card__title" id="sdk-int-title">Integration</h2>' +
      '<p class="t-muted">Pick your app, then follow the steps. Its App ID is filled into every snippet.</p>' +
      '<div id="sdk-app-block"></div><div class="sdk-int__divider" role="separator"></div><div id="sdk-steps-block"></div></section>' +
    '<section class="cf-card" id="sdk-consent-card" aria-labelledby="sdk-consent-title"></section>' +
    '<p class="t-muted" id="sdk-support"></p>';

  function announce(text) {
    var live = ui.$('#sdk-live', root);
    live.textContent = '';
    setTimeout(function () { live.textContent = text; }, 30);
  }

  /* ---------- State ---------- */

  var scenario = S.scenarioFrom(location.search);
  // Apps can only be created after verification, so before it there is nothing to pick
  function loadApps() { return api.kyc.featuresUnlocked() ? S.appsFor(scenario) : []; }
  var apps = loadApps();
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
    apps = loadApps();
    st = S.parseUrl(location.search, apps, scenario);
    renderAll();
  });

  /* ---------- Sections ---------- */

  function renderHeader() {
    ui.$('#sdk-header', root).innerHTML =
      '<header class="cf-pagehead"><div class="cf-pagehead__row"><div class="cf-pagehead__titles">' +
        '<h1 class="cf-pagehead__title">SDK</h1><p class="cf-pagehead__desc">' + esc(T.subtitle) + '</p></div>' +
        (apps.length || !api.kyc.featuresUnlocked() ? '' : '<a href="apps.html?create=1" class="cf-btn cf-btn--secondary">' + icon('plus') + '<span>' + esc(T.noAppsLink) + '</span></a>') +
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
  function lockText() {
    var why = api.kyc.lockReason();
    return why === 'agreement' ? Cashful.developerSettingsConfig.agreementLockHint : why === 'rejected' ? 'Your verification wasn’t approved' : T.lockedHint;
  }
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
    var el = ui.$('#sdk-app-block', root);
    var app = appById(st.app);
    if (!apps.length) {
      var canCreate = api.kyc.featuresUnlocked();
      el.innerHTML = '<h3 class="step__title" id="sdk-app-title">App ID</h3>' +
        '<p class="t-muted">' + (canCreate ? esc(T.noAppsText) : 'Your App ID appears here once your account is verified and you create an app') + '. The snippets below show <code class="cf-mono">' + esc(cfg.appIdPlaceholder) + '</code> until then.</p>' +
        (canCreate ? '<div><a href="apps.html?create=1" class="cf-btn cf-btn--secondary">' + icon('plus') + '<span>' + esc(T.noAppsLink) + '</span></a></div>' : lockedHint('sdk-app-lock'));
      appDd = null;
      return;
    }
    el.innerHTML = '<h3 class="step__title" id="sdk-app-title">App ID</h3>' +
      '<p class="t-muted">Pick the app you are integrating.</p>' +
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
        extra = '<div class="sdk-step__links">' + (api.kyc.featuresUnlocked()
          ? (app && Cashful.apps.isEditable(app)
              ? '<button type="button" class="cf-btn cf-btn--primary cf-btn--sm" data-submit-app="' + esc(app.id) + '">Submit for review</button>'
              : '<a href="' + (app ? 'app.html?id=' + encodeURIComponent(app.id) : 'apps.html') + '" class="cf-btn cf-btn--secondary cf-btn--sm">' + (app ? 'Open the app' : 'Go to Apps') + '</a>')
          : '<button type="button" class="cf-btn cf-btn--secondary cf-btn--sm" data-locked aria-disabled="true" aria-describedby="sdk-submit-hint">' + icon('lock', 16) + '<span>Submit for review</span></button>' + lockedHint('sdk-submit-hint')) +
          (app && Cashful.apps.isActive(app) ? '<a href="analytics.html?app=' + esc(app.id) + '" class="cf-btn cf-btn--ghost cf-btn--sm"><span>View analytics</span>' + icon('arrow-right', 16) + '</a>' : '') + '</div>';
      }
      return '<li class="sdk-step"><span class="step__num">' + (i + 1) + '</span><div class="sdk-step__body">' +
        '<h3 class="step__title">' + esc(s.title) + '</h3><p class="step__desc">' + esc(s.description) + '</p>' + code + extra + '</div></li>';
    }).join('');
    ui.$('#sdk-steps-block', root).innerHTML = '<h3 class="step__title" id="sdk-steps-title">Integration steps</h3>' +
      '<p class="t-caption t-secondary sdk-snippet-note">' + esc(T.snippetNote) + '</p><ol class="sdk-steps">' + items + '</ol>';
  }

  /* ---------- Consent screen: the preview, its colors, and the template that follows them ---------- */

  var CS = cfg.consent;
  var COLOR_FIELDS = [
    { key: 'bg', label: 'Background' }, { key: 'text', label: 'Text' },
    { key: 'button', label: 'Button' }, { key: 'buttonText', label: 'Button text' }
  ];
  // The choice is a convenience: it is remembered in this browser, never needed for anything else
  var CONSENT_KEY = 'cashful.sdk.consentTheme';
  function loadConsent() {
    try {
      var v = JSON.parse(localStorage.getItem(CONSENT_KEY));
      if (v && v.colors && COLOR_FIELDS.every(function (f) { return S.normalizeHex(v.colors[f.key]); })) return v;
    } catch (e) { /* blocked or broken storage: start from the default */ }
    return null;
  }
  function saveConsent() { try { localStorage.setItem(CONSENT_KEY, JSON.stringify(consent)); } catch (e) { /* ignore */ } }
  var consent = loadConsent() || { mode: CS.defaultTheme, colors: Object.assign({}, S.themeById(CS.defaultTheme)) };
  ['id', 'label'].forEach(function (k) { delete consent.colors[k]; });

  /** Two pairs have to stay readable: the text on the background, and the label on the button. */
  function contrastRows() {
    var c = consent.colors;
    return [
      { name: 'Text on background', ratio: S.contrast(c.text, c.bg) },
      { name: 'Button text on button', ratio: S.contrast(c.buttonText, c.button) }
    ].map(function (r) {
      var ok = r.ratio >= CS.minContrast;
      return '<li class="sdk-contrast__row ' + (ok ? 'is-ok' : 'is-low') + '">' + icon(ok ? 'check-circle' : 'alert', 16) +
        '<span><strong>' + esc(r.name) + ':</strong> ' + r.ratio.toFixed(1) + ' : 1. ' +
        (ok ? 'Easy to read.' : 'Too low. Aim for at least ' + CS.minContrast + ' : 1, so use a lighter or darker color.') + '</span></li>';
    }).join('');
  }

  function applyConsent() {
    var c = consent.colors;
    var pv = ui.$('#consent-preview', root);
    if (!pv) return;
    pv.style.setProperty('--cp-bg', c.bg); pv.style.setProperty('--cp-text', c.text);
    pv.style.setProperty('--cp-btn', c.button); pv.style.setProperty('--cp-btn-text', c.buttonText);
    ui.$('#consent-contrast', root).innerHTML = contrastRows();
    saveConsent();
  }

  function renderConsent() {
    var approved = api.kyc.featuresUnlocked();
    var locked = cfg.consentTemplateRequiresKyc && !approved;
    var themes = CS.themes.concat([{ id: 'custom', label: 'Custom' }]);
    ui.$('#sdk-consent-card', root).innerHTML =
      '<h2 class="cf-card__title" id="sdk-consent-title">Consent screen</h2>' +
      '<p class="t-muted">Show people this screen before the SDK starts. Match its colors to your app, or build your own screen that meets the same requirements.</p>' +
      '<div class="sdk-consent">' +
        '<div class="sdk-consent__preview" id="consent-preview" role="group" aria-label="Example consent screen">' +
          '<span class="sdk-consent__tag">' + esc(T.consentPreviewNote) + '</span>' +
          '<h3 class="sdk-consent__title">' + esc(T.consentTitle) + '</h3><p>' + esc(T.consentText) + '</p>' +
          '<div class="sdk-consent__buttons"><button type="button" class="sdk-consent__btn sdk-consent__btn--primary" data-act="preview">' + esc(T.consentAllow) + '</button>' +
            '<button type="button" class="sdk-consent__btn" data-act="preview">' + esc(T.consentDeny) + '</button></div>' +
          '<p class="sdk-consent__fine">' + esc(T.consentOff) + '</p></div>' +
        '<div class="sdk-consent__side">' +
          '<fieldset class="sdk-themes"><legend class="step__title">Colors</legend>' +
            '<div class="sdk-themes__opts">' + themes.map(function (t) {
              return '<label class="sdk-theme"><input class="sdk-theme__input" type="radio" name="consent-theme" value="' + t.id + '"' + (t.id === consent.mode ? ' checked' : '') + '>' +
                '<span class="sdk-theme__card">' + (t.bg ? '<span class="sdk-theme__sw" style="background:' + esc(t.bg) + ';border-color:' + esc(t.button) + '"><span style="background:' + esc(t.button) + '"></span></span>' : '<span class="sdk-theme__sw sdk-theme__sw--custom">' + icon('edit', 14) + '</span>') +
                esc(t.label) + '</span></label>';
            }).join('') + '</div></fieldset>' +
          '<div class="sdk-colors" id="consent-colors"' + (consent.mode === 'custom' ? '' : ' hidden') + '>' + COLOR_FIELDS.map(function (f) {
            return '<div class="cf-input"><label class="cf-input__label" for="cc-' + f.key + '-hex">' + f.label + '</label>' +
              '<div class="sdk-color"><input type="color" class="sdk-color__pick" id="cc-' + f.key + '" data-key="' + f.key + '" value="' + esc(consent.colors[f.key]) + '" aria-label="' + f.label + ' color picker">' +
              '<div class="cf-field"><input class="cf-field__input cf-mono" id="cc-' + f.key + '-hex" data-key="' + f.key + '" data-hex value="' + esc(consent.colors[f.key]) + '" maxlength="7" spellcheck="false" autocomplete="off"></div></div>' +
              '<div class="cf-input__helper"></div></div>';
          }).join('') + '<div><button type="button" class="cf-btn cf-btn--ghost cf-btn--sm" data-act="reset-colors">Reset colors</button></div></div>' +
          '<ul class="sdk-contrast" id="consent-contrast" aria-live="polite" aria-label="Contrast check"></ul>' +
          '<h3 class="step__title">Requirements</h3>' +
          '<ul class="sdk-reqs">' + CS.requirements.map(function (r) { return '<li>' + icon('check-circle', 16) + '<span>' + esc(r) + '</span></li>'; }).join('') + '</ul>' +
          '<div class="sdk-download">' +
            (locked
              ? '<button type="button" class="cf-btn cf-btn--secondary" id="sdk-template" aria-disabled="true" aria-describedby="sdk-template-hint">' + icon('lock') + '<span>Download template</span></button>' + lockedHint('sdk-template-hint')
              : '<button type="button" class="cf-btn cf-btn--secondary" id="sdk-template">' + icon('download') + '<span>Download template</span></button>') +
          '</div></div>' +
      '</div>';
    applyConsent();
    bindConsent();
  }

  function setColor(key, value) { consent.colors[key] = value; consent.mode = 'custom'; }

  function bindConsent() {
    var card = ui.$('#sdk-consent-card', root);
    var customBox = ui.$('#consent-colors', card);

    ui.$$('input[name="consent-theme"]', card).forEach(function (r) {
      r.addEventListener('change', function () {
        consent.mode = r.value;
        if (r.value !== 'custom') consent.colors = Object.assign({}, S.themeById(r.value));
        ['id', 'label'].forEach(function (k) { delete consent.colors[k]; });
        customBox.hidden = r.value !== 'custom';
        COLOR_FIELDS.forEach(function (f) {
          ui.$('#cc-' + f.key, card).value = consent.colors[f.key];
          var hex = ui.$('#cc-' + f.key + '-hex', card); hex.value = consent.colors[f.key]; ui.setError(hex, '');
        });
        applyConsent();
        track('consent_theme_changed', { mode: r.value });
        announce('Colors: ' + r.value + '.');
      });
    });

    // The picker updates the preview while it moves
    ui.$$('.sdk-color__pick', card).forEach(function (pick) {
      pick.addEventListener('input', function () {
        var hex = ui.$('#cc-' + pick.dataset.key + '-hex', card);
        hex.value = pick.value.toUpperCase(); ui.setError(hex, '');
        setColor(pick.dataset.key, pick.value.toUpperCase());
        ui.$('input[value="custom"]', card).checked = true;
        applyConsent();
      });
    });
    // Typing a color applies it once it is valid; a wrong one is reported when the field is left
    ui.$$('[data-hex]', card).forEach(function (hex) {
      hex.addEventListener('input', function () {
        var v = S.normalizeHex(hex.value);
        if (!v) return;
        ui.$('#cc-' + hex.dataset.key, card).value = v;
        setColor(hex.dataset.key, v);
        ui.$('input[value="custom"]', card).checked = true;
        applyConsent();
      });
      hex.addEventListener('blur', function () {
        var v = S.normalizeHex(hex.value);
        if (v) { hex.value = v; ui.setError(hex, ''); }
        else ui.setError(hex, 'Enter a color like #7760E7.');
      });
    });

    ui.$('[data-act="reset-colors"]', card).addEventListener('click', function () {
      consent = { mode: CS.defaultTheme, colors: Object.assign({}, S.themeById(CS.defaultTheme)) };
      ['id', 'label'].forEach(function (k) { delete consent.colors[k]; });
      renderConsent();
      announce('Colors reset.');
      ui.$('input[name="consent-theme"]:checked', root).focus();
    });
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

    if (e.target.closest('[data-locked]')) { announce(lockText() + '.'); return; }

    // Step 4: sends the app for review and goes to the list, where its status now reads In review
    var sendApp = e.target.closest('[data-submit-app]');
    if (sendApp) {
      var sent = Cashful.apps.submit(sendApp.dataset.submitApp);
      if (sent) {
        track('app_submitted_for_review', { app: sent.id, resubmit: false, from: 'sdk' });
        Cashful.store.flash('appToast', 'Sent for review. You’ll see the result here.');
        ui.go('apps.html');
      }
      return;
    }

    var tpl = e.target.closest('#sdk-template');
    if (tpl) {
      if (tpl.getAttribute('aria-disabled') === 'true') { announce(lockText() + '.'); return; }
      var tfile = S.consentFile(consent);
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
  api.kyc.onChange(function () {
    apps = loadApps();
    st = S.parseUrl(location.search, apps, scenario);
    renderHeader(); renderPlatformCard(); renderApp(); renderSteps(); renderConsent();
  });

  // Apps and statuses come from the shared store: a change made on the Apps pages (another tab) shows up here
  Cashful.apps.onChange(function () {
    scenario = S.scenarioFrom(location.search);
    apps = S.appsFor(scenario);
    st = S.parseUrl(location.search, apps, scenario);
    renderAll();
  });
})();
