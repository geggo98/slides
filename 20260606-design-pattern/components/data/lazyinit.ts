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
        height: "230px",
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
          "<code>enum</code>/Holder (Singleton-Folie) lösen nur den statischen, arg-losen Fall — nicht lazy <em>Instanzfelder</em> oder Werte mit Konstruktor-Args. Diese Lücke füllen <code>by lazy</code> &amp; Co.; Javas <code>StableValue</code> (JEP) ist 2026 noch Preview.",
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
        label: "Swift",
        language: "swift",
        height: "140px",
        note: "Gleicher Keyword-Look, <strong>gegensätzliche</strong> Garantie.",
        code: `class ReportService {
    lazy var cache = Cache()       // ⚠️ Instanz: KEINE Synchronisation — Race beim 1. Zugriff

    static let shared = Parser()   // ✅ static/global: lazy UND thread-sicher (swift_once)
}`,
        callout:
          "<code>lazy var</code> (Instanz) hat <strong>keine</strong> Synchronisation — gleichzeitiger Erstzugriff kann den Initializer mehrfach ausführen. Globals &amp; <code>static</code>-Stored-Properties sind lazy <strong>und</strong> thread-sicher (<code>swift_once</code>/<code>dispatch_once</code>). Aber nur die <em>Initialisierung</em> ist once — ein mutables <code>static var</code> racet danach weiter; voll sicher ist nur <code>static let</code>.",
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
