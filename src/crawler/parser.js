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
