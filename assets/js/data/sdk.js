/* Developer SDK — logic around the config: demo scenarios, URL state, snippets and placeholder files.
   No rendering here. Apps come from the shared mock apps (data/apps.js). */
(function () {
  var cfg = Cashful.sdkConfig;

  var SCENARIOS = [
    { id: 'default', label: 'Default' },
    { id: 'no-apps', label: 'No apps' },
    { id: 'none-active', label: 'Apps but none Active' },
    { id: 'app-not-active', label: 'Selected app not Active' }
  ];

  function scenarioFrom(search) {
    var d = new URLSearchParams(search).get('data');
    return SCENARIOS.some(function (s) { return s.id === d; }) ? d : 'default';
  }

  function appsFor(scenario) {
    var all = Cashful.apps.all();
    if (scenario === 'no-apps') return [];
    if (scenario === 'none-active') return all.filter(function (a) { return !Cashful.apps.isActive(a); });
    return all;
  }

  function availablePlatforms() { return cfg.platforms.filter(function (p) { return p.status === 'available'; }); }
  function platformById(id) { return cfg.platforms.filter(function (p) { return p.id === id; })[0]; }
  function defaultPlatform() {
    var d = platformById(cfg.defaultPlatform);
    return d && d.status === 'available' ? d.id : availablePlatforms()[0].id;
  }

  /** First Active app, otherwise the first app, otherwise none. The "not Active" demo starts on one that isn't. */
  function defaultApp(apps, scenario) {
    if (!apps.length) return null;
    if (scenario === 'app-not-active') return (apps.filter(function (a) { return !Cashful.apps.isActive(a); })[0] || apps[0]).id;
    return (apps.filter(Cashful.apps.isActive)[0] || apps[0]).id;
  }

  /** Reads ?platform= and ?app=. Unknown or coming-soon platforms and unknown apps fall back to the defaults. */
  function parseUrl(search, apps, scenario) {
    var p = new URLSearchParams(search);
    var platform = p.get('platform');
    var app = p.get('app');
    var okPlatform = availablePlatforms().some(function (x) { return x.id === platform; });
    var okApp = apps.some(function (a) { return a.id === app; });
    return { platform: okPlatform ? platform : defaultPlatform(), app: okApp ? app : defaultApp(apps, scenario), data: scenario };
  }

  function buildUrl(st) {
    var p = new URLSearchParams();
    p.set('platform', st.platform);
    if (st.app) p.set('app', st.app);
    if (st.data !== 'default') p.set('data', st.data);
    return location.pathname + '?' + p.toString();
  }

  /** The snippet with the App ID filled in (or the placeholder when there is no app). */
  function snippet(platformId, step, appId) {
    var s = (cfg.snippets[platformId] || {})[step] || '';
    return s.split('{APP_UUID}').join(appId || cfg.appIdPlaceholder);
  }

  function sdkFile(platform) {
    return {
      name: 'cashful-sdk-' + platform.id + '-' + platform.version + '.placeholder.txt',
      text: 'Cashful SDK for ' + platform.name + ' ' + platform.version + '\r\nReleased ' + platform.releasedAt + '\r\n\r\n' +
        'This is a placeholder file from the prototype. The real SDK package is provided by Cashful.\r\n'
    };
  }
  function consentFile() {
    return {
      name: cfg.consent.templateFileName + '.placeholder.txt',
      text: 'Cashful consent screen template\r\n\r\nThis is a placeholder file from the prototype. The real template is provided by Cashful.\r\n\r\n' +
        'Requirements:\r\n' + cfg.consent.requirements.map(function (r) { return '- ' + r; }).join('\r\n') + '\r\n'
    };
  }

  Cashful.sdk = {
    config: cfg, SCENARIOS: SCENARIOS,
    scenarioFrom: scenarioFrom, appsFor: appsFor, parseUrl: parseUrl, buildUrl: buildUrl,
    platformById: platformById, snippet: snippet, sdkFile: sdkFile, consentFile: consentFile
  };
})();
