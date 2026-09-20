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

**Codex**: **kein** automatischer Modell-Split — Wechsel nur manuell, offener Feature-Request [openai/codex#20596](https://github.com/openai/codex/issues/20596). Seit 0.105.0 aber ein automatischer **Effort**-Split: <Link to="codex-effort">übernächste Folie</Link>.

</div>

<div class="mt-2 text-sm opacity-60">

Weitergedacht — Rollen-Routing über Modellfamilien & Harnesse hinweg: <Link to="modell-routing">Kap. 7</Link>

</div>

---
hideInToc: true
clicks: 2
---

# `opusplan`: Ersparnis & Break-even in Euro

<div class="text-sm opacity-70 mb-2">

Die Behauptung der letzten Folie nachgerechnet — Regler mit Median-Defaults aus 42,8k eigenen Claude-Code-Requests.

</div>

<OpusplanBreakEven :step="$clicks" />

<div class="text-xs opacity-70 leading-snug mt-1">

„Re-Plan" = zurück in den Plan-Modus derselben Session — davor `/compact`, ebenso bei neuem Ziel mit anderem Inhalt: sonst zahlt jeder Bruch den alten Kontext mit. Gerechnet mit 1 h — die bekommt die Hauptkonversation in jedem Claude-Abo im Kontingent.<br>
Listenpreise/MTok: Sonnet 5 $2 / $10 · Opus 5 $5 / $25 · Cache-Read 0,1× · Cache-Write 1,25× (5 min) bzw. 2× (1 h) · 1 USD = 0,876 €

</div>

<!--
Rechenmodell (components/lib/opusplanMath.ts, per vitest gepinnt):
Kosten je Phase = Output×Out-Preis + Cache-Read×0,1×In + Cache-Write×
TTL-Faktor×In (1,25× bei 5 min, 2× bei 1 h). Plan-Phase (Median): 100k
Out, 7M Read, 360k Write. Exec: Regler. Cache-Bruch beim Modellwechsel:
~93 % des Kontexts werden als Write neu berechnet (n=625 beobachtete
Bruch-Events) — bei 180k Kontext ≈ 0,59 € statt ~0,07 € als Opus-Read.

Preisbasis: opusplan löst in der TUI auf Opus 5 (Plan) und Sonnet 5
(Exec) auf; Sonnet 4.6 steht im /model-Picker gar nicht mehr. Sonnet 5
kostet $2/$10 — die zum 01.09.2026 angekündigte Erhöhung auf $3/$15
wurde gestrichen (platform.claude.com/docs/en/about-claude/pricing,
geprüft 01.09.2026). Die KV-Cache-Folie in Kapitel 6 rechnet weiter mit
Sonnet 4.6, dort geht es nur um die Multiplikatoren. Tokenizer-Falle,
falls jemand fragt: Sonnet 5 zählt ~30 % mehr Tokens als 4.6, aber Opus 5
und Sonnet 5 teilen sich denselben Tokenizer — der übergebene Kontext und
damit der Cache-Bruch sind davon unberührt. Nur die beiden Exec-Regler
stammen aus einem Messfenster über den Wechsel hinweg.

Break-even bewusst NUR gegen „Nur Opus" erzählt: beide planen mit Opus,
die Plan-Prämie (~3 $) kürzt sich raus. „Nur Sonnet" ist der
Referenzboden — noch billiger, aber mit schwächerem Plan; das ist ein
Qualitäts-, kein Preisvergleich. Break-even bei Defaults: ~1,8 MTok
Exec-Cache-Read (Output skaliert mit) — typische Exec-Phasen liegen bei
5–120 MTok, also Faktor 3–67 darüber. Ersparnis bei Defaults: 9,27 €
(−37 %); die Exec-Phase allein wird 60 % billiger — daher das „massiv
billiger" der vorigen Folie.

Anti-Pattern (aus der eigenen Historie: 60 % der Sessions kehren in den
Plan-Mode zurück, 72 % davon ohne Compaction, max. 13 Zyklen): Jede
Rückkehr ohne /compact = ZWEI Cache-Brüche — erst der Kontext als
OPUS-Write (der teure!), dann wieder als Sonnet-Write, zusammen ≈ 2,05 €,
plus Re-Plan (~45k Output) ≈ 0,99 €. Allein die Brüche fressen ab
5 Rückkehren die gesamte Ersparnis auf (mit 5-min-TTL erst ab 8).
Der Regler-Default steht auf n=3: dort liegen Anti-Pattern (24,68 €) und
„Nur Opus" (24,83 €) praktisch gleichauf — 0,15 € Abstand, 0,6 %, auf der
Leinwand nicht unterscheidbar. Die vierte Rückkehr schiebt den Balken mit
27,72 € (+11,6 %) klar darüber. Falls jemand fragt, warum die Box dann
„ab 5×" sagt: zwei Maßstäbe. Der Balkenschnitt liegt bei 3,05, weil der
Anti-Pattern-Balken auch den neuen Plan-Output mitzahlt, den der „Nur
Opus"-Balken gar nicht kennt; die 5 zählt nur die Brüche, also den Preis
des Modellwechsels allein. Mit 5-min-TTL werden daraus 4,2 und 8. Mit den
alten Sonnet-4.6-Preisen lag der Balken schon bei zwei darüber — Sonnet 5
macht die Exec-Phase billiger, also braucht das Anti-Pattern mehr
Anläufe. Merksatz: vor erneutem Planen /compact — das schrumpft den
Kontext und damit beide Brüche. Gleiches gilt beim Themenwechsel: wer
eine Session über lauter fremde Aufgaben weiterlaufen lässt, schleppt
deren Kontext mit und zahlt ihn bei jedem Bruch erneut — /compact (oder
eine neue Session) macht ihn klein.

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
(~90/Request) ignoriert; laufende Exec-Cache-Writes weggelassen (fallen
überall ähnlich an; Sonnet-Writes billiger → konservativ pro opusplan);
Re-Plan-Reads nicht bepreist; Kontext beim Wiedereintritt konstant
(Median dort 174k ≈ 177k beim Erst-Wechsel).
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

<div class="text-xs opacity-60 leading-snug mt-2">Der Effort-Wechsel <b>bricht den Cache</b> wie ein Modellwechsel: <code>reasoning.effort</code> gehört zum Prefix (<a href="https://github.com/openai/codex/issues/35416">#35416</a>). <code>reasoning_effort_override</code> soll das vermeiden — <b>⚠ in 0.154/0.155 scheitert damit auf Sol, Terra und Luna jeder Turn</b> (HTTP 400, <a href="https://github.com/openai/codex/issues/44751">#44751</a>); nur Astra läuft, Fix erst ab 0.156. Effort-Faktor: <Link to="pareto-historie">Effort-Falle, Kap. 7</Link>.</div>

</div>
<div>

<CodexEffortTui :step="$clicks" style="--ctui-height: 372px" />

</div>
</div>

<!--
Klicks (acht, nur die Klicks laufen im Presenter- und im Publikumsfenster
synchron; die Tipp-Animation läuft je Fenster). Erst der globale Teil, im
Default-Mode: 1 tippt /model, die Slash-Zeile erscheint, dann öffnet sich
„Select Model and Effort“ — sol ist Default, terra „current“. 2 „Select
Reasoning Level for gpt-5.6-sol“, der Cursor bleibt auf Medium. 3 „Model
changed to gpt-5.6-sol medium“ — das schreibt model UND
model_reasoning_effort GLOBAL, links werden beide Zeilen grün. Dann der
Plan-Teil: 4 tippt /plan, die Statuszeile zeigt „Plan mode“. 5 tippt
/model erneut — sol ist jetzt „current“ und BLEIBT gewählt. Das ist der
Punkt, an dem Leute scheitern: Wer hier ein anderes Modell wählt, bekommt
KEINEN Dialog, Codex schreibt model und model_reasoning_effort still
global (should_prompt_plan_mode_reasoning_scope in
tui/src/chatwidget/model_popups.rs, rust-v0.155.1: selected_model !=
current_model → false; Issue #38236 beschreibt genau diese Falle). 6 der
Cursor wandert von Medium auf Extra high; links ist
plan_mode_reasoning_effort schwach markiert, weil erst der nächste Dialog
entscheidet, ob der Wert dorthin geht. 7 „Apply reasoning change“ — Option
1 „Apply to Plan mode override“ schreibt nur plan_mode_reasoning_effort,
die Zeile leuchtet allein. 8 „Model changed to gpt-5.6-sol xhigh for Plan
mode.“, Statuszeile gpt-5.6-sol xhigh · Plan mode; links stehen alle drei
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
shared/components/brainless); die Texte sind wörtlich aus Codex CLI
0.153.4 (Screenshots 19.09.2026) bzw. aus den Quellen unten. Der Dialog
in Klick 5 zeigt den Moment VOR dem ersten Override, die TOML-Zeile ist
sein Ergebnis. Die zweite Beschreibung endet auf „built-in Plan default
(medium)“, weil kein plan_mode_reasoning_effort gesetzt ist: medium ist
der fest eingebaute Plan-Preset-Wert
(models-manager/src/collaboration_mode_presets.rs, per
collaborationMode/list an die TUI), unabhängig von model_reasoning_effort
und Modell — der TUI-Test plan_mode.rs belegt genau diese Formulierung.

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
antwortet 400. Der Key gilt auch je [profiles.x]. Installiert hier: CLI
0.153.4 und das App-Bundle 0.154.0-alpha.6.2 (≈ Stable 0.154.0 vom
09.09.2026), beide kennen den Key.

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
12 % je Wechsel. Bei 180k Kontext ist (180−10)/180 ≈ 0,94 — praktisch das
BREAK_SHARE 0,93 von opusplan, deshalb dieselbe Konstante.

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
GPT-6 Astra … in standard, single-agent mode“; Codex' Gate ist breiter
(alle Responses-Lite-Modelle: astra, sol, terra, luna) — ob die API es auf
5.6 honoriert, ist unbelegt. Der Schalter „Cache erhalten“ auf der Folie
rechnet den Zielzustand (Bruch 0), nicht den heutigen.
-->

---
hideInToc: true
routeAlias: codex-effort-wechsel
clicks: 2
---

# Codex: Ersparnis & Break-even in Euro

<div class="text-sm opacity-70 mb-2">

Dieselbe Rechnung wie bei `opusplan` — gleiches Szenario, gleiche Regler (sie sind gekoppelt), nur der Effort wechselt statt des Modells.

</div>

<CodexEffortBreakEven :step="$clicks" />

<div class="text-xs opacity-70 leading-snug mt-1">Preise/MTok, vorläufig (Sol-Aktion): Astra $10/$50 · Sol $4/$20 · Terra $2/$12 · Luna $0,20/$1,20 · Read 0,1× · Write 1,25× · TTL 30 min · 1 USD = 0,876 €</div>

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
= Output×Out-Preis + Cache-Read×0,1×In + Cache-Write×1,25×In, alle Volumina
von der opusplan-Folie (Plan: 100k Out, 7M Read, 360k Write; Kontext 180k;
Exec: Regler, 150k Out je 30 MTok Read) × Fähigkeitsfaktor c = pass@1 Opus
5 ÷ bestes pass@1 des Modells (Astra 0,99, Sol 1,01, Terra 1,06, Luna 1,10
— alle unter den Fehlerbalken, bewusst trotzdem drin). xhigh = Faktor f ×
medium für die GANZE Phase; f ist €/Task xhigh ÷ €/Task medium aus der
DeepSWE-Leiter (paretoData.ts, Stand 03.09.): Astra 1,49, Sol 2,54, Terra
3,63, Luna 6,75 — der Regler rundet auf eine Stelle. Cache-Bruch wie bei
opusplan 0,93 × Kontext × Write, aber 1,25× statt 2× (Anthropic 1-h-TTL).
Sol-Defaults (f 2,5, 30 MTok, 3 Re-Plans): Nur medium 19,18 € · Nur xhigh
47,94 € · Effort-Wechsel 28,71 € · Ersparnis 19,23 € (−40 %) · Bruch 0,74 €
· Break-even 1,1 MTok Exec-Read (Astra 3,3 — teuerster Bruch, 1,82 €) ·
Balken über „Nur xhigh“ ab 6 Rückkehren, allein die Brüche ab 13.
Die Folie selbst nennt die Vorläufigkeit nur im Badge des Rechners
(geliehene Volumina, geschätzter Faktor) und in der Preiszeile (Sol-
Aktionspreis); die Rechnung mit dem Fähigkeitsfaktor steht nur hier.
Ersparnis je Modell: Sol 19,23 € (−40 %), Terra 18,41 € (−49 %), Astra
14,50 € (−21 %), Luna 4,30 € (−58 %) — opusplan bei SEINEN Defaults: 9,27 €
(−37 %), aus opusplanMath abgeleitet (OPUSPLAN_REF), nicht abgetippt. Der
Euro-Vergleich hinkt: die Codex-Basis „Nur xhigh“ (Sol 47,94 €) ist eine
teurere Session als „Nur Opus“ (24,83 €), weil Sol über Sonnet 5 liegt und
f die ganze Session multipliziert. Preisneutral ist der Prozentwert — und
da liegt nur Astra unter opusplan; das sagt die Note-Box („opusplan schafft
−37 %“). Die Regler-Fußnote trägt bewusst keine Zahl mehr: sie wäre nur bei
den Defaults wahr, die Balken darüber bewegen sich.

Annahme „Effekt kleiner als bei Claude, weil Codex-Modelle billiger sind
und der Effort weniger ausmacht“ — geprüft, stimmt nur zum Teil: (a) pro
Token billiger als Opus 5 sind Sol/Terra/Luna, Astra kostet das Doppelte;
für die Exec-Phase zählt aber Sonnet 5 ($2/$10), und Sol ($4/$20) liegt
darüber. (b) Der Effort-Faktor ist NICHT klein: 1,5× (Astra) bis 6,8×
(Luna), Sol 2,5× — dasselbe Verhältnis wie die Opus/Sonnet-Preise.
Zweiter, unabhängiger Datenpunkt: Artificial Analysis Index v4.3,
gpt-5.6-terra, gleiche Aufgaben je Stufe — Output-Tokens medium 17 M →
xhigh 52 M (3,1×), Laufkosten $447 → $1 187 (2,7×). OpenAI selbst bleibt
qualitativ: „Higher reasoning effort can improve results for complex
tasks, but it takes longer and uses more tokens.“ (learn.chatgpt.com/
docs/models). (c) Kleiner ist allein der Write-Multiplikator (1,25× statt
2×). Absolut liegt der einzelne Bruch bei Sol gut ein Viertel ÜBER opusplan
(0,74 € gegen 0,59 €), weil Sol pro Input-Token das Doppelte von Sonnet
kostet; das Rückkehr-Paar liegt darunter (1,49 € gegen 2,05 €), weil ohne
Modellwechsel kein Opus-Write anfällt.

f gilt für die ganze Phase, nicht nur den Output — das ist keine offene
Frage, das Archiv beantwortet sie: Board-Stand c55e58f2 vom 03.09.
(data/deepswe/, derselbe, aus dem EFFORTS stammt), xhigh/medium: Sol
Kosten 2,54× · Cache-Reads 2,87× · Output 2,21× · Schritte 1,42× (Terra
3,65/4,68/3,37/1,71 · Luna 7,10/14,2/5,5/3,0 · Astra 1,49/1,45/1,45/1,10 ·
Opus 5 2,76/3,19/2,48/1,70). Die Reads wachsen mindestens so stark wie der
Output, weil xhigh mehr Schritte macht und je Schritt mehr Kontext trägt
(Sol 45k → 90k Cache je Schritt). f auf die Reads ist also eher
konservativ; nur auf den Output angewandt gäbe es f_eq ≈ 1,3 und 3,25 €
Ersparnis bei Sol — was dem 2,54× widerspräche, aus dem f stammt. Offen
bleibt: ein Plan→Exec-Split auf einem Modell ist kein ganzer Benchmark-
Lauf, und der Exec-Mix der Folie (80 % Read-Kosten, 20 % Out) ist nicht
der von DeepSWE (Sol: 44 % Read, 33 % unkachiert, 23 % Out) — deshalb
„vorläufig“. Und die Leiter ist eine Obergrenze: medium löst weniger
Aufgaben und gibt früher auf, bei Terra (35 % pass@1 auf medium) und Luna
(11 %) dominiert das, Sol (61 %) und Astra (73 %) sind belastbar. Deshalb
ist f ein Regler.

Preise: developers.openai.com/api/docs/pricing, geprüft 16.09.2026 —
Astra $10/$1/$12,50/$50 (In/Cached/Write/Out), Sol $4/$0,40/$5/$20 (Aktion
„at least through November 21, 2026“, regulär $5/$30), Terra
$2/$0,20/$2,50/$12, Luna $0,20/$0,02/$0,25/$1,20. Read 0,1×, Write 1,25×,
prompt_cache_options.ttl kennt nur "30m"; Codex fordert keine Retention
an. Im ChatGPT-Abo zählt das Kontingent, nicht der Preis — die €-Werte
sind wie bei opusplan das API-Äquivalent.

Vereinfachungen (bewusst, wie opusplan): input_tokens ignoriert, laufende
Exec-Writes weggelassen, Re-Plan-Reads nicht bepreist, Kontext beim
Wiedereintritt konstant. Zusätzlich hier: EIN Faktor f für Reads und
Output (im Archiv skalieren die Reads stärker — leicht konservativ); die
geliehenen Volumina gelten als medium-Volumina, auch die der Plan-Phase
(der xhigh-Plan liest also 2,5 × 7 = 17,5 MTok bei Sol) — liest man die
Plan-Mediane stattdessen als xhigh-Plan, bleibt die Ersparnis in € gleich,
der Prozentwert würde −49 % statt −40 %; Kontext beim Wechsel fest 180k,
also unter der 272k-Schwelle (2× Input); Rückkehr auf eine bekannte Stufe
innerhalb 30 min bräche nicht (nicht modelliert); Sol-Aktionspreis
($4/$20, bis mindestens 21.11.2026, vorher $5/$30) statt Listenpreis.
Nachtragen, sobald eigene Codex-Sessions vorliegen: Kontext, Plan-/Exec-
Volumina, gemessener Faktor — dann Konstanten in codexEffortMath.ts
ersetzen, Test-Referenzwerte nachziehen, „vorläufig“ streichen.
-->

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

<div class="text-sm opacity-70 mb-2">

Einen Pfad verlassen oder verzweigen — ohne den Prefix neu zu bauen.

</div>

<div class="grid grid-cols-2 gap-8 text-sm">
<div>

### `/rewind` — zurück auf einen früheren Turn

- `Esc Esc` oder `/rewind`: **Code**, **Konversation** oder **beides**
- Cache-seitig **gratis**: der gekürzte Verlauf _ist_ der alte Prefix — von jedem späteren Turn **warm gehalten**, über die TTL hinaus
- `/compact` **baut** einen neuen Prefix (voller Write), Rewind **trifft** einen alten
- Im selben Menü: **Summarize from/up to here** — zielgenaues `/compact`, mit dessen Kosten
- Rollt **nicht** zurück: `bash`-Edits, Subagent-Edits, Symlinks — kein Git-Ersatz

</div>
<div>

### `/branch` — Konversation verzweigen

- Kopiert die History in eine **neue Session-ID**; das Original bleibt unangetastet
- Gleicher Prozess, gleicher Prefix ⇒ der erste Request der Verzweigung **liest aus dem Cache**
- `--fork-session` startet dagegen einen **neuen Prozess**: frischer Git-Snapshot, der Prefix kann kippen
- Praxis: zwei Ansätze aus demselben Kontext, statt zweimal zu erklären
- Nicht der **Fork-Subagent** der <Link to="cache-modi">nächsten Folie</Link> — gleiche Idee, andere Ebene

</div>
</div>

<div class="mt-3 text-sm opacity-60">

**Codex**: `Esc Esc` editiert die vorige Nachricht und **forkt** den Chat, `/fork` und `codex fork` verzweigen eine Session — ein Code-Restore wie das Checkpointing fehlt ([#11626](https://github.com/openai/codex/issues/11626), [#12558](https://github.com/openai/codex/issues/12558)).

</div>

<!--
Anschluss an die opusplan-Folie: dort hieß der Merksatz „vor erneutem
Planen /compact". Hier die andere Hälfte — wer den Pfad ganz verlässt,
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
(CLAUDE_CODE_FORK_SUBAGENT) — ein Kind-Agent erbt den Parent-Prefix.
Hier verzweigt die eigene Session. Gleiche Idee, andere Ebene; das ist
die einzige Stelle im Deck, wo „Fork" zweierlei heißt.

Summarize from/up to here: praktisch top („die verbose Debug-Strecke ab
hier zusammenfassen, die Anfangsinstruktionen behalten"), cache-seitig
aber ein zielgenaues /compact — neuer, kürzerer Prefix, voller Write.
Nicht als billig verkaufen.

Grenzen einmal laut sagen: bash-Änderungen (rm/mv/cp) und Edits von
Hintergrund-Subagents kommen NICHT zurück, Symlinks und Hardlinks
werden übersprungen („Restored the code, but skipped N files"), 100
Checkpoints pro Session, 30 Tage Retention. Kein Git-Ersatz.

Codex-Stand am 25.08.2026 gegen learn.chatgpt.com/docs/developer-
commands?surface=cli geprüft: „/fork — Create a branching chat from a
previous point in conversation, preserving the original transcript" und
„Press Esc twice with an empty composer to edit the previous user
message and fork the chat from that point", dazu das Subcommand
`codex fork`. Ein Checkpoint-Restore für Code ist dort nicht
dokumentiert; die Slash-Command-Liste bewegt sich schnell, vor dem Talk
erneut gegenchecken.
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

**TTL: 1 h** (2× Write) im Abo-Kontingent — Pro/Max/Team/Enterprise · **5 min** bei API-Key & Usage-Credits.

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
Abo-Zeile am 25.08.2026 gegen code.claude.com/docs/en/prompt-caching
gegengecheckt: 1h gilt für die Hauptkonversation in jedem Claude-Abo im
Kontingent (nicht nur Max), 5 min für API-Key/Usage-Credits/Cloud —
und für Subagents, Workflows und Compaction immer, sofern nicht per
subagentPromptCacheTtl umgestellt.

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

**Nimm den billigsten Punkt der Front, der Deine Aufgaben löst** — im Zweifel unten anfangen, bei Fehlschlag eine Sprosse höher. **glm-5.3-flash** 0,21 € (63 %) → **gpt-5.6-luna** 0,53 € (67 %) → **gemini-3.8-flash** 2,07 € (74 %). Alle drei zusammen: 2,81 €, gut ein Viertel eines Laufs mit Opus 5 (10,37 €) — der nicht mehr löst als Sprosse 3. Was Du wählen kannst, hängt am Werkzeug (Filter oben): bei Windsurf sind es vier Sprossen bis 10,37 €.

</div>

<div class="text-xs opacity-70 mt-1">

DeepSWE v1.1 · 113 Tasks · mini-swe-agent · pass@1 · Datacurve 03.09. · 1 USD = 0,876 € · Board-Default + terra · Quadranten redaktionell

</div>

<!--
Diese Folie hat eine Handlungsanweisung, keinen Befund. Sie zuerst
aussprechen, alles andere ist Begründung: Nimm den billigsten Punkt der
Front, von dem Du glaubst, dass er Deine Aufgaben löst. Weißt Du es
nicht — und das ist der Normalfall —, fang unten an und geh bei einem
Fehlschlag eine Sprosse höher.

Die Leiter hat heute drei Sprossen, und die Zahl darunter ist das
Argument: 0,21 + 0,53 + 2,07 = 2,81 €. Wer die ganze Leiter hochsteigt,
also zweimal scheitert und beim dritten Versuch durchkommt, zahlt gut
ein Viertel dessen, was ein einziger Lauf mit Opus 5 kostet (10,37 €) —
und Opus 5 löst nach diesem Board nicht mehr als Sprosse 3. Deshalb ist
Eskalieren nicht die vorsichtige Variante, sondern die billige.

Die Einschränkung ehrlich dazusagen: Das gilt für Aufgaben vom Zuschnitt
dieses Benchmarks. Wo ein Fehlschlag teuer ist — Produktionsdaten, ein
Review, das jemand lesen muss —, zahlst Du für den Fehlversuch mehr als
die 21 Cent. Dann steigt man weiter oben ein.

Die Spitze der Leiter vorsichtig formulieren: gemini-3.8-flash hat mit
73,8 % den höchsten Score, den das Board ausweist, Opus 5 hat 73,7 %.
Nach unserem eigenen Kriterium — weniger als 5 Punkte Abstand heißt
gleichauf — ist das KEIN Qualitätsunterschied. Die Folie sagt deshalb
nicht „Gemini ist besser", sondern: derselbe Score kostet ein Fünftel.
Was sich geändert hat, ist der Preis.

Seit dem 03.09. steht gpt-6-astra daneben — der teuerste Punkt der
Folie, und trotzdem nicht auf der Front. Wenn jemand fragt, warum das
beste Modell des Boards nicht empfohlen wird: Weil „bestes" hier 74,12 %
gegen 73,83 % heißt, bei Fehlerbalken von ±2,9 und ±1,4. Auf ganze
Prozent gerundet — so zeichnet dieses Chart — sind beide 74 %. Und der
eine kostet 5,71 €, der andere 2,07 €.

Das Chart nimmt je Modell die BESTE gemessene Konfiguration, das Board
die höchste Effort-Stufe. Bei astra fallen die beiden weit auseinander:

  high    73,23 %   331/452    5,01 €
  xhigh   74,12 %   335/452    5,71 €   <- hier geplottet
  max     73,23 %   331/452   10,84 €   <- das Board zeigt DIESE Zeile

high und max lösen dieselben 331 von 452 Aufgaben; die höchste Stufe
kostet das Doppelte für keine einzige zusätzlich gelöste Aufgabe. Diese
Frage kommt selten von selbst — wenn doch, ist die kurze Antwort: Die
alte Regel unterstellte, dass mehr Aufwand mehr Ergebnis heißt. Das
stimmt bei vier von 22 Modellen nicht mehr. Details im ⓘ.

Zwei Vorbehalte, beide gehören dazu. Erstens ist astras Preis der
einzige auf dem Board, den Datacurve als „expected launch pricing"
ausweist: angekündigt, nicht abgerechnet, mit einer Position „compute
units", die es sonst nirgends gibt. Zweitens steht astra in keinem
Werkzeug-Katalog — am 04.09. bei Cursor und Windsurf nachgesehen, null
Treffer. Das teuerste Modell dieser Folie kann man noch gar nicht
kaufen.

Nebenbei zu den Fehlerbalken: den engsten hat jetzt astra mit ±0,83,
davor gemini-3.8-flash mit ±1,4. Opus 5 hat ±3,9.

Der Geisterring rechts davon ist der Listenpreis: Googles
Einführungspreis läuft am 31.12.2026 aus, danach verdoppelt sich der
Punkt auf 4,14 €. Auch dann bliebe er auf der Front — dann hinter
terra, das zurückkäme.

Drei Klicks im Anbieter-Filter, die sich lohnen:
- Anthropic: ein einziger Punkt, keine Kurve. Wer an einen Anbieter
  gebunden ist, hat keine Preis-Leistungs-Wahl mehr, nur noch eine
  Entscheidung.
- Windsurf: vier Frontpunkte mit Opus 5 für 10,37 € an der Spitze —
  also genau die Front von letzter Woche. Windsurfs Katalog endet bei
  Gemini 3.6 Flash. Für diese Nutzer ist der Befund dieser Folie noch
  gar nicht passiert.
- Cursor: zwei Punkte, Spitze der Neuzugang für 2,07 €. Dieselbe
  Woche, dasselbe Board, ein anderes Werkzeug, ein Fünftel des Preises.

Wenn aus dem Publikum „bei uns ist nur X freigegeben" kommt: Die Labs
darunter sind Checkboxen, mehrere gehen gleichzeitig. Anthropic allein
ist ein einziger Punkt, OpenAI allein sind vier — und zusammen sind es
immer noch dieselben vier: Opus 5 fällt heraus, weil astra denselben
gerundeten Score für 5,71 € statt 10,37 € liefert. Das ist im ganzen
Filter der einzige Fall, in dem ein zusätzliches Lab die Front NICHT
verbessert, und ein gutes Beispiel dafür, dass „mehr Auswahl" und
„bessere Auswahl" verschiedene Dinge sind. Ein Werkzeug-Preset setzt
dabei Modelle, keine Lab-Häkchen: Deshalb steht Google nach „Windsurf"
auf 2/4 und nicht auf 4/4.

Was der Filter NICHT sagt: Er zeigt Verfügbarkeit, nicht Preis. Cursor
und Windsurf rechnen nach eigenen Tarifen ab; geplottet ist der
API-Listenpreis. Und das jeweils eigene Modell fehlt — DeepSWE misst
weder Cursors Composer noch Windsurfs SWE-1.x.

Wenn jemand fragt, warum das Deck so ein Datum betont: Diese Folie
sagte Ende August „Opus 5 führt mit 74 %". Ein einziger Board-Eintrag
hat das widerlegt — und eine Woche später hat der nächste Neuzugang
gar nichts bewegt. Beides ist das Thema des Kapitels: Die Zahl ist ein
Datum, kein Naturgesetz.

Zum Harness-Vorbehalt im ⓘ („±2 bis ±5 Prozentpunkte im Mittel, Kosten
bis 5×"): Das ist ein Mittelwert über Modelle, kein Maximum — einzelne
Paare weichen stärker ab (HarnessTax, Kapitel 7). Der schärfste
vermutete Hebel dahinter ist die Abbruch-Option — das Zitat dazu (RLVR-
Task-Designer, HN, 01.09.2026) steht zwei Folien weiter auf „Harness +
Modell: Wer trägt was?". Kurz vorweg, was das für DIESE Folie bedeutet:
DeepSWE fährt mini-swe-agent, und dessen Abbruchverhalten steckt in
jedem Punkt dieser Front mit drin. Der Score ist nie das Modell allein.

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

Der Widerspruch zum eigenen Deck ist damit nicht mehr offen, sondern
gemessen entschieden: Kapitel 10 schließt mit „die Community
konvergiert auf dünne Harnesses", Kernaussage 4 mit „die
Harness-Schicht wird austauschbar" — und HarnessTax stützt genau das,
auch für die hier getesteten Aufgaben. Was bleibt, ist eine engere
These: Persistenz kann helfen (Luna), ist aber weder notwendig (Fable
5) noch hinreichend (Haiku bricht in Claude Code sogar FRÜHER ab als in
Pi und Codex) für den Aufpreis.

Kontingent-Toggle im Chart, die Limits im Detail:

1) Was der Toggle rechnet. Der Abo-Preis ist fix, begrenzt wird über
das Wochenlimit, also €/Task ∝ 1/Kontingent. Bis 13.09.2026 läuft die
+50-%-Aktion (×2/3, der volle Punkt); ab 14.09. ersetzt Anthropic sie
durch dauerhafte +25 % über der Basis (×0,8, der Geisterring) — Pro,
Max, Team und seat-basiertes Enterprise. Von der Basis aus gerechnet
ist das ein Plus, von heute aus ein Minus von 17 % (1,25/1,50 = 0,83).
Beide Rechnungen stimmen, sie haben nur verschiedene Nullpunkte. Eine
Rückkehr auf das Basislimit gibt es nicht. Quelle in ⓘ; NICHT aus dem
Support-Artikel zitieren, der stand am 01.09. noch auf „bis 31.08.".

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

Entzerrte Marker: bis 5,9 px verschoben, höchstens 1,2 Prozentpunkte
senkrecht oder 4,0 % im Preis waagerecht. Betroffen: sol und astra sowie
terra und glm-5.3 (waagerecht auseinander), muse-spark-1.2 und qwen3.8-max
(senkrecht). Mit Kontingent-Overlay rückt zusätzlich claude-fable-5 um
1,7 px. Frontpunkte rücken in jeder Ansicht nur waagerecht, auch im
Windsurf-Preset, wo terra Sprosse 2 ist. Kein dominierter Punkt rückt über
die Front oder links an seinen Dominator vorbei. Fadenkreuz und Tooltip
zeigen den wahren Wert. Die Zahlen rechnet markerDodge.test.ts nach und hält
sie gegen diese Notiz.
-->

---
hideInToc: true
clicks: 10
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

Neunter Klick (nach Station 9): die Lupe „Die Effort-Falle". Das Chart
dimmt, ein Panel zeigt die Region 1,5 bis 13 € × 62 bis 78 % vergrößert und
darin alle fünf gemessenen Effort-Stufen von gpt-6-astra als Leiter: low
1,92 €/67,0 %, medium 3,84 €/72,8 %, high 5,01 €/73,2 %, xhigh 5,71 €/74,1 %
(die geplottete Stufe), max 10,84 €/73,2 %. Die Klammer zwischen high und
max sagt es in einem Satz: 2,2-facher Preis, gleicher Score. Trugschluss:
„höherer Effort ist besser". Er kann auch einfach nur teurer sein, und das
deutlich. Vor dem Buchen die Stufen vergleichen; bei vier von 22 Modellen ist
die billigere Stufe auch die bessere (Details im ⓘ unter „Höchste
Effort-Stufe").

Zehnter Klick: „Aktueller Stand" schließt die Klammer zur Folie davor —
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
„Welches Modell wofür?“**

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
Front aus „Welches Modell wofür?" ist NICHTS davon vergleichbar: anderer
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
- HarnessTax (Kapitel 7, Folie "Der Harness als zweite Achse") bestätigt
  den Erstkontext-Befund unabhängig, mit anderer Methode (Provider-API
  statt Logging-Proxy) und anderem Modell-Fokus (sieben Modelle über
  drei Harnesse statt Sonnet/Fable über zwei) — 13,7× Claude Code gegen
  Pi (27.011 gegen 1.972 Token, gemittelt über je 630 Versuche), aus
  23 Werkzeugen und 76.995 Zeichen Tool-Schema gegen 4 Werkzeuge und
  2.873 Zeichen. Codex' eigener Aufschlag gegen Pi (2,4×) sitzt dagegen
  in den Instruktionen (23.502 Zeichen), nicht im Werkzeug-Schema —
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

**OpenCode** (sst/opencode) ist TypeScript — in Go geschrieben ist Charm **Crush** (Fork-Linie des Prototyps). · **Gemini CLI** wird ab 2026-06-18 schrittweise von Antigravity abgelöst (<TalkXref slug="20260327-ai-agents">Details im Agents-Talk</TalkXref>). Stand: 29.04.2026.

</div>

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
   auf SWE-Bench Pro, im selben Blog: 18 % der Opus-4.7-Treffer und 25 % der
   Opus-4.6-Treffer per git log --all oder git show auf den Gold-Commit. Für
   DeepSWE v1 ist es ein dokumentierter Risikopfad, den v1.1 schließt.

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

- Mario Zechner — **Pi** (`pi-mono`)
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
---

<div class="text-2xl font-semibold mb-2">Selbsttest</div>

<AgentsDetailsQuiz />

<!--
- Hinter der End-Slide: Selbststudium nach dem Vortrag. Adaptiv — startet
  mittel, passt sich der Antwortqualität an.
- Fragenpool via Web-Recherche + Fable-Generierung + adversariale Auswahl;
  Transfer-Sektion verlinkt den ai-agents-Talk (Token-Ökonomie, Skills vs. MCP).
-->
