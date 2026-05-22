# OpenRewrite — Report für Enterprise-Anwendungen

Ein umfassender, kritischer Überblick zu OpenRewrite mit Fokus auf typische Java Spring Boot Stacks (Spring Boot, Spring Framework, Spring Security, JPA/Hibernate, Jackson, JUnit). Behandelt Architektur, Lizenzmodell, AI-Integrationen, Recipe-Aufbau, den Kotlin-Support inkl. der relevanten Caveats sowie das umliegende Tooling-Ökosystem.

Stand: Mai 2026.

---

## Inhaltsverzeichnis

0. [Glossar](#0-glossar)
1. [Was OpenRewrite ist](#1-was-openrewrite-ist)
2. [OpenRewrite vs. Moderne — Lizenzen und Editionen](#2-openrewrite-vs-moderne--lizenzen-und-editionen)
3. [OpenRewrite + LLMs — Integrationsmuster](#3-openrewrite--llms--integrationsmuster)
4. [Aufbau von Recipes (Spring Boot Fokus)](#4-aufbau-von-recipes-spring-boot-fokus)
5. [Kotlin-Support](#5-kotlin-support)
6. [Alternativen und verwandte Tools](#6-alternativen-und-verwandte-tools)
7. [Konsolidierte Empfehlungen für Enterprise-Anwendungen](#7-konsolidierte-empfehlungen-für-enterprise-anwendungen)
8. [Reading Material (konsolidiert)](#8-reading-material-konsolidiert)

---

## 0. Glossar

Übergreifendes Vokabular, das in mehreren Kapiteln vorkommt. Kapitelspezifische Begriffe stehen jeweils am Anfang des betreffenden Kapitels.

### Tooling-Konzepte (sprach- und tool-übergreifend)

- **AST** (Abstract Syntax Tree) — strukturelle Baumdarstellung von Quellcode. Verliert Whitespace und Kommentare beim Parsen.
- **CST** (Concrete Syntax Tree) — behält die Formatierung inklusive Trivia (Kommentare, Whitespace, Leerzeilen).
- **LST** (Lossless Semantic Tree) — OpenRewrites Eigenname: CST + Type Attribution. Das ist das eigentliche Killer-Feature gegenüber den meisten Alternativen.
- **Codemod** — generischer Begriff (von Facebook geprägt) für skriptbare Code-Transformation.
- **Semantic Patch** — Coccinelles Terminologie für die gleiche Idee, syntaxnah formuliert (SmPL).
- **Structural Search & Replace** — Pattern-Matching auf AST-Ebene statt Regex.
- **Recipe / Rule** — in der OpenRewrite-/Error-Prone-Welt: die einzelne Transformation als wiederverwendbare Einheit.
- **Type Attribution** / **Type Awareness** — die Eigenschaft eines Werkzeugs, Symbole, Resolved Types und Klassenhierarchien zu kennen (im Unterschied zu rein syntaktischem Matching).
- **Format-Erhaltung** — die Eigenschaft, beim Round-Trip durch Parser und Printer keine Whitespace-/Kommentar-Änderungen zu produzieren.

### OpenRewrite-spezifisch

- **Visitor** — Implementierungsmuster für die LST-Traversierung. `JavaIsoVisitor` (typerhaltend) vs. `JavaVisitor` (darf den Knotentyp ändern).
- **`MethodMatcher`** / **`TypeUtils`** — Pattern-Matcher für Methoden- und Typ-Signaturen (AspectJ-ähnliche Syntax).
- **`JavaTemplate`** — Code-Synthese-Werkzeug. Verwandelt String-Snippets in echte LST-Knoten mit Typ-Information.
- **`Preconditions.check()`** — Gating-Mechanismus: Recipe wird nur auf Files angewendet, die den Filter passieren.
- **`ScanningRecipe<P>`** — zwei-Phasen-Recipe: erst Scan über alle Files (Akkumulator füllen), dann Edit-Phase mit dem akkumulierten Wissen.
- **Declarative YAML Recipe** — Recipe ohne Java-Code, nur Komposition vorhandener Recipes (`type: specs.openrewrite.org/v1beta/recipe`).
- **Refaster-style Recipe** — annotation-basiert mit `@BeforeTemplate` / `@AfterTemplate`. Wird zu OpenRewrite-Recipe compiled.
- **`recipeList`** — YAML-Feld, das die kompositorische Reihenfolge der Sub-Recipes definiert.
- **`@DocumentExample`** — Test-Annotation, die ein Before/After-Beispiel zugleich in die generierte Doku extrahiert.
- **Marker** — Metadaten an LST-Knoten (z. B. `JavaVersion`, `BuildEnvironment`, `SearchResult`). Werden für Preconditions und Such-Recipes verwendet.
- **`rewriteRun` / `rewriteDryRun`** — die Gradle-/Maven-Tasks, die Recipes ausführen bzw. nur einen Patch erzeugen.

### Lizenz-Tiers

- **Apache 2.0** — vollständig FOSS, keine Restriktionen.
- **MSAL** (Moderne Source Available License) — Source einsehbar, aber kein FOSS. Nutzung für eigenen Code erlaubt, kommerzielle Weiterverwertung verboten.
- **MPL** (Moderne Proprietary License) — proprietär, closed source. Nur als Teil der bezahlten Moderne-Plattform nutzbar.

### AI-Integration

- **Deterministic Recipe** — klassische OpenRewrite-Recipe; gleiche Eingabe → identische Ausgabe.
- **Generative Recipe** — Recipe, die im Inneren einen LLM-Call macht. Ergebnis ist non-deterministisch.
- **Agentic Loop** — externe AI-Schleife: build → fix → build, getrieben von einem Coding-Agent (Claude Code, Codex, etc.).
- **Prethink** — Modernes Begriff für „OpenRewrite extrahiert strukturierten Kontext, AI konsumiert ihn". Umkehrung der Pipeline-Richtung.
- **MCP-Tool für Recipes** — eine Recipe als MCP-Tool exponiert, sodass ein AI-Agent sie aufruft.
- **Skill** (im Claude-Code-Sinn) — Markdown-Anweisungen, die einem AI-Agent das Schreiben von Recipes beibringen.
- **Determinismus-Boundary** — die konzeptuelle Linie zwischen reproduzierbarem Code und LLM-Output. Je näher zur PR, desto schmerzhafter die Verletzung.

### Kotlin

- **K (Kotlin LST)** — der Kotlin-Knoten-Typ-Tree, analog zu `J` (Java) und `G` (Groovy). Erbt vom Java-LST.
- **K1 vs. K2** — der alte vs. neue Kotlin-Compiler-Frontend. K2 ist seit Kotlin 2.0 (Mai 2024) Default.
- **`kotlin-compiler-embeddable`** — Kotlins eigene Compiler-Library, die OpenRewrite zum Parsing einsetzt.
- **Polyglot Visitor** — Marketing-Begriff für Visitors, die über Java/Groovy/Kotlin laufen, weil deren LSTs eine gemeinsame `J.*`-Basis haben.

---

## 1. Was OpenRewrite ist

### 1.1 Kurzfassung

OpenRewrite ist ein **Refactoring-Framework für Quellcode-Transformationen im großen Stil** — primär für die JVM-Welt (Java, Kotlin, Groovy). Es ist kein Linter und kein IDE-Plugin, sondern eine Engine, die parametrisierte Refactorings („Recipes") deterministisch auf ganzen Codebases ausführt. Maintainer ist Moderne, Inc.; das Framework selbst ist Apache-2.0-lizenziert, viele Recipes mittlerweile nicht mehr (siehe Abschnitt 2).

### 1.2 Architektur

OpenRewrite parst Sourcen in einen LST, mutiert den LST über Visitors und serialisiert ihn zurück. Die Änderungen werden in den modifizierten Bäumen vorgenommen und dann zurück in Quellcode gedruckt, sodass die Diffs reviewbar und commitbar sind. Im Unterschied zu einem klassischen AST verliert man bei einem Round-Trip keine Formatierung. Das ist der entscheidende Punkt gegenüber Ansätzen wie JavaParser oder Spoon: Der Diff ist klein und reviewbar.

Der Visitor-Mechanismus ist klassisch: man definiert das Verhalten eines Visitors, der den LST durchläuft. Verschiedene Visitor-Typen existieren, um zu balancieren, wie viel man ändern darf vs. was OpenRewrite validieren kann. Ein `JavaIsoVisitor` darf z. B. keine Methodendeklaration durch ein Feld ersetzen, mit einem `JavaVisitor` geht das aber.

Wichtig zur Realitätsabbildung: Die In-Memory-Natur des LST wird bei größeren Projekten naturgemäß zum Flaschenhals. Dieses Problem adressiert Modernes proprietäre Lösung mit aufgeteilter und persistenter Baumgenerierung. Vanilla-OpenRewrite läuft bei großen Monorepos irgendwann gegen den Heap.

### 1.3 Recipe-Ökosystem

Die wichtigsten Recipe-JARs (alle unter `org.openrewrite.recipe:*`):

- **`rewrite-spring`** — Spring-Boot-Migrationen. Aktuell sind Recipes von `UpgradeSpringBoot_2_1` bis `UpgradeSpringBoot_4_0` verfügbar. Beispiel-Versionspin aus aktuellen Docs: `rewrite-spring:6.30.4`.
- **`rewrite-migrate-java`** — Java-Version-Migrationen (8 → 11 → 17 → 21), `javax → jakarta`, deprecated API-Ersetzungen.
- **`rewrite-testing-frameworks`** — JUnit 4 → 5, Hamcrest → AssertJ, Mockito-Upgrades.
- **`rewrite-static-analysis`** — die OpenRewrite-eigene „Linter"-Sammlung. Überlappt teilweise mit SonarQube/Error Prone, aber mit Auto-Fix.
- **`rewrite-logging-frameworks`** — Log4j 1.x/Commons Logging → SLF4J, Log4j-2-Migrationen (Log4Shell/CVE-2021-44228).
- **`rewrite-hibernate`** — Hibernate-Migrationen (5.x → 6.x → 7.x), inkl. `javax.persistence → jakarta.persistence`.
- **`rewrite-jenkins`**, **`rewrite-quarkus`**, **`rewrite-micrometer`**, **`rewrite-third-party`** — Framework-spezifische Sammlungen.

OpenRewrite unterstützt mittlerweile auch YAML, XML, JSON, Properties, Maven/Gradle-Dateien, Dockerfiles, Terraform, Kubernetes-Manifests etc. — also der gleiche LST-Ansatz für Konfigurationsdateien, was viele übersehen.

Die Recipe-Liste ist komplett unter https://docs.openrewrite.org/recipes (Marketplace-artige Browsability) bzw. https://docs.openrewrite.org/reference/all-recipes (flach).

### 1.4 Build-Integration

**Pragmatisch (schnell, ohne Buildfile-Änderung)** — idiomatisch für ad-hoc Anwendungen, weil der Hauptbuild nicht angefasst wird:

```bash
gradle --init-script init.gradle rewriteRun \
  -Drewrite.activeRecipe=org.openrewrite.java.spring.boot3.UpgradeSpringBoot_3_5
```

Mit einem `init.gradle`, das den Plugin-Classpath nur für diesen Lauf injiziert. Das ist der bevorzugte Weg, wenn man nicht permanent committen will, dass das Projekt OpenRewrite kennt.

**Idiomatisch (langfristig im Repo verankert)** — `build.gradle.kts`:

```kotlin
plugins {
    id("org.openrewrite.rewrite") version "latest.release"
}

rewrite {
    activeRecipe("org.openrewrite.java.spring.boot3.UpgradeSpringBoot_3_5")
    setExportDatatables(true)  // schreibt CSV-Reports nach build/rewrite/datatables
}

dependencies {
    rewrite("org.openrewrite.recipe:rewrite-spring:6.30.4")
    rewrite("org.openrewrite.recipe:rewrite-migrate-java:latest.release")
}
```

Maven-Pendant:

```xml
<plugin>
  <groupId>org.openrewrite.maven</groupId>
  <artifactId>rewrite-maven-plugin</artifactId>
  <version>6.39.0</version>
  <configuration>
    <exportDatatables>true</exportDatatables>
    <activeRecipes>
      <recipe>org.openrewrite.java.spring.boot3.UpgradeSpringBoot_3_5</recipe>
    </activeRecipes>
  </configuration>
  <dependencies>
    <dependency>
      <groupId>org.openrewrite.recipe</groupId>
      <artifactId>rewrite-spring</artifactId>
      <version>6.30.4</version>
    </dependency>
  </dependencies>
</plugin>
```

Tasks: `rewriteDryRun` erzeugt ein `build/reports/rewrite/rewrite.patch`, `rewriteRun` schreibt direkt. Für CI bietet sich `rewriteDryRun` + PR-Bot an — niemals `rewriteRun` direkt auf `main` loslassen.

> ⚠️ **Warnung zu `latest.release`**: Bequem für lokale Experimente, in CI ein Bug-Magnet (nicht reproduzierbar). Idiomatisch wäre, die Recipe-Versionen via `dependencyLocking` oder Renovate zu pinnen. `latest.release` für die Plugin-Version ist besonders gefährlich, weil Plugin-Major-Bumps Breaking Changes für Recipe-Signaturen bringen können.

### 1.5 Anwendungsfälle

Wo OpenRewrite wirklich glänzt:

- **Framework-Upgrades** mit hohem Boilerplate-Anteil: Spring Boot 2.x → 3.x (`javax → jakarta` ist der Killer-Use-Case — manuell ist das stumpfsinnig, OpenRewrite macht es deterministisch).
- **JUnit 4 → 5** in großen Test-Suiten.
- **Sicherheits-CVE-Patches** auf Code-Ebene (Log4Shell-artige Migrationen).
- **API-Deprecation-Sweeps**: Eine neue Library-Version wird published und liefert ein Recipe mit, das alle Konsumenten automatisch umstellt.
- **Style-Konsolidierung** in Monorepos.
- **Jackson-Migrationen**: Annotation-Renaming, Modul-Konsolidierung, Konfigurations-Migrationen (z. B. `ObjectMapper`-Building-Patterns).

### 1.6 Wo es nicht glänzt — ehrliche Kritik

1. **Memory-Verbrauch.** Bei größeren Codebases muss man Heap erhöhen oder auf Moderne (kommerziell) ausweichen. Die LST wird im Speicher gehalten.

2. **Learning Curve für Custom Recipes.** Wer den Visitor-Mechanismus zum ersten Mal sieht, debuggt erstmal. `JavaTemplate` hat eigene Gotchas (Imports werden manchmal nicht automatisch hinzugefügt, wenn Cursor-Context fehlt).

3. **Recipe-Qualität variiert.** Die offiziellen Module sind gut gepflegt; Community-Recipes (`rewrite-third-party`) sind ein gemischtes Bild. Vor Anwendung den Source der Recipe lesen — oder damit rechnen, dass `rewriteDryRun` plötzlich 800 Files anfasst, von denen 50 falsch sind.

4. **Spring-Recipes sind opinionated.** Eine `UpgradeSpringBoot_X_Y`-Recipe macht auch Properties-Renames, Bean-Konfigurationsänderungen und Property-Migrationen. Wer ein eigenwilliges Setup hat (z. B. eigene `EnvironmentPostProcessor`s), bekommt unerwünschte Änderungen.

5. **Moderne ist der Schwerkraftspunkt.** OpenRewrite wird zwar nie EE-only, aber Features mit echtem Multi-Repo-Scaling (LST-Persistenz, Cross-Repo-Impact-Analysis) sind im OSS-Teil bewusst nicht. Das ist legitim, aber sollte einem klar sein.

6. **Build-Tool-Edge-Cases.** Composite-Builds, Gradle-Plugins mit komplexen Conventions, Kotlin-DSL-Buildfiles mit ungewöhnlichen Konstrukten — da bricht der LST-Aufbau gerne mal.

7. **Kotlin-Support ist zweitklassig.** Siehe Abschnitt 5.

---

## 2. OpenRewrite vs. Moderne — Lizenzen und Editionen

Das Bild ist seit Ende 2024 deutlich messier geworden, als die Marketing-Sprache suggeriert. Es gibt **drei Lizenz-Tiers** auf der Recipe-Seite und **drei Produkt-Tiers** auf der Moderne-Plattform-Seite. „Community Edition" bedeutet hier _nicht_, was man erwartet.

### 2.1 Das Lizenz-Schichtenmodell

OpenRewrite-Code zerfällt heute in drei Kategorien:

**1. Apache 2.0 (echtes Open Source)**

Core-OpenRewrite-Technologie und Sprach-Libraries sind generell vollständig open source unter der Apache-Lizenz. Das beinhaltet das gesamte `openrewrite/rewrite`, inklusive `rewrite-core` und vielen der ursprünglichen Language Bindings (Java, Groovy, Kotlin, XML, Properties, YAML, Terraform). Recipe-Module mit signifikantem Community-Engagement sind ebenfalls vollständig Apache-lizenziert.

**2. MSAL — Moderne Source Available License**

OpenRewrite-Recipes mit signifikanten Beiträgen von Moderne und Third-Party-Contributors werden mit der MSAL veröffentlicht. Diese Lizenz verhindert, dass andere signifikanten kommerziellen Wert aus OpenRewrite ableiten, ohne zur Community beizutragen. Einzelne Organisationen können diese Recipes für ihren eigenen Quellcode konsumieren und anwenden, aber die Recipes können nicht in kommerzielle Produkte verpackt oder weiterverkauft werden.

Moderne erklärt das mit der Konzertkarten-Analogie: Tickets kaufen und das Konzert besuchen ist OK, Weiterverkauf für Profit nicht.

Das betrifft konkret das ganze `rewrite-spring`-Modul seit dem 13. Dezember 2024 — an diesem Tag sind mehrere OpenRewrite-Recipes durch einen Lizenzwechsel von Apache 2.0 auf entweder MSAL oder MPL gegangen. Insbesondere das `rewrite-spring`-Recipe-Paket ging von Apache 2.0 auf MSAL.

**3. MPL — Moderne Proprietary License**

Es gibt eine Gruppe von OpenRewrite-Recipes, die von Moderne speziell für Multi-Repo-Code-Analyse und -Transformation auf ihrer Plattform erstellt wurden, einschließlich solcher, die für groß angelegte Impact-Analysen und Security-Remediation entworfen sind, sowie solche, die AI-Tool-Calling nutzen. Diese Recipes stehen unter der MPL. Diese proprietäre Lizenz beinhaltet auch zusätzliche Abdeckung für Framework-Migrationen wie Spring Boot. Sprich: Teile der Spring-Boot-Migration sind nur über die Moderne-Plattform zugänglich, nicht über den OSS-Recipe-Katalog.

### 2.2 Die „Community Edition"-Falle

Wenn man im Recipe-Katalog Einträge wie „Migrate to Spring Boot 3.4 (Community Edition)" oder „Migrate to Spring Boot 4.0 (Community Edition)" sieht — das ist **nicht** die OSS-Variante im üblichen Sinn. Die Bezeichnung bedeutet konkret: „Dieses Recipe ist unter der MSAL verfügbar."

Mapping:

- _(Community Edition)_ im Namen → MSAL
- Kein Suffix, weil unter Apache 2.0 → echtes OSS
- _„Moderne customer?"_-Hinweis → es gibt eine zusätzliche MPL-Variante hinter Paywall

Das ist semantisch verwirrend und vermutlich auch absichtlich so — „Community Edition" klingt einladender als „Source-Available, kommerziell eingeschränkt".

### 2.3 Die Moderne-Plattform-Editionen

Auf der bezahlten SaaS-Seite gibt es drei Plattform-Tiers:

- **Standard** — SaaS, der Einstieg
- **Enterprise** — SaaS, mehr Features (genaue Abgrenzung unklar, klassisches „Contact Sales"-Modell)
- **DX (Developer Experience) Edition** — air-gapped on-premises. Für regulierte Industrien (Banken, Versicherer, Defense).

Was kann die Plattform, was Vanilla-OpenRewrite nicht kann: Multi-Repo-Execution, persistierte LSTs (keine Heap-Probleme), PR-Management, Cross-Repo-Impact-Analyse, AI-augmentierte Recipes. Die Engine selbst skaliert nicht über mehrere Repos parallel — das ist das Killer-Feature der bezahlten Variante.

Außerdem läuft Moderne einen kostenlosen Tenant für Open-Source-Software auf `app.moderne.io` — sprich, für OSS-Maintainer kann man die Plattform gratis nutzen. Kommerzielle Closed-Source-Codebases zahlen.

### 2.4 Der Relicensing-Streit (Dezember 2024)

Die Geschichte, die in der Marketing-Page nicht steht und die man kennen sollte, bevor man strategische Entscheidungen trifft.

Am 26. Dezember 2024 entdeckte Jonathan Leitschuh, einer der wichtigsten Contributor zu `rewrite-java-security`, dass das Repo verschoben, geschlossen und umlizenziert worden war. Der Code, den er verfasst hatte, die Recipes, die er geschrieben hatte, und die Sicherheitsarbeit, die durch Open-Source-Security-Initiativen (Linux Foundation OpenSSF Project Alpha-Omega, finanziert von Microsoft, Google, Amazon) finanziert worden war, war jetzt hinter der MPL eingeschlossen. Kein Vorwarnen. Kein Contributor-Outreach. Kein Blog-Post.

Modernes Begründung: Bedenken über Firmen wie Amazon und VMware, die OpenRewrite-Recipes nutzten, ohne etwas zurückzugeben. Bei Modernes CodeRemix Summit 2025 erklärten mehrere Mitarbeiter, dass diese Furcht im späten 2024 kristallisierte, als mehrere Interessenten angeblich sagten, sie sähen keinen Wert darin, für Moderne zu bezahlen — weil sie glaubten, dass Lösungen wie Amazon Q Code Transformer, Sourcegraph Batch Changes oder Broadcom Application Advisor ausreichen würden.

Modernes eigene Darstellung (von Tim te Beek, OpenRewrite Community Lead): Als Startup mit dreißig Mitarbeitern, die an den verflochtenen Angeboten von OpenRewrite und Moderne arbeiten, muss man manchmal schnell handeln. Die Apache-Lizenz erlaubt Redistribution unter Beibehaltung der Notices — daher war die Relizenzierung juristisch zulässig.

Kurz gesagt: Moderne hat (nach eigener Aussage rechtlich zulässig) Code, der unter Apache 2.0 stand, kopiert in neue Repos verschoben, deren Inhalt unter MSAL/MPL gestellt und die Apache-2.0-Originale archiviert. Contributors wurden nicht konsultiert. Das ist juristisch Apache-konform (Apache erlaubt Relizenzierung von Derivaten), aber moralisch hat das einen erheblichen Vertrauensschaden hinterlassen.

Das ist Teil eines breiteren Musters in der Industrie — vergleichbar mit HashiCorp/Terraform → OpenTofu Fork, Elastic → OpenSearch, Redis → Valkey. Ein OpenRewrite-Fork ist bisher **nicht** zustande gekommen, was bedeutsam ist: Es deutet darauf hin, dass die Community-Größe nicht ausreicht oder die kritische Masse fehlt.

### 2.5 Praktische Implikationen für Enterprise-Anwendungen

**Erlaubt (auch für kommerzielle Produkte):**

- MSAL-Recipes (z. B. `rewrite-spring`) auf den eigenen Anwendungs-Code anwenden, um zu refaktoren/upgraden. Das ist explizit der Use Case, den MSAL erlaubt.
- Eigene Recipes schreiben und intern nutzen — Apache 2.0 Engine ist unverändert offen.
- Den OpenRewrite Gradle/Maven Plugin in der CI nutzen.

**Vermutlich problematisch (kein Anwalt — Rechtsabteilung fragen):**

- Beratungsservices anbieten, bei denen MSAL-Recipes auf Kundencode angewendet werden — das ist nach Modernes Selbstdarstellung explizit untersagt.
- Ein internes Refactoring-Tool bauen, das Recipes als Service anbietet und an andere Geschäftsbereiche verkauft.
- Forking eines MSAL-Recipes und Weiterverbreitung als eigenes Produkt.

**Definitiv nicht ohne Lizenz:**

- MPL-Recipes — die bekommt man gar nicht erst ohne Moderne-Subscription.
- Eigenständiges Hosten einer Multi-Repo-Plattform, die OpenRewrite skaliert ausführt und damit Geld verdient.

Konkret: Eine Spring-Boot-Migration auf der eigenen Codebase ist im sicheren Bereich. Das Risiko ist nicht juristisch, sondern strategisch — man baut Tooling-Abhängigkeiten zu einem Vendor auf, der gezeigt hat, dass er Lizenzen ohne Vorwarnung ändert.

### 2.6 Kritische Bewertung

1. **Die Lizenzklarheit ist absichtlich oder fahrlässig undurchsichtig.** Recipe-Pages sagen „Apache" oder „Moderne Source Available License" in einem kleinen Hinweis, aber das Hauptbranding ist „OpenRewrite is OSS". Es gibt unter `org.openrewrite.recipe:rewrite-spring` (Maven Central) Artefakte, die _im JAR_ MSAL-Komponenten enthalten. Man muss die `META-INF`-Lizenz-Header lesen, um sicher zu sein.

2. **„Community Edition" ist ein Marketing-Trick.** In der Software-Industrie heißt „Community Edition" typischerweise „kostenlos, OSS-lizenziert, Feature-eingeschränkt" (vgl. MySQL CE, GitLab CE, Elastic ECE). Bei OpenRewrite heißt es „source available, kommerziell restriktiv".

3. **Der Relicensing-Vorgang war handwerklich schlecht.** Selbst wenn Apache 2.0 das erlaubt, ist es Standard-Praxis, mit Contributors zu sprechen und einen Übergangspfad zu definieren. Dass Moderne das nicht getan hat, ist ein Warnsignal für die Governance.

4. **Kein Fork in Sicht.** Im Gegensatz zu Terraform → OpenTofu oder Redis → Valkey gibt es keinen sichtbaren Community-Druck, einen Apache-2.0-Fork des `rewrite-spring`-Standes vor dem 13.12.2024 zu pflegen.

5. **Die Alternativen sind dünn.** Siehe Abschnitt 6 — es gibt keinen ernstzunehmenden OSS-Konkurrenten, der Spring-Boot-Migrationen mit der Recipe-Tiefe bietet. Das ist genau der Moat, den Moderne ausnutzt.

6. **Die Strategie ist legitim aber transparent.** Moderne braucht Geld. Die Engine ist als kostenloser Köder gut genug, um Adoption zu treiben, und die wirklich teuren Recipes (Spring Boot, Security, AI-augmentiert) wandern in Richtung MSAL/MPL. Das ist ein klassisches Open-Core-Modell mit „Source Available" als Zwischenstufe.

### 2.7 Strategische Hygiene

- **Lizenz-Compliance einbauen, bevor man in CI committet.** Idiomatisch: `gradle-license-report` oder eine OpenRewrite-Recipe wie `org.openrewrite.java.dependencies.DependencyLicenseCheck` laufen lassen, um die transitiv gezogenen Recipe-JARs zu klassifizieren.
- **Recipe-Versionen hart pinnen.** Wenn morgen ein Recipe von Apache 2.0 auf MSAL gekippt wird (wie es bereits passiert ist), willst du das in einer kontrollierten PR sehen, nicht in einem Renovate-Auto-Update.
- **Eigene Recipes klar trennen.** Wenn eigene Recipes geschrieben werden, in eigenen Repos unter eigener Lizenz halten. Niemals direkt in einen Moderne-Repo PR-en — der Code könnte morgen umlizenziert werden.
- **Beobachte Forks.** Falls jemand `rewrite-spring` als Apache-2.0-Fork pflegt (aktuell nicht der Fall), wäre das eine Hedging-Option.

---

## 3. OpenRewrite + LLMs — Integrationsmuster

Es gibt mehrere Integrationsmuster, und sie unterscheiden sich fundamental in **wer entscheidet, was sich ändert** und **wo die Determinismus-Grenze verläuft**. Das ist der entscheidende Achsenpunkt für alle Bewertungen — bei `rewriteRun` über 200 Repos will man keine probabilistischen Diffs reviewen.

### 3.1 Pattern 1: „Determinismus zuerst, AI im Loop" (Duolingo-Stil)

**Das ist der pragmatische Goldstandard.** Duolingo hat es Ende 2025 als JVM Golden Path Workflow dokumentiert, und es ist die Blaupause für seriöse Migration-at-Scale.

Workflow:

1. YAML-Konfiguration definiert Upgrade-Schritte (Gradle 8, JDK 17, Spring Boot 3, JDK 21, ...).
2. Pro Schritt: OpenRewrite-Recipes laufen _zuerst_ (deterministisch).
3. Anschließend optional ein AI-Prompt mit Template-Diff für Lücken, die kein Recipe abdeckt.
4. Build-Versuch.
5. Bei Fehler: AI fixt im Loop, wieder Build, bis grün.
6. PR erzeugen, nächster Schritt.

Die Kernerkenntnisse aus dem Duolingo-Report (Frontline-Erfahrung, nicht Marketing):

- **„Don't over-rely on AI. Learn to love determinism."** OpenRewrite-Recipes lieferten einen sehr soliden Ausgangspunkt für die Upgrades. AI wurde nur eingesetzt, um die Lücken zu füllen. Ein separater, deterministischer Validierungsschritt (Build) machte den Workflow verlässlicher.
- **„Breaking upgrades into smaller steps saves a lot of time."** Kleinere Schritte machten es einfacher, Prompting zu verbessern, Issues zu debuggen, den Workflow bei Fehlern neu zu laufen und Änderungen zu deployen.
- **„Better prompting is not just adding more context."** Beim Update der Prompts musste die richtige Balance gefunden werden zwischen dem Hinzufügen von Lösungen aus abgeschlossenen Upgrades und dem Generalisieren dieser Lösungen. Zu viele Diffs blähen den Context Window auf und produzieren overly-specific Prompts, die schlecht skalieren.

Wo es schmerzt: Eine der OpenRewrite-Recipes fügte eine konfliktäre Dependency hinzu, die Build-Failures verursachte. Den Root-Cause zu finden war schwierig und verlangsamte das Team. AI-Agents waren gut bei Debugging-Strategien, aber nicht gut darin, den Code zu durchsuchen und die Quelle der konfliktären Dependency zu finden. Halluzinationen kamen ebenfalls vor — AI-Agents erkannten oft deprecated Methods, aber wenn nicht, drehten sie sich im Kreis.

**Übersetzung in einen Enterprise-Spring-Boot-Migrationskontext:** Spring-Boot-3-Migration läuft als deterministischer Push, Edge-Cases bei JPA/Hibernate (Custom-UserType, Naming-Strategies, eigene Type-Converter) lässt man den Agent fixen. Build → Tests als deterministisches Gate. Determinismus-Boundary liegt zwischen Recipe-Output und Build-Success.

### 3.2 Pattern 2: AI als Recipe-Autor, nicht als Refactorer

Die elegantere Variante: Der LLM **schreibt** Recipes, nutzt sie aber nicht selbst zum Refaktoren. Das verlagert die Determinismus-Boundary nach links — die Recipe selbst bleibt reproduzierbar.

Moderne dokumentiert das explizit als ihre Haupt-Empfehlung: Recipe-Authoring ist ein guter Use Case für generative AI. Wenn Recipes deklarativ sein können, sind sie hochkomponierbar. Wenn sie imperativ sein müssen, sind sie tief strukturiert, gebaut um bekannte Patterns wie Visitors und Templates. Und weil jede Recipe durch Before/After-Tests abgesichert werden kann, sind sie leicht testbar, was AI „ehrlich" hält.

Tooling-Stand: Moderne hat die standalone Claude Skill zurückgezogen und die Funktionalität direkt in die Moderne CLI eingebaut. Mit einem Befehl erhält der Agent vier eingebaute Skills, die durch den gesamten Recipe-Authoring-Workflow führen, einschließlich Recipes ausführen und Impact-Analyse.

Konkret: Der Moderne CLI kann Agent-Tools (Skills und MCP-Server) installieren, die AI-Coding-Agents beibringen, wie man mit OpenRewrite-Recipes arbeitet. Recipe-Authoring verlangt das Verständnis von Visitor-Patterns, LST-Strukturen und Testing-Idiomen, die AI-Coding-Agents nicht out-of-the-box kennen. Die vier Skills decken Recipe-Creation, Recipe-Testing, Repo-Discovery und Impact-Analysis ab.

**Warum das das nachhaltigste Pattern ist:** Der LLM-Output wird einmal materialisiert (als Recipe), reviewed, getestet, committed. Danach läuft die Recipe deterministisch auf 200 Repos. Token-Kosten fallen _einmal_ an, nicht 200×.

### 3.3 Pattern 3: LLM _innerhalb_ einer Recipe (`rewrite-generative-ai`)

Es gibt das experimentelle Modul `openrewrite/rewrite-generative-ai`. Funktionsweise: Recipe traversiert den LST, ruft an Decision-Points die OpenAI-API, integriert die Antwort in den Tree.

Die explizite Warnung der OpenRewrite-Maintainer selbst — ernst zu nehmen: Diese Recipes sind experimentell und nicht für den Produktionseinsatz empfohlen. Weil LLM-Outputs non-deterministisch sind, variieren die Recipe-Ergebnisse zwischen Läufen — einschließlich der Produktion inkorrekter Änderungen oder der Modifikation von Code, der unangetastet bleiben sollte. „At scale, this leads to unpredictable diffs that are difficult to review."

Beispiel-Recipe: Restrukturiert Java switch-Statements, um den default-Case ans Ende zu setzen, indem GPT-4o den umgeordneten Code generiert.

**Klares Urteil: Pattern 3 ist eine Krücke.** Es hebt den fundamentalen Vorteil von OpenRewrite (Determinismus, reviewbare Diffs, Auditability) auf. Das `default-last`-Switch-Beispiel ist trivial deterministisch lösbar — kein LLM nötig. Wenn die Transformation wirklich Sprachverständnis braucht (Naming, semantische Refaktorierung), ist man mit einem externen Agenten (Pattern 1) besser bedient, weil man die Iteration kontrollieren kann.

Außerdem gibt es einen offiziellen Namespace `org.openrewrite.java.ai` mit AI-Recipes. Die Doku verweist explizit: „Moderne customer? Use the Moderne recipe catalog instead." Sprich: Die interessanten AI-Recipes sind hinter der Moderne-Paywall (MPL).

### 3.4 Pattern 4: Prethink — Pipeline umgedreht

Das ist die interessanteste Architekturidee aus 2025/2026. Statt LLM in OpenRewrite zu kippen, läuft OpenRewrite _vor_ dem Agent und produziert strukturierten Kontext.

Prethink wird als Set von OpenRewrite-Recipes ausgeliefert, die Multi-Repo-trusted Kontext für AI-Agents generieren. Wenn man Prethink-Recipes gegen die Codebase laufen lässt, produzieren sie strukturierte Outputs:

- **Code-Data-Tables** (CSV): tiefe Einsichten, die nur mit Modernes LST entdeckbar sind.
- **CALM-Architekturdiagramme** (FINOS Common Architecture Language Model): JSON, das Service-Endpoints, DB-Connections, externe Service-Calls und Messaging-Connections beschreibt.
- **Aktualisierung von `CLAUDE.md`** (oder `.cursorrules`, etc.) mit Verweisen auf diese Kontext-Files unter `.moderne/context/`.

Das bedeutet: Agents können sofort über vor-aufgelöste Fakten über die Codebase nachdenken. Bei Nutzung des Moderne MCP-Servers können AI-Coding-Agents das `run_recipe`-Tool verwenden, um Prethink-Recipes auszuführen und Kontext inkrementell neu zu generieren, während sie Code editieren.

Das ist konzeptuell richtig: **AI ist gut im Reasoning über kompakte strukturierte Daten, schlecht im Reasoning über Millionen Zeilen Code.** OpenRewrite extrahiert das LST-Wissen in eine konsumierbare Form. Der Agent operiert dann auf einer Architekturbeschreibung statt auf rohem Code-Grep.

Für Enterprise-Anwendungen mit vielen Services und komplexer Architektur (viele Microservices, B2B-Integrationen, Messaging-Topologien) ist das besonders wertvoll — eine CALM-Beschreibung der Service-Topologie ist wertvollerer AI-Input als „grep durch 40 Repos".

Caveat: Prethink ist Moderne-Marketing-Sprache, und einige Komponenten sind hinter Moderne-Plattform-Paywall. Die `rewrite-prethink`-Recipes selbst sind im OSS-Katalog, aber das Volle scheint Plattform-only zu sein.

### 3.5 Pattern 5: MCP-basierter Recipe-Call

Das jüngste Pattern: Recipes werden als MCP-Tools exponiert, der AI-Agent ruft sie wie jede andere Funktion auf.

Der Moderne CLI installiert MCP-Server, die Tools wie `run_recipe`, `find_recipes`, `analyze_impact` exponieren. Der Agent entscheidet, welche Recipe wann anzuwenden ist — der LLM ist Dirigent, OpenRewrite ist Orchester. Das ist Pattern 1 verfeinert: Statt einer hartkodierten Workflow-YAML treffen die Recipe-Selektion und der Build-Loop dynamisch im Agenten.

Tradeoff: Mehr Flexibilität, mehr Token-Verbrauch, weniger Reproduzierbarkeit zwischen Läufen. Für explorative Migration brauchbar; für CI-getriebene Mass-Migration ungeeignet.

### 3.6 Pattern-Matrix

| Pattern                      | Determinismus          | Reviewbarkeit | Skalierung  | Token-Kosten       | Maturity                 |
| ---------------------------- | ---------------------- | ------------- | ----------- | ------------------ | ------------------------ |
| 1. Recipes first, AI im Loop | hoch (an PR-Boundary)  | gut           | sehr gut    | mittel             | produktiv                |
| 2. AI schreibt Recipes       | sehr hoch              | exzellent     | exzellent   | niedrig (einmalig) | produktiv                |
| 3. LLM in Recipe             | niedrig                | schlecht      | gefährlich  | hoch               | experimentell, Hände weg |
| 4. Prethink-Kontext für AI   | hoch (für Recipe-Teil) | gut           | gut         | mittel             | neu, vielversprechend    |
| 5. MCP Recipe-Call           | mittel                 | mittelmäßig   | mittelmäßig | hoch               | neu, interaktiv          |

### 3.7 Kritische Bewertung

1. **Pattern 1 ist der einzige produktionserprobte Workflow für Migration-at-Scale.** Duolingo, einige FINOS-Mitglieder, Modernes Enterprise-Kunden. Alles andere ist entweder zu jung oder experimentell.

2. **Pattern 2 (AI als Recipe-Autor) ist langfristig die richtige Antwort.** Wenn eine Migration zweimal gebraucht wird (Spring Boot 3 → 4 wird kommen), ist eine versionierte Recipe billiger als jedes Mal einen Agenten loszuschicken. Aber: hohe initiale Lernkurve für LST/Visitor/JavaTemplate. Hier sind Moderne-Skills wirklich nützlich, wenn man ihnen eine Stunde Zeit gibt.

3. **Pattern 3 ist symptomatisch für ein größeres Problem.** Wenn das einzige Argument für einen LLM-Call innerhalb der Recipe ist „dann muss ich keine Visitor schreiben", löst man das falsche Problem.

4. **Prethink (Pattern 4) ist konzeptuell unterschätzt.** Die Idee, dass AI-Agents auf vorverarbeitetem Kontext (CALM, DataTables) statt auf rohem Code operieren, ist eines der besseren Architekturmuster der letzten Zeit. Das wird sich wahrscheinlich durchsetzen — nicht zwingend unter dem Moderne-Branding, aber als Konzept.

5. **MCP-Recipe-Calls (Pattern 5) sind cool, aber gefährlich für CI.** Für exploratives Refactoring am eigenen Repo: super. Für Mass-Migration über das Inventory: zu non-deterministisch, zu teuer.

6. **Lock-in-Warnung:** Moderne pusht stark in Richtung MCP-Server + Skills + Prethink + CALM. Alles davon ist konzeptuell offen, aber die _Implementation_ zieht zur Plattform. Wenn man Pattern 4 oder 5 einsetzt, achte darauf, ob die Komponenten unter Apache 2.0 oder MSAL/MPL stehen.

### 3.8 Pragmatischer Empfehlungspfad

**Phase 1 (sofort):** Pattern 1 für die Java-Seite. Konkret: Eine Spring-Boot-Upgrade-Pipeline mit `rewrite-spring` und `rewrite-migrate-java`, gefolgt von einem Coding-Agent im Build-Fix-Loop. Den Loop kann man lokal mit Claude Code starten oder als GitHub-Action/Jenkins-Pipeline-Workflow.

**Phase 2 (mittel):** Pattern 2 für unternehmensspezifische Migrationen. Beispiele: ein Recipe, das ein internes API-Pattern auf eine neue Version migriert. Hier bringt OpenRewrite den großen Hebel, weil das Pattern in vielen Services wiederkehrt. Ein Coding-Agent schreibt die Recipe mit Moderne-Skills als Anleitung.

**Phase 3 (explorativ):** Prethink-Konzept ausprobieren. Ein eigenes Recipe-Set, das die Architektur als CALM-JSON in `.moderne/context/` extrahiert und `CLAUDE.md` (oder ähnliches Agent-Konfigfile) damit anreichert. Selbst wenn Modernes Pakete nicht genutzt werden — das Konzept ist nachbaubar.

---

## 4. Aufbau von Recipes (Spring Boot Fokus)

### 4.1 Die drei Recipe-Typen — Entscheidungstabelle

| Typ                  | Wann verwenden                                                                                          | Komplexität              |
| -------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------ |
| **Declarative YAML** | Komposition vorhandener Recipes, Property-Migrationen, einfache Renames                                 | trivial                  |
| **Refaster-style**   | 1-zu-1-Code-Pattern-Ersetzungen mit gleichem Typ                                                        | niedrig, sehr deklarativ |
| **Imperative Java**  | alles andere, insbesondere Recipes mit Statefulness, Cross-File-Logik oder komplexen Template-Synthesen | mittel bis hoch          |

Idiomatisch: **Schreib in dieser Reihenfolge.** Greif zur imperativen Recipe erst, wenn YAML oder Refaster nicht reichen. Das wird in der offiziellen Best-Practices-Doku auch so empfohlen.

### 4.2 Anatomie einer imperativen Recipe

Eine minimale Recipe besteht aus drei Teilen: Metadaten, Optionen, Visitor.

```java
public final class SayHelloRecipe extends Recipe {
    @Option(displayName = "Fully Qualified Class Name",
            description = "A fully qualified class name indicating which class to add a `hello()` method to.",
            example = "com.example.FooBar")
    private final String fullyQualifiedClassName;

    public SayHelloRecipe(String fullyQualifiedClassName) {
        this.fullyQualifiedClassName = fullyQualifiedClassName;
    }

    @Override
    public String getDisplayName() { return "Say 'Hello'"; }

    @Override
    public String getDescription() { return "Adds a `hello` method to the specified class."; }

    @Override
    public TreeVisitor<?, ExecutionContext> getVisitor() {
        return new JavaIsoVisitor<ExecutionContext>() {
            @Override
            public J.ClassDeclaration visitClassDeclaration(J.ClassDeclaration cd, ExecutionContext ctx) {
                if (!TypeUtils.isOfClassType(cd.getType(), fullyQualifiedClassName)) {
                    return cd; // Do no harm: Klasse passt nicht → unverändert zurück
                }
                // ... Mutation, eventuell mit JavaTemplate
                return cd;
            }
        };
    }
}
```

Drei Idiom-Punkte, die einsteigertypisch falsch gemacht werden:

1. **`getVisitor()` gibt jedes Mal eine _neue_ Visitor-Instanz zurück.** Sonst leakt State zwischen Cycles. Das ist explizit dokumentiert.
2. **„Do no harm".** Wenn der Visitor unsicher ist, ob er ändern darf, ändert er _nicht_. Aus den Best Practices: Wenn eine Recipe nicht bestimmen kann, dass eine Änderung sicher ist, soll sie keine Änderungen machen statt potenziell falsche Änderungen. Fewer changes over wrong changes.
3. **Determinismus.** Eine Recipe sollte mit dem gleichen LST und der gleichen Konfiguration immer das gleiche Ergebnis produzieren. Cross-File-State gehört in einen Scanner (siehe unten), nicht in Instance Fields des Visitors.

### 4.3 Die Visitor-Mechanik

Visitors arbeiten depth-first über den LST. Jeder LST-Knotentyp hat eine `visitX`-Methode. Für Java sind das z. B. `visitClassDeclaration`, `visitMethodDeclaration`, `visitMethodInvocation`, `visitAnnotation`, `visitVariableDeclarations` — die komplette `J.*`-Hierarchie ist abgebildet.

Wichtig: **Wer `super.visitX(node, ctx)` nicht aufruft, bricht die Traversierung ab.**

```java
@Override
public J.MethodInvocation visitMethodInvocation(J.MethodInvocation method, ExecutionContext ctx) {
    method = super.visitMethodInvocation(method, ctx); // erst children verarbeiten
    if (!matcher.matches(method)) {
        return method;
    }
    return method.withName(method.getName().withSimpleName("newName"));
}
```

Die `Cursor`-API gibt Zugang zum Parent-Kontext: `getCursor().getParentTreeCursor()`, `getCursor().firstEnclosing(J.ClassDeclaration.class)`. Das ist häufig nötig — etwa um zu prüfen, ob ein `@Bean`-aufrufender Code in einer `@Configuration`-Klasse liegt.

`JavaIsoVisitor` vs. `JavaVisitor`: Ein `JavaIsoVisitor` kann eine Methodendeklaration nicht durch ein Feld ersetzen, ein `JavaVisitor` kann das. Faustregel: **Iso, außer du musst.** Der Compiler gibt mehr Schutz.

### 4.4 `MethodMatcher` — Pattern-Sprache

Der Standard-Weg, Methoden zu identifizieren. Syntax: `<fully.qualified.Type> <methodName>(<argTypes>)`.

```java
private final MethodMatcher matcher = new MethodMatcher("java.util.List add(..)");

@Override
public J.MethodInvocation visitMethodInvocation(J.MethodInvocation mi, ExecutionContext ctx) {
    mi = super.visitMethodInvocation(mi, ctx);
    if (matcher.matches(mi)) {
        // hier zugreifen
    }
    return mi;
}
```

Wildcards: `..` für „beliebige Argumente", `*` für „beliebiger Typ in dieser Position".

Beispiele aus dem Spring-Kontext, die in eigenen Recipes wiederkehren:

- `org.springframework.web.bind.annotation.RequestMapping *(..)` — alle Methoden mit dieser Annotation (Annotation-Matching geht idiomatisch über `@Override visitAnnotation`).
- `org.springframework.boot.SpringApplication run(..)` — der typische Entry-Point.
- `javax.persistence.EntityManager merge(..)` — für JPA-Migrationen.
- `org.springframework.jdbc.core.JdbcTemplate queryForObject(..)` — typisches Pattern für Result-Type-Migrationen.
- `com.fasterxml.jackson.databind.ObjectMapper readValue(..)` — für Jackson-bezogene Refactorings.

`TypeUtils` liefert das Typ-Side-Matching: `TypeUtils.isOfClassType(j.getType(), "com.foo.Bar")`, `TypeUtils.isAssignableTo("java.util.Collection", type)`. Das ist essentiell, weil `maybeAddImport()` keinen Import hinzufügt, wenn nichts im LST mit dem Typ des angefragten Imports type-attributed ist. Sprich: Wenn man Typen synthetisiert, ohne Type Attribution mitzuliefern, läuft der Import-Manager leer.

### 4.5 `JavaTemplate` — der idiomatische Weg, neuen Code zu synthetisieren

**Niemals String-Concatenation für neue Codestücke.** Das ist der häufigste Anfängerfehler. `JavaTemplate` parst Snippets im Kontext der bestehenden Klasse, mit Imports und Typen, und liefert echte LST-Knoten zurück.

```java
public class ExpandCustomerInfo extends Recipe {
    @Override public String getDisplayName() { return "Expand Customer Info"; }
    @Override public String getDescription() { return "Expand the `CustomerInfo` class with new fields."; }

    @Override
    public TreeVisitor<?, ExecutionContext> getVisitor() {
        return new JavaIsoVisitor<ExecutionContext>() {
            private final MethodMatcher matcher =
                new MethodMatcher("com.example.Customer setCustomerInfo(String)");

            private final JavaTemplate template = JavaTemplate.builder(
                "this.firstName = info.split(\" \")[0];\n" +
                "this.lastName  = info.split(\" \")[1];\n" +
                "this.age       = Integer.parseInt(info.split(\" \")[2]);"
            ).build();

            @Override
            public J.MethodDeclaration visitMethodDeclaration(J.MethodDeclaration md,
                                                              ExecutionContext ctx) {
                if (!matcher.matches(md.getMethodType())) {
                    return md;
                }
                md = md.withBody(template.apply(
                    new Cursor(getCursor(), md.getBody()),
                    md.getBody().getCoordinates().firstStatement()
                ));
                return maybeAutoFormat(md, md, ctx);
            }
        };
    }
}
```

Drei Sachen, die hier idiomatisch sind:

1. **Coordinates statt String-Positionen.** `getCoordinates().replace()`, `.firstStatement()`, `.before()`, `.after()` — das ist die typsichere Variante.
2. **`maybeAutoFormat`** zur Reformatierung. OpenRewrite versucht, bestehende Styles zu erhalten; mit `maybeAutoFormat` kann man bei neu synthetisierten Knoten Formatierung erzwingen.
3. **`maybeAddImport()` / `maybeRemoveImport()`** im Visitor — niemals manuell an der `J.CompilationUnit` schrauben. Diese Methoden wissen, ob ein Import tatsächlich noch gebraucht wird.

### 4.6 `Preconditions.check()` — Filter und Performance-Hebel

Preconditions sind kein optionales Detail. Sie machen den Unterschied zwischen einer Recipe, die in 30 Sekunden über ein Repo läuft, und einer, die zwei Stunden braucht.

Idiomatisches Pattern:

```java
@Override
public TreeVisitor<?, ExecutionContext> getVisitor() {
    return Preconditions.check(
        Preconditions.and(
            new UsesType<>("org.springframework.boot.context.properties.ConfigurationProperties", false),
            new UsesJavaVersion<>(17)
        ),
        new JavaIsoVisitor<ExecutionContext>() {
            // dein eigentlicher Visitor
        }
    );
}
```

Standard-Preconditions, die man immer wieder sieht:

- **`UsesType<>("fqn", includeImplicit)`** — wird die Klasse irgendwo verwendet?
- **`UsesMethod<>("methodPattern")`** — wird diese Methode aufgerufen?
- **`UsesJavaVersion<>(int)`** — minimum Java-Level.
- **`HasSourcePath<>("**/application\*.yml")`\*\* — file-pfad-basiert.
- **`FindSourceFiles`**, **`FindDependency`**, **`ModuleHasDependency`** — Repo-/Modul-Level.

Wichtige Subtilität: Preconditions operieren auf bereits geparsten Source-Files. OpenRewrite läuft in zwei Phasen: Parsing-Phase (alle Source-Files werden in LSTs geparst) und Recipe-Execution-Phase (Preconditions entscheiden, welche geparsten Files die Recipe modifiziert). Das bedeutet: Preconditions können nicht verhindern, dass Files geparst werden — sie kontrollieren nur, ob Recipes auf bereits erfolgreich geparste Files angewendet werden. Sprich: Preconditions sparen _Edit_-Aufwand, nicht _Parse_-Aufwand.

### 4.7 `ScanningRecipe<P>` — Cross-File-State

Vanilla-Recipes sind file-lokal. Sobald etwas bekannt sein muss, das in einem anderen File steht („existiert ein `pom.xml` mit Spring-Boot?", „welche Klassen implementieren dieses Interface?"), braucht man `ScanningRecipe`.

Architektur:

1. **Initial Value** (`getInitialValue`) — Akkumulator-Datenstruktur erzeugen.
2. **Scanner** (`getScanner`) — Visitor, der durch _alle_ Files läuft und den Akkumulator befüllt. Macht keine Änderungen.
3. **Visitor / Generator** (`getVisitor` oder `generate`) — der eigentliche Edit-Schritt, der den befüllten Akkumulator nutzt.

Wenn eine Recipe neue Source-Files generieren muss oder alle Source-Files vor Änderungen sehen muss, muss sie eine ScanningRecipe sein. Das Akkumulator-Objekt ist eine custom Datenstruktur, definiert von der Recipe selbst, um beliebige für die Funktion benötigte Information zu speichern. Der Scanner ist ein Visitor, der den Akkumulator mit Daten befüllt.

Wann das gebraucht wird (Spring-Kontext-Beispiele):

- Eine Recipe, die in jedem `@Configuration`-Bean prüft, ob ein bestimmter `@Bean`-Name _irgendwo anders_ schon definiert ist.
- Eine Recipe, die `application.properties` und `application.yml` als ein gemeinsames Property-Set behandelt.
- Eine Recipe, die einen Spring-Initializer generiert (neuer Source File), nur wenn ein bestimmter Pattern noch nirgendwo existiert.

### 4.8 Declarative YAML — Komposition als erster Hebel

Das ist der wichtigste Teil für „komplexe Recipes wie Spring Boot". Die ganzen `UpgradeSpringBoot_X_Y`-Recipes sind **fast vollständig YAML**, nicht Java. Sie kombinieren vorhandene atomare Recipes.

Minimal-Form:

```yaml
---
type: specs.openrewrite.org/v1beta/recipe
name: com.example.MigrateInternalApiV1ToV2
displayName: Migriere Legacy-API-Konvention V1 zu V2
description: Migriert vom Legacy-API-Pattern zur neuen V2-Konvention.
tags: [internal, api-migration]
preconditions:
  - org.openrewrite.java.search.UsesType:
      fullyQualifiedTypeName: com.example.api.v1.LegacyApi
recipeList:
  - org.openrewrite.java.ChangeType:
      oldFullyQualifiedTypeName: com.example.api.v1.LegacyApi
      newFullyQualifiedTypeName: com.example.api.v2.Api
  - org.openrewrite.java.ChangeMethodName:
      methodPattern: com.example.api.v2.Api compute(..)
      newMethodName: calculate
  # weitere atomare Recipes
```

Drei Punkte:

- **`recipeList`** — die Sub-Recipes laufen _sequenziell_, nicht parallel. Jede Sub-Recipe sieht die Änderungen der vorigen.
- **`preconditions`** — gelten global für alle Sub-Recipes. (Es gibt seit 2024 die Möglichkeit, Preconditions pro Phase zu trennen, siehe Issue #4005 im Repo.)
- **Sub-Recipes können selbst declarative oder imperative sein** — gemischt geht.

Atomare „Building Blocks", die man in YAML kombiniert:

| Recipe                                                       | Zweck                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------ |
| `org.openrewrite.java.ChangeType`                            | FQN-Typ umbenennen, inkl. Imports                      |
| `org.openrewrite.java.ChangeMethodName`                      | Methode umbenennen                                     |
| `org.openrewrite.java.ChangePackage`                         | Package umbenennen                                     |
| `org.openrewrite.java.RemoveAnnotation`                      | Annotation entfernen                                   |
| `org.openrewrite.java.AddAnnotation`                         | Annotation hinzufügen                                  |
| `org.openrewrite.java.dependencies.UpgradeDependencyVersion` | Maven/Gradle Dependency-Version setzen                 |
| `org.openrewrite.java.dependencies.AddDependency`            | Dependency hinzufügen, wenn Typ verwendet              |
| `org.openrewrite.java.dependencies.RemoveDependency`         | Dependency entfernen                                   |
| `org.openrewrite.maven.UpgradeParentVersion`                 | Maven Parent-POM-Version                               |
| `org.openrewrite.gradle.UpdateGradleWrapper`                 | Gradle Wrapper aktualisieren                           |
| `org.openrewrite.properties.ChangePropertyKey`               | Property-Key umbenennen (für `application.properties`) |
| `org.openrewrite.yaml.ChangePropertyKey`                     | Selbiges für YAML                                      |

### 4.9 Spring Boot Upgrade Recipe — zerlegt

Die echte Komposition von `UpgradeSpringBoot_4_0` (gekürzt):

```yaml
type: specs.openrewrite.org/v1beta/recipe
recipeList:
  - org.openrewrite.java.spring.boot3.UpgradeSpringBoot_3_5
  - org.openrewrite.java.spring.cloud2025.UpgradeSpringCloud_2025_1
  - org.openrewrite.java.spring.framework.UpgradeSpringFramework_7_0
  - org.openrewrite.java.spring.security7.UpgradeSpringSecurity_7_0
  - org.openrewrite.java.spring.batch.SpringBatch5To6Migration
  - org.openrewrite.java.spring.boot4.SpringBootProperties_4_0
  - org.openrewrite.java.spring.boot4.ReplaceMockBeanAndSpyBean
  - org.openrewrite.hibernate.MigrateToHibernate71
  - org.openrewrite.java.testing.testcontainers.Testcontainers2Migration
  - org.openrewrite.java.springdoc.UpgradeSpringDoc_3_0
  - org.openrewrite.java.dependencies.UpgradeDependencyVersion:
      groupId: org.springframework.boot
      artifactId: "*"
      newVersion: 4.0.x
      overrideManagedVersion: false
```

Was hier konzeptuell passiert:

1. **Rekursive Komposition**: `UpgradeSpringBoot_4_0` ruft `UpgradeSpringBoot_3_5` auf. Das wiederum ruft `UpgradeSpringBoot_3_4` auf. Usw. zurück bis `UpgradeSpringBoot_2_0`. Eine Anwendung auf Spring Boot 2.5 durchläuft die korrekten Zwischenschritte.
2. **Begleit-Upgrades**: Spring Boot zieht Spring Framework, Spring Security, Spring Cloud, Spring Batch, Hibernate, Testcontainers mit. Das ist der Hauptmehrwert — man muss sich nicht selbst um den Versions-Compatibility-Graph kümmern.
3. **Property-Migration**: `SpringBootProperties_4_0` ist eine eigene Recipe, die `application.properties` und `application.yml` umbenennt (z. B. `spring.datasource.schema → spring.sql.init.schema-locations`).
4. **Dependency-Version-Bump als letzter Schritt**: Erst nachdem alle Code-Migrationen liefen, wird die Build-File-Version auf `4.0.x` gesetzt.

Konkrete Wirkung von `UpgradeSpringBoot_3_5` (bündelt viele kleinere Transformationen):

- Migration von `javax.*` Imports zu `jakarta.*` — die fundamentale Namespace-Änderung (Servlet, Persistence, Validation und weitere Jakarta EE APIs).
- Update umbenannter Spring-Boot-Konfigurations-Properties — schreibt Einträge in `application.properties` und `application.yml` neu.
- Modernisierung deprecated APIs (Spring Security 6 Konfigurations-Modell, etc.).
- Verkettete Framework-Upgrades (Spring Framework, Spring Data, Spring Security, Spring Cloud), sodass alles auf kompatiblen Versionen landet.

**Die Lehre für eigene Migrationen:** Jede atomare Transformation in eine eigene Recipe packen (oder ein vorhandenes Building Block verwenden) und in einer YAML komponieren. Das ist testbar pro Schritt und auditierbar im PR-Review.

### 4.10 Refaster-style — die unterschätzte dritte Variante

Refaster ist Googles Idee, ursprünglich aus Error Prone. OpenRewrite hat sie übernommen. Man schreibt zwei Methoden mit Annotations — die Engine generiert daraus eine Recipe.

```java
public class SimplifyTernary {
    @BeforeTemplate
    boolean before(boolean expr) {
        return expr ? true : false;
    }

    @AfterTemplate
    boolean after(boolean expr) {
        return expr;
    }
}
```

OpenRewrite baut daraus eine vollständige `Recipe` mit `JavaTemplate.Matcher` und `JavaTemplate.apply()`.

**Wann Refaster idiomatisch ist:**

- 1-zu-1-Code-Pattern-Ersetzungen ohne Typ-Wechsel.
- Idiom-Migrationen: `Stream.collect(Collectors.toList()) → Stream.toList()`, `Optional.isPresent() && Optional.get() → Optional.ifPresent`, etc.
- Refactoring-Templates, die in einem Team geteilt werden, ohne Visitor-Code-Review.
- Jackson-Annotation-Idiom-Migrationen: `@JsonProperty(value = "foo")` → `@JsonProperty("foo")` und ähnliches.

**Wann nicht:**

- Sobald man Cursor-Kontext braucht (z. B. „nur in `@Configuration`-Klassen").
- Sobald man mehrere unzusammenhängende LST-Knoten verändern muss.
- Sobald die Transformation Cross-File-Wissen braucht.

Für unternehmensspezifische Code-Konventionen (interne Idiome, eigene Builder-Patterns) ist Refaster eine sehr gute Wahl, weil das Team das Pattern direkt im Java-Quellcode sieht — kein Visitor-Wissen nötig.

### 4.11 Testing — `RewriteTest` und `@DocumentExample`

Jede Recipe sollte getestet sein. Pattern:

```java
class MigrateInternalApiV1ToV2Test implements RewriteTest {

    @Override
    public void defaults(RecipeSpec spec) {
        spec.recipeFromResource(
                "/META-INF/rewrite/internal-api-migration.yml",
                "com.example.MigrateInternalApiV1ToV2"
            )
            .parser(JavaParser.fromJavaVersion()
                .classpath("spring-context", "spring-beans"));
    }

    @DocumentExample
    @Test
    void migratesApiUsage() {
        rewriteRun(
            java(
                """
                package com.example;
                import com.example.api.v1.LegacyApi;
                class SomeService {
                    void doWork(LegacyApi api) {
                        api.compute("input");
                    }
                }
                """,
                """
                package com.example;
                import com.example.api.v2.Api;
                class SomeService {
                    void doWork(Api api) {
                        api.calculate("input");
                    }
                }
                """
            )
        );
    }

    @Test
    void leavesUnrelatedCodeAlone() {
        rewriteRun(
            java("""
                package com.example;
                class GenericService { }
                """) // kein erwartetes "after" → unverändert lassen
        );
    }
}
```

Die `@DocumentExample`-Annotation extrahiert das Before/After-Beispiel und generiert ein YAML-File, das in der Recipe-Doku angezeigt wird. Sprich: der Test ist gleichzeitig Doku-Quelle.

`JavaParser.fromJavaVersion().classpath(...)` ist wichtig: Wenn eine Recipe neue LST-Elemente erzeugt (z. B. via `JavaTemplate`) ohne korrekte Type-Information, schlägt die Validierung fehl. Dem Parser muss gesagt werden, welche Bibliotheken im Klassenpfad liegen, sonst hat das LST keine Type-Information und `JavaTemplate` versagt.

### 4.12 Best Practices

Aus der offiziellen Konventionen-Doku:

1. **Niemals String-Concat für Code-Synthese.** Stattdessen `JavaTemplate` für Java-Code, format-spezifische Parser für XML/JSON.
2. **Visitor-Konstruktion via Constructor-Capture, nicht Instance-Fields.** Wenn der Visitor Optionen braucht, als Constructor-Args übergeben oder den Visitor inline (Closure-Style) erzeugen.
3. **Preconditions sind kein Optional.** Jede ernsthafte Recipe hat Preconditions.
4. **`maybeAddImport` / `maybeRemoveImport` nutzen, nicht manuell editieren.**
5. **`maybeAutoFormat` am Ende, nicht in der Mitte.**
6. **Idempotenz testen.** Die Recipe muss nach dem zweiten Lauf auf dem gleichen File **nichts mehr** tun. Wenn doch, ist es ein Bug.
7. **Test sowohl Positive als auch Negative Cases.** „Was die Recipe _nicht_ anfasst" ist genauso wichtig wie „was sie ändert".

### 4.13 Anwendungsfälle in Enterprise-Anwendungen

Typische Anwendungsfälle, in denen eigene Recipes Sinn machen:

**Pure YAML-Komposition (~60 % der Fälle):**

- Wrapper-Recipe „Migriere internen Microservice auf neue Spring-Boot-Version" — eine YAML mit Preconditions auf einen Service-Marker, dann Delegation an `UpgradeSpringBoot_3_X` plus interne API-Migrations-Recipes.
- Property-Migration für unternehmensspezifische Property-Keys (z. B. Konsolidierung verschiedener Konfigurationsschemata).
- Konsolidierung von Jackson-`ObjectMapper`-Konfigurations-Boilerplate auf eine gemeinsame Factory.

**Refaster-Style (~25 %):**

- Hibernate-Query-Idiome (Criteria-API-Modernisierung, JPQL-Patterns).
- Logger-Konventionen (z. B. „benutze immer Lombok `@Slf4j`, nie statisches `LoggerFactory.getLogger`").
- Optional-Idiome, Stream-Collector-Modernisierung.
- Jackson-Annotation-Normalisierung.

**Imperative Recipes (~15 %, nur wenn nötig):**

- Migrationen mit Cross-File-Logik (z. B. „wenn die Adapter-Klasse `X` einen `@Bean` namens `Y` definiert, dann ändere den Aufrufer in der entsprechenden Configuration-Klasse").
- Spring Security 6.x → 7.x Custom-Konfigurationen, die nicht von Out-of-the-box-Recipes abgedeckt werden.
- Hibernate-Custom-`UserType`-Migrationen, die Cross-Field-Knowledge brauchen.

**Pragmatischer Anlaufpfad für ein erstes eigenes Recipe-Modul:**

1. Eigenes Gradle-Subprojekt `company-rewrite` neben dem Hauptbuild.
2. Recipes in `company-rewrite/src/main/resources/META-INF/rewrite/*.yml`.
3. Komplexere Logik in `company-rewrite/src/main/java/...`.
4. Tests in `company-rewrite/src/test/java/...` mit `RewriteTest`.
5. Aktivierung im Konsumer-Projekt: `rewrite("com.example:company-rewrite:1.0.0")` in der `dependencies { rewrite(...) }`-Sektion.
6. CI publisht das `company-rewrite`-Artifact in den internen Maven-Mirror; Konsumer-Repos pinnen die Version.

### 4.14 Kritische Bewertung Recipe-Authoring

1. **Type Attribution ist die größte Frustquelle.** Wenn eine Recipe stillschweigend nichts tut, ist die erste Hypothese: fehlende Type Attribution im LST. Diagnostic: `Find missing types`-Recipe laufen lassen.

2. **`JavaTemplate` mit Generics ist ekelhaft.** Sobald die synthetische Code-Stelle Generic-Typen hat, fängt man an, mit `TypeVariable`-API zu kämpfen. Es geht, aber es ist undankbar.

3. **Spring-Recipes sind opinionated und teilweise zu aggressiv.** Eine `UpgradeSpringBoot_3_5`-Recipe macht auch Property-Renames, die in eurer Config-Pipeline möglicherweise nicht erwartet sind. `rewriteDryRun` ist Pflicht, niemals `rewriteRun` direkt auf eure Production-Codebase ohne Diff-Review.

4. **Die meisten Spring-Recipes sind seit Dezember 2024 unter MSAL.** Praktisch erlaubt das die Anwendung auf eigenen Code; aber wenn jemals daran gedacht wird, ein eigenes Tooling extern anzubieten, kollidiert das mit der Lizenz.

5. **Wenig native Unterstützung für Custom-Annotation-Processors.** Mit eigenen Annotations, die zur Compile-Zeit Code generieren (Spring Boot Configuration Processor, MapStruct), sieht OpenRewrite den generierten Code nicht zwangsläufig. Recipes operieren auf dem Source-LST, nicht auf dem Post-Processing-Output.

6. **Performance bei sehr großen Recipe-Listen.** Eine YAML mit 50 Sub-Recipes braucht real Minuten auf einem mittelgroßen Microservice. Profile-Recipes oder Recipe-Splitting wird ab einer gewissen Größe nötig.

---

## 5. Kotlin-Support

Für Enterprise-Anwendungen, die ein Spring + Kotlin Setup planen oder bereits einsetzen, ist die Kotlin-Realität von OpenRewrite einer der wichtigsten Caveats.

### 5.1 TL;DR

**Kotlin-Support ist da, aber zweitklassig, und mit Kotlin 2.x aktuell gebrochen.** Die spannenden Spring-Recipes sind in Java geschrieben für Java-Code; sie funktionieren teilweise auf Kotlin, aber mit signifikanten Lücken. Für ein neues Spring + Kotlin Projekt heute heißt das: Plane ein, dass OpenRewrite als Migrations-Werkzeug nur eingeschränkt nutzbar ist.

### 5.2 Was funktioniert (Spring + Kotlin Refactoring)

**Standard-Recipes mit `J.*`-Visitor laufen über Kotlin-Code.** Da Kotlins LST vom Java-LST erbt, kann eine in Java geschriebene Recipe wie `org.openrewrite.java.RemoveAnnotation` oder `org.openrewrite.java.ChangeType` Kotlin-Code anfassen. Modernes eigene Worte: „A JavaVisitor can be used to traverse and manipulate Groovy and Kotlin LSTs alike."

Was das praktisch bedeutet: Eine `javax → jakarta`-Migration über `JavaxMigrationToJakarta` (Teil von `UpgradeSpringBoot_3_X`) wird auch auf einer Kotlin-Klasse mit `@javax.persistence.Entity` funktionieren — _wenn_ das Kotlin-File überhaupt geparst werden kann (siehe unten).

**Kotlin-spezifische Recipes existieren**, sind aber wenige:

- `org.openrewrite.kotlin.format.AutoFormat`, `Spaces`, `BlankLines` — Formatierung.
- `org.openrewrite.kotlin.cleanup.RemoveTrailingComma`, `RemoveRedundantParentheses` — kleinere Cleanups.
- `org.openrewrite.kotlin.AddImport`, `ChangeType`, etc. — die typischen Building Blocks in Kotlin-Variante.

**Gradle Kotlin DSL Support** ist seit 2025 verfügbar. Aus Modernes Deep-Dive: Die Polyglot-Adaptation ist möglich, weil Groovy- und Kotlin-LSTs beide vom Java-LST erben, sodass ein `JavaVisitor` zur Traversierung und Manipulation beider LSTs verwendet werden kann. Es gibt aber bedeutsame Unterschiede zwischen diesen LSTs, was das Manipulieren sprachspezifischer Syntax umständlich macht.

Konkret: `build.gradle.kts` mit Recipes wie `UpdateGradleWrapper`, `UpgradeDependencyVersion`, `org.openrewrite.gradle.kotlin.UpdateGradleProperty` ist möglich. Das war lange offen und ist erst Mitte 2025 ernsthaft funktional geworden.

### 5.3 Was nicht funktioniert

**Kotlin 2.x / K2 ist nicht unterstützt.** Das ist die wichtigste praktische Limitierung. Aus dem aktiven GitHub-Issue (Januar 2026): Bei einem Projekt mit Kotlin 2.x (K2 compiler) schlägt das Parsing fehl mit `KotlinIllegalArgumentExceptionWithAttachments`. Das aktuelle `rewrite-kotlin` nutzt `kotlin-compiler-embeddable:1.9.25`, das Kotlin-2.x-Source, kompiliert mit dem K2-Compiler, nicht parsen kann.

Kotlin 2.0 ist seit Mai 2024 stable und Default. Sprich: Jedes neue Spring + Kotlin Projekt heute landet auf Kotlin 2.x, und OpenRewrite kann es nicht parsen. Es gibt einen PR (#6338) der das adressiert, aber er ist Anfang 2026 noch in Arbeit. Workaround in der Praxis: Kotlin-Files via `exclusion("**/*.kt")` ausschließen — verhindert aber, dass Recipes auf Kotlin-Sources angewendet werden.

**Parsing-Zuverlässigkeit auch unter K1 ist mäßig.** Aus einem realen Erfahrungsbericht: Etwa 50 % der Kotlin-Files wurden nicht geparst, und wenn doch, dann nicht immer wie erwartet refaktoriert.

**Spring-spezifische Recipes erkennen Kotlin-Idiome nicht.** Beispiele für Dinge, die in einer Spring + Kotlin Codebase typisch sind und für die OpenRewrite kein semantisches Verständnis hat:

- **Data Classes** als Entities/DTOs. `JavaxMigrationToJakarta` stellt das `@Entity`-Annotation um, aber die Recipe versteht nicht, dass `data class` etwas anderes ist als ein Java-POJO. Konstruktor-Parameter mit Annotations, Init-Blöcke, `copy()`-Semantik sind außerhalb der Reichweite.
- **Companion Objects** als Ersatz für `static`-Methoden. Recipes wie „statische Logger-Initialisierung migrieren" verstehen das nicht.
- **Extension Functions** auf Spring-Types (`fun RestTemplate.getForObject(...)`). Eine Recipe, die `RestTemplate` durch `RestClient` ersetzt, fasst die Extension-Function-Definition nicht zwingend an.
- **Property-Delegation** (`by lazy`, `by inject()`, `@Autowired` auf `lateinit var`). Spring-Recipes, die `@Autowired`-Constructor-Migration machen, behandeln das inkonsistent.
- **Named und Default Arguments**. Migrations-Recipes, die Methoden-Signaturen ändern, brechen Kotlin-Aufrufstellen mit named arguments, wenn der Parameter-Name sich ändert.
- **Coroutines / Suspend Functions**. Recipes für Spring WebFlux → Reactive-Migrationen sind auf Java-Reactor zugeschnitten, nicht auf Coroutines.
- **`when`-Expressions, `if`-as-Expression**. Recipes, die Java-`switch`-Statements modernisieren, sehen nichts in Kotlin-`when`-Blöcken.
- **Jackson + Kotlin**: Annotation-Migrationen erkennen den `kotlin-module` nicht spezifisch. Constructor-based-Deserialisierung mit Kotlin data classes wird inkonsistent gehandhabt.

**Refaster funktioniert nur eingeschränkt auf Kotlin.** Refaster-Templates sind in Java geschrieben, der generierte Matcher arbeitet auf `JavaTemplate.Matcher`. Auf Kotlin-Code matched das nur bei Patterns, die im Java-LST-Subset liegen.

**Kein Spring-Boot-für-Kotlin-Best-Practices-Recipe-Modul.** Die `rewrite-spring`-Recipes haben keine Kotlin-Spezialisierung. Es gibt z. B. keine „Constructor Injection auf Kotlin-Data-Class-Konventionen normalisieren"-Recipe.

### 5.4 Recipes in Kotlin schreiben

**Technisch ja, praktisch suboptimal.**

#### Was möglich ist

OpenRewrite ist eine JVM-Library. Jede Recipe-Klasse kann in Kotlin geschrieben werden, gegen die OpenRewrite-Java-API. Der Recipe-Starter unterstützt das nicht out-of-the-box, aber es funktioniert mit einem normalen `kotlin("jvm")`-Plugin im Recipe-Modul-`build.gradle.kts`.

```kotlin
class RemoveDeprecatedLegacyInit : Recipe() {
    override fun getDisplayName() = "Remove deprecated LegacyLogger init"
    override fun getDescription() = "Removes the legacy LegacyLogger.init() bootstrap call."

    private val matcher = MethodMatcher("com.example.logging.LegacyLogger init()")

    override fun getVisitor(): TreeVisitor<*, ExecutionContext> = object : JavaIsoVisitor<ExecutionContext>() {
        override fun visitMethodInvocation(
            mi: J.MethodInvocation,
            ctx: ExecutionContext
        ): J.MethodInvocation {
            val m = super.visitMethodInvocation(mi, ctx)
            return if (matcher.matches(m)) null!! else m // pragmatisches Beispiel
        }
    }
}
```

Funktioniert. Aber:

#### Warum es trotzdem keine gute Idee ist

1. **Die Konventionen, Tutorials, Community-Beispiele sind komplett in Java.** Bei der Suche nach OpenRewrite-Patterns (LST-Debugging, `JavaTemplate`-Gotchas, MethodMatcher-Edge-Cases) findet man Java-Antworten. Permanente mentale Übersetzung.

2. **Lombok-Boilerplate-Reduktion verliert die Idiomatik.** Idiomatische OpenRewrite-Recipes in Java nutzen `@Value @EqualsAndHashCode(callSuper = false)` aus Lombok. Das macht eine Klasse mit Optionen kurz. In Kotlin würde man Data Class verwenden — die kann aber nicht von `Recipe` erben (Data Classes können keine Klassen extenden). Man landet entweder bei normalen `class … : Recipe()` plus manueller `equals`/`hashCode`-Implementation, oder man ignoriert es. Weniger Boilerplate-frei als Java-mit-Lombok.

3. **`JavaTemplate.builder(...)` mit Kotlin-String-Templates ist trickreich.** Kotlin-`$variable`-Interpolation kollidiert mit `JavaTemplate`-Parameter-Syntax, die `#{}` verwendet. Raw strings nutzen und auf Escaping achten.

4. **Stack-Traces in Tests verweisen auf Java-Stellen, die nicht 1:1 zum Kotlin-Code passen.** Ein produktivitätsfeindlicher Faktor in iterativer Recipe-Entwicklung.

5. **`@Option`-Annotation funktioniert mit Kotlin-Properties.** Mit `@field:Option`. Wenn das vergessen wird, landet die Annotation am Konstruktor-Parameter statt am Field, und OpenRewrites Reflection-basierte Recipe-Validierung gibt unklare Fehler.

#### Wann es trotzdem Sinn macht

Ein Fall:

**Internes Recipe-Modul, das tief mit Kotlin-spezifischer Logik arbeitet** — etwa Recipes, die `KotlinIsoVisitor` direkt verwenden, mit `K.*`-Knotentypen (Data Classes, Companion Objects, etc.). In dem Fall ist Kotlin-Recipe-Code lesbar, weil die Recipe-Logik sich mit Kotlin-Idiomen beschäftigt. Aber: Diese Klasse von Recipes braucht es nur bei signifikantem Kotlin-Anteil.

**Sonst bei Java + Lombok bleiben.** Pragmatisch und idiomatisch deckungsgleich.

### 5.5 Das LST-Vererbungsmodell — wichtig zum Verständnis

Aus Modernes technischem Deep-Dive: Strong type attribution ist ein grundlegender Grund, warum OpenRewrite-Recipes präzise und einfach zu authoren sind. Die Idee, Recipes in separate Groovy- und Kotlin-Versionen aufzuspalten, wurde verworfen, weil das den Recipe-Namespace überladen und Discoverability schaden würde. Es gibt aber auch keinen `GroovyAndKotlinVisitor` — daher ist der Weg zu echten Polyglot-Recipes nicht trivial. Zwei Schlüssel-Features kommen zusammen: Groovy- und Kotlin-LSTs erben beide vom Java-LST. Ein `JavaVisitor` kann zur Traversierung und Manipulation beider verwendet werden. Es gibt aber bedeutsame Unterschiede, was das Manipulieren sprachspezifischer Syntax umständlich macht.

Konkret: Kotlin-LST-Knoten haben den Präfix `K.*` für sprachspezifische Konstrukte (`K.ClassDeclaration` mit `data class`-Modifier-Info, `K.WhenExpression`, etc.). Aber Common Java-Konstrukte (`J.ClassDeclaration`, `J.MethodInvocation`, `J.Annotation`) erscheinen auch in Kotlin-LSTs. Eine `JavaVisitor` sieht nur das gemeinsame Java-Subset und ignoriert Kotlin-spezifische Knoten.

Zwei Konsequenzen:

1. **Viele Recipes „funktionieren" trotzdem auf Kotlin** — soweit sie nur auf die Java-Subset-Knoten greifen.
2. **Kotlin-Idiome werden meist nicht erkannt** — weil Recipes nicht über `K.*` traversieren.

Das ist kein Designfehler, sondern eine fundamentale Eigenschaft des polyglotten Modells. Wer es ändern will, muss eine dedizierte `KotlinVisitor`-basierte Recipe schreiben.

### 5.6 Repository-Status

`rewrite-kotlin` wurde als standalone Repo am 12. Mai 2025 archiviert — der Code wanderte ins Hauptmonorepo `openrewrite/rewrite`. Funktional ist das OK, weil das Maven-Artifact (`org.openrewrite:rewrite-kotlin`, aktuell 183+ Versionen) weiter publiziert wird. Aber: Es signalisiert, dass Kotlin nicht als eigenes Produkt mit eigenem Release-Zyklus behandelt wird.

### 5.7 Empfehlungen nach Szenario

**Szenario A: Neues Spring + Kotlin Projekt geplant**

1. **Kotlin-Versions-Strategie bewusst planen.** Solange OpenRewrite K2 nicht unterstützt, ist man mit Kotlin 2.x auf der Java-Seite produktiv, auf der Kotlin-Seite ohne automatisiertes Refactoring-Werkzeug. Das ist _einer_ der zu wägenden Faktoren in der Tech-Stack-Entscheidung — aber kein Blocker.
2. **Bewusste Trennung Java vs. Kotlin.** Wenn Kotlin im Projekt nur für eng umrissene Bereiche (Routing-DSL, Test-DSL, Type-Safe-Konfiguration) eingesetzt wird, bleibt der Java-Anteil OpenRewrite-fähig. Bei „Kotlin-first" akzeptiert man de facto, dass automatisierte Migrationen nur das Build-File und einen kleinen Java-Anteil treffen.
3. **Refaktor-Werkzeug für Kotlin ist IntelliJ + selbstgeschriebene Inspections oder Detekt-Rules.** Nicht OpenRewrite. Diese Realität anerkennen.

**Szenario B: Bestehender Java-Code, einzelne Kotlin-Skripte oder -Module**

Pragmatisch. Die Kotlin-Files können via `exclusion("**/*.kt")` aus der Recipe-Anwendung ausgenommen werden, oder die Recipes ignorieren sie still. Kein dringender Handlungsbedarf.

**Szenario C: Spring Boot Upgrade auf Codebase mit einigen Kotlin-Files**

Workflow:

1. **`rewriteDryRun` zuerst** — sichtbar machen, welche Kotlin-Files überhaupt geparst werden.
2. **Bei Parse-Fehlern**: `exclusion("**/*.kt")` in der `rewrite { }`-Konfiguration setzen. Die Kotlin-Files werden dann komplett übersprungen, der Rest der Migration läuft sauber.
3. **Manuelle Nacharbeit der Kotlin-Files** mit einem Coding-Agent im Pattern-1-Stil (Duolingo-Workflow aus Abschnitt 3) — der Agent macht die `javax → jakarta`-Migration auf den Kotlin-Files, der Build ist das deterministische Gate.

Nicht elegant, aber realistisch und funktioniert.

### 5.8 Kritische Bewertung Kotlin-Support

1. **Kotlin-Support hat Second-Class-Charakter und wird das absehbar bleiben.** Moderne verdient Geld mit Enterprise-Java-Migrationen. Spring + Kotlin ist im Enterprise-Java-Markt eine Minderheit; entsprechend niedriger die Investitionspriorität.

2. **Die K2-Lücke ist symptomatisch.** Kotlin 2.0 ist seit Mai 2024 stable. Dass `rewrite-kotlin` im Frühjahr 2026 immer noch auf `kotlin-compiler-embeddable:1.9.25` hängt, zeigt, dass das Team nicht mit JetBrains' Release-Tempo Schritt hält. Selbst wenn PR #6338 in Kürze landet — der Backlog von „funktioniert auf K2, aber wie auf K1?"-Bugs wird Monate brauchen.

3. **Spring + Kotlin Best-Practices-Recipes fehlen vollständig.** Das ist der greifbarste Mangel. Konstruktor-Injection mit Data Classes, Configuration Properties mit `@ConstructorBinding`, WebFlux-Reactor-zu-Coroutines — alles Stellen, wo eine professionelle Recipe-Sammlung Geld wert wäre. Existiert nicht.

4. **Pragmatischer Ausweg: AI-Agent statt Recipe für Kotlin-Code.** Das verbindet sich nahtlos mit den AI-Pattern aus Abschnitt 3. Pattern 1 (Duolingo-Style: Recipes wo möglich, Agent für den Rest) ist hier doppelt wertvoll: Auf der Java-Seite läuft OpenRewrite, auf der Kotlin-Seite übernimmt der Agent komplett.

---

## 6. Alternativen und verwandte Tools

OpenRewrite ist nicht allein im Raum der Code-Transformations-Werkzeuge. Bevor man sich auf OpenRewrite committet, lohnt der Blick auf die Landschaft — sowohl für JVM-Alternativen als auch für andere Sprachökosysteme und polyglotte Tools.

### 6.1 Die Achsen, an denen man Tools einordnet

Vier Eigenschaften, die einen sinnvollen Vergleich erlauben:

1. **Format-Erhaltung** — verliert das Tool Whitespace und Kommentare bei der Transformation?
2. **Type Awareness** — kennt das Tool Symbole, resolved Types und Inheritance, oder arbeitet es rein syntaktisch?
3. **Sprachen-Scope** — single-language oder polyglott?
4. **Authoring-Modell** — programmatisch in der Host-Sprache, eigene Query-Language (DSL), oder by-Example/Template?

OpenRewrite ist einer der wenigen Punkte im Raum „Format + Types + Recipe-Modell". Das macht es schwer ersetzbar — aber je nach Sprache und Use Case gibt es Tools, die zumindest zwei von drei Achsen treffen, und für viele konkrete Aufgaben sind sie pragmatischer.

### 6.2 JVM-Alternativen zu OpenRewrite

**Refaster (Teil von Error Prone, Google).** Der direkteste ideologische Konkurrent. Man schreibt `@BeforeTemplate` / `@AfterTemplate`-Paare als normales Java, der Compiler matcht und rewritet. Volltype-aware, weil es ein javac-Plugin ist. Schwäche gegenüber OpenRewrite: läuft als Build-Zeit-Check, keine separate „Lauf-mich-mal-übers-Repo"-Plattform, keine vergleichbare Recipe-Bibliothek, keine Multi-Repo-Orchestrierung. Für eine konkrete API-Migration im eigenen Code ist Refaster oft pragmatischer. Erweiterungen: **Picnic Error Prone Support** liefert ~100 produktionsreife Refaster-Templates für gängige Java-Idiome.

- https://github.com/google/error-prone
- https://errorprone.info/docs/refaster
- https://github.com/PicnicSupermarket/error-prone-support

**Spoon (INRIA).** Source-to-Source-Transformations-Library für Java, akademisch sehr fundiert, type-aware (eigene metamodell-basierte Repräsentation). Erlaubt sowohl Pattern Matching als auch programmatische Transformationen. Im Stil Bibliothek, nicht Plattform — das Refactoring baut man sich selbst. Stärke: extrem mächtig und gut für Tooling-Forschung. Schwäche: kein Ökosystem an fertigen Recipes, weniger Polish als OpenRewrite.

- https://spoon.gforge.inria.fr/
- https://github.com/INRIA/spoon/

**JavaParser + JavaSymbolSolver.** Die rohe Schicht darunter. Sinnvoll, wenn Spoon zu opinionated ist und wirklich nur ein AST mit Symbol-Auflösung gebraucht wird. Format-Preservation per `LexicalPreservingPrinter`, aber rough edges.

- https://javaparser.org/

**Polyglot Piranha (Uber).** In Rust geschrieben, läuft aber auf Java/Kotlin/Swift/Go/Strings/etc. via tree-sitter. Spezialisiert auf „Feature-Flag-Cleanup"-artige Transformationen mit deklarativen Rules. Für die meisten klassischen OSS-Migrationen weniger umfassend als OpenRewrite, aber polyglott, was OpenRewrite klar nicht ist.

- https://github.com/uber/piranha

**IntelliJ Structural Search & Replace (SSR).** Wird unterschätzt. Wenn man im Editor sitzt und eine einmalige Repo-weite Transformation braucht, ist SSR mit Type-Filtern oft schneller als eine OpenRewrite-Recipe zu schreiben. Nicht headless/CI-tauglich — das ist der Deal-Breaker für Mass-Migration.

- https://www.jetbrains.com/help/idea/structural-search-and-replace.html

**Kotlin-Welt:** OpenRewrite hat seit ein paar Jahren Kotlin-Support (siehe Abschnitt 5). Daneben gibt's **Detekt** mit AutoCorrect für simple Lints. Ein echtes „Refaster für Kotlin" fehlt im Ökosystem.

> **Notiz zu anderen JVM-Sprachen:** Für Scala existiert mit **Scalafix** ein konzeptuell sehr ähnliches Werkzeug (semantische Refactorings mit SemanticDB) — relevant zu kennen, falls jemals ein Mixed-JVM-Setup auftaucht.

### 6.3 Andere Sprachen-Ökosysteme

**JavaScript / TypeScript:**

- **jscodeshift** (Meta) — der Klassiker, baut auf recast + Babel. Großes Recipe-Ökosystem (React-Codemods, MUI-Migrationen). Type-Awareness nur über separate TypeScript-AST-Pfade. https://github.com/facebook/jscodeshift
- **ts-morph** — idiomatisch, wenn man in TypeScript bleiben will. Nutzt den TS-Compiler direkt, also volle Type-Info. https://ts-morph.com/
- **Hypermod** (Community + Plattform, hat den Codemod-Registry-Gedanken weiterentwickelt) und **codemod.com** (kommerziell, eigene Plattform) — beide noch aktiv, beide JS/TS-fokussiert. https://www.hypermod.io/, https://codemod.com/
- **Biome** integriert mittlerweile GritQL als Query-Sprache für eigene Plugins (siehe Polyglotte Tools).

**Python:**

- **LibCST** (Instagram/Meta) — konzeptionell am nächsten an OpenRewrite: Concrete Syntax Tree mit Metadaten-Providern für Type-Inference (über Pyre/Pyright). Wenn nur ein Python-Tool gemerkt werden soll, ist es das. https://libcst.readthedocs.io/
- **Bowler** (Facebook, auf LibCST gebaut) — fluent API, allerdings stagniert. https://pybowler.io/
- **RedBaron, rope** — ältere Alternativen, heute LibCST nehmen.

**C/C++:**

- **Coccinelle** — der geistige Vorfahre von OpenRewrite. Semantic Patches mit eigener DSL „SmPL". Wird im Linux-Kernel intensiv für Treiber-Migrationen genutzt. https://coccinelle.gitlabpages.inria.fr/website/
- **Clang LibTooling / ClangTidy mit Fixits** — die offizielle Schiene, type-aware, aber API-mäßig hässlich. https://clang.llvm.org/docs/LibTooling.html

**Go:**

- **`gofmt -r`**, **`go fix`** — eingebaut, aber sehr beschränkt.
- **`gopls modify`**, **`eg`** (von Alan Donovan) — Template-basiert, ähnlich Refaster-Idee.
- **Rf** (Russ Cox) — noch experimentell, aber spannend. https://github.com/rsc/rf

**Rust:**

- **rustfix** + **clippy --fix** — auf Lints fokussiert, kein generisches Refactoring-Framework.
- Eigene `syn`+`quote`-Tools für Macro-Generation, aber das ist nicht Refactoring im OpenRewrite-Sinn.

### 6.4 Polyglotte Tools (sprachübergreifend)

Diese Klasse ist eine eigene Familie und löst ein anderes Problem als OpenRewrite. Sie sind in der Regel **nicht type-aware** (außer in Grenzfällen), aber dafür funktionieren sie über Sprachgrenzen hinweg:

**Semgrep.** Eigentlich Security/SAST, aber kann mit `--autofix` deklarative Transformationen durchführen. Pattern-Sprache so wie der Code selbst aussieht, also niedrige Einstiegshürde. ~30 Sprachen. Sinnvoll für Compliance- und Security-Sweeps.

- https://semgrep.dev/

**ast-grep (`sg`).** Rust-basiert, tree-sitter-basiert. Pragmatischer Favorit für Quick Wins: kein Buildsystem-Setup, einfache YAML-Rules, sehr schnell.

- https://ast-grep.github.io/

**Comby.** Structural Search & Replace mit Template-Holes über alle Sprachen, die balancierte Delimiter haben. Sehr elegant für „Form-Pattern"-Refactorings, aber keine Semantik.

- https://comby.dev/

**GritQL.** Statuswechsel: Grit als Produkt wurde im April 2025 von Honeycomb übernommen, das Produkt wird eingestellt, aber GritQL bleibt als Open-Source-Query-Engine erhalten. Biome.js arbeitet aktiv an GritQL-Support für sein Plugin-System. Lohnt sich weiterhin zu kennen, weil die Sprache eine Zukunft hat — die SaaS-Plattform aber nicht.

- https://github.com/biomejs/gritql
- Honeycombs Übernahme-Ankündigung: https://www.honeycomb.io/blog/honeycomb-acquires-grit

### 6.5 Entscheidungs-Cheatsheet

| Anforderung                                                                                                     | Empfehlung                                                                                                     |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| API-Migration in einem einzelnen Java-Repo                                                                      | Refaster (Picnic-Templates als Vorlage); OpenRewrite wäre Overkill                                             |
| Dieselbe Migration über 50+ JVM-Repos mit Recipe-Wiederverwendung                                               | OpenRewrite ist hier wirklich allein auf weiter Flur, ggf. mit Moderne-Plattform für Multi-Repo-Orchestrierung |
| Type-Awareness essentiell (z. B. „ist das wirklich `java.util.Date` oder eine User-Klasse mit gleichem Namen?") | Refaster, Spoon, OpenRewrite, LibCST mit Type-Provider, ts-morph                                               |
| Quick Win, einmaliges Refactoring im eigenen Repo                                                               | ast-grep oder IntelliJ SSR. Keine Recipe für etwas schreiben, das genau einmal gebraucht wird                  |
| Security-Sweep über mehrere Sprachen                                                                            | Semgrep                                                                                                        |
| Strukturelles Find-and-Replace ohne Semantik, polyglott                                                         | Comby oder ast-grep                                                                                            |
| Feature-Flag-Cleanup, polyglott                                                                                 | Polyglot Piranha                                                                                               |
| Spring Boot Major-Version-Upgrade über 10+ Microservices                                                        | OpenRewrite (`rewrite-spring`) ist hier konkurrenzlos                                                          |
| Python-Codebase mit Type-Awareness refaktoren                                                                   | LibCST                                                                                                         |
| JS/TS-Codebase mit Type-Awareness refaktoren                                                                    | ts-morph                                                                                                       |
| JS/TS-Codebase ohne Type-Awareness, Massen-Migration                                                            | jscodeshift                                                                                                    |
| Linux-Kernel-artige Patches in C/C++                                                                            | Coccinelle                                                                                                     |

### 6.6 Kritische Einordnung

Eine ehrliche Schwäche von OpenRewrite, die in der Praxis auffällt: Recipes sind in Java geschrieben (oder neuerdings YAML-deklarativ für simple Fälle), und die Lernkurve für Visitor-basierte LST-Manipulation ist nicht trivial. Refaster ist für „API von X auf Y mappen" oft mit einem Bruchteil des Codes machbar — nur halt nicht über fremde Codebasen distribuierbar wie OpenRewrite-Recipes.

Die Distinktion ist wichtig:

- **Refaster** = Tool für „in meinem Code von A nach B".
- **OpenRewrite** = Tool für „diese Migration soll in 200 Repos laufen, wiederverwendbar als Artifact".

Wer beide Use Cases hat, nutzt idiomatisch beide nebeneinander. Refaster für interne Schnell-Refactorings, OpenRewrite für distribuierbare Recipe-Module.

Ein zweiter Punkt: Die polyglotten Tools (Semgrep, ast-grep, Comby) sind in Enterprise-Setups oft unterschätzte Ergänzungen für OpenRewrite. Beispiel: OpenRewrite refaktoriert den Spring-Code, ein Semgrep-Rule prüft parallel YAML-Konfigurationen auf Compliance-Pattern. Die Tools schließen sich nicht aus.

### 6.7 Weiterführendes Material zu Code-Transformation

- Jonathan Schneiders Talks zu OpenRewrite-Internas (LST-Design): YouTube nach „Moderne OpenRewrite" suchen.
- Coccinelle-Paper „Documenting and Automating Collateral Evolutions in Linux Device Drivers" (Padioleau et al.) — akademische Wurzel der ganzen Bewegung.
- „A Survey of Source Code Transformation Tools" — Mens & Tourwé, IEEE TSE 2004 (etwas alt, aber gute Taxonomie).
- Picnic Engineering Blog — beste praktische Refaster-Erfahrungsberichte: https://blog.picnic.nl/picnics-error-prone-support-becomes-an-error-prone-org-project-1d212c4d99c1

---

## 7. Konsolidierte Empfehlungen für Enterprise-Anwendungen

Zusammenführung der bisherigen Punkte in einen aktionablen Plan.

### 7.1 Strategische Leitlinien

1. **OpenRewrite ist das beste verfügbare Werkzeug für Java-zentrierte Spring-Boot-Migrationen at Scale.** Trotz Lizenz-Schmerzen, trotz Moderne-Lock-in, trotz Kotlin-Schwäche. Die Alternativen sind dünn (siehe Abschnitt 6).

2. **Die Engine ist OSS, die wertvollen Recipes sind es nicht mehr.** Das ist die wichtigste praktische Realität nach Dezember 2024. Lizenz-Audit der genutzten Recipes ist Pflicht, bevor das in produktive Pipelines eingebaut wird.

3. **AI ergänzt OpenRewrite, ersetzt es nicht.** Pattern 1 (deterministische Recipes zuerst, AI im Build-Fix-Loop) ist der einzig produktionserprobte Workflow. Pattern 2 (AI schreibt Recipes) ist die nachhaltigste Investition. Pattern 3 (LLM in Recipes) wird gemieden.

4. **Eigene Recipes sind ein langfristiger Asset.** Wer einmal eine interne API-Migration als Recipe schreibt, kann sie für jede zukünftige Version dieser API wiederverwenden. Das ist der eigentliche Hebel — nicht die fertigen Spring-Recipes.

5. **Kotlin als Tech-Stack-Entscheidung mit OpenRewrite-Lens betrachten.** Wer ernsthaft auf Kotlin migriert, gibt OpenRewrite als Migrations-Werkzeug für den Kotlin-Anteil weitgehend auf. Das ist ein bewusst zu treffender Tradeoff.

6. **Tool-Mix statt Tool-Monokultur.** Refaster für interne Schnell-Refactorings, OpenRewrite für Mass-Migration, Semgrep/ast-grep für Compliance- und Quick-Win-Sweeps. Die Tools schließen sich nicht aus.

### 7.2 Phasenplan

**Phase 0 — Vor-Bewertung**

- Codebase-Inventory: Welche Spring-Boot-Versionen, welche Java-Versionen, welche kritischen Dependencies (Hibernate, Jackson, Spring Security, Spring Cloud), welche Kotlin-Anteile?
- Lizenz-Audit: Welche Recipes geplant? Welche sind Apache 2.0, welche MSAL? Rechtsabteilung konsultieren.
- Build-Tool-Konsolidierung: OpenRewrite funktioniert am besten mit sauberen Gradle- oder Maven-Standard-Setups. Composite-Builds, exotische Plugins, eigene Conventions sind Risikofaktoren.
- Tool-Evaluation: Lohnt sich OpenRewrite gegenüber Refaster für den konkreten Use Case? Anzahl der Konsumer-Repos ist die Kernfrage.

**Phase 1 — Erste Migration mit existierenden Recipes**

- Spring-Boot-Upgrade-Recipe auf einem mittelgroßen Microservice testen (`rewriteDryRun`).
- Diff manuell reviewen, Edge-Cases identifizieren.
- Build- und Test-Erfolg als deterministisches Gate.
- Erfolg dokumentieren, Lessons Learned festhalten.

**Phase 2 — Pattern 1 als CI-Workflow**

- Duolingo-Style-Workflow aufbauen: YAML-Konfiguration der Upgrade-Schritte, OpenRewrite läuft zuerst, AI-Agent fixt die Lücken, Build als Gate, PR pro Schritt.
- Coding-Agent (Claude Code, Codex, etc.) integrieren — entweder lokal-getriggert oder als CI-Pipeline-Step.
- Token-Budget und Eskalations-Pfade definieren.

**Phase 3 — Eigene Recipes**

- Internes Recipe-Modul aufsetzen (siehe Abschnitt 4.13).
- Erste eigene YAML-Recipe als Wrapper um Standard-Spring-Recipes plus interne API-Renames.
- Refaster-Recipes für unternehmensspezifische Code-Idiome.
- AI-Agent (Pattern 2) zum Recipe-Authoring einsetzen — mit Moderne-Skills als Anleitung.
- Tests mit `@DocumentExample` als Doku-Quelle.

**Phase 4 — Skalierung**

- Recipe-Modul in internem Maven-Mirror publishen.
- Konsumer-Repos pinnen Versionen.
- Pattern 4 (Prethink-Konzept) experimentell ausprobieren: OpenRewrite extrahiert Architektur-Information für AI-Agents.
- Bei kritischer Masse: Evaluation der Moderne-Plattform vs. weiterer OSS-Selbstbau.

### 7.3 Hygiene-Checklist

- [ ] Recipe-Versionen hart gepinnt (kein `latest.release` in CI).
- [ ] Plugin-Version separat gepinnt.
- [ ] Lizenz-Header der Recipe-JARs auditiert (Apache 2.0 vs. MSAL).
- [ ] `rewriteDryRun` als Pflicht-Schritt vor `rewriteRun`.
- [ ] PR-Bot-Workflow statt Direct-Commit auf `main`.
- [ ] `@DocumentExample`-Tests für jede eigene Recipe.
- [ ] Idempotenz-Tests für jede eigene Recipe.
- [ ] Negative-Case-Tests (was die Recipe _nicht_ anfassen soll).
- [ ] Recipe-Modul-Versionierung mit semantischer Versionierung.
- [ ] Dependency-Locking der Recipe-Module.
- [ ] Kotlin-Files via `exclusion` ausschließen, falls Kotlin 2.x verwendet.
- [ ] Token-Budget pro AI-Agent-Lauf gedeckelt.
- [ ] Build-Erfolg + Test-Erfolg als deterministisches Gate.
- [ ] Datatables aktiviert (`setExportDatatables(true)`) für Audit und Metrik.

### 7.4 Risiken und ihre Mitigationen

| Risiko                                                          | Mitigation                                                                       |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Recipe wird umlizenziert (MSAL → MPL)                           | Versions-Pinning + jährliches Lizenz-Audit                                       |
| Heap-Probleme bei großen Repos                                  | JVM-Heap erhöhen; mittelfristig Moderne-Plattform-Eval                           |
| Kotlin K2 nicht parsbar                                         | `exclusion("**/*.kt")`; AI-Agent für Kotlin-Files                                |
| Spring-Recipe macht unerwünschte Property-Renames               | `rewriteDryRun` + Diff-Review; ggf. eigene überschreibende Recipe                |
| AI-Halluzinationen im Pattern-1-Loop                            | Loop-Iteration-Limit; menschliches Review vor PR-Merge                           |
| AI-Token-Kosten eskalieren                                      | Pro-Run-Budget; Pattern 2 (Recipe-Authoring) bevorzugen                          |
| Type Attribution fehlt → Recipe tut nichts                      | `Find missing types`-Diagnostic-Recipe                                           |
| Recipe-Modul-Abhängigkeit verschiebt sich                       | Eigenes internes Recipe-Modul mit eigener Versionierung                          |
| Vendor-Lock-in zu Moderne                                       | OSS-Anteile der Pipeline bevorzugen; Moderne-spezifische Features klar isolieren |
| Tool falsch gewählt (z. B. OpenRewrite für einmaligen Refactor) | Vor Phase 1 Tool-Evaluation gegen Refaster/ast-grep/SSR                          |

---

## 8. Reading Material (konsolidiert)

### 8.1 OpenRewrite Grundlagen

- Offizielle Docs: https://docs.openrewrite.org/
- Recipe-Konzepte: https://docs.openrewrite.org/concepts-and-explanations/recipes
- Recipe-Katalog (Marketplace): https://docs.openrewrite.org/recipes
- Alle Recipes (flach): https://docs.openrewrite.org/reference/all-recipes
- GitHub-Org: https://github.com/openrewrite
- FAQ: https://docs.openrewrite.org/reference/faq

### 8.2 Recipe-Authoring

- Java Refactoring Recipe schreiben (Tutorial): https://docs.openrewrite.org/authoring-recipes/writing-a-java-refactoring-recipe
- JavaTemplate Deep-Dive: https://docs.openrewrite.org/authoring-recipes/modifying-methods-with-javatemplate
- Best Practices und Konventionen: https://docs.openrewrite.org/authoring-recipes/recipe-conventions-and-best-practices
- Method Patterns Reference: https://docs.openrewrite.org/reference/method-patterns
- Type Attribution Reference: https://docs.openrewrite.org/reference/type-attribution
- YAML-Format Reference: https://docs.openrewrite.org/reference/yaml-format-reference
- Scanning Recipes: https://docs.openrewrite.org/concepts-and-explanations/recipes#scanning-recipes
- Refaster Recipes: https://docs.openrewrite.org/authoring-recipes/refaster-recipes
- Recipe-Starter (Template-Projekt): https://github.com/moderneinc/rewrite-recipe-starter

### 8.3 Spring Boot Migrationen

- Migrate to Spring Boot 3 Tutorial: https://docs.openrewrite.org/running-recipes/popular-recipe-guides/migrate-to-spring-3
- `UpgradeSpringBoot_4_0` Source (YAML): https://github.com/openrewrite/rewrite-spring/blob/main/src/main/resources/META-INF/rewrite/spring-boot-40.yml

### 8.4 Lizenzen

- Offizielle Lizenz-FAQ: https://docs.openrewrite.org/licensing/openrewrite-licensing
- Repository-spezifische Lizenz-Übersicht: https://docs.openrewrite.org/licensing/repository-licensing
- MSAL-Text: https://docs.openrewrite.org/licensing/msal
- Kritischer Beitrag von Jonathan Leitschuh: https://infosecwriteups.com/when-open-source-isnt-how-openrewrite-lost-its-way-642053be287d
- Modernes Gegendarstellung von Tim te Beek: https://medium.com/@timtebeek/the-openrewrite-community-potluck-ebf36116e7a6
- Spring-Tools-Issue zu den Auswirkungen: https://github.com/spring-projects/spring-tools/issues/1443

### 8.5 AI-Integrationen

- Duolingo Golden Path Workflow (Frontline-Case-Study): https://blog.duolingo.com/automating-jvm-golden-path
- FINOS — Modernization with AI Agents: https://www.finos.org/blog/open-source-auto-refactoring-meets-ai-agent-to-modernize-fintech-software-at-scale
- `rewrite-generative-ai` (Warnung: experimentell): https://github.com/openrewrite/rewrite-generative-ai
- Moderne AI Recipe Authoring: https://www.moderne.ai/blog/ai-powered-openrewrite-recipe-authoring-with-claude-skill
- Moderne Skills Doku: https://docs.moderne.io/user-documentation/agent-tools/skills/
- Moderne Prethink: https://docs.moderne.io/user-documentation/agent-tools/prethink/
- AI-Assisted Java Upgrades Hybrid-Approach: https://sri-chalam.medium.com/ai-assisted-java-upgrades-a-hybrid-approach-with-ai-instructions-and-openrewrite-669dc89d39b3
- FINOS CALM Spec: https://github.com/finos/architecture-as-code

### 8.6 Kotlin

- `rewrite-kotlin` Maven: https://mvnrepository.com/artifact/org.openrewrite/rewrite-kotlin
- Kotlin-Recipes-Katalog: https://docs.openrewrite.org/recipes/kotlin
- K2-Support-Issue: https://github.com/openrewrite/rewrite/issues/6621
- Moderne Deep-Dive Gradle-Kotlin-DSL-Support: https://www.moderne.ai/blog/openrewrite-and-gradle-kotlin-technical-deep-dive
- Archiviertes Repo (historische Issues): https://github.com/openrewrite/rewrite-kotlin
- Hauptmonorepo (aktueller Kotlin-Code): https://github.com/openrewrite/rewrite
- K2 Compiler Migration Guide: https://kotlinlang.org/docs/k2-compiler-migration-guide.html

### 8.7 Alternativen und verwandte Tools

JVM:

- Error Prone: https://github.com/google/error-prone
- Refaster: https://errorprone.info/docs/refaster
- Picnic Error Prone Support: https://github.com/PicnicSupermarket/error-prone-support
- Spoon: https://spoon.gforge.inria.fr/ (GitHub: https://github.com/INRIA/spoon/)
- JavaParser: https://javaparser.org/
- Polyglot Piranha (Uber): https://github.com/uber/piranha
- IntelliJ SSR: https://www.jetbrains.com/help/idea/structural-search-and-replace.html

JavaScript / TypeScript:

- jscodeshift: https://github.com/facebook/jscodeshift
- ts-morph: https://ts-morph.com/
- Hypermod: https://www.hypermod.io/
- codemod.com: https://codemod.com/

Python:

- LibCST: https://libcst.readthedocs.io/
- Bowler: https://pybowler.io/

C / C++ / Go:

- Coccinelle: https://coccinelle.gitlabpages.inria.fr/website/
- Clang LibTooling: https://clang.llvm.org/docs/LibTooling.html
- Rf (Russ Cox): https://github.com/rsc/rf

Polyglott:

- Semgrep: https://semgrep.dev/
- ast-grep: https://ast-grep.github.io/
- Comby: https://comby.dev/
- GritQL: https://github.com/biomejs/gritql
- GritQL Übernahme durch Honeycomb (April 2025): https://www.honeycomb.io/blog/honeycomb-acquires-grit

Akademisch / Hintergrund:

- Picnic Engineering Blog (praktische Refaster-Erfahrungsberichte): https://blog.picnic.nl/picnics-error-prone-support-becomes-an-error-prone-org-project-1d212c4d99c1

### 8.8 Weiterführend / Lernen

- Addo Zhangs OpenRewrite Learning Series (Visitor/LST): https://addozhang.medium.com/openrewrite-learning-part-3-recipes-and-visitors-71927fcf0e20
- Baeldung Tutorial (solider Einstieg): https://www.baeldung.com/java-openrewrite
- Cronn Erfahrungsbericht (realistisches Bild): https://blog.cronn.de/en/java/2025/10/23/openrewrite-for-refactoring.html
- Moderne Vergleichsseite (Marketing, mit Capability Matrix): https://www.moderne.ai/blog/overview-of-openrewrite-and-moderne

---

_Ende des Reports._
