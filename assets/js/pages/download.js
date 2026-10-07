/* Download app: OS-aware recommended installer, platform tiles, "How to install" modals. */
(function () {
  if (!Cashful.app) return;
  var ui = Cashful.ui;
  var esc = ui.esc;

  /* Recommended installer: Windows visitors get Windows, everyone else macOS (as in the design) */
  var HERO = {
    macos: { title: 'Cashful for macOS', meta: 'Version [X] · [X] MB · macOS 12 or later · Apple silicon and Intel', cta: 'Download for macOS' },
    windows: { title: 'Cashful for Windows', meta: 'Version [X] · [X] MB · Windows 10 or later', cta: 'Download for Windows' }
  };
  var os = /Windows/i.test(navigator.userAgent) ? 'windows' : 'macos';
  if (ui.params.get('os') && HERO[ui.params.get('os')]) os = ui.params.get('os');
  var h = HERO[os];
  ui.$('#hero-title').textContent = h.title;
  ui.$('#hero-meta').textContent = h.meta;
  ui.$('#hero-download span').textContent = h.cta;
  ui.$('#hero-download').dataset.download = h.cta;
  ui.$('#hero-help').dataset.help = os;

  /* "Soon" tiles: servers and routers */
  var SOON = [
    { key: 'linux', name: 'Linux', meta: 'Ubuntu, Debian', icon: 'monitor' },
    { key: 'docker', name: 'Docker', meta: 'Any Docker host', icon: 'package' },
    { key: 'pi', name: 'Raspberry Pi', meta: 'Pi 3 or later', icon: 'globe' },
    { key: 'router', name: 'Routers', meta: 'Selected models', icon: 'wifi' }
  ];
  ui.$('#soon-tiles').innerHTML = SOON.map(function (t) {
    return '<div class="cf-tile dl-tile is-soon">' +
      '<div class="cf-tile__top"><span class="cf-tile__chip"><cf-icon name="' + t.icon + '" size="24"></cf-icon></span><span class="cf-badge cf-badge--neutral">Soon</span></div>' +
      '<div><div class="cf-tile__name">' + esc(t.name) + '</div><div class="cf-tile__meta">' + esc(t.meta) + '</div></div>' +
      '<div class="dl-tile__actions">' +
        '<button type="button" class="cf-btn cf-btn--secondary cf-btn--sm cf-btn--block" disabled><cf-icon name="download" size="16"></cf-icon><span>Download</span></button>' +
        '<button type="button" class="cf-btn cf-btn--ghost cf-btn--sm cf-btn--block dl-help" data-help="' + t.key + '"><cf-icon name="help" size="16"></cf-icon><span>How to install</span></button>' +
      '</div></div>';
  }).join('');

  document.addEventListener('click', function (e) {
    var help = e.target.closest('[data-help]');
    if (help) Cashful.install.openPlatform(help.dataset.help);
  });

  // Deep link for demos: download.html?help=android
  var open = ui.params.get('help');
  if (open && Cashful.data.platforms[open]) Cashful.install.openPlatform(open);
})();
