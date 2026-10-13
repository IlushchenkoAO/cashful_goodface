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
    loginLinkTtlMin: 15,      // "The link works for 15 minutes"
    lookupsPerMinute: 10,     // email lookups on the entry screen, per minute (rate limit)
    handoffTtlMin: 5          // "Links from the Cashful app work for 5 minutes"
  },

  /* Who can sign up: the US and the EU. `geoGuess` stands in for the country found from the visitor's IP
     (?geo=Brazil in the sign-up URL tries another one). Anything else gets the "not available yet" state. */
  eligibility: {
    geoGuess: 'United States',
    supported: ['United States', 'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czechia', 'Denmark', 'Estonia', 'Finland',
      'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands',
      'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden'],
    // Shown in the list but not served yet, so the unsupported state can be reached by hand
    unsupported: ['Brazil', 'Canada', 'India', 'United Kingdom', 'Other country']
  },

  // Codes the mock backend accepts. Shown in the Prototype panel.
  demo: {
    emailCode: '246810',
    totpCode: '135790',
    smsCode: '246810',        // the code texted to confirm a payout
    backupCode: 'CASH-2026',
    // The KYC alert's X. true: closing it marks KYC as approved (prototype only). false: no X, the alert goes
    // away only when the status changes through the demo control.
    kycAlertCloseApproves: true,
    kycAlertCloseTooltip: 'Prototype: closing this marks KYC as approved'
  },

  /* A person (user) is not an account. Every user has exactly one Personal account (earn from devices), and can belong to
     any number of Developer accounts (SDK), as Owner, Admin or Member. A Developer account is an "org" (seedOrgs): it has
     its own KYC, apps, balance and payouts, members. See api.js for how a session picks one.
     peerStage — what Overview shows for the Personal account: 'new' | 'day1' | 'active' | 'payout'
     org.kycStatus — the one KYC value everything reads (api.kyc), per Developer account:
                     'not_started' | 'in_review' (shown as "Pending") | 'changes_requested' | 'rejected' | 'approved' (shown as "Verified")
     org.started   — the onboarding has been begun but not submitted (only meaningful while not_started)
     org.step      — onboarding step: 'type' | 'details' | 'apps' | 'agreements' | 'kyc' | 'review' */
  seedUsers: [
    {
      email: 'artem@goodface.agency',
      password: 'cashful123',
      name: 'Goodfacer',
      phone: '+1 415 555 0132',
      verified: true,
      twoFactor: true,
      peerStage: 'active'
    },
    {
      email: 'dev@studio.dev',
      password: 'cashful123',
      name: 'Studio Dev',
      verified: true,
      twoFactor: false,
      peerStage: 'new',
      lastAccount: 'developer', lastOrgId: 'studio-dev'   // opens in its Developer account
    }
  ],

  // The demo Developer accounts. Artem is Owner of "Acme Apps LLC" (verified, apps, a balance, a team) and of "Side Project LLC"
  // (KYC pending, no apps), and a Member of "Studio Nine Inc.". dev@studio.dev owns "Studio Dev", whose onboarding stopped at
  // step 3 ("Welcome back" after log in).
  seedOrgs: [
    {
      id: 'acme', order: 1, name: 'Acme Apps LLC', createdAt: Date.now() - 210 * 864e5,
      kycStatus: 'approved', started: true, step: 'review', kind: 'company', approvedAt: Date.now() - 80 * 864e5,
      details: { company: 'Acme Apps LLC', regno: '12-3456789', country: 'United States', street: '500 Market Street', city: 'San Francisco', region: 'California', zip: '94105', website: 'acme-apps.example' },
      apps: { count: '3', installs: '480000' },
      business: { kind: 'llc', name: 'Acme Apps LLC', country: 'United States', street: '500 Market Street', city: 'San Francisco', postal: '94105', apps: '3', installs: '480000' },
      signatures: { 'developer-agreement': { name: 'Alex Morgan', at: Date.now() - 205 * 864e5 } },
      appsSeed: 'acme', referralDefault: 'default',
      members: [
        { email: 'artem@goodface.agency', name: 'Goodfacer', role: 'owner', addedAt: Date.now() - 210 * 864e5 },
        { email: 'sam.rivera@acme-apps.example', name: 'Sam Rivera', role: 'admin', addedAt: Date.now() - 120 * 864e5 },
        { email: 'priya.nair@acme-apps.example', name: 'Priya Nair', role: 'member', addedAt: Date.now() - 45 * 864e5 }
      ]
    },
    {
      id: 'side', order: 2, name: 'Side Project LLC', createdAt: Date.now() - 9 * 864e5,
      kycStatus: 'in_review', started: true, step: 'review', kind: 'company',
      details: { company: 'Side Project LLC', regno: '98-7654321', country: 'United States', street: '12 Pine Street', city: 'Portland', region: 'Oregon', zip: '97204', website: '' },
      apps: { count: '2', installs: '5000' },
      business: { kind: 'llc', name: 'Side Project LLC', country: 'United States', street: '12 Pine Street', city: 'Portland', postal: '97204', apps: '2', installs: '5000' },
      signatures: { 'developer-agreement': { name: 'Alex Morgan', at: Date.now() - 8 * 864e5 } },
      appsSeed: 'none', referralDefault: 'empty',
      members: [{ email: 'artem@goodface.agency', name: 'Goodfacer', role: 'owner', addedAt: Date.now() - 9 * 864e5 }]
    },
    {
      id: 'nine', order: 3, name: 'Studio Nine Inc.', createdAt: Date.now() - 300 * 864e5,
      kycStatus: 'approved', started: true, step: 'review', kind: 'company', approvedAt: Date.now() - 280 * 864e5,
      details: { company: 'Studio Nine Inc.', regno: '55-1122334', country: 'Germany', street: 'Torstrasse 100', city: 'Berlin', region: '', zip: '10119', website: 'studio-nine.example' },
      apps: { count: '2', installs: '90000' },
      business: { kind: 'llc', name: 'Studio Nine Inc.', country: 'Germany', street: 'Torstrasse 100', city: 'Berlin', postal: '10119', apps: '2', installs: '90000' },
      signatures: { 'developer-agreement': { name: 'Maya Chen', at: Date.now() - 290 * 864e5 } },
      appsSeed: 'nine', referralDefault: 'empty',
      members: [
        { email: 'maya.chen@studio-nine.example', name: 'Maya Chen', role: 'owner', addedAt: Date.now() - 300 * 864e5 },
        { email: 'omar.haddad@studio-nine.example', name: 'Omar Haddad', role: 'admin', addedAt: Date.now() - 150 * 864e5 },
        { email: 'artem@goodface.agency', name: 'Goodfacer', role: 'member', addedAt: Date.now() - 30 * 864e5 }
      ]
    },
    {
      id: 'studio-dev', order: 4, name: 'Studio Dev', createdAt: Date.now() - 20 * 864e5,
      kycStatus: 'not_started', started: true, step: 'apps', kind: 'company',
      details: { company: 'Studio Apps LLC' }, apps: {},
      appsSeed: 'none', referralDefault: 'empty',
      members: [{ email: 'dev@studio.dev', name: 'Studio Dev', role: 'owner', addedAt: Date.now() - 20 * 864e5 }]
    }
  ],

  // Acme has one pending invitation. The demo-* ones are what the demo panel's invite links open (the invite page recreates them).
  seedInvites: [
    { token: 'acme-pending', orgId: 'acme', email: 'new.hire@acme-apps.example', role: 'member', invitedBy: 'artem@goodface.agency', createdAt: Date.now() - 2 * 864e5, status: 'pending' }
  ],
  // An invitation is valid for this long
  inviteValidDays: 7,

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

/* ---------- Permissions: who can do what in a Developer account ----------
   One place for the matrix. Ask with Cashful.can(role, action); never test a role by name elsewhere.
   A role without access has the item hidden (not disabled), and opening its URL shows the "no access" screen. */
Cashful.permissions = {
  // actions
  all: ['analytics', 'apps.view', 'apps.create', 'apps.review', 'sdk', 'sdk.download', 'payouts', 'members', 'company.edit', 'account.delete', 'account.leave'],
  owner: ['analytics', 'apps.view', 'apps.create', 'apps.review', 'sdk', 'sdk.download', 'payouts', 'members', 'company.edit', 'account.delete'],
  admin: ['analytics', 'apps.view', 'apps.create', 'apps.review', 'sdk', 'sdk.download', 'payouts', 'members', 'company.edit', 'account.leave'],
  member: ['analytics', 'apps.view', 'apps.create', 'apps.review', 'sdk', 'sdk.download', 'account.leave']
};
Cashful.ROLE_LABELS = { owner: 'Owner', admin: 'Admin', member: 'Member' };
/** @param role 'owner' | 'admin' | 'member' (null for a Personal account, which has no roles and no limits) */
Cashful.can = function (role, action) {
  if (!role) return true;
  var list = Cashful.permissions[role];
  return !!list && list.indexOf(action) > -1;
};
