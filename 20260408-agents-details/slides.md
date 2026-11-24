---
theme: default
title: "Wie funktioniert ein Coding-Agent?"
lang: de
info: |
  Architektur, Gemeinsamkeiten und Token-Verbrauch.
  Deep-Dive in Agent-Loop, Tool-Use, Context Management und die Erkenntnisse aus dem Claude-Code-Source-Leak.
monaco: true
mdc: true
transition: slide-left
colorSchema: auto
fonts:
  sans: Inter
  mono: 0xProto
hideInToc: true
---

# Wie funktioniert ein Coding-Agent?

Architektur, Gemeinsamkeiten und Token-Verbrauch

<div class="mt-8 text-sm opacity-60">

Zielgruppe: Software-Entwickler

</div>

---
hideInToc: true
---

# Inhalt

<Toc mode="all" minDepth="1" maxDepth="1" columns="2" listClass="!list-none !pl-0" />

<div class="mt-6 text-sm opacity-60">

Companion-Talk: <TalkXref slug="20260327-ai-agents">Coding-Agents im Alltag</TalkXref> — Tool-Auswahl, Permissions und Praxis. Dieser Deep-Dive zeigt, wie der Loop intern funktioniert.

</div>

---
layout: section
---

# 1. Grundlagen

---
layout: center
hideInToc: true
---

# Eine While-Schleife — das ist alles.

<div class="text-lg opacity-70 mt-4">

Alle modernen Coding-Agenten folgen demselben Grundprinzip:<br/>
**Eine Loop, die ein LLM aufruft, Tool-Calls erkennt, ausführt, zurückfüttert — und wiederholt.**

</div>

<div class="text-sm opacity-50 mt-8">

Weder Router noch Classifier steuern den Ablauf — **das Modell entscheidet**, wann es fertig ist. (Der Classifier im Auto-Modus prüft nur, ob eine Aktion erlaubt ist.)

</div>

---
hideInToc: true
---

# Der Agent-Loop

<AgentLoopCode />

<div class="mt-4 text-sm opacity-70">

- Die Loop endet regulär, wenn das Modell **keinen Tool-Call** mehr ausgibt
- Bei Claude Code heißt diese Loop `queryLoop()` (`src/query.ts`)
- Der Harness muss nur die Infrastruktur bereitstellen — das Modell orchestriert

</div>

<!--
Regulär endet die Loop, wenn das Modell keinen Tool-Call mehr ausgibt
(Agent-SDK-Doku: „Turns continue until Claude produces output with no tool
calls, at which point the loop ends“). Vorzeitig beenden sie Turn- und
Budget-Limits, Stop-Hooks, ein Abbruch durch den User oder ein Fehler.
`queryLoop()` kennt dafür zehn Terminal-Gründe, darunter `max_turns` und
`stop_hook_prevented` (inoffizielle Analyse des geleakten Codes).
Quelle: https://code.claude.com/docs/en/agent-sdk/agent-loop.md, geprüft 24.11.2026.
-->

---
hideInToc: true
---

# Harness vs. Framework vs. Modell

<div class="grid grid-cols-3 gap-6 mt-4">
<div class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">

### Modell

Das LLM (z. B. Claude Opus 5.5, GPT-6.2 Astra, Gemini 4 Carbon; Stand 11/2026).

Macht das **Reasoning**. Durch RL auf Tool-Use trainiert.

**Hier steckt der Großteil der Intelligenz.**

</div>
<div class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">

### Harness

Der dünne Wrapper (Claude Code, Pi, Codex CLI).

Gibt dem Modell Tools und führt den Agent-Loop aus.

**Je weniger Logik, desto besser.**

</div>
<div class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">

### Framework

Höhere Abstraktionsebene (LangChain, CrewAI).

Anthropic warnt: Frameworks verdecken oft die eigentlichen Prompts und Antworten.

**Trend: verliert an Relevanz.**

</div>
</div>

<!--
Framework-Warnung als Paraphrase. Wörtlich, über Frameworks: „However, they
often create extra layers of abstraction that can obscure the underlying
prompts and responses, making them harder to debug.“
Quelle: Anthropic, „Building effective agents“, geprüft 24.11.2026.
-->

---
hideInToc: true
---

# Agent-Loop im Detail <span class="text-sm font-normal opacity-60">— Schnelldurchlauf: jedes Detail bekommt gleich sein Kapitel</span>

<AgentSimulation />

---
layout: center
hideInToc: true
---

# Woher wissen wir das alles?

<div class="text-lg opacity-80 mt-4">

**31. März 2026:** Eine 59,8-MB-Source-Map landet versehentlich in npm —<br/>
**512K Zeilen** Claude-Code-TypeScript, im Klartext.

</div>

<div class="text-sm opacity-50 mt-8">

Interne Namen (`queryLoop`), Schwellwerte und Zeilenzahlen in diesem Talk stammen aus diesem Leak — **Details in Kapitel 8.**

Zweite Quelle: ein **Logging-Proxy an der API-Grenze** (Systima, 07/2026) — der Leak zeigt den Code, der Proxy die tatsächlichen Payloads. **Messwerte in Kapitel 8.**

</div>

---
layout: section
---

# 2. Tokens

---
clicks: 4
hideInToc: true
---

# Was ist ein Token?

<TokenBasics :clicks="$clicks" />

<!--
Stand 24.11.2026. Vokabulargröße je nach Modell: OpenAI cl100k_base rund
100.000, o200k_base rund 200.000 (tiktoken, openai_public.py); Llama 3.1
128.256, DeepSeek-V3 129.280, Qwen3 151.936 (vocab_size in config.json auf
Hugging Face).
-->

---
hideInToc: true
---

# Autoregression: ein Token nach dem anderen

<AutoregressiveDemo />

<!--
Sampling-Methoden hier = Baseline. Min-p (im Demo) ist der aktuelle Kontrast:
Schwelle = min_p · p_max — wandert mit der Konfidenz (scharf → wenige Token,
flach → viele), statt fester Masse wie Top-p. (Nguyen et al., ICLR 2025,
arXiv:2407.01082; min_p ~0.05–0.1; breit unterstützt in HF/vLLM/SGLang/llama.cpp/
Ollama, Default nur llama.cpp; Überlegenheit umstritten: arXiv:2506.13681.)

Praxis-Faustregeln 2025/26 (keine kanonische Vorgabe):
- Open-Weight / lokal: Temperature + Min-p
- Kommerzielle APIs: Temperature + Top-p (v.a. weil Min-p dort fehlt)
- Reasoning-Modelle: Defaults lassen — DeepSeek-R1 empfiehlt temp 0.5–0.7 (0.6),
  kein System-Prompt; OpenAI o-Serie / GPT-5 verbieten temp/top_p (fix)
- Deterministische Evals: greedy (temp=0) — auf GPU nicht bit-genau reproduzierbar
- Format-Zwang: Constrained Decoding oben drauf

Constrained Decoding = Logit-Maskierung, kein freies Sampling: ungültige Token
werden vor dem Sampling auf −∞ gesetzt → gesampelt wird nur über schema-gültige.
- XGrammar (mlc-ai): Default in vLLM (seit v0.6.5, Dez 2024) & SGLang, in
  TensorRT-LLM opt-in. Pushdown-Automat + adaptiver Token-Mask-Cache;
  < 40 µs/Token für JSON (arXiv:2411.15100, MLSys 2025).
- llguidance (aus MS Research, jetzt guidance-ai): OpenAI nutzt es für den
  Grammar/Custom-Tools-Pfad (Lark); JSON-Schema-Modus laut Maintainer seit Mai 2025.
- Outlines (dottxt-ai): popularisierte den FSM/Regex-Ansatz (Willard & Louf 2023,
  arXiv:2307.09702) — O(1) pro Token, aber teure Index-Compile-Zeit bei
  komplexen Schemata.
-->

---
hideInToc: true
routeAlias: kontext-hygiene
---

# Kontext-Hygiene: Signal statt Rauschen

<ContextHygiene />

<!--
Auf der letzten Folie hat das Modell eine Verteilung über das nächste Token berechnet. Diese Verteilung hängt nur vom Kontext ab. Hier messen wir, wie stark.

Wir sehen Java-Code mit nummerierten Messstellen. Ich beginne mit der Kontrollgruppe, dem sauberen Code. Ein Klick auf eine Stelle zeigt die Top-5-Tokens und rechts, was Luna, Sol und Terra wählen. Mit dem Slider mache ich den Code schrittweise schlechter. Die Kommentare sind nur für uns, das Modell hat sie nie gesehen.

Ein Beispiel aus `warehouse`: Mit fachlichen Namen setzt Sol `base` fort, mit P von 1,000. Mit technischen Namen wie `handle` und `input` fällt Sol auf 0,837 und Terra auf 0,589. Diese Stelle habe ich nachträglich ausgesucht, sie illustriert nur.

Der Beleg steht in der Studie: Je Stufe der Namens-Leiter sinkt der logit bei Terra um 0,30 und bei Sol um 0,24. Der Effekt sitzt an Stellen, an denen ein Fachname kommt. An Boilerplate ändert sich kaum etwas. Klare Namen sind Signal, schlechte Namen sind Rauschen. Das deckt sich grob mit dem, was wir aus dem Software Engineering kennen.

Nicht jeder Schritt fällt. Beim Big Ball of Mud, von S3 nach S4, wird das Modell wieder sicherer, und wir wissen nicht, warum. Dazu kommen nur drei Modelle und ein Korpus, den eine KI geschrieben hat.

Kontext entscheidet also über die Qualität. Er kostet aber auch Tokens, und Tokens kosten Geld. Darum geht es auf der nächsten Folie: Hardware gegen Preisliste.
-->

---
hideInToc: true
---

# Hardware vs. Preisliste

<div class="grid grid-cols-2 gap-6 text-sm">
<div>

### Was die Hardware macht

- **Prefill**: alle Input-Tokens **parallel**, ein Forward-Pass — Rechenwerke voll ausgelastet (**compute-bound**)
- **Decode**: **ein Token pro Durchlauf**, seriell — jeder Schritt liest Gewichte + kompletten **KV-Cache** aus dem Speicher (**memory-bound**)
- Der KV-Cache wächst mit dem Context → **jedes weitere Token kostet mehr** Bandbreite & VRAM als das vorige

</div>
<div>

### Was die Preisliste macht

| Sonnet 4.6 | Preis/MTok      |
| ---------- | --------------- |
| Input      | $3.00           |
| **Output** | **$15.00 (5×)** |

- Die **5×-Asymmetrie ist Physik**: seriell erzeugter Output bindet die Hardware um Größenordnungen länger als parallel gelesener Input
- **Flat pro Position ist Mischkalkulation**: Token Nr. 900.000 wird wie Token Nr. 1.000 berechnet — kurze Requests subventionieren lange

</div>
</div>

<div class="mt-3 px-3 py-2 border-1.5 border-amber-500 rounded-lg text-sm [&>p]:!my-0" style="background: rgba(245,158,11,0.08)">

**Die Ausnahme beweist es:** Gemini 3 Pro staffelt oberhalb 200K Context ($2→$4 Input, $12→$18 Output). Anthropics 1M-Beta nahm 2×/1,5× — seit Opus 4.7/Sonnet 4.6 ist 1M flat. Gestaffelt wird, **weil** die Hardware-Kosten mit der Kontextlänge real steigen.

</div>

<!--
Faktencheck-Belege (Stand 2026-07-16):
- Prefill compute-bound (~200–500 FLOP/Byte), Decode memory-bandwidth-bound
  (~1–2 FLOP/Byte): arXiv:2512.22066 (Prefill vs. Decode Bottlenecks),
  SARATHI arXiv:2308.16369. „Output tokens cost more than input tokens
  because of physics, not margin."
- Flat pro Position — Anthropic-Pricing-Doku wörtlich: "A 900k-token request
  is billed at the same per-token rate as a 9k-token request."
  (platform.claude.com/docs/en/about-claude/pricing, Long context pricing)
- Gemini 3 Pro: ≤200K → $2/$12, >200K → $4/$18 pro MTok; die ganze Anfrage
  springt in den teuren Tier (ai.google.dev/gemini-api/docs/pricing).
- Anthropic 1M-Beta (context-1m-2025-08-07, Sonnet 4/4.5): 2× Input / 1,5×
  Output oberhalb 200K. Seit Opus 4.7 / Sonnet 4.6 / Fable: 1M flat.
- Preisreferenz: Sonnet 4.6 $3/$15 · Opus 4.8 $5/$25 · Haiku 4.5 $1/$5 —
  Output durchgängig 5× Input.
-->

---
clicks: 5
hideInToc: true
---

# Ein Bugfix, Token für Token

<div class="text-sm opacity-70 mb-1">

Zwei Dateien lesen, Bug fixen — der Context wächst mit **jeder** Iteration, wird komplett neu mitgeschickt und komplett neu **als Input abgerechnet**.

</div>

<TokenAccumulation :clicks="$clicks" />

<!--
Abrechnungs-Belege (Stand 2026-07-16):
- Thinking-Tokens = Output-Tokens, voll bezahlt auch bei display:
  summarized/omitted — Anthropic Extended-Thinking-Doku: "You're charged
  for the full thinking tokens generated by the original request, not the
  summary tokens."
- Tool-Use-Schleife: Thinking-Blöcke müssen unverändert zurückgereicht
  werden; das signature-Feld trägt das verschlüsselte volle Thinking, der
  Server entschlüsselt es — die Tokens zählen als Input ("only bills for
  the input tokens for the blocks shown to Claude").
- Multi-Turn: Opus 4.5+ / Sonnet 4.6+ behalten Thinking-Blöcke im Kontext
  (zählen als — meist gecachte — Input-Tokens); ältere Modelle strippten
  sie zwischen User-Turns.
- OpenAI analog: Reasoning-Tokens "are billed as output tokens"; bei
  store=false wandern encrypted reasoning items als Input zurück.
- Kostenrechnung der Summenbox (Sonnet 4.6): ~55K Input × $3/MTok ≈ $0,17;
  ~8K Output × $15/MTok ≈ $0,12. Mit ~85 % Cache-Reads: Input ≈ $0,05.
  Segment-Zahlen: Vorrunden-Output = Denken ~2.000 + Tool-Call ~100 bzw.
  Diff ~1.500; Rest = Tool-Ergebnis (Datei/Erfolg).
-->

---
layout: section
---

# 3. Tool-Use & Token-Ökonomie

---
hideInToc: true
---

# Tool-Use: Wie funktionieren Tool-Calls?

<div class="grid grid-cols-2 gap-8">
<div>

### Der Ablauf

1. **Tool-Definitionen** als JSON-Schema im Request-Prefix (separates `tools`-Array)
2. Modell generiert strukturiertes JSON (`tool_use`-Block)
3. Harness **parst** Funktionsname + Parameter
4. Harness **führt aus** (lokal oder via **MCP**, dem Standard-Protokoll für externe Tool-Server)
5. Ergebnis als `tool_result` zurück ans Modell

</div>
<div>

### Die Design-Entscheidung

| Agent           | Tools  | Philosophie            |
| --------------- | ------ | ---------------------- |
| **Pi**          | **4**  | "Bash is all you need" |
| Codex CLI       | ~16    | Shell-zentrisch        |
| Gemini CLI      | ~19    | Mittlerer Weg          |
| **Claude Code** | **52** | Fein-granular          |

**Jedes geladene Tool kostet bei jedem Request Tokens. Tool Search lädt Definitionen erst bei Bedarf.**

</div>
</div>

<!--
Stand 24.11.2026.
- Claude Code: 52 eingebaute Tools laut Tools-Referenz
  (code.claude.com/docs/en/tools-reference.md; 53 Zeilen, TaskOutput ist
  entfernt). Viele davon nur bedingt verfügbar: Glob und Grep fehlen
  standardmäßig auf macOS, Linux und WSL, TodoWrite ist standardmäßig aus,
  andere lädt ToolSearch erst bei Bedarf.
- Codex CLI: ~16 Tool-Handler im Quellcode (rust-v0.172.0). Welche davon
  das Modell sieht, hängt von Konfiguration und Feature-Flags ab: ein Test
  in openai/codex (prompt_caching.rs) erwartet 7 bis 8 Tools, darunter
  exec_command, write_stdin, apply_patch, view_image, request_user_input,
  web_search und tool_search, update_plan nur optional.
- Gemini CLI: 19 Standard-Tools laut docs/reference/tools.md, ohne die sechs
  experimentellen tracker_*-Tools.
- Tool Search: In Claude Code für MCP-Tools Standard; zum Sitzungsstart laden
  nur Namen und Server-Instruktionen (code.claude.com/docs/en/mcp.md).
  Anthropic und OpenAI bieten dasselbe per `defer_loading`. Bei OpenAI sieht
  das Modell bei einer einzelnen zurückgestellten Funktion weiter Name und
  Beschreibung; zurückgestellt wird vor allem das Parameter-Schema.
-->

---
hideInToc: true
---

# Tool-Definitionen: Provider-Vergleich

<ToolDefinitions />

<!--
Stand 24.11.2026.
- OpenAI: Das Beispiel zeigt das Format der Chat Completions API. Die
  empfohlene Responses API nimmt ein flaches Objekt ohne `function`-Hülle:
  `{"type": "function", "name": …, "description": …, "parameters": {…},
  "strict": true}` (developers.openai.com, Function Calling).
- Strict Mode ist kein Alleinstellungsmerkmal von OpenAI mehr: Anthropic
  erzwingt mit `strict: true` das Schema per Grammar-Constrained Sampling,
  verfügbar auf jedem Modell (platform.claude.com, strict-tool-use).
- Gemini: `parameters` ist ein OpenAPI-Subset; `default` wird angenommen,
  aber ignoriert, `oneOf` fehlt. Alternativ `parametersJsonSchema` mit JSON
  Schema, aber auch nur als Subset. Im Modus `any` können sehr große oder
  tief verschachtelte Schemas abgelehnt werden (ai.google.dev, Function
  Calling, Notes and limitations).
-->

---
clicks: 13
hideInToc: true
---

# Der User wartet, die Tools antworten

<div class="text-sm opacity-70 mb-1">

Eine Frage, vier Requests: Jedes Tool-Ergebnis startet die nächste Runde, ohne den User.

</div>

<ToolLoop :clicks="$clicks" />

<!--
Gleiches Szenario und gleiche Zahlen wie auf der Folie „Ein Bugfix, Token für Token“. Der schraffierte tools-Marker ist nicht maßstäblich: Keine Quelle der Folien trennt das tools-Array vom System-Prompt (4.000 Tokens); die Größen folgen auf den nächsten Folien (MCP: 17K–126K). Dateinamen und Tool-Parameter sind Beispiele, die IDs `toolu_01` bis `toolu_03` sind gekürzt.

Ablauf: Jeder Klick schaltet genau ein Ereignis weiter, nichts läuft von selbst ab. Die zwölf Ereignisse kommen in dieser Reihenfolge: die Frage, Request 1, Tool-Aufruf, Tool-Ergebnis, Request 2, Tool-Aufruf, Tool-Ergebnis, Request 3, Tool-Aufruf, Tool-Ergebnis, Request 4 und die Antwort. Klick 13 zeigt die Kosten. Der ▶-Knopf in der Leiste der Komponente spielt auf Wunsch automatisch weiter, etwa beim Nachlesen. Ein Klick auf ein Kästchen zeigt unten, was an dieser Stelle übertragen wird.

Das Tool antwortet nicht dem Modell. Das Harness führt das Tool aus und schickt das Ergebnis im nächsten Request mit, als `tool_result`-Block in einer Nachricht der Rolle `user`. Deshalb steht im Detail-Kasten „Tool → Harness“ und nicht „Tool → Modell“. Die Schleife endet, wenn die Antwort keinen `tool_use`-Block mehr enthält.

Quellen, alle abgerufen am 22.11.2026:

- Schleife mit `tool_use` und `tool_result`, Ergebnis in einer `user`-Nachricht: <https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls> („Add a `user` message with one `tool_result` block for each `tool_use` block“) und <https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works> („Repeat from step 2 while `stop_reason` is `"tool_use"`“).
- Endpunkt `POST /v1/messages`: <https://platform.claude.com/docs/en/api/messages/create>
- `tools`-Array mit `name`, `description` und `input_schema`: <https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools>
- Claude-Code-Tools `Read` (`file_path`) und `Edit` (`file_path`, `old_string`, `new_string`): <https://code.claude.com/docs/en/tools-reference> und <https://code.claude.com/docs/en/agent-sdk/typescript> (Typen `FileReadInput` und `FileEditInput`).
- Namensschema `mcp__<server>__<tool>` für MCP-Tools in Claude Code: <https://code.claude.com/docs/en/permissions> („To match one tool, write its full name, `mcp__<server>__<tool>`“).
- GitHub-MCP-Tool `get_file_contents` mit `owner` und `repo` (Pflicht) und `path`: README von <https://github.com/github/github-mcp-server>. Der Servername `github` im Beispiel ist der Name, unter dem der Server in Claude Code eingetragen ist.
-->

---
hideInToc: true
---

# Wie viele Tools braucht ein Agent?

<div class="text-sm opacity-70 mb-1">
Pi's 4 Tools (Read/Write/Edit/Bash) genügen — weil das Modell weiß, was `rg`, `find`, `curl` tut.

</div>

<ToolCountBar />

---
hideInToc: true
---

# Tool-Selection-Accuracy

<div class="text-sm opacity-70 mb-1">

Ab etwa 30–50 Tools wählt Claude schlechter. Anthropic's **Tool Search Tool** hebt die Trefferquote deutlich — mehr dazu am Ende dieses Kapitels.

</div>

<ToolAccuracyLine />

<!--
Die Markierung bei 49 % stammt aus Anthropics internen MCP-Evaluationen mit „large tool libraries“; eine Tool-Zahl nennt die Quelle nicht. Opus 4 stieg mit Tool Search von 49 % auf 74 %, Opus 4.5 von 79,5 % auf 88,1 %. Quelle: <https://www.anthropic.com/engineering/advanced-tool-use>, geprüft 24.11.2026.

Die Schwelle 30–50 Tools nennt die Tool-Search-Doku: „Claude's ability to pick the right tool degrades once you exceed 30–50 available tools.“ Quelle: <https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool.md>, geprüft 24.11.2026. Tool Search löst das Problem nicht vollständig, es verbessert die Auswahl.
-->

---
clicks: 1
hideInToc: true
---

# MCP Token-Bloat

<div class="text-sm opacity-70 mb-1">

MCP-Server kosten geschätzt **17K–126K Tokens** (Spitze: Gateway für mehrere Server) — ohne Tool Search bei **jedem** Request. Claude Code lädt Definitionen standardmäßig erst bei Bedarf. Praxis-Sicht: <TalkXref slug="20260327-ai-agents">Coding-Agents im Alltag</TalkXref>.

</div>

<McpTokenBar />

<!--
Ohne Tool Search schickt der Client die vollständigen Tool-Definitionen bei jedem Request mit. Claude Code hat Tool Search standardmäßig an: Zu Sessionbeginn lädt es nur Tool-Namen und Server-Instructions und holt Definitionen bei Bedarf nach. Vorab laden alle Tools nur mit `ENABLE_TOOL_SEARCH=false`, `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS`, HIPAA-Konfiguration, Azure-Foundry-Deployments und Modellen vor Opus 4 bzw. Sonnet 4. Quelle: <https://code.claude.com/docs/en/mcp.md>, geprüft 24.11.2026.

Der Balken „GitHub (93 Tools)“ mit ~55.000 Tokens ist eine Drittschätzung ohne offengelegte Methode (<https://dev.to/kenimo49/your-mcp-server-eats-55000-tokens-before-your-agent-says-a-word-i-measured-the-real-cost-19l8>). Eine tiktoken-Zählung (o200k_base) ergibt für 86 Tools 14.406 Tokens (<https://policylayer.com/token-cost/github>). Die beiden GitHub-Balken stammen aus unterschiedlichen Quellen und Methoden.

Der Höchstwert 126K stammt nicht von einem einzelnen Server, sondern vom Docker MCP Gateway (Eintrag `MCP_DOCKER`), das mehrere Server bündelt: 135 Tools, ~125.964 Tokens laut `/doctor` in Claude Code 2.0.50, Einzelbericht vom 24.11.2025 (<https://github.com/anthropics/claude-code/issues/12241>). Das Gateway bietet inzwischen Dynamic MCP (`mcp-find`/`mcp-add`) und holt Server erst bei Bedarf in die Sitzung.

MySQL: neverinfamous/mysql-mcp mit 106 Tools, Stand 12/2025 (<https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1978>). Neuere Versionen haben mehr Tools, v2.0.0 191 und v5.x laut Changelog etwa 242; für sie gibt es keine gemessene Tokenzahl.

Kosten nach Klick: $5/MTok Input für Claude Opus 4.6, ohne Prompt Caching. Mit Cache-Hit kostet Input $0,50/MTok, 126K Tokens also ≈ $0,06 statt $0,63 pro Request. Quelle: <https://platform.claude.com/docs/en/about-claude/pricing.md>, geprüft 24.11.2026.
-->

---
hideInToc: true
routeAlias: token-oekonomie
---

# Skills vs MCP: Faktor 10–260×

<div class="text-sm opacity-70 mb-1">
Skills: ~100 Tokens Frontmatter pro Skill. MCP ohne Tool Search: volle Tool-Definitionen bei jedem Request; Claude Code und Codex CLI laden sie standardmäßig erst bei Bedarf. Skills in der Praxis: <TalkXref slug="20260327-ai-agents">Coding-Agents im Alltag</TalkXref>.

</div>

<SkillsVsMcpLine />

<!--
Stand 24.11.2026. Skills: ~100 Tokens pro Skill für name und description aus
dem Frontmatter (Anthropic-Doku Agent Skills, Spezifikation agentskills.io).
MCP: ~1K bis ~26K Tokens Tool-Definitionen pro Server; die Kurve rechnet mit
~11K pro Server (Anthropic-Beispiel: 5 Server ≈ 55K). Spitze: GitHub mit 35
Tools, ~26K. Daraus der Faktor 10–260× (1K bzw. 26K gegen 100).
Die Kurve gilt nur ohne Tool Search. Claude Code stellt MCP-Tools
standardmäßig zurück und lädt sie bei Bedarf; Codex CLI nutzt Tool Search
standardmäßig seit v0.142.2 (25.06.2026).
-->

---
hideInToc: true
---

# MCP Token-Bloat: Wer löst das Problem?

<div class="text-sm opacity-70 mb-1">
5 von 6 Agents (83 %) laden MCP-Tools inzwischen automatisch nach Bedarf. Nur Gemini CLI filtert noch manuell (includeTools/excludeTools).

</div>

<McpOptTable />

<!--
Stand 24.11.2026. Codex CLI: Tool Search für MCP-Tools standardmäßig seit
rust-v0.142.2 (25.06.2026). OpenCode: Code Mode ist Standard, MCP-Tools liegen
in einem Katalog und laufen über execute; codemode: false schaltet pro Server
zurück. Pi: MCP seit Ende September 2026 im Kern (Ankündigung 29.09.2026),
Codemode lädt automatisch, sobald MCP konfiguriert ist. Gemini CLI: nur
includeTools/excludeTools.
Reduktion: Claude Code „über 85 %“ laut Anthropic-Doku (Tool Search Tool);
BM25 und Regex sind die beiden Varianten des API-Tools. Cursor: −46,9 %
Gesamt-Tokens des Agents in Läufen mit MCP-Aufruf, A/B-Test, hohe Varianz je
nach Zahl installierter MCPs (Cursor-Blog, 06.01.2026). Das misst keine
Schema-Tokens und ist mit dem Claude-Code-Wert nicht direkt vergleichbar.
-->

---
hideInToc: true
---

# Claude Code ToolSearch: Stand der Technik

<div class="text-sm opacity-70 mb-1">
Standardmäßig sind alle MCP-Tools deferred; die 10-%-Schwelle (seit v2.1.7) gilt nur noch mit ENABLE_TOOL_SEARCH=auto. Bash, Read, Edit laden immer vorab.

</div>

<ToolSearchImpact />

<div class="mt-4 text-sm opacity-60">

Drittanbieter: Atlassian **mcp-compressor** (bis 97% Reduktion, 2–3 Meta-Tools) · Speakeasy Dynamic Toolsets (bis 160×) · ToolHive MCP Optimizer (bis 85%).

</div>

<!--
Stand 24.11.2026: Seit Claude Code v2.1.7 (Jan 2026) wurden MCP-Tools
automatisch zurückgestellt, sobald sie mehr als 10 % des Kontexts belegten
(damals über das Tool MCPSearch). Heute stellt Claude Code standardmäßig alle
MCP-Tools zurück und lädt sie bei Bedarf. Die 10-%-Schwelle gilt nur noch mit
ENABLE_TOOL_SEARCH=auto („Threshold mode“), auto:N setzt eine eigene Schwelle.
Wann der Standard wechselte, nennt das Changelog nicht. Auch selten genutzte
Built-ins wie WebSearch und WebFetch sind deferred; Kern-Tools wie Bash, Read
und Edit laden immer vorab. 85 % Reduktion: Anthropic-Beispiel ~77K → ~8,7K
Tokens; das Tool Search Tool selbst kostet ~500 Tokens (API). Accuracy-Zahlen (49→74 %, 79,5→88,1 %) aus Anthropics Tool-Search-
Ankündigung (interne MCP-Evaluationen, Nov. 2025). Drittanbieter-Werte sind
Obergrenzen der Hersteller: mcp-compressor 70–97 % je nach Stufe (Standard
„Medium“ 81 %, 97 % nur „Max“; Atlassian-Blog, 30.03.2026). Speakeasy: bis
160×, im Mittel 91–97 % weniger Input-Tokens; „100x“ ist nur die
Blog-Überschrift. ToolHive: 60–85 % pro Request (Stacklok-Doku, 09.03.2026).
-->

---
layout: section
---

# 4. Context Management

---
hideInToc: true
---

# Context Management

<div class="grid grid-cols-2 gap-8">
<div>

### Die harte Grenze

| Provider    | Context-Window       |
| ----------- | -------------------- |
| **Claude**  | 1M Tokens (Standard) |
| **Gemini**  | 1M Tokens            |
| **GPT-6.x** | 1,05M Tokens         |

Eine produktive Session füllt das **schnell** — Datei-Inhalte, Tool-Ergebnisse, History.

</div>
<div>

### Was füllt den Context?

<ContextAnatomy />

</div>
</div>

<div class="mt-4 text-sm opacity-60">

Gemessen: Ein 85K-Bootstrap (Harness + Config) belegt **8,5% des 1M-Windows**, bei 200K (Opus/Sonnet 4.6 ohne 1M) **>40%** — auf jedem Request, immun gegen Cache-Discounts (Messung: **Kapitel 8**).

</div>

<!--
Stand 24.11.2026. Claude: 1M ohne Beta-Header auf allen aktuellen Modellen; 200K nur noch bei Opus 4.5, Sonnet 4.5, Haiku 4.5 und älter (https://platform.claude.com/docs/en/about-claude/models/overview.md). In Claude Code laufen Opus/Sonnet 4.6 mit 200K, wenn kein 1M-Kontext aktiv ist oder CLAUDE_CODE_DISABLE_1M_CONTEXT=1 gesetzt ist. Bei 1M kompaktiert Claude Code bei ~967K; 85K sind dann ~9% bis zur Compaction (https://code.claude.com/docs/en/model-config.md).

GPT-6.2 Astra/Sol, GPT-6.1 Terra und GPT-6 Luna: je 1.050.000 Tokens; ab 272K Input-Tokens kostet Input doppelt (https://developers.openai.com/api/docs/models/gpt-6.2-sol.md).

MCP: Tool Search ist in Claude Code Default — MCP-Tools werden verzögert geladen, beim Start nur Namen und Server-Instructions (https://code.claude.com/docs/en/mcp.md). Ohne Tool Search laden die vollen Definitionen; Anthropic, 24.11.2025: GitHub ~26K, Slack ~21K, Jira ~17K, 5 Server zusammen 55K.
-->

---
hideInToc: true
---

# Context Compaction

**Claude Code** nutzt drei Strategien:

<div class="grid grid-cols-3 gap-6 mt-4">
<div class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">

### MicroCompact

Lokales Trimmen alter Tool-Outputs

**0 API-Calls**

</div>
<div class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">

### AutoCompact

Bei ~97 % (967K/1M): **Summary ≤20K Tokens**

13K Buffer (Quellcode v2.1.88). Schwelle per `/autocompact` einstellbar. Circuit-Breaker nach 3 Fehlversuchen.

</div>
<div class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">

### Full Compact

Gesamte Conversation komprimieren

Liest bis zu 5 zuletzt geänderte Dateien neu; über 5K Tokens nur als Pfad.

</div>
</div>

<div class="mt-4 text-sm opacity-60">

**Pi**: Kompaktiert standardmäßig automatisch, sobald nur noch 16.384 Tokens frei sind; die letzten ~20K bleiben wörtlich. Dazu manuell `/compact`. Tree-structured Sessions: Beim Zweigwechsel per `/tree` bietet Pi eine Zusammenfassung an.

</div>

<!--
Stand 24.11.2026. AutoCompact: Den 13K-Buffer nennt die Doku nicht; er stammt aus Analysen des geleakten Quellcodes (v2.1.88, März 2026: AUTOCOMPACT_BUFFER_TOKENS = 13_000). Laut Doku kompaktieren 1M-Modelle bei ~967K (~97%); einstellbar per `/autocompact`, autoCompactWindow oder CLAUDE_CODE_AUTO_COMPACT_WINDOW (https://code.claude.com/docs/en/model-config.md). Bei 200K-Window nennt der Quellcode-Leak ~167K (~83 %). Die 20K sind laut Leak die Output-Reserve für die Summary, kein fester Umfang; das Doku-Beispiel hat 1.725 Tokens (https://code.claude.com/docs/en/context-window.md).

Full Compact: Claude Code liest danach bis zu fünf gelesene oder bearbeitete Dateien neu ein, die zuletzt geänderten zuerst; eine Datei über 5.000 Tokens kommt nur als Pfadverweis zurück. Skill-Bodies kommen mit höchstens 5.000 Tokens je Skill und 25.000 insgesamt zurück (context-window.md). Ein Gesamtbudget von 50K für die Dateien nennt nur der Quellcode-Leak, nicht die Doku.

Pi: reserveTokens 16384, keepRecentTokens 20k, Auto-Compaction per Default an, abschaltbar mit "enabled": false (https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/compaction.md).
-->

---
src: ./pages/context-rot-forschung.md
---

---
src: ./pages/context-rot-luna.md
---

---
layout: section
---

# 5. Sandbox, Subagents & Memory

---
hideInToc: true
---

# Sandboxing im Vergleich

| Agent           | Ansatz         | Details                                                                                    |
| --------------- | -------------- | ------------------------------------------------------------------------------------------ |
| **Claude Code** | OS-native      | Seatbelt (macOS), bubblewrap (Linux/WSL2). **Default aus.** Netz nur per Domain-Allowlist. |
| **Codex CLI**   | OS-native      | Seatbelt (macOS), Bubblewrap+seccomp (Linux). Netzwerk default aus.                        |
| **Gemini CLI**  | Multi-Strategy | Docker, Podman, gVisor, LXC/LXD + OS-native. Per-Tool-Isolation.                           |
| **Pi**          | **Keines**     | Guardrails anderer Agents seien meist Security-Theater; besser in einem Container laufen.  |

<div class="mt-4 text-sm opacity-60">

Zusätzlich prüft Claude Code Bash-Befehle AST-basiert: Tree-sitter WASM-Parser, 22 Validators, 9.707 Zeilen, Deny → Ask → Allow. Schwäche: Bei >50 Sub-Commands in einer Pipeline fällt diese Prüfung auf ein einzelnes "Ask" zurück.

Konfigurations- und Permission-Sicht: <TalkXref slug="20260327-ai-agents">Coding-Agents im Alltag</TalkXref>.

</div>

<!--
Stand 24.11.2026. Claude Codes Sandbox erzwingt das Betriebssystem: Seatbelt auf macOS, bubblewrap und socat auf Linux/WSL2. Sie ist standardmäßig aus und wird per `/sandbox` bzw. sandbox.enabled eingeschaltet. Netzwerk läuft über einen lokalen Proxy, der jeden Host gegen die Domain-Allowlist prüft; die ist anfangs leer (https://code.claude.com/docs/en/sandboxing.md). Die AST-Prüfung ist davon unabhängig: Sie entscheidet über Permissions, nicht über Isolation.

Pi: Die Zeile paraphrasiert Mario Zechner, 30.11.2025. Wörtlich: "If you look at the security measures in other coding agents, they're mostly security theater" und "If you're uncomfortable with full access, run pi inside a container or use a different tool if you need (faux) guardrails" (https://mariozechner.at/posts/2025-11-30-pi-coding-agent/).
-->

---
hideInToc: true
---

# Subagents

<div class="grid grid-cols-2 gap-8">
<div>

### Claude Code: AgentTool

- **Tiefe:** bis 3 Ebenen (früher 1)
- **Frische Conversation**; nur ein Fork erbt die Parent-History
- Lädt eigenes System-Prompt und CLAUDE.md
- Nur das **finale Summary** geht zurück an den Parent
- Modi: Standard, Worktree-Isolation, Fork (Default seit v2.1.232; aus: `CLAUDE_CODE_FORK_SUBAGENT=0`)
- **Gemessen:** Fan-out auf 2 Subagents = 121K → **513K Input-Tokens (4,2×)** — jeder liest seinen Bootstrap bei jedem Turn neu

</div>
<div>

### Die Gegenposition

**Pi** hat bewusst **keine Subagents.**

> _"Spawning multiple sub-agents to implement various features in parallel is an anti-pattern […] unless you don't care if your codebase devolves into a pile of garbage."_
>
> — Mario Zechner (30.11.2025)

Stattdessen: Spawn pi-Instanzen via tmux.

</div>
</div>

<div class="mt-4 text-xs opacity-60">

Orchestrierung im Alltag: <TalkXref slug="20260327-ai-agents">Coding-Agents im Alltag</TalkXref> · Deterministische Alternative zu LLM-Subagents: <TalkXref slug="20260522-open-rewrite">OpenRewrite</TalkXref>.

</div>

<!--
Tiefe: bis 3 Ebenen unter der Hauptsitzung. Ohne Fork startet ein Subagent mit frischer Conversation ohne Parent-History; ein Fork erbt sie. Fork-Mode ist im Terminal seit v2.1.232 Default, überall (auch -p, SDK) seit v2.1.302; abschalten mit CLAUDE_CODE_FORK_SUBAGENT=0.

Fan-out 4,2×: Systima, „Claude Code Is Way More Token-Hungry Than OpenCode“ (12.07.2026), Claude Code 2.1.207, Sonnet 4.5, ein Lauf; gezählt sind Input-Tokens (121.000 direkt gegen 513.000 mit zwei Subagents). Die Folgestudie „The Subagent Tax“ (22.07.2026) misst 2,6× (Opus) bis 5,9× (Fable 5) Input-Tokens, und in keinem Fall waren die Subagents schneller. Quellen: systima.ai/blog/claude-code-vs-opencode-token-overhead, systima.ai/blog/subagent-tax
-->

---
hideInToc: true
---

# Memory-Systeme

| Agent       | Datei                           | Hierarchie                                                 |
| ----------- | ------------------------------- | ---------------------------------------------------------- |
| Claude Code | `CLAUDE.md` (sonst `AGENTS.md`) | Managed → `~/.claude/` → Projekt (+ `.local.md`) → Subdirs |
| Codex CLI   | `AGENTS.md`                     | Global → Repo → Subfolder                                  |
| Gemini CLI  | `GEMINI.md`                     | `~/.gemini/` → Projekt → Subdirs                           |
| Pi          | `AGENTS.md` + `SYSTEM.md`       | Global → Eltern-Dirs → CWD; `SYSTEM.md` ersetzt den Prompt |

<div class="mt-4">

> _"We had all these crazy ideas about memory architectures... in the end, we shipped the simplest thing: a file that has some stuff, auto-read into context."_
>
> — Boris Cherny, Head of Claude Code

</div>

<div class="mt-4 text-sm opacity-60">

**AGENTS.md** wird Cross-Tool-Standard (Linux Foundation, 60.000+ Repos); Claude Code liest es nur ohne `CLAUDE.md`.

</div>

<!--
Claude Code liest AGENTS.md erst seit v2.1.277 und standardmäßig nur, wenn keine CLAUDE.md vorliegt. Liegen beide vor, bleibt AGENTS.md still außen vor. Die ~20K Tokens pro Request für eine 72-KB-Datei stammen aus der Messung in Kapitel 8 (Systima, Juli 2026): Claude Code und OpenCode legten je gut 20.000 Tokens pro Request zu. Codex ist nicht gemessen; es kappt AGENTS.md standardmäßig bei 32 KiB.

Pi (configuration.md, earendil-works/pi, abgerufen 24.11.2026): Kontextdateien `AGENTS.md` oder `CLAUDE.md` lädt Pi aus dem Agent-Verzeichnis (global), den Eltern-Verzeichnissen und dem CWD; je Verzeichnis zählt nur eine, `CLAUDE.md` greift nur ohne `AGENTS.md`. `SYSTEM.md` ersetzt den System-Prompt, `APPEND_SYSTEM.md` ergänzt ihn; die Projektdatei unter `.pi/` geht der globalen vor.
-->

---
hideInToc: true
---

# Memory: Kein Ansatz gewinnt klar

<div class="text-sm opacity-70 mb-1">
Bubble-Größe = Token-Kosten. Sweet Spot: oben links. Den höchsten Punkt (Aider Repo Map) hat niemand gemessen.

</div>

<MemoryScatter />

<!--
Die Punkte in diesem Diagramm sind meine eigene Einschätzung, keine Messung. Ich habe sie am 08.04.2026 für die erste Fassung vergeben, ohne Quelle. Am 24.11.2026 habe ich sie an der Literatur geprüft. Keine Quelle bewertet die acht Ansätze auf einer gemeinsamen Skala, aber einzelne Studien widersprechen einzelnen Werten.

Vier Werte habe ich deshalb geändert. CLAUDE.md und AGENTS.md: Effektivität von 8 auf 6, Kosten von 5 auf 6, denn die ETH-Studie misst keinen allgemeinen Gewinn und im Mittel über 20 % Mehrkosten. Skills: Effektivität von 9 auf 5, denn in der Eval von Vercel kamen sie auf höchstens 79 %, AGENTS.md auf 100 %. Aider Repo Map: Kosten von 3 auf 4, denn Prism misst 13 % Mehrkosten gegenüber dem Lauf ohne Memory. Mem0: Kosten von 6 auf 4, denn in SWE-ContextBench kostete es 0,62 $ je Aufgabe, der Lauf ohne Kontext 0,79 $, also ca. 78 %.

Die Belege tragen eine Aussage: Komplexe Memory-Systeme haben sich auf Coding-Aufgaben bisher nicht ausgezahlt. In VibeMemBench lagen 11 von 12 Paarungen (ca. 92 %) nicht über dem Lauf ohne Memory. „Einfach schlägt komplex“ tragen sie nicht, denn Supermemory, Prism und die Embedding-Suche von Cursor zeigen Gewinne, und auch einfache Kontextdateien bringen keinen allgemeinen Gewinn. Vier Werte hat niemand gemessen: MEMORY.md, Session Persistence, MemGPT auf Code und die Effektivität der Aider Repo Map. Auch der höchste Punkt im Diagramm, die Aider Repo Map mit Effektivität 8, ist also ungemessen.
-->

---
layout: section
routeAlias: caching
---

# 6. Cache & Sessions

---
hideInToc: true
---

# KV-Cache: 90% Discount

<div class="grid grid-cols-2 gap-6">
<div>

<CachePricingBar />

</div>
<div class="text-sm">

### Wie funktioniert der Cache?

- Server hasht **Prefix** (Modell + Tools + System-Prompt + History)
- **Nur exakter Prefix-Match** — ein Token Änderung invalidiert alles danach
- TTL: **5 Min** (API-Default) · **1 h** = 2× Write — im Abo fordert Claude Code die Stunde an

### Anthropic Pricing (Sonnet 5)

| Typ            | Preis/MTok        |
| -------------- | ----------------- |
| Base Input     | $2.00             |
| Cache Write    | $2.50 (1.25×)     |
| **Cache Read** | **$0.20 (0.10×)** |

</div>
</div>

<div class="mt-2 text-xs opacity-60">

**Cache-Read: überall 0,1×.** Write: **OpenAI** seit GPT-5.6 ebenfalls **1,25×**, **Google** nur 0,1× — dafür Storage pro Stunde, nächste Slide.

</div>

---
hideInToc: true
routeAlias: opusplan
---

# `opusplan`: Opus plant, Sonnet führt aus

<div class="text-sm opacity-70 mb-1">
Ein Modell-Alias in Claude Code — teure Intelligenz für den Plan, günstige Ausführung für den Rest.

</div>

<div class="grid grid-cols-2 gap-8">
<div>

### Wie es funktioniert

- **Plan-Mode → Opus**, danach **Ausführung → Sonnet** — automatischer Wechsel
- Setzen via `/model opusplan`, `--model opusplan` oder `model`-Setting
- Der Wechsel **tauscht das Modell** — und das Modell ist Teil des Prefix-Hash (vorige Slide). Also **bricht der Wechsel den Cache**: die History wird **einmal** ohne Cache neu gelesen

</div>
<div>

### Warum es sich trotzdem lohnt

- **Sonnet** ist stark genug für die Ausführung — Opus ist dafür oft Overkill
- Der einmalige Cache-Bruch amortisiert sich: der **Plan wird verwendet, nicht weggeworfen**
- Ein guter Plan von einem starken Modell zahlt sich aus — **wenn** das Ergebnis nutzbar ist
- Unterm Strich: **billiger** als Opus durchgängig (−8 % bis −44 %, nächste Folie)

</div>
</div>

<div class="mt-4 text-sm opacity-60">

**Codex**: **kein** automatischer Modell-Split — Wechsel nur manuell, offener Feature-Request [openai/codex#20596](https://github.com/openai/codex/issues/20596). Seit 0.105.0 aber ein automatischer **Effort**-Split: <Link to="codex-effort">übernächste Folie</Link>.

</div>

<div class="mt-2 text-sm opacity-60">

Weitergedacht — Rollen-Routing über Modellfamilien & Harnesse hinweg: <Link to="modell-routing">Kap. 7</Link>

</div>

---
hideInToc: true
clicks: 2
routeAlias: opusplan-wechsel
---

# `opusplan`: Ersparnis & Break-even in Euro

<div class="text-sm opacity-70 mb-1">
Die Behauptung der letzten Folie nachgerechnet — Median-Defaults aus 57 echten Opus→Sonnet-Sessions (30.08.–29.09.2026).

</div>

<OpusplanBreakEven :step="$clicks" />

<div class="text-xs opacity-70 leading-snug mt-1">

„Re-Plan“ = Rückkehr in den Plan-Modus; Worst Case: kalter Cache, 2 volle Brüche (gemessen 12 von 81). Gerechnet mit 1 h — die bekommt die Hauptkonversation in jedem Claude-Abo im Kontingent.<br>
Listenpreise/MTok: Sonnet 5.5 $2/$10 · Opus 5.5 $4/$20 · Read 0,1× (Opus: 0,05×) · Write 1,25× (5 min) / 2× (1 h) · 1 USD = 0,876 €

</div>

<!--
Rechenmodell (components/lib/opusplanMath.ts, per vitest gepinnt, die
Konstanten zusätzlich gegen data/opusplan-sessions/summary.json gehalten):
Kosten je Phase = Output×Out-Preis + Cache-Read×Read-Faktor×In + Cache-Write×
TTL-Faktor×In (1,25× bei 5 min, 2× bei 1 h). Plan-Phase (Median, n=56): 30k
Out, 4,1M Read, 160k Write. Exec: Regler, Defaults = Median je Session
(n=57): 21 MTok Read, 76k Out (der Regler beginnt bei 80k), dazu pauschal
0,0147 MTok Write je MTok Read. Cache-Bruch beim ERSTEN Wechsel: 85 % des
Kontexts (Median, Quartile 79/100 %, alle 57 Sessions über 50 %) — bei 180k
Kontext 0,61 $ ≈ 0,54 €.

Preisbasis: opusplan löst auf der Anthropic-API auf Opus 5.5 (Plan) und
Sonnet 5.5 (Exec) auf (code.claude.com/docs/en/model-config, geprüft
30.09.2026). Opus 5.5 kostet $4/$20 und liest zu 0,05× — Fußnote 2 der
Preisseite — also $0,20/MTok, genauso viel wie Sonnet. Dadurch sitzt die
Ersparnis nur noch in Output ($20 gegen $10) und Cache-Writes ($8 gegen $4),
nicht mehr im Read. Bei den Defaults: Nur Sonnet 7,00 € · Nur Opus 9,61 € ·
opusplan 8,36 € — Ersparnis 1,25 € (−13 %). Break-even bei ~6,3 MTok
Exec-Cache-Read; 46 von 57 Sessions liegen darüber, 11 darunter.

Was die echten Sessions zeigen (data/opusplan-sessions/, 30.08.–29.09.2026,
57 Sessions, 137 Wechsel Opus→Sonnet, 81 zurück; 56 von 57 mit
ExitPlanMode — ob ein Wechsel opusplan oder ein manuelles /model war, sagt
das Protokoll nicht):
- Ersparnis kontrafaktisch (dieselben Tokens zum Preis des Plan-Opus, ohne
  den Bruch des ersten Wechsels): Opus 5 (n=39) Median −44 % (Quartile
  −38/−51), Opus 5.5 (n=17) Median −8 % (−0,1/−11), 12 von 17 billiger.
  Die gepoolten −43 % mischen zwei Preisstände und werden nicht zitiert.
  Die Modellrechnung am Regler-Default (−13 %) liegt im 5.5er-Bereich.
- Die Sonnet-Seite ist jetzt gemessen, nicht mehr abgeleitet. Was sich
  gegenüber der alten Stichprobe (42.802 Requests, 48 Plan-Sessions) ändert:
  Plan-Output 30k statt 100k, Plan-Read 4,1M statt 7M, Bruch 0,85 statt 0,93,
  Exec-Read 21 MTok statt 30, Exec-Out 76k statt 150k. 32 von 57 Sessions
  sind ein einziger Plan→Exec-Durchlauf.
- Vorbehalt: „Nur Opus“ ist kontrafaktisch mit den Sonnet-Tokens gerechnet.
  Braucht Sonnet für dieselbe Aufgabe mehr Tokens oder mehr Anläufe als Opus,
  ist die Ersparnis kleiner — das geben diese Daten nicht her.

Anti-Pattern → Worst Case. 25 von 57 Sessions kehren in den Plan-Mode
zurück (81 Rückkehren, Median 2 je Session, max. 9), 69 von 81 ohne
/compact (85 %). Der Folien-Balken rechnet jede Rückkehr als ZWEI volle
Brüche — erst der Kontext als Opus-Write, dann wieder als Sonnet-Write,
zusammen 1,61 €. Gemessen ist das die Ausnahme: eine Rückkehr schreibt im
Median nur 5k Tokens neu (n=81), nur 12 von 81 schreiben mehr als die
Hälfte des Kontexts; 9 von 80 Rückkehren kommen nach mehr als 60 Minuten
Pause. Grund: beide Modelle halten ihren Cache 1 h warm (100 % der Writes
in den Sessions sind 1-h-Writes), eine Rückkehr liest den alten Eintrag und
schreibt nur das Delta, das das andere Modell angehängt hat. Der Balken ist
also die Obergrenze bei kaltem Cache (beide Caches abgelaufen), nicht der
Normalfall; der Regler heißt deshalb Worst Case. Bei den Defaults (n=2)
steht er bei 11,61 € gegen 9,61 € „Nur Opus“; schon EINE Worst-Case-
Rückkehr (1,63 € mit Re-Plan) frisst die Ersparnis von 1,25 €. Der
Re-Plan-Output ist mit 1k Tokens (Median, n=81) vernachlässigbar — die alte
Annahme von 45k Output galt für einen echten neuen Plan, den die Sessions
so selten zeigen. Den /compact-Rat aus der alten Fassung ausdrücklich NICHT
mehr als Regel verkaufen: er schrumpft bei kaltem Cache beide Brüche, ist
aber selbst eine Cache-Unterbrechung (Schlussfolgerung, nicht gemessen).

TTL-Toggle: Die 1h-TTL ist der Default der Hauptkonversation in JEDEM
Claude-Abo, solange das Kontingent reicht — Pro, Max, Team und
Enterprise gleichermaßen; auf 5 min fällt nur, wer per API-Key,
Usage-Credits oder Cloud-Provider arbeitet (code.claude.com/docs/en/
prompt-caching, „Which TTL each request gets", geprüft 25.08.2026).
Also explizit ansagen: Enterprise-Zuhörer sind gemeint. Gemessen habe
ich mit einem Max-Abo; Enterprise-Seats zahlen Kontingent statt Token,
die Aussage bleibt identisch — Brüche ×1,6 gegenüber 5 min, Break-even
1,8 statt 1,1 MTok. Die
€-Werte sind durchweg das API-Äquivalent. Zwei Enterprise-Feinheiten:
Admins können die TTL org-weit per Managed Settings (promptCacheTtl)
setzen, und über dem Kontingent schaltet Claude Code selbst auf 5 min.

Das Kontingent selbst verschiebt sich gerade: bis 13.09.2026 gilt die
+50-%-Aktion auf die Wochenlimits, ab 14.09. ersetzt Anthropic sie durch
dauerhafte +25 % über der Basis — von heute aus gerechnet also ein Minus
von 17 %. Wer öfter über das Kontingent läuft, fällt entsprechend öfter
auf die 5-min-TTL zurück, und genau dann werden die Cache-Brüche hier
teuer. Ausführlich in den Notes der Folie „Welches Modell wofür?" in
Kapitel 7, dort hängt der Kontingent-Toggle dran.

Vereinfachungen (bewusst): input_tokens
(~90/Request) ignoriert; laufende Exec-Cache-Writes pauschal 0,0147 MTok je
MTok Read statt je Phase gemessen; Re-Plan-Reads nicht bepreist; Kontext beim
Wiedereintritt konstant (Median dort 209k, beim Erst-Wechsel 179k). Die
TTL-Abschnitte oben (1-h-Default, Kontingent-Aktion) sind Stand 25.08.2026
geprüft und hier nicht erneuert; die Sessions bestätigen nur, dass alle Writes
1-h-Writes waren.
-->

---
hideInToc: true
routeAlias: codex-effort
clicks: 8
---

# Codex: `xhigh` plant, `medium` führt aus

<div class="text-sm opacity-70 leading-snug mb-2">Kein Modell-Split wie <code>opusplan</code>, aber ein automatischer <b>Effort</b>-Split seit Codex CLI <b>0.105.0</b> (25.02.2026) — dieselbe Rechnung: <Link to="codex-effort-wechsel">nächste Folie</Link>.</div>

<div class="grid gap-6 items-start" style="grid-template-columns: minmax(0, 360px) 1fr">
<div>

<CodexConfigToml :step="$clicks" />

<div class="text-xs opacity-60 leading-snug mt-2"><b>Von Hand (TUI):</b> erst <code>/model</code> (Modell + Stufe, schreibt <code>model</code> und <code>model_reasoning_effort</code>), dann <code>/plan</code>, dann <code>/model</code> erneut — <b>gleiches Modell</b>, andere Stufe: nur dann fragt Codex „Apply to Plan mode override“ und schreibt <code>plan_mode_reasoning_effort</code>. Nur für die Session: <kbd>Alt</kbd>+<kbd>,</kbd> / <kbd>Alt</kbd>+<kbd>.</kbd>.</div>

<div class="text-xs opacity-60 leading-snug mt-2">Der Effort-Wechsel <b>bricht den Cache</b> wie ein Modellwechsel: <code>reasoning.effort</code> gehört zum Prefix (<a href="https://github.com/openai/codex/issues/35416">#35416</a>). Der Ausweg <code>configuration_update</code> braucht <code>[features] reasoning_effort_override</code> (in Entwicklung, aus) und ein Modell aus Codex' Liste: in 0.160 nur <b>Astra</b> und <b>Sol 6.1</b> — sonst ignoriert Codex den Schalter still. Effort-Faktor: <Link to="effort-falle">Effort-Falle, Kap. 7</Link>.</div>

</div>
<div>

<CodexEffortTui :step="$clicks" style="--ctui-height: 372px" />

</div>
</div>

<!--
Klicks (acht, nur die Klicks laufen im Presenter- und im Publikumsfenster
synchron; die Tipp-Animation läuft je Fenster). Erst der globale Teil, im
Default-Mode: 1 tippt /model, die Slash-Zeile erscheint, dann öffnet sich
„Select Model and Effort“ — GPT-6.1-Sol ist Default (Priorität 1 im
gebündelten Katalog von rust-v0.160.0, seit 0.159.1), das VORIGE GPT-6-Sol
„current“; Reihenfolge und Beschreibungen aus models.json, das Backend kann
live umsortieren. 2 „Select Reasoning Level for GPT-6.1-Sol“, der Cursor
bleibt auf Medium. 3 „Model changed to gpt-6.1-sol medium“ — das schreibt
model UND model_reasoning_effort GLOBAL, links werden beide Zeilen grün (die
Meldung zeigt den Slug, Picker/Header/Status zeigen seit PR #46503 den
Anzeigenamen „GPT-6.1-Sol“). Dann der Plan-Teil: 4 tippt /plan, die
Statuszeile zeigt „Plan mode“. 5 tippt /model erneut — GPT-6.1-Sol ist jetzt
„current“ und BLEIBT gewählt. Das ist der Punkt, an dem Leute scheitern:
Wer hier ein anderes Modell wählt, bekommt KEINEN Dialog, Codex schreibt
model und model_reasoning_effort still global (should_prompt_plan_mode_
reasoning_scope in tui/src/chatwidget/model_popups.rs, rust-v0.156.1:
selected_model != current_model → false; Issue #38236 beschreibt genau
diese Falle). 6 der Cursor wandert von Medium auf Extra high; links ist
plan_mode_reasoning_effort schwach markiert, weil erst der nächste Dialog
entscheidet, ob der Wert dorthin geht. 7 „Apply reasoning change“ — Option
1 „Apply to Plan mode override“ schreibt nur plan_mode_reasoning_effort,
die Zeile leuchtet allein. 8 „Model changed to gpt-6.1-sol xhigh for Plan
mode.“, Statuszeile GPT-6.1-Sol xhigh · Plan mode; links stehen alle drei
geschriebenen Zeilen grün. Zurück (←) nimmt jeden Schritt ohne Animation
zurück. Das Verzeichnis ~/slides ist das dieses Decks — Easter Egg.

Zur Warnung bei reasoning_effort_override (Faktencheck 20.09.2026): Issue
openai/codex#44751 (11.09.2026, offen) — mit dem Flag scheitert in 0.154.0
auf gpt-5.6-luna, -terra und -sol JEDER Turn mit HTTP 400, schon der erste
bei unverändertem Effort; `codex exec` endet mit turn.failed und Exit 1,
nur gpt-6-astra läuft. Ursache: effort_for_configuration_update prüft
use_responses_lite statt einer eigenen Fähigkeit, und die API lehnt das
configuration_update-Item bei den 5.6ern ab. Fix: PR #46530 („Gate
reasoning effort updates on explicit model support“, gemerged 19.09.2026,
neue Modell-Metadaten supports_reasoning_effort_updates) — NACH 0.155.1
(18.09.), also erst in 0.156. „Experimentell“ heißt hier also nicht nur
„bringt vielleicht nichts“ (der Cache bricht trotzdem, s. u.), sondern
„der Harness ist mit den 5.6er-Modellen nicht benutzbar“. Kein Panic, aber
jede Session tot; Workaround laut Issue: Flag aus, neue Session. Nachbau mit dem brainless-Port (MIT,
shared/components/brainless); die Dialogtexte sind wörtlich aus Codex CLI
0.156.1 (fünf Screenshots 23.09.2026) und gegen rust-v0.160.0 gegengelesen,
Modellnamen und -beschreibungen aus models.json von 0.160 (seit 05.10.;
kein neuer Screenshot) bzw. aus den Quellen unten. Seit PR #46503 (18.09.,
in 0.156) zeigen Picker, Reasoning-Titel, Header und Statuszeile
Anzeigenamen („GPT-6.1-Sol“); nur die Ergebnis-Meldungen bleiben beim Slug
(„gpt-6.1-sol“). Der Untertitel „Access legacy models …“ unter „Select
Model and Effort“ ist mit derselben PR weggefallen. Die Fußzeile
variiert seit PR #45831/#46697 je Dialogtyp: „enter select · esc back“
für Modell- und Scope-Dialog, „enter default · s session · esc back“
für die Reasoning-Wahl (ein neuer `s`-Weg für Session-only, siehe
CodexPermissions.vue). Der Dialog in Klick 5 zeigt den Moment VOR dem
ersten Override, die TOML-Zeile ist sein Ergebnis. Die zweite
Beschreibung endet auf „built-in Plan default (medium)“, weil kein
plan_mode_reasoning_effort gesetzt ist: medium ist der fest eingebaute
Plan-Preset-Wert (models-manager/src/collaboration_mode_presets.rs, per
collaborationMode/list an die TUI), unabhängig von model_reasoning_effort
und Modell — der TUI-Test plan_mode.rs belegt genau diese Formulierung.

Nachtrag (Faktencheck 23.09.2026, ÜBERHOLT — siehe Nachtrag vom 05.10.
unten): 0.156.0/0.156.1 sind jetzt stable
(22.09.2026). Der Crash ist weg, aber supports_reasoning_effort_updates
steht dort für JEDES Modell auf false (Default, models-manager/src/model_info.rs,
Fallback-Konstruktor) — auch gpt-6-astra. Codex sendet aktuell also nie
einen configuration_update; jeder Effort-Wechsel bricht den Cache wie vor
dem ganzen Feature, nur crasht nichts mehr. Das Flag kippt erst mit Commit
24462234b2 (PR #47397 „Refresh bundled model metadata and instructions“,
gemerged 23.09.2026 00:07 UTC) auf true, und zwar nur für Astra — das liegt
bereits in rust-v0.157.0-alpha.* (`git compare` bestätigt: Vorfahre von
0.157.0-alpha.11, aber NACH rust-v0.156.1 vom 22.09. 19:51 UTC), in keinem
Stable-Release. gpt-6-sol und gpt-6-luna (neu im Katalog seit PR #47332,
gemerged 22.09. 18:17 UTC) tragen das Flag nirgends — weder in 0.156.1 noch
im aktuellen 0.157-Alpha-Stand. OpenAIs Reasoning-Doku
(developers.openai.com/api/docs/guides/reasoning) sagt seit dieser Woche
„Configuration updates are supported by the GPT-6 model family“ statt „…only
by GPT-6 Astra“ (Wayback-Crawl 20.09. vs. 23.09.) — API-seitig also breiter,
aber Codex' eigenes Client-Gate zieht (Stand 23.09.) nicht nach. GPT-6 Terra
existiert noch nicht (developers.openai.com/api/docs/models/gpt-6-terra
liefert 404, 23.09.2026). Details und die aktualisierten astra-Zahlen: die
eigene „Effort-Falle"-Folie (Kap. 7, gleich nach der Historie).

Nachtrag (Faktencheck 05.10.2026, Codex rust-v0.160.0 vom 01.10., stable;
Quellen im Tag und auf main geprüft, OpenAI-Doku als rohes .md): Der Stand
vom 23.09. ist überholt.

1. Allow-List. Das Gate ist core/src/client.rs,
reasoning_effort_override_enabled() (im Tag L552–556, auf main L559–562):
Feature an UND Provider OpenAI UND model_info.supports_reasoning_effort_
updates. Im gebündelten Katalog (models-manager/models.json) steht das Flag
auf true bei gpt-6-astra und gpt-6.1-sol. gpt-6-sol, gpt-6-luna und die
daybreak-Einträge setzen es nicht (Default false, models-manager/src/
model_info.rs L140); gpt-5.6-*, gpt-5.5 und codex-auto-review tragen
ausdrücklich false. Astra seit 0.157.0 (stabil 25.09., PR #47397 vom 23.09.).
Sol 6.1: PR #49318 (29.09.), im Katalog seit 0.159.1 und dort Default-Modell;
0.158.0 und 0.159.0 kennen es nicht. Terra gibt es bei GPT-6 nicht.

2. „Still ignoriert“ stimmt: Ohne Flag filtert build_responses_request
gespeicherte ConfigurationUpdate-Items aus der Request-Kopie (L896–900),
und der Request-Effort bleibt der gewählte. Meldung gibt es keine; die TUI
benutzt das Flag nirgends (Codesuche über das Repo). Ebenfalls aus sind
Guardian-/Basic-Sessions und Memory-Consolidation (L505–514).

3. Das Feature selbst ist unverändert Stage::UnderDevelopment, default false
(features/src/lib.rs L1726–1731). Ohne [features] reasoning_effort_override
= true bricht der Cache bei JEDEM Modell, auch bei Astra und Sol 6.1 — die
Allow-List ist nur die zweite Hürde. Grenze: Der Live-Katalog des Backends
kann das gebündelte Flag überschreiben; ohne Login nicht geprüft.

4. OpenAI-Doku, 05.10.: reasoning (Abschnitt „Change reasoning mid-
conversation“) „Configuration updates are supported by the GPT-6 model
family in standard, single-agent mode. They change only reasoning effort.“;
prompt-caching „On supported GPT-6 and later models …“. API-seitig also die
GPT-6-Familie, Codex' Allow-List ist enger.

5. Geprüfter Text („Why it works across the entire GPT-6 suite …“): Halb
richtig. „Prior to GPT-6 … changing reasoning.effort altered the hidden
instruction“ gilt auch für GPT-6, sobald man den Request-Parameter ändert —
neu ist nur der Ausweg per configuration_update (Request-Parameter bleibt
gleich, das Item steht im input). „Immediately invalidated“ ist übertrieben:
der statische Prefix bleibt (#35416: 9 984 von ~15 k Tokens), es bricht der
Sitzungsanteil. „GPT-6.1 and future iterations“ ist Spekulation, die Doku
sagt „GPT-6 and later“ und nennt standard und single-agent als Bedingung.
„Astra, Sol or Luna“ stimmt API-seitig für die Familie, in Codex nur für
Astra und Sol 6.1 — und nur mit eingeschaltetem Feature. „KV cache“: OpenAI
spricht von Prompt-Caching und gecachtem Prefix.

6. Nachbau und Beispiel-config.toml dieser Folie zeigen seit 05.10. GPT-6.1-
Sol statt GPT-6-Sol: Sol 6.1 ist Katalog-Default (PR #49318, Priorität 1)
und steht auf der Allow-List. Picker-Reihenfolge und Beschreibungen aus
models.json von 0.160, Dialogtexte aus den 0.156.1-Screenshots (Titel und
Scope-Optionen in 0.160 unverändert gegengelesen). Die toml nennt die
Allow-List als Kommentar (supports_reasoning_effort_updates); im Rechner
steht sie als CONFIG_UPDATE_SLUGS in lib/codexEffortMath.ts.

Versionsbeleg: PR openai/codex#12303 „Improve Plan mode reasoning
selection flow“, gemerged 21.02.2026, erstes Release
rust-v0.105.0 vom 25.02.2026 (Release-Notes nennen #12303/#12307);
0.104.0 vom 18.02. hatte es noch nicht. Davor war der Plan-Effort auf
medium hartkodiert (PR #9980, 27.01.2026: „It's overthinking so much on
high“). Maintainer-Bestätigung: Issue #10033 am 20.03.2026 geschlossen mit
„This is possible with plan_mode_reasoning_effort = "high"“. Diskussion
#10628 („Using different models for Plan vs Execute“, 04.02.2026) ist ein
Nutzer-Vorschlag ohne OpenAI-Beitrag; der Kommentar vom 27.02. beschreibt
den TUI-Weg, der vom 21.08. hält fest: „This only affects the reasoning
effort“. Ein MODELL-Split bleibt offen — #20596 (Fußnote der opusplan-
Folie: Modellwahl vor der Umsetzung) und #19343 (plan_mode_model als
Config-Key, seit 24.04.2026) — die Fußnote der opusplan-Folie stimmt also
weiter, nur für den Effort nicht mehr.

Doku: learn.chatgpt.com/docs/config-file/config-reference —
„Plan-mode-specific reasoning override. When unset, Plan mode uses its
built-in preset default“ (medium). Gültige Werte laut Doku none…xhigh,
der Code nimmt auch max und ultra; Ungültiges reicht Codex durch, die API
antwortet 400. Der Key gilt auch je [profiles.x]. Installiert hier (Stand
23.09.2026, Screenshots): CLI 0.156.1, kennt den Key.

TUI-Beleg (rust-v0.154.0): die Konstanten PLAN_MODE_REASONING_SCOPE_* in
tui/src/chatwidget.rs L184-186, der Dialog in
tui/src/chatwidget/model_popups.rs (Beschreibung L349) — „Apply reasoning
change“ → „Apply to Plan mode override“ („Always use extra high reasoning
in Plan mode.“ — Codex schreibt das Label „extra high“, nicht xhigh) oder
„Apply to global default and Plan mode override“. Der Dialog kommt nur im
Plan-Mode, nur für das aktuelle Modell und nur, wenn die Wahl den
Plan-Effort oder die gespeicherten Defaults ändert
(should_prompt_plan_mode_reasoning_scope, L313-331) — daher die Berichte
„fragt mal, mal nicht“. Ein Modellwechsel im Plan-Mode fragt nicht und
schreibt model und model_reasoning_effort global. Option 1 schreibt
plan_mode_reasoning_effort dauerhaft in die config.toml
(PersistPlanModeReasoningEffort, tui/src/app/event_dispatch.rs); nur
Alt+, / Alt+. (seit PR #18866, 21.04.2026) bleibt im Plan-Mode
Session-lokal. Beim Moduswechsel meldet die TUI „Model changed to
{model} {effort} for Plan mode.“ Desktop-App: #18712 (offen, reproduziert
20.08.2026 mit genau dieser medium/xhigh-Config) — sie ignoriert den Key.

Cache-Beleg: developers.openai.com/api/docs/guides/prompt-caching, Tabelle
„Which settings affect the cached prefix?“, Zeile reasoning.effort: „Can
change model-side reasoning instructions. On supported models, use a
configuration update to change effort while preserving the earlier
prefix.“ Und im Abschnitt zum configuration_update: „Keep the top-level
reasoning.effort at its original value as changing that setting can
rewrite instructions in the hidden system instructions.“ Codex schreibt den Effort
nicht in die Instructions, nur als Request-Parameter (core/src/client.rs
build_reasoning) — der Bruch kommt von OpenAIs verstecktem Prefix.
Rohdaten #35416 (gpt-5.6-luna, ~15k Input): cached fällt bei jedem Wechsel
auf eine NEUE Stufe von 14 080 bzw. 15 104 auf 9 984 — das ist der
sitzungsunabhängige statische Prefix, für den Sitzungsanteil also ein
voller Bruch; Rückkehr auf eine schon benutzte Stufe innerhalb der TTL
bricht NICHT (der alte Eintrag lebt noch). Nicht modelliert, konservativ
gegen den Wechsel. #42996 (Desktop 0.153.4): Hit-Rate 99 % → 12 % / 0 % /
12 % je Wechsel. Bei 180k Kontext ist (180−10)/180 ≈ 0,94 — etwas über dem
BREAK_SHARE 0,85 von opusplan (gemessener Median des ersten Wechsels, n=57);
dieselbe Konstante, also leicht konservativ gegen den Wechsel.

Der Schalter: [features] reasoning_effort_override = true — im Quellcode
Stage UnderDevelopment, default aus, weder im /experimental-Menü noch in
der Doku; einschaltbar per config.toml, Codex warnt dann („Under-
development features are incomplete and may behave unpredictably“,
abschaltbar mit suppress_unstable_features_warning). Er hängt
configuration_update-Items an die History, statt den Prefix zu ändern
(core/src/session/reasoning_effort.rs). In 0.154.0 nur HALB verdrahtet:
der Request-Effort wechselt weiter, der Test in
core/tests/suite/reasoning_effort_override.rs erwartet dort noch
medium,high,high,low — der Cache bricht also trotzdem. Das Pinning
(PR #43795, 08.09.) liegt erst in 0.155.0-alpha. API-Doku
(…/guides/reasoning#change-reasoning-mid-conversation): „supported only by
GPT-6 Astra … in standard, single-agent mode“ (Stand 16.09.; seit 05.10.
„the GPT-6 model family“). Codex' Gate war damals die Responses-Lite-
Fähigkeit (alle Modelle); seit PR #46530 ist es eine eigene Fähigkeit mit
Allow-List — siehe Nachtrag 05.10. Der Schalter „Cache erhalten“ der Folie
codex-effort-wechsel rechnet den Bruch nur für Allow-List-Modelle auf 0 und
ist bei den anderen wirkungslos, wie in Codex.
-->

---
hideInToc: true
routeAlias: codex-effort-wechsel
clicks: 2
---

# Codex: Ersparnis & Break-even in Euro

<div class="text-sm opacity-70 mb-1">
Dieselbe Rechnung wie bei `opusplan` — gleiches Szenario, gleiche Regler (sie sind gekoppelt), nur der Effort wechselt statt des Modells.

</div>

<CodexEffortBreakEven :step="$clicks" />

<div class="text-xs opacity-70 leading-snug mt-1">Preise/MTok (In/Out), 05.10.2026: Astra $10/$50 · Sol 6.1 $2/$10 · Sol 6 $2/$10 · Luna $0,10/$0,50 · Read 0,1× (Sol 6.1: 0,05×) · Write 1,25× · TTL 30 min · 1 USD = 0,876 €. Effort- und Fähigkeitsfaktor: <a href="https://artificialanalysis.ai/leaderboards/models">Artificial Analysis</a>, 01.10.2026</div>

<!--
Klicks wie auf der opusplan-Folie: 1 blendet das Break-even-Chart ein, 2
den Anti-Pattern-Balken. Die vier Szenario-Regler (Kontext, Exec-Read,
Exec-Output, Re-Plans) sind mit der opusplan-Folie GEKOPPELT — wer dort
dreht, sieht es hier, und umgekehrt; so decken beide Rechnungen dasselbe
Szenario ab und die Ersparnisse bleiben vergleichbar. Eine Umrechnung der
Claude-Volumina in Codex-Volumina ist noch nicht definiert (Platzhalter
toCodexSzenario in codexEffortMath.ts).

Rechenmodell (components/lib/codexEffortMath.ts, per vitest gepinnt):
Gleiches Modell in beiden Phasen, nur der Effort wechselt. Kosten je Phase
= Output×Out-Preis + Cache-Read×Read-Preis + Cache-Write×1,25×In, alle
Volumina von der opusplan-Folie (Plan: 30k Out, 4,1M Read, 160k Write;
Kontext 180k; Exec: Regler, 80k Out je 21 MTok Read) × Fähigkeitsfaktor
c = bester Intelligence Index von Opus 5.5 ÷ bester Index des Modells
(Astra 1,09, Sol 6.1 1,11, Sol 6 1,21, Luna 1,51). Ein Index-Verhältnis ist
kein Tokenverhältnis: c ist eine Setzung, bei Luna die gröbste. xhigh =
Faktor f × medium für die GANZE Phase; f ist USD/Task xhigh ÷ USD/Task
medium aus dem Artificial-Analysis-Snapshot vom 01.10.2026 (aaData.ts,
`intelligenceIndexCostPerTask`): Astra 1,50, Sol 6.1 1,84, Sol 6 2,11,
Luna 2,41 — der Regler rundet auf eine Stelle. Cache-Bruch wie bei
opusplan 0,85 × Kontext × Write, aber 1,25× statt 2× (Anthropic 1-h-TTL).
Der Schalter „Cache erhalten“ setzt den Bruch nur für Modelle der
Allow-List auf 0 (Astra, Sol 6.1 — siehe Nachtrag 05.10. auf der Folie
davor); bei Sol 6 und Luna ist er wirkungslos, die Zahlen bleiben gleich,
die Notiz sagt es, und der Knopf steht durchgestrichen.

Umstellung vom 05.10.2026: Vorher rechnete die Folie mit den 5.6-Modellen
(Sol, Terra, Luna) und DeepSWE-Faktoren (Sol 5.6 2,54, Terra 3,63, Luna 6,75);
jetzt die aktuellen GPT-6-Modelle, weil nur Astra und Sol 6.1 überhaupt
einen configuration_update bekommen. Terra entfällt (kein GPT-6 Terra).
DeepSWE führt für diese Modelle nur Astra (74 % pass@1 auf xhigh), AA alle
vier — deshalb AA, wie auf der Pareto-Folie. Die Faktoren sind nicht
dasselbe: ein AA-Task ist ein Eval-Task des Index-Mixes, kein SWE-Task, und
die Effort-Faktoren fallen kleiner aus (Astra 1,50 gegen 1,49 bei DeepSWE,
Sol 5.6 2,35 gegen 2,54, Luna 5.6 5,47 gegen 6,75).

Sol-6.1-Defaults (f 1,8, 21 MTok, 2 Re-Plans): Nur medium 3,91 € · Nur xhigh
7,03 € · Effort-Wechsel 5,14 € · Ersparnis 1,89 € (−27 %) · Bruch 0,37 € ·
Break-even 3,5 MTok Exec-Read · Balken über „Nur xhigh“ ab 3 Rückkehren,
allein die Brüche ebenfalls ab 3. Mit eingeschaltetem Schalter (Allow-List):
Ersparnis 2,26 € (−32 %), Balken über „Nur xhigh“ erst ab 129 Rückkehren —
eine Rückkehr kostet nur noch den neuen Plan (0,02 $).
Stand der Volumina: 30.09.2026 auf die 57 echten Opus→Sonnet-Sessions
umgestellt (data/opusplan-sessions/); vorher die 42,8k-Requests-Mediane.
Die Folie selbst nennt die Vorläufigkeit nur im Badge des Rechners
(geliehene Volumina, geschätzter Faktor); die Rechnung mit dem Fähigkeits-
faktor steht nur hier.
Ersparnis je Modell (jeweils mit eigenem Regler-Faktor): Astra 10,15 €
(−22 %), Sol 6.1 1,89 € (−27 %), Sol 6 5,42 € (−37 %), Luna 0,44 € (−42 %) —
opusplan bei SEINEN Defaults: 1,25 € (−13 %), aus opusplanMath abgeleitet
(OPUSPLAN_REF), nicht abgetippt. Der Euro-Vergleich hinkt, weil die Basen
verschieden teuer sind: „Nur xhigh“ kostet bei Astra 46,86 €, bei Sol 6.1
7,03 €, bei Luna 1,04 €, „Nur Opus“ 9,61 €. Preisneutral ist der Prozentwert
— und da liegen alle vier Codex-Modelle über opusplan (−22 … −42 % gegen
−13 %); nur Luna spart in Euro weniger als opusplan (0,44 gegen 1,25 €).
Der Grund für opusplans geringe Ersparnis ist opusplan, nicht Codex: mit
Opus 5.5 liest Opus so billig wie Sonnet (0,05×), die Ersparnis schrumpft
von −37 % auf −13 %. Die Regler-Fußnote trägt bewusst keine Zahl: sie wäre
nur bei den Defaults wahr, die Balken darüber bewegen sich.

Annahme „Effekt kleiner als bei Claude, weil Codex-Modelle billiger sind
und der Effort weniger ausmacht“ — geprüft, stimmt nur zum Teil: (a) pro
Token kosten Sol 6.1 und Sol 6 ($2/$10) so viel wie Sonnet 5.5, Luna
($0,10/$0,50) weniger, Astra ($10/$50) das 2,5-Fache von Opus 5.5 ($4/$20);
Preise: developers.openai.com/api/docs/pricing, 05.10.2026. (b) Der
Effort-Faktor ist kleiner als bei den 5.6ern, aber nicht klein: 1,5 (Astra)
bis 2,4 (Luna) auf AA, Opus 5.5 liegt dort bei 2,59 (3,46 $ ÷ 1,34 $) — ein
ähnliches Verhältnis wie bei Codex' Sol/Luna, deutlich über Astra. OpenAI
selbst bleibt qualitativ: „Higher reasoning effort can improve results for
complex tasks, but it takes longer and uses more tokens.“ (learn.chatgpt.com/
docs/models). (c) Kleiner ist der Write-Multiplikator (1,25× statt 2×) und,
bei Sol 6.1, der Read (0,05× wie bei Opus 5.5): der einzelne Bruch kostet bei
Sol 6.1 0,37 € gegen 0,54 € bei opusplan; das Rückkehr-Paar liegt mit 0,75 €
weit unter opusplans 1,61 €, weil ohne Modellwechsel kein Opus-Write
anfällt. Gegenläufig: der billigere Read drückt die Ersparnis je MTok —
deshalb liegt der Break-even bei Sol 6.1 mit 3,5 MTok über dem von Sol 6
(1,5) und Luna (1,1), und bei Faktor 1,5 lohnt sich der Wechsel dort erst
ab 5,5 MTok.

f gilt für die ganze Phase, nicht nur den Output. AA liefert nur die Summe
(USD/Task), keine Aufteilung in Reads, Output und Schritte. Die Aufteilung
stammt aus dem DeepSWE-Archiv (data/deepswe/, Board-Stand c55e58f2 vom
03.09.), und dort nur für Astra, das auch auf der Folie steht: xhigh/medium
Kosten 1,49× · Cache-Reads 1,45× · Output 1,45× · Schritte 1,10× — die
Reads wachsen also so stark wie der Output; für die 5.6er (Sol 2,54 · 2,87 ·
2,21 · 1,42, Terra 3,65/4,68/3,37/1,71, Luna 7,10/14,2/5,5/3,0) wachsen sie
stärker. f auf die Reads anzuwenden ist deshalb eher konservativ; nur auf
den Output angewandt gäbe es einen kleineren Wert und eine kleinere
Ersparnis. Offen bleibt: ein Plan→Exec-Split auf einem Modell ist kein
ganzer Benchmark-Lauf, und der Exec-Mix der Folie (Read-Kosten dominieren)
ist nicht der des Index — deshalb „vorläufig“. Und die Leiter ist eine
Obergrenze: medium löst weniger Aufgaben. Auf AA erreicht medium 94 %
(Astra), 92 % (Sol 6.1), 84 % (Sol 6) und 79 % (Luna) des besten Index —
bei Luna und Sol 6 ist die Qualitätslücke also spürbar. Deshalb ist f ein
Regler.

Preise: developers.openai.com/api/docs/pricing, geprüft 05.10.2026
(In/Cached/Write/Out, Standard, kurzer Kontext) — Astra $10/$1/$12,50/$50,
Sol 6.1 $2/$0,10/$2,50/$10, Sol 6 $2/$0,20/$2,50/$10, Luna
$0,10/$0,01/$0,125/$0,50. Read 0,1× (Sol 6.1: 0,05×), Write 1,25×. Die
Sol-Aktion („through November 21, 2026“) gilt nur für gpt-5.6-sol, das hier
nicht mehr steht. prompt_cache_options.ttl kennt nur "30m"; Codex fordert
keine Retention an. Im ChatGPT-Abo zählt das Kontingent, nicht der Preis —
die €-Werte sind wie bei opusplan das API-Äquivalent.

Vereinfachungen (bewusst): input_tokens ignoriert, laufende Exec-Writes
weggelassen (anders als bei opusplan, das sie pauschal mitrechnet — hier
gleicher Preis in beiden Phasen, sie kürzen sich fast raus), Re-Plan-Reads
nicht bepreist, Kontext beim Wiedereintritt konstant. Zusätzlich hier: EIN
Faktor f für Reads und Output; die geliehenen Volumina gelten als
medium-Volumina, auch die der Plan-Phase (der xhigh-Plan liest also
1,8 × 4,1 = 7,4 MTok bei Sol 6.1) — liest man die Plan-Mediane stattdessen
als xhigh-Plan, bleibt die Ersparnis in € gleich, der Prozentwert würde −31 %
statt −27 %; Kontext beim Wechsel fest 180k, also unter der 272k-Schwelle
(2× Input; für GPT-6 nicht eigens geprüft); Rückkehr auf eine bekannte Stufe
innerhalb 30 min bräche nicht (nicht modelliert). Nachtragen, sobald eigene
Codex-Sessions vorliegen: Kontext, Plan-/Exec-Volumina, gemessener Faktor —
dann Konstanten in codexEffortMath.ts ersetzen, Test-Referenzwerte
nachziehen, „vorläufig“ streichen.
-->

---
hideInToc: true
---

# System Prompts: Statisch vs. Dynamisch

<div class="grid grid-cols-2 gap-8">
<div>

### Cache-Optimierung durch Ordering

<PromptOrdering />

Der statische Teil bleibt **über Turns im Cache** — nie über Organisationen hinweg, auf der Claude API sogar je Workspace getrennt.

</div>
<div>

### System-Prompt-Größen

| Agent           | System-Prompt      |
| --------------- | ------------------ |
| **Pi**          | **<1.000 Tokens**  |
| Codex CLI       | Mittel             |
| Gemini CLI      | Mittel             |
| **Claude Code** | **Multi-K Tokens** |

Lehrstück Claude Code: **≤25 Wörter zwischen Tool-Calls, ≤100 in finalen Antworten** — eingeführt am 16.04.2026, zurückgenommen am 20.04.2026: eine Evaluation zeigte 3 % Verlust bei Opus 4.6 und 4.7.

<!--
Der Prompt ist außerdem modell-konditional: an Fable 5 sendet Claude Code 62%
weniger Instruktions-Zeichen als an Sonnet 4.5 (27.787 → 10.526) — Messung und
Details auf der API-Grenze-Slide in Kapitel 8 (dort in der Fußzeile).
-->

</div>
</div>

---
hideInToc: true
---

# Das Session-Resume-Problem

<div class="grid grid-cols-2 gap-8">
<div>

### Was schiefgeht

- **API**-Default: 5 Minuten — Resume nach 6 Min = voller Cache-Write (im Abo fordert Claude Code 1 h an)
- Bug in Claude Code (#42338): Cache wird oft komplett invalidiert
- **Thinking-Signaturen** (kryptografische Marker der Reasoning-Blöcke) werden als Input-Tokens replayed

### Community-Reports

- Einzelne Resumes für **$342**
- 80% der Nutzungsgrenze mit **0 Eingaben**
- 480-Message-Session: **39K Tokens** reine Signaturen = 25% des Payloads

</div>
<div>

### Cache-TTLs im Vergleich

| Provider      | Default  | Max            |
| ------------- | -------- | -------------- |
| **Anthropic** | 5 Min ¹  | 1h (2× Write)  |
| **OpenAI**    | 30 Min ² | fest           |
| **Google**    | 1h       | Konfigurierbar |

Google verlangt **Storage-Kosten**: $0,50–4,50/MTok/h. Min. 32.768 Tokens.

¹ API-Default; Claude Code fordert im Abo-Kontingent 1 h an. ² GPT-5.6+ kennt nur 30 Min, ältere Modelle 5–10 Min bzw. 24 h.

</div>
</div>

<!--
Belege: Cache-Invalidierungs-Bug Claude Code #42338; $342-Resume und
„80 % Limit mit 0 Eingaben" aus Community-Reports (GitHub/Reddit); 480-Message-
Session = 39K Signatur-Tokens aus einem öffentlichen Token-Breakdown.
Default-TTL 5 min, Extended 1 h = 2× Cache-Write. Stand 29.04.2026.
-->

---
hideInToc: true
routeAlias: rewind-fork
---

# Rewind & Fork: die billigen Operationen

<div class="text-sm opacity-70 mb-1">
Einen Pfad verlassen oder verzweigen — ohne den Prefix neu zu bauen.

</div>

<div class="grid grid-cols-2 gap-8 text-sm">
<div>

### `/rewind` — zurück auf einen früheren Turn

- `Esc Esc` oder `/rewind`: **Code**, **Konversation** oder **beides**
- Cache-seitig **gratis**: der gekürzte Verlauf _ist_ der alte Prefix — von jedem späteren Turn **warm gehalten**, über die TTL hinaus
- `/compact` **baut** einen neuen Prefix (voller Write), Rewind **trifft** einen alten
- Im selben Menü: **Summarize from/up to here** — zielgenaues `/compact`, mit dessen Kosten
- Rollt **nicht** zurück: was nur `bash` oder ein Subagent änderte, Symlinks — kein Git-Ersatz

</div>
<div>

### `/branch` — Konversation verzweigen

- Kopiert die History in eine **neue Session-ID**; das Original bleibt unangetastet
- Gleicher Prozess, gleicher Prefix ⇒ der erste Request der Verzweigung **liest aus dem Cache**
- `--fork-session` startet dagegen einen **neuen Prozess**: frischer Git-Snapshot, der Prefix kann kippen
- Praxis: zwei Ansätze aus demselben Kontext, statt zweimal zu erklären
- Nicht verwechseln: `/fork` kopiert in eine **Hintergrund-Session**, `/subtask` startet den **Fork-Subagent** der <Link to="cache-modi">nächsten Folie</Link>

</div>
</div>

<div class="mt-3 text-sm opacity-60">

**Codex**: `Esc Esc` editiert die vorige Nachricht und **forkt** den Chat, `/fork` und `codex fork` verzweigen eine Session — ein Code-Restore wie das Checkpointing fehlt ([#11626](https://github.com/openai/codex/issues/11626), offen).

</div>

<!--
Anschluss an die opusplan-Folie: dort steht /compact als Gegenmittel für
den Worst Case (kalter Cache bei der Rückkehr in den Plan-Mode). Hier die
andere Hälfte — wer den Pfad ganz verlässt,
braucht gar kein /compact. Faustregel ansagen: Compaction ist für
„Kontext ist gut, aber zu groß", Rewind für „Kontext ist falsch".

Die Cache-Aussage steht wörtlich in der Doku (code.claude.com/docs/en/
prompt-caching, „Rewinding the conversation", geprüft 25.08.2026):
„/rewind truncates your conversation back to an earlier turn. The
remaining history is the same content the cache was built from at that
point … so the next request hits the earlier cache entry. Every turn
since then has read through that prefix, which kept the entry warm even
if the original turn was longer ago than the TTL." Genau das ist der
Punkt für die Bühne: der alte Eintrag lebt, weil JEDER spätere Turn
durch ihn gelesen hat — deshalb greift Rewind auch nach Stunden noch.
Der Tip-Kasten derselben Seite empfiehlt Rewind ausdrücklich statt
/compact, wenn man einen Pfad aufgibt. Code-Restore hat laut Doku keine
eigene Cache-Wirkung (Dateien kommen ohnehin erst per Read in den
Kontext).

Ehrlichkeitshinweis zu /branch: dass der erste Request der Verzweigung
aus dem Cache liest, ist ABGELEITET, nicht wörtlich belegt — aus der
Prefix-Regel („any two requests with the same model and prefix read the
same cache") plus der Sessions-Doku: „/branch copies the transcript and
switches the running Claude Code process to write to it". Gleicher
Prozess ⇒ gleicher System-Prompt ⇒ identischer Prefix. Bei
--fork-session in einem NEUEN Prozess gilt das nicht zwingend:
sequenzielle Sessions teilen den Prefix nur, wenn der Git-Snapshot beim
Start passt (Branch + letzte Commits stecken im System-Prompt).

Abgrenzung zur nächsten Folie: dort der Fork-SUBAGENT
(Default seit v2.1.232; /subtask startet ihn von Hand) — ein Kind-Agent
erbt den Parent-Prefix.
Hier verzweigt die eigene Session. Gleiche Idee, andere Ebene.
„Fork" heißt in Claude Code dreierlei: --fork-session (neuer Prozess),
/fork (kopiert die Konversation in eine Hintergrund-Session, man arbeitet
im Original weiter; der Cache des Originals bleibt erhalten; bei
abgeschalteter Agent View startet /fork stattdessen einen Fork-Subagent)
und der Fork-Subagent selbst (/subtask, CLAUDE_CODE_FORK_SUBAGENT).
Quelle: code.claude.com/docs/en/commands, geprüft 24.11.2026.

Summarize from/up to here: praktisch top („die verbose Debug-Strecke ab
hier zusammenfassen, die Anfangsinstruktionen behalten"), cache-seitig
aber ein zielgenaues /compact — neuer, kürzerer Prefix, voller Write.
Nicht als billig verkaufen.

Grenzen einmal laut sagen: Dateien, die NUR bash (rm/mv/cp) oder ein
Subagent geändert hat, kommen NICHT zurück. Hat Claude die Datei vorher
selbst editiert, rollt /rewind auch spätere bash- und Subagent-Änderungen
daran zurück; ein Fork-Skill im Vordergrund wird komplett zurückgerollt
(code.claude.com/docs/en/checkpointing, geprüft 24.11.2026). Symlinks und Hardlinks
werden übersprungen („Restored the code, but skipped N files"), 100
Checkpoints pro Session, 30 Tage Retention. Kein Git-Ersatz.

Codex-Stand am 25.08.2026 gegen learn.chatgpt.com/docs/developer-
commands?surface=cli geprüft: „/fork — Create a branching chat from a
previous point in conversation, preserving the original transcript" und
„Press Esc twice with an empty composer to edit the previous user
message and fork the chat from that point", dazu das Subcommand
`codex fork`. Ein Checkpoint-Restore für Code ist dort nicht
dokumentiert; die Slash-Command-Liste bewegt sich schnell, vor dem Talk
erneut gegenchecken. Issue #11626 ist offen (Stand 24.11.2026); #12558
wurde am 23.02.2026 als Duplikat davon geschlossen, Status „completed“
heißt dort also nicht, dass das Feature kam.
-->

---
hideInToc: true
routeAlias: cache-modi
---

# Claude Code CLI: Drei Modi, drei Cache-Profile

<div class="text-sm opacity-70 mb-1">
Derselbe Harness, drei Cache-Charakteristiken — wer sie kennt, zahlt den Prefix nicht doppelt.

</div>

<div class="grid grid-cols-3 gap-4 mt-2 text-xs">
<div class="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">

### Interaktiv (`claude`)

**TTL: 1 h** (2× Write) im Abo-Kontingent — Pro/Max/Team/Enterprise · **5 min** bei API-Key & Usage-Credits.

Ab März 2026 fielen manche Abos auf 5 min zurück: Client-Bugs plus Server-Experimente (#46829, ein Reporter: ~17 % Mehrkosten).

Wählbar per `promptCacheTtl` (ab v2.1.242); global weiter `ENABLE_PROMPT_CACHING_1H` / `FORCE_PROMPT_CACHING_5M`.

</div>
<div class="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">

### Background-Subagent

**TTL: 5 min**, auch im Abo; ab v2.1.242 per `subagentPromptCacheTtl` 1 h.

Lange Tool-Calls oder verspätete Permission-Prompts → Cache verfällt → voller Cache-Write.

**Fork-Mode** (Default seit **v2.1.232**; aus: `CLAUDE_CODE_FORK_SUBAGENT=0`): Kind erbt Parent-Prefix → **90–97,5 % Discount** (modellabhängig) bei parallelen Subagents.

</div>
<div class="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">

### Pipe (`claude -p`)

Aufrufe im selben Verzeichnis **teilen den Prefix** (System-Prompt, Tools, Projektkontext); nacheinander nur bei gleichem Git-Snapshot.

TTL wie interaktiv. `--resume <id>` / `--continue` lesen den Prefix aus dem Cache.

</div>
</div>

<div class="mt-2 text-xs opacity-60">

Stand verifiziert: 24.11.2026 — Anthropic schaltet Cache-Defaults serverseitig ohne Changelog um.

</div>

<!--
Abo-Zeile am 25.08.2026 gegen code.claude.com/docs/en/prompt-caching
gegengecheckt: 1h gilt für die Hauptkonversation in jedem Claude-Abo im
Kontingent (nicht nur Max), 5 min für API-Key/Usage-Credits/Cloud —
und für Subagents, Workflows und Compaction immer, sofern nicht per
subagentPromptCacheTtl umgestellt.

März-2026-Regression (#46829, geschlossen als not_planned): ab ca.
6.–8. März fielen manche Abo-Nutzer im Haupt-Loop auf 5 min. Ursachen:
ein Fallback bei abgeschalteter Telemetrie (behoben in v2.1.108), ein
Latch im Overage-Zustand (laut Support-Antwort behoben in v2.1.90) und
serverseitige TTL-Experimente; Subagenten bleiben bewusst auf 5 min.
Die Mehrkosten (~17 % gesamt, ~26 % im März) hat ein einzelner Reporter
auf zwei Rechnern gemessen.

TTL selbst wählen (Stand 24.11.2026): Hauptkonversation per
promptCacheTtl bzw. CLAUDE_CODE_PROMPT_CACHE_TTL, alles andere per
subagentPromptCacheTtl bzw. CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL, je 5m
oder 1h, ab v2.1.242 laut Doku (der CHANGELOG führt es unter 2.1.243).
ENABLE_PROMPT_CACHING_1H / FORCE_PROMPT_CACHING_5M (seit v2.1.108)
gelten weiter für beide Töpfe; FORCE_PROMPT_CACHING_5M hat Vorrang vor
allem.

Fork-Discount je Modell (platform.claude.com/docs/en/about-claude/pricing,
24.11.2026): Cache-Hit 0,1× Basis-Input (Standard, 90 %), 0,05× bei
Opus 5.5 und Sonnet 5.5 (95 %), 0,025× bei Fable/Mythos 5.1 und 5.2
(97,5 %).

Fork-Mode: v2.1.117 Opt-in mit
CLAUDE_CODE_FORK_SUBAGENT=1 (in -p/SDK ab v2.1.121), Default interaktiv
seit v2.1.232, in -p/SDK/Desktop/VS Code seit v2.1.302; abschalten mit
=0, /subtask startet einen Fork von Hand (seit v2.1.212).

Subagent-TTL: 1 h per subagentPromptCacheTtl bzw.
CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL (ab v2.1.242), per Frontmatter
experimental.cacheTtl ab v2.1.248; ENABLE_PROMPT_CACHING_1H=1 hebt beide
Töpfe auf 1 h.

Pipe: -p-Läufe liegen im Topf „Main conversation“, also dieselbe TTL wie
interaktiv: 1 h im Abo, 5 min per API-Key. Geteilt wird der Prefix;
neu gebaut wird der Gesprächsteil. Doku: „Sessions you run in parallel in the same directory
build matching prefixes and can read each other's cache." Sequenziell nur
bei gleichem Git-Status-Snapshot beim Start. Die frühere Behauptung
„kein Cache zwischen -p-Aufrufen" samt Beleg OpenClaw #19989 ist
gestrichen: das Issue betrifft keine -p-Wrapper, sondern volatile IDs im
System-Prompt (siehe nächste Folie). Cache-Defaults werden serverseitig
ohne Changelog umgeschaltet — vor jedem Talk gegenchecken. Stand
24.11.2026 (code.claude.com/docs/en/prompt-caching, /sub-agents).
-->

---
hideInToc: true
routeAlias: cache-hygiene
---

# Cache-Hygiene & Batch-Modus

<div class="grid grid-cols-2 gap-6 text-sm">
<div>

### Vier Regeln, damit der Cache greift

1. **Prefix stabil** — volatile Daten (Zeitstempel, IDs) ans **Ende**: System → Doku → History → Metadaten → Frage. Ein Zeitstempel _vor_ der Doku bricht jede Sekunde den Cache (→ Cache-Boundary).
2. **Parameter stabil** — nicht nur der Text zählt: `tool_choice`, `extended_thinking`, Bilder & Tool-Defs invalidieren **still**. Hierarchie `tools → system → messages` — oben kippt alles darunter.
3. **Größe richtig** — Min-Länge je Modell **512** (5.x) bis **4.096** Tok (Opus 4.5/4.6, Haiku 4.5); darunter still ungecacht. Zu groß → Context Rot.
4. **TTL beachten** — jeder Treffer resettet die 5-Min-Uhr **kostenlos**; der 1h-Cache (2× Write) rechnet sich ab dem **2. Treffer**.

</div>
<div>

### Batch-Modus: nochmal −50 %

- Bis **100K Anfragen**, Antwort **≤ 24 h**, 256 MB/Batch
- Rabatt **stapelt multiplikativ** mit dem Cache → Cache-Read nur noch **0,15 $/MTok**
- Ideal für **autonome Hintergrund-Agenten** — nicht für interaktiv/zeitkritisch

<div class="mt-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg text-xs">

**Rechenbeispiel** — 10K-Tok-Systemprompt, 500 Anfragen/h:

ohne Cache **$15,00** → mit Cache **$1,53** → + Batch **$0,77** (bei 100 % Treffern)

</div>

<div class="mt-2 text-xs opacity-60">

Praxis: autonome Dauerläufer in <TalkXref slug="20260707-anatomy-of-autonomous-agents">Anatomie Autonomer Agenten</TalkXref>.

</div>

</div>
</div>

<!--
Quelle: Stefan Wintermeyer, „KI-Kosten reduzieren: Prompt-Caching" (iX/heise
2026, heise.de/-11335003). Min-Längen laut Claude-API-Doku
(platform.claude.com/docs/en/build-with-claude/prompt-caching, Stand
24.11.2026): 5.x-Modelle (Opus 5/5.5, Sonnet 5.5, Haiku 5.5, Fable) 512;
Sonnet 4.6 und Opus 4.8 1.024; Opus 4.7 2.048; Opus 4.5/4.6 und Haiku 4.5
4.096 Token. Auf Amazon Bedrock gilt für Opus 4.7 weiterhin 4.096.
Beispiel zu Regel 1: OpenClaw #19989 — Version 2026.2.15 schrieb
message_id, reply_to_id und sender_id in den System-Prompt, cacheWrite
dominierte, Kosten rund 10×; behoben mit PR #20597 (19.02.2026), der die
IDs in den User-Kontext verschob. Batch: −50% auf In+Out, stapelt multiplikativ mit dem Cache-Read-Discount
(0,30 × 0,5 = 0,15 $/MTok). Rechenbeispiel mit Sonnet-4.6-Preisen: 500×10K×$3,00
= $15,00 ungecacht; 1×10K×$3,75 + 499×10K×$0,30 = $1,53 mit Cache; +Batch $0,77.
Die $0,77 setzen 100 % Cache-Treffer voraus. Im Batch gibt es den Cache
nur best-effort; die Batch-Doku nennt typisch 30–98 % Treffer
(platform.claude.com/docs/en/build-with-claude/batch-processing,
24.11.2026). Mit 5-min-Cache wären das ≈ $0,92 (98 %) bis ≈ $6,79 (30 %).
Die Doku empfiehlt für Batches mit gemeinsamem Kontext den 1h-Cache; mit
1h-Write (2×) kostet der 100-%-Fall $0,78 statt $0,77.
-->

---
layout: section
routeAlias: modell-routing
---

# 7. Modell-Routing

<div class="text-sm opacity-75 mt-4">

Verschiedene Modelle & Harnesse pro Rolle kombinieren — noch nicht umgesetzt, als Prototyp mit Claude CLI + Codex CLI getestet.

</div>

---
hideInToc: true
clicks: 5
---

# Modell-Routing: Rollen statt Einheitsmodell

<div class="text-sm opacity-75 -mt-1">

Kostendruck auf **hochfrequente** Rollen, Premium auf **niedrigfrequente** — entscheidend ist €/Task (Preis × Tokens × Steps), nicht €/Mtok.

</div>

<ModelRoutingRoles :active="[null, 'plan', 'exec', 'res', 'ver', 'ext'][$clicks]" />

<div class="text-xs opacity-70 mt-2">

Muster nach: <a href="https://quesma.com/blog/custom-deep-research-pipeline/" target="_blank">Quesma — „Custom Deep Research Pipeline"</a> (07/2026) · Claude ⇄ Codex im Detail → <TalkXref slug="20260327-ai-agents" anchor="ultracode-vs-ultra">`ultracode` vs. `ultra`</TalkXref> · alle Quellen & Einschränkungen → ⓘ

</div>

---
hideInToc: true
routeAlias: pareto-heute
---

# Welches Modell wofür? Die Datenlage

<ModelRoutingPareto />

<!--
VIER ANSICHTEN aus zwei Quellen, Menü „Ansicht“ oben rechts: Artificial
Analysis (Intelligenz × Kosten, × Tempo) und DesignArena (Design-Elo ×
Preis, × Tempo). Beim Öffnen steht „Intelligenz × Kosten“ (Artificial
Analysis, Intelligence Index v5, Stand 23.11.2026). Die Regel ist in allen
dieselbe, nur die Achsen wechseln.

Die Handlungsanweisung zuerst aussprechen, alles andere ist Begründung:
Nimm den billigsten Punkt der Front, von dem Du glaubst, dass er Deine
Aufgaben löst. Weißt Du es nicht — und das ist der Normalfall —, fang
unten an und geh bei einem Fehlschlag eine Sprosse höher. Wo ein
Fehlschlag teuer ist — Produktionsdaten, ein Review, das jemand lesen
muss —, steigt man weiter oben ein.

Artificial Analysis (AA) misst breite Fähigkeit — der Intelligence Index
mischt Wissen, Logik und Agenten-Aufgaben —, keinen Coding-Agenten auf
echten Repos. „Kosten pro Task“ heißt bei AA: Ø Kosten eines Durchlaufs
des Index, kein SWE-Task; mit den DeepSWE-Werten der Historie ist das
NICHT vergleichbar. AA liefert Preise in USD, umgerechnet mit 0,876. Je
Modell die beste Effort-Stufe, Index ≥ 25.

Warum kein DeepSWE mehr auf dieser Folie: Das Board misst keine neuen
Modelle mehr — unser letzter Abruf (23.09.) zeigte noch den Stand vom
03.09., Opus 5.5, GPT-6 Sol/Luna und Gemini 4 Argon fehlen. Issue
datacurve-ai/deep-swe#117 („Is this repo dead?“, 16.10.2026, offen):
„no new tests are on the website“. AA führt es nicht mehr als Referenz.
Die Historie bis 03.09. bleibt auf den folgenden Folien.

INDEX v5 (seit Ende Oktober 2026). AA hat den Index neu aufgesetzt und
bisher nur einen Teil der Modelle neu gemessen: 126 mit Index, 110 mit
Kosten — am 01.10. hatten 175 Einträge Kosten. Die Zahlen sind neu geeicht und
NICHT mit früheren Ständen vergleichbar: Opus 5.5 hatte 57,6 bei 5,24 €,
jetzt 59,1 bei 8,79 € — der Preis je Index-Durchlauf ist gestiegen, weil
v5 schwerere Aufgaben stellt, nicht weil Anthropic teurer wurde.

Wo ein v5-Wert fehlt, steht der v4-Wert vom 01.10. auf v5 umgerechnet:
ein Potenzgesetz, gefittet an den 51 Konfigurationen, die in beiden Ständen
gemessen sind (R² 0,92, typisch ±4 Punkte; Kosten log-linear, ×/÷ 1,5).
Danach wird jeder Wert zwischen den gemessenen Modellen desselben
Herstellers verankert, damit die v4-Reihenfolge im eigenen Haus bleibt —
ohne das stand glm-5.3-flash (≈ 33,0) über dem gemessenen glm-5.3 (31,7).
Diese Punkte stehen hohl und gestrichelt, der Tooltip sagt „aus Index v4
umgerechnet“. Für die Folie reicht das — es ist eine Präsentation, keine
Analyse, und die Marker sind ohnehin nur so genau wie ein Pixel. Im
Kostenchart ist es einer: qwen3.8-2.4t 3,85 € (≈ 28,6); qwen3.8-flash-next
(0,50 €, 28,6) und glm-5.3-flash sind in v5 gemessen. Auf keiner der beiden
Fronten steht ein umgerechneter Punkt.

Vorsicht bei Modellen, die AA aus dem Board nimmt: Sie fallen auf den
v4-Wert zurück, und der Fit trifft die Spitze schlecht. gpt-6.1-sol hatte
am 16.11. in v5 gemessene 54,6 bei 1,11 €, umgerechnet steht es jetzt bei
≈ 39,8 und 1,37 €; gpt-6-astra fällt von 56,9 auf ≈ 40,6. Das liegt weit
außerhalb der typischen ±4 Punkte. Im Chart betrifft das nur die Presets
(siehe JetBrains AI unten).

Die AA-Kostenleiter hat sieben Sprossen: mimo-v2.6-flash 0,11 € (26,7) →
muse-ember 0,12 € (36,0) → claude-haiku-5.5 0,36 € (36,5) →
gpt-6.1-terra 0,84 € (51,3) → gpt-6.2-sol 0,89 € (57,3) → gpt-6.2-astra
3,50 € (62,1) → claude-fable-5.2 23,25 € (64,6). Gegenüber dem 16.11. hat
OpenAI die Mitte übernommen: gpt-6.2-sol (neu, Stufe Max) ersetzt
gpt-6.1-sol, das AA nicht mehr führt (16.11.: 54,6 bei 1,11 €), und liefert
für 5 Cent mehr als gpt-6.1-terra sechs Punkte mehr. gpt-6.2-astra (neu,
Stufe Max) verdrängt gemini-4-carbon. Carbon kostet bei AA wieder 7,76 statt
5,48 USD je Durchlauf (6,79 statt 4,80 €), bei gleichem Index; die Seite
führt dazu jetzt den Listenpreis 4/20 USD je 1M Token statt 2/10. Opus 5.5
(59,1 bei 8,79 €) bleibt dominiert: gpt-6.2-astra kostet weniger als die
Hälfte und liefert drei Punkte mehr. Der große Sprung liegt weiter zwischen
Haiku 5.5 und gpt-6.1-terra: knapp 15 Punkte für gut das Doppelte. Oben
kosten die letzten gut sieben Punkte (57,3 → 64,6) rund das 26-Fache — das
ist die Eskalations-Frage der Folie. Allein der letzte Schritt (gpt-6.2-astra
→ Fable 5.2) bringt 2,5 Punkte für das 6,6-Fache.

gpt-6.2-astra und gpt-6.2-sol sind neu im AA-Stand. Bei Astra liegen unter
Max die Stufen xhigh (61,6 bei 2,21 €) und high (60,1 bei 1,82 €); xhigh
kostet also knapp zwei Drittel von Max für einen halben Punkt weniger. Von
den Produkten führt sie bisher nur Junie (Release-Notes 18.11.: „GPT 6.2
Astra and GPT 6.2 Sol support“); Cursor und Windsurf listen sie am 23.11.
noch nicht. Ob sie allgemein verfügbar sind, ist nicht nachgeprüft.

claude-fable-5.2 steht seit 16.11. im AA-Stand. Das Chart nimmt je Modell die Stufe
mit dem höchsten Index; darunter liegen xhigh (62,2 bei 12,99 €), high
(61,8 bei 7,95 €), medium (56,4 bei 3,33 €) und low (53,9 bei 2,71 €).
Die Max-Stufe kostet also fast das Dreifache von high für 2,8 Punkte mehr.
Verfügbar ist das Modell laut den Produktkatalogen in Cursor
(Modellseite 16.11.), Windsurf (Seite vom 09.11.) und Junie (Release-Notes
09.11.); eine Ankündigung des Herstellers ist nicht nachgeprüft.

Neu im Chart am 23.11.: gpt-6.2-sol, gpt-6.2-astra und gemini-4-neon
(Stufe xhigh: 61,4 bei 5,65 €, 99 tok/s; high 59,6 bei 3,28 €). Weg sind
gpt-6-astra, gpt-6.1-sol und gemini-3.8-flash: AA führt sie nicht mehr (am
16.11. gemessen mit 56,9 bei 5,47 €, 54,6 bei 1,11 € und 30,8 bei 6,80 €).
Die Produkte führen sie weiter; in ihren Presets stehen sie als
umgerechnete v4-Werte (≈ 40,6 bei 5,69 €, ≈ 39,8 bei 1,37 €, ≈ 35,6 bei
2,28 €). Seit 16.11. fehlen schon claude-fable-5.1 und qwen3.8-max, Fable
5.1 steht in den Presets ebenso umgerechnet (≈ 51,6 bei 12,70 €).

gemini-4-neon ist von gpt-6.2-astra dominiert (billiger und besser) und
steht nicht auf der Marktfront. Cursor (Modellseite 23.11.), Windsurf (vier
Stufen Low bis XHigh) und Junie (Release-Notes 19.11.: „Gemini 4 Neon
support“) führen es; bei Cursor und Windsurf, die GPT-6.2 noch nicht
führen, steht es auf der Kostenleiter. Eine Freigabe durch Google ist nicht
nachgeprüft.

gemini-4-carbon stand vom 31.10. bis 16.11. auf der Kostenfront; seit 23.11.
ist es dominiert (6,79 € statt 4,80 €, siehe oben). In der Tempoansicht
(63 tok/s) steht es ebenfalls nicht auf der Front: claude-fable-5.2 ist
schneller (110 tok/s) und besser (64,6). Eine Freigabe durch Google ist
nicht nachgeprüft, aber zwei Produkte bieten es seit November an: Junie seit
10.11.2026 (Release-Notes „Gemini 4 Carbon support“), Cursor laut
Modellseite vom 16.11.2026. Deshalb steht es nicht in NUR_EINGESCHRAENKT.
Auf den Leitern von Cursor und Junie ersetzen es jetzt gemini-4-neon bzw.
gpt-6.2-astra.

gemini-4-argon (50,4 bei 8,71 €) ist in v5 von gpt-6.1-terra und
gpt-6.2-sol dominiert und nicht auf der Front. Seine Kosten je Durchlauf
setzte AA am 28.10. abends doppelt so hoch an wie am Nachmittag (7,68 statt
3,84 USD) und am 09.11. noch einmal höher (9,95 USD); am 16.11. standen sie
bei 4,97 USD, seit 23.11. wieder bei 9,94 USD, bei gleichem Index. Einen
Grund nennt die Seite nicht. Es
steht in den Katalogen von Cursor, Windsurf und Junie (Windsurf:
Low/Medium/High); ob es allgemein verfügbar ist, ist nicht nachgeprüft.

Ansicht „Tempo“: Front nach Output-Tokens/s — muse-ember 443 →
claude-haiku-5.5 257 → gemini-4-hydrogen 157 → claude-sonnet-5.5 152 →
claude-opus-5.5 115 → claude-fable-5.2 110. Dieselben Modelle wie am 16.11.
Die Index-Achse reicht jetzt von 18 bis 74 statt 22 bis 68: Hydrogen und
Sonnet 5.5 liegen fast aufeinander, und auf der engeren Skala ließen sich
die Marker nicht sauber entzerren.
AA misst Tempo seit 03.11. anders (Methodik 3.0.0): nicht mehr der Median
eines Profils mit 10 000 Input-Tokens über 72 Stunden, sondern der
Durchschnitt aller Lastprofile über 5 Tage, bis hin zu agentischen
Sitzungen mit Tool-Aufrufen, und Ende zu Ende samt Wartezeit bis zum ersten
Token. Die Werte liegen deshalb typisch rund 20 % unter den alten, einzelne
Modelle bewegen sich zwischen einem Drittel und dem 2,5-Fachen. Am 09.11.
fielen so muse-wonder von 192 auf 121 tok/s und gpt-6.1-sol von 98 auf 57.
Mit den alten Zahlen ist die Ansicht nicht vergleichbar. Auch von Stand zu
Stand der neuen Methode bewegen sich einzelne Werte um bis zu rund 15 %
(Haiku 5.5 233 → 257 tok/s, Carbon 72 → 62, Hydrogen 173 → 157). Ohne
Tempo-Wert fehlt nur noch ling-3.1-flash-1019; qwen4-max hat seit 23.11.
einen (64 tok/s), mistral-large-4 hat 74 tok/s. Der
Schalter „Tempo als Größe“
legt die Geschwindigkeit als Halo um die Marker der Kostenansicht.
Attribution: AA verlangt den Link, er steht in der Fußzeile.

DESIGNARENA (Board „Overall Agentic“, Stand 23.11.2026) ist die zweite
Meinung: keine Benchmark-Aufgaben, sondern Blind-Duelle. Menschen sehen
zwei Ergebnisse derselben Design- bzw. Agentic-Aufgabe (Website, App,
Spiel) und wählen das bessere; daraus ein Bradley-Terry-Elo, Start 1200,
372 000 Stimmen. Das misst Gefallen und Gesamteindruck, nicht
Korrektheit — wo AA und DesignArena sich einig sind, ist die Aussage
belastbarer als jede für sich.

Ansicht „Design-Elo × Preis“: x ist der LISTENPREIS je 1M Token, 3 Teile
Input zu 1 Teil Output gemischt, wie DesignArena selbst rechnet — in USD,
nicht umgerechnet. Das ist ein Preisschild, kein Verbrauch pro Aufgabe:
ein gesprächiges Modell steht hier zu billig. Elo ≥ 1200, 38 Modelle.
Front: glm-5.3-flash 0,24 $ (1235) → minimax-m3.1-flash 0,26 $ (1254) →
inkling-2-small 0,48 $ (1321) → qwen4-max 2,25 $ (1368) →
gpt-6.1-sol 4 $ (1374) → claude-opus-5.5 8 $ (1456). Auffällig gegen AA:
die billigen chinesischen Modelle (GLM, MiniMax, Qwen) stehen hier weit
vorn. An der Spitze liegen Opus 5.5 (Stufe high) und GPT-6.1 Sol (max).
glm-5.3-flash ist seit 23.11. neu auf dem Board (rund 290 Duelle) und setzt
sich unten vor minimax-m3.1-flash. Die übrigen Front-Modelle liegen 5 bis
11 Punkte höher als am 16.11., die Reihenfolge ist dieselbe. Ebenfalls neu
und alle dominiert: gpt-6.2-astra (1324 bei 16 $), gpt-6.2-sol (1282 bei
4 $), hy4 (1312 bei 1,25 $), qwen3.8-max (1318) und mimo-v2.5-pro (1258);
claude-haiku-5.5 (1193) liegt unter dem Boden.

Ansicht „Design-Elo × Tempo“: Ø Zeit einer Generierung. Seit 16.11.
führt DesignArena sie für fast jedes Modell —
0 der 38 Modelle der Preisansicht haben keine. Deshalb gilt jetzt derselbe Boden wie beim
Preis, Elo ≥ 1200. Front: gpt-6-sol 8,2 min (1220) →
deepseek-v4.1-flash 9,0 min (1297) → claude-opus-5.5 14,3 min (1456).
Vorsicht beim Vergleich: Die 28 Modelle, die schon am 09.11. eine Zeit
hatten, stehen jetzt im Median rund 4-mal so lang da (1,4- bis 75-mal);
claude-fable-5 etwa 12,2 statt 4,0 min. Einen Grund nennt die Seite
nicht. Die Zeiten taugen also nur innerhalb dieses Stands, nicht gegen
frühere Folienstände.

PRODUKT-AUSWAHL (Anbieter-Menü; Kataloge von Cursor, Windsurf und Junie vom
23.11.2026, JetBrains AI vom 28.10.2026, AA-Stand 23.11.2026). Der Zweck: Wer ein Produkt hat, will wissen, welche SEINER
Modelle sich lohnen und wann es ein strikt besseres gibt. Ein Produkt
zeigt deshalb alle seine Modelle mit Wert — auch ältere, die AA nicht mehr
führt — und rechnet die Front nur über diese, selbst wenn andere Produkte
neuere Modelle haben. Achsen und Quadranten-Linien (Median) folgen der
Auswahl; „Alle“ und die Labs bleiben beim aktuellen Feld. Der Tooltip
eines grauen Punkts nennt das Modell, das ihn strikt übertrifft. Ältere
Modelle hat AA in v5 kaum neu gemessen: In den Presets sind deshalb die
meisten Punkte aus v4 umgerechnet (≈).

Kostenansicht, die vier Produkte:
- JetBrains AI (25 von 42, fünf Sprossen): gpt-5-mini 0,12 € (≈ 8,1) → gpt-6-luna 0,13 € (27,9) → gpt-6.1-sol 1,37 € (≈ 39,8) → claude-sonnet-5.5 8,78 € (54,5) → claude-opus-5.5 8,79 € (59,1). AA führt gpt-6.1-sol seit 23.11. nicht mehr; auf der Leiter steht es deshalb mit seinem umgerechneten v4-Wert, 15 Punkte unter der letzten Messung (54,6). Damit kommt Sonnet 5.5, einen Cent billiger als Opus 5.5, als eigene Sprosse dazu. Die Leiter unterschätzt hier also das OpenAI-Modell, die Aussage „bis Opus 5.5“ bleibt. Die Spitze, gpt-6.2-astra und claude-fable-5.2, führt JetBrains nicht.
- Junie (20 von 20): gpt-6-luna 0,13 € (27,9) → gpt-6.1-terra-non-reasoning 0,20 € (30,5) → gpt-6.1-terra 0,84 € (51,3) → gpt-6.2-sol 0,89 € (57,3) → gpt-6.2-astra 3,50 € (62,1) → claude-fable-5.2 23,25 € (64,6). Seit 23.11. neu belegt: GPT 6.2 Astra und GPT 6.2 Sol (Release-Notes 18.11.) sowie Gemini 4 Neon (19.11.). Junie führt damit als einziges Produkt dieselbe Spitze wie der Markt; gpt-6.2-astra verdrängt Carbon, gpt-6.2-sol ersetzt gpt-6.1-sol. Alle 20 Modelle haben einen Kostenwert.
- Windsurf (38 von 55): gpt-6-luna 0,13 € (27,9) → gpt-6.1-terra-non-reasoning 0,20 € (30,5) → claude-haiku-5.5 0,36 € (36,5) → gpt-6.1-terra 0,84 € (51,3) → gemini-4-neon 5,65 € (61,4) → claude-fable-5.2 23,25 € (64,6). Die Modellseite führt seit dem Abruf vom 23.11. Gemini 4 Neon in vier Stufen (273 Einträge, 55 Familien; die Seite nennt weiter „as of November 9, 2026“). Neon verdrängt claude-opus-5.5 von der Leiter. gpt-6.1-sol und gpt-6-astra fallen heraus, weil AA sie nicht mehr misst: umgerechnet (≈ 39,8 und ≈ 40,6) liegen beide unter gpt-6.1-terra.
- Cursor (40 von 58): gpt-5-mini 0,12 € (≈ 8,1) → claude-haiku-5.5 0,36 € (36,5) → gemini-4-hydrogen 2,77 € (53,9) → gemini-4-neon 5,65 € (61,4) → claude-fable-5.2 23,25 € (64,6). Seit 23.11. führt Cursor Gemini 4 Neon; es verdrängt gemini-4-carbon. gpt-5.6-luna (≈ 26,9) fällt heraus: Die neu gefittete Umrechnung setzt es auf 0,364 €, knapp über Haiku 5.5 (0,36 €).

Tempoansicht (Leiter jeweils vom langsamsten zum schnellsten). Seit 09.11.
fehlen hier alle Modelle, die nur der v4-Stand vom 01.10. kennt: Ihr Tempo
stammt aus der alten AA-Methodik und stünde sonst neben den neuen Werten.
Seit 23.11. gilt das auch für gpt-6-astra, gpt-6.1-sol und
gemini-3.8-flash, die AA nicht mehr führt.
- JetBrains AI (6 von 42): claude-opus-5.5 115 tok/s (59,1) → claude-sonnet-5.5 152 tok/s (54,5). Zwei gezeichnete Familien weniger als am 16.11.: gpt-6.1-sol und gemini-3.8-flash haben kein Tempo mehr.
- Junie (13 von 20): claude-fable-5.2 110 tok/s (64,6) → claude-opus-5.5 115 tok/s (59,1) → claude-sonnet-5.5 152 tok/s (54,5) → gemini-4-hydrogen 157 tok/s (53,9). Die neuen Modelle stehen nicht auf der Leiter: gemini-4-neon (99 tok/s, 61,4) ist langsamer und schwächer als Fable 5.2, gpt-6.2-astra (48 tok/s, 62,1) und gpt-6.2-sol (67 tok/s, 57,3) ebenso.
- Cursor (17 von 58): claude-fable-5.2 110 tok/s (64,6) → claude-opus-5.5 115 tok/s (59,1) → claude-sonnet-5.5 152 tok/s (54,5) → gemini-4-hydrogen 157 tok/s (53,9) → claude-haiku-5.5 257 tok/s (36,5) → gemini-3.5-flash-lite 310 tok/s (11,7). muse-wonder (118 tok/s, 43,6) steht unter Sonnet 5.5 und fällt heraus.
- Windsurf (15 von 55): claude-fable-5.2 110 tok/s (64,6) → claude-opus-5.5 115 tok/s (59,1) → claude-sonnet-5.5 152 tok/s (54,5) → claude-haiku-5.5 257 tok/s (36,5).

Die Frage aus dem Publikum, was mit dem eigenen API-Schlüssel ist: JetBrains
AI und Junie erlauben BYOK. Dann das Lab des Schlüssels anhaken (OpenAI,
Anthropic, Google, xAI), bei einem OpenRouter-Schlüssel „Alle“. Die Presets
zeigen nur, was das JetBrains-Abo mitbringt. Und Junie veröffentlicht keine
vollständige Modellliste: 20 Modelle sind belegt (Landingpage, datierte
Release-Notes), das Produkt selbst zeigt mit /model mehr.

Wenn aus dem Publikum „bei uns ist nur X freigegeben“ kommt: Die Labs
im Anbieter-Menü sind Checkboxen, mehrere gehen gleichzeitig. Ein
Werkzeug-Preset setzt dabei Modelle, keine Lab-Häkchen — deshalb kann ein
Lab nach einem Preset auf „teilweise“ stehen.

Was der Filter NICHT sagt: Er zeigt Verfügbarkeit, nicht Preis. Cursor
und Windsurf rechnen nach eigenen Tarifen ab; geplottet ist der
API-Listenpreis. Und das jeweils eigene Modell fehlt — AA misst weder
Cursors Composer noch Windsurfs SWE-x.

Wenn jemand fragt, warum das Deck so ein Datum betont: Die Front dieser
Folie hat sich schon zwischen zwei AA-Snapshots verschoben, ohne dass ein
Modell erschienen ist (gpt-6-luna am 01.10.2026: Index von 37,3 auf 38,1
korrigiert). Die Zahl ist ein Datum,
kein Naturgesetz — die Folie wird deshalb wöchentlich aus einem neuen
AA-Snapshot nachgezogen.

Zum Harness-Vorbehalt im ⓘ („±2 bis ±5 Prozentpunkte im Mittel, Kosten
bis 5×"): Das ist ein Mittelwert über Modelle, kein Maximum — einzelne
Paare weichen stärker ab (HarnessTax, Kapitel 7). Der schärfste
vermutete Hebel dahinter ist die Abbruch-Option — das Zitat dazu (RLVR-
Task-Designer, HN, 01.09.2026) steht zwei Folien weiter auf „Harness +
Modell: Wer trägt was?". Der Score ist nie das Modell allein.

Seit dem 16.09.2026 gibt es zu der Anekdote eine Messung: HarnessTax
(UC Berkeley Sky Lab + Arena, Kapitel 7 „Der Harness als zweite
Achse"), 21 Modell×Harness-Paare auf zwei Benchmarks. Ergebnis, kurz
vorweggenommen: Die Ausdauer-These stimmt teilweise — Claude Code lässt
ein schwaches Modell (GPT-5.6 Luna) tatsächlich 3,4× so viele Schritte
laufen wie Pi. Aber das erklärt nicht den Aufpreis bei starken
Modellen: Claude Fable 5 braucht in Claude Code und Pi praktisch
dieselbe Schrittzahl (15,3 gegen 15,4), kostet aber doppelt so viel.
Und läuft ein Anthropic-Modell im eigenen Harness am besten? Nur bei
Fable 5 — bei Opus, Sonnet und Haiku gewinnt auf beiden Benchmarks ein
fremder Harness. Details, Zahlen und Einschränkungen: auf der Folie
„Der Harness als zweite Achse" selbst.

Kontingent-Toggle (nur Kostenansicht), die Limits im Detail:

1) Was der Toggle rechnet. Der Abo-Preis ist fix, begrenzt wird über
das Wochenlimit, also €/Task ∝ 1/Kontingent. Seit 14.09.2026 gelten
dauerhaft +25 % über der Basis (×0,8) — Pro, Max, Team und
seat-basiertes Enterprise; davor lief bis 13.09. eine +50-%-Aktion.
Eine Rückkehr auf das Basislimit gibt es nicht. Quelle in ⓘ.

2) Warum „20x" nicht das Vierfache von „5x" ist. Max 5x kostet 100 $,
Max 20x kostet 200 $ — das liest sich wie vierfaches Kontingent für
doppeltes Geld. Der Faktor gilt aber nur im 5-Stunden-Fenster.
Wöchentlich, und das ist bei Agenten-Arbeit das bindende Limit, liegt
der Abstand bei ungefähr 2×. Genau deshalb hängt der Toggle hier am
Wochenlimit: In dem Regime, in dem er rechnet, ist die 5-h-Zahl
irrelevant. https://x.com/i/status/2094121392229028236 (30.08.2026)

3) Die Gegenrede vom Wettbewerb. Tibo Sottiaux, der bei OpenAI Codex
verantwortet, hält dagegen: Bei Codex beziehe sich das 20X ausdrücklich
auf Wochenlimits, 5-h-Limits gebe es auf beiden Pro-Plänen gar nicht,
und Pro 20X sei genau 20× Plus. Das ist Marketing-Konter, der Punkt
darunter trägt trotzdem: Wer zwei Abos vergleicht, muss dieselbe
Fensterlänge vergleichen. Das ist die „Zielfunktion"-Einschränkung aus
ⓘ an einem konkreten Fall.
https://x.com/thsottiaux/status/2094254532020818191 (31.08.2026)

Nicht überziehen: Anthropic veröffentlicht keine festen Message- oder
Stundenzahlen. Was kursiert (~225 vs. ~900 Nachrichten pro 5 h), sind
Community-Schätzungen — als Größenordnung erwähnen, nicht als Faktum.

Entzerrte Marker: bis 4,2 px verschoben, höchstens 0,7 Indexpunkte senkrecht oder 2,9 % im Preis bzw. Tempo waagerecht.
In der Kostenansicht liegen glm-5.3-flash (0,51 €, 27,8) und
qwen3.8-flash-next (0,50 €, 28,6) fast aufeinander und rücken je 4,2 px
senkrecht auseinander. Mit dem Kontingent-Schalter landet claude-opus-5.5
(×0,8: 7,03 €) wieder fast auf gemini-4-carbon (6,79 €, seit 23.11. wieder
der alte Preis); beide rücken je 4,1 px waagerecht auseinander. In der
Tempoansicht rücken gemini-4-hydrogen (157 tok/s) und claude-sonnet-5.5
(152 tok/s) je 3,6 px waagerecht auseinander, dazu ein Knäuel um Index 30:
glm-5.3, gpt-6.1-terra-non-reasoning und qwen3.8-flash-next (bis 4,2 px)
sowie qwen3.8-2.4t und mimo-v2.6-flash (je 1,8 px). Auch in den
Anbieter-Presets bleibt keine Überlappung übrig. Kein dominierter Punkt
rückt über die Front. Fadenkreuz und Tooltip zeigen den wahren Wert.
Die Zahlen rechnet markerDodge.test.ts nach und hält sie gegen diese Notiz.
-->

---
hideInToc: true
clicks: 9
routeAlias: pareto-historie
---

# Zwei Monate Pareto-Front

<ModelRoutingHistory :step="$clicks" />

<!--
Keine Quellen-Fußzeile unter dem Chart: Die Stationsnotizen 6 bis 9 sind
vier bis fünf Zeilen lang und schoben sie unter die Folienkante (gemessen
05.09.2026, 731 bis 780 px bei 720). Quellen, Wechselkurs und "damals
veröffentlichter Stand" stehen im ⓘ-Modal.

Warum die Serie am 15.06. beginnt (Station 1 = Start von v1.1):
- DeepSWE v1 (bis 14.06.) ließ die Tests im Container des Agenten laufen, das
  Repo stand im Detached-HEAD-Modus. Datacurves Sorge: Eine ähnliche, upstream
  gemergte Lösung wäre per `git log` zu finden gewesen. Dazu instabile Tests
  und veraltete Abhängigkeiten bei einigen Tasks.
- v1.1 (Blog vom 14.06.2026) bewertet nur noch den committeten Patch in einem
  eigenen Container, setzt `main` auf den Startcommit ohne spätere Commits
  und liefert CTRF-Testreports. Dieselben 113 Tasks.
- Datacurve selbst: "Scores stay close: the ordering at the top is unchanged,
  and most configurations land within a few points." Neun Konfigurationen
  liefen unter beiden Methoden, −3,8 bis +6,0 Punkte.
- Nur acht Modelle wurden neu gefahren. 13 v1-Modelle kamen nie zurück,
  glm-5.2 (21.06.) und deepseek-v4-pro (12.08.) wurden später neu gemessen.
  Ein v1-Stand in dieser Serie hätte 15 Punkte verschwinden lassen, die
  nicht dominiert, sondern nicht gemessen waren.
- Den Vergleich v1 gegen v1.1 zeigt die Bonusfolie am Ende. Nicht hierher
  gehört die Zahl "18 % der Opus-4.7-Treffer per git log --all": Sie stammt
  aus Datacurves SWE-Bench-Pro-Auswertung, nicht aus DeepSWE v1.

Station 2 (10.07.): Die gpt-5.6-Familie kommt an einem Tag. terra hat den
Score von fable-5 für gut ein Drittel des Preises, Anthropic verschwindet
von der Front. Station 3 (22.07.) füllt dann nur noch das billige Ende auf.

Die Lupe „Die Effort-Falle" (gpt-6-astras fünf Effort-Stufen) ist seit
22.09.2026 keine Station mehr dieser Folie, sondern eine eigene Folie direkt
danach (routeAlias `effort-falle`) — dort auch mit dem inzwischen
korrigierten heutigen Preis statt der hier gezeigten 03.09.-Zahlen.

Neunter Klick: „Aktueller Stand" schließt die Klammer zur Folie davor —
dasselbe Bild wie dort, jetzt mit allen Namen und Fadenkreuz. Die Notiz
wiederholt die drei Sprossen und die Regel statt der Namen: der billigste
Frontpunkt, der Deine Aufgaben löst. Punkt oder Label anklicken pinnt,
mehrere gleichzeitig möglich; die Beschriftung nimmt die Farbe ihres
Fadenkreuzes an. Der Legenden-Schalter zeigt die Namen auf
jeder Station, den Schlusstext gibt es nur an diesem Schritt. Zurück (←)
schaltet beides aus.

Entzerrte Marker: bis 6,8 px verschoben, höchstens 2,0 Prozentpunkte
senkrecht oder 4,7 % im Preis waagerecht. Betroffen: ab Station 3
muse-spark-1.1/grok-4.5, an den Stationen 3 bis 5 kimi-k3/terra
(waagerecht), ab Station 6 muse-spark-1.2/qwen3.8-max, ab Station 7
terra/glm-5.3, an Station 9 sol/astra (waagerecht). Frontpunkte rücken nur
waagerecht. Kein dominierter Punkt rückt über die Front oder links an seinen
Dominator vorbei. Fadenkreuz und Tooltip zeigen den wahren Wert. Die Zahlen
rechnet markerDodge.test.ts nach und hält sie gegen diese Notiz.
-->

---
hideInToc: true
routeAlias: effort-falle
clicks: 3
---

# GPT-6 Astra: Die Effort-Falle

<div class="text-sm opacity-70 mb-1">
Ein Modell, fünf Preise — und ein Preis, der sich seit dem Start schon
verschoben hat, bevor auch nur ein zweites GPT-6-Modell auf dem Board
gelandet ist.

</div>

<EffortFalle :step="$clicks" />

<!--
Herausgelöst aus dem bisherigen neunten Klick der Historien-Folie (bis
22.09.2026) — Details siehe deren Notiz. Drei Klicks:

1 blendet die Preis/Score-Klammer zwischen high und max ein: beide lösen 331
von 452 Aufgaben, max kostet trotzdem das 1,9-Fache. Rechnung siehe
`components/paretoData.ts`, Abschnitt „astra heute". Board zeigt `max`, weil
seine Regel die höchste Effort-Stufe nimmt, nicht die beste.

2 der Preis-Kasten: Board führte astra bis mindestens zum 17.09.2026 als
„expected launch pricing" (12 $/M Input, 15 $/M Cache-Write, 1,20 $/M
Cache-Read, 2 $/M compute units — die einzige Zeile des ganzen Boards mit
dieser Klausel). Zum 22.09.2026 08:52 UTC (Wayback) steht dort „current
pricing" (10 $/M Input, 12,50 $/M Cache-Write, 1 $/M Cache-Read, keine
Compute-Unit-Gebühr) — 27–39 % billiger, Score und Konfidenzintervall jeder
Stufe unverändert. Die Historien-Folie (Stand 03.09.2026) bleibt bei den
alten Zahlen, sie ist explizit datiert; diese Folie rechnet mit dem
Live-Stand vom 23.09.2026 (`data/deepswe/board-20260922T062715Z-e9886184.ndjson`).

3 der Vorläufig-Kasten: Claude Opus 5.5 (22.09.) und GPT-6 Sol + Luna (22.09.)
sind auf dem DeepSWE-Board noch nicht gelistet — Live-Fetch vom 23.09.2026
zeigt dieselben 70 Datensätze/28 Modelle wie am 03.09. Datacurves eigene
Tracking-Issues (datacurve-ai/deep-swe#98 für Opus 5.5, #99 für Sol/Luna,
beide vom 22.09., offen) enden mit „Please test". Die drei gezeigten Zahlen
sind selbstberichtet: Opus 5.5 74,2 % (Ø 5 Durchläufe, Anthropics eigene
„Claude Opus 5.5 System Card", Abschnitt 8.3 — kein Preis genannt), GPT-6 Sol
68,8 % und GPT-6 Luna 66,6 % (beide bei max effort, aus OpenAIs eigenem
Ankündigungs-Chart). Bewusst als Text, nicht als Chart-Punkt: Weder für Sol
noch für Luna lässt sich aus dem Chart eine belastbare €/Task-Zahl ablesen,
und Opus 5.5 nennt gar keinen Preis — ein erfundener x-Wert wäre keine
Messung. Quelldatei `components/lib/preliminaryDeepSWE.ts`, bewusst getrennt
von `paretoData.ts` und nicht Teil von `SNAPSHOTS`/`CURRENT`: sobald eines
der beiden Issues einen echten Board-Wert bringt, wird diese Datei ersetzt
(gelöscht, nicht nur editiert), ohne dass irgendwo sonst im Deck etwas
nachgezogen werden muss.

Kein GPT-6 Terra (Stand 23.09.2026): developers.openai.com/api/docs/models/gpt-6-terra
liefert 404, anders als bei Astra/Sol/Luna.
-->

---
hideInToc: true
routeAlias: abbruch-hypothese
clicks: 2
---

# Harness + Modell: Wer trägt was?

<div class="grid grid-cols-2 gap-8 mt-2 text-sm">
<div>

### Ein Agent = Modell + Harness

„A software system that manages a model's tools, context, and task execution" — wer einen Coding-Agent wählt, wählt **beides**, auch wenn nur vom Modell die Rede ist.

Kap. 10 sagt es mit Browser Use: <Link to="bitter-lesson">„All the value is in the RL'd model"</Link> — bisher eine Erfahrung, **jetzt gemessen.** In der Praxis: <TalkXref slug="20260707-anatomy-of-autonomous-agents" anchor="duemmer-ist-besser">Standard-Harness + Markdown</TalkXref>.

<div v-click="1">

### Der Harness-Anteil am Erfolg ist klein

Im Mittel **±2 Punkte** (SWE-bench Lite) bis **±5 Punkte** (Terminal-Bench 2.0) — dieselbe Zahl wie im ⓘ von „Welches Modell wofür?". HarnessTax, 21 Modell×Harness-Paare, 16.09.2026.

</div>
</div>
<div v-click="2">

### Eine verbreitete Vermutung

Claude Codes Harness treibe das Modell zum Weitermachen — ein Beispiel von vielen:

> _"If you give the AI a way to give up, eventually it will."_
>
> — fxtentacle, RLVR-Task-Designer, Hacker News, 01.09.2026

Zwei prüfbare Vorhersagen stecken darin:

1. **Der Harness entscheidet mit** — mehr gelöst oder billiger.
2. **Der eigene Harness gibt nicht auf** — mehr Schritte → mehr gelöst.

Die nächste Folie prüft die erste, die übernächste die zweite.

</div>
</div>

<!--
Diese Folie stellt die Frage und die Ausgangslage, bewertet noch nichts.
Drei Klick-Blöcke: Definition (Zitat aus dem HarnessTax-Blogpost, Pan et
al., UC Berkeley Sky Lab + Arena, 16.09.2026: „Coding agents put these
capabilities to work through harness, a software system that manages a
model's tools, context, and task execution. […] Choosing a coding agent
therefore means selecting both a model and a harness, even when the
explicit focus is only on the model."), dann der Befund als Zahl, dann
die Vermutung, aus der die zwei Vorhersagen folgen.

Zur Zahl: „±2 bis ±5 Punkte" ist der MITTLERE Harness-Effekt über die
Modelle je Benchmark („the average harness effect on success rate stays
within ±2% on SWE-bench Lite and within about ±5% on Terminal-Bench
2.0"). Einzelne Paare weichen stärker ab — Haiku auf Terminal-Bench: Pi
47,8 % gegen Codex 31,1 %, Sol: Pi 83,3 % gegen Claude Code 71,1 % — bei
30 Tasks meist innerhalb der 95-%-CI. Deshalb nicht „bis zu 5 Punkte"
sagen.

Das HN-Zitat vollständig (Deckkonvention: Original, nicht übersetzt —
wie Zechner, Cherny, Browser Use):
„(I don't work at Anthropic, but I've designed RLVR tasks) My impression
is that especially for long-horizon tasks like science, the harness is
much more important than people give it credit for. Claude Code + Fable
5 seems to have a tendency to "give up", get stuck in a dead end, or
claim things to be impossible. But using the Fable 5 API together with a
custom harness, it'll happily try 200+ variants and fail its way towards
the goal. If you give the AI a way to give up, eventually it will. If you
remove that option from the harness, then thanks to the non-determinism
inherent to LLMs, you get to explore pretty much all related solution
attempts." — news.ycombinator.com/item?id=49528037. Ehrlich einordnen:
ein Erfahrungsbericht, keine Messung — eine Person, kein Anthropic-
Mitarbeiter, keine nachrechenbaren Zahlen. Es ist EIN Beispiel für eine
oft geäußerte Vermutung; die Studie misst genau diese beiden
Vorhersagen.

Kein ⓘ hier: die Quellen stehen in der Attribution und im ⓘ der beiden
HarnessTax-Folien.
-->

---
hideInToc: true
routeAlias: harness-tax
clicks: 4
---

# Der Harness als zweite Achse

<HarnessTaxPareto :step="$clicks" />

<div v-click="4" class="text-sm mt-1">

**Vorhersage 1, geprüft: Der Harness wirkt — vor allem auf die Kosten.**
Claude Code kostet auf SWE-bench Lite im Mittel 2,0× so viel wie **Pi**,
bei Luna 5,1× — für im Mittel ±2 bis ±5 Punkte Erfolg. Unintuitiv: auf
Terminal-Bench 2.0 holt das Vier-Werkzeuge-Harness Pi bei 6 von 7
Modellen den höchsten Erfolg, auf SWE-bench Lite nur bei einem.

</div>

<div class="text-xs opacity-70 mt-1">

HarnessTax (UC Berkeley Sky Lab + Arena) · 21 Modell×Harness-Paare ·
30 Tasks × 3 Läufe · 95-%-CI · Preisliste eingefroren 01.09.2026 · 1
USD = 0,876 € · **nicht vergleichbar mit der DeepSWE-Front aus
„Zwei Monate Pareto-Front“**

</div>

<!--
Die Anschlussfrage aus Kapitel 7 bisher: Läuft ein Modell im eigenen
Harness besser? Die Folie davor stellte die Vermutung vor (Abbruch-
Option als Hebel) — eine Anekdote, keine Messung. HarnessTax misst
die erste der beiden Vorhersagen: 21 Paare, sieben Modelle, drei
Harnesse (Pi, Codex CLI, Claude Code), zwei Benchmarks, je 30 Tasks
dreifach wiederholt. Vergleichbarkeit: Zwischen den beiden Benchmarks
ist die Methode gleich (Harness-Vergleiche je Benchmark konsistent),
die absoluten Raten nicht mischbar (Fable 97,8 % auf Lite ist nahe der
Sättigung; die Autoren nennen mögliche Kontamination). Mit der DeepSWE-
Front aus „Zwei Monate Pareto-Front" ist NICHTS davon vergleichbar: anderer
Benchmark, anderes Harness (mini-swe-agent), andere Metrik (pass@1 je
Task dort, Mittel über drei Versuche hier), 113 gegen 30 Tasks.

Was diese Folie zeigt: Farbe UND Form sind der Harness (violettes
Quadrat Pi, grünes Dreieck Codex, orange Raute Claude Code — Farben wie
in Kapitel 10s Harness-Vergleich, Formen wie in der Studie; die Form ist
die Zweitkodierung für Farbenblinde, im Dark-Theme liegen Orange und Grün
nur ΔE 7,7 auseinander), Beschriftung das Modell. Vor dem ersten Klick
liegen Quadranten und der Pfeilcluster („Billiger", „Leistungsfähiger",
„Besseres Preis-Leistungs-Verhältnis") von „Welches Modell wofür?"
darüber — nur als Erinnerung, dass es dasselbe Koordinatensystem ist
(Trennung redaktionell bei 0,5 € / 50 %); sie blenden mit dem ersten
Klick aus. Vier Klicks:
1 die gestrichelte Pareto-Front über alle 21 Punkte — sie bleibt.
2 der Claude-Code-Aufpreis: je Modell ein Pfeil vom Pi-Punkt zum
Claude-Code-Punkt mit dem Kostenfaktor; Codex gedimmt. Die Pfeile
laufen fast waagerecht — das IST der Befund: gleicher Erfolg, anderer
Preis. SWE-bench Lite: Luna 5,1× (+2,2 Punkte), Sol 3,5× (+3,3), Opus
2,1× (+4,4), Fable 2,0× (+1,1), Kimi 1,7× (+4,4), Haiku 1,1× (−7,8),
Sonnet 1,0× (+2,2); geometrisches Mittel 2,0×. Terminal-Bench 2.0: Sol
3,2× (−12,2), Luna 2,2× (−6,7), Fable 1,4× (+4,4), Kimi 1,4× (−6,7),
Opus 1,2× (−3,3), Sonnet 1,1× (−3,3), Haiku 1,0× (−6,7); Mittel 1,5×
(Faktoren und Deltas aus den ungerundeten Archivwerten, eine Stelle;
harnessTaxData.test.ts hält sie fest).
3 natives gegen bestes Harness: Geisterring am nativen Punkt, Pfeil zum
Harness mit dem höchsten Erfolg — nur wo sie sich unterscheiden, ohne
Beschriftung (das Erfolgs-Delta steht im Tooltip). SWE: Opus und Sonnet
→ Codex, Haiku → Pi, Sol → Claude Code (Fable bleibt, Luna steht mit
Codex gleichauf). Terminal-Bench: Opus, Sonnet, Haiku, Sol, Luna → Pi
(Opus liegt dort mit Pi und Codex gleichauf, der Pfeil zeigt auf Pi).
Zusammen: ein fremder Harness gewinnt 9 von 12.
4 der Schlusstext.
Der Benchmark-Umschalter wechselt zwischen SWE-bench Lite und
Terminal-Bench 2.0 — beide zeigen, sonst wäre es Rosinenpickerei: auf SWE
holt Claude Code bei vier Modellen den höchsten Erfolg (Fable, Sol, Luna
gleichauf mit Codex, Kimi), Codex bei zwei, Pi nur bei Haiku; auf
Terminal-Bench holt Pi bei sechs von sieben den höchsten Erfolg, Claude
Code nur bei Fable. Der Blogpost selbst sagt nur „Pi reaches the Pareto
frontier on both benchmarks" — die Zählung ist unsere, aus dem Archiv.
Klick auf ein Harness-Swatch in der Legende dimmt die anderen und zeigt
die Front dieses Harness allein; „alle Namen" beschriftet alle 21
Punkte mit dem Modell-Kurznamen (der Harness steht in Form und Farbe des
Markers — „Modell · Harness" als Text zwang fünf Labels in Überlappungen). Pis Vorteil ist vermutlich nicht nur der schmalere
Werkzeugkatalog: Pi läuft per Default auch ganz ohne Permission-Gating
(voller YOLO-Modus, kein Klassifikator) — Detail dazu im Companion-Talk
<TalkXref slug="20260327-ai-agents">Coding-Agents im Alltag</TalkXref>.

Die Kernzahl aus dem Blogpost: über die sechs Anthropic- und
OpenAI-Modelle und beide Benchmarks gewinnt ein FREMDER Harness in 9
von 12 Vergleichen. Eingeschränkt auf die vier Anthropic-Modelle
(natives Harness Claude Code): Claude Code gewinnt nur 2 von 8, und
beide Male ist es Claude Fable 5. Bei Opus 4.8, Sonnet 4.6 und Haiku
4.5 ist auf BEIDEN Benchmarks ein anderer Harness vorn.

Kostenseite, geometrisches Mittel der Verhältnisse über alle sieben
Modelle: Claude Code kostet auf SWE-bench Lite 2,0× so viel wie Pi und
1,6× so viel wie Codex; auf Terminal-Bench 2.0 1,5× so viel wie Pi. Der
Erfolgs-Unterschied bleibt im selben Zeitraum klein (SWE: cc−pi
+1,4 Punkte, codex−pi +1,7 Punkte; Terminal-Bench 2.0: BEIDE liegen im
Mittel unter Pi, −4,9 bzw. −4,3 Punkte). Schlimmster Einzelfall:
GPT-5.6 Luna kostet in Claude Code das 5,1-Fache von Pi, für ganze
+2,3 Prozentpunkte Erfolg.

Woher der Aufpreis kommt, zeigt die nächste Folie über die Ausdauer —
und bestätigt nebenbei unabhängig, was Kapitel 10 („Gemessen an der
API-Grenze") schon an einem einzelnen Logging-Proxy zeigte: Claude
Codes Erstkontext ist auf SWE-bench Lite 13,7× so groß wie Pis (27.011
gegen 1.972 Token, gemittelt über je 630 Versuche) — 23 Werkzeuge und
76.995 Zeichen Tool-Schema gegen 4 Werkzeuge und 2.873 Zeichen.

Einschränkungen ausführlich im ⓘ: 30×3 pro Zelle (die meisten
Harness-Unterschiede im Erfolg liegen in der CI), Kosten sind
Token×eingefrorene Preisliste statt bezahltes Geld, ein 100-Turn-Cap
(traf Claude Code×Haiku auf Terminal-Bench 2.0 viermal), Pi lief nicht
im Auslieferungszustand, rohe Traces sind angekündigt, aber am
18.09.2026 noch nicht veröffentlicht.
-->

---
hideInToc: true
routeAlias: abbruch-these
---

# Die Abbruch-These, gemessen

<div class="text-sm mb-1">

**Vorhersage 2, geprüft: Gibt der eigene Harness nicht auf?** Mehr
Schritte → mehr gelöst? Drei Modelle, drei verschiedene Antworten.

</div>

<HarnessPersistence />

<div class="text-xs opacity-70 mt-1">

Ausdauer und Erfolg fallen auseinander — die These war nicht falsch,
nur nicht die Erklärung für den Preis. SWE-bench Lite, HarnessTax.

</div>

<!--
Die HN-These, noch einmal knapp: eigener Harness → Modell gibt nicht
auf → mehr Schritte → mehr gelöst. Drei Modelle, drei verschiedene
Antworten:

GPT-5.6 Luna trägt die These: Claude Code lässt es 92,4 statt 27,1
Schritte laufen (3,4×), 6,8× so viele Tokens — UND +2,3 Punkte Erfolg.
Ausdauer hilft hier tatsächlich ein bisschen, kostet aber das 5,1-Fache.

Claude Fable 5 widerlegt die Erklärung, nicht den Befund: 15,3 gegen
15,4 Schritte sind praktisch gleich. Der Aufpreis (2,0×) steckt im
GEWICHT pro Schritt — größerer Erstkontext, mehr Tokens je Anfrage —
nicht in mehr Versuchen. Wer hier von „mehr Ausdauer" spricht, verwechselt
Kosten mit Verhalten.

Claude Haiku 4.5 dreht die These um: Claude Code bricht mit 50,9
Schritten FRÜHER ab als Pi (60,1) und Codex (62,7) — und löst mit
52,2 % auch am wenigsten von den dreien. Das genaue Gegenteil von
„gibt nicht auf".

Die Balken in den Zellen sind Data-Bars wie in Excel: Länge = Wert geteilt
durch das Spaltenmaximum der neun Zeilen (bei „Erfolg" der Prozentwert
selbst), Farbe = Harness wie der Marker im Chart davor. Sie sollen nur die
schnelle Orientierung geben — „eher hoch, eher niedrig" —, die Zahl bleibt
die Aussage. Luna in Claude Code springt so ins Auge: Schritte und Tokens
voll, Erfolg kaum länger als bei Pi.

Fazit für die Folie davor: Die Abbruch-Option ist ein realer Hebel
(Luna beweist es), aber weder notwendig (Fable 5) noch hinreichend
für den Aufpreis — und bei Haiku zeigt sich sogar das Gegenteil.
Turn-Definitionen unterscheiden sich zwischen Harnessen (ⓘ), die
Größenordnung der Unterschiede bleibt aber eindeutig.
-->

---
layout: section
---

# 8. Die fünf Schleifen

<div class="text-lg opacity-70 mt-4">

Vom Token zum Retry: **Kosten entstehen multiplikativ.**

</div>

---
clicks: 7
hideInToc: true
routeAlias: fuenf-schleifen
---

# Ein Agent ist eine Schleife aus Schleifen

<NestedLoops :clicks="$clicks" />

<div class="mt-3 text-xs opacity-60">

Autonomie-Primitive (`/goal`, `/loop`): <TalkXref slug="20260327-ai-agents" anchor="autonomie-primitive">AI Coding Agents</TalkXref> · Dauerläufer in der Praxis: <TalkXref slug="20260707-anatomy-of-autonomous-agents">Anatomie Autonomer Agenten</TalkXref>

</div>

<!--
Klick 0 bis 6 wie bisher: fünf Schleifen von innen nach außen, dann Formel und
Merksatz. Wer die Workflow-Schicht nicht zeigen will, springt nach Klick 6 mit
Pfeil-nach-unten direkt zur nächsten Folie. Pfeil-nach-rechts zeigt Klick 7.

Klick 7, optional: die Workflow-Schicht (Stand 22.11.2026). Der Agent startet
selbst Subagenten, etwa über ein Workflow-Tool oder das Agent-Tool. Jeder
Subagent fährt eine eigene Agent-Schleife mit eigenem Kontextfenster und lädt
System-Prompt, Tools und CLAUDE.md neu. Das ist der Bootstrap-Context.

Warum sitzt die Schicht zwischen /goal und Agent-Loop? Der Agent löst den
Fan-out selbst mitten in einem Turn aus, deshalb multiplizieren ihn Turns, Runs
und Versuche. Und jeder Subagent durchläuft einen ganzen Agent-Loop, deshalb
liegt die Schicht außen um den Agent-Loop. Sie ist gestrichelt, weil sie ein
Zusatz ist: Die fünf Kernschleifen bleiben fünf. Genau genommen ist es
Rekursion. Subagenten dürfen in Claude Code selbst wieder Subagenten starten,
standardmäßig bis drei Ebenen unter der Hauptsitzung.

Die drei Zahlen der Belegzeile:
- 3–10× mehr Token als ein Einzelagent bei gleicher Aufgabe: Anthropic,
  23.01.2026, interne Tests ohne veröffentlichte Methode. Die einzige
  Herstellerzahl mit der Baseline „Einzelagent“.
- ≈ 7× einer normalen Sitzung: Claude-Code-Doku zu Agent Teams, nur im Plan
  Mode und ohne Angabe der Teamgröße. Agent Teams sind nicht dasselbe wie
  Subagenten.
- 94 % der Subagenten-Token sind erneut gelesener Kontext: Messung einer
  Einzelperson über 858 Läufe (genau 94,4 %). Das sind Cache-Reads, sie kosten
  ca. ein Zehntel des Input-Preises. Token sind hier also nicht gleich Kosten.

Ehrlich bleiben: Kein Hersteller nennt einen Faktor für Subagenten in
Coding-Agenten. Die oft zitierten 15× vergleichen mit einem Chat, nicht mit
einem Einzelagenten. Unabhängige Messungen reichen von ca. 0,1× bis gut 6×: In
einem Preprint brauchen 3 von 6 Frameworks (50 %) weniger Token als der
Einzelagent. Die Architektur entscheidet, die Agentenzahl allein nicht. Details
stehen hinter „Quellen ⓘ“.

Hebel, in dieser Reihenfolge:
1. Fan-out nur, wo Teilaufgaben unabhängig sind. Anthropic selbst: Coding hat
   weniger wirklich parallelisierbare Aufgaben als Recherche.
2. Kleines Modell für Subagenten. In einer Messung über 1 674 Sitzungen erbten
   85 % der Subagenten das Hauptmodell, obwohl die meisten nur suchten.
3. Knappe Rückgabe: Der Hauptagent zahlt jede Summary in jedem Folge-Request.
4. Obergrenze setzen. Claude Code erlaubt standardmäßig 16 Workflow-Agenten
   gleichzeitig und 1 000 je Lauf und warnt ab 25 Agenten oder 1,5 Mio. Token.
5. Bootstrap klein halten, damit der Cache greift: Jeder Subagent liest ihn bei
   jedem Turn neu.
-->

---
hideInToc: true
---

# Die Rechnung: multiplikativ, nicht additiv

<div class="text-sm opacity-70 mb-1">
Modellrechnung: Ticket-Bot via `/loop`, ein 8-h-Arbeitstag, Sonnet-4.6-Preise (Vorgängermodell; Input $3/MTok · Cache-Write $3,75 · Cache-Read $0,30). Ohne Subagenten gerechnet: Fan-out käme als weiterer Faktor dazu.

</div>

<div class="grid grid-cols-2 gap-6 text-sm">
<div class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">

### 😤 Naiv

- **2 Versuche** — unklare Aufgabe, erstes Ergebnis verworfen
- **× 8 Runs** — 1-h-Intervall, API-Key-TTL 5 min ⇒ jeder Run cache-kalt
- **× 20 Turns** — vages Ziel, kein Abbruchkriterium
- **× Ø 40K Tokens** — ungepflegter Context

**= 12,8 MTok Input ≈ $38/Tag**

</div>
<div class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">

### 😌 Optimiert

- **1 Versuch** — Plan-Mode + klare Aufgabe
- **× 8 Runs** — gleiche Frequenz
- **× 10 Turns** — präzises `/goal` mit Abbruchkriterium
- **× Ø 30K Tokens** — Context-Hygiene, **~85 % aus dem Cache**

**= 2,4 MTok Input ≈ $2/Tag**

</div>
</div>

<div class="mt-4 p-3 border-1.5 border-amber-500 rounded-lg text-sm" style="background: rgba(245,158,11,0.08)">

**Faktor ~20×** — kein einzelner Trick, sondern **ein Hebel pro Schleife**. Je weiter außen, desto größer.

</div>

<!--
Modellrechnung (Input-Tokens, Output der Einfachheit halber ignoriert):
- Naiv: 2 × 8 × 20 × 40.000 = 12,8 MTok, cache-kalt ohne Cache-Nutzen
  → 12,8 × $3,00 = $38,40/Tag.
- Optimiert: 1 × 8 × 10 × 30.000 = 2,4 MTok, davon 85 % Cache-Read
  ($0,30) und 15 % Cache-Write ($3,75)
  → 2,4 × (0,85 × 0,30 + 0,15 × 3,75) = 2,4 × 0,8175 = $1,96/Tag.
- Verhältnis: 38,40 / 1,96 ≈ 19,6 → „Faktor ~20ד.
Preise: Sonnet 4.6, siehe Kap. 6 (KV-Cache: 90% Discount).
Sonnet 4.6 ist das Vorgängermodell. Mit Sonnet 5.5 ($2 / Cache-Write
$2,50 / Cache-Read $0,10, Stand 24.11.2026): naiv 12,8 × $2 ≈ $26/Tag,
optimiert 2,4 × (0,85 × 0,10 + 0,15 × 2,50) ≈ $1,10/Tag, Faktor ≈ 23.
Der neuere Tokenizer erzeugt für denselben Text etwa 30 % mehr Token;
beide Beträge steigen dann auf ≈ $33 und ≈ $1,44, der Faktor bleibt.
TTL: Der Default von 5 min gilt per API-Key, Usage-Credits und Cloud.
Im Abo (im Kontingent) bekommt die Hauptkonversation 1 h; bei
1-h-Intervall bleibt der Cache dann eher warm, ebenso per API-Key mit
promptCacheTtl: 1h (ab v2.1.242).
Output-Dimension bewusst weggelassen — die steckt in Kap. 2
(„Hardware vs. Preisliste" + Bugfix-Abrechnung).
-->

---
src: ./pages/erosion-forschung.md
---

---
src: ./pages/erosion-luna.md
---

---
layout: section
---

# 9. Source-Leak

---
hideInToc: true
---

# Source Leak: Highlights

<div class="text-xs opacity-60 mb-2">

31. März 2026: 59,8 MB Source-Map in npm — 512K Zeilen TypeScript.

</div>

<LeakStatsGrid />

<!--
Quelle: Claude-Code-Source-Map-Leak vom 31.03.2026 (cli.js.map, 59,8 MB,
512K Zeilen TypeScript, ~1.900 Dateien deobfusziert). Zahlen aus der
Community-Analyse des Leaks. 40+ Tools laut VentureBeat (02.04.2026).
9.707 Zeilen = bashParser.ts + ast.ts + bashSecurity.ts (Sabrina Ramonov);
die Validierung allein, bashSecurity.ts, hat 2.592 Zeilen.
23 Checks = BASH_SECURITY_CHECK_IDS 1–23 in bashSecurity.ts
(4 earlyValidators + 19 validators); VentureBeat: „23 sequential checks“.
Pi-Vergleichswerte: eigene Zählung im Repo earendil-works/pi, Commit
957f21c (letzter vor dem 01.04.2026), packages/coding-agent/src ohne Tests:
41.404 Zeilen in 124 Dateien. Heute (24.11.2026): 79.010 in 266 Dateien.
-->

---
clicks: 1
hideInToc: true
---

# Source Leak: Codebase-Größen

<div class="text-sm opacity-70 mb-1">
<span v-click.hide>Balken zeigen ausgewählte Module im Claude-Code-Leak.</span>
<span v-after>Violette Linie = Pis Agent-Kern (~1,9K Zeilen). Claude Codes Bash-Parser + Security allein ist rund 5× so groß.</span>

</div>

<LeakModuleBar />

<!--
Zeilen aus eigener Zählung, Stand 24.11.2026: Mirror
github.com/Tinkeringg-Lab/claude-code (Leak 2.1.88), nur .ts/.tsx, wc -l.
services/mcp 12.310 (davon client.ts 3.348), Bash-Parser + Security
9.707 (3 Dateien, davon bashSecurity.ts 2.592), utils/permissions 9.409,
tools/AgentTool 6.782, services/compact 3.960. src/tools gesamt hat
50.828 Zeilen und enthält AgentTool und bashSecurity.ts, deshalb kein
eigener Balken. KAIROS ist ein Feature-Flag in 61 Dateien, kein Modul.
Pi-Linie: packages/agent/src, Commit 957f21c (01.04.2026), 1.859 Zeilen;
heute 2.548. Der ganze Pi Coding Agent hatte damals 41.404 Zeilen.
9.707 / 1.859 ≈ 5,2.
-->

---
layout: section
---

# 10. Architektur-Vergleich

---
hideInToc: true
---

# Taxonomie: Brand-Verwirrung

<div class="text-sm opacity-70 mb-1">
"Gemini" ist 6 Produkte. "Codex" ist 7 Dinge. "Pi" ist 3 völlig verschiedene Produkte mit identischem Namen.

</div>

<TaxonomyTreemap />

---
hideInToc: true
---

# Architektur-Radar

<div class="text-sm opacity-70 mb-1">
Sechs Harnesses, sechs Philosophien. Klick in der Legende zum Ein-/Ausblenden. Höher ≠ besser.

</div>

<RadarCompare />

---
hideInToc: true
routeAlias: api-grenze
---

# Gemessen an der API-Grenze: Claude Code vs. OpenCode

<div class="text-sm opacity-70 mb-1">
Logging-Proxy zwischen Harness und Model-Endpoint (Systima, 07/2026) — exakte Payloads + Usage-Blöcke, 273 hash-verkettete Records.

</div>

<ApiBoundaryStats />

<div class="mt-3 text-xs opacity-60">

**Modellabhängig:** Auf Fable 5 schrumpft die Baseline auf 3,3× (62% weniger Prompt-Zeichen, gleiche 27 Tools) — aber die Konvergenz kippt: 6 statt 3 Requests, ~298K vs. 133K Tokens. **Batching ist Modell-Verhalten, keine Harness-Konstante.**

</div>

<!--
Quelle: systima.ai/blog/claude-code-vs-opencode-token-overhead (12.07.2026),
Zahlen am Primärtext verifiziert 14.07.2026. Setup: Claude Code 2.1.207 vs.
OpenCode 1.17.18, claude-sonnet-4-5 gepinnt; reduzierte Matrix auf Fable 5.
- 27 Tools vs. „40+" im Leak-Kapitel: der Leak (März 2026) zählte im
  Quellcode registrierte Tools; Systima zählte das tools-Array über den Draht
  inkl. Background-Agent-/Orchestration-Suite (Task-Familie, CronCreate,
  Monitor, …). Die Tools-Referenz nennt heute 52 (Stand 24.11.2026).
- Cache-Writes: Spanne 5,9×–54× je nach Cache-Temperatur; Mid-Session-Rewrites
  reproduziert (43K/37K auf Sonnet, 50K/86K auf Fable). OpenCode blieb bis auf
  einen ~6K-Write byte-stabil.
- Caveats: Gateway (Meridian) im Messpfad, Envelope (~6,2K Sonnet / ~3,5K
  Fable) herausgerechnet; Payload-Zahlen exakt, Metered-Zahlen Cold-Cache-
  Anker. T3-Konvergenz = eine Beobachtung einer Task-Form; Fable-Lanes kleine
  Stichprobe. Nebenfund: Gateway tauschte still Modell-Snapshots aus — „wer
  nicht an der API-Grenze loggt, weiß nicht, welches Modell antwortet."
- Instruction-File-Mechanik: CC 2.1.207 ignorierte AGENTS.md still (nur
  CLAUDE.md); OpenCode liest beide. → Memory-Slide Kapitel 5.
  Nachtrag (Stand 24.11.2026): Seit v2.1.277 liest Claude Code AGENTS.md,
  wenn im Arbeitsverzeichnis und darüber kein CLAUDE.md oder
  CLAUDE.local.md liegt (Default `claude-md-or-agents-md`). Liegen beide
  vor, gilt nur CLAUDE.md; beide zusammen erst mit
  `claude-md-and-agents-md`.
- HarnessTax (Kapitel 7, Folie "Der Harness als zweite Achse") bestätigt
  den Erstkontext-Befund unabhängig, mit anderer Methode (Provider-API
  statt Logging-Proxy) und anderem Modell-Fokus (sieben Modelle über
  drei Harnesse statt Sonnet/Fable über zwei) — 13,7× Claude Code gegen
  Pi (27.011 gegen 1.972 Token, gemittelt über je 630 Versuche), aus
  23 Werkzeugen und 76.995 Zeichen Tool-Schema gegen 4 Werkzeuge und
  2.873 Zeichen. Codex' eigener Aufschlag gegen Pi (5,7×: 11.308 gegen
  1.972 Token) sitzt dagegen vor allem in den Instruktionen (23.502
  gegen 2.547 Zeichen, 9,2×) —
  Claude Code und Codex zahlen den Aufpreis an verschiedenen Stellen.
  Zwei Messungen, dieselbe Richtung, macht den Befund robuster als eine
  allein.
-->

---
hideInToc: true
---

# Harness-Vergleich

<HarnessTable />

<div class="mt-3 text-xs opacity-60">

**Gemini CLI** → Antigravity ab 2026-06-18 (<TalkXref slug="20260327-ai-agents">Agents-Talk</TalkXref>). Stand: 29.04., teils 24.11.2026.

</div>

<!--
OpenCode (anomalyco/opencode) ist TypeScript; in Go geschrieben ist Charm Crush (Fork-Linie des Prototyps).

Gemini CLI wird ab 2026-06-18 schrittweise von Antigravity abgelöst; Details im Agents-Talk.

Stand der Tabelle: 29.04.2026; die Zeilen MCP, Subagents, Sandboxing, Memory und Context: 24.11.2026.

Cursor-Subagents: ja, parallel, bis Tiefe 2.
-->

---
layout: center
hideInToc: true
routeAlias: bitter-lesson
---

# Die Bitter Lesson

<div class="text-xl opacity-80 mt-4">

> _"All the value is in the RL'd model, not your 10,000 lines of abstractions."_
>
> — Gregor Zunic, Browser Use, 16.01.2026

</div>

<div class="text-sm opacity-50 mt-8">

Der klare Trend: Die Community konvergiert auf **dünne Harnesses**. Frameworks verlieren an Relevanz. Die Modell-Anbieter launchen eigene CLIs, weil der Einstiegspreis für einen Coding-Agent **nahe null** ist.

</div>

<div class="text-sm opacity-70 mt-4">

Die Zahlen dazu: <Link to="harness-tax">Der Harness als zweite Achse, Kap. 7</Link> — gleicher Erfolg, bis 5× Kosten.

</div>

<!--
Quelle: browser-use.com/posts/bitter-lesson-agent-frameworks, Gregor
Zunic (Mitgründer und CTO), 16.01.2026. Der Satz ist der Untertitel des
Posts; im Text: „99% of the work is done within the model itself. We
don't need some highly abstract framework around it." Die Begründung mit
Zahlen liefert Kapitel 7 (HarnessTax): Der Harness verschiebt den Erfolg
im Mittel nur um ±2 bis ±5 Punkte, die Kosten bis 5×.
-->

---
layout: section
---

# 11. Kernaussagen

---
hideInToc: true
---

# Kernaussagen

<div class="mt-2 space-y-4">

### 1. Agent = While-Loop + Tool-Use

Der Kern ist trivial — ~10 Zeilen Pseudocode. Weder Router noch Classifier steuern den Ablauf.

### 2. Token-Budget ist die echte Constraint

Ohne Tool Search kosten MCP-Server 17K–126K Tokens pro Request, Skills ~10–260× weniger; Claude Code lädt MCP-Tools standardmäßig erst bei Bedarf. Beim Cache zählen **Request-Anzahl und Prefix-Stabilität**, und Kosten sind **multiplikativ**.

### 3. Komplex heißt nicht besser

4 Tools und <1K System-Prompt (Pi) konkurrieren mit 27 Tools und 9.707 Zeilen Bash-Prüfung (Claude Code). Memory-Systeme wie Mem0 schlagen auf Code bisher den Lauf ohne Memory nicht.

### 4. Der Wert steckt im Modell

RL-trainierte Modelle haben das Orchestrierungs-Wissen internalisiert; die Harness-Schicht wird austauschbar. Der Hebel liegt in **Context-Engineering und Domain-Skills**, nicht in Framework-Abstraktionen.

</div>

<!--
Zu 2: Beim Cache zählen Request-Anzahl und Prefix-Stabilität mehr als die Baseline-Größe. Kosten sind multiplikativ: je weiter außen die Schleife, desto größer der Hebel.

Zu 3: 27 Tools im tools-Array jedes Requests, gemessen von Systima an Claude Code 2.1.207 (Juli 2026). Die Tools-Referenz führt rund 50 eingebaute Tools, darunter viele nur unter Bedingungen (Glob/Grep fehlen standardmäßig auf macOS/Linux/WSL, PowerShell nur unter Windows). Stand 24.11.2026.
-->

---
layout: section
---

# Bonus

<div class="text-lg opacity-70 mt-4">

Engineering-Schichten: Prompt, Context, Harness — **und vielleicht Evolution.**

</div>

<div class="text-sm opacity-50 mt-8">

Dazu DeepSWE v1 gegen v1.1: was eine geänderte Messung mit einer Pareto-Front macht.

</div>

---
hideInToc: true
---

# Vier Schichten. Ein Spektrum.

<EngineeringSchichten />

<!--
Belege, Stand 24.11.2026:
- LangChain, Blog vom 17.02.2026: deepagents-cli von knapp außerhalb der
  Top 30 in die Top 5 auf Terminal Bench 2.0, 52,8 → 66,5 %; nur der
  Harness geändert, Modell fest (gpt-5.2-codex).
- AutoGPT: Repo angelegt 16.03.2023, Release 30.03.2023; der Hype kam im
  April.
- AlphaEvolve: 48 skalare Multiplikationen für komplexwertige
  4×4-Matrizen.
- Hermes (v0.23.4): keine feste Schwelle von 5 Tool-Calls mehr. Zusätzlich
  prüft eine Background Review nach dem Turn, ob ein Skill entstehen soll;
  standardmäßig alle 10 Tool-Calling-Iterationen
  (`skills.creation_nudge_interval`).
-->

---
hideInToc: true
clicks: 2
routeAlias: pareto-v1-bonus
---

# Bonus: DeepSWE v1 gegen v1.1

<ModelRoutingHistory
  series="v1"
  old-legend="v1-Wert"
  gone-legend="in v1.1 nicht gemessen"
  :step="$clicks"
/>

<div class="text-xs opacity-70 mt-1">

**1** Andere Messung, andere Werte · **2** Andere Modellliste, andere Front · **3** Benchmark-Design: v1 ließ Git-Historie sehen, v1.1 schließt den Cheat-Pfad

</div>

<!--
Bonus hinter dem "Danke", nicht Teil des Vortrags. Drei Lehren aus einem
Chart:
1. Messmethode: v1.1 bewertet den committeten Patch in einem eigenen
   Container, setzt main auf den Startcommit und entfernt instabile Tests.
   Dieselben 113 Tasks, sechs doppelt gemessene Modelle, Sprünge von −4
   (gpt-5.4) bis +9 Punkten (gemini-3.5-flash); gemini-3.1-pro kostet
   fünfmal so viel. Datacurve: "Scores stay close."
2. Modellliste: Die Front von v1 hatte acht Punkte ab 0,62 €, die von v1.1
   vier ab 2,47 €. Der Unterschied ist die Liste, nicht die Modelle: 13 der
   15 Kreuze wurden nie wieder gemessen. Wer einen Benchmark liest, fragt
   zuerst, wer fehlt.
3. Benchmark-Design: In v1 stand das Repo im Detached-HEAD-Modus mit
   sichtbarer Historie. Datacurves Sorge: Ein Agent findet eine ähnliche,
   upstream gemergte Lösung per git log. Gemessen hat Datacurve das Cheaten
   auf SWE-Bench Pro, im Launch-Post "Introducing DeepSWE" (26.05.2026):
   18 % der Opus-4.7-Treffer und 25 % der Opus-4.6-Treffer per
   git log --all oder git show auf den Gold-Commit. Für DeepSWE v1 ist es
   ein dokumentierter Risikopfad, den v1.1 schließt. Ein Abgleich mit den
   Upstream-Repos (Stand 05.06.2026) fand keinen Fall: "results from v1.0
   remain free of this form of cheating". Abgerufen 10.10.2026.

Klick 1: v1.1 mit Pfeilen (v1-Wert zu v1.1-Wert) und Kreuzen. Klick 2: alle
Namen plus Fadenkreuz.

Entzerrte Marker: bis 4,8 px verschoben, höchstens 0,5 Prozentpunkte
senkrecht oder 3,3 % im Preis waagerecht (nur v1: gpt-5.4-mini und
mimo-v2.5-pro waagerecht, claude-opus-4.6 und claude-sonnet-4.6 senkrecht).
Fadenkreuz und Tooltip zeigen den wahren Wert. Die Zahlen rechnet
markerDodge.test.ts nach und hält sie gegen diese Notiz.
-->

---
hideInToc: true
---

# Quellen & Weiterführendes

<div class="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mt-4">
<div>

- Anthropic — _Building Effective Agents_
- Geoff Huntley — _How to Build a Coding Agent_
- Browser Use — _The Bitter Lesson of Agent Frameworks_
- Armin Ronacher — `lucumr.pocoo.org`
- Stefan Wintermeyer — _Prompt-Caching_ (iX/heise 2026) · `heise.de/-11335003`
- Systima — _Claude Code vs OpenCode: Token Overhead_ · `systima.ai`
- Anthropic Docs — _Pricing_ & _Extended Thinking_ (Token-Billing) · `platform.claude.com`
- OpenAI — _Reasoning Models_ · Google — _Gemini API Pricing_
- arXiv:2512.22066 — _Prefill vs. Decode Bottlenecks_

</div>
<div>

- Mario Zechner — **Pi** (`earendil-works/pi`)
- Boris Cherny — **Claude Code**
- Claude Code Source-Leak — `cli.js.map`, 31.03.2026
- Claude Code Docs — _Prompt-Caching_, _Checkpointing_, _Manage sessions_ · `code.claude.com/docs`

</div>
</div>

<div class="mt-6 text-sm opacity-60">

Companion-Talk: <TalkXref slug="20260327-ai-agents">Coding-Agents im Alltag</TalkXref> — Tool-Auswahl, Permissions und Praxis.

</div>

---
layout: end
hideInToc: true
---

# Danke

<div class="text-sm opacity-60 mt-2">

Quellen & Companion-Talk: siehe vorige Slide.

</div>

---
layout: default
title: Selbsttest
hideInToc: true
routeAlias: selbsttest
---

<div class="text-2xl font-semibold mb-2">Selbsttest</div>

<AgentsDetailsQuiz />

<!--
- Hinter der End-Slide: Selbststudium nach dem Vortrag. Adaptiv — startet
  mittel, passt sich der Antwortqualität an.
- Fragenpool via Web-Recherche + Fable-Generierung + adversariale Auswahl;
  Transfer-Sektion verlinkt den ai-agents-Talk (Token-Ökonomie, Skills vs. MCP).
-->
