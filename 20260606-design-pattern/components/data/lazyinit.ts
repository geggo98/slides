// Lazy Initialization — kein GoF-23-Muster (wie Null Object), benannt von Beck
// (Smalltalk Best Practice Patterns, 1997) und als Fowlers „Lazy Load“ (PoEAA,
// 2002) formalisiert. Schicht-1-Lehrfall: die hand­geschriebene Java-Zeremonie
// (Double-Checked Locking) wird in modernen Sprachen zu EINEM Keyword.
// Annotation-Schema (MonacoBlockAnnotated): { lines:n|[a,b], label, detail:{title,body}, tone }
// tone ∈ info | success | warning | danger.

export const lazyInit = {
  lazyInit: {
    tabs: [
      {
        label: "Java (von Hand)",
        language: "java",
        height: "255px",
        note: "Java hat <strong>kein</strong> eingebautes <code>Lazy&lt;T&gt;</code> — die Lazy-Init eines <em>Instanzfelds</em> (nicht statisch!) schreibt man von Hand (DCL mit <code>volatile</code>).",
        code: `class ReportService {
    private volatile Parser parser;       // volatile: Pflicht für DCL
    Parser parser() {
        if (parser == null) {             // 1. Check ohne Lock
            synchronized (this) {
                if (parser == null)       // 2. Check mit Lock
                    parser = new Parser();
            }
        }
        return parser;
    }
}`,
        annotations: [
          {
            lines: 2,
            label: "volatile ist Pflicht (JSR-133, Java 5) — sonst DCL kaputt",
            tone: "warning",
            detail: {
              title: "„Double-Checked Locking is Broken“ (2000) → Java-5-Fix",
              body: "Ohne <code>volatile</code> darf Compiler/CPU die Konstruktor-Schreibvorgänge hinter die Referenz-Publikation umordnen — ein anderer Thread sieht dann ein <em>halb-konstruiertes</em> <code>Parser</code>-Objekt. <code>volatile</code> etabliert die nötige <em>happens-before</em>-Ordnung; das greift erst ab dem JSR-133-Memory-Model (Java 5, 2004).",
            },
          },
        ],
        callout:
          "DCL ist nur für lazy <em>Instanzfelder</em> nötig — den statischen Fall lösen <code>enum</code>/Holder; modernes Java: <code>LazyConstant</code> (Tab).",
      },
      {
        label: "Java (util.concurrent)",
        language: "java",
        height: "290px",
        note: "Lock-frei statt DCL — <code>AtomicReference</code>+CAS (Einzelwert), <code>computeIfAbsent</code> (keyed, exactly-once).",
        code: `class ReportService {
    // (a) Einzelwert, lock-frei (CAS, „first wins“):
    private final AtomicReference<Parser> ref = new AtomicReference<>();
    Parser parser() {
        Parser p = ref.get();
        if (p != null) return p;
        p = new Parser();                       // kann mehrfach laufen
        return ref.compareAndSet(null, p) ? p : ref.get();
    }
    // (b) Mehrere Werte pro Key (atomar, exactly-once):
    private final ConcurrentHashMap<Class<?>, Parser> cache = new ConcurrentHashMap<>();
    Parser parser(Class<?> k) { return cache.computeIfAbsent(k, this::build); }
}`,
        annotations: [
          {
            lines: [7, 8],
            label:
              "CAS: compute kann mehrfach laufen — nur „first wins“ publiziert",
            tone: "warning",
            detail: {
              title: "AtomicReference ≠ exactly-once",
              body: "<code>compareAndSet</code> publiziert genau einen Wert, aber <code>new Parser()</code> kann unter Contention <strong>mehrfach</strong> laufen — nur sinnvoll, wenn die Berechnung idempotent und günstig ist. <code>updateAndGet</code>/<code>accumulateAndGet</code> dürfen die Funktion laut Javadoc bei Contention sogar wiederholen.",
            },
          },
          {
            lines: 12,
            label: "computeIfAbsent: atomar, höchstens einmal pro Key",
            tone: "success",
            detail: {
              title: "ConcurrentHashMap — keyed exactly-once",
              body: "<code>computeIfAbsent</code> läuft <strong>atomar, höchstens einmal pro Key</strong>; andere Threads blockieren, bis fertig — also echtes „exactly once“, anders als die CAS-Variante. Idiomatisch für keyed Memoization (Parser-Cache pro Typ). Für „genau einmal“ bei einem Einzelwert ist DCL (Tab 1) oder ein memoized <code>Supplier</code> sauberer als CAS. Vorsicht: <em>rekursives</em> <code>computeIfAbsent</code> auf derselben Map wirft ab Java 9 <code>IllegalStateException</code>.",
            },
          },
        ],
      },
      {
        label: "Java (LazyConstant, Preview)",
        language: "java",
        height: "160px",
        note: "<code>LazyConstant</code> (JEP 526, JDK 26, <strong>Preview</strong>) — wie <code>lazy val</code>, aber <strong>constant-foldbar trotz Lazy-Init</strong> (das kann keine Vor-25-Lösung). Auch <code>List.ofLazy</code>/<code>Map.ofLazy</code>.",
        code: `// Preview (JEP 526) — javac & java mit --enable-preview
class OrderController {
    // Lazy, aber im final-Feld → JIT darf nach Init constant-folden:
    private final LazyConstant<Logger> logger =
        LazyConstant.of(() -> Logger.create(OrderController.class));
    void submit() { logger.get().info("started"); }   // 1. get(): Closure läuft einmal
}`,
        annotations: [
          {
            lines: [3, 5],
            label:
              "Lazy UND constant-foldbar — die Lücke zwischen final und mutable",
            tone: "info",
            detail: {
              title: "JEP 526 — Lazy Constants (2nd Preview, JDK 26)",
              body: "Genau einmal, thread-sicher, und — im <code>final</code>-Feld gehalten — <strong>constant-foldbar</strong> (anders als <code>volatile</code>/<code>AtomicReference</code>, die der JIT nie wegoptimieren darf). Ohne die <code>static</code>-only-Beschränkung des Holder-Idioms. <strong>null</strong> als berechneter Wert ist verboten; nicht <code>Serializable</code>.",
            },
          },
        ],
        caveat:
          "<strong>Alte API nicht mehr verwenden:</strong> <code>StableValue</code> (JEP 502, JDK 25, mit <code>orElseSet</code>/<code>setOrThrow</code>/<code>trySet</code>) wurde in JDK 26 zu <code>LazyConstant</code> umbenannt, die Low-Level-Methoden <strong>entfernt</strong>.",
        callout:
          "Weiterhin <strong>Preview</strong> — produktionsreif erst nach Finalisierung (~<strong>JDK 29</strong>, LTS Sep 2027). Bis dahin: Holder-Idiom (statisch) bzw. memoized <code>Supplier</code> (Instanz).",
      },
      {
        label: "Kotlin",
        language: "kotlin",
        height: "160px",
        note: "<code>by lazy</code> — der <code>Lazy&lt;T&gt;</code>-Delegate berechnet beim ersten Zugriff und cached. Eine Zeile statt DCL.",
        code: `class ReportService {
    // thread-sicher per Default (SYNCHRONIZED):
    val parser: Parser by lazy { Parser() }              // einmal, beim 1. Zugriff

    // Opt-out, wenn Single-Thread garantiert ist:
    val cache: Cache by lazy(LazyThreadSafetyMode.NONE) { buildCache() }
}`,
        annotations: [
          {
            lines: 3,
            label: "Default = LazyThreadSafetyMode.SYNCHRONIZED",
            tone: "success",
            detail: {
              title: "Drei Thread-Safety-Modi",
              body: "<strong>SYNCHRONIZED</strong> (Default, Lock — genau einmal) · <strong>PUBLICATION</strong> (lock-frei per CAS; Initializer kann mehrfach laufen, aber nur ein Ergebnis gewinnt) · <strong>NONE</strong> (keine Synchronisation — nur für garantiert Single-Thread).",
            },
          },
        ],
        caveat:
          "<code>lateinit var</code> ist <strong>nicht</strong> dieses Muster: eager, non-null, extern später zugewiesen (wirft <code>UninitializedPropertyAccessException</code> bei Zugriff davor) — keine Berechnung on-demand.",
      },
      {
        label: "Scala",
        language: "scala",
        height: "130px",
        note: "<code>lazy val</code> — ein Keyword, thread-sicher; <code>@threadUnsafe</code> als Opt-out (Scala 3).",
        code: `class ReportService:
  lazy val parser: Parser = Parser()        // einmal, beim 1. Zugriff; thread-sicher

  @threadUnsafe                             // Opt-out aus der Synchronisation
  lazy val cache: Cache = buildCache()`,
        callout:
          "<strong>Warum das Sprach-Konstrukt das Idiom schlägt:</strong> Scala 2 hielt den Objekt-Monitor <em>während</em> des Initializers → zwei sich referenzierende <code>lazy val</code>s auf verschiedenen Objekten konnten <strong>deadlocken</strong> (SIP-20). Scala 3 implementiert „Version 6 von SIP-20“: 4-Zustands-Bitmap + CAS, sperrt nie <code>this</code>.",
      },
      {
        label: "Rust",
        language: "rust",
        height: "215px",
        note: "Zwei Achsen: <em>einmalig/manuell</em> (<code>OnceCell</code>/<code>OnceLock</code>) vs <em>lazy/auto</em> (<code>LazyCell</code>/<code>LazyLock</code>); <em>single-thread</em> (<code>*Cell</code>) vs <em>thread-safe</em> (<code>*Lock</code>).",
        code: `use std::sync::LazyLock;
use std::collections::HashMap;

// Thread-sicheres Global, lazy beim ersten Deref initialisiert.
// Moderner Ersatz für das alte lazy_static!-Makro (Rust >= 1.80):
static CONFIG: LazyLock<HashMap<&str, &str>> = LazyLock::new(|| {
    HashMap::from([("host", "localhost"), ("port", "8080")])
});
// CONFIG["host"] löst den Closure genau einmal aus.`,
        annotations: [
          {
            lines: 6,
            label: "LazyLock im static — LazyCell wäre hier ein Compile-Fehler",
            tone: "info",
            detail: {
              title: "Stabilisierungs-Versionen & !Sync",
              body: "<code>OnceCell</code>/<code>OnceLock</code> ab <strong>1.70</strong> (Juni 2023); <code>LazyCell</code>/<code>LazyLock</code> ab <strong>1.80</strong> (Juli 2024). <code>LazyCell</code>/<code>OnceCell</code> sind <code>!Sync</code> (single-thread) → im <code>static</code> verboten; ein <code>static</code> braucht den <code>Sync</code>-Typ <code>LazyLock</code>/<code>OnceLock</code>.",
            },
          },
        ],
        callout:
          "Evolution: <code>lazy_static!</code> → <code>once_cell</code> (matklad) → std. Seit Rust 1.80 braucht es <strong>kein Crate</strong> mehr — nur <code>LazyLock</code>.",
      },
      {
        label: "C#",
        language: "csharp",
        height: "150px",
        note: "<code>System.Lazy&lt;T&gt;</code> (.NET 4.0, 2010) — thread-sicher per Default.",
        code: `class ReportService {
    // thread-sicher per Default (LazyThreadSafetyMode.ExecutionAndPublication):
    private static readonly Lazy<Parser> _parser = new(() => new Parser());

    public Parser Parser => _parser.Value;   // Factory läuft einmal, beim 1. .Value
}`,
        annotations: [
          {
            lines: 3,
            label:
              "LazyThreadSafetyMode: None / PublicationOnly / ExecutionAndPublication",
            tone: "success",
            detail: {
              title: "Default = ExecutionAndPublication",
              body: "Lock garantiert: Factory läuft genau einmal, ein Wert wird publiziert. <code>PublicationOnly</code> = Race erlaubt, ein Gewinner, Exceptions werden nicht gecached. Achtung: thread-sicher ist nur die <em>Initialisierung</em>, nicht das initialisierte Objekt selbst. Wrapper-frei: <code>LazyInitializer.EnsureInitialized</code>.",
            },
          },
        ],
      },
      {
        label: "Go",
        language: "go",
        height: "150px",
        note: "<code>sync.Once</code> (klassisch) → <code>sync.OnceValue</code> (Go 1.21, Aug 2023).",
        code: `// sync.OnceValue ersetzt die hand-gerollte sync.Once + Feld-Kombination:
var parser = sync.OnceValue(func() *Parser {
    return newParser()                       // läuft genau einmal
})
// Aufruf: p := parser()   — nebenläufig sicher`,
        annotations: [
          {
            lines: 2,
            label: "OnceFunc / OnceValue / OnceValues neu in Go 1.21",
            tone: "info",
            detail: {
              title: "Generics-basiert",
              body: "Die drei Helfer „capture a common use of <code>Once</code> to lazily initialize a value on first use“ (Release-Notes). Erst durch Generics (Go 1.18) in der Stdlib ausdrückbar; <code>sync.Once</code> selbst ist älter (vor Go 1.0).",
            },
          },
        ],
      },
      {
        label: "Python",
        language: "python",
        height: "160px",
        note: "<code>functools.cached_property</code> (3.8) — pro-Instanz lazy, im <code>__dict__</code> gecached (Shadowing).",
        code: `from functools import cached_property

class Dataset:
    @cached_property
    def stats(self) -> Stats:                # berechnet beim 1. Zugriff,
        return expensive_scan(self.path)     # dann in __dict__ gecached`,
        callout:
          "<strong>Achtung (3.12):</strong> Der (undokumentierte) Lock war <strong>per-property</strong> (klassenweit, nicht per-Instanz) → hohe Contention, und wurde in <strong>3.12 entfernt</strong>. Folge: bei gleichzeitigem Erstzugriff kann der Getter <strong>mehrfach</strong> laufen (last write wins). Striktes once = eigener Lock im Getter. Modul-Ebene: <code>__getattr__</code> (PEP 562).",
      },
    ],
  },
};
