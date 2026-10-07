/* Referrals — Personal accounts. Sections: summary, share, how it works, funnel, milestones, table, rules.
   Reward amounts and all reward copy come from referrals.config.js (see data/referrals.js).
   A Developer account has no Referrals page and is sent to its own home. */
(function () {
  if (!Cashful.app) return;
  var ui = Cashful.ui;
  var R = Cashful.referral;
  var fmt = Cashful.fmt;
  var track = Cashful.track;
  var esc = ui.esc;

  if (Cashful.app.account === 'developer') {
    location.replace(Cashful.api.homeFor(Cashful.app.user, 'developer'));
    return;
  }

  var c = R.settings();
  var root = ui.$('#referrals');
  var state = R.createState(R.scenario());
  var s = R.stats(state);
  var sort = { key: 'joined', dir: 'desc' };
  var expanded = {};

  function icon(name, size) { return '<cf-icon name="' + name + '" size="' + (size || 20) + '"></cf-icon>'; }
  function ratio(part, whole, of) { return whole ? (Math.round(part / whole * 1000) / 10) + '% of ' + of : ''; }

  /* ---------- Copy ---------- */

  function copyText(text) {
    return new Promise(function (resolve) {
      var settled = false;
      function finish(ok) { if (!settled) { settled = true; resolve(ok); } }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { finish(true); }, function () { finish(fallbackCopy(text)); });
        // Some embedded browsers never answer the clipboard permission — don't leave the button without feedback
        setTimeout(function () { finish(fallbackCopy(text)); }, 1500);
      } else finish(fallbackCopy(text));
    });
  }
  function fallbackCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    area.remove();
    return ok;
  }

  function announce(text) {
    var live = ui.$('#ref-live', root);
    live.textContent = '';
    setTimeout(function () { live.textContent = text; }, 30);
  }

  var COPY = {
    link: { event: 'referral_link_copied', done: 'Referral link copied' },
    code: { event: 'referral_code_copied', done: 'Referral code copied' },
    message: { event: 'referral_message_copied', done: 'Message copied' }
  };

  function copyButton(kind, source, cls, label) {
    return '<button type="button" class="cf-btn ' + cls + '" data-copy-kind="' + kind + '" data-source="' + source + '">' +
      icon('copy', 16) + '<span>' + label + '</span></button>';
  }

  function doCopy(btn) {
    var kind = btn.dataset.copyKind;
    var text = kind === 'link' ? R.LINK : kind === 'code' ? R.CODE : ui.$('#ref-message', root).value;
    copyText(text).then(function (ok) {
      var label = ui.$('span', btn);
      if (!btn.dataset.label) btn.dataset.label = label.textContent;
      if (!ok) { announce('Couldn’t copy. Select the text and copy it yourself.'); return; }
      track(COPY[kind].event, { source: btn.dataset.source });
      announce(COPY[kind].done);
      label.textContent = 'Copied';
      ui.$('cf-icon', btn).setAttribute('name', 'check');
      clearTimeout(btn._reset);
      btn._reset = setTimeout(function () {
        label.textContent = btn.dataset.label;
        ui.$('cf-icon', btn).setAttribute('name', 'copy');
      }, 1600);
    });
  }

  /* ---------- Sections ---------- */

  function header() {
    return '<header class="cf-pagehead"><div class="cf-pagehead__row"><div class="cf-pagehead__titles">' +
      '<h1 class="cf-pagehead__title">Referrals</h1>' +
      '<p class="cf-pagehead__desc">' + (c.enabled ? 'Invite friends and earn when they do.' : '') + '</p>' +
    '</div></div></header>';
  }

  function unavailable() {
    return '<section class="cf-card" aria-labelledby="ref-off-title"><div class="cf-empty">' +
      '<span class="cf-tile__chip">' + icon('users', 24) + '</span>' +
      '<h2 class="cf-empty__title" id="ref-off-title">Referrals are not available right now</h2>' +
      '<p class="cf-empty__desc">Check back soon. Your earnings and payouts aren’t affected.</p>' +
      '<a href="dashboard.html" class="cf-btn cf-btn--secondary">Back to Overview</a>' +
    '</div></section>';
  }

  function summaryHtml() {
    return '<section class="cf-card ref-summary" aria-labelledby="ref-summary-title">' +
      '<h2 class="sr-only" id="ref-summary-title">Referral earnings</h2>' +
      '<div class="ref-fig"><span class="ref-fig__label">Total earned from referrals</span>' +
        '<span class="ref-fig__value">' + fmt.money(s.total) + '</span>' +
        '<span class="ref-fig__hint">' + (s.bonus > 0 ? 'Includes ' + fmt.money(s.bonus) + ' in milestone bonuses. ' : '') + 'Added to your Available balance.</span></div>' +
      '<div class="ref-fig"><span class="ref-fig__label">Earned this month</span>' +
        '<span class="ref-fig__value ref-fig__value--sm">' + fmt.money(s.month) + '</span></div>' +
      copyButton('link', 'header', 'cf-btn--primary', 'Copy link') +
    '</section>';
  }

  function shareHtml() {
    return '<section class="cf-card ref-share" aria-labelledby="ref-share-title">' +
      '<h2 class="cf-card__title" id="ref-share-title">Share your link</h2>' +
      '<div class="ref-copyrows">' +
        '<div class="ref-copyrow"><div class="ref-copyrow__main"><span class="ref-copyrow__label">Your link</span><span class="ref-copyrow__value cf-mono">' + esc(R.LINK) + '</span></div>' +
          copyButton('link', 'share', 'cf-btn--secondary cf-btn--sm', 'Copy') + '</div>' +
        '<div class="ref-copyrow"><div class="ref-copyrow__main"><span class="ref-copyrow__label">Your code</span><span class="ref-copyrow__value cf-mono">' + esc(R.CODE) + '</span></div>' +
          copyButton('code', 'share', 'cf-btn--secondary cf-btn--sm', 'Copy') + '</div>' +
      '</div>' +
      '<div class="cf-input"><label class="cf-input__label" for="ref-message">Share message</label>' +
        '<div class="cf-field cf-field--area"><textarea class="cf-field__input" id="ref-message" rows="3">' + esc(R.shareMessage(c)) + '</textarea></div>' +
        '<div class="cf-input__helper">Your link is already in the message. Edit the text before you share it.</div></div>' +
      '<div class="ref-actions">' +
        copyButton('message', 'share', 'cf-btn--secondary', 'Copy message') +
        '<a class="cf-btn cf-btn--secondary" id="ref-email" data-share="email" href="#">' + icon('external-link', 20) + '<span>Share by email</span></a>' +
        '<button type="button" class="cf-btn cf-btn--secondary" id="ref-system" data-share="system" hidden>' + icon('upload', 20) + '<span>Share…</span></button>' +
      '</div>' +
    '</section>';
  }

  function howHtml() {
    return '<div class="section-head"><h2 class="section-head__title">How it works</h2><span class="section-head__desc">' + esc(R.summaryLine(c)) + '</span></div>' +
      '<div class="cf-grid cf-grid--3">' + R.steps(c).map(function (st) {
        return '<div class="cf-card how-card"><span class="how-card__icon">' + icon(st.icon) + '</span>' +
          '<div class="stack-4"><span class="how-card__title">' + esc(st.title) + '</span><span class="t-muted">' + esc(st.text) + '</span></div></div>';
      }).join('') + '</div>' +
      '<p class="ref-trust">' + icon('shield', 20) + esc(R.TRUST) + '</p>';
  }

  function funnelHtml() {
    var f = s.funnel;
    return '<div class="section-head"><h2 class="section-head__title">Your funnel</h2></div>' +
      '<div class="cf-grid cf-grid--4">' +
        ui.statCard({ label: 'Link visits', value: String(f.visits), icon: 'external-link' }) +
        ui.statCard({ label: 'Sign-ups', value: String(f.signups), icon: 'user', caption: ratio(f.signups, f.visits, 'visits') }) +
        ui.statCard({ label: 'Connected', value: String(f.connected), icon: 'smartphone', caption: ratio(f.connected, f.signups, 'sign-ups') }) +
        ui.statCard({ label: 'Qualified', value: String(f.qualified), icon: 'check-circle', caption: ratio(f.qualified, f.connected, 'connected') }) +
      '</div>';
  }

  function milestonesHtml() {
    if (!c.milestonesEnabled || !c.milestones.length) return '';
    var q = s.qualified;
    var progress = s.next
      ? '<div class="ref-progress"><div class="ref-progress__label"><span>' + q + ' of ' + s.next.qualified + ' qualified friends</span><span>Next bonus ' + R.dollars(s.next.bonus) + '</span></div>' +
        '<div class="cf-progress" role="progressbar" aria-label="Progress to the next milestone" aria-valuemin="0" aria-valuemax="' + s.next.qualified + '" aria-valuenow="' + q + '">' +
        '<div class="cf-progress__bar" style="width:' + Math.min(100, Math.floor(q / s.next.qualified * 100)) + '%"></div></div></div>'
      : '<p class="t-body">You’ve reached every milestone. Thank you for spreading the word.</p>';
    return '<section class="cf-card" id="ref-milestones" aria-labelledby="ref-milestones-title">' +
      '<div class="cf-card__head"><h2 class="cf-card__title" id="ref-milestones-title">Milestones</h2></div>' +
      '<span class="t-muted">One-time bonuses for reaching a number of qualified friends. They’re added to what you’ve earned.' + (s.bonus > 0 ? ' You’ve earned ' + fmt.money(s.bonus) + ' so far.' : '') + '</span>' +
      progress +
      '<ul class="ref-milestones">' + c.milestones.map(function (m) {
        var done = q >= m.qualified;
        return '<li class="ref-milestone' + (done ? ' is-done' : '') + '">' +
          '<span class="ref-milestone__icon">' + icon(done ? 'check-circle' : 'clock') + '</span>' +
          '<span class="ref-milestone__text">' + m.qualified + ' qualified friends</span>' +
          '<span class="ref-milestone__bonus">' + R.dollars(m.bonus) + '</span>' +
          (done ? '<span class="cf-badge cf-badge--success"><span class="cf-badge__dot"></span>Achieved</span>'
                : '<span class="cf-badge cf-badge--neutral">' + (m.qualified - q) + ' to go</span>') +
        '</li>';
      }).join('') + '</ul></section>';
  }

  function tableSectionHtml() {
    return '<section class="cf-card cf-card--flush" aria-labelledby="ref-table-title">' +
      '<div class="cf-card__head"><h2 class="cf-card__title" id="ref-table-title" tabindex="-1">Your referrals</h2>' +
        (state.rows.length ? '<span class="cf-card__meta">' + state.rows.length + (state.rows.length === 1 ? ' friend' : ' friends') + '</span>' : '') + '</div>' +
      '<div id="ref-table"></div></section>';
  }

  function rulesHtml() {
    return '<details class="cf-disclosure" id="ref-rules">' +
      '<summary class="cf-disclosure__summary"><span>Rules</span>' + icon('chevron-down') + '</summary>' +
      '<div class="cf-disclosure__body"><ul class="ref-rules">' + R.rules(c).map(function (r) {
        return '<li><div class="ref-rule__title">' + esc(r.title) + '</div><div class="ref-rule__text">' + esc(r.text) + '</div></li>';
      }).join('') + '</ul><div><a href="#terms" data-soon="Terms">Read the Terms</a></div></div></details>';
  }

  /* ---------- Table ---------- */

  function sortedRows() {
    var k = sort.key === 'joined' ? 'joined' : 'earnings';
    var dir = sort.dir === 'asc' ? 1 : -1;
    return state.rows.slice().sort(function (a, b) { return (a[k] - b[k]) * dir; });
  }

  function th(label, key, right) {
    var on = sort.key === key;
    var cls = right ? ' class="is-right"' : '';
    return '<th scope="col"' + cls + (on ? ' aria-sort="' + (sort.dir === 'asc' ? 'ascending' : 'descending') + '"' : '') + '>' +
      '<button type="button" class="ref-sort" data-sort="' + key + '">' + label +
      icon(on && sort.dir === 'asc' ? 'chevron-up' : 'chevron-down', 16) + '</button></th>';
  }

  function renderTable() {
    var el = ui.$('#ref-table', root);
    if (!state.rows.length) {
      el.innerHTML = '<div class="cf-empty"><span class="cf-tile__chip">' + icon('users', 24) + '</span>' +
        '<h3 class="cf-empty__title">No referrals yet</h3>' +
        '<p class="cf-empty__desc">Share your link with friends. When they sign up, they show up here with their progress.</p>' +
        copyButton('link', 'empty-state', 'cf-btn--primary', 'Copy link') + '</div>';
      return;
    }
    el.innerHTML = '<div class="cf-table-wrap"><table class="cf-table ref-table">' +
      '<thead><tr><th scope="col">Friend</th>' + th('Joined', 'joined') + '<th scope="col">Status</th>' + th('Your earnings', 'earnings', true) +
      '<th scope="col"><span class="sr-only">Details</span></th></tr></thead>' +
      '<tbody>' + sortedRows().map(row).join('') + '</tbody></table></div>';
  }

  function statusCell(r) {
    var badge = '<span class="cf-badge cf-badge--' + R.STATUS_TONE[r.status] + '" title="' + esc(R.statusHint(r, c)) + '"><span class="cf-badge__dot"></span>' + r.status + '</span>';
    if (r.status === 'Connected') {
      var need = fmt.toCents(c.qualificationEarnings);
      var pct = Math.min(100, Math.floor(r.progress / need * 100));
      badge += '<div class="ref-mini"><span class="t-caption t-secondary">' + fmt.money(r.progress) + ' of ' + fmt.money(need) + '</span>' +
        '<div class="cf-progress" role="progressbar" aria-label="Progress to qualification for ' + esc(R.maskEmail(r.email)) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '">' +
        '<div class="cf-progress__bar" style="width:' + pct + '%"></div></div></div>';
    }
    if (r.status === 'Not counted') badge += '<div class="cf-table__sub">' + esc(R.REASONS[r.reason].label) + '</div>';
    return badge;
  }

  function earningsCell(r) {
    if (r.status === 'Qualified') return '<div class="cf-table__amount">' + fmt.money(r.earnings) + '</div><div class="cf-table__sub">Earning until ' + fmt.date(r.rewardEndsAt) + '</div>';
    if (r.status === 'Reward ended') return '<div class="cf-table__amount">' + fmt.money(r.earnings) + '</div><div class="cf-table__sub">Ended ' + fmt.date(r.rewardEndsAt) + '</div>';
    return '<span class="t-secondary">—</span>';
  }

  function row(r) {
    var name = R.maskEmail(r.email);
    var open = !!expanded[r.id];
    var toggle = r.status === 'Not counted'
      ? '<button type="button" class="cf-ibtn cf-ibtn--ghost cf-ibtn--sm" data-act="toggle" data-id="' + r.id + '" aria-expanded="' + open + '" aria-controls="reason-' + r.id + '" aria-label="' + (open ? 'Hide' : 'Show') + ' why ' + esc(name) + ' isn’t counted">' + icon(open ? 'chevron-up' : 'chevron-down') + '</button>'
      : '';
    return '<tr><td class="cf-table__primary">' + esc(name) + '</td>' +
      '<td>' + fmt.date(r.joined) + '</td>' +
      '<td>' + statusCell(r) + '</td>' +
      '<td class="is-right">' + earningsCell(r) + '</td>' +
      '<td class="is-right">' + toggle + '</td></tr>' +
      (r.status === 'Not counted' && open
        ? '<tr class="ref-reason" id="reason-' + r.id + '"><td colspan="5"><div class="ref-reason__box">' + icon('info') + '<span><strong>Not counted.</strong> ' + esc(R.REASONS[r.reason].text) + '</span></div></td></tr>'
        : '');
  }

  /* ---------- Render and events ---------- */

  function render() {
    if (!c.enabled) { root.innerHTML = header() + unavailable(); return; }
    root.innerHTML = '<div class="sr-only" role="status" aria-live="polite" id="ref-live"></div>' +
      header() + summaryHtml() + shareHtml() + howHtml() + funnelHtml() + milestonesHtml() + tableSectionHtml() + rulesHtml();
    renderTable();
    updateEmailLink();

    // The system share sheet only exists in some browsers
    if (navigator.share) ui.$('#ref-system', root).hidden = false;

    ui.$('#ref-rules', root).addEventListener('toggle', function (e) {
      if (e.target.open) track('referral_rules_opened', { source: 'referrals' });
    });

    var ms = ui.$('#ref-milestones', root);
    if (ms) {
      var fire = function () { track('referral_milestone_viewed', { qualified: s.qualified, achieved: s.achieved.length }); };
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
          if (entries.some(function (en) { return en.isIntersecting; })) { fire(); io.disconnect(); }
        });
        io.observe(ms);
      } else fire();
    }
  }

  function updateEmailLink() {
    var body = ui.$('#ref-message', root).value;
    ui.$('#ref-email', root).href = 'mailto:?subject=' + encodeURIComponent(c.shareEmailSubject) + '&body=' + encodeURIComponent(body);
  }

  root.addEventListener('input', function (e) { if (e.target.id === 'ref-message') updateEmailLink(); });

  root.addEventListener('click', function (e) {
    var copy = e.target.closest('[data-copy-kind]');
    if (copy) { doCopy(copy); return; }

    var share = e.target.closest('[data-share]');
    if (share) {
      var channel = share.dataset.share;
      track('referral_share_clicked', { channel: channel });
      if (channel === 'system') {
        navigator.share({ title: c.shareEmailSubject, text: ui.$('#ref-message', root).value }).catch(function () { /* dismissed */ });
      }
      return;
    }

    var sorter = e.target.closest('[data-sort]');
    if (sorter) {
      var key = sorter.dataset.sort;
      sort = { key: key, dir: sort.key === key && sort.dir === 'desc' ? 'asc' : 'desc' };
      renderTable();
      var again = ui.$('[data-sort="' + key + '"]', root);
      if (again) again.focus();
      return;
    }

    var toggle = e.target.closest('[data-act="toggle"]');
    if (toggle) {
      var id = toggle.dataset.id;
      expanded[id] = !expanded[id];
      if (expanded[id]) {
        var r = state.rows.filter(function (x) { return x.id === id; })[0];
        track('referral_row_expanded', { status: r.status, reason: r.reason });
      }
      renderTable();
      var back = ui.$('[data-act="toggle"][data-id="' + id + '"]', root);
      if (back) back.focus();
    }
  });

  render();
})();
