/* Developer Apps — placeholder business values and texts. The client edits this file only.
   Nothing on the Apps pages is gated by KYC.
   Status ids: draft | in_review | changes_requested | active (labels: Draft, In review, Changes requested, Active).
   Platforms come from the SDK config (sdk.config.js): only `available` ones can be chosen. */
window.Cashful = window.Cashful || {};
Cashful.appsConfig = {
  pageSize: 10,
  nameMaxLength: 60,
  descriptionMaxLength: 500,
  types: ['Mobile app', 'Desktop app', 'Game', 'Utility', 'Other'],
  platformsSource: 'sdk.platforms',
  screenshot: {
    maxSizeMb: 5,
    formats: ['jpg', 'png', 'webp']
  },
  reviewEtaText: null,               // e.g. 'Usually 2-3 business days'; shown in the In review banner only when not null
  supportEmail: 'support@cashful.example',
  statusBanners: {
    draft: 'Integrate the SDK in your app, then add its link and a screenshot of the integration. After that, send it for review.',
    in_review: 'We’re reviewing your app. You’ll see the result here.',
    changes_requested: 'Please address the feedback below and resubmit.',
    active: 'Your app is active. Analytics are available.'
  },
  emptyState: {
    title: 'Create your first app',
    steps: ['Create your app', 'Submit it for review', 'Once Active, track analytics']
  },
  // Shown in the feedback block when a reviewer didn't leave a name
  reviewerFallback: 'Cashful review team',
  // The comment a simulated "Changes requested" carries (the prototype's review result)
  sampleFeedback: 'Please add a clearer screenshot that shows the SDK working in your app, and check that the app link points to the public store page.',
  // What to do before sending an app for review (shown on a Draft)
  beforeSubmit: {
    title: 'Before you send it for review',
    steps: [
      'Integrate the Cashful SDK into your app.',
      'Take a screenshot that shows the integration working, for example the consent screen.',
      'Add the app link (the store page or your website) and the screenshot below.'
    ]
  }
};
