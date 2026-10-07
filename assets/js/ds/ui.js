/* Cashful DS — behaviour for the static components: inputs, OTP, alerts, toasts, views. */
(function () {
  var ui = {};

  ui.$ = function (sel, root) { return (root || document).querySelector(sel); };
  ui.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  ui.params = new URLSearchParams(location.search);

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  ui.esc = esc;

  /* ---------- Input ----------
     Markup: .cf-input > .cf-input__label + .cf-field > input + .cf-input__helper
     The helper's initial text is restored when the error clears. */
  function wrapOf(input) { return input.closest('.cf-input, .cf-check-group'); }

  ui.setError = function (input, message) {
    var wrap = wrapOf(input);
    var helper = ui.$('.cf-input__helper, .cf-check-group__error', wrap);
    if (helper && helper.dataset.default == null) helper.dataset.default = helper.textContent;
    wrap.classList.toggle('is-error', !!message);
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (helper) helper.textContent = message || helper.dataset.default;
  };

  ui.setHelper = function (input, text) {
    var helper = ui.$('.cf-input__helper', wrapOf(input));
    helper.textContent = text;
    helper.dataset.default = text;
  };

  ui.setDisabled = function (input, disabled) {
    input.disabled = disabled;
    var wrap = wrapOf(input);
    if (wrap) wrap.classList.toggle('is-disabled', disabled);
  };

  // Typing into a field clears its error
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.matches && t.matches('.cf-field__input') && wrapOf(t).classList.contains('is-error')) ui.setError(t, '');
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.matches && t.matches('.cf-check__input') && t.checked && t.closest('.cf-check-group.is-error')) ui.setError(t, '');
  });

  /* ---------- Validators ---------- */
  ui.isEmail = function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); };
  ui.isStrongPassword = function (v) { return v.length >= 8 && /\d/.test(v); };

  /* ---------- Buttons ---------- */
  ui.setLoading = function (btn, loading) {
    btn.classList.toggle('is-loading', loading);
    btn.disabled = loading;
    btn.setAttribute('aria-busy', loading ? 'true' : 'false');
  };

  /** Runs an async action with the button in its loading state. */
  ui.withLoading = function (btn, fn) {
    ui.setLoading(btn, true);
    return Promise.resolve().then(fn).finally(function () { ui.setLoading(btn, false); });
  };

  /* ---------- OTP ----------
     <div class="cf-otp" data-otp></div> → 6 cells with auto-advance, backspace and paste. */
  ui.otp = function (root, opts) {
    opts = opts || {};
    var length = opts.length || 6;
    var cellsWrap = document.createElement('div');
    cellsWrap.className = 'cf-otp__cells';
    var error = document.createElement('p');
    error.className = 'cf-otp__error';
    error.setAttribute('role', 'alert');
    error.hidden = true;

    var cells = [];
    for (var i = 0; i < length; i++) {
      var c = document.createElement('input');
      c.className = 'cf-otp__cell';
      c.inputMode = 'numeric';
      c.autocomplete = i === 0 ? 'one-time-code' : 'off';
      c.maxLength = 1;
      c.placeholder = '·';
      c.setAttribute('aria-label', 'Digit ' + (i + 1));
      cells.push(c);
      cellsWrap.appendChild(c);
    }
    root.appendChild(cellsWrap);
    root.appendChild(error);

    function value() { return cells.map(function (c) { return c.value; }).join(''); }
    function fill(from, digits) {
      for (var k = 0; k < digits.length && from + k < length; k++) cells[from + k].value = digits[k];
      cells[Math.min(from + digits.length, length - 1)].focus();
    }
    function changed() {
      api.setError('');
      if (opts.onChange) opts.onChange(value());
      if (value().length === length && opts.onComplete) opts.onComplete(value());
    }

    cells.forEach(function (cell, idx) {
      cell.addEventListener('input', function () {
        var digits = cell.value.replace(/\D/g, '');
        cell.value = '';
        if (digits) fill(idx, digits);
        changed();
      });
      cell.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !cell.value && idx > 0) { cells[idx - 1].value = ''; cells[idx - 1].focus(); changed(); e.preventDefault(); }
        if (e.key === 'ArrowLeft' && idx > 0) cells[idx - 1].focus();
        if (e.key === 'ArrowRight' && idx < length - 1) cells[idx + 1].focus();
        if (e.key === 'Enter' && opts.onEnter) opts.onEnter(value());
      });
      cell.addEventListener('paste', function (e) {
        var digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '');
        if (!digits) return;
        e.preventDefault();
        fill(idx, digits);
        changed();
      });
      cell.addEventListener('focus', function () { cell.select(); });
    });

    var api = {
      value: value,
      isComplete: function () { return value().length === length; },
      focus: function () { (cells.filter(function (c) { return !c.value; })[0] || cells[length - 1]).focus(); },
      clear: function () { cells.forEach(function (c) { c.value = ''; }); api.setError(''); cells[0].focus(); },
      set: function (digits) { fill(0, digits); },
      setError: function (msg) {
        root.classList.toggle('is-error', !!msg);
        error.hidden = !msg;
        error.textContent = msg || '';
      },
      setDisabled: function (d) { cells.forEach(function (c) { c.disabled = d; }); }
    };
    return api;
  };

  /* ---------- Alert ---------- */
  var ALERT_ICONS = { info: 'info', success: 'check-circle', warning: 'alert', error: 'x-circle' };

  /** Renders an alert into `slot` (replacing its content). Pass null to clear. */
  ui.alert = function (slot, a) {
    if (!a) { slot.innerHTML = ''; slot.hidden = true; return; }
    var tone = a.tone || 'info';
    slot.hidden = false;
    slot.innerHTML =
      '<div class="cf-alert cf-alert--' + tone + '" role="' + (tone === 'error' ? 'alert' : 'status') + '">' +
        '<cf-icon class="cf-alert__icon" name="' + ALERT_ICONS[tone] + '" size="20"></cf-icon>' +
        '<div class="cf-alert__text">' +
          (a.title ? '<div class="cf-alert__title">' + esc(a.title) + '</div>' : '') +
          (a.text ? '<div class="cf-alert__desc">' + (a.html ? a.text : esc(a.text)) + '</div>' : '') +
        '</div>' +
      '</div>';
  };

  /** Alert markup as a string — for pages that render whole sections. */
  ui.alertHtml = function (a) {
    var tone = a.tone || 'info';
    return '<div class="cf-alert cf-alert--' + tone + '" role="' + (tone === 'error' ? 'alert' : 'status') + '">' +
      '<cf-icon class="cf-alert__icon" name="' + ALERT_ICONS[tone] + '" size="20"></cf-icon>' +
      '<div class="cf-alert__text"><div class="cf-alert__title">' + esc(a.title) + '</div>' +
      (a.text ? '<div class="cf-alert__desc">' + esc(a.text) + '</div>' : '') + '</div></div>';
  };

  /* ---------- StatCard ----------
     ui.statCard({ label, value, icon, caption, delta, trend: 'up'|'down', brand }) */
  ui.statCard = function (s) {
    var up = s.trend !== 'down';
    var foot = (s.delta || s.caption)
      ? '<div class="cf-stat__foot">' +
          (s.delta ? '<span class="cf-stat__delta ' + (up ? 'is-up' : 'is-down') + '"><cf-icon name="' + (up ? 'arrow-up-right' : 'arrow-down-right') + '" size="16"></cf-icon>' + esc(s.delta) + '</span>' : '') +
          (s.caption ? '<span class="cf-stat__caption">' + esc(s.caption) + '</span>' : '') +
        '</div>'
      : '';
    return '<div class="cf-stat' + (s.brand ? ' cf-stat--brand' : '') + '">' +
      '<div class="cf-stat__top"><span class="cf-stat__label">' + esc(s.label) + '</span><span class="cf-stat__chip"><cf-icon name="' + s.icon + '" size="20"></cf-icon></span></div>' +
      '<div class="cf-stat__value">' + esc(s.value) + '</div>' + foot + '</div>';
  };

  /* ---------- Toast ---------- */
  ui.toast = function (text, icon) {
    var host = ui.$('.cf-toast-host');
    if (!host) {
      host = document.createElement('div');
      host.className = 'cf-toast-host';
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    var t = document.createElement('div');
    t.className = 'cf-toast';
    t.innerHTML = '<cf-icon name="' + (icon || 'check-circle') + '" size="20"></cf-icon><span>' + esc(text) + '</span>';
    host.appendChild(t);
    setTimeout(function () { t.remove(); }, 3200);
  };

  /* ---------- Notice ----------
     Corner notification with a title, used when something happens in the background
     (a device connected). Dismissible, hides itself after `timeout` ms. */
  ui.notice = function (n) {
    var el = document.createElement('div');
    el.className = 'cf-notice';
    el.setAttribute('role', 'status');
    el.innerHTML =
      '<cf-icon class="cf-notice__icon" name="' + (n.icon || 'check-circle') + '" size="24"></cf-icon>' +
      '<div class="cf-notice__text"><span class="cf-notice__title">' + esc(n.title) + '</span>' +
      (n.text ? '<span class="cf-notice__desc">' + esc(n.text) + '</span>' : '') + '</div>' +
      '<button type="button" class="cf-notice__close" aria-label="Dismiss"><cf-icon name="close" size="16"></cf-icon></button>';
    document.body.appendChild(el);
    function close() { el.remove(); }
    el.querySelector('.cf-notice__close').addEventListener('click', close);
    setTimeout(close, n.timeout || 8000);
    return close;
  };

  /* ---------- Modal ----------
     ui.modal({ title, body: html, footer: html, width, onClose }) → { el, close }
     Closes on Esc, backdrop click and any [data-close] inside. Focus returns to the opener. */
  ui.modal = function (m) {
    var opener = document.activeElement;
    var overlay = document.createElement('div');
    overlay.className = 'cf-overlay';
    overlay.innerHTML =
      '<div class="cf-modal" role="dialog" aria-modal="true" aria-label="' + esc(m.title) + '"' + (m.width ? ' style="width:' + m.width + 'px"' : '') + '>' +
        '<div class="cf-modal__head"><h3 class="cf-modal__title">' + esc(m.title) + '</h3>' +
          '<button type="button" class="cf-ibtn cf-ibtn--ghost cf-ibtn--sm" aria-label="Close" data-close><cf-icon name="close" size="20"></cf-icon></button></div>' +
        '<div class="cf-modal__body">' + (m.body || '') + '</div>' +
        (m.footer ? '<div class="cf-modal__foot">' + m.footer + '</div>' : '') +
      '</div>';
    document.body.appendChild(overlay);
    document.body.classList.add('has-modal');

    var closed = false;
    function close(reason) {
      if (closed) return;
      closed = true;
      overlay.remove();
      document.body.classList.remove('has-modal');
      document.removeEventListener('keydown', onKey);
      if (opener && opener.focus) opener.focus();
      if (m.onClose) m.onClose(reason);
    }
    var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    function focusables() {
      return ui.$$(FOCUSABLE, overlay).filter(function (el) { return !el.closest('[hidden]'); });
    }
    function onKey(e) {
      if (e.key === 'Escape') { close('escape'); return; }
      if (e.key !== 'Tab') return;
      // Keep Tab inside the dialog
      var items = focusables();
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (!overlay.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close('backdrop');
      if (e.target.closest('[data-close]')) close('button');
    });

    /** Initial focus: [data-autofocus] if present, otherwise the first body control, otherwise Close. */
    function focusInitial() {
      var target = ui.$('[data-autofocus]', overlay) ||
        ui.$('.cf-modal__body button, .cf-modal__body a[href], .cf-modal__foot button', overlay) ||
        ui.$('[data-close]', overlay);
      target.focus();
    }
    focusInitial();

    /** Replaces the title, body and footer in place (multi-step dialogs). */
    function update(next) {
      var dialog = ui.$('.cf-modal', overlay);
      if (next.title != null) {
        ui.$('.cf-modal__title', overlay).textContent = next.title;
        dialog.setAttribute('aria-label', next.title);
      }
      if (next.body != null) ui.$('.cf-modal__body', overlay).innerHTML = next.body;
      if (next.footer != null) {
        var foot = ui.$('.cf-modal__foot', overlay);
        if (!foot) { foot = document.createElement('div'); foot.className = 'cf-modal__foot'; dialog.appendChild(foot); }
        foot.innerHTML = next.footer;
      }
      focusInitial();
    }
    return { el: overlay, close: close, update: update };
  };

  /* ---------- Tabs ----------
     ui.tabs(container, ['Today', '7 days'], 'Today', onChange) */
  ui.tabs = function (container, items, value, onChange) {
    container.className = 'cf-tabs';
    container.setAttribute('role', 'tablist');
    function render() {
      container.innerHTML = items.map(function (t) {
        var on = t === value;
        return '<button type="button" role="tab" class="cf-tab' + (on ? ' is-on' : '') + '" aria-selected="' + on + '" data-tab="' + esc(t) + '">' + esc(t) + '</button>';
      }).join('');
    }
    container.onclick = function (e) {
      var b = e.target.closest('[data-tab]');
      if (!b || b.dataset.tab === value) return;
      value = b.dataset.tab;
      render();
      onChange(value);
    };
    render();
  };

  /* ---------- Copy field ----------
     <div class="cf-copy"><span class="cf-copy__value">…</span><button data-copy="…">…</button></div> */
  ui.copyField = function (value) {
    return '<div class="cf-copy"><span class="cf-copy__value">' + esc(value) + '</span>' +
      '<button type="button" class="cf-ibtn cf-ibtn--ghost cf-ibtn--sm" aria-label="Copy" data-copy="' + esc(value) + '"><cf-icon name="copy" size="16"></cf-icon></button></div>';
  };

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-copy]');
    if (!btn) return;
    var text = btn.dataset.copy;
    try {
      var p = navigator.clipboard && navigator.clipboard.writeText(text);
      if (p) p.catch(function () { /* no permission (e.g. file://) — the check mark still shows */ });
    } catch (err) { /* clipboard API unavailable */ }
    var icon = btn.querySelector('cf-icon');
    icon.setAttribute('name', 'check');
    btn.setAttribute('aria-label', 'Copied');
    setTimeout(function () { icon.setAttribute('name', 'copy'); btn.setAttribute('aria-label', 'Copy'); }, 1400);
  });

  /* ---------- Views ----------
     A page holds several states as <section data-view="name">; only one is visible. */
  ui.showView = function (name) {
    ui.$$('[data-view]').forEach(function (v) { v.hidden = v.dataset.view !== name; });
    var first = ui.$('[data-view="' + name + '"] input:not([disabled]):not([hidden]):not([type="checkbox"])');
    if (first) first.focus();
  };

  /* ---------- Time ---------- */
  ui.formatTime = function (sec) {
    sec = Math.max(0, Math.ceil(sec));
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  };

  /** Ticks every second until `until` (ms timestamp). Returns a stop function. */
  ui.countdown = function (until, onTick, onDone) {
    function tick() {
      var left = (until - Date.now()) / 1000;
      if (left <= 0) { clearInterval(id); onDone && onDone(); return; }
      onTick(left);
    }
    var id = setInterval(tick, 1000);
    tick();
    return function () { clearInterval(id); };
  };

  ui.go = function (url, delay) {
    setTimeout(function () { location.href = url; }, delay || 0);
  };

  Cashful.ui = ui;
})();
