---
theme: default
title: "AI Coding Agent Configuration"
info: |
  Systematischer Vergleich: Claude Code, Codex, Windsurf, Junie, OpenCode, Gemini CLI.
  Primitive, Protokolle, Worktrees und Cross-Tool-Kompatibilität.
---

# AI Coding Agent Configuration

Systematischer Vergleich: Claude Code · Codex · Windsurf · Junie · OpenCode · Gemini CLI

---

# Kernbegriffe

| Primitiv | Was es ist | Analogie |
|---|---|---|
| **Instruktionsdatei** | Markdown-Datei mit Projektkonventionen, bei Sessionstart in System-Prompt geladen | Firmenhandbuch |
| **Rules / Regeln** | Modulare `.md`-Dateien, konditional oder immer geladen | Abteilungsrichtlinien |
| **Skills** | `SKILL.md` + Skripte/Templates, laden on-demand | Verfahrensanleitung |
| **Hooks** | Shell-Befehle bei Lifecycle-Events, deterministisch | Git-Hooks |
| **MCP Server** | Externe Tool-Anbindung via Model Context Protocol | USB-C-Adapter |
| **Subagents** | Isolierte Agent-Instanzen mit eigenem Kontextfenster | Praktikant |
| **Plugins** | Bündelung von Skills + Hooks + MCP in ein Paket | npm-Paket |

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

| Tool | Hierarchie |
|---|---|
| **Claude Code** | `~/.claude/` → Elternverzeichnisse → Projekt-Root → Unterverzeichnisse + `.claude/rules/*.md` |
| **Codex** | System → User → Projekt → CLI-Flags. `AGENTS.md` vom Git-Root abwärts konkateniert |
| **Windsurf** | System → Global → Workspace → AGENTS.md (4 Stufen) |
| **Gemini CLI** | System-Defaults → User → Projekt → Overrides → Env-Vars → CLI-Args + Policy Engine |
| **OpenCode** | Remote-Config via `.well-known/opencode` |

**Universell: Deny gewinnt immer** — keine niedrigere Ebene kann ein Verbot aufheben.

---

# Hook-Systeme: Die größte Divergenz

| Tool | Events | Pre-Tool-Block | Besonderheit |
|---|---|---|---|
| **Claude Code** | 12+ | ✓ (Exit 2) | 3 Handler-Typen: Shell, LLM-Prompt, Agent |
| **Gemini CLI** | 10 | ✓ | Retry-Trigger via `AfterAgent` (Exit 2) |
| **Windsurf** | 12 | ✓ | Cloud-managed Hook-Deployment |
| **OpenCode** | 30+ | ✓ | JS/TS-Plugins statt Shell-Skripte |
| **Codex** | 2 | ✗ | Nur `notify` + `userpromptsubmit` |
| **Junie** | — | ✗ | Approval Gates + Live Prompting |

**Architekturprinzip:** Hooks sind Quality Gates — sie fangen die letzten 10% auf, die das Modell trotz guter Instruktionen übersieht.

---

# Sandboxing und Permissions

| Tool | Technologie | Besonderheit |
|---|---|---|
| **Codex** | Seatbelt / Landlock+seccomp | `.git/`, `.codex/` immer gesperrt |
| **Claude Code** | Seatbelt / bubblewrap | Drei-Tier: Deny → Ask → Allow mit Prefix-Matching |
| **Gemini CLI** | Seatbelt, Docker, Podman, LXC | Breiteste Backend-Auswahl + TOML Policy Engine |
| **Windsurf** | Turbo-Mode Auto-Execution | `.codeiumignore` für Dateirestriktionen |
| **Junie** | Safe/Sensitive-Klassifikation | Regex-basierte Allowlist pro Kommando |
| **OpenCode** | Per-Agent Permission-Overrides | Pro-Agent MCP-Enable/Disable |

---
clicks: false
---

# LSP · MCP · ACP

<ProtocolCards />

---

# LSP vs. MCP — Keine Verwechslung

| | LSP | MCP |
|---|---|---|
| **Zweck** | Semantisches Code-Verständnis | Externe Tool-/Datenanbindung |
| **Richtung** | Agent → Code | Agent → Externe Welt |
| **Erstellt** | Microsoft, 2016 | Anthropic, 2024 |
| **Analogie** | IDE-Intelligenz | USB-C-Adapter |

**LSP** gibt dem Agenten *Augen für Code* — 50ms statt Sekunden für Symbol-Suche.

**MCP** gibt ihm *Hände für die Außenwelt* — Zugriff auf Systeme die er sonst nicht erreicht.

Ein Agent profitiert von **beiden gleichzeitig**.

---

# ACP — Agent Client Protocol

**Zed + JetBrains, 2025** — "LSP für AI-Agenten"

Vor ACP: Jede IDE brauchte für jeden Agenten eine Custom-Integration.

Mit ACP: Ein Agent implementiert ACP einmal → funktioniert in JetBrains, Zed, und jedem ACP-kompatiblen Editor.

| Tool | ACP | Details |
|---|---|---|
| Claude Code | ✓ | JetBrains-IDEs + Zed |
| Codex | ✓ | JetBrains ab 2026.1 |
| Junie | ✓ | JetBrains-nativ |
| Gemini CLI | ✓ | JetBrains + Zed |
| Windsurf | ✗ | Eigene IDE |

**MCP-Durchreichung:** JetBrains reicht konfigurierte MCP-Server an ACP-Agenten durch — einmal konfigurieren, alle Agenten nutzen es.

---

# Cross-Tool-Kompatibilität

**AGENTS.md** — der emergente Standard, von 5/6 Tools unterstützt (alle außer Claude Code → `CLAUDE.md`).

**SKILL.md** — stärkster Cross-Tool-Standard. Identische Struktur über alle 6 Tools.

**Settings und Hooks** — NICHT portabel. JSON vs. TOML vs. JS-Plugins.

Praktische Interop heute:
- **Junie** importiert automatisch `.claude/`, `.codex/`, `.cursor/`
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

# Empfehlungen für Multi-Tool-Teams

1. **`AGENTS.md` als primäre Instruktionsdatei** — für Claude Code zusätzlich `CLAUDE.md`
2. **Skills im `SKILL.md`-Format** in `.agents/skills/` — per Symlink in toolspezifische Pfade
3. **Instruktionsdateien unter 200 Zeilen** — Rules für pfadspezifische Konventionen
4. **Security schichten** — Permission-Deny + Sandbox + Ignore-Dateien
5. **Hooks für harte Quality Gates** — nicht bitten, sondern erzwingen
6. **MCP sparsam** — Token-Kosten monitoren, nicht aktive Server disconnecten
7. **Projekt-Level-Configs versionieren** — Secrets nur in User-Level oder Env-Vars

---
clicks: false
---

# Gesamtübersicht — Interaktiv

<FullInfographic />
