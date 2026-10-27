// Counts my commits across my own (non-fork) repos, split into human / AI-assisted / AI-agent,
// and draws assets/ai-commits.svg. Runs daily from .github/workflows/ai-commits.yml.
// Local run: GH_TOKEN=$(gh auth token) node scripts/ai-commits.mjs
import { mkdirSync, writeFileSync } from "node:fs";

const USER = "thaildhe172591";
const HEADERS = { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: "application/vnd.github+json" };

async function get(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers: HEADERS });
  if (res.status === 409) return []; // empty repository
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

async function all(path) {
  const out = [];
  for (let page = 1; ; page++) {
    const batch = await get(`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    out.push(...batch);
    if (batch.length < 100) return out;
  }
}

/**
 * Decide who wrote a commit.
 * @param c  an item from GET /repos/{owner}/{repo}/commits:
 *           c.author?.login      GitHub account, null when the email isn't linked to any account
 *           c.commit.author.name / c.commit.author.email
 *           c.commit.message     includes trailers such as "Co-authored-by: Claude Opus 5 <noreply@anthropic.com>"
 * @returns "human" | "assisted" | "agent", or null when it isn't mine (teammates, CI bots) so it's left out
 */
function classify(c) {
  const { name, email } = c.commit.author;
  // Agents commit under their own identity; only my repos are scanned, so I launched them.
  if (/@example\.com$|^noreply@anthropic\.com$/i.test(email) || name === "Stellar Dev") return "agent";
  if (c.author?.login !== USER) return null; // teammates, [bot] accounts
  return /^co-authored-by:.*noreply@anthropic\.com/im.test(c.commit.message) ? "assisted" : "human";
}

const repos = (await all(`/users/${USER}/repos?type=owner`)).filter((r) => !r.fork && r.name !== USER);
const counts = { human: 0, assisted: 0, agent: 0 };
for (const repo of repos) {
  for (const c of await all(`/repos/${USER}/${repo.name}/commits`)) {
    const kind = classify(c);
    if (kind === undefined) throw new Error("classify() must return human | assisted | agent | null");
    if (kind) counts[kind]++;
  }
}

// --- card (same look as assets/tech-stack.svg) ---
const W = 556, PAD = 28, BAR_Y = 70, BAR_H = 10;
const total = counts.human + counts.assisted + counts.agent;
const SEGMENTS = [
  ["Human", counts.human, "#3fb950"],
  ["AI-assisted", counts.assisted, "#388bfd"],
  ["AI agent", counts.agent, "#a371f7"],
];
const pct = (n) => (total ? Math.round((n / total) * 100) : 0);

let x = PAD;
const bar = SEGMENTS.map(([, n, color]) => {
  const w = total ? ((W - PAD * 2) * n) / total : 0;
  const rect = `<rect x="${x.toFixed(1)}" y="${BAR_Y}" width="${w.toFixed(1)}" height="${BAR_H}" fill="${color}"/>`;
  x += w;
  return rect;
}).join("");

const colW = (W - PAD * 2) / SEGMENTS.length;
const legend = SEGMENTS.map(([label, n, color], i) => {
  const lx = PAD + i * colW;
  return `<circle cx="${lx + 4}" cy="${BAR_Y + 39}" r="4" fill="${color}"/>
<text x="${lx + 14}" y="${BAR_Y + 43}" fill="#8b949e" font-size="12">${label}</text>
<text x="${lx}" y="${BAR_Y + 68}" fill="#e6edf3" font-size="18" font-weight="600">${n}<tspan fill="#8b949e" font-size="12" font-weight="400"> · ${pct(n)}%</tspan></text>`;
}).join("\n");

const H = BAR_Y + 92;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Ubuntu, -apple-system, Helvetica, Arial, sans-serif">
<title>Human and AI commits</title>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="16" fill="#0d1117" stroke="#30363d"/>
<text x="${PAD}" y="38" fill="#e6edf3" font-size="15" font-weight="600">Human × AI commits</text>
<text x="${W - PAD}" y="38" fill="#8b949e" font-size="12" text-anchor="end">${total} commits · ${repos.length} repos</text>
<clipPath id="bar"><rect x="${PAD}" y="${BAR_Y}" width="${W - PAD * 2}" height="${BAR_H}" rx="5"/></clipPath>
<g clip-path="url(#bar)"><rect x="${PAD}" y="${BAR_Y}" width="${W - PAD * 2}" height="${BAR_H}" fill="#21262d"/>${bar}</g>
${legend}
</svg>
`;
mkdirSync("assets", { recursive: true });
writeFileSync("assets/ai-commits.svg", svg);
console.log(counts, `total=${total}`);
