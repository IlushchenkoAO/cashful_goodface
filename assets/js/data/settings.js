/* Settings (Personal) — mock data, demo presets and small rules. No page rendering here.
   The profile, 2FA and notification values live in memory for the page (a reload restores the preset).
   The balance and the payout in progress come from the shared Payouts state. */
(function () {
  var cfg = Cashful.settingsConfig;

  // Copy for the three notifications in the config (the values are in the config, the words are here)
  var NOTIFICATIONS = [
    { key: 'payoutUpdates', title: 'Payout updates', text: 'Emails when a payout is requested, sent or needs attention.', lockedText: 'Required so you never miss a payout update.' },
    { key: 'earningsSummary', title: 'Monthly earnings summary', text: 'A short email once a month with what you earned.' },
    { key: 'productNews', title: 'Product news and offers', text: 'New features, tips and offers.', helper: 'We’ll only send these if you opt in.' }
  ];

  var COUNTRIES = ['United States', 'United Kingdom', 'Canada', 'Germany', 'Poland', 'Ukraine', 'Other'];

  // Presets for ?state=. The page opens the dialog or fills the form for the ones that need it.
  var PRESETS = [
    { id: 'default', label: 'Default' },
    { id: 'profile-dirty', label: 'Profile with unsaved changes' },
    { id: 'email-pending', label: 'Email verification pending' },
    { id: 'password-error', label: 'Password: wrong current password' },
    { id: 'password-success', label: 'Password: updated' },
    { id: '2fa-setup', label: '2FA: setup, step 1' },
    { id: '2fa-wrong-code', label: '2FA: setup, wrong code' },
    { id: '2fa-on', label: '2FA: on' },
    { id: '2fa-hidden', label: '2FA section off (config)' },
    { id: 'notifications-on', label: 'Notifications: all on' },
    { id: 'notifications-off', label: 'Notifications: all off' },
    { id: 'delete-blocked', label: 'Delete: payout in progress' },
    { id: 'delete-balance', label: 'Delete: balance warning' },
    { id: 'delete-zero', label: 'Delete: zero balance' }
  ];

  function preset(id) { return PRESETS.some(function (p) { return p.id === id; }) ? id : 'default'; }

  /** The config as the page sees it: the "2FA section off" preset overlays it. */
  function settings(presetId) {
    return Object.assign({}, cfg, { twoFactorEnabled: cfg.twoFactorEnabled && presetId !== '2fa-hidden' });
  }

  function createState(presetId, user) {
    var n = {};
    NOTIFICATIONS.forEach(function (item) { n[item.key] = cfg.notifications[item.key].default; });
    if (presetId === 'notifications-on') { n.earningsSummary = true; n.productNews = true; }
    if (presetId === 'notifications-off') { n.earningsSummary = false; n.productNews = false; }
    // A locked notification is always on, whatever the preset says
    NOTIFICATIONS.forEach(function (item) { if (cfg.notifications[item.key].locked) n[item.key] = true; });

    return {
      profile: { name: user.name || user.email.split('@')[0], email: user.email, country: 'Germany' },
      emailPending: presetId === 'email-pending' ? 'alex.morgan@example.com' : null,
      tfa: { enabled: presetId === '2fa-on' },
      notifications: n
    };
  }

  /* ---------- Passwords ---------- */

  /** @returns {level: 'Weak'|'Fair'|'Strong', hint} */
  function passwordStrength(pw) {
    var score = 0;
    if (pw.length >= 12) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    var level = pw.length < 8 || score <= 1 ? 'Weak' : score === 2 ? 'Fair' : 'Strong';
    return { level: level, hint: level === 'Strong' ? 'Strength: Strong.' : 'Strength: ' + level + '. Use 12 or more characters with numbers, symbols and capitals.' };
  }

  /** @returns {field: message} for the password form (the mock current-password check is separate). */
  function validatePassword(v) {
    var e = {};
    if (!v.current) e.current = 'Enter your current password.';
    if (v.next.length < 8) e.next = 'Use at least 8 characters.';
    else if (v.next === v.current) e.next = 'The new password must be different from the current one.';
    if (!v.confirm) e.confirm = 'Repeat the new password.';
    else if (v.confirm !== v.next) e.confirm = 'The passwords don’t match.';
    return e;
  }

  /* ---------- Placeholder QR for the 2FA setup (a pattern, not a real code) ---------- */

  function qrPlaceholder() {
    var n = 25, cell = 8, seed = 7, rects = '';
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    function finder(x, y) {
      return '<rect x="' + x * cell + '" y="' + y * cell + '" width="' + 7 * cell + '" height="' + 7 * cell + '"/>' +
        '<rect x="' + (x + 1) * cell + '" y="' + (y + 1) * cell + '" width="' + 5 * cell + '" height="' + 5 * cell + '" fill="var(--bg-surface)"/>' +
        '<rect x="' + (x + 2) * cell + '" y="' + (y + 2) * cell + '" width="' + 3 * cell + '" height="' + 3 * cell + '"/>';
    }
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        var inFinder = (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
        if (!inFinder && rnd() > 0.52) rects += '<rect x="' + x * cell + '" y="' + y * cell + '" width="' + cell + '" height="' + cell + '"/>';
      }
    }
    var size = n * cell;
    return '<svg class="set-qr" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="Placeholder QR code" fill="var(--text-primary)">' +
      rects + finder(0, 0) + finder(n - 7, 0) + finder(0, n - 7) + '</svg>';
  }

  Cashful.settings = {
    config: cfg, NOTIFICATIONS: NOTIFICATIONS, COUNTRIES: COUNTRIES, PRESETS: PRESETS, SETUP_KEY: 'JBSW Y3DP EHPK 3PXP',
    preset: preset, settings: settings, createState: createState,
    passwordStrength: passwordStrength, validatePassword: validatePassword, qrPlaceholder: qrPlaceholder
  };
})();
