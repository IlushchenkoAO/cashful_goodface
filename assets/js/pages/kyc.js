/* Verification (kyc.html): the page the verification partner would open, for a Developer and for a Personal account.
   Reached from Settings → Verification, the dashboard reminder and the alerts ("Start verification", "Continue verification",
   "Update information"). The prototype passes the check with "Complete verification": the status becomes Approved and
   everything that waited for it unlocks (Developer: Apps, the SDK download, payouts, Analytics. Personal: withdrawals).
   ?mode=update is the Developer's "Action required" resubmit. */
(function () {
  if (!Cashful.app) return;
  var ui = Cashful.ui;
  var api = Cashful.api;
  var esc = ui.esc;

  var root = ui.$('#kyc');
  var isDev = Cashful.app.account === 'developer';
  var update = isDev && ui.params.get('mode') === 'update';

  function feature(icon, title, desc) {
    return '<div class="feature"><span class="feature__icon"><cf-icon name="' + icon + '" size="20"></cf-icon></span>' +
      '<span class="feature__text"><span class="feature__title">' + esc(title) + '</span><span class="feature__desc">' + esc(desc) + '</span></span></div>';
  }

  function render() {
    var status = isDev ? api.kyc.status() : api.peerKyc.status();

    if (status === 'approved') {
      root.innerHTML = '<header class="cf-pagehead"><div class="cf-pagehead__row"><div class="cf-pagehead__titles"><h1 class="cf-pagehead__title" id="kyc-title" tabindex="-1">Verification</h1></div></div></header>' +
        '<section class="cf-card" style="max-width:640px">' + ui.alertHtml({ tone: 'success', title: 'You’re verified', text: isDev ? 'Apps, the SDK download and payouts are unlocked.' : 'You can withdraw whenever you reach the minimum.' }) +
        '<div><a class="cf-btn cf-btn--primary" href="settings.html#verification">Back to Settings</a></div></section>';
      return;
    }

    root.innerHTML =
      '<header class="cf-pagehead"><div class="cf-pagehead__row"><div class="cf-pagehead__titles">' +
        '<h1 class="cf-pagehead__title" id="kyc-title" tabindex="-1">' + (update ? 'Update your information' : 'Verify your identity') + '</h1>' +
        '<p class="cf-pagehead__desc">Our verification partner checks your ID. It takes about ' + (isDev ? '2' : '3') + ' minutes on your phone or webcam.</p></div></div></header>' +
      '<section class="cf-card" style="max-width:640px" aria-labelledby="kyc-need">' +
        '<h2 class="cf-card__title" id="kyc-need">What you’ll need</h2>' +
        feature('file', 'A government-issued photo ID', 'Passport, national ID card or driving license.') +
        feature('user', 'A quick selfie', 'To match your face with the photo on your ID.') +
        ui.alertHtml({ tone: 'info', title: 'Your documents stay with our partner', text: 'Cashful only receives the result of the check, not copies of your documents.' }) +
        '<p class="t-caption t-secondary">Prototype: the partner’s check opens here. One button passes it.</p>' +
        '<div class="kyc-actions"><a class="cf-btn cf-btn--secondary" href="settings.html#verification">Back to Settings</a>' +
          '<button type="button" class="cf-btn cf-btn--primary" id="kyc-complete">Complete verification</button></div>' +
      '</section>';

    ui.$('#kyc-complete', root).addEventListener('click', function (e) {
      ui.withLoading(e.currentTarget, function () { return new Promise(function (r) { setTimeout(r, 900); }); }).then(function () {
        if (isDev) api.kyc.set('approved'); else api.peerKyc.set('approved');
        Cashful.store.flash('kycDone', true);
        ui.go('settings.html#verification');
      });
    });
  }

  render();
  var h = ui.$('#kyc-title', root);
  if (h) h.focus();
})();
