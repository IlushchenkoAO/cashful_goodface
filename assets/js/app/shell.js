/* App shell for signed-in pages.
   <body data-account="personal|developer"> … <aside class="cf-sidebar" data-sidebar data-active="overview"></aside>
   - guards the session and the account the page belongs to
   - renders the sidebar for that account
   - one account → a prompt to add the other one; both → the Personal | Developer switcher
   Exposes Cashful.app = { user, account }. */
(function () {
  var ui = Cashful.ui;
  var api = Cashful.api;
  var esc = ui.esc;

  var user = api.currentUser();
  if (!user) { location.replace('auth.html'); return; }

  var account = document.body.dataset.account;
  // Pages both accounts share (Payouts) use data-account="auto": they follow the active account
  var shared = account === 'auto';
  if (shared) { account = api.activeAccount(); document.body.dataset.account = account; }
  // A page of the other account type sends the person to the home of the account they are in:
  // Overview for Personal, Apps for Developer. The sidebar is not drawn, so nothing flashes.
  if (user.accounts.indexOf(account) < 0 || api.activeAccount() !== account) { location.replace(api.homeFor(user, api.activeAccount())); return; }

  // Referrals is a Personal-only page and can be switched off in referrals.config.js
  var referralsOn = !Cashful.referral || Cashful.referral.settings().enabled;

  var MENUS = {
    personal: [
      { id: 'overview', label: 'Overview', icon: 'home', href: 'dashboard.html' },
      { id: 'download', label: 'Download app', icon: 'download', href: 'download.html' },
      referralsOn ? { id: 'referrals', label: 'Referrals', icon: 'users', href: 'referrals.html' } : null,
      { id: 'payouts', label: 'Payouts', icon: 'wallet', href: 'payouts.html' },
      { id: 'settings', label: 'Settings', icon: 'settings', href: 'settings.html' }
    ].filter(Boolean),
    // Overview exists only for Personal accounts; a Developer starts on Analytics
    developer: [
      { id: 'analytics', label: 'Analytics', icon: 'chart', href: 'analytics.html' },
      { id: 'apps', label: 'Apps', icon: 'apps', href: 'apps.html', needsKyc: true },
      { id: 'sdk', label: 'SDK', icon: 'package', href: 'sdk.html' },
      { id: 'payouts', label: 'Payouts', icon: 'wallet', href: 'payouts.html', needsKyc: true },
      { id: 'settings', label: 'Settings', icon: 'settings', href: 'settings.html' }
    ]
  };

  var PROMPTS = {
    // shown to a personal-only login
    personal: { action: 'add-developer', icon: 'code', title: 'Become a developer', desc: 'Monetize your app with the SDK' },
    // shown to a developer-only login
    developer: { action: 'add-personal', icon: 'smartphone', title: 'Earn from your devices', desc: 'Add a personal account' }
  };

  function initials(name) {
    var parts = String(name || '').replace(/[^\p{L}\s.]/gu, ' ').split(/[\s.]+/).filter(Boolean);
    var s = parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] || '?').slice(0, 2);
    return s.toUpperCase();
  }

  /** The photo when there is one, otherwise the initials. */
  function avatarContent(u) {
    return u.avatar ? '<img src="' + esc(u.avatar) + '" alt="">' : esc(initials(u.name || u.email.split('@')[0]));
  }

  /** Re-reads the signed-in user (after Settings saved a new name or photo) and updates the user card. */
  function refreshUser() {
    user = api.currentUser();
    Cashful.app.user = user;
    ui.$$('.cf-usercard').forEach(function (card) {
      ui.$('.cf-usercard__name', card).textContent = user.name || user.email.split('@')[0];
      ui.$('[data-user-avatar]', card).innerHTML = avatarContent(user);
    });
  }

  /** Developer items that wait for verification: shown with a badge, and not clickable until it is approved. */
  function navItem(item, active) {
    if (item.needsKyc && account === 'developer' && !api.kyc.featuresUnlocked()) {
      var why = api.kyc.status() === 'in_review' ? 'in review' : 'complete KYC to unlock';
      return '<a class="cf-nav is-locked" href="#" data-nav-locked aria-disabled="true"' + (item.id === active ? ' aria-current="page"' : '') +
        ' aria-label="' + esc(item.label) + ', locked: ' + why + '" title="' + (api.kyc.status() === 'in_review' ? 'Unlocks when your verification is approved' : 'Complete verification to unlock') + '">' +
        '<cf-icon name="' + item.icon + '" size="20"></cf-icon><span class="cf-nav__label">' + esc(item.label) + '</span>' +
        '<span class="cf-nav__badge" aria-hidden="true"><cf-icon name="lock" size="12"></cf-icon>' + (api.kyc.status() === 'in_review' ? 'In review' : 'Needs KYC') + '</span></a>';
    }
    var cls = 'cf-nav' + (item.id === active ? ' is-active' : '');
    var attrs = item.href ? 'href="' + item.href + '"' : 'href="#" data-soon="' + esc(item.label) + '"';
    if (item.id === active) attrs += ' aria-current="page"';
    return '<a class="' + cls + '" ' + attrs + '><cf-icon name="' + item.icon + '" size="20"></cf-icon><span class="cf-nav__label">' + esc(item.label) + '</span></a>';
  }

  function switcher() {
    return '<div class="cf-switch" role="tablist" aria-label="Account">' +
      ['personal', 'developer'].map(function (k) {
        var on = k === account;
        return '<button type="button" role="tab" class="cf-switch__opt' + (on ? ' is-on' : '') + '" aria-selected="' + on + '" data-switch-account="' + k + '">' +
          (k === 'personal' ? 'Personal' : 'Developer') + '</button>';
      }).join('') + '</div>';
  }

  function prompt() {
    var p = PROMPTS[account];
    return '<a class="sb-prompt" href="#" data-account-action="' + p.action + '">' +
      '<span class="sb-prompt__icon"><cf-icon name="' + p.icon + '" size="18"></cf-icon></span>' +
      '<span class="sb-prompt__text"><span class="sb-prompt__title">' + p.title + '</span><span class="sb-prompt__desc">' + p.desc + '</span></span>' +
      '<span class="sb-prompt__chevron"><cf-icon name="chevron-right" size="16"></cf-icon></span></a>';
  }

  function renderSidebar(el) {
    var active = el.dataset.active;
    var name = user.name || user.email.split('@')[0];
    var home = api.homeFor(user, account);
    el.innerHTML =
      '<div class="cf-sidebar__logo"><a href="' + home + '" aria-label="Cashful — home"><cf-logo height="26"></cf-logo></a></div>' +
      (user.accounts.length > 1 ? switcher() : prompt()) +
      '<nav class="cf-sidebar__menu" aria-label="Main">' + MENUS[account].map(function (n) { return navItem(n, active); }).join('') + '</nav>' +
      '<div class="cf-sidebar__spacer"></div>' +
      '<div class="cf-usercard">' +
        '<span class="cf-avatar" data-user-avatar>' + avatarContent(user) + '</span>' +
        '<div class="cf-usercard__info"><div class="cf-usercard__name">' + esc(name) + '</div><div class="cf-usercard__email">' + esc(user.email) + '</div></div>' +
        '<button type="button" class="cf-usercard__logout" aria-label="Log out" title="Log out" data-logout><cf-icon name="log-out" size="20"></cf-icon></button>' +
      '</div>';
  }

  ui.$$('[data-sidebar]').forEach(renderSidebar);

  // Locked items do nothing when clicked, and the menu follows the verification status live
  ui.$$('[data-sidebar]').forEach(function (el) {
    el.addEventListener('click', function (e) { if (e.target.closest('[data-nav-locked]')) e.preventDefault(); });
  });
  if (account === 'developer') {
    api.kyc.onChange(function () {
      ui.$$('[data-sidebar]').forEach(function (el) {
        var menu = ui.$('.cf-sidebar__menu', el);
        if (menu) menu.innerHTML = MENUS[account].map(function (n) { return navItem(n, el.dataset.active); }).join('');
      });
    });
  }

  /* ---------- Adding the second account (BecomeDeveloper, PersonalAdded) ---------- */

  function feature(icon, title, desc) {
    return '<div class="feature"><span class="feature__icon"><cf-icon name="' + icon + '" size="20"></cf-icon></span>' +
      '<span class="feature__text"><span class="feature__title">' + esc(title) + '</span><span class="feature__desc">' + esc(desc) + '</span></span></div>';
  }

  function openBecomeDeveloper() {
    var m = ui.modal({
      title: 'Add a developer account',
      body:
        '<p class="cf-modal__desc">Monetize your app with the Cashful SDK. You keep one login and switch between accounts in the sidebar. Your personal earnings aren’t affected.</p>' +
        feature('file', 'Business details', 'Country, full address and company type.') +
        feature('edit', 'Agreements', 'Developer Agreement and end-user consent rules.') +
        feature('shield', 'Identity check', 'ID and a selfie, about 2 minutes.'),
      footer:
        '<button type="button" class="cf-btn cf-btn--secondary" data-close>Not now</button>' +
        '<button type="button" class="cf-btn cf-btn--primary" data-confirm><span>Continue</span><cf-icon name="arrow-right" size="20"></cf-icon></button>'
    });
    var confirm = m.el.querySelector('[data-confirm]');
    confirm.addEventListener('click', function () {
      ui.withLoading(confirm, function () {
        return api.addDeveloperAccount().then(function (res) { ui.go(res.redirect); });
      });
    });
  }

  document.addEventListener('click', function (e) {
    var action = e.target.closest('[data-account-action]');
    if (action) {
      e.preventDefault();
      if (action.dataset.accountAction === 'add-developer') openBecomeDeveloper();
      else api.addPersonalAccount().then(function (res) {
        Cashful.store.flash('personalAdded', true);
        ui.go(res.redirect);
      });
      return;
    }

    var sw = e.target.closest('[data-switch-account]');
    if (sw && sw.dataset.switchAccount !== account) {
      var home = api.switchAccount(sw.dataset.switchAccount);
      ui.go(shared ? location.href : home);
      return;
    }

    // Sections that aren't part of the prototype yet
    var soon = e.target.closest('[data-soon]');
    if (soon) {
      e.preventDefault();
      ui.toast(soon.dataset.soon + ' — coming in a later iteration', 'clock');
      return;
    }

    if (e.target.closest('[data-logout]')) {
      api.logOut().then(function () { ui.go('auth.html?state=logged-out'); });
    }
  });

  // Account email appears in install instructions and copy
  ui.$$('[data-user-email]').forEach(function (el) { el.textContent = user.email; });

  Cashful.app = { user: api.currentUser(), account: account, openBecomeDeveloper: openBecomeDeveloper, refreshUser: refreshUser, initials: initials };

  // Deep link for demos: ?modal=become-developer
  if (ui.params.get('modal') === 'become-developer' && user.accounts.length === 1 && account === 'personal') openBecomeDeveloper();
})();
