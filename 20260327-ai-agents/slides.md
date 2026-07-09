---
theme: default
title: "AI Coding Agents: Konfiguration & Autonomie"
info: |
  Systematischer Vergleich: Claude Code, Codex, Devin Desktop, Junie, OpenCode, Gemini CLI.
  Konfiguration (Primitive, Protokolle, Worktrees, Cross-Tool) und
  Autonomie & Orchestrierung (Subagents, /goal, /loop, Dynamic Workflows, Agent Teams).
monaco: true
mdc: true
transition: slide-left
colorSchema: auto
fonts:
  sans: Inter
  mono: 0xProto
hideInToc: true
lang: de
---

# AI Coding Agents: Konfiguration & Autonomie

Systematischer Vergleich: Claude Code · Codex · Devin Desktop · Junie · OpenCode · Gemini CLI

<div class="text-sm opacity-75 mt-4">

**Hinweis:** Die quelloffene **Gemini CLI** wird ab **2026-06-18** (Consumer) durch die **Antigravity CLI** (`agy`) abgelöst — ein Go-Rewrite und **nicht** zu verwechseln mit der Antigravity-**IDE** (eigenes Produkt). Enterprise läuft vorerst weiter. Details: Kapitel _Autonomie & Orchestrierung_.

**Hinweis:** **Windsurf** heißt seit **2026-06-02** **Devin Desktop** — der Rust-Rewrite **Devin Local** löst **Cascade** ab (EOL 2026-07-01), neu mit **ACP-Support**.

</div>

<!--
Quellen Antigravity (Stand 2026-05, faktengeprüft):

- Google Developers Blog, 2026-05-19 (kanonisch zur CLI-Transition):
  https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/
- Plattform / 2.0 / SDK / Managed Agents:
  https://antigravity.google

WICHTIG — drei getrennte Produkte unter der Marke "Antigravity" (nur Marke + Runtime gemeinsam):
- Antigravity IDE: agentischer VS-Code-Fork (Nov 2025), eigenständig; Agent-Manager wird zugunsten der 2.0-App abgelöst.
- Antigravity 2.0: Standalone-Desktop-App (19.05.2026), KEIN Editor; Orchestrierungs-Command-Center.
- Antigravity CLI (`agy`): Nachfolger der Gemini CLI (Go-Rewrite), teilt das Agent-Harness mit der 2.0-App — NICHT aus der IDE-Linie.

Kernfakten CLI:
- 2026-06-18: Gemini CLI / Code-Assist-Extensions stoppen Requests für Pro/Ultra/Free; Enterprise läuft weiter.
- Erbt: Agent Skills, Hooks, Subagents, Extensions (→ "Antigravity plugins"), MCP.
- Neu: async Background-Multi-Agent-Workflows + dynamische Subagents (Auto-Decompose); + Antigravity SDK + Managed Agents.
- Open-Source-Status: proprietär (anders als die Apache-lizenzierte Gemini CLI) — Community-Kritik.
  (Eine Flash-Suche widersprach mit angebl. GitHub-Repo; vor dem Vortrag final gegen antigravity.google prüfen.)
- Wörtlich: "no 1:1 feature parity right out of the gate".
-->

---
hideInToc: true
---

# Inhalt

<Toc mode="all" minDepth="1" maxDepth="1" columns="2" listClass="!list-none !pl-0" />

---
layout: section
---

# 1. Grundlagen & Primitive

---
hideInToc: true
---

# Kernbegriffe

<style>
table {
  font-size: 0.9em;
}
</style>

| Primitiv              | Was es ist                                                                        | Analogie               |
| --------------------- | --------------------------------------------------------------------------------- | ---------------------- |
| **Instruktionsdatei** | Markdown-Datei mit Projektkonventionen, bei Sessionstart in System-Prompt geladen | Projekthandbuch        |
| **Rules / Regeln**    | Modulare `.md`-Dateien, konditional oder immer geladen                            | Programmierrichtlinien |
| **Skills**            | `SKILL.md` + Skripte/Templates, laden on-demand                                   | Run-Book               |
| **Hooks**             | Shell-Befehle bei Lifecycle-Events, deterministisch                               | Git-Hooks              |
| **MCP Server**        | Externe Tool-Anbindung via Model Context Protocol                                 | Datenbank              |
| **Subagents**         | Isolierte Agent-Instanzen, je eigenes Kontextfenster (= Kostenmultiplikator)      | Praktikant             |
| **Plugins**           | Bündelung von Skills + Hooks + MCP in ein Paket                                   | npm-Paket              |

---
hideInToc: true
---

# Entscheidungsregel

**Instruktionsdateien und Rules sind beratend** — das Modell kann sie ignorieren.

**Hooks sind deterministisch** — sie laufen garantiert.

**Skills** liegen dazwischen: das Modell entscheidet, ob es sie lädt.

**MCP** stellt Fähigkeiten bereit, die das Modell sonst nicht hätte.

**Subagents** lösen Kontextfenster-Probleme.

<div class="text-sm opacity-70 mt-6">

Wie der Agent-Loop diese Primitive intern verdrahtet → Deep-Dive <TalkXref slug="20260408-agents-details">Wie funktioniert ein Coding-Agent?</TalkXref>

</div>

---
clicks: false
hideInToc: true
---

# Primitive im Überblick

<PrimitivesOverview />

---
clicks: false
hideInToc: true
---

# Vergleichsmatrix

<ComparisonMatrix />

---
layout: section
---

# 2. Instruktionen & Guardrails

---
hideInToc: true
---

# Instruktionsdateien: Hierarchie

Alle Tools: **Plain-Markdown**, kein DSL — optionales YAML-Frontmatter.

<style>
table {
  font-size: 0.74em;
}
th,
td {
  padding: 0.25em 0.5em !important;
}
</style>

| Tool              | Hierarchie                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| **Claude Code**   | `~/.claude/` → Elternverzeichnisse → Projekt-Root → Unterverzeichnisse + `.claude/rules/*.md`  |
| **Codex**         | System → User → Projekt → CLI-Flags. `AGENTS.md` vom Git-Root abwärts konkateniert             |
| **Devin Desktop** | System → Global → Workspace → AGENTS.md (4 Stufen)                                             |
| **Gemini CLI**    | System-Defaults → User → Projekt → Overrides → Env-Vars → CLI-Args + Policy Engine             |
| **OpenCode**      | Remote-Config via `.well-known/opencode`                                                       |
| **Junie**         | IDE-Defaults → `.junie/guidelines.md`; fremde Configs (`.claude/`/`.codex/`) nur als Vorschlag |

**Universell: Deny gewinnt immer** — keine niedrigere Ebene kann ein Verbot aufheben.

---
hideInToc: true
---

# Hook-Systeme: Die größte Divergenz

| Tool              | Events | Pre-Tool-Block | Besonderheit                              |
| ----------------- | ------ | -------------- | ----------------------------------------- |
| **Claude Code**   | 12+    | ✓ (Exit 2)     | 3 Handler-Typen: Shell, LLM-Prompt, Agent |
| **Gemini CLI**    | 10     | ✓              | Retry-Trigger via `AfterAgent` (Exit 2)   |
| **Devin Desktop** | 12     | ✓              | Cloud-managed Hook-Deployment             |
| **OpenCode**      | 30+    | ✓              | JS/TS-Plugins statt Shell-Skripte         |
| **Codex**         | 2      | ✗              | Nur `notify` + `userpromptsubmit`         |
| **Junie**         | —      | ✗              | Approval Gates + Live Prompting           |

**Architekturprinzip:** Hooks sind Quality Gates — sie fangen die letzten 10% auf, die das Modell trotz guter Instruktionen übersieht.

---
hideInToc: true
---

# Sandboxing und Permissions

<style>
table {
  font-size: 0.85em;
}
th,
td {
  padding: 0.3em 0.5em !important;
}
</style>

| Tool                   | Technologie                    | Besonderheit                                                        |
| ---------------------- | ------------------------------ | ------------------------------------------------------------------- |
| **Codex**              | Seatbelt / Landlock+seccomp    | `.git/`, `.codex/` immer gesperrt                                   |
| **Claude Code**        | Seatbelt / bubblewrap          | 6 Modi inkl. `auto` (Klassifikator-Safety-Net) · Deny → Ask → Allow |
| **Gemini CLI**         | Seatbelt, Docker, Podman, LXC  | Breiteste Backend-Auswahl + TOML Policy Engine                      |
| **Devin&nbsp;Desktop** | Turbo-Mode Auto-Execution      | `.codeiumignore` für Dateirestriktionen                             |
| **Junie**              | Safe/Sensitive-Klassifikation  | Regex-basierte Allowlist pro Kommando                               |
| **OpenCode**           | Per-Agent Permission-Overrides | Pro-Agent MCP-Enable/Disable                                        |

<Callout tone="warning" dense class="!my-0">
<p class="!my-0 !leading-tight" style="font-size: 11px; opacity: 0.85;"><strong>Sensible Daten lokal?</strong> Agent im <strong>Devcontainer</strong> isolieren — Sandboxes schützen nicht vor Skill-/MCP-Exfiltration.</p>
</Callout>

---
hideInToc: true
routeAlias: permission-modes
---

# Claude Code Permission Modes

Sechs Modi statt zwei. `Shift+Tab` cycelt `default → acceptEdits → plan`; `auto`/`bypassPermissions` brauchen Opt-in.

<style>
table {
  font-size: 0.85em;
}
th,
td {
  padding: 0.3em 0.5em !important;
}
</style>

| Modus               | Ohne Prompt erlaubt                     | Best für                         |
| ------------------- | --------------------------------------- | -------------------------------- |
| `default`           | Nur Reads                               | Sensitives, Onboarding           |
| `acceptEdits`       | Reads + Edits + `mkdir`/`mv`/`cp`/`sed` | Iterieren, Review per `git diff` |
| `plan`              | Nur Reads, kein Edit                    | Codebase erkunden                |
| **`auto`**          | **Alles, mit Background-Klassifikator** | **Lange Tasks, Prompt-Fatigue**  |
| `dontAsk`           | Nur vorab erlaubte Tools (sonst Deny)   | CI/Pipelines                     |
| `bypassPermissions` | Alles, ohne Checks                      | Container/VM ohne Internet       |

<Callout tone="info" dense class="!my-0">
<p class="!my-0 !leading-tight" style="font-size: 11px; opacity: 0.85;"><strong>Auto Mode</strong> (Research Preview, v2.1.83+, server-konfiguriertes Klassifikator-Modell) — Klassifikator blockt <code>curl | bash</code>, Force-Push, Prod-Deploys, IAM-Grants, externe Endpoints; Chat-Aussagen wie „don't push“ wirken als Deny. Fallback nach 3 Blocks in Folge / 20 gesamt. <strong>vs. <code>bypassPermissions</code>:</strong> Auto = unsichtbare Checks, Bypass = keine.</p>
</Callout>

---
layout: section
---

# 3. Protokolle: LSP · MCP · ACP

---
clicks: false
hideInToc: true
---

# LSP · MCP · ACP

<ProtocolCards />

---
hideInToc: true
---

# LSP vs. MCP — Keine Verwechslung

|              | LSP                           | MCP                          |
| ------------ | ----------------------------- | ---------------------------- |
| **Zweck**    | Semantisches Code-Verständnis | Externe Tool-/Datenanbindung |
| **Richtung** | Agent → Code                  | Agent → Externe Welt         |
| **Erstellt** | Microsoft, 2016               | Anthropic, 2024              |
| **Analogie** | IDE-Intelligenz               | Datenbank                    |

**LSP** gibt dem Agenten _Augen für Code_ — 50ms statt Sekunden für Symbol-Suche.

**MCP** gibt ihm _Hände für die Außenwelt_ — Zugriff auf Systeme die er sonst nicht erreicht.

Ein Agent profitiert von **beiden gleichzeitig**.

---
hideInToc: true
---

# ACP — Agent Client Protocol

**Zed + Gemini CLI (Google), 2025** — „LSP für AI-Agenten“ · JetBrains ab 2025-10

**Vor ACP:** N·M Custom-Integrationen (IDE × Agent). **Mit ACP:** einmal implementieren → läuft überall.

| Tool          | ACP | Details              |
| ------------- | --- | -------------------- |
| Claude Code   | ✓   | JetBrains-IDEs + Zed |
| Codex         | ✓   | JetBrains ab 2026.1  |
| Junie         | ✓   | JetBrains-nativ      |
| Gemini CLI    | ✓   | JetBrains + Zed      |
| Devin Desktop | ✓   | ACP-Launch Juni 2026 |

**MCP-Durchreichung:** JetBrains reicht konfigurierte MCP-Server an ACP-Agenten durch — einmal konfigurieren, alle Agenten nutzen es.

---
hideInToc: true
routeAlias: acp-abrechnung
---

# ACP — Abrechnung auf Pro/Max

Wie bei `claude -p` zählt **Claude Code via ACP** ab **2026-06-15** auf Pro/Max-Plänen gegen ein separates **Agent-SDK-Credit**, nicht gegen das (subventionierte) interaktive Subscription-Kontingent. Über das Credit hinaus zu Standard-API-Raten.

**Betroffen:** Claude Code aus Zed/JetBrains via ACP, `claude -p`, GitHub Actions, alle Drittanbieter-Tools mit Agent-SDK. **Unverändert:** Interactive Claude Code im Terminal/IDE bleibt im Subscription-Kontingent.

<!--
Quellen zur Abrechnung Agent-SDK-Credit (Stand 2026-05):

- Anthropic Help Center (kanonisch zum Billing-Split, Credit-Beträge, Start 2026-06-15):
  https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan
- Zed Blog (kanonisch zur ACP-→-Agent-SDK-Verknüpfung: "Claude Code through ACP … no longer draws from your Pro/Max subscription limits"):
  https://zed.dev/blog/anthropic-subscription-changes
- Ursprünglicher Hinweis aus der Community:
  https://x.com/ClaudeDevs/status/2054610152817619388
-->

---
layout: section
---

# 4. Interoperabilität & Praxis

---
hideInToc: true
---

# Cross-Tool-Kompatibilität

**AGENTS.md** — der emergente Standard, von 5/6 Tools unterstützt (alle außer Claude Code → `CLAUDE.md`).

**SKILL.md** — stärkster Cross-Tool-Standard. Identische Struktur über alle 6 Tools.

**Settings und Hooks** — NICHT portabel. JSON vs. TOML vs. JS-Plugins.

**Claude Code → Single-Source via `@AGENTS.md`-Import** in `CLAUDE.md` (an beliebiger Stelle, max. 5 Hops tief). Claude-spezifische Zusätze einfach darunter ergänzen. Alternative: `ln -s AGENTS.md CLAUDE.md` (Windows: Admin/Dev-Mode nötig).

Praktische Interop heute:

- **Junie** scannt `.claude/`, `.codex/`, `.cursor/` und **schlägt** Guidelines **vor** (kein vollautomatischer Import)
- **OpenCode** fällt auf `CLAUDE.md` zurück
- **Devin Desktop** entdeckt Skills aus `.agents/skills/`
- **Gemini CLI** erlaubt mehrere Dateinamen-Alternativen

---
clicks: false
hideInToc: true
---

# Zusammenspiel der Primitive

<FlowLayers />

---
clicks: false
hideInToc: true
---

# Git Worktrees für Agenten

<WorktreeOverview />

---
hideInToc: true
---

# Pipes & Headless-Mode

| Tool              | Headless           | Stdin-Pipe           | Besonderheit                           |
| ----------------- | ------------------ | -------------------- | -------------------------------------- |
| **Claude Code**   | `-p` / `--print`   | ✓ (10 MB cap)        | 3 s-Timeout · ab 2026-06-15 SDK-Credit |
| **Gemini CLI**    | `-p` / `--prompt`  | ✓                    | `--output-format json` / `stream-json` |
| **Codex**         | `codex exec` (`e`) | ✓ (Prompt-Arg `-`)   | `exec resume`, `--json`                |
| **OpenCode**      | `opencode run "…"` | ✗ (nur `-f <datei>`) | `opencode serve` für warme Sessions    |
| **Devin Desktop** | ✗                  | ✗                    | Nur IDE-integriert                     |
| **Junie**         | ✗                  | ✗                    | Nur IDE-integriert                     |

---
hideInToc: true
---

# Claude Code im Pipe-Einsatz — Stolperfallen

**1. 3-Sekunden-Timeout** — wenn binnen 3 s keine Daten ankommen, läuft Claude **ohne** Stdin weiter (Warnung auf stderr). Sobald Daten fließen, wartet er auf **EOF** — `tail -f | claude -p …` hängt deshalb ewig.

**2. Abrechnung** — ab **2026-06-15** zählt `claude -p` auf Pro/Max-Plänen gegen ein separates **Agent-SDK-Credit**, nicht gegen das interaktive Kontingent.

**3. Umgehung: vollständig puffern, dann übergeben** — Subshell läuft fertig, Claude bekommt sofort einen geschlossenen Stream.

```bash
# Bash / Zsh — Herestring puffert über $(...)
claude -p "Fasse das Transkript zusammen:" \
  <<< "$(yt-dlp --skip-download --write-auto-subs --sub-lang de "$URL")"
```

```fish
# Fish — psub schreibt in Tempfile (NICHT `psub -F` / `--fifo`,
# das reproduziert den EOF-Hang)
claude -p "Fasse zusammen:" < (yt-dlp --skip-download --write-auto-subs --sub-lang de $URL | psub)
```

Bonus: `claude -p` lässt sich mit `--resume <session-id>` zu einer bestehenden Session fortsetzen — ideal für mehrstufige Skript-Pipelines.

---
hideInToc: true
---

# Empfehlungen für Multi-Tool-Teams

1. **`AGENTS.md` als primäre Instruktionsdatei** — Claude Code via `@AGENTS.md`-Import in `CLAUDE.md` (sonst doppelte Wartung)
2. **Skills im `SKILL.md`-Format** in `.agents/skills/` — per Symlink in toolspezifische Pfade
3. **Instruktionsdateien unter 200 Zeilen** — Rules für pfadspezifische Konventionen
4. **Security schichten** — Permission-Deny + Sandbox + Ignore-Dateien
5. **Hooks für harte Quality Gates** — nicht bitten, sondern erzwingen
6. **MCP sparsam** — Token-Kosten monitoren, nicht aktive Server disconnecten
7. **Projekt-Level-Configs versionieren** — Secrets nur in User-Level oder Env-Vars

---
layout: section
---

# 5. Autonomie & Orchestrierung

Bisher: _was_ der Agent weiß. Jetzt: _wie selbständig_ er arbeitet — und was das kostet.

---
hideInToc: true
---

# Drei Achsen der Autonomie

Drei Fragen ordnen **jedes** Autonomie-Feature ein:

1. **Wer hält den Plan?** — du · das Modell (Turn für Turn) · ein Skript
2. **Reden die Worker miteinander?** — nein (Subagents) · ja (Agent Teams)
3. **Wie viele Kontextfenster?** — jedes zusätzliche **vervielfacht die Tokens**

| Achse         | Mechanismus              | Beispiel                      |
| ------------- | ------------------------ | ----------------------------- |
| **Zeit**      | wiederholtes Auslösen    | `/loop`                       |
| **Bedingung** | Stopp bei Zielerreichung | `/goal` (Haiku prüft je Turn) |
| **Breite**    | viele parallele Worker   | Dynamic Workflows             |

<div class="text-sm opacity-70 mt-3">

Seit **Fork-Mode** gilt der „Kostenmultiplikator“ nur noch abgeschwächt (~90 % Discount bei parallelen Subagents). Token-Ökonomie im Detail → <TalkXref slug="20260408-agents-details">Wie funktioniert ein Coding-Agent?</TalkXref>

</div>

---
hideInToc: true
routeAlias: autonomie-primitive
---

# Claude Code: Sechs Autonomie-Primitive

| Primitiv              | Status        | Was es tut                                                    |
| --------------------- | ------------- | ------------------------------------------------------------- |
| **Subagents**         | GA            | Isolierter Worker, eigenes Kontextfenster, nur Summary zurück |
| **Tasks**             | GA            | Aufgabenliste mit Abhängigkeiten (ersetzt TodoWrite)          |
| **`/goal`**           | GA            | Completion-Bedingung; Haiku prüft je Turn                     |
| **`/loop`**           | GA            | Cron-Intervall, session-gebunden                              |
| **Dynamic Workflows** | Preview       | JS-Skript orchestriert ≤16 parallel, Cap 1000/Run             |
| **Agent Teams**       | Experimentell | Peer-to-Peer-Mailbox, ~7× Tokens                              |

---
hideInToc: true
---

# Autonomie im Tool-Vergleich

| Tool                       | Loop (Zeit) | Goal (Bedingung) | Breite (parallel)                |
| -------------------------- | ----------- | ---------------- | -------------------------------- |
| **Claude Code**            | `/loop`     | `/goal`          | Dynamic Workflows                |
| **Codex**                  | ✗           | `/goal`          | Cloud-Sandboxes                  |
| **Antigravity CLI**        | ◐           | ✗                | async Background-Workflows       |
| **Copilot**                | ✗           | ◐ (bis PR)       | Cloud Agent                      |
| **Devin Desktop / Cursor** | ✗           | ◐                | Devin Local / Cloud (≤8)         |
| **Junie / Air**            | ✗           | Plan/Brave-Mode  | Air orchestriert mehrere Agenten |

Drei **orthogonale** Achsen — verschiedene Kostenprofile: loop ∝ Laufzeit, goal ∝ Turns, Breite multiplikativ ∝ Agenten.

---
hideInToc: true
---

# Dynamic Workflows & `ultracode`

<div class="text-sm opacity-75">Research Preview · 2026-05-28 · Opus 4.8</div>

**Mechanik:** Claude _schreibt_ ein JS-Skript, das in isolierter Background-Runtime Dutzende bis Hunderte Subagents orchestriert, die sich **adversarisch gegenseitig prüfen**.

**Limits:** ≤16 gleichzeitig · Hard-Cap 1000/Run · Subagents im `acceptEdits`-Modus.

**`ultracode`** = Effort `xhigh` + Auto-Orchestrierung, session-only (`/effort ultracode`). Eines der teuersten Features _mit zusätzlichem Aufschlag_ — Breite × Tiefe multiplikativ.

<Callout tone="warning" class="mt-4">

**Paradedisziplin & Kostenfalle:** Große Java-Refactorings sind _der_ Workflow-Use-Case — aber Hunderte Subagents = €€€€€. Deterministische **OpenRewrite**-Recipes erledigen den mechanischen Großteil token-frei, KI nur an der Determinismus-Grenze. → Vortrag <TalkXref slug="20260522-open-rewrite" />

</Callout>

---
hideInToc: true
---

# `ultracode` vs. Codex `ultra` — gleiche Idee, andere Mechanik

<div class="text-sm opacity-75">GPT-5.6 Sol · Preview 26.06.2026 · „Ultra will be in codex" (T. Sottiaux, 06.07.)</div>

<div class="text-sm">

| Aspekt          | Claude Code `ultracode`                             | Codex · GPT-5.6 Sol `ultra`                       |
| --------------- | --------------------------------------------------- | ------------------------------------------------- |
| **Auslöser**    | `/effort ultracode` (`xhigh` + Auto-Orchestrierung) | `ReasoningEffort::Ultra` → `Max` + Proactive-Mode |
| **Koordinator** | Modell _schreibt ein JS-Skript_ (isolierte Runtime) | **kein Skript** — native `ThreadSpawn`-Subagents  |
| **Steuerung**   | deterministischer JS-Fluss, adversarische Prüfung   | Delegations-Policy: Proactive/Explicit/Custom     |

<Callout tone="info" class="mt-2" dense>

**Faktencheck (Quellcode):** `openai/codex` zeigt die echte Mechanik — `Ultra`→`Max` + native `ThreadSpawn`-Subagents (`x-openai-subagent`-Header), **kein generiertes JavaScript** wie bei `ultracode`. Gleiches Ziel, andere Umsetzung.

</Callout>

<Callout tone="warning" class="mt-2" dense>

**Kostenwarnung:** Beide Wege multiplizieren Subagent-Calls → **sehr hohe Token-Kosten**. `ultracode` mit zusätzlichem Aufschlag, `ultra` vervielfacht den Verbrauch je paralleler Subagent-Ebene. Nur gezielt einsetzen.

</Callout>

</div>

<!--
Quellen:
- OpenAI Preview (26.06.2026): https://openai.com/index/previewing-gpt-5-6-sol/
- Tweet T. Sottiaux „Ultra will be in codex.": https://xcancel.com/thsottiaux/status/2073933490513752151
- Codex-Quellcode @98d28aab:
    codex-rs/core/src/client.rs#L172  (Ultra→Max)
    codex-rs/core/src/session/multi_agents.rs#L53  (MultiAgentMode, ThreadSpawn)
    codex-rs/core/src/context/multi_agent_mode_instructions.rs#L7  (Delegations-Policy)
-->

---
hideInToc: true
---

# Neue Orchestrierungs-Plattformen

**Antigravity = Dachmarke über drei getrennte Produkte:**

- **Antigravity IDE** — agentischer VS-Code-Fork (Nov 2025), eigenständig.
- **Antigravity 2.0** — Standalone-Desktop-App, Orchestrierungs-Command-Center, **kein Editor**.
- **Antigravity CLI (`agy`)** — Nachfolger der **Gemini CLI** (Go), teilt Harness mit der 2.0-App, **nicht** aus der IDE-Linie. Erbt Skills/Hooks/Subagents/Plugins/MCP; neu: async Multi-Agent-Workflows + dynamische Subagents. _Proprietär (Community-Kritik)._

**Junie + JetBrains Air** — Junie: Plan-/Brave-Mode, Subagents in `.junie/agents/`, Junie CLI (Beta 2026-03, LLM-agnostisch, BYOK). **Air = eigenes Produkt** (Preview 2026-03): orchestriert Junie/Claude/Codex/Gemini **gleichzeitig** via Docker + Worktrees.

**Cursor & Cloud-Agenten** — `cursor-agent`-CLI, Cloud Agents (≤8 parallel), best-of-n auf Worktrees. Dazu Codex Cloud & Copilot Cloud Agent.

<!--
Stand: Mai/Juni 2026. Antigravity ist eine Dachmarke über drei getrennte Produkte:
die IDE (VS-Code-Fork, Nov 2025), die Standalone-Desktop-App Antigravity 2.0
(Orchestrierung, kein Editor) und die CLI „agy“ (Go-Rewrite der Gemini CLI, proprietär,
teilt das Harness mit der 2.0-App — nicht aus der IDE-Linie). Junie-CLI ist Beta seit
2026-03 (LLM-agnostisch, BYOK); JetBrains Air ist ein eigenes Produkt (Preview 2026-03),
das Junie/Claude/Codex/Gemini gleichzeitig via Docker + Worktrees orchestriert.
-->

---
clicks: false
hideInToc: true
---

# Alle Details: Tools × Autonomie-Dimensionen

<AutonomyPivot />

---
layout: section
---

# 6. Sicherheit & Auto-Modi

---
hideInToc: true
---

# Auto-Modi: Wer entscheidet pro Tool-Call?

„Auto“ heißt bei jedem Tool etwas anderes — nur **drei** beinhalten ein echtes Urteil: ein _separates_ LLM entscheidet pro Call **allow / block / eskalieren** (reasoning-blind, damit der Hauptagent den Wächter nicht überredet).

<style>
table {
  font-size: 0.86em;
}
</style>

| Tool / Gruppe                                      | Echtes Gate-LLM          | Architektur                           |
| -------------------------------------------------- | ------------------------ | ------------------------------------- |
| **Cursor** (Auto-Review)                           | ✓ Klassifikator-Subagent | Sandbox-first                         |
| **Claude Code** (Auto Mode)                        | ✓ server-konfig. Modell  | Trust-Scope-first                     |
| **OpenAI Codex** (Auto-review)                     | ✓ Guardian-Subagent      | Sandbox-first **+** Reviewer (Hybrid) |
| **Gemini · Devin Desktop · Junie · OpenCode · Pi** | ✗ statische Allow/Deny   | — (YOLO/Turbo/Brave = Rückfrage aus)  |

**Sandbox-first** (Cursor/Codex): erst isolieren, Klassifikator zuletzt. **Trust-Scope-first** (Claude): Vertrauensgrenze in Prosa, Klassifikator primär. → volle Matrix nächste Folie.

---
clicks: false
hideInToc: true
---

# Auto-Modi: Klassifikator-Gates im Detail

<AutoModeGates />

---
hideInToc: true
---

# Wie sicher ist der Spaß? — Kein Sicherheits-Boundary

**Alle Anbieter sagen es selbst.** Cursor wörtlich: _„best-effort convenience, not a security boundary.“_ Der Klassifikator ist ein täuschbares LLM, nicht-deterministisch.

| Quelle                      | Workload                   | False-Negative-Rate |
| --------------------------- | -------------------------- | ------------------- |
| **Anthropic** (n=52)        | reale „overeager“-Aktionen | **17 %**            |
| **AmPermBench** (HKUST/ETH) | _adversariale_ Prompts     | **81 %**            |

**Kein Widerspruch:** ~**37 %** aller zustandsändernden Aktionen (In-Project-Edits) erreichen den Klassifikator _per Design_ nie — andere Last, nicht geschönt. Dazu: Nutzer winken **93 %** aller Prompts durch (Approval-Fatigue). → <Link to="44">Details im Bonus</Link>.

<!--
Sync-Paar mit der Bonus-Slide „Sicherheit im Detail“: Die Kennzahlen 17 % (Anthropic,
n=52, reale overeager-Aktionen) und 81 % (AmPermBench, HKUST/ETH, adversariale Prompts)
stehen bewusst auf beiden Slides — bei einer Aktualisierung BEIDE Stellen anpassen.
Stand: Mai/Juni 2026; nur AmPermBench ist unabhängig, der Rest ist selbstberichtet.
-->

---
hideInToc: true
---

# Konsequenz: Klassifikator + Sandbox + Least-Privilege — nie allein

Primärer Failure-Mode (Anthropic): **Consent-Scoping** — der Klassifikator findet „approval-shaped evidence“ und verkennt den echten Blast-Radius. **judge = defendant.**

<Callout tone="danger" class="mb-3">

**PocketOS, 2026-04-25:** Ein Cursor-Agent löschte Produktions-DB **und** Backups in _einem_ Call (~9 s) — trotz Plan-Mode und „Destructive Guardrails“.

</Callout>

**Drei deterministische Hebel** — nicht probabilistisch:

1. **Trifecta brechen:** Default-deny-Egress + Domain-Allowlist (Exfiltration kappen).
2. **Hartes Deny statt Prosa** (`permissions.deny` / `hard_deny`) — überlebt Compaction.
3. **Agent ohne echte Secrets** in Container/VM (Willison: OS-Sandbox > KI-Schutz).

---
layout: section
---

# 7. Bonusmaterial

---
clicks: false
hideInToc: true
routeAlias: skills
---

# Agent Skills — im Detail

<SkillInfographic />

---
clicks: false
hideInToc: true
---

# Clinejection — Anatomie eines Supply-Chain-Angriffs

<ClinejectionAttackChain />

---
clicks: false
hideInToc: true
---

# Clinejection — Zeitverlauf und vereitelte Eskalation

<div class="text-xs opacity-70 mb-1">Gleiche Angriffsklasse, gleiches Vortragsdatum: ein 7-Tage-Cooldown hätte das Cline-npm-Paket abgefangen → <TalkXref slug="20260327-gradle-dependency-resolution">Supply-Chain-Schutz in Gradle</TalkXref></div>

<ClinejectionTimeline />

---
clicks: 1
hideInToc: true
---

# Clinejection — Willisons „Lethal Trifecta“

<ClinejectionTrifecta />

---
hideInToc: true
---

# Claude Code Auto Mode — unter der Haube

Zwei Verteidigungs-Layer, ein deklarierter Trust-Scope — und ein **blinder Fleck**.

- **Input-Layer:** serverseitige **Prompt-Injection-Probe** scannt Tool-Outputs (Reads, Web-Fetches, Shell), _bevor_ sie in den Kontext gelangen → „treat as suspect“.
- **Output-Layer:** **2-stufiger Klassifikator (server-konfiguriertes Modell)** — Stufe 1 Single-Token-Yes/No (auf Blocken getrimmt), Stufe 2 Chain-of-Thought nur bei Flag. **Reasoning-blind:** sieht nur User-Msgs, Tool-Calls, `CLAUDE.md` — Claudes eigene Messages & Tool-_Results_ werden gestrippt.

**Reihenfolge (erster Match):** Allow/Deny-Regeln → Read-only + **In-Project-Edits auto-approved** → Rest zum Klassifikator → Block → Claude versucht Alternative. (Die sechs Permission-Modi: <Link to="permission-modes">Claude Code Permission Modes</Link>.)

<Callout tone="danger" class="mt-2">

**Tier-2-Blindspot:** In-Project-Datei-Edits laufen **ohne Klassifikator-Aufruf** — by design. Genau hier setzen die unabhängigen Stress-Tests an.

</Callout>

---
hideInToc: true
---

# `autoMode` — Vertrauen in Prosa, Verbote in Stein

Vier Felder. Das einzige, das die meisten brauchen, ist **Prosa** — kein Regex.

| Feld              | Bedeutung                                       | Härte                 |
| ----------------- | ----------------------------------------------- | --------------------- |
| **`environment`** | vertrauenswürdige Repos/Buckets/Domains (Prosa) | was gilt als „extern“ |
| **`hard_deny`**   | unbedingte Boundary — ignoriert Intent & Allows | hart (v2.1.136+)      |
| **`soft_deny`**   | destruktiv, aber vom Nutzer aufhebbar           | weich                 |
| **`allow`**       | Carve-out gegen zu strenge Built-in-Block-Regel | Ausnahme              |

```json
"autoMode": { "environment": ["$defaults",
  "Trusted buckets: s3://acme-artifacts", "Trusted domains: *.corp.example.com"] }
```

<Callout tone="warning" dense class="!my-0">
<p class="!my-0 !leading-tight" style="font-size: 12px; opacity: 0.85;"><strong>Zwei Fallen:</strong> <code>defaultMode: "auto"</code> aus dem Repo wird <em>ignoriert</em> (ein Repo darf sich nicht selbst Auto Mode geben) · „don't push“ im Chat überlebt <strong>keine</strong> Context-Compaction → für Garantien <code>permissions.deny</code> / <code>hard_deny</code>.</p>
</Callout>

---
hideInToc: true
---

# Sicherheit im Detail — Zahlen, Vorfälle, Bypässe

<div style="font-size: 0.85em">

| Quelle                       | Workload                   | Kennzahl                             |
| ---------------------------- | -------------------------- | ------------------------------------ |
| **Anthropic** (n=10.000)     | realer Traffic             | 0,4 % False-_Positive_               |
| **Anthropic** (n=52)         | reale „overeager“-Aktionen | **17 %** False-Negative              |
| **Anthropic** (n=1.000)      | synthetische Exfiltration  | 5,7 % FNR                            |
| **AmPermBench** (unabhängig) | adversariale Prompts       | **81 %** FNR (70,3 % auf Sichtbarem) |
| **OpenAI** (synthetisch)     | Injection-Recall           | 99,3 % → **90,2 %** über alle Kat.   |

</div>

**Auch die deterministische Schicht hat Lücken:** Shell-Builtin-Bypass (`export`/`cd`/`eval` umgehen die Allowlist), CurXecute & MCPoison (MCP-Config-Tausch → RCE).

<Callout tone="warning" dense class="mt-1">
<p class="!my-0 !leading-tight">Die Zahlen messen <strong>verschiedene Workloads</strong> — keine gemeinsame Skala; nur AmPermBench ist unabhängig, der Rest ist selbstberichtet.</p>
</Callout>

<!--
Sync-Paar mit „Wie sicher ist der Spaß?“: Die 17 % (Anthropic, n=52) und 81 %
(AmPermBench) stehen bewusst auf beiden Slides — bei einer Aktualisierung BEIDE
Stellen anpassen. Stand: Mai/Juni 2026. Quellen: Anthropic Auto-Mode-Posts
(self-reported), AmPermBench HKUST/ETH (unabhängig), OpenAI Injection-Recall.
Die CVEs zum Shell-Builtin-Bypass/CurXecute/MCPoison vor Zitation gegen die
Primärquelle prüfen (Attribution teils uneinheitlich).
-->

---
hideInToc: true
---

# Claude Code in IntelliJ via ACP — Installation

**Subscription statt API-Key:** `claude` per Homebrew installieren, dann in IntelliJ als ACP-Agent registrieren.

**Schritt 1 — installieren & anmelden:**

```bash
brew install --cask claude-code   # Cask = stable-Channel; opt-in Auto-Update via CLAUDE_CODE_PACKAGE_MANAGER_AUTO_UPDATE=1
claude                            # interaktiv: /login → Subscription wählen
unset ANTHROPIC_API_KEY           # sonst gewinnt der Key gegen die Subscription
claude /status                    # aktiven Auth-Modus bestätigen
```

---
hideInToc: true
---

# Claude Code in IntelliJ via ACP — Agent registrieren

<style>
/* Seit dem Inter-Headmatter wickelt der Fließtext eine Zeile mehr um —
   kompaktere Code-Blöcke halten das Callout über der Folienkante.
   (Die Zeilenboxen steuert das innere code-Element, nicht das pre.) */
pre.slidev-code,
pre.slidev-code code {
  line-height: 1.35 !important;
}
</style>

**Schritt 2:** AI-Chat → ⋮ → **Add Custom Agent** öffnet `~/.jetbrains/acp.json`. Robuster als der direkte `npx`-Aufruf ist ein Wrapper-Skript: GUI-Apps erben den Shell-`PATH` nicht, das Skript setzt `PATH` und `env` kontrolliert:

```json
{
  "agent_servers": {
    "Claude Code (Subscription)": {
      "command": "/Users/<Du>/bin/claude-acp.sh",
      "args": [],
      "env": {}
    }
  }
}
```

```sh
#!/bin/sh
# Speichern als: ~/bin/claude-acp.sh
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" # Brew (ARM/Intel) fehlt im GUI-PATH
unset ANTHROPIC_API_KEY
export ANTHROPIC_MODEL=opus # Alternativ: haiku (am billigsten), sonnet (ausgewogen), fable (sehr teuer, 2x Opus)
exec npx @agentclientprotocol/claude-agent-acp
```

<Callout tone="warning" dense class="mt-1">
<p class="!my-0 !leading-tight" style="font-size: 11px; opacity: 0.85;"><strong>Token-Abrechnung:</strong> Der ACP-Pfad nutzt den Agent-SDK-Modus → zählt ab <strong>2026-06-15</strong> auf Pro/Max gegen ein separates Agent-SDK-Credit, nicht gegen das interaktive Kontingent. (siehe <Link to="acp-abrechnung">ACP — Abrechnung auf Pro/Max</Link>)</p>
</Callout>

---
clicks: false
hideInToc: true
---

# Gesamtübersicht — Interaktiv

<FullInfographic />

---
hideInToc: true
---

# Quellen & Weiterführendes

<div class="text-sm">

**Auto Mode & Permission-Sicherheit**

- Anthropic Help Center — Agent-SDK mit Claude-Plan (Billing-Split, ab 2026-06-15)
- AmPermBench (HKUST/ETH) — unabhängiger FNR-Benchmark für Permission-Klassifikatoren
- Simon Willison — „The Lethal Trifecta“ (2025-06-16, `simonwillison.net`)

**Tools & Protokolle**

- Google Developers Blog (2026-05-19) — Gemini CLI → Antigravity CLI · `antigravity.google`
- Zed Blog — „Anthropic subscription changes“ (ACP ↔ Agent-SDK-Credit)
- ACP — Agent Client Protocol (Zed) · AGENTS.md — Linux Foundation

**Supply-Chain**

- Clinejection — Adnan Khan, Disclosure 2026-02-09 (Indirect Prompt Injection → npm)

</div>

<!--
Vollständige URLs in den Presenter Notes der Quell-Slides (S1 Antigravity-Transition,
S17 Agent-SDK-Billing). Stand: Mai/Juni 2026.
-->

---
layout: end
hideInToc: true
---

# Danke

---
layout: default
title: Selbsttest
hideInToc: true
---

<div class="text-2xl font-semibold mb-2">Selbsttest</div>

<AiAgentsQuiz />

<!--
- Hinter der End-Slide: für Selbststudium nach dem Vortrag.
- Adaptive: startet mittel, wird je nach Antwort härter oder leichter.
- Optionen-Pool aus 3 parallelen Agenten + Transfer-Web-Research kuratiert: Tool-Mechanik, Sicherheit/Clinejection, Praktische Szenarien + 4 Transfer-Fragen (Sandbox-Internals, MCP-Spec-Evolution, andere Frameworks, Lethal Trifecta).
-->
