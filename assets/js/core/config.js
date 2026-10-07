/* Prototype configuration: business rules and demo data in one place.
   Values marked [X] in the design are still placeholders waiting on the client (see README). */
window.Cashful = window.Cashful || {};

Cashful.config = {
  // false — prototype mode: any text in any field is accepted, so every flow can be clicked through.
  //         Error states are still reachable from the screen map (?demo=…).
  // true  — real rules: format checks, wrong passwords and codes, taken emails, lockout.
  strictValidation: false,

  rules: {
    emailCodeTtlMin: 10,      // "It expires in 10 minutes"
    resendCooldownSec: 60,
    maxLoginAttempts: 5,      // "After 5 failed attempts…"
    lockMinutes: 15,          // "…logging in pauses for 15 minutes"
    resetLinkTtlMin: 60,      // "It works for 1 hour"
    handoffTtlMin: 5          // "Links from the Cashful app work for 5 minutes"
  },

  // Codes the mock backend accepts. Shown in the Prototype panel.
  demo: {
    emailCode: '246810',
    totpCode: '135790',
    backupCode: 'CASH-2026',
    // The KYC alert's X. true: closing it marks KYC as approved (prototype only). false: no X, the alert goes
    // away only when the status changes through the demo control.
    kycAlertCloseApproves: true,
    kycAlertCloseTooltip: 'Prototype: closing this marks KYC as approved'
  },

  /* One login can hold two accounts: 'personal' (earn from devices) and 'developer' (SDK).
     peerStage — what Overview shows: 'new' | 'day1' | 'active' | 'payout'
     dev.kycStatus — the one KYC value everything reads (api.kyc):
                     'not_started' | 'in_review' | 'changes_requested' | 'approved'
     dev.started   — the onboarding has been begun but not submitted (only meaningful while not_started)
     dev.step      — onboarding step: 'type' | 'details' | 'apps' | 'agreements' | 'kyc' | 'review' */
  seedUsers: [
    {
      email: 'artem@goodface.agency',
      password: 'cashful123',
      name: 'Goodfacer',
      accounts: ['personal'],
      verified: true,
      twoFactor: true,
      peerStage: 'active'
    },
    {
      email: 'dev@studio.dev',
      password: 'cashful123',
      name: 'Studio Dev',
      accounts: ['developer'],
      verified: true,
      twoFactor: false,
      // Stopped at step 3 → "Welcome back" resume after log in (DevOnbResume)
      dev: { kycStatus: 'not_started', started: true, step: 'apps', kind: 'company', details: { company: 'Studio Apps LLC' } }
    }
  ],

  onboardingSteps: [
    { id: 'type', title: 'Account type', description: 'Individual or company' },
    { id: 'details', title: 'Business details', description: 'Country and full address' },
    { id: 'apps', title: 'Your apps', description: 'Apps and installs' },
    { id: 'agreements', title: 'Agreements', description: 'Review and sign' },
    { id: 'kyc', title: 'Verify identity', description: 'ID and selfie, about 2 min' },
    { id: 'review', title: 'Review', description: 'Manual check by our team' }
  ],

  referrals: {
    JORDAN24: { name: 'Jordan M.', initials: 'JM' }
  }
};
