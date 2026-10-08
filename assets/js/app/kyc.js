/* KYC notices for Developer pages. They read the one KYC value (api.kyc) and follow its changes live.
   Banner (top of the page, mount with <div data-kyc-alert></div>):
     in_review          — "We're reviewing your account", with an X when config.demo.kycAlertCloseApproves is on
     changes_requested  — developerSettings.alertTexts.changes_requested and a "Go to Settings" button (no X)
     rejected           — developerSettings.alertTexts.rejected and a "Go to Settings" button (no X)
     not_started, approved — no banner
   Reminder (a card in the bottom-right corner of every Developer page, drawn automatically):
     not_started (also "in progress") — what is still to do, a "Start verification" button, and an X.
     The X hides it for the rest of the browser session, so it never nags; it comes back in a new session.
   In the prototype the banner's X means "KYC passed": it sets the status to approved, the banner leaves with a short
   transition and a toast says what is unlocked. */
(function () {
  var ui = Cashful.ui;
  var api = Cashful.api;
  var cfg = Cashful.config.demo;

  var UNLOCKED = 'KYC approved. SDK download and payouts are now unlocked.';

  function reviewTime() { var ds = Cashful.developerSettingsConfig; return ds ? ds.kyc.reviewTime : '1–2 business days'; }
  function started() { var u = api.currentUser(); return !!(u && u.dev && u.dev.started); }

  function alertFor(status) {
    if (status === 'in_review') {
      return ui.alertHtml({
        tone: 'warning',
        title: 'We’re reviewing your account',
        text: 'You can read the SDK documentation now. Apps, the SDK download and payouts unlock after approval, usually within ' + reviewTime() + '.',
        close: cfg.kycAlertCloseApproves ? { label: 'Close', tooltip: cfg.kycAlertCloseTooltip || '' } : null
      });
    }
    var ds = Cashful.developerSettingsConfig;
    var toSettings = '<div class="alert-action"><a href="settings.html#verification" class="cf-btn cf-btn--primary"><span>Go to Settings</span><cf-icon name="arrow-right" size="20"></cf-icon></a></div>';
    // not_started and changes_requested: the text comes from the config, there is no close button, and Settings is the way forward
    if (status === 'rejected' && ds) return ui.alertHtml({ tone: 'error', title: ds.alertTexts.rejected }) + toSettings;
    if (status === 'changes_requested' && ds) return ui.alertHtml({ tone: 'error', title: ds.alertTexts.changes_requested }) + toSettings;
    return '';
  }

  function mountAlert(slot) {
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function leave() {
      var el = slot.firstElementChild;
      if (!el) return;
      el.classList.add('is-leaving');
      setTimeout(function () { if (el.parentNode === slot) slot.innerHTML = ''; }, reduceMotion ? 0 : 220);
    }

    function render(status, animate) {
      var html = alertFor(status);
      if (html) slot.innerHTML = '<div class="kyc-alert">' + html + '</div>';
      else if (animate && slot.firstElementChild) leave();
      else slot.innerHTML = '';
    }

    render(api.kyc.status(), false);
    api.kyc.onChange(function (status) { render(status, true); });

    slot.addEventListener('click', function (e) {
      if (!e.target.closest('[data-alert-close]') || !cfg.kycAlertCloseApproves) return;
      api.kyc.set('approved');
      ui.toast(UNLOCKED);
      // The X is gone now; keep keyboard focus on the page instead of losing it
      var title = ui.$('.cf-pagehead__title');
      if (title) { title.tabIndex = -1; title.focus(); }
    });
  }

  /* ---------- Reminder: what is still to do, bottom-right, closable ---------- */

  var DISMISS_KEY = 'cashful.kycReminderDismissed';
  function dismissed() { try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch (e) { return false; } }
  function dismiss() { try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch (e) { /* storage may be blocked */ } }

  function reminderItems() {
    var begun = started();
    return [
      { label: 'Business details', st: begun ? 'done' : 'todo' },
      { label: 'Identity verification', st: 'todo', note: 'About 2 minutes, with our verification partner' },
      { label: 'Manual review', st: 'todo', note: 'Usually ' + reviewTime() + ' after you submit' }
    ];
  }

  function reminderHtml() {
    var items = reminderItems();
    var done = items.filter(function (x) { return x.st === 'done'; }).length;
    return '<section class="kyc-reminder" role="region" aria-labelledby="kyc-rem-title">' +
      '<button type="button" class="cf-ibtn cf-ibtn--ghost cf-ibtn--sm kyc-reminder__close" aria-label="Dismiss the verification reminder" data-reminder-close><cf-icon name="close" size="16"></cf-icon></button>' +
      '<h2 class="kyc-reminder__title" id="kyc-rem-title">Complete verification</h2>' +
      '<p class="kyc-reminder__text">Until you do, Apps and Payouts stay locked, the SDK can’t be downloaded and Analytics stays empty.</p>' +
      '<div class="kyc-reminder__bar" role="progressbar" aria-label="Verification progress" aria-valuemin="0" aria-valuemax="' + items.length + '" aria-valuenow="' + done + '" aria-valuetext="' + done + ' of ' + items.length + ' steps done"><span style="width:' + (done / items.length * 100) + '%"></span></div>' +
      '<ol class="kyc-reminder__steps">' + items.map(function (x) {
        return '<li class="kc-step is-' + x.st + '"><span class="kc-step__mark" aria-hidden="true">' + (x.st === 'done' ? '✓' : '•') + '</span>' +
          '<span class="kc-step__text"><span class="kc-step__label">' + ui.esc(x.label) + '</span>' + (x.note ? '<span class="kc-step__note">' + ui.esc(x.note) + '</span>' : '') + '</span>' +
          '<span class="kc-step__state">' + (x.st === 'done' ? 'Done' : 'To do') + '</span></li>';
      }).join('') + '</ol>' +
      '<a class="cf-btn cf-btn--primary cf-btn--block" href="settings.html#verification"><span>' + (started() ? 'Continue verification' : 'Start verification') + '</span><cf-icon name="arrow-right" size="20"></cf-icon></a>' +
    '</section>';
  }

  function mountReminder() {
    var host = document.createElement('div');
    host.className = 'kyc-reminder-host';
    document.body.appendChild(host);
    function render() {
      var show = api.kyc.status() === 'not_started' && !dismissed();
      host.innerHTML = show ? reminderHtml() : '';
    }
    host.addEventListener('click', function (e) {
      if (!e.target.closest('[data-reminder-close]')) return;
      dismiss();
      render();
    });
    render();
    api.kyc.onChange(render);
  }

  /** A card that says a page is locked until verification, with the way to unlock it (Apps, an app's page). */
  function lockedPageHtml(title, what) {
    var why = api.kyc.lockReason();
    var status = api.kyc.status();
    var text = why === 'rejected' ? 'Your verification wasn’t approved, so ' + what + ' stays locked. Contact support from Settings to talk it through.'
      : status === 'in_review' ? 'We’re reviewing your details, usually within ' + reviewTime() + '. ' + what.charAt(0).toUpperCase() + what.slice(1) + ' unlocks as soon as you’re approved.'
      : why === 'agreement' ? Cashful.developerSettingsConfig.agreementLockHint + ' to unlock ' + what + '.'
      : 'Complete verification to unlock ' + what + '. It takes about 2 minutes.';
    var cta = status === 'in_review' ? 'See the status' : why === 'rejected' ? 'See details' : (started() ? 'Continue verification' : 'Start verification');
    return '<header class="cf-pagehead"><div class="cf-pagehead__row"><div class="cf-pagehead__titles"><h1 class="cf-pagehead__title">' + ui.esc(title) + '</h1></div></div></header>' +
      '<section class="cf-card" aria-labelledby="kyc-lock-title"><div class="cf-empty"><span class="cf-tile__chip"><cf-icon name="lock" size="24"></cf-icon></span>' +
      '<h2 class="cf-empty__title" id="kyc-lock-title">' + ui.esc(title) + ' unlock after verification</h2><p class="cf-empty__desc">' + ui.esc(text) + '</p>' +
      '<a class="cf-btn cf-btn--primary" href="settings.html#' + (why === 'agreement' ? 'agreements' : 'verification') + '">' + cta + '</a></div></section>';
  }

  Cashful.kyc = { mountAlert: mountAlert, mountReminder: mountReminder, lockedPageHtml: lockedPageHtml };

  // Developer pages only; Settings and the Verification page are where it is finished
  var page = document.body.dataset.page;
  if (Cashful.app && Cashful.app.account === 'developer' && page !== 'settings' && page !== 'kyc') mountReminder();
})();
