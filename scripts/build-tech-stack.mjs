// Builds assets/tech-stack.svg: one row per layer, a dot under each daily driver.
// Run from the repo root: node scripts/build-tech-stack.mjs
import { mkdirSync, writeFileSync } from "node:fs";

// "*" = daily driver. Names are skillicons.dev ids, except the custom tiles below.
const ROWS = [
  ["Backend", "APIs · business logic", ["cs*", "dotnet*", "java", "go"]],
  ["Frontend", "web · SSR · desktop", ["react*", "nextjs*", "tauri", "ts*", "js", "html", "css"]],
  ["Data", "schemas · PL/SQL · reports", ["oracle*", "postgres", "mysql", "mongodb"]],
  ["AI & automation", "OCR · LLM agents · MCP", ["claude*", "codex", "gemini", "grok", "copilot", "mcp", "python"]],
  ["Tools & cloud", "build · ship · host", ["git*", "visualstudio*", "vscode", "docker", "githubactions", "aws", "cloudflare"]],
];

const PAD = 28, LABEL_W = 176, ICON = 44, GAP = 12, ROW_H = 76, TOP = 18;
const W = PAD * 2 + LABEL_W + Math.max(...ROWS.map(([, , icons]) => icons.length)) * (ICON + GAP) - GAP;
const H = TOP + ROWS.length * ROW_H + 44;
const FONT = "Segoe UI, Ubuntu, -apple-system, Helvetica, Arial, sans-serif";
const SIMPLE_ICONS = "https://cdn.jsdelivr.net/npm/simple-icons@16.36.0/icons";
const LOBE_ICONS = "https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.95.1/icons";

// Same dark rounded tile skillicons uses, so custom icons blend in.
const tile = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" fill="none" viewBox="0 0 256 256"><rect width="256" height="256" rx="60" fill="#242938"/>${inner}</svg>`;

// simple-icons and lobe-icons are both 24×24: nest one on the tile, recoloured unless it ships its own colours.
async function iconOnTile(url, color) {
  const svg = (await (await fetch(url)).text()).trim();
  return tile(svg.replace(/^<svg([^>]*)>/, (_, attrs) =>
    `<svg${attrs.replace(/\s(width|height|style|role|fill)="[^"]*"/g, "")} x="52" y="52" width="152" height="152"${color ? ` fill="${color}"` : ""}>`));
}

// skillicons has none of these; simple-icons dropped Oracle (drawn here) and OpenAI/Grok (lobe-icons has them).
const CUSTOM = {
  oracle: async () => tile(`<rect x="44" y="84" width="168" height="88" rx="44" stroke="#F80000" stroke-width="24"/>`),
  claude: () => iconOnTile(`${SIMPLE_ICONS}/claude.svg`, "#D97757"),
  codex: () => iconOnTile(`${LOBE_ICONS}/codex.svg`, "#FFFFFF"),
  gemini: () => iconOnTile(`${LOBE_ICONS}/gemini-color.svg`),
  grok: () => iconOnTile(`${LOBE_ICONS}/grok.svg`, "#FFFFFF"),
  copilot: () => iconOnTile(`${SIMPLE_ICONS}/githubcopilot.svg`, "#FFFFFF"),
  mcp: () => iconOnTile(`${SIMPLE_ICONS}/modelcontextprotocol.svg`, "#FFFFFF"),
};

async function skillIcon(id) {
  const svg = await (await fetch(`https://skillicons.dev/icons?i=${id}`)).text();
  const outer = svg.indexOf("<svg");
  return svg.slice(svg.indexOf("<svg", outer + 1), svg.lastIndexOf("</g>")).trim();
}

// Nest an icon at (x, y); prefix ids so gradients from different icons don't collide.
function place(svg, id, x, y) {
  return svg
    .replace(/id="([^"]+)"/g, `id="${id}-$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${id}-$1)`)
    .replace(/href="#([^"]+)"/g, `href="#${id}-$1"`)
    .replace(/^<svg([^>]*)>/, (_, attrs) =>
      `<svg${attrs.replace(/\s(width|height)="[^"]*"/g, "")} x="${x}" y="${y}" width="${ICON}" height="${ICON}">`);
}

const parts = [];
for (const [i, [name, desc, icons]] of ROWS.entries()) {
  const y0 = TOP + i * ROW_H;
  const iy = y0 + 12;
  parts.push(
    `<text x="${PAD}" y="${y0 + 33}" fill="#e6edf3" font-size="15" font-weight="600">${name.replace("&", "&amp;")}</text>`,
    `<text x="${PAD}" y="${y0 + 53}" fill="#8b949e" font-size="12">${desc}</text>`,
  );
  for (const [j, raw] of icons.entries()) {
    const id = raw.replace("*", "");
    const x = PAD + LABEL_W + j * (ICON + GAP);
    parts.push(place(await (CUSTOM[id]?.() ?? skillIcon(id)), id, x, iy));
    if (raw.endsWith("*")) parts.push(`<circle cx="${x + ICON / 2}" cy="${iy + ICON + 8}" r="3" fill="#58a6ff"/>`);
  }
  if (i < ROWS.length - 1) parts.push(`<line x1="${PAD}" y1="${y0 + ROW_H}" x2="${W - PAD}" y2="${y0 + ROW_H}" stroke="#21262d"/>`);
}
const ly = TOP + ROWS.length * ROW_H + 24;
parts.push(
  `<circle cx="${W - PAD - 74}" cy="${ly - 4}" r="3" fill="#58a6ff"/>`,
  `<text x="${W - PAD}" y="${ly}" fill="#8b949e" font-size="12" text-anchor="end">daily driver</text>`,
);

const out = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">
<title>Tech stack</title>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="16" fill="#0d1117" stroke="#30363d"/>
${parts.join("\n")}
</svg>
`;
mkdirSync("assets", { recursive: true });
writeFileSync("assets/tech-stack.svg", out);
console.log(`assets/tech-stack.svg  ${W}x${H}  ${(out.length / 1024).toFixed(1)} KB`);
