# Klassische Software-Engineering-Muster und ihre modernen Entsprechungen — Strukturierte Übersicht mit Code (JVM-Fokus)

> **Version 5.** Gegenüber v4: (1) §4.1 Singleton — die Java-Idiome mit **JLS-Referenzen** unterlegt (§12.4.1/§12.4.2 Klassen-Init-Lock, §17.4.5/§8.3.1.4 volatile, §8.9 Enum) plus **GraalVM-Native-Image-Portabilität**; (2) neues **§9.3** zum receiver-abhängigen **Self-Invocation-/Re-Entrancy-Problem** (Spring vs. JS `Proxy` vs. andere Sprachen, inkl. Rekursion); (3) neues Kapitel **§11 — Higher-Order Functions als Gegenentwurf** (TransactionTemplate/RetryTemplate, Resilience4j `Decorators`, React HOC u.a.); (4) **§11.3 Reihenfolge-Problem** (Retry × Transaktion, Resilience4j feste Aspekt-Reihenfolge, Security/Cache/Metrik). Kapitel ab Annotation Processing zu §12–17 umnummeriert.
>
> **Version 4.** Gegenüber v3: §5.2 (Staged Builder) um zwei verifizierte Grenzen erweitert — §5.2.1 **kombinatorische Explosion** bei beliebiger Feld-Reihenfolge (2ᴺ Interfaces; dokumentierte Lombok-Begründung gegen einen Staged-Modus) inkl. TypeScript-/Rust-Gegenbeispiel mit type-level set tracking; §5.2.2 **Builder + Vererbung** (Self-Type-Pattern, Lombok `@SuperBuilder`).
>
> **Version 3.** Gegenüber v2: §8 zu einem eigenständigen Teil **III — „Metaprogramming als Pattern-Substrat"** ausgebaut (dynamische Proxies, AOP, Annotation Processing, Bytecode-Weaving als gemeinsame Kategorie). **Builder** erhält ein eigenes Kapitel mit Staged/Step-Builder-Code und dem Vergleich „named + optionale / Default-Parameter" quer durch Kotlin, Scala, Python, TypeScript, Go, Rust. Jedes relevante Muster bekommt Code: Original in Java → moderner Java-Ersatz → weitere Ökosysteme **nur dort, wo sie eine neue Erkenntnis hinzufügen**.

## Inhaltsverzeichnis

- **Teil I — Grundlagen & Taxonomie**
  - 1. Drei-Schichten-Taxonomie
  - 2. Faktencheck der Nutzer-Thesen (Verdikte)
  - 3. Übersichts-Matrix
- **Teil II — Muster mit Code-Beispielen**
  - 4. Schicht 1: Sprachdefizit-Workarounds (Singleton, Strategy, Template Method, Observer, Iterator, Visitor, State, Null Object)
  - 5. Sonderfall Builder (klassisch · Staged Builder · kombinatorische Explosion · Vererbung/`@SuperBuilder` · named/default-Params quer durch die Sprachen)
  - 6. Schicht 2: Strukturmuster (Decorator, Adapter)
  - 7. Schicht 3: Architektur-/DDD-Muster (Value Object, Repository)
- **Teil III — Metaprogramming als Pattern-Substrat**
  - 8. Kategorie & Einordnung
  - 9. Dynamische Proxies (Java, JavaScript) — inkl. 9.3 Self-Invocation/Re-Entrancy (receiver-abhängig)
  - 10. Spring AOP (deklarative Aspekte + Failure Modes)
  - 11. Higher-Order Functions als Gegenentwurf (TransactionTemplate/RetryTemplate, Resilience4j, React HOC) + Reihenfolge-Problem
  - 12. Annotation Processing (Compile-Zeit-Codegen)
  - 13. Bytecode-Weaving
  - 14. Vergleichsmatrix der Metaprogramming-Techniken
- **Teil IV — Meta-Analyse & Schluss**
  - 15. Bewertung der These „GoF zielt auf legacy Java/C++"
  - 16. Empfehlungen
  - 17. Caveats & Quellen

---

## TL;DR

- **Substitution ist real, aber selektiv.** 16 der 23 GoF-Muster sind laut Norvig in höheren Sprachen „either invisible or simpler" — substituiert durch first-class functions, sum types/ADTs, null-safety, named/default args. Ein hartes Drittel (Adapter, Facade, Composite, Proxy, Repository, Architektur-Muster) bleibt sprachunabhängig relevant.
- **Drei Schichten, nicht drei GoF-Familien.** Schicht 1 (Sprachdefizit-Workarounds) wird durch Sprachfeatures ersetzt; Schicht 2 (Strukturmuster) bleibt mit leichteren Implementierungen; Schicht 3 (Architektur/DDD) ist von der Substitution unberührt. Wer das nicht trennt, irrt in beide Richtungen.
- **Builder ist der Lehrfall für Typsystem-Grenzen.** Geplante Java-null-Safety (JEP 8303099) erzwingt Pflichtfelder NICHT zur Compile-Zeit. Compile-zeit-sicher ist nur der Staged Builder (Interface-Kette) — oder man umgeht das Muster ganz mit named/default-Konstruktor-Parametern (Kotlin/Scala/Python/TS), was den Builder überflüssig macht. Go (functional options) und Rust (typestate / `build() -> Result`) zeigen die beiden Endpunkte.
- **Metaprogramming ist das eigentliche Substrat hinter „Proxy & Spring-Magie".** Dynamische Proxies _implementieren_ das Proxy-Pattern (statt es zu ersetzen) und subsumieren Decorator. Spring AOP industrialisiert das zu deklarativen Aspekten — mit dokumentierten Failure Modes (Self-Invocation, `final`, nur Method-Execution-Joinpoints). Annotation Processing (Compile-Zeit) und Bytecode-Weaving sind die anderen Punkte auf demselben Spektrum.

---

# Teil I — Grundlagen & Taxonomie

## 1. Drei-Schichten-Taxonomie

GoF (Gamma/Helm/Johnson/Vlissides, 1994) ordnet seine 23 Muster in **Creational / Structural / Behavioral**. Für die Substitutionsfrage ist diese Einteilung irreführend, weil sie drei sehr unterschiedliche Abstraktionsebenen vermischt. Nützlicher ist folgende Schichtung:

- **Schicht 1 — Sprachdefizit-Workarounds.** Muster, die fehlende Sprachfeatures kompensieren: fehlende first-class functions (Strategy, Command, Template Method, Visitor-Teilfall), fehlende ADTs/sum types (Visitor, State, Interpreter), fehlende null-safety (Null Object), fehlende Sprach-Singletons (Singleton). → In modernen Sprachen weitgehend **durch Features ersetzt**.
- **Schicht 2 — echte Strukturmuster.** Adapter, Facade, Composite, Decorator, Proxy, Bridge. Sprachunabhängige Strukturierung von Objektgeflechten. → **Bleiben relevant**, oft mit leichterer Implementierung.
- **Schicht 3 — Architektur-/Persistenz-Muster.** DDD-Taktik (Entity, Value Object, Aggregate, Repository, Factory, Service) und PoEAA (Active Record, Data Mapper, Unit of Work, Service Layer, DTO …). → Von der Substitutionsdebatte **praktisch unberührt**; Value Object ist die Ausnahme (Implementierung durch records/data classes ersetzt).

Weitere klassische Kataloge im selben historischen OOP-Kontext: PoEAA (Fowler, 2002), DDD (Evans, 2003), Enterprise Integration Patterns (Hohpe/Woolf, 2003), GRASP (Larman, Heuristiken statt Implementierungsmuster).

## 2. Faktencheck der Nutzer-Thesen (Verdikte)

| #   | These                                             | Verdict                                   | Kern (Detail + Code im genannten Kapitel)                                                                                                        |
| --- | ------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Singleton ← Companion Object (Kotlin/Scala)       | **Begrifflich falsch, Intention korrekt** | Kotlin-Singleton = `object` declaration; `companion object` ist an eine Klasse gebunden (≈ statische Member). Scala `object` korrekt. → §4.1     |
| 2   | Singleton ← `enum` (Java)                         | **Korrekt**                               | Bloch, _Effective Java_ Item 3: „a single-element enum type is the best way to implement a singleton". → §4.1                                    |
| 3   | Singleton ↔ Spring DI Singleton-Scope            | **Korrekt mit Caveat**                    | Default-Scope, aber **per-Container/per-Bean**, nicht per-ClassLoader wie GoF. → §4.1                                                            |
| 4   | Visitor ← Lambda                                  | **Größtenteils falsch**                   | Visitor löst Expression Problem via double dispatch; Lambda ersetzt nur den Single-Method-Fall. Korrekt: sealed types + pattern matching. → §4.6 |
| 5   | Builder-Pflichtfelder ← geplante Java-null-Safety | **These bestätigt: erzwingt NICHT**       | Kein Typestate/Dependent Type; null-Safety greift erst zur Laufzeit bei `build()`. Compile-zeit-sicher nur Staged Builder. → §5                  |
| 6   | Dynamische Proxies / Spring ersetzen Muster       | **Begriff zu grob**                       | Proxies _implementieren_ Proxy, subsumieren Decorator; Spring AOP industrialisiert. → Teil III                                                   |

Belege (Primärquellen): Bloch _Effective Java_ Item 3; Spring-Referenzdoku zum Singleton-Scope („per container and per bean", explizit abgegrenzt vom GoF-Singleton „per ClassLoader"); Kotlin-Doku zu `object`/`companion object`; JEP 441 (Pattern Matching for `switch`, final JDK 21); JEP 8303099 (Null-Restricted/Nullable Types, Status Draft).

## 3. Übersichts-Matrix

Status-Labels: **[ERSETZT]** durch Sprachfeature obsolet · **[KONZEPT]** Idee bleibt, GoF-Implementierung veraltet · **[RELEVANT]** weiterhin idiomatisch · **[SPRACHABH.]** sprachabhängig.

| Muster                            | Schicht | Status                 | Moderne Entsprechung (Kurz)                                       | Kapitel     |
| --------------------------------- | ------- | ---------------------- | ----------------------------------------------------------------- | ----------- |
| Singleton                         | 1       | [ERSETZT]/[KONZEPT]    | Kotlin `object`, Java `enum`, DI-Scope; Globalstate-Kritik bleibt | §4.1        |
| Strategy                          | 1       | [ERSETZT]              | first-class functions / Lambdas                                   | §4.2        |
| Command                           | 1       | [ERSETZT]              | Lambdas / Funktionsobjekte                                        | §4.2        |
| Template Method                   | 1       | [ERSETZT]/[KONZEPT]    | higher-order functions                                            | §4.3        |
| Observer                          | 1       | [KONZEPT]              | reaktive Streams / Flow / Signals                                 | §4.4        |
| Iterator                          | 1       | [ERSETZT]              | eingebaute Iterationsprotokolle / Generatoren / Iterator-Traits   | §4.5        |
| Visitor                           | 1       | [ERSETZT durch ADTs]   | sealed types + pattern matching                                   | §4.6        |
| State                             | 1       | [KONZEPT]/[ERSETZT]    | sealed/enum + matching; Rust-Typestate                            | §4.7        |
| Null Object                       | 1       | [ERSETZT]              | `Optional`/`Option`, Nullability                                  | §4.8        |
| Builder                           | 1/2     | [SPRACHABH.]           | named/default args; Staged Builder; functional options            | §5          |
| Factory Method / Abstract Factory | 1/3     | [KONZEPT]              | DI-Container, Factory-Funktionen                                  | (Prosa §16) |
| Prototype                         | 2       | [SPRACHABH.]           | `copy()` / `Clone` / structuredClone                              | (Prosa §7)  |
| Decorator                         | 2       | [RELEVANT]             | Komposition; Kotlin `by`-Delegation                               | §6.1        |
| Adapter                           | 2       | [RELEVANT]             | bleibt; strukturelle Typisierung reduziert Bedarf                 | §6.2        |
| Facade / Composite / Bridge       | 2       | [RELEVANT]             | Strukturkonzepte; ADTs für Composite                              | (Prosa §6)  |
| Proxy                             | 2       | [KONZEPT]/[SPRACHABH.] | dynamische Proxies/AOP **implementieren** es                      | Teil III    |
| Chain of Responsibility           | 2       | [KONZEPT]              | Middleware-Pipelines, funktionale Komposition                     | (Prosa)     |
| Flyweight                         | 2       | [KONZEPT]              | Caching/Interning                                                 | (Prosa)     |
| Value Object (DDD)                | 3       | [ERSETZT (Impl.)]      | `record` / `data class` / `struct` / frozen dataclass             | §7.1        |
| Repository (DDD)                  | 3       | [RELEVANT]             | Spring Data / JPA (generiert)                                     | §7.2        |
| Active Record vs Data Mapper      | 3       | [RELEVANT]             | ORM-Designentscheidung                                            | §7.2        |

---

# Teil II — Muster mit Code-Beispielen

## 4. Schicht 1 — Sprachdefizit-Workarounds

### 4.1 Singleton — [ERSETZT] / [KONZEPT]

**Original (Java).** Die volle Zeremonie: privater Konstruktor, statisches Feld, thread-sichere Lazy-Initialisierung via Double-Checked Locking (`volatile` ist hier zwingend, sonst ist das DCL kaputt).

```java
public final class Registry {
    private static volatile Registry instance;     // volatile: Pflicht für korrektes DCL
    private Registry() { }                          // verhindert externe Instanziierung

    public static Registry getInstance() {
        if (instance == null) {                     // 1. Check ohne Lock
            synchronized (Registry.class) {
                if (instance == null) {             // 2. Check mit Lock
                    instance = new Registry();
                }
            }
        }
        return instance;
    }
}
```

**Moderner Java-Ersatz A — `enum` (Bloch, Item 3).** Thread-sichere Initialisierung durch die JVM, serialisierungs- und reflexionssicher, ohne jede Boilerplate.

```java
public enum Registry {
    INSTANCE;                                       // das einzige Element IST das Singleton
    public void register(String key) { /* ... */ }
}
// Nutzung: Registry.INSTANCE.register("x");
```

**Moderner Java-Ersatz B — Initialization-on-Demand-Holder.** Wenn `enum` ausscheidet (z.B. weil eine Oberklasse erweitert werden muss), ist dies das idiomatische lazy + thread-sichere Idiom ohne `synchronized`: Die innere Klasse wird durch die ClassLoader-Semantik garantiert erst beim ersten Zugriff und genau einmal geladen.

```java
public final class Registry {
    private Registry() { }
    private static class Holder {                   // lazy: erst bei erstem getInstance() geladen
        static final Registry INSTANCE = new Registry();
    }
    public static Registry getInstance() { return Holder.INSTANCE; }
}
```

**Sprachkonformität (JLS) — keine Implementierungsdetails, kein undefiniertes Verhalten.** Alle drei Java-Idiome stützen sich auf garantierte Zusicherungen der _Java Language Specification_ (JLS, Referenz: Java SE 21), nicht auf JVM-Eigenheiten. Damit verhalten sie sich auf jeder konformen Implementierung identisch:

- **`enum`-Singleton:** Enum-Konstanten sind implizit `public static final` und werden im statischen Initialisierer der Enum-Klasse erzeugt (JLS §8.9 _Enum Classes_). Dass dies **genau einmal und thread-sicher** geschieht, garantiert das Klassen-Initialisierungsverfahren in **JLS §12.4.2** _(Detailed Initialization Procedure)_: pro Klasse C existiert ein eindeutiges Initialisierungs-Lock LC, unter dem der Initialisierer läuft; die Freigabe des Locks etabliert die `happens-before`-Beziehung zu allen Lesern (JLS §17.4.4). Reflexionssicherheit folgt daraus, dass Enum-Konstruktoren nicht reflektiv aufrufbar sind (JLS §8.9; `Constructor.newInstance` wirft für Enum-Typen). Serialisierungssicherheit liefert die _Java Object Serialization Specification_ (Enum-Konstanten werden über ihren Namen serialisiert und auf die kanonische Instanz aufgelöst; eigene `readObject`/`readResolve` werden ignoriert) — das meint Bloch mit „serialization machinery for free" (Item 3).
- **Initialization-on-Demand-Holder:** _Lazy_ ist garantiert durch **JLS §12.4.1** _(When Initialization Occurs)_ — eine Klasse wird erst bei ihrer ersten aktiven Nutzung initialisiert (hier: der erste Lesezugriff auf das Nicht-Konstanten-Feld `Holder.INSTANCE`). _Thread-sicher und genau einmal_ wiederum durch §12.4.2. Kein `synchronized`, kein `volatile` nötig.
- **Double-Checked Locking:** korrekt **nur mit** `volatile` — die `volatile`-Schreib/Lese-Operation etabliert die nötige `happens-before`-Ordnung (JLS §17.4.5 _Happens-before Order_; §8.3.1.4 _volatile Fields_). Ohne `volatile` ist das Idiom kaputt (das ist der Kern der „Double-Checked Locking is Broken"-Deklaration von 2000, behoben durch das Java-5-Memory-Model).

**Portabilität inkl. GraalVM Native Image.** Weil die Korrektheit auf JLS-Garantien (§12.4.2, §17.4.5) beruht und nicht auf einer konkreten JVM, gelten die Idiome auch unter AOT-Compilern. GraalVM Native Image bewahrt die Klassen-Initialisierungssemantik ausdrücklich, egal ob eine Klasse zur **Build-Zeit** oder zur **Laufzeit** initialisiert wird — die Init-Checks „can not be removed as this would break Java semantics", und seit GraalVM 19.0 werden Anwendungs­klassen standardmäßig zur Laufzeit initialisiert (also bleibt das Holder-Idiom lazy). Einzige Native-Image-spezifische Vorsicht: Wird eine Klasse zur Build-Zeit initialisiert, wird ihr statischer Zustand in den Image-Heap eingefroren; ein Singleton, dessen Initialisierer laufzeit­abhängigen Zustand (Umgebung, Dateien, Uhrzeit) lesen muss, sollte daher laufzeit-initialisiert bleiben. Das ist eine Konfigurationsfrage, kein Bruch der Sprachkonformität.

**Kotlin — `object` (das eigentliche Singleton-Idiom).** Lazy und thread-sicher per Sprache.

```kotlin
object Registry {                                   // echtes Singleton
    fun register(key: String) { /* ... */ }
}
// Nutzung: Registry.register("x")
```

**Kotlin — `companion object` ist NICHT dasselbe (Falscher Freund).** An die umschließende Klasse gebunden, ~ statische Member, beim Klassenladen initialisiert. Kein global eigenständiges Singleton.

```kotlin
class HttpClient private constructor() {
    companion object {                              // ≈ Java-static, an HttpClient gebunden
        fun create(): HttpClient = HttpClient()
    }
}
// Zugriff nur über die Klasse: HttpClient.create()
```

**Rust — bewusst unbequem (`OnceLock`).** Es gibt kein einfaches mutables globales Singleton, weil Ownership/Aliasing das verbieten. Für lazy globale, unveränderliche Werte ist `std::sync::OnceLock` (stabil seit 1.70) idiomatisch. Die Reibung ist Absicht — sie drängt zu Dependency-Übergabe (≈ DI).

```rust
use std::sync::OnceLock;

struct Registry { /* ... */ }

fn registry() -> &'static Registry {
    static INSTANCE: OnceLock<Registry> = OnceLock::new();
    INSTANCE.get_or_init(|| Registry { /* ... */ })   // einmalige, thread-sichere Init
}
```

**Go — `sync.Once`.** Das idiomatische lazy, thread-sichere Singleton auf Paketebene.

```go
package registry

import "sync"

type Registry struct{ /* ... */ }

var (
    instance *Registry
    once     sync.Once
)

func Get() *Registry {
    once.Do(func() { instance = &Registry{} })     // genau einmal, thread-sicher
    return instance
}
```

**Spring DI — der pragmatische Industrie-Weg.** Default-Scope `singleton` heißt **eine Instanz pro `ApplicationContext`**, injiziert statt global gezogen — und damit testbar (man kann eine Mock-Instanz injizieren). Semantisch nicht der GoF-Singleton (der ist per-ClassLoader hartkodiert).

```java
@Component                                          // Default-Scope: eine Instanz pro Container
public class Registry { /* ... */ }
// Verwendung via Konstruktor-Injektion, kein getInstance():
@Service
class UserService {
    private final Registry registry;
    UserService(Registry registry) { this.registry = registry; }
}
```

**Erkenntnis-Bilanz.** Die GoF-Boilerplate ist überall durch ein Sprach- oder Framework-Feature ersetzt. Was _nicht_ verschwindet, ist das eigentliche Problem des Singletons: globaler, schwer mockbarer Zustand. `object`/`enum` sind genauso schwer auszutauschen wie ein klassisches Singleton; DI ist die einzige Variante, die das Testbarkeitsproblem löst.

### 4.2 Strategy (und Command) — [ERSETZT]

**Original (Java).** Ein Interface, eine Implementierungshierarchie, manuelle Verdrahtung.

```java
interface DiscountStrategy {
    BigDecimal apply(BigDecimal price);
}
class NoDiscount implements DiscountStrategy {
    public BigDecimal apply(BigDecimal price) { return price; }
}
class TenPercent implements DiscountStrategy {
    public BigDecimal apply(BigDecimal price) {
        return price.multiply(new BigDecimal("0.9"));
    }
}
class Checkout {
    private final DiscountStrategy strategy;
    Checkout(DiscountStrategy strategy) { this.strategy = strategy; }
    BigDecimal total(BigDecimal price) { return strategy.apply(price); }
}
```

**Moderner Java-Ersatz — die Strategy IST eine Funktion.** Der Interface-Zoo entfällt; `UnaryOperator`/`Function` aus `java.util.function` genügt.

```java
UnaryOperator<BigDecimal> tenPercent = p -> p.multiply(new BigDecimal("0.9"));
UnaryOperator<BigDecimal> noDiscount = UnaryOperator.identity();

class Checkout {
    private final UnaryOperator<BigDecimal> discount;          // Strategy als Funktionstyp
    Checkout(UnaryOperator<BigDecimal> discount) { this.discount = discount; }
    BigDecimal total(BigDecimal price) { return discount.apply(price); }
}
// new Checkout(tenPercent).total(new BigDecimal("100"));
```

**Rust — Closure als generischer Typparameter (zero-cost).** Die Strategy ist ein durch `Fn` beschränkter generischer Parameter; der Compiler monomorphisiert, also kein virtueller Aufruf. (Für dynamische Auswahl zur Laufzeit: `Box<dyn Fn(f64) -> f64>`.)

```rust
struct Checkout<F: Fn(f64) -> f64> {
    discount: F,
}
impl<F: Fn(f64) -> f64> Checkout<F> {
    fn total(&self, price: f64) -> f64 { (self.discount)(price) }
}
let ten_percent = |p: f64| p * 0.9;
let c = Checkout { discount: ten_percent };
// c.total(100.0);
```

**Go — benannter Funktionstyp.** First-class functions, der Typ wird nur zur Lesbarkeit benannt.

```go
type Discount func(float64) float64                 // Strategy als Funktionstyp

func total(price float64, d Discount) float64 { return d(price) }

tenPercent := func(p float64) float64 { return p * 0.9 }
// total(100, tenPercent)
```

**Command** ist derselbe Mechanismus mit anderem Intent: ein gekapselter Aufruf. Modern ein `Runnable`/`Supplier`-Lambda statt einer Command-Klasse. Nur die Undo/Redo-Variante braucht noch ein Objekt mit Zustand (für die inverse Operation). Erkenntnis: Strategy, Command und Template Method (§4.3) sind dieselbe Substitution — „Verhalten als Wert übergeben" — und in jeder Sprache mit first-class functions schlicht kein benennenswertes Muster mehr.

### 4.3 Template Method — [ERSETZT] / [KONZEPT]

**Original (Java).** Festes Skelett in einer `final`-Methode, variable Schritte als abstrakte Hooks, Variation über Vererbung.

```java
abstract class ReportGenerator {
    public final String generate() {                // Template-Methode: Ablauf fixiert
        return header() + body() + footer();
    }
    protected String header() { return "=== Report ===\n"; }
    protected abstract String body();               // Hook: Subklasse füllt
    protected String footer() { return "\n=== Ende ==="; }
}
class SalesReport extends ReportGenerator {
    protected String body() { return "Umsatz: 42"; }
}
```

**Moderner Java-Ersatz — Hook als Funktionsparameter.** Komposition statt Vererbung; keine Subklasse nötig.

```java
String generate(Supplier<String> body) {            // Skelett als Funktion, Hook injiziert
    return "=== Report ===\n" + body.get() + "\n=== Ende ===";
}
// generate(() -> "Umsatz: 42");
```

**Kotlin — noch knapper mit Trailing-Lambda.**

```kotlin
fun report(body: () -> String) =
    "=== Report ===\n${body()}\n=== Ende ==="

report { "Umsatz: 42" }                             // Trailing-Lambda: idiomatischer Hook
```

Erkenntnis: Das „invariant skeleton + variable steps" überlebt als Konzept (z.B. in funktionaler Komposition `before andThen after`), aber die vererbungsbasierte Implementierung ist obsolet.

### 4.4 Observer — [KONZEPT]

**Original (Java).** Handgepflegte Listener-Liste. Schwächen direkt im Code sichtbar: enge Kopplung, kein erzwungenes `unsubscribe` (Memory-Leak-Risiko), synchroner Aufruf, kein Error-/Completion-Signal.

```java
interface PriceObserver { void priceChanged(BigDecimal newPrice); }

class Stock {
    private final List<PriceObserver> observers = new ArrayList<>();
    private BigDecimal price;

    void subscribe(PriceObserver o) { observers.add(o); }   // kein unsubscribe-Zwang
    void setPrice(BigDecimal p) {
        this.price = p;
        for (var o : observers) o.priceChanged(p);          // synchron, kein Fehlerkanal
    }
}
```

**Modern — Kotlin `Flow`/`StateFlow`.** Verallgemeinert Observer um Operatoren (`map`/`filter`), Completion/Error, Backpressure und vor allem lebenszyklusgebundene Cancellation über den Coroutine-Scope.

```kotlin
class Stock {
    private val _price = MutableStateFlow(BigDecimal.ZERO)
    val price: StateFlow<BigDecimal> = _price.asStateFlow()  // hot stream, hält aktuellen Wert
    fun setPrice(p: BigDecimal) { _price.value = p }
}

// Consumer — Cancellation/Lifecycle kommen vom umgebenden CoroutineScope:
suspend fun observe(stock: Stock) {
    stock.price
        .map { it.multiply(BigDecimal("1.19")) }             // Operator-Pipeline
        .collect { println(it) }                             // terminale Operation
}
```

Erkenntnis: Niemand schreibt für nicht-triviale Fälle noch `addObserver`/`notifyObservers`. Reactive Streams (RxJava, Reactor) und Flow sind die Verallgemeinerung; Roman Elizarov beschreibt Rx explizit als Observer-Pattern mit Callbacks pro emittiertem Element plus Operatoren. Im Frontend übernehmen Signals (Angular/Solid/Svelte) dieselbe Rolle.

### 4.5 Iterator — [ERSETZT]

**Original (Java).** Eigener Iterator von Hand. Man schreibt das praktisch nie selbst, weil das Muster als `Iterable` + for-each in der Sprache steckt.

```java
class Range implements Iterable<Integer> {
    private final int from, to;
    Range(int from, int to) { this.from = from; this.to = to; }

    public Iterator<Integer> iterator() {
        return new Iterator<>() {                   // anonymer Iterator
            int cur = from;
            public boolean hasNext() { return cur < to; }
            public Integer next() { return cur++; }
        };
    }
}
// for (int i : new Range(0, 3)) { /* 0, 1, 2 */ }
```

**Rust — `Iterator`-Trait mit lazy, zero-cost Adaptern.** `map`/`filter` allozieren nichts und werden monomorphisiert (keine virtuellen Aufrufe).

```rust
let sum: i32 = (0..3)                               // Range implementiert Iterator
    .filter(|n| n % 2 == 0)                         // lazy
    .map(|n| n * 10)                                // lazy
    .sum();                                         // terminale Operation treibt die Iteration
```

**Python — Generator.** Das Iterator-Protokoll wird vom Compiler erzeugt; `yield` hält den Zustand.

```python
def squares(n):
    for i in range(n):
        yield i * i                                 # lazy; Zustand sprachverwaltet

list(squares(3))                                    # [0, 1, 4]
```

Erkenntnis: Iterator ist das Paradebeispiel eines vollständig in die Sprache absorbierten Musters. Der interessante Unterschied liegt in der _Lazy-/Zero-Cost_-Eigenschaft (Rust, Kotlin `Sequence`, Java `Stream`) gegenüber dem strikten GoF-Iterator.

### 4.6 Visitor — [ERSETZT durch ADTs] _(Kernbeispiel: Expression Problem)_

Dies ist der Lehrfall dafür, warum „Lambda ersetzt Pattern X" zu kurz greift. Der Visitor löst das **Expression Problem** via **double dispatch**: Operationen auf einer geschlossenen Typhierarchie hinzufügen, ohne die Typen zu ändern, mit Vollständigkeitsprüfung.

**Original (Java) — double dispatch.** Der `accept`/`visit`-Tanz ist der GoF-Mechanismus. (Die `record`s dienen nur der Kürze; entscheidend ist das doppelte Dispatch.)

```java
interface ExprVisitor<R> {
    R visitNum(Num n);
    R visitAdd(Add a);
}
interface Expr { <R> R accept(ExprVisitor<R> v); }

record Num(int value) implements Expr {
    public <R> R accept(ExprVisitor<R> v) { return v.visitNum(this); }   // dispatch 1: Typ -> visitX
}
record Add(Expr left, Expr right) implements Expr {
    public <R> R accept(ExprVisitor<R> v) { return v.visitAdd(this); }
}

class EvalVisitor implements ExprVisitor<Integer> {                       // eine Operation = eine Klasse
    public Integer visitNum(Num n) { return n.value(); }
    public Integer visitAdd(Add a) {
        return a.left().accept(this) + a.right().accept(this);            // dispatch 2: Rekursion
    }
}
```

Die Zeremonie kostet: jede **neue Operation** ist eine neue Visitor-Klasse; jeder **neue Knotentyp** zwingt zur Änderung des Visitor-Interfaces _und aller_ Visitor-Implementierungen. Genau diese Asymmetrie ist der Kern des Expression Problems.

**Moderner Java 21-Ersatz — sealed + Pattern-Switch.** Die geschlossene Hierarchie ist `sealed`; der `switch` deckt sie ab, der Compiler prüft Vollständigkeit über `permits`, das Record-Pattern dekonstruiert direkt.

```java
sealed interface Expr permits Num, Add {}
record Num(int value) implements Expr {}
record Add(Expr left, Expr right) implements Expr {}

static int eval(Expr e) {
    return switch (e) {                             // Vollständigkeit vom Compiler geprüft
        case Num(int v)          -> v;              // Record-Pattern dekonstruiert
        case Add(Expr l, Expr r) -> eval(l) + eval(r);
    };                                              // kein default nötig (sealed = erschöpfend)
}
```

Eine **neue Operation** ist jetzt eine neue Funktion (kein Eingriff in die Typen); ein **neuer Knotentyp** erweitert `permits`, woraufhin der Compiler _jeden_ `switch` als unvollständig markiert, der ihn nicht behandelt — die fehlerträchtige Handarbeit des Visitors wird zur Compile-Zeit-Garantie.

**Rust — `enum` + `match`.** Genau dieselbe Idee, nur dass Rust hier von Anfang an stand.

```rust
enum Expr {
    Num(i32),
    Add(Box<Expr>, Box<Expr>),                      // Box wegen rekursiver Größe
}
fn eval(e: &Expr) -> i32 {
    match e {                                        // erschöpfend erzwungen
        Expr::Num(v)    => *v,
        Expr::Add(l, r) => eval(l) + eval(r),
    }
}
```

**TypeScript — Discriminated Union.** Strukturell statt nominal; Vollständigkeit nicht eingebaut, aber über einen `never`-Trick erzwingbar.

```typescript
type Expr =
  | { kind: "num"; value: number }
  | { kind: "add"; left: Expr; right: Expr };

function evaluate(e: Expr): number {
  switch (e.kind) {
    case "num":
      return e.value;
    case "add":
      return evaluate(e.left) + evaluate(e.right);
    default: {
      const _exhaustive: never = e; // Compile-Fehler, falls ein Fall fehlt
      return _exhaustive;
    }
  }
}
```

**Scala — sealed trait + case classes.** Zur Erinnerung an die Chronologie: Scala konnte das 2004, Java zog 2021 nach.

```scala
sealed trait Expr
case class Num(value: Int) extends Expr
case class Add(left: Expr, right: Expr) extends Expr

def eval(e: Expr): Int = e match {
  case Num(v)    => v
  case Add(l, r) => eval(l) + eval(r)
}
```

Erkenntnis: Vier Sprachen, eine Konvergenz auf **algebraische Datentypen + Pattern Matching**. Ein einzelnes Lambda ersetzt den Visitor nur im degenerierten Ein-Methoden-Fall (dann ist es ohnehin Strategy). Visitor bleibt nur sinnvoll, wenn (a) die Sprache keine ADTs hat, (b) man eine fremde, nicht-`sealed` Hierarchie von außen erweitern muss, oder (c) echtes Mehrfach-Dispatch über mehrere Hierarchien gebraucht wird. Brian Goetz' „Data Oriented Programming" verallgemeinert genau diese Substitution für Java (records = Produkttypen, sealed = Summentypen, Pattern Matching = Polymorphie über ADTs).

### 4.7 State — [KONZEPT] / [ERSETZT]

Klassisch: ein State-Interface mit einer Klasse je Zustand, Übergänge als Methoden. Modern in Java/Kotlin: `sealed` + `when`/`switch` mit Übergängen als Funktionen. Das eigentlich Interessante zeigt Rust:

**Rust — Typestate.** Jeder Zustand ist ein eigener Typ; ungültige Übergänge sind schlicht **nicht kompilierbar**.

```rust
use std::marker::PhantomData;

struct Draft;
struct Published;
struct Post<S> { content: String, _state: PhantomData<S> }

impl Post<Draft> {
    fn new(c: &str) -> Post<Draft> { Post { content: c.into(), _state: PhantomData } }
    fn publish(self) -> Post<Published> {            // konsumiert Draft, liefert Published
        Post { content: self.content, _state: PhantomData }
    }
}
impl Post<Published> {
    fn render(&self) -> &str { &self.content }        // render() existiert NUR für Published
}
// let d = Post::<Draft>::new("hi");
// d.render();   // Compile-Fehler: render() gibt es für Draft nicht
// d.publish().render();   // ok
```

Erkenntnis: Rust (und in Grenzen die JVM-Sprachen über `sealed` + verbotene Konstruktoren) kann die Zustandsmaschine ins Typsystem heben. Das ist dieselbe Idee wie der Staged Builder in §5 — Korrektheit per Konstruktion statt per Laufzeit-Check.

### 4.8 Null Object — [ERSETZT]

**Original (Java).** Ein „leeres" Objekt mit neutralem Verhalten, um `null`-Checks zu vermeiden.

```java
interface Logger { void log(String msg); }
class ConsoleLogger implements Logger {
    public void log(String m) { System.out.println(m); }
}
class NullLogger implements Logger {                 // Null Object: tut bewusst nichts
    public void log(String m) { /* no-op */ }
}
```

**Modern.** Nullability im Typsystem macht das Muster überflüssig.

```kotlin
// Kotlin: Safe-Call statt NullLogger
val logger: Logger? = null
logger?.log("hi")                                    // passiert einfach nichts
```

```rust
// Rust: Option statt Null Object
let logger: Option<&dyn Fn(&str)> = None;
if let Some(l) = logger { l("hi"); }
```

```java
// Java: Optional (schwächer — Optional selbst darf nicht null sein, nicht für Felder empfohlen)
Optional<Logger> logger = Optional.empty();
logger.ifPresent(l -> l.log("hi"));
```

Erkenntnis: Null Object war ein Workaround für fehlende Nullability im Typsystem. Kotlin (`T?`), Rust (`Option<T>`) und Scala/Haskell (`Option`/`Maybe`) machen es obsolet. Anmerkung: Null Object stand nicht im originalen GoF-Katalog, sondern wurde später ergänzt.

## 5. Sonderfall Builder — klassisch, Staged Builder, und der eigentliche Ersatz: named/default-Parameter

Der Builder verdient ein eigenes Kapitel, weil er drei verschiedene Ebenen der Problemlösung sichtbar macht: Laufzeit-Prüfung (klassischer Builder), Compile-Zeit-Kodierung (Staged Builder) und Problemauflösung an der Wurzel (named + optionale Parameter, die den Builder überflüssig machen). Er ist außerdem der Lehrfall aus §7 der v2: geplante Java-null-Safety erzwingt **keine** Pflichtfelder zur Compile-Zeit.

### 5.1 Klassischer Builder (Java) — Pflichtfeld-Prüfung zur **Laufzeit**

```java
public final class HttpRequest {
    private final String url;                        // Pflicht
    private final String method;                     // optional (Default GET)
    private final Duration timeout;                  // optional
    private final Map<String, String> headers;       // optional

    private HttpRequest(Builder b) {
        this.url = b.url; this.method = b.method;
        this.timeout = b.timeout; this.headers = b.headers;
    }
    public static Builder builder() { return new Builder(); }

    public static final class Builder {
        private String url;                          // kein Default -> muss gesetzt werden
        private String method = "GET";
        private Duration timeout = Duration.ofSeconds(30);
        private Map<String, String> headers = new HashMap<>();

        public Builder url(String url)       { this.url = url; return this; }
        public Builder method(String m)      { this.method = m; return this; }
        public Builder timeout(Duration t)   { this.timeout = t; return this; }
        public Builder header(String k, String v) { headers.put(k, v); return this; }

        public HttpRequest build() {
            if (url == null)                          // PFLICHTFELD-PRÜFUNG: erst hier, zur LAUFZEIT
                throw new IllegalStateException("url is required");
            return new HttpRequest(this);
        }
    }
}
// HttpRequest.builder().url("https://x").method("POST").build();
// HttpRequest.builder().method("POST").build();   // kompiliert! NPE/IllegalState erst zur Laufzeit
```

Das ist exakt der Punkt aus §7: Ob `url` gesetzt wurde, weiß der Compiler nicht. Geplante null-Safety (`String!`) ändert das nicht — die Builder-internen Felder müssen `String?` sein (ein `String!`-Feld müsste vor `super()` zugewiesen sein, was dem inkrementellen Setzen widerspricht), und die Prüfung verschiebt sich lediglich auf eine narrowing conversion zur Laufzeit beim `new HttpRequest(...)`.

### 5.2 Staged / Step Builder (Java) — Pflichtfelder zur **Compile-Zeit**

Eine Kette distinkter Interface-Typen erzwingt Reihenfolge und Pflichtfelder: `build()` ist erst sichtbar, nachdem die Pflicht-Setter durchlaufen wurden. Das ist das einzige compile-zeit-sichere Builder-Idiom in Java — und das Nächste, was Java an „Dependent Types für Builder" hat.

```java
public final class HttpRequest {
    private final String url, method;
    private final Duration timeout;
    private HttpRequest(String url, String method, Duration timeout) {
        this.url = url; this.method = method; this.timeout = timeout;
    }
    public static UrlStep builder() { return new Steps(); }

    public interface UrlStep      { MethodStep url(String url); }       // Schritt 1: Pflicht
    public interface MethodStep   { OptionalStep method(String m); }    // Schritt 2: Pflicht
    public interface OptionalStep {                                     // Schritt 3: optional + build
        OptionalStep timeout(Duration t);
        HttpRequest build();
    }

    private static final class Steps implements UrlStep, MethodStep, OptionalStep {
        private String url, method;
        private Duration timeout = Duration.ofSeconds(30);
        public MethodStep url(String url)     { this.url = url; return this; }
        public OptionalStep method(String m)  { this.method = m; return this; }
        public OptionalStep timeout(Duration t){ this.timeout = t; return this; }
        public HttpRequest build()            { return new HttpRequest(url, method, timeout); }
    }
}
// HttpRequest.builder().url("https://x").method("POST").build();   // erzwungene Reihenfolge
// HttpRequest.builder().method("POST")...                          // Compile-Fehler: kein method() auf UrlStep
// HttpRequest.builder().url("https://x").build();                  // Compile-Fehler: build() erst auf OptionalStep
```

Preis: hohe Boilerplate, weshalb das in der Praxis generiert wird (Immutables, `@RecordBuilder`, in Rust `typed-builder`). Konzeptionell identisch zum Rust-Typestate aus §4.7.

#### 5.2.1 Grenze: kombinatorische Explosion bei beliebiger Feld-Reihenfolge

Der Staged Builder oben erzwingt eine **feste** Reihenfolge (`url` → `method` → `build`). Das kostet N+1 Interfaces — linear. Die teure Variante ist der **order-independent** Fall: Pflichtfelder in beliebiger Reihenfolge setzen und dabei zur Compile-Zeit verfolgen, _welche Teilmenge_ bereits gesetzt ist. Jede mögliche Teilmenge braucht einen eigenen Rückgabetyp → **2ᴺ Zustände**.

Genau das ist die dokumentierte Begründung, warum Lombok keinen `@Builder`-Staged-Modus generiert (Lombok-Wiki, „FEATURE IDEA: 'Mandatory' fields with @Builder"): „You are either forced to first set a, and then b, and then the rest, in that exact order, or you get a combinatorial explosion of interfaces." Konkret nennen die Maintainer: 10 Pflichtfelder in beliebiger Reihenfolge = 2¹⁰ = **1024 generierte Klassen** (Megabytes an Class-Files, langsameres Class-Loading, vermüllte IDE-Autovervollständigung); bei fester Reihenfolge nur 10 Klassen. Weitere genannte Gründe: das Bauen lässt sich nicht über mehrere Module/Methoden verteilen, und die Interface-Flut verseucht Outline-/Autocomplete-Ansichten. Fazit der Maintainer sinngemäß: die Kur ist schlimmer als die Krankheit. (Manuell ist das Muster sehr wohl machbar — z.B. wrappt `java-webauthn-server` Lomboks `@Builder` mit von Hand geschriebenen Stage-Interfaces; die Maintainer halten das aber für eine Aufgabe der Anwendung, nicht des Generators.)

**Präzisierung gegenüber „Sprachen ohne Summen-Typen".** Die Wurzel ist nicht das Fehlen von Summen-Typen im ADT-Sinn, sondern das Fehlen von **type-level set tracking** — der Fähigkeit, „die Menge der noch fehlenden Pflichtfelder" als _einen_ komponierbaren Typ auszudrücken, statt jede Teilmenge als konkretes Interface zu materialisieren. Sprachen mit dieser Fähigkeit umgehen die Explosion ohne 2ᴺ Typen:

```typescript
// TypeScript: ein generischer Akkumulator der bereits gesetzten Keys; build() ist nur
// verfügbar, wenn alle Pflicht-Keys enthalten sind. Keine Interface-Explosion.
type Required = "url" | "method";
class ReqBuilder<Set extends Required = never> {
  private data: Partial<Record<Required, string>> = {};
  url(v: string) {
    this.data.url = v;
    return this as ReqBuilder<Set | "url">;
  }
  method(v: string) {
    this.data.method = v;
    return this as ReqBuilder<Set | "method">;
  }
  // build() existiert nur, wenn Set alle Required abdeckt (sonst Compile-Fehler):
  build(this: ReqBuilder<Required>) {
    return { ...this.data };
  }
}
// new ReqBuilder().url("x").method("GET").build();   // ok, beliebige Reihenfolge
// new ReqBuilder().url("x").build();                 // Compile-Fehler: 'method' fehlt in Set
```

In Rust übernimmt dieselbe Rolle eine Kette von `PhantomData`-Markern (ein Typ-Parameter pro Pflichtfeld, „gesetzt"/„ungesetzt"); Crates wie `typed-builder` oder `bon` generieren genau das und erlauben beliebige Reihenfolge mit Compile-Zeit-Pflichtprüfung — ohne 2ᴺ handgeschriebene Typen. Erkenntnis: Das Problem ist Java-/Lombok-spezifisch, weil Javas Generics „die noch fehlenden Felder" nicht ergonomisch als Typ komponieren können und ein Generator die Kombinationen real ausschreiben müsste.

#### 5.2.2 Grenze: Builder + Vererbung (Self-Type-Problem, `@SuperBuilder`)

Der klassische Builder bricht bei Vererbung. Gibt ein Setter `this` als konkreten Builder-Typ zurück, liefern die **geerbten** Setter den _Eltern_-Builder-Typ — ruft man nach einem Kind-Setter einen Eltern-Setter auf, ist die Fluent-Chain auf den Elterntyp verengt und die Kind-Methoden sind nicht mehr sichtbar.

Die Lösung ist das **selbstreferenzielle Generic-Pattern** (Self-Type / F-bounded / CRTP): die Builder-Basis trägt einen Typ-Parameter, der auf den konkreten Subtyp gebunden ist, plus eine abstrakte `self()`-Methode.

```java
// Das Pattern, das Lombok generiert (vereinfachte, von Hand geschriebene Skizze):
abstract class Animal {
    String name;
    abstract static class Builder<C extends Animal, B extends Builder<C, B>> {
        private String name;
        protected abstract B self();           // jede Subklasse gibt ihren eigenen Builder-Typ zurück
        public abstract C build();
        public B name(String n) { this.name = n; return self(); }   // Chain bleibt im Subtyp B
    }
}
```

Lombok automatisiert das mit **`@SuperBuilder`** (eingeführt in Lombok **1.18.2**, im Paket `lombok.experimental`, bis heute als _experimental_ markiert):

```java
@SuperBuilder
class Animal { private String name; }

@SuperBuilder
class Dog extends Animal { private String breed; }

// Fluent-Chain über die ganze Hierarchie, Reihenfolge frei:
Dog d = Dog.builder().name("Rex").breed("Labrador").build();
```

Constraints und scharfe Kanten (verifiziert):

- **Die gesamte Hierarchie muss `@SuperBuilder` verwenden** — kein Mischen mit `@Builder`; gemeinsame Einstellungen müssen über alle Ebenen gleich sein. Lombok generiert pro Klasse zwei innere Builder-Klassen, die die Eltern-Builder-Klasse erweitern.
- Vor 1.18.2 war der Workaround, `@Builder` auf einen **expliziten Konstruktor** zu setzen, der `super(...)` aufruft, und den `builderMethodName` der Kind-Klasse umzubenennen — funktioniert, aber von Hand.
- `@SuperBuilder` kombiniert mit **eigenen Generics** an der Klasse ist laut Maintainern „a rabbit hole … liable to blow up"; in solchen Fällen wird Komposition (`@Embeddable`/`@Embedded` bzw. Delegation) der Vererbung vorgezogen.
- Records sind hier **kein** Ersatz: Records können nicht erben, weshalb `@SuperBuilder` (und der Builder mit Vererbung allgemein) genau dort weiterlebt, wo Records an ihre Grenze stoßen.

### 5.3 Der eigentliche Ersatz: named + optionale / Default-Parameter

In Sprachen mit benannten und optionalen Parametern ist der Builder schlicht überflüssig — und Pflichtfelder sind „kostenlos" compile-zeit-erzwungen, weil ein Parameter ohne Default eben gesetzt werden muss. Genau das Feature, das Java fehlt.

**Kotlin — named + default args.**

```kotlin
class HttpRequest(
    val url: String,                                 // Pflicht: KEIN Default -> compile-zeit-erzwungen
    val method: String = "GET",                      // optional
    val timeout: Duration = Duration.ofSeconds(30),
    val headers: Map<String, String> = emptyMap(),
)
val r = HttpRequest(url = "https://x", method = "POST")
// HttpRequest(method = "POST")                      // Compile-Fehler: url fehlt
```

Das ist die Auflösung des §7-Problems an der Wurzel: Was Javas null-Safety dem Builder nicht geben kann (Pflichtfeld-Garantie zur Compile-Zeit), liefert Kotlin direkt über den Konstruktor.

**Scala — named + default params** (auf der JVM zuerst da).

```scala
case class HttpRequest(
  url: String,                                       // Pflicht
  method: String = "GET",
  timeout: Duration = Duration.ofSeconds(30),
  headers: Map[String, String] = Map.empty,
)
HttpRequest(url = "https://x", method = "POST")
```

**Python — keyword args + `@dataclass`.** Ergonomie wie Kotlin, aber als dynamische Sprache: Pflichtfeld-Verstoß ist ein `TypeError` zur **Laufzeit**, nicht Compile-Zeit. (Beachte `field(default_factory=...)` für veränderliche Defaults — ein nacktes `headers: dict = {}` wäre der klassische Mutable-Default-Bug.)

```python
from dataclasses import dataclass, field
from datetime import timedelta

@dataclass(frozen=True)
class HttpRequest:
    url: str                                         # Pflicht: kein Default
    method: str = "GET"                              # optional
    timeout: timedelta = timedelta(seconds=30)
    headers: dict = field(default_factory=dict)      # veränderlicher Default korrekt

HttpRequest(url="https://x", method="POST")
# HttpRequest(method="POST")                         # TypeError zur Laufzeit: url fehlt
```

**TypeScript — Options-Objekt mit optionalen Properties.** Pflichtfeld vom Type-Checker erzwungen.

```typescript
interface HttpRequestOptions {
  url: string; // Pflicht
  method?: string; // optional
  timeout?: number;
  headers?: Record<string, string>;
}
function httpRequest(opts: HttpRequestOptions) {
  const { url, method = "GET", timeout = 30_000, headers = {} } = opts; // Defaults beim Destructuring
  // ...
}
httpRequest({ url: "https://x", method: "POST" });
// httpRequest({ method: "POST" });                  // Compile-Fehler: url fehlt
```

**Go — Functional Options Pattern.** Go hat **weder** named **noch** default args. Das idiomatische Gegenmittel (Rob Pike / Dave Cheney) ist ein variadischer Slice von Options-Funktionen; Pflichtfelder werden als Positionsparameter modelliert.

```go
type HttpRequest struct {
    url     string
    method  string
    timeout time.Duration
    headers map[string]string
}
type Option func(*HttpRequest)                       // Option = Mutator-Funktion

func WithMethod(m string) Option        { return func(r *HttpRequest) { r.method = m } }
func WithTimeout(t time.Duration) Option { return func(r *HttpRequest) { r.timeout = t } }

func NewHttpRequest(url string, opts ...Option) *HttpRequest {   // url Pflicht = Positionsparam
    r := &HttpRequest{url: url, method: "GET", timeout: 30 * time.Second,
        headers: map[string]string{}}
    for _, opt := range opts {                       // optionale Felder anwenden
        opt(r)
    }
    return r
}
// NewHttpRequest("https://x", WithMethod("POST"))
```

Neue Erkenntnis: Ein komplettes Idiom, das nur existiert, weil eine Sprachlücke (keine named/default args) gefüllt werden muss — das Go-Gegenstück zum Java-Builder.

**Rust — zwei Endpunkte.** Rust hat ebenfalls keine named/default args. Pragmatisch liefert `build()` ein `Result` (Pflichtfeld → Fehler zur **Laufzeit**, wie Javas klassischer Builder):

```rust
struct HttpRequest { url: String, method: String, timeout_secs: u64 }

struct Builder { url: Option<String>, method: String, timeout_secs: u64 }
impl Builder {
    fn new() -> Self { Builder { url: None, method: "GET".into(), timeout_secs: 30 } }
    fn url(mut self, u: &str) -> Self { self.url = Some(u.into()); self }
    fn method(mut self, m: &str) -> Self { self.method = m.into(); self }
    fn build(self) -> Result<HttpRequest, &'static str> {            // Pflichtfeld -> Result
        Ok(HttpRequest {
            url: self.url.ok_or("url is required")?,                 // Laufzeit-Prüfung
            method: self.method,
            timeout_secs: self.timeout_secs,
        })
    }
}
// Builder::new().url("https://x").method("POST").build()?;
```

Für die **Compile-Zeit**-Variante kodiert man — wie beim State-Typestate in §4.7 — den „url gesetzt"-Zustand über Markertypen (`PhantomData`), sodass `build()` erst nach `url()` existiert. Verbose; das Crate `typed-builder` generiert genau das. Rust zeigt damit beide Enden desselben Spektrums in einer Sprache.

### 5.4 Zusammenfassung: Pflichtfeld-Durchsetzung pro Idiom

| Sprache / Idiom                           | Mechanismus                        | Pflichtfeld-Durchsetzung                                   |
| ----------------------------------------- | ---------------------------------- | ---------------------------------------------------------- |
| Java — klassischer Builder                | Builder + `build()`                | **Laufzeit** (Exception in `build()`)                      |
| Java — Staged Builder                     | Interface-Kette                    | **Compile-Zeit**                                           |
| Java — Konstruktor/`record`               | Positionsparameter                 | Compile-Zeit, aber keine named/default args                |
| Java — geplante null-Safety (JEP 8303099) | `String!`                          | **Laufzeit** (narrowing conversion); kein Typestate        |
| Kotlin                                    | named + default Konstruktor-Params | **Compile-Zeit**                                           |
| Scala                                     | named + default params             | **Compile-Zeit**                                           |
| Python                                    | keyword args + `@dataclass`        | Laufzeit (`TypeError`, dynamisch)                          |
| TypeScript                                | Options-Objekt + optionale Props   | **Compile-Zeit**                                           |
| Go                                        | functional options                 | Compile-Zeit (Pflicht = Positionsparam), Rest ohne Prüfung |
| Rust — pragmatisch                        | Builder + `build() -> Result`      | Laufzeit                                                   |
| Rust — typestate / `typed-builder`        | `PhantomData`-Marker               | **Compile-Zeit**                                           |

Didaktische Pointe: Der Builder ist kein „gelöstes" oder „obsoletes" Muster, sondern eine Landkarte dafür, _auf welcher Ebene_ eine Sprache das Konstruktionsproblem angeht. Java braucht ihn mangels named/default args weiterhin; Kotlin/Scala/TS lösen ihn auf; Go/Rust ersetzen ihn durch eigene Idiome; und nur explizite Typ-Ebenen-Kodierung (Staged Builder, Typestate) gibt die Compile-Zeit-Garantie, die null-Safety allein nicht liefert.

## 6. Schicht 2 — Strukturmuster (bleiben relevant)

Diese Muster sind keine Sprachdefizite, sondern Strukturierung von Objektgeflechten. Sie bleiben gültig; moderne Sprachen senken nur den Implementierungsaufwand. Composite (rekursive Struktur, als rekursive sum types ausdrückbar), Facade (Modul-/Paket-Grenze) und Bridge (Komposition zweier Hierarchien) seien hier nur genannt; die zwei lehrreichsten mit Code:

### 6.1 Decorator — [RELEVANT]

**Original (Java).** Wrapper, der dasselbe Interface implementiert und zur Laufzeit Verhalten hinzufügt; rekursiv schachtelbar. Die Zeremonie: jeder Decorator muss _jede_ Interface-Methode neu deklarieren und delegieren.

```java
interface DataSource { String read(); }
class FileSource implements DataSource {
    public String read() { return "raw"; }
}
class EncryptedSource implements DataSource {        // Decorator 1
    private final DataSource wrapped;
    EncryptedSource(DataSource d) { this.wrapped = d; }
    public String read() { return decrypt(wrapped.read()); }
}
class CompressedSource implements DataSource {       // Decorator 2
    private final DataSource wrapped;
    CompressedSource(DataSource d) { this.wrapped = d; }
    public String read() { return decompress(wrapped.read()); }
}
// new CompressedSource(new EncryptedSource(new FileSource()));
```

**Kotlin — Klassen-Delegation (`by`).** Generiert die Delegation _aller_ Interface-Methoden automatisch; man überschreibt nur das Geänderte. Damit verschwindet die Decorator-Boilerplate, unter der Java leidet.

```kotlin
interface DataSource { fun read(): String; fun close() }
class FileSource : DataSource {
    override fun read() = "raw"
    override fun close() { /* ... */ }
}
class EncryptedSource(private val wrapped: DataSource) : DataSource by wrapped {
    override fun read() = decrypt(wrapped.read())    // nur read() angepasst; close() auto-delegiert
}
// EncryptedSource(FileSource())
```

Erkenntnis: Decorator bleibt konzeptionell [RELEVANT], aber Kotlins `by` (und allgemein Komposition + higher-order functions) eliminiert die manuelle Durchreich-Arbeit.

**Falscher Freund — Python `@decorator`.** Gleiches Wort, anderes Konzept: syntaktischer Zucker für higher-order functions, die Funktionen/Klassen zur **Definitionszeit** transformieren (AOP-artig) — nicht das strukturelle GoF-Decorator.

```python
import functools, time
def timed(fn):                                       # KEIN GoF-Decorator
    @functools.wraps(fn)
    def wrapper(*a, **k):
        t = time.perf_counter()
        try: return fn(*a, **k)
        finally: print(time.perf_counter() - t)
    return wrapper

@timed
def work(): ...                                      # Definitionszeit-Transformation
```

Das GoF-Decorator in Python ist dagegen schlicht ein Wrapper-Objekt (Komposition). Für didaktisches Material zwingend zu trennen.

### 6.2 Adapter — [RELEVANT], aber strukturelle Typisierung senkt den Bedarf

**Original (Java) — Object Adapter.**

```java
interface Json { String toJson(); }
class LegacyUser {                                   // fremde Klasse, kennt kein Json
    String name() { return "Ada"; }
}
class LegacyUserAdapter implements Json {            // Adapter überbrückt die Inkompatibilität
    private final LegacyUser u;
    LegacyUserAdapter(LegacyUser u) { this.u = u; }
    public String toJson() { return "{\"name\":\"" + u.name() + "\"}"; }
}
```

**Go — strukturelle Typisierung macht den Adapter oft überflüssig.** Erfüllt ein fremder Typ bereits die passende Methodenform, konformiert er implizit — ohne expliziten Adapter.

```go
type Stringer interface{ String() string }           // aus fmt
type LegacyUser struct{ name string }
func (u LegacyUser) String() string { return u.name } // erfüllt Stringer implizit

var s Stringer = LegacyUser{"Ada"}                    // passt automatisch, kein Adapter nötig
```

Erkenntnis: In Go und TypeScript (structural typing) entfällt der Adapter, sobald die _Form_ passt; er bleibt nur bei echter Signatur-Inkompatibilität nötig. In nominal typisierten Sprachen (Java vor strukturellen Konzepten) ist er häufiger. Gamma selbst nennt Adapter (mit Bridge, Proxy, Chain of Responsibility) als bleibend wertvoll — „a great example of the enduring nature of good design".

## 7. Schicht 3 — Architektur-/DDD-Muster

Von der Substitution weitgehend unberührt; eine Ausnahme (Value Object) und ein Brückenfall zum Metaprogramming (Repository):

### 7.1 Value Object (DDD) — [ERSETZT (Implementierung)]

Definierendes Kriterium (Fowler): Wertgleichheit statt Identitätsgleichheit, Immutability. Jede moderne Sprache hat dafür einen Einzeiler; die GoF/DDD-Boilerplate (`equals`/`hashCode`/`toString` von Hand) ist weg.

```java
// Java: record — equals/hashCode/toString gratis, flach unveränderlich
record Money(BigDecimal amount, Currency currency) {
    Money {                                          // kompakter Konstruktor: Invarianten
        if (amount.signum() < 0) throw new IllegalArgumentException("negativ");
    }
}
```

```kotlin
// Kotlin: data class (+ value class für Ein-Feld-VOs ohne Heap-Allokation)
data class Money(val amount: BigDecimal, val currency: Currency)

@JvmInline
value class UserId(val value: Long)                  // inline: keine Wrapper-Allokation
```

```rust
// Rust: struct mit derive — Wertgleichheit, Clone
#[derive(Debug, Clone, PartialEq, Eq)]
struct Money { amount: i64, currency: Currency }
```

```python
# Python: frozen dataclass — __eq__/__hash__ generiert, immutable
@dataclass(frozen=True)
class Money:
    amount: Decimal
    currency: str
```

Caveat: Javas `record` bietet nur **flache** Immutability (eine `final`-Referenz auf eine veränderliche `List` schützt deren Inhalt nicht) und eignet sich nicht als JPA-Entity (`final`, kein No-Arg-Konstruktor). Entity (Identitätsgleichheit, Lebenszyklus) bleibt davon getrennt und [RELEVANT].

### 7.2 Repository (DDD/PoEAA) — [RELEVANT], Implementierung generiert

```java
// Spring Data: man deklariert ein Interface, das Framework generiert die Implementierung.
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);        // Query aus dem Methodennamen abgeleitet
}
// Injektion und Nutzung wie eine normale Bean:
@Service
class UserService {
    private final UserRepository users;
    UserService(UserRepository users) { this.users = users; }
    User byEmail(String e) { return users.findByEmail(e).orElseThrow(); }
}
```

Erkenntnis: Das Muster bleibt vollständig gültig; was sich ändert, ist, dass die Implementierung **generiert** wird — Spring Data erzeugt zur Laufzeit einen Proxy hinter dem Interface. Das ist die direkte Brücke zu Teil III: Repository ist ein Architekturmuster, dessen _Implementierung_ heute Metaprogramming ist. Die Designachse **Active Record** (Objekt kennt seine Persistenz: `user.save()`; Rails, Django ORM) vs. **Data Mapper** (Mapper/Repository trennt In-Memory-Objekt von der DB; Hibernate/JPA, Doctrine) ist eine echte Architekturentscheidung ohne Sprachfeature-Ersatz.

---

# Teil III — Metaprogramming als Pattern-Substrat

## 8. Kategorie & Einordnung

Dynamische Proxies, AOP, Annotation Processing und Bytecode-Weaving teilen ein Merkmal: **Code, der Code beobachtet oder erzeugt**, um Cross-Cutting-Belange (Transaktionen, Caching, Logging, Security, Mapping, DI-Verdrahtung) aus handgeschriebenen Klassen herauszuziehen. Sie sind nicht selbst Muster, sondern das _Substrat_, das mehrere Muster **implementiert und industrialisiert** — vor allem Proxy und Decorator, in Teilen auch Strategy und Template Method.

Diese Kategorie sauszugliedern (statt sie unter „Proxy" zu hängen) ist konzeptionell sauberer, weil die vier Techniken einen **Spektrum nach Zeitpunkt** bilden: Laufzeit (dynamische Proxies) → Compile-Zeit (Annotation Processing) → Compile-/Load-/Laufzeit mit Bytecode-Eingriff (Weaving). Sie unterscheiden sich systematisch in Reichweite und Kosten (§14).

Bezug zu Norvig: Proxy steht in seiner Gruppe „first-class types" (Muster, die durch Metaprogramming in dynamischen Sprachen „simpler" werden). Dynamische Proxies und Reflection sind genau die Metaprogramming-Antwort der JVM auf fehlende first-class types.

## 9. Dynamische Proxies

### 9.1 Java — `java.lang.reflect.Proxy`

Ein einziger `InvocationHandler` ersetzt N handgeschriebene Proxy-/Decorator-Klassen. Einschränkung: **nur Interfaces** (für konkrete Klassen braucht es CGLIB/ByteBuddy).

```java
interface Service { String fetch(String id); }
class RealService implements Service {
    public String fetch(String id) { return "data:" + id; }
}

Service real = new RealService();
Service proxy = (Service) Proxy.newProxyInstance(
    Service.class.getClassLoader(),
    new Class<?>[]{ Service.class },
    (p, method, args) -> {                           // ein Handler für ALLE Methoden
        long t = System.nanoTime();
        try {
            return method.invoke(real, args);        // Delegation an das echte Objekt
        } finally {
            System.out.println(method.getName() + " " + (System.nanoTime() - t) + "ns");
        }
    });
// proxy.fetch("42");  // führt Logik + Cross-Cutting (Timing) aus, ohne eigene Proxy-Klasse
```

### 9.2 JavaScript — `Proxy` mit Traps

Mächtiger als Java, weil **Property-Zugriff** abgefangen wird, nicht nur deklarierte Methoden. Vue 3 baut seine Reaktivität auf genau diesem Mechanismus auf (Ersatz für Vue 2s `Object.defineProperty`-Getter/Setter).

```javascript
const realService = { fetch: (id) => `data:${id}` };

const proxy = new Proxy(realService, {
  get(target, prop, receiver) {
    // Trap auf jeden Property-Zugriff
    const orig = Reflect.get(target, prop, receiver);
    if (typeof orig !== "function") return orig;
    return (...args) => {
      // Methodenaufruf umhüllen
      console.time(prop);
      try {
        return orig.apply(target, args);
      } finally {
        console.timeEnd(prop);
      }
    };
  },
});
// proxy.fetch("42");
```

Erkenntnis: Dynamische Proxies **ersetzen das Proxy-Pattern nicht — sie implementieren es** boilerplate-frei und subsumieren Decorator. Der Intent (Stellvertreter/Interzeption) bleibt; was verschwindet, sind die handgeschriebenen Klassen.

### 9.3 Das Self-Invocation-/Re-Entrancy-Problem — und warum es vom Receiver abhängt

Der bekannte Spring-Stolperstein „interner Aufruf umgeht den Proxy" (§10) ist ein **allgemeines** Phänomen jedes objektbasierten Proxys, aber — entgegen der verbreiteten Annahme — **nicht universell**. Ob ein klassen-interner oder rekursiver Aufruf den Proxy umgeht, hängt einzig davon ab, gegen welches Objekt (welchen `this`/Receiver) der Methodenrumpf ausgeführt wird.

**Fall A — separater Wrapper, Rumpf läuft gegen das rohe Target → Bypass.** Hält der Proxy eine Referenz auf ein _eigenes_ Target-Objekt und delegiert an dieses, dann ist `this` im Methodenrumpf das Target, nicht der Proxy. Ein `this.andereMethode()` (oder ein rekursiver Selbstaufruf) geht direkt ans Target und umgeht jede Interzeption. Das betrifft: handgeschriebene GoF-Proxy/Decorator-Klassen, **JDK Dynamic Proxies** (`InvocationHandler` delegiert via `method.invoke(target, …)`) und **Spring AOP** — sowohl im JDK- als auch im CGLIB-Modus, weil der eigentliche Geschäftslogik-Rumpf gegen die Target-Instanz läuft.

```java
// JDK-Proxy: nur der erste Aufruf wird interzipiert, der rekursive Selbstaufruf nicht.
class CounterImpl implements Counter {
    public int countdown(int n) {
        if (n <= 0) return 0;
        return countdown(n - 1);   // this == CounterImpl (Target), NICHT der Proxy -> kein Logging ab hier
    }
}
```

**Fall B — JavaScript `Proxy`: standardmäßig KEIN Bypass.** Ruft man `proxy.method()`, ist der Receiver der **Proxy** — die MDN-Doku stellt klar, dass beim Auslösen der `get`-Trap „the `this` value is the proxy instead of the original" ist. Folglich re-entern interne `this.x()`-Aufrufe die Traps. **Genau darauf beruht die Reaktivität von Vue 3**: Property-Zugriffe innerhalb von Methoden werden mitverfolgt, weil sie durch den reaktiven Proxy laufen. Der Bypass kehrt erst zurück, wenn man `this` bewusst auf das Target zurückbindet:

```javascript
// Im §9.2-Beispiel steht orig.apply(target, args) — das bindet this auf das Target
// und reproduziert damit Fall A: interne Selbstaufrufe umgehen die Trap.
// Ohne Rebinding (this = Proxy) würden sie die Trap erneut auslösen.
```

Diese Rückbindung ist kein Sonderfall, sondern oft **nötig**: private Klassenfelder (`#field`) und interne Slots (`Map`, `Set`, `Date`) prüfen die „Brand" des tatsächlichen Receivers und brechen durch einen Proxy hindurch — sie funktionieren nur, wenn `this` das echte Target ist. Damit steht man vor einem echten Zielkonflikt: `this = Proxy` (Selbstaufrufe werden interzipiert, aber private Felder brechen) vs. `this = Target` (private Felder funktionieren, aber Selbstaufrufe umgehen den Proxy).

**Andere Sprachen.** Dasselbe Prinzip: Ein Kompositions-Wrapper in Python/Kotlin/C# (separates Objekt) zeigt Fall A — interne `self.x()`/`this.x()`-Aufrufe umgehen den Wrapper. Ein Python-`__getattr__`-Proxy, dessen Methoden mit `self == Proxy` laufen, zeigt Fall B (Re-Entrancy). Maßgeblich ist nie „Proxy ja/nein", sondern die Receiver-Bindung.

Erkenntnis: Rekursion ist nur ein Selbstaufruf auf dieselbe Methode und folgt derselben Regel. Wer Cross-Cutting-Verhalten _zuverlässig_ auf jeden (auch internen) Aufruf legen will, kann sich nicht auf transparente, dispatch-basierte Proxies verlassen — das ist eines der Hauptargumente für den expliziten, funktionalen Gegenentwurf (§11).

## 10. Spring AOP — deklarative Aspekte

Spring AOP ist das Proxy-Pattern industrialisiert: Beans werden in Proxies gewrappt, Cross-Cutting-Advice über `MethodInterceptor` eingewoben. Annotationen als proxy-basierte Aspekte: `@Transactional` (protection/smart-reference), `@Cacheable` (caching/virtual), `@Async`, `@Retryable`, `@PreAuthorize`/`@Secured` (protection), `@Validated`, `@Observed`, `@Lazy` (virtual), scoped beans (scoped proxy).

```java
@Service
public class PaymentService {
    @Transactional                                   // proxy-basierter Aspekt: begin/commit/rollback
    public void transfer(Long from, Long to, BigDecimal amount) {
        // reine Geschäftslogik — kein tx-Boilerplate, kein try/catch/rollback von Hand
    }
}
```

Absorbiert damit: handgeschriebenes **Proxy + Decorator**, das Cross-Cutting-Skelett von **Template Method** (immer gleicher tx/retry-Rahmen) und die Cross-Cutting-Variante von **Strategy** (Policy deklarativ statt injiziert).

**Mechanismus (gegen die Doku verifiziert).** JDK-Proxy, wenn die Bean Interface(s) implementiert **und** `proxyTargetClass=false`; sonst CGLIB. Der **Spring-Framework-Default ist `proxyTargetClass=false`**; **Spring Boot 2.0+ setzt `spring.aop.proxy-target-class=true` per Default** → CGLIB als Standard, auch bei vorhandenen Interfaces. Diese Diskrepanz ist eine häufige Fehlerquelle (z.B. „bean is a JDK dynamic proxy that implements …"-Injektionsfehler bei `@Async`).

**Failure Modes (für didaktisches Material zentral):**

1. **Self-Invocation** — der häufigste Fehler. Ein interner `this`-Aufruf umgeht den Proxy; der Aspekt greift stillschweigend nicht.

```java
@Service
public class OrderService {
    @Transactional
    public void outer() {
        inner();                                     // ACHTUNG: this.inner() umgeht den Proxy
    }
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void inner() {                            // dieser @Transactional greift bei Aufruf via outer() NICHT
        // ...
    }
}
```

Workarounds: Self-Injection, `AopContext.currentProxy()` (braucht `exposeProxy=true`), oder Refactoring in eine zweite Bean. Dies ist der „Fall A" aus §9.3 (Rumpf läuft gegen die Target-Instanz); der Bypass ist also kein Spring-Bug, sondern Folge der Receiver-Bindung.

2. **`final` Klassen/Methoden** — CGLIB kann nicht subklassen → Advice still ignoriert. `private` Methoden werden nie interzipiert.
3. **Nur public Method-Execution-Joinpoints** — kein Field-Access, keine Konstruktor-/Call-Joinpoints. Volles AspectJ (§13) kann das. Also **Spring-AOP ⊊ AspectJ**.
4. **Zwei Objekt-Identitäten** — Proxy ≠ Target; `instanceof`/`==` und auf dem Target reflektierte Annotationen verhalten sich teils unerwartet.

Ein fünftes, eigenständiges Problem entsteht, sobald **mehrere** Aspekte kombiniert werden (z.B. Retry + Transaktion): ihre **Reihenfolge** ist semantisch entscheidend und bei Annotationen implizit — dazu §11.3.

## 11. Higher-Order Functions als expliziter Gegenentwurf zum transparenten Proxy

Transparente Proxies (GoF-Proxy, JDK/CGLIB, Spring AOP) sind _unsichtbar_ — und genau daraus entstehen ihre zwei Schwächen: der receiver-abhängige Bypass (§9.3) und die implizite Reihenfolge (§11.3). Der funktionale Gegenentwurf dreht das um: eine **Higher-Order Function** nimmt die Operation (eine Funktion) und gibt eine umhüllte Funktion zurück bzw. führt sie in einem Rahmen aus. Das Cross-Cutting-Verhalten ist damit **explizit am Aufrufort sichtbar**, hängt nicht an `this`-Dispatch (also kein Self-Invocation-Problem) und seine Reihenfolge ist der Code selbst.

### 11.1 Prinzip

Statt ein Objekt transparent zu wrappen, wird eine Funktion explizit dekoriert oder in einer Template-Methode ausgeführt. Der Preis ist die fehlende Transparenz (man muss die Umhüllung an jeder Aufrufstelle hinschreiben); der Gewinn ist Vorhersagbarkeit.

### 11.2 Beispiele

**Spring `TransactionTemplate` / `RetryTemplate` — programmatisch statt `@Transactional`/`@Retryable`.** Beide nehmen einen Callback (HOF). Verschachtelt man sie, ist die Reihenfolge explizit und das Self-Invocation-Problem entfällt, weil nichts an Proxy-Dispatch hängt:

```java
// Retry AUSSEN, Transaktion INNEN: jeder Versuch erhält eine frische Transaktion.
retryTemplate.execute(ctx ->
    transactionTemplate.execute(status -> {
        var draft = articles.findById(id).orElseThrow();
        draft.setSlug(slugGenerator.next());
        return articles.save(draft);            // transienter Fehler -> Rollback + nächster Versuch
    })
);
```

**Resilience4j — `Decorators` (higher-order functions).** Die Bibliothek ist explizit „designed for functional programming" und bietet HOF-Dekoratoren für CircuitBreaker, Retry, RateLimiter, Bulkhead, TimeLimiter. Die **Reihenfolge der Dekoration ist die Semantik**:

```java
Supplier<String> decorated = Decorators.ofSupplier(() -> backend.call())
    .withRetry(retry)                           // Reihenfolge hier = Ausführungs-Schachtelung
    .withCircuitBreaker(circuitBreaker)
    .decorate();
String result = decorated.get();
```

**React Higher-Order Components — HOF über Komponenten.** Eine HOC ist „a function that takes a component and returns a new component":

```jsx
const withLogging = (Wrapped) => (props) => {
  // expliziter Wrapper
  console.log("render", Wrapped.name);
  return <Wrapped {...props} />;
};
const LoggedButton = withLogging(Button);
// Bibliotheks-HOCs: connect(mapState)(C), withRouter(C), React.memo(C), withErrorBoundary(C).
```

Einordnung: Seit Hooks (React 16.8) sind HOCs für _Logik_-Wiederverwendung weitgehend abgelöst und in react.dev als „legacy" geführt; sie leben aber in Bibliotheks-APIs (`connect`, `observer`, `withRouter`, `React.memo`) und beim _Komponenten_-Wrapping fort, wo Hooks kein Äquivalent haben (z.B. Error Boundaries).

**Weitere Beispiele quer durch die Ökosysteme:**

```python
# Python: lru_cache ist ein Caching-Proxy als HOF (kein GoF-Decorator, vgl. §6.1).
from functools import lru_cache
@lru_cache(maxsize=128)
def fib(n): return n if n < 2 else fib(n - 1) + fib(n - 2)
```

```javascript
// JavaScript (lodash): Rate-Limiting-„Proxy" als HOF.
import debounce from "lodash/debounce";
const onResize = debounce(() => recompute(), 200);
```

```kotlin
// Kotlin: ein sichtbarer Retry-Wrapper als inline-HOF.
inline fun <T> withRetry(times: Int, block: () -> T): T {
    repeat(times - 1) { runCatching { return block() } }
    return block()
}
// withRetry(3) { client.call() }
```

Ebenfalls hierher gehören Middleware-Ketten (Express, Koa, Redux `store => next => action => …`) als funktionale Komposition von Cross-Cutting-Belangen (Überschneidung mit Chain of Responsibility) sowie Kotlins `measureTimeMillis { … }`, `synchronized(lock) { … }` und das `transaction { … }` von Exposed.

### 11.3 Das Reihenfolge-Problem bei kombinierten Aspekten

Sobald zwei Cross-Cutting-Belange zusammenwirken, entscheidet ihre **Schachtelungsreihenfolge** über die Korrektheit — und bei transparenten Annotationen ist diese Reihenfolge implizit und global konfiguriert, also leicht still falsch.

**Kanonisches Beispiel: Retry × Transaktion.** Liegt **eine** Transaktion um **alle** Versuche (Transaktion außen, Retry innen — oder Retry auf einer Methode, die eine geerbte Eltern-Transaktion mitbenutzt), dann markiert schon die erste geworfene Exception die Transaktion als **rollback-only**: Spring AOP setzt das Flag, _bevor_ der Retry greift. Ein späterer, an sich erfolgreicher Versuch ist damit vergeblich — der abschließende Commit scheitert mit „Transaction has been marked as rollback-only". Korrekt ist **Retry außen, Transaktion innen**, sodass jeder Versuch eine frische Transaktion bekommt. In Annotationsform: `@Retryable` auf der äußeren, `@Transactional` auf der inneren Methode — zwingend als **Cross-Bean-Aufruf**, sonst greift wegen Self-Invocation (§9.3) der Retry-Proxy gar nicht. Alternativ `Propagation.REQUIRES_NEW` (bricht aber die Atomarität zwischen äußerer und innerer Arbeit). Die programmatische Verschachtelung aus §11.2 macht beides explizit und umgeht das Self-Invocation-Problem.

**Resilience4j.** Die Aspekt-Reihenfolge der Annotationen ist **fest** vorgegeben: `Retry ( CircuitBreaker ( RateLimiter ( TimeLimiter ( Bulkhead ( Function ) ) ) ) )`. Will man eine andere Reihenfolge (etwa damit Bulkhead-Ablehnungen nicht den CircuitBreaker öffnen), „you must use the functional chaining style instead of the Spring annotations style" — also genau die `Decorators`-HOF aus §11.2. Die Annotationsreihenfolge ist zudem eine dokumentierte Verwirrungsquelle (Eintritt links → Austritt rechts).

**Weitere Reihenfolge-Fälle:** Security **vor** Transaktion (keine Transaktion für einen nicht autorisierten Aufruf öffnen); Cache **vor** Transaktion (ein Cache-Treffer sollte keine Transaktion starten); Metrik/Timing **innerhalb vs. außerhalb** von Retry (misst man die Dauer _pro Versuch_ oder die _Gesamtdauer_ inklusive Backoff?). In all diesen Fällen ändert die Reihenfolge nicht die Performanz, sondern die _Semantik_.

Erkenntnis: Transparente Proxies/Annotationen machen die Reihenfolge **implizit** (Präzedenz konfigurieren, `@Order`, aspectOrder-Properties) — falsch konfiguriert ist sie still inkorrekt. Die funktionale Komposition macht die Reihenfolge **explizit**: die Schachtelung _ist_ der Code. Das ist, zusammen mit der Self-Invocation-Immunität (§9.3), das stärkste Argument für den HOF-Gegenentwurf — erkauft mit dem Verlust der Transparenz.

## 12. Annotation Processing — Compile-Zeit-Codegen

Annotation Processors (APT, `javax.annotation.processing`) erzeugen **zur Compile-Zeit** Quellcode — ohne Laufzeit-Reflection und ohne Proxy-Kosten. Beispiele: Lombok (`@Data`), MapStruct (Mapper), Dagger (DI-Graph), Micronaut/Quarkus (Compile-Zeit-DI, um Laufzeit-Proxies zu vermeiden und GraalVM-Native-Image zu ermöglichen).

```java
@Mapper                                              // MapStruct: generiert zur Compile-Zeit eine Impl
public interface UserMapper {
    UserDto toDto(User user);                        // der generierte Code ist plain, debugbar, reflexionsfrei
}
```

Erkenntnis: APT verschiebt die „Magie" von der Laufzeit auf die Compile-Zeit. Folgen: keine Laufzeit-Reflection-Kosten, AOT-/Native-Image-tauglich, im Debugger sichtbarer Code — aber an den Build-Schritt gebunden. Genau dieser Trade-off treibt Micronaut/Quarkus als Compile-Zeit-Alternativen zu Springs laufzeit-proxybasiertem Ansatz. (Hinweis: Lombok ist technisch ein APT, hängt sich aber unsupported in javac-Interna ein — die häufigste Reibung in IDE/Build-Toolchains.)

## 13. Bytecode-Weaving

Weaving modifiziert Bytecode direkt — und kann deshalb genau das, woran proxy-basiertes AOP scheitert: Field-Access, Konstruktoren und Self-Invocation interzipieren.

- **AspectJ** — Compile-Time- oder Load-Time-Weaving (LTW via Java-Agent). Voller Joinpoint-Umfang; löst die Spring-AOP-Limitierungen, zum Preis von Build-/Agent-Komplexität.
- **ByteBuddy / CGLIB** — generieren Klassen zur Laufzeit (Subclass-Proxies). ByteBuddy ist der moderne Standard; Mockito baut darauf.
- **Hibernate** — nutzt Bytecode-Enhancement (zur Build- oder Ladezeit) für Lazy Loading und Dirty Checking.

Erkenntnis: Weaving ist der mächtigste und zugleich invasivste Punkt des Spektrums. Es löst die Reichweiten-Grenzen der Proxies, verlangt aber Agents oder Build-Plugins und erschwert das Debugging (der ausgeführte Bytecode ≠ der geschriebene Quellcode).

## 14. Vergleichsmatrix der Metaprogramming-Techniken

| Technik                          | Zeitpunkt               | Reichweite                   | Hauptkosten                                   | Beispiele                                     |
| -------------------------------- | ----------------------- | ---------------------------- | --------------------------------------------- | --------------------------------------------- |
| JDK Dynamic Proxy                | Laufzeit                | nur Interface-Methoden       | Reflection-Overhead; Interface-Pflicht        | Spring AOP (Interface-Fall), Spring Data      |
| Subclass-Proxy (CGLIB/ByteBuddy) | Laufzeit                | public, non-`final` Methoden | Klassengenerierung; `final`/`private`-Grenzen | Spring AOP (Klassen-Fall), Mockito            |
| Annotation Processing (APT)      | Compile-Zeit            | generierter Quellcode        | an Build gebunden                             | Lombok, MapStruct, Dagger, Micronaut, Quarkus |
| Bytecode-Weaving                 | Compile-/Load-/Laufzeit | Felder, Konstruktoren, alles | Agent/Build-Komplexität, Debugging            | AspectJ, Hibernate-Enhancement                |
| JS `Proxy` (Traps)               | Laufzeit                | jeder Property-Zugriff       | dynamisch, kein statischer Check              | Vue 3 Reaktivität, MobX, Immer                |

Leselinie der Matrix: Je später und tiefer der Eingriff, desto größer die Reichweite — und desto höher die Kosten an Build-Komplexität, Debugging und „Magie". Die Industrie bewegt sich bei DI/AOP spürbar von Laufzeit-Proxies (Spring klassisch) zu Compile-Zeit-Processing (Micronaut/Quarkus, Spring AOT/Native), getrieben von Startup-Zeit und GraalVM.

---

# Teil IV — Meta-Analyse & Schluss

## 15. Bewertung der These „GoF zielt auf legacy Java/C++"

**Verdict: teilweise korrekt, aber zu pauschal.**

_Pro These (verifiziert):_

- **Norvig (Object World, 1996, „Design Patterns in Dynamic Programming").** „16 of 23 patterns are either invisible or simpler" in höheren Sprachen, aufgeschlüsselt nach Ursache: First-class types (6: Abstract Factory, Flyweight, Factory Method, State, Proxy, Chain of Responsibility), First-class functions (4: Command, Strategy, Template Method, Visitor), Macros (2: Interpreter, Iterator), Method Combination (2: Mediator, Observer), Multimethods (1: Builder), Modules (1: Facade). Verifiziert an der Primärquelle (norvig.com).
- **Paul Graham („Revenge of the Nerds", 2002).** Muster im Code seien für ihn „a sign of trouble" — ein Hinweis, dass er „by hand the expansions of some macro" erzeuge, das er eigentlich schreiben müsste („the human compiler"). Polemisch, aus Lisp-Sicht, aber dieselbe Diagnose wie Norvig.
- **Erich Gamma selbst (InformIT, 2009, „Design Patterns 15 Years Later").** Beim Überdenken der Liste: „I'm in favor of dropping Singleton. Its use is almost always a design smell." Außerdem würde er Factory Method zu Factory verallgemeinern. Das GoF-Buch verwendet C++/Smalltalk und referenziert NeXTStep/AppKit — also tatsächlich der OOP-Kontext der frühen 90er.

_Contra These (ebenfalls belegt):_

- Nicht alle Muster sind Sprachdefizite. **Adapter, Facade, Composite, Bridge, Proxy, Memento** sowie die **Architektur-Muster** (Repository, Unit of Work, MVC, Service Layer, Middleware) sind sprachunabhängige Strukturkonzepte. Gamma 2009 betont die „enduring nature of good design" an Adapter/Bridge/Proxy/Chain of Responsibility.
- Selbst mit ADTs braucht man Vokabular für große Systeme: Repository, Aggregate, Bounded Context lösen Probleme, die kein Sprachfeature wegnimmt.
- Goetz' Befund ist nicht „Muster sind falsch", sondern „OO und FP konvergieren": records/sealed/pattern matching geben Java die ADT-Werkzeuge, die viele _behaviorale_ Muster überflüssig machen — während die _strukturellen_ bleiben.

**Synthese.** Die ehrliche Botschaft ist nicht „GoF ist tot", sondern: GoF ist ein Katalog aus drei Schichten (§1). Schicht 1 ist weitgehend durch Sprachfeatures ersetzt (das ist der wahre Kern der These), Schicht 2 bleibt mit leichteren Implementierungen, Schicht 3 ist unberührt. Wer die Schichten nicht trennt, zieht falsche Schlüsse in beide Richtungen — entweder „alles obsolet" (falsch für Schicht 2/3) oder „alles weiterhin nötig" (falsch für Schicht 1).

## 16. Empfehlungen

1. **Entlang der drei Schichten lehren, nicht entlang Creational/Structural/Behavioral.** Nur die Schichtung macht die Substitutionsachse sichtbar.
2. **Pro Muster vier Felder zeigen:** Originalintent → GoF-Implementierung (Java) → moderne idiomatische Entsprechung pro Sprache → Status-Label. Dieses Dokument ist so aufgebaut.
3. **Vier „Falsche-Freunde"-Boxen explizit machen:** (i) Kotlin `object` vs. `companion object` (§4.1); (ii) Python `@decorator` vs. GoF-Decorator (§6.1); (iii) Spring-Singleton vs. GoF-Singleton (§4.1); (iv) dynamische Proxies/AOP _implementieren_ das Proxy-Pattern, sie _ersetzen_ es nicht (Teil III).
4. **Visitor als Lehrstück für das Expression Problem (§4.6)** — zeigt am klarsten, warum „Lambda ersetzt Pattern X" zu kurz greift und warum ADTs die eigentliche Antwort sind. Vier-Sprachen-Konvergenz als roter Faden.
5. **Builder als Lehrstück für Typsystem-Ebenen (§5)** — der Kontrast „Laufzeit-Check (klassisch) vs. Compile-Zeit-Kodierung (Staged/Typestate) vs. Problemauflösung (named/default args)" zeigt, dass dasselbe Problem auf verschiedenen Ebenen gelöst werden kann; null-Safety landet auf der schwächsten.
6. **Metaprogramming als eigene Kategorie behandeln (Teil III)** — das Spektrum Laufzeit-Proxy → Compile-Zeit-APT → Bytecode-Weaving erklärt mehr als jede Einzelbetrachtung von „Proxy" und ordnet die Industrie-Bewegung zu GraalVM/AOT ein.
7. **Primärquellen verlinken:** GoF 1994; Bloch _Effective Java_ Item 3; Norvig norvig.com/design-patterns; Fowler PoEAA + bliki (EvansClassification, ValueObject); Evans 2003; OpenJDK JEPs 395/409/440/441 und 8303099; Goetz „Data Oriented Programming in Java" (InfoQ 2022); kotlinlang.org (object-declarations, delegation); docs.spring.io (factory-scopes, core/aop/proxying); MapStruct/Micronaut-Doku für Compile-Zeit-Codegen.

**Schwellen, die Empfehlungen ändern würden:**

- Liefert Java „carrier classes"/Record-`with`-Evolution (Goetz-Diskussion 2026, derzeit kein Release): Builder-Status in Java von [RELEVANT] auf [ERSETZT] hochstufen.
- Wechselt JEP 8303099 von Draft auf Preview/GA: §5/§7-Bewertung prüfen (voraussichtlich weiterhin „kein Typestate für Builder").
- Deckt das Material Frontends ab: Signals (Angular/Solid/Svelte) als eigene Observer-Entsprechung in §4.4 ergänzen.

## 17. Caveats & Quellen

**Verifizierte Fakten** (Primär- oder hochwertige Sekundärquelle): Bloch Item-3-Zitat; Norvig 16/23 inkl. Kategorie-Aufschlüsselung; Spring-Singleton-„per container and per bean"; Kotlin-Doku `object`/`companion object` und `by`-Delegation; JEP 441 (final JDK 21) und JEP 395 (`record`, final JDK 16); JEP 8303099 (Status Draft, 2025-07-24) — Feld-Initialisierungsregeln, narrowing nullness conversion, Non-Goals; Spring-Proxy-Defaults (Framework `proxyTargetClass=false`, Spring Boot 2.0+ `spring.aop.proxy-target-class=true`); Gamma-2009-„drop Singleton"; Graham-Zitat; Fowler Value-Object/Entity-Definition. **v4:** Lomboks dokumentierte Begründung gegen einen Staged-`@Builder` (Lombok-Wiki „FEATURE IDEA: 'Mandatory' fields with @Builder": wörtlich „combinatorial explosion of interfaces"; Mailinglisten-Zahl 10 Felder beliebiger Reihenfolge = 1024 Klassen vs. 10 bei fester Reihenfolge); `@SuperBuilder` eingeführt in Lombok 1.18.2, Paket `lombok.experimental`, weiterhin als _experimental_ markiert, Hierarchie-weiter Zwang, Self-Type-/Generic-Mechanismus (projectlombok.org/features/experimental/SuperBuilder, Baeldung). **v5:** JLS-Stellen für die Singleton-Idiome — §12.4.1 _When Initialization Occurs_, §12.4.2 _Detailed Initialization Procedure_ (eindeutiges Init-Lock LC pro Klasse), §17.4.4/§17.4.5 _Happens-before_, §8.3.1.4 _volatile Fields_, §8.9 _Enum Classes_ (docs.oracle.com/javase/specs, Java SE 21) sowie Shipilevs „Safe Publication"-Analyse; GraalVM Native Image bewahrt die Klassen-Init-Semantik (Init-Checks nicht entfernbar „as this would break Java semantics"; Anwendungs­klassen seit GraalVM 19.0 default Laufzeit-Init; Build-Zeit-Init friert statischen Zustand in den Image-Heap — graalvm.org/.../ClassInitialization). JS-`Proxy`-Receiver-Semantik: bei `proxy.method()` ist `this` per Default der Proxy, Rebinding auf das Target nötig für private `#fields`/interne Slots (MDN Proxy-Doku, javascript.info/proxy). Spring Retry × `@Transactional`: geteilte Transaktion → rollback-only nach erstem Fehler; korrekt ist Retry außen / Transaktion innen, Cross-Bean wegen Self-Invocation (Baeldung, Java Code Geeks). Resilience4j: feste Aspekt-Reihenfolge `Retry(CircuitBreaker(RateLimiter(TimeLimiter(Bulkhead(fn)))))`, abweichende Reihenfolge nur via funktionale Komposition; HOF-Dekoratoren-Design (resilience4j.readme.io). React HOC = „function that takes a component and returns a new component", durch Hooks (16.8) für Logik-Wiederverwendung abgelöst, in react.dev als legacy geführt, in Bibliotheks-APIs weiter verbreitet (LogRocket, react.dev legacy docs).

**Begründete Einschätzungen** (Analyse, keine Einzelquelle): die Drei-Schichten-Taxonomie; die Status-Label-Zuordnungen; „Kotlin ist die pattern-ärmste JVM-Sprache"; „null-Safety entwertet den Builder eher, als ihn abzusichern"; „Spring-AOP ⊊ AspectJ"; die Lesart der Metaprogramming-Matrix.

**Unsichere/strittige Punkte:** Domain Event als „Evans-2003"-Muster ist historisch ungenau (eher Vernon 2013). JEP 8303099 ist **Draft**; Syntaxdetails (Array-Initializer-Shorthand etc.) sind dort selbst als „strawman"/„TBD" markiert und können sich ändern. Norvigs 16/23-Zählung summiert die genannten Kategorien; die restlichen 7 bleiben laut Norvig auch in dynamischen Sprachen „echte" Muster.

**Code-Hinweise / Versionsabhängigkeit.** Die Java-Beispiele setzen Java 21 (LTS) voraus: Pattern Matching für `switch` und Record Patterns sind erst ab 21 final (Preview in 17–20); `record` ab 16, `sealed` ab 17. `OnceLock` (Rust) ist ab 1.70 stabil. null-Safety (JEP 8303099) ist in **keinem** Release — die §5/§7-Aussagen sind Designanalyse, kein lauffähiger Code. Spring-Proxy-Defaults gelten ab Spring Boot 2.0. Die Beispiele sind didaktisch reduziert (Fehlerbehandlung, Imports, Thread-Sicherheit teils ausgelassen) und auf den jeweiligen Lehrpunkt zugespitzt; sie sind nicht als produktionsfertige Snippets gedacht.

**Quellengüte.** Wo möglich Primärquellen (OpenJDK JEPs inkl. 8303099, kotlinlang.org, docs.spring.io, norvig.com, paulgraham.com, martinfowler.com, informit.com, clojure.org); einzelne Detailbelege aus hochwertigen Sekundärquellen (InfoQ, nipafx, KT Academy, python-patterns.guide, MapStruct/Micronaut-Doku).
