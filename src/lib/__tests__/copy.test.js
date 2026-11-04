import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copy } from '../../pages/copy.js';
import { strings } from '../../agent/strings.js';
import { TEXT } from '../../campus/text.js';

// Every Arabic string the site shows must be Modern Standard Arabic (the site is a competition entry).
const DIALECT = ['وين', 'شو', 'هلق', 'هلأ', 'بدك', 'بدي', 'مليانة', 'مليان', 'كتير', 'هيك', 'لسا', 'منيح', 'هالحاوية', 'لحد', 'رميت'];
const PREFIXES = ['', 'و', 'ف', 'ب', 'ل', 'ال', 'وال', 'بال', 'لل'];

function strs(v, out = []) {
  if (typeof v === 'string') out.push(v);
  else if (typeof v === 'function') { try { strs(v('١'), out); } catch { /* not a text template */ } }
  else if (Array.isArray(v)) v.forEach((x) => strs(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strs(x, out));
  return out;
}

function problems(text) {
  const found = [];
  if (/إيجنت/.test(text)) found.push('إيجنت');
  for (const word of text.split(/[^\p{Script=Arabic}]+/u)) {
    const bare = word.replace(/[ً-ْ]/g, '');
    if (DIALECT.some((d) => PREFIXES.some((p) => bare === p + d))) found.push(bare);
    if (bare === 'صح' || bare === 'الصح') found.push(bare);
  }
  return found;
}

test('the guard catches dialect', () => {
  assert.deepEqual(problems('وين أرمي البطاريات؟'), ['وين']);
  assert.deepEqual(problems('الحاوية مليانة'), ['مليانة']);
  assert.deepEqual(problems('تحدث مع الإيجنت'), ['إيجنت']);
  assert.deepEqual(problems('في الحاوية الصح'), ['الصح']);
  assert.deepEqual(problems('الحاوية الصحيحة ممتلئة'), []);
});

test('no dialect in any Arabic copy', () => {
  const all = [...strs(copy('ar')), ...strs(strings('ar')), ...strs(TEXT.ar)];
  assert.ok(all.length > 50, 'copy was collected');
  const bad = all.map((t) => [t, problems(t)]).filter(([, p]) => p.length);
  assert.deepEqual(bad, []);
});
