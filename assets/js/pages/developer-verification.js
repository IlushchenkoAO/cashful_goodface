/* Developer sign-up details and KYC — six steps, progress saved after each one. A new developer lands here right
   after the account is created (or right after the email is verified).
   type → details (company | independent) → apps → agreements → kyc → review
   Nothing is required: the fields come filled with sample values (edit them or just continue), so a reviewer can click
   through. The KYC step can be skipped: "Complete verification later"
   leaves the status Not started (In progress) and the dashboard reminds the developer. The details are also saved as
   dev.business, the same record Settings → Business details edits.
   #step opens a step directly; ?resume=1 shows "Welcome back" (DevOnbResume).
   An account with kycStatus 'changes_requested' lands on the identity step to resubmit documents. */
(function () {
  var ui = Cashful.ui;
  var api = Cashful.api;
  var cfg = Cashful.config;

  var user = api.currentUser();
  if (!user) { location.replace('auth.html'); return; }
  if (user.accounts.indexOf('developer') < 0) { location.replace(api.homeFor(user)); return; }
  if (api.activeAccount() !== 'developer') api.switchAccount('developer');

  var STEPS = cfg.onboardingSteps.map(function (s) { return s.id; });
  var dev = user.dev;

  var OPTIONS = {
    countries: cfg.eligibility.supported,
    regions: ['United States, European Union', 'United States', 'European Union', 'Worldwide', 'Other']
  };
  var PLATFORMS = ['Android', 'iOS', 'Windows', 'macOS', 'Linux', 'Other'];
  var DEFAULT_PLATFORMS = ['Android', 'iOS'];

  /* ---------- Static setup ---------- */

  ui.$$('[data-user-email]').forEach(function (el) { el.textContent = user.email; });
  ui.$$('[data-review-time]').forEach(function (el) { el.textContent = Cashful.developerSettingsConfig.kyc.reviewTime; });

  ui.$$('select[data-options]').forEach(function (s) {
    s.innerHTML = OPTIONS[s.dataset.options].map(function (o) { return '<option>' + ui.esc(o) + '</option>'; }).join('');
  });

  ui.$('#platforms').innerHTML = PLATFORMS.map(function (p) {
    return '<label class="cf-check"><input class="cf-check__input" type="checkbox" name="platforms" value="' + p + '"' +
      (DEFAULT_PLATFORMS.indexOf(p) > -1 ? ' checked' : '') + '>' +
      '<span class="cf-checkbox__box"><cf-icon name="check" size="14" stroke-width="2.75"></cf-icon></span><span class="cf-check__label">' + p + '</span></label>';
  }).join('');

  /* ---------- Saved answers ⇄ form fields ---------- */

  var SECTION = { 'details-company': 'details', 'details-indie': 'details', apps: 'apps', agreements: 'agreements' };

  function restore(form) {
    var saved = dev[SECTION[form.dataset.view]];
    if (form.dataset.view === 'type') saved = { kind: dev.kind };
    if (!saved) return;
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || !(el.name in saved)) return;
      var v = saved[el.name];
      if (el.type === 'checkbox' && Array.isArray(v)) el.checked = v.indexOf(el.value) > -1;
      else if (el.type === 'checkbox') el.checked = !!v;
      else if (el.type === 'radio') el.checked = el.value === v;
      else el.value = v;
    });
  }

  function collect(form) {
    var out = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name) return;
      if (el.type === 'checkbox' && el.name === 'platforms') {
        out.platforms = out.platforms || [];
        if (el.checked) out.platforms.push(el.value);
      } else if (el.type === 'checkbox') out[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
      else out[el.name] = el.value.trim();
    });
    return out;
  }

  /** Sample answers, in the fields until the person types their own. Nothing here is required. */
  var SAMPLES = {
    company: 'Studio Apps LLC', regno: '12-3456789', street: '500 Market Street', city: 'San Francisco', region: 'California', zip: '94105',
    website: 'studio.dev', firstName: 'Alex', lastName: 'Morgan', count: '3', installs: '120000', signature: 'Alex Morgan'
  };
  function prefill(form) {
    Array.prototype.forEach.call(form.elements, function (el) {
      if (el.name in SAMPLES && el.tagName === 'INPUT' && el.type === 'text' && !el.value.trim()) el.value = SAMPLES[el.name];
    });
  }

  /** The numbers have to be whole numbers when something is typed in them; everything else may be left as it is. */
  function validate(form) {
    var ok = true;
    ui.$$('.cf-field__input', form).forEach(function (el) {
      if ((el.name === 'count' || el.name === 'installs') && el.value.trim() && !/^\d+$/.test(el.value.trim().replace(/[,\s]/g, ''))) {
        ui.setError(el, 'Enter a whole number, 0 or more.'); ok = false;
      }
    });
    var agree = form.elements.agree;
    if (api.strict && agree && !agree.checked) { ui.setError(agree, 'Agree to the documents to sign.'); ok = false; }
    if (!ok) { var bad = ui.$('.is-error input, .is-error select', form); if (bad) bad.focus(); }
    return ok;
  }

  /** The record Settings → Business details edits, built from the answers above. Only known values are written. */
  function businessFrom(d) {
    var det = d.details || {}, ap = d.apps || {};
    var b = {
      kind: d.kind === 'indie' ? 'indie' : 'llc',
      name: d.kind === 'indie' ? [det.firstName, det.lastName].filter(Boolean).join(' ') : det.company,
      country: det.country, street: det.street, city: det.city, postal: det.zip,
      apps: ap.count != null ? String(ap.count).replace(/[,\s]/g, '') : undefined,
      installs: ap.installs != null ? String(ap.installs).replace(/[,\s]/g, '') : undefined
    };
    Object.keys(b).forEach(function (k) { if (b[k] == null || b[k] === '') delete b[k]; });
    return b;
  }

  /* ---------- Step display ---------- */

  function viewFor(step) { return step === 'details' ? 'details-' + (dev.kind || 'company') : step; }

  function companyName() {
    var d = dev.details || {};
    if (dev.kind === 'indie') return [d.firstName, d.lastName].filter(Boolean).join(' ');
    return d.company || 'your company';
  }

  function renderStepper(step) {
    var cur = STEPS.indexOf(step);
    // After submitting for review every step is done
    if (dev.kycStatus === 'in_review' || dev.kycStatus === 'approved') cur = STEPS.length - 1;
    ui.$('#stepper').innerHTML = cfg.onboardingSteps.map(function (s, i) {
      var st = i < cur ? 'done' : i === cur ? 'current' : 'upcoming';
      return '<li class="cf-step is-' + st + '"' + (st === 'current' ? ' aria-current="step"' : '') + '>' +
        '<div class="cf-step__rail"><span class="cf-step__marker">' + (st === 'done' ? '<cf-icon name="check" size="16" stroke-width="2.5"></cf-icon>' : i + 1) + '</span>' +
        (i < STEPS.length - 1 ? '<span class="cf-step__line"></span>' : '') + '</div>' +
        '<div class="cf-step__text"><div class="cf-step__title">' + ui.esc(s.title) + '</div><div class="cf-step__desc">' + ui.esc(s.description) + '</div></div></li>';
    }).join('');
    ui.$('#step-num').textContent = cur + 1;
  }

  function show(step) {
    if (STEPS.indexOf(step) < 0) step = 'type';
    var view = viewFor(step);
    var form = ui.$('[data-view="' + view + '"]');
    if (form.tagName === 'FORM') { restore(form); prefill(form); }

    // Copy that depends on earlier answers
    var signing = dev.kind === 'indie'
      ? 'You’re signing as ' + (companyName() || 'an independent developer') + '.'
      : 'You’re signing on behalf of ' + companyName() + '.';
    ui.$('#signing-as').textContent = signing;
    ui.$$('[data-company-only]').forEach(function (el) { el.hidden = dev.kind === 'indie'; });
    ui.$$('[data-company-name]').forEach(function (el) { el.textContent = companyName(); });

    renderStepper(step);
    ui.showView(view);
    window.scrollTo(0, 0);
  }

  function go(step) {
    if (location.hash.slice(1) === step) show(step);
    else location.hash = step;   // hashchange → show(); browser Back works between steps
  }

  window.addEventListener('hashchange', function () { show(location.hash.slice(1)); });

  /* ---------- Submitting steps ---------- */

  function next(step) { return STEPS[STEPS.indexOf(step) + 1]; }
  function prev(step) { return STEPS[STEPS.indexOf(step) - 1]; }
  function stepOf(form) { return form.dataset.view.indexOf('details') === 0 ? 'details' : form.dataset.view; }

  ui.$$('form.onb__form').forEach(function (form) {
    var step = stepOf(form);
    var submit = ui.$('button[type="submit"]', form);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate(form)) return;

      if (step === 'kyc') {
        // The verification partner's flow would open here; the prototype simulates a pass
        ui.withLoading(submit, function () {
          return api.submitKyc().then(function (d) { dev = d; go('review'); });
        });
        return;
      }

      var data = collect(form);
      var patch = {};
      if (step === 'type') patch.kind = data.kind;
      else patch[SECTION[form.dataset.view]] = data;

      ui.withLoading(submit, function () {
        return api.saveOnboarding(patch, next(step)).then(function (d) {
          dev = d;
          if (step === 'type' || step === 'details' || step === 'apps') dev = api.updateDev({ business: Object.assign({}, dev.business, businessFrom(dev)) });
          // The Developer Agreement is signed here once; Settings → Agreements shows it as signed
          if (step === 'agreements' && data.signature) api.kyc.sign('developer-agreement', data.signature);
          go(next(step));
        });
      });
    });

    var later = ui.$('#kyc-later', form);
    if (later) later.addEventListener('click', function () {
      // The details are saved; the verification itself waits. The dashboard keeps reminding, Settings finishes it.
      ui.withLoading(later, function () { return api.saveOnboarding({}, 'kyc'); }).then(function () { ui.go('analytics.html'); });
    });

    var back = ui.$('[data-back]', form);
    if (back) back.addEventListener('click', function () { go(prev(step)); });
  });

  // Documents aren't written yet
  document.addEventListener('click', function (e) {
    var doc = e.target.closest('[data-doc]');
    if (!doc) return;
    e.preventDefault();
    ui.toast('Prototype: “' + doc.dataset.doc + '” opens here once the client sends the text', 'file');
  });

  ui.$$('[data-logout]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      api.logOut().then(function () { ui.go(a.getAttribute('href')); });
    });
  });

  /* ---------- Where to start ---------- */

  var start = location.hash.slice(1);
  if (!start) {
    if (dev.kycStatus === 'in_review' || dev.kycStatus === 'approved') start = 'review';
    else if (dev.kycStatus === 'changes_requested') start = 'kyc';
    else start = dev.step || 'type';
  }

  function insertAlert(view, a) {
    var form = ui.$('[data-view="' + view + '"]');
    var slot = document.createElement('div');
    form.insertBefore(slot, form.firstChild);
    ui.alert(slot, a);
  }

  if (ui.params.get('resume') && dev.kycStatus === 'not_started' && dev.started) {
    insertAlert(viewFor(start), { tone: 'info', title: 'Welcome back', text: 'Your progress is saved. Pick up where you left off.' });
  }
  if (dev.kycStatus === 'changes_requested') {
    insertAlert('kyc', { tone: 'error', title: 'We need a clearer photo of your ID', text: 'The photo was too blurry to confirm your identity. Upload it again, it takes about 2 minutes.' });
  }

  // Approved from the review screen (the prototype shortcut): on to the dashboard
  api.kyc.onChange(function (status) { if (status === 'approved') ui.go('analytics.html'); });

  history.replaceState(null, '', location.pathname + location.search + '#' + start);
  show(start);
})();
