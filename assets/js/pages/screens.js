/* Screen map: prepares the state a link needs before opening it.
   data-fresh                     — start verify-email from a fresh sign-up
   data-accounts="personal,developer" + optional
     data-account, data-dev-status, data-dev-step, data-dev-kind, data-peer-stage, data-flash
                                  — sign in as a login with exactly that setup */
(function () {
  var ui = Cashful.ui;
  var api = Cashful.api;

  // data-dev-status is a shorthand in the links; it sets the real fields (kycStatus, started)
  var KYC_SHORTHAND = {
    not_started: { kycStatus: 'not_started', started: false },
    in_progress: { kycStatus: 'not_started', started: true },
    in_review: { kycStatus: 'in_review' },
    action_needed: { kycStatus: 'changes_requested' },
    approved: { kycStatus: 'approved' }
  };

  ui.$$('[data-fresh]').forEach(function (a) {
    a.addEventListener('click', function () { api.cancelPending(); });
  });

  ui.$$('[data-accounts]').forEach(function (a) {
    a.addEventListener('click', function () {
      var d = a.dataset;
      var dev = {};
      if (d.devStatus) Object.assign(dev, KYC_SHORTHAND[d.devStatus]);
      if (d.devStep) dev.step = d.devStep;
      if (d.devKind) dev.kind = d.devKind;
      api.demo.signInWith(d.accounts.split(','), { account: d.account, dev: dev, peerStage: d.peerStage });
      if (d.flash) Cashful.store.flash(d.flash, true);
    });
  });

  ui.$('#reset').addEventListener('click', function () {
    Cashful.store.reset();
    ui.toast('Demo data reset');
  });
})();
