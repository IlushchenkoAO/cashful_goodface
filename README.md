# Cashful dashboard — HTML/CSS/JS prototype

A working prototype of `app.cashful.com`, ported from the design prototype (`cashful-prototype`).
Plain HTML, CSS and JavaScript: no framework, no build, no server. Open `index.html` by double-clicking it.

**Status:** iteration 3. All 42 screens from the design are ported: authentication, developer verification,
account switching, developer Analytics, and the Peer side (Overview and Download app).

## Open it

- `auth.html` is the start: one entry for log in and sign up (`index.html` forwards to it).
- `screens.html` is the screen map. Every screen from the design opens in the state it shows.
- The **Prototype** button in the bottom-right corner shows hints for the current screen, the Overview stage
  switcher, a link to the screen map and "Reset data".

## Prototype mode: any input works

`strictValidation: false` in `assets/js/core/config.js` (the default) means every field accepts anything,
empty fields included. Any email and password log in, and any code passes. That way every flow can be
clicked through without remembering demo data.

The error states (wrong password, locked, wrong code, bad referral code, expired link, rate limit, network error,
provider cancelled) still open from `screens.html` through `?demo=…`. A typed email that exists goes to “Welcome back”;
any other email starts sign-up.

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
| `auth.html` | 01 entry, 02 welcome back, 03 account type, 04 create account, unsupported country, 06 link a provider | one entry for log in and sign up (identifier-first), see below |
| `login.html`, `signup.html`, `signup-developer.html`, `index.html` | | only forward to `auth.html`, keeping the query |
| `verify-email.html` | 05 VerifyEmail, …Error, …Resent | 6-digit code (paste, auto-advance), 60 s resend timer, “Wrong email? Change” |
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

### Accounts, teams and roles

A **login is not an account.** Every login has exactly one **Personal** account (always, even when it signed up as a
developer) and any number of **Developer** accounts, owned or joined by invitation. Developer accounts are independent:
each has its own verification (KYC), apps, balance, payout methods and history, members.

- **Account menu** (sidebar, bottom): its button always shows the account in use (name and type). The list opens upward: who is signed in, Personal first,
  then the developer accounts; each shows its KYC badge (Not started, Pending, Verified, Rejected) and, when it is not
  yours, your role. A check marks the current one, then "Create developer account", then **User settings** and **Logout**.
  Switching opens Overview (Personal) or Analytics (Developer), and remembers the account for the next login.
- **Seeded accounts for the demo login:** Personal; **Acme Apps LLC** (Owner, Verified, 3 apps, a balance, an Admin, a
  Member and one pending invitation); **Side Project LLC** (Owner, KYC Pending, no apps, balance 0, locked);
  **Studio Nine Inc.** (you are a Member).
- **SDK rules:** every developer account starts with three rules and an "I agree / I understand" button: explicit opt-in for all users, opt-out at any time from the application, and the app and SDK removed from the device at uninstallation. It is the step before the password at sign-up, and a dialog in "Create developer account". It is shown every time.
- **Create developer account:** from the account menu, the same onboarding as a first sign-up. The first field is the account
  name; when the login already has a developer account, the person and address fields are prefilled with the hint
  "Prefilled from Acme Apps LLC. Each developer account is verified separately." Verification is done again per
  account. Afterwards the account is in the switcher with KYC Pending and opens locked.
- **Roles** (`Cashful.can(role, action)` in `assets/js/core/config.js`, one matrix): Owner, Admin, Member.

  | | Owner | Admin | Member |
  |---|---|---|---|
  | Analytics, apps, SDK download, create and submit apps | yes | yes | yes |
  | Referral | yes | yes | yes |
  | Payouts (request, methods) | yes | yes | no |
  | Settings → Members | yes | yes | no |
  | Edit company data, sign agreements, start verification | yes | yes | no |
  | Delete the developer account | yes | no | no |
  | Leave the account | no | yes | yes |

  Menu items a role can't use are hidden. A Member who opens such a URL sees "You don't have access to this page. Ask an
  account admin." (`data-requires="<action>"` on the page `<body>`).
- **Settings → Members** (Owner, Admin): a table (Name/Email, Role, Status, Added, actions) with the Owner first and not
  changeable or removable. Active members: Change role, Remove (confirmation). Pending invitations: Resend invite,
  Revoke invite, Open the invitation (prototype). "Invite member" takes an email and a role (Admin or Member, with what each
  can do) and checks: invalid email, already on the team, already invited. It adds a "Pending invite" row and shows the toast
  "Invitation sent". Invitations are valid for 7 days (`inviteValidDays`).
- **Invitation screens** (`invite.html?token=…`): "Join <account> on Cashful" with who invited you and your role. If the
  email has an account: Sign in, then "Accept invitation", then the account opens in the switcher (a 2FA step returns
  here). If it has none: sign up with the email prefilled and locked, a Personal account is created automatically, and the
  invited account opens. An expired, revoked or used invitation shows "This invitation is no longer valid". Demo links
  (made again on every open): `demo-new`, `demo-existing`, `demo-expired`.
- **Leave account** (Admin, Member; Settings → Leave account, with confirmation): the person loses access and lands on
  Personal. The only Admin cannot leave while the Owner is inactive: the button is disabled and says why.
- **Danger zone** (Owner only): Delete account is blocked while the balance is above 0 ("Withdraw your remaining balance of
  $X before deleting this account", link to Payouts); with a zero balance a dialog lists what goes (apps, members, SDK
  keys, payouts) and asks to type the account name. Personal and other accounts are not touched. Deleting the **Personal**
  account deletes the login: the dialog lists the owned developer accounts (deleted too) and the ones you are a member of
  (you are removed), and it is blocked while any owned account still holds a balance (they are listed).
- **Referrals** exist only for the Personal account. A Developer account has no Referrals item; opening the route sends it to Analytics.
- **Demo panel** (floating, prototype only; `page-demo.js`): your role in the current account, KYC status, balance
  (zero or more than zero), "Owner is inactive", and links to the invitation screens.

The chart data is taken 1:1 from the design (`assets/js/data/earnings.js`). The devices, alerts and
cards are in `assets/js/data/peer.js`.

Download buttons and the Developer menu items that have no page yet show a "coming later" toast. These
sections are not part of the design yet. Help center is not part of the MVP and has been removed.

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
    app/shell.js          session/account guard, sidebar, account switcher, role-based menu, "no access" screen
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

### Apps (Developer)

`apps.html` is the list and `app.html?id=<UUID>` the details (there is no router: these are the `/apps` and
`/apps/:id` routes). The whole area waits for an approved verification (`api.kyc.featuresUnlocked()`): the menu item shows "Needs KYC"
and a direct visit shows a locked page with the way to unlock it. A Personal account is sent to its Overview.

- **Shared store:** `assets/js/data/apps.js` keeps the apps in the prototype store. Analytics, SDK and the Apps
  pages all read apps and statuses from it (status ids: `draft`, `in_review`, `changes_requested`, `active`) and
  follow the `cashful:apps` event. Business values and texts: `assets/js/data/apps.config.js`.
- **Rules:** Draft and Changes requested are editable; In review and Active are read-only; only a Draft can be
  deleted. Draft → In review (submit), In review → Active or Changes requested (review), Changes requested → In review.
- **List URL:** `?status=&q=&sort=updated|name|status&page=&create=1`.
- **Review result (prototype):** the status badge of an app that is In review is a dropdown (in the list and on the app's
  page): Active, or Changes requested with a sample comment. An approved app gets mock traffic, so it appears in Analytics.
  "Approve all apps in review (Prototype)" under the list approves every app waiting for review.
- **Demo control:** "Apps data" (Default, No apps, Only Drafts, Only Active; `?data=`) next to "KYC status".
- **Components:** new `ui.timeline`, `Cashful.controls.fileDropzone`, `Cashful.apps.badge` (status badge); reused:
  segmented control, dropdown, modal, cards, table, `ui.copyText`, `ui.alertHtml`, `track()`.

**Platforms and IDs:** an app can run on several platforms (checkboxes in Create app and in the Draft). It gets an Application ID and an Application Release ID (one per app) as soon as it is created, shown with Copy buttons on its page and on the SDK page, and filled into the SDK snippets. Until the app is Active a note says: install the SDK with both IDs so telemetry can be collected; once approved, the installation becomes active and starts earning.

### Analytics (Developer)

`analytics.html` is read-only. Until the account is approved it shows an empty state that says why and how to verify. A Personal account that opens the route is sent
to its Overview. Developer navigation: Analytics, Apps, SDK, Payouts, Settings (no Overview: that exists only for Personal).

- **Business values and texts:** `assets/js/data/analytics.config.js` (default period, max custom range, page
  size, CSV and "Live" switches, metric definitions, the "not Active" hint, the empty-state copy).
- **Mock data:** `assets/js/data/apps.js` (3 Active apps on Android, iOS, and Windows plus macOS; one app each in
  Draft, In review and Changes requested; DeskSync became Active 21 days ago) and `assets/js/data/analytics.js`
  (deterministic traffic: a function of the app, platform and calendar day; 120+ days of history; today is partial).
- **URL state:** `?app=<id|all>&period=7d|30d|90d|custom&from=&to=&metric=nodes|ips|earnings&groupBy=day|app|platform&split=1`.
  Reload, Back and Forward restore the exact view; unknown or invalid values fall back to defaults.
- **Components:** `ui.statCard` (extended: info tooltip, "Live" badge, neutral delta; the Peer Overview uses it
  unchanged), `Cashful.charts.timeSeries` (`ds/charts.js`, a dependency-free SVG line chart),
  `Cashful.controls.segmented` and `.dropdown` (`ds/controls.js`), plus `.cf-skel` skeletons.
- **Demo control:** "Analytics data": Data, No apps, Apps but none Active, Active app no data yet, Empty period,
  Loading, Error (`?data=`). Error fails once and Retry recovers. "KYC status" next to it still works and the page
  looks the same in both.

### KYC (Developer)

The KYC state is one value on the developer account in the store, `dev.kycStatus`: `not_started`,
`in_review`, `changes_requested` or `approved`. Read and write it only through `api.kyc` (`status()`,
`approved()`, `set()`, `onChange()`); a change fires the `cashful:kyc` event, so open pages update without a reload.

- **Who reads it:** the alert (`app/kyc.js`), Analytics (wording of the Apps card), Payouts (the "Complete KYC"
  lock), the SDK page (download lock), the developer onboarding, and the demo control.
- **Alert:** while `in_review` it shows at the top of the Developer pages (Analytics, SDK, Payouts) with an X.
  In the prototype the X means "KYC passed": the alert leaves with a short transition, a toast says what is
  unlocked, and the SDK download and payouts unlock at once. `demo.kycAlertCloseApproves` and
  `demo.kycAlertCloseTooltip` are in `core/config.js`; with `kycAlertCloseApproves: false` there is no X.
- **Demo control:** "KYC status" (In review / Approved) on Analytics, SDK and Payouts. It works in both
  directions and is also how to reset the prototype for the next demo.
- **SDK page:** see the next section. Only its download buttons are locked.

### SDK (Developer)

`sdk.html` is open to every Developer, whatever the KYC status; a Personal account is sent to its Overview.
Only the "Download SDK" button is locked (and "Download template" when `consentTemplateRequiresKyc` is on). The lock
is `aria-disabled` (focusable, with its reason in `aria-describedby`) and reads `api.kyc.approved()` on every
render and on `api.kyc.onChange`, so the KYC alert's X and the demo control unlock it without a reload.

- **Business values and texts:** `assets/js/data/sdk.config.js`: platforms with version, release date,
  requirements and docs link, the steps, the per-platform snippets (placeholder pseudo-code with `{APP_UUID}`),
  the consent requirements and the page texts. Logic: `assets/js/data/sdk.js`.
- **URL state:** `?platform=android&app=<id>`; unknown or coming-soon platforms and unknown apps fall back to the
  defaults. Back and Forward restore the selection.
- **Components:** new `ui.codeBlock` (labelled, scrollable, Copy button), `ui.copyText`, `ui.downloadFile` and
  `.cf-btn[aria-disabled]`; reused: the segmented/dropdown controls, badges, cards, the shared mock apps and `track()`.
- **Demo control:** "SDK state" (Default, No apps, Apps but none Active, Selected app not Active; `?data=`) next
  to "KYC status", which updates the page at once.
- **Analytics events:** `sdk_platform_selected`, `sdk_download_clicked`, `sdk_download_blocked_clicked`,
  `sdk_snippet_copied`, `sdk_app_id_copied`, `sdk_consent_template_downloaded` (logged to the console by `track()`).

### Payouts

`payouts.html` is shared by both accounts (`data-account="auto"` follows the active account; switching in the
sidebar stays on the page). It is not in the design file, so it is built from the existing components.

- **Business values:** `assets/js/data/payouts.config.js` is the only file the client edits: minimum payout, fee
  (fixed or percent) and arrival time per method, crypto currencies and their networks.
- **Mock data and rules:** `assets/js/data/payouts.js` (money in cents, fees, masking, validation, seeds).
  State is in memory; a reload restores the scenario from `?state=`.
- **States:** `?state=default|full|no-methods|below-minimum|in-progress|empty-history|no-earnings`. **Default is empty:** the
  balance follows what was earned (a Personal account has money once a device is connected, a Developer once an app is
  Active), there are no payout methods and no history. The person adds a method by hand; the first withdrawal fills the
  history with a payout in every state (Requested, Processing, Paid, Failed, Rejected). `full` is the old set: three methods
  and history. A Personal account that is not verified yet sees a badge: identity verification is needed for the first
  withdrawal. A Developer account is locked until its KYC is approved. Each account type keeps its own payouts.
- **Demo control:** the "Demo · payouts" button (`pages/page-demo.js`) switches the account type and the state.
  The same control sits on the Referrals page. Remove its script tag from the page to hide it.
- **Dialogs:** `ui.modal` now traps Tab focus and has `update()` for multi-step dialogs, so every dialog in the
  prototype gets both.

### Referrals

`referrals.html` is for Personal accounts. Sidebar order: Overview, Download app, Referrals, Payouts, Settings.
A Developer account has no Referrals item; opening the route sends it to Analytics (the Developer landing page). It is not in the
design file, so it is built from the existing components.

- **Business values:** `assets/js/data/referrals.config.js` is the only file the client edits (reward percent and
  duration, qualification amount, attribution window, one-time bonus, milestones, share message, on/off flags).
  The "how it works" steps, the summary line, the rules, the sign-up banner and the status tooltips are
  generated from it.
- **Mock data and copy:** `assets/js/data/referrals.js`. The funnel is derived from the seeded rows, so the
  numbers in the table and the funnel always match.
- **States:** `?state=default|empty|no-devices|early|qualified|reward-ended|not-counted|milestones-off|disabled`
  (`no-devices` is "No devices, no referrals" and also puts Overview in its no-devices stage). The chosen
  state is kept in the prototype store, so the navigation, the Overview card and the sign-up screen follow it
  (for example "disabled" hides the Referrals item, the Overview card and the referral field).
- **Overview:** the "Invite friends" card shows the code, a Copy button, the total earned from referrals and a link
  to the page. It never depends on devices: with no devices it sits right below the "Connect your first device"
  block and shows $0.00. Only `referral.enabled: false` hides it. Nothing else in the dashboard (or the Referrals
  route) checks whether a device is connected.
- **Sign-up:** `?ref=CODE` pre-fills the code and shows the applied state. The code is remembered for
  `attributionWindowDays` (Personal sign-up only).
- **Analytics:** `Cashful.track(name, props)` (`core/track.js`) only logs to the console. Events:
  `referral_link_copied`, `referral_code_copied`, `referral_message_copied`, `referral_share_clicked`,
  `referral_rules_opened`, `referral_row_expanded`, `referral_milestone_viewed`.
- **Rewards and payouts:** referral earnings are described as part of the Available balance. There is no
  separate withdrawal. The Payouts mock balance is independent of the Referrals mock numbers.

### Billing information and SMS on payout

- **Billing information** (Personal and each Developer account; Owner and Admin): name or company, country, address and an optional Tax ID, asked once before the first payout. It has its own card in Settings; requesting a payout opens the same dialog when it is empty.
- **SMS code on payout:** after the amount is confirmed, a 6-digit code is texted to the phone in the profile (asked for first when there is none). Prototype: any 6 digits work; in strict mode the code is `demo.smsCode` in `config.js`.
- **"User settings"** in the account menu (bottom of the sidebar) opens the Profile section of Settings.

### Settings (Personal)

Both account types share the layout: a sticky "Settings sections" navigation in two groups, **Account settings** (the account in use) and
**User settings** (the person, the same in every account), and a small heading above the first card of each group.
Personal: Account settings = Verification, Billing information; User settings = Profile, Security, Notifications, Legal, Delete account.

`settings.html` serves both account types (`data-account="auto"`): Personal sees the stack below, Developer sees
the Developer Settings described in the next section. It is not in the design file, so it is built from the existing components. Six stacked cards, and the ones
with a form save on their own: Profile, Security (password and two-factor), Verification, Notifications, Legal,
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
- **No profile photo:** the avatar is the initials. There is nothing to upload.
- **Phone number:** a field in the profile. It is where the SMS code for a payout is sent.
- **No Account type card:** a developer account is added from the account switcher ("Create developer account").
- **Presets:** `?state=default|profile-dirty|email-pending|password-error|password-success|2fa-setup|2fa-wrong-code|2fa-on|2fa-hidden|verification-none|verification-review|verification-done|notifications-on|notifications-off|delete-blocked|delete-balance|delete-zero`.

### Settings (Developer)

Same route, `settings.html`. Cards in this order, each with an anchor (`#verification`, `#business`,
`#agreements`, `#members` (Owner, Admin), `#profile`, `#security`, `#notifications`, `#leave` (Admin, Member), `#danger` (Owner)), a sticky
"Settings sections" navigation with scroll-spy, and a URL hash that scrolls to the section and focuses its heading.
Each form saves on its own (Save stays disabled until something changes, then an inline "saved" message).

- **Verification:** status badge (with text), four stages each marked in words, "What this unlocks:", and the
  action for the status (Start verification, Update information with the reviewer's comment, nothing when in
  review or approved). `/kyc` is `kyc.html`, a placeholder for the provider.
- **Business details:** editable only in Not started and Changes requested; read-only (contact support) in
  In review and Approved. The apps and installs numbers must be whole numbers, 0 or more.
- **Agreements:** the Developer Agreement is signed in a dialog (checkbox + full name of 2+ characters; the
  name is stored, never logged). Terms, Privacy and AUP show their accepted date and a link.
- **Profile, Security, Notifications:** the Personal components. Name, phone, pending email and 2FA are stored
  on the login and shared with Personal. Notifications use the Developer set (stored per account type);
  there is no Country field.
- **Members, Leave account, Danger zone:** see "Accounts, teams and roles". A Member sees Verification, Business details and
  Agreements read-only.
- **Config:** `assets/js/data/developer-settings.config.js` (support email, what KYC unlocks, locked business
  statuses, agreements, notifications, alert texts, `agreementsBlockFeatures`).
- **`featuresUnlocked`:** `api.kyc.featuresUnlocked()` = KYC approved and (flag off, or Developer Agreement
  signed). The SDK download and the Payout requests read it; `api.kyc.lockReason()` picks the hint, which links
  to `#agreements` or `#verification`.
- **Demo control (Settings, Developer):** role, balance, KYC status (Not started, In progress, Pending, Changes requested, Rejected,
  Verified), Developer Agreement (Unsigned, Signed).
- **Events:** `settings_anchor_clicked`, `kyc_start_clicked`, `kyc_update_info_clicked`, `business_details_saved`,
  `agreement_viewed`, `agreement_signed`, `account_switch_clicked`, `member_invited`, `member_invite_resent`, `member_invite_revoked`, `member_role_changed`, `member_removed`, `account_left`, `developer_account_deleted`.

### Log in or sign up (identifier-first)

`auth.html` is the only entry. The person gives an email or uses Google, GitHub or Apple, and the server decides:

- **Existing email** → 02 Welcome back (password, “Forgot password?”, “Email me a login link instead”). A provider that is
  already linked skips this screen. 2FA still applies.
- **Existing email, a provider not linked yet** → 06 “You already have an account”: log in once, the provider is linked.
- **New email** → 03 “How do you want to earn?” (only when there is no `?type`) → 04 Create account (password is skipped for
  providers) → 05 Verify email (skipped for providers) → dashboard. A country outside the US and EU gets its own screen.
- **`?type=peer|developer`** comes from a site CTA, is kept through the whole flow (and on the forgot-password pages),
  and only a new user is ever asked for a type. A log in never asks: it opens the last used profile, and with a Developer CTA
  a Personal login gets the Developer account added and opened (no new account).
- **Security:** the lookup takes the same time for a known and an unknown email, is rate limited (`rules.lookupsPerMinute`),
  and the messages are neutral.
- **Mock identities:** Google is the Personal demo (already linked), GitHub is the Developer demo (not linked, so it asks to link),
  Apple is a new account. `api.identify`, `api.social`, `api.sendLoginLink`, `api.applyIntent` are in `assets/js/core/api.js`.
- **States for the screen map:** `?demo=wrong-password | locked | link | link-sent | type | create | unsupported | sso-cancelled | network | rate-limit | ref-error`.

### Developer sign-up: details, KYC now or later

A new developer (after the email code, right after a provider sign-up, or when a Personal login adds a Developer
account) lands in `developer-verification.html` and gives the required details: legal form (company or independent
developer), country, full address, name, **number of apps** and **number of installations** (whole numbers). Then they sign the
Developer Agreement and meet the KYC step. The answers are saved as `dev.business`, the same record Settings → Business
details edits, and the signature shows in Settings → Agreements.

- **Verify now** → the status is In review and the dashboard says so (banner, empty Analytics, "In review" in the menu).
- **Complete verification later** → status Not started ("In progress" once details are saved). Then:
  - **Analytics** shows an empty state with the way to verify.
  - **Apps** and **Payouts** carry a "Needs KYC" badge in the menu and cannot be clicked. Opening them by URL shows a locked page.
  - **SDK** can be opened and read. The download (and "Submit for review") is locked, with the reason.
  - A **reminder** (bottom-right, with what is left) appears on every Developer page until verified. Its X hides it for the
    browser session so it does not nag; it comes back in a new session.
- **Finishing later:** Settings → Verification → **Start verification** opens the Verification page (`kyc.html`). The
  prototype passes the check with **Complete verification**: the status becomes Approved and everything opens.
- **SDK page:** App ID and Integration steps are one section. The consent screen has colors: Light, Dark, Brand or Custom (four
  color pickers with hex fields), a contrast check (4.5 : 1, shown in words, not only color) and Reset. The downloaded template
  follows the chosen colors. The choice is kept in this browser only. Presets: `consent.themes` in `sdk.config.js`.

### Prototype: nothing is required

The prototype is sent to people who review it, so nothing blocks them. An empty field gets a sample value when its form is
sent (`ui.sampleFor`, with `data-sample` for the cases that need a particular value; `data-no-sample` leaves a field alone,
like a referral code). On the entry screen an empty email becomes a sample email. The developer sign-up details come filled with
sample values. Creating an app needs nothing, and neither do the link and the screenshot when sending it for review.

### Prototype: a new developer starts empty

A developer who signs up (or a Personal login that adds a Developer account) starts with **no apps**: the Apps list, Analytics
and the SDK page are empty. Payouts show zero until an app is Active. Add an app on the Apps page (after verification), open it,
(a Draft explains what to add first: integrate the SDK, then add the link and a screenshot of it). Sending an app goes back to the
list with a short notice. The badge of an app that is In review is a dropdown to pick the result; Active gives it mock traffic,
so it shows in Analytics. Changes requested shows the comments and a button to fix and resubmit (back to the list again).
Wherever the account itself is in review, a small "Approve (Prototype)" button skips the wait.
### Prototype: log in or sign up

The entry screen has a small switch at the bottom, "Prototype · show: Sign up | Log in". **Sign up** (the default): any email
creates a new account. **Log in**: any email is an existing account. Either way, leaving the email empty uses a sample. The same
switch is in the Prototype panel (with a third option, "by the email": a known email logs in, any other signs up) and in the
URL: `auth.html?entry=login|signup|auto`.

### Auth and onboarding brief

Added from the "Auth and onboarding" brief. The full flow and the screen list are in `flow.html`
(linked from `screens.html`).

- **Sign-up** (inside `auth.html`): Google, GitHub and Apple, and one consent box (Terms, AUP, Privacy). The country is not
  asked: the server reads it (here a mock, `?geo=Brazil` tries another one). A country outside the US and the EU stops a
  new sign-up with its own screen and "Notify me".
- **Two-factor authentication is asked only when logging in**, and only when the person turned it on in Settings → Security.
  Nothing inside the dashboard asks for it (payout methods included). Turning it off asks for a code from the authenticator app,
  or a backup code when the phone is lost, says what changes and emails the person.
- **Personal verification** (identity check) is needed only to withdraw. It is not part of sign-up; the first withdrawal
  explains it and sends to Settings → Verification (a Personal account has the same card and the same Verification page as a
  developer). `api.peerKyc`: not started, in review, verified.
- **Verification statuses:** Not started, In progress, In review, Changes requested (the brief's "Action required"),
  Rejected (reason, next step, support) and Approved. The demo control sets all of them.
- **Settings:** "Connected sign-in providers" (Google, GitHub, Apple) in Security, for both account types.

## Not in the design yet

These show a "coming later" toast: Create app (design pending), the legal documents' pages,
and installer downloads.
