/* Developer Analytics. What it shows depends on the verification status:
     in_review     — can explore the SDK and create draft apps (DashboardDeveloper)
     approved      — can send apps for review and request payouts (DevAnalyticsApproved)
     action_needed — KYC failed, resubmit documents (DevAnalyticsActionNeeded)
   An unfinished onboarding sends the person back to it. */
(function () {
  if (!Cashful.app) return;
  var ui = Cashful.ui;
  var api = Cashful.api;
  var esc = ui.esc;

  var DEMO = { review: 'in_review', approved: 'approved', action: 'action_needed' };
  var forced = DEMO[ui.params.get('state')];
  if (forced) api.setDevStatus(forced);

  var user = api.currentUser();
  var dev = user.dev;
  if (dev.status === 'not_started' || dev.status === 'in_progress') {
    location.replace('developer-verification.html');
    return;
  }

  var approved = dev.status === 'approved';
  var d = dev.details || {};
  var owner = dev.kind === 'indie' ? [d.firstName, d.lastName].filter(Boolean).join(' ') || user.email : (d.company || 'Studio Apps LLC');

  var top = {
    in_review: ui.alertHtml({ tone: 'warning', title: 'We’re reviewing your account', text: 'You can explore the SDK and add draft apps now. Sending apps for review and payouts unlock after approval, usually within [X] business days.' }),
    approved: ui.alertHtml({ tone: 'success', title: 'You’re verified', text: 'Your developer account is approved. You can now send apps for review and request payouts.' }),
    action_needed: ui.alertHtml({ tone: 'error', title: 'We need a clearer photo of your ID', text: 'The photo was too blurry to confirm your identity. Upload it again, it takes about 2 minutes.' }) +
      '<div class="alert-action"><a href="developer-verification.html#kyc" class="cf-btn cf-btn--primary"><span>Resubmit documents</span><cf-icon name="arrow-right" size="20"></cf-icon></a></div>'
  }[dev.status];

  function disabledSelect(label, value) {
    return '<div class="cf-input is-disabled filter"><span class="cf-input__label">' + esc(label) + '</span>' +
      '<div class="cf-field cf-field--select"><span class="cf-field__input">' + esc(value) + '</span><cf-icon name="chevron-down" size="20"></cf-icon></div></div>';
  }

  var btn = approved ? 'cf-btn--primary' : 'cf-btn--secondary';

  ui.$('#analytics').innerHTML = top +
    '<header class="cf-pagehead"><div class="cf-pagehead__row"><div class="cf-pagehead__titles">' +
      '<h1 class="cf-pagehead__title">Analytics</h1><p class="cf-pagehead__desc">' + esc(owner) + '</p></div></div></header>' +
    // Filters do nothing until there are apps — disabled as in the design
    '<div class="filters">' + disabledSelect('App', 'All apps') + disabledSelect('Period', 'Last 30 days') + '</div>' +
    '<div class="cf-grid cf-grid--4">' +
      ui.statCard({ label: 'Balance', value: '$0.00', icon: 'wallet', caption: approved ? 'Payouts from $[X]' : 'Payouts unlock after approval', brand: true }) +
      ui.statCard({ label: 'Earned this month', value: '$0.00', icon: 'banknote' }) +
      ui.statCard({ label: 'Nodes online', value: '0', icon: 'globe' }) +
      ui.statCard({ label: 'Traffic', value: '0.0 GB', icon: 'chart' }) +
    '</div>' +
    '<section class="cf-card apps-card">' +
      '<div class="apps-card__head"><h3 class="cf-card__title">Apps</h3>' +
        '<a href="#" class="cf-btn ' + btn + ' cf-btn--sm" data-soon="Create app"><cf-icon name="plus" size="16"></cf-icon><span>Create app</span></a></div>' +
      '<div class="apps-card__empty">' +
        '<cf-mascot character="main" size="104"></cf-mascot>' +
        '<div class="empty-card__text"><h2 class="empty-card__title">Add your first app</h2>' +
          '<p class="empty-card__desc">' + (approved
            ? 'Create an app and send it for review. Once it’s active, its nodes, traffic and earnings show up here.'
            : 'Add your app now and save it as a draft. You can send it for review once your account is approved.') + '</p></div>' +
        '<div class="apps-card__actions"><a href="#" class="cf-btn ' + btn + '" data-soon="Create app">Create app</a>' +
          '<a href="#" class="cf-btn cf-btn--ghost" data-soon="SDK guide"><span>Read the SDK guide</span><cf-icon name="arrow-right" size="20"></cf-icon></a></div>' +
      '</div>' +
    '</section>';
})();
