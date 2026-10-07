/* Persistent state for the mock backend.
   Lives in localStorage so it survives page navigation; falls back to memory
   when storage is blocked (private mode, some file:// setups). */
(function () {
  var KEY = 'cashful.prototype.v3';
  var memory = null;

  function seed() {
    var users = {};
    // Deep copy: seed users contain nested objects (dev) that must not share references with config
    Cashful.config.seedUsers.forEach(function (u) { users[u.email] = JSON.parse(JSON.stringify(u)); });
    return {
      users: users,       // email → user
      session: null,      // { email, remember }
      pending: null,      // signup awaiting email verification
      challenge: null,    // login awaiting 2FA
      attempts: {},       // email → { fails, lockedUntil }
      resetTokens: {}     // token → { email, createdAt, used }
    };
  }

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* storage unavailable */ }
    return memory || seed();
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
