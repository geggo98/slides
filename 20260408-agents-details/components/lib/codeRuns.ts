// Syntaxfarben für Code, der in Stücke zerschnitten wird (ContextRotLuna: der
// Code läuft von Messstelle zu Messstelle, dazwischen stehen Knöpfe). Shiki
// liefert Tokens je Zeile; hier werden sie zu Läufen über den ganzen Text und
// lassen sich dann an beliebigen Zeichenstellen zerschneiden.

/** Ausschnitt eines Shiki-Tokens; `offset` zählt ab Textanfang. */
export interface TokenLike {
  content: string;
  offset: number;
  htmlStyle?: Record<string, string> | string;
}

/** Ein Textstück mit CSS-Variablen (leer: ungefärbt). */
export interface Run {
  text: string;
  style?: Record<string, string>;
}

function styleOf(t: TokenLike): Record<string, string> | undefined {
  const s = t.htmlStyle;
  if (!s) return undefined;
  if (typeof s !== "string") return s;
  const out: Record<string, string> = {};
  for (const part of s.split(";")) {
    const i = part.indexOf(":");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

/**
 * Läufe über den ganzen Text. Lücken (Zeilenumbrüche, die Shiki nicht als
 * Token liefert) werden ungefärbt aufgefüllt, so dass die Läufe zusammen genau
 * `code` ergeben. Stimmt ein Token nicht mit dem Text überein, gilt der Text.
 */
export function toRuns(code: string, lines: TokenLike[][]): Run[] {
  const runs: Run[] = [];
  let pos = 0;
  for (const t of lines.flat()) {
    if (t.offset < pos || t.offset + t.content.length > code.length) continue;
    if (t.offset > pos) runs.push({ text: code.slice(pos, t.offset) });
    runs.push({
      text: code.slice(t.offset, t.offset + t.content.length),
      style: styleOf(t),
    });
    pos = t.offset + t.content.length;
  }
  if (pos < code.length) runs.push({ text: code.slice(pos) });
  return runs;
}

/** Die Läufe zwischen den Zeichenstellen `from` (einschließlich) und `to`. */
export function sliceRuns(runs: Run[], from: number, to: number): Run[] {
  const out: Run[] = [];
  let pos = 0;
  for (const r of runs) {
    const a = Math.max(from, pos);
    const b = Math.min(to, pos + r.text.length);
    if (a < b)
      out.push({ text: r.text.slice(a - pos, b - pos), style: r.style });
    pos += r.text.length;
  }
  return out;
}
