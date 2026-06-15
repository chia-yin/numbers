import { DEFAULT_GROUP_CONFIG } from './groupConfig.js';

export function splitGroups(phoneNumber, groupConfig) {
  const expectedLength = groupConfig.reduce((a, b) => a + b, 0);
  if (phoneNumber.length !== expectedLength) {
    throw new Error('號碼長度與分組設定不符');
  }

  const groups = [];
  let offset = 0;
  for (const len of groupConfig) {
    groups.push(phoneNumber.slice(offset, offset + len));
    offset += len;
  }
  return groups;
}

export function sumGroup(group) {
  return [...group].reduce((sum, char) => sum + Number(char), 0);
}

export function calcFiveGrid(n1, n2, n3) {
  return {
    總格: n1 + n2 + n3,
    天格: n1 + 1,
    人格: n1 + n2,
    地格: n2 + n3,
    外格: n3 + 1,
  };
}

export function toLastDigit(n) {
  return n % 10;
}

export function toWuxing(digit) {
  if (digit < 0 || digit > 9) {
    throw new Error('digit 必須在 0–9');
  }
  if (digit === 1 || digit === 2) return '木';
  if (digit === 3 || digit === 4) return '火';
  if (digit === 5 || digit === 6) return '土';
  if (digit === 7 || digit === 8) return '金';
  return '水';
}

export function calcExtended(fiveGrid) {
  return {
    子息: fiveGrid.天格 + fiveGrid.外格,
    健康: fiveGrid.外格 + fiveGrid.地格,
    配偶: fiveGrid.天格 + fiveGrid.人格,
    朋友: fiveGrid.人格 + fiveGrid.地格,
  };
}

function enrichGrid(value) {
  const digit = toLastDigit(value);
  return { value, digit, wuxing: toWuxing(digit) };
}

export function analyze(phoneNumber, groupConfig = DEFAULT_GROUP_CONFIG) {
  const groups = splitGroups(phoneNumber, groupConfig);
  const n1 = sumGroup(groups[0]);
  const n2 = sumGroup(groups[1]);
  const n3 = sumGroup(groups[2]);

  const fiveGridRaw = calcFiveGrid(n1, n2, n3);
  const extendedRaw = calcExtended(fiveGridRaw);

  const fiveGrid = {};
  for (const [key, value] of Object.entries(fiveGridRaw)) {
    fiveGrid[key] = enrichGrid(value);
  }

  const extended = {};
  for (const [key, value] of Object.entries(extendedRaw)) {
    extended[key] = enrichGrid(value);
  }

  return {
    input: phoneNumber,
    groups,
    groupSums: { n1, n2, n3 },
    fiveGrid,
    extended,
  };
}
