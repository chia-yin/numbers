export function sleep(ms = 2000) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getStarDisallowRules(robotsText) {
  const rules = [];
  const lines = robotsText.split(/\r?\n/);
  let inStarSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) {
      continue;
    }

    const agentMatch = line.match(/^User-agent:\s*(.+)$/i);
    if (agentMatch) {
      inStarSection = agentMatch[1].trim() === '*';
      continue;
    }

    if (!inStarSection) {
      continue;
    }

    const disallowMatch = line.match(/^Disallow:\s*(.*)$/i);
    if (disallowMatch) {
      rules.push(disallowMatch[1].trim());
    }
  }

  return rules;
}

function isPathDisallowed(pathname, rules) {
  for (const rule of rules) {
    if (rule.length === 0) {
      continue;
    }
    if (rule === '/') {
      return true;
    }
    if (pathname.startsWith(rule)) {
      return true;
    }
  }
  return false;
}

export async function checkRobots(url) {
  const target = new URL(url);
  const robotsUrl = `${target.origin}/robots.txt`;

  let response;
  try {
    response = await fetch(robotsUrl, { signal: AbortSignal.timeout(5000) });
  } catch {
    return;
  }

  if (!response.ok) {
    return;
  }

  const robotsText = await response.text();
  const rules = getStarDisallowRules(robotsText);
  if (isPathDisallowed(target.pathname, rules)) {
    throw new Error('robots.txt disallows crawling this URL');
  }
}
