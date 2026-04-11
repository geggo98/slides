// ── Harness data (Radar + Bar) ──────────────────────────────────────────────
export interface Harness {
  name: string;
  color: string;
  oss: boolean;
  lang: string;
  tools: number;
  values: number[]; // [Tools, Sandbox, MCP, SubAgents, MultiProvider, OSS, ExclusiveModels]
  desc: string;
}

export const HARNESSES: Harness[] = [
  {
    name: "Claude Code",
    color: "#fb923c",
    oss: false,
    lang: "TypeScript",
    tools: 19,
    values: [9, 9, 10, 9, 1, 0, 0],
    desc: "Feature-reichstes proprietäres Harness, Anthropic-only.",
  },
  {
    name: "Codex CLI",
    color: "#10b981",
    oss: true,
    lang: "Rust",
    tools: 6,
    values: [4, 8, 8, 7, 5, 10, 0],
    desc: "Solides OSS, OS-native Sandboxing (Seatbelt/bwrap), OpenAI-fokussiert.",
  },
  {
    name: "Gemini CLI",
    color: "#60a5fa",
    oss: true,
    lang: "TypeScript",
    tools: 12,
    values: [7, 10, 8, 4, 1, 10, 0],
    desc: "Breitestes Sandboxing (Docker/gVisor/Podman), 1M Context-Window.",
  },
  {
    name: "Pi",
    color: "#a78bfa",
    oss: true,
    lang: "TypeScript",
    tools: 4,
    values: [3, 1, 0, 0, 10, 10, 0],
    desc: "Radikaler Minimalismus: 4 Tools, kein MCP, kein Sandbox, 15+ Provider.",
  },
  {
    name: "OpenCode",
    color: "#facc15",
    oss: true,
    lang: "Go",
    tools: 9,
    values: [6, 6, 8, 6, 9, 10, 0],
    desc: "Multi-Provider Open-Source-Klon, ähnlich Claude Code in Features.",
  },
  {
    name: "Cursor",
    color: "#f472b6",
    oss: false,
    lang: "(IDE)",
    tools: 8,
    values: [6, 5, 7, 10, 7, 0, 10],
    desc: "Einzige IDE mit Cursor-exklusiven Modellen (Composer, Tab).",
  },
];

export const RADAR_INDICATORS = [
  { name: "Tool-Anzahl", max: 10 },
  { name: "Sandbox", max: 10 },
  { name: "MCP-Support", max: 10 },
  { name: "Sub-Agents", max: 10 },
  { name: "Multi-Provider", max: 10 },
  { name: "Open Source", max: 10 },
  { name: "Exklusive Modelle", max: 10 },
];

// ── MCP Token Bloat ─────────────────────────────────────────────────────────
export const MCP_DATA = [
  { name: "Jira", tokens: 17000 },
  { name: "Slack", tokens: 21000 },
  { name: "GitHub (35 Tools)", tokens: 26000 },
  { name: "MySQL (106 Tools)", tokens: 54600 },
  { name: "GitHub (93 Tools, alle)", tokens: 55000 },
  { name: "MCP Docker (135 Tools)", tokens: 126000 },
];

// ── MCP Optimization Strategies ────────────────────────────────────────────
export interface McpOptStrategy {
  agent: string;
  color: string;
  lazyLoading: "auto" | "file" | "none" | "n/a";
  allowDeny: boolean;
  hardLimit: string | null;
  measuredReduction: number | null;
  approach: string;
}

export const MCP_OPT_STRATEGIES: McpOptStrategy[] = [
  {
    agent: "Claude Code",
    color: "#fb923c",
    lazyLoading: "auto",
    allowDeny: false,
    hardLimit: null,
    measuredReduction: 90,
    approach: "Deferred Tools + BM25/Regex (ToolSearch)",
  },
  {
    agent: "Cursor",
    color: "#f472b6",
    lazyLoading: "file",
    allowDeny: true,
    hardLimit: "40/80",
    measuredReduction: 47,
    approach: "Schemas auf Disk, on-demand lesen",
  },
  {
    agent: "Codex CLI",
    color: "#10b981",
    lazyLoading: "none",
    allowDeny: true,
    hardLimit: null,
    measuredReduction: null,
    approach: "Manuelles Allow/Deny (TOML)",
  },
  {
    agent: "Gemini CLI",
    color: "#60a5fa",
    lazyLoading: "none",
    allowDeny: true,
    hardLimit: null,
    measuredReduction: null,
    approach: "includeTools / excludeTools",
  },
  {
    agent: "OpenCode",
    color: "#facc15",
    lazyLoading: "none",
    allowDeny: true,
    hardLimit: null,
    measuredReduction: null,
    approach: "Re-fetch bei jedem Call (kein Cache!)",
  },
  {
    agent: "Pi",
    color: "#a78bfa",
    lazyLoading: "n/a",
    allowDeny: false,
    hardLimit: null,
    measuredReduction: null,
    approach: "Kein MCP-Support",
  },
];

// ── ToolSearch Impact Stats ────────────────────────────────────────────────
export interface ToolSearchStat {
  value: string;
  label: string;
  desc: string;
  highlight?: boolean;
}

export const TOOLSEARCH_STATS: ToolSearchStat[] = [
  {
    value: "85–95%",
    label: "Token-Reduktion",
    desc: "Schema-Tokens pro Request. Nur ~968 Tokens für ToolSearch-Tool selbst.",
    highlight: true,
  },
  {
    value: "49% → 74%",
    label: "Opus 4 Accuracy",
    desc: "Tool-Selection bei 50+ Tools — weniger im Kontext = bessere Auswahl.",
  },
  {
    value: "v2.1.69+",
    label: "System-Tool-Deferral",
    desc: "Auch Built-in-Tools (Bash, Read, Edit, ...) hinter ToolSearch deferred. ~14K Tokens gespart.",
  },
  {
    value: "79,5% → 88,1%",
    label: "Opus 4.5 Accuracy",
    desc: "Weniger Tools im Kontext verbessert auch stärkere Modelle.",
  },
];

// ── Skills vs MCP ───────────────────────────────────────────────────────────
export const SKILLS_VS_MCP = {
  categories: ["1", "5", "10", "20", "50"],
  skills: [50, 250, 500, 1000, 2500],
  mcp: [30000, 150000, 300000, 600000, 1500000],
};

// ── Cache Pricing ───────────────────────────────────────────────────────────
export const CACHE_PRICING = {
  providers: ["Anthropic", "OpenAI", "Google"],
  cacheWrite: [1.25, 1.0, 1.0],
  cacheRead: [0.1, 0.1, 0.1],
};

// ── Tool Selection Accuracy ─────────────────────────────────────────────────
export const TOOL_ACCURACY = {
  standard: [
    [5, 92],
    [10, 85],
    [25, 70],
    [50, 49],
    [100, 30],
    [200, 14],
  ] as [number, number][],
  withToolSearch: [
    [5, 95],
    [10, 90],
    [25, 82],
    [50, 78],
    [100, 76],
    [200, 74],
  ] as [number, number][],
};

// ── Memory Approaches ───────────────────────────────────────────────────────
export interface MemoryApproach {
  name: string;
  x: number; // complexity
  y: number; // effectiveness
  size: number; // token cost
  color: string;
}

export const MEMORY_APPROACHES: MemoryApproach[] = [
  { name: "CLAUDE.md / AGENTS.md", x: 1, y: 8, size: 5, color: "#facc15" },
  { name: "MEMORY.md (Auto)", x: 2, y: 7, size: 4, color: "#fb923c" },
  { name: "Skills (Progressive)", x: 3, y: 9, size: 1, color: "#4ade80" },
  { name: "Aider Repo Map", x: 4, y: 8, size: 3, color: "#a78bfa" },
  { name: "Session Persistence", x: 2, y: 6, size: 5, color: "#5eead4" },
  { name: "Cursor RAG (Embeddings)", x: 7, y: 7, size: 4, color: "#60a5fa" },
  { name: "Mem0 (Vector+Graph)", x: 7, y: 5, size: 6, color: "#f472b6" },
  { name: "MemGPT / Letta", x: 9, y: 4, size: 8, color: "#ec4899" },
];

// ── Taxonomy Treemap ────────────────────────────────────────────────────────
export const TREEMAP_DATA = [
  {
    name: "Gemini",
    itemStyle: { color: "#60a5fa" },
    children: [
      { name: "Modell-Familie\n(1.0→3.1)", value: 8 },
      { name: "Chatbot\n(gemini.google.com)", value: 5 },
      { name: "Gemini Advanced\n(Subscription)", value: 4 },
      { name: "Gemini CLI\n(Coding-Harness)", value: 9 },
      { name: "Code Assist\n(IDE-Plugin)", value: 6 },
      { name: "Gemini API\n(AI Studio/Vertex)", value: 7 },
    ],
  },
  {
    name: "Codex",
    itemStyle: { color: "#10b981" },
    children: [
      { name: "code-davinci-002\n(2021, deprecated!)", value: 3 },
      { name: "codex-1\n(Modell)", value: 5 },
      { name: "codex-mini\n(Modell)", value: 4 },
      { name: "GPT-5.3-Codex\n(Modell)", value: 6 },
      { name: "Codex CLI\n(Open-Source)", value: 9 },
      { name: "Codex Web\n(chatgpt.com/codex)", value: 6 },
      { name: "Codex App\n(Desktop)", value: 5 },
    ],
  },
  {
    name: "Claude",
    itemStyle: { color: "#fb923c" },
    children: [
      { name: "Modelle\n(Opus/Sonnet/Haiku)", value: 9 },
      { name: "claude.ai\n(Chat-UI)", value: 7 },
      { name: "Claude Code\n(CLI-Harness)", value: 9 },
      { name: "Claude API\n(platform.claude.com)", value: 8 },
      { name: "Subscriptions\n(Pro/Max/Team)", value: 6 },
      { name: "Claude Cowork\n(GUI Preview)", value: 4 },
    ],
  },
  {
    name: "Cursor",
    itemStyle: { color: "#f472b6" },
    children: [
      { name: "Cursor IDE\n(VS Code Fork)", value: 9 },
      { name: "Cursor Agent\n(Mode)", value: 8 },
      { name: "Cursor CLI\n(Headless)", value: 5 },
      { name: "Background Agents\n(Cloud)", value: 7 },
      { name: "Composer\n(Cursor-exklusiv)", value: 8 },
      { name: "Cursor Tab\n(Cursor-exklusiv)", value: 6 },
    ],
  },
  {
    name: "Pi",
    itemStyle: { color: "#a78bfa" },
    children: [
      { name: "Inflection Pi\n(Chatbot — ANDERES Produkt!)", value: 4 },
      { name: "Pi Framework\n(pi-mono SDK)", value: 7 },
      { name: "Pi Coding Agent\n(Harness)", value: 8 },
      { name: "shittycodingagent.ai\n(Landing-Page)", value: 3 },
    ],
  },
];

// ── Source Leak Stats ───────────────────────────────────────────────────────
export interface LeakStat {
  value: string;
  label: string;
  desc: string;
  pi: string | null;
}

export const LEAK_STATS: LeakStat[] = [
  {
    value: "512K",
    label: "Zeilen TypeScript",
    desc: "Im Source-Map vom 31. März 2026",
    pi: "~3.000 Zeilen",
  },
  {
    value: "59.8 MB",
    label: "cli.js.map",
    desc: "Source-Map die nie hätte shippen sollen",
    pi: null,
  },
  {
    value: "~1.900",
    label: "Dateien",
    desc: "Im deobfuskierten Repository",
    pi: "~30 Dateien",
  },
  {
    value: "19+",
    label: "Tools registriert",
    desc: "Read, Write, Edit, Bash, Glob, Grep, Task, …",
    pi: "4 (Read/Write/Edit/Bash)",
  },
  {
    value: "9.707",
    label: "Zeilen Bash-Security",
    desc: "Über 3 Dateien, Tree-sitter AST-Parser",
    pi: "0 — kein Sandbox",
  },
  {
    value: "22",
    label: "Security Validators",
    desc: "Für Bash-Command-Validierung",
    pi: "0",
  },
  {
    value: "150+",
    label: "KAIROS-Referenzen",
    desc: "In 61 Dateien — autonomer Daemon-Modus",
    pi: "kein Daemon-Modus",
  },
  {
    value: "multi-K",
    label: "System-Prompt-Tokens",
    desc: "Plus dynamische Anteile",
    pi: "<1.000 Tokens",
  },
  {
    value: "89",
    label: "Zeilen Undercover-Mode",
    desc: "Strippt Anthropic-Attribution",
    pi: "0",
  },
];

export interface ModuleSize {
  name: string;
  lines: number;
}

export const MODULE_SIZES: ModuleSize[] = [
  { name: "Bash Security", lines: 9707 },
  { name: "Tool Definitions", lines: 4500 },
  { name: "Permission System", lines: 3200 },
  { name: "Streaming Parser", lines: 2800 },
  { name: "KAIROS Daemon", lines: 2400 },
  { name: "AutoCompact Logic", lines: 1800 },
  { name: "MCP Client", lines: 1500 },
  { name: "Sub-Agent (Task)", lines: 1200 },
];
