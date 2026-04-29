---
theme: default
title: "Wie funktioniert ein Coding-Agent?"
info: |
  Architektur, Gemeinsamkeiten und Token-Verbrauch.
  Deep-Dive in Agent-Loop, Tool-Use, Context Management und die Erkenntnisse aus dem Claude-Code-Source-Leak.
monaco: true
---

# Wie funktioniert ein Coding-Agent?

Architektur, Gemeinsamkeiten und Token-Verbrauch

<div class="mt-8 text-sm opacity-60">

Zielgruppe: Software-Entwickler

</div>

---
layout: center
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

# Der Agent-Loop

<AgentLoopCode />

<div class="mt-4 text-sm opacity-70">

- Die Loop terminiert, wenn das Modell **keinen Tool-Call** mehr ausgibt
- Bei Claude Code heißt dieser Loop intern `nO` (Master Loop)
- Der Harness muss nur die Infrastruktur bereitstellen — das Modell orchestriert

</div>

---

# Agent-Loop im Detail

<AgentSimulation />

---

# Tool-Use: Wie funktionieren Tool-Calls?

<div class="grid grid-cols-2 gap-8">
<div>

### Der Ablauf

1. **Tool-Definitionen** als JSON-Schema im System-Prompt
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

**Jedes Tool kostet Tokens im System-Prompt.**

</div>
</div>

---

# Tool-Definitionen: Provider-Vergleich

<ToolDefinitions />

---

# Wie viele Tools braucht ein Agent?

<div class="text-sm opacity-70 mb-2">

Pi's 4 Tools (Read/Write/Edit/Bash) genügen — weil das Modell weiß, was `rg`, `find`, `curl` tut.

</div>

<ToolCountBar />

---

# Tool-Selection-Accuracy

<div class="text-sm opacity-70 mb-2">

Zu viele Tools = schlechtere Auswahl. Anthropic's **Tool Search Tool** (Jan 2026) löst das via On-Demand-Loading.

</div>

<ToolAccuracyLine />

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
│ Tool-Definitionen       │ ← 19+ Tools = viele Tokens
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

Claude Code: **≤25 Wörter zwischen Tool-Calls, ≤100 Wörter in finalen Antworten.** A/B-Tests zeigten ~1.2% Token-Reduktion mit expliziten Wortzahlen.

</div>
</div>

---

# Token-Ökonomie: Wohin gehen die Tokens?

<div class="text-lg font-bold mt-8">

MCP-Server saugen **17K–126K Tokens** bevor der erste Tool-Call passiert.

</div>

<div class="mt-4 text-sm opacity-70">

- Tool-Definitionen werden **bei JEDEM Request** in den System-Prompt injiziert
- Sie zählen als **Input-Tokens** und kosten bei jedem API-Call
- Skills lösen das via Progressive Disclosure: **Faktor 40–1100×** weniger Tokens
- Prompt-Caching gibt **90% Discount** — aber nur bei exaktem Prefix-Match

</div>

---
clicks: 1
---

# MCP Token-Bloat

<div class="text-sm opacity-70 mb-2">

Tool-Definitionen werden bei JEDEM Request injiziert — das ist der direkte Grund für MCP-Token-Bloat.

</div>

<McpTokenBar />

---

# Skills vs MCP: Faktor 40–1100×

<div class="text-sm opacity-70 mb-2">

Skills: ~50 Tokens Frontmatter pro Skill. MCP: volle Tool-Definitionen bei jedem Request.

</div>

<SkillsVsMcpLine />

---

# MCP Token-Bloat: Wer löst das Problem?

<div class="text-sm opacity-70 mb-2">

Nur 2 von 6 Agents haben automatisches Lazy-Loading. Die meisten setzen auf manuelles Filtern — oder ignorieren das Problem.

</div>

<McpOptTable />

---

# Claude Code ToolSearch: State of the Art

<div class="text-sm opacity-70 mb-2">

Seit v2.1.7 (Jan 2026): Aktiviert automatisch wenn MCP-Tools >10% des Context belegen. Seit v2.1.69: auch System-Tools deferred.

</div>

<ToolSearchImpact />

<div class="mt-4 text-sm opacity-60">

Drittanbieter: Atlassian **mcp-compressor** (97% Reduktion, 2–3 Meta-Tools) · Speakeasy Dynamic Toolsets (100×) · ToolHive MCP Optimizer (85%).

</div>

---

# KV-Cache: 90% Discount

<div class="grid grid-cols-2 gap-6">
<div>

<CachePricingBar />

</div>
<div class="text-sm">

### Wie funktioniert der Cache?

- Server hashed **Prefix** (Modell + Tools + System-Prompt + History)
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
- 80% des Usage-Limits mit **0 User-Inputs**
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

---

# Claude Code CLI: Drei Modi, drei Cache-Profile

<div class="text-sm opacity-70 mb-2">

Derselbe Harness, drei Cache-Charakteristiken — wer das ignoriert, zahlt schnell 10×.

</div>

<div class="grid grid-cols-3 gap-4 mt-2 text-xs">
<div class="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">

### Interaktiv (`claude`)

**TTL: 1 h** auf Max · **5 min** auf Pro/API.

Server-controlled — März-2026-Regression drückte 1h → 5m für viele User (#46829, ~17–25% Mehrkosten).

Seit **v2.1.108** explizit via `ENABLE_PROMPT_CACHING_1H` / `FORCE_PROMPT_CACHING_5M`.

</div>
<div class="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">

### Background-Subagent

**TTL: 5 min — fix.**

Lange Tool-Calls oder verspätete Permission-Prompts → Cache verfällt → voller Cache-Write.

**Fork-Mode** (`CLAUDE_CODE_FORK_SUBAGENT=1`, v2.1.117): Kind erbt Parent-Prefix → ~**90% Discount** bei parallelen Subagenten. Seit **v2.1.121** auch in `-p` und SDK.

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

</div>

---

# Sub-Agents

<div class="grid grid-cols-2 gap-8">
<div>

### Claude Code: AgentTool

- **Tiefe 1** — Sub-Agenten spawnen keine eigenen Sub-Agenten
- Jeder startet mit **frischer Conversation** (kein Parent-History)
- Lädt eigenes System-Prompt und CLAUDE.md
- Nur das **finale Summary** geht zurück an den Parent
- Modi: Fork (Standard), Teammate, Worktree

</div>
<div>

### Die Gegenposition

**Pi** hat bewusst **keine Sub-Agenten.**

> _"Spawning multiple sub-agents is an anti-pattern; it doesn't work unless you don't care if your codebase devolves into garbage."_
>
> — Mario Zechner

Stattdessen: Spawn pi-Instanzen via tmux.

</div>
</div>

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

# Memory: Einfach schlägt komplex

<div class="text-sm opacity-70 mb-2">

Bubble-Größe = Token-Kosten. Sweet Spot: oben links (niedrige Komplexität, hohe Effektivität).

</div>

<MemoryScatter />

---

# Architektur-Radar

<div class="text-sm opacity-70 mb-2">

Sechs Harnesses, sechs Philosophien. Klick in der Legende zum Ein-/Ausblenden. Höher ≠ besser.

</div>

<RadarCompare />

---

# Harness-Vergleich

<HarnessTable />

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

# Source Leak: Highlights

<div class="text-xs opacity-60 mb-2">

31. März 2026: 59.8 MB Source-Map in npm — 512K Zeilen TypeScript.

</div>

<LeakStatsGrid />

---
clicks: 1
---

# Source Leak: Codebase-Größen

<div class="text-sm opacity-70 mb-2">

<span v-click.hide>Balken zeigen die größten Module im Claude-Code-Leak.</span>
<span v-after>Violette Linie = Pi's gesamte Codebase (~3K Zeilen). Claude Code's Bash-Security allein ist 3× so groß.</span>

</div>

<LeakModuleBar />

---

# Taxonomie: Brand-Verwirrung

<div class="text-sm opacity-70 mb-2">

"Gemini" ist 6 Produkte. "Codex" ist 7 Dinge. "Pi" ist 3 völlig verschiedene Produkte mit identischem Namen.

</div>

<TaxonomyTreemap />

---

# Takeaways

<div class="mt-4 space-y-6">

### 1. Agent = While-Loop + Tool-Use

Der Kern ist trivial — 10 Zeilen Pseudocode. Kein Classifier, kein Router, keine State-Machine.

### 2. Token-Budget ist die echte Constraint

MCP-Server kosten 17K–126K Tokens pro Request. Skills lösen das mit Faktor 40–1100×. Cache-Management ist kritisch.

### 3. Einfach schlägt komplex

4 Tools und <1K System-Prompt (Pi) konkurrieren mit 19+ Tools und 9.700 Zeilen Security (Claude Code). CLAUDE.md schlägt Vector-Datenbanken.

### 4. Der Wert steckt im Modell

RL-trainierte Modelle haben das Orchestrierungs-Wissen internalisiert. Die Harness-Schicht wird austauschbar. Investiert in **Context-Engineering und Domain-Skills**, nicht in Framework-Abstraktionen.

</div>

---
layout: center
---

# Bonus: Engineering-Schichten

<div class="text-lg opacity-70 mt-4">

Prompt, Context, Harness — **und vielleicht Evolution.**

</div>

<div class="text-sm opacity-50 mt-8">

Ein Überblick über die Engineering-Disziplinen, die sich um LLM-Agenten gebildet haben.

</div>

---

# Vier Schichten. Ein Spektrum.

<EngineeringSchichten />

---
layout: end
---

# Danke

Quellen: Anthropic "Building Effective Agents" · Claude Code Source Leak (März 2026) · Mario Zechner (Pi) · Boris Cherny (Claude Code) · Geoff Huntley "How to Build a Coding Agent" · Browser Use "Bitter Lesson of Agent Frameworks" · Armin Ronacher (lucumr.pocoo.org)
