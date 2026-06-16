import { parse } from 'node-html-parser';

function firstPhoneOnLine(line) {
  const noHyphen = line.replace(/-/g, '');
  const simple = noHyphen.match(/\b(\d{10})\b/);
  if (simple) {
    return simple[1];
  }

  const spacedPattern = /(?:\d[\s.\-]*){10,}/g;
  let match;
  while ((match = spacedPattern.exec(line)) !== null) {
    const digits = match[0].replace(/[\s.\-]/g, '');
    if (digits.length === 10) {
      return digits;
    }
  }

  return null;
}

export function extractFromText(content) {
  const results = [];
  for (const line of content.split(/\r?\n/)) {
    const phone = firstPhoneOnLine(line);
    if (phone) {
      results.push(phone);
    }
  }
  return results;
}

// 從整段文字抓出「所有」台灣手機號碼(09 + 8 碼,容許分隔符),去重。
// 適合從渲染後的網頁全文撈號碼(爬蟲用)。
export function extractAllPhones(text) {
  const results = new Set();
  const re = /09(?:[\s.\-]?\d){8}/g;
  let m;
  while ((m = re.exec(String(text))) !== null) {
    const digits = m[0].replace(/[\s.\-]/g, '');
    if (digits.length === 10) results.add(digits);
  }
  return [...results];
}

export function extractFromHtml(html, selector) {
  const root = parse(html);
  const results = [];

  if (selector) {
    for (const element of root.querySelectorAll(selector)) {
      results.push(...extractFromText(element.textContent));
    }
  } else {
    results.push(...extractFromText(root.textContent));
  }

  return [...new Set(results)];
}
