/* Settings (Personal) — placeholder business values. The client edits this file only.
   notifications.<key>.locked   transactional emails the person can't switch off ("Always on")
   notifications.<key>.default  the initial value
   deletion.warnWhenBalanceAbove  dollars: above this (Available + Pending) the delete dialog warns about the balance */
window.Cashful = window.Cashful || {};
Cashful.settingsConfig = {
  supportEmail: 'support@cashful.example',
  countryEditable: false,
  twoFactorEnabled: true,
  notifications: {
    payoutUpdates:   { locked: true,  default: true },
    earningsSummary: { locked: false, default: true },
    productNews:     { locked: false, default: false }
  },
  legal: {
    termsUrl: '#',
    privacyUrl: '#',
    aupUrl: '#',
    acceptedVersion: '1.0',
    acceptedAt: '2026-09-12'
  },
  deletion: {
    confirmWord: 'DELETE',
    blockedWhenPayoutInProgress: true,
    warnWhenBalanceAbove: 0
  }
};
