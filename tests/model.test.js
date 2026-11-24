/* Run with: node tests/model.test.js */
'use strict';
var assert = require('assert');
var M = require('../assets/js/model.js');
var D = require('../assets/js/data.js');

var passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { console.error('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1; }
}

console.log('Meridian Hale simulation model');

test('baseline reproduces the case (57% WAU, 11.1 escaped errors per 100)', function () {
  var st = M.initState({ team: 'T' });
  var h = st.history[0];
  assert.ok(Math.abs(h.wau - 0.57) < 0.01, 'WAU ' + h.wau);
  assert.ok(Math.abs(h.escPer100 - 11.1) < 0.2, 'escPer100 ' + h.escPer100);
  assert.strictEqual(h.utilisation, 68.4);
});

test('baseline grade WAU matches Exhibit 2', function () {
  var h = M.initState({ team: 'T' }).history[0];
  D.segments.forEach(function (s) { assert.strictEqual(h.segments[s.id].wau, s.wau); });
});

test('doing nothing leaves adoption flat', function () {
  var st = M.runStrategy([{}, {}, {}, {}], { team: 'T' });
  assert.ok(Math.abs(st.history[4].wau - 0.57) < 0.02);
});

test('same team and seed give identical results', function () {
  var a = M.runStrategy(D.benchmarks[1].quarters, { team: 'X', seed: 'class-1' });
  var b = M.runStrategy(D.benchmarks[1].quarters, { team: 'Y', seed: 'class-1' });
  assert.deepStrictEqual(a.history.map(function (h) { return h.incidents; }), b.history.map(function (h) { return h.incidents; }));
});

test('every benchmark strategy fits the budget', function () {
  D.benchmarks.forEach(function (b) {
    var st = M.runStrategy(b.quarters, { team: 'T' });
    assert.ok(st.spentK <= D.meta.annualBudgetK, b.id + ' spent ' + st.spentK);
  });
});

test('mandate raises adoption above target but worsens quality (the paradox)', function () {
  var a = M.runStrategy(D.benchmarks[0].quarters, { team: 'T' });
  var last = a.history[4];
  assert.ok(last.wau >= D.meta.wauTarget, 'WAU ' + last.wau);
  assert.ok(last.escPer100 > 11.1, 'escPer100 ' + last.escPer100);
});

test('guardrails cut escaped errors by more than half', function () {
  var c = M.runStrategy(D.benchmarks[2].quarters, { team: 'T' });
  assert.ok(c.history[4].escPer100 < 5.5, 'escPer100 ' + c.history[4].escPer100);
});

test('partners respond more to use cases and mentoring than to champions', function () {
  var base = { team: 'T' };
  var champ = M.runStrategy([{ spend: { champions: 300 } }, {}, {}, {}], base);
  var enable = M.runStrategy([{ spend: { useCases: 150, mentoring: 150 } }, {}, {}, {}], base);
  assert.ok(enable.history[1].segments.par.wau > champ.history[1].segments.par.wau);
});

test('budget check rejects overspending', function () {
  var st = M.initState({ team: 'T' });
  var c = M.costOf(st, { spend: { champions: 5000 } });
  assert.strictEqual(c.ok, false);
  assert.throws(function () { M.simulateQuarter(st, { spend: { champions: 5000 } }); });
});

test('mandate one-off cost is charged once', function () {
  var st = M.initState({ team: 'T' });
  var c1 = M.costOf(st, { policies: { mandate: true } });
  st = M.simulateQuarter(st, { policies: { mandate: true } });
  var c2 = M.costOf(st, { policies: { mandate: true } });
  assert.strictEqual(c1.totalK - c2.totalK, 250);
});

test('right-sizing caps licences at 1,400 users', function () {
  var st = M.runStrategy([{ policies: { rightsize: true }, spend: { champions: 150, useCases: 120 } }, {}, {}, {}], { team: 'T' });
  var users = st.history[1].wau * D.meta.headcount;
  assert.ok(users <= D.meta.rightsizeLicences + 1, 'users ' + users);
});

test('scorecard is within 0-100 and CSV has one row per quarter plus baseline', function () {
  var st = M.runStrategy(D.benchmarks[4].quarters, { team: 'T' });
  var s = M.scorecard(st);
  ['adoption', 'reliance', 'quality', 'value', 'risk', 'people', 'overall'].forEach(function (k) {
    assert.ok(s[k] >= 0 && s[k] <= 100, k + ' ' + s[k]);
  });
  assert.strictEqual(M.toCSV(st).split('\n').length, 6);
});

console.log('\n' + passed + ' passed');
