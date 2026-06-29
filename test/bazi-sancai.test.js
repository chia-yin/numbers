import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDayMaster } from '../src/engine/bazi.js';
import { computeSancai, computeEnergyBalance, computeSeason } from '../src/engine/wuxingJudge.js';

test('日主:錨點 2000-01-07 為甲木,前一日 2000-01-01 為戊土', () => {
  assert.equal(computeDayMaster('2000-01-07').label, '甲木');
  assert.equal(computeDayMaster('2000-01-01').label, '戊土');
});

test('日主:晚子時(23時)歸隔日', () => {
  assert.equal(computeDayMaster('2000-01-06', '23:30').label, '甲木');
  assert.equal(computeDayMaster('2000-01-06', '22:00').label, '癸水');
});

test('日主:格式異常回 null', () => {
  assert.equal(computeDayMaster(''), null);
  assert.equal(computeDayMaster('abc'), null);
});

test('四季旺弱:木春夏旺、秋冬弱(老師特例)', () => {
  assert.equal(computeSeason(11, '木').label, '旺'); // 春
  assert.equal(computeSeason(31, '木').label, '旺'); // 夏
  assert.equal(computeSeason(51, '木').label, '弱'); // 秋
  assert.equal(computeSeason(61, '木').label, '弱'); // 冬
});

test('三才:金剋木視為友情之剋(剋中帶吉)', () => {
  const grid = { 天格: { wuxing: '金' }, 人格: { wuxing: '木' }, 地格: { wuxing: '火' } };
  const sc = computeSancai(grid);
  assert.equal(sc.天人關係, '剋');
  assert.match(sc.desc, /友情之剋/);
});

test('能量分布:同一五行≥3 判偏弱', () => {
  const grid = {
    總格: { wuxing: '木' }, 天格: { wuxing: '木' }, 人格: { wuxing: '木' },
    地格: { wuxing: '火' }, 外格: { wuxing: '水' },
  };
  const eb = computeEnergyBalance(grid);
  assert.equal(eb.dominant, '木');
  assert.equal(eb.dominantCount, 3);
  assert.equal(eb.luck, '偏弱');
});
