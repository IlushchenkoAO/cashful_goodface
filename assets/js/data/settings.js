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
    { id: 'avatar-none', label: 'Avatar: no photo' },
    { id: 'avatar-set', label: 'Avatar: photo set' },
    { id: 'avatar-preview', label: 'Avatar: preview before save' },
    { id: 'avatar-invalid', label: 'Avatar: invalid format' },
    { id: 'avatar-too-large', label: 'Avatar: file too large' },
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

  // The Developer set: its values are in developer-settings.config.js, the words are here
  var DEV_NOTIFICATIONS = [
    { key: 'payoutUpdates', title: 'Payout updates', text: 'Emails when a payout is requested, sent or needs attention.', lockedText: 'Required so you never miss a payout update.' },
    { key: 'appReviewUpdates', title: 'App review updates', text: 'Emails when an app is approved or needs changes.', lockedText: 'Required so you know where each app stands.' },
    { key: 'verificationUpdates', title: 'Verification updates', text: 'Emails about your identity and business verification.', lockedText: 'Required so you never miss a verification step.' },
    { key: 'earningsSummary', title: 'Monthly earnings summary', text: 'A short email once a month with what your apps earned.' },
    { key: 'productNews', title: 'Product news and offers', text: 'New SDK features, tips and offers.', helper: 'We’ll only send these if you opt in.' }
  ];
  function notificationList(account) { return account === 'developer' ? DEV_NOTIFICATIONS : NOTIFICATIONS; }
  function notificationConfig(account) { return account === 'developer' ? Cashful.developerSettingsConfig.notifications : cfg.notifications; }

  /**
   * The page's state. Name and photo live on the login; the pending email, 2FA and the notification choices are
   * also kept on the login, so a change made in one account type shows in the other. The preset only opens a state.
   */
  function createState(presetId, user, account) {
    account = account || 'personal';
    var list = notificationList(account), conf = notificationConfig(account);
    var n = {};
    list.forEach(function (item) { n[item.key] = conf[item.key].default; });
    if (user.notif && user.notif[account]) Object.assign(n, user.notif[account]);
    if (presetId === 'notifications-on') { n.earningsSummary = true; n.productNews = true; }
    if (presetId === 'notifications-off') { n.earningsSummary = false; n.productNews = false; }
    // A locked notification is always on, whatever the preset says
    list.forEach(function (item) { if (conf[item.key].locked) n[item.key] = true; });

    return {
      profile: { name: user.name || user.email.split('@')[0], email: user.email, country: 'Germany', avatar: user.avatar || null },
      emailPending: presetId === 'email-pending' ? 'alex.morgan@example.com' : (user.emailPending || null),
      tfa: { enabled: presetId === '2fa-on' ? true : !!user.tfaEnabled },
      notifications: n
    };
  }

  /* ---------- Developer: business details ---------- */

  var BUSINESS_KINDS = [{ value: 'llc', label: 'LLC' }, { value: 'indie', label: 'Independent developer' }];
  var BUSINESS_DEFAULT = { kind: 'llc', name: 'Studio Apps LLC', country: 'United States', street: '500 Market Street', city: 'San Francisco', postal: '94105', apps: '6', installs: '480000' };

  function businessOf(user) { return Object.assign({}, BUSINESS_DEFAULT, user.dev && user.dev.business); }

  /** @returns {field: message}; empty when every required field is filled and valid. */
  function validateBusiness(v) {
    var e = {};
    if (!v.kind) e.kind = 'Choose an account type.';
    if (!v.name.trim()) e.name = v.kind === 'indie' ? 'Enter your legal name.' : 'Enter the legal company name.';
    if (!v.country) e.country = 'Choose a country.';
    if (!v.street.trim()) e.street = 'Enter the street address.';
    if (!v.city.trim()) e.city = 'Enter the city.';
    if (!v.postal.trim()) e.postal = 'Enter the postal code.';
    if (!/^\d+$/.test(String(v.apps).trim())) e.apps = 'Enter a whole number, 0 or more.';
    if (!/^\d+$/.test(String(v.installs).trim())) e.installs = 'Enter a whole number, 0 or more.';
    return e;
  }

  var SAMPLE_FEEDBACK = 'We couldn’t match the company name with your registration documents. Please check the legal name and the address, then update them here.';

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

  /* ---------- Profile photo ---------- */

  var TYPE_NAMES = { 'image/jpeg': 'JPG', 'image/png': 'PNG', 'image/webp': 'WebP', 'image/gif': 'GIF' };

  /** "JPG, PNG or WebP" from the accepted types in the config. */
  function avatarFormats() {
    var names = cfg.avatar.acceptedTypes.map(function (t) { return TYPE_NAMES[t] || t; });
    return names.length > 1 ? names.slice(0, -1).join(', ') + ' or ' + names[names.length - 1] : names[0];
  }
  function avatarFormatError() { return 'Use a ' + avatarFormats() + ' image.'; }
  function avatarSizeError() { return 'Image must be under ' + cfg.avatar.maxSizeMb + ' MB.'; }
  function avatarHint() { return avatarFormats() + ', up to ' + cfg.avatar.maxSizeMb + ' MB.'; }

  /** @returns an error message, or '' when the file can be used. */
  function checkAvatarFile(file) {
    if (cfg.avatar.acceptedTypes.indexOf(file.type) < 0) return avatarFormatError();
    if (file.size > cfg.avatar.maxSizeMb * 1024 * 1024) return avatarSizeError();
    return '';
  }

  /** Centre-crops the image to a square and returns it as a data URL. */
  function cropToSquare(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var side = Math.min(img.width, img.height);
        var out = cfg.avatar.outputSizePx;
        var canvas = document.createElement('canvas');
        canvas.width = canvas.height = out;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, out, out);
        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, out, out);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
      img.src = url;
    });
  }

  /** A drawn, non-square portrait for the demo presets (so the crop is visible). */
  function sampleFile() {
    return new Promise(function (resolve) {
      var canvas = document.createElement('canvas');
      canvas.width = 480; canvas.height = 320;
      var ctx = canvas.getContext('2d');
      var bg = ctx.createLinearGradient(0, 0, 480, 320);
      bg.addColorStop(0, '#7b5cf0'); bg.addColorStop(1, '#ffc83d');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, 480, 320);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(240, 130, 62, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(240, 320, 120, 110, 0, Math.PI, 0); ctx.fill();
      canvas.toBlob(function (blob) { resolve(new File([blob], 'sample.jpg', { type: 'image/jpeg' })); }, 'image/jpeg', 0.9);
    });
  }

  /** Files for the "invalid" demo presets. */
  function badFile(kind) {
    return kind === 'format'
      ? new File(['gif'], 'photo.gif', { type: 'image/gif' })
      : new File([new ArrayBuffer(cfg.avatar.maxSizeMb * 1024 * 1024 + 1)], 'huge.png', { type: 'image/png' });
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
    config: cfg, NOTIFICATIONS: NOTIFICATIONS, DEV_NOTIFICATIONS: DEV_NOTIFICATIONS, notificationList: notificationList, notificationConfig: notificationConfig,
    BUSINESS_KINDS: BUSINESS_KINDS, businessOf: businessOf, validateBusiness: validateBusiness, SAMPLE_FEEDBACK: SAMPLE_FEEDBACK, COUNTRIES: COUNTRIES, PRESETS: PRESETS, SETUP_KEY: 'JBSW Y3DP EHPK 3PXP',
    preset: preset, settings: settings, createState: createState,
    passwordStrength: passwordStrength, validatePassword: validatePassword, qrPlaceholder: qrPlaceholder,
    avatarHint: avatarHint, checkAvatarFile: checkAvatarFile, cropToSquare: cropToSquare, sampleFile: sampleFile, badFile: badFile
  };
})();
