// Quellen und Einschränkungen der Folie „Memory: Kein Ansatz gewinnt klar“
// (components/MemoryScatter.vue). Die Punktwerte in `MEMORY_APPROACHES`
// (chartData.ts) sind eine eigene Einschätzung vom 08.04.2026, am 24.11.2026
// an vier Stellen korrigiert; die Quellen unten belegen Mechanismen und
// Teilaussagen. Recherchiert und an den Rohseiten geprüft am 23.11.2026
// (retrieved: "2026-11-23").
export const line =
  "Werte: eigene Einschätzung auf Skalen von 1–10, am 24.11.2026 korrigiert · vier Werte ohne jede Messung · Belege unter ⓘ Quellen · Stand 24.11.2026";

export const scope =
  "Die Belege tragen diese Aussage: Komplexe Memory-Systeme haben sich auf Coding-Aufgaben bisher nicht ausgezahlt. Einfache Kontextdateien bringen aber ebenfalls keinen allgemeinen Gewinn, und einzelne komplexe Systeme zeigen Gewinne. Eine Regel „einfach schlägt komplex“ geben die Belege nicht her.";

export const sources = [
  {
    href: "https://arxiv.org/abs/2609.23570",
    label: "VibeMemBench (arXiv, 20.09.2026)",
    note: "Stützt die Kernaussage: 4 Memory-Systeme, 11 von 12 Paarungen (ca. 92 %) nicht über dem Lauf ohne Memory; ohne Claude und GPT",
  },
  {
    href: "https://arxiv.org/abs/2602.08316",
    label: "SWE-ContextBench (Zhu et al., v3 vom 06.05.2026)",
    note: "Stützt Mem0 y = 5: 24,24 % gelöst gegen 26,26 % ohne Kontext. Grund für Mem0-Kosten 6 → 4: 0,62 $ gegen 0,79 $ je Aufgabe (ca. 78 %)",
  },
  {
    href: "https://www.letta.com/blog/benchmarking-ai-agent-memory",
    label: "Letta: Is a Filesystem All You Need? (12.08.2025)",
    note: "Stützt die Kernaussage: Verlauf in Dateien erreicht 74,0 % auf LoCoMo, Mem0-Graph 68,5 %. Chat-Benchmark, kein Coding",
  },
  {
    href: "https://arxiv.org/abs/2602.11988",
    label: "Evaluating AGENTS.md (ETH Zürich, v3 vom 29.09.2026)",
    note: "Grund für CLAUDE.md y 8 → 6 und Kosten 5 → 6: Kontextdateien heben die Lösungsquote nicht allgemein, kosten aber im Mittel über 20 % mehr",
  },
  {
    href: "https://arxiv.org/abs/2607.27250",
    label: "Do Context Files Help Coding Agents? (28.07.2026)",
    note: "Passt zu CLAUDE.md y = 6: Kontextdateien bewegen die Korrektheit nicht messbar. Klein: 17 Aufgaben, 288 Läufe",
  },
  {
    href: "https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals",
    label: "Vercel: AGENTS.md outperforms skills (27.01.2026)",
    note: "Grund für Skills y 9 → 5: AGENTS.md 100 %, Skills höchstens 79 %, ohne ausdrückliche Anweisung nicht besser als keine Doku. Eine Eval, ein Hersteller",
  },
  {
    href: "https://aclanthology.org/2026.findings-emnlp.1301/",
    label: "Prism (Findings EMNLP 2026)",
    note: "Grund für Repo-Map-Kosten 3 → 4: 13 % teurer als ohne Memory. Das strukturierte Prism spart bis 24,9 % bei gleicher Qualität",
  },
  {
    href: "https://cursor.com/blog/semsearch",
    label: "Cursor: Semantic Search (06.11.2025)",
    note: "Einziger Beleg für Cursor y = 7: Embeddings plus grep beantworten Fragen im Mittel 12,5 % genauer. Herstellermessung, keine Lösungsquote",
  },
  {
    href: "https://agentskills.io/specification.md",
    label: "Agent Skills: Specification",
    note: "Stützt Skills-Kosten 1: Im Ruhezustand lädt nur name und description, rund 100 Token je Skill",
  },
];

export const caveats = [
  {
    lead: "Einschätzung, keine Messung:",
    text: "Keine Quelle bewertet Setup-Komplexität, Effektivität und Token-Kosten auf einer gemeinsamen Skala, und kein Benchmark misst alle acht Ansätze im selben Aufbau. Die Werte vom 08.04.2026 hatten keine Quelle.",
  },
  {
    lead: "Vier Werte am 24.11.2026 korrigiert:",
    text: "CLAUDE.md y 8 → 6 und Kosten 5 → 6 (ETH: kein allgemeiner Gewinn, über 20 % Mehrkosten), Skills y 9 → 5 (Vercel: höchstens 79 %), Aider Repo Map Kosten 3 → 4 (Prism: 13 % Mehrkosten), Mem0 Kosten 6 → 4 (SWE-ContextBench: 0,62 $ gegen 0,79 $, ca. 78 % des Laufs ohne Memory).",
  },
  {
    lead: "Ohne jede Messung:",
    text: "MEMORY.md (Auto) y = 7, Session Persistence y = 6, MemGPT/Letta y = 4 auf Code und die Effektivität der Aider Repo Map y = 8. Für diese vier Werte gibt es keine Quelle; sie bleiben unverändert.",
  },
  {
    lead: "Chat-Benchmarks sind keine Coding-Belege:",
    text: "Die Zahlen von Mem0 (über 90 % weniger Token) und Letta (74,0 % auf LoCoMo) stammen aus Chat-Benchmarks. Auf Code-Aufgaben ist Mem0 nicht teurer als der Lauf ohne Memory, aber auch nicht besser.",
  },
  {
    lead: "Nicht jedes komplexe System verliert:",
    text: "Supermemory löst in SWE-ContextBench 30,30 % gegen 26,26 % ohne Kontext, Prism senkt die Kosten, Cursor misst einen Gewinn durch Embeddings. Eine allgemeine Regel folgt aus den Belegen deshalb nicht.",
  },
  {
    lead: "Die Studien zu Kontextdateien widersprechen sich:",
    text: "ETH und die Zwei-Agenten-Ablation messen keinen signifikanten Effekt; von Hand geschriebene Dateien bringen bei ETH im Mittel 2,4 Prozentpunkte. Vercel misst dagegen 53 % → 100 %.",
  },
  {
    lead: "Zwei Punkte beschreiben einen verlassenen Stand:",
    text: "Cursors aktuelle Doku beschreibt nur noch Instant Grep ohne Embeddings; ob die Embedding-Suche ganz entfallen ist, sagt keine Quelle. Letta hat den klassischen MemGPT-Server eingestellt, der Nachfolger Letta Code speichert Memory in git-versionierten Dateien.",
  },
];
