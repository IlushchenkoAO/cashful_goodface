/* DEV ONLY — status simulation for the prototype. The real review is not part of the MVP.
   On the details page of every app it adds a "Simulate status" block: pick any status (Draft, In review, Changes
   requested, Active with data, Active with no data yet) and apply it, so the list, Analytics and the SDK page can be
   shown in any state. "Active with data" gives the app mock traffic, so it appears in Analytics.
   Remove this script's tag from app.html to hide it (nothing else depends on it). */
(function () {
  var ui = Cashful.ui;
  var A = Cashful.apps;
  if (!ui || !A || document.body.dataset.page !== 'app') return;

  var id = ui.params.get('id');
  var SAMPLE = 'Please add a clearer screenshot of the app’s main screen.';
  var OPTIONS = [
    { id: 'draft', label: 'Draft' },
    { id: 'in_review', label: 'In review' },
    { id: 'changes_requested', label: 'Changes requested' },
    { id: 'active-data', label: 'Active, with data' },
    { id: 'active-empty', label: 'Active, no data yet' }
  ];

  function currentOption(app) {
    if (app.status !== 'active') return app.status;
    return app.base ? 'active-data' : 'active-empty';
  }

  function render() {
    var slot = ui.$('#app-review-sim');
    if (!slot) return;
    var app = A.get(id);
    if (!app) { slot.innerHTML = ''; return; }
    var cur = currentOption(app);
    slot.innerHTML = '<section class="cf-card sim" aria-labelledby="sim-title">' +
      '<div class="sim__head"><h2 class="cf-card__title" id="sim-title">Simulate status</h2><span class="cf-badge cf-badge--neutral">Dev only</span></div>' +
      '<p class="t-muted">The real review happens in the Cashful team’s tools. Pick a status to see how the app looks in the list, in Analytics and in the SDK page.</p>' +
      '<form class="sim__form" id="sim-form" novalidate>' +
        '<div class="cf-input"><label class="cf-input__label" for="sim-status">Status</label><div class="cf-field cf-field--select"><select class="cf-field__input" id="sim-status">' +
          OPTIONS.map(function (o) { return '<option value="' + o.id + '"' + (o.id === cur ? ' selected' : '') + '>' + o.label + '</option>'; }).join('') +
        '</select><cf-icon name="chevron-down" size="20"></cf-icon></div><div class="cf-input__helper"></div></div>' +
        '<div class="cf-input" id="sim-comment-wrap"' + (cur === 'changes_requested' ? '' : ' hidden') + '><label class="cf-input__label" for="sim-comment">Reviewer comment</label>' +
          '<div class="cf-field cf-field--area"><textarea class="cf-field__input" id="sim-comment" rows="3">' + ui.esc(SAMPLE) + '</textarea></div><div class="cf-input__helper"></div></div>' +
        '<div class="sim__buttons"><button type="submit" class="cf-btn cf-btn--primary">Apply status</button></div>' +
      '</form></section>';
  }

  document.addEventListener('change', function (e) {
    if (e.target.id !== 'sim-status') return;
    ui.$('#sim-comment-wrap').hidden = e.target.value !== 'changes_requested';
  });

  document.addEventListener('submit', function (e) {
    if (e.target.id !== 'sim-form') return;
    e.preventDefault();
    var value = ui.$('#sim-status').value;
    var comment = '';
    if (value === 'changes_requested') {
      var input = ui.$('#sim-comment');
      comment = input.value.trim();
      if (!comment) { ui.setError(input, 'Write what needs to change.'); input.focus(); return; }
    }
    var label = OPTIONS.filter(function (o) { return o.id === value; })[0].label;
    A.setStatus(id, value.indexOf('active') === 0 ? 'active' : value, { data: value !== 'active-empty', comment: comment });
    ui.toast('Status: ' + label);
  });

  // The page re-draws itself on every status change and then announces it; the block follows
  window.addEventListener('cashful:app-rendered', render);
  render();
})();
