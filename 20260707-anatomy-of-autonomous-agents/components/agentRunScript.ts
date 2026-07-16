// Drehbuch für den Agent-Lauf-Simulator (Folien „Simulation“ + „Zoom“).
// Eine gemeinsame Timeline pro View: jeder Step trägt die Claude- UND die
// Codex-Darstellung, damit der Live-Umschalter die Position behält.
//
// =====================================================================
// GROBE SCHÄTZWERTE (Platzhalter). Alle Token-Zahlen in dieser Datei
// sind Richtwerte und werden durch Messwerte aus einem echten Lauf
// ersetzt, sobald sie vorliegen. NUR die Konstanten unten und die
// tokens-Felder der Steps anpassen — die Sim summiert selbst.
// =====================================================================

export type Vendor = "claude" | "codex";

export interface TermEvent {
  kind:
    | "header"
    | "wrapper"
    | "user"
    | "thinking"
    | "msg"
    | "tool"
    | "todos"
    | "diff"
    | "diffPager"
    | "promptPanel"
    | "composer";
  // generic text (user / msg / wrapper)
  text?: string;
  // tool / exec
  label?: string;
  arg?: string;
  result?: string;
  status?: "success" | "error" | "pending";
  // header
  model?: string;
  org?: string;
  cwd?: string;
  version?: string;
  user?: string;
  // todos
  todos?: { label: string; status: "done" | "active" | "todo" }[];
  // diff (claude) / diffPager (codex)
  file?: string;
  summary?: string;
  diffLines?: {
    type: "meta" | "hunk" | "add" | "del" | "ctx";
    n?: number;
    text: string;
  }[];
  // promptPanel (Zoom: der vom Hauptagenten generierte Prompt)
  title?: string;
  encrypted?: boolean;
  note?: string;
  // composer
  effort?: string;
  mode?: string;
}

export interface SimStep {
  id: string;
  /** Autoplay-Verweildauer dieses Steps in ms. */
  dwellMs: number;
  /** Sidebar-Einzeiler: was passiert gerade. */
  note?: string;
  /** Sidebar-Highlight (z. B. Subagent-Multiplikator). */
  flag?: "multiplier";
  /** Token-Deltas (Claude-Basis); Codex wird via CODEX_TOKEN_FACTOR abgeleitet. */
  tokens?: { main?: number; sub?: number };
  claude: TermEvent[];
  codex: TermEvent[];
}

export const TOKEN_LABELS = {
  claude: { main: "claude-opus xhigh", sub: "Sonnet 5" },
  codex: { main: "gpt-5.6-sol ultra", sub: "gpt-5.6-sol low" },
} as const;

/** 3 Tickets ⇒ 3 Workflows ⇒ 3 isolierte Kontextfenster, die alles neu lesen. */
export const SUBAGENT_COUNT = 3;

/** GPT-5.6 verbraucht erfahrungsgemäß ~10–15 % weniger Token (grobe Annahme). */
export const CODEX_TOKEN_FACTOR = 0.87;

const CWD = "~/agenten/ticket-tests";
const RUNBOOK = "runbooks/ticket-test-runbook.md";

const TODOS_START: TermEvent["todos"] = [
  { label: "PROJ-1041 Bonitätsablehnung prüfen", status: "todo" },
  { label: "PROJ-1042 Preis-Regression prüfen", status: "todo" },
  { label: "PROJ-1043 Sonderfall Fahranfänger prüfen", status: "todo" },
];
const TODOS_MID: TermEvent["todos"] = [
  { label: "PROJ-1041 — übersprungen (Idempotenz)", status: "done" },
  { label: "PROJ-1042 Preis-Regression prüfen", status: "active" },
  { label: "PROJ-1043 Sonderfall Fahranfänger prüfen", status: "todo" },
];
const TODOS_LATE: TermEvent["todos"] = [
  { label: "PROJ-1041 — übersprungen (Idempotenz)", status: "done" },
  { label: "PROJ-1042 — Follow-up gepostet", status: "done" },
  { label: "PROJ-1043 Sonderfall Fahranfänger prüfen", status: "active" },
];
const TODOS_DONE: TermEvent["todos"] = [
  { label: "PROJ-1041 — übersprungen (Idempotenz)", status: "done" },
  { label: "PROJ-1042 — Follow-up gepostet", status: "done" },
  { label: "PROJ-1043 — voller Report gepostet", status: "done" },
];

export const STEPS_OVERVIEW: SimStep[] = [
  {
    id: "boot",
    dwellMs: 2000,
    note: "Session-Start: Enterprise-Lizenz, Hauptmodell geladen",
    claude: [
      {
        kind: "header",
        version: "v2.1.206",
        user: "Ticket-Tester",
        model: "claude-opus · xhigh · ultracode (Workflows)",
        org: "Enterprise-Lizenz",
        cwd: CWD,
      },
    ],
    codex: [
      {
        kind: "wrapper",
        text: `while true; do codex exec "Lies und befolge ${RUNBOOK}"; sleep 3600; done`,
      },
      {
        kind: "header",
        version: "v0.138.2",
        model: "gpt-5.6-sol ultra",
        cwd: CWD,
      },
    ],
  },
  {
    id: "prompt",
    dwellMs: 2400,
    note: "Grundkosten jedes Laufs: System-Prompt + Werkzeuge + Runbook-Einstieg",
    tokens: { main: 18_000 },
    claude: [
      {
        kind: "user",
        text: `/loop 1h (lokal, keine Cloud) Bitte führe @${RUNBOOK} aus`,
      },
    ],
    codex: [
      {
        kind: "user",
        text: `Lies und befolge ${RUNBOOK} (Übergabe aus der while-Schleife — Codex hat noch kein /loop)`,
      },
    ],
  },
  {
    id: "think-1",
    dwellMs: 1600,
    tokens: { main: 500 },
    claude: [{ kind: "thinking" }],
    codex: [{ kind: "thinking" }],
  },
  {
    id: "read-runbook",
    dwellMs: 1800,
    note: "Runbook on demand gelesen — Programm in Prosa",
    tokens: { main: 6_500 },
    claude: [
      {
        kind: "tool",
        label: "Read",
        arg: RUNBOOK,
        result: "212 Zeilen gelesen",
      },
    ],
    codex: [{ kind: "tool", label: `cat ${RUNBOOK}`, result: "212 Zeilen" }],
  },
  {
    id: "find-tickets",
    dwellMs: 2000,
    note: "Zustand lebt im Ticketsystem, nicht im Prozess",
    tokens: { main: 1_800 },
    claude: [
      {
        kind: "tool",
        label: "jira",
        arg: "search status=offen labels=testautomation",
        result: "3 offene Tickets: PROJ-1041 · PROJ-1042 · PROJ-1043",
      },
    ],
    codex: [
      {
        kind: "tool",
        label: "jira search --status offen --label testautomation",
        result: "3 offene Tickets: PROJ-1041 · PROJ-1042 · PROJ-1043",
      },
    ],
  },
  {
    id: "todos",
    dwellMs: 1800,
    tokens: { main: 400 },
    claude: [
      {
        kind: "tool",
        label: "TaskCreate",
        arg: "3 Tickets",
        result: "Aufgabenliste angelegt",
      },
      { kind: "todos", todos: TODOS_START },
    ],
    codex: [
      { kind: "tool", label: "update_plan", result: "3 Schritte" },
      { kind: "todos", todos: TODOS_START },
    ],
  },
  {
    id: "spawn",
    dwellMs: 2600,
    note: "Jeder Workflow ist ein isoliertes Kontextfenster — liest Runbook-Modul + Ticket komplett neu",
    flag: "multiplier",
    tokens: { sub: 27_000 },
    claude: [
      {
        kind: "tool",
        label: "Workflow",
        arg: "ticket-test PROJ-1041 · Sonnet 5",
        result: "Subagent gestartet — eigener Kontext",
        status: "pending",
      },
      {
        kind: "tool",
        label: "Workflow",
        arg: "ticket-test PROJ-1042 · Sonnet 5",
        result: "Subagent gestartet — eigener Kontext",
        status: "pending",
      },
      {
        kind: "tool",
        label: "Workflow",
        arg: "ticket-test PROJ-1043 · Sonnet 5",
        result: "Subagent gestartet — eigener Kontext",
        status: "pending",
      },
    ],
    codex: [
      {
        kind: "tool",
        label: "spawn_agent ticket-test PROJ-1041",
        result: "gpt-5.6-sol low · MultiAgentV2",
        status: "pending",
      },
      {
        kind: "tool",
        label: "spawn_agent ticket-test PROJ-1042",
        result: "gpt-5.6-sol low · MultiAgentV2",
        status: "pending",
      },
      {
        kind: "tool",
        label: "spawn_agent ticket-test PROJ-1043",
        result: "gpt-5.6-sol low · MultiAgentV2",
        status: "pending",
      },
    ],
  },
  {
    id: "result-1041",
    dwellMs: 2200,
    note: "Ausgang 1: Idempotenz-Header sagt „schon getestet“ — überspringen",
    tokens: { sub: 3_500, main: 600 },
    claude: [
      {
        kind: "tool",
        label: "Workflow",
        arg: "PROJ-1041",
        result: "übersprungen — Idempotenz-Header: schon getestet auf 4f9c2ae",
      },
      { kind: "todos", todos: TODOS_MID },
    ],
    codex: [
      {
        kind: "tool",
        label: "agent PROJ-1041",
        result: "übersprungen — Idempotenz-Header: schon getestet auf 4f9c2ae",
      },
      { kind: "todos", todos: TODOS_MID },
    ],
  },
  {
    id: "result-1042",
    dwellMs: 2200,
    note: "Ausgang 2: neuer Commit — nur der fehlende Testfall wird nachgetestet",
    tokens: { sub: 11_000, main: 900 },
    claude: [
      {
        kind: "tool",
        label: "Workflow",
        arg: "PROJ-1042",
        result:
          "Follow-up — neuer Commit b7e21d0, nur TC3 nachgetestet · Kommentar ergänzt",
      },
      { kind: "todos", todos: TODOS_LATE },
    ],
    codex: [
      {
        kind: "tool",
        label: "agent PROJ-1042",
        result:
          "Follow-up — neuer Commit b7e21d0, nur TC3 nachgetestet · Kommentar ergänzt",
      },
      { kind: "todos", todos: TODOS_LATE },
    ],
  },
  {
    id: "timeout-1043",
    dwellMs: 2200,
    note: "Fehler ist Signal, kein Abbruch — der Lauf bleibt stur",
    tokens: { sub: 7_000 },
    claude: [
      {
        kind: "tool",
        label: "Workflow",
        arg: "PROJ-1043",
        result: "Timeout nach 120 s — Staging antwortet nicht",
        status: "error",
      },
    ],
    codex: [
      {
        kind: "tool",
        label: "agent PROJ-1043",
        result: "Timeout nach 120 s — Staging antwortet nicht",
        status: "error",
      },
    ],
  },
  {
    id: "retry-1043",
    dwellMs: 2400,
    note: "Ausgang 3: Retry mit doppelter Wartezeit — dann voller Report",
    tokens: { sub: 16_000, main: 1_200 },
    claude: [
      { kind: "msg", text: "Neuer Versuch mit 240 s Wartezeit …" },
      {
        kind: "tool",
        label: "Workflow",
        arg: "PROJ-1043 · Retry",
        result: "voller Testreport gepostet — TC1 ✅ · TC2 ✅ · TC3 ❌",
      },
      { kind: "todos", todos: TODOS_DONE },
    ],
    codex: [
      { kind: "msg", text: "Neuer Versuch mit 240 s Wartezeit …" },
      {
        kind: "tool",
        label: "followup_task PROJ-1043 --retry",
        result: "voller Testreport gepostet — TC1 ✅ · TC2 ✅ · TC3 ❌",
      },
      { kind: "todos", todos: TODOS_DONE },
    ],
  },
  {
    id: "notes",
    dwellMs: 2600,
    note: "Lernen durch Notizen: Der nächste Lauf kennt den Timeout-Trick",
    tokens: { main: 1_800 },
    claude: [
      {
        kind: "diff",
        file: "notizen/ticket-tests.md",
        summary: "Updated notizen/ticket-tests.md with 1 addition",
        diffLines: [
          { type: "ctx", n: 41, text: "## Beobachtungen" },
          { type: "ctx", n: 42, text: "- Staging braucht nach Deploy ~3 min" },
          {
            type: "add",
            n: 43,
            text: "- Bei Timeout: einfach nochmals probieren und etwas länger warten (2× Wartezeit)",
          },
        ],
      },
    ],
    codex: [
      {
        kind: "diffPager",
        diffLines: [
          {
            type: "meta",
            text: "diff --git a/notizen/ticket-tests.md b/notizen/ticket-tests.md",
          },
          { type: "hunk", text: "@@ -41,2 +41,3 @@ ## Beobachtungen" },
          { type: "ctx", text: " - Staging braucht nach Deploy ~3 min" },
          {
            type: "add",
            text: "+- Bei Timeout: einfach nochmals probieren und etwas länger warten (2× Wartezeit)",
          },
        ],
      },
    ],
  },
  {
    id: "done",
    dwellMs: 2400,
    note: "Lauf beendet — Orchestrierung wartet stumpf auf die nächste Stunde",
    tokens: { main: 700 },
    claude: [
      {
        kind: "msg",
        text: "3 Tickets verarbeitet: 1× übersprungen, 1× Nachtest, 1× voller Report. Nächster Lauf in 1 h.",
      },
      { kind: "composer", effort: "ultracode", mode: "auto" },
    ],
    codex: [
      {
        kind: "msg",
        text: "3 Tickets verarbeitet: 1× übersprungen, 1× Nachtest, 1× voller Report. Die while-Schleife schläft 3600 s.",
      },
      { kind: "composer", model: "gpt-5.6-sol ultra", cwd: CWD },
    ],
  },
];

// Der vom Hauptagenten generierte Subagent-Prompt (Zoom, Claude-Ansicht).
const GENERATED_PROMPT =
  "Du testest Ticket PROJ-1043 (preis-service, Sonderfall Fahranfänger). Code-Stand: Commit 4f9c2ae. " +
  "Führe die Testfälle TC1–TC3 aus dem Runbook-Modul module/preis-service.md aus. " +
  "Idempotenz: Lies zuerst den Kommentar-Header im Ticket — gleicher Commit ⇒ nur fehlende Testfälle nachtesten. " +
  "Nutze den test-runner-Skill. Antworte NUR mit dem strukturierten Ergebnis-Kommentar (Tabelle Testfall/Status/Beobachtet) — poste nichts selbst.";

// Fact-Check-Hinweis (openai/codex#28058): Verschlüsselung ist ein Feature der
// Codex CLI (MultiAgentV2, PR #26210, nach v0.137.0) — nicht modellabhängig.
const ENCRYPTION_NOTE =
  "Codex CLI verschlüsselt Sub-Agent-Prompts (MultiAgentV2, PR #26210, > v0.137.0 — nicht modellabhängig): " +
  "Im Rollout-/Audit-Log steht nur Ciphertext. Offene Regression:";

const CIPHERTEXT =
  "enc:v2:gAAAAABo3q7Kx1P9tL0fZ2Yc8VwJm4Qs6Rd0aHhN5uBpEeTi9XkC3vLySf7WgO1zMnA2jDqUr8bt…";

export const STEPS_ZOOM: SimStep[] = [
  {
    id: "z-boot",
    dwellMs: 2000,
    note: "Frischer Kontext: Der Subagent weiß nichts vom Hauptlauf",
    claude: [
      {
        kind: "header",
        version: "v2.1.206",
        user: "Workflow PROJ-1043",
        model: "Sonnet 5 — billiger & schnell genug",
        org: "gestartet vom Hauptagenten · eigenes Kontextfenster",
        cwd: CWD,
      },
    ],
    codex: [
      {
        kind: "header",
        version: "v0.138.2",
        model: "gpt-5.6-sol low",
        cwd: CWD,
      },
    ],
  },
  {
    id: "z-prompt",
    dwellMs: 3200,
    note: "Der Prompt ist generiert, nicht getippt — der Hauptagent ist der Autor",
    tokens: { sub: 9_000 },
    claude: [
      {
        kind: "promptPanel",
        title: "Vom Hauptagenten generierter Prompt",
        text: GENERATED_PROMPT,
      },
    ],
    codex: [
      {
        kind: "promptPanel",
        title: "Vom Hauptagenten generierter Prompt (spawn_agent)",
        text: CIPHERTEXT,
        encrypted: true,
        note: ENCRYPTION_NOTE,
      },
    ],
  },
  {
    id: "z-think",
    dwellMs: 1600,
    tokens: { sub: 500 },
    claude: [{ kind: "thinking" }],
    codex: [{ kind: "thinking" }],
  },
  {
    id: "z-skill",
    dwellMs: 2200,
    note: "Skills als Hände: ~50 Token Frontmatter statt voller Tool-Definitionen",
    tokens: { sub: 800 },
    claude: [
      {
        kind: "tool",
        label: "Skill",
        arg: "test-runner",
        result: "geladen — TC-Läufe gegen Staging, Calc-IDs einsammeln",
      },
    ],
    codex: [
      {
        kind: "tool",
        label: "skill test-runner",
        result: "geladen — TC-Läufe gegen Staging, Calc-IDs einsammeln",
      },
    ],
  },
  {
    id: "z-run",
    dwellMs: 2200,
    note: "Der Timeout aus der Übersicht — hier passiert er wirklich",
    tokens: { sub: 4_700 },
    claude: [
      {
        kind: "tool",
        label: "Bash",
        arg: "./run-tc preis-service 4f9c2ae TC1 TC2 TC3",
        result: "Timeout nach 120 s — Staging antwortet nicht",
        status: "error",
      },
    ],
    codex: [
      {
        kind: "tool",
        label: "./run-tc preis-service 4f9c2ae TC1 TC2 TC3",
        result: "Timeout nach 120 s — Staging antwortet nicht",
        status: "error",
      },
    ],
  },
  {
    id: "z-retry",
    dwellMs: 2600,
    note: "Notiz aus dem Runbook: bei Timeout länger warten — genau das passiert",
    tokens: { sub: 14_000 },
    claude: [
      {
        kind: "msg",
        text: "Runbook-Notiz: Staging braucht nach Deploy ~3 min. Neuer Versuch mit 240 s.",
      },
      {
        kind: "tool",
        label: "Bash",
        arg: "./run-tc … --timeout 240",
        result:
          "TC1 ✅ Ablehnung wie erwartet · TC2 ✅ Preis unverändert · TC3 ❌ Aufschlag fehlt",
      },
    ],
    codex: [
      {
        kind: "msg",
        text: "Runbook-Notiz: Staging braucht nach Deploy ~3 min. Neuer Versuch mit 240 s.",
      },
      {
        kind: "tool",
        label: "./run-tc … --timeout 240",
        result:
          "TC1 ✅ Ablehnung wie erwartet · TC2 ✅ Preis unverändert · TC3 ❌ Aufschlag fehlt",
      },
    ],
  },
  {
    id: "z-report",
    dwellMs: 2600,
    note: "Nur das strukturierte Ergebnis geht zurück — der Kontext stirbt mit dem Subagenten",
    tokens: { sub: 3_000 },
    claude: [
      {
        kind: "msg",
        text: "Ergebnis-Kommentar an Hauptagent übergeben: Code-Stand 4f9c2ae · TC1 ✅ · TC2 ✅ · TC3 ❌ (Aufschlag fehlt, Calc c9d8e7f6-…). Roter Befund gegen PR-Diff gegengeprüft.",
      },
    ],
    codex: [
      {
        kind: "msg",
        text: "Ergebnis an Parent-Agent (send_message): Code-Stand 4f9c2ae · TC1 ✅ · TC2 ✅ · TC3 ❌ (Aufschlag fehlt, Calc c9d8e7f6-…). Roter Befund gegen PR-Diff gegengeprüft.",
      },
    ],
  },
  {
    id: "z-done",
    dwellMs: 2000,
    note: "Subagent-Ende: Kontextfenster verworfen, Ergebnis bleibt im Ticket",
    claude: [
      {
        kind: "msg",
        text: "Workflow beendet — Kontextfenster wird verworfen.",
      },
    ],
    codex: [
      { kind: "msg", text: "Agent beendet — Kontextfenster wird verworfen." },
    ],
  },
];
