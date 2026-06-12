---
theme: default
lang: de
title: "Brauchen wir noch Entwurfsmuster? — GoF zwischen Sprachfeature und Architektur"
info: |
  Klassische GoF-Muster und ihre modernen Entsprechungen (JVM-Fokus).
  Drei-Schichten-Taxonomie, Builder als Typsystem-Lehrstück, Metaprogramming
  als Pattern-Substrat — mit einer Pattern × Sprache-Matrix.
monaco: true
mdc: true
transition: slide-left
colorSchema: auto
fonts:
  sans: Inter
  mono: 0xProto
hideInToc: true
---

# Brauchen wir noch Entwurfsmuster?

GoF zwischen Sprachfeature und Architektur — was bleibt, was die Sprache übernimmt

<div class="mt-8 text-sm opacity-60">

Drei Schichten · Builder als Typsystem-Lehrstück · Metaprogramming als Substrat · Pattern × Sprache-Matrix

</div>

<!--
- Leitfrage: Sind die GoF-Muster (1994) heute noch relevant — oder haben Sprachfeatures sie überflüssig gemacht?
- Antwort vorweg: weder „alles tot“ noch „alles ewig“. Die Wahrheit ist geschichtet.
- JVM-Fokus, aber mit Kotlin/Rust/Go/TS/Python als Kontrast.
-->

---
hideInToc: true
---

# Kurzfassung

- **Substitution ist real, aber selektiv.** 16 der 23 GoF-Muster sind laut Norvig in höheren Sprachen „either invisible or simpler“ — ersetzt durch first-class functions, sum types/ADTs, null-safety, named/default args. Ein hartes Drittel bleibt sprachunabhängig relevant.
- **Drei Schichten, nicht drei GoF-Familien.** Schicht 1 (Sprachdefizit-Notlösungen) wird durch Features ersetzt; Schicht 2 (Strukturmuster) bleibt mit leichterer Implementierung; Schicht 3 (Architektur/DDD) ist unberührt. Wer das nicht trennt, irrt in beide Richtungen.
- **Builder ist der Lehrfall für Typsystem-Grenzen.** Geplante Java-null-Safety erzwingt Pflichtfelder **nicht** zur Compile-Zeit. Compile-zeit-sicher ist nur der Staged Builder — oder named/default args, die das Muster ganz auflösen.
- **Metaprogramming ist das Substrat hinter „Proxy & Spring-Magie“.** Dynamische Proxies _implementieren_ Proxy (statt es zu ersetzen) und subsumieren Decorator; Spring AOP industrialisiert das — mit dokumentierten Failure Modes.

---
hideInToc: true
---

# Inhalt

<Toc mode="all" minDepth="1" maxDepth="1" columns="2" listClass="!list-none !pl-0" />

---
layout: section
---

# 1. Die Frage & die Drei-Schichten-Taxonomie

Warum „GoF ist tot“ und „GoF ist ewig“ beide falsch sind

---
hideInToc: true
---

# Drei Stimmen — dieselbe Diagnose

<div class="grid grid-cols-3 gap-6 mt-6">
<div>

### Norvig (1996)

> „16 of 23 patterns are **either invisible or simpler**“ in höheren Sprachen.

Aufgeschlüsselt: first-class functions (Strategy, Command, Template Method, Visitor), first-class types (Factory, Proxy, State …), Makros (Iterator, Interpreter).

</div>
<div>

### Graham (2002)

> Muster im Code seien „a **sign of trouble**“.

Ein Hinweis, dass man „by hand the expansions of some macro“ erzeuge — _„the human compiler“_. Polemisch, aus Lisp-Sicht, aber dieselbe Diagnose.

</div>
<div>

### Gamma (2009)

> „I'm in favor of **dropping Singleton**. Its use is almost always a design smell.“

Würde Factory Method zu Factory verallgemeinern. Das GoF-Buch nutzt C++/Smalltalk — der OOP-Kontext der frühen 90er.

</div>
</div>

<div class="mt-6 text-sm opacity-70">

Aber: nicht alle Muster sind Sprachdefizite. Gamma betont zugleich die _„enduring nature of good design“_ an Adapter, Bridge, Proxy.

</div>

---
hideInToc: true
---

# Drei Schichten statt Creational / Structural / Behavioral

Die GoF-Einteilung vermischt drei Abstraktionsebenen. Nützlicher ist die Schichtung nach **Substituierbarkeit**:

<div class="grid grid-cols-3 gap-6 mt-6">
<div>

### Schicht 1 — Sprachdefizit-Notlösungen

Kompensieren fehlende Features: first-class functions, ADTs/sum types, null-safety, Sprach-Singletons.

→ **durch Features ersetzt**

<div class="text-xs opacity-60 mt-2">Strategy, Command, Template Method, Observer, Iterator, Visitor, State, Null Object, Singleton</div>

</div>
<div>

### Schicht 2 — echte Strukturmuster

Sprachunabhängige Strukturierung von Objektgeflechten.

→ **bleiben relevant**, leichtere Implementierung

<div class="text-xs opacity-60 mt-2">Adapter, Facade, Composite, Decorator, Proxy, Bridge</div>

</div>
<div>

### Schicht 3 — Architektur / DDD

DDD-Taktik & PoEAA: Entity, Value Object, Repository, Unit of Work …

→ **von der Substitution unberührt** (Ausnahme: Value Object)

<div class="text-xs opacity-60 mt-2">Value Object, Repository, Active Record vs Data Mapper</div>

</div>
</div>

---
hideInToc: true
---

# Faktencheck: sechs verbreitete Thesen

<div class="text-xs mt-4">

| #   | These                                        | Fazit                                     | Kern                                                                 |
| --- | -------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------- |
| 1   | Singleton ← Companion Object (Kotlin)        | **begrifflich falsch**, Intention korrekt | Kotlin-Singleton = `object`; `companion object` ≈ statische Member   |
| 2   | Singleton ← `enum` (Java)                    | **korrekt**                               | Bloch, _Effective Java_ Item 3: bestes Singleton-Idiom               |
| 3   | Singleton ↔ Spring DI-Scope                 | **korrekt mit Einschränkung**             | per Container/Bean, nicht per ClassLoader wie GoF                    |
| 4   | Visitor ← Lambda                             | **größtenteils falsch**                   | Lambda nur im Single-Method-Fall; korrekt: sealed + pattern matching |
| 5   | Builder-Pflichtfelder ← geplante null-Safety | **erzwingt NICHT**                        | kein Typestate; greift erst zur Laufzeit bei `build()`               |
| 6   | Proxies / Spring ersetzen Muster             | **Begriff zu grob**                       | Proxies _implementieren_ Proxy, AOP _industrialisiert_               |

</div>

<!--
- Diese sechs Thesen ziehen sich als roter Faden durch den Talk.
- Vier davon sind „falsche Freunde“ — gleiches Wort, anderes Konzept.
-->

---
hideInToc: true
---

# Lese-Anleitung: vier Felder & vier Status-Labels

<div class="grid grid-cols-2 gap-8 mt-4">
<div>

### Pro Muster zeigen wir

1. **Originalintent** des Musters
2. **GoF-Implementierung** (Java, klassisch)
3. **Moderne Entsprechung** je Sprache (Tabs)
4. **Status-Label**

Code in den Tabs: anklickbare **Annotationen** mit JLS-/JEP-Bezügen.

</div>
<div>

### Status-Labels

- **[ERSETZT]** durch Sprachfeature obsolet
- **[KONZEPT]** Idee bleibt, GoF-Implementierung veraltet
- **[RELEVANT]** weiterhin idiomatisch
- **[SPRACHABH.]** sprachabhängig

<div class="text-xs opacity-60 mt-3">In der Schluss-Matrix verdichtet zu: weiterhin relevant · moderner Ersatz · trifft nicht zu.</div>

</div>
</div>

---
layout: section
---

# 2. Schicht 1 — Sprachdefizit-Notlösungen

„Verhalten als Wert übergeben“ — und ADTs statt double dispatch

---
hideInToc: true
---

# Singleton · [ERSETZT] / [KONZEPT]

<PatternTabs name="singleton" />

<div class="mt-2 text-xs opacity-70">

Das `enum`-Feld ist lazy, aber der Init-Zeitpunkt ist nicht kontrollierbar → <Link to="lazy-init">Lazy Initialization</Link>.

</div>

<!--
- enum-Singleton ist Blochs Empfehlung; alle drei Java-Idiome sind JLS-fundiert (kein UB).
- Was NICHT verschwindet: globaler, schwer mockbarer Zustand. Nur DI löst das.
-->

---
hideInToc: true
---

# Strategy & Command · [ERSETZT]

<PatternTabs name="strategy" />

---
hideInToc: true
---

# Template Method · [ERSETZT] / [KONZEPT]

<PatternTabs name="templateMethod" />

---
hideInToc: true
---

# Observer · [KONZEPT]

<PatternTabs name="observer" />

---
hideInToc: true
---

# Iterator · [ERSETZT]

<PatternTabs name="iterator" />

---
hideInToc: true
---

# Visitor · [ERSETZT] durch ADTs — der Lehrfall

<PatternTabs name="visitor" />

<!--
- Warum „Lambda ersetzt Pattern X“ zu kurz greift: Visitor löst das Expression Problem via double dispatch.
- Ein Lambda ersetzt nur den degenerierten Ein-Methoden-Fall (dann ist es Strategy).
-->

---
hideInToc: true
---

# State · [KONZEPT] / [ERSETZT]

<PatternTabs name="state" />

---
hideInToc: true
---

# Null Object · [ERSETZT]

<PatternTabs name="nullObject" />

---
hideInToc: true
---

# Falscher Freund #1: `object` vs `companion object`

<PatternTabs name="falscherFreundKotlin" />

---
layout: section
---

# 3. Sonderfall Builder

Der Lehrfall für Typsystem-Ebenen: Laufzeit-Check · Compile-Zeit-Kodierung · Problemauflösung

---
hideInToc: true
---

# Klassischer Builder · [SPRACHABH.] — Prüfung zur Laufzeit

<PatternTabs name="builderClassic" />

<!--
- Der klassische Builder verschiebt die Pflichtfeld-Prüfung in `build()`: fehlt ein Pflichtfeld, fliegt erst zur LAUFZEIT eine Exception.
- Das ist die schwächste Garantie-Ebene — der Compiler hilft nicht. Genau hier setzt der nächste Schritt (Staged Builder) an.
-->

---
hideInToc: true
---

# Staged Builder · [SPRACHABH.] — Pflichtfelder zur Compile-Zeit

<PatternTabs name="builderStaged" />

<!--
- Der Staged Builder kodiert die Pflichtreihenfolge in eine Interface-Kette: jede Stufe gibt nur das Interface der nächsten zurück.
- Dadurch erzwingt der COMPILER die Pflichtfelder — Preis: N Interfaces Boilerplate. Das ist die Compile-Zeit-Kodierung, die named/default args (übernächste Folie) ganz auflösen.
-->

---
hideInToc: true
---

# Grenze: kombinatorische Explosion (2ᴺ) · [SPRACHABH.]

<PatternTabs name="builderExplosion" />

---
hideInToc: true
---

# Grenze: Builder + Vererbung (`@SuperBuilder`) · [SPRACHABH.]

<PatternTabs name="builderInheritance" />

---
hideInToc: true
---

# Die eigentliche Auflösung: named / default args · [SPRACHABH.]

In Sprachen mit named + optionalen Parametern ist der Builder schlicht **überflüssig** — und Pflichtfelder sind „kostenlos“ compile-zeit-erzwungen.

<PatternTabs name="builderNamedArgs" />

---
hideInToc: true
---

# Pflichtfeld-Durchsetzung pro Idiom

<div class="enf-table text-xs mt-3">

| Sprache / Idiom                    | Mechanismus                      | Pflichtfeld-Durchsetzung                                |
| ---------------------------------- | -------------------------------- | ------------------------------------------------------- |
| Java — klassischer Builder         | Builder + `build()`              | **Laufzeit** (Exception)                                |
| Java — Staged Builder              | Interface-Kette                  | **Compile-Zeit**                                        |
| Java — Konstruktor / `record`      | Positionsparameter               | Compile-Zeit, keine named/default                       |
| Java — null-Safety (JEP 8303099)   | `String!`                        | **Laufzeit** (narrowing); kein Typestate                |
| Kotlin / Scala                     | named + default Params           | **Compile-Zeit**                                        |
| Python                             | kwargs + `@dataclass`            | Laufzeit (`TypeError`, dynamisch)                       |
| TypeScript                         | Options-Objekt + optionale Props | **Compile-Zeit**                                        |
| Go                                 | functional options               | Compile-Zeit (Pflicht = Positionsparam), Rest ungeprüft |
| Rust — pragmatisch                 | `build() -> Result`              | Laufzeit                                                |
| Rust — typestate / `typed-builder` | `PhantomData`-Marker             | **Compile-Zeit**                                        |

</div>

<div class="mt-2 text-xs opacity-70">

Der Builder ist kein „gelöstes“ Muster, sondern eine **Landkarte**, _auf welcher Ebene_ eine Sprache das Konstruktionsproblem löst — null-Safety landet auf der schwächsten. <TalkXref slug="20260428-java-null-pointer">JEP 8303099 im Detail</TalkXref>

</div>

<style>
.enf-table table { border-collapse: collapse; }
.enf-table th, .enf-table td { padding: 2px 8px !important; line-height: 1.2; }
</style>

---
hideInToc: true
routeAlias: lazy-init
---

# Lazy Initialization · [ERSETZT] / [KONZEPT]

Kein GoF-23-Muster — Beck (1997), Fowlers „Lazy Load“ (2002). _Lazy initialization_ (ein Feld) ≠ _lazy evaluation_ (Haskell).

<PatternTabs name="lazyInit" />

<!--
- Konstruktions-Sonderfall neben Builder: Builder = WIE konstruieren, Lazy Init = WANN.
- Java braucht JSR-133 (2004), nur um den Workaround KORREKT zu machen; Bibliotheken (Guava) verstecken ihn; neuere Sprachen backen ihn als Keyword ein.
- enum/Holder (Singleton-Folie) lösen nur den statischen, arg-losen Fall — nicht Instanzfelder/Konstruktor-Args.
-->

---
hideInToc: true
---

# Lazy Init — Methoden im Vergleich

<div class="cmp-table text-xs mt-3">

| Mechanismus                                    | Geltung  | Compute-Garantie                 | Constant-Folding |
| ---------------------------------------------- | -------- | -------------------------------- | ---------------- |
| `synchronized` / DCL (Java)                    | Instanz  | genau einmal                     | **nein**         |
| `AtomicReference` (CAS)                        | Instanz  | ggf. mehrfach, erster gewinnt    | **nein**         |
| `ConcurrentHashMap.computeIfAbsent`            | keyed    | genau einmal pro Key             | **nein**         |
| Holder-Idiom (Java, `static`)                  | statisch | genau einmal                     | **ja**           |
| `enum`-Singleton (Java)                        | statisch | genau einmal                     | —                |
| `LazyConstant` (Java, `final`-Feld, _Preview_) | beides   | genau einmal, thread-safe        | **ja**           |
| Kotlin `by lazy` (SYNCHRONIZED)                | Instanz  | genau einmal (DCL)               | nein             |
| Scala 3 `lazy val`                             | Instanz  | genau einmal (CAS-State-Machine) | nein             |

</div>

<div class="mt-3 text-sm opacity-70">

Die Lücke, die `LazyConstant` schließt: lazy **und** thread-safe **und** constant-foldbar — ohne die `static`-only-Beschränkung des Holder-Idioms. Mutable Träger (`volatile`, `AtomicReference`) darf der JIT nie wegoptimieren; `final`-getragene Lazy-Konstanten schon.

</div>

<div class="cmp-foot text-xs opacity-65 mt-4">

**DCL** — Double-Checked Locking<br>
**CAS** — Compare-and-Swap (atomare „vergleiche-und-tausche“-CPU-Instruktion)<br>
**Constant Folding** — [statische Formelauswertung zur Übersetzungszeit](https://en.wikipedia.org/wiki/Constant_folding); der Compiler/JIT ersetzt einen konstanten Ausdruck vorab durch sein Ergebnis

</div>

<style>
.cmp-table table { border-collapse: collapse; }
.cmp-table th, .cmp-table td { padding: 2px 8px !important; line-height: 1.25; }
.cmp-foot { border-top: 0.5px solid var(--color-border-tertiary); padding-top: 6px; line-height: 1.7; }
.cmp-foot a { color: var(--color-text-info); text-decoration: underline; }
.cmp-foot strong { color: var(--color-text-primary); font-weight: 600; }
</style>

<!--
- §8 des Referenzdokuments: Semantik-Mapping mit der Constant-Folding-Spalte als Pointe.
- LazyConstant ist semantisch lazy val/by lazy, aber zusätzlich ohne Static-only-Limit UND mit Constant-Folding.
-->

---
layout: section
---

# 4. Schicht 2 — Strukturmuster

Bleiben relevant — moderne Sprachen senken nur den Implementierungsaufwand

---
hideInToc: true
---

# Decorator · [RELEVANT]

<PatternTabs name="decorator" />

---
hideInToc: true
---

# Adapter · [RELEVANT]

<PatternTabs name="adapter" />

---
hideInToc: true
---

# Falscher Freund #2: Python `@decorator` ≠ GoF-Decorator

<PatternTabs name="falscherFreundPython" />

---
hideInToc: true
---

# Kurz: Facade · Composite · Bridge · Proxy

<div class="grid grid-cols-2 gap-8 mt-6">
<div>

- **Facade** — eine Modul-/Paketgrenze, die ein komplexes Subsystem hinter einer schmalen API verbirgt.
- **Composite** — rekursive Teil-Ganzes-Struktur; als rekursive **sum types** elegant ausdrückbar.

</div>
<div>

- **Bridge** — Komposition zweier unabhängiger Hierarchien (Abstraktion ⊥ Implementierung).
- **Proxy** — bleibt [KONZEPT]; dynamische Proxies / AOP **implementieren** ihn → <Link to="metaprogramming">Sektion 6</Link>.

</div>
</div>

<div class="mt-8 text-center text-sm opacity-70">

Facade · Composite · Bridge: <strong>[RELEVANT]</strong>, Proxy: <strong>[KONZEPT]</strong> — sprachunabhängige Strukturkonzepte, kein Sprachfeature nimmt sie weg.

</div>

---
layout: section
---

# 5. Schicht 3 — Architektur- / DDD-Muster

Von der Substitution unberührt — eine Ausnahme (Value Object), ein Brückenfall (Repository)

---
hideInToc: true
---

# Value Object · [ERSETZT] (Implementierung)

<PatternTabs name="valueObject" />

---
hideInToc: true
---

# Repository · [RELEVANT], Implementierung generiert

<PatternTabs name="repository" />

---
hideInToc: true
---

# Persistenz: drei Cluster, nicht „ORM vs. SQL“

<div class="grid grid-cols-3 gap-6 mt-6">
<div>

### Active Record

Persistenz lebt **im** Domänenobjekt: `user.save()`, `User.find(id)`.

Schnelle CRUD-Entwicklung, aber Domänen-/Persistenzlogik vermischt; „Fat Models“.

<div class="text-xs opacity-60 mt-2">Rails, Django, Eloquent, GORM</div>

</div>
<div>

### Data Mapper / ORM

Mapper trennt Objekt von DB; **Unit of Work** + **Identity Map** + Change Tracking.

Sauberes Modell, aber Leaky Abstraction: **N+1**, Lazy-Init, Cache-Staleness.

<div class="text-xs opacity-60 mt-2">Hibernate/JPA, EF Core, SQLAlchemy ORM</div>

</div>
<div>

### Repository

Sammlungsähnliche **Domänen-Abstraktion** über Mapper/ORM.

Gehört in die Domänenschicht; Implementierung in die Infrastruktur (Hexagonal).

<div class="text-xs opacity-60 mt-2">Spring Data, IRepository&lt;T&gt;</div>

</div>
</div>

<div class="mt-5 text-xs opacity-70">

Große Debatten: **Impedance Mismatch** (Neward, „The Vietnam of Computer Science“) · **Leaky Abstractions** (Spolsky) · **N+1**. <Link to="persistenz-cluster">Volle Cluster-Tabelle im Bonus</Link>.

</div>

---
hideInToc: true
---

# Repository über ORM = Anti-Pattern?

<div class="grid grid-cols-2 gap-8 mt-4">
<div>

### Position „Anti-Pattern“

- Microsoft Learn: „The Entity Framework **`DbContext`** class is based on the **Unit of Work and Repository** patterns“ → Custom-Repo darüber = Abstraktion über Abstraktion.
- **Generic Repository** (`IRepository<T>`) bringt keinen Mehrwert über `DbSet<T>`/`Session`, verletzt aber SRP.
- „Wir tauschen später das ORM aus“ — passiert fast nie.

</div>
<div>

### Position „Sinnvoll“

- DDD-Repository ≠ Generic Repository: **aggregat-spezifisch**, domänensprachliche Methoden (`findOrdersPendingPayment()`).
- **Persistence Ignorance** der Domäne.
- In-Memory-Repository ist trivialer zu schreiben als ein Mock-`DbContext`.

</div>
</div>

<div class="mt-5 text-sm opacity-70">

**Synthese:** aggregat-spezifische Domänen-Boundary (kein Generic Repository); niemals `IQueryable` herausleaken; für reine Reads lieber **Query Objects** / direkt `EntityManager`.

</div>

<!--
- Die „Anti-Pattern“-Position trifft NUR das Generic Repository (`IRepository<T>`) über einem ORM, das selbst schon Unit of Work + Repository ist.
- Das DDD-Repository ist etwas anderes: aggregat-spezifisch, domänensprachlich, Persistence Ignorance. Synthese: Boundary ja, Generic-Wrapper nein, `IQueryable` nie herausleaken.
-->

---
layout: section
routeAlias: metaprogramming
---

# 6. Metaprogramming als Pattern-Substrat

Code, der Code beobachtet oder erzeugt — das Substrat, das Proxy & Decorator _implementiert und industrialisiert_

---
hideInToc: true
---

# Das Substrat — vier Techniken, ein Zeit-Spektrum

Dynamische Proxies, AOP, Annotation Processing und Bytecode-Weaving teilen ein Merkmal: sie ziehen **Cross-Cutting-Belange** (Transaktionen, Caching, Security, Mapping, DI) aus handgeschriebenen Klassen heraus.

<div class="grid grid-cols-4 gap-4 mt-8 text-sm">
<div class="text-center">

**Laufzeit**

Dynamische Proxies (JDK / CGLIB)

</div>
<div class="text-center">

**Laufzeit**

Spring AOP (Proxy + Advice)

</div>
<div class="text-center">

**Compile-Zeit**

Annotation Processing (APT)

</div>
<div class="text-center">

**Compile/Load/Laufzeit**

Bytecode-Weaving (AspectJ)

</div>
</div>

<div class="mt-8 text-center opacity-70">

Je <strong>später und tiefer</strong> der Eingriff, desto größer die Reichweite — und desto höher die Kosten an Build-Komplexität, Debugging und „Magie“.

</div>

---
hideInToc: true
---

# Dynamische Proxies — sie _implementieren_ Proxy

<PatternTabs name="proxies" />

---
hideInToc: true
---

# Self-Invocation / Re-Entrancy — receiver-abhängig

<PatternTabs name="selfInvocation" />

<!--
- Kernargument: ob ein Selbstaufruf interzipiert wird, hängt allein an der Receiver-Bindung von `this`, nicht am Vorhandensein eines Proxys.
- Java-Proxy: `this` = Target → Selbstaufruf umgeht den Aspekt (stiller Bug). JS-Proxy: `this` = Proxy → re-entert die Trap. Das motiviert den funktionalen Gegenentwurf.
-->

---
hideInToc: true
---

# Spring AOP — industrialisiert, mit Failure Modes

<PatternTabs name="springAop" />

---
hideInToc: true
---

# Higher-Order Functions — der explizite Gegenentwurf

<PatternTabs name="hof" />

---
hideInToc: true
---

# Das Reihenfolge-Problem: Retry × Transaktion

<div class="grid grid-cols-2 gap-8 mt-4">
<div>

### Der Bug

Liegt **eine** Transaktion um **alle** Versuche, markiert schon die erste Exception die Transaktion als **rollback-only** — Spring setzt das Flag, _bevor_ der Retry greift.

→ Ein späterer, erfolgreicher Versuch ist vergeblich: Commit scheitert mit _„Transaction has been marked as rollback-only“_.

</div>
<div>

### Korrekt

**Retry außen, Transaktion innen** — jeder Versuch bekommt eine frische Transaktion.

In Annotationsform zwingend als **Cross-Bean**-Aufruf (sonst greift wegen Self-Invocation der Retry-Proxy nicht).

</div>
</div>

<div class="mt-5 text-sm opacity-70">

Weitere Reihenfolge-Fälle: **Security vor Transaktion** · **Cache vor Transaktion** · Metrik _innerhalb vs. außerhalb_ von Retry. Transparente Annotationen machen die Reihenfolge **implizit** (still falsch konfigurierbar); funktionale Komposition macht sie **explizit** — die Schachtelung _ist_ der Code.

</div>

<!--
- Der Bug: eine Transaktion um alle Retries → die erste Exception setzt rollback-only, jeder spätere Erfolg scheitert beim Commit.
- Regel: Retry AUSSEN, Transaktion INNEN — jeder Versuch eine frische Transaktion. Annotationen machen die Reihenfolge implizit (still falsch), funktionale Komposition macht sie explizit.
-->

---
hideInToc: true
---

# Annotation Processing — Magie zur Compile-Zeit

<PatternTabs name="annotationProcessing" />

---
hideInToc: true
---

# Bytecode-Weaving — der mächtigste, invasivste Punkt

<div class="grid grid-cols-3 gap-6 mt-6">
<div>

### AspectJ

Compile- oder Load-Time-Weaving (LTW via Java-Agent). **Voller Joinpoint-Umfang** — Field-Access, Konstruktoren, Self-Invocation. Löst die Spring-AOP-Grenzen, zum Preis von Build-/Agent-Komplexität.

</div>
<div>

### ByteBuddy / CGLIB

Generieren Klassen zur Laufzeit (Subclass-Proxies). ByteBuddy ist der moderne Standard; **Mockito** baut darauf.

</div>
<div>

### Hibernate

Bytecode-Enhancement (Build- oder Ladezeit) für **Lazy Loading** und **Dirty Checking**.

</div>
</div>

<div class="mt-6 text-sm opacity-70">

Weaving kann genau das, woran proxy-basiertes AOP scheitert — der ausgeführte Bytecode ≠ der geschriebene Quellcode (Debugging-Kosten). Die Industrie bewegt sich bei DI/AOP zu **Compile-Zeit** (Micronaut/Quarkus, Spring AOT/Native), getrieben von Startup-Zeit und GraalVM.

</div>

---
hideInToc: true
---

# Vergleichsmatrix der Metaprogramming-Techniken

<div class="text-xs mt-4">

| Technik                          | Zeitpunkt             | Reichweite                   | Hauptkosten                                   | Beispiele                 |
| -------------------------------- | --------------------- | ---------------------------- | --------------------------------------------- | ------------------------- |
| JDK Dynamic Proxy                | Laufzeit              | nur Interface-Methoden       | Reflection; Interface-Pflicht                 | Spring AOP, Spring Data   |
| Subclass-Proxy (CGLIB/ByteBuddy) | Laufzeit              | public, non-`final` Methoden | Klassengenerierung; `final`/`private`-Grenzen | Spring AOP, Mockito       |
| Annotation Processing (APT)      | Compile-Zeit          | generierter Quellcode        | an Build gebunden                             | Lombok, MapStruct, Dagger |
| Bytecode-Weaving                 | Compile/Load/Laufzeit | Felder, Konstruktoren, alles | Agent/Build, Debugging                        | AspectJ, Hibernate        |
| JS `Proxy` (Traps)               | Laufzeit              | jeder Property-Zugriff       | dynamisch, kein statischer Check              | Vue 3, MobX, Immer        |

</div>

---
layout: section
---

# 7. Meta-Analyse & Schluss

„GoF zielt auf alte Java/C++-Codebasen“ — teilweise korrekt, aber zu pauschal

---
hideInToc: true
---

# Fazit: „GoF zielt auf alte Java/C++-Codebasen“?

<div class="grid grid-cols-3 gap-6 mt-4">
<div>

### Pro These

- **Norvig**: 16/23 „invisible or simpler“.
- **Graham**: Muster = „sign of trouble“.
- **Gamma 2009**: „drop Singleton“; GoF nutzt C++/Smalltalk, NeXTStep — Kontext der frühen 90er.

</div>
<div>

### Contra These

- **Adapter, Facade, Composite, Bridge, Proxy** + Architektur-Muster sind sprachunabhängig.
- Selbst mit ADTs braucht man **Repository, Aggregate, Bounded Context**.
- Goetz: OO und FP **konvergieren** — nicht „Muster sind falsch“.

</div>
<div>

### Synthese

Nicht „GoF ist tot“, sondern: ein Katalog aus **drei Schichten**. Schicht 1 ersetzt, Schicht 2 leichter, Schicht 3 unberührt.

Wer die Schichten nicht trennt, irrt in **beide** Richtungen.

</div>
</div>

<!--
- Die These „GoF zielt auf alte Java/C++-Codebasen“ ist halb wahr: Schicht 1 stützt sie (Norvig/Graham/Gamma), Schicht 2/3 widerlegen sie (sprachunabhängige Struktur- und Architekturmuster).
- Pointe: nicht „tot vs. ewig“, sondern drei Schichten. Wer sie nicht trennt, irrt in beide Richtungen.
-->

---
hideInToc: true
---

# Empfehlungen

<div class="grid grid-cols-2 gap-8 mt-4">
<div>

1. **Entlang der drei Schichten lehren** — nicht Creational/Structural/Behavioral. Nur die Schichtung macht die Substitutionsachse sichtbar.
2. **Pro Muster vier Felder:** Intent → GoF-Java → moderne Entsprechung je Sprache → Status-Label.
3. **Vier Falsche-Freunde-Boxen** explizit machen.

</div>
<div>

4. **Visitor = Lehrstück Expression Problem** — warum „Lambda ersetzt Pattern X“ zu kurz greift; ADTs sind die Antwort.
5. **Builder = Lehrstück Typsystem-Ebenen** — Laufzeit-Check vs. Compile-Zeit-Kodierung vs. Problemauflösung.
6. **Metaprogramming als eigene Kategorie** — das Spektrum Laufzeit-Proxy → APT → Weaving ordnet die Industrie-Bewegung zu GraalVM/AOT.

</div>
</div>

<div class="mt-5 text-xs opacity-60">

Schwellen, die das Bild kippen: Java „carrier classes“/Record-`with`-Evolution → Builder von [RELEVANT] auf [ERSETZT]. JEP 8303099 von Draft auf GA → die Builder- und null-Safety-Einordnung neu prüfen (vermutlich weiterhin „kein Typestate“).

</div>

---
layout: section
---

# 8. Pattern × Sprache

Die große Landkarte: weiterhin idiomatisch · moderner Ersatz · trifft nicht zu

---
hideInToc: true
---

# Pattern × Sprache — Schicht 1 (Verhalten)

<PatternLanguageMatrix :keys="['singleton','strategy','template','observer','iterator','visitor','state','nullobj']" />

<!--
- Zellen sind anklickbar (Details als Popup).
- Schicht 1 ist mehrheitlich ↻ (moderner Ersatz durch Sprachfeatures).
- Sprachen ohne ADTs/Nullability (Go) zeigen mehr ✓ („relevant“) bei Visitor/State/Null Object.
-->

---
hideInToc: true
---

# Pattern × Sprache — Builder · Struktur · Architektur

<PatternLanguageMatrix :keys="['builder','lazyinit','decorator','adapter','proxy','valueobj','repository','factory']" />

<!--
- Schicht 2/3 ist mehrheitlich ✓ (weiterhin relevant); Value Object & Factory sind die Ausnahmen (↻).
- Builder ist sprachabhängig: Java/Go/Rust ✓ (Idiom nötig), Kotlin/TS/Python ↻ (named/default args).
-->

---
layout: section
---

# Bonusmaterial

Persistenz-Cluster · Querverweise · Quellen

---
hideInToc: true
routeAlias: persistenz-cluster
---

# Persistenz-Pattern: sieben Cluster

<PersistencePatternsMatrix />

<!--
- Kernanliegen: „jOOQ vs. Hibernate“ ist nicht „Query Builder vs. ORM“ als wertende Wahl,
  sondern „SQL ist Wahrheit“ vs. „Objekt-Graph ist Wahrheit“.
- Datomic ist KEINE ORM-Alternative, sondern ein anderes Datenmodell (Datalog/EAVT).
-->

---
hideInToc: true
---

# Querverweise

<TalkXrefPanel
  variant="neutral"
  :here="{
    title: 'Entwurfsmuster 2026',
    bullets: [
      '<strong>Drei Schichten:</strong> was die Sprache übernimmt, was bleibt',
      'Builder als Lehrstück für <strong>Typsystem-Ebenen</strong> (Laufzeit → Staged → named/default args)',
      'Visitor → ADTs; Metaprogramming <em>implementiert</em> Proxy',
    ],
  }"
  :refs="[
    {
      slug: '20260428-java-null-pointer',
      anchor: 'native-null-types',
      bullets: [
        '<strong>Warum</strong> null-Safety dem Builder keine Compile-Zeit-Pflichtfelder gibt (JEP 8303099)',
        'Null Object → <code>Optional</code>/Nullability; JSpecify, NullAway',
      ],
    },
    {
      slug: '20260522-open-rewrite',
      anchor: 'recipe-mechanik',
      bullets: [
        'Muster-Migration <strong>mechanisch</strong>: <code>ChangeType</code>, sealed-/Visitor-Recipes',
        '<code>JavaIsoVisitor</code> — dasselbe double dispatch, jetzt als Recipe-Mechanik',
      ],
    },
  ]"
/>

---
hideInToc: true
---

# Einschränkungen & Quellen

<div class="grid grid-cols-2 gap-8 mt-4 text-sm">
<div>

### Primärquellen

- GoF 1994 · Bloch, _Effective Java_ Item 3
- Norvig, _Design Patterns in Dynamic Programming_ (norvig.com)
- Fowler, _PoEAA_ + bliki (ValueObject, EvansClassification) · Evans, _DDD_ 2003
- OpenJDK: JEP 395 (record), 409 (sealed), 440/441 (pattern matching), **8303099** (null-safety, _Draft_)
- Goetz, _Data Oriented Programming in Java_ · kotlinlang.org · docs.spring.io
- Lazy Init: Beck, _Smalltalk Best Practice Patterns_ (1997) · Fowler, _PoEAA_ „Lazy Load“ · Pugh u. a., „Double-Checked Locking is Broken“ + JSR-133 (Java 5) · JEP 502/526/531 (Stable Values → Lazy Constants) · Rust 1.70 / 1.80 Release-Notes

</div>
<div>

### Einschränkungen

- **JEP 8303099 ist Draft** — Syntaxdetails sind „strawman/TBD“. null-Safety ist in **keinem** Release; die Aussagen zu Builder & null-Safety sind Designanalyse.
- Java-Beispiele setzen **Java 21** voraus (sealed ab 17, record ab 16, Pattern Matching final ab 21).
- Norvigs 16/23 summiert die genannten Kategorien; 7 bleiben auch dynamisch „echte“ Muster.
- Beispiele sind didaktisch reduziert (Imports, Fehlerbehandlung teils ausgelassen).

</div>
</div>

---
layout: end
---

Entwurfsmuster 2026 — drei Schichten, ein Katalog. Danke!

---
layout: default
title: Selbsttest
hideInToc: true
---

<div class="text-2xl font-semibold mb-2">Selbsttest</div>

<DesignPatternQuiz />

<!--
- Hinter der End-Slide: Selbststudium nach dem Vortrag. Adaptiv — startet
  mittel, passt sich der Antwortqualität an.
- Fragenpool via Web-Recherche + Fable-Generierung + adversariale Auswahl;
  depends-lastig („hängt von der Sprache ab"), Transfer-Sektion verlinkt den
  java-null-Talk (JEP 8303099, Staged Builder vs. @NonNull).
-->
