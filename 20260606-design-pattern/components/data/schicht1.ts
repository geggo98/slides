// Schicht 1 — Sprachdefizit-Notlösungen. Code + Annotationen je Muster.
// Annotation-Schema (MonacoBlockAnnotated): { lines:n|[a,b], label, detail:{title,body}, tone }
// tone ∈ info | success | warning | danger.

export const schicht1 = {
  // ─────────────────────────────────────────── Singleton
  singleton: {
    tabs: [
      {
        label: "Klassisch (DCL)",
        language: "java",
        height: "310px",
        note: "Die volle Zeremonie: privater Konstruktor, statisches Feld, Double-Checked Locking.",
        code: `public final class Registry {
    private static volatile Registry instance;   // volatile: Pflicht für DCL
    private Registry() { }

    public static Registry getInstance() {
        if (instance == null) {                   // 1. Check ohne Lock
            synchronized (Registry.class) {
                if (instance == null) {           // 2. Check mit Lock
                    instance = new Registry();
                }
            }
        }
        return instance;
    }
}`,
        annotations: [
          {
            lines: 2,
            label: "volatile ist Pflicht — sonst ist DCL kaputt",
            tone: "warning",
            detail: {
              title: "JLS §8.3.1.4 / §17.4.5 — volatile & happens-before",
              body: "Ohne <code>volatile</code> etabliert das Idiom keine <em>happens-before</em>-Ordnung (JLS §17.4.5, §8.3.1.4) — ein anderer Thread kann eine teil-initialisierte Instanz sehen. Das ist der Kern der „Double-Checked Locking is Broken“-Deklaration (2000), behoben durch das Java-5-Memory-Model.",
            },
          },
        ],
      },
      {
        label: "enum (Bloch)",
        language: "java",
        height: "210px",
        note: "Thread-sicher, serialisierungs- und reflexionssicher — ohne Boilerplate. Ein Feld wird beim Enum-Init <strong>einmal lazy</strong> befüllt.",
        code: `public enum Registry {
    INSTANCE;                        // das einzige Element IST das Singleton
    private final Index index = buildIndex();   // einmal, bei Enum-Init gebaut
    public void register(String key) { /* ... */ }
    public Index index() { return index; }
}
// Nutzung: Registry.INSTANCE.register("x");`,
        annotations: [
          {
            lines: [1, 2],
            label: "Genau einmal & thread-sicher — vom Klassenlader garantiert",
            tone: "success",
            detail: {
              title: "JLS §8.9 / §12.4.2 — Enum-Init",
              body: "Enum-Konstanten sind implizit <code>public static final</code>, erzeugt im statischen Initialisierer (JLS §8.9). Dass das <strong>genau einmal und thread-sicher</strong> geschieht, garantiert das Klassen-Init-Lock (JLS §12.4.2); Reflexions- und Serialisierungssicherheit gibt es gratis. Bloch, <em>Effective Java</em>, Item 3: „the best way to implement a singleton“.",
            },
          },
          {
            lines: 3,
            label: "Lazy — aber der Init-Zeitpunkt ist nicht kontrollierbar",
            tone: "warning",
            detail: {
              title: "JLS §12.4.1 — „first active use“",
              body: "Das Feld wird mit der Enum-Klasse initialisiert: laut JLS §12.4.1 <em>unmittelbar vor der ersten aktiven Nutzung</em>. „Nutzung“ ist weit gefasst — jeder statische Methodenaufruf (auch <code>values()</code>/<code>valueOf()</code>), jedes <code>switch</code> über das Enum (synthetischer <code>$SwitchMap</code> ruft <code>ordinal()</code>) triggert die volle Initialisierung. Granularität ist <strong>pro Klasse</strong>, nicht pro Konstante. Man kontrolliert also <em>nicht</em>, wann <code>buildIndex()</code> läuft.",
            },
          },
        ],
        callout:
          'Das deckt nur den <strong>statischen, arg-losen</strong> Singleton-Fall — und der Init-Zeitpunkt ist nicht steuerbar. Für lazy <em>Instanzfelder</em>, Werte mit Konstruktor-Args oder einen kontrollierten Zeitpunkt → <a class="pt-xref" href="lazy-init">Lazy Initialization</a> (eigene Folie).',
      },
      {
        label: "Holder (IoDH)",
        language: "java",
        height: "180px",
        note: "Wenn <code>enum</code> ausscheidet (z.B. Oberklasse nötig): lazy + thread-sicher, ohne <code>synchronized</code>.",
        code: `public final class Registry {
    private Registry() { }
    private static class Holder {                 // lazy: erst bei erstem Zugriff
        static final Registry INSTANCE = new Registry();
    }
    public static Registry getInstance() { return Holder.INSTANCE; }
}`,
        annotations: [
          {
            lines: [3, 4],
            label: "Lazy garantiert durch JLS §12.4.1",
            tone: "info",
            detail: {
              title: "JLS §12.4.1 / §12.4.2 — Initialization-on-Demand",
              body: "Die innere Klasse wird laut JLS §12.4.1 erst bei erster <em>aktiver Nutzung</em> initialisiert (erster Lesezugriff auf <code>Holder.INSTANCE</code>); §12.4.2 garantiert „genau einmal, thread-sicher“. Kein <code>volatile</code>, kein <code>synchronized</code> nötig.",
            },
          },
        ],
      },
      {
        label: "Kotlin object",
        language: "kotlin",
        height: "120px",
        note: "Das eigentliche Singleton-Idiom — lazy und thread-sicher <em>per Sprache</em>.",
        code: `object Registry {                    // echtes Singleton
    fun register(key: String) { /* ... */ }
}
// Nutzung: Registry.register("x")`,
      },
      {
        label: "Rust OnceLock",
        language: "rust",
        height: "180px",
        note: "Kein einfaches mutables Global — Ownership verbietet es. Die Reibung ist <strong>Absicht</strong> und drängt zu DI.",
        code: `use std::sync::OnceLock;

struct Registry { /* ... */ }

fn registry() -> &'static Registry {
    static INSTANCE: OnceLock<Registry> = OnceLock::new();
    INSTANCE.get_or_init(|| Registry { /* ... */ })   // einmalig, thread-sicher
}`,
      },
      {
        label: "Go sync.Once",
        language: "go",
        height: "200px",
        note: "Das idiomatische lazy, thread-sichere Singleton auf Paketebene.",
        code: `var (
    instance *Registry
    once     sync.Once
)

func Get() *Registry {
    once.Do(func() { instance = &Registry{} })   // genau einmal, thread-sicher
    return instance
}`,
      },
      {
        label: "Spring DI",
        language: "java",
        height: "180px",
        note: "Der pragmatische Industrie-Weg: eine Instanz pro <code>ApplicationContext</code>, injiziert statt global gezogen.",
        code: `@Component                           // Default-Scope: eine Instanz pro Container
public class Registry { /* ... */ }

@Service
class UserService {
    private final Registry registry;
    UserService(Registry registry) { this.registry = registry; }
}`,
        callout:
          "<strong>Falscher Freund #3:</strong> Spring-Singleton ≠ GoF-Singleton. GoF ist per-ClassLoader hartkodiert; Spring ist <em>per Container/Bean</em> und damit <strong>testbar</strong> (Mock injizierbar). DI ist die einzige Variante, die das Testbarkeitsproblem des globalen Zustands löst.",
      },
    ],
  },

  // ─────────────────────────────────────────── Strategy & Command
  strategy: {
    tabs: [
      {
        label: "Original (Java)",
        language: "java",
        height: "305px",
        note: "Ein Interface, eine Implementierungshierarchie, manuelle Verdrahtung.",
        code: `interface DiscountStrategy {
    BigDecimal apply(BigDecimal price);
}
class NoDiscount implements DiscountStrategy {
    public BigDecimal apply(BigDecimal p) { return p; }
}
class TenPercent implements DiscountStrategy {
    public BigDecimal apply(BigDecimal p) {
        return p.multiply(new BigDecimal("0.9"));
    }
}
class Checkout {
    private final DiscountStrategy strategy;
    Checkout(DiscountStrategy s) { this.strategy = s; }
    BigDecimal total(BigDecimal p) { return strategy.apply(p); }
}`,
      },
      {
        label: "Modern (Java)",
        language: "java",
        height: "180px",
        note: "Die Strategy <strong>IST</strong> eine Funktion — der Interface-Zoo entfällt.",
        code: `UnaryOperator<BigDecimal> tenPercent = p -> p.multiply(new BigDecimal("0.9"));
UnaryOperator<BigDecimal> noDiscount = UnaryOperator.identity();

class Checkout {
    private final UnaryOperator<BigDecimal> discount;   // Strategy als Funktionstyp
    Checkout(UnaryOperator<BigDecimal> d) { this.discount = d; }
    BigDecimal total(BigDecimal p) { return discount.apply(p); }
}`,
        annotations: [
          {
            lines: 1,
            label: "java.util.function statt Interface-Hierarchie",
            tone: "success",
            detail: {
              title: "First-class functions",
              body: "<code>UnaryOperator</code>/<code>Function</code> aus <code>java.util.function</code> ersetzen die Strategy-Schnittstelle. Strategy, Command und Template Method sind <em>dieselbe</em> Substitution: „Verhalten als Wert übergeben“.",
            },
          },
        ],
      },
      {
        label: "Rust (zero-cost)",
        language: "rust",
        height: "200px",
        note: "Closure als generischer, durch <code>Fn</code> beschränkter Parameter — der Compiler monomorphisiert, kein virtueller Aufruf.",
        code: `struct Checkout<F: Fn(f64) -> f64> {
    discount: F,
}
impl<F: Fn(f64) -> f64> Checkout<F> {
    fn total(&self, price: f64) -> f64 { (self.discount)(price) }
}
let ten_percent = |p: f64| p * 0.9;
let c = Checkout { discount: ten_percent };`,
      },
      {
        label: "Go",
        language: "go",
        height: "140px",
        note: "First-class functions; der Typ wird nur zur Lesbarkeit benannt.",
        code: `type Discount func(float64) float64                // Strategy als Funktionstyp

func total(price float64, d Discount) float64 { return d(price) }

tenPercent := func(p float64) float64 { return p * 0.9 }`,
        callout:
          "<strong>Command</strong> ist derselbe Mechanismus mit anderem Intent: ein gekapselter Aufruf (<code>Runnable</code>/<code>Supplier</code>-Lambda). Nur die <em>Undo/Redo</em>-Variante braucht noch ein Objekt mit Zustand.",
      },
    ],
  },

  // ─────────────────────────────────────────── Template Method
  templateMethod: {
    tabs: [
      {
        label: "Original (Java)",
        language: "java",
        height: "230px",
        note: "Festes Skelett in einer <code>final</code>-Methode, variable Schritte als abstrakte Hooks, Variation über Vererbung.",
        code: `abstract class ReportGenerator {
    public final String generate() {            // Template-Methode: Ablauf fixiert
        return header() + body() + footer();
    }
    protected String header() { return "=== Report ==="; }
    protected abstract String body();           // Hook: Subklasse füllt
    protected String footer() { return "=== Ende ==="; }
}
class SalesReport extends ReportGenerator {
    protected String body() { return "Umsatz: 42"; }
}`,
      },
      {
        label: "Modern (Java)",
        language: "java",
        height: "120px",
        note: "Hook als Funktionsparameter — Komposition statt Vererbung, keine Subklasse nötig.",
        code: `String generate(Supplier<String> body) {        // Skelett als Funktion, Hook injiziert
    return "=== Report ===" + body.get() + "=== Ende ===";
}
// generate(() -> "Umsatz: 42");`,
      },
      {
        label: "Kotlin",
        language: "kotlin",
        height: "110px",
        note: "Noch knapper mit Trailing-Lambda.",
        // ${...} wird in der cooked-Literal-Form als \${...} geschrieben, \n als \\n.
        code: `fun report(body: () -> String) =
    "=== Report ===\\n\${body()}\\n=== Ende ==="

report { "Umsatz: 42" }                          // Trailing-Lambda: idiomatischer Hook`,
        callout:
          "Das „invariant skeleton + variable steps“ überlebt als <em>Konzept</em> (funktionale Komposition <code>before andThen after</code>), aber die vererbungsbasierte Implementierung ist obsolet.",
      },
    ],
  },

  // ─────────────────────────────────────────── Observer
  observer: {
    tabs: [
      {
        label: "Original (Java)",
        language: "java",
        height: "240px",
        note: "Handgepflegte Listener-Liste. Schwächen direkt sichtbar: enge Kopplung, kein <code>unsubscribe</code>-Zwang, synchron, kein Fehlerkanal.",
        code: `interface PriceObserver { void priceChanged(BigDecimal newPrice); }

class Stock {
    private final List<PriceObserver> observers = new ArrayList<>();
    private BigDecimal price;

    void subscribe(PriceObserver o) { observers.add(o); }   // kein unsubscribe-Zwang
    void setPrice(BigDecimal p) {
        this.price = p;
        for (var o : observers) o.priceChanged(p);          // synchron, kein Fehlerkanal
    }
}`,
      },
      {
        label: "Modern (Kotlin Flow)",
        language: "kotlin",
        height: "260px",
        note: "<code>StateFlow</code> verallgemeinert Observer um Operatoren, Completion/Error, Backpressure und lebenszyklusgebundene Cancellation.",
        code: `class Stock {
    private val _price = MutableStateFlow(BigDecimal.ZERO)
    val price: StateFlow<BigDecimal> = _price.asStateFlow()  // hot stream, hält Wert
    fun setPrice(p: BigDecimal) { _price.value = p }
}

// Cancellation/Lifecycle kommen vom umgebenden CoroutineScope:
suspend fun observe(stock: Stock) {
    stock.price
        .map { it.multiply(BigDecimal("1.19")) }             // Operator-Pipeline
        .collect { println(it) }                             // terminale Operation
}`,
        callout:
          "Reactive Streams (RxJava, Reactor) und Flow sind die Verallgemeinerung; Elizarov beschreibt Rx explizit als Observer mit Operatoren. Im Frontend übernehmen <strong>Signals</strong> (Angular/Solid/Svelte) dieselbe Rolle.",
      },
    ],
  },

  // ─────────────────────────────────────────── Iterator
  iterator: {
    tabs: [
      {
        label: "Original (Java)",
        language: "java",
        height: "250px",
        note: "Eigener Iterator von Hand. Man schreibt das praktisch nie — das Muster steckt als <code>Iterable</code> + for-each in der Sprache.",
        code: `class Range implements Iterable<Integer> {
    private final int from, to;
    Range(int from, int to) { this.from = from; this.to = to; }

    public Iterator<Integer> iterator() {
        return new Iterator<>() {               // anonymer Iterator
            int cur = from;
            public boolean hasNext() { return cur < to; }
            public Integer next() { return cur++; }
        };
    }
}
// for (int i : new Range(0, 3)) { /* 0, 1, 2 */ }`,
      },
      {
        label: "Rust (lazy, zero-cost)",
        language: "rust",
        height: "150px",
        note: "<code>Iterator</code>-Trait mit lazy Adaptern — <code>map</code>/<code>filter</code> allozieren nichts und werden monomorphisiert.",
        code: `let sum: i32 = (0..3)                        // Range implementiert Iterator
    .filter(|n| n % 2 == 0)                  // lazy
    .map(|n| n * 10)                         // lazy
    .sum();                                  // terminale Operation treibt die Iteration`,
      },
      {
        label: "Python (Generator)",
        language: "python",
        height: "130px",
        note: "Das Iterator-Protokoll wird vom Compiler erzeugt; <code>yield</code> hält den Zustand.",
        code: `def squares(n):
    for i in range(n):
        yield i * i                          # lazy; Zustand sprachverwaltet

list(squares(3))                             # [0, 1, 4]`,
        callout:
          "Iterator ist das Paradebeispiel eines vollständig in die Sprache absorbierten Musters. Interessant ist nur noch die <strong>Lazy-/Zero-Cost</strong>-Eigenschaft (Rust, Kotlin <code>Sequence</code>, Java <code>Stream</code>) gegenüber dem strikten GoF-Iterator.",
      },
    ],
  },

  // ─────────────────────────────────────────── Visitor (Expression Problem)
  visitor: {
    tabs: [
      {
        label: "Original (double dispatch)",
        language: "java",
        height: "300px",
        note: "Der <code>accept</code>/<code>visit</code>-Tanz löst das <strong>Expression Problem</strong> via double dispatch.",
        code: `interface ExprVisitor<R> { R visitNum(Num n); R visitAdd(Add a); }
interface Expr { <R> R accept(ExprVisitor<R> v); }

record Num(int value) implements Expr {
    public <R> R accept(ExprVisitor<R> v) { return v.visitNum(this); }   // dispatch 1
}
record Add(Expr left, Expr right) implements Expr {
    public <R> R accept(ExprVisitor<R> v) { return v.visitAdd(this); }
}

class EvalVisitor implements ExprVisitor<Integer> {                      // 1 Operation = 1 Klasse
    public Integer visitNum(Num n) { return n.value(); }
    public Integer visitAdd(Add a) {
        return a.left().accept(this) + a.right().accept(this);           // dispatch 2
    }
}`,
      },
      {
        label: "Java 21 (sealed + switch)",
        language: "java",
        height: "215px",
        note: "Die geschlossene Hierarchie ist <code>sealed</code>; der <code>switch</code> deckt sie ab, der Compiler prüft Vollständigkeit.",
        code: `sealed interface Expr permits Num, Add {}
record Num(int value) implements Expr {}
record Add(Expr left, Expr right) implements Expr {}

static int eval(Expr e) {
    return switch (e) {                     // Vollständigkeit vom Compiler geprüft
        case Num(int v)          -> v;      // Record-Pattern dekonstruiert
        case Add(Expr l, Expr r) -> eval(l) + eval(r);
    };                                      // kein default nötig (sealed = erschöpfend)
}`,
        annotations: [
          {
            lines: [5, 9],
            label: "JEP 441 — Pattern Matching for switch (final JDK 21)",
            tone: "success",
            detail: {
              title: "JEP 441 / 409 — sealed + Pattern Matching",
              body: "Eine <strong>neue Operation</strong> ist jetzt eine Funktion (kein Eingriff in die Typen); ein <strong>neuer Knotentyp</strong> erweitert <code>permits</code>, woraufhin der Compiler <em>jeden</em> unvollständigen <code>switch</code> markiert. Fehlerträchtige Handarbeit → Compile-Zeit-Garantie. <code>sealed</code>: JEP 409 (JDK 17), Record Patterns: JEP 440 (JDK 21).",
            },
          },
        ],
      },
      {
        label: "Rust (enum + match)",
        language: "rust",
        height: "195px",
        note: "Dieselbe Idee — nur dass Rust hier von Anfang an stand.",
        code: `enum Expr {
    Num(i32),
    Add(Box<Expr>, Box<Expr>),              // Box wegen rekursiver Größe
}
fn eval(e: &Expr) -> i32 {
    match e {                               // erschöpfend erzwungen
        Expr::Num(v)    => *v,
        Expr::Add(l, r) => eval(l) + eval(r),
    }
}`,
      },
      {
        label: "TypeScript (Union)",
        language: "typescript",
        height: "270px",
        note: "Strukturell statt nominal; Vollständigkeit über einen <code>never</code>-Trick erzwingbar.",
        code: `type Expr =
  | { kind: "num"; value: number }
  | { kind: "add"; left: Expr; right: Expr };

function evaluate(e: Expr): number {
  switch (e.kind) {
    case "num": return e.value;
    case "add": return evaluate(e.left) + evaluate(e.right);
    default: {
      const _exhaustive: never = e;         // Compile-Fehler, falls ein Fall fehlt
      return _exhaustive;
    }
  }
}`,
      },
      {
        label: "Scala (chronologisch zuerst)",
        language: "scala",
        height: "165px",
        note: "Zur Erinnerung an die Chronologie: Scala konnte das 2004, Java zog 2021 nach.",
        code: `sealed trait Expr
case class Num(value: Int) extends Expr
case class Add(left: Expr, right: Expr) extends Expr

def eval(e: Expr): Int = e match {
  case Num(v)    => v
  case Add(l, r) => eval(l) + eval(r)
}`,
        callout:
          "Vier Sprachen, eine Konvergenz auf <strong>algebraische Datentypen + Pattern Matching</strong>. Ein Lambda ersetzt den Visitor nur im degenerierten Ein-Methoden-Fall (dann ist es Strategy). Goetz' „Data Oriented Programming“ verallgemeinert genau das für Java.",
      },
    ],
  },

  // ─────────────────────────────────────────── State
  state: {
    tabs: [
      {
        label: "Klassisch / JVM modern",
        language: "kotlin",
        height: "200px",
        note: "Klassisch: ein State-Interface je Zustand. Modern in Java/Kotlin: <code>sealed</code> + <code>when</code>/<code>switch</code>, Übergänge als Funktionen.",
        code: `sealed interface DoorState
data object Open   : DoorState
data object Closed : DoorState
data object Locked : DoorState

fun next(s: DoorState): DoorState = when (s) {  // erschöpfend geprüft
    Open   -> Closed
    Closed -> Locked
    Locked -> Closed
}`,
      },
      {
        label: "Rust (Typestate)",
        language: "rust",
        height: "285px",
        note: "Jeder Zustand ist ein eigener Typ; ungültige Übergänge sind schlicht <strong>nicht kompilierbar</strong>.",
        code: `use std::marker::PhantomData;

struct Draft; struct Published;
struct Post<S> { content: String, _state: PhantomData<S> }

impl Post<Draft> {
    fn publish(self) -> Post<Published> {   // konsumiert Draft, liefert Published
        Post { content: self.content, _state: PhantomData }
    }
}
impl Post<Published> {
    fn render(&self) -> &str { &self.content }   // render() existiert NUR für Published
}
// d.render();            // Compile-Fehler: render() gibt es für Draft nicht
// d.publish().render();  // ok`,
        callout:
          "Rust hebt die Zustandsmaschine ins Typsystem — dieselbe Idee wie der <strong>Staged Builder</strong>: Korrektheit per Konstruktion statt per Laufzeit-Check.",
      },
    ],
  },

  // ─────────────────────────────────────────── Null Object
  nullObject: {
    tabs: [
      {
        label: "Original (Java)",
        language: "java",
        height: "170px",
        note: "Ein „leeres“ Objekt mit neutralem Verhalten, um <code>null</code>-Checks zu vermeiden. Im JDK angewandt: <code>Collections.emptyList()/emptySet()/emptyMap()</code> — geteilte immutable Singletons, neutral beim Lesen (<code>add()</code> wirft).",
        code: `interface Logger { void log(String msg); }
class ConsoleLogger implements Logger {
    public void log(String m) { System.out.println(m); }
}
class NullLogger implements Logger {        // Null Object: tut bewusst nichts
    public void log(String m) { /* no-op */ }
}`,
      },
      {
        label: "Kotlin",
        language: "kotlin",
        height: "100px",
        note: "Nullability im Typsystem macht das Muster überflüssig.",
        code: `val logger: Logger? = null
logger?.log("hi")                            // passiert einfach nichts`,
      },
      {
        label: "Rust",
        language: "rust",
        height: "100px",
        note: "<code>Option</code> statt Null Object.",
        code: `let logger: Option<&dyn Fn(&str)> = None;
if let Some(l) = logger { l("hi"); }`,
      },
      {
        label: "Java (Optional)",
        language: "java",
        height: "100px",
        note: "Schwächer — <code>Optional</code> selbst darf nicht null sein, nicht für Felder empfohlen.",
        code: `Optional<Logger> logger = Optional.empty();
logger.ifPresent(l -> l.log("hi"));`,
        callout:
          "Null Object war eine Notlösung für fehlende Nullability. Kotlin (<code>T?</code>), Rust (<code>Option&lt;T&gt;</code>) und Scala/Haskell machen es obsolet. Anmerkung: Null Object stand <em>nicht</em> im originalen GoF-Katalog.",
      },
    ],
  },

  // ─────────────────────────────────────────── Falscher Freund: Kotlin object vs companion object
  falscherFreundKotlin: {
    tabs: [
      {
        label: "object (echtes Singleton)",
        language: "kotlin",
        height: "110px",
        note: "<code>object</code>-Declaration = global eigenständiges, lazy + thread-sicheres Singleton.",
        code: `object Registry {                    // echtes Singleton
    fun register(key: String) { /* ... */ }
}
Registry.register("x")`,
      },
      {
        label: "companion object (≈ static)",
        language: "kotlin",
        height: "140px",
        note: "An die umschließende Klasse gebunden, ~ statische Member, beim Klassenladen initialisiert — <strong>kein</strong> global eigenständiges Singleton.",
        code: `class HttpClient private constructor() {
    companion object {               // ≈ Java-static, an HttpClient gebunden
        fun create(): HttpClient = HttpClient()
    }
}
HttpClient.create()                  // Zugriff nur über die Klasse`,
        callout:
          "<strong>Falscher Freund #1:</strong> Die verbreitete These „Singleton ← Companion Object“ ist <em>begrifflich falsch</em>, die Intention korrekt. Kotlin-Singleton = <code>object</code>; <code>companion object</code> ist ein an die Klasse gebundenes Pendant zu statischen Membern.",
      },
    ],
  },
};
