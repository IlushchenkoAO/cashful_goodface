/* DEV ONLY — review simulation for the prototype. The real review is not part of the MVP.
   On the details page of an app that is In review it adds "Approve" and "Request changes".
   Remove this script's tag from app.html to hide it (nothing else depends on it). */
(function () {
  var ui = Cashful.ui;
  var A = Cashful.apps;
  if (!ui || !A || document.body.dataset.page !== 'app') return;

  var id = ui.params.get('id');
  var SAMPLE = 'Please add a clearer screenshot of the app’s main screen.';

  function render() {
    var slot = ui.$('#app-review-sim');
    if (!slot) return;
    var app = A.get(id);
    if (!app || app.status !== 'in_review') { slot.innerHTML = ''; return; }
    slot.innerHTML = '<section class="cf-card sim" aria-labelledby="sim-title">' +
      '<div class="sim__head"><h2 class="cf-card__title" id="sim-title">Simulate review</h2><span class="cf-badge cf-badge--neutral">Dev only</span></div>' +
      '<p class="t-muted">The real review happens in the Cashful team’s tools. Use this to move the app through the statuses.</p>' +
      '<div class="sim__buttons"><button type="button" class="cf-btn cf-btn--primary" data-sim="approve">Approve</button>' +
      '<button type="button" class="cf-btn cf-btn--secondary" data-sim="changes">Request changes</button></div>' +
      '<form class="sim__form" id="sim-form" hidden novalidate><div class="cf-input"><label class="cf-input__label" for="sim-comment">Reviewer comment</label>' +
        '<div class="cf-field cf-field--area"><textarea class="cf-field__input" id="sim-comment" rows="3">' + ui.esc(SAMPLE) + '</textarea></div><div class="cf-input__helper"></div></div>' +
        '<div class="sim__buttons"><button type="submit" class="cf-btn cf-btn--primary">Send feedback</button>' +
        '<button type="button" class="cf-btn cf-btn--ghost" data-sim="cancel">Cancel</button></div></form></section>';
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-sim]');
    if (!b) return;
    var form = ui.$('#sim-form');
    if (b.dataset.sim === 'approve') {
      A.review(id, 'approve');
      ui.toast('App approved. It is now Active.');
    } else if (b.dataset.sim === 'changes') {
      form.hidden = false;
      ui.$('#sim-comment').focus();
    } else if (b.dataset.sim === 'cancel') form.hidden = true;
  });

  document.addEventListener('submit', function (e) {
    if (e.target.id !== 'sim-form') return;
    e.preventDefault();
    var input = ui.$('#sim-comment');
    var comment = input.value.trim();
    if (!comment) { ui.setError(input, 'Write what needs to change.'); input.focus(); return; }
    A.review(id, 'changes', comment, null);
    ui.toast('Changes requested');
  });

  // The page re-draws itself on every status change and then announces it; the block follows
  window.addEventListener('cashful:app-rendered', render);
  render();
})();
