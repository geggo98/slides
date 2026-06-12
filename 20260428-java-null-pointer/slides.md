---
theme: default
title: "Java Null-Sicherheit 2026"
info: |
  Pragmatischer Stack für Spring Boot 4 — JSpecify, NullAway, Lombok, JPA.
  Plus: Was kommt nativ? Wie machen es Kotlin & andere JVM-Sprachen?
monaco: true
mdc: true
lang: de
transition: slide-left
colorSchema: auto
fonts:
  sans: Inter
  mono: 0xProto
hideInToc: true
---

# Java Null-Sicherheit 2026

Pragmatischer Stack für Spring Boot 4 — und wo es hingeht

<div class="mt-8 text-sm opacity-60">

Zielgruppe: Java-/Spring-Boot-4-Entwicklerinnen und -Entwickler, die NPEs satt haben

</div>

<!--
- Stand: April 2026.
- Wir reden Klartext: Trade-offs werden benannt, nicht weichgespült.
- Der Vortrag hat 4 Teile: Pragmatischer 2026-Stack, Spring-Specifics, JVM-Sprachen-Vergleich, Bonus-Tabellen.
-->

---
layout: center
hideInToc: true
---

# Kurzfassung

<div class="text-left mt-8 max-w-3xl mx-auto space-y-4">

1. **`Optional<T>` ist Rückgabetyp. Punkt.** Kein Feld, kein Parameter, kein Generic-Element.
2. **JSpecify 1.0 + `@NullMarked` + NullAway** ist der pragmatische 2026-Standard. Spring Boot 4 (Nov 2025) liefert es ab Werk.
3. **Native `String!`/`String?`** bleibt mehrere LTS-Zyklen entfernt — JEP 8303099 ist Draft, realistisch frühestens **JDK 33** stable (das nächste LTS nach 29, 2029).
4. **Records ersetzen `@Data`/`@Value`**, nicht `@Builder`/`@Slf4j`. Lombok-Migration ist partiell, nicht binär.

</div>

<!--
- Wer JSR-305 oder org.springframework.lang.* heute neu einführt, verliert Zeit.
- Wer auf JEP 8303099 wartet, wartet falsch.
-->

---
hideInToc: true
---

# Inhalt

<Toc mode="all" minDepth="1" maxDepth="1" columns="2" listClass="!list-none !pl-0" />

---
layout: section
---

# 1. JSpecify — Was und Warum

Annotation-Konsens 2026 und seine vier Annotationen

---
hideInToc: true
---

# Annotation-Chaos: Wie wir hierher gekommen sind

<div class="grid grid-cols-2 gap-8">
<div>

### Das Problem

Über 15 Jahre haben Hersteller eigene Null-Annotationen gebaut — alle mit subtil verschiedener Semantik:

- **JSR-305** (2006) nie standardisiert, 2012 abgebrochen
- **Spring**, **JetBrains**, **Eclipse**, **Checker FW**, **Lombok** — jede Lösung im eigenen Silo
- Kein Tool versteht alle Varianten gleich
- Generics-Annotationen (`List<@Nullable T>`) inkompatibel oder fehlend

</div>
<div>

### Der Konsolidierungspunkt

**JSpecify 1.0** (17. Juli 2024) — getragen von **Google, Oracle, JetBrains, Broadcom/VMware (Spring), Sonar, Uber**:

- Vier Annotationen, klare Type-Use-Semantik
- Kein Checker — nur die Spezifikation
- Spring Framework 7 / Boot 4: Core vollständig, Portfolio rolling
- Kotlin 2.x liest JSpecify nativ

</div>
</div>

<!--
- 2024 ist der erste echte Konsens. Davor: jeder gegen jeden.
- Kein Tool unter den Hauptanbietern, das JSpecify nicht versteht.
-->

---
hideInToc: true
---

# Quellen-Übersicht: Welche Annotationen sind aktiv?

<AnnotationCompatTable variant="annotations" />

<div class="mt-4 text-sm opacity-70">

OpenRewrite-Recipes (`org.openrewrite.java.jspecify.MigrateToJSpecify`) automatisieren ~80 % der Migration.

</div>

<!--
- "Bridge" = nur sinnvoll für die Sprache, mit der das Tool kommt (z.B. JetBrains-Annotationen für Kotlin-Compiler-Hints).
- IntelliJ 2025.3 bevorzugt JSpecify (Quick-Fixes); eine formale Deprecation der JetBrains-Annotationen ist bisher nur ein offener Request.
-->

---
hideInToc: true
---

# JSpecify in vier Annotationen

```java
import org.jspecify.annotations.*;

@NullMarked                       // Default für das ganze Package
package com.example.service;
```

| Annotation      | Wirkung                                                              |
| --------------- | -------------------------------------------------------------------- |
| `@NullMarked`   | Scope: Default = **non-null** in Modul / Package / Class             |
| `@Nullable`     | Type-Use: dieser Type Use **darf** `null` sein                       |
| `@NonNull`      | Type-Use: dieser Type Use schließt `null` **aus** (selten gebraucht) |
| `@NullUnmarked` | Lokale Aufhebung von `@NullMarked` (z. B. für Test-Klassen)          |

<div class="mt-4 text-sm opacity-70">

**Idiomatik 2026:** `@NullMarked` aufs Package. Innerhalb explizit nur das Nullable markieren.

</div>

<!--
- "Type Use" heißt: die Annotation gehört zum Typ, nicht zum Element. Das ist der Schlüssel für Generics.
- @NonNull braucht man kaum, weil @NullMarked das schon impliziert.
-->

---
hideInToc: true
---

# Type-Use ist die Pointe

```java {monaco}
// Liste, deren *Elemente* null sein dürfen
List<@Nullable String> tags;

// Das ganze List-Feld kann null sein, Elemente non-null
@Nullable List<String> maybeNoTagsAtAll;

// Beides erlaubt
@Nullable List<@Nullable String> mostPermissive;

// JSR-305 konnte das nicht ausdrücken — Hauptgrund für 6 Jahre Spec-Arbeit
```

<div class="mt-4 text-sm opacity-70">

`Map<@NonNull K, @Nullable V>` — Wert darf null sein, Key nicht. **Diese Präzision** war die JSR-305-Lücke.

</div>

<!--
- Wer JSpecify nutzt, sollte hier 2-3 Minuten verbringen — das ist der Mehrwert gegenüber JSR-305.
- Demo-Effekt: NullAway-Fehlermeldungen zeigen exakt diese Position.
-->

---
hideInToc: true
---

# `@NullMarked` aufs Package — Opt-out statt Opt-in

````md magic-move {lines: true}
```java
// src/main/java/com/example/service/OrderService.java
public class OrderService {
    public Order place(@Nonnull Customer c, @Nullable PromoCode p) { ... }
    public Optional<Order> findById(@Nonnull String id) { ... }
    public List<@Nonnull Order> all() { ... }
}
// Jede Methode wiederholt @Nonnull. Vergessen = stille Lücke.
```

```java
// src/main/java/com/example/service/OrderService.java
public class OrderService {
    public Order place(Customer c, @Nullable PromoCode p) { ... }
    public Optional<Order> findById(String id) { ... }
    public List<Order> all() { ... }
}
// Default ist non-null. Nur das Nullable wird markiert.
```
````

<div v-click class="mt-4">

```java
// src/main/java/com/example/service/package-info.java
@NullMarked
package com.example.service;
import org.jspecify.annotations.NullMarked;
```

</div>

<!--
- Magic-move zeigt: dieselbe API, weniger Lärm, vergessen unmöglich.
-->

---
hideInToc: true
---

# `@NullMarked` kaskadiert _nicht_ in Sub-Packages

```java
// com/example/service/package-info.java     ← markiert
@NullMarked package com.example.service;

// com/example/service/repo/CustomerRepo.java ← NICHT markiert!
class CustomerRepo { Customer findById(String id) { ... } }
```

<div v-click class="mt-3 text-sm">

JLS-Sicht: `com.foo` und `com.foo.bar` sind **zwei unabhängige Packages** — keine Hierarchie. Gilt für Sichtbarkeit, `sealed`-Permits, **und Annotationen**.

JSpecify-Javadoc: _„This annotation has no effect on 'subpackages'.“_

**Konsequenz:** Jedes Java-Package braucht sein **eigenes** `package-info.java` mit `@NullMarked`.

</div>

<!--
- DER häufigste Bug beim JSpecify-Onboarding bestehender Codebases.
- "Sub-Package" ist ein menschliches Konzept; die JLS kennt nur flache Packages.
- IntelliJ macht's bei Refactorings einfach — "New > package-info.java" auf jedem Package-Knoten.
-->

---
hideInToc: true
---

# Geltungsbereiche: Modul, Package, lokal

<div class="grid grid-cols-2 gap-8">
<div>

| Scope               | Wirkung                                    |
| ------------------- | ------------------------------------------ |
| `module-info.java`  | **transitiv** auf alle Packages des Moduls |
| `package-info.java` | nur auf genau dieses Package               |
| Klasse / Methode    | lexikalisch umschlossener Code             |

`@NullUnmarked` kann jeden Scope **lokal** aufheben.
`@NullMarked` schaltet ihn innerhalb wieder ein.

```java
@NullMarked
module com.example.shop { /* requires … */ }
```

</div>
<div>

### ⚠️ JPMS-Realität bei Spring Boot

`module-info.java` setzt ein **aktiv genutztes JPMS-Modulsystem** voraus. Der typische Spring-Boot-Classpath nutzt **kein** JPMS — dann fällt diese Option komplett weg.

**Empfehlung für den Spring-Boot-Stack:**
`package-info.java` pro Package. Tool-agnostisch — IntelliJ, NullAway, Checker Framework und Eclipse JDT verstehen es alle gleich.

<div v-click class="mt-3 text-sm opacity-80">

**Brownfield-Brücke:** NullAway kennt

```shell
 -XepOpt:NullAway:AnnotatedPackages=com.example
```

(markiert Packages transitiv). Aber: **kein JSpecify-Standard**. IntelliJ sieht es nicht — inkonsistente Warnungen je nach Tool. Nur als Übergang.

</div>

</div>
</div>

<!--
- JPMS-Migration eines Spring-Boot-Monorepos ist Wochen Arbeit für nichts — package-info ist hier richtig.
- AnnotatedPackages: praktisch, aber genau die Inkonsistenz, die man mit JSpecify gerade vermeiden wollte.
- Multi-Modul-Setups (Maven Reactor) sind NICHT JPMS — da hilft die Modul-Annotation auch nicht.
-->

---
hideInToc: true
---

# Stolperfalle: Generierter Code liegt außerhalb

Quellgeneratoren erzeugen Klassen, die **nicht automatisch** im gleichen `package-info.java`-Scope landen:

- **MapStruct** → `target/generated-sources/annotations/...Mapper`
- **JPA-Metamodel** (`*_.java`)
- **QueryDSL** (`Q*.java`)
- **Lombok-Delombok-Output**

<div v-click>

Ohne JPMS-Modul kann zudem eine `package-info` aus dem Test-Sourcepath die aus dem Main-Sourcepath verdecken — oder fehlen ganz.

</div>

<div v-click class="mt-4">

### Drei Optionen

1. Generator-Konfiguration prüfen: kann sie ein `@NullMarked`-`package-info` mit erzeugen?
2. Generated-Sources-Package per **eigenem** `package-info.java` mit `@NullUnmarked` ausnehmen — explizit ist besser als implizit.
3. NullAway: `-XepOpt:NullAway:UnannotatedSubPackages=...generated...` ergänzen.

</div>

<!--
- Lombok-Delombok ist die hinterhältigste Quelle — Annotationen werden teilweise propagiert, teilweise nicht.
- @NullUnmarked auf generierte Sources ist sicherer als sie zu ignorieren — Verstöße werden dann beim Konsumenten sichtbar.
- Spring Boot 4 erzeugt selbst keine generated-sources mit JSpecify-Markern; das ist Build-Plugin-Sache.
-->

---
hideInToc: true
---

# JSpecify ≠ Checker

<div class="grid grid-cols-2 gap-8">
<div>

JSpecify ist **nur** die Sprache:

- Das `org.jspecify:jspecify:1.0.0` JAR
- Die Spezifikation (was `@Nullable T` semantisch bedeutet)

**Wer prüft das?**

- **NullAway** — pragmatisch, schnell, CI-tauglich
- **Checker Framework** — formal sound, langsamer Compile
- **IntelliJ IDEA** — best-effort, aber sofortiges Feedback in der IDE
- **Eclipse JDT** — solide, Eclipse-spezifisch

</div>
<div>

### Konsequenz für die Praxis

```bash
# Build bricht bei Null-Verstoß
./gradlew build
> Task :compileJava FAILED
NullAway: dereferenced expression
  promo may be null
  at OrderService.java:42
```

Null-Sicherheit wird **Build-Property**, nicht Code-Review-Diskussion.

</div>
</div>

<!--
- Wichtig: NullAway läuft als ErrorProne-Plugin im Compile.
- Checker Framework ist 5–20× langsamer — nur einsetzen, wo Soundness formal nötig ist (Sicherheit, Krypto).
-->

---
layout: section
---

# 2. Optional idiomatisch

Rückgabetyp, kein Feld — Brian Goetz hatte Recht

---
layout: quote
hideInToc: true
---

# „Optional was added with a clear intent: it was meant as a return type for methods that need to communicate clearly that they may have no result.“

<div class="mt-4 text-sm opacity-70">— Brian Goetz, Java Language Architect, Stack Overflow 2014</div>

<!--
- Goetz hat das später 2018 nochmal explizit bestätigt.
- "Wert für Abwesenheit" — ein identitätsfreier Wrapper.
-->

---
hideInToc: true
---

# `Optional<T>` — Anti-Patterns konkret

````md magic-move {lines: true}
```java
// ❌ Optional als Feld: nicht serialisierbar, JPA-feindlich
class User {
    private Optional<String> email;
}

// ❌ Optional als Parameter: Aufrufer kann immer noch null übergeben
public void register(User u, Optional<String> referral) { ... }

// ❌ Optional in Collections: leere Liste ist die richtige Antwort
List<Optional<String>> tags;
Optional<List<Order>> orders;

// ❌ get() ohne Prüfung: NoSuchElementException statt NPE — nichts gewonnen
String e = findById(id).get();
```

```java
// ✅ Optional NUR als Rückgabetyp
class User {
    private @Nullable String email;
    public Optional<String> email() {
        return Optional.ofNullable(email);
    }
}

// ✅ Parameter-Overload statt Optional
public void register(User u) { register(u, null); }
public void register(User u, @Nullable String referral) { ... }

// ✅ List<@Nullable T> bzw. leere Liste
List<@Nullable String> tags;
List<Order> orders;   // leere Liste statt Optional.empty()

// ✅ Funktionale Komposition
findById(id)
    .map(User::email)
    .filter(Email::isVerified)
    .orElseThrow(() -> new UserNotFoundException(id));
```
````

<!--
- Brian Goetz hätte Optional am liebsten primitiv-only, ohne Box-Variante.
- Mit JEP 401 wird Optional eine value class — Heap-Overhead verschwindet.
-->

---
hideInToc: true
---

# Trade-offs `Optional<T>` — was gilt 2026

| Aspekt                          | Status                                                   |
| ------------------------------- | -------------------------------------------------------- |
| Compile-Time-Garantie           | ✅ Typsystem zwingt explizite Behandlung                 |
| Runtime-Overhead                | ⚠️ ~16–32 Byte Heap pro `Optional`, in Hot Paths messbar |
| Serialisierbar                  | ❌ `Serializable` nicht implementiert                    |
| JPA / Jackson als Feldtyp       | ❌ de facto nein                                         |
| Funktionale Komposition         | ✅ exzellent (`map`, `flatMap`, `filter`)                |
| Primitives (`OptionalInt` etc.) | ⚠️ umständlich                                           |
| **JEP 401 (Value Classes)**     | 🔮 löst Heap-Overhead — Preview frühestens JDK 28        |

<div class="mt-4 text-sm opacity-70">

**Komplementär zu JSpecify:** `Optional<T>` als Rückgabetyp, `@Nullable T` als Parameter / Feld.

</div>

<!--
- "16-32 Byte" ist die Größenordnung im Heap mit Object-Header.
- Mit Skalarisierung im JIT ist der Overhead in Hot Paths schon heute oft weg.
-->

---
layout: section
---

# 3. Build & Lombok

NullAway in den Build, Lombok-Konfig richtig setzen

---
hideInToc: true
---

# Build-Setup — Gradle (Kotlin DSL)

<GradleBuildSetup />

<!--
- OnlyNullMarked=true ist der Schlüssel: schrittweise Einführung pro Package, ohne die ganze Codebase auf einmal zu fixen.
- JSpecifyMode=true aktiviert die Generics-Präzision.
- Editor scrollt — der Rest des Build-Setups liegt unter der Fold.
-->

---
hideInToc: true
---

# Build-Setup — Maven

<MavenBuildSetup />

<!--
- Das NullAway-Setup generiert Spring-Initializr nicht out of the box; muss manuell rein (≠ JSpecify-Dependency, die Initializr für Boot 4 setzt — siehe Bonus).
- Spring Boot 4 Parent-POM definiert die Versionen — nur die NullAway-Version selbst pinnen.
- Editor scrollt — der Rest des POM-Setups liegt unter der Fold.
-->

---
hideInToc: true
---

# Lombok — Mythen vs. Realität

<div class="grid grid-cols-2 gap-6">
<div>

### Mythen ❌

- „Lombok ist für NullAway unsichtbar“
- „Lombok wirft `IllegalArgument`, nicht NPE“
- „`@Builder` ist mit Null-Sicherheit unverträglich“
- „Lombok und Records schließen sich aus“

</div>
<div>

### Fakten ✅

- NullAway sieht generierten Code via `LombokHandler`
- **NPE ist Default seit Einführung 2013** (`@NonNull` v0.11.10)
- `@Builder` braucht ein Wrapper-Pattern (Pflichtfeld-Check im `build()`), das ist kein Typ-Problem
- **Records** ersetzen `@Data`/`@Value` — `@Slf4j`/`@SneakyThrows` bleiben

</div>
</div>

<div class="mt-4 text-sm opacity-70">

**Voraussetzung:** korrekte `lombok.config`. Ohne sie bricht die Tooling-Integration.
**Records vs. `@Builder`/named args** im Detail: <TalkXref slug="20260606-design-pattern">Design-Pattern-Talk</TalkXref>.

</div>

<!--
- Lombok kennt @NullMarked noch nicht (Issue #3861, accepted), aber funktioniert über addNullAnnotations=jspecify.
- Wer heute Greenfield startet: Records, nicht @Data.
-->

---
hideInToc: true
---

# `lombok.config` — leer vs. korrekt

````md magic-move {lines: true}
```properties
# lombok.config — Default
# (leer)
```

```properties
# lombok.config — JSpecify-aware
config.stopBubbling = true

lombok.addLombokGeneratedAnnotation = true
lombok.addNullAnnotations = jspecify

lombok.nonNull.exceptionType = JDK
# generiert java.util.Objects.requireNonNull(...) statt Lombok-eigener Klasse
```

```java
// Resultat im generierten Code
@NullMarked
@Data
public class User {
    private final String id;
    private final @Nullable String email;
}

// Lombok generiert (vereinfacht):
public User(String id, @Nullable String email) {
    this.id = Objects.requireNonNull(id, "id is marked non-null but is null");
    this.email = email;
}
public @Nullable String getEmail() { return email; }
```
````

<!--
- addLombokGeneratedAnnotation: NullAway respektiert generierten Code.
- exceptionType=JDK: keine Lombok-Runtime-Klasse mehr nötig.
- Für JPA-Entities lieber @Getter/@Setter statt @Data — equals/hashCode mit JPA-Reflection ist eine eigene Falle.
-->

---
layout: section
---

# 4. Spring Boot 4

Was 2025/2026 dazu kam und welche Fallen bleiben

---
hideInToc: true
---

# Spring Boot 4 — Was 2025/2026 dazu kam

<div class="grid grid-cols-2 gap-8">
<div>

### Spring Framework 7 (Nov 2025)

- **Alle** Public-APIs `@NullMarked`
- `org.springframework.lang.@Nullable` deprecated
- Reactor / Spring Data / Spring Security: rolling adoption
- Kotlin 2.x: Spring-APIs sind **nativ nullsicher** sichtbar

### Migration-Recipe (OpenRewrite)

```bash
mvn rewrite:run \
  -Drewrite.activeRecipes=\
    org.openrewrite.java.jspecify.MigrateToJSpecify
```

<div class="mt-2 text-xs opacity-70">Recipe-Mechanik im Detail: <TalkXref slug="20260522-open-rewrite">OpenRewrite-Talk</TalkXref></div>

</div>
<div>

### Spring Boot 4 Highlights

- Liefert JSpecify im Parent-POM
- Auto-Konfiguration ist `@NullMarked`
- ConfigurationProperties via Records empfohlen
- Reactor Mono/Flux: wenn leer = `Mono.empty()`, **nicht** `Mono<Optional<T>>`

### Kompatibilitäts-Snapshot

| Komponente            | JSpecify-Status |
| --------------------- | --------------- |
| Spring Core           | ✅ vollständig  |
| Spring Data, Security | 🟡 in Arbeit    |
| Reactor               | ✅              |

</div>
</div>

<!--
- Boot 4 = Framework 7 + Web-Stacks + Auto-Config.
- "in Arbeit" heißt: Public-API-Pakete sind annotiert, interne Pakete folgen.
-->

---
hideInToc: true
---

# Service-Layer-Beispiel

```java {monaco} {height: '300px'}
package com.example.shop.order;

import java.util.Optional;

import org.jspecify.annotations.NullMarked;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;

@NullMarked
@Service
public class OrderService {

    private final OrderRepository repo;
    private final PaymentGateway gateway;

    public OrderService(OrderRepository repo, PaymentGateway gateway) {
        this.repo = repo;
        this.gateway = gateway;
    }

    public Optional<Order> findById(String id) {
        return repo.findById(id);                 // Optional ist Rückgabe
    }

    public Order place(Customer customer, @Nullable PromoCode promo) {
        var order = new Order(customer);
        if (promo != null) order.applyPromo(promo);
        gateway.charge(order);
        return order;
    }
}
```

<!--
- @NullMarked auf der Klasse oder package-info.java.
- Constructor-Injection: keine Optional-Felder, kein @Nullable für Pflicht-Beans.
- promo darf null sein → explizit annotiert.
- Editor scrollt — die place()-Methode liegt unter der Fold.
-->

---
hideInToc: true
---

# Spring-Boot-4-Tücken

<div class="grid grid-cols-2 gap-8">
<div>

### Lazy-init und `@Autowired`-Felder

```java
@SuppressWarnings("NullAway.Init")
@Autowired
private @Nullable OptionalCache cache;
```

- Field-Injection ist `null` zwischen Konstruktor und Spring-Init
- NullAway erkennt das nicht — `Init`-Suppress nötig
- **Besser:** Constructor-Injection benutzen

### `@ConfigurationProperties`

```java
@ConfigurationProperties("app.shop")
public record ShopConfig(
    String tenantId,
    @Nullable String fallbackLocale,
    Duration timeout
) {}
```

</div>
<div>

### JPA-Entities ehrlich annotieren

```java
@NullMarked
@Entity
public class Customer {
    @Id
    private @Nullable Long id; // Reflection setzt das

    @Column(nullable = false)
    private String email;

    @ManyToOne
    private @Nullable Address address;
}
```

- Reflection-Init = `null` möglich
- `@Column(nullable=false)` ≠ Java-Typ-Garantie
- Records besser für DTOs/Projections, nicht als `@Entity` (`final`, kein No-Arg-Ctor)

</div>
</div>

<!--
- @SuppressWarnings("NullAway.Init") nicht missbrauchen — nur dort, wo Spring/JPA reflektion-induziert null setzt.
- Records + @ConstructorBinding: Default-Werte mit Constructor-Defaults oder Compact Constructor.
-->

---
hideInToc: true
---

# Testing — Mockito skips Constructor

```java {monaco} {height: '260px'}
@NullMarked
public class OrderService {
    private final PaymentGateway gateway;
    public OrderService(PaymentGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway);  // wird im Mock nicht aufgerufen
    }
    public void process(Order o) { gateway.charge(o); }
}

// In Tests:
class OrderServiceTest {
    @Test
    void mockBypassesConstructor() {
        var svc = mock(OrderService.class);
        // svc.gateway ist null, weil Mockito den Constructor überspringt!
    }

    @Test
    void useSmartNulls() {
        var svc = mock(OrderService.class, RETURNS_SMART_NULLS);
        // Smart-null wirft eine SmartNullPointerException mit Stacktrace
    }
}
```

<div class="mt-4 text-sm opacity-70">

**Pragma:** `@NullUnmarked` für Test-Klassen, NullAway in Tests auf `WARN` statt `ERROR` setzen.

</div>

<!--
- RETURNS_SMART_NULLS gibt es als Settings-Option seit Mockito 2 — kein v5-Feature und kein globaler Default (Javadoc: „probably the default in 3.0.0“, nie eingelöst).
- AssertJ hat (Stand 2026) keinen JSpecify-Support — offenes Issue #3727.
- Editor scrollt — der Test-Block liegt unter der Fold.
-->

---
layout: section
---

# 5. Refinement (alias „Narrowing“)

Wie der Build entscheidet, ob `x` jetzt wirklich nicht null ist

---
hideInToc: true
---

# „Narrowing“ — Begriff & Architektur

<div class="grid grid-cols-2 gap-8">
<div>

### Der Begriff

- „Narrowing“ steht **nicht** in der JSpecify-Spec
- Korrekt: _flow-sensitive type refinement_ (NullAway-Paper, FSE 2019)
- Synonyme: Kotlin/TS „smart-cast“, Compiler-Theorie „dataflow narrowing“
- JSpecify erwähnt Refinement nur indirekt — schreibt es Tools zu

</div>
<div>

### Die Schichten — keine Konkurrenz

- **JSpecify** — Spezifikation: was `@Nullable T` _bedeutet_. Kein Checker.
- **ErrorProne** — javac-Plugin-Framework von Google. Stellt CFG- und Dataflow-Infrastruktur. Macht selbst kein Refinement.
- **NullAway** — ErrorProne-Plugin von Uber. Hier wohnt die Refinement-Logik. 5–10 % Build-Overhead, **bewusst unsound**.

</div>
</div>

<!--
- Wer auf einer JSpecify-Issue nach Narrowing-Semantik fragt, ist auf der falschen Mailingliste.
- ErrorProne ist nur das Framework — alle Nullness-Checks laufen im NullAway-Plugin.
-->

---
hideInToc: true
---

# Was NullAway als Refinement erkennt

```java
@Nullable Foo f = lookup();

if (f != null)                   f.use();   // ✅ Vergleich (auch ternär, negiert)
Objects.requireNonNull(f);       f.use();   // ✅ JDK
Preconditions.checkNotNull(f);   f.use();   // ✅ Guava
assert f != null;                f.use();   // ✅ nur mit NullAway:AssertsEnabled=true
if (f instanceof Bar b)          b.use();   // ✅ instanceof + Pattern

Optional<Foo> o = find();
if (o.isPresent())               o.get();   // ✅ erkannt (nicht empfohlen → ifPresent)
```

<div class="mt-4 text-sm opacity-70">

**Interprozedural eingeschränkt:** `@Contract` (JetBrains, Korrektheits-Check buggy), `@EnsuresNonNull` / `@RequiresNonNull`, ~95 mitgelieferte Library Models für JDK und Guava.

</div>

<!--
- Whitelist ist nicht ad hoc — explizite Transferfunktionen über Access Paths (a.b().c).
- Quelle: NullAway-Wiki "How NullAway Works".
- Im Konstruktor wird zusätzlich über Initialisierungs-Pfade gefolgert.
-->

---
hideInToc: true
---

# Die unsichere Annahme

<div class="grid grid-cols-2 gap-6">
<div>

### Das Problem

```java
class OrderService {
  @Nullable Foo field;

  void m() {
    if (this.field != null) {
      someMethod();          // könnte field nullen
      this.field.doStuff();  // OK. Sound? Nein.
    }
  }
}
```

<div class="mt-2 text-xs opacity-70 italic">

„NullAway makes the simplifying (but unsound) assumption that callees perform no mutation …“ — NullAway-Wiki

</div>

</div>
<div>

### Das Standard-Idiom

```java
void m() {
  Foo local = this.field;     // atomarer Read
  if (local != null) {
    someMethod();
    local.doStuff();          // ✅ kein Field-Read
  }
}
```

- Lokale Kopie macht **die Atomarität explizit**
- Pattern in **Spring, Chromium, Uber**
- Wer Soundness will: **Checker Framework** (5–20× langsamer)

</div>
</div>

<!--
- Häufigste Restursache von NPEs in NullAway-Audits: genau dieses Pattern.
- Refinement-Store wird über Methodenaufrufe NICHT invalidiert — explizit dokumentierter Trade-off.
-->

---
hideInToc: true
---

# Limitationen, die in der Praxis beißen

| Limitation                                     | Symptom                                                 | Umgehung                                |
| ---------------------------------------------- | ------------------------------------------------------- | --------------------------------------- |
| **Boolean-Indirection** (Issue #98, seit 2017) | `boolean nn = x != null; if (nn) x.foo();` → ERROR      | Direkt `if (x != null)`                 |
| **Generics-Mode** in Entwicklung               | `Map<String, @Nullable V>` mit `JSpecifyMode=true` → FP | Default-Mode oder Suppress              |
| **Type-Use-Position** strikt seit 0.12         | `@Nullable String[]` ≠ `String @Nullable []`            | `LegacyAnnotationLocations` Compat-Flag |
| **JPA / Hibernate Reflection-Init**            | Default-Constructor + Reflection setzt non-null         | `@SuppressWarnings("NullAway.Init")`    |

<div class="mt-4 text-sm opacity-70">

Die meisten realen NPEs in NullAway-Audits kommen aus **Initialisierung, Library Models und Generics** — nicht aus Refinement-Lücken.

</div>

<!--
- Spring-7-Migration hat bei Type-Use-Position Wellen geschlagen.
- NullAway 0.11 vermeidet das temporär; ist aber kein Zukunftspfad.
- Issue #98 ist die kanonische Limitation — bekannt, akzeptiert, instruktiv.
-->

---
hideInToc: true
---

# Pragmatisch vs. idiomatisch

<div class="grid grid-cols-2 gap-6">
<div>

### Pragmatisch — Build durchbekommen

- `Objects.requireNonNull(x)` als **Ausdruck** (`return Objects.requireNonNull(maybe);`)
- Lokale Kopie aus Feld + `if`-Check
- `Nullness.castToNonNull` (NullAway-API) als bewusster Escape-Hatch
- `@SuppressWarnings("NullAway")` punktuell — **mit Begründungs-Kommentar**

</div>
<div>

### Idiomatisch — Langfristig sauber

- `@NullMarked` aufs `package-info.java` (non-null als Default)
- JSpecify als type-use, **korrekte syntaktische Position**
- Lokale Kopie aus Feld vor Null-Check als Standard-Pattern
- `@EnsuresNonNull("field")` auf Initialisierungs-Methoden
- Konstruktor-Vollständigkeit statt nachträglicher Setter

</div>
</div>

<div class="mt-4 text-sm opacity-70 italic">

Refinement ist die einfachste Komponente — nicht der harte Teil. Die meisten realen NPEs kommen aus **Initialisierung**, **Library Models** und **Generics-Nullness**.

</div>

<!--
- Cheatsheet wandert in den Build-PR.
- Nächste Sektion zeigt: Kotlin löst genau diese Punkte als Sprach-Feature, nicht als Plugin-Mechanik.
-->

---
hideInToc: true
---

# Dataflow-Store live — sechs Szenarien

<NarrowingExplorer />

<!--
- Live-Recap aller Refinement-Themen aus den vorigen Folien.
- Reihenfolge der Szenarien folgt der Komplexität: Basis → Boolean-Indirektion → Field+Call → Lokale Kopie → requireNonNull → @EnsuresNonNull.
- Triangles ▲/▼ steppen durch Code-Zeilen, Tabs oben wechseln das Szenario.
-->

---
layout: section
---

# 6. Andere JVM-Sprachen

Wie Kotlin, Scala & Co. das gleiche Problem lösen

---
hideInToc: true
---

# Sprach-Mechanismen im Vergleich

<AnnotationCompatTable variant="languages" />

<div class="mt-6 text-sm opacity-70">

**Take-away:** Kotlin hat das stärkste statische Typsystem für Null. Java holt mit Annotationen nach. Native Sprach-Lösung kommt — aber dauert.

</div>

<!--
- Scala 3 -Yexplicit-nulls ist opt-in, in der Praxis selten aktiviert.
- Clojure NPE-Fragen treten nur an Java-Boundaries auf — innerhalb der Sprache ist nil ein konsistenter Wert.
-->

---
hideInToc: true
---

# Kotlin im direkten Vergleich

<JavaKotlinCompare />

<div class="mt-2 text-sm opacity-70 grid grid-cols-2 gap-4">
<div>

- `@Nullable` ist Annotation, Compile-Tool prüft
- Optional als „leeres Ergebnis“-Vehikel
- Boilerplate: explizite Null-Checks

</div>
<div>

- `?` ist Teil des **Typsystems**, nicht Annotation
- `?.`, `?:`, `!!` sind Sprach-Konstrukte
- Smart-Casts: nach `if (x != null)` ist x non-null

</div>
</div>

<!--
- Beide Stile sind heute valide. Kotlin ist eleganter, Java ist mit JSpecify nicht mehr weit weg.
- Auch wichtig: Optional<T> in Kotlin praktisch unbenutzt — T? reicht.
-->

---
hideInToc: true
---

# Java ↔ Kotlin Interop mit JSpecify

<KotlinInteropDiagram />

<div class="mt-2 text-sm opacity-70">

**Konsequenz:** Wer Java-Bibliotheken für Kotlin-Konsumenten baut, sollte `@NullMarked` setzen — Kotlin 2.x liest das automatisch.

</div>

<!--
- Platform-Type T! ist Kotlins "weiß-ich-nicht" — er checkt nicht und der Aufrufer kann hineingreifen.
- Kotlin 2.0 (Mai 2024) hat JSpecify-Support standardmäßig aktiviert.
- Vor JSpecify: JetBrains-Annotationen am Java-Code waren der einzige Weg — heute überholt.
-->

---
layout: section
---

# 7. Was kommt nativ?

JEPs, Roadmap und Realität

---
hideInToc: true
---

# Die vier relevanten JEPs

<AnnotationCompatTable variant="jeps" />

<div class="mt-4 text-sm opacity-70">

JEP 8303099 ist Draft **ohne Target-Release**. „Frühestens“ ist Lese-Hinweis: das ist die optimistische Lesart der derzeitigen OpenJDK-Mailinglisten.

</div>

<!--
- JEP 401 wird VOR JEP 8303099 stabilisieren — Value Classes brauchen kein null-restriction-Syntax.
- JEP 8316779 ist abhängig von 8303099 — es gibt wenig Sinn, isoliert zu landen.
-->

---
hideInToc: true
---

# JDK-Roadmap & Realität

<JepTimeline />

<div class="mt-4 text-sm opacity-70 italic">

> „Since this feature is still in the proposal stage and will likely take several years to materialize, JSpecify and NullAway currently represent the most practical and powerful way to improve the stability of Java applications.“ — Sébastien Deleuze, Spring Team, März 2025

</div>

<!--
- LTS-Zyklen sind 2 Jahre — JDK 25 (2025), 29 (2027), 33 (2029). JDK 31 (2028) ist KEIN LTS.
- Wer heute auf 8303099 wartet: 2-3 LTS-Zyklen Wartezeit.
-->

---
hideInToc: true
---

# Geplante Syntax — Vorschau

```java
// JEP 8303099 (Draft) — kann sich noch ändern
String!  s1 = "x";       // null-restricted: Compiler verbietet null
String?  s2 = null;      // explizit nullable
String   s3 = readFromUnannotatedApi();  // unmarked: backward-compat

List<String!> allNonNull;
List<String?> mayHaveNulls;

// Migration JSpecify → native Marker ist mechanisch (gleiche Semantik)
@Nullable String x;       // 2026
String? x;                // 2029+
```

<div class="mt-4 text-sm opacity-70">

**Mechanische Migration:** OpenRewrite (oder Nachfolger) wird `@Nullable T` → `T?` automatisieren. Der Aufwand „heute“ und „später“ ist vergleichbar — und „heute“ gibt es schon Build-Sicherheit.

</div>

<!--
- Syntax kann sich vor Final ändern (?! oder !? oder anderes Sigil).
- JEP 8316779 ist die Value-Class-Variante — gleiches Konzept, andere Semantik (Identity).
-->

---
layout: section
---

# 8. Action Plan

Konkrete Schritte für Greenfield und Brownfield

---
layout: center
hideInToc: true
---

# Action Plan — Greenfield 2026

<div class="text-left max-w-3xl mx-auto mt-6 space-y-2 text-sm">

1. **JSpecify 1.0.0** als einzige Annotation-Quelle in `pom.xml` / `build.gradle.kts`
2. **`@NullMarked`** auf jedes `package-info.java`
3. **NullAway + ErrorProne** im Build, `OnlyNullMarked=true`, `JSpecifyMode=true`, **`error("NullAway")`**
4. **Records** für Datenklassen (nicht `@Data`/`@Value`)
5. **`Optional<T>`** ausschließlich als Rückgabetyp
6. **IntelliJ IDEA 2025.3+** für sofortiges IDE-Feedback
7. **Spring Boot 4** mit Constructor-Injection — keine `@Autowired`-Felder

</div>

<!--
- Wer einen dieser Punkte überspringt, verliert den Großteil der Sicherheit.
- Greenfield ist einfach. Brownfield ist die eigentliche Arbeit.
-->

---
layout: center
hideInToc: true
---

# Action Plan — Brownfield (Spring Boot 3 → 4)

<div class="text-left max-w-3xl mx-auto mt-6 space-y-2 text-sm">

1. **Upgrade auf Spring Boot 4** (eigener PR, ohne Null-Migration mischen)
2. **OpenRewrite-Recipes** für 80 % der Annotation-Migration (`MigrateToJSpecify` — <TalkXref slug="20260522-open-rewrite">Details</TalkXref>)
3. **Pro Package**: `@NullMarked` setzen → NullAway-Output ansehen → fixen → Warnung auf Error
4. **Lombok schrittweise zurückbauen**: `@Data` → Records, `@Slf4j` bleibt
5. **JPA-Entities**: `@Getter`/`@Setter` reichen, `@EqualsAndHashCode` raus
6. **`@SuppressWarnings("NullAway.Init")`** akzeptieren — aber nur an Spring-Lifecycle-Stellen

</div>

<div class="mt-4 text-sm opacity-70 text-center">

**Was NICHT tun:** kein neuer JSR-305-Code · kein `Optional` als Feld/Parameter · kein `@Data`/`@Value` mehr · kein Checker FW „weil es sauberer wirkt“

</div>

<!--
- Schritt 3 ist der eigentliche Aufwand. Pro Package-Wave 0,5–2 Tage je nach Größe.
- Schritt 1 vor Schritt 2 — Boot-Upgrade-PRs reviewen sich anders als Null-Migration-PRs.
-->

---
layout: section
---

# 9. Bonus

Vergleichstabellen & Kompatibilitätsmatrizen

---
hideInToc: true
---

# Static Analyzer im Vergleich

<AnnotationCompatTable variant="analyzers" />

<div class="mt-4 text-sm opacity-70">

**2026-Konsens:** NullAway in CI, IntelliJ in der IDE. Checker FW nur, wo formale Soundness gefordert ist.

</div>

<!--
- "Praktisch" bei NullAway heißt: pragmatische Heuristiken, keine formale Garantie für jede Code-Pfad.
- Eclipse JDT braucht für JSpecify manuelle Konfiguration über externalAnnotations.
-->

---
hideInToc: true
---

# Spring-Boot-Kompatibilitätsmatrix

<AnnotationCompatTable variant="springboot" />

<div class="mt-4 text-sm opacity-70">

Boot 2.x: OSS-Support endete am 30.06.2023 (kommerzielle Verlängerung bis 2029). Boot 3.x bekommt JSpecify-Adoption nicht mehr in den Hauptzweig — nur Boot 4 ist „native“.

</div>

<!--
- Boot 3.x kann JSpecify-Code konsumieren — die org.springframework.lang.* APIs sind nicht inkompatibel.
- Spring Initializr erzeugt für Boot 4 inzwischen JSpecify-Imports im pom.xml.
-->

---
hideInToc: true
---

# Migrations-Cheatsheet

<div class="grid grid-cols-2 gap-3 text-xs leading-snug [&_h3]:text-base [&_h3]:mt-2 [&_h3]:mb-1 [&_table]:my-1 [&_th]:py-1 [&_td]:py-1 [&_li]:my-0">
<div>

### Annotations-Migration

| Von                          | Nach                                    |
| ---------------------------- | --------------------------------------- |
| `javax.annotation.@Nonnull`  | `org.jspecify.@NullMarked` (package)    |
| `javax.annotation.@Nullable` | `org.jspecify.@Nullable`                |
| `org.springframework.lang.*` | `org.jspecify.*`                        |
| `org.jetbrains.@NotNull`     | `org.jspecify.@NullMarked` (impliziert) |
| `lombok.@NonNull` (Runtime)  | bleiben — komplementär                  |

### Lombok-Strategie

| Annotation                            | Heute                        |
| ------------------------------------- | ---------------------------- |
| `@Data`, `@Value`                     | → Records                    |
| `@Builder`                            | bleibt (mit Wrapper-Pattern) |
| `@Slf4j`, `@SneakyThrows`, `@Cleanup` | bleiben                      |
| `@EqualsAndHashCode` für JPA          | **vermeiden**                |

</div>
<div>

### Code-Pattern-Migration

| Von                           | Nach                         |
| ----------------------------- | ---------------------------- |
| `Optional<T>` als Feld        | `@Nullable T`                |
| `Optional<T>` als Parameter   | Method-Overload              |
| `Optional<List<T>>`           | leere `List<T>`              |
| `obj.get()`                   | `obj.orElseThrow(...)`       |
| `if (obj.isPresent())`        | `obj.ifPresent(...)`         |
| `List<String>` als API-Return | `List<String>` (nie `null`!) |

### Null-Frei-Heuristik

- **Collections:** leer statt null
- **Strings:** leer (`""`) statt null, wenn semantisch passt
- **Optional:** ausschließlich Rückgabetyp
- **Defaults:** Constructor-Validation mit `Objects.requireNonNull`

</div>
</div>

<!--
- Wichtig: nicht alle Lombok-Annotations sind böse. Records lösen 70% des Use-Cases.
- @EqualsAndHashCode für JPA-Entities ist eine Falle — Hibernate-Reflection setzt id auf null, dann ungleich gleich.
-->

---
hideInToc: true
---

# Weiterführende Quellen

<div class="grid grid-cols-2 gap-8 mt-4 text-sm">
<div>

### Spezifikation & Tools

- **JSpecify** — `jspecify.dev`
- **NullAway** — `github.com/uber/NullAway`
- **Checker Framework** — `checkerframework.org`
- **Spring & JSpecify** — `spring.io/blog`
- **JEP 8303099** — `openjdk.org/jeps/8303099`
- **JEP 401** — `openjdk.org/jeps/401`

</div>
<div>

### Verwandte Talks

- Mechanische Migration & Recipes:
  <TalkXref slug="20260522-open-rewrite">OpenRewrite-Talk</TalkXref>
- Records, `@Builder` & named args pro Sprache:
  <TalkXref slug="20260606-design-pattern">Design-Pattern-Talk</TalkXref>

</div>
</div>

<!--
- Reading List vor dem Dank — Quellen und die Companion-Talks gebündelt.
-->

---
layout: end
hideInToc: true
---

# Danke

<div class="mt-6 text-base opacity-80">

Fragen? Diskussion?

</div>

<div class="mt-12 text-xs opacity-50">

Quellen: jspecify.dev · github.com/uber/NullAway · spring.io/blog · openjdk.org/jeps/8303099 · openjdk.org/jeps/401

</div>

<!--
- Backup-Folien (Bonus-Sektion) für Q&A bereithalten — wer nach JEP-Detail fragt, will die Roadmap sehen.
-->

---
layout: default
title: Selbsttest
hideInToc: true
---

<div class="text-2xl font-semibold mb-2">Selbsttest</div>

<NullSafetyQuiz />

<!--
- Hinter der End-Slide: für Selbststudium nach dem Vortrag.
- Adaptive: startet mittel, wird je nach Antwort härter oder leichter.
-->
