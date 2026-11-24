/* Instructor page controller */
(function () {
  'use strict';
  var D = window.MH_DATA, M = window.MHModel, U = window.MHUI;
  var $ = function (id) { return document.getElementById(id); };
  U.nav('instructor.html');

  /* reference tables */
  var segNames = D.segments.map(function (s) { return s.short; });
  var lt = '<table><thead><tr><th>Lever</th><th>Construct</th><th class="num">Max / qtr</th><th class="num">Scale £k</th>' +
    segNames.map(function (n) { return '<th class="num">' + n + '</th>'; }).join('') + '</tr></thead><tbody>';
  D.levers.forEach(function (l) {
    l.effects.forEach(function (e, i) {
      lt += '<tr><td>' + (i === 0 ? U.esc(l.name) : '') + '</td><td>' + e.construct.toUpperCase() + '</td><td class="num">+' + e.max + '</td><td class="num">' + (i === 0 ? l.scale : '') + '</td>' +
        D.segments.map(function (s) { return '<td class="num">' + (e.mult[s.id] || 0) + '</td>'; }).join('') + '</tr>';
    });
  });
  lt += '<tr><td>"When to rely" calibration</td><td colspan="' + (3 + segNames.length) + '">Also: verification habit +15% of the remaining gap per quarter (scaled by spend); trust moves 40% towards a warranted level; raises review catch rate and time-saving realisation.</td></tr>';
  $('leverTable').innerHTML = lt + '</tbody></table>';

  var st = '<table><thead><tr><th>Dimension</th><th class="num">Weight</th><th>How it is scored (0–100)</th></tr></thead><tbody>';
  var how = {
    adoption: 'Final weekly active users ÷ 70% target',
    reliance: 'Final share of staff who use the tool and always verify ÷ 50%',
    quality: '100 − 60 × (final escaped errors per 100 ÷ baseline 11.1)',
    value: 'Incremental chargeable value over the year ÷ £4m',
    risk: '100 − 12 per client incident − 20 per breach − 15 for an insurance loading',
    people: 'Average of staff sentiment and partner support'
  };
  Object.keys(D.scoreWeights).forEach(function (k) { st += '<tr><td>' + k.charAt(0).toUpperCase() + k.slice(1) + '</td><td class="num">' + Math.round(D.scoreWeights[k] * 100) + '%</td><td>' + how[k] + '</td></tr>'; });
  $('scoreTable').innerHTML = st + '</tbody></table>';

  var wt = '<table><thead><tr><th>Grade</th><th class="num">n</th><th class="num">w PE</th><th class="num">w EE</th><th class="num">w SI</th><th class="num">w FC</th><th class="num">Mandate floor</th><th class="num">Drafting share</th></tr></thead><tbody>';
  D.segments.forEach(function (s) {
    wt += '<tr><td>' + U.esc(s.name) + '</td><td class="num">' + s.n + '</td><td class="num">' + s.weights.pe + '</td><td class="num">' + s.weights.ee + '</td><td class="num">' + s.weights.si + '</td><td class="num">' + s.weights.fc + '</td><td class="num">' + U.pct(s.mandateFloor) + '</td><td class="num">' + U.pct(s.draftWeight) + '</td></tr>';
  });
  $('weightTable').innerHTML = wt + '</tbody></table>';

  /* class results */
  var teams = [];

  function render() {
    if (!teams.length) { $('classOut').classList.add('hidden'); return; }
    $('classOut').classList.remove('hidden');
    teams.sort(function (a, b) { return b.score.overall - a.score.overall; });
    var cols = ['overall', 'adoption', 'reliance', 'quality', 'value', 'risk', 'people'];
    var lb = '<table><thead><tr><th>#</th><th>Team</th>' + cols.map(function (c) { return '<th class="num">' + c.charAt(0).toUpperCase() + c.slice(1) + '</th>'; }).join('') +
      '<th class="num">Final WAU</th><th class="num">Errors /100</th><th class="num">Incidents</th><th class="num">Spent</th><th>Board KPI met</th></tr></thead><tbody>';
    teams.forEach(function (t, i) {
      var h = t.history[t.history.length - 1];
      var spent = t.history.slice(1).reduce(function (a, x) { return a + (x.costK || 0); }, 0);
      lb += '<tr><td>' + (i + 1) + '</td><td>' + U.esc(t.team) + '</td>' + cols.map(function (c) { return '<td class="num"' + (c === 'overall' ? ' style="font-weight:700"' : '') + '>' + t.score[c] + '</td>'; }).join('') +
        '<td class="num">' + U.pct(h.wau) + '</td><td class="num">' + h.escPer100.toFixed(1) + '</td><td class="num">' + (t.totals.incidents + t.totals.shadowIncidents) + '</td><td class="num">' + U.money(spent) + '</td><td>' + (t.score.boardKpiMet ? 'Yes' : 'No') + '</td></tr>';
    });
    $('leaderboard').innerHTML = lb + '</tbody></table>';

    /* scatter: WAU (x) vs escaped errors (y) */
    var W = 560, H = 340, L = 50, R = 20, T = 20, B = 44;
    var x = function (v) { return L + (v - 0.3) / 0.7 * (W - L - R); };
    var maxE = Math.max(14, Math.ceil(Math.max.apply(null, teams.map(function (t) { return t.history[t.history.length - 1].escPer100; }))));
    var y = function (v) { return T + (1 - v / maxE) * (H - T - B); };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" font-size="12" role="img" aria-label="Final weekly usage against errors reaching clients">';
    [0.3, 0.5, 0.7, 0.9].forEach(function (v) { s += '<line x1="' + x(v) + '" x2="' + x(v) + '" y1="' + T + '" y2="' + (H - B) + '" stroke="#e6e9ee"/><text x="' + x(v) + '" y="' + (H - B + 16) + '" text-anchor="middle" fill="#7a8494">' + U.pct(v) + '</text>'; });
    for (var e = 0; e <= maxE; e += Math.ceil(maxE / 4)) { s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(e) + '" y2="' + y(e) + '" stroke="#e6e9ee"/><text x="' + (L - 8) + '" y="' + (y(e) + 4) + '" text-anchor="end" fill="#7a8494">' + e + '</text>'; }
    s += '<line x1="' + x(0.7) + '" x2="' + x(0.7) + '" y1="' + T + '" y2="' + (H - B) + '" stroke="#b3261e" stroke-dasharray="5 4"/><text x="' + (x(0.7) + 4) + '" y="' + (T + 10) + '" fill="#b3261e">70% target</text>';
    s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(11.1) + '" y2="' + y(11.1) + '" stroke="#9aa3ae" stroke-dasharray="3 3"/><text x="' + (W - R) + '" y="' + (y(11.1) - 5) + '" text-anchor="end" fill="#7a8494">Sep 2026 level</text>';
    s += '<text x="' + ((L + W - R) / 2) + '" y="' + (H - 6) + '" text-anchor="middle" fill="#4a5566">Final weekly active users</text>';
    s += '<text transform="rotate(-90)" x="' + (-(T + H - B) / 2) + '" y="14" text-anchor="middle" fill="#4a5566">Errors reaching clients per 100</text>';
    teams.forEach(function (t) {
      var h = t.history[t.history.length - 1];
      s += '<circle cx="' + x(h.wau) + '" cy="' + y(h.escPer100) + '" r="6" fill="#2f6fc0" fill-opacity=".8"><title>' + U.esc(t.team) + ': ' + U.pct(h.wau) + ', ' + h.escPer100.toFixed(1) + ' errors/100, score ' + t.score.overall + '</title></circle>';
      s += '<text x="' + (x(h.wau) + 9) + '" y="' + (y(h.escPer100) + 4) + '" fill="#1b2430">' + U.esc(t.team.length > 22 ? t.team.slice(0, 21) + '…' : t.team) + '</text>';
    });
    $('scatter').innerHTML = s + '</svg>';

    /* policy mix in Q4 */
    var pm = '<table><thead><tr><th>Policy (Q4)</th><th class="num">Teams</th></tr></thead><tbody>';
    D.policies.forEach(function (p) {
      var c = teams.filter(function (t) { var d = t.decisions[t.decisions.length - 1]; return d && d.policies[p.id]; }).length;
      pm += '<tr><td>' + U.esc(p.name) + '</td><td class="num">' + c + ' of ' + teams.length + '</td></tr>';
    });
    var rb = teams.filter(function (t) { return t.decisions.some(function (d) { return d.buildRetrieval; }); }).length;
    pm += '<tr><td>' + U.esc(D.retrieval.name) + ' (any quarter)</td><td class="num">' + rb + ' of ' + teams.length + '</td></tr>';
    $('policyMix').innerHTML = pm + '</tbody></table>';
  }

  $('files').addEventListener('change', function (ev) {
    var files = Array.prototype.slice.call(ev.target.files || []);
    var ok = 0, bad = 0, done = 0;
    files.forEach(function (f) {
      var r = new FileReader();
      r.onload = function () {
        try {
          var d = JSON.parse(r.result);
          if (d.type !== 'meridian-hale-result' || !d.history || !d.score) { throw new Error('not a result file'); }
          teams = teams.filter(function (t) { return t.team !== d.team; });
          teams.push(d); ok++;
        } catch (e) { bad++; }
        done++;
        if (done === files.length) {
          $('loadMsg').textContent = ok + ' file(s) loaded' + (bad ? ', ' + bad + ' skipped (not Meridian Hale result files)' : '') + '. ' + teams.length + ' team(s) shown.';
          render();
        }
      };
      r.readAsText(f);
    });
    ev.target.value = '';
  });

  $('demoBtn').addEventListener('click', function () {
    teams = M.benchmarks({ team: 'demo', seed: 'demo-class' }).map(function (b) {
      return { team: b.name, score: b.score, totals: b.state.totals, decisions: b.state.decisions, history: b.state.history };
    });
    $('loadMsg').textContent = 'Demo: the five benchmark strategies, run with class code "demo-class".';
    render();
  });
  $('clearBtn').addEventListener('click', function () { teams = []; $('loadMsg').textContent = ''; render(); });
})();
