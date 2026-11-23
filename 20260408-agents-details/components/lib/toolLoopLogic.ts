// Reine Logik der Figur ToolLoop.vue (Folie „Der User wartet, die Tools
// antworten“): Zeitleiste, Zähler, Klick-Übergänge, JSON-Färbung, Detail-
// Panel. Die Zahlen sind die ROWS aus TokenAccumulation.vue (Folie „Ein
// Bugfix, Token für Token“), dort als Bar-Summen R1 4.200 … R4 20.950.
import { TEXTS, type TextKey } from "../toolLoopTexts";

export const MAXV = 21000;

export interface Round {
  cached: number;
  fromOut: number;
  fresh: number;
  /** Einträge in `messages`: 1 User-Nachricht + 2 je fertiger Tool-Runde */
  msgs: number;
}

export const ROUNDS: readonly Round[] = [
  { cached: 0, fromOut: 0, fresh: 4200, msgs: 1 },
  { cached: 4200, fromOut: 2100, fresh: 5000, msgs: 3 },
  { cached: 11300, fromOut: 2100, fresh: 4000, msgs: 5 },
  { cached: 17400, fromOut: 3500, fresh: 50, msgs: 7 },
];

export const total = (r: Round) => r.cached + r.fromOut + r.fresh;

export type Variant = "local" | "mcp";

export interface Call {
  id: string;
  name: string;
  /** JSON des `input`-Objekts (eine Zeile) */
  input: string;
  /** Zeile im tool_use-Chip */
  short: string;
  /** Name der Quelle im tool_result-Chip */
  res: string;
  tok: string;
}

const EDIT: Call = {
  id: "toolu_03",
  name: "Edit",
  input: '{ "file_path": "…", "old_string": "…", "new_string": "…" }',
  short: "Edit  src/auth/session.ts",
  res: "ok",
  tok: "50",
};

const mcpRead = (n: 1 | 2, file: string, res: string, tok: string): Call => ({
  id: `toolu_0${n}`,
  name: "mcp__github__get_file_contents",
  input: `{ "owner": "…", "repo": "…", "path": "src/auth/${file}" }`,
  short: "mcp__github__get_file_contents",
  res,
  tok,
});

const localRead = (n: 1 | 2, file: string, res: string, tok: string): Call => ({
  id: `toolu_0${n}`,
  name: "Read",
  input: `{ "file_path": "src/auth/${file}" }`,
  short: `Read  src/auth/${file}`,
  res,
  tok,
});

export const CALLS: Record<Variant, readonly Call[]> = {
  local: [
    localRead(1, "session.ts", "session.ts", "5.000"),
    localRead(2, "token.ts", "token.ts", "4.000"),
    EDIT,
  ],
  mcp: [
    mcpRead(1, "session.ts", "session.ts", "5.000"),
    mcpRead(2, "token.ts", "token.ts", "4.000"),
    EDIT,
  ],
};

export type EventKind = "idle" | "ask" | "req" | "use" | "res" | "final";
export interface LoopEvent {
  kind: EventKind;
  /** Runde 0–3 (nicht bei idle/ask) */
  r?: number;
}

/** 13 Ereignisse, Index 0–12: idle, ask, dann je Runde req [use res] bzw. final. */
export const EVENTS: readonly LoopEvent[] = (() => {
  const ev: LoopEvent[] = [{ kind: "idle" }, { kind: "ask" }];
  for (let r = 0; r < ROUNDS.length; r++) {
    ev.push({ kind: "req", r });
    if (r < ROUNDS.length - 1) ev.push({ kind: "use", r }, { kind: "res", r });
    else ev.push({ kind: "final", r });
  }
  return ev;
})();

export const LAST = EVENTS.length - 1;

/** Verweilzeit im Autoplay je Ereignis in ms. */
export const DWELL: Record<EventKind, number> = {
  idle: 0,
  ask: 900,
  req: 1000,
  use: 1000,
  res: 750,
  final: 0,
};

export const evIndex = (kind: EventKind, r?: number) =>
  EVENTS.findIndex((e) => e.kind === kind && e.r === r);

export const dwellOf = (ev: number) => DWELL[EVENTS[ev]?.kind ?? "idle"] || 600;

/** Anzahl der bis Ereignis `ev` gestarteten Requests. */
export const requestsAt = (ev: number) =>
  ROUNDS.filter((_, r) => ev >= evIndex("req", r)).length;

/** Summe der Input-Tokens aller bis `ev` gestarteten Requests. */
export const inputSumAt = (ev: number) =>
  ROUNDS.slice(0, requestsAt(ev)).reduce((a, r) => a + total(r), 0);

export const fmt = (n: number) => n.toLocaleString("de-DE");

// ── Slidev-Klicks ────────────────────────────────────────────────────────
export interface ViewState {
  ev: number;
  cost: boolean;
}

/** Slidev-Klicks der Folie: je einer pro Ereignis 1–LAST, dazu einer für die Kosten. */
export const CLICKS = LAST + 1;

/**
 * Klick 0: Ruhezustand. Klick 1 bis LAST: je ein Ereignis weiter (Klick 1 ist
 * das „Senden“ des Users). Klick LAST + 1: Kostenansicht. Die Ansicht hängt nur
 * vom Klickstand ab, deshalb zeigen Rückwärtsklicks und der Einsprung in die
 * Folie denselben Zustand wie das Vorwärtsklicken.
 */
export function viewForClicks(clicks: number): ViewState {
  if (clicks <= 0) return { ev: 0, cost: false };
  if (clicks <= LAST) return { ev: clicks, cost: false };
  return { ev: LAST, cost: true };
}

// ── Textbausteine ────────────────────────────────────────────────────────
export type TextVars = Record<string, string | number>;

export const t = (k: TextKey, v: TextVars = {}): string =>
  TEXTS[k].replace(/\{(\w+)\}/g, (_, n: string) => String(v[n] ?? `{${n}}`));

export interface RichPart {
  tag: "b" | "code" | null;
  text: string;
}

/** Zerlegt Text mit `<b>…</b>` und `<code>…</code>` ohne v-html. */
export function richParts(s: string): RichPart[] {
  const parts: RichPart[] = [];
  for (const m of s.split(/(<b>.*?<\/b>|<code>.*?<\/code>)/)) {
    if (!m) continue;
    const tagged = /^<(b|code)>(.*)<\/\1>$/.exec(m);
    if (tagged)
      parts.push({ tag: tagged[1] as "b" | "code", text: tagged[2]! });
    else parts.push({ tag: null, text: m });
  }
  return parts;
}

// ── JSON-Färbung: Schlüssel, Strings, Anmerkung („← …“) ─────────────────
export interface JsonToken {
  cls: "k" | "s" | "c" | "p";
  text: string;
}

export function highlightJson(src: string): JsonToken[] {
  const out: JsonToken[] = [];
  // matches:  "type": "tool_use"  ->  k("\"type\""), p(":"), s("\"tool_use\"")
  //           ← in jeder Runde    ->  c(Rest der Zeile)
  const re = /("(?:[^"\\]|\\.)*")(\s*:)?|(←[^\n]*)/g;
  let last = 0;
  for (const m of src.matchAll(re)) {
    const at = m.index;
    if (at > last) out.push({ cls: "p", text: src.slice(last, at) });
    if (m[3] !== undefined) out.push({ cls: "c", text: m[3] });
    else if (m[2] !== undefined) {
      out.push({ cls: "k", text: m[1]! });
      out.push({ cls: "p", text: m[2] });
    } else out.push({ cls: "s", text: m[1]! });
    last = at + m[0].length;
  }
  if (last < src.length) out.push({ cls: "p", text: src.slice(last) });
  return out;
}

// ── Detail-Panel ─────────────────────────────────────────────────────────
export interface Wire {
  dir: string;
  role: string;
  note: string;
  json: string;
}

/** Panel-Inhalt für Ereignis `i`; null im Ruhezustand. */
export function wireFor(i: number, variant: Variant): Wire | null {
  const e = EVENTS[i];
  if (!e) return null;
  const r = e.r ?? 0;
  const c = CALLS[variant][r];
  const round = ROUNDS[r];
  switch (e.kind) {
    case "ask":
      return {
        dir: t("dir.userToModel"),
        role: "role: user",
        note: "",
        json: `{\n  "role": "user",\n  "content": "${t("bubble.user.text")}"\n}`,
      };
    case "req":
      return {
        dir: t("dir.request", { n: r + 1 }),
        role: "POST /v1/messages",
        note: r === 0 ? t("note.request.first") : t("note.request.auto"),
        json: `{\n  "system": "…",\n  "tools": [ { "name": "…", "description": "…", "input_schema": { … } }, … ],   ${t("ann.tools")}\n  "messages": [ … ${round!.msgs} … ]   ${t("ann.messages")}\n}   ${t("ann.tokens", { n: fmt(total(round!)) })}`,
      };
    case "use":
      return {
        dir: t("dir.modelToTool"),
        role: "role: assistant",
        note: "",
        json: `{\n  "type": "tool_use",\n  "id": "${c!.id}",\n  "name": "${c!.name}",\n  "input": ${c!.input}\n}`,
      };
    case "res":
      return {
        dir: t("dir.toolToHarness", { n: r + 2 }),
        role: "role: user",
        note: t("note.toolResult"),
        json: `{\n  "type": "tool_result",\n  "tool_use_id": "${c!.id}",\n  "content": "…"   ${t("ann.tokens", { n: c!.tok })}\n}`,
      };
    case "final":
      return {
        dir: t("dir.modelToUser"),
        role: "role: assistant",
        note: t("note.final"),
        json: `{\n  "type": "text",\n  "text": "${t("bubble.answer.text")}"\n}`,
      };
    default:
      return null;
  }
}

export function stepTitle(i: number): string {
  const e = EVENTS[i];
  switch (e?.kind) {
    case "ask":
      return t("step.1");
    case "req":
      return t("step.request", { n: (e.r ?? 0) + 1 });
    case "use":
      return t("step.toolUse");
    case "res":
      return t("step.toolResult");
    case "final":
      return t("step.final");
    default:
      return t("step.0");
  }
}
