/* Cashful DS — form controls rendered from JS.
   segmented(el, opts)  — a radio group drawn as a segmented control (native radios: the arrow keys and the
                          announced "checked" state come for free).
   dropdown(el, opts)   — a listbox select whose options can carry HTML (badges) and be disabled with a tooltip. */
(function () {
  var ui = Cashful.ui;
  var esc = ui.esc;
  var uid = 0;

  /**
   * segmented(el, { label, options: [{ value, label }], value, onChange })
   * `label` names the group for assistive technology. Returns { setValue }.
   */
  function segmented(el, o) {
    var name = 'seg-' + (++uid);
    el.innerHTML = '<fieldset class="cf-seg"><legend class="sr-only">' + esc(o.label) + '</legend>' +
      o.options.map(function (opt) {
        return '<label class="cf-seg__opt"><input class="cf-seg__input" type="radio" name="' + name + '" value="' + esc(opt.value) + '"' + (opt.value === o.value ? ' checked' : '') + '>' +
          '<span class="cf-seg__label">' + esc(opt.label) + '</span></label>';
      }).join('') + '</fieldset>';
    el.addEventListener('change', function (e) {
      if (e.target.name === name && o.onChange) o.onChange(e.target.value);
    });
    return {
      setValue: function (v) {
        ui.$$('input', el).forEach(function (i) { i.checked = i.value === v; });
      }
    };
  }

  /**
   * dropdown(el, { label, options: [{ value, label, html, disabled, tooltip }], value, onChange })
   * `html` (already escaped) replaces the label inside the option. Disabled options can be read but not chosen.
   * Returns { setValue, setOptions }.
   */
  function dropdown(el, o) {
    var id = 'dd-' + (++uid);
    var options = o.options;
    var value = o.value;
    var active = -1;

    el.classList.add('cf-dd');
    el.innerHTML =
      '<span class="cf-input__label" id="' + id + '-label">' + esc(o.label) + '</span>' +
      '<button type="button" class="cf-dd__trigger" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="' + id + '-label ' + id + '-value" id="' + id + '-btn">' +
        '<span class="cf-dd__value" id="' + id + '-value"></span><cf-icon name="chevron-down" size="20"></cf-icon></button>' +
      '<ul class="cf-dd__list" role="listbox" tabindex="-1" aria-labelledby="' + id + '-label" hidden></ul>';

    var trigger = ui.$('.cf-dd__trigger', el);
    var list = ui.$('.cf-dd__list', el);
    var valueEl = ui.$('.cf-dd__value', el);

    function inner(opt) { return opt.html || esc(opt.label); }
    function current() { return options.filter(function (x) { return x.value === value; })[0]; }

    function paint() {
      var cur = current();
      valueEl.innerHTML = cur ? inner(cur) : '';
      list.innerHTML = options.map(function (opt, i) {
        var cls = 'cf-dd__opt' + (i === active ? ' is-active' : '') + (opt.disabled ? ' is-disabled' : '');
        return '<li role="option" id="' + id + '-' + i + '" class="' + cls + '" data-i="' + i + '" aria-selected="' + (opt.value === value) + '"' +
          (opt.disabled ? ' aria-disabled="true"' : '') +
          (opt.tooltip ? ' data-tooltip="' + esc(opt.tooltip) + '" aria-description="' + esc(opt.tooltip) + '"' : '') + '>' + inner(opt) + '</li>';
      }).join('');
      if (active > -1) list.setAttribute('aria-activedescendant', id + '-' + active); else list.removeAttribute('aria-activedescendant');
    }

    function open() {
      if (!list.hidden) return;
      active = Math.max(0, options.findIndex(function (x) { return x.value === value; }));
      list.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      paint();
      list.focus();
      document.addEventListener('mousedown', outside);
    }
    function close(refocus) {
      if (list.hidden) return;
      list.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      document.removeEventListener('mousedown', outside);
      if (refocus) trigger.focus();
    }
    function outside(e) { if (!el.contains(e.target)) close(false); }

    function choose(i) {
      var opt = options[i];
      if (!opt || opt.disabled) return;
      value = opt.value;
      close(true);
      paint();
      if (o.onChange) o.onChange(value);
    }
    // Moving the highlight only toggles classes: rebuilding the list on hover would eat the click
    function setActive(i) {
      active = i;
      ui.$$('.cf-dd__opt', list).forEach(function (li, n) { li.classList.toggle('is-active', n === i); });
      list.setAttribute('aria-activedescendant', id + '-' + i);
      var li = ui.$('.is-active', list);
      if (li && li.scrollIntoView) li.scrollIntoView({ block: 'nearest' });
    }
    function move(delta) { setActive(Math.min(options.length - 1, Math.max(0, active + delta))); }

    trigger.addEventListener('click', function () { if (list.hidden) open(); else close(true); });
    trigger.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); }
    });
    list.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Home') { e.preventDefault(); move(-options.length); }
      else if (e.key === 'End') { e.preventDefault(); move(options.length); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
      else if (e.key === 'Tab') close(false);
    });
    list.addEventListener('click', function (e) {
      var li = e.target.closest('[data-i]');
      if (li) choose(parseInt(li.dataset.i, 10));
    });
    list.addEventListener('mousemove', function (e) {
      var li = e.target.closest('[data-i]');
      if (li && parseInt(li.dataset.i, 10) !== active) setActive(parseInt(li.dataset.i, 10));
    });
    list.addEventListener('blur', function () { setTimeout(function () { if (!el.contains(document.activeElement)) close(false); }, 0); });

    paint();
    return {
      setValue: function (v) { value = v; paint(); },
      setOptions: function (next, v) { options = next; if (v !== undefined) value = v; paint(); }
    };
  }

  /**
   * fileDropzone(el, { label, accept: ['image/jpeg', …], maxSizeMb, maxDimension, value, editable,
   *                    formatError, sizeError, hint, onChange(dataUrl|null), onUploaded })
   * Choose or drop one image. It is checked (type, size), shrunk to `maxDimension` and handed back as a JPEG data URL,
   * so the prototype can keep it in the store. With editable:false it only shows the image.
   * Returns { setValue, setError }.
   */
  function fileDropzone(el, o) {
    var id = 'dz-' + (++uid);
    var value = o.value || null;

    function shrink(file) {
      return new Promise(function (resolve, reject) {
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () {
          var max = o.maxDimension || 1280;
          var scale = Math.min(1, max / Math.max(img.width, img.height));
          var canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
        img.src = url;
      });
    }

    function setError(message) {
      var p = ui.$('.cf-drop__error', el);
      if (!p) return;
      p.textContent = message || '';
      p.hidden = !message;
      var field = ui.$('.cf-drop__area, .cf-drop__preview', el);
      if (field) field.classList.toggle('is-error', !!message);
    }

    function take(file) {
      if (!file) return;
      if (o.accept.indexOf(file.type) < 0) { setError(o.formatError); return; }
      if (file.size > o.maxSizeMb * 1024 * 1024) { setError(o.sizeError); return; }
      shrink(file).then(function (dataUrl) {
        value = dataUrl;
        paint();
        if (o.onUploaded) o.onUploaded();
        if (o.onChange) o.onChange(value);
      }, function () { setError(o.formatError); });
    }

    function paint() {
      var input = '<input type="file" class="cf-drop__input" id="' + id + '-input" accept="' + esc(o.accept.join(',')) + '" hidden>';
      var err = '<p class="cf-drop__error" id="' + id + '-error" role="alert" hidden></p>';
      if (value) {
        el.innerHTML = '<div class="cf-drop__preview"><img src="' + esc(value) + '" alt="' + esc(o.label) + ' preview"></div>' +
          (o.editable ? '<div class="cf-drop__actions"><button type="button" class="cf-btn cf-btn--secondary cf-btn--sm" data-drop="pick">Replace</button>' +
            '<button type="button" class="cf-btn cf-btn--ghost cf-btn--sm" data-drop="remove">Remove</button></div>' : '') + err + input;
      } else if (o.editable) {
        el.innerHTML = '<div class="cf-drop__area" role="group" aria-label="' + esc(o.label) + '">' +
          '<cf-icon name="upload" size="24"></cf-icon><span>Drag an image here or</span>' +
          '<button type="button" class="cf-btn cf-btn--secondary cf-btn--sm" data-drop="pick" aria-describedby="' + id + '-hint ' + id + '-error">Choose file</button>' +
          '<span class="cf-input__helper" id="' + id + '-hint">' + esc(o.hint || '') + '</span></div>' + err + input;
      } else {
        el.innerHTML = '<p class="t-muted">Nothing uploaded.</p>';
      }
    }

    el.classList.add('cf-drop');
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-drop]');
      if (!b) return;
      if (b.dataset.drop === 'pick') ui.$('.cf-drop__input', el).click();
      else { value = null; paint(); setError(''); if (o.onChange) o.onChange(null); var pick = ui.$('[data-drop="pick"]', el); if (pick) pick.focus(); }
    });
    el.addEventListener('change', function (e) {
      if (!e.target.classList.contains('cf-drop__input')) return;
      var file = e.target.files[0];
      e.target.value = '';
      setError('');
      take(file);
    });
    ['dragover', 'dragenter'].forEach(function (t) {
      el.addEventListener(t, function (e) { if (!o.editable) return; e.preventDefault(); var a = ui.$('.cf-drop__area', el); if (a) a.classList.add('is-over'); });
    });
    ['dragleave', 'drop'].forEach(function (t) {
      el.addEventListener(t, function () { var a = ui.$('.cf-drop__area', el); if (a) a.classList.remove('is-over'); });
    });
    el.addEventListener('drop', function (e) {
      if (!o.editable) return;
      e.preventDefault();
      setError('');
      take(e.dataTransfer && e.dataTransfer.files[0]);
    });

    paint();
    return {
      setValue: function (v) { value = v || null; paint(); },
      setError: setError
    };
  }

  Cashful.controls = { segmented: segmented, dropdown: dropdown, fileDropzone: fileDropzone };
})();
