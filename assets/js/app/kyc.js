/* KYC alert for Developer pages. It reads the one KYC value (api.kyc) and follows its changes live.
     in_review          — "We're reviewing your account", with an X when config.demo.kycAlertCloseApproves is on
     not_started        — developerSettings.alertTexts.not_started and a "Go to Settings" button (no X)
     changes_requested  — developerSettings.alertTexts.changes_requested and a "Go to Settings" button (no X)
     approved           — no alert
   In the prototype the X means "KYC passed": it sets the status to approved, the alert leaves with a short
   transition and a toast says what is unlocked. Mount it with <div data-kyc-alert></div>. */
(function () {
  var ui = Cashful.ui;
  var api = Cashful.api;
  var cfg = Cashful.config.demo;

  var UNLOCKED = 'KYC approved. SDK download and payouts are now unlocked.';

  function alertFor(status) {
    if (status === 'in_review') {
      return ui.alertHtml({
        tone: 'warning',
        title: 'We’re reviewing your account',
        text: 'You can explore the SDK and add draft apps now. Sending apps for review and payouts unlock after approval, usually within [X] business days.',
        close: cfg.kycAlertCloseApproves ? { label: 'Close', tooltip: cfg.kycAlertCloseTooltip || '' } : null
      });
    }
    var ds = Cashful.developerSettingsConfig;
    var toSettings = '<div class="alert-action"><a href="settings.html#verification" class="cf-btn cf-btn--primary"><span>Go to Settings</span><cf-icon name="arrow-right" size="20"></cf-icon></a></div>';
    // not_started and changes_requested: the text comes from the config, there is no close button, and Settings is the way forward
    if (status === 'not_started' && ds) return ui.alertHtml({ tone: 'info', title: ds.alertTexts.not_started }) + toSettings;
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

  Cashful.kyc = { mountAlert: mountAlert };
})();
