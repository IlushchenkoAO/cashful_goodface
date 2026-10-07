/* Install instructions: the "Add a device" modal (Overview) and "How to install" (Download).
   There is no real "add" action in the web app — a device appears once it signs in. */
(function () {
  if (!Cashful.app) return;
  var ui = Cashful.ui;
  var esc = ui.esc;
  var P = Cashful.data.platforms;
  var email = Cashful.app.user.email;

  function step(n, title, desc, extra) {
    return '<div class="step"><span class="step__num">' + n + '</span><div class="step__body">' +
      '<span class="step__title">' + esc(title) + '</span>' +
      '<span class="step__desc">' + esc(desc) + '</span>' + (extra || '') + '</div></div>';
  }

  function linkBtn(label, icon) {
    return '<a href="#" class="cf-btn cf-btn--secondary cf-btn--sm" data-download="' + esc(label) + '"><cf-icon name="' + (icon || 'download') + '" size="16"></cf-icon>' + esc(label) + '</a>';
  }

  function signInStep(command) {
    return step(2, 'Sign in with ' + email, command
      ? 'The command asks for your login once. The device shows up here on its own.'
      : 'Use this same account. The device shows up here on its own.');
  }

  var keepRunning = step(3, 'Keep Cashful running', 'It works in the background and only uses bandwidth you’re not using.');

  /* ---------- Add a device (tabs by device type) ---------- */

  var ADD_TABS = {
    'Phone': function () {
      return step(1, 'Get the app', 'Android 8 or later, iOS 15 or later.',
        '<div class="step__actions">' + linkBtn('Google Play') + linkBtn('App Store') + '</div>') + signInStep() + keepRunning;
    },
    'Computer': function () {
      return step(1, 'Download for your computer', 'Windows 10 or later, macOS 12 or later, Ubuntu and Debian.',
        '<div class="step__actions">' + linkBtn('Windows') + linkBtn('macOS') + linkBtn('Linux') + '</div>') + signInStep() + keepRunning;
    },
    'Router or server': function () {
      return step(1, 'Run the install command', 'Works on Raspberry Pi, Docker hosts and supported routers.',
        '<div class="step__actions step__actions--block">' + ui.copyField(P.docker.cmd) + '</div>') + signInStep(true) + keepRunning;
    }
  };

  function openAddDevice(onClose) {
    var m = ui.modal({
      title: 'Add a device',
      width: 560,
      body:
        '<p class="cf-modal__desc">Install Cashful on any device with internet. Only one device per network (IP address) earns at a time, so a phone on mobile data and a home computer earn separately.</p>' +
        '<div data-add-tabs></div>' +
        '<div class="steps" data-add-steps></div>',
      footer: '<button type="button" class="cf-btn cf-btn--secondary" data-close>Close</button>',
      onClose: onClose
    });
    var stepsEl = m.el.querySelector('[data-add-steps]');
    function show(tab) { stepsEl.innerHTML = ADD_TABS[tab](); }
    ui.tabs(m.el.querySelector('[data-add-tabs]'), Object.keys(ADD_TABS), 'Phone', show);
    show('Phone');
    return m;
  }

  /* ---------- How to install (one platform) ---------- */

  function platformSteps(p) {
    if (p.kind === 'store') {
      return step(1, 'Open the store and install', 'Search for Cashful or use the button on the tile.',
        '<div class="step__actions">' + linkBtn(p.store, 'external-link') + '</div>') + signInStep() + keepRunning;
    }
    if (p.kind === 'desktop') {
      return step(1, 'Open the installer you downloaded', p.where,
        '<div class="step__actions">' + linkBtn(p.store) + '</div>') + signInStep() + keepRunning;
    }
    return step(1, 'Run the install command', p.hint || 'Paste it into a terminal on the device.',
      '<div class="step__actions step__actions--block">' + ui.copyField(p.cmd) + '</div>') + signInStep(true) + keepRunning;
  }

  function openPlatform(key) {
    var p = P[key];
    var soon = p.soon
      ? '<div class="cf-alert cf-alert--info" role="status"><cf-icon class="cf-alert__icon" name="info" size="20"></cf-icon><div class="cf-alert__text"><div class="cf-alert__title">Coming later</div><div class="cf-alert__desc">We’re still testing this one. Leave your email and we’ll tell you the day it’s ready.</div></div></div>'
      : '';
    return ui.modal({
      title: p.title,
      width: 520,
      body: soon + '<p class="cf-modal__desc">' + esc(p.note) + '</p><div class="steps">' + platformSteps(p) + '</div>',
      footer: (p.soon ? '<button type="button" class="cf-btn cf-btn--primary" data-notify="' + esc(key) + '">Notify me</button>' : '') +
        '<button type="button" class="cf-btn cf-btn--secondary" data-close>Close</button>'
    });
  }

  /* Installer links and "Notify me" are placeholders until the release */
  document.addEventListener('click', function (e) {
    var dl = e.target.closest('[data-download]');
    if (dl) { e.preventDefault(); ui.toast('Prototype: “' + dl.dataset.download + '” opens the real installer after release', 'download'); }
    var notify = e.target.closest('[data-notify]');
    if (notify) {
      notify.disabled = true;
      notify.textContent = 'We’ll email you';
      ui.toast('We’ll email ' + email + ' when it’s ready');
    }
  });

  Cashful.install = { openAddDevice: openAddDevice, openPlatform: openPlatform };
})();
