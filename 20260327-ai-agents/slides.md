---
theme: default
title: "AI Coding Agents: Konfiguration & Autonomie"
info: |
  Systematischer Vergleich: Claude Code, Codex, Windsurf, Junie, OpenCode, Gemini CLI.
  Konfiguration (Primitive, Protokolle, Worktrees, Cross-Tool) und
  Autonomie & Orchestrierung (Subagents, /goal, /loop, Dynamic Workflows, Agent Teams).
monaco: true
---

# AI Coding Agents: Konfiguration & Autonomie

Systematischer Vergleich: Claude Code · Codex · Windsurf · Junie · OpenCode · Gemini CLI

<div class="text-sm opacity-75 mt-4">

**Hinweis:** Die quelloffene **Gemini CLI** wird ab **2026-06-18** (Consumer) durch die **Antigravity CLI** (`agy`) abgelöst — ein Go-Rewrite und **nicht** zu verwechseln mit der Antigravity-**IDE** (eigenes Produkt). Enterprise läuft vorerst weiter. Details: Kapitel _Autonomie & Orchestrierung_.

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

# Kernbegriffe

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

# Entscheidungsregel

**Instruktionsdateien und Rules sind beratend** — das Modell kann sie ignorieren.

**Hooks sind deterministisch** — sie laufen garantiert.

**Skills** liegen dazwischen: das Modell entscheidet, ob es sie lädt.

**MCP** stellt Fähigkeiten bereit, die das Modell sonst nicht hätte.

**Subagents** lösen Kontextfenster-Probleme.

---
clicks: false
---

# Primitive im Überblick

<PrimitivesOverview />

---
clicks: false
---

# Vergleichsmatrix

<ComparisonMatrix />

---

# Instruktionsdateien: Hierarchie

Alle Tools: **Plain-Markdown**, kein DSL — optionales YAML-Frontmatter.

| Tool            | Hierarchie                                                                                    |
| --------------- | --------------------------------------------------------------------------------------------- |
| **Claude Code** | `~/.claude/` → Elternverzeichnisse → Projekt-Root → Unterverzeichnisse + `.claude/rules/*.md` |
| **Codex**       | System → User → Projekt → CLI-Flags. `AGENTS.md` vom Git-Root abwärts konkateniert            |
| **Windsurf**    | System → Global → Workspace → AGENTS.md (4 Stufen)                                            |
| **Gemini CLI**  | System-Defaults → User → Projekt → Overrides → Env-Vars → CLI-Args + Policy Engine            |
| **OpenCode**    | Remote-Config via `.well-known/opencode`                                                      |

**Universell: Deny gewinnt immer** — keine niedrigere Ebene kann ein Verbot aufheben.

---

# Hook-Systeme: Die größte Divergenz

| Tool            | Events | Pre-Tool-Block | Besonderheit                              |
| --------------- | ------ | -------------- | ----------------------------------------- |
| **Claude Code** | 12+    | ✓ (Exit 2)     | 3 Handler-Typen: Shell, LLM-Prompt, Agent |
| **Gemini CLI**  | 10     | ✓              | Retry-Trigger via `AfterAgent` (Exit 2)   |
| **Windsurf**    | 12     | ✓              | Cloud-managed Hook-Deployment             |
| **OpenCode**    | 30+    | ✓              | JS/TS-Plugins statt Shell-Skripte         |
| **Codex**       | 2      | ✗              | Nur `notify` + `userpromptsubmit`         |
| **Junie**       | —      | ✗              | Approval Gates + Live Prompting           |

**Architekturprinzip:** Hooks sind Quality Gates — sie fangen die letzten 10% auf, die das Modell trotz guter Instruktionen übersieht.

---

# Sandboxing und Permissions

| Tool            | Technologie                    | Besonderheit                                                     |
| --------------- | ------------------------------ | ---------------------------------------------------------------- |
| **Codex**       | Seatbelt / Landlock+seccomp    | `.git/`, `.codex/` immer gesperrt                                |
| **Claude Code** | Seatbelt / bubblewrap          | 6 Modi inkl. `auto` (Classifier-Safety-Net) · Deny → Ask → Allow |
| **Gemini CLI**  | Seatbelt, Docker, Podman, LXC  | Breiteste Backend-Auswahl + TOML Policy Engine                   |
| **Windsurf**    | Turbo-Mode Auto-Execution      | `.codeiumignore` für Dateirestriktionen                          |
| **Junie**       | Safe/Sensitive-Klassifikation  | Regex-basierte Allowlist pro Kommando                            |
| **OpenCode**    | Per-Agent Permission-Overrides | Pro-Agent MCP-Enable/Disable                                     |

<p class="!my-0 !leading-tight" style="font-size: 11px; opacity: 0.85;">⚠️ <strong>Sensible Daten lokal?</strong> Agent im <strong>Devcontainer</strong> isolieren, nur unkritische Pfade mounten — Sandboxes schützen nicht vor Skill-/MCP-Exfiltration.</p>

---

# Claude Code Permission Modes

Sechs Modi statt zwei. `Shift+Tab` cycelt `default → acceptEdits → plan`; `auto`/`bypassPermissions` brauchen Opt-in.

| Modus               | Ohne Prompt erlaubt                     | Best für                         |
| ------------------- | --------------------------------------- | -------------------------------- |
| `default`           | Nur Reads                               | Sensitives, Onboarding           |
| `acceptEdits`       | Reads + Edits + `mkdir`/`mv`/`cp`/`sed` | Iterieren, Review per `git diff` |
| `plan`              | Nur Reads, kein Edit                    | Codebase erkunden                |
| **`auto`**          | **Alles, mit Background-Classifier**    | **Lange Tasks, Prompt-Fatigue**  |
| `dontAsk`           | Nur vorab erlaubte Tools (sonst Deny)   | CI/Pipelines                     |
| `bypassPermissions` | Alles, ohne Checks                      | Container/VM ohne Internet       |

<p class="!my-0 !leading-tight" style="font-size: 11px; opacity: 0.85;"><strong>Auto Mode</strong> (Research Preview, v2.1.83+, Opus 4.6/4.7 + Sonnet 4.6, Anthropic API) — Classifier blockt <code>curl | bash</code>, Force-Push, Prod-Deploys, IAM-Grants, externe Endpoints; Chat-Aussagen wie „don't push" wirken als Deny. Fallback nach 3 Blocks in Folge / 20 gesamt. <strong>vs. <code>bypassPermissions</code>:</strong> Auto = unsichtbare Checks, Bypass = keine — nur Auto schützt vor Modellfehlern und Prompt-Injection.</p>

---
clicks: false
---

# LSP · MCP · ACP

<ProtocolCards />

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

# ACP — Agent Client Protocol

**Zed + JetBrains, 2025** — "LSP für AI-Agenten"

**Vor ACP:** N·M Custom-Integrationen (IDE × Agent). **Mit ACP:** einmal implementieren → läuft überall.

| Tool        | ACP | Details              |
| ----------- | --- | -------------------- |
| Claude Code | ✓   | JetBrains-IDEs + Zed |
| Codex       | ✓   | JetBrains ab 2026.1  |
| Junie       | ✓   | JetBrains-nativ      |
| Gemini CLI  | ✓   | JetBrains + Zed      |
| Windsurf    | ✗   | Eigene IDE           |

**MCP-Durchreichung:** JetBrains reicht konfigurierte MCP-Server an ACP-Agenten durch — einmal konfigurieren, alle Agenten nutzen es.

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

# Cross-Tool-Kompatibilität

**AGENTS.md** — der emergente Standard, von 5/6 Tools unterstützt (alle außer Claude Code → `CLAUDE.md`).

**SKILL.md** — stärkster Cross-Tool-Standard. Identische Struktur über alle 6 Tools.

**Settings und Hooks** — NICHT portabel. JSON vs. TOML vs. JS-Plugins.

**Claude Code → Single-Source via `@AGENTS.md`-Import** in `CLAUDE.md` (an beliebiger Stelle, max. 5 Hops tief). Claude-spezifische Zusätze einfach darunter ergänzen. Alternative: `ln -s AGENTS.md CLAUDE.md` (Windows: Admin/Dev-Mode nötig).

Praktische Interop heute:

- **Junie** scannt `.claude/`, `.codex/`, `.cursor/` und **schlägt** Guidelines **vor** (kein vollautomatischer Import)
- **OpenCode** fällt auf `CLAUDE.md` zurück
- **Windsurf** entdeckt Skills aus `.agents/skills/`
- **Gemini CLI** erlaubt mehrere Dateinamen-Alternativen

---
clicks: false
---

# Zusammenspiel der Primitive

<FlowLayers />

---
clicks: false
---

# Git Worktrees für Agenten

<WorktreeOverview />

---

# Pipes & Headless-Mode

| Tool            | Headless           | Stdin-Pipe           | Besonderheit                           |
| --------------- | ------------------ | -------------------- | -------------------------------------- |
| **Claude Code** | `-p` / `--print`   | ✓ (10 MB cap)        | 3 s-Timeout · ab 2026-06-15 SDK-Credit |
| **Gemini CLI**  | `-p` / `--prompt`  | ✓                    | `--output-format json` / `stream-json` |
| **Codex**       | `codex exec` (`e`) | ✓ (Prompt-Arg `-`)   | `exec resume`, `--json`                |
| **OpenCode**    | `opencode run "…"` | ✗ (nur `-f <datei>`) | `opencode serve` für warme Sessions    |
| **Windsurf**    | ✗                  | ✗                    | Nur IDE-integriert                     |
| **Junie**       | ✗                  | ✗                    | Nur IDE-integriert                     |

---

# Claude im Pipe-Einsatz — Stolperfallen

**1. 3-Sekunden-Timeout** — wenn binnen 3 s keine Daten ankommen, läuft Claude **ohne** Stdin weiter (Warnung auf stderr). Sobald Daten fließen, wartet er auf **EOF** — `tail -f | claude -p …` hängt deshalb ewig.

**2. Abrechnung** — ab **2026-06-15** zählt `claude -p` auf Pro/Max-Plänen gegen ein separates **Agent-SDK-Credit**, nicht gegen das interaktive Kontingent.

**3. Workaround: vollständig puffern, dann übergeben** — Subshell läuft fertig, Claude bekommt sofort einen geschlossenen Stream.

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

# Empfehlungen für Multi-Tool-Teams

1. **`AGENTS.md` als primäre Instruktionsdatei** — Claude Code via `@AGENTS.md`-Import in `CLAUDE.md` (sonst doppelte Wartung)
2. **Skills im `SKILL.md`-Format** in `.agents/skills/` — per Symlink in toolspezifische Pfade
3. **Instruktionsdateien unter 200 Zeilen** — Rules für pfadspezifische Konventionen
4. **Security schichten** — Permission-Deny + Sandbox + Ignore-Dateien
5. **Hooks für harte Quality Gates** — nicht bitten, sondern erzwingen
6. **MCP sparsam** — Token-Kosten monitoren, nicht aktive Server disconnecten
7. **Projekt-Level-Configs versionieren** — Secrets nur in User-Level oder Env-Vars

---
layout: center
---

# Autonomie & Orchestrierung

Bisher: _was_ der Agent weiß. Jetzt: _wie selbständig_ er arbeitet — und was das kostet.

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

# Autonomie im Tool-Vergleich

| Tool                  | Loop (Zeit) | Goal (Bedingung) | Breite (parallel)                |
| --------------------- | ----------- | ---------------- | -------------------------------- |
| **Claude Code**       | `/loop`     | `/goal`          | Dynamic Workflows                |
| **Codex**             | ✗           | `/goal`          | Cloud-Sandboxes                  |
| **Antigravity CLI**   | ◐           | ✗                | async Background-Workflows       |
| **Copilot**           | ✗           | ◐ (bis PR)       | Cloud Agent                      |
| **Windsurf / Cursor** | ✗           | ◐                | Cascade / Cloud (≤8)             |
| **Junie / Air**       | ✗           | Plan/Brave-Mode  | Air orchestriert mehrere Agenten |

Drei **orthogonale** Achsen — verschiedene Kostenprofile: loop ∝ Laufzeit, goal ∝ Turns, Breite multiplikativ ∝ Agenten.

---

# Dynamic Workflows & `ultracode`

<div class="text-sm opacity-75">Research Preview · 28.05.2026 · Opus 4.8</div>

**Mechanik:** Claude _schreibt_ ein JS-Skript, das in isolierter Background-Runtime Dutzende bis Hunderte Subagents orchestriert, die sich **adversarisch gegenseitig prüfen**.

**Limits:** ≤16 gleichzeitig · Hard-Cap 1000/Run · Subagents im `acceptEdits`-Modus.

**`ultracode`** = Effort `xhigh` + Auto-Orchestrierung, session-only (`/effort ultracode`). Eines der teuersten Features _mit zusätzlichem Aufschlag_ — Breite × Tiefe multiplikativ.

<div class="mt-4 px-4 py-2 text-sm border-l-4 border-amber-500 bg-amber-500/10 rounded">

**Paradedisziplin & Kostenfalle:** Große Java-Refactorings sind _der_ Workflow-Use-Case — aber Hunderte Subagents = €€€€€. Deterministische **OpenRewrite**-Recipes erledigen den mechanischen Großteil token-frei, KI nur an der Determinismus-Grenze. → Vortrag [_OpenRewrite — Refactoring at Scale_](../20260522-open-rewrite/)

</div>

---

# Neue Orchestrierungs-Plattformen

**Antigravity = Dachmarke über drei getrennte Produkte:**

- **Antigravity IDE** — agentischer VS-Code-Fork (Nov 2025), eigenständig.
- **Antigravity 2.0** — Standalone-Desktop-App, Orchestrierungs-Command-Center, **kein Editor**.
- **Antigravity CLI (`agy`)** — Nachfolger der **Gemini CLI** (Go), teilt Harness mit der 2.0-App, **nicht** aus der IDE-Linie. Erbt Skills/Hooks/Subagents/Plugins/MCP; neu: async Multi-Agent-Workflows + dynamische Subagents. _Proprietär (Community-Kritik)._

**Junie + JetBrains Air** — Junie: Plan-/Brave-Mode, Subagents in `.junie/agents/`, Junie CLI (Beta 03/2026, LLM-agnostisch, BYOK). **Air = eigenes Produkt** (Preview 03/2026): orchestriert Junie/Claude/Codex/Gemini **gleichzeitig** via Docker + Worktrees.

**Cursor & Cloud-Agenten** — `cursor-agent`-CLI, Cloud Agents (≤8 parallel), best-of-n auf Worktrees. Dazu Codex Cloud & Copilot Cloud Agent.

---
layout: center
---

# Bonusmaterial

---
clicks: false
---

# Agent Skills — Deep Dive

<SkillInfographic />

---
clicks: false
---

# Clinejection -- Anatomie eines Supply-Chain-Angriffs

<ClinejectionAttackChain />

---
clicks: false
---

# Clinejection -- Zeitverlauf und vereitelte Eskalation

<ClinejectionTimeline />

---
clicks: 1
---

# Clinejection -- Willisons "Lethal Trifecta"

<ClinejectionTrifecta />

---
clicks: false
---

# Gesamtübersicht — Interaktiv

<FullInfographic />

---
layout: end
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
