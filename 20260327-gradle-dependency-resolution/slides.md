---
theme: default
transition: slide-left
title: Gradle Dependency Resolution & Locking
info: |
  Gradle Dependency Locking, Resolution-Strategien, Supply-Chain-Schutz
  und Ökosystem-Vergleich.
---

# Gradle Dependency Resolution & Locking

Reproduzierbare Builds, Supply-Chain-Schutz und Ökosystem-Vergleich

---

# Agenda

1. **Grundlagen** — Kernbegriffe & Dependency Stack
2. **Dependency Locking** — Aktivierung & Befehle
3. **BOM & Resolution-Strategien** — Spring BOM, Plugin vs. Native, Extra Properties
4. **Version Catalogs** — TOML, Zusammenspiel & Fallstricke
5. **Praxis-Workflows** — Neue Library, Library-Update
6. **Snapshot-Versionen** — Sonderfall, Caching & Produktions-Gate
7. **Supply-Chain-Schutz** — Scanning, Verification, Cooldown & Angriffe

---
layout: section
---

# 1. Grundlagen

Kernbegriffe & Dependency Stack

---

# Kernbegriffe

| Begriff                   | Bedeutung                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------- |
| **Dependency Locking**    | Fixiert aufgelöste Versionen in einer Lock-Datei                                    |
| **Resolution Strategy**   | "highest version wins" — Spring Boot BOM überschreibt mit festen Versionen          |
| **Lock State**            | `gradle.lockfile` pro (Sub-)Projekt — exakter Abhängigkeitsbaum                     |
| **Verification Metadata** | SHA-256 + PGP pro Artefakt in `verification-metadata.xml`                           |
| **BOM**                   | POM, die Versionen vorgibt — importiert via `platform()` (nativ) oder Spring-Plugin |
| **`platform()`**          | Nativer Gradle-BOM-Import (seit 5.0) — nutzt Gradles Constraint-Engine              |
| **Version Catalog**       | TOML-Datei (`libs.versions.toml`) — rein deklarativ, kein Einfluss auf Resolution   |

---
clicks: false
---

# Gradle Dependency Stack

<LayerStack />

---
layout: section
---

# 2. Dependency Locking

Aktivierung & Befehle

---

# Locking aktivieren

```kotlin
// build.gradle.kts
dependencyLocking {
    lockAllConfigurations()
    lockMode.set(LockMode.STRICT) // Build schlägt fehl wenn Lock-Datei fehlt/veraltet
}
```

Selektiv (nur bestimmte Konfigurationen):

```kotlin
configurations.compileClasspath {
    resolutionStrategy.activateDependencyLocking()
}
```

---

# Wichtigste Befehle

| Aktion                              | Befehl                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------- |
| Lock-Datei erzeugen / aktualisieren | `./gradlew dependencies --write-locks`                                  |
| Nur eine Konfiguration locken       | `./gradlew dependencies --configuration compileClasspath --write-locks` |
| Verification Metadata erzeugen      | `./gradlew --write-verification-metadata sha256,pgp`                    |
| Abhängigkeitsbaum anzeigen          | `./gradlew dependencies --configuration compileClasspath`               |
| Veraltete Deps prüfen               | `./gradlew dependencyUpdates`                                           |
| Lock-Datei-Diff prüfen              | `git diff gradle.lockfile`                                              |

---
layout: section
---

# 3. BOM & Resolution-Strategien

Spring BOM, Plugin vs. Native, Extra Properties

---

# Resolution mit Spring Boot BOM

```kotlin
plugins {
    id("org.springframework.boot") version "4.0.6"
    id("io.spring.dependency-management") version "1.1.7"
}
```

**Resolution-Ablauf:**

1. `implementation("...spring-boot-starter-web")` — keine Version
2. `spring-boot-dependencies` BOM liefert die Version (z.B. `4.0.6`)
3. Transitive Deps (Jackson, Tomcat, SLF4J, ...) werden durch BOM gepinnt
4. Lock-File fixiert das Gesamtergebnis

Spring-Boot-Version ändern → BOM ändert sich → Dutzende transitive Versionen ändern sich → Lock-Datei neu generieren!

---

# BOM-Import: Spring-Plugin vs. Native Gradle

<style>
table { font-size: 0.78em; }
th, td { padding: 0.25em 0.5em !important; }
</style>

|                          | Spring Dependency Management Plugin                              | Native Gradle (`platform()`)                   |
| ------------------------ | ---------------------------------------------------------------- | ---------------------------------------------- |
| **Seit**                 | Gradle 2.x (vor nativem BOM-Support)                             | Gradle 5.0 (2018)                              |
| **Syntax**               | `dependencyManagement { imports { mavenBom(...) } }`             | `implementation(platform(...))`                |
| **Mechanismus**          | Interne Map `group:artifact → version`, injiziert vor Resolution | Gradle Constraint-Engine (Teil der Resolution) |
| **Einzelne Constraints** | `dependencyManagement { dependencies { dependency(...) } }`      | `constraints { implementation(...) }`          |
| **Overrides**            | `ext["jackson.version"]` (Maven-Property-Mapping)                | `constraints { }` oder `enforcedPlatform()`    |
| **Priorität**            | Rang 6 (übersteuert `platform()`)                                | Rang 5 / Rang 7 (`enforcedPlatform()`)         |
| **Idiomatisch**          | Legacy — aber in Spring-Boot-Projekten weit verbreitet           | Empfohlen seit Gradle 5.x                      |

> **Historischer Kontext:** Das Spring-Plugin entstand, weil Gradle vor 5.0 keinen BOM-Import konnte.
> Heute ist `platform()` der idiomatische Weg — Spring-Boot-Projekte bringen das Plugin aber implizit mit.

---

# Ansätze nicht mischen

### Spring-Plugin (Rang 6)

```kotlin
plugins { id("io.spring.dependency-management") version "1.1.7" }
dependencyManagement {
    imports { mavenBom("org.springframework.boot:spring-boot-dependencies:4.0.6") }
    dependencies { dependency("com.google.guava:guava:33.4.0-jre") }
}
```

### Native Gradle (Rang 5 / 7)

```kotlin
dependencies {
    implementation(platform("org.springframework.boot:spring-boot-dependencies:4.0.6"))
    constraints { implementation("com.google.guava:guava:33.4.0-jre") }
}
```

> ⚠️ **Beide Ansätze im selben Build = schwer vorhersagbare Resolution.**
> Das Spring-Plugin (Rang 6) übersteuert `platform()` (Rang 5) stillschweigend.
>
> ⚠️ **Wer Versionen überschreibt, übernimmt die Kompatibilitäts-Verantwortung.**
> Die BOM garantiert Zusammenspiel ihrer Versionen — ein Override bricht diese Garantie.
> Beim nächsten BOM-Upgrade prüfen, ob die gepinnten Versionen noch kompatibel sind.

---

# Empfehlung 2026 — Spring BOM einbinden

<style>
pre { font-size: 0.82em; line-height: 1.35; }
blockquote { font-size: 0.85em; }
</style>

### Variante A — Native BOM (Default: schneller, idiomatisch)

```kotlin
import org.springframework.boot.gradle.plugin.SpringBootPlugin

plugins { id("org.springframework.boot") version "4.0.6" apply false }

dependencies {
    implementation(platform(SpringBootPlugin.BOM_COORDINATES))   // 4.0.6 BOM
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
}
```

### Variante B — Plugin (nur wenn Property-Overrides gebraucht werden)

```kotlin
plugins {
    id("org.springframework.boot") version "4.0.6" apply false
    id("io.spring.dependency-management") version "1.1.7"
}
ext["jackson.version"] = "2.18.3"   // Maven-Property-Mapping → BOM-Override
```

> **`apply false` + `BOM_COORDINATES`:** Plugin-Classpath ohne Apply (kein `bootJar`/`bootRun`) — Plugin-Version und BOM-Version bleiben typsicher gekoppelt, kein String-Drift bei Upgrades.
>
> **Default ist A.** B nur bei `ext`-Property-Overrides — siehe nächste Slide.

---

# Extra Properties (`ext["..."]`)

`ext` ist eine `Map<String, Any?>` an jedem Gradle-Projekt — Spring Boot nutzt sie als **BOM-Override-Mechanismus**.

```kotlin
// Root build.gradle.kts
ext["jackson.version"] = "2.18.3"   // Überschreibt die Version aus der Spring-BOM
```

Spring Boot BOM definiert Versionen über Maven-Properties (`<jackson-bom.version>`). Das Dependency-Management-Plugin mappt `ext["jackson.version"]` auf diese Property → BOM verwendet den Override.

> Bekannte Property-Namen: `jackson.version`, `hibernate.version`, `slf4j.version`, `kotlin.version`, …
>
> Vollständige Liste: [Spring Boot — Dependency Versions](https://docs.spring.io/spring-boot/appendix/dependency-versions/properties.html)

---

# Extra Properties: Alternativen

| Ansatz                                 | Typsicher        | IDE-Support | BOM-Override        |
| -------------------------------------- | ---------------- | ----------- | ------------------- |
| `ext["jackson.version"]`               | ❌ `Any?` + Cast | ❌          | ✅ Spring-BOM       |
| `platform()` + `constraints {}`        | ✅               | ✅          | ✅ jede BOM (nativ) |
| Version Catalog (`libs.versions.toml`) | ✅               | ✅          | ❌ BOM gewinnt      |
| `buildSrc` / Convention Plugin         | ✅               | ✅          | ❌ manuell          |
| `resolutionStrategy.force(...)`        | —                | —           | ✅ jede BOM         |

<br>

- **Native Gradle BOM-Override:** `constraints { }` oder `enforcedPlatform()`
- **Spring-BOM-Override:** `ext["..."]` oder `force()`
- **Alles andere:** Version Catalog
- **Nicht mischen:** Catalog + `ext["..."]` = doppelte Wahrheitsquelle

---
clicks: false
title: Resolution Simulator
---

<ResolutionSimulator />

---
layout: section
---

# 4. Version Catalogs

TOML, Zusammenspiel & Fallstricke

---

# Version Catalogs (`libs.versions.toml`)

```toml
[versions]
spring-boot = "4.0.6"
jackson = "2.17.2"

[libraries]
spring-boot-starter-web = { module = "org.springframework.boot:spring-boot-starter-web" }
jackson-databind = { module = "com.fasterxml.jackson.core:jackson-databind", version.ref = "jackson" }

[plugins]
spring-boot = { id = "org.springframework.boot", version.ref = "spring-boot" }
```

```kotlin
dependencies {
    implementation(libs.spring.boot.starter.web)
    implementation(libs.jackson.databind)
}
```

---

# Catalog, BOM, Lock-File, Verification

| Mechanismus               | Funktion                                                | Analogie                   |
| ------------------------- | ------------------------------------------------------- | -------------------------- |
| **Version Catalog**       | _Deklaration_: Welche Deps mit welchen Koordinaten?     | Einkaufsliste              |
| **BOM (Spring)**          | _Resolution-Constraint_: Welche Version wird aufgelöst? | Preisliste des Lieferanten |
| **Lock-File**             | _Fixierung_: Welche Versionen konkret aufgelöst?        | Kassenbon                  |
| **Verification Metadata** | _Integritätsprüfung_: Artefakt unverändert?             | Siegel auf der Verpackung  |

<br>

- **Catalog** → definiert _was_ du deklarierst
- **Lock-File** → fixiert _was tatsächlich aufgelöst wird_ (inkl. transitiver Deps)
- Catalog ersetzt Lock-File **nicht** — Catalog kennt keine transitiven Deps

---

# Catalog-Fallstricke

### Version im Catalog vs. Version aus der BOM

```toml
[versions]
jackson = "2.18.3"   # Catalog sagt 2.18.3
```

```kotlin
implementation(libs.jackson.databind)  // Aufgelöst: 2.17.2 (BOM gewinnt!)
```

**Pragmatische Lösung:** Für BOM-gemanagte Deps keine Version im Catalog angeben.

### Catalog ist kein Constraint-Mechanismus

Für echte Version-Enforcement:

```kotlin
configurations.all {
    resolutionStrategy {
        force(libs.jackson.databind.get().toString())
    }
}
```

### Doppelte Wahrheitsquellen vermeiden

Catalog + `ext["jackson.version"]` = Wartungs-Albtraum. Entscheide dich für eine Quelle.

---
layout: section
---

# 5. Praxis-Workflows

Neue Library & Library-Update

---

# Workflow: Neue Library (Spring-gemanagt)

```kotlin
// Keine Version nötig — BOM liefert sie
implementation("org.springframework.boot:spring-boot-starter-data-jpa")
```

```bash
./gradlew dependencies --write-locks
git diff gradle.lockfile   # Review
git add gradle.lockfile && git commit -m "Add spring-boot-starter-data-jpa"
```

<br>

### Nicht-Spring-gemanagt

```kotlin
implementation("com.google.cloud:google-cloud-storage:2.46.0")
```

Gleicher Workflow — Version explizit, aber _transitive_ Deps werden im Lock-File erfasst.

---

# Workflow: Library-Update

### Spring-gemanagt (BOM-Version anheben)

```kotlin
id("org.springframework.boot") version "4.0.6"  // war 4.0.0
```

```bash
./gradlew dependencies --write-locks
git diff gradle.lockfile   # Kritisch: Jede transitive Änderung prüfen
```

### Override einer Spring-gemanagten Version

```kotlin
// Variante 1: BOM-Property überschreiben
ext["jackson.version"] = "2.18.3"

// Variante 2: Force
configurations.all {
    resolutionStrategy { force("com.fasterxml.jackson.core:jackson-databind:2.18.3") }
}
```

> ⚠️ Eingriff in die BOM-Kohärenz — ab hier bist du selbst für Kompatibilität verantwortlich.
>
> Denk daran, die Version beim näschten Spring update zu prüfen und ggf. den Override wieder zu entfernen.

---
layout: section
---

# 6. Snapshot-Versionen

Sonderfall, Caching & Produktions-Gate

---

# Snapshot-Versionen: Der Sonderfall

`1.3.0-SNAPSHOT` = **mutable** Version — jeder Build kann ein anderes Artefakt liefern.

Gradle behandelt Snapshots als _dynamische Versionen_ (wie `1.+`):

| Aspekt                | Release                  | Snapshot                                  |
| --------------------- | ------------------------ | ----------------------------------------- |
| Inhalt                | Immutable                | Mutable (neuer Timestamp = neuer Inhalt)  |
| Lock-File             | Fixiert Version + Inhalt | Fixiert nur den Namen, nicht den Inhalt   |
| Verification Metadata | Funktioniert             | Praktisch inkompatibel (Hash ändert sich) |
| Dependency-Scanner    | Verlässlich              | Falsche Sicherheit                        |
| "Highest Wins"        | Deterministisch          | Non-deterministisch                       |

> ⚠️ Snapshots unterwandern systematisch Lock-Files, Verification Metadata und Scanner-Verlässlichkeit.

---

# Snapshots: Repository & Caching

### Repository-Trennung

```kotlin
repositories {
    mavenCentral()  // Nur Releases
    maven("https://repo.example.com/snapshots") {
        mavenContent { snapshotsOnly() }  // Dependency-Confusion-Schutz
    }
}
```

### Caching steuern

```kotlin
configurations.all {
    resolutionStrategy {
        cacheChangingModulesFor(0, TimeUnit.SECONDS)  // CI: immer frisch
    }
}
```

`--refresh-dependencies` umgeht den Cache komplett. Default-Caching: 24 Stunden.

---

# Snapshots in Produktion verhindern

```kotlin
tasks.register("noSnapshots") {
    doLast {
        configurations.compileClasspath.get().resolvedConfiguration
            .resolvedArtifacts.forEach {
                if (it.moduleVersion.id.version.endsWith("-SNAPSHOT"))
                    throw GradleException("Snapshot: ${it.moduleVersion.id}")
            }
    }
}
```

Als CI-Gate einbinden:

```bash
./gradlew noSnapshots  # Schlägt fehl wenn Snapshot-Deps vorhanden
```

> Snapshots nur in Feature-Branches / Integrations-Builds — nie Richtung Produktion.

---
layout: section
---

# 7. Supply-Chain-Schutz

Scanning, Verification, Cooldown & Angriffe

---

# Dependency Scanning

Lock-File als **Single Source of Truth** für Scanner (Snyk, Trivy, OWASP, Dependabot):

- Scanner liest `gradle.lockfile` → kennt jede transitive Abhängigkeit mit exakter Version
- CVE-Abgleich gegen diese Versionsliste
- Kein Gradle-Build nötig im CI-Scanner-Step (schneller, weniger fehleranfällig)

<br>

**Voraussetzung:** Lock-Datei ist aktuell und committet.

Veraltete Lock-Dateien → Scanner meldet keine neuen transitiven Deps → **blinde Flecken**.

---

# CVE-Pinning mit Audit-Trail (`because`)

Scanner meldet CVE → Version pinnen, **Begründung gleich mit-committen**.

```kotlin
dependencies {
    constraints {
        implementation("org.apache.logging.log4j:log4j-core:2.17.1") {
            because("CVE-2021-44228 (Log4Shell) — RCE via JNDI-Lookup")
        }
    }
}
```

### Plugin-Classpath (`buildscript`)

```kotlin
buildscript {
    dependencies {
        classpath("org.apache.logging.log4j:log4j-core:2.17.1") {
            because("CVE-2021-44228 (Log4Shell) — Plugin zog verwundbare Version transitiv")
        }
    }
}
```

- `because`-String erscheint in `./gradlew dependencyInsight` → Audit-Trail
- Beim nächsten Upgrade: _Warum_ wurde gepinnt? Antwort steht im Build-File
- Konvention: CVE-ID + 1-Zeilen-Beschreibung + Datum

---

# Supply-Chain-Schutz: Verification Metadata

```bash
./gradlew --write-verification-metadata sha256,pgp
```

Erzeugt `gradle/verification-metadata.xml`:

```xml
<component group="com.fasterxml.jackson.core" name="jackson-databind" version="2.17.2">
    <artifact name="jackson-databind-2.17.2.jar">
        <sha256 value="a1b2c3d4..." origin="Generated by Gradle"/>
        <pgp value="ABC12345"/>
    </artifact>
</component>
```

- **Checksum-Match:** Artefakt muss gespeicherten Hash haben
- **PGP-Signatur:** Artefakt muss von bekanntem Key signiert sein
- **Re-Upload-Schutz:** Gleiche Version, anderer Inhalt → Build schlägt fehl

---

# Verification Metadata: Fallstrick bei der Generierung

`--write-verification-metadata` erfasst nur Konfigurationen, die beim jeweiligen Task aufgelöst werden.

```bash
# ❌ Unvollständig — erfasst nicht alle Konfigurationen
./gradlew --write-verification-metadata sha256 classpath

# ✅ Alle CI-relevanten Tasks ausführen, Caching deaktivieren
./gradlew --write-verification-metadata sha256 --no-build-cache \
    build check --dry-run
```

**Achtung:** `--dry-run` reicht nicht immer! Manche Plugins (z.B. Checkstyle) erzeugen _detached configurations_, die erst bei tatsächlicher Task-Ausführung aufgelöst werden. Solche Tasks müssen echt laufen — nicht nur `--dry-run`.

**Regel:** Beim Generieren _alle Tasks ausführen, die auch in der CI laufen_ — sonst fehlen Artefakte für Konfigurationen, die nur bestimmte Tasks auflösen.

**Typisches Symptom:** `Dependency verification failed for configuration 'classpath'`

---

# Escape Hatch 1: Frisches `GRADLE_USER_HOME`

`--write-verification-metadata` erfasst nur Artefakte, die **während der Invocation tatsächlich heruntergeladen** werden — gecachte Files in `~/.gradle/caches` werden übersprungen.

```bash
# Nuclear Option: Lädt wirklich alles neu
export GRADLE_USER_HOME=$(mktemp -d)
./gradlew --write-verification-metadata sha256,pgp build check
./gradlew --stop                # Daemon herunterfahren
rm -rf "$GRADLE_USER_HOME"      # ⚠️ Cleanup nicht vergessen!
```

**Was wird neu gezogen:** Wrapper-Distribution (~150 MB), alle Plugin-Marker-POMs, Toolchain-JDKs (falls auto-download aktiv), PGP-Keyring.

> ⚠️ **Wann einsetzen:** Wenn Gradles offizieller Weg (alle CI-Tasks ausführen + `--refresh-dependencies`) nicht reicht. Reproducible-Builds-Communities (F-Droid, Reproducible Central) nutzen diese Technik standardmäßig.
>
> ⚠️ **`--refresh-dependencies` reicht alleine nicht** — es forciert nur Re-Check changing modules, löst aber Konfigurationen, die du nicht aufrufst, nicht neu auf.

---

# Escape Hatch 2: `.pom` / `.module` trusten

Wenn detached configurations (Checkstyle, JaCoCo, ErrorProne) auf manchen Systemen Artefakte ziehen, die woanders nicht reproduzierbar sind — letzter Ausweg:

```xml
<!-- gradle/verification-metadata.xml -->
<verification-metadata>
    <configuration>
        <trusted-artifacts>
            <trust file=".*\.pom" regex="true"
                   reason="Mirror-Variationen / dynamisch generierte POMs"/>
            <trust file=".*\.module" regex="true"
                   reason="Gradle Module Metadata, oft non-reproducible"/>
        </trusted-artifacts>
    </configuration>
</verification-metadata>
```

**Warum vertretbar:** JAR-Inhalte (der ausführbare Code) werden weiterhin per SHA-256 verifiziert — nur die volatilen Metadaten-Files werden großzügiger getrustet.

**Warum POMs/Module-Files variieren:** Mirror-Whitespace/-Encoding, dynamisch generierte POMs (JitPack, Snapshot-Repos), Plugin-Marker-Artefakte aus dem Gradle Plugin Portal.

> ⚠️ **Nicht der Default!** Wenn möglich, einzelne Artefakte mit `<trust group="..." name="..."/>` granular trusten statt Glob-Pattern.

---

# Supply-Chain-Schutz: Repository Filtering

```kotlin
repositories {
    mavenCentral() {
        content {
            includeGroupByRegex("org\\.springframework.*")
            includeGroupByRegex("com\\.fasterxml\\.jackson.*")
        }
    }
    maven("https://internal.repo.example.com/maven") {
        content { includeGroup("com.example.internal") }
    }
}
```

Verhindert **Dependency Confusion**: interne Paketnamen werden nicht von Maven Central aufgelöst.

---

# Minimum Release Age (Cooldown)

<style>
table { font-size: 0.78em; }
th, td { padding: 0.25em 0.5em !important; }
blockquote { font-size: 0.85em; }
</style>

Kompromittierte Pakete werden typischerweise innerhalb von Stunden bis Tagen entdeckt — ein **Cooldown von 7 Tagen** filtert die Mehrheit opportunistischer Supply-Chain-Angriffe.

| Tool            | Einheit  | Config-Key                 | 7 Tage =              | Exclude-Liste               |
| --------------- | -------- | -------------------------- | --------------------- | --------------------------- |
| **Gradle**      | —        | _(nicht nativ)_            | Renovate / Dependabot | —                           |
| **npm**         | Tage     | `min-release-age`          | `7`                   | —                           |
| **pnpm**        | Minuten  | `minimumReleaseAge`        | `10080`               | `minimumReleaseAgeExclude`  |
| **Bun**         | Sekunden | `minimumReleaseAge`        | `604800`              | `minimumReleaseAgeExcludes` |
| **Yarn** ≥ 4.10 | Minuten  | `npmMinimalAgeGate`        | `10080`               | `npmPreapprovedPackages`    |
| **uv** ¹        | Dauer    | `exclude-newer`            | `"7 days"`            | `exclude-newer-package`     |
| **Deno**        | CLI-Flag | `--minimum-dependency-age` | —                     | explizite Version setzen    |

> Cooldown ist kein Allheilmittel — gezielte Angriffe können ihn aussitzen. Eine Schicht in Defense-in-Depth, nicht die einzige.
>
> ¹ `exclude-newer` benötigt PEP 691 (JSON Metadata API). Nexus unterstützt nur PEP 503 (HTML) — siehe separate Slides.

---

# Cooldown: Gradle-Ökosystem

Gradle hat **kein natives Minimum Release Age**. Stattdessen:

### Renovate / Dependabot

```json
// renovate.json
{ "minimumReleaseAge": "7 days" }
```

```yaml
# dependabot.yml
cooldown:
  default-days: 7
```

### Ergänzende Maßnahmen

- **Verification Metadata** (SHA-256 + PGP) schützt gegen nachträgliche Manipulation
- **Lock-Files** fixieren aufgelöste Versionen
- **Repository Filtering** verhindert Dependency Confusion
- Renovate/Dependabot-Cooldown **synchron** mit Paketmanager-Cooldown konfigurieren, sonst entstehen PRs für nicht-installierbare Versionen

---

# Build-Time Code Execution

Die JVM-Welt hat keine Lifecycle-Scripts — aber Fremdcode wird dennoch ausgeführt:

- **Code-Generatoren** (OpenAPI Generator, Protobuf, JOOQ): voller Dateisystem-/Netzwerkzugriff
- **Test-Frameworks** (JUnit, Testcontainers): Code aus Test-Dependencies
- **Security-Scanner/Linter** (SpotBugs, Trivy): Zugriff auf Build-Secrets
- **Gradle-Plugins**: Code bei Build-_Konfiguration_, nicht erst beim Task-Run
- **Annotation Processors** (Lombok, MapStruct): Compile-Zeit-Ausführung

---

# Fallbeispiel: Trivy → LiteLLM Supply-Chain-Angriff (März 2026)

Aqua Security's Trivy — 32.000+ GitHub Stars, 100M+ Docker-Downloads — kompromittiert.

- Angreifer (TeamPCP) übernahmen 76 von 77 Version-Tags der `trivy-action` GitHub Action
- Manipulierte Binary lief **vor** der Scan-Logik → CI/CD-Secrets exfiltriert

**Kettenreaktion — LiteLLM** (~95 Mio. Downloads/Monat):

- LiteLLM nutzte Trivy in der CI/CD-Pipeline → PyPI-Publishing-Tokens gestohlen
- Zwei kompromittierte Releases (v1.82.7, v1.82.8) mit dreistufigem Payload:
  Credential-Harvesting → Kubernetes Lateral Movement → persistente Backdoor
- Gestohlene Credentials ermöglichten Zugriff auf nachgelagerte Systeme (u.a. **Mercor**, KI-Daten-Zulieferer für Meta, OpenAI, Anthropic)
- Meta pausierte alle Mercor-Projekte, proprietäre KI-Trainingsdaten potenziell exponiert

> Die Ironie: Ein Security-Scanner wurde zum Angriffsvektor — weil er mit denselben Privilegien lief wie der Build.

---
clicks: false
---

# Axios Supply-Chain-Angriff

<AxiosAttack />

---

# Build-Sandbox: Empfehlungen

- CI/CD-Runner: **keinen Zugriff auf Produktions-Secrets**, die sie nicht benötigen
- Secrets nur für den jeweiligen Deployment-Step injizieren
- **Gradle-Builds in isolierten Containern** (ephemere Runner, kein persistenter Zustand)
- **Network-Policies**: nur Artefakt-Repository und nötige Endpunkte
- **GitHub Actions auf Commit-SHA pinnen** statt mutable Tags
- **Secrets nach Verdachtsfällen sofort rotieren**

---
layout: center
---

# Bonusmaterial

---
clicks: false
---

# Java-Versionen mit Gradle Verwalten

<JavaVersionsMatrix />

---

# Cooldown: Tool-Beispiele

<CooldownTabs />

---

# Cooldown: Nexus & Python (PEP 503 vs. 691)

<style>
table { font-size: 0.78em; }
th, td { padding: 0.25em 0.5em !important; }
blockquote { font-size: 0.85em; }
p, li { font-size: 0.9em; }
</style>

|                     | **PEP 503** (Simple HTML)       | **PEP 691** (JSON Metadata)       |
| ------------------- | ------------------------------- | --------------------------------- |
| **Format**          | HTML-Seite mit Download-Links   | JSON mit strukturierten Metadaten |
| **Upload-Datum**    | ❌ nicht enthalten              | ✅ `upload-time` pro Release      |
| **Provenance**      | ❌ nicht enthalten              | ✅ Attestations (PEP 740)         |
| **Unterstützt von** | PyPI, Nexus, Artifactory, devpi | PyPI _(nur PyPI.org)_             |

### Konsequenz für Nexus

Nexus (und andere Mirrors/Proxies) implementiert **nur PEP 503** — die HTML-Variante ohne Metadaten.

- **`--exclude-newer` funktioniert nicht**: uv kann das Upload-Datum nicht ermitteln → Cooldown greift nicht
- **Provenance nicht verfügbar**: Keine Attestations über Herkunft des Pakets
- **Betrifft alle Nexus-PyPI-Repositories**: Hosted, Proxy und Group

> ⚠️ In Unternehmensumgebungen mit Nexus als PyPI-Proxy ist Cooldown für Python-Pakete **wirkungslos**.
> Alternativer Schutz: Renovate/Dependabot-Cooldown auf Repository-Ebene + Hash-Pinning in `uv.lock`.

---
clicks: false
---

# Ökosystem-Vergleich

<EcosystemTabs />

---

# Feature-Vergleich

<CompareTable />

---

# Schutzmatrix

<style>
table { font-size: 0.75em; }
th, td { padding: 0.25em 0.5em !important; }
</style>

| Mechanismus                      | Schützt gegen                      | Datei / Ort                        |
| -------------------------------- | ---------------------------------- | ---------------------------------- |
| **Version Catalog**              | Wartbarkeit, IDE-Support           | `libs.versions.toml`               |
| **Lock-File**                    | Unbeabsichtigte Versionsänderungen | `gradle.lockfile`                  |
| **Verification Metadata**        | Artefakt-Manipulation              | `verification-metadata.xml`        |
| **Trusted Artifacts (Escape)**   | Detached-Config-Flakiness          | `verification-metadata.xml`        |
| **Repository Filtering**         | Dependency Confusion               | `build.gradle.kts`                 |
| **BOM (Spring)**                 | Inkonsistente transitive Versionen | BOM POM                            |
| **Minimum Release Age**          | Frische kompromittierte Releases   | npm/pnpm/Bun/Yarn/uv/Deno          |
| **Renovate/Dependabot Cooldown** | Frische Releases (Gradle)          | `renovate.json` / `dependabot.yml` |
| **Dependency Scanner**           | Bekannte CVEs                      | CI-Pipeline                        |
| **Build-Sandbox**                | Code Execution durch Deps/Plugins  | Container, Network-Policies        |

---
clicks: false
title: Ökosysteme
---

<EcosystemInfographic />

---
clicks: false
title: Alle Gradle Info-Grafiken
---

<GradleInfographic />

---

# Weiterführende Links

<style>
ul { font-size: 0.9em; }
</style>

- [Gradle: Dependency Locking](https://docs.gradle.org/current/userguide/dependency_locking.html)
- [Gradle: Version Catalogs](https://docs.gradle.org/current/userguide/version_catalogs.html)
- [Gradle: Dependency Verification](https://docs.gradle.org/current/userguide/dependency_verification.html)
- [Gradle: Bootstrapping Dependency Verification](https://docs.gradle.org/current/userguide/dependency_verification.html#sec:bootstrapping-verification)
- [Gradle: Trusting Some Particular Artifacts](https://docs.gradle.org/current/userguide/dependency_verification.html#sec:trusting-some-artifacts)
- [Renovate: minimumReleaseAge](https://docs.renovatebot.com/configuration-options/#minimumreleaseage)
- [Package Managers Need to Cool Down](https://nesbitt.io/2026/03/04/package-managers-need-to-cool-down.html) — Andrew Nesbitt
- [npm: min-release-age](https://docs.npmjs.com/cli/v11/using-npm/config#min-release-age)
- [pnpm: minimumReleaseAge](https://pnpm.io/settings#minimumreleaseage)
- [Bun: minimumReleaseAge](https://bun.com/docs/pm/cli/install#minimum-release-age)
- [Supply-Chain Guardrails (Coinspect)](https://www.coinspect.com/blog/supply-chain-guardrails/)
- [SLSA Framework](https://slsa.dev/)
- [Spring Boot: Dependency Management Plugin](https://docs.spring.io/dependency-management-plugin/docs/current/reference/html/)
- [Go: How Go Mitigates Supply Chain Attacks](https://go.dev/blog/supply-chain)
- [pnpm: Mitigating Supply Chain Attacks](https://pnpm.io/supply-chain-security)
- [uv: Locking and Syncing](https://docs.astral.sh/uv/concepts/projects/sync/)
- [PEP 503 — Simple Repository API](https://peps.python.org/pep-0503/)
- [PEP 691 — JSON-based Simple API for Python Package Indexes](https://peps.python.org/pep-0691/)
- [PEP 740 — Index Support for Digital Attestations](https://peps.python.org/pep-0740/)
- [Trivy Supply-Chain-Angriff (Aqua Security, März 2026)](https://www.aquasec.com/blog/trivy-supply-chain-attack-what-you-need-to-know/)
- [LiteLLM Security Update (März 2026)](https://docs.litellm.ai/blog/security-update-march-2026)
- [Supply-Chain-Attacke auf LiteLLM (heise online)](https://www.heise.de/-11223618)
- [Meta Pauses Work With Mercor After Data Breach (WIRED)](https://www.wired.com/story/meta-pauses-work-with-mercor-after-data-breach-puts-ai-industry-secrets-at-risk/)

---
layout: end
---

# Danke
