// GESCHÄTZT, NICHT GEMESSEN — eigene Annahme, andere Herkunft als
// `preliminaryDeepSWE.ts`.
// ---------------------------------------------------------------------------
// `preliminaryDeepSWE.ts` zeigt die SELBSTBERICHTETEN Herstellerzahlen für
// Claude Opus 5.5 und GPT-6 Sol/Luna (Systemcard bzw. Ankündigungs-Chart) —
// bewusst OHNE Chart-Punkt, weil aus einem anderen Benchmark keine belastbare
// €/Task-Koordinate für DIESES Chart folgt (siehe dortiger Kopfkommentar).
//
// Diese Datei geht den umgekehrten Weg: keine neue Score-Behauptung, sondern
// eine explizite Annahme — „Leistungsfähigkeit wie das Vorgängermodell,
// Preis auf die neue Preisliste re-skaliert". Score = der beim Vorgänger
// bereits gezeigte, gerundete `Pt.y` aus `CURRENT` (keine neue Rundung).
// Vorgänger-Zuordnung folgt der Namenskontinuität, die OpenAI selbst benutzt
// (Sol → Sol, Luna → Luna); Anthropic hat kein Namens-Analogon, hier ist der
// Vorgänger schlicht die vorherige Opus-Generation.
//
// Getrennt von `paretoData.ts` gehalten aus demselben Grund wie
// `preliminaryDeepSWE.ts`: löschbare Einheit. Sobald DeepSWE eines der drei
// Modelle real misst (Tracking-Issues #98 Opus 5.5, #99 Sol/Luna, beide
// 22.09.2026 offen), ersetzt ein echter `Pt` in einem `SNAPSHOTS`-Eintrag
// diesen Punkt — und diese Datei verliert den betroffenen Eintrag oder wird,
// wenn alle drei ersetzt sind, ganz gelöscht. Kein Re-Export über
// `paretoData.ts`, damit `grep -rl preliminaryParetoPoints` jede betroffene
// Stelle findet.
//
// Methode: zwei-Bucket-Skalierung, identisch zur Herleitung der realen
// gpt-5.6-sol-Preissenkung im Kopfkommentar von `paretoData.ts`
// („Preissenkung gpt-5.6-sol vom 21.08.2026"):
//
//   Output-Anteil alt = mean_output_tokens × alter Output-Preis
//   Rest-Anteil alt    = mean_cost_usd − Output-Anteil alt
//   neu (USD)          = Rest-Anteil × (neuer/alter Input-Preis)
//                       + Output-Anteil × (neuer/alter Output-Preis)
//   neu (€)            = neu (USD) × 0,876   — derselbe Kurs wie überall in
//                         `paretoData.ts`
//
// Rohzahlen (mean_output_tokens, mean_cost_usd) aus
// data/deepswe/board-20260903T222437Z-c55e58f2.ndjson — demselben Stand wie
// `CURRENT` —, `config` = die jeweils beste Konfiguration je Vorgänger
// („max" bei allen dreien, dieselbe Regel wie `bestByScore()`):
//
//   claude-opus-5   max   mean_output_tokens 117 565,6937   mean_cost_usd 11,837583
//   gpt-5.6-sol     max   mean_output_tokens  60 013,6444   mean_cost_usd  6,455955
//   gpt-5.6-luna    max   mean_output_tokens  73 399,7076   mean_cost_usd  0,605623
//
// Offizielle Preise je MTok (Input/Output), primäre Quellen, abgerufen
// 24.09.2026:
//
//   Anthropic (platform.claude.com/docs/en/about-claude/pricing):
//     Claude Opus 5    $5 / $25
//     Claude Opus 5.5  $4 / $20
//   OpenAI (developers.openai.com/api/docs/pricing):
//     GPT-5.6 Sol      $4 / $20         GPT-6 Sol   $2 / $10
//     GPT-5.6 Luna    $0,20 / $1,20     GPT-6 Luna  $0,10 / $0,50
//
// Rechnung je Modell:
//
//   claude-opus-5.5: Output-Anteil = 117565,6937 × 25/1e6 = 2,939142 $
//                    Rest-Anteil   = 11,837583 − 2,939142 = 8,898441 $
//                    neu = (8,898441 + 2,939142) × 0,8 = 9,470066 $ → 8,2958 € → 8,30 €
//                    (beide Bucket-Ratios sind hier zufällig gleich 0,8 —
//                    die Aufteilung ändert am Ergebnis nichts, siehe Caveat
//                    unten)
//
//   gpt-6-sol:       Output-Anteil = 60013,6444 × 20/1e6 = 1,200273 $
//                    Rest-Anteil   =  6,455955 − 1,200273 = 5,255682 $
//                    neu = (5,255682 + 1,200273) × 0,5 = 3,227977 $ → 2,8277 € → 2,83 €
//                    (Input- UND Output-Ratio sind hier beide exakt 0,5 —
//                    OpenAIs Preissenkung ist für Sol über alle Komponenten
//                    uniform)
//
//   gpt-6-luna:      Output-Anteil = 73399,7076 × 1,20/1e6 = 0,088080 $
//                    Rest-Anteil   =  0,605623 − 0,088080  = 0,517544 $
//                    neu = 0,517544 × 0,5 + 0,088080 × (0,50/1,20)
//                        = 0,258772 + 0,036700 = 0,295472 $ → 0,25887 € → 0,26 €
//
// CAVEAT Opus 5.5, absichtlich NICHT eingerechnet: Anthropics Cache-Lese-
// Multiplikator sinkt bei Opus 5.5 zusätzlich (0,1× → 0,05× Base-Input),
// stärker als der Input/Output-Preis selbst (×0,8). Die Zwei-Bucket-Methode
// bündelt Cache-Reads in den „Rest"-Anteil und skaliert sie nur mit ×0,8 —
// sie erfasst diesen Zusatzrabatt nicht. Bei einem cache-lastigen
// Agenten-Workload wie DeepSWEs mini-swe-agent (Opus 5 max laut Board:
// mean_cache_tokens 14,78 Mio von mean_input_tokens 15,03 Mio, also
// vermutlich >95 % Cache-Treffer) dürfte der reale Preis darunter liegen —
// die 8,30 € sind eine vorsichtige OBERE Schätzung, keine engere Eingrenzung.
// Nicht durch eine dritte, cache-bewusste Rechnung ersetzt: das würde
// voraussetzen, was `mean_cache_tokens` im Board-Schema genau abrechnet, und
// das ist nirgends dokumentiert — eine ungeprüfte Annahme wäre schlechter als
// die dokumentierte Konservativität hier.
//
// Front-Auswirkung (Stand `CURRENT`: glm-5.3-flash 0,21 €/63 % →
// gpt-5.6-luna 0,53 €/67 % → gemini-3.8-flash 2,07 €/74 %, Summe 2,81 €):
// gpt-6-luna (0,26 €, 67 %) dominiert gpt-5.6-luna (gleicher Score,
// billiger) und ersetzt es als Sprosse 2 — neue Leiter 0,21 + 0,26 + 2,07 =
// 2,54 € (−9,6 %). gpt-6-sol (2,83 €, 73 %) und claude-opus-5.5 (8,30 €,
// 74 %) bleiben dominiert: gemini-3.8-flash liefert denselben gerundeten
// Score für weniger Geld — dieselbe Pointe wie zuvor bei Opus 5 und
// gpt-6-astra, nur mit dem neuen Modell statt dem alten.
// Nachgerechnet in `lib/__tests__/preliminaryParetoPoints.test.ts`.

import { P, type Pt } from "../paretoData";

// gpt-6-sol bewusst OHNE `story`: es fällt genau in die dichte astra/sol/
// terra-Zone (2,83 € liegt zwischen gpt-5.6-terra 3,47 € und gpt-5.6-sol
// 5,66 €). Mit `story: true` erzwang der Platzierer dort eine Position, die
// mit den Labels von gpt-5.6-terra und gpt-5.6-sol kollidierte (gemessen
// 24.09.2026, `playwright-tests/pareto44-preliminary-points-check.ts`).
// Exakt dasselbe Muster wie bei gpt-6-astra auf dieser Folie: kein
// Story-Punkt, der Name kommt per Hover, Pin oder „alle Namen“ — siehe
// `paretoData.ts`, Abschnitt „Auf DIESER Folie ist astra kein Story-Punkt“.
export const PRELIMINARY_PARETO_POINTS: readonly Pt[] = [
  { ...P("claude-opus-5.5", 8.3, 74, { story: true }), provisional: true },
  { ...P("gpt-6-sol", 2.83, 73), provisional: true },
  { ...P("gpt-6-luna", 0.26, 67, { story: true }), provisional: true },
];
