// Sonderfall Builder — drei Ebenen: Laufzeit-Prüfung (klassisch),
// Compile-Zeit-Kodierung (Staged/Typestate), Problemauflösung (named/default args).

export const builder = {
  builderClassic: {
    tabs: [
      {
        label: "Klassischer Builder",
        language: "java",
        height: "295px",
        note: "Pflichtfeld-Prüfung zur <strong>Laufzeit</strong> — der Compiler weiß nicht, ob <code>url</code> gesetzt wurde.",
        code: `// HttpRequest mit Pflichtfeld url + optionalem method (Default GET):
public static final class Builder {
    private String url;                  // kein Default -> Pflicht
    private String method = "GET";       // optional
    public Builder url(String u)    { this.url = u; return this; }
    public Builder method(String m) { this.method = m; return this; }

    public HttpRequest build() {
        if (url == null)                 // PFLICHTFELD-PRÜFUNG: erst hier
            throw new IllegalStateException("url is required");
        return new HttpRequest(url, method);
    }
}
// HttpRequest.builder().method("POST").build();  // kompiliert! Fehler erst zur Laufzeit`,
        annotations: [
          {
            lines: [9, 10],
            label: "Pflichtfeld-Prüfung erst zur Laufzeit",
            tone: "warning",
            detail: {
              title: "Geplante null-Safety (JEP 8303099) ändert das NICHT",
              body: "Die Builder-Felder müssen <code>String?</code> sein (inkrementelles Setzen), und die Prüfung verschiebt sich nur auf eine <em>narrowing conversion</em> zur Laufzeit beim <code>new HttpRequest(...)</code>. Kein Typestate, kein Dependent Type — null-Safety landet auf der schwächsten Ebene.",
            },
          },
        ],
      },
    ],
  },

  builderStaged: {
    tabs: [
      {
        label: "Staged / Step Builder",
        language: "java",
        height: "305px",
        note: "Eine Kette distinkter Interface-Typen erzwingt Reihenfolge und Pflichtfelder zur <strong>Compile-Zeit</strong>.",
        code: `public static UrlStep builder() { return new Steps(); }   // Einstieg: nur url() sichtbar
public interface UrlStep    { MethodStep url(String u); }       // Schritt 1: Pflicht
public interface MethodStep { OptionalStep method(String m); }  // Schritt 2: Pflicht
public interface OptionalStep {                                 // Schritt 3: optional + build()
    OptionalStep timeout(Duration t);
    HttpRequest build();
}
class Steps implements UrlStep, MethodStep, OptionalStep {       // eine Klasse, alle Stufen
    String url, method; Duration timeout = Duration.ofSeconds(30);
    public MethodStep url(String u)         { this.url = u; return this; }
    public OptionalStep method(String m)    { this.method = m; return this; }
    public OptionalStep timeout(Duration t) { this.timeout = t; return this; }
    public HttpRequest build()              { return new HttpRequest(url, method, timeout); }
}
// builder().url("x").build();   // Compile-Fehler: build() erst auf OptionalStep`,
        annotations: [
          {
            lines: [2, 7],
            label: "Interface-Kette erzwingt Pflichtfelder zur Compile-Zeit",
            tone: "success",
            detail: {
              title: "Das einzige compile-zeit-sichere Builder-Idiom in Java",
              body: "<code>build()</code> ist erst sichtbar, nachdem die Pflicht-Setter durchlaufen wurden — das Nächste, was Java an „Dependent Types für Builder“ hat. Konzeptionell identisch zum Rust-Typestate. Preis: hohe Boilerplate, weshalb das generiert wird (Immutables, <code>@RecordBuilder</code>).",
            },
          },
        ],
      },
    ],
  },

  builderExplosion: {
    tabs: [
      {
        label: "TypeScript (type-level set)",
        language: "typescript",
        height: "225px",
        note: "Ein generischer Akkumulator der gesetzten Keys; <code>build()</code> ist nur verfügbar, wenn alle Pflicht-Keys enthalten sind.",
        code: `type Required = "url" | "method";
class ReqBuilder<Set extends Required = never> {
  private data: Partial<Record<Required, string>> = {};
  url(v: string)    { this.data.url = v;    return this as ReqBuilder<Set | "url">; }
  method(v: string) { this.data.method = v; return this as ReqBuilder<Set | "method">; }
  // build() existiert nur, wenn Set alle Required abdeckt:
  build(this: ReqBuilder<Required>) { return { ...this.data }; }
}
// new ReqBuilder().url("x").method("GET").build();   // ok, beliebige Reihenfolge
// new ReqBuilder().url("x").build();                 // Compile-Fehler: 'method' fehlt`,
        annotations: [
          {
            lines: 7,
            label: "build() nur sichtbar, wenn Set ⊇ Required",
            tone: "success",
            detail: {
              title: "type-level set tracking statt 2ᴺ Interfaces",
              body: "„Die Menge der noch fehlenden Pflichtfelder“ wird als <em>ein</em> komponierbarer Typ ausgedrückt, statt jede Teilmenge als konkretes Interface zu materialisieren. In Rust übernimmt das eine Kette von <code>PhantomData</code>-Markern (<code>typed-builder</code>, <code>bon</code>).",
            },
          },
        ],
        callout:
          "<strong>Lombok generiert bewusst keinen Staged-Modus:</strong> 10 Pflichtfelder in beliebiger Reihenfolge = 2¹⁰ = <strong>1024 Klassen</strong> (Lombok-Wiki: „combinatorial explosion of interfaces“). Bei fester Reihenfolge nur 10. Die Wurzel ist nicht das Fehlen von Summen-Typen, sondern fehlendes <em>type-level set tracking</em> in Javas Generics.",
      },
    ],
  },

  builderInheritance: {
    tabs: [
      {
        label: "Self-Type / @SuperBuilder",
        language: "java",
        height: "250px",
        note: "Der klassische Builder bricht bei Vererbung: geerbte Setter liefern den <em>Eltern</em>-Builder-Typ. Lösung: das selbstreferenzielle Generic-Pattern.",
        code: `abstract class Animal {
    String name;
    abstract static class Builder<C extends Animal, B extends Builder<C, B>> {
        private String name;
        protected abstract B self();         // jede Subklasse gibt ihren Builder-Typ zurück
        public abstract C build();
        public B name(String n) { this.name = n; return self(); }  // Chain bleibt im Subtyp B
    }
}
// Lombok automatisiert das mit @SuperBuilder (seit 1.18.2, weiterhin experimental):
@SuperBuilder class Dog extends Animal { private String breed; }
Dog d = Dog.builder().name("Rex").breed("Labrador").build();  // Reihenfolge frei`,
        annotations: [
          {
            lines: [3, 5],
            label: "F-bounded / CRTP Self-Type-Pattern",
            tone: "info",
            detail: {
              title: "Selbstreferenzielles Generic",
              body: "Die Builder-Basis trägt einen auf den konkreten Subtyp gebundenen Typ-Parameter <code>B</code> plus eine abstrakte <code>self()</code>-Methode, damit geerbte Setter den Kind-Builder-Typ zurückgeben. Die gesamte Hierarchie muss <code>@SuperBuilder</code> verwenden — kein Mischen mit <code>@Builder</code>.",
            },
          },
        ],
        callout:
          "<strong>Records sind hier kein Ersatz</strong> — Records können nicht erben. Genau dort lebt der Builder mit Vererbung weiter, wo Records an ihre Grenze stoßen.",
      },
    ],
  },

  builderNamedArgs: {
    tabs: [
      {
        label: "Kotlin",
        language: "kotlin",
        height: "170px",
        note: "Named + default args — der Builder wird schlicht <strong>überflüssig</strong>.",
        code: `class HttpRequest(
    val url: String,                             // Pflicht: KEIN Default
    val method: String = "GET",                  // optional
    val timeout: Duration = Duration.ofSeconds(30),
)
val r = HttpRequest(url = "https://x", method = "POST")
// HttpRequest(method = "POST")                  // Compile-Fehler: url fehlt`,
        annotations: [
          {
            lines: 2,
            label: "Pflichtfeld ohne Default → Compile-Zeit erzwungen",
            tone: "success",
            detail: {
              title: "Die Auflösung an der Wurzel",
              body: "Was Javas null-Safety dem Builder nicht geben kann (Pflichtfeld-Garantie zur Compile-Zeit), liefert Kotlin direkt über den Konstruktor — „kostenlos“, weil ein Parameter ohne Default eben gesetzt werden muss.",
            },
          },
        ],
      },
      {
        label: "Scala",
        language: "scala",
        height: "130px",
        note: "Named + default params — auf der JVM <strong>zuerst</strong> da.",
        code: `case class HttpRequest(
  url: String,                                   // Pflicht
  method: String = "GET",
  timeout: Duration = Duration.ofSeconds(30),
)
HttpRequest(url = "https://x", method = "POST")`,
      },
      {
        label: "Python",
        language: "python",
        height: "200px",
        note: "Ergonomie wie Kotlin, aber dynamisch: Pflichtfeld-Verstoß ist ein <code>TypeError</code> zur <strong>Laufzeit</strong>.",
        code: `from dataclasses import dataclass, field

@dataclass(frozen=True)
class HttpRequest:
    url: str                                     # Pflicht: kein Default
    method: str = "GET"                          # optional
    headers: dict = field(default_factory=dict)  # veränderlicher Default korrekt

HttpRequest(url="https://x", method="POST")
# HttpRequest(method="POST")                     # TypeError zur Laufzeit: url fehlt`,
      },
      {
        label: "TypeScript",
        language: "typescript",
        height: "200px",
        note: "Options-Objekt mit optionalen Properties; Pflichtfeld vom Type-Checker erzwungen.",
        code: `interface HttpRequestOptions {
  url: string;                                   // Pflicht
  method?: string;                               // optional
  timeout?: number;
}
function httpRequest(opts: HttpRequestOptions) {
  const { url, method = "GET", timeout = 30_000 } = opts;  // Defaults beim Destructuring
}
httpRequest({ url: "https://x", method: "POST" });
// httpRequest({ method: "POST" });              // Compile-Fehler: url fehlt`,
      },
      {
        label: "Go (functional options)",
        language: "go",
        height: "200px",
        note: "Go hat <strong>weder</strong> named <strong>noch</strong> default args. Das idiomatische Gegenmittel (Pike/Cheney): variadische Options-Funktionen.",
        code: `type Option func(*HttpRequest)                   // Option = Mutator-Funktion

func WithMethod(m string) Option { return func(r *HttpRequest) { r.method = m } }

func NewHttpRequest(url string, opts ...Option) *HttpRequest {  // url Pflicht = Positionsparam
    r := &HttpRequest{url: url, method: "GET"}
    for _, opt := range opts { opt(r) }          // optionale Felder anwenden
    return r
}
// NewHttpRequest("https://x", WithMethod("POST"))`,
        callout:
          "Ein komplettes Idiom, das nur existiert, weil eine Sprachlücke gefüllt werden muss — das Go-Gegenstück zum Java-Builder.",
      },
      {
        label: "Rust (zwei Endpunkte)",
        language: "rust",
        height: "210px",
        note: "Rust hat ebenfalls keine named/default args. Pragmatisch: <code>build()</code> liefert ein <code>Result</code> (Pflichtfeld → Fehler zur Laufzeit).",
        code: `struct Builder { url: Option<String>, method: String }
impl Builder {
    fn url(mut self, u: &str) -> Self { self.url = Some(u.into()); self }
    fn build(self) -> Result<HttpRequest, &'static str> {   // Pflichtfeld -> Result
        Ok(HttpRequest {
            url: self.url.ok_or("url is required")?,        // Laufzeit-Prüfung
            method: self.method,
        })
    }
}
// Compile-Zeit-Variante: PhantomData-Marker, generiert von \`typed-builder\`.`,
        callout:
          "Rust zeigt <strong>beide Enden desselben Spektrums</strong> in einer Sprache: <code>build() -&gt; Result</code> (Laufzeit) und Typestate via <code>PhantomData</code> (Compile-Zeit).",
      },
    ],
  },
};
