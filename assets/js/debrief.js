/* Debrief page controller */
(function () {
  'use strict';
  var D = window.MH_DATA, M = window.MHModel, U = window.MHUI;
  var $ = function (id) { return document.getElementById(id); };
  U.nav('debrief.html');

  var state = U.load();
  if (!state || !state.finished || state.version !== D.meta.version) { $('empty').classList.remove('hidden'); return; }
  $('debrief').classList.remove('hidden');

  var score = M.scorecard(state);
  var last = state.history[state.history.length - 1];
  var first = state.history[0];

  $('teamName').textContent = state.team;
  $('subLine').textContent = 'Class code: ' + state.seedText + ' · Spent ' + U.money(state.spentK) + ' of £2.40m';
  $('overall').textContent = score.overall;

  var labels = { adoption: 'Adoption', reliance: 'Appropriate reliance', quality: 'Quality', value: 'Value', risk: 'Risk', people: 'People' };
  U.scoreBars($('bars'), Object.keys(labels).map(function (k) {
    return { label: labels[k] + ' (' + Math.round(D.scoreWeights[k] * 100) + '%)', value: score[k] };
  }));

  $('kpiVerdict').innerHTML = score.boardKpiMet ?
    'You <strong>met</strong> the board\'s original target of 70% weekly usage (' + U.pct(last.wau) + '). Check whether quality, risk and people outcomes held up as well.' :
    'You <strong>missed</strong> the board\'s original target of 70% weekly usage (' + U.pct(last.wau) + '). That may or may not have been the right call: the scorecard shows what you got in return.';

  var rows = [
    ['Weekly active users', U.pct(first.wau), U.pct(last.wau)],
    ['Appropriate reliance (use × verify)', U.pct(first.reliance), U.pct(last.reliance)],
    ['Errors reaching clients per 100', first.escPer100.toFixed(1), last.escPer100.toFixed(1)],
    ['Review catch rate for AI errors', U.pct(first.catchRate), U.pct(last.catchRate)],
    ['Chargeable utilisation', first.utilisation.toFixed(1) + '%', last.utilisation.toFixed(1) + '%'],
    ['Incremental chargeable value (year)', '—', U.money(state.totals.valueK)],
    ['Client incidents / breaches', '—', state.totals.incidents + ' / ' + state.totals.shadowIncidents],
    ['Incident and insurance costs', '—', U.money(state.totals.incidentCostK)],
    ['Harrow Lane Capital', 'Paused', state.flags.harrowLane === 'returned' ? 'Returned' : 'Lost'],
    ['Staff sentiment', '62', Math.round(last.indices.sentiment)],
    ['Partner support', '40', Math.round(last.indices.partnerSupport)]
  ];
  $('endTable').innerHTML = '<thead><tr><th>Measure</th><th class="num">Sep 2026</th><th class="num">Dec 2027</th></tr></thead><tbody>' +
    rows.map(function (r) { return '<tr><td>' + r[0] + '</td><td class="num">' + r[1] + '</td><td class="num">' + r[2] + '</td></tr>'; }).join('') + '</tbody>';

  U.wauChart($('wauChart'), state);
  U.lineChart($('relChart'), {
    title: 'Use and appropriate reliance', labels: U.quarterLabels(4),
    series: [
      { name: 'Weekly use', color: U.COLORS.grey, values: state.history.map(function (h) { return h.wau; }) },
      { name: 'Use + verify', color: U.COLORS.accent, bold: true, values: state.history.map(function (h) { return h.reliance; }) }
    ], yMin: 0, yMax: 1, yFmt: function (v) { return U.pct(v); }
  });

  /* decisions table */
  var dh = '<table><thead><tr><th>Decision</th>' + D.meta.quarterShort.map(function (q) { return '<th class="num">' + q + '</th>'; }).join('') + '</tr></thead><tbody>';
  D.levers.forEach(function (l) {
    dh += '<tr><td>' + U.esc(l.name) + '</td>' + state.decisions.map(function (d) { return '<td class="num">' + (d.spend[l.id] ? '£' + d.spend[l.id] + 'k' : '·') + '</td>'; }).join('') + '</tr>';
  });
  dh += '<tr><td>' + U.esc(D.retrieval.name) + '</td>' + state.decisions.map(function (d) { return '<td class="num">' + (d.buildRetrieval ? '✓' : '·') + '</td>'; }).join('') + '</tr>';
  D.policies.forEach(function (p) {
    dh += '<tr><td>' + U.esc(p.name) + '</td>' + state.decisions.map(function (d) { return '<td class="num">' + (d.policies[p.id] ? 'On' : '·') + '</td>'; }).join('') + '</tr>';
  });
  dh += '<tr><td><strong>Spend</strong></td>' + state.history.slice(1).map(function (h) { return '<td class="num"><strong>' + U.money(h.costK) + '</strong></td>'; }).join('') + '</tr>';
  $('decisions').innerHTML = dh + '</tbody></table>';

  /* benchmarks */
  var bench = M.benchmarks({ team: state.team, seed: state.seedText });
  var all = [{ name: 'Your team (' + state.team + ')', score: score, state: state, you: true }].concat(bench);
  all.sort(function (a, b) { return b.score.overall - a.score.overall; });
  var bh = '<table><thead><tr><th>Strategy</th><th class="num">Overall</th><th class="num">Adoption</th><th class="num">Reliance</th><th class="num">Quality</th><th class="num">Value</th><th class="num">Risk</th><th class="num">People</th><th class="num">Final WAU</th><th class="num">Incidents</th></tr></thead><tbody>';
  all.forEach(function (b) {
    var h = b.state.history[b.state.history.length - 1];
    bh += '<tr' + (b.you ? ' style="background:#e8f0fa;font-weight:600"' : '') + '><td>' + U.esc(b.name) + '</td>' +
      ['overall', 'adoption', 'reliance', 'quality', 'value', 'risk', 'people'].map(function (k) { return '<td class="num">' + b.score[k] + '</td>'; }).join('') +
      '<td class="num">' + U.pct(h.wau) + '</td><td class="num">' + (b.state.totals.incidents + b.state.totals.shadowIncidents) + '</td></tr>';
  });
  $('bench').innerHTML = bh + '</tbody></table>';

  /* weights reveal */
  var wh = '<table><thead><tr><th>Grade</th><th class="num">Performance expectancy</th><th class="num">Effort expectancy</th><th class="num">Social influence</th><th class="num">Facilitating conditions</th><th class="num">Usage floor under mandate</th></tr></thead><tbody>';
  D.segments.forEach(function (s) {
    var w = s.weights;
    var max = Math.max(w.pe, w.ee, w.si, w.fc);
    var cell = function (v) { return '<td class="num"' + (v === max ? ' style="font-weight:700;color:#1f4e8c"' : '') + '>' + v.toFixed(2) + '</td>'; };
    wh += '<tr><td>' + U.esc(s.name) + '</td>' + cell(w.pe) + cell(w.ee) + cell(w.si) + cell(w.fc) + '<td class="num">' + U.pct(s.mandateFloor) + '</td></tr>';
  });
  $('weights').innerHTML = wh + '</tbody></table>';

  /* downloads */
  var slug = state.team.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  $('dlJson').addEventListener('click', function () {
    var payload = { type: 'meridian-hale-result', version: D.meta.version, team: state.team, seed: state.seedText,
      exportedAt: new Date().toISOString(), score: score, totals: state.totals, flags: state.flags,
      decisions: state.decisions, history: state.history };
    U.download('meridian-hale-' + slug + '.json', JSON.stringify(payload, null, 2), 'application/json');
  });
  $('dlCsv').addEventListener('click', function () { U.download('meridian-hale-' + slug + '.csv', M.toCSV(state), 'text/csv'); });
})();
