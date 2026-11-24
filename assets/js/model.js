/*
 * Meridian Hale: The Copilot Paradox — simulation engine
 *
 * A UTAUT-based adoption model with an automation-bias quality layer.
 * Pure functions, no DOM. Runs in the browser (window.MHModel) and in Node (module.exports).
 */
(function (root) {
  'use strict';

  var D = root.MH_DATA || (typeof require !== 'undefined' ? require('./data.js') : null);
  if (!D) { throw new Error('MH_DATA not loaded'); }

  /* ---------- constants (documented on the instructor page) ---------- */
  var K = 1.2;                 // sensitivity of intention to construct changes
  var ADJUST = 0.6;            // share of the gap to target usage closed each quarter
  var DECAY = 0.08;            // quarterly decay of SI and FC gains without upkeep
  var RESTRUCT_SHARE = 160 / 2400;
  var BAN_SUPPRESSION = 0.85;  // banned staff use the tool ~85% less
  var E_AI0 = 0.28;            // factual-error rate in AI-assisted deliverables (Exhibit 3)
  var E_NON = 0.08;            // factual-error rate without AI
  var CATCH0 = 0.39;           // review catch rate for AI errors (Exhibit 3)
  var CATCH_NON = 0.71;
  var DRAFT_SHARE_MAX = 0.9;
  var VERIFY_DRAFT0 = 0.5 * 0.31 + 0.3 * 0.38 + 0.2 * 0.52;
  var ESCALATION = 0.003;      // chance an escaped error becomes a client incident
  var REALISATION0 = 0.55;     // share of self-reported time saving that is real
  var CONV0 = 0.25, CONV_PLAN = 0.35;
  var HL_RETURN_VALUE_K = 250;
  var PREMIUM_LOADING_K = 180;
  var SHADOW_INCIDENT_COST_K = 120;

  /* ---------- helpers ---------- */
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
  function logit(p) { p = clamp(p, 0.001, 0.999); return Math.log(p / (1 - p)); }
  function sat(spend, scale) { return 1 - Math.exp(-Math.max(0, spend || 0) / scale); }
  function round(x, dp) { var f = Math.pow(10, dp || 0); return Math.round(x * f) / f; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function hashString(s) {
    var h = 2166136261;
    s = String(s);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function poisson(lambda, rand) {
    if (lambda <= 0) { return 0; }
    var L = Math.exp(-lambda), k = 0, p = 1;
    do { k++; p *= rand(); } while (p > L && k < 60);
    return k - 1;
  }

  function seg(id) { for (var i = 0; i < D.segments.length; i++) { if (D.segments[i].id === id) { return D.segments[i]; } } return null; }
  function lever(id) { for (var i = 0; i < D.levers.length; i++) { if (D.levers[i].id === id) { return D.levers[i]; } } return null; }
  function policy(id) { for (var i = 0; i < D.policies.length; i++) { if (D.policies[i].id === id) { return D.policies[i]; } } return null; }

  function normaliseDecision(dec) {
    dec = dec || {};
    var out = { spend: {}, policies: {}, buildRetrieval: !!dec.buildRetrieval };
    D.levers.forEach(function (l) { out.spend[l.id] = Math.max(0, Math.round(Number((dec.spend || {})[l.id]) || 0)); });
    D.policies.forEach(function (p) { out.policies[p.id] = !!(dec.policies || {})[p.id]; });
    return out;
  }

  /* ---------- state ---------- */
  function weightedScore(s, w, mods) {
    mods = mods || {};
    return w.pe * (s.pe + (mods.pe || 0)) + w.ee * (s.ee + (mods.ee || 0)) +
      w.si * (s.si + (mods.si || 0)) * (mods.siMult || 1) + w.fc * (s.fc + (mods.fc || 0));
  }

  function initState(opts) {
    opts = opts || {};
    var team = opts.team || 'Team';
    var seed = (opts.seed !== undefined && opts.seed !== '') ? hashString(opts.seed) : hashString(team);
    var segs = D.segments.map(function (s) {
      var intent = s.wau / (1 - RESTRUCT_SHARE * BAN_SUPPRESSION);
      return {
        id: s.id, n: s.n,
        pe: s.pe, ee: s.ee, si: s.si, fc: s.fc, trust: s.trust, verify: s.verify,
        base: { pe: s.pe, ee: s.ee, si: s.si, fc: s.fc },
        intent0: intent, intent: intent, wau: s.wau, target: intent,
        score0: weightedScore(s, s.weights), complianceShare: 0, verifyUse: s.verify
      };
    });
    var st = {
      version: D.meta.version, team: team, seedText: String(opts.seed || team), seed: seed,
      quarter: 0, spentK: 0, finished: false,
      segments: segs,
      levels: { calibration: 0, useCases: 0, champions: 0, skills: 0, mentoring: 0 },
      cumSpend: { calibration: 0, useCases: 0, champions: 0, skills: 0, mentoring: 0 },
      flags: { retrievalOrdered: false, retrievalLive: false, mandateEverOn: false, modelUpgrade: false,
        auditApproved: false, premiumLoading: false, harrowLane: 'paused', licenceCaps: null },
      indices: { sentiment: 62, partnerSupport: 40, clientTrust: 60 },
      totals: { incidents: 0, shadowIncidents: 0, incidentCostK: 0, valueK: 0, hoursSaved: 0 },
      decisions: [], history: [], log: []
    };
    var snap = measure(st, normaliseDecision({}), null, true);
    st.baseline = { convHours: snap.hoursRealised * CONV0, escPer100: snap.escPer100 };
    snap.utilisation = D.meta.baselineUtilisation;
    snap.incrementalValueK = 0;
    st.history.push(snap);
    return st;
  }

  /* ---------- costs ---------- */
  function licenceCostK(policies) {
    var users = policies.rightsize ? D.meta.rightsizeLicences : D.meta.headcount;
    return users * D.meta.licenceCostPerUserQuarterK;
  }

  function costOf(state, decision) {
    var dec = normaliseDecision(decision);
    var items = [];
    var lic = licenceCostK(dec.policies);
    items.push({ label: 'Licences', k: lic });
    D.levers.forEach(function (l) { if (dec.spend[l.id] > 0) { items.push({ label: l.name, k: dec.spend[l.id] }); } });
    D.policies.forEach(function (p) {
      if (!dec.policies[p.id]) { return; }
      var k = p.costPerQuarter;
      if (p.id === 'mandate' && !state.flags.mandateEverOn) { k += p.oneOffCost; }
      if (k > 0) { items.push({ label: p.name, k: k }); }
    });
    if (dec.buildRetrieval && !state.flags.retrievalOrdered) { items.push({ label: D.retrieval.name, k: D.retrieval.cost }); }
    var total = items.reduce(function (a, b) { return a + b.k; }, 0);
    var remaining = D.meta.annualBudgetK - state.spentK;
    var quartersAfter = 4 - (state.quarter + 1);
    var reserve = quartersAfter * D.meta.rightsizeLicences * D.meta.licenceCostPerUserQuarterK;
    var reserveFull = quartersAfter * D.meta.headcount * D.meta.licenceCostPerUserQuarterK;
    return { items: items, totalK: round(total, 1), remainingK: round(remaining, 1),
      maxThisQuarterK: round(remaining - reserve, 1),
      maxIfFullLicencesK: round(remaining - reserveFull, 1),
      ok: total <= remaining - reserve + 0.001 };
  }

  /* ---------- measurement (no state change except derived fields) ---------- */
  function effectiveMods(state, s, pol) {
    var m = { pe: 0, ee: 0, si: 0, fc: 0, siMult: 1 };
    if (pol.banCitations && (s.id === 'g12' || s.id === 'sen')) { m.pe -= 0.2; }
    if (state.flags.auditApproved && (s.id === 'g12' || s.id === 'sen')) { m.pe += 0.5; }
    if (pol.verifyProtocol) { m.ee -= 0.4; m.fc += 0.3; }
    if (pol.appraisal) { m.si += (s.id === 'par' ? 0.3 : 0.8); }
    if (pol.rightsize) { m.si -= 0.3; }
    if (pol.mandate) { m.siMult = 1.3; }
    return m;
  }

  function measure(state, dec, rand, isBaseline) {
    var pol = dec.policies;
    var M = D.meta;
    var segOut = {};
    var totalUsers = 0, relianceSum = 0, hours = 0, shadowUsers = 0;
    var draftShare = 0, verifyDraft = 0, manVerifyUse = 0.52;

    state.segments.forEach(function (s) {
      var def = seg(s.id);
      var a = s.wau;
      var verifyEff = clamp(s.verify + (pol.verifyProtocol ? 0.15 : 0), 0, 0.95);
      var verifyUse = verifyEff * (1 - 0.4 * s.complianceShare);
      s.verifyUse = verifyUse;
      totalUsers += a * s.n;
      relianceSum += a * s.n * verifyUse;
      var minutes = def.minutes * (1 + 0.1 * state.levels.useCases);
      hours += s.n * a * minutes; // minutes/day x 60 days / 60 = hours per quarter
      draftShare += def.draftWeight * a;
      verifyDraft += def.draftWeight * verifyUse;
      if (s.id === 'man') { manVerifyUse = verifyUse; }
      if (!isBaseline && (s.id === 'g12' || s.id === 'sen')) {
        var unmet = 0;
        if (pol.rightsize) { unmet += Math.max(0, s.target - a); }
        if (pol.verifyProtocol && state.levels.calibration < 0.3) { unmet += 0.1 * s.intent; }
        if (pol.banCitations && state.levels.calibration < 0.3) { unmet += 0.04 * s.intent; }
        shadowUsers += s.n * unmet;
      }
      var mods = effectiveMods(state, s, pol);
      segOut[s.id] = { wau: round(a, 4), intent: round(s.intent, 4), verifyUse: round(verifyUse, 3),
        pe: round(clamp(s.pe + mods.pe, 1, 7), 2), ee: round(clamp(s.ee + mods.ee, 1, 7), 2),
        si: round(clamp(s.si + mods.si, 1, 7), 2), fc: round(clamp(s.fc + mods.fc, 1, 7), 2), trust: round(s.trust, 2),
        complianceShare: round(s.complianceShare, 3) };
    });

    var wau = totalUsers / M.headcount;
    var realisation = Math.min(0.85, REALISATION0 + 0.15 * state.levels.calibration + 0.1 * state.levels.useCases +
      (state.flags.retrievalLive ? 0.05 : 0));
    var hoursRealised = hours * realisation;

    // Quality
    var Dq = M.deliverablesPerQuarter;
    var share = DRAFT_SHARE_MAX * draftShare;
    var eAI = E_AI0 * (state.flags.retrievalLive ? 0.7 : 1) * (state.flags.modelUpgrade ? 0.75 : 1) *
      (pol.banCitations ? 0.8 : 1) * (1 - 0.5 * verifyDraft) / (1 - 0.5 * VERIFY_DRAFT0);
    var catchRate = clamp(CATCH0 + (pol.verifyProtocol ? 0.15 : 0) + 0.1 * state.levels.calibration +
      0.2 * (manVerifyUse - 0.52) - (pol.mandate ? 0.05 : 0), 0.1, 0.85);
    var escapedAI = Dq * share * eAI * (1 - catchRate);
    var escapedNon = Dq * (1 - share) * E_NON * (1 - CATCH_NON);
    var escaped = escapedAI + escapedNon;

    return {
      quarter: state.quarter,
      wau: round(wau, 4), segments: segOut,
      reliance: round(relianceSum / M.headcount, 4),
      hoursRealised: Math.round(hoursRealised), realisation: round(realisation, 3),
      aiShare: round(share, 3), errorRateAI: round(eAI, 4), catchRate: round(catchRate, 3),
      escaped: round(escaped, 1), escPer100: round(escaped / Dq * 100, 2),
      shadowUsers: Math.round(shadowUsers)
    };
  }

  /* ---------- one quarter ---------- */
  function simulateQuarter(stateIn, decisionIn) {
    if (stateIn.finished) { throw new Error('Simulation already finished'); }
    var state = clone(stateIn);
    var dec = normaliseDecision(decisionIn);
    var cost = costOf(state, dec);
    if (!cost.ok) { throw new Error('Decision exceeds the remaining budget'); }
    var q = state.quarter + 1;
    var rand = mulberry32(state.seed + q * 7919);
    var pol = dec.policies;
    var log = [];

    /* events at the start of the quarter */
    if (state.flags.retrievalOrdered && !state.flags.retrievalLive) {
      state.flags.retrievalLive = true;
      log.push({ type: 'good', text: 'Verified retrieval is now live: the tool only cites documents it can actually retrieve.' });
    }
    if (q === 3) {
      state.flags.modelUpgrade = true;
      state.segments.forEach(function (s) { s.trust = clamp(s.trust + 0.5, 1, 7); });
      if (state.levels.calibration < 0.3) {
        state.segments.forEach(function (s) { s.verify = clamp(s.verify - 0.08, 0.05, 0.95); });
        log.push({ type: 'bad', text: 'The new model feels so good that staff check less. Without calibration training, verification habits slipped across all grades.' });
      } else {
        log.push({ type: 'info', text: 'The new model reduced errors. Because staff had been through calibration training, verification habits held.' });
      }
    }
    if (q === 4) {
      var g = state.segments.filter(function (s) { return s.id === 'g12'; })[0];
      g.ee = clamp(g.ee - 0.3, 1, 7);
      if (pol.verifyProtocol) {
        state.flags.auditApproved = true;
        log.push({ type: 'good', text: 'With a verification protocol in force, the audit methodology team approved AI-assisted procedures. Junior audit staff see more value in the tool.' });
      } else {
        log.push({ type: 'info', text: 'No verification protocol, so audit methodology has not approved AI-assisted procedures.' });
      }
    }

    /* levers */
    D.levers.forEach(function (l) {
      var spend = dec.spend[l.id];
      var f = sat(spend, l.scale);
      state.cumSpend[l.id] += spend;
      state.levels[l.id] = sat(state.cumSpend[l.id], l.scale * 2.5);
      l.effects.forEach(function (e) {
        state.segments.forEach(function (s) {
          var m = e.mult[s.id] || 0;
          s[e.construct] = clamp(s[e.construct] + e.max * m * f, 1, 7);
        });
      });
    });
    var calF = sat(dec.spend.calibration, lever('calibration').scale);

    /* decay and calibration-driven trust/verification */
    state.segments.forEach(function (s) {
      s.si -= DECAY * (s.si - s.base.si);
      s.fc -= DECAY * (s.fc - s.base.fc);
      var reliability = 7 * (1 - E_AI0 * (state.flags.modelUpgrade ? 0.75 : 1) * (state.flags.retrievalLive ? 0.7 : 1));
      var warranted = clamp(reliability - 1.2, 1, 7);
      s.trust += 0.4 * calF * (warranted - s.trust);
      s.verify = clamp(s.verify + 0.15 * calF * (1 - s.verify), 0, 0.95);
    });

    /* usage */
    if (pol.rightsize && !state.flags.licenceCaps) {
      var users = state.segments.reduce(function (a, s) { return a + s.n * s.wau; }, 0);
      var scale = (D.meta.rightsizeLicences / users);
      state.flags.licenceCaps = {};
      state.segments.forEach(function (s) { state.flags.licenceCaps[s.id] = Math.min(1, s.wau * scale); });
      log.push({ type: 'info', text: 'Licences cut to 1,400, allocated to current active users.' });
    }
    if (!pol.rightsize && state.flags.licenceCaps) {
      state.flags.licenceCaps = null;
      log.push({ type: 'info', text: 'Licences restored to all 2,400 staff.' });
    }
    state.segments.forEach(function (s) {
      var def = seg(s.id);
      var mods = effectiveMods(state, s, pol);
      var score = weightedScore(s, def.weights, mods);
      s.target = sigmoid(logit(s.intent0) + K * (score - s.score0));
      s.intent = s.intent + ADJUST * (s.target - s.intent);
      var a = s.intent;
      if (pol.mandate) { a = Math.max(a, def.mandateFloor); }
      s.complianceShare = a > 0 ? Math.max(0, (a - s.intent) / a) : 0;
      if (!pol.liftBan) { a *= (1 - RESTRUCT_SHARE * BAN_SUPPRESSION); }
      if (state.flags.licenceCaps) { a = Math.min(a, state.flags.licenceCaps[s.id]); }
      s.wau = clamp(a, 0, 0.99);
    });
    if (pol.mandate) { state.flags.mandateEverOn = true; }
    if (dec.buildRetrieval && !state.flags.retrievalOrdered) {
      state.flags.retrievalOrdered = true;
      log.push({ type: 'info', text: 'Verified-retrieval build commissioned. It goes live next quarter.' });
    }

    /* measure */
    state.quarter = q;
    var r = measure(state, dec, rand, false);

    /* value */
    var conv = pol.capacityPlan ? CONV_PLAN : CONV0;
    var convHours = r.hoursRealised * conv;
    var incremental = (convHours - state.baseline.convHours) * D.meta.blendedRatePerHourK;
    r.utilisation = round(D.meta.baselineUtilisation + 100 * (convHours - state.baseline.convHours) / D.meta.feeEarnerCapacityHoursPerQuarter, 2);
    r.incrementalValueK = Math.round(incremental);

    /* incidents */
    var riskMult = (pol.liftBan && !pol.verifyProtocol) ? 1.3 : 1;
    var lambda = r.escaped * ESCALATION * riskMult;
    var incidents = poisson(lambda, rand);
    var incidentCost = 0;
    for (var i = 0; i < incidents; i++) {
      var c = Math.round(40 + rand() * 110);
      incidentCost += c;
      var story = D.incidentStories[Math.floor(rand() * D.incidentStories.length)];
      log.push({ type: 'bad', text: 'Client incident (fee reduction £' + c + 'k): ' + story });
    }
    var pShadow = Math.min(0.4, r.shadowUsers / 800);
    var shadow = (r.shadowUsers > 0 && rand() < pShadow) ? 1 : 0;
    if (shadow) {
      incidentCost += SHADOW_INCIDENT_COST_K;
      log.push({ type: 'bad', text: 'Confidentiality breach: juniors frustrated by restrictions pasted client data into a public AI tool. Remediation and client notification cost £' + SHADOW_INCIDENT_COST_K + 'k.' });
    } else if (r.shadowUsers > 150) {
      log.push({ type: 'warn', text: 'IT security reports rising traffic to public AI tools from junior staff (an estimated ' + r.shadowUsers + ' people). No breach yet.' });
    }
    r.incidents = incidents; r.shadowIncident = shadow; r.incidentCostK = incidentCost;

    /* indices */
    var I = state.indices;
    var sp = dec.spend;
    I.sentiment += 4 * sat(sp.champions, 150) + 2 * sat(sp.skills, 100) + 2 * sat(sp.mentoring, 60) + 1.5 * calF -
      (pol.mandate ? 6 : 0) - (pol.appraisal ? 3 : 0) - (pol.verifyProtocol ? 1.5 : 0) - (pol.rightsize ? 3 : 0) -
      shadow * 3 - incidents * 1;
    I.sentiment += 0.1 * (60 - I.sentiment);
    I.partnerSupport += 10 * sat(sp.useCases, 120) + 8 * sat(sp.mentoring, 60) - (pol.mandate ? 10 : 0) -
      (pol.appraisal ? 6 : 0) - incidents * 3 + (pol.verifyProtocol ? 2 : 0) - ((pol.liftBan && !pol.verifyProtocol) ? 6 : 0);
    I.clientTrust += (pol.verifyProtocol ? 3 : 0) + (pol.banCitations ? 2 : 0) - incidents * 7 - shadow * 10;

    /* end-of-quarter checks */
    if (q === 2) {
      var controls = pol.verifyProtocol || state.levels.calibration >= 0.35;
      if (!controls) {
        state.flags.premiumLoading = true;
        incidentCost += PREMIUM_LOADING_K; r.incidentCostK = incidentCost;
        log.push({ type: 'bad', text: 'Insurers were not satisfied with your AI controls. A £' + PREMIUM_LOADING_K + 'k premium loading applies.' });
      } else {
        log.push({ type: 'good', text: 'Insurers accepted your evidence of AI controls. No premium loading.' });
      }
      var earlyIncidents = state.totals.incidents + incidents;
      if (earlyIncidents === 0 && (pol.verifyProtocol || pol.banCitations)) {
        state.flags.harrowLane = 'returned';
        r.incrementalValueK += HL_RETURN_VALUE_K;
        I.clientTrust += 10;
        log.push({ type: 'good', text: 'Harrow Lane Capital resumed instructions, citing your new controls. £' + HL_RETURN_VALUE_K + 'k of work in the pipeline this quarter.' });
      } else {
        state.flags.harrowLane = 'lost';
        log.push({ type: 'bad', text: 'Harrow Lane Capital moved its next two mandates to a competitor.' });
      }
    }
    I.sentiment = clamp(I.sentiment, 0, 100);
    I.partnerSupport = clamp(I.partnerSupport, 0, 100);
    I.clientTrust = clamp(I.clientTrust, 0, 100);
    r.indices = { sentiment: round(I.sentiment, 1), partnerSupport: round(I.partnerSupport, 1), clientTrust: round(I.clientTrust, 1) };

    /* totals */
    state.totals.incidents += incidents;
    state.totals.shadowIncidents += shadow;
    state.totals.incidentCostK += incidentCost;
    state.totals.valueK += r.incrementalValueK;
    state.totals.hoursSaved += r.hoursRealised;
    state.spentK = round(state.spentK + cost.totalK, 1);
    r.costK = cost.totalK;
    r.cost = cost.items;
    r.log = log;

    state.decisions.push(dec);
    state.history.push(r);
    if (q >= 4) { state.finished = true; }
    return state;
  }

  /* ---------- scorecard ---------- */
  function scorecard(state) {
    var last = state.history[state.history.length - 1];
    var W = D.scoreWeights;
    var s = {
      adoption: clamp(last.wau / D.meta.wauTarget * 100, 0, 100),
      reliance: clamp(last.reliance / 0.5 * 100, 0, 100),
      quality: clamp(100 - (last.escPer100 / 11.1) * 60, 0, 100),
      value: clamp(state.totals.valueK / 4000 * 100, 0, 100),
      risk: clamp(100 - 12 * state.totals.incidents - 20 * state.totals.shadowIncidents - (state.flags.premiumLoading ? 15 : 0), 0, 100),
      people: clamp((last.indices ? (last.indices.sentiment + last.indices.partnerSupport) / 2 : 51), 0, 100)
    };
    var overall = 0;
    Object.keys(W).forEach(function (k) { overall += W[k] * s[k]; });
    Object.keys(s).forEach(function (k) { s[k] = Math.round(s[k]); });
    s.overall = Math.round(overall);
    s.boardKpiMet = last.wau >= D.meta.wauTarget;
    return s;
  }

  /* ---------- run a full strategy (for benchmarks and tests) ---------- */
  function runStrategy(quarters, opts) {
    var st = initState(opts);
    for (var i = 0; i < 4; i++) {
      var dec = normaliseDecision(quarters[i] || {});
      var c = costOf(st, dec);
      if (!c.ok) { throw new Error('Strategy over budget in quarter ' + (i + 1) + ': ' + c.totalK + ' > ' + c.maxThisQuarterK); }
      st = simulateQuarter(st, dec);
    }
    return st;
  }

  function benchmarks(opts) {
    return D.benchmarks.map(function (b) {
      var st = runStrategy(b.quarters, opts);
      return { id: b.id, name: b.name, state: st, score: scorecard(st) };
    });
  }

  /* ---------- export ---------- */
  function toCSV(state) {
    var head = ['team', 'quarter', 'wau', 'reliance', 'escPer100', 'catchRate', 'errorRateAI', 'utilisation',
      'incrementalValueK', 'incidents', 'shadowIncident', 'incidentCostK', 'sentiment', 'partnerSupport', 'clientTrust', 'costK'];
    D.segments.forEach(function (s) { head.push('wau_' + s.id); });
    var rows = [head.join(',')];
    state.history.forEach(function (h) {
      var row = [JSON.stringify(state.team), h.quarter, h.wau, h.reliance, h.escPer100, h.catchRate, h.errorRateAI,
        h.utilisation, h.incrementalValueK, h.incidents || 0, h.shadowIncident || 0, h.incidentCostK || 0,
        h.indices ? h.indices.sentiment : 62, h.indices ? h.indices.partnerSupport : 40, h.indices ? h.indices.clientTrust : 60, h.costK || 0];
      D.segments.forEach(function (s) { row.push(h.segments[s.id].wau); });
      rows.push(row.join(','));
    });
    return rows.join('\n');
  }

  var api = {
    initState: initState, simulateQuarter: simulateQuarter, costOf: costOf, scorecard: scorecard,
    runStrategy: runStrategy, benchmarks: benchmarks, normaliseDecision: normaliseDecision, toCSV: toCSV,
    constants: { K: K, ADJUST: ADJUST, DECAY: DECAY, E_AI0: E_AI0, E_NON: E_NON, CATCH0: CATCH0, CATCH_NON: CATCH_NON,
      ESCALATION: ESCALATION, REALISATION0: REALISATION0, CONV0: CONV0, CONV_PLAN: CONV_PLAN,
      BAN_SUPPRESSION: BAN_SUPPRESSION, PREMIUM_LOADING_K: PREMIUM_LOADING_K, HL_RETURN_VALUE_K: HL_RETURN_VALUE_K },
    _internals: { sat: sat, sigmoid: sigmoid, logit: logit, hashString: hashString, poisson: poisson, mulberry32: mulberry32 }
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  root.MHModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
