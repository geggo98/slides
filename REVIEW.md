# Slide-Review 2026-06

> Arbeitsdokument vom 2026-06-12. Punkte abhaken, wenn umgesetzt. Aufwand: **S** < 30 min, **M** < 2 h, **L** > 2 h.
> Methodik: 7 Per-Deck-Reviews + 4 übergreifende Reviews (Xref, Konsistenz, Quiz, Accessibility), Web-Faktencheck (38 Claims),
> Link-Check (46 URLs), Overflow-Sweep über alle 342 Slides (chromium + firefox + webkit, Light + Dark).
> Rohdaten: `playwright-tests/review-raw/` (git-ignoriert; bei Bedarf `git add -f`).
> Slide-Nummern: Stand 2026-06-12, mit Slide-Überschrift zitiert, damit Punkte auch nach Umnummerierung auffindbar bleiben.

---

## Umsetzungsstand (2026-06-12)

Vollständig umgesetzt, ein Commit pro Vortrag bzw. Shared-Bereich auf `main`
(`git log --oneline` ist die maßgebliche Referenz; die Detail-Häkchen unten
sind als Nachschlagewerk belassen):

- **shared** — MonacoBlock-`var()`-Fallbacks, `TalkXref`-Typisierung,
  Broken-Link-Vitest, `shared/quiz/CLAUDE.md`, C#-Badge.
- **ai-agents · gradle · monitoring (grafana) · agents-details · java-null ·
  open-rewrite · design-pattern** — Inhalt/Fakten, Querverweise (`<TalkXref>` +
  `setup/main.ts`), Sprache/Typografie, Struktur, Overflow. Beim Gradle-Deck
  zusätzlich der Resolution-Simulator (SceneBom/BomDown/Force/Catalog) auf die
  korrigierte Jackson-Version 2.20.x nachgezogen.
- **Overflow** — jedes Deck per `playwright-tests/sweep-deck-overflow.ts`
  (chromium, Light + Dark) auf **0 Overflow** gebracht.
- **Vier neue Quizze** (gradle, grafana, agents-details, design-pattern) via
  Web-Recherche → Fable-Generierung → adversariale Auswahl; Schema t:3/f:3/d:2,
  Difficulty-Pyramide, Transfer-Sektionen über die Cross-Deck-Brücken.

**Bewusst zurückgestellt** (keine Regression, hier dokumentiert):

- Shared `TalkXrefPanel`-Konsolidierung + `talkUrl(anchor)` — präventive
  Refactors ohne aktuellen Konsumenten.
- Volle Headmatter-Angleichung über `lang: de` hinaus (transition/colorSchema/
  fonts) — globales Rendering-Risiko, pro Deck visuell zu prüfen.
- Breite Komponenten-Refactors (usePalette-Migration, shared `Tabs.vue`,
  Komponenten-Dedup) und 0/N-Notes-Vollabdeckung — L-Aufwand, kein
  nutzersichtbarer Gewinn.
- Vorbestehende, nicht durch die Edits ausgelöste Overflows: grafana
  `DashboardLinking` (strukturell, jetzt bewusst scrollbar) und der gradle
  `EcosystemInfographic`-Footer auf einer Bonusfolie.

---

## Übergreifend (Shared / Infrastruktur)

### Bugs & Robustheit

- [ ] **(S) MonacoBlock: var()-Fallbacks ergänzen.** `shared/components/MonacoBlock.vue:209–227` nutzt `var(--sk-radm)`, `var(--color-border-tertiary)`, `var(--font-sans)`, `var(--sk-rad)` ohne Fallback. In Decks ohne SlidevTokens (java-null-pointer, agents-details) wird die `border`-Shorthand dadurch komplett verworfen → randloser weißer Editor auf weißer Slide. Fix: `var(--color-border-tertiary, rgba(128,128,128,.3))`, `var(--sk-radm, 8px)` etc. — robust für alle Decks, unabhängig vom Token-Setup.
- [ ] **(S) `setup/main.ts` für die drei Decks ohne anlegen** (grafana, agents-details, java-null-pointer): `import "@shared/components/SlidevTokens.vue"` + `app.component("TalkXref", TalkXref)` (Kopiervorlage: `20260522-open-rewrite/setup/main.ts`). In `20260327-ai-agents/setup/main.ts` fehlt nur der SlidevTokens-Import; in `20260327-gradle…/setup/main.ts` nur die TalkXref-Registrierung.
- [ ] **(S) Broken-Link-Test bauen, der in `shared/talks.ts:3-4` versprochen wird** (~30 Zeilen Vitest): TALKS-Keys ↔ Talk-Verzeichnisse abgleichen; perspektivisch auch Xref-Anchor ↔ `routeAlias`-Vorkommen im Ziel-Deck. Hätte den Stale-Range-Befund (s. open-rewrite) verhindert.
- [ ] **(S) `TalkXref.vue`: `slug`-Prop als `TalkSlug` typisieren** (heute `string`; unbekannter Slug rendert stumm den Slug als Label statt zu failen).

### Einheitliches Querverweis-Muster (Empfehlung des Xref-Reviews)

- [ ] **(S) Inline-Ebene als Standard festlegen:** TalkXref in jedem Deck global registriert (siehe setup/main.ts oben); jede Fließtext-Erwähnung eines anderen Talks wird ein `<TalkXref>`.
- [ ] **(M) Slide-Ebene konsolidieren:** `JspecifyCrossRef.vue` (open-rewrite) und `DesignPatternCrossRef.vue` (design-pattern) sind zu ~80 % identische Zwei-Spalten-Panels mit leicht divergentem Styling. Durch EINE datengetriebene Shared-Komponente `shared/components/TalkXrefPanel.vue` ersetzen (Props: `here: {title, bullets}`, `refs: [{slug, bullets, anchor?}]`) — bevor ein drittes Deck die dritte Kopie anlegt.
- [ ] **(M) Slide-Anker robust machen:** `talkUrl(slug, anchor?)` + TalkXref-Prop `anchor`; Konvention: Cross-Deck-Ziele bekommen im Ziel-Deck ein `routeAlias` (funktioniert in der URL, Decks sind im History-Router-Modus gebaut). Prosa-Slide-Nummern („Slides 8–18") komplett streichen — der einzige nachgewiesene Stale-Content sitzt genau dort.

### Overflow-Check-Methodik (Selektor-Lücken)

- [ ] **(S) `role="tab"`/`role="tablist"` ergänzen**, damit der Overflow-Check die Panels durchcycelt: `ai-agents/components/SkillInfographic.vue` + `FullInfographic.vue` (`.nav button`), `java-null-pointer/components/NarrowingExplorer.vue` (`.scenario-btn`). Nachhaltiger: auf shared `Tabs.vue` migrieren (siehe Deck-Abschnitte).

### Frontmatter-Konvention

- [ ] **(S) Headmatter-Standard definieren und angleichen.** Referenz (java-null/open-rewrite/design-pattern): `monaco: true · mdc: true · transition: slide-left · colorSchema: auto · fonts: {sans: Inter, mono: 0xProto} · hideInToc: true`. Es fehlen: **gradle** (fast alles), **grafana** (fast alles), **ai-agents** (transition/colorSchema/fonts), **agents-details** (dito, trotz vorhandenem Font-Symlink in `public/fonts/`). `lang: de` setzt bisher kein Deck → überall ergänzen.

### Quiz-Konventionen (Engine: `shared/quiz/`)

- [ ] **(S) Konventionen dokumentieren** (z. B. `shared/quiz/CLAUDE.md`): Options-Schema **t:3/f:3/d:2** (das java-null-Schema ist für den 4-aus-N-Sampler das sauberste — min. 2 false, sonst wird die einzige false-Option in jedem Sample wiederholt), Anrede **Du**, 5–9 thematische Sections, Transfer-Section einheitlich klein „transfer".

---

## 20260327-ai-agents (49 Slides)

### Inhalt & Fakten

- [x] ~~(S) S46 „Claude Code in IntelliJ via ACP": ACP-Wrapper-Skript korrigiert~~ **erledigt 2026-06-12**: Homebrew-PATH für ARM+Intel ergänzt (GUI-Apps erben den Shell-PATH nicht), `npx claude-code-acp` → `npx @agentclientprotocol/claude-agent-acp` (unscoped Paket gehört einem Dritten! Zed-Adapter wurde umbenannt, `@zed-industries/claude-code-acp` ist deprecated), `CLAUDE_ACP_MODEL` → `ANTHROPIC_MODEL` (offizieller Adapter liest nur diese), `faible` → `fable`, Tippfehler „Spechern" → „Speichern". Overflow nach Edit geprüft: ✓ clean.
- [ ] (S) S46: Begründungssatz präzisieren — „Sauberer als bloßes `npx` … fixer Pfad" passt nicht ganz, da das Skript weiter `npx` nutzt; Begründung auf „kontrollierter PATH + env" umstellen.
- [ ] (S) S9 „Instruktionsdateien: Hierarchie": Tabelle listet nur 5 von 6 Tools — **Junie fehlt** (S10/S11/S22 führen Junie jeweils). OpenCode-Zelle beschreibt zudem keine Hierarchie, nur Remote-Config.
- [ ] (M) S36 „Konsequenz: Klassifikator + Sandbox …": PocketOS-Callout verweist auf den „Clinejection-Bonus" — die Bonus-Slides S39–41 behandeln aber nur den Cline-npm-Vorfall, PocketOS kommt dort nicht vor. Verweis entfernen oder PocketOS in den Bonus aufnehmen.
- [ ] (S) S12/S33/S42: Auto-Mode-Stand prüfen — Faktencheck: Kern-Claims (v2.1.83+, Research Preview, `hard_deny` v2.1.136+) ✅ bestätigt, aber Auto Mode ist inzwischen weiterentwickelt (seit v2.1.111 ohne Flag, „All plans", seit v2.1.158 auch Bedrock/Vertex mit Opus 4.7/4.8); Klassifikator-Modell wird offiziell nur noch als „server-configured model" beschrieben.
- [ ] (S) S16 „ACP — Agent Client Protocol": „Zed + JetBrains, 2025" unterschlägt Google als Launch-Partner (Gemini CLI war der ACP-Launch-Partner; JetBrains kam 10/2025 dazu). Optional präzisieren.
- [ ] (S) S45: brew-Cask-Hinweis ergänzen — Cask trackt den stable-Channel; mit `CLAUDE_CODE_PACKAGE_MANAGER_AUTO_UPDATE=1` gibt es inzwischen Auto-Update via brew (bekannte stable/latest-Verwirrung #41194).
- [ ] (S) S35 „Wie sicher ist der Spaß?" / S44 „Sicherheit im Detail": Zahlenpaare (17 %, 81 %) bewusst doppelt — in beiden Presenter Notes als Sync-Paar markieren.
- ✓ Web-verifiziert und korrekt: Antigravity-Migration 2026-06-18, Devin-Desktop-Rebrand 2026-06-02, Agent-SDK-Credit 2026-06-15 (Details: $20/$100/$200, kein Rollover), Source-Leak-Daten, AGENTS.md/Linux Foundation, JetBrains `~/.jetbrains/acp.json` + `agent_servers`.

### Querverweise

- [ ] (S) S4 „Kernbegriffe" oder S5 „Entscheidungsregel": TalkXref → `20260408-agents-details` („Wie der Loop intern funktioniert → Deep-Dive") — **wichtigste fehlende Brücke im Repo** (Companion-Talks, bisher 0 Verbindungen).
- [ ] (S) S24 „Empfehlungen für Multi-Tool-Teams" Punkt 6 und/oder S26 „Drei Achsen der Autonomie": TalkXref → agents-details (MCP Token-Bloat, Token-Ökonomie). Dabei Fork-Mode-Relativierung übernehmen: „Kostenmultiplikator" gilt seit Fork-Mode (~90 % Discount bei parallelen Subagents) nur noch abgeschwächt.
- [ ] (S) S39–41 „Clinejection": TalkXref → `20260327-gradle-dependency-resolution` (Supply-Chain-Schutz; Pointe: ein 7-Tage-Cooldown hätte das Cline-Paket abgefangen).
- [ ] (S) S29 „Dynamic Workflows & `ultracode`": Slot-Label des bestehenden TalkXref weglassen — identisch mit dem Registry-Fallback.
- [ ] (S) Interne Verweise klickbar machen: `routeAlias` auf S12 setzen + `<Link>` auf S42 (statt Prosa „siehe Kapitel …"); ebenso S35 „→ Details im Bonus" und S36 „(→ Clinejection-Bonus)" als `<Link>` (Vorbild: S46 ↔ S17 `acp-abrechnung`).
- [ ] (S) `components/skill/McpPanel.vue:51`: „Tool Search (default on)" → „auto ab >10 % Context-Anteil (v2.1.7)" und „50.000+ Tokens" → „17K–126K, typisch 50K+" (Angleichung an agents-details).

### Overflow (gemessen)

- [ ] (S) S11 „Sandboxing und Permissions": +25px (nur WebKit) — Devcontainer-Fußnotenblock.
- [ ] (S) S12 „Claude Code Permission Modes": +3px (chromium/firefox) — Fußnote.
- [ ] (S) S20 „Zusammenspiel der Primitive": +23px (chromium/firefox) — Tabellenzeile „Hook: Stop".

### Komponenten & Theme

- [ ] (M) `SkillInfographic.vue:119–139`: definiert alle 19 `--color-*`-Variablen lokal mit eigener, von `shared/theme/tokens.ts` abweichender Palette (Schatten-Token-System). Nach SlidevTokens-Einführung auflösen; die `components/skill/*.vue` hängen heute fragil an diesem Scope.
- [ ] (M) SkillInfographic/FullInfographic: eigene `.nav button`-Pill-Navigation → shared `Tabs.vue` (oder mind. `role="tab"`, s. Übergreifend).
- [ ] (S) `ComparisonMatrix.vue:79` + `ProtocolCards.vue:13`: duplizierte Y/N/Partial-Span-Generatoren in einen Helper ziehen; toten Ternary `isDark ? "#639922" : "#639922"` auflösen.
- [ ] (M) `ProtocolCards.vue:293–351`: tragender Inhalt bei 7–8 px logischer Schriftgröße (real ~9–10 px am Beamer) — kleinste Schrift im Repo, vergrößern.
- [ ] (S) 3 handgestylte Fußnoten-`<p>` (slides.md:166, 185, 614) auf `<Callout dense>` umstellen (Callout ist registriert und wird sonst korrekt genutzt).
- [ ] (L) Langfristig: ~8 Komponenten mit eigenem `isDark ? dark : light`-Palettenobjekt auf `shared/composables/usePalette.ts` migrieren (223 hardcodierte Hex-Werte).

### Sprache & Stil

- [ ] (S) S39–41: Überschriften nutzen ASCII `--` statt `—`; S41 gerade Anführungszeichen `"Lethal Trifecta"`. Deckweit: deutsche öffnende „ mit ASCII-Schlusszeichen `"` kombiniert (S12, S35, S43); S33 einmalig »Auto«.
- [ ] (S) „Classifier" (S11/S12/S33) vs. „Klassifikator" (S34–S36, S42, S44) vereinheitlichen — wechselt sogar zwischen Nachbar-Slides.
- [ ] (S) S23-Titel: „Claude" → „Claude Code" (sonst durchgängig).
- [ ] (S) Datumsformate mischen ISO (2026-06-15) und deutsch (28.05.2026, 03/2026) — eine Konvention wählen.

### Struktur & Notes

- [ ] (M) Quellen-/Reading-List-Slide im Bonus ergänzen — Quellen existieren nur in Presenter Notes (S1, S17).
- [ ] (L) Notes-Abdeckung: nur 3/49 Slides (vorhandene sind vorbildlich mit „Stand"-Vermerk) — mindestens für die faktendichten Slides S30, S35, S44 ergänzen.

---

## 20260327-gradle-dependency-resolution (52 Slides)

### Inhalt & Fakten

- [ ] **(S) KRITISCH — MonacoBlock rendert nicht** auf S40 „Axios Supply-Chain-Angriff", S43 „Java-Versionen mit Gradle Verwalten", S44 „Cooldown: Tool-Beispiele": `CooldownTabs.vue`, `AxiosInfectionChain.vue:182`, `JvmEvolution.vue`, `JvmIdiomatic.vue` nutzen `<MonacoBlock>` ohne Import (Commit `ce6d391` löschte die lokale Kopie ohne `@shared`-Import nachzuziehen). **Live verifiziert**: 9 Vue-Resolve-Warnungen, 0 gerenderte Editoren. Fix: `import MonacoBlock from "@shared/components/MonacoBlock.vue"` in den 4 Dateien.
- [ ] **(M) Jackson-Storyline ist faktisch falsch:** S13/S14/S20/S23 erzählen „Spring Boot 4.0.6-BOM liefert Jackson **2.17.2**" — Boot 4.0.0 managed tatsächlich **Jackson 3.0.2** (`jacksonVersion`) bzw. **2.20.1** (`jackson2Version`); 2.17.2 war Boot 3.3.x. Entweder Versionen aktualisieren (inkl. Property-Name: `<jackson-bom.version>`-Mapping auf S14 prüfen) oder Beispiel explizit auf Boot 3.3 datieren.
- [ ] (S) S40/S49: Axios-Downloads dreimal unterschiedlich (~100 Mio 2×, „40M+" 1×) — belegt sind „über 70 Mio/Woche" (Microsoft) bzw. „über 83 Mio" (THN). Auf einen belegten Wert einigen.
- [ ] (S) S44 (CooldownTabs): „Cooldown erst ab npm 11.5.0" → korrekt ist **11.10.0 (Feb 2026)**.
- [ ] (S) S46 (EcosystemTabs) „pnpm hat als einziger minimumReleaseAge eingebaut" widerspricht der eigenen S36-Tabelle (npm/Bun/Yarn haben es auch). Bonus: pnpm v11 setzt inzwischen Default 1440 min — stärkt die Storyline.
- [ ] (S) Cooldown-Empfehlung einordnen: S36 „7 Tage" vs. `AxiosAnatomy.vue:55` „Arctic Wolf: 3 Tage" stehen unkommentiert nebeneinander.
- [ ] (S) S43 Tab „Idiomatisch": Label sagt „Spring Boot 3 auf JDK 21", Code nutzt `version "4.0.6"`.
- [ ] (M) S43 Tab „Idiomatisch": „idiomatische" Config enthält `io.spring.dependency-management` — widerspricht S11 („Legacy") und S13 (Empfehlung = natives `platform()`). Bonus-Beispiel auf Variante A angleichen.
- [ ] (S) S8 „Wichtigste Befehle": `./gradlew dependencyUpdates` braucht das ben-manes-Plugin — nirgends erwähnt.
- [ ] (S) S32: ❌-Beispiel `--write-verification-metadata sha256 classpath` — `classpath` ist kein Task; das Beispiel scheitert aus anderem Grund als dem erklärten.
- [ ] (S) S4 „Kernbegriffe": Resolution-Strategy-Definition vermengt Default-Strategie und BOM-Eingriff in einem Satz.
- [ ] (S) S39/S40: Datumslogik bewusst prüfen — Talk-Datum 27.03.2026, aber Axios-Vorfall 30./31.03. und Timeline bis 03.04. (ok, falls der Talk gepflegt/wiederholt wird — dann ggf. „aktualisiert am"-Vermerk).
- [ ] (S) S50 „(Alle Gradle Info-Grafiken)": reine Duplikat-Slide (bündelt S5/S16/S46/S47) — entfernen oder als Referenz kennzeichnen.
- ✓ Web-verifiziert und korrekt: Trivy→LiteLLM-Vorfall (inkl. v1.82.7/.8, ~40 min), Sapphire Sleet/UNC1069, Cooldown-Matrix (außer npm-Version), Gradle 9/JDK 17 (Nuance: nur Daemon), daemon-jvm.properties stable 9.2.

### Querverweise

- [ ] (S) S40 „Axios Supply-Chain-Angriff" (deckt S39 mit ab): TalkXref → `20260327-ai-agents` (Clinejection-Bonus — gleiche Angriffsklasse, gleiches Vortragsdatum). Voraussetzung: TalkXref-Registrierung in setup/main.ts (s. Übergreifend).
- [ ] (S) S29 „Dependency Scanning" ↔ S39: S29 nennt Trivy als vertrauenswürdigen Scanner, S39 zeigt Trivy als Angriffsvektor — die Pointe verdrahten („zu Trivy als Angriffsvektor: → Bonus").
- [ ] (S) S2 „Agenda": 9-Slide-Bonusblock (S42–50) ergänzen; S36-Fußnote „siehe separate Slides" explizit benennen; S25 „(Details in Abschnitt 7)" für Verification Metadata.
- Bewusst NICHT verlinken: gradle → java-null-pointer via Spring-BOM (vom Xref-Review als erzwungen bewertet).

### Overflow (gemessen)

- [ ] (M) S51 „Weiterführende Links": **+293–325px** (alle Engines) — 24 Link-Bullets weit über Canvas. Auf 2 Slides splitten oder 2-spaltig + kürzen.
- [ ] (S) S15: +12px (firefox) — „Nicht mischen"-Block. S34: +10px (alle Engines) — Schlusszeile.

### Komponenten & Theme

- [ ] (M) Drei eigene Tab-Bars → shared `Tabs.vue`: `AxiosAttack.vue`, `GradleInfographic.vue` (je S, identische Styles), `ResolutionSimulator.vue` (`.sc-tabs`, M). EcosystemInfographic (`.info-tabs`) bei nächster Überarbeitung.
- [ ] (S) `CooldownTabs.vue` `.ct-info`-Boxen → shared `Callout` (tone-Prop).
- [ ] (S) `EcosystemInfographic.vue:905–908`: `.tag-go`/`.tag-maven` Brand-Hex ohne Dark-Override bei 8 px — wie `.th-go` (Z.778) nachziehen.
- [ ] (S) Prettier über `Axios*.vue` + `Scene*.vue` laufen lassen (Single quotes vs. Repo-Stil).
- [ ] (L) Optional: CompareTable/JvmMatrix → shared MatrixPivot (Detail-Blasen als Gewinn).

### Sprache & Stil

- [ ] (S) Tippfehler: S23 „beim näschten Spring update" → „nächsten Spring-Update"; S43-Titel „Verwalten" → „verwalten"; AxiosTimeline „depreciert", „BlueNoroff/Lazarus-Untergr."; S43 „Morling-Problem in Wartezeit" → „Wartestellung".
- [ ] (M) Terminologie „Lock-Datei" (7×) vs. „Lock-File" (11×) vs. „Lockfile" (Komponenten) — eine Variante wählen.

### Struktur & Notes

- [ ] (S) S1 ohne `layout: cover`; Headmatter an Repo-Standard angleichen (s. Übergreifend).
- [ ] (L) Notes-Abdeckung 0/52 — mindestens Sektions-Opener + Story-Slides S39/S40.
- [ ] (M) Quiz fehlt — Skizze siehe „Quiz & Transferfragen".

---

## 20260329-grafana-lgtm-monitoring-in-k8s-distributed-system (51 Slides)

### Inhalt & Fakten

- [ ] (S) S1-Titelfolie sagt „Percona MySQL", die Beispiele S43 (`span.db.system = "postgresql"`) und S44 („PostgreSQL-Query ist der Bottleneck") nutzen PostgreSQL — angleichen.
- [ ] (S) S41 „Mimir für Metriken": Recording-Rule-Beispiel aggregiert `sum by (service)` über eine Serie, die nur `(job, status)`-Labels hat → läuft ins Leere; zudem Level-Namenskonvention verletzt.
- [ ] (S) S11 „Errors": „Provider-Timeout-Rate (Status 0 = Verbindungsabbruch)" — **web-verifiziert falsch**: Spring/Micrometer taggt `status=IO_ERROR` (bzw. `CLIENT_ERROR` ohne Response), nie „0".
- [ ] (S) S16 „USE": Errors-Dimension ohne Beispiel — eine Zeile (`node_network_receive_errs_total`) ergänzen.
- ✓ Web-verifiziert und korrekt: Recovery Threshold GA 10.3, Loki 3.0 Structured Metadata, Pyroscope (JFR/async-profiler/Port 4040).

### Querverweise

- ✓ Kein Handlungsbedarf: Das Deck steht thematisch allein; das Review fand keine sinnvollen Brücken (geprüft gegen alle 6 anderen Decks) — keine Xrefs erzwingen.

### Overflow (gemessen)

- [ ] (S) S24 „Schwellwerte für Kubernetes / Spring Boot": **+83px** (chromium/firefox) — „CFS-Throttling ist binär"-Block.
- [ ] (M) S38 (DashboardLinking): Tooltip-Element `.urlref-tip-text` ragt **+1266px** unter den Canvas (alle Engines) — vermutlich ein im Layout-Flow gemessener Hover-Tooltip in `DashboardLinking.vue`; absolut positionieren bzw. `display: none` im Ruhezustand.

### Komponenten & Theme

- [ ] (S) S39 „Dashboard-Architektur — Interaktiv" (`GrafanaDashboard.vue`) ist nur ein Tab-Wrapper um die Inhalte von S36–S38 → komplette Redundanz; eine Seite streichen.
- [ ] (M) 4 Komponenten laden DM Sans zur Laufzeit von fonts.googleapis.com (`MonitoringMethods`, `SaturationSimulator`, `SystemDynamicsSimulator`, `GrafanaDashboard`) — Netzabhängigkeit beim Präsentieren; self-hosten oder Deck-Font nutzen.
- [ ] (M) S3/S32/S35: Hex-Farben in slides.md ohne Light/Dark-Differenzierung (#eab308 auf hell = schwacher Kontrast); S32/S35-Hinweisboxen sind exakt das shared-Callout-Muster (braucht Token-Setup, s. Übergreifend).
- [ ] (S) `muted: #64748b` modus-fix in fast allen Komponenten — auf Dark-Surface nur 4.0:1 bei 8–10 px-Labels (Beamer-grenzwertig).
- [ ] (S–M) `GaugeRing.vue`: Schwellen-Status nur über Ringfarbe grün→orange→rot (Protan/Deutan: Warn≈Crit) — Glyph (!/!!) ergänzen.
- [ ] (S) S4 (MethodsOverview): 3 Boxen im 2-Spalten-Grid — dritte Box hängt halbbreit allein; `1fr 1fr 1fr` prüfen.
- [ ] (L) Tab-Komponenten erst NACH Token-Setup auf shared Tabs migrieren (Deck importiert bisher nichts aus shared — sonst optischer Bruch).

### Sprache & Stil

- [ ] (S) 7 Stellen schließendes ASCII-`"` statt `"` (Z. 202, 370, 471, 486, 492, 656, 694); „kompoundiert" (S18) → „verstärkt"; „RED-Equivalent" (S3) → „RED-Äquivalent"; Komma vor „bevor" (S26).
- [ ] (S) Headmatter-`title` ist englisch bei deutschem Deck — bewusst entscheiden (Landing-Page-Linktext!).
- [ ] (S) PromQL-Blöcke als ` ```sql ` mit `--`-Kommentaren (S9–S12, S16, S18, S19) — PromQL kennt nur `#`; Copy-Paste bricht. Gleiches: S42 (LogQL), S43 (TraceQL).
- [ ] (S) S44: Alloy-Snippet ist River-Syntax, nicht YAML; Einrückung verloren.

### Struktur & Notes

- [ ] (M) **Einziges Deck ohne Inhaltsverzeichnis** — TOC-Slide nach S1 + `hideInToc: true`-Pflege auf allen Content-Slides (sonst listet `<Toc>` alle 51).
- [ ] (L) Notes-Abdeckung 0/51 — mindestens Bedienungs-Spickzettel für die 5 interaktiven Slides.
- [ ] (M) Quiz fehlt — Skizze siehe „Quiz & Transferfragen".

---

## 20260408-agents-details (45 Slides)

### Inhalt & Fakten

- [ ] (S) S33/S34: „OpenCode = Go" — **web-verifiziert falsch**: sst/opencode ist TypeScript (0 Bytes Go); Go ist Charm **Crush** (Fork-Linie des Prototyps). Korrigieren, ggf. als Fußnote die Verwechslungsgeschichte.
- [ ] (S) S20 (McpOptTable): „Claude Code Allow/Deny: Nein" — **web-verifiziert falsch**: `mcp__server__tool`-Permissions existieren (inkl. Wildcards `mcp__server__*`, Teil-Globs).
- [ ] (S) S8/S13/S17: „Tool-Definitionen im System-Prompt" → korrekt „im Request-Prefix" (separates `tools`-Array) — die eigene Simulation (S6) und S15 sagen es bereits richtig.
- [ ] (S) S34 (HarnessTable): „Claude Code: 200K" → „200K (1M opt-in)" — widerspricht S13 und S6-Simulation.
- [ ] (S) S23 vs. S25: „Extended 1h = 2× Write" — auf S25 („TTL 1h auf Max") den Kostenhinweis ergänzen.
- [ ] (S) S23 (CachePricingBar): OpenAI/Google 0.1× ist **web-verifiziert korrekt** (Stand Juni 2026) — nur Fußnote „Google: + Storage-Kosten bei explizitem Caching" ergänzen (Widerspruch zu S24 auflösen).
- [ ] (S) S42 „Kernaussagen": „10 Zeilen Pseudocode" vs. 14 Zeilen auf S5 → „~10 Zeilen".
- [ ] (M) Gemini-CLI-Slides (S8/S20/S33/S34): ai-agents erklärt die Antigravity-Ablösung ab 2026-06-18 — hier Fußnote/Stand-Hinweis ergänzen (Stand-Vermerk „29.04.2026" steht nur auf S25).
- ✓ Web-verifiziert und korrekt: Source-Leak (59.8 MB / 512K Zeilen / 31.03.2026), Anthropic-Cache-Preise (5min/1h/0.10×/1.25×), AGENTS.md Linux Foundation 60k+.

### Querverweise

- [ ] (M) `setup/main.ts` anlegen (s. Übergreifend), dann: S2 „Inhalt" — Companion-Hinweis → `20260327-ai-agents`; S27 „Sandboxing im Vergleich" → ai-agents (Konfigurations-Sicht); S28 „Sub-Agents" → ai-agents (Orchestrierung) + `20260522-open-rewrite` (Determinismus-Alternative); S17/S19 (Token-Ökonomie/Skills) → ai-agents.

### Overflow (gemessen)

- [ ] (S) S33 „Architektur-Radar": +51px (nur firefox dark) — Radar-Legende.
- [ ] (S) S42 „Kernaussagen": +11px (firefox) — Schlussabsatz.

### Komponenten & Theme

- [ ] **(M) `AgentSimulation.vue:165–182`: globaler `document`-keydown-Handler** — Space blockiert mit `preventDefault` die Slidev-Navigation, solange die Komponente gemountet ist (auch auf Nachbar-Slides!); Pfeiltasten steuern Simulation UND Slidev gleichzeitig. Handler an aktive Slide koppeln (`useNav().currentPage`) oder fokus-basiert.
- [ ] (M) **Accessibility-Hauptbefund des Repos**: Chart-Serienfarben fixe Tailwind-400er in beiden Modi → 1.5–2.3:1 auf Weiß (`chartData.ts`, CachePricingBar, ToolAccuracyLine, SkillsVsMcpLine, LeakModuleBar). Fix-Muster steht im selben Deck: `ToolSearchImpact.vue:15` (`d ? "#4ade80" : "#16a34a"`). Einzelfälle: HarnessTable „OpenCode"-Spalte #facc15 = 1.5:1 (S), TaxonomyTreemap weiße Labels auf 400er-Zellen = 2.0–2.5:1 in beiden Modi (S), SchichtenVars-Akzente 1.6–2.1:1 (S).
- [ ] (S) CachePricingBar: Write/Read nur über Orange/Grün unterscheidbar (Deutan-Problem) — Blau/Orange oder Label an Balkengruppe.
- [ ] (M) `EngineeringSchichten.vue` eigene Tab-Bar → shared `Tabs.vue` (trivialer 5-Tab-Switcher).
- [ ] (M) Duplikate dedupen: LeakStatsGrid ↔ ToolSearchImpact (Stat-Card-Grid), HarnessTable ↔ McpOptTable (Badge-/Tabellen-CSS, Carbon-Palette auch in java-null AnnotationCompatTable) → gemeinsames StatGrid/Badge bzw. deck-lokales `palette.ts`.
- [ ] (S) Aufräumen: `engineering-schichten-infografik.html` (58 KB Design-Artefakt im Deck-Root), ungenutzter `public/fonts/0xProto`-Symlink (oder `fonts:`-Frontmatter ergänzen und nutzen).

### Sprache & Stil

- [ ] (S) „Sub-Agents"/„Sub-Agenten"/„Subagent(en)" — drei Varianten im Deck; auf „Subagents" normieren (= ai-agents-Konvention).
- [ ] (S) Zahlenformate: „59.8 MB" (engl.) neben „9.707 Zeilen" (dt.); „79,5 %" vs. „~1.2%" — deutsches Format konsequent.
- [ ] (S) „hashed"/„decodet" → „hasht"/„dekodiert"; Genus festlegen („der/die Loop", „der/das Harness"); „OpenAI-fokus." → „OpenAI-Fokus"; S42-Imperativ „Investiert in …" an unpersönlichen Stil angleichen.

### Struktur & Notes

- [ ] (M) Quellen-Slide vor S45 — 7 Quellen stehen unverlinkt auf der End-Slide; **0/45 Notes** trotz faktendichtester Slides des Repos (S21/S24/S25/S38 ohne Beleg-URLs; ai-agents macht es mit Notes vor).
- [ ] (S–M) Quiz fehlt — natürlichstes Quiz-Paar mit ai-agents, Stoff ist faktisch-knackig (Skizze unten).

---

## 20260428-java-null-pointer (51 Slides)

### Inhalt & Fakten

- [ ] (S) S41 (JepTimeline) + S2: **LTS-Markierung falsch** (web-verifiziert): LTS-Folge ist 25 → **29 (Sep 2027)** → **33 (Sep 2029)**; JDK 31 (Sep 2028) ist KEIN LTS. Auch Presenter-Note „31 (2029)" und „frühestens JDK 31 stable" (S2) sowie den deck-internen Widerspruch „stable ≥ 2028" (AnnotationCompatTable) auflösen.
- [ ] (S) S5: „JSpecify 1.0 (August 2024)" → **17. Juli 2024** (InfoQ-Artikel von Aug 2024 ist die Verwechslungsquelle).
- [ ] (S) S21: „Lombok @NonNull Default seit 1.16.20: NPE" — NPE ist Default **seit Feature-Einführung 2013** (v0.11.10); 1.16.20 hat damit nichts zu tun.
- [ ] (S) S17/S40: „JEP 401 preview ab JDK 27/28" — **JDK 27 ist raus** (RDP1 04.06.2026, nicht targeted); „frühestens JDK 28" formulieren.
- [ ] (S) S27-Note: Mockito-/AssertJ-Claims korrigieren — `RETURNS_SMART_NULLS` per Settings gibt es seit Mockito 2 (kein v5-Feature, kein globaler Default; Javadoc-Anekdote: „probably the default in 3.0.0" — nie eingelöst); **AssertJ hat keinen JSpecify-Support** (offenes Issue #3727).
- [ ] (S) S6-Note: „JetBrains-Annotationen ab IntelliJ 2025.3 deprecated" → 2025.3 **bevorzugt** JSpecify (Quick-Fixes); formale Deprecation ist nur ein offener Request.
- [ ] (S) S48-Note: „Boot 2.x seit Mai 2025 out of support" — falsch (OSS-Ende 30.06.2023, kommerziell bis 2029); streichen oder präzisieren.
- [ ] (S) S30: „assert nur mit -ea" → entscheidend ist das Compile-Flag `-XepOpt:NullAway:AssertsEnabled=true`, nicht die JVM-Option.
- [ ] (S) S6/S24/S45 + Quiz: Recipe-Name exakt **`MigrateToJSpecify`** (großes S).
- [ ] (S) S26 „Spring-Boot-4-Tücken": „Records oft besser geeignet" steht in der JPA-Entity-Spalte — Records taugen nicht als @Entity (kein No-Arg-Konstruktor, final); auf „für DTOs/Projections" präzisieren. (Direkter Widerspruch zum design-pattern-Deck, das es korrekt sagt.)
- [ ] (S) S29 vs. S47: NullAway-Overhead „~10 %" vs. „5–10 %" vereinheitlichen.
- [ ] (S) S5 vs. S24: „Spring vollständig adoptiert" vs. Tabelle „Spring Data/Security 🟡 in Arbeit" — S5 auf „Core vollständig, Portfolio rolling" abschwächen.
- [ ] (S) S6: JSR-305-Spalte „Seit 2012" → 2006 (2012 ist das Abbruch-Jahr, sagt S5 selbst).
- [ ] (S) S16: „get() ohne Refinement" nutzt den Begriff 12 Slides vor seiner Einführung (S28/29) — umformulieren.
- [ ] (S) S20-Note vs. S48-Note: Initializr-Aussagen wirken widersprüchlich (gemeint: NullAway-Setup vs. JSpecify-Dependency) — präzisieren; S20-POM: `<version>` bei jspecify raus oder Note anpassen.
- [ ] (S) S20 (Maven-Setup): `annotationProcessorPaths` enthält nur `nullaway` — **`error_prone_core` fehlt, Setup kompiliert so nicht** (Gradle-Variante hat beide).
- [ ] (S) S25: `import java.util.Optional;` fehlt im gezeigten Import-Block.
- [ ] (S) S11: `module com.example.kfzif` — internes Arbeitgeber-Kürzel → `com.example.shop`.
- [ ] (S) S21/S49: „Wrapper-Pattern" für @Builder wird 2× erwähnt, nie erklärt — Halbsatz ergänzen.
- [ ] (S) S30 vs. S49: `isPresent()/get()` als „✅ Optional-Idiom" markieren als „(erkannt, nicht empfohlen)" — Cheatsheet migriert es zu `ifPresent`.

### Querverweise

- [ ] (M) `setup/main.ts` anlegen (s. Übergreifend), dann: S24 „Spring Boot 4" unter dem Migration-Recipe-Block → TalkXref `20260522-open-rewrite` (schließt den von JspecifyCrossRef behaupteten Kreis; das Recipe wird 4× erwähnt, 0× verlinkt; sekundär S45). S21 „Lombok — Mythen vs. Realität" → `20260606-design-pattern` (Records/@Builder/named args, eine Inline-Zeile genügt). Optional S19/S20 → gradle.

### Overflow (gemessen — alle: Code unter der Monaco-Fold)

- [ ] (S) S19 „Build-Setup — Gradle": +72px, S20 „Build-Setup — Maven": **+143px**, S25 „Service-Layer-Beispiel": **+159px**, S27 „Testing": +108px — Editor-Höhen vergrößern, Code kürzen oder bewusst scrollbar lassen (dann Presenter-Note „scrollen!").

### Komponenten & Theme

- [ ] (S) NarrowingExplorer (S34): `role="tablist"/"tab"` ergänzen (Overflow-Check-Lücke, s. Übergreifend); shared-Tabs-Migration lohnt hier nicht (Stepper-verzahnt).
- [ ] (M) 4 Komponenten (AnnotationCompatTable, JepTimeline, NarrowingExplorer, KotlinInteropDiagram) hand-rollen dieselbe Carbon-Palette — auf `shared/quiz/lib/carbonTokens.ts` bzw. usePalette umstellen.
- [ ] (S) Optional: S19/S20 mit shared `Tabs` (Gradle/Maven) auf eine Slide zusammenführen.

### Sprache & Stil

- [ ] (S) „indirizieren" (NarrowingExplorer) → „umleiten"; „den ganzen Codebase" → „die Codebase"; „Read-Atomizität" → „Atomarität"; „Klammeraffen am Call-Site" → „an der Call-Site"; S27-Titel „skipped" → „skips"; „Kotlin's" → „Kotlins" (Quiz, 2×); „hierhin" → „hierher" (S5).
- [ ] (S) „Null-Sicherheit" vs. „Null-Safety" vs. „nullsafe" — Konvention wählen (Titel sagt „Null-Sicherheit").
- [ ] (S) Anführungszeichen: durchgängig ASCII-Schlusszeichen → typografisches `"`.

### Struktur & Notes

- [ ] (M) Reading-List-Slide vor „Danke" (S50) — Quellen sind nur Mini-Footer; dort auch die neuen TalkXrefs bündeln.
- ✓ Notes-Abdeckung 41/51 — bestes Deck im Repo, kein Handlungsbedarf.

---

## 20260522-open-rewrite (36 Slides)

### Inhalt & Fakten

- [ ] (S) S26 (JspecifyCrossRef) + S34: **Stale Slide-Ranges, nachgemessen falsch** — „Slides 8–18" ist heute S4–S13, „Slide 12 (Quellen-Übersicht)" ist S6. An 3 Stellen dupliziert. Fix: Zahlen raus, Sektionsnamen oder `routeAlias`-Anchor nutzen (s. Übergreifend).
- [ ] (S) S2 „Kurzfassung" vs. S14/S18: „Pattern 1 ist der **einzige** produktionserprobte Workflow" widerspricht „Pattern 1 **und 2** sind die einzigen produktionsreifen Zonen" (S18) und dem „produktiv"-Badge von Pattern 2 (S14).
- [ ] (S) S24 „Mechanische Migration via Recipe" — Bündel von 5 kleinen Fixes: (a) YAML-description + Note behaupten JetBrains-Ersetzung, recipeList hat nur Spring/javax-ChangeTypes; (b) Precondition `UsesType: org.springframework.lang.Nullable` überspringt javax-only-Dateien (widerspricht dem Misch-Szenario von S23); (c) Annotation-Ranges um 2 verschoben (korrekt `[10,22]`/`[23,26]`); (d) „Pattern 2 aus dem vorigen Kapitel" → Kapitel 3; (e) „Conditional"-Annotation braucht `onlyIfUsing:` im YAML.
- [ ] (S) Recipe-Name: **`MigrateToJSpecify`** (großes S) — betrifft S24-YAML/Note und Quiz.
- [ ] (S) S11: Annotation „list" `[10,19]` schneidet `newVersion: 2.0.x` (Z. 20) ab → `[10,20]`.
- [ ] (S) S31 „Kotlin-Support": **Markdown-Bug** — `<code>exclusion("\*_/_.kt")</code>` rendert als `*/.kt`; Backticks verwenden: `` `exclusion("**/*.kt")` ``. Zudem: Tracking-Issue ist **#6007** (Done!, Fix #6338), #6621 wurde als Duplikat geschlossen — die Kotlin-Aussage ist evtl. zu pessimistisch, K2-2.2-Support ist gelandet.
- [ ] (S) S20: „MPL" einmal explizit gegen Mozilla Public License abgrenzen; S2-Note „vor einem MPL-Update stehen" umformulieren.
- [ ] (S) Konsistenz zu java-null: S24/S25-Abwägung „@Nullable User oder Optional<User>?" relativiert kommentarlos die apodiktische Regel des Null-Talks („Optional ist Rückgabetyp. Punkt.") — Halbsatz zur Abgrenzung ergänzen.
- ✓ Web-verifiziert und korrekt: MSAL-Wechsel 13.12.2024 (still, inkl. rewrite-hibernate), Moderne/Netflix-Gründungsgeschichte, Knight-Capital-Details (SEC 8-K).

### Querverweise

- [ ] (S) Rückverweis → `20260327-ai-agents` fehlt (ai-agents S29 verlinkt hierher mit Stichwort „Determinismus-Grenze"): auf S13 „Pattern 1" oder S18 „Achsenkreuz"; minimal-invasiv als zweite Zeile in S34 „Reading List".

### Overflow (gemessen — alle: Code unter der Monaco-Fold)

- [ ] (M) S10 „Recipe-Mechanik": Anatomie-Tab **+181px**, Visitor +80px, MethodMatcher +64px; S11 „Recipe-Komposition": YAML-Tab +95px, Preconditions +64px; S23 +162px; S24 +162px; S25 +170px; S32 +16px. Pro Slide entscheiden: Editor höher, Code kürzen, oder bewusst scrollbar + Presenter-Note.

### Komponenten & Theme

- [ ] (S) S34 „Reading List": von `layout: end` auf `layout: default` umstellen (kämpft gegen zentriertes End-Layout; zwei end-Slides hintereinander). „URLs" sind `<code>`-Text — echte Links setzen; die abgekürzte URL auflösen: `https://infosecwriteups.com/when-open-source-isnt-how-openrewrite-lost-its-way-642053be287d` (Leitschuh-Writeup, im Faktencheck identifiziert).
- [ ] (S) RecipeMechanikTabs/RecipeKompositionTabs: identischer 14-Zeilen-`--sk-tab-*`-Block dedupen; lokale `.callout` vs. shared Callout entscheiden.
- [ ] (M) 5× AiPattern-Pipeline-SVGs + LstAnatomy/RecipeTypesDecisionTree teilen ~40 Zeilen identisches CSS; 5 Tabellen-Komponenten identisches Tabellen-CSS — je eine gemeinsame Basis extrahieren.
- ✓ Theme vorbildlich: einziges Deck ohne hardcodierte Hex-Werte in lokalen Komponenten.
- [ ] (S) RiskMatrix (S29): Severity nur als Farbpunkt (grün/amber/rot, Deutan-Problem) — Text-Badge oder ▲●▼.

### Sprache & Stil

- [ ] (M) Genus „Recipe" schwankt (das/die/eine) — festlegen; „KI" vs. „AI" gemischt, teils im selben Satz — KI im Fließtext, AI nur in Eigennamen.
- [ ] (S) „authort" (S14 aria-label) → „autoriert"; „Contributors" vs. „Contributoren"; „in CI committed" → „committet".

### Quiz

- [ ] (S) 3 Transfer-Fragen mit ASCII-Deutsch ohne Umlaute („urspruenglich", „fuer", „haette") — Umlaute restaurieren (`moderne-netflix-origin`, `codemod-landscape-polyglott`, `knight-capital-deploy-disaster`).
- [ ] (S) Authoring-Leak in Feedback-Texten: „Wörtlich aus den slide-data-Notizen", „laut Presenter-Notes" → „aus dem Talk".
- [ ] (M) 7 Fragen mit d:0 (ohne depends-Option) wiegen im Sampler schwerer — je 1 depends ergänzen, wo fachlich tragfähig; `msal-pivot` (easy) verlangt exaktes Datum → Datum in die Frage ziehen.

---

## 20260606-design-pattern (58 Slides)

### Inhalt & Fakten

- [ ] (S) S32 „Kurz: Facade · Composite · Bridge · Proxy": Widerspruch auf derselben Slide — Bullet „Proxy bleibt **[KONZEPT]**" vs. Fußzeile „**Alle vier: [RELEVANT]**". Fußzeile differenzieren.
- [ ] (S) S53 (pattern-language-matrix.json): Factory mit `short: "Schicht 3"` gelabelt — laut eigener Taxonomie (S6) und Detail-Text Schicht-1-Fall.
- [ ] (S) S8 „Lese-Anleitung": Label **[SPRACHABH.]** wird definiert, aber nie verwendet — ausgerechnet Builder (S20–S24) trägt gar kein Status-Label. Builder-Folien mit „· [SPRACHABH.]" labeln (löst beides).
- [ ] (S) S26 „Lazy Initialization": drei Einordnungen (Matrix sagt „Schicht 1", Folie hängt in „3. Sonderfall Builder", Text sagt „kein GoF-Muster") — Matrix-short auf „Sonderfall".
- [ ] (M) S51: Sektion „Pattern × Sprache" kommt NACH „7. Meta-Analyse & Schluss", obwohl S8 sie „Schluss-Matrix" nennt, und ist unnummeriert (bricht die 1–7-Nummerierung im ToC) — vor das Fazit ziehen oder als „8." nummerieren.
- [ ] (S) Label-Varianten „[ERSETZT durch ADTs]" (S15), „[ERSETZT (Implementierung)]" (S34) ans S8-Schema angleichen (optional).
- ✓ Faktencheck: JDK-Daten dieses Decks sind korrekt (LazyConstant ~JDK 29 = LTS Sep 2027 ✓ — im Gegensatz zum java-null-Deck); Norvig/Graham/Gamma, Lombok-, Rust-, Go-, Python-Claims plausibel; Drei-Schichten-Taxonomie konsistent durchgehalten.

### Querverweise

- [ ] (S) S25 „Pflichtfeld-Durchsetzung pro Idiom": Inline-TalkXref → `20260428-java-null-pointer` (JEP 8303099 ist dort Kernthema; bisher erfährt der Hörer erst im Bonus S56 davon).
- [ ] (S) S32: „→ Teil III" ist toter Text (Sektionen heißen 1.–7.) → „→ Sektion 6" + `<Link>`; S36 „Volle Cluster-Tabelle im Bonus" → `routeAlias` auf S55 + `<Link>` (Vorbild: S10→S26 `lazy-init` funktioniert).
- [ ] (S) §-Referenzen aufs Referenzdokument fürs Publikum umformulieren: S42 „Fall A aus §9.3", S50/S57 „§5/§7" (kollidiert optisch mit den Slide-Sektionen 5/7).

### Overflow (gemessen)

- [ ] (S) S41 (Tab „Fall B — Receiver-Bindung"): +10px (chromium/firefox) — Callout-Text kürzen.

### Komponenten & Theme

- [ ] (M) `PatternTabs.vue`: eigene Tab-Bar → shared `Tabs.vue` (meistgenutzte Komponente des Decks, 24 Folien — bekäme ARIA + Tastatur-Nav gratis); lokale `.callout`/`.caveat`-Boxen → shared `Callout` (caveat ≈ tone="warning").
- [ ] (S) `meta.ts:246`: `language: "jsx"` — Monaco hat keinen jsx-Tokenizer, React-Tab rendert ohne Highlighting → `javascript` + Badge-Override (oder Alias in MonacoBlock). `lazyinit.ts:181`: `csharp` fehlt in MonacoBlock.LANGUAGE_META → grauer Fallback-Badge.
- ✓ Mermaid-Anforderungen eingehalten (theme="default" + :key auf isDark); Style-Blöcke token-basiert.

### Sprache & Stil

- [ ] (S) `schicht1.ts:69`: einzige Du-Anrede im sonst unpersönlichen Deck → „Man kontrolliert…".
- [ ] (S) slides.md: ~30× ASCII-Schlusszeichen `"` (data/\*.ts machen es korrekt) — normalisieren.

### Struktur & Notes

- [ ] (M) Notes-Abdeckung 9/58 — mindestens Divider + argumentative Slides (S20, S21, S37, S41, S44, S49) ergänzen.
- [ ] (L) Quiz fehlt — die depends-Verdict-Semantik der Engine passt nirgendwo besser („hängt von der Sprache ab" ist die Kernthese); Skizze unten.

---

## Quiz & Transferfragen (übergreifend)

### Bestehende Quizze angleichen

- [ ] (M) **ai-agents: Difficulty-Pyramide reparieren** — 2/13/20 (easy/medium/hard) bricht die adaptive Engine: Wer auf medium scheitert, erschöpft den easy-Pool nach 2 Fragen und wird zurück auf medium gezwungen. 4–6 medium-Fragen auf easy rekalibrieren oder neue easy-Fragen schreiben. (java-null 5/7/4 und open-rewrite 4/8/4 sind sauber pyramidal.)
- [ ] (S) Niveau-Reklassifizierungen: ai-agents `agent-sdk-billing-2026`, `gemini-antigravity-migration` hard→medium; java-null `records-vs-lombok`, `history-other-langs` hard→medium; ai-agents `loop-scheduling` ist kein echtes easy.
- [ ] (S) ai-agents `transfer-mcp-spec-2025-11` (t:5/f:1): einzige false-Option erscheint in jedem Sample → vorhersagbar; min. 2 false.
- [ ] (M) ai-agents: Ur-Batch (16 Fragen) von 7 auf 8 Optionen auffüllen; 29 Mikro-Sections auf 5–9 Buckets konsolidieren („Transfer · X" → „transfer").
- [ ] (S) ai-agents `autonomy-axes-loop-goal-workflows`: Umlaut-Mix („faechern", „schliessen") normalisieren.
- [ ] (M) java-null: Feedback-Texte teils nur 2 Wörter („Standard-Architektur.") — Untergrenze 1 ganzer Satz mit Begründung.
- [ ] (S) Anrede vereinheitlichen (Empfehlung: Du — passt zum Vortragsstil; java-null ist heute unpersönlich).

### Transferfragen-Kandidaten (in bestehende Quizze einbaubar)

- [ ] (S) **AiAgentsQuiz**: „Skills vs. MCP aus Token-Sicht" (medium, Brücke agents-details); „Warum überlebt ‚don't push' die Session nicht?" — Compaction als Mechanik hinter Consent-Scoping (hard); „Clinejection auf Gradle übertragen — was hätten Verification Metadata/Cooldown gebrochen?" (hard, Brücke gradle); „Pattern-1-Build-Loop als /goal-Lauf" (hard, Brücke open-rewrite).
- [ ] (S) **OpenRewriteQuiz**: „Hooks : Rules = Recipe : LLM-Gap-Fill" (medium, Brücke ai-agents); „Nicht-deterministische Wächter in CI" — Auto-Mode-Klassifikator und Pattern 3 als gleiche Fehlerklasse (hard); „50+ package-info.java generieren → ScanningRecipe/generate(acc)" (hard, Brücke java-null).
- [ ] (S) **NullSafetyQuiz**: „Wer meldet die Fehler nach Stufe 2? (NullAway in ErrorProne)" (medium, Brücke open-rewrite); „@Nullable User vs. Optional<User> am Gap-Fill-Decision-Point" (medium); „Pflichtfelder: Staged Builder (Compile-Zeit) vs. Lombok @NonNull (Laufzeit)" (hard, Brücke design-pattern); „Null Object [ERSETZT] vs. Optional vs. @Nullable" (medium).

### Neue Quizze (4 Decks ohne)

- [ ] (M) **gradle**: ① Resolution & Locking ② BOM vs. Catalog vs. ext (natürliche depends-Fälle) ③ Snapshots & Caching ④ Supply-Chain (hard). ~14–16 Fragen (4/7/4), Schema t:3/f:3/d:2, +2 transfer (ai-agents-Brücke).
- [ ] (M) **grafana**: ① Methodologien (easy) ② Saturation & Schwellwerte ③ Systemdynamik & Hysterese (hard) ④ LGTM & Korrelation. ~14–16 (4/8/4); Schwellwert-Fragen sind ideale depends-Kandidaten; als Selbsttest NACH den Interaktiv-Slides positionieren, deren Szenarien nicht doppeln.
- [ ] (S–M) **agents-details**: ① Agent-Loop & Tool-Use (easy) ② Context & Token-Ökonomie ③ Cache & Sessions (hard) ④ Architektur & Memory + transfer-Section zu ai-agents. ~16 (4/8/4). Stoff schreibt sich fast aus den Slides.
- [ ] (L) **design-pattern**: ① Taxonomie & Status-Labels (easy) ② Schicht 1 ersetzt ③ Builder & Lazy Init ④ Metaprogramming-Substrat (hard). ~16–18 (4/8/5); 2 depends-Optionen pro Frage sind hier inhaltlich tragend („hängt von der Sprache ab"); +2–3 transfer zu java-null.

---

## Tote Links

- ✓ **Keine.** Alle 46 geprüften externen URLs antworten mit HTTP 200 (inkl. der fünf 2026er-Blog-URLs und der TalkXref-Ziele auf geggo98.github.io).
- [ ] (S) Einzige Ausnahme by design: die abgekürzte `infosecwriteups.com/...642053be287d` in der open-rewrite Reading List (S34) — volle URL siehe dort.
