# Cashful dashboard — HTML/CSS/JS prototype

A working prototype of `app.cashful.com`, ported from the design prototype (`cashful-prototype`).
Plain HTML, CSS and JavaScript: no framework, no build, no server. Open `index.html` by double-clicking it.

**Status:** iteration 3. All 42 screens from the design are ported: authentication, developer verification,
account switching, developer Analytics, and the Peer side (Overview and Download app).

## Open it

- `index.html` is the start of sign-up.
- `screens.html` is the screen map. Every screen from the design opens in the state it shows.
- The **Prototype** button in the bottom-right corner shows hints for the current screen, the Overview stage
  switcher, a link to the screen map and "Reset data".

## Prototype mode: any input works

`strictValidation: false` in `assets/js/core/config.js` (the default) means every field accepts anything,
empty fields included. Any email and password log in, and any code passes. That way every flow can be
clicked through without remembering demo data.

The error states from the design (wrong password, locked, email taken, wrong code, bad referral code,
expired link) still open from `screens.html` through `?demo=…`.

`strictValidation: true` turns the real rules on: format checks, passwords, codes and the 5-attempt lockout.
For that mode, use the demo data:

| What | Value |
| --- | --- |
| Personal account with 2FA | `artem@goodface.agency` / `cashful123` |
| Developer account, verification not finished | `dev@studio.dev` / `cashful123` |
| Email code | `246810` |
| Authenticator code / backup code | `135790` / `CASH-2026` |
| Referral code | `JORDAN24` |

## What works

The design shows each state as a separate artboard. Here they are real logic, and one page moves
between its states.

### Authentication

| Page | Design screens | Logic |
| --- | --- | --- |
| `index.html` | Main | choose account type |
| `signup.html` | SignupPersonal, …EmailTaken, SignupInvited, SignupReferralError | referral link `?ref=CODE` |
| `signup-developer.html` | SignupDeveloper | same, plus GitHub |
| `verify-email.html` | VerifyEmail, …Error, …Resent, VerifyEmailDev | 6-digit code (paste, auto-advance), 60 s resend timer |
| `login.html` | Login, LoginError, LoginLocked, LoggedOut | routing by account type; lockout with a live countdown |
| `login-2fa.html` | Login2FA | authenticator code or backup code |
| `forgot-password.html` | ForgotPassword, ForgotSent | |
| `reset-password.html` | ResetPassword, ResetDone, ResetLinkExpired | a one-time link that expires after use |
| `earn-handoff.html` | EarnHandoff, EarnHandoffExpired | token exchange, then Overview |

### Peer dashboard

| Page | Design screens | Logic |
| --- | --- | --- |
| `dashboard.html` | DashboardPersonal, PeerDay1, PeerActive, PeerPayoutReady, PeerAddDevice, PeerConnected | stage of the account (below), period tabs, chart tooltip, copy the referral link |
| `download.html` | PeerDownload | recommended installer for the visitor's OS, "How to install" on tile hover, "Soon" platforms with "Notify me" |

**Overview stages.** One screen shows the account over time:
`new` (no devices) → `day1` → `active` (2 months in) → `payout` (balance over the minimum).
A new account starts at `new`. "Add a device" opens the instructions. When you close them, the prototype
pretends the person installed the app: a second later Pixel 8 connects, a corner notice appears, and
Overview switches to `day1`. Use `dashboard.html?state=…` or the Prototype panel to switch stages by hand.

### Developer verification and Analytics

| Page | Design screens | Logic |
| --- | --- | --- |
| `developer-verification.html` | DevOnbType, DevOnbBusiness, DevOnbBusinessIndie, DevOnbApps, DevOnbAgreements, DevOnbKyc, DevOnbReview, DevOnbResume | 6-step wizard, progress saved after each step, `#step` deep links, browser Back between steps |
| `analytics.html` | DashboardDeveloper, DevAnalyticsApproved, DevAnalyticsActionNeeded | content depends on the review result; `?state=review\|approved\|action` |

- **Step 1 picks the branch.** "Company" leads to the business details form, "Independent" to the personal
  details form. Later steps use the answers: "You're signing on behalf of {company}" or "You're signing
  as {name}", and the "Authority to act for {company}" row only appears for companies.
- **Start verification** simulates the partner's check and moves the account to review.
- **Resuming.** Logging in with an unfinished onboarding opens the saved step with "Welcome back".
- **Action needed.** "Resubmit documents" goes back to the identity step and shows the reason.

### Accounts and switching

One login can have a personal account, a developer account, or both. Adding the second one never needs a new
sign-up.

- **One account:** the sidebar shows a prompt. On a personal account it says "Become a developer" and opens a
  confirmation modal, then onboarding. On a developer account it says "Earn from your devices" and adds a
  personal account right away ("Personal account added").
- **Both accounts:** the sidebar shows the Personal | Developer switcher. Each account has its own menu and
  home page.

Opening a page that belongs to the other account switches to that account. Opening a page for an account the
login doesn't have redirects to the login's home page.

The chart data is taken 1:1 from the design (`assets/js/data/earnings.js`). The devices, alerts and
cards are in `assets/js/data/peer.js`.

Download buttons, Payouts, Referrals, Settings, Help and "Become a developer" show a "coming later"
toast. These sections are not part of the design yet.

## Structure

```
*.html                    one page per screen group
assets/
  tokens.json             canonical tokens (from the design prototype)
  img/qr-app.svg          QR code from the Download screen
  css/
    cashful.css           entry point: imports tokens, base, all components
    tokens.css            CSS custom properties — use tokens, never raw values
    base.css              reset, text styles, utilities
    components/*.css      one file per DS component, BEM with the `cf-` prefix
    layouts/auth.css      split auth layout + centred "solo" layout
    layouts/app.css       signed-in shell, Overview and Download blocks
  js/
    ds/svg-data.js        icons, logo, mascots, brand shapes (copied 1:1 from the DS bundle)
    ds/elements.js        <cf-icon>, <cf-logo>, <cf-mascot>, <cf-brand-shape>, <cf-brand-icon>
    ds/ui.js              inputs, OTP, alerts, toasts, notices, modal, tabs, copy field, views
    core/config.js        strictValidation switch, business rules, demo data
    core/store.js         state in localStorage (survives navigation)
    core/api.js           mock backend: same response shapes a real API should return
    core/demo.js          the Prototype panel (remove the script tag to hide it)
    data/                 sample data for Overview (chart, devices) and install instructions
    app/shell.js          session/account guard, sidebar, account switcher, "Become a developer"
    app/install.js        "Add a device" and "How to install" modals
    pages/*.js            logic for each page
```

Scripts are plain `<script defer>` files that share the `window.Cashful` namespace. They are not
ES modules, because modules don't load from `file://`.

**Moving to a real backend:** replace the bodies of the functions in `core/api.js` with `fetch()`, and
replace `data/*.js` with responses. Pages only use the response shapes.

## Differences from the design

- **Login2FA:** the design source has only the brand panel; the form side is empty. The form here
  follows the VerifyEmail pattern and adds a backup code option. **Needs a design.**
- **Responsive:** the design is desktop only (1440×900). On narrow screens the auth brand panel turns
  into a header, and the dashboard sidebar becomes a top menu.
- **Additions:** a loading state on buttons, error text for checkboxes, a hover on the account type
  cards, toasts, and the Download hero switching between Windows and macOS based on the visitor's OS.

## Open questions for the client

The `[X]` placeholders and the questions from `docs/flows.md` in the design prototype are still open:
payout minimum, referral %, review time, app versions and sizes, install commands, whether servers and
routers are supported, whether 2FA is required, and what happens when KYC is rejected.

### Payouts

`payouts.html` is shared by both accounts (`data-account="auto"` follows the active account; switching in the
sidebar stays on the page). It is not in the design file, so it is built from the existing components.

- **Business values:** `assets/js/data/payouts.config.js` is the only file the client edits: minimum payout, fee
  (fixed or percent) and arrival time per method, crypto currencies and their networks.
- **Mock data and rules:** `assets/js/data/payouts.js` (money in cents, fees, masking, validation, seeds).
  State is in memory; a reload restores the scenario from `?state=`.
- **States:** `?state=default|no-methods|below-minimum|in-progress|empty-history`. The default history already
  holds Paid, Failed and Rejected rows. A Developer account is locked until its KYC is approved.
- **Demo control:** the "Demo · payouts" button (`pages/page-demo.js`) switches the account type and the state.
  The same control sits on the Referrals page. Remove its script tag from the page to hide it.
- **Dialogs:** `ui.modal` now traps Tab focus and has `update()` for multi-step dialogs, so every dialog in the
  prototype gets both.

### Referrals

`referrals.html` is for Personal accounts. Sidebar order: Overview, Download app, Referrals, Payouts, Settings.
A Developer account has no Referrals item; opening the route sends it to its own home page. It is not in the
design file, so it is built from the existing components.

- **Business values:** `assets/js/data/referrals.config.js` is the only file the client edits (reward percent and
  duration, qualification amount, attribution window, one-time bonus, milestones, share message, on/off flags).
  The "how it works" steps, the summary line, the rules, the sign-up banner and the status tooltips are
  generated from it.
- **Mock data and copy:** `assets/js/data/referrals.js`. The funnel is derived from the seeded rows, so the
  numbers in the table and the funnel always match.
- **States:** `?state=default|empty|early|qualified|reward-ended|not-counted|milestones-off|disabled`. The chosen
  state is kept in the prototype store, so the navigation, the Overview card and the sign-up screen follow it
  (for example "disabled" hides the Referrals item, the Overview card and the referral field).
- **Overview:** the "Invite friends" card shows the code, a Copy button, the total earned from referrals and a link
  to the page. It is hidden when referrals are off.
- **Sign-up:** `?ref=CODE` pre-fills the code and shows the applied state. The code is remembered for
  `attributionWindowDays` (Personal sign-up only).
- **Analytics:** `Cashful.track(name, props)` (`core/track.js`) only logs to the console. Events:
  `referral_link_copied`, `referral_code_copied`, `referral_message_copied`, `referral_share_clicked`,
  `referral_rules_opened`, `referral_row_expanded`, `referral_milestone_viewed`.
- **Rewards and payouts:** referral earnings are described as part of the Available balance. There is no
  separate withdrawal. The Payouts mock balance is independent of the Referrals mock numbers.

### Settings (Personal)

`settings.html` is for Personal accounts. The Developer account's Settings item is still a "coming later" toast.
It is not in the design file, so it is built from the existing components. Six stacked cards, and the ones
with a form save on their own: Profile, Security (password and two-factor), Notifications, Account type, Legal,
Delete account.

- **Business values:** `assets/js/data/settings.config.js` is the only file the client edits (support email,
  country editable, 2FA on/off, notification defaults and which are locked, legal links and accepted version,
  delete confirm word and rules).
- **Mock data and rules:** `assets/js/data/settings.js` (presets, password strength and validation, the
  placeholder 2FA QR). Profile, 2FA and notification values live in memory; a reload restores the preset.
- **Shared Payouts state:** the Payouts state now lives in the prototype store, so "Delete account" reads the
  same balance and the same payout in progress that the Payouts page shows. Opening Payouts with `?state=`
  starts that scenario afresh; without it the saved state continues.
- **Mock rules:** current password `wrong-password` fails; any 6 digits pass the 2FA check and `000000` fails.
  Passwords and codes are never logged or stored.
- **Account type:** "Create developer account" opens the same confirmation as the sidebar prompt, then the
  developer onboarding. "Switch to Developer" uses the account switcher state.
- **Presets:** `?state=default|profile-dirty|email-pending|password-error|password-success|2fa-setup|2fa-wrong-code|2fa-on|2fa-hidden|notifications-on|notifications-off|delete-blocked|delete-balance|delete-zero`.
  The demo control also switches between a login with and without a developer account.

## Not in the design yet

These show a "coming later" toast: Developer settings, Help center, SDK, Create app, SDK guide,
the agreement documents, and installer downloads.
