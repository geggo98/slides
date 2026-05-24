---
theme: default
title: "OpenRewrite — Refactoring at Scale für Spring Boot"
info: |
  LST, Recipes, KI-Pattern und ein JSpecify-Praxisbeispiel.
  Querverweis: Java Null-Sicherheit 2026.
monaco: true
mdc: true
transition: slide-left
colorSchema: auto
fonts:
  sans: Inter
  mono: 0xProto
hideInToc: true
---

# OpenRewrite — Refactoring at Scale für Spring Boot

LST, Recipes und KI im Build-Loop — am Beispiel JSpecify

<div class="mt-8 text-sm opacity-60">

Zielgruppe: Java- und Spring-Boot-Entwicklerinnen und -Entwickler, die ihre Codebase nicht von Hand zu Tode patchen wollen

</div>

<!--
- Stand: Mai 2026.
- Wir reden Klartext: Lizenz-Schmerzen, AI-Halluzinationen, Kotlin-Realität werden benannt.
- Der Vortrag hat 7 Sektionen — Inhaltsverzeichnis auf der nächsten Slide nach dem TL;DR.
- Praxisbeispiel JSpecify-Migration verbindet Recipe-Mechanik mit KI-Pattern 1+2.
-->

---
layout: center
hideInToc: true
---

# TL;DR

<div class="text-left mt-8 max-w-3xl mx-auto space-y-4">

1. **LST > AST.** OpenRewrites Lossless Semantic Tree erhält Whitespace _und_ Typinformation — Voraussetzung für reviewbare Diffs.
2. **Recipes sind deterministisch — und das ist das Killer-Feature.** Gleiche Eingabe → identische Ausgabe. KI nur dort, wo die Determinismus-Grenze sie überlebt.
3. **Pattern 1 (Recipes-first + AI im Build-Loop) ist der einzige produktionserprobte KI-Workflow.** Pattern 3 (LLM in Recipe) ist ein Anti-Pattern.
4. **Lizenz-Audit ist Pflicht.** Seit 13.12.2024 ist `rewrite-spring` MSAL — „Community Edition" heißt hier „source available, kommerziell restriktiv".

</div>

<!--
- Wer Spring-Recipes ungeprüft in CI committed, kann morgen vor einem MPL-Update stehen.
- JSpecify-Migration zeigt alle drei AI-Ebenen in einer Story: Mechanik, LLM-Recipe-Authoring, LLM-Gap-Fill.
-->

---
hideInToc: true
---

# Inhalt

<Toc mode="all" minDepth="1" maxDepth="1" columns="2" listClass="!list-none !pl-0" />

---
layout: section
---

# 1. Was OpenRewrite ist

Format-erhaltend und typ-aware — die LST-Foundation

---
hideInToc: true
---

# OpenRewrite kurzgefasst

<div class="grid grid-cols-2 gap-8 mt-4">
<div>

### Was es ist

- **Refactoring-Framework** für JVM-Codebases at scale
- Parst Sourcen in einen **LST** (Lossless Semantic Tree)
- Mutiert per **Visitor**, serialisiert zurück
- Recipes sind **deterministisch** — gleiche Eingabe → identischer Diff
- Maintainer: Moderne, Inc.; Engine Apache 2.0

</div>
<div>

### Was es nicht ist

- **Kein Linter** (keine Reports, ändert direkt)
- **Kein IDE-Plugin** (CLI / Gradle / Maven)
- **Kein regex-basiertes sed** — type-aware, Cursor-API für Parent-Kontext
- **Kein AST-only-Tool** — behält Formatierung beim Round-Trip
- **Kein magisches AI-Werkzeug** — KI ist ein additives Pattern, kein Ersatz

</div>
</div>

<!--
- Spring Boot 3.x Upgrade (javax → jakarta) ist der Killer-Use-Case.
- Vanilla-OpenRewrite ist heap-limitiert; Moderne ist der proprietäre Multi-Repo-Hebel.
-->

---
hideInToc: true
---

# Das LST — der eigentliche Hebel

<LstAnatomy class="mt-4" />

<!--
- JavaParser und Spoon haben AST + Type-API, aber verlieren Formatierung beim Re-Print.
- Comby/ast-grep haben CST, aber keine Type-Awareness.
- LST = CST + Type Attribution → beide Welten, deshalb klein-und-reviewbar.
-->

---
hideInToc: true
---

# Recipe-Ökosystem — was es out-of-the-box gibt

<RewriteCatalog class="mt-4" />

<!--
- Kompletter Katalog: https://docs.openrewrite.org/recipes
- Mischlizenzen: rewrite-spring und rewrite-hibernate sind MSAL, der Rest mehrheitlich Apache.
- Achtung Plugin-Version: niemals latest.release in CI.
-->

---
layout: section
---

# 2. Recipes bauen — drei Wege

YAML, Refaster, Imperative — in dieser Reihenfolge

---
hideInToc: true
---

# Die drei Recipe-Typen

<RecipeTypesDecisionTree class="mt-4" />

<!--
- 60/25/15 ist eine Faustregel aus der Praxis, kein offizieller Wert.
- Wer mit YAML startet, kann später jederzeit zu Refaster oder Imperative wechseln — der umgekehrte Weg ist teurer.
- „Do no harm" ist die Recipe-Maxime: lieber gar nichts ändern als falsch ändern.
-->

---
hideInToc: true
---

# Recipe-Mechanik

<RecipeMechanikTabs class="mt-2" />

<!--
- Vier Konzepte aus Stepper 1: Anatomie, Visitor, MethodMatcher, JavaTemplate.
- Anatomie: drei Idiom-Punkte — neue Instanz, do-no-harm, Determinismus.
- Visitor: super.visit() vergessen ist Anfänger-Fehler #1.
- Matcher: AspectJ-Syntax; * für Typ-Wildcard, .. für Args-Wildcard.
- Template: niemals String-Concat. Anfänger-Fehler #2.
-->

---
hideInToc: true
---

# Recipe-Komposition

<RecipeKompositionTabs class="mt-2" />

<!--
- Drei Konzepte aus Stepper 1: Preconditions, YAML-Komposition, Spring-Boot-Tree.
- Preconditions sparen Edit-, nicht Parse-Aufwand — wichtige Subtilität für Performance-Erwartungen.
- YAML-recipeList läuft sequenziell — Reihenfolge zählt.
- UpgradeSpringBoot_4_0 ist rekursiv: 4.0 → 3.5 → 3.4 → … → 2.0.
-->

---
layout: section
---

# 3. KI + OpenRewrite — die Determinismus-Grenze

Fünf Pattern, sortiert nach Reife und Risiko

---
hideInToc: true
---

# Pattern 1: Recipes-first, AI im Build-Loop

<AiPattern1Card class="mt-2" />

<!--
- Duolingo Golden Path Case Study (FINOS): Spring-Boot- und JDK-Upgrades über die gesamte Codebase.
- Pattern 1 ist im Kern: Build ist die Ground-Truth, AI ist Patch-Maker.
- Iteration-Limit nicht vergessen — sonst läuft der Token-Zähler heiß.
-->

---
hideInToc: true
---

# Pattern 2: AI als Recipe-Autor

<AiPattern2Card class="mt-2" />

<!--
- Moderne Skills sind LLM-Instruktionen, die einem Coding-Agent Recipe-Authoring beibringen.
- Praktischer Bonus: das Recipe wird einmal reviewt, dann läuft es deterministisch.
- Genau dieses Pattern werden wir in der JSpecify-Sektion sehen.
-->

---
hideInToc: true
---

# Pattern 3: LLM in Recipe — das Anti-Pattern

<AiPattern3Card class="mt-2" />

<!--
- rewrite-generative-ai existiert in der OpenRewrite-Org als experimentelles Repo.
- Das README warnt vor Produktiveinsatz — das ist selten so explizit.
- Wer den Diff bei jedem Run anders bekommt, hat keine Refactoring-Recipe, sondern ein Lotterielos.
-->

---
hideInToc: true
---

# Pattern 4: Prethink — Pipeline umgedreht

<AiPattern4Card class="mt-2" />

<!--
- FINOS CALM (architecture-as-code) ist die offene Spec dahinter.
- Idee: Recipe liest LST → produziert strukturierten Markdown/CSV → Agent reasoned darüber.
- Was Moderne als „Prethink" verkauft, kann jedes Team mit eigenen Recipes nachbauen.
-->

---
hideInToc: true
---

# Pattern 5: MCP-basierter Recipe-Call

<AiPattern5Card class="mt-2" />

<!--
- Moderne MCP Server exponiert run_recipe, find_recipes, analyze_impact.
- Agent entscheidet pro Turn neu — das ist Feature *und* Bug.
- Für Exploration nützlich, für reproduzierbare CI-Pipelines nicht.
-->

---
hideInToc: true
clicks: 6
---

# Die Determinismus-Grenze als Achsenkreuz

<DeterminismAxisChart class="mt-4" />

<!--
- Je näher der LLM-Output zur PR-Boundary kommt, desto schmerzhafter die Verletzung.
- Pattern 2 (AI als Recipe-Autor) ist die wirtschaftlichste Position: Determinismus hoch, Token-Kosten einmalig.
- Pattern 3 ist die rote Zone — Maintainer raten selbst davon ab.
- Pro Klick erscheint ein Pattern mit Kurzbeschreibung — am Ende stehen alle fünf im Vergleich.
-->

---
layout: section
---

# 4. Lizenzen: Apache, MSAL, MPL

Was sich Ende 2024 verschoben hat und warum es dich betrifft

---
hideInToc: true
---

# Die drei Editionen im Vergleich

<LicenseMatrix class="mt-4" />

<div class="mt-4 text-sm opacity-70 max-w-4xl">

Am 13. Dezember 2024 sind die `rewrite-spring`-Recipes von Apache 2.0 nach MSAL gewechselt — ohne Vorwarnung an Contributors. Juristisch erlaubt (Apache 2.0 lässt das zu), strategisch ein Vertrauensschaden.

</div>

<!--
- „Community Edition" im Recipe-Katalog heißt MSAL, nicht OSS. Marketing-Falle.
- MPL-Recipes (Multi-Repo, AI-augmentiert) sind nur über Moderne-Subscription erreichbar.
- Wer ernsthaft baut: jährliches Lizenz-Audit pro Recipe-JAR.
-->

---
hideInToc: true
---

# Praxis-Konsequenz: Audit vor Adoption

<LicenseAuditChecklist class="mt-4" />

<!--
- Die Checklist gehört in den Definition-of-Done für CI-Integration.
- Wer `latest.release` nutzt, sieht Lizenz-Drift erst, wenn der Build kaputt ist — oder schlimmer, in einem Vendor-Audit.
- gradle-license-report oder die OpenRewrite-eigene DependencyLicenseCheck-Recipe automatisieren das.
-->

---
layout: section
---

# 5. Praxisbeispiel: JSpecify-Migration

Drei Ebenen, wo KI hilft — und wo nicht

---
hideInToc: true
---

# Ausgangslage: gemischte Null-Annotationen

<JspecifyMixedBlock class="mt-2" />

<div class="mt-3 text-sm opacity-70">

Typischer Spring-Boot-Bestand: <code>org.springframework.lang.Nullable</code> aus dem Spring-Stack, <code>javax.annotation.Nonnull</code> aus dem JSR-305-Zeitalter, dazu Methodenrümpfe, deren Null-Semantik nicht in der Annotation steht. Drei verschiedene Toolchains — keiner versteht alle gleich.

</div>

<!--
- 15 Jahre Annotation-Wildwuchs: Spring, JetBrains, Eclipse, Checker FW, JSR-305 — alle inkompatibel.
- JSpecify 1.0 (August 2024) ist der Konsens-Punkt: Google, Oracle, JetBrains, Spring, Sonar, Uber.
- Annotationen kann man mechanisch ersetzen — Methodensemantik nicht.
-->

---
hideInToc: true
---

# Schritt 1: Mechanische Migration via Recipe

<JspecifyRecipeBlock class="mt-2" />

<div class="mt-3 text-sm opacity-70">

100 % deterministisch, idempotent, läuft <em>ohne</em> LLM. Vier <code>ChangeType</code>-Aufrufe ersetzen Spring/javax durch JSpecify. Auch das Recipe selbst kann LLM-autoriert sein — <strong>Pattern 2</strong> aus dem vorigen Kapitel.

</div>

<!--
- Standard-Recipe ist `org.openrewrite.java.jspecify.MigrateToJspecify` (~80 % Coverage laut Null-Sicherheit-Talk).
- Hier zeige ich eine eigene YAML-Variante, weil sie auch JetBrains-Annotationen aufnimmt.
- Pattern 2: Recipe wird einmal LLM-autoriert, dann beliebig oft deterministisch angewendet.
-->

---
hideInToc: true
---

# Schritt 2: LLM füllt die Lücken (Pattern 1, Build-Loop)

<JspecifyAfterBlock class="mt-2" />

<div class="mt-3 text-sm opacity-70">

Annotationen sind getauscht. Aber <code>@NullMarked</code> macht den Default <code>@NonNull</code> — und der Build zeigt: <code>findByEmail</code> kann <code>null</code> zurückgeben. <strong>Hier endet die Mechanik.</strong> Der Coding-Agent (Pattern 1) liest den Kontrollfluss, schlägt <code>@Nullable User</code> oder <code>Optional&lt;User&gt;</code> vor — bis der Build grün ist.

</div>

<!--
- @NullMarked auf Package-Ebene (package-info.java) ist idiomatischer als pro Klasse.
- NullAway prüft den Rest — der Build wird zum Gate für den AI-Loop.
- Genau das Pattern, das im FINOS-Bericht und bei Duolingo dokumentiert ist.
-->

---
hideInToc: true
---

# Querverweis: Java Null-Sicherheit 2026

<JspecifyCrossRef class="mt-4" />

<!--
- Die beiden Talks ergänzen sich: hier das Tooling, dort das Konzept.
- Im Null-Sicherheit-Talk wird der OpenRewrite-Recipe `MigrateToJspecify` als Migrationshebel genannt.
- Hier ist die andere Seite: was tut die Recipe konkret, wo hört sie auf, wie ergänzt KI sie.
-->

---
layout: section
---

# 6. Rollout-Strategie für Spring-Boot-Teams

Vom Inventur-PoC bis zum produktiven Composite-Recipe

---
hideInToc: true
---

# Phased Rollout: 5 Phasen

<PhasedRolloutTimeline class="mt-4" />

<!--
- Phase 0 ist die unbeliebteste — wird aber gerne übersprungen, und genau das rächt sich.
- Phase 2 = Pattern 1 als CI-Workflow. Phase 3 = Pattern 2 für eigene Recipes.
- Phase 4 mit Prethink ist die experimentelle Ergänzung — kein Muss.
-->

---
hideInToc: true
---

# Risiko-Tabelle: was schiefgehen kann

<RiskMatrix class="mt-4" />

<!--
- Top-3 Risiken aus der Praxis: Lizenz-Drift, AI-Halluzinationen, Vendor-Lock-in.
- Recipe-Versionen pinnen ist die billigste Mitigation und wird trotzdem oft ignoriert.
- Kotlin K2 als bewusst akzeptierter Trade-off, nicht als Ärgernis.
-->

---
layout: section
---

# 7. Bonusmaterial

Was es noch zu wissen lohnt, aber nicht in den Hauptpfad passt

---
hideInToc: true
---

# Kotlin-Support: ehrliche Realitätsprüfung

<div class="grid grid-cols-2 gap-8 mt-4">
<div>

### Stand 2026

- `rewrite-kotlin` existiert, **aber**:
- **K1** (alter Compiler) ist halbwegs unterstützt
- **K2** (Default seit Kotlin 2.0) hat offene Parse-Issues
- Großes K2-Tracking-Issue: <code>openrewrite/rewrite#6621</code>
- Recipes mit Java-LST-Annahmen brechen auf Kotlin-spezifischen Konstrukten

</div>
<div>

### Pragmatischer Umgang

- **Polyglot-Visitor**-Marketing nur teilweise tragfähig
- Reine Java-/Groovy-Codebases sind sicher
- Bei gemischten Stacks: <code>exclusion("\*_/_.kt")</code>
- Kotlin-Anteil mit Coding-Agent (Claude Code etc.) refactoren — der versteht Kotlin nativ
- Wer auf Kotlin migriert, gibt OpenRewrite für den Kotlin-Anteil weitgehend auf

</div>
</div>

<!--
- Operator-Overloading, Extension-Functions, Sealed-Classes brechen Iso-Visitor-Annahmen.
- Moderne Gradle-Kotlin-DSL-Support-Blogpost ist optimistischer als die Realität in 2026.
- Spring Boot + Kotlin-Teams sollten das vor der Tool-Entscheidung wissen.
-->

---
hideInToc: true
---

# ScanningRecipe — zwei-Phasen-Pattern für Cross-File-Wissen

<ScanningRecipeBlock class="mt-2" />

<div class="grid grid-cols-2 gap-8 mt-3 text-sm">
<div>

### Wann nötig

- Recipe muss alle Files <em>vor</em> Änderungen sehen
- Recipe generiert neue Source-Files
- Cross-File-State (z. B. „existiert ein <code>@Bean</code> mit dem Namen?")

</div>
<div>

### Architektur

1. <code>getInitialValue</code> — Akkumulator anlegen
2. <code>getScanner</code> — alle Files lesen, Akkumulator füllen
3. <code>getVisitor</code> / <code>generate</code> — mit Wissen aus Akkumulator ändern

</div>
</div>

<!--
- Beispiel: application.properties + application.yml als gemeinsames Property-Set behandeln.
- ScanningRecipe ist die richtige Antwort auf „wir brauchen das Wissen aus File B in File A".
- Instance-Fields des Visitors taugen dafür nicht — Determinismus-Verletzung.
-->

---
hideInToc: true
---

# Tool-Mix: Refaster + Spoon + Semgrep + ast-grep

<ToolMixCheatsheet class="mt-4" />

<!--
- Refaster-Picnic-Sammlung ist eine reife Alternative für 1:1-Migrationen.
- Semgrep glänzt bei Compliance-Sweeps — kein format-preserving, dafür breit.
- ast-grep ist der CST-Pendant zu Semgrep, polyglott, sehr schnell.
- IntelliJ SSR für lokale Refactorings unterschätzt.
-->

---
layout: end
hideInToc: true
---

<div class="text-left max-w-3xl mx-auto text-sm">

## Reading List

- **Duolingo Golden Path** — <code>blog.duolingo.com/automating-jvm-golden-path</code>
- **OpenRewrite Recipe-Konzepte** — <code>docs.openrewrite.org/concepts-and-explanations/recipes</code>
- **Lizenz-FAQ** — <code>docs.openrewrite.org/licensing/openrewrite-licensing</code>
- **Jonathan Leitschuh: When Open Source isn't** — <code>infosecwriteups.com/...642053be287d</code>
- **Moderne AI Recipe Authoring** — <code>moderne.ai/blog/ai-powered-openrewrite-recipe-authoring-with-claude-skill</code>
- **FINOS CALM Spec** — <code>github.com/finos/architecture-as-code</code>
- **Querverweis: Java Null-Sicherheit 2026** (Slides 8–18 zu JSpecify)

<div class="mt-4 text-xs opacity-60">

Stefan Schwetschke · stefan@schwetschke.de · Mai 2026

</div>

</div>

---
layout: end
hideInToc: true
---

# Danke!

<div class="mt-6 text-sm opacity-60">

Fragen? · stefan@schwetschke.de

</div>

---
layout: default
title: Selbsttest
hideInToc: true
---

<div class="text-2xl font-semibold mb-2">Selbsttest</div>

<OpenRewriteQuiz />

<!--
- Hinter der End-Slide: für Selbststudium nach dem Vortrag.
- Adaptive: startet mittel, wird je nach Antwort härter oder leichter.
- Optionen-Pool aus 4 parallelen Agent-Recherchen kuratiert: Recipe-Mechanik, KI-Pattern + JSpecify, Lizenzen + Tool-Mix, harte Transfer-Fragen (Moderne-Herkunft, Codemod-Landschaft, Knight-Capital-Crash).
-->
