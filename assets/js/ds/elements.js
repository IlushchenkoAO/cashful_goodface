/* Cashful DS — brand graphics as custom elements (no shadow DOM, styles stay global).

   <cf-icon name="shield" size="20"></cf-icon>
   <cf-logo version="color|on-dark|black|white" type="full|mark" height="28"></cf-logo>
   <cf-mascot character="main|c|form" size="104"></cf-mascot>
   <cf-brand-shape shape="pair|step|block" size="220" color="var(--yellow-500)"></cf-brand-shape>
*/
(function () {
  var ICONS = Cashful.ICONS;
  var P = Cashful.PATHS;
  var NS = 'http://www.w3.org/2000/svg';

  function num(el, attr, fallback) {
    var v = parseFloat(el.getAttribute(attr));
    return isNaN(v) ? fallback : v;
  }

  function svg(width, height, viewBox, body, label) {
    var a = label ? ' role="img" aria-label="' + label + '"' : ' aria-hidden="true"';
    return '<svg xmlns="' + NS + '" width="' + width + '" height="' + height + '" viewBox="' + viewBox + '"' + a + '>' + body + '</svg>';
  }

  function path(d, fill) { return '<path d="' + d + '" fill="' + fill + '"/>'; }

  /** Builds an icon SVG string; also used by JS that renders markup. */
  function iconSvg(name, size, strokeWidth) {
    size = size || 20;
    return '<svg class="cf-icon" xmlns="' + NS + '" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (strokeWidth || 1.75) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }

  var LOGO = {
    color: ['var(--neutral-900)', 'var(--purple-500)'],
    'on-dark': ['var(--neutral-50)', 'var(--purple-500)'],
    black: ['var(--neutral-900)', 'var(--neutral-900)'],
    white: ['var(--neutral-50)', 'var(--neutral-50)']
  };

  var MASCOTS = {
    main: [230, 230, P.M_MAIN_B, P.M_MAIN_F, 'var(--purple-500)'],
    c: [429, 230, P.M_C_B, P.M_C_F, 'var(--yellow-500)'],
    form: [230, 230, P.M_F_B, P.M_F_F, 'var(--pink-500)']
  };

  // Third-party marks keep their own colours, so they live outside the stroke icon set
  var BRAND_ICONS = {
    google: '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>',
    github: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z"/></svg>',
    apple: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>'
  };

  var renderers = {
    'cf-brand-icon': function (el) { return BRAND_ICONS[el.getAttribute('name')] || ''; },
    'cf-icon': function (el) {
      return iconSvg(el.getAttribute('name'), num(el, 'size', 20), num(el, 'stroke-width', 1.75));
    },
    'cf-logo': function (el) {
      var colors = LOGO[el.getAttribute('version') || 'color'] || LOGO.color;
      var h = num(el, 'height', 28);
      if (el.getAttribute('type') === 'mark') {
        return svg(h, h, '0 0 112 112', path(P.MARK, colors[1]), 'Cashful');
      }
      return svg(h * 858 / 141, h, '0 0 858 141', path(P.WORD, colors[0]) + path(P.MARKL, colors[1]), 'Cashful');
    },
    'cf-mascot': function (el) {
      var m = MASCOTS[el.getAttribute('character') || 'main'] || MASCOTS.main;
      var s = num(el, 'size', 120);
      return svg(s * m[0] / m[1], s, '0 0 ' + m[0] + ' ' + m[1], path(m[2], m[4]) + path(m[3], 'var(--neutral-900)'));
    },
    'cf-brand-shape': function (el) {
      var c = el.getAttribute('color') || 'var(--purple-500)';
      var s = num(el, 'size', 80);
      var shape = el.getAttribute('shape') || 'step';
      if (shape === 'block') return svg(s, s, '0 0 56 56', '<rect width="56" height="56" rx="8" fill="' + c + '"/>');
      var def = shape === 'pair' ? [151, 161, P.SH_PAIR] : [140, 150, P.SH_STEP];
      return svg(s * def[0] / def[1], s, '0 0 ' + def[0] + ' ' + def[1], def[2].map(function (d) { return path(d, c); }).join(''));
    }
  };

  Object.keys(renderers).forEach(function (tag) {
    var render = renderers[tag];
    customElements.define(tag, class extends HTMLElement {
      static get observedAttributes() { return ['name', 'size', 'height', 'version', 'type', 'character', 'shape', 'color']; }
      connectedCallback() { this.innerHTML = render(this); }
      attributeChangedCallback() { if (this.isConnected) this.innerHTML = render(this); }
    });
  });

  Cashful.iconSvg = iconSvg;
})();
