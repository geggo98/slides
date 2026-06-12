---
theme: default
title: "Wie funktioniert ein Coding-Agent?"
lang: de
info: |
  Architektur, Gemeinsamkeiten und Token-Verbrauch.
  Deep-Dive in Agent-Loop, Tool-Use, Context Management und die Erkenntnisse aus dem Claude-Code-Source-Leak.
monaco: true
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

# Agent-Loop im Detail

<AgentSimulation />

---
layout: section
---

# 2. Tool-Use

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
4. Harness **führt aus** (lokal oder via MCP)
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

Zu viele Tools = schlechtere Auswahl. Anthropic's **Tool Search Tool** (Jan 2026) löst das via On-Demand-Loading.

</div>

<ToolAccuracyLine />

---
layout: section
---

# 3. Context Management

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

```
┌─────────────────────────┐
│ Tool-Definitionen       │ ← Request-Prefix, 19+ Tools
│ System-Prompt (statisch)│ ← CLAUDE.md, Skills, Rules
│ MCP-Tool-Definitionen   │ ← 17K–126K pro Server!
│ Conversation-History    │ ← wächst mit jeder Iteration
│ Memory (MEMORY.md)      │ ← max 200 Zeilen
│ User-Message            │ ← ganz am Ende
└─────────────────────────┘
```

</div>
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
hideInToc: true
---

# System Prompts: Statisch vs. Dynamisch

<div class="grid grid-cols-2 gap-8">
<div>

### Cache-Optimierung durch Ordering

```
tools-Array               ← stabil, global gecacht
System-Prompt (statisch)  ← Verhaltensregeln
────── CACHE BOUNDARY ──────
CLAUDE.md / Skills        ← session-spezifisch
Git-Status / Datum        ← bricht Cache nicht global
Conversation-History      ← wächst
User-Message              ← ganz am Ende
```

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

</div>
</div>

---
layout: section
---

# 4. Token-Ökonomie

---
hideInToc: true
---

# Token-Ökonomie: Wohin gehen die Tokens?

<div class="text-lg font-bold mt-8">

MCP-Server saugen **17K–126K Tokens** bevor der erste Tool-Call passiert.

</div>

<div class="mt-4 text-sm opacity-70">

- Tool-Definitionen werden **bei JEDEM Request** in den Request-Prefix (`tools`-Array) injiziert
- Sie zählen als **Input-Tokens** und kosten bei jedem API-Call
- Skills lösen das via Progressive Disclosure: **Faktor 40–1100×** weniger Tokens
- Prompt-Caching gibt **90% Discount** — aber nur bei exaktem Prefix-Match

</div>

<div class="mt-3 text-xs opacity-60">

Praxis-Sicht auf MCP-Token-Bloat und Tool-Auswahl: <TalkXref slug="20260327-ai-agents">Coding-Agents im Alltag</TalkXref>.

</div>

---
clicks: 1
hideInToc: true
---

# MCP Token-Bloat

<div class="text-sm opacity-70 mb-2">

Tool-Definitionen werden bei JEDEM Request injiziert — das ist der direkte Grund für MCP-Token-Bloat.

</div>

<McpTokenBar />

---
hideInToc: true
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

# 5. Cache & Sessions

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

# Das Session-Resume-Problem

<div class="grid grid-cols-2 gap-8">
<div>

### Was schiefgeht

- Default-TTL: **5 Minuten** — Resume nach 6 Min = voller Cache-Write
- Bug in Claude Code (#42338): Cache wird oft komplett invalidiert
- Thinking-Signaturen werden als Input-Tokens replayed

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
layout: section
---

# 6. Sandbox & Subagents

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
layout: section
---

# 7. Memory

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

**AGENTS.md** wird zum Cross-Tool-Standard — Linux Foundation, 60.000+ Open-Source-Repos.

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
---

# 8. Architektur-Vergleich

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
---

# Harness-Vergleich

<HarnessTable />

<div class="mt-3 text-xs opacity-60">

**OpenCode** (sst/opencode) ist TypeScript — in Go geschrieben ist Charm **Crush** (Fork-Linie des Prototyps). · **Gemini CLI** wird ab 2026-06-18 schrittweise von Antigravity abgelöst (<TalkXref slug="20260327-ai-agents">Details im Agents-Talk</TalkXref>). Stand: 29.04.2026.

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

# 9. Source-Leak & Brand

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
hideInToc: true
---

# Taxonomie: Brand-Verwirrung

<div class="text-sm opacity-70 mb-2">

"Gemini" ist 6 Produkte. "Codex" ist 7 Dinge. "Pi" ist 3 völlig verschiedene Produkte mit identischem Namen.

</div>

<TaxonomyTreemap />

---
layout: section
---

# 10. Kernaussagen

---
hideInToc: true
---

# Kernaussagen

<div class="mt-4 space-y-5">

### 1. Agent = While-Loop + Tool-Use

Der Kern ist trivial — ~10 Zeilen Pseudocode. Kein Classifier, kein Router, keine State-Machine.

### 2. Token-Budget ist die echte Constraint

MCP-Server kosten 17K–126K Tokens pro Request. Skills lösen das mit Faktor 40–1100×. Cache-Management ist kritisch.

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
