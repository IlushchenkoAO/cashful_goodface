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

  function newDev() { return { status: 'not_started', step: 'type', kind: 'company', details: {}, apps: {} }; }

  /** A login with one account of `type` ('personal' | 'developer'). */
  function newUser(email, type, extra) {
    var u = Object.assign({
      email: email,
      name: email.split('@')[0],
      accounts: [type],
      verified: false,
      twoFactor: false
    }, extra);
    if (type === 'personal' && !u.peerStage) u.peerStage = 'new';
    if (type === 'developer' && !u.dev) u.dev = newDev();
    return u;
  }

  /** Where a signed-in user lands for an account (default: their first one). */
  function homeFor(user, account, opts) {
    account = account || user.accounts[0];
    if (account === 'personal') return 'dashboard.html';
    var dev = user.dev || newDev();
    if (dev.status === 'not_started' || dev.status === 'in_progress') {
      // Coming back to an unfinished onboarding after log in → "Welcome back" (DevOnbResume)
      return 'developer-verification.html' + (opts && opts.resume && dev.status === 'in_progress' ? '?resume=1' : '');
    }
    return 'analytics.html';
  }

  function startSession(db, email, remember) {
    var user = db.users[email];
    db.session = { email: email, remember: !!remember, at: Date.now(), account: user ? user.accounts[0] : 'personal' };
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

  /**
   * @returns {ok:true, redirect} | {ok:false, field, error}
   */
  api.signUp = function (input) {
    var email = normEmail(input.email) || (input.type === 'developer' ? 'new.dev@studio.dev' : 'new.user@example.com');
    var code = String(input.referral || '').trim();
    return delay().then(function () {
      if (strict && store.get().users[email]) return { ok: false, field: 'email', error: 'taken' };
      if (strict && code && !api.findReferral(code)) return { ok: false, field: 'referral', error: 'referral_not_found' };
      store.update(function (db) {
        if (!db.users[email]) {
          db.users[email] = newUser(email, input.type, { password: input.password, referral: code ? code.toUpperCase() : null });
        }
        startPending(db, email, input.type);
      });
      return { ok: true, redirect: 'verify-email.html' };
    });
  };

  /** Sign up / log in with Google or GitHub (simulated). */
  api.social = function (provider, intent) {
    return delay(null, 700).then(function () {
      return store.update(function (db) {
        var email;
        if (intent === 'login') {
          // Google → the demo personal account, GitHub → the demo developer account
          email = provider === 'github' ? 'dev@studio.dev' : DEMO_EMAIL;
        } else {
          email = provider + '.user@example.com';
          db.users[email] = db.users[email] || newUser(email, intent, {
            name: provider === 'github' ? 'GitHub user' : 'Google user', verified: true
          });
        }
        startSession(db, email, true);
        return { ok: true, redirect: homeFor(db.users[email]) };
      });
    });
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
        return { ok: true, redirect: homeFor(user), justVerified: true };
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
          user = db.users[email] = newUser(email, 'personal', { verified: true, twoFactor: true, peerStage: 'active' });
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

  /** The account the person is looking at right now. */
  api.activeAccount = function () {
    var db = store.get();
    var user = db.session && db.users[db.session.email];
    if (!user) return null;
    return user.accounts.indexOf(db.session.account) > -1 ? db.session.account : user.accounts[0];
  };

  /** Switcher in the sidebar. @returns the URL to open */
  api.switchAccount = function (account) {
    return withUser(function (user, db) {
      if (user.accounts.indexOf(account) < 0) return null;
      db.session.account = account;
      return homeFor(user, account);
    });
  };

  /** "Become a developer" — adds the second account without signing up again. */
  api.addDeveloperAccount = function () {
    return delay(null, 400).then(function () {
      return withUser(function (user, db) {
        if (user.accounts.indexOf('developer') < 0) user.accounts.push('developer');
        user.dev = user.dev || newDev();
        db.session.account = 'developer';
        return { ok: true, redirect: homeFor(user, 'developer') };
      });
    });
  };

  /** "Earn from your devices" — adds a personal account (PersonalAdded). */
  api.addPersonalAccount = function () {
    return delay(null, 400).then(function () {
      return withUser(function (user, db) {
        if (user.accounts.indexOf('personal') < 0) {
          user.accounts.push('personal');
          user.peerStage = 'new';   // a fresh personal account has no devices yet
        }
        db.session.account = 'personal';
        return { ok: true, redirect: 'dashboard.html' };
      });
    });
  };

  /* ---------- Developer verification ---------- */

  /** Saves a step's answers and moves on. Progress survives log out. */
  api.saveOnboarding = function (patch, nextStep) {
    return delay(null, 350).then(function () {
      return withUser(function (user) {
        var dev = user.dev = user.dev || newDev();
        Object.keys(patch || {}).forEach(function (k) {
          dev[k] = (typeof patch[k] === 'object' && patch[k] && !Array.isArray(patch[k]))
            ? Object.assign({}, dev[k], patch[k]) : patch[k];
        });
        if (dev.status === 'not_started') dev.status = 'in_progress';
        if (nextStep) dev.step = nextStep;
        return dev;
      });
    });
  };

  /** Identity check by the verification partner (simulated), then manual review. */
  api.submitKyc = function () {
    return delay(null, 1600).then(function () {
      return withUser(function (user) {
        user.dev.status = 'in_review';
        user.dev.step = 'review';
        return user.dev;
      });
    });
  };

  api.setDevStatus = function (status) {
    withUser(function (user) {
      user.dev = user.dev || newDev();
      user.dev.status = status;
      if (status !== 'not_started' && status !== 'in_progress') user.dev.step = 'review';
    });
  };

  /* ---------- Demo helpers (Prototype panel, screen map) ---------- */

  api.demo = {
    /** Signs in as a login with exactly these accounts, for screen-map links. */
    signInWith: function (accounts, opts) {
      opts = opts || {};
      store.update(function (db) {
        var email = DEMO_EMAIL;
        var user = db.users[email];
        user.accounts = accounts.slice();
        if (accounts.indexOf('developer') > -1) {
          user.dev = Object.assign(newDev(), { details: { company: 'Studio Apps LLC' } }, opts.dev || {});
        } else {
          delete user.dev;
        }
        if (accounts.indexOf('personal') < 0) delete user.peerStage;
        if (opts.peerStage) user.peerStage = opts.peerStage;
        startSession(db, email, false);
        db.session.account = opts.account || accounts[0];
      });
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
        db.users[email] = newUser(email, type, { password: 'cashful123' });
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
