/* Persistent state for the mock backend.
   Lives in localStorage so it survives page navigation; falls back to memory
   when storage is blocked (private mode, some file:// setups).
   v5: a person (user) is not an account. Developer accounts are "orgs" in db.orgs; a user belongs to some of them with a role,
   and a session looks at one account at a time (db.session.account 'personal' | 'developer', and db.session.orgId). */
(function () {
  var KEY = 'cashful.prototype.v5';
  var memory = null;

  function seed() {
    var C = Cashful.config;
    var users = {};
    // Deep copy: seed users contain nested objects that must not share references with config
    C.seedUsers.forEach(function (u) { users[u.email] = JSON.parse(JSON.stringify(u)); });
    var orgs = {};
    (C.seedOrgs || []).forEach(function (o) { orgs[o.id] = JSON.parse(JSON.stringify(o)); });
    var invites = {};
    (C.seedInvites || []).forEach(function (i) { invites[i.token] = JSON.parse(JSON.stringify(i)); });
    return {
      users: users,       // email → user
      session: null,      // { email, remember, account, orgId }
      pending: null,      // signup awaiting email verification
      challenge: null,    // login awaiting 2FA
      attempts: {},       // email → { fails, lockedUntil }
      resetTokens: {},    // token → { email, createdAt, used }
      orgs: orgs,         // developer accounts: id → { name, kycStatus, members, appList… }
      invites: invites    // team invitations: token → { orgId, email, role, status… }
    };
  }

  /** Lets the api wire derived properties (the session user's `dev`, the accounts list) onto a freshly read db. */
  function bound(db) {
    if (Cashful.bindDb) Cashful.bindDb(db);
    return db;
  }

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return bound(JSON.parse(raw));
    } catch (e) { /* storage unavailable */ }
    return bound(memory || seed());
  }

  function write(db) {
    memory = db;
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* keep in memory */ }
  }

  Cashful.store = {
    get: read,
    /** Applies `fn(db)` and saves. Returns whatever `fn` returns. */
    update: function (fn) {
      var db = read();
      var result = fn(db);
      write(db);
      return result;
    },
    /** One-time value for the next page (e.g. pre-filled email) — kept out of the URL. */
    flash: function (key, value) {
      this.update(function (db) { db.flash = db.flash || {}; db.flash[key] = value; });
    },
    takeFlash: function (key) {
      return this.update(function (db) {
        var v = db.flash ? db.flash[key] : undefined;
        if (db.flash) delete db.flash[key];
        return v;
      });
    },
    reset: function () {
      try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
      memory = null;
      write(seed());
    }
  };
})();
