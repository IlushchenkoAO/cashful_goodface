/* Developer verification — six steps, progress saved after each one.
   type → details (company | independent) → apps → agreements → kyc → review
   #step opens a step directly; ?resume=1 shows "Welcome back" (DevOnbResume).
   An account with status 'action_needed' lands on the identity step to resubmit documents. */
(function () {
  var ui = Cashful.ui;
  var api = Cashful.api;
  var cfg = Cashful.config;

  var user = api.currentUser();
  if (!user) { location.replace('login.html'); return; }
  if (user.accounts.indexOf('developer') < 0) { location.replace(api.homeFor(user)); return; }
  if (api.activeAccount() !== 'developer') api.switchAccount('developer');

  var STEPS = cfg.onboardingSteps.map(function (s) { return s.id; });
  var dev = user.dev;

  var OPTIONS = {
    countries: ['United States', 'United Kingdom', 'Canada', 'Germany', 'Poland', 'Ukraine', 'Other'],
    appCounts: ['1–3', '4–10', 'More than 10'],
    installs: ['Under 10,000', '10,000–100,000', '100,000–1,000,000', 'More than 1,000,000'],
    regions: ['United States, European Union', 'United States', 'European Union', 'Worldwide', 'Other']
  };
  var PLATFORMS = ['Android', 'iOS', 'Windows', 'macOS', 'Linux', 'Other'];
  var DEFAULT_PLATFORMS = ['Android', 'iOS'];

  /* ---------- Static setup ---------- */

  ui.$$('[data-user-email]').forEach(function (el) { el.textContent = user.email; });

  ui.$$('select[data-options]').forEach(function (s) {
    s.innerHTML = OPTIONS[s.dataset.options].map(function (o) { return '<option>' + ui.esc(o) + '</option>'; }).join('');
  });
  // Design defaults
  ui.$$('select[name="installs"]').forEach(function (s) { s.value = '10,000–100,000'; });

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

  /** Strict mode only: every field without an "Optional" helper must be filled. */
  function validate(form) {
    if (!api.strict) return true;
    var ok = true;
    ui.$$('.cf-field__input', form).forEach(function (el) {
      var helper = ui.$('.cf-input__helper', el.closest('.cf-input'));
      if (helper && /optional/i.test(helper.textContent)) return;
      if (!el.value.trim()) { ui.setError(el, 'Fill in this field.'); ok = false; }
    });
    var agree = form.elements.agree;
    if (agree && !agree.checked) { ui.setError(agree, 'Agree to the documents to sign.'); ok = false; }
    return ok;
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
    if (dev.status === 'in_review' || dev.status === 'approved') cur = STEPS.length - 1;
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
    if (form.tagName === 'FORM') restore(form);

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
        return api.saveOnboarding(patch, next(step)).then(function (d) { dev = d; go(next(step)); });
      });
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
    if (dev.status === 'in_review' || dev.status === 'approved') start = 'review';
    else if (dev.status === 'action_needed') start = 'kyc';
    else start = dev.step || 'type';
  }

  function insertAlert(view, a) {
    var form = ui.$('[data-view="' + view + '"]');
    var slot = document.createElement('div');
    form.insertBefore(slot, form.firstChild);
    ui.alert(slot, a);
  }

  if (ui.params.get('resume') && dev.status === 'in_progress') {
    insertAlert(viewFor(start), { tone: 'info', title: 'Welcome back', text: 'Your progress is saved. Pick up where you left off.' });
  }
  if (dev.status === 'action_needed') {
    insertAlert('kyc', { tone: 'error', title: 'We need a clearer photo of your ID', text: 'The photo was too blurry to confirm your identity. Upload it again, it takes about 2 minutes.' });
  }

  history.replaceState(null, '', location.pathname + location.search + '#' + start);
  show(start);
})();
