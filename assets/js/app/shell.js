/* App shell for signed-in pages.
   <body data-account="personal|developer|auto" [data-requires="payouts"]> … <aside class="cf-sidebar" data-sidebar data-active="overview"></aside>
   - guards the session and the account the page belongs to
   - renders the sidebar: the menu for the account in use (and the person's role in it), and at the bottom the account menu:
     the account in use is always visible on its button; the list holds the accounts, "Create developer account",
     User settings and Logout
   - a page that needs a permission the person's role doesn't have (data-requires, see Cashful.can) shows "no access" instead
   Exposes Cashful.app = { user, account, org, role, accountKey, accountName, can }. */
(function () {
  var ui = Cashful.ui;
  var api = Cashful.api;
  var esc = ui.esc;

  var user = api.currentUser();
  if (!user) { location.replace('auth.html'); return; }

  var account = document.body.dataset.account;
  // Pages both account types share (Payouts, Referrals, Settings…) use data-account="auto": they follow the account in use
  var shared = account === 'auto';
  if (shared) { account = api.activeAccount(); document.body.dataset.account = account; }
  // A page of the other kind sends the person to the home of the account they are in:
  // Overview for Personal, Analytics for a Developer account. The sidebar is not drawn, so nothing flashes.
  if (user.accounts.indexOf(account) < 0 || api.activeAccount() !== account) { location.replace(api.homeFor(user, api.activeAccount())); return; }

  var org = account === 'developer' ? api.activeOrg() : null;
  var role = account === 'developer' ? api.role() : null;
  var accountName = org ? org.name : 'Personal';
  var accountKey = org ? org.id : 'personal';
  function can(action) { return Cashful.can(role, action); }

  // Referrals can be switched off in referrals.config.js
  var referralsOn = !Cashful.referral || Cashful.referral.settings().enabled;

  /* What each account's menu holds. `can`: the permission it needs; without it the item is hidden, not disabled. */
  var MENUS = {
    personal: [
      { id: 'overview', label: 'Overview', icon: 'home', href: 'dashboard.html' },
      { id: 'download', label: 'Download app', icon: 'download', href: 'download.html' },
      referralsOn ? { id: 'referrals', label: 'Referrals', icon: 'users', href: 'referrals.html' } : null,
      { id: 'payouts', label: 'Payouts', icon: 'wallet', href: 'payouts.html' },
      { id: 'settings', label: 'Settings', icon: 'settings', href: 'settings.html' }
    ].filter(Boolean),
    // Overview exists only for Personal accounts; a Developer account starts on Analytics
    developer: [
      { id: 'analytics', label: 'Analytics', icon: 'chart', href: 'analytics.html', can: 'analytics' },
      { id: 'apps', label: 'Apps', icon: 'apps', href: 'apps.html', needsKyc: true, can: 'apps.view' },
      { id: 'sdk', label: 'SDK', icon: 'package', href: 'sdk.html', can: 'sdk' },
      { id: 'payouts', label: 'Payouts', icon: 'wallet', href: 'payouts.html', needsKyc: true, can: 'payouts' },
      { id: 'settings', label: 'Settings', icon: 'settings', href: 'settings.html' }
    ].filter(Boolean)
  };
  function menuFor(acc) { return MENUS[acc].filter(function (n) { return !n.can || can(n.can); }); }

  function initials(name) {
    var parts = String(name || '').replace(/[^\p{L}\s.]/gu, ' ').split(/[\s.]+/).filter(Boolean);
    var s = parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] || '?').slice(0, 2);
    return s.toUpperCase();
  }

  function avatarContent(u) {
    return esc(initials(u.name || u.email.split('@')[0]));
  }

  /** Re-reads the signed-in user (after User settings saved a new name) and updates the account menu. */
  function refreshUser() {
    user = api.currentUser();
    Cashful.app.user = user;
    ui.$$('[data-user-name]').forEach(function (el) { el.textContent = user.name || user.email.split('@')[0]; });
  }

  /** Developer items that wait for verification: shown with a badge, and not clickable until it is verified. */
  function navItem(item, active) {
    if (item.needsKyc && account === 'developer' && !api.kyc.featuresUnlocked()) {
      var pending = api.kyc.status() === 'in_review';
      var why = pending ? 'pending verification' : 'complete KYC to unlock';
      return '<a class="cf-nav is-locked" href="#" data-nav-locked aria-disabled="true"' + (item.id === active ? ' aria-current="page"' : '') +
        ' aria-label="' + esc(item.label) + ', locked: ' + why + '" title="' + (pending ? 'Unlocks when your verification is complete' : 'Complete verification to unlock') + '">' +
        '<cf-icon name="' + item.icon + '" size="20"></cf-icon><span class="cf-nav__label">' + esc(item.label) + '</span>' +
        '<span class="cf-nav__badge" aria-hidden="true"><cf-icon name="lock" size="12"></cf-icon>' + (pending ? 'Pending' : 'Needs KYC') + '</span></a>';
    }
    var cls = 'cf-nav' + (item.id === active ? ' is-active' : '');
    var attrs = item.href ? 'href="' + item.href + '"' : 'href="#" data-soon="' + esc(item.label) + '"';
    if (item.id === active) attrs += ' aria-current="page"';
    return '<a class="' + cls + '" ' + attrs + '><cf-icon name="' + item.icon + '" size="20"></cf-icon><span class="cf-nav__label">' + esc(item.label) + '</span></a>';
  }

  /* ---------- Account menu ----------
     At the bottom of the sidebar. Its button always shows the account in use (name and type). The list opens upward: who is
     signed in, the accounts (Personal first, then the Developer accounts with their KYC status and, when it isn't Owner, the
     role; a check on the current one), "+ Create developer account", then User settings and Logout. */

  var KYC_TONE = { approved: 'success', in_review: 'warning', not_started: 'neutral', changes_requested: 'error', rejected: 'error' };

  function accountTile(name, personal) {
    return '<span class="acct__tile' + (personal ? ' is-personal' : '') + '" aria-hidden="true">' + (personal ? '<cf-icon name="user" size="16"></cf-icon>' : esc(initials(name))) + '</span>';
  }

  function switcher() {
    var list = api.accounts();
    var cur = account === 'developer' ? accountKey : 'personal';
    var typeText = account === 'developer' ? 'Developer' + (role && role !== 'owner' ? ' · ' + Cashful.ROLE_LABELS[role] : '') : 'Personal account';
    var name = user.name || user.email.split('@')[0];
    return '<div class="acct acct--bottom" data-acct>' +
      '<button type="button" class="acct__btn" aria-haspopup="menu" aria-expanded="false" aria-controls="acct-menu" data-acct-toggle>' +
        accountTile(accountName, account === 'personal') +
        '<span class="acct__text"><span class="acct__name">' + esc(accountName) + '</span><span class="acct__type">' + esc(typeText) + '</span></span>' +
        '<cf-icon name="chevron-up" size="16"></cf-icon></button>' +
      '<div class="acct__menu" id="acct-menu" role="menu" aria-label="Accounts" hidden>' +
        '<div class="acct__who"><span class="acct__who-name" data-user-name>' + esc(name) + '</span><span class="acct__who-email">' + esc(user.email) + '</span></div>' +
        '<div class="acct__sep" role="separator"></div>' +
        list.map(function (a) {
          var on = a.id === cur;
          var meta = a.type === 'personal' ? '<span class="acct__sub">Personal</span>' :
            '<span class="acct__sub"><span class="cf-badge cf-badge--' + (KYC_TONE[a.kycStatus] || 'neutral') + '"><span class="cf-badge__dot"></span>' + esc(api.kyc.LABELS[a.kycStatus] || a.kycStatus) + '</span>' +
            (a.role !== 'owner' ? '<span class="acct__role">' + esc(Cashful.ROLE_LABELS[a.role]) + '</span>' : '') + '</span>';
          return '<button type="button" class="acct__item' + (on ? ' is-on' : '') + '" role="menuitemradio" aria-checked="' + on + '" data-acct-switch="' + esc(a.type) + '" data-org="' + esc(a.type === 'developer' ? a.id : '') + '">' +
            accountTile(a.name, a.type === 'personal') + '<span class="acct__text"><span class="acct__name">' + esc(a.name) + '</span>' + meta + '</span>' +
            (on ? '<cf-icon name="check" size="16"></cf-icon>' : '') + '</button>';
        }).join('') +
        '<button type="button" class="acct__item acct__item--create" role="menuitem" data-acct-create><cf-icon name="plus" size="16"></cf-icon><span>Create developer account</span></button>' +
        '<div class="acct__sep" role="separator"></div>' +
        '<a class="acct__item acct__item--plain" role="menuitem" href="settings.html#profile"><cf-icon name="settings" size="16"></cf-icon><span>User settings</span></a>' +
        '<button type="button" class="acct__item acct__item--logout" role="menuitem" data-logout><cf-icon name="log-out" size="16"></cf-icon><span>Logout</span></button>' +
      '</div></div>';
  }

  function renderSidebar(el) {
    var active = el.dataset.active;
    var home = api.homeFor(user, account);
    el.innerHTML =
      '<div class="cf-sidebar__logo"><a href="' + home + '" aria-label="Cashful — home"><cf-logo height="26"></cf-logo></a></div>' +
      '<nav class="cf-sidebar__menu" aria-label="Main">' + menuFor(account).map(function (n) { return navItem(n, active); }).join('') + '</nav>' +
      '<div class="cf-sidebar__spacer"></div>' +
      switcher();
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
        if (menu) menu.innerHTML = menuFor(account).map(function (n) { return navItem(n, el.dataset.active); }).join('');
        var sw = ui.$('[data-acct]', el);
        if (sw) { var open = !ui.$('.acct__menu', sw).hidden; sw.outerHTML = switcher(); if (open) toggleMenu(ui.$('[data-acct]', el), true); }
      });
    });
  }

  /* ---------- The switcher's behaviour ---------- */

  function toggleMenu(root, open) {
    var btn = ui.$('[data-acct-toggle]', root), menu = ui.$('.acct__menu', root);
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) { var first = ui.$('.acct__item.is-on', menu) || ui.$('.acct__item', menu); if (first) first.focus(); }
  }

  /** "+ Create developer account": a new account, opened in the onboarding (its details prefilled from another of the person's accounts). */
  function createDeveloperAccount() {
    // The SDK rules are agreed to every time a developer account is created
    var m = ui.modal({
      title: 'Before you create a developer account',
      width: 560,
      body: '<p class="cf-modal__desc">Cashful only works with apps that respect their users. Agree to these three SDK rules to continue.</p>' + ui.sdkRulesHtml(),
      footer: '<button type="button" class="cf-btn cf-btn--secondary" data-close>Cancel</button>' +
        '<button type="button" class="cf-btn cf-btn--primary" data-confirm>I agree / I understand</button>'
    });
    var agree = m.el.querySelector('[data-confirm]');
    agree.addEventListener('click', function () {
      ui.withLoading(agree, function () { return api.createDevAccount().then(function (res) { ui.go(res.redirect); }); });
    });
  }

  // Kept for the demo deep link (?modal=become-developer): the same thing with a short explanation first
  function feature(icon, title, desc) {
    return '<div class="feature"><span class="feature__icon"><cf-icon name="' + icon + '" size="20"></cf-icon></span>' +
      '<span class="feature__text"><span class="feature__title">' + esc(title) + '</span><span class="feature__desc">' + esc(desc) + '</span></span></div>';
  }
  function openBecomeDeveloper() {
    var m = ui.modal({
      title: 'Create a developer account',
      body:
        '<p class="cf-modal__desc">Monetize your app with the Cashful SDK. You keep one login and switch between accounts in the sidebar. Each developer account has its own verification, apps, payouts and team.</p>' +
        feature('file', 'Business details', 'Country, full address and company type.') +
        feature('edit', 'Agreements', 'Developer Agreement and end-user consent rules.') +
        feature('shield', 'Identity check', 'ID and a selfie, about 2 minutes.'),
      footer:
        '<button type="button" class="cf-btn cf-btn--secondary" data-close>Not now</button>' +
        '<button type="button" class="cf-btn cf-btn--primary" data-confirm><span>Continue</span><cf-icon name="arrow-right" size="20"></cf-icon></button>'
    });
    var confirm = m.el.querySelector('[data-confirm]');
    confirm.addEventListener('click', function () { m.close(); createDeveloperAccount(); });
  }

  document.addEventListener('click', function (e) {
    var toggle = e.target.closest('[data-acct-toggle]');
    if (toggle) {
      var root = toggle.closest('[data-acct]');
      toggleMenu(root, ui.$('.acct__menu', root).hidden);
      return;
    }
    var item = e.target.closest('[data-acct-switch]');
    if (item) {
      var cur = account === 'developer' ? accountKey : 'personal';
      var target = item.dataset.acctSwitch === 'personal' ? 'personal' : item.dataset.org;
      if (target === cur) { toggleMenu(item.closest('[data-acct]'), false); return; }
      // The start screen of the account chosen: Overview for Personal, Analytics for a Developer account
      ui.go(api.switchAccount(item.dataset.acctSwitch, item.dataset.org));
      return;
    }
    var create = e.target.closest('[data-acct-create]');
    if (create) { createDeveloperAccount(); return; }
    // A click anywhere else closes the list
    ui.$$('[data-acct]').forEach(function (r) { if (!ui.$('.acct__menu', r).hidden) toggleMenu(r, false); });

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

  // Keyboard: Esc closes (and returns to the button), arrows move through the list
  document.addEventListener('keydown', function (e) {
    var root = e.target.closest && e.target.closest('[data-acct]');
    if (!root) return;
    var menu = ui.$('.acct__menu', root);
    if (menu.hidden) { if (e.key === 'ArrowDown' && e.target.closest('[data-acct-toggle]')) { e.preventDefault(); toggleMenu(root, true); } return; }
    if (e.key === 'Escape') { toggleMenu(root, false); ui.$('[data-acct-toggle]', root).focus(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      var items = ui.$$('.acct__item', menu);
      var i = items.indexOf(document.activeElement);
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
    }
  });

  // Account email appears in install instructions and copy
  ui.$$('[data-user-email]').forEach(function (el) { el.textContent = user.email; });

  /* ---------- No access ----------
     A page that needs a permission this role doesn't have shows this instead. The page's own script does not run
     (Cashful.app stays unset, and every page script starts with `if (!Cashful.app) return;`). */
  var need = document.body.dataset.requires;
  if (need && account === 'developer' && !can(need)) {
    var content = ui.$('.cf-shell__content');
    if (content) {
      content.innerHTML = '<section class="cf-card" aria-labelledby="noaccess-title"><div class="cf-empty"><span class="cf-tile__chip"><cf-icon name="lock" size="24"></cf-icon></span>' +
        '<h1 class="cf-empty__title" id="noaccess-title" tabindex="-1">You don’t have access to this page</h1>' +
        '<p class="cf-empty__desc">Ask an account admin.</p>' +
        '<a class="cf-btn cf-btn--secondary" href="analytics.html">Go to Analytics</a></div></section>';
      var h = ui.$('#noaccess-title', content); if (h) h.focus();
    }
    return;
  }

  Cashful.app = {
    user: api.currentUser(), account: account, org: org, role: role, accountKey: accountKey, accountName: accountName, can: can,
    openBecomeDeveloper: openBecomeDeveloper, refreshUser: refreshUser, initials: initials
  };

  // A message left by the previous page (account deleted, account left…)
  var shellToast = Cashful.store.takeFlash('shellToast');
  if (shellToast) ui.toast(shellToast);

  // Deep link for demos: ?modal=become-developer
  if (ui.params.get('modal') === 'become-developer') openBecomeDeveloper();
})();
