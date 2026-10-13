/* Mock backend. Every call is async with a short delay so loading states are visible.
   The shapes here are what the real API should return; swap the bodies for fetch() later.

   With config.strictValidation = false (default) any input is accepted: any password, any code,
   any email. Error responses only appear in strict mode or through the demo helpers. */
(function () {
  var store = Cashful.store;
  var cfg = Cashful.config;
  var R = cfg.rules;
  var MIN = 60 * 1000;
  var strict = !!cfg.strictValidation;
  var DEMO_EMAIL = cfg.seedUsers[0].email;

  function delay(value, ms) {
    return new Promise(function (resolve) { setTimeout(function () { resolve(value); }, ms || 550); });
  }
  function normEmail(e) { return String(e || '').trim().toLowerCase(); }
  function token() { return Math.random().toString(36).slice(2, 10); }

  /** The fields every Developer account starts with (KYC, onboarding answers). */
  function newDev() { return { kycStatus: 'not_started', started: false, step: 'type', kind: 'company', details: {}, apps: {} }; }

  /** A login. Everyone has a Personal account; Developer accounts are separate (orgs, below). */
  function newUser(email, type, extra) {
    return Object.assign({
      email: email,
      name: email.split('@')[0],
      accounts: ['personal'],
      verified: false,
      twoFactor: false,
      peerStage: 'new'   // a fresh Personal account has no devices yet
    }, extra);
  }

  /* ---------- Developer accounts ("orgs") ----------
     A user can own some and belong to others (Owner, Admin, Member). Each has its own KYC, apps, balance, payouts,
     team and referral link. db.session.account is 'personal' or 'developer'; with 'developer', db.session.orgId says which. */

  function orgsOf(db, email) {
    return Object.keys(db.orgs || {}).map(function (id) { return db.orgs[id]; })
      .filter(function (o) { return (o.members || []).some(function (m) { return m.email === email; }); })
      .sort(function (x, y) { return (x.order || 1e13) - (y.order || 1e13) || (x.createdAt || 0) - (y.createdAt || 0); });
  }
  function memberOf(org, email) {
    return org ? (org.members || []).filter(function (m) { return m.email === email; })[0] || null : null;
  }
  function activeOrg(db) { return db.session && db.session.orgId && db.orgs ? db.orgs[db.session.orgId] || null : null; }

  /**
   * Called by the store on every read: derives what is not stored. The accounts list of each user (Personal, plus
   * Developer when they belong to an org), and, for the signed-in user, `dev`: the Developer account they are looking at.
   * `dev` is not saved (it is not enumerable); changing it changes the org itself.
   */
  Cashful.bindDb = function (db) {
    if (!db || !db.users) return db;
    db.orgs = db.orgs || {};
    db.invites = db.invites || {};
    Object.keys(db.users).forEach(function (email) {
      db.users[email].accounts = orgsOf(db, email).length ? ['personal', 'developer'] : ['personal'];
    });
    var s = db.session;
    var user = s && db.users[s.email];
    if (!user) return db;
    if (s.account === 'developer') {
      var orgs = orgsOf(db, s.email);
      var cur = orgs.filter(function (o) { return o.id === s.orgId; })[0] || orgs[0];
      if (cur) s.orgId = cur.id; else { s.account = 'personal'; s.orgId = null; }
    } else s.orgId = null;
    Object.defineProperty(user, 'dev', {
      configurable: true, enumerable: false,
      get: function () { return activeOrg(db) || undefined; },
      set: function (v) { if (db.session && db.session.orgId) db.orgs[db.session.orgId] = v; }
    });
    return db;
  };

  /** A new Developer account owned by `ownerEmail`. `o.from`: another of their accounts, whose person and address details are copied. */
  function createOrg(db, ownerEmail, o) {
    o = o || {};
    var owner = db.users[ownerEmail];
    var id = 'org-' + token();
    var ownerName = (owner && owner.name) || ownerEmail.split('@')[0];
    var org = Object.assign(newDev(), {
      id: id, name: o.name || 'New developer account', createdAt: Date.now(), appsSeed: 'none', appList: [], referralDefault: 'empty',
      members: [{ email: ownerEmail, name: ownerName, role: 'owner', addedAt: Date.now() }]
    });
    if (o.from) {
      var d = o.from.details || {}, keep = {};
      ['firstName', 'lastName', 'country', 'street', 'city', 'region', 'zip', 'website'].forEach(function (k) { if (d[k]) keep[k] = d[k]; });
      if (!keep.firstName && !keep.lastName) { var parts = ownerName.split(' '); keep.firstName = parts[0]; keep.lastName = parts.slice(1).join(' '); }
      org.details = keep;
      org.kind = o.from.kind || 'company';
      org.prefilledFrom = o.from.name;
    }
    db.orgs[id] = org;
    return org;
  }

  /** Adds a login. A Developer sign-up also gets a first Developer account, and opens in it. */
  function addUser(db, email, type, extra) {
    var u = db.users[email] = newUser(email, type, extra);
    if (type === 'developer') {
      var org = createOrg(db, email, { name: o_name(email, extra) });
      u.lastAccount = 'developer';
      u.lastOrgId = org.id;
    }
    return u;
  }
  function o_name(email, extra) { return ((extra && extra.name) || email.split('@')[0]) + '’s apps'; }

  /** The profile a login opens in: the one used last (and its Developer account), else Personal. */
  function lastAccount(user) {
    return user.lastAccount && user.accounts.indexOf(user.lastAccount) > -1 ? user.lastAccount : 'personal';
  }

  function homeFor(user, account) {
    account = account || lastAccount(user);
    return account === 'personal' ? 'dashboard.html' : 'analytics.html';
  }

  /** Where a developer starts: a brand-new account fills in the business details and meets the KYC step first. */
  function devEntry(db) {
    var org = activeOrg(db);
    return org && !org.started && org.kycStatus === 'not_started' ? 'developer-verification.html' : 'analytics.html';
  }

  function startSession(db, email, remember) {
    var user = db.users[email];
    var account = 'personal', orgId = null;
    if (user && user.lastAccount === 'developer') {
      var orgs = orgsOf(db, email);
      var o = orgs.filter(function (x) { return x.id === user.lastOrgId; })[0] || orgs[0];
      if (o) { account = 'developer'; orgId = o.id; }
    }
    db.session = { email: email, remember: !!remember, at: Date.now(), account: account, orgId: orgId };
    db.challenge = null;
  }

  function startPending(db, email, type) {
    db.pending = { email: email, type: type, codeSentAt: Date.now(), resendAt: Date.now() + R.resendCooldownSec * 1000 };
  }

  var api = { strict: strict };

  /* ---------- Session ---------- */

  api.currentUser = function () {
    var db = store.get();
    return db.session ? db.users[db.session.email] || null : null;
  };

  api.logOut = function () {
    store.update(function (db) { db.session = null; db.pending = null; db.challenge = null; });
    return delay(true, 250);
  };

  api.homeFor = homeFor;

  /* ---------- Sign up ---------- */

  /** Referrer for a code. In prototype mode every code is valid. */
  api.findReferral = function (code) {
    code = String(code || '').trim().toUpperCase();
    if (!code) return null;
    return cfg.referrals[code] || (strict ? null : { name: 'Jordan M.', initials: 'JM' });
  };

  /* ---------- Identifier-first entry ----------
     One entry for log in and sign up: the person gives an email (or uses a provider) and the server decides.
     The lookup always takes the same time, whatever the answer, and is rate limited. */

  var lookupLog = [];   // timestamps of recent lookups (in memory: a reload is a fresh start)

  /**
   * @returns {ok:true, exists, hasPassword, providers:[…]} | {ok:false, error:'rate_limited', retryIn} | {ok:false, error:'network'}
   * `opts.demo` forces 'rate-limit' or 'network' for the screen map.
   */
  api.identify = function (email, opts) {
    opts = opts || {};
    email = normEmail(email);
    return delay(null, 650).then(function () {   // the same wait for known and unknown emails
      if (opts.demo === 'network') return { ok: false, error: 'network' };
      var now = Date.now();
      lookupLog = lookupLog.filter(function (t) { return now - t < MIN; });
      if (opts.demo === 'rate-limit' || lookupLog.length >= R.lookupsPerMinute) {
        return { ok: false, error: 'rate_limited', retryIn: Math.max(5, Math.ceil((MIN - (now - (lookupLog[0] || now))) / 1000)) };
      }
      lookupLog.push(now);
      var u = store.get().users[email];
      // Prototype only: db.demo.entryMode decides what any typed email is, so log in can be shown as well as sign up.
      //   'signup' (default) every email is new; 'login' every email is an existing account; 'auto' a known email logs in
      //   and any other starts sign-up. Set with the switch on the entry screen, the Prototype panel, or ?entry=.
      var mode = (store.get().demo || {}).entryMode || 'signup';
      if (mode === 'login') return { ok: true, exists: true, hasPassword: true, providers: u && u.sso ? Object.keys(u.sso).filter(function (k) { return u.sso[k]; }) : [] };
      if (mode === 'signup') return { ok: true, exists: false, hasPassword: false, providers: [] };
      return {
        ok: true,
        exists: !!u,
        hasPassword: !!(u && (u.password || !strict)),
        providers: u && u.sso ? Object.keys(u.sso).filter(function (k) { return u.sso[k]; }) : []
      };
    });
  };

  /** The Prototype panel's switch for what an email on the entry screen is (see api.identify). */
  api.entryMode = function (mode) {
    if (mode) store.update(function (db) { db.demo = db.demo || {}; db.demo.entryMode = mode; });
    return (store.get().demo || {}).entryMode || 'signup';
  };

  /**
   * Creates the login. With `input.sso` (a provider name) it needs no password and no email check: it signs in.
   * @returns {ok:true, redirect} | {ok:false, field, error}
   */
  var PROVIDER_NAMES = { google: 'Google user', github: 'GitHub user', apple: 'Apple user' };
  api.signUp = function (input) {
    var email = normEmail(input.email) || (input.type === 'developer' ? 'new.dev@studio.dev' : 'new.user@example.com');
    var code = String(input.referral || '').trim();
    return delay().then(function () {
      if (strict && !input.sso && store.get().users[email]) return { ok: false, field: 'email', error: 'taken' };
      if (strict && code && !api.findReferral(code)) return { ok: false, field: 'referral', error: 'referral_not_found' };
      if (input.country && Cashful.config.eligibility.supported.indexOf(input.country) < 0) return { ok: false, field: 'country', error: 'unsupported_country' };
      if (input.sso) {
        return store.update(function (db) {
          var p = {}; p[input.sso] = true;
          if (!db.users[email]) addUser(db, email, input.type, {
            name: PROVIDER_NAMES[input.sso] || 'New user', verified: true, sso: p, referral: code ? code.toUpperCase() : null
          });
          if (input.country) db.users[email].country = input.country;
          startSession(db, email, true);
          return { ok: true, redirect: input.type === 'developer' ? devEntry(db) : 'dashboard.html' };
        });
      }
      store.update(function (db) {
        if (!db.users[email]) {
          addUser(db, email, input.type, { password: input.password, referral: code ? code.toUpperCase() : null });
          if (input.country) db.users[email].country = input.country;
        }
        startPending(db, email, input.type);
      });
      return { ok: true, redirect: 'verify-email.html' };
    });
  };

  /**
   * A provider (Google, GitHub, Apple) was picked. The mock identity behind each one is in SSO_IDENTITY.
   * @returns {status:'ok', redirect} | {status:'2fa'} | {status:'link_required', email, provider}
   *        | {status:'new', email, provider} | {status:'cancelled'} | {status:'network'}
   */
  var SSO_IDENTITY = { google: DEMO_EMAIL, github: 'dev@studio.dev', apple: 'apple.user@example.com' };
  api.social = function (provider, opts) {
    opts = opts || {};
    return delay(null, 700).then(function () {
      if (opts.demo === 'network') return { status: 'network' };
      if (opts.demo === 'sso-cancelled') return { status: 'cancelled', provider: provider };
      var email = SSO_IDENTITY[provider];
      return store.update(function (db) {
        var user = db.users[email];
        if (!user) return { status: 'new', email: email, provider: provider };
        // Google is already linked to the demo personal account
        var linked = (user.sso && user.sso[provider]) || (provider === 'google' && email === DEMO_EMAIL);
        if (!linked) return { status: 'link_required', email: email, provider: provider };
        if (user.twoFactor) {
          db.challenge = { email: email, remember: true, at: Date.now() };
          return { status: '2fa' };
        }
        startSession(db, email, true);
        return { status: 'ok', redirect: homeFor(user) };
      });
    });
  };

  /** "Email me a login link instead": always answers the same. `api.logInWithLink` stands in for opening it. */
  api.sendLoginLink = function () { return delay({ ok: true }, 650); };
  api.logInWithLink = function (email) {
    email = normEmail(email);
    return delay(null, 400).then(function () {
      return store.update(function (db) {
        var user = db.users[email];
        if (!user) return { status: 'invalid' };
        if (user.twoFactor) {
          db.challenge = { email: email, remember: false, at: Date.now() };
          return { status: '2fa' };
        }
        startSession(db, email, false);
        return { status: 'ok', redirect: homeFor(user) };
      });
    });
  };

  /**
   * After a log in with a CTA that carried ?type: a Developer CTA opens the Developer onboarding inside the same
   * login (no new account), a Personal CTA the Personal one. Resolves to a url, or null when there is nothing to do.
   */
  api.applyIntent = function (type) {
    var want = type === 'developer' ? 'developer' : type === 'personal' || type === 'peer' ? 'personal' : null;
    var user = api.currentUser();
    if (!want || !user) return Promise.resolve(null);
    if (want === 'personal' || user.accounts.indexOf('developer') > -1) return Promise.resolve(api.switchAccount(want));
    return api.createDevAccount().then(function (res) { return res.redirect; });
  };

  /* ---------- Email verification ---------- */

  api.getPending = function () { return store.get().pending; };

  api.verifyEmail = function (code) {
    return delay().then(function () {
      return store.update(function (db) {
        var p = db.pending;
        if (!p) return { ok: false, error: 'no_pending' };
        if (strict && Date.now() - p.codeSentAt > R.emailCodeTtlMin * MIN) return { ok: false, error: 'expired' };
        if (strict && code !== cfg.demo.emailCode) return { ok: false, error: 'wrong_code' };
        var user = db.users[p.email];
        user.verified = true;
        db.pending = null;
        startSession(db, user.email, false);
        return { ok: true, redirect: lastAccount(user) === 'developer' ? devEntry(db) : homeFor(user), justVerified: true };
      });
    });
  };

  api.resendCode = function () {
    return delay(null, 400).then(function () {
      return store.update(function (db) {
        if (!db.pending) return { ok: false };
        db.pending.codeSentAt = Date.now();
        db.pending.resendAt = Date.now() + R.resendCooldownSec * 1000;
        return { ok: true, pending: db.pending };
      });
    });
  };

  /** "Change email": drops the unverified account so the address can be used again. */
  api.cancelPending = function () {
    return store.update(function (db) {
      var p = db.pending;
      if (p && db.users[p.email] && !db.users[p.email].verified) delete db.users[p.email];
      db.pending = null;
      return p;
    });
  };

  /* ---------- Log in ---------- */

  api.lockState = function (email) {
    var a = store.get().attempts[normEmail(email)];
    return a && a.lockedUntil > Date.now() ? a.lockedUntil : null;
  };

  /**
   * @returns {status:'ok', redirect} | {status:'2fa'} | {status:'invalid', attemptsLeft} | {status:'locked', until}
   */
  api.logIn = function (input) {
    var email = normEmail(input.email) || DEMO_EMAIL;
    return delay().then(function () {
      return store.update(function (db) {
        var a = db.attempts[email] || (db.attempts[email] = { fails: 0, lockedUntil: 0 });
        if (a.lockedUntil > Date.now()) return { status: 'locked', until: a.lockedUntil };

        var user = db.users[email];
        if (!strict && !user) {
          // Prototype: an unknown email is a returning personal user (Login → Login2FA as in the design)
          user = addUser(db, email, 'personal', { verified: true, twoFactor: true, peerStage: 'active' });
        }
        // Same answer for unknown email and wrong password — never reveal which accounts exist.
        if (strict && (!user || user.password !== input.password)) {
          a.fails += 1;
          if (a.fails >= R.maxLoginAttempts) {
            a.fails = 0;
            a.lockedUntil = Date.now() + R.lockMinutes * MIN;
            return { status: 'locked', until: a.lockedUntil };
          }
          return { status: 'invalid', attemptsLeft: R.maxLoginAttempts - a.fails };
        }

        delete db.attempts[email];
        // "Log in and link Google": the password proves it is the same person, then the provider is linked
        if (input.link) user.sso = Object.assign({}, user.sso, (function () { var o = {}; o[input.link] = true; return o; })());
        if (!user.verified) {
          startPending(db, email, user.accounts[0]);
          return { status: 'ok', redirect: 'verify-email.html' };
        }
        if (user.twoFactor) {
          db.challenge = { email: email, remember: !!input.remember, at: Date.now() };
          return { status: '2fa' };
        }
        startSession(db, email, input.remember);
        return { status: 'ok', redirect: homeFor(user, null, { resume: true }) };
      });
    });
  };

  api.getChallenge = function () { return store.get().challenge; };

  /** Second step. `kind` is 'totp' (6 digits) or 'backup'. */
  api.verify2FA = function (code, kind, trustDevice) {
    return delay().then(function () {
      return store.update(function (db) {
        var c = db.challenge;
        if (!c) return { ok: false, error: 'no_challenge' };
        var expected = kind === 'backup' ? cfg.demo.backupCode : cfg.demo.totpCode;
        if (strict && String(code).trim().toUpperCase() !== expected) return { ok: false, error: 'wrong_code' };
        var user = db.users[c.email];
        user.trustedDevice = !!trustDevice;
        startSession(db, c.email, c.remember);
        return { ok: true, redirect: homeFor(user, null, { resume: true }) };
      });
    });
  };

  /* ---------- Password reset ---------- */

  /** Always succeeds (doesn't reveal accounts). `token` stands in for the email link. */
  api.requestReset = function (email) {
    email = normEmail(email) || DEMO_EMAIL;
    return delay().then(function () {
      return store.update(function (db) {
        if (strict && !db.users[email]) return { ok: true, token: null };
        var t = token();
        db.resetTokens[t] = { email: email, createdAt: Date.now(), used: false };
        return { ok: true, token: t };
      });
    });
  };

  /** @returns {email} for a usable token, otherwise null (expired, used or unknown). */
  api.checkResetToken = function (t) {
    if (t === 'expired') return null;
    if (t === 'demo') return { email: DEMO_EMAIL };
    var rec = store.get().resetTokens[t];
    if (!rec) return strict ? null : { email: DEMO_EMAIL };
    if (rec.used || Date.now() - rec.createdAt > R.resetLinkTtlMin * MIN) return null;
    return { email: rec.email };
  };

  api.resetPassword = function (t, password, logoutOthers) {
    return delay().then(function () {
      var rec = api.checkResetToken(t);
      if (!rec) return { ok: false, error: 'expired' };
      return store.update(function (db) {
        if (db.users[rec.email]) db.users[rec.email].password = password;
        if (db.resetTokens[t]) db.resetTokens[t].used = true;
        delete db.attempts[rec.email];
        if (logoutOthers && db.session && db.session.email === rec.email) db.session = null;
        return { ok: true, email: rec.email };
      });
    });
  };

  /* ---------- Handoff from the earn app ---------- */

  /** Exchanges a one-time token from the mobile app for a session. */
  api.handoff = function (t) {
    return delay(null, 1400).then(function () {
      if (!t || t === 'expired') return { ok: false, error: 'expired' };
      return store.update(function (db) {
        startSession(db, DEMO_EMAIL, false);
        return { ok: true, device: 'Pixel 8', redirect: 'dashboard.html' };
      });
    });
  };

  /* ---------- Peer dashboard ---------- */

  /** Stage of a personal account: 'new' → 'day1' → 'active' → 'payout'. */
  api.setPeerStage = function (stage) {
    store.update(function (db) {
      if (db.session && db.users[db.session.email]) db.users[db.session.email].peerStage = stage;
    });
  };

  /**
   * The web app has no "add" action — a device appears once it signs in.
   * The prototype simulates that sign-in a moment after the instructions are closed.
   */
  api.waitForFirstDevice = function () {
    return delay(null, 1800).then(function () {
      api.setPeerStage('day1');
      return { device: 'Pixel 8', network: 'Mobile data' };
    });
  };

  /* ---------- Accounts: one login, personal and/or developer ---------- */

  function withUser(fn) {
    return store.update(function (db) {
      var user = db.session && db.users[db.session.email];
      return user ? fn(user, db) : null;
    });
  }

  /** The kind of account the person is looking at right now: 'personal' or 'developer'. */
  api.activeAccount = function () {
    var db = store.get();
    return db.session && db.users[db.session.email] ? db.session.account : null;
  };
  /** The Developer account in use (an org), or null on the Personal account. */
  api.activeOrg = function () { return activeOrg(store.get()); };
  /** What data belongs to: 'personal', or the org's id. Payouts, referrals and apps are kept per this key. */
  api.accountKey = function () {
    var db = store.get();
    return db.session && db.session.account === 'developer' && db.session.orgId ? db.session.orgId : 'personal';
  };
  /** The signed-in person's role in the Developer account in use: 'owner' | 'admin' | 'member', or null on Personal. */
  api.role = function () {
    var db = store.get();
    var m = memberOf(activeOrg(db), db.session && db.session.email);
    return m ? m.role : null;
  };
  /** Can the signed-in person do this in the account in use? (see Cashful.can in config.js) */
  api.can = function (action) { return Cashful.can(api.role(), action); };

  /** Everything the switcher lists: Personal first, then every Developer account with the person's role and its KYC status. */
  api.accounts = function () {
    var db = store.get();
    var email = db.session && db.session.email;
    if (!email) return [];
    var list = [{ type: 'personal', id: 'personal', name: 'Personal', role: null, kycStatus: null }];
    orgsOf(db, email).forEach(function (o) {
      list.push({ type: 'developer', id: o.id, name: o.name, role: memberOf(o, email).role, kycStatus: o.kycStatus });
    });
    return list;
  };

  /** Switcher in the sidebar. @returns the URL to open (Overview for Personal, Analytics for a Developer account) */
  api.switchAccount = function (account, orgId) {
    return withUser(function (user, db) {
      if (account === 'personal') {
        db.session.account = 'personal'; db.session.orgId = null;
        user.lastAccount = 'personal';
        return homeFor(user, 'personal');
      }
      var orgs = orgsOf(db, user.email);
      var org = orgs.filter(function (o) { return o.id === orgId; })[0] || orgs.filter(function (o) { return o.id === user.lastOrgId; })[0] || orgs[0];
      if (!org) return null;
      db.session.account = 'developer'; db.session.orgId = org.id;
      user.lastAccount = 'developer'; user.lastOrgId = org.id;
      return homeFor(user, 'developer');
    });
  };

  /**
   * "+ Create developer account": a new account owned by the person, opened at once (in the onboarding). When they already
   * have one, their name, country and address are copied from it; each account is still verified separately.
   */
  api.createDevAccount = function () {
    return delay(null, 400).then(function () {
      return withUser(function (user, db) {
        var mine = orgsOf(db, user.email);
        var from = mine.filter(function (o) { return memberOf(o, user.email).role === 'owner' && o.details && Object.keys(o.details).length; })[0] || mine[0] || null;
        var org = createOrg(db, user.email, { from: from });
        db.session.account = 'developer'; db.session.orgId = org.id;
        user.lastAccount = 'developer'; user.lastOrgId = org.id;
        return { ok: true, redirect: 'developer-verification.html', orgId: org.id };
      });
    });
  };
  api.addDeveloperAccount = api.createDevAccount;

  /** Billing information (who gets paid, and where) of the account in use: Personal is kept on the login, a Developer account on the account. */
  api.billing = {
    get: function () {
      var db = store.get(), s = db.session;
      if (!s) return null;
      var holder = s.account === 'developer' && s.orgId ? db.orgs[s.orgId] : db.users[s.email];
      return (holder && holder.billing) || null;
    },
    save: function (data) {
      return store.update(function (db) {
        var s = db.session;
        var holder = s.account === 'developer' && s.orgId ? db.orgs[s.orgId] : db.users[s.email];
        if (holder) holder.billing = data;
        return data;
      });
    }
  };

  /** Merges fields into the Developer account in use (business details, signatures…). */
  api.updateDev = function (patch) {
    return withUser(function (user, db) {
      var org = activeOrg(db);
      if (!org) return null;
      Object.assign(org, patch);
      return org;
    });
  };

  /** Saves profile fields on the signed-in user (name, avatar as a data URL). `null` removes a field. */
  api.updateProfile = function (patch) {
    return withUser(function (user) {
      Object.keys(patch).forEach(function (k) {
        if (patch[k] == null) delete user[k]; else user[k] = patch[k];
      });
      return user;
    });
  };

  /* ---------- Developer verification ---------- */

  /** Saves a step's answers and moves on. Progress survives log out. */
  api.saveOnboarding = function (patch, nextStep) {
    return delay(null, 350).then(function () {
      return withUser(function (user) {
        var dev = user.dev;
        if (!dev) return null;
        Object.keys(patch || {}).forEach(function (k) {
          dev[k] = (typeof patch[k] === 'object' && patch[k] && !Array.isArray(patch[k]))
            ? Object.assign({}, dev[k], patch[k]) : patch[k];
        });
        dev.started = true;
        if (nextStep) dev.step = nextStep;
        return dev;
      });
    });
  };

  /** Identity check by the verification partner (simulated), then manual review. */
  api.submitKyc = function () {
    return delay(null, 1600).then(function () {
      return withUser(function (user) {
        if (!user.dev) return null;
        user.dev.kycStatus = 'in_review';
        user.dev.step = 'review';
        return user.dev;
      });
    });
  };

  /* ---------- KYC: the one place its state is read and written ----------
     Every locked element, the alert and the demo control use this. The value lives on the developer
     account in the store (dev.kycStatus); a change is announced with the "cashful:kyc" event so open
     pages update without a reload. */
  api.kyc = {
    /** What a status is called on screen. */
    LABELS: { not_started: 'Not started', in_review: 'Pending', changes_requested: 'Changes requested', rejected: 'Rejected', approved: 'Verified' },
    STATUSES: ['not_started', 'in_review', 'changes_requested', 'rejected', 'approved'],
    status: function () {
      var u = api.currentUser();
      return (u && u.dev && u.dev.kycStatus) || 'not_started';
    },
    approved: function () { return api.kyc.status() === 'approved'; },
    set: function (status) {
      withUser(function (user) {
        if (!user.dev) return;
        user.dev.kycStatus = status;
        if (status !== 'not_started') user.dev.step = 'review';
        // The date shown as "Verified on …"
        if (status === 'approved') user.dev.approvedAt = user.dev.approvedAt || Date.now(); else delete user.dev.approvedAt;
      });
      api.kyc.notify();
    },
    notify: function () { window.dispatchEvent(new CustomEvent('cashful:kyc', { detail: { status: api.kyc.status() } })); },

    /* The Developer Agreement: signing is stored with the typed name and the time. */
    signature: function (id) {
      var u = api.currentUser();
      return (u && u.dev && u.dev.signatures && u.dev.signatures[id || 'developer-agreement']) || null;
    },
    signed: function (id) { return !!api.kyc.signature(id); },
    sign: function (id, name) {
      withUser(function (user) {
        if (!user.dev) return;
        user.dev.signatures = user.dev.signatures || {};
        user.dev.signatures[id] = { name: name, at: Date.now() };
      });
      api.kyc.notify();
    },
    unsign: function (id) {
      withUser(function (user) { if (user.dev && user.dev.signatures) delete user.dev.signatures[id]; });
      api.kyc.notify();
    },
    /** What the locks read: KYC approved, and (when the config asks for it) the Developer Agreement signed. */
    featuresUnlocked: function () {
      var c = Cashful.developerSettingsConfig;
      var block = !!(c && c.agreementsBlockFeatures);
      return api.kyc.approved() && (!block || api.kyc.signed('developer-agreement'));
    },
    /** Why the locks are on: null (unlocked), 'agreement' (config asks for the signature) or 'kyc'. */
    lockReason: function () {
      if (api.kyc.featuresUnlocked()) return null;
      var c = Cashful.developerSettingsConfig;
      if (api.kyc.status() === 'rejected') return 'rejected';
      return c && c.agreementsBlockFeatures && !api.kyc.signed('developer-agreement') ? 'agreement' : 'kyc';
    },
    /** Calls fn(status) on every change, here or in another tab. Returns a function that stops listening. */
    onChange: function (fn) {
      function onEvent() { fn(api.kyc.status()); }
      window.addEventListener('cashful:kyc', onEvent);
      window.addEventListener('storage', onEvent);
      return function () {
        window.removeEventListener('cashful:kyc', onEvent);
        window.removeEventListener('storage', onEvent);
      };
    }
  };

  /* ---------- Identity verification (Personal) ----------
     Needed only to withdraw money, never at sign-up. It lives in Settings → Verification, like the developer's.
     Status: 'not_started' | 'in_review' | 'approved'. Payouts asks for it the first time a withdrawal is requested. */
  api.peerKyc = {
    STATUSES: ['not_started', 'in_review', 'approved'],
    status: function () { var u = api.currentUser(); return (u && u.peerKyc) || 'not_started'; },
    approved: function () { return api.peerKyc.status() === 'approved'; },
    set: function (status) {
      withUser(function (user) {
        user.peerKyc = status;
        if (status === 'approved') user.peerKycAt = Date.now(); else delete user.peerKycAt;
      });
      window.dispatchEvent(new CustomEvent('cashful:peer-kyc', { detail: { status: status } }));
    }
  };

  /* ---------- Team: members and invitations of a Developer account ----------
     Members live in org.members (the Owner first). An invitation is db.invites[token] until it is accepted, revoked or expires. */

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function inviteState(inv) {
    if (!inv || inv.status !== 'pending') return 'invalid';
    return Date.now() - inv.createdAt > Cashful.config.inviteValidDays * 864e5 ? 'invalid' : 'ok';
  }
  function ownerOf(org) { return (org.members || []).filter(function (m) { return m.role === 'owner'; })[0] || null; }
  function pendingInvites(db, orgId) {
    return Object.keys(db.invites || {}).map(function (k) { return db.invites[k]; })
      .filter(function (i) { return i.orgId === orgId && i.status === 'pending'; })
      .sort(function (x, y) { return y.createdAt - x.createdAt; });
  }

  api.team = {
    /** The members table: the Owner first, then the other members, then the pending invitations. */
    rows: function (orgId) {
      var db = store.get(), org = db.orgs[orgId];
      if (!org) return [];
      var members = (org.members || []).slice().sort(function (x, y) { return (y.role === 'owner') - (x.role === 'owner') || x.addedAt - y.addedAt; })
        .map(function (m) { return { kind: 'member', email: m.email, name: m.name, role: m.role, status: 'active', at: m.addedAt }; });
      var invites = pendingInvites(db, orgId).map(function (i) { return { kind: 'invite', token: i.token, email: i.email, name: '', role: i.role, status: 'pending', at: i.createdAt }; });
      return members.concat(invites);
    },
    /** @returns {ok:true, invite} | {ok:false, field:'email', error:'invalid'|'member'|'pending'} */
    invite: function (orgId, email, role) {
      email = normEmail(email);
      if (!EMAIL_RE.test(email)) return { ok: false, field: 'email', error: 'invalid' };
      return store.update(function (db) {
        var org = db.orgs[orgId];
        if (!org) return { ok: false, error: 'no_account' };
        if (memberOf(org, email)) return { ok: false, field: 'email', error: 'member' };
        if (pendingInvites(db, orgId).some(function (i) { return i.email === email; })) return { ok: false, field: 'email', error: 'pending' };
        var inv = { token: 'inv-' + token(), orgId: orgId, email: email, role: role === 'admin' ? 'admin' : 'member', invitedBy: db.session.email, createdAt: Date.now(), status: 'pending' };
        db.invites[inv.token] = inv;
        return { ok: true, invite: inv };
      });
    },
    /** A new invitation window, as if the email was sent again. */
    resend: function (tokenId) {
      return store.update(function (db) { var i = db.invites[tokenId]; if (!i || i.status !== 'pending') return false; i.createdAt = Date.now(); return true; });
    },
    revoke: function (tokenId) {
      return store.update(function (db) { var i = db.invites[tokenId]; if (!i || i.status !== 'pending') return false; i.status = 'revoked'; return true; });
    },
    /** The Owner's role never changes. */
    changeRole: function (orgId, email, role) {
      return store.update(function (db) {
        var m = memberOf(db.orgs[orgId], email);
        if (!m || m.role === 'owner' || (role !== 'admin' && role !== 'member')) return false;
        m.role = role;
        return true;
      });
    },
    /** The Owner cannot be removed. */
    remove: function (orgId, email) {
      return store.update(function (db) {
        var org = db.orgs[orgId], m = memberOf(org, email);
        if (!m || m.role === 'owner') return false;
        org.members = org.members.filter(function (x) { return x.email !== email; });
        return true;
      });
    },
    /** The only Admin cannot leave while the Owner is inactive: nobody would be left to run the account. */
    leaveBlock: function (orgId, email) {
      var db = store.get(), org = db.orgs[orgId], m = memberOf(org, email);
      if (!m) return 'not_member';
      if (m.role === 'owner') return 'owner';
      if (m.role === 'admin' && org.ownerInactive && (org.members || []).filter(function (x) { return x.role === 'admin'; }).length === 1) return 'last_admin';
      return null;
    },
    /** @returns {ok:true} | {ok:false, error:'owner'|'last_admin'} */
    leave: function (orgId) {
      var email = api.currentUser() && api.currentUser().email;
      var block = api.team.leaveBlock(orgId, email);
      if (block) return { ok: false, error: block };
      return store.update(function (db) {
        var org = db.orgs[orgId];
        org.members = org.members.filter(function (x) { return x.email !== email; });
        var user = db.users[email];
        if (db.session.orgId === orgId) { db.session.account = 'personal'; db.session.orgId = null; }
        if (user && user.lastOrgId === orgId) { user.lastAccount = 'personal'; delete user.lastOrgId; }
        return { ok: true };
      });
    },
    /** The demo panel's invite links: these invitations are made again every time, so the flows can be shown over and over. */
    ensureDemo: function (tokenId) {
      var DEMO = {
        'demo-new': { email: 'newcomer@example.com', role: 'member', age: 0 },
        'demo-existing': { email: 'dev@studio.dev', role: 'admin', age: 0 },
        'demo-expired': { email: 'late.joiner@example.com', role: 'member', age: 30 }
      };
      var d = DEMO[tokenId];
      if (!d) return false;
      store.update(function (db) {
        var org = db.orgs.acme;
        if (!org) return;
        org.members = (org.members || []).filter(function (m) { return m.email !== d.email; });
        if (tokenId === 'demo-new') delete db.users[d.email];
        db.invites[tokenId] = { token: tokenId, orgId: 'acme', email: d.email, role: d.role, invitedBy: 'artem@goodface.agency', createdAt: Date.now() - d.age * 864e5, status: 'pending' };
      });
      return true;
    },
    /** What the invitation page shows: {state:'ok'|'invalid', invite, org, inviter, hasAccount} */
    getInvite: function (tokenId) {
      var db = store.get(), inv = db.invites[tokenId];
      var org = inv ? db.orgs[inv.orgId] : null;
      var state = org ? inviteState(inv) : 'invalid';
      var inviter = inv ? db.users[inv.invitedBy] || memberOf(org, inv.invitedBy) : null;
      return { state: state, invite: inv || null, org: org || null, inviter: inviter ? { name: inviter.name, email: inviter.email } : null, hasAccount: !!(inv && db.users[inv.email]) };
    },
    /** The signed-in person (whose email is the invitation's) joins and the account opens. */
    accept: function (tokenId) {
      return withUser(function (user, db) {
        var inv = db.invites[tokenId], org = inv ? db.orgs[inv.orgId] : null;
        if (!org || inviteState(inv) !== 'ok' || inv.email !== user.email) return { ok: false, error: 'invalid' };
        if (!memberOf(org, user.email)) org.members.push({ email: user.email, name: user.name, role: inv.role, addedAt: Date.now() });
        inv.status = 'accepted';
        db.session.account = 'developer'; db.session.orgId = org.id;
        user.lastAccount = 'developer'; user.lastOrgId = org.id;
        return { ok: true, redirect: 'analytics.html', orgId: org.id };
      });
    }
  };

  /** Sign up from an invitation: the email is the invitation's (locked), a Personal account is created automatically, and the invited account opens. */
  api.signUpFromInvite = function (tokenId, password) {
    return delay(null, 500).then(function () {
      return store.update(function (db) {
        var inv = db.invites[tokenId], org = inv ? db.orgs[inv.orgId] : null;
        if (!org || inviteState(inv) !== 'ok') return { ok: false, error: 'invalid' };
        if (db.users[inv.email]) return { ok: false, error: 'has_account' };
        var u = addUser(db, inv.email, 'personal', { password: password, verified: true });
        startSession(db, inv.email, true);
        org.members.push({ email: u.email, name: u.name, role: inv.role, addedAt: Date.now() });
        inv.status = 'accepted';
        db.session.account = 'developer'; db.session.orgId = org.id;
        u.lastAccount = 'developer'; u.lastOrgId = org.id;
        return { ok: true, redirect: 'analytics.html' };
      });
    });
  };

  /* ---------- Deleting accounts ---------- */

  /** Does the account have an Active app? (what its balance comes from; the apps are stored on the account) */
  api.orgHasActiveApps = function (org) {
    return (org.appList || []).some(function (a) { return a.status === 'active'; }) || (!org.appList && ['acme', 'nine', 'default'].indexOf(org.appsSeed) > -1);
  };

  /** The Developer account the Owner is looking at is deleted for good; the person lands on Personal. Other accounts are not touched. */
  api.deleteOrg = function (orgId) {
    return withUser(function (user, db) {
      var org = db.orgs[orgId];
      var m = memberOf(org, user.email);
      if (!org || !m || m.role !== 'owner') return { ok: false, error: 'not_owner' };
      removeOrg(db, orgId);
      if (db.session.orgId === orgId) { db.session.account = 'personal'; db.session.orgId = null; }
      if (user.lastOrgId === orgId) { user.lastAccount = 'personal'; delete user.lastOrgId; }
      return { ok: true };
    });
  };
  function removeOrg(db, orgId) {
    delete db.orgs[orgId];
    Object.keys(db.invites).forEach(function (k) { if (db.invites[k].orgId === orgId) delete db.invites[k]; });
    ['payoutsBy', 'referralBy'].forEach(function (k) { if (db.demo && db.demo[k]) delete db.demo[k][orgId]; });
  }

  /** What deleting the Personal account takes with it: the person goes, so the accounts they own go and they leave the others. */
  api.deletionImpact = function () {
    var db = store.get(), email = db.session && db.session.email;
    var owned = [], member = [];
    orgsOf(db, email).forEach(function (o) {
      (memberOf(o, email).role === 'owner' ? owned : member).push({ id: o.id, name: o.name, role: memberOf(o, email).role });
    });
    return { owned: owned, member: member };
  };

  /** Deleting the Personal account deletes the person: the accounts they own are deleted, they are removed from the rest. */
  api.deleteUser = function () {
    return withUser(function (user, db) {
      orgsOf(db, user.email).forEach(function (o) {
        if (memberOf(o, user.email).role === 'owner') removeOrg(db, o.id);
        else o.members = o.members.filter(function (m) { return m.email !== user.email; });
      });
      Object.keys(db.invites).forEach(function (k) { if (db.invites[k].email === user.email) delete db.invites[k]; });
      delete db.users[user.email];
      db.session = null;
      return { ok: true };
    });
  };

  /* ---------- Demo helpers (Prototype panel, screen map) ---------- */

  api.demo = {
    /**
     * Signs in as the demo login, for screen-map links. With 'developer' in `accounts` it also gets a Developer account of its
     * own to shape ("Studio Apps LLC", id 'demo', shaped by opts.dev); the seeded Acme, Side Project and Studio Nine stay as they are.
     */
    signInWith: function (accounts, opts) {
      opts = opts || {};
      store.update(function (db) {
        var email = DEMO_EMAIL;
        var user = db.users[email];
        if (accounts.indexOf('developer') > -1) {
          var org = Object.assign(newDev(), { details: { company: 'Studio Apps LLC' } }, opts.dev || {});
          var keep = db.orgs.demo;
          org.id = 'demo'; org.name = 'Studio Apps LLC'; org.createdAt = Date.now();
          org.appsSeed = 'default'; org.referralDefault = 'default';
          org.members = [{ email: email, name: user.name, role: opts.role || 'owner', addedAt: Date.now() }];
          if (keep && keep.members) org.members = keep.members.filter(function (m) { return m.email !== email; }).concat(org.members);
          db.orgs.demo = org;
        } else delete db.orgs.demo;
        if (opts.peerStage) user.peerStage = opts.peerStage;
        startSession(db, email, false);
        var wantDev = (opts.account || accounts[0]) === 'developer' && db.orgs.demo;
        db.session.account = wantDev ? 'developer' : 'personal';
        db.session.orgId = wantDev ? 'demo' : null;
      });
    },
    /** Makes the signed-in person Owner, Admin or Member of the account in use, keeping exactly one Owner. */
    setRole: function (role) {
      store.update(function (db) {
        var org = activeOrg(db);
        var me = memberOf(org, db.session.email);
        if (!org || !me || ['owner', 'admin', 'member'].indexOf(role) < 0) return;
        if (role === 'owner') {
          org.members.forEach(function (m) { if (m !== me && m.role === 'owner') m.role = 'admin'; });
        } else if (!org.members.some(function (m) { return m !== me && m.role === 'owner'; })) {
          // somebody else has to own the account
          var other = org.members.filter(function (m) { return m !== me; })[0];
          if (other) other.role = 'owner';
          else org.members.push({ email: 'jordan.lee@' + org.id + '.example', name: 'Jordan Lee', role: 'owner', addedAt: Date.now() - 400 * 864e5 });
        }
        me.role = role;
      });
    },
    /** Forces the balance of the account in use to 'zero' or 'positive' (what Payouts, Danger zone and the deletion blocks read). */
    setBalance: function (kind) {
      store.update(function (db) {
        var key = db.session.account === 'developer' && db.session.orgId ? db.session.orgId : 'personal';
        var holder = key === 'personal' ? db.users[db.session.email] : db.orgs[key];
        if (!holder) return;
        holder.demoBalance = kind;
        var st = db.demo && db.demo.payoutsBy && db.demo.payoutsBy[key];
        if (st) { st.balance.available = kind === 'zero' ? 0 : 12840; st.balance.pending = kind === 'zero' ? 0 : 1460; }
      });
    },
    setOwnerInactive: function (on) {
      store.update(function (db) { var org = activeOrg(db); if (org) org.ownerInactive = !!on; });
    },
    lock: function (email) {
      store.update(function (db) {
        db.attempts[normEmail(email)] = { fails: 0, lockedUntil: Date.now() + R.lockMinutes * MIN - 8000 };
      });
    },
    seedPending: function (type) {
      store.update(function (db) {
        if (db.pending) return;
        var email = type === 'developer' ? 'new.dev@studio.dev' : 'new.user@example.com';
        addUser(db, email, type, { password: 'cashful123' });
        startPending(db, email, type);
      });
    },
    seedChallenge: function () {
      store.update(function (db) {
        if (!db.challenge) db.challenge = { email: DEMO_EMAIL, remember: false, at: Date.now() };
      });
    },
    signInAs: function (email) {
      store.update(function (db) { startSession(db, email, false); });
    }
  };

  Cashful.api = api;
})();
