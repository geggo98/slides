// Teil III — Metaprogramming als Pattern-Substrat: dynamische Proxies, Spring AOP,
// HOF-Gegenentwurf, Annotation Processing.

export const meta = {
  // ─────────────────────────────────────────── Dynamische Proxies
  proxies: {
    tabs: [
      {
        label: "Java (reflect.Proxy)",
        language: "java",
        height: "315px",
        note: "Ein einziger <code>InvocationHandler</code> ersetzt N handgeschriebene Proxy-/Decorator-Klassen.",
        code: `interface Service { String fetch(String id); }
class RealService implements Service {
    public String fetch(String id) { return "data:" + id; }
}

Service real = new RealService();
Service proxy = (Service) Proxy.newProxyInstance(
    Service.class.getClassLoader(),
    new Class<?>[]{ Service.class },
    (p, method, args) -> {                  // ein Handler für ALLE Methoden
        long t = System.nanoTime();
        try { return method.invoke(real, args); }   // Delegation an das echte Objekt
        finally { log(method.getName(), System.nanoTime() - t); }
    });
// proxy.fetch("42");  // Logik + Cross-Cutting, ohne eigene Proxy-Klasse`,
        annotations: [
          {
            lines: [10, 13],
            label:
              "Ein Handler für alle Methoden — Einschränkung: nur Interfaces",
            tone: "info",
            detail: {
              title: "java.lang.reflect.Proxy",
              body: "Für konkrete Klassen braucht es CGLIB/ByteBuddy. Dynamische Proxies <strong>implementieren</strong> das Proxy-Pattern boilerplate-frei und subsumieren Decorator — der Intent (Stellvertreter/Interzeption) bleibt, was verschwindet sind die handgeschriebenen Klassen.",
            },
          },
        ],
      },
      {
        label: "JavaScript (Proxy-Traps)",
        language: "javascript",
        height: "280px",
        note: "Mächtiger als Java: <strong>Property-Zugriff</strong> wird abgefangen, nicht nur deklarierte Methoden.",
        // \` und \${ escapen, damit die JS-Template-Literale im Code sichtbar bleiben.
        code: `const realService = { fetch: (id) => \`data:\${id}\` };

const proxy = new Proxy(realService, {
  get(target, prop, receiver) {            // Trap auf jeden Property-Zugriff
    const orig = Reflect.get(target, prop, receiver);
    if (typeof orig !== "function") return orig;
    return (...args) => {
      console.time(prop);
      try { return orig.apply(target, args); }
      finally { console.timeEnd(prop); }
    };
  },
});`,
        annotations: [
          {
            lines: 4,
            label: "Vue 3 baut seine Reaktivität auf genau diesem Mechanismus",
            tone: "info",
            detail: {
              title: "JS Proxy ≫ Java Proxy",
              body: "Abgefangen wird jeder Property-Zugriff (Ersatz für Vue 2s <code>Object.defineProperty</code>-Getter/Setter). MobX und Immer nutzen dasselbe.",
            },
          },
        ],
        callout:
          "<strong>Falscher Freund #4:</strong> Dynamische Proxies/AOP <strong>ersetzen</strong> das Proxy-Pattern nicht — sie <em>implementieren</em> es. Norvig ordnet Proxy in „first-class types“ ein: Reflection ist die Metaprogramming-Antwort der JVM auf fehlende first-class types.",
      },
    ],
  },

  // ─────────────────────────────────────────── Self-Invocation / Re-Entrancy
  selfInvocation: {
    tabs: [
      {
        label: "Fall A — Bypass (Java)",
        language: "java",
        height: "170px",
        note: "Hält der Proxy ein eigenes Target und delegiert dorthin, ist <code>this</code> im Rumpf das <strong>Target</strong> — interne/rekursive Aufrufe umgehen die Interzeption.",
        code: `// JDK-Proxy: nur der erste Aufruf wird interzipiert, der rekursive nicht.
class CounterImpl implements Counter {
    public int countdown(int n) {
        if (n <= 0) return 0;
        return countdown(n - 1);   // this == Target, NICHT der Proxy -> ab hier kein Logging
    }
}`,
        annotations: [
          {
            lines: 5,
            label: "Receiver = Target → Bypass",
            tone: "danger",
            detail: {
              title: "Betrifft GoF-Proxy, JDK Dynamic Proxy UND Spring AOP",
              body: "Sobald der Geschäftslogik-Rumpf gegen die Target-Instanz läuft (<code>method.invoke(target, …)</code>), geht jeder <code>this.x()</code>-Aufruf direkt ans Target. Rekursion ist nur ein Selbstaufruf und folgt derselben Regel.",
            },
          },
        ],
      },
      {
        label: "Fall B — Receiver-Bindung (Java vs. JS)",
        note: "Identischer Selbstaufruf, zwei Ergebnisse — entscheidend ist, worauf <code>this</code> im Rumpf zeigt.",
        diagrams: [
          {
            title: "JDK Dynamic Proxy — <code>this = Target</code>",
            code: `sequenceDiagram
  participant C as Aufrufer
  participant P as Proxy
  participant T as Target
  C->>P: countdown(2)
  P->>T: method.invoke(target)
  Note over T: this = Target
  T->>T: this.countdown(1)
  Note over T: Selbstaufruf umgeht Proxy<br/>kein Logging`,
          },
          {
            title: "JS Proxy — <code>this = Proxy</code>",
            code: `sequenceDiagram
  participant C as Aufrufer
  participant P as Proxy
  participant T as Target
  C->>P: countdown(2)
  P->>T: orig(), receiver = Proxy
  Note over T: this = Proxy
  T->>P: this.countdown(1)
  P->>T: orig() erneut
  Note over P: re-entert Trap<br/>Logging`,
          },
        ],
        caveat:
          "⚠️ <strong>Arrow Functions:</strong> Klassenfeld-Arrows (<code>m = () => …</code>) binden <code>this</code> lexikalisch bei der Konstruktion → <strong>Target</strong>, umgehen den Proxy wie Fall A. Nur reguläre Methoden re-entern.",
        callout:
          "Maßgeblich ist nie „Proxy ja/nein“, sondern die <strong>Receiver-Bindung</strong>. Transparente, dispatch-basierte Proxies legen Cross-Cutting nicht <em>zuverlässig</em> auf jeden Aufruf.",
      },
    ],
  },

  // ─────────────────────────────────────────── Spring AOP
  springAop: {
    tabs: [
      {
        label: "@Transactional",
        language: "java",
        height: "170px",
        note: "Spring AOP ist das Proxy-Pattern industrialisiert: Beans werden gewrappt, Advice über <code>MethodInterceptor</code> eingewoben.",
        code: `@Service
public class PaymentService {
    @Transactional                          // proxy-basierter Aspekt: begin/commit/rollback
    public void transfer(Long from, Long to, BigDecimal amount) {
        // reine Geschäftslogik — kein tx-Boilerplate, kein try/catch/rollback
    }
}`,
        annotations: [
          {
            lines: 3,
            label:
              "Absorbiert Proxy + Decorator + Template-Method-Skelett + Strategy-Policy",
            tone: "info",
            detail: {
              title: "Deklarative Aspekte",
              body: "<code>@Transactional</code>, <code>@Cacheable</code>, <code>@Async</code>, <code>@Retryable</code>, <code>@PreAuthorize</code>, <code>@Validated</code> … alle proxy-basiert. Default: Framework <code>proxyTargetClass=false</code> (JDK-Proxy), aber Spring Boot 2.0+ setzt <code>=true</code> → CGLIB als Standard.",
            },
          },
        ],
      },
      {
        label: "Failure Mode: Self-Invocation",
        language: "java",
        height: "235px",
        note: "Der häufigste Fehler — ein interner <code>this</code>-Aufruf umgeht den Proxy; der Aspekt greift <strong>stillschweigend</strong> nicht.",
        code: `@Service
public class OrderService {
    @Transactional
    public void outer() {
        inner();                            // ACHTUNG: this.inner() umgeht den Proxy
    }
    @Transactional(propagation = REQUIRES_NEW)
    public void inner() {                   // greift bei Aufruf via outer() NICHT
        // ...
    }
}`,
        annotations: [
          {
            lines: 5,
            label:
              "Fall A von der Self-Invocation-Folie — kein Spring-Bug, sondern Receiver-Bindung",
            tone: "danger",
            detail: {
              title: "Notlösungen",
              body: "Self-Injection, <code>AopContext.currentProxy()</code> (braucht <code>exposeProxy=true</code>), oder Refactoring in eine zweite Bean.",
            },
          },
        ],
        callout:
          "Weitere Failure Modes: <strong>final/private</strong> (CGLIB kann nicht subklassen → Advice ignoriert), <strong>nur public Method-Execution-Joinpoints</strong> (Spring-AOP ⊊ AspectJ), <strong>zwei Objekt-Identitäten</strong> (Proxy ≠ Target).",
      },
    ],
  },

  // ─────────────────────────────────────────── Higher-Order Functions
  hof: {
    tabs: [
      {
        label: "TransactionTemplate",
        language: "java",
        height: "180px",
        note: "Programmatisch statt <code>@Transactional</code>/<code>@Retryable</code>: die Reihenfolge ist explizit, das Self-Invocation-Problem entfällt.",
        code: `// Retry AUSSEN, Transaktion INNEN: jeder Versuch erhält eine frische Transaktion.
retryTemplate.execute(ctx ->
    transactionTemplate.execute(status -> {
        var draft = articles.findById(id).orElseThrow();
        draft.setSlug(slugGenerator.next());
        return articles.save(draft);        // transienter Fehler -> Rollback + Retry
    })
);`,
      },
      {
        label: "Resilience4j",
        language: "java",
        height: "150px",
        note: "Die Bibliothek ist „designed for functional programming“ — HOF-Dekoratoren für CircuitBreaker, Retry, RateLimiter …",
        code: `Supplier<String> decorated = Decorators.ofSupplier(() -> backend.call())
    .withRetry(retry)                       // Reihenfolge hier = Ausführungs-Schachtelung
    .withCircuitBreaker(circuitBreaker)
    .decorate();
String result = decorated.get();`,
        annotations: [
          {
            lines: [2, 3],
            label: "Die Reihenfolge der Dekoration IST die Semantik",
            tone: "warning",
            detail: {
              title: "Reihenfolge-Problem",
              body: "Die Annotations-Reihenfolge ist <em>fest</em>: <code>Retry(CircuitBreaker(RateLimiter(TimeLimiter(Bulkhead(fn)))))</code>. Für eine andere Reihenfolge „you must use the functional chaining style instead of the Spring annotations style“.",
            },
          },
        ],
      },
      {
        label: "React HOC",
        language: "javascript",
        height: "150px",
        note: "Eine HOC ist „a function that takes a component and returns a new component“.",
        code: `const withLogging = (Wrapped) => (props) => {   // expliziter Wrapper
  console.log("render", Wrapped.name);
  return <Wrapped {...props} />;
};
const LoggedButton = withLogging(Button);
// connect(mapState)(C), withRouter(C), React.memo(C), withErrorBoundary(C)`,
      },
      {
        label: "Kotlin",
        language: "kotlin",
        height: "130px",
        note: "Ein sichtbarer Retry-Wrapper als inline-HOF.",
        code: `inline fun <T> withRetry(times: Int, block: () -> T): T {
    repeat(times - 1) { runCatching { return block() } }
    return block()
}
// withRetry(3) { client.call() }`,
        callout:
          "Higher-Order Functions machen Cross-Cutting <strong>explizit am Aufrufort</strong> sichtbar — kein <code>this</code>-Dispatch (kein Self-Invocation-Problem), und die Schachtelung <em>ist</em> die Reihenfolge. Preis: der Verlust der Transparenz.",
      },
    ],
  },

  // ─────────────────────────────────────────── Annotation Processing
  annotationProcessing: {
    tabs: [
      {
        label: "MapStruct (APT)",
        language: "java",
        height: "120px",
        note: "Annotation Processors erzeugen <strong>zur Compile-Zeit</strong> Quellcode — ohne Laufzeit-Reflection, ohne Proxy-Kosten.",
        code: `@Mapper  // generiert zur Compile-Zeit eine Impl
public interface UserMapper {
    UserDto toDto(User user);  // plain, debugbar, reflexionsfrei
}`,
        annotations: [
          {
            lines: [1, 3],
            label: "Magie von der Laufzeit auf die Compile-Zeit verschoben",
            tone: "success",
            detail: {
              title: "APT — der andere Punkt im Spektrum",
              body: "Keine Reflection-Kosten, AOT-/Native-Image-tauglich, im Debugger sichtbarer Code — aber an den Build gebunden. Genau dieser Trade-off treibt <strong>Micronaut/Quarkus</strong> als Compile-Zeit-Alternativen zu Springs Laufzeit-Proxies (Lombok, MapStruct, Dagger).",
            },
          },
        ],
      },
    ],
  },
};
