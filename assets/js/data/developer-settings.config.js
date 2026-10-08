/* Developer Settings — placeholder business values and texts. The client edits this file only.
   kycStatus (the shared store) is the single source of truth: not_started | in_review | changes_requested | rejected | approved.
   "In progress" is not_started with the onboarding begun (dev.started).
   `featuresUnlocked` = kycApproved && (!agreementsBlockFeatures || the Developer Agreement is signed): it locks the
   SDK download and payout requests, nothing else. */
window.Cashful = window.Cashful || {};
Cashful.developerSettingsConfig = {
  supportEmail: 'support@cashful.example',
  kyc: {
    unlocks: ['SDK download', 'Sending apps for review', 'Payout requests'],
    reviewTime: '1–2 business days',       // "usually within …": shown wherever a review is pending
    // Rejected: the reason a reviewer would give, and what happens next
    rejection: {
      reason: 'We couldn’t confirm that the company name and address match your registration documents.',
      nextStep: 'You can contact support to talk it through. If the details were wrong, support can reopen your verification.'
    },
    startRoute: '/kyc',                    // a placeholder page: this is where the KYC provider would open
    stageLabels: {
      details: 'Business details completed',
      agreements: 'Agreements signed',
      review: 'Verification review',
      approved: 'Approved'
    }
  },
  businessDetails: {
    lockedStatuses: ['in_review', 'approved', 'rejected']   // read-only here, change via support
  },
  agreementsBlockFeatures: false,               // true: SDK download and payouts also need the signed Developer Agreement
  agreementLockHint: 'Sign the Developer Agreement and complete KYC',
  agreements: [
    { id: 'developer-agreement', title: 'Developer Agreement', version: '1.0', kind: 'signable',
      bodyText: 'DEVELOPER AGREEMENT (placeholder)\n\n1. Scope. This agreement covers your use of the Cashful SDK and your apps on the Cashful network.\n\n2. Consent. Your apps must ask people for explicit opt-in before the SDK starts, and let them switch it off at any time.\n\n3. Payouts. Earnings are paid according to the payout terms shown in your dashboard.\n\n4. Conduct. You will not use the network for anything the Acceptable Use Policy forbids.\n\n5. Changes. Cashful may update these terms and will tell you before they take effect.\n\nThis text is a placeholder. The final agreement is provided by Cashful.' },
    { id: 'terms', title: 'Terms of Service', version: '1.0', kind: 'accepted', acceptedAt: '2026-09-12', url: '#' },
    { id: 'privacy', title: 'Privacy Policy', version: '1.0', kind: 'accepted', acceptedAt: '2026-09-12', url: '#' },
    { id: 'aup', title: 'Acceptable Use Policy', version: '1.0', kind: 'accepted', acceptedAt: '2026-09-12', url: '#' }
  ],
  notifications: {
    payoutUpdates: { locked: true, default: true },
    appReviewUpdates: { locked: true, default: true },
    verificationUpdates: { locked: true, default: true },
    earningsSummary: { locked: false, default: true },
    productNews: { locked: false, default: false }
  },
  closeAccount: {
    text: 'To close your developer account, contact support.',
    mailSubject: 'Close my Cashful developer account'
  },
  alertTexts: {
    changes_requested: 'Your verification needs your attention.',
    rejected: 'Your verification wasn’t approved.'
  }
};
