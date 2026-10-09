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

  /* ---------- Samples: nothing is required in the prototype ----------
     When a form is submitted, an empty field is filled with a sample value first, so a reviewer can click through
     without typing anything. The sample is data-sample, else one that fits the field's type, else its placeholder.
     Left alone: checkboxes, files, search, one-time codes, and anything marked data-no-sample (a referral code,
     the word that confirms a deletion). A form with data-strict is never filled. */
  var SAMPLE_BY_TYPE = { email: 'demo@example.com', password: 'cashful123', url: 'https://example.com/app', tel: '+1 555 0100', number: '100' };
  ui.sampleFor = function (el) {
    if (el.dataset.sample) return el.dataset.sample;
    if (SAMPLE_BY_TYPE[el.type]) return SAMPLE_BY_TYPE[el.type];
    if (el.getAttribute('inputmode') === 'numeric') return '100';
    var ph = (el.getAttribute('placeholder') || '').replace(/^e\.g\.\s*/i, '').replace(/…$/, '').trim();
    return ph && ph.length > 2 && !/^(\d+ digits|at least)/i.test(ph) ? ph : 'Sample';
  };
  function fillSamples(form) {
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.disabled || el.readOnly || el.type === 'hidden' || el.hasAttribute('data-no-sample') || el.closest('.cf-otp')) return;
      if (el.tagName === 'SELECT') {
        if (el.value === '') {
          for (var i = 0; i < el.options.length; i++) if (el.options[i].value !== '') { el.selectedIndex = i; el.dispatchEvent(new Event('change', { bubbles: true })); break; }
        }
        return;
      }
      if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return;
      if (/^(checkbox|radio|file|submit|button|search|range|color)$/.test(el.type)) return;
      if (el.value.trim() !== '') return;
      el.value = ui.sampleFor(el);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
  // Capture phase: runs before the form's own submit handler
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f && f.tagName === 'FORM' && !f.hasAttribute('data-strict')) fillSamples(f);
  }, true);

  // Typing into a field clears its error
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.matches && t.matches('.cf-field__input') && wrapOf(t).classList.contains('is-error')) ui.setError(t, '');
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.matches && t.matches('.cf-check__input') && t.checked && t.closest('.cf-check-group.is-error')) ui.setError(t, '');
  });

  /* ---------- Field markup (for pages that render forms from JS) ----------
     ui.fieldHtml({ id, name, label, value, type, placeholder, helper, inputmode, autocomplete, maxlength,
                    spellcheck, autofocus, disabled, sample, noSample })
     sample: what an empty field gets when its form is submitted (see "Samples" below); noSample: leave it empty
     ui.selectHtml({ id, name, label, options, value, helper }) — options: strings or { value, label } */
  ui.selectOptions = function (options, value) {
    return options.map(function (opt) {
      if (typeof opt === 'string') opt = { value: opt, label: opt };
      return '<option value="' + esc(opt.value) + '"' + (opt.value === value ? ' selected' : '') + '>' + esc(opt.label) + '</option>';
    }).join('');
  };

  ui.fieldHtml = function (o) {
    return '<div class="cf-input' + (o.disabled ? ' is-disabled' : '') + '"><label class="cf-input__label" for="' + o.id + '">' + esc(o.label) + '</label>' +
      '<div class="cf-field"><input class="cf-field__input" id="' + o.id + '" name="' + o.name + '" type="' + (o.type || 'text') + '" value="' + esc(o.value || '') + '"' +
      (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : '') +
      (o.inputmode ? ' inputmode="' + o.inputmode + '"' : '') +
      ' autocomplete="' + (o.autocomplete || 'off') + '"' +
      (o.maxlength ? ' maxlength="' + o.maxlength + '"' : '') +
      (o.spellcheck === false ? ' spellcheck="false"' : '') +
      (o.autofocus ? ' data-autofocus' : '') +
      (o.sample ? ' data-sample="' + esc(o.sample) + '"' : '') +
      (o.noSample ? ' data-no-sample' : '') +
      (o.disabled ? ' disabled' : '') + '></div>' +
      '<div class="cf-input__helper">' + (o.helperHtml || esc(o.helper || '')) + '</div></div>';
  };

  ui.selectHtml = function (o) {
    return '<div class="cf-input"><label class="cf-input__label" for="' + o.id + '">' + esc(o.label) + '</label>' +
      '<div class="cf-field cf-field--select"><select class="cf-field__input" id="' + o.id + '" name="' + o.name + '">' +
      ui.selectOptions(o.options, o.value) + '</select><cf-icon name="chevron-down" size="20"></cf-icon></div>' +
      '<div class="cf-input__helper">' + esc(o.helper || '') + '</div></div>';
  };

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
  /** `a.close` = { label, tooltip } adds an X button at the right edge (data-alert-close). */
  ui.alertHtml = function (a) {
    var tone = a.tone || 'info';
    var close = a.close
      ? '<button type="button" class="cf-alert__close cf-ibtn cf-ibtn--ghost cf-ibtn--sm" data-alert-close aria-label="' + esc(a.close.label || 'Close') + '"' +
        (a.close.tooltip ? ' data-tooltip="' + esc(a.close.tooltip) + '" aria-describedby="alert-close-tip"' : '') + '>' +
        '<cf-icon name="close" size="20"></cf-icon>' +
        (a.close.tooltip ? '<span class="sr-only" id="alert-close-tip">' + esc(a.close.tooltip) + '</span>' : '') + '</button>'
      : '';
    return '<div class="cf-alert cf-alert--' + tone + '" role="' + (tone === 'error' ? 'alert' : 'status') + '">' +
      '<cf-icon class="cf-alert__icon" name="' + ALERT_ICONS[tone] + '" size="20"></cf-icon>' +
      '<div class="cf-alert__text"><div class="cf-alert__title">' + esc(a.title) + '</div>' +
      (a.text ? '<div class="cf-alert__desc">' + esc(a.text) + '</div>' : '') + '</div>' + close + '</div>';
  };

  /* ---------- StatCard ----------
     ui.statCard({ label, value, icon, caption, delta, trend: 'up'|'down'|'flat', brand,
                   info, badgeHtml, footHtml })
     info      — adds an info button with a tooltip (reachable by keyboard)
     badgeHtml — next to the label (e.g. a "Live" indicator); footHtml — extra line at the bottom (escaped by the caller)
     'flat' shows the delta with a neutral arrow. Without the optional fields the markup is the original one. */
  var statUid = 0;
  ui.statCard = function (s) {
    var trend = s.trend || 'up';
    var arrow = { up: 'arrow-up-right', down: 'arrow-down-right', flat: 'arrow-right' }[trend];
    var foot = (s.delta || s.caption || s.footHtml)
      ? '<div class="cf-stat__foot">' +
          (s.delta ? '<span class="cf-stat__delta is-' + trend + '"><cf-icon name="' + arrow + '" size="16"></cf-icon>' + esc(s.delta) + '</span>' : '') +
          (s.caption ? '<span class="cf-stat__caption">' + esc(s.caption) + '</span>' : '') +
          (s.footHtml || '') +
        '</div>'
      : '';
    var info = '';
    if (s.info) {
      var tipId = 'stat-tip-' + (++statUid);
      info = '<button type="button" class="cf-stat__info" data-tooltip="' + esc(s.info) + '" aria-label="About ' + esc(s.label) + '" aria-describedby="' + tipId + '">' +
        '<cf-icon name="info" size="16"></cf-icon><span class="sr-only" id="' + tipId + '">' + esc(s.info) + '</span></button>';
    }
    return '<div class="cf-stat' + (s.brand ? ' cf-stat--brand' : '') + '">' +
      '<div class="cf-stat__top"><span class="cf-stat__label">' + esc(s.label) + info + '</span>' + (s.badgeHtml || '') +
        '<span class="cf-stat__chip"><cf-icon name="' + s.icon + '" size="20"></cf-icon></span></div>' +
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

  /* ---------- Clipboard ----------
     ui.copyText(text) → Promise<boolean>. Falls back to execCommand, and doesn't hang when an embedded
     browser never answers the clipboard permission. */
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
  ui.copyText = function (text) {
    return new Promise(function (resolve) {
      var settled = false;
      function finish(ok) { if (!settled) { settled = true; resolve(ok); } }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { finish(true); }, function () { finish(fallbackCopy(text)); });
        setTimeout(function () { finish(fallbackCopy(text)); }, 1500);
      } else finish(fallbackCopy(text));
    });
  };

  /** Saves text as a file generated in the browser (CSV export, placeholder downloads). */
  ui.downloadFile = function (name, text, mime) {
    var url = URL.createObjectURL(new Blob([text], { type: mime || 'text/plain;charset=utf-8' }));
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  };

  /* ---------- Timeline ----------
     ui.timeline([{ title, date, text, tone }]) → a vertical list, oldest first. `text` is escaped and may be empty.
     `tone` ('success'|'warning'|'error') tints the dot; the title says what happened, so colour never carries it alone. */
  ui.timeline = function (items) {
    return '<ol class="cf-timeline">' + items.map(function (it) {
      return '<li class="cf-timeline__item' + (it.tone ? ' is-' + it.tone : '') + '"><span class="cf-timeline__dot" aria-hidden="true"></span>' +
        '<div class="cf-timeline__body"><div class="cf-timeline__head"><span class="cf-timeline__title">' + esc(it.title) + '</span>' +
        '<time class="cf-timeline__date">' + esc(it.date) + '</time></div>' +
        (it.meta ? '<div class="cf-timeline__meta">' + esc(it.meta) + '</div>' : '') +
        (it.text ? '<p class="cf-timeline__text">' + esc(it.text) + '</p>' : '') + '</div></li>';
    }).join('') + '</ol>';
  };

  /* ---------- CodeBlock ----------
     ui.codeBlock({ code, label, id }) → markup of a labelled, scrollable block with a Copy button.
     The Copy button carries data-code-copy; the page decides what copying does (announce, track). */
  ui.codeBlock = function (o) {
    return '<div class="cf-code-block" role="group" aria-label="' + esc(o.label) + '"' + (o.id ? ' data-code="' + esc(o.id) + '"' : '') + '>' +
      '<div class="cf-code-block__bar"><span class="cf-code-block__label">' + esc(o.label) + '</span>' +
      '<button type="button" class="cf-btn cf-btn--secondary cf-btn--sm" data-code-copy><cf-icon name="copy" size="16"></cf-icon><span>Copy</span></button></div>' +
      '<pre class="cf-code-block__pre" tabindex="0"><code>' + esc(o.code) + '</code></pre></div>';
  };

  /** Shows "Copied" on a copy button for a moment. */
  ui.flashCopied = function (btn) {
    var label = ui.$('span', btn);
    if (!btn.dataset.label) btn.dataset.label = label.textContent;
    label.textContent = 'Copied';
    ui.$('cf-icon', btn).setAttribute('name', 'check');
    clearTimeout(btn._reset);
    btn._reset = setTimeout(function () {
      label.textContent = btn.dataset.label;
      ui.$('cf-icon', btn).setAttribute('name', 'copy');
    }, 1600);
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
