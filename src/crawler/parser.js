import { parse } from 'node-html-parser';

function firstPhoneOnLine(line) {
  // 移除「數字之間」的分隔符(空白、連字號、點),保留其他文字邊界,
  // 例如 "0936 102 682"、"0936-102 682" 都正規化成 "0936102682"
  const normalized = line.replace(/(\d)[\s.\-]+(?=\d)/g, '$1');
  const match = normalized.match(/(?<!\d)(\d{10})(?!\d)/);
  return match ? match[1] : null;
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
