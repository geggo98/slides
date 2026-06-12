// ── Node definitions ────────────────────────────────────────────────────────
export interface SimNode {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sub: string;
  cat: string;
}

export const NODES: Record<string, SimNode> = {
  user: { x: 30, y: 240, w: 90, h: 50, label: "User", sub: "", cat: "person" },
  ide: {
    x: 145,
    y: 240,
    w: 130,
    h: 50,
    label: "IDE",
    sub: "z.B. Zed",
    cat: "client",
  },
  harness: {
    x: 305,
    y: 240,
    w: 140,
    h: 50,
    label: "Harness",
    sub: "Claude Code",
    cat: "harness",
  },
  claudemd: {
    x: 220,
    y: 60,
    w: 110,
    h: 50,
    label: "CLAUDE.md",
    sub: "AGENTS.md",
    cat: "memory",
  },
  skill: {
    x: 350,
    y: 60,
    w: 110,
    h: 50,
    label: "SKILL.md",
    sub: "Skills",
    cat: "memory",
  },
  memory: {
    x: 480,
    y: 60,
    w: 110,
    h: 50,
    label: "MEMORY.md",
    sub: "Auto Memory",
    cat: "memory",
  },
  tools: {
    x: 235,
    y: 410,
    w: 130,
    h: 50,
    label: "Local Tools",
    sub: "Bash / Read / …",
    cat: "tool",
  },
  mcp: {
    x: 385,
    y: 410,
    w: 130,
    h: 50,
    label: "MCP-Server",
    sub: "z.B. GitHub",
    cat: "tool",
  },
  auth: {
    x: 480,
    y: 240,
    w: 100,
    h: 50,
    label: "Auth",
    sub: "Key / OAuth",
    cat: "infra",
  },
  api: {
    x: 615,
    y: 240,
    w: 110,
    h: 50,
    label: "API",
    sub: "anthropic.com",
    cat: "infra",
  },
  cache: {
    x: 770,
    y: 150,
    w: 130,
    h: 50,
    label: "KV-Cache",
    sub: "Cache-Key",
    cat: "model",
  },
  model: {
    x: 770,
    y: 240,
    w: 130,
    h: 50,
    label: "Modell",
    sub: "Opus 4.6",
    cat: "model",
  },
  thinking: {
    x: 770,
    y: 330,
    w: 130,
    h: 50,
    label: "Thinking Tokens",
    sub: "encrypted",
    cat: "model",
  },
};

// ── Edge definitions ────────────────────────────────────────────────────────
export interface SimEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export const EDGES: SimEdge[] = [
  { id: "u-ide", from: "user", to: "ide" },
  { id: "ide-h", from: "ide", to: "harness", label: "ACP / JSON-RPC" },
  { id: "h-cmd", from: "harness", to: "claudemd" },
  { id: "h-skill", from: "harness", to: "skill" },
  { id: "h-mem", from: "harness", to: "memory" },
  { id: "h-tools", from: "harness", to: "tools" },
  { id: "h-mcp", from: "harness", to: "mcp", label: "JSON-RPC" },
  { id: "h-auth", from: "harness", to: "auth" },
  { id: "auth-api", from: "auth", to: "api", label: "HTTPS" },
  { id: "api-cache", from: "api", to: "cache" },
  { id: "api-model", from: "api", to: "model" },
  { id: "model-think", from: "model", to: "thinking" },
];

// ── Step definitions ────────────────────────────────────────────────────────
export interface SimStep {
  title: string;
  desc: string;
  nodes: string[];
  edges: string[];
  reverse?: boolean;
}

export const STEPS: SimStep[] = [
  {
    title: "User stellt Frage in der IDE",
    desc: "Der Entwickler tippt eine Anfrage in seine IDE (z.B. Zed). Die IDE spricht ACP — das Agent Client Protocol — und kann damit beliebige Coding-Agenten als Backend verwenden.",
    nodes: ["user", "ide"],
    edges: ["u-ide"],
  },
  {
    title: "IDE startet Harness via ACP",
    desc: "Die IDE spawnt den Harness als Subprocess. Kommunikation: JSON-RPC 2.0 über stdio (Newline-Delimited JSON). Erste Message ist initialize — handelt Capabilities aus.",
    nodes: ["ide", "harness"],
    edges: ["ide-h"],
  },
  {
    title: "Harness liest CLAUDE.md / AGENTS.md",
    desc: "Hierarchischer Load: ~/.claude/CLAUDE.md (global) + ./CLAUDE.md (Projekt, in Git) + optional ./CLAUDE.local.md (gitignored). Der Inhalt wird in den System-Prompt injiziert.",
    nodes: ["harness", "claudemd"],
    edges: ["h-cmd"],
  },
  {
    title: "Harness scannt verfügbare Skills",
    desc: "Progressive Disclosure: Aus jeder SKILL.md wird NUR der YAML-Frontmatter geladen (~50 Tokens pro Skill). Die Skill-Inhalte bleiben auf der Disk — werden erst nachgeladen wenn das Modell den Skill aktiv nutzen will.",
    nodes: ["harness", "skill"],
    edges: ["h-skill"],
  },
  {
    title: "Harness lädt Auto-Memory",
    desc: "MEMORY.md (max. 200 Zeilen / 25 KB) wird in den Context geladen. Hier stehen automatisch konsolidierte Erkenntnisse aus früheren Sessions.",
    nodes: ["harness", "memory"],
    edges: ["h-mem"],
  },
  {
    title: "Harness verbindet sich mit MCP-Servern",
    desc: "Für jeden konfigurierten MCP-Server wird ein Subprocess gespawnt. Das initialize-Handshake liefert die kompletten Tool-Definitionen — bei GitHub-MCP allein 26K–55K Tokens. Diese landen ALLE im System-Prompt jedes Requests.",
    nodes: ["harness", "mcp"],
    edges: ["h-mcp"],
  },
  {
    title: "Harness baut den Request",
    desc: "Layered Prompt-Struktur (für maximalen Cache-Hit): tools-Array → System-Prompt (statisch) → Conversation-History → Cache-Control-Breakpoints → User-Message ganz am Ende. Reihenfolge ist KRITISCH — ein umsortiertes Tool bricht den Cache.",
    nodes: ["harness", "claudemd", "skill", "memory", "mcp", "tools"],
    edges: [],
  },
  {
    title: "Auth-Header wird gesetzt",
    desc: "Zwei Wege: (1) x-api-key: sk-ant-… → Pay-as-you-go pro Token. (2) Authorization: Bearer eyJ… → OAuth-Token aus Pro/Max-Subscription. Der Harness wählt automatisch.",
    nodes: ["harness", "auth"],
    edges: ["h-auth"],
  },
  {
    title: "HTTPS POST an api.anthropic.com",
    desc: "POST /v1/messages mit JSON-Body {model, system, tools, messages, stream:true}. Response als SSE. Native Client Attestation: Bun-Binary überschreibt einen Placeholder mit einem Hash — DRM für API-Calls.",
    nodes: ["auth", "api"],
    edges: ["auth-api"],
  },
  {
    title: "Cache-Key Lookup im KV-Cache",
    desc: "Der Server hasht das Prefix → Cache-Key. Cache-Hit: 90% Discount ($0.30 statt $3/MTok bei Sonnet). Cache-Miss: voller Write zu 1.25× Kosten. Default-TTL: 5 Minuten. Nur EXAKTER Prefix-Match.",
    nodes: ["api", "cache"],
    edges: ["api-cache"],
  },
  {
    title: "Modell dekodiert die Antwort",
    desc: "Claude Opus 4.6 generiert autoregressiv Tokens. Bei Tool-Use stoppt das Modell nach dem tool_use-Block. Special Tokens sind hinter der API versteckt — strukturell wie <tool_call> in Open-Source-Modellen.",
    nodes: ["api", "model"],
    edges: ["api-model"],
  },
  {
    title: "Thinking Tokens (encrypted)",
    desc: "Extended Thinking: Reasoning-Tokens vor der Antwort. Kommen als thinking_block mit base64-encoded Signature zurück. Anthropic kann validieren, Drittanbieter können nicht lesen — Anti-Distillation.",
    nodes: ["model", "thinking"],
    edges: ["model-think"],
  },
  {
    title: "Streaming Response → Harness",
    desc: "SSE-Stream: content_block_start → content_block_delta (input_json_delta) → content_block_stop. Der Harness akkumuliert JSON-Fragmente und parst am Ende.",
    nodes: ["api", "auth", "harness"],
    edges: ["auth-api", "h-auth"],
    reverse: true,
  },
  {
    title: "Harness führt das Tool aus",
    desc: "Local Tool (Bash, Read, Write) direkt im Process ODER MCP-Tool (JSON-RPC tools/call). Vorher: Permission-Check nach Deny → Ask → Allow. Bash hat einen tree-sitter-AST-Parser.",
    nodes: ["harness", "tools", "mcp"],
    edges: ["h-tools", "h-mcp"],
  },
  {
    title: "Loop: Tool-Result zurück, Modell macht weiter",
    desc: "Neuer Request: alte messages + assistant-message (tool_use) + user-message (tool_result). Cache greift wieder — Prefix wird re-used. Loop bis finale Text-Antwort OHNE tool_use.",
    nodes: ["harness", "auth", "api", "model"],
    edges: ["h-auth", "auth-api", "api-model"],
  },
  {
    title: "Auto Dream konsolidiert MEMORY.md",
    desc: "Periodischer Subagent (≥24h Inaktivität, ≥5 Sessions): liest MEMORY.md, mergt Duplikate, löscht Veraltetes, hält ≤200 Zeilen / 25 KB. Beim nächsten Start ist die Memory wieder im Context.",
    nodes: ["harness", "memory"],
    edges: ["h-mem"],
  },
];

// ── Component detail texts ──────────────────────────────────────────────────
export interface SimDetail {
  title: string;
  body: string;
}

export const DETAILS: Record<string, SimDetail> = {
  user: {
    title: "User",
    body: `Der Mensch am Terminal. Tippt natürlich-sprachliche Anfragen, reviewed Diffs, gibt Permissions frei (Allow / Deny / Ask).

In der Praxis ist der User der einzige autoritative Sender im System: alles andere — Tool-Outputs, MCP-Responses, Web-Inhalte — gilt als untrusted data.`,
  },
  ide: {
    title: "IDE (Editor mit ACP)",
    body: `Editor-Frontend wie Zed, Neovim, JetBrains IDEs, Emacs.

Spricht ACP (Agent Client Protocol): JSON-RPC 2.0 über stdio. Spawnt den Harness als Subprocess. ACP ist für KI-Agenten was LSP für Language Server ist. Von Zed Industries (Aug 2025), Apache 2.0.`,
  },
  harness: {
    title: "Harness (Claude Code)",
    body: `Der dünne Wrapper um das LLM. Implementiert den Agent-Loop:

while (true) {
  resp = api.call(system, tools, history)
  if (resp.tool_use) {
    result = executeTool(resp.tool_use)
    history.append(resp, result)
  } else {
    display(resp.text); break
  }
}

Der Harness ist NICHT das Modell. Er macht KEIN Reasoning. Die ganze Intelligenz steckt im RL-trainierten Modell.`,
  },
  claudemd: {
    title: "CLAUDE.md / AGENTS.md",
    body: `Plain-Text-Memory-Datei. Wird bei jedem Session-Start in den System-Prompt geladen.

Hierarchie:
  ~/.claude/CLAUDE.md      ← global
  ./CLAUDE.md              ← Projekt (Git)
  ./sub/CLAUDE.md          ← Subdirectory
  ./CLAUDE.local.md        ← gitignored

AGENTS.md ist der provider-agnostische Standard (Linux Foundation, 60.000+ Repos).`,
  },
  skill: {
    title: "SKILL.md (Agent Skills)",
    body: `YAML-Frontmatter + Markdown + optionale Scripts.

PROGRESSIVE DISCLOSURE:
1. Startup: nur Frontmatter (~50 Tokens pro Skill)
2. On-Demand: volle SKILL.md wenn relevant
3. Deep-Dive: Referenzierte Files später
4. Code-Execution: Scripts in Sandbox

1 Skill ≈ 50 Tokens vs 1 MCP-Server ≈ 2.000–55.000+ Tokens (Faktor 40–1100×).`,
  },
  memory: {
    title: "MEMORY.md (Auto Memory)",
    body: `Automatisch verwaltete Memory-Datei. Claude schreibt selbst Notizen rein: Build-Commands, Debugging-Insights, Style-Preferences.

Limit: 200 Zeilen / 25 KB. AUTO DREAM: Hintergrund-Subagent konsolidiert periodisch (≥24h, ≥5 Sessions).`,
  },
  tools: {
    title: "Local Tools",
    body: `Im Harness-Process: Read, Write, Edit, Bash, Glob, Grep, Task (Subagent), etc. 19+ bei Claude Code.

Tool-Definitionen als JSON-Schema im "tools"-API-Parameter → Input-Tokens.

PERMISSIONS: Deny → Ask → Allow. Bash: tree-sitter-WASM AST-Parser, 22 Validators, ~9.700 Zeilen Security.`,
  },
  mcp: {
    title: "MCP-Server",
    body: `Model Context Protocol: JSON-RPC 2.0 (stdio, SSE, HTTP).

DAS TOKEN-PROBLEM:
• GitHub MCP (35 Tools): ~26.000 Tokens
• GitHub MCP (93 Tools): ~55.000 Tokens
• MySQL MCP (106 Tools): ~54.600 Tokens
• Docker MCP (135 Tools): ~126.000 Tokens

Tool-Selection-Accuracy fällt von 49% auf 14% mit zu vielen Tools.`,
  },
  auth: {
    title: "Authentifizierung",
    body: `Zwei Wege:
(1) API-KEY: x-api-key: sk-ant-… → Pay-as-you-go
(2) OAUTH: Authorization: Bearer eyJ… → Subscription

Opus 4.6: $5/$25 per MTok (Input/Output)
Sonnet 4.6: $3/$15 per MTok`,
  },
  api: {
    title: "API-Endpoint",
    body: `POST https://api.anthropic.com/v1/messages
Body: {model, system, tools, messages, stream: true, thinking: {type: "enabled"}}

Response: Server-Sent Events (SSE).

NATIVE CLIENT ATTESTATION: Bun's Zig-HTTP-Stack überschreibt "cch=00000" mit Hash → DRM für API-Calls.`,
  },
  cache: {
    title: "KV-Cache",
    body: `Beim Prefill: Key/Value-Tensoren für jedes Token in jeder Attention-Layer.

CACHE-KEY = Hash(Modell + Tools + System-Prompt + Prefix)
Nur exakter Prefix-Match. Ein Token Änderung = alles danach invalidiert.

Sonnet 4.6: Base $3/MTok, Cache-Write $3.75 (1.25×), Cache-Read $0.30 (90% Rabatt). TTL: 5 Min.`,
  },
  model: {
    title: "Modell (Claude Opus 4.6)",
    body: `Dense Transformer. 1M Context, 128K Output. Codename: "Fennec".

Drei Trainings-Phasen:
(1) Supervised Fine-Tuning auf Tool-Use-Conversations
(2) Special Tokens zur Demarkation
(3) Reinforcement Learning für die Wann-Entscheidung

"Aller Wert steckt im RL-trainierten Modell, nicht in 10.000 Zeilen Abstraktion."`,
  },
  thinking: {
    title: "Thinking Tokens (encrypted)",
    body: `Extended Thinking: Reasoning-Tokens VOR der Antwort.

thinking_block mit base64-Signature (bis 13.184 Zeichen). Anthropic validiert für Reuse, Drittanbieter können nicht lesen.

PROBLEM: Bei Resume werden alle Signaturen replayed. 480-Message-Session: 39.000 Tokens reine Signaturen = 25% des Payloads.`,
  },
};

// ── Category colors for dark/light mode ─────────────────────────────────────
export function getCatColors(isDark: boolean) {
  return {
    person: {
      fill: isDark ? "#1f1424" : "#f5f0ff",
      stroke: isDark ? "#c084fc" : "#a855f7",
    },
    client: {
      fill: isDark ? "#14241f" : "#f0fdfa",
      stroke: isDark ? "#5eead4" : "#14b8a6",
    },
    harness: {
      fill: isDark ? "#241914" : "#fff7ed",
      stroke: isDark ? "#fb923c" : "#f97316",
    },
    memory: {
      fill: isDark ? "#241f14" : "#fefce8",
      stroke: isDark ? "#facc15" : "#eab308",
    },
    tool: {
      fill: isDark ? "#14241a" : "#f0fdf4",
      stroke: isDark ? "#4ade80" : "#22c55e",
    },
    infra: {
      fill: isDark ? "#14192b" : "#eff6ff",
      stroke: isDark ? "#60a5fa" : "#3b82f6",
    },
    model: {
      fill: isDark ? "#2b1424" : "#fdf2f8",
      stroke: isDark ? "#f472b6" : "#ec4899",
    },
  };
}
