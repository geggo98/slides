// Schicht 2 (Strukturmuster) + Schicht 3 (Architektur-/DDD-Muster).

export const schicht23 = {
  // ─────────────────────────────────────────── Decorator
  decorator: {
    tabs: [
      {
        label: "Original (Java)",
        language: "java",
        height: "300px",
        note: "Wrapper, der dasselbe Interface implementiert und rekursiv schachtelbar ist. Zeremonie: jeder Decorator muss <em>jede</em> Methode neu deklarieren und delegieren.",
        code: `interface DataSource { String read(); }
class FileSource implements DataSource {
    public String read() { return "raw"; }
}
class EncryptedSource implements DataSource {       // Decorator 1
    private final DataSource wrapped;
    EncryptedSource(DataSource d) { this.wrapped = d; }
    public String read() { return decrypt(wrapped.read()); }
}
class CompressedSource implements DataSource {      // Decorator 2
    private final DataSource wrapped;
    CompressedSource(DataSource d) { this.wrapped = d; }
    public String read() { return decompress(wrapped.read()); }
}
// new CompressedSource(new EncryptedSource(new FileSource()));`,
      },
      {
        label: "Kotlin (by-Delegation)",
        language: "kotlin",
        height: "180px",
        note: "Generiert die Delegation <em>aller</em> Interface-Methoden automatisch; man überschreibt nur das Geänderte.",
        code: `interface DataSource { fun read(): String; fun close() }
class FileSource : DataSource {
    override fun read() = "raw"
    override fun close() { /* ... */ }
}
class EncryptedSource(private val wrapped: DataSource) : DataSource by wrapped {
    override fun read() = decrypt(wrapped.read())   // nur read() angepasst; close() auto-delegiert
}`,
        annotations: [
          {
            lines: 6,
            label: "by-Delegation generiert alle übrigen Methoden",
            tone: "success",
            detail: {
              title: "Kotlin Class Delegation",
              body: "Damit verschwindet die Decorator-Boilerplate, unter der Java leidet. Decorator bleibt konzeptionell [RELEVANT], aber Komposition + <code>by</code> eliminiert die manuelle Durchreich-Arbeit.",
            },
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────── Adapter
  adapter: {
    tabs: [
      {
        label: "Original (Java)",
        language: "java",
        height: "200px",
        note: "Object Adapter überbrückt eine Signatur-Inkompatibilität.",
        // String.raw: \" bleibt als Backslash-Quote sichtbar.
        code: String.raw`interface Json { String toJson(); }
class LegacyUser {                                  // fremde Klasse, kennt kein Json
    String name() { return "Ada"; }
}
class LegacyUserAdapter implements Json {           // Adapter überbrückt die Inkompatibilität
    private final LegacyUser u;
    LegacyUserAdapter(LegacyUser u) { this.u = u; }
    public String toJson() { return "{\"name\":\"" + u.name() + "\"}"; }
}`,
      },
      {
        label: "Go (strukturell)",
        language: "go",
        height: "150px",
        note: "Strukturelle Typisierung macht den Adapter oft überflüssig — erfüllt ein fremder Typ die Methodenform, konformiert er implizit.",
        code: `type Stringer interface{ String() string }          // aus fmt
type LegacyUser struct{ name string }
func (u LegacyUser) String() string { return u.name } // erfüllt Stringer implizit

var s Stringer = LegacyUser{"Ada"}                   // passt automatisch, kein Adapter nötig`,
        callout:
          "In Go/TypeScript (structural typing) entfällt der Adapter, sobald die <em>Form</em> passt; er bleibt nur bei echter Signatur-Inkompatibilität. Gamma nennt Adapter „a great example of the enduring nature of good design“.",
      },
    ],
  },

  // ─────────────────────────────────────────── Falscher Freund: Python @decorator
  falscherFreundPython: {
    tabs: [
      {
        label: "Python @decorator (HOF)",
        language: "python",
        height: "220px",
        note: "Gleiches Wort, anderes Konzept: syntaktischer Zucker für Higher-Order Functions, die zur <strong>Definitionszeit</strong> transformieren (AOP-artig).",
        code: `import functools, time
def timed(fn):                                       # KEIN GoF-Decorator
    @functools.wraps(fn)
    def wrapper(*a, **k):
        t = time.perf_counter()
        try: return fn(*a, **k)
        finally: print(time.perf_counter() - t)
    return wrapper

@timed
def work(): ...                                      # Definitionszeit-Transformation`,
      },
      {
        label: "GoF-Decorator (Komposition)",
        language: "python",
        height: "150px",
        note: "Das GoF-Decorator in Python ist schlicht ein Wrapper-Objekt — Komposition, zur <em>Laufzeit</em>.",
        code: `class TimedSource:                                   # GoF-Decorator = Wrapper-Objekt
    def __init__(self, inner): self.inner = inner
    def read(self):
        t = time.perf_counter()
        try: return self.inner.read()
        finally: print(time.perf_counter() - t)`,
        callout:
          "<strong>Falscher Freund #2:</strong> Für didaktisches Material zwingend zu trennen — Python <code>@decorator</code> ≠ strukturelles GoF-Decorator.",
      },
    ],
  },

  // ─────────────────────────────────────────── Value Object
  valueObject: {
    tabs: [
      {
        label: "Java (record)",
        language: "java",
        height: "140px",
        note: "Wertgleichheit statt Identitätsgleichheit, Immutability. Die GoF/DDD-Boilerplate (<code>equals</code>/<code>hashCode</code> von Hand) ist weg.",
        code: `record Money(BigDecimal amount, Currency currency) {
    Money {                                          // kompakter Konstruktor: Invarianten
        if (amount.signum() < 0) throw new IllegalArgumentException("negativ");
    }
}`,
        annotations: [
          {
            lines: 1,
            label: "JEP 395 — record (final JDK 16)",
            tone: "success",
            detail: {
              title: "record",
              body: "<code>equals</code>/<code>hashCode</code>/<code>toString</code> gratis, flach unveränderlich. Definierendes VO-Kriterium (Fowler): Wertgleichheit statt Identitätsgleichheit.",
            },
          },
        ],
      },
      {
        label: "Kotlin",
        language: "kotlin",
        height: "110px",
        note: "<code>data class</code> + <code>value class</code> für Ein-Feld-VOs ohne Heap-Allokation.",
        code: `data class Money(val amount: BigDecimal, val currency: Currency)

@JvmInline
value class UserId(val value: Long)                  // inline: keine Wrapper-Allokation`,
      },
      {
        label: "Rust",
        language: "rust",
        height: "80px",
        note: "<code>struct</code> mit <code>derive</code> — Wertgleichheit, Clone.",
        code: `#[derive(Debug, Clone, PartialEq, Eq)]
struct Money { amount: i64, currency: Currency }`,
      },
      {
        label: "Python",
        language: "python",
        height: "100px",
        note: "Frozen dataclass — <code>__eq__</code>/<code>__hash__</code> generiert, immutable.",
        code: `@dataclass(frozen=True)
class Money:
    amount: Decimal
    currency: str`,
        callout:
          "<strong>Caveat:</strong> Javas <code>record</code> bietet nur <em>flache</em> Immutability und eignet sich nicht als JPA-Entity (<code>final</code>, kein No-Arg-Konstruktor). <strong>Entity</strong> (Identität, Lebenszyklus) bleibt davon getrennt und [RELEVANT].",
      },
    ],
  },

  // ─────────────────────────────────────────── Repository
  repository: {
    tabs: [
      {
        label: "Spring Data (generiert)",
        language: "java",
        height: "230px",
        note: "Man deklariert ein Interface — das Framework generiert die Implementierung.",
        code: `public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);       // Query aus dem Methodennamen abgeleitet
}

@Service
class UserService {
    private final UserRepository users;
    UserService(UserRepository users) { this.users = users; }
    User byEmail(String e) { return users.findByEmail(e).orElseThrow(); }
}`,
        annotations: [
          {
            lines: [1, 3],
            label:
              "Spring Data erzeugt zur Laufzeit einen Proxy hinter dem Interface",
            tone: "info",
            detail: {
              title: "Brücke zu Teil III",
              body: "Das Muster bleibt vollständig gültig; was sich ändert, ist, dass die <strong>Implementierung generiert</strong> wird. Repository ist ein Architekturmuster, dessen <em>Implementierung</em> heute Metaprogramming ist.",
            },
          },
        ],
        callout:
          "<strong>Active Record</strong> (Objekt kennt seine Persistenz: <code>user.save()</code>; Rails, Django) vs. <strong>Data Mapper</strong> (Mapper/Repository trennt Objekt von DB; Hibernate/JPA) ist eine echte Architekturentscheidung — ohne Sprachfeature-Ersatz.",
      },
    ],
  },
};
