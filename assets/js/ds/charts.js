/* Cashful DS — TimeSeriesChart: a light, dependency-free SVG line chart.
   Cashful.charts.timeSeries(el, {
     series:      [{ id, label, points: [{ date: 'YYYY-MM-DD', value: number|null, partial?: true }] }],
     metricLabel: 'Nodes online',            // names the single series in the tooltip
     yFormat:     function (v) → axis label, valueFormat: function (v) → tooltip value,
     ariaLabel:   text alternative (the data table next to the chart is the full data view),
     partialLabel:'Today (partial)', height: 280
   }) → { update(opts), destroy() }
   - a point with `partial` is drawn dashed and hollow; `null` leaves a gap
   - hover or focus + arrow keys / Home / End show the tooltip; the same text goes to a live region
   Colours come from the --chart-* tokens; names and the dashed style carry the meaning, not colour alone. */
(function () {
  var ui = Cashful.ui;
  var esc = ui.esc;
  var COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];
  var MARGIN = { l: 64, r: 16, t: 12, b: 30 };

  function niceStep(raw) {
    var pow = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var n = raw / pow;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
  }
  function shortDate(date) { return new Date(date + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }); }
  function longDate(date) { return new Date(date + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); }

  function timeSeries(root, initial) {
    var opts = initial;
    var idx = null;
    var geometry = null;

    root.classList.add('cf-ts');
    root.innerHTML =
      '<div class="cf-ts__stage" tabindex="0" role="group" aria-roledescription="chart">' +
        '<svg class="cf-ts__svg" aria-hidden="true" focusable="false"></svg>' +
        '<div class="cf-ts__tip" hidden></div>' +
      '</div>' +
      '<ul class="cf-ts__legend"></ul>' +
      '<div class="sr-only" role="status" aria-live="polite"></div>';
    var stage = ui.$('.cf-ts__stage', root);
    var svg = ui.$('.cf-ts__svg', root);
    var tip = ui.$('.cf-ts__tip', root);
    var legend = ui.$('.cf-ts__legend', root);
    var live = ui.$('[role="status"]', root);

    function color(i) { return COLORS[i % COLORS.length]; }

    function draw() {
      var series = opts.series;
      var n = series[0] ? series[0].points.length : 0;
      var W = Math.max(320, stage.clientWidth);
      var H = opts.height || 280;
      var pw = W - MARGIN.l - MARGIN.r, ph = H - MARGIN.t - MARGIN.b;

      var max = 0;
      series.forEach(function (s) { s.points.forEach(function (p) { if (p.value != null) max = Math.max(max, p.value); }); });
      max = max || 1;
      var step = niceStep(max * 1.05 / 4);
      var top = step * Math.ceil(max * 1.05 / step);
      var ticks = [];
      for (var v = 0; v <= top + step / 1000; v += step) ticks.push(v);

      function x(i) { return n > 1 ? MARGIN.l + i * pw / (n - 1) : MARGIN.l + pw / 2; }
      function y(val) { return MARGIN.t + ph - (val / top) * ph; }
      geometry = { x: x, y: y, n: n, pw: pw, W: W, H: H };

      var out = '';
      ticks.forEach(function (t) {
        out += '<line class="cf-ts__grid" x1="' + MARGIN.l + '" x2="' + (W - MARGIN.r) + '" y1="' + y(t) + '" y2="' + y(t) + '"/>' +
          '<text class="cf-ts__tick" x="' + (MARGIN.l - 10) + '" y="' + (y(t) + 4) + '" text-anchor="end">' + esc(opts.yFormat(t)) + '</text>';
      });

      // X labels: counted back from the last point so the newest date is always labelled
      var maxLabels = Math.max(2, Math.floor(pw / 84));
      var every = Math.max(1, Math.ceil((n - 1) / (maxLabels - 1)));
      for (var i = n - 1; i >= 0; i -= every) {
        out += '<text class="cf-ts__tick" x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="' + (i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle') + '">' + esc(shortDate(series[0].points[i].date)) + '</text>';
      }

      series.forEach(function (s, si) {
        var c = color(si);
        // Split into runs of consecutive values (null = gap)
        var runs = [], run = [];
        s.points.forEach(function (p, i) {
          if (p.value == null) { if (run.length) runs.push(run); run = []; } else run.push({ i: i, v: p.value, partial: !!p.partial });
        });
        if (run.length) runs.push(run);
        runs.forEach(function (r) {
          var last = r[r.length - 1];
          var solid = last.partial && r.length > 1 ? r.slice(0, -1) : r;
          var path = function (pts) { return pts.map(function (p, k) { return (k ? 'L' : 'M') + x(p.i).toFixed(1) + ' ' + y(p.v).toFixed(1); }).join(' '); };
          if (series.length === 1 && solid.length > 1) {
            out += '<path class="cf-ts__area" d="' + path(solid) + ' L' + x(solid[solid.length - 1].i).toFixed(1) + ' ' + y(0) + ' L' + x(solid[0].i).toFixed(1) + ' ' + y(0) + ' Z" fill="' + c + '"/>';
          }
          if (solid.length > 1) out += '<path class="cf-ts__line" d="' + path(solid) + '" stroke="' + c + '"/>';
          if (last.partial && r.length > 1) out += '<path class="cf-ts__line is-partial" d="' + path(r.slice(-2)) + '" stroke="' + c + '"/>';
          if (last.partial) out += '<circle class="cf-ts__partial-dot" cx="' + x(last.i).toFixed(1) + '" cy="' + y(last.v).toFixed(1) + '" r="4" stroke="' + c + '"/>';
          if (r.length === 1 && !last.partial) out += '<circle cx="' + x(last.i).toFixed(1) + '" cy="' + y(last.v).toFixed(1) + '" r="3" fill="' + c + '"/>';
        });
      });

      out += '<g class="cf-ts__cursor" hidden><line y1="' + MARGIN.t + '" y2="' + (MARGIN.t + ph) + '"/></g>';
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.setAttribute('width', W);
      svg.setAttribute('height', H);
      svg.innerHTML = out;

      stage.setAttribute('aria-label', opts.ariaLabel + '. Use the left and right arrow keys to read each day.');

      legend.innerHTML = (series.length > 1 ? series.map(function (s, si) {
        return '<li><span class="cf-ts__swatch" style="background:' + color(si) + '"></span>' + esc(s.label) + '</li>';
      }).join('') : '') + '<li><span class="cf-ts__dash"></span>Dashed: today, still in progress</li>';

      if (idx !== null) show(Math.min(idx, n - 1), false); else hide();
    }

    function textFor(i) {
      var first = opts.series[0].points[i];
      var parts = opts.series.map(function (s) {
        var p = s.points[i];
        return (opts.series.length > 1 ? s.label : opts.metricLabel) + ' ' + (p.value == null ? 'no data' : opts.valueFormat(p.value));
      });
      return longDate(first.date) + (first.partial ? ', ' + (opts.partialLabel || 'Today (partial)') : '') + ': ' + parts.join(', ');
    }

    function show(i, announce) {
      idx = i;
      var g = geometry;
      var cx = g.x(i);
      var cursor = ui.$('.cf-ts__cursor', svg);
      cursor.removeAttribute('hidden');
      var line = ui.$('line', cursor);
      line.setAttribute('x1', cx); line.setAttribute('x2', cx);
      ui.$$('.cf-ts__dot', svg).forEach(function (d) { d.remove(); });
      var first = opts.series[0].points[i];
      opts.series.forEach(function (s, si) {
        var p = s.points[i];
        if (p.value == null) return;
        var dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('class', 'cf-ts__dot');
        dot.setAttribute('cx', cx); dot.setAttribute('cy', g.y(p.value)); dot.setAttribute('r', 5);
        dot.setAttribute('stroke', color(si));
        cursor.appendChild(dot);
      });

      tip.hidden = false;
      tip.innerHTML = '<div class="cf-ts__tip-date">' + esc(longDate(first.date)) +
        (first.partial ? ' <span class="cf-ts__tip-partial">' + esc(opts.partialLabel || 'Today (partial)') + '</span>' : '') + '</div>' +
        opts.series.map(function (s, si) {
          var p = s.points[i];
          return '<div class="cf-ts__tip-row"><span class="cf-ts__swatch" style="background:' + color(si) + '"></span>' +
            '<span>' + esc(opts.series.length > 1 ? s.label : opts.metricLabel) + '</span><strong>' + (p.value == null ? 'No data' : esc(opts.valueFormat(p.value))) + '</strong></div>';
        }).join('');
      var tw = tip.offsetWidth;
      var left = cx + 14;
      if (left + tw > g.W - 4) left = cx - tw - 14;
      tip.style.left = Math.max(4, left) + 'px';
      if (announce) live.textContent = textFor(i);
    }

    function hide() {
      idx = null;
      tip.hidden = true;
      var cursor = ui.$('.cf-ts__cursor', svg);
      if (cursor) cursor.setAttribute('hidden', '');
    }

    function indexAt(clientX) {
      var rect = svg.getBoundingClientRect();
      var px = (clientX - rect.left) * (geometry.W / rect.width);
      var n = geometry.n;
      if (n < 2) return 0;
      return Math.max(0, Math.min(n - 1, Math.round((px - MARGIN.l) / (geometry.pw / (n - 1)))));
    }

    stage.addEventListener('pointermove', function (e) { if (geometry.n) show(indexAt(e.clientX), false); });
    stage.addEventListener('pointerleave', function () { if (document.activeElement !== stage) hide(); });
    stage.addEventListener('blur', hide);
    stage.addEventListener('keydown', function (e) {
      var n = geometry.n;
      if (!n) return;
      var next = idx === null ? n - 1 : idx;
      if (e.key === 'ArrowLeft') next = Math.max(0, (idx === null ? n - 1 : idx - 1));
      else if (e.key === 'ArrowRight') next = Math.min(n - 1, (idx === null ? n - 1 : idx + 1));
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = n - 1;
      else if (e.key === 'Escape') { hide(); return; }
      else return;
      e.preventDefault();
      show(next, true);
    });

    var raf = null;
    var observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(function () {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () { if (Math.abs(stage.clientWidth - geometry.W) > 1 && stage.clientWidth >= 320) draw(); });
    }) : null;
    if (observer) observer.observe(stage);

    draw();
    return {
      update: function (next) { opts = next; draw(); },
      destroy: function () { if (observer) observer.disconnect(); root.innerHTML = ''; }
    };
  }

  Cashful.charts = { timeSeries: timeSeries };
})();
