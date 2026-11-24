/* Simulation page controller */
(function () {
  'use strict';
  var D = window.MH_DATA, M = window.MHModel, U = window.MHUI;
  var $ = function (id) { return document.getElementById(id); };
  var state = U.load();
  var pendingResult = false;

  U.nav('simulation.html');

  if (state && state.version !== D.meta.version) { state = null; }

  function show(id) { ['setup', 'game', 'result'].forEach(function (s) { $(s).classList.toggle('hidden', s !== id); }); window.scrollTo(0, 0); }

  function steps(container, current, resultMode) {
    var html = D.meta.quarterShort.map(function (q, i) {
      var cls = i < current ? 'done' : (i === current ? 'now' : '');
      if (resultMode && i === current) { cls = 'done'; }
      return '<span class="' + cls + '">' + q + ' 2027</span>';
    }).join('');
    html += '<span class="' + (state && state.finished ? 'now' : '') + '">Debrief</span>';
    container.innerHTML = html;
  }

  /* ---------- KPI tiles ---------- */
  function kpiTile(label, value, delta, opts) {
    opts = opts || {};
    var dHtml = '';
    if (delta !== null && delta !== undefined && !isNaN(delta)) {
      var dir = Math.abs(delta) < 1e-9 ? 'flat' : (delta > 0 ? 'up' : 'down');
      var cls = 'delta ' + dir + (opts.lowerIsBetter ? (dir === 'up' ? ' bad-up' : (dir === 'down' ? ' good-down' : '')) : '');
      var sign = delta > 0 ? '▲ ' : (delta < 0 ? '▼ ' : '');
      dHtml = '<div class="' + cls + '">' + sign + (opts.fmtDelta ? opts.fmtDelta(Math.abs(delta)) : Math.abs(delta)) + ' vs last quarter</div>';
    } else if (opts.note) {
      dHtml = '<div class="delta flat">' + opts.note + '</div>';
    }
    return '<div class="kpi"><div class="label">' + label + '</div><div class="value">' + value + '</div>' + dHtml + '</div>';
  }

  function kpis(container, st) {
    var h = st.history[st.history.length - 1];
    var p = st.history.length > 1 ? st.history[st.history.length - 2] : null;
    var ind = h.indices || { sentiment: 62, partnerSupport: 40, clientTrust: 60 };
    var pind = p ? (p.indices || { sentiment: 62, partnerSupport: 40, clientTrust: 60 }) : null;
    var remaining = D.meta.annualBudgetK - st.spentK;
    container.innerHTML = [
      kpiTile('Weekly active users', U.pct(h.wau), p ? (h.wau - p.wau) * 100 : null, { fmtDelta: function (d) { return d.toFixed(1) + ' pts'; }, note: 'Target 70%' }),
      kpiTile('Errors reaching clients', h.escPer100.toFixed(1) + '<small style="font-size:.9rem"> /100</small>', p ? h.escPer100 - p.escPer100 : null, { lowerIsBetter: true, fmtDelta: function (d) { return d.toFixed(1); }, note: 'Per 100 deliverables' }),
      kpiTile('Chargeable utilisation', h.utilisation.toFixed(1) + '%', p ? h.utilisation - p.utilisation : null, { fmtDelta: function (d) { return d.toFixed(2) + ' pts'; }, note: 'Target 72%' }),
      kpiTile('Client incidents', String(st.totals.incidents + st.totals.shadowIncidents), null, { note: 'This year, incl. breaches' }),
      kpiTile('Staff sentiment', Math.round(ind.sentiment), pind ? ind.sentiment - pind.sentiment : null, { fmtDelta: function (d) { return d.toFixed(1); }, note: 'Index, 0–100' }),
      kpiTile('Partner support', Math.round(ind.partnerSupport), pind ? ind.partnerSupport - pind.partnerSupport : null, { fmtDelta: function (d) { return d.toFixed(1); }, note: 'Index, 0–100' }),
      kpiTile('Client trust', Math.round(ind.clientTrust), pind ? ind.clientTrust - pind.clientTrust : null, { fmtDelta: function (d) { return d.toFixed(1); }, note: 'Index, 0–100' }),
      kpiTile('Budget remaining', U.money(remaining), null, { note: 'of £2.40m for the year' })
    ].join('');
  }

  function qualChart(container, st) {
    U.lineChart(container, {
      title: 'Escaped errors per 100 deliverables', labels: U.quarterLabels(4), height: 260,
      series: [{ name: 'Escaped', color: U.COLORS.bad, bold: true, values: st.history.map(function (h) { return h.escPer100; }) }],
      yMin: 0, yMax: Math.max(14, Math.ceil(Math.max.apply(null, st.history.map(function (h) { return h.escPer100; })) + 1)),
      yFmt: function (v) { return Number(v).toFixed(0); }
    });
  }

  function pulse(container, st) {
    var h = st.history[st.history.length - 1];
    var rows = [['Performance expectancy', 'pe'], ['Effort expectancy', 'ee'], ['Social influence', 'si'], ['Facilitating conditions', 'fc'], ['Trust in outputs', 'trust']];
    var html = '<table><thead><tr><th>Measure</th>' + D.segments.map(function (s) { return '<th class="num">' + s.short + '</th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (r) {
      html += '<tr><td>' + r[0] + '</td>' + D.segments.map(function (s) { return '<td class="num">' + h.segments[s.id][r[1]].toFixed(1) + '</td>'; }).join('') + '</tr>';
    });
    html += '<tr><td>Always verify facts and sources</td>' + D.segments.map(function (s) { return '<td class="num">' + U.pct(h.segments[s.id].verifyUse) + '</td>'; }).join('') + '</tr>';
    html += '<tr><td><strong>Weekly active users</strong></td>' + D.segments.map(function (s) { return '<td class="num"><strong>' + U.pct(h.segments[s.id].wau) + '</strong></td>'; }).join('') + '</tr>';
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  /* ---------- decision form ---------- */
  function lastDecision() { return state.decisions.length ? state.decisions[state.decisions.length - 1] : null; }

  function buildForm() {
    var prev = lastDecision();
    $('levers').innerHTML = D.levers.map(function (l) {
      var v = prev ? prev.spend[l.id] : 0;
      return '<div class="lever"><div><div class="name">' + U.esc(l.name) + '</div><div class="blurb">' + U.esc(l.blurb) + '</div></div>' +
        '<div class="input">£<input type="number" min="0" step="10" id="lv_' + l.id + '" value="' + v + '" aria-label="' + U.esc(l.name) + ' spend in £k">k</div></div>';
    }).join('');

    var r = D.retrieval;
    if (state.flags.retrievalOrdered) {
      $('retrieval').innerHTML = '<p>' + U.esc(r.name) + ' <span class="tag on">' + (state.flags.retrievalLive ? 'Live' : 'Commissioned') + '</span></p>';
    } else {
      $('retrieval').innerHTML = '<div class="policy"><input type="checkbox" id="pol_retrieval"><div><label for="pol_retrieval" style="margin:0">' + U.esc(r.name) + '</label><div class="blurb muted" style="font-size:.88rem">' + U.esc(r.blurb) + '</div></div><div class="cost">£' + r.cost + 'k one-off</div></div>';
    }

    $('policies').innerHTML = D.policies.map(function (p) {
      var on = prev ? prev.policies[p.id] : false;
      var cost = [];
      if (p.oneOffCost && !(p.id === 'mandate' && state.flags.mandateEverOn)) { cost.push('£' + p.oneOffCost + 'k one-off'); }
      if (p.costPerQuarter) { cost.push('£' + p.costPerQuarter + 'k/qtr'); }
      if (p.id === 'rightsize') { cost.push('saves £90k/qtr'); }
      return '<div class="policy"><input type="checkbox" id="pol_' + p.id + '"' + (on ? ' checked' : '') + '><div><label for="pol_' + p.id + '" style="margin:0">' + U.esc(p.name) + (on ? ' <span class="tag on">On</span>' : '') + '</label><div class="blurb muted" style="font-size:.88rem">' + U.esc(p.blurb) + '</div></div><div class="cost">' + (cost.join(' · ') || 'No direct cost') + '</div></div>';
    }).join('');

    Array.prototype.forEach.call(document.querySelectorAll('#levers input, #policies input, #retrieval input'), function (i) {
      i.addEventListener('input', updateBudget);
      i.addEventListener('change', updateBudget);
    });
    updateBudget();
  }

  function readDecision() {
    var dec = { spend: {}, policies: {}, buildRetrieval: false };
    D.levers.forEach(function (l) { dec.spend[l.id] = Math.max(0, Number($('lv_' + l.id).value) || 0); });
    D.policies.forEach(function (p) { dec.policies[p.id] = $('pol_' + p.id).checked; });
    var rb = $('pol_retrieval');
    dec.buildRetrieval = !!(rb && rb.checked);
    return dec;
  }

  function updateBudget() {
    var c = M.costOf(state, readDecision());
    var max = Math.max(1, c.maxThisQuarterK);
    var meter = $('meter');
    meter.querySelector('div').style.width = Math.min(100, c.totalK / max * 100) + '%';
    meter.classList.toggle('over', !c.ok);
    $('budgetLine').innerHTML = 'Spending this quarter: <strong>' + U.money(c.totalK) + '</strong> of ' + U.money(c.maxThisQuarterK) + ' available';
    $('costLines').innerHTML = c.items.map(function (i) { return '<div><span>' + U.esc(i.label) + '</span><span>' + U.money(i.k) + '</span></div>'; }).join('') +
      '<div class="total"><span>Total</span><span>' + U.money(c.totalK) + '</span></div>';
    var quartersAfter = 3 - state.quarter;
    $('budgetNote').innerHTML = c.ok ? ('Remaining for the year: ' + U.money(c.remainingK) + '.' + (quartersAfter > 0 ? ' At least ' + U.money(quartersAfter * 126) + ' is held back for future licences.' : '')) :
      '<span style="color:var(--bad)">Over budget. Reduce spending or switch off a costly policy.</span>';
    $('submitBtn').disabled = !c.ok;
  }

  /* ---------- render ---------- */
  function renderGame() {
    var q = state.quarter; // 0-based index of the quarter being decided
    steps($('steps'), q, false);
    $('qTitle').textContent = D.meta.quarters[q];
    $('qName').textContent = D.meta.quarters[q];
    $('teamLine').textContent = state.team + (state.seedText && state.seedText !== state.team ? ' · class code ' + state.seedText : '');
    var ev = D.events[q];
    $('event').innerHTML = '<h3>' + U.esc(ev.title) + '</h3><p style="margin:0">' + U.esc(ev.text) + '</p>';
    kpis($('kpis'), state);
    U.wauChart($('wauChart'), state);
    qualChart($('qualChart'), state);
    pulse($('pulse'), state);
    buildForm();
    show('game');
  }

  function renderResult() {
    var h = state.history[state.history.length - 1];
    steps($('steps2'), state.quarter - 1, true);
    $('rTitle').textContent = 'Results: ' + D.meta.quarters[state.quarter - 1];
    kpis($('rKpis'), state);
    var log = h.log.slice();
    log.unshift({ type: 'info', text: 'You spent ' + U.money(h.costK) + ' this quarter. Weekly usage is now ' + U.pct(h.wau) + ' and an estimated ' + h.escPer100.toFixed(1) + ' factual errors per 100 deliverables reached clients.' });
    if (!h.incidents && !h.shadowIncident) { log.push({ type: 'good', text: 'No client incidents this quarter.' }); }
    $('rLog').innerHTML = log.map(function (l) { return '<li class="' + l.type + '">' + U.esc(l.text) + '</li>'; }).join('');
    $('nextBtn').textContent = state.finished ? 'Go to the debrief' : 'Continue to ' + D.meta.quarters[state.quarter];
    show('result');
  }

  function route() {
    if (!state) { show('setup'); return; }
    if (pendingResult) { renderResult(); return; }
    if (state.finished) { renderResult(); return; }
    renderGame();
  }

  /* ---------- events ---------- */
  $('startBtn').addEventListener('click', function () {
    var team = $('team').value.trim() || 'Team';
    var seed = $('seed').value.trim();
    state = M.initState({ team: team, seed: seed || team });
    U.save(state);
    route();
  });

  $('submitBtn').addEventListener('click', function () {
    var dec = readDecision();
    var c = M.costOf(state, dec);
    if (!c.ok) { return; }
    try {
      state = M.simulateQuarter(state, dec);
      U.save(state);
      pendingResult = true;
      route();
    } catch (e) { alert(e.message); }
  });

  $('nextBtn').addEventListener('click', function () {
    pendingResult = false;
    if (state.finished) { window.location.href = 'debrief.html'; return; }
    route();
  });

  $('resetBtn').addEventListener('click', function () {
    if (window.confirm('Delete this browser\'s saved game? Download your results from the debrief first if you need them.')) {
      U.clear(); state = null; pendingResult = false; route();
    }
  });

  route();
})();
