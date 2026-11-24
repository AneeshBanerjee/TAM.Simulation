/* Shared UI helpers: navigation, storage, formatting, charts, downloads */
(function (root) {
  'use strict';
  var D = root.MH_DATA;
  var KEY = 'mh-copilot-sim-v1';

  var COLORS = {
    g12: '#1f4e8c', sen: '#2f6fc0', man: '#5b8fd6', dir: '#8fb3e6', par: '#c0d4f2', cen: '#9aa3ae',
    firm: '#1b2430', target: '#b3261e', good: '#2e7d4f', bad: '#b3261e', accent: '#2f6fc0', grey: '#9aa3ae'
  };

  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) { Object.keys(attrs).forEach(function (k) { if (k === 'class') { e.className = attrs[k]; } else { e.setAttribute(k, attrs[k]); } }); }
    if (html !== undefined) { e.innerHTML = html; }
    return e;
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pct(x, dp) { return (x * 100).toFixed(dp === undefined ? 0 : dp) + '%'; }
  function money(k) { var sign = k < 0 ? '−' : ''; k = Math.abs(k); return sign + (k >= 1000 ? '£' + (k / 1000).toFixed(2) + 'm' : '£' + Math.round(k) + 'k'); }
  function num(x, dp) { return Number(x).toLocaleString('en-GB', { maximumFractionDigits: dp || 0, minimumFractionDigits: dp || 0 }); }

  /* storage: per-browser convenience only */
  function load() { try { var s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function save(state) { try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch (e) { return false; } }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }

  function nav(active) {
    var links = [['index.html', 'Home'], ['case.html', 'Case'], ['simulation.html', 'Simulation'], ['debrief.html', 'Debrief'], ['instructor.html', 'Instructor']];
    var html = '<div class="wrap"><a class="brand" href="index.html">Meridian Hale <span>· The Copilot Paradox</span></a><nav class="nav">' +
      links.map(function (l) { return '<a href="' + l[0] + '"' + (l[0] === active ? ' class="active"' : '') + '>' + l[1] + '</a>'; }).join('') +
      '</nav></div>';
    var hdr = document.querySelector('header.topbar');
    if (hdr) { hdr.innerHTML = html; }
    var ft = document.querySelector('footer');
    if (ft) {
      ft.innerHTML = '<div class="wrap">Meridian Hale LLP and all characters are fictional. Data are constructed for teaching. ' +
        'Simulation v' + D.meta.version + '. Built for MBA and Executive MBA teaching on technology acceptance (TAM, UTAUT).</div>';
    }
  }

  function download(filename, text, type) {
    var blob = new Blob([text], { type: type || 'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  }

  /*
   * Simple SVG line chart.
   * opts: { labels: [..], series: [{name, values, color, dash, width}], yMin, yMax, yFmt, target: {value, label}, height }
   */
  function lineChart(container, opts) {
    var W = 720, H = opts.height || 300, L = 52, R = 110, T = 16, B = 34;
    var n = Math.max(opts.labels.length, opts.slots || 0);
    var yMin = opts.yMin !== undefined ? opts.yMin : 0, yMax = opts.yMax !== undefined ? opts.yMax : 1;
    var fmt = opts.yFmt || function (v) { return v; };
    var x = function (i) { return L + (n === 1 ? 0 : i * (W - L - R) / (n - 1)); };
    var y = function (v) { return T + (1 - (v - yMin) / (yMax - yMin)) * (H - T - B); };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.title || 'chart') + '" font-size="12" font-family="inherit">';
    var ticks = opts.ticks || 4;
    for (var t = 0; t <= ticks; t++) {
      var v = yMin + (yMax - yMin) * t / ticks;
      s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#e6e9ee"/>';
      s += '<text x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end" fill="#7a8494">' + esc(fmt(v)) + '</text>';
    }
    opts.labels.forEach(function (lab, i) {
      s += '<text x="' + x(i) + '" y="' + (H - 12) + '" text-anchor="middle" fill="#7a8494">' + esc(lab) + '</text>';
    });
    if (opts.target) {
      s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(opts.target.value) + '" y2="' + y(opts.target.value) + '" stroke="' + COLORS.target + '" stroke-dasharray="5 4" stroke-width="1.2"/>';
      s += '<text x="' + (L + 6) + '" y="' + (y(opts.target.value) - 6) + '" fill="' + COLORS.target + '">' + esc(opts.target.label) + '</text>';
    }
    var labelYs = [];
    opts.series.forEach(function (se) {
      var pts = se.values.map(function (v, i) { return v === null || v === undefined ? null : [x(i), y(v)]; }).filter(Boolean);
      if (!pts.length) { return; }
      s += '<polyline fill="none" stroke="' + se.color + '" stroke-width="' + (se.width || 2.2) + '"' + (se.dash ? ' stroke-dasharray="' + se.dash + '"' : '') + ' points="' + pts.map(function (p) { return p.join(','); }).join(' ') + '"/>';
      pts.forEach(function (p, i) { s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3" fill="' + se.color + '"><title>' + esc(se.name + ', ' + opts.labels[i] + ': ' + fmt(se.values[i])) + '</title></circle>'; });
      var last = pts[pts.length - 1];
      var ly = last[1] + 4;
      labelYs.forEach(function (o) { if (Math.abs(o - ly) < 13) { ly = o + 13; } });
      labelYs.push(ly);
      s += '<text x="' + (W - R + 8) + '" y="' + ly + '" fill="#1b2430"' + (se.bold ? ' font-weight="700"' : '') + '>' + esc(se.name + ' ' + fmt(se.values[se.values.length - 1])) + '</text>';
    });
    s += '</svg>';
    container.innerHTML = s;
  }

  function scoreBars(container, rows) {
    container.innerHTML = rows.map(function (r) {
      return '<div class="bar-row"><div>' + esc(r.label) + '</div><div class="bar"><div style="width:' + Math.max(0, Math.min(100, r.value)) + '%;background:' + (r.color || COLORS.accent) + '"></div></div><div class="num"><strong>' + Math.round(r.value) + '</strong></div></div>';
    }).join('');
  }

  function quarterLabels(count) {
    var labs = ['Sep 2026'];
    for (var i = 0; i < count; i++) { labs.push(D.meta.quarterShort[i] + ' 2027'); }
    return labs;
  }

  function wauChart(container, state) {
    var labels = quarterLabels(4);
    var series = D.segments.map(function (s) {
      return { name: s.short, color: COLORS[s.id], values: state.history.map(function (h) { return h.segments[s.id].wau; }) };
    });
    series.push({ name: 'Firm', color: COLORS.firm, dash: '6 3', width: 2.8, bold: true, values: state.history.map(function (h) { return h.wau; }) });
    lineChart(container, { title: 'Weekly active users by grade', labels: labels, slots: 5, series: series, yMin: 0, yMax: 1,
      yFmt: function (v) { return pct(v); }, target: { value: D.meta.wauTarget, label: 'Board target 70%' } });
  }

  root.MHUI = { el: el, esc: esc, pct: pct, money: money, num: num, load: load, save: save, clear: clear, nav: nav,
    download: download, lineChart: lineChart, scoreBars: scoreBars, wauChart: wauChart, quarterLabels: quarterLabels, COLORS: COLORS };
})(window);
