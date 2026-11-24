// ── Themed colors ───────────────────────────────────────────────────────────
// Serien-/Akzentfarben als Light/Dark-Paar: die hellen Tailwind-400er-Töne
// der Dark-Palette erreichen auf weißem Grund nur ~1.6–2.1:1 Kontrast.
// Light-Mode nutzt deshalb die 600er/700er-Stufe derselben Skala — gleiche
// Farbsemantik, ausreichender Kontrast. Auflösung via resolveColor()
// (chartConfig.ts) nach dem Muster `d ? dark : light`.
export interface ThemedColor {
  light: string;
  dark: string;
}

export const AGENT_COLORS = {
  claudeCode: { light: "#c2410c", dark: "#fb923c" }, // Orange
  codex: { light: "#047857", dark: "#10b981" }, // Smaragd
  gemini: { light: "#2563eb", dark: "#60a5fa" }, // Blau
  pi: { light: "#7c3aed", dark: "#a78bfa" }, // Violett
  opencode: { light: "#ca8a04", dark: "#facc15" }, // Gelb/Amber
  cursor: { light: "#db2777", dark: "#f472b6" }, // Pink
} as const satisfies Record<string, ThemedColor>;

// ── Harness data (Radar + Bar) ──────────────────────────────────────────────
export interface Harness {
  name: string;
  color: ThemedColor;
  oss: boolean;
  lang: string;
  tools: number;
  values: number[]; // [Tools, Sandbox, MCP, SubAgents, MultiProvider, OSS, ExclusiveModels]
  desc: string;
}

export const HARNESSES: Harness[] = [
  {
    name: "Claude Code",
    color: AGENT_COLORS.claudeCode,
    oss: false,
    lang: "TypeScript",
    // Stand 24.11.2026: code.claude.com/docs/en/tools-reference.md listet
    // 53 Tools, TaskOutput seit v2.1.277 entfernt → 52; viele nur unter
    // Bedingungen (Glob/Grep z. B. auf macOS/Linux standardmäßig nicht da).
    tools: 52,
    values: [9, 9, 10, 9, 1, 0, 0],
    desc: "Feature-reichster proprietärer Harness, Anthropic-only.",
  },
  {
    name: "Codex CLI",
    color: AGENT_COLORS.codex,
    oss: true,
    lang: "Rust",
    // Stand 24.11.2026, Quellcode rust-v0.172.0 (codex-rs/core/src/tools/
    // handlers): 11 Kern-Tools + 5 standardmäßig aktive Multi-Agent-Tools;
    // mit 3 MCP-Ressourcen-Tools 19. Konfigurationsabhängig.
    tools: 16,
    // MCP 8 → 7 (Stand 24.11.2026): `codex mcp-server` entfernt, Codex ist
    // nur noch MCP-Client (learn.chatgpt.com/docs/mcp-server.md).
    values: [4, 8, 7, 7, 5, 10, 0],
    desc: "Solides OSS, OS-native Sandboxing (Seatbelt/bwrap), OpenAI-fokussiert.",
  },
  {
    name: "Gemini CLI",
    color: AGENT_COLORS.gemini,
    oss: true,
    lang: "TypeScript",
    // Stand 24.11.2026, packages/core (tool-names.ts, config.ts): ca. 20 in
    // der Standardkonfiguration, 17 immer registriert, bis 27 mit
    // Plan-Modus, Todos und Tracker.
    tools: 20,
    // Subagents 4 → 7 (Stand 24.11.2026): lokale Subagents standardmäßig an
    // (abschaltbar per experimental.enableAgents=false), Remote per A2A.
    values: [7, 10, 8, 7, 1, 10, 0],
    desc: "Breitestes Sandboxing (Docker/gVisor/Podman), 1M Context-Window.",
  },
  {
    name: "Pi",
    color: AGENT_COLORS.pi,
    oss: true,
    lang: "TypeScript",
    tools: 4,
    // MCP 0 → 8 (Stand 24.11.2026): Pi bindet MCP-Server seit 09/2026 ein
    // (stdio, Streamable HTTP; packages/coding-agent/docs/mcp.md).
    values: [3, 1, 8, 0, 10, 10, 0],
    desc: "Radikaler Minimalismus: 4 Tools, MCP seit 09/2026, kein Sandbox, 15+ Provider.",
  },
  {
    name: "OpenCode",
    color: AGENT_COLORS.opencode,
    oss: true,
    lang: "TypeScript",
    // Stand 24.11.2026: opencode.ai/docs/tools dokumentiert 16 eingebaute
    // Tools; der Quellcode enthält weitere.
    tools: 16,
    values: [6, 6, 8, 6, 9, 10, 0],
    desc: "Multi-Provider Open-Source-Klon, ähnlich Claude Code in Features.",
  },
  {
    name: "Cursor",
    color: AGENT_COLORS.cursor,
    oss: false,
    lang: "(IDE)",
    // Stand 24.11.2026: cursor.com/docs/agent/overview.md nennt unter
    // „Tools“ 9 Kategorien (Search, Web, Fetch Rules, Read, Edit, Shell,
    // Browser, Image generation, Ask questions); die Zahl einzelner Tools
    // veröffentlicht Cursor nicht.
    tools: 9,
    values: [6, 5, 7, 10, 7, 0, 10],
    desc: "Einzige IDE mit Cursor-exklusiven Modellen (Composer, Tab).",
  },
];

export const RADAR_INDICATORS = [
  { name: "Tool-Anzahl", max: 10 },
  { name: "Sandbox", max: 10 },
  { name: "MCP-Support", max: 10 },
  { name: "Subagents", max: 10 },
  { name: "Multi-Provider", max: 10 },
  { name: "Open Source", max: 10 },
  { name: "Exklusive Modelle", max: 10 },
];

// ── MCP Token Bloat ─────────────────────────────────────────────────────────
export const MCP_DATA = [
  { name: "Jira", tokens: 17000 },
  { name: "Slack", tokens: 21000 },
  { name: "GitHub (35 Tools)", tokens: 26000 },
  // neverinfamous/mysql-mcp, Stand 12/2025 (MCP-Issue #1978: „106 tools
  // sends ~207KB (~54,600 tokens)“). Neuere Versionen: v2.0.0 191 Tools,
  // v5.x ca. 242; dafür gibt es keine gemessene Tokenzahl. Geprüft 24.11.2026.
  { name: "MySQL (106 Tools, 12/2025)", tokens: 54600 },
  // Drittschätzung ohne offengelegte Methode (dev.to/kenimo49, 05/2026:
  // „GitHub (full) | 93 | ~55,000“). Eine tiktoken-Zählung (o200k_base,
  // policylayer.com/token-cost/github) ergibt für 86 Tools 14.406 Tokens.
  // Geprüft 24.11.2026.
  { name: "GitHub (93 Tools, Schätzung)", tokens: 55000 },
  // Docker MCP Gateway (Eintrag MCP_DOCKER, bündelt mehrere Server).
  // Einzelbericht, /doctor in Claude Code 2.0.50, 24.11.2025
  // (anthropics/claude-code#12241: „MCP_DOCKER: 135 tools (~125,964
  // tokens)“). Das Gateway bietet inzwischen Dynamic MCP (mcp-find/mcp-add).
  { name: "Docker-Gateway (135 Tools)", tokens: 126000 },
];

// ── MCP Optimization Strategies ────────────────────────────────────────────
export interface McpOptStrategy {
  agent: string;
  color: ThemedColor;
  lazyLoading: "auto" | "file" | "none" | "n/a";
  allowDeny: boolean;
  hardLimit: string | null;
  measuredReduction: number | null;
  approach: string;
}

export const MCP_OPT_STRATEGIES: McpOptStrategy[] = [
  {
    agent: "Claude Code",
    color: AGENT_COLORS.claudeCode,
    lazyLoading: "auto",
    allowDeny: true,
    hardLimit: null,
    // Stand 24.11.2026: Herstellerangabe „over 85 percent“,
    // platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool.md.
    // BM25/Regex sind nur die zwei Varianten des API-Tools.
    measuredReduction: 85,
    approach: "Deferred Tools + ToolSearch (on demand)",
  },
  {
    agent: "Cursor",
    color: AGENT_COLORS.cursor,
    lazyLoading: "file",
    allowDeny: true,
    hardLimit: "40/80",
    // Stand 24.11.2026: −46,9 % Gesamt-Tokens des Agents in Läufen mit
    // MCP-Aufruf (A/B-Test), keine Schema-Tokens;
    // cursor.com/blog/dynamic-context-discovery (06.01.2026).
    measuredReduction: 47,
    approach: "Schemas auf Disk, on-demand lesen",
  },
  {
    agent: "Codex CLI",
    color: AGENT_COLORS.codex,
    // Stand 24.11.2026: Tool Search Standard seit rust-v0.142.2 (25.06.2026).
    lazyLoading: "auto",
    allowDeny: true,
    hardLimit: null,
    measuredReduction: null,
    approach: "Tool Search (Standard seit v0.142.2), enabled/disabled_tools",
  },
  {
    agent: "Gemini CLI",
    color: AGENT_COLORS.gemini,
    lazyLoading: "none",
    allowDeny: true,
    hardLimit: null,
    measuredReduction: null,
    approach: "includeTools / excludeTools",
  },
  {
    agent: "OpenCode",
    color: AGENT_COLORS.opencode,
    // Stand 24.11.2026: Code Mode ist Standard (opencode.ai/docs/mcp-servers).
    lazyLoading: "auto",
    allowDeny: true,
    hardLimit: null,
    measuredReduction: null,
    approach: "Code Mode (Standard): Tool-Katalog, Aufruf über execute",
  },
  {
    agent: "Pi",
    color: AGENT_COLORS.pi,
    // Stand 24.11.2026: MCP im Kern seit Ende 09/2026; Codemode lädt
    // automatisch mit MCP (earendil.com/posts/you-said-no-mcp). allowDeny
    // ist unbelegt (Badge „Nein“ ungeprüft).
    lazyLoading: "auto",
    allowDeny: false,
    hardLimit: null,
    measuredReduction: null,
    approach:
      "MCP im Kern, Codemode (JS-Sandbox), Tools als deferred konfigurierbar",
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
    // Stand 24.11.2026: anthropic.com/engineering/advanced-tool-use
    value: "~85%",
    label: "Token-Reduktion",
    desc: "Schema-Tokens pro Request (Anthropic-Beispiel: ~77K → ~8,7K). Das Tool Search Tool selbst kostet ~500 Tokens (API).",
    highlight: true,
  },
  {
    value: "49% → 74%",
    label: "Opus 4 Accuracy",
    desc: "MCP-Evals mit großen Tool-Bibliotheken — weniger im Kontext = bessere Auswahl.",
  },
  {
    // Stand 24.11.2026: code.claude.com/docs/en/agent-sdk/tool-search.md
    value: "Built-ins",
    label: "Teilweise deferred",
    desc: "Selten genutzte Built-in-Tools (z. B. WebSearch, WebFetch) liegen hinter ToolSearch; Kern-Tools wie Bash, Read und Edit laden immer vorab.",
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
  // Stand 24.11.2026. Skill: ~100 Tokens Frontmatter (name + description),
  // platform.claude.com/docs/en/agents-and-tools/agent-skills/overview.
  // MCP-Server: ~11K Tokens Tool-Definitionen (Anthropic-Beispiel 5 Server
  // ≈ 55K; Spanne ~1K–26K), anthropic.com/engineering/advanced-tool-use.
  // Gilt nur ohne Tool Search.
  skills: [100, 500, 1000, 2000, 5000],
  mcp: [11000, 55000, 110000, 220000, 550000],
};

// ── Cache Pricing ───────────────────────────────────────────────────────────
// Vielfaches des Base-Input-Preises, alle drei am 01.09.2026 an der
// Preistabelle des jeweiligen Anbieters geprüft:
// - Anthropic: Write 1,25× (5-min-TTL) bzw. 2× (1 h), Read 0,1×
//   platform.claude.com/docs/en/about-claude/pricing
// - OpenAI: seit der GPT-5.6-Generation EBENFALLS 1,25× Write — sol $4 → $5,
//   terra $2 → $2,50, luna $0,20 → $0,25; Read 0,1×. Vorher stand hier 1,0×,
//   das galt für ältere Modelle.  developers.openai.com/api/docs/pricing
// - Google: rechnet das Anlegen zum Cache-Preis ab (0,1×) und verlangt dafür
//   Storage pro Stunde — $0,50/MTok/h bei 3.7 Flash bis $4,50 bei 3.1 Pro.
//   Die Miete lässt sich auf einer „×-Base-Preis"-Achse nicht abbilden und
//   steht deshalb in der Fußzeile.  ai.google.dev/gemini-api/docs/pricing
export const CACHE_PRICING = {
  providers: ["Anthropic", "OpenAI", "Google"],
  cacheWrite: [1.25, 1.25, 0.1],
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
  color: ThemedColor;
}

// Einschätzung auf Skalen von 1–10, keine Messung. Erste Fassung vom
// 08.04.2026 (Commit 1884bf8) ohne Quelle; am 24.11.2026 gegen die Literatur
// korrigiert, Belege und Grenzen in memoryScatterSources.ts (retrieved
// 2026-11-23). Geändert am 24.11.2026:
//   CLAUDE.md / AGENTS.md  y 8 → 6, Kosten 5 → 6 (ETH: kein allgemeiner Gewinn, über 20 % Mehrkosten)
//   Skills                 y 9 → 5 (Vercel: höchstens 79 %, AGENTS.md 100 %)
//   Aider Repo Map         Kosten 3 → 4 (Prism: 13 % über dem Lauf ohne Memory)
//   Mem0                   Kosten 6 → 4 (SWE-ContextBench: 0,62 $ gegen 0,79 $ je Aufgabe)
// Ohne jede Messung unverändert: MEMORY.md (Auto), Session Persistence,
// MemGPT / Letta (auf Code), Aider Repo Map (Effektivität).
export const MEMORY_APPROACHES: MemoryApproach[] = [
  {
    name: "CLAUDE.md / AGENTS.md",
    x: 1,
    y: 6,
    size: 6,
    color: { light: "#ca8a04", dark: "#facc15" },
  },
  {
    name: "MEMORY.md (Auto)",
    x: 2,
    y: 7,
    size: 4,
    color: { light: "#c2410c", dark: "#fb923c" },
  },
  {
    name: "Skills (Progressive)",
    x: 3,
    y: 5,
    size: 1,
    color: { light: "#16a34a", dark: "#4ade80" },
  },
  {
    name: "Aider Repo Map",
    x: 4,
    y: 8,
    size: 4,
    color: { light: "#7c3aed", dark: "#a78bfa" },
  },
  {
    name: "Session Persistence",
    x: 2,
    y: 6,
    size: 5,
    color: { light: "#0d9488", dark: "#5eead4" },
  },
  {
    name: "Cursor RAG (Embeddings)",
    x: 7,
    y: 7,
    size: 4,
    color: { light: "#2563eb", dark: "#60a5fa" },
  },
  {
    name: "Mem0 (Vector+Graph)",
    x: 7,
    y: 5,
    size: 4,
    color: { light: "#db2777", dark: "#f472b6" },
  },
  {
    name: "MemGPT / Letta",
    x: 9,
    y: 4,
    size: 8,
    color: { light: "#be185d", dark: "#ec4899" },
  },
];

// ── Taxonomy Treemap ────────────────────────────────────────────────────────
export const TREEMAP_DATA = [
  {
    name: "Gemini",
    itemStyle: { color: "#60a5fa" },
    children: [
      // Stand 24.11.2026: Gemini 4 laut ai.google.dev/gemini-api/docs/models;
      // Abo-Namen laut gemini.google/subscriptions; CLI und Code Assist für
      // Free/AI Pro/Ultra seit 18.06.2026 abgeschaltet (Nachfolger: Antigravity).
      { name: "Modell-Familie\n(1.0→4)", value: 8 },
      { name: "Chatbot\n(gemini.google.com)", value: 5 },
      { name: "Abo\n(Google AI Plus/Pro/Ultra)", value: 4 },
      { name: "Gemini CLI\n(nur noch Enterprise)", value: 9 },
      { name: "Code Assist\n(IDE, nur Enterprise)", value: 6 },
      { name: "Gemini API\n(AI Studio/Vertex)", value: 7 },
    ],
  },
  {
    name: "Codex",
    itemStyle: { color: "#10b981" },
    children: [
      { name: "code-davinci-002\n(2022, abgeschaltet 2023)", value: 3 },
      { name: "codex-1\n(Modell)", value: 5 },
      // Stand 24.11.2026 (developers.openai.com: deprecations, codex/models).
      { name: "codex-mini\n(abgeschaltet 02/2026)", value: 4 },
      { name: "GPT-5.3-Codex\n(Modell, deprecated)", value: 6 },
      { name: "Codex CLI\n(Open-Source)", value: 9 },
      { name: "Codex Cloud\n(früher Codex Web)", value: 6 },
      { name: "Codex in der\nChatGPT-Desktop-App", value: 5 },
    ],
  },
  {
    name: "Claude",
    itemStyle: { color: "#fb923c" },
    children: [
      // Stand 24.11.2026 (claude.com/pricing, claude.com/product/cowork).
      { name: "Modelle\n(Mythos/Fable/Opus/Sonnet/Haiku)", value: 9 },
      { name: "claude.ai\n(Chat-UI)", value: 7 },
      { name: "Claude Code\n(CLI-Harness)", value: 9 },
      { name: "Claude API\n(platform.claude.com)", value: 8 },
      { name: "Subscriptions\n(Pro/Max/Ultra/Team/Ent.)", value: 6 },
      { name: "Claude Cowork\n(jetzt Teil von Claude)", value: 4 },
    ],
  },
  {
    name: "Cursor",
    itemStyle: { color: "#f472b6" },
    children: [
      { name: "Cursor IDE\n(VS Code Fork)", value: 9 },
      { name: "Cursor Agent\n(Mode)", value: 8 },
      { name: "Cursor CLI\n(Headless)", value: 5 },
      { name: "Cloud Agents\n(früher Background Agents)", value: 7 },
      { name: "Composer\n(Cursor-exklusiv)", value: 8 },
      { name: "Cursor Tab\n(Cursor-exklusiv)", value: 6 },
    ],
  },
  {
    name: "Pi",
    itemStyle: { color: "#a78bfa" },
    children: [
      { name: "Inflection Pi\n(Chatbot — ANDERES Produkt!)", value: 4 },
      { name: "Pi SDK\n(earendil-works/pi)", value: 7 },
      { name: "Pi Coding Agent\n(Harness)", value: 8 },
      { name: "pi.dev\n(Landing-Page)", value: 3 },
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
    // Pi: packages/coding-agent/src ohne Tests, Commit 957f21c (01.04.2026):
    // 41.404 Zeilen in 124 Dateien. Stand Ende März 2026, geprüft 24.11.2026.
    pi: "~41.000 Zeilen",
  },
  {
    value: "59,8 MB",
    label: "cli.js.map",
    desc: "Source-Map die nie hätte shippen sollen",
    pi: null,
  },
  {
    value: "~1.900",
    label: "Dateien",
    desc: "Im deobfuskierten Repository",
    pi: "124 Dateien",
  },
  {
    // VentureBeat, 02.04.2026: „orchestrates 40-plus tools“; geprüft 24.11.2026.
    value: "40+",
    label: "Tools registriert",
    desc: "Read, Write, Edit, Bash, Glob, Grep, Task, …",
    pi: "4 (Read/Write/Edit/Bash)",
  },
  {
    value: "9.707",
    label: "Zeilen Bash-Parser + Validierung",
    desc: "3 Dateien; bashSecurity.ts allein 2.592",
    pi: "0 — kein Sandbox",
  },
  {
    value: "23",
    label: "Security Checks",
    desc: "Nacheinander auf jeden Bash-Befehl",
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
  // Eigene Zählung, Stand 24.11.2026: Mirror github.com/Tinkeringg-Lab/claude-code
  // (Leak 2.1.88, 31.03.2026), nur .ts/.tsx, wc -l. Bash = bashParser.ts +
  // ast.ts + bashSecurity.ts (Sabrina Ramonov, 02.04.2026). src/tools/ gesamt
  // (50.828) fehlt bewusst: es enthält AgentTool und bashSecurity.ts. KAIROS ist
  // ein Feature-Flag in 61 Dateien, kein Modul.
  { name: "MCP (services/mcp)", lines: 12310 },
  { name: "Bash Parser + Security", lines: 9707 },
  { name: "Permissions", lines: 9409 },
  { name: "Subagent (AgentTool)", lines: 6782 },
  { name: "Compaction", lines: 3960 },
];

// ── Systima-Messung an der API-Grenze (Claude Code vs. OpenCode) ────────────
// Logging-Proxy zwischen Harness und Endpoint, Juli 2026 (Claude Code 2.1.207
// vs. OpenCode 1.17.18, sonnet-4-5 gepinnt, Fable-5-Teilmatrix). Quelle:
// systima.ai/blog/claude-code-vs-opencode-token-overhead — Werte am
// Primärtext verifiziert 14.07.2026.
export interface SystimaStat {
  value: string;
  label: string;
  desc: string;
  /** OpenCode-Vergleichswert für die Footer-Zeile der Karte. */
  oc: string;
}

export const SYSTIMA_STATS: SystimaStat[] = [
  {
    value: "4,7×",
    label: "Baseline vor dem ersten Prompt",
    desc: "~33K Tokens Bootstrap: 27 Tool-Schemas (~24K), System-Prompt in 3 Blöcken, 3 Reminder-Blöcke",
    oc: "~7K Tokens — 10 Tools, 1 System-Block",
  },
  {
    value: "3 vs. 9",
    label: "Requests im Multi-Step-Task",
    desc: "Paralleles Tool-Batching zahlt die fette Baseline nur 3× — die Totals konvergieren bei ~121K",
    oc: "~132K total, trotz 7K-Baseline",
  },
  {
    value: "bis 54×",
    label: "Cache-Writes, identischer Task",
    desc: "Instabile Prefixes, 3 Request-Klassen pro Session: Mid-Session-Rewrites von 37K–86K Tokens zu Premium-Raten",
    oc: "1.003 Write-Tokens — Prefix byte-identisch",
  },
  {
    value: "3,7×",
    label: "Input-Tokens bei gleicher Qualität",
    desc: "10-Lane-Benchmark, beide 5/5 bestanden: ~268K Input-Tokens pro Run, 4–8 min Laufzeit",
    oc: "~72K pro Run, 1–2 min",
  },
];
