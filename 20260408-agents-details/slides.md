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

Kein Classifier, kein Router, keine State-Machine — **das Modell entscheidet**, wann es fertig ist.

</div>

---
hideInToc: true
---

# Der Agent-Loop

<AgentLoopCode />

<div class="mt-4 text-sm opacity-70">

- Die Loop terminiert, wenn das Modell **keinen Tool-Call** mehr ausgibt
- Bei Claude Code heißt diese Loop intern `nO` (Master Loop)
- Der Harness muss nur die Infrastruktur bereitstellen — das Modell orchestriert

</div>

---
hideInToc: true
---

# Harness vs. Framework vs. Modell

<div class="grid grid-cols-3 gap-6 mt-4">
<div class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">

### Modell

Das LLM (Claude Opus 4.6, GPT-5.4, Gemini 3.1 Pro).

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

Anthropic warnt: _"Frameworks create extra layers that obscure prompts and responses."_

**Trend: verliert an Relevanz.**

</div>
</div>

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
**512K Zeilen** Claude-Code-TypeScript, deobfusziert.

</div>

<div class="text-sm opacity-50 mt-8">

Interne Namen (`nO`), Schwellwerte und Zeilenzahlen in diesem Talk stammen aus diesem Leak — **Details in Kapitel 8.**

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

<div class="mt-4 p-3 border-1.5 border-amber-500 rounded-lg text-sm" style="background: rgba(245,158,11,0.08)">

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

<div class="text-sm opacity-70 mb-2">

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

| Agent           | Tools   | Philosophie            |
| --------------- | ------- | ---------------------- |
| **Pi**          | **4**   | "Bash is all you need" |
| Codex CLI       | ~6      | Shell-zentrisch        |
| Gemini CLI      | ~12     | Mittlerer Weg          |
| **Claude Code** | **19+** | Fein-granular          |

**Jedes Tool kostet Tokens — als `tools`-Array bei jedem Request.**

</div>
</div>

---
hideInToc: true
---

# Tool-Definitionen: Provider-Vergleich

<ToolDefinitions />

---
hideInToc: true
---

# Wie viele Tools braucht ein Agent?

<div class="text-sm opacity-70 mb-2">

Pi's 4 Tools (Read/Write/Edit/Bash) genügen — weil das Modell weiß, was `rg`, `find`, `curl` tut.

</div>

<ToolCountBar />

---
hideInToc: true
---

# Tool-Selection-Accuracy

<div class="text-sm opacity-70 mb-2">

Zu viele Tools = schlechtere Auswahl. Anthropic's **Tool Search Tool** löst das — mehr dazu am Ende dieses Kapitels.

</div>

<ToolAccuracyLine />

---
clicks: 1
hideInToc: true
---

# MCP Token-Bloat

<div class="text-sm opacity-70 mb-2">

MCP-Server saugen **17K–126K Tokens**, bevor der erste Tool-Call passiert — die Tool-Definitionen werden bei **jedem** Request neu injiziert. Praxis-Sicht: <TalkXref slug="20260327-ai-agents">Coding-Agents im Alltag</TalkXref>.

</div>

<McpTokenBar />

---
hideInToc: true
routeAlias: token-oekonomie
---

# Skills vs MCP: Faktor 40–1100×

<div class="text-sm opacity-70 mb-2">

Skills: ~50 Tokens Frontmatter pro Skill. MCP: volle Tool-Definitionen bei jedem Request. Skills in der Praxis: <TalkXref slug="20260327-ai-agents">Coding-Agents im Alltag</TalkXref>.

</div>

<SkillsVsMcpLine />

---
hideInToc: true
---

# MCP Token-Bloat: Wer löst das Problem?

<div class="text-sm opacity-70 mb-2">

Nur 2 von 6 Agents haben automatisches Lazy-Loading. Die meisten setzen auf manuelles Filtern — oder ignorieren das Problem.

</div>

<McpOptTable />

---
hideInToc: true
---

# Claude Code ToolSearch: Stand der Technik

<div class="text-sm opacity-70 mb-2">

Seit v2.1.7 (Jan 2026): Aktiviert automatisch wenn MCP-Tools >10% des Context belegen. Seit v2.1.69: auch System-Tools deferred.

</div>

<ToolSearchImpact />

<div class="mt-4 text-sm opacity-60">

Drittanbieter: Atlassian **mcp-compressor** (97% Reduktion, 2–3 Meta-Tools) · Speakeasy Dynamic Toolsets (100×) · ToolHive MCP Optimizer (85%).

</div>

<!--
Stand 06/2026: Tool Search Tool seit Claude Code v2.1.7 (Jan 2026), aktiviert
automatisch ab >10 % Context-Anteil der MCP-Tools; System-Tool-Deferral seit
v2.1.69. Accuracy-Zahlen (49→74 %, 79,5→88,1 %) aus Anthropics Tool-Search-
Ankündigung. Drittanbieter-Werte aus den jeweiligen Projekt-READMEs.
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

| Provider   | Context-Window   |
| ---------- | ---------------- |
| **Claude** | 200K → 1M Tokens |
| **Gemini** | 1M Tokens        |
| **GPT-5**  | Modell-abhängig  |

Eine produktive Session füllt das **schnell** — Datei-Inhalte, Tool-Ergebnisse, History.

</div>
<div>

### Was füllt den Context?

<ContextAnatomy />

</div>
</div>

<div class="mt-4 text-sm opacity-60">

Gemessen: Ein 85K-Bootstrap (Harness + Config) belegt **>40% eines 200K-Windows** — auf jedem Request, immun gegen Cache-Discounts. Compaction kommt entsprechend früher (Messung: **Kapitel 8**).

</div>

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

Bei ~92-98% Füllstand: **20K-Token Summary**

13K Buffer reserviert. Circuit-Breaker nach 3 Fehlversuchen.

</div>
<div class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">

### Full Compact

Gesamte Conversation komprimieren

Re-inject kürzlich gelesene Dateien (≤5K/Datei). Budget auf 50K zurück.

</div>
</div>

<div class="mt-4 text-sm opacity-60">

**Pi**: Kein automatisches Kompaktieren. Tree-structured Sessions — manuelles `/compact`.

</div>

---
layout: section
---

# 5. Sandbox, Subagents & Memory

---
hideInToc: true
---

# Sandboxing im Vergleich

| Agent           | Ansatz         | Details                                                                   |
| --------------- | -------------- | ------------------------------------------------------------------------- |
| **Claude Code** | AST-basiert    | Tree-sitter WASM-Parser, 22 Validators, 9.707 Zeilen. Deny → Ask → Allow. |
| **Codex CLI**   | OS-native      | Seatbelt (macOS), Bubblewrap+seccomp (Linux). Netzwerk default aus.       |
| **Gemini CLI**  | Multi-Strategy | Docker, Podman, gVisor, LXC/LXD + OS-native. Per-Tool-Isolation.          |
| **Pi**          | **Keines**     | _"Halbherzige Guardrails sind Theater. Lauf in einem Container."_         |

<div class="mt-4 text-sm opacity-60">

Bekannte Schwäche Claude Code: Bei >50 Sub-Commands in einer Pipeline fällt die Validierung auf ein einzelnes "Ask" zurück.

Konfigurations- und Permission-Sicht: <TalkXref slug="20260327-ai-agents">Coding-Agents im Alltag</TalkXref>.

</div>

---
hideInToc: true
---

# Subagents

<div class="grid grid-cols-2 gap-8">
<div>

### Claude Code: AgentTool

- **Tiefe 1** — Subagents spawnen keine eigenen Subagents
- Jeder startet mit **frischer Conversation** (kein Parent-History)
- Lädt eigenes System-Prompt und CLAUDE.md
- Nur das **finale Summary** geht zurück an den Parent
- Modi: Standard, Worktree-Isolation, Fork (opt-in via `CLAUDE_CODE_FORK_SUBAGENT=1`)
- **Gemessen:** Fan-out auf 2 Subagents = 121K → **513K Tokens (4,2×)** — jeder liest seinen Bootstrap bei jedem Turn neu

</div>
<div>

### Die Gegenposition

**Pi** hat bewusst **keine Subagents.**

> _"Spawning multiple sub-agents is an anti-pattern; it doesn't work unless you don't care if your codebase devolves into garbage."_
>
> — Mario Zechner

Stattdessen: Spawn pi-Instanzen via tmux.

</div>
</div>

<div class="mt-4 text-xs opacity-60">

Orchestrierung im Alltag: <TalkXref slug="20260327-ai-agents">Coding-Agents im Alltag</TalkXref> · Deterministische Alternative zu LLM-Subagents: <TalkXref slug="20260522-open-rewrite">OpenRewrite</TalkXref>.

</div>

---
hideInToc: true
---

# Memory-Systeme

| Agent       | Datei                     | Hierarchie                                     |
| ----------- | ------------------------- | ---------------------------------------------- |
| Claude Code | `CLAUDE.md`               | `~/.claude/` → Projekt → Subdirs → `.local.md` |
| Codex CLI   | `AGENTS.md`               | Global → Repo → Subfolder                      |
| Gemini CLI  | `GEMINI.md`               | `~/.gemini/` → Projekt → Subdirs               |
| Pi          | `AGENTS.md` + `SYSTEM.md` | Projekt-Kontext + System-Prompt-Modifier       |

<div class="mt-4">

> _"We had all these crazy ideas about memory architectures... in the end, we shipped the simplest thing: a file that has some stuff, auto-read into context."_
>
> — Boris Cherny, Head of Claude Code

</div>

<div class="mt-4 text-sm opacity-60">

**AGENTS.md** wird zum Cross-Tool-Standard — Linux Foundation, 60.000+ Open-Source-Repos. Aber: Claude Code 2.1.207 ignorierte es **still** (las nur `CLAUDE.md`) — und eine 72-KB-Datei kostet **~20K Tokens pro Request** (Messung: Kapitel 8).

</div>

---
hideInToc: true
---

# Memory: Einfach schlägt komplex

<div class="text-sm opacity-70 mb-2">

Bubble-Größe = Token-Kosten. Sweet Spot: oben links (niedrige Komplexität, hohe Effektivität).

</div>

<MemoryScatter />

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
- Default-TTL: **5 Minuten**
- Extended: 1 Stunde (2× Write-Kosten)

### Anthropic Pricing (Sonnet 4.6)

| Typ            | Preis/MTok        |
| -------------- | ----------------- |
| Base Input     | $3.00             |
| Cache Write    | $3.75 (1.25×)     |
| **Cache Read** | **$0.30 (0.10×)** |

</div>
</div>

<div class="mt-2 text-xs opacity-60">

OpenAI und Google geben den **Cache-Read ebenfalls mit 0,1×** an. **Google** berechnet bei explizitem Caching zusätzlich Storage-Kosten — Details auf der nächsten Slide.

</div>

---
hideInToc: true
---

# `opusplan`: Opus plant, Sonnet führt aus

<div class="text-sm opacity-70 mb-2">

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

- **Sonnet 5** ist stark genug für die Ausführung — Opus ist dafür oft Overkill
- Der einmalige Cache-Bruch amortisiert sich: der **Plan wird verwendet, nicht weggeworfen**
- Ein guter Plan von einem starken Modell zahlt sich aus — **wenn** das Ergebnis nutzbar ist
- Unterm Strich: **massiv billiger** als durchgängig Opus

</div>
</div>

<div class="mt-4 text-sm opacity-60">

**Codex**: Plan-Mode ja, aber **kein** automatischer Modell-Split — Wechsel nur manuell. Offener Feature-Request: [openai/codex#20596](https://github.com/openai/codex/issues/20596).

</div>

<div class="mt-2 text-sm opacity-60">

Weitergedacht — Rollen-Routing über Modellfamilien & Harnesse hinweg: <Link to="modell-routing">Kap. 7</Link>

</div>

---
hideInToc: true
---

# System Prompts: Statisch vs. Dynamisch

<div class="grid grid-cols-2 gap-8">
<div>

### Cache-Optimierung durch Ordering

<PromptOrdering />

Der statische Teil wird **global über alle Organisationen gecacht** — massive Kostenoptimierung.

</div>
<div>

### System-Prompt-Größen

| Agent           | System-Prompt      |
| --------------- | ------------------ |
| **Pi**          | **<1.000 Tokens**  |
| Codex CLI       | Mittel             |
| Gemini CLI      | Mittel             |
| **Claude Code** | **Multi-K Tokens** |

Claude Code: **≤25 Wörter zwischen Tool-Calls, ≤100 Wörter in finalen Antworten.** A/B-Tests zeigten ~1,2% Token-Reduktion mit expliziten Wortzahlen.

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

- Default-TTL: **5 Minuten** — Resume nach 6 Min = voller Cache-Write
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
| **Anthropic** | 5 Min    | 1h (2× Write)  |
| **OpenAI**    | 5-10 Min | 24h            |
| **Google**    | 1h       | Konfigurierbar |

Google verlangt **Storage-Kosten**: $1–4.50/MTok/h. Min. 32.768 Tokens.

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
routeAlias: cache-modi
---

# Claude Code CLI: Drei Modi, drei Cache-Profile

<div class="text-sm opacity-70 mb-2">

Derselbe Harness, drei Cache-Charakteristiken — wer das ignoriert, zahlt schnell 10×.

</div>

<div class="grid grid-cols-3 gap-4 mt-2 text-xs">
<div class="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">

### Interaktiv (`claude`)

**TTL: 1 h** (2× Write-Kosten) auf Max · **5 min** auf Pro/API.

Server-controlled — März-2026-Regression drückte 1h → 5m für viele Nutzer (#46829, ~17–25% Mehrkosten).

Seit **v2.1.108** explizit via `ENABLE_PROMPT_CACHING_1H` / `FORCE_PROMPT_CACHING_5M`.

</div>
<div class="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">

### Background-Subagent

**TTL: 5 min — fix.**

Lange Tool-Calls oder verspätete Permission-Prompts → Cache verfällt → voller Cache-Write.

**Fork-Mode** (`CLAUDE_CODE_FORK_SUBAGENT=1`, v2.1.117): Kind erbt Parent-Prefix → ~**90% Discount** bei parallelen Subagents. Seit **v2.1.121** auch in `-p` und SDK.

</div>
<div class="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">

### Pipe (`claude -p`)

**Kein Cache** zwischen Aufrufen.

Escape: `--resume <id>` oder `--continue` reaktiviert den On-Disk-Prefix (innerhalb TTL = 5 min).

Anti-Pattern: Wrapper, die `claude -p` ohne `--resume` loopen — **OpenClaw #19989** (10× Kosten durch invalidierten Cache).

</div>
</div>

<div class="mt-2 text-xs opacity-60">

Stand verifiziert: 29.04.2026 — Anthropic schaltet Cache-Defaults serverseitig ohne Changelog um.

</div>

<!--
Quellen: 1h→5m-Regression #46829; ENABLE_PROMPT_CACHING_1H /
FORCE_PROMPT_CACHING_5M seit v2.1.108; Fork-Mode CLAUDE_CODE_FORK_SUBAGENT=1
seit v2.1.117 (in -p/SDK ab v2.1.121); OpenClaw #19989 (claude -p ohne
--resume = 10× Kosten). Cache-Defaults werden serverseitig ohne Changelog
umgeschaltet — vor jedem Talk gegenchecken. Stand 29.04.2026.
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
3. **Größe richtig** — Min-Länge **Sonnet 4.6: 2.048**, **Opus 4.x / Haiku 4.5: 4.096** Tok; darunter still ungecacht. Zu groß → Context Rot.
4. **TTL beachten** — jeder Treffer resettet die 5-Min-Uhr **kostenlos**; der 1h-Cache (2× Write) rechnet sich ab dem **2. Treffer**.

</div>
<div>

### Batch-Modus: nochmal −50 %

- Bis **100K Anfragen**, Antwort **≤ 24 h**, 256 MB/Batch
- Rabatt **stapelt multiplikativ** mit dem Cache → Cache-Read nur noch **0,15 $/MTok**
- Ideal für **autonome Hintergrund-Agenten** — nicht für interaktiv/zeitkritisch

<div class="mt-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg text-xs">

**Rechenbeispiel** — 10K-Tok-Systemprompt, 500 Anfragen/h:

ohne Cache **$15,00** → mit Cache **$1,53** → + Batch **$0,77**

</div>

<div class="mt-2 text-xs opacity-60">

Praxis: autonome Dauerläufer in <TalkXref slug="20260707-anatomy-of-autonomous-agents">Anatomie Autonomer Agenten</TalkXref>.

</div>

</div>
</div>

<!--
Quelle: Stefan Wintermeyer, „KI-Kosten reduzieren: Prompt-Caching" (iX/heise
2026, heise.de/-11335003). Min-Längen sind modellabhängig; Opus 4.7 nennt die
Doku 4.096, in Livetests greift der Cache reproduzierbar oft schon ab ~2.048
Token. Batch: −50% auf In+Out, stapelt multiplikativ mit dem Cache-Read-Discount
(0,30 × 0,5 = 0,15 $/MTok). Rechenbeispiel mit Sonnet-4.6-Preisen: 500×10K×$3,00
= $15,00 ungecacht; 1×10K×$3,75 + 499×10K×$0,30 = $1,53 mit Cache; +Batch $0,77.
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
---

# Welches Modell wofür? Die Datenlage

<ModelRoutingPareto />

<div v-click class="text-sm mt-1">

**Stand 07/2026 liegt kein Claude-Modell auf der Front** — aber Harness-Transfer verschiebt Scores um 10–30 Punkte (→ ⓘ). Verlasse Dich nicht blind auf Benchmarks: Teste Deinen eigenen Use-Case selbst, nutze diese Werte nur zur Orientierung.

</div>

<div class="text-xs opacity-70 mt-1">

DeepSWE v1.1 · 113 Tasks · mini-swe-agent · pass@1 · Datacurve, 17.07.2026 · 1 USD = 0,876 € (21.07.) · Quadranten redaktionell (8 € / 50 %)

</div>

---
layout: section
---

# 8. Die fünf Schleifen

<div class="text-lg opacity-70 mt-4">

Vom Token zum Retry: **Kosten entstehen multiplikativ.**

</div>

---
clicks: 6
hideInToc: true
routeAlias: fuenf-schleifen
---

# Ein Agent ist eine Schleife aus Schleifen

<NestedLoops :clicks="$clicks" />

<div class="mt-3 text-xs opacity-60">

Autonomie-Primitive (`/goal`, `/loop`): <TalkXref slug="20260327-ai-agents" anchor="autonomie-primitive">AI Coding Agents</TalkXref> · Dauerläufer in der Praxis: <TalkXref slug="20260707-anatomy-of-autonomous-agents">Anatomie Autonomer Agenten</TalkXref>

</div>

---
hideInToc: true
---

# Die Rechnung: multiplikativ, nicht additiv

<div class="text-sm opacity-70 mb-2">

Modellrechnung: Ticket-Bot via `/loop`, ein 8-h-Arbeitstag, Sonnet-4.6-Preise (Input $3/MTok · Cache-Write $3,75 · Cache-Read $0,30).

</div>

<div class="grid grid-cols-2 gap-6 text-sm">
<div class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">

### 😤 Naiv

- **2 Versuche** — unklare Aufgabe, erstes Ergebnis verworfen
- **× 8 Runs** — 1-h-Intervall, TTL 5 min ⇒ jeder Run cache-kalt
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
Output-Dimension bewusst weggelassen — die steckt in Kap. 2
(„Hardware vs. Preisliste" + Bugfix-Abrechnung).
-->

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
Community-Analyse des Leaks. Pi-Vergleichswerte aus dem pi-mono-Repo.
-->

---
clicks: 1
hideInToc: true
---

# Source Leak: Codebase-Größen

<div class="text-sm opacity-70 mb-2">

<span v-click.hide>Balken zeigen die größten Module im Claude-Code-Leak.</span>
<span v-after>Violette Linie = Pi's gesamte Codebase (~3K Zeilen). Claude Code's Bash-Security allein ist 3× so groß.</span>

</div>

<LeakModuleBar />

---
layout: section
---

# 10. Architektur-Vergleich

---
hideInToc: true
---

# Taxonomie: Brand-Verwirrung

<div class="text-sm opacity-70 mb-2">

"Gemini" ist 6 Produkte. "Codex" ist 7 Dinge. "Pi" ist 3 völlig verschiedene Produkte mit identischem Namen.

</div>

<TaxonomyTreemap />

---
hideInToc: true
---

# Architektur-Radar

<div class="text-sm opacity-70 mb-2">

Sechs Harnesses, sechs Philosophien. Klick in der Legende zum Ein-/Ausblenden. Höher ≠ besser.

</div>

<RadarCompare />

---
hideInToc: true
routeAlias: api-grenze
---

# Gemessen an der API-Grenze: Claude Code vs. OpenCode

<div class="text-sm opacity-70 mb-2">

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
- 27 Tools vs. „19+" im Leak-Kapitel: der Leak (März 2026) zählte registrierte
  Kern-Tools; Systima zählte das tools-Array über den Draht inkl. Background-
  Agent-/Orchestration-Suite (Task-Familie, CronCreate, Monitor, …).
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
-->

---
hideInToc: true
---

# Harness-Vergleich

<HarnessTable />

<div class="mt-3 text-xs opacity-60">

**OpenCode** (sst/opencode) ist TypeScript — in Go geschrieben ist Charm **Crush** (Fork-Linie des Prototyps). · **Gemini CLI** wird ab 2026-06-18 schrittweise von Antigravity abgelöst (<TalkXref slug="20260327-ai-agents">Details im Agents-Talk</TalkXref>). Stand: 29.04.2026.

</div>

---
layout: center
hideInToc: true
---

# Die Bitter Lesson

<div class="text-xl opacity-80 mt-4">

> _"All the value is in the RL'd model, not your 10,000 lines of abstractions."_
>
> — Browser Use

</div>

<div class="text-sm opacity-50 mt-8">

Der klare Trend: Die Community konvergiert auf **dünne Harnesses**. Frameworks verlieren an Relevanz. Die Modell-Anbieter launchen eigene CLIs, weil der Einstiegspreis für einen Coding-Agent **nahe null** ist.

</div>

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

Der Kern ist trivial — ~10 Zeilen Pseudocode. Kein Classifier, kein Router, keine State-Machine.

### 2. Token-Budget ist die echte Constraint

MCP-Server kosten 17K–126K Tokens pro Request. Skills lösen das mit Faktor 40–1100×. Beim Cache zählen **Request-Anzahl und Prefix-Stabilität** mehr als die Baseline-Größe — und Kosten sind **multiplikativ**: je weiter außen die Schleife, desto größer der Hebel.

### 3. Einfach schlägt komplex

4 Tools und <1K System-Prompt (Pi) konkurrieren mit 19+ Tools und 9.700 Zeilen Security (Claude Code). CLAUDE.md schlägt Vector-Datenbanken.

### 4. Der Wert steckt im Modell

RL-trainierte Modelle haben das Orchestrierungs-Wissen internalisiert; die Harness-Schicht wird austauschbar. Der Hebel liegt in **Context-Engineering und Domain-Skills**, nicht in Framework-Abstraktionen.

</div>

---
layout: section
---

# Bonus: Engineering-Schichten

<div class="text-lg opacity-70 mt-4">

Prompt, Context, Harness — **und vielleicht Evolution.**

</div>

<div class="text-sm opacity-50 mt-8">

Ein Überblick über die Engineering-Disziplinen, die sich um LLM-Agenten gebildet haben.

</div>

---
hideInToc: true
---

# Vier Schichten. Ein Spektrum.

<EngineeringSchichten />

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

- Mario Zechner — **Pi** (`pi-mono`)
- Boris Cherny — **Claude Code**
- Claude Code Source-Leak — `cli.js.map`, 31.03.2026

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
---

<div class="text-2xl font-semibold mb-2">Selbsttest</div>

<AgentsDetailsQuiz />

<!--
- Hinter der End-Slide: Selbststudium nach dem Vortrag. Adaptiv — startet
  mittel, passt sich der Antwortqualität an.
- Fragenpool via Web-Recherche + Fable-Generierung + adversariale Auswahl;
  Transfer-Sektion verlinkt den ai-agents-Talk (Token-Ökonomie, Skills vs. MCP).
-->
