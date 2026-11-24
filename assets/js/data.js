/*
 * Meridian Hale: The Copilot Paradox — simulation data
 * All figures are constructed teaching data consistent with the case.
 */
(function (root) {
  'use strict';

  var MH_DATA = {
    meta: {
      title: 'Meridian Hale: The Copilot Paradox',
      version: '1.0.0',
      quarters: ['Q1 2027 (Jan–Mar)', 'Q2 2027 (Apr–Jun)', 'Q3 2027 (Jul–Sep)', 'Q4 2027 (Oct–Dec)'],
      quarterShort: ['Q1', 'Q2', 'Q3', 'Q4'],
      annualBudgetK: 2400,          // board's year-two envelope, £k, licences included
      licenceCostPerUserQuarterK: 0.09, // £30 per user per month = £90 per quarter
      headcount: 2400,
      rightsizeLicences: 1400,
      deliverablesPerQuarter: 3200,
      feeEarnerCapacityHoursPerQuarter: 990000, // 2,200 fee earners x 7.5h x 60 days
      blendedRatePerHourK: 0.12,    // £120 per hour
      baselineUtilisation: 68.4,
      wauTarget: 0.70
    },

    /*
     * Segments are the six grade groups from Exhibit 2 / the usage chart.
     * Construct scores are 1–7. verify = share who "always check facts and sources".
     * wau = weekly active users, September 2026. minutes = self-reported minutes saved per active user per day.
     * weights are HIDDEN from students until the debrief: they drive behavioural intention.
     */
    segments: [
      { id: 'g12', name: 'Grades 1–2 (trainees & associates)', short: 'Grades 1–2', n: 900,
        pe: 5.8, ee: 5.9, si: 5.6, fc: 4.4, trust: 5.4, verify: 0.31, wau: 0.73, minutes: 38,
        mandateFloor: 0.88, draftWeight: 0.5,
        weights: { pe: 0.30, ee: 0.15, si: 0.35, fc: 0.20 } },
      { id: 'sen', name: 'Seniors (grade 3)', short: 'Seniors', n: 500,
        pe: 5.5, ee: 5.4, si: 5.0, fc: 4.2, trust: 4.9, verify: 0.38, wau: 0.66, minutes: 36,
        mandateFloor: 0.85, draftWeight: 0.3,
        weights: { pe: 0.30, ee: 0.20, si: 0.30, fc: 0.20 } },
      { id: 'man', name: 'Managers (grade 4)', short: 'Managers', n: 420,
        pe: 4.9, ee: 4.8, si: 4.3, fc: 3.9, trust: 4.3, verify: 0.52, wau: 0.49, minutes: 31,
        mandateFloor: 0.80, draftWeight: 0.2,
        weights: { pe: 0.35, ee: 0.20, si: 0.20, fc: 0.25 } },
      { id: 'dir', name: 'Directors', short: 'Directors', n: 180,
        pe: 4.7, ee: 4.1, si: 3.6, fc: 3.6, trust: 3.7, verify: 0.61, wau: 0.33, minutes: 24,
        mandateFloor: 0.60, draftWeight: 0,
        weights: { pe: 0.40, ee: 0.25, si: 0.10, fc: 0.25 } },
      { id: 'par', name: 'Partners', short: 'Partners', n: 200,
        pe: 4.6, ee: 3.6, si: 3.1, fc: 3.2, trust: 3.2, verify: 0.70, wau: 0.19, minutes: 18,
        mandateFloor: 0.55, draftWeight: 0,
        weights: { pe: 0.45, ee: 0.25, si: 0.05, fc: 0.25 } },
      { id: 'cen', name: 'Central functions', short: 'Central', n: 200,
        pe: 4.8, ee: 5.0, si: 4.0, fc: 3.8, trust: 4.6, verify: 0.40, wau: 0.41, minutes: 22,
        mandateFloor: 0.60, draftWeight: 0,
        weights: { pe: 0.30, ee: 0.30, si: 0.15, fc: 0.25 } }
    ],

    /*
     * Investment levers: spend in £k per quarter. Effect per quarter = max x mult[segment] x (1 - exp(-spend/scale)).
     */
    levers: [
      { id: 'champions', name: 'AI Champions network', scale: 150, suggested: 100,
        blurb: 'Fund 20 champions at 10% of their time, practice by practice. Peer coaching and visible role models.',
        effects: [
          { construct: 'si', max: 0.6, mult: { g12: 1, sen: 1, man: 0.8, dir: 0.4, par: 0.2, cen: 0.7 } },
          { construct: 'fc', max: 0.5, mult: { g12: 1, sen: 1, man: 1, dir: 0.6, par: 0.4, cen: 0.8 } }
        ] },
      { id: 'useCases', name: 'Practice use-case libraries', scale: 120, suggested: 80,
        blurb: 'Tested, practice-specific use cases with worked examples on real (anonymised) client work.',
        effects: [
          { construct: 'pe', max: 0.7, mult: { g12: 0.5, sen: 0.7, man: 0.9, dir: 1, par: 1, cen: 0.6 } },
          { construct: 'fc', max: 0.2, mult: { g12: 1, sen: 1, man: 1, dir: 1, par: 1, cen: 1 } }
        ] },
      { id: 'mentoring', name: 'Partner reverse mentoring', scale: 60, suggested: 40,
        blurb: 'Juniors coach partners and directors one-to-one on their own client work.',
        effects: [
          { construct: 'ee', max: 0.8, mult: { g12: 0, sen: 0, man: 0.3, dir: 0.8, par: 1, cen: 0 } },
          { construct: 'si', max: 0.4, mult: { g12: 0, sen: 0, man: 0.2, dir: 0.8, par: 1, cen: 0 } }
        ] },
      { id: 'skills', name: 'Prompting & skills training', scale: 100, suggested: 60,
        blurb: 'Hands-on workshops on getting good output: prompting, iterating, using the knowledge base.',
        effects: [
          { construct: 'ee', max: 0.6, mult: { g12: 0.3, sen: 0.5, man: 0.8, dir: 1, par: 1, cen: 1 } }
        ] },
      { id: 'calibration', name: '"When to rely" calibration course', scale: 100, suggested: 80,
        blurb: 'A 90-minute course for all grades on where the tool is strong and weak, and how to verify.',
        effects: [
          { construct: 'fc', max: 0.4, mult: { g12: 1, sen: 1, man: 1, dir: 1, par: 1, cen: 1 } }
        ] }
    ],

    /* Policies: switches that apply while on. Costs in £k. */
    policies: [
      { id: 'mandate', name: 'Mandate AI steps in workflows (Option A)', costPerQuarter: 0, oneOffCost: 250,
        blurb: 'Build AI steps into 14 standard workflow templates. Use becomes expected, not optional. £250k one-off redesign.' },
      { id: 'appraisal', name: 'Add "effective use of AI" to appraisals', costPerQuarter: 0, oneOffCost: 0,
        blurb: 'Appraisal competency for all grades. Signals that use matters for progression.' },
      { id: 'verifyProtocol', name: 'Verification protocol + AI-assisted flag (Option C)', costPerQuarter: 60, oneOffCost: 0,
        blurb: 'Every AI-drafted factual claim must be source-checked; reviewers see an "AI-assisted" flag. QA sampling £60k per quarter.' },
      { id: 'banCitations', name: 'Ban AI-generated citations in client deliverables', costPerQuarter: 0, oneOffCost: 0,
        blurb: 'No AI-sourced references, deal comparables or quotations in client work unless independently sourced.' },
      { id: 'liftBan', name: 'Lift the Restructuring ban', costPerQuarter: 0, oneOffCost: 0,
        blurb: 'Allow Restructuring (160 people) to use Meridian Assist on client work again.' },
      { id: 'rightsize', name: 'Right-size licences to 1,400 (Option D)', costPerQuarter: 0, oneOffCost: 0,
        blurb: 'Keep licences only for current active users. Licence cost falls from £216k to £126k a quarter.' },
      { id: 'capacityPlan', name: 'Capacity reinvestment plan', costPerQuarter: 40, oneOffCost: 0,
        blurb: 'Practice leaders re-plan staffing and pricing so saved time becomes chargeable capacity. £40k per quarter.' }
    ],

    retrieval: {
      id: 'retrieval', name: 'Build verified-retrieval feature', cost: 300,
      blurb: 'Engineering work so Meridian Assist cites only documents it can actually retrieve. £300k one-off; live from the following quarter.'
    },

    /* Scripted events, shown at the start of each quarter. */
    events: [
      { quarter: 1, title: 'Insurer asks for AI controls',
        text: 'Your professional indemnity broker writes: "Underwriters will need written evidence of effective controls over generative AI in client deliverables before the mid-year review. Without it, a premium loading of around £180,000 is likely." The deadline is the end of Q2.' },
      { quarter: 2, title: 'A competitor cuts due diligence fees',
        text: 'A top-10 rival announces a 15% cut in financial due diligence fees "enabled by AI". Two of your PE clients forward the press release. Harrow Lane Capital will decide at the end of this quarter whether to resume instructions.' },
      { quarter: 3, title: 'New model version released',
        text: 'The vendor upgrades the underlying model. Internal tests show factual errors falling by about 30%. Staff love it, and trust in the tool jumps across the firm. Your Head of Quality & Risk warns: "Better is not the same as reliable."' },
      { quarter: 4, title: 'Graduate intake and audit methodology',
        text: '140 graduates join in October with no Meridian Assist experience. Separately, the audit methodology team says it will approve AI-assisted procedures, but only if a firm-wide verification protocol is in force.' }
    ],

    incidentStories: [
      'A Deal Advisory report quoted a market growth rate from an industry study that does not contain it. The client spotted it in a lender meeting.',
      'A tax memo relied on a superseded HMRC manual paragraph suggested by the tool. The client\'s in-house team caught it.',
      'A valuation appendix listed a "comparable" transaction at the wrong multiple. The buyer\'s adviser challenged it.',
      'An audit planning memo summarised a board minute that did not exist in the client file.',
      'A public sector client found two fabricated references in a policy review appendix.',
      'A restructuring creditor update misstated a statutory deadline drafted with AI assistance.'
    ],

    /* Debrief: benchmark strategies run on the same seed for comparison. */
    benchmarks: [
      { id: 'A', name: 'Pure Option A: mandate', quarters: [
        { spend: { champions: 50, skills: 100 }, policies: { mandate: true, appraisal: true } },
        { spend: { champions: 100, skills: 100 }, policies: { mandate: true, appraisal: true } },
        { spend: { champions: 100, skills: 100 }, policies: { mandate: true, appraisal: true } },
        { spend: { champions: 100, skills: 100 }, policies: { mandate: true, appraisal: true } } ] },
      { id: 'B', name: 'Pure Option B: targeted enablement', quarters: [
        { spend: { champions: 150, useCases: 120, mentoring: 60, skills: 50 }, policies: {} },
        { spend: { champions: 150, useCases: 120, mentoring: 60, skills: 50 }, policies: {} },
        { spend: { champions: 150, useCases: 120, mentoring: 60, skills: 50 }, policies: {} },
        { spend: { champions: 150, useCases: 120, mentoring: 60, skills: 50 }, policies: {} } ] },
      { id: 'C', name: 'Pure Option C: guardrails first', quarters: [
        { spend: { calibration: 120 }, buildRetrieval: true, policies: { verifyProtocol: true, banCitations: true } },
        { spend: { calibration: 120, skills: 50 }, policies: { verifyProtocol: true, banCitations: true } },
        { spend: { calibration: 120, skills: 50 }, policies: { verifyProtocol: true, banCitations: true } },
        { spend: { calibration: 120, skills: 50 }, policies: { verifyProtocol: true, banCitations: true } } ] },
      { id: 'D', name: 'Pure Option D: right-size', quarters: [
        { spend: { calibration: 100, skills: 100, champions: 50 }, policies: { rightsize: true } },
        { spend: { calibration: 100, skills: 100, champions: 50 }, policies: { rightsize: true } },
        { spend: { calibration: 100, skills: 100, champions: 50 }, policies: { rightsize: true } },
        { spend: { calibration: 100, skills: 100, champions: 50 }, policies: { rightsize: true } } ] },
      { id: 'S', name: 'Sequenced: guardrails, then enablement', quarters: [
        { spend: { calibration: 120, useCases: 60, mentoring: 30 }, buildRetrieval: true, policies: { verifyProtocol: true, banCitations: true } },
        { spend: { calibration: 60, champions: 60, useCases: 60, mentoring: 40 }, policies: { verifyProtocol: true, banCitations: true, capacityPlan: true } },
        { spend: { calibration: 60, champions: 60, useCases: 60, mentoring: 40 }, policies: { verifyProtocol: true, banCitations: true, capacityPlan: true } },
        { spend: { calibration: 60, champions: 60, useCases: 60, mentoring: 40 }, policies: { verifyProtocol: true, banCitations: true, capacityPlan: true, liftBan: true } } ] }
    ],

    scoreWeights: { adoption: 0.15, reliance: 0.20, quality: 0.20, value: 0.20, risk: 0.10, people: 0.15 }
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = MH_DATA; }
  root.MH_DATA = MH_DATA;
})(typeof window !== 'undefined' ? window : globalThis);
