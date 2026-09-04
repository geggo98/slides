# Datenpersistenz-Patterns über Sprachen hinweg — Eine konzeptionelle Taxonomie

## TL;DR

- **Es gibt nicht „ORM vs. SQL", sondern sieben konzeptionell unterschiedliche Pattern-Cluster** — Active Record, Data Mapper (mit Identity Map + Unit of Work), Repository, Query Builder / Fluent SQL DSL, Language-Integrated Query, SQL Mapper / Micro-ORM und alternative Datenmodelle (Datomic) — die sich in _Mapping-Richtung_, _SQL-Kontrolle_, _Objekt-Graph-Verwaltung_ und _Typsicherheit_ fundamental unterscheiden. Werkzeuge wie Hibernate, jOOQ, EF Core, Drizzle oder Datomic sind Implementierungen _innerhalb_ dieser Cluster, keine austauschbaren Alternativen.
- **Die meisten Diskussionen verlaufen falsch**, weil sie Werkzeuge derselben Kategorie verwechseln mit denen anderer Kategorien: „jOOQ vs. Hibernate" ist nicht „Query Builder vs. ORM" als wertende Wahl, sondern eine Designentscheidung zwischen „SQL ist Wahrheit, Objekt-Graph wird daraus abgeleitet" und „Objekt-Graph ist Wahrheit, SQL wird generiert". Repository über einem ORM ist in den meisten Fällen redundant, weil `DbContext`/Hibernate-`Session` bereits Unit of Work + Repository sind — Microsoft Learn sagt das wörtlich: „The Entity Framework DbContext class is based on the Unit of Work and Repository patterns and can be used directly from your code."
- **Empfehlung für JVM-Schulungsmaterial**: Lehre Patterns _vor_ Werkzeugen. Beginne mit Fowlers PoEAA-Definitionen, kontrastiere Active Record (Rails-Ursprung) gegen Data Mapper (Hibernate/JPA), dann Repository als Domänenabstraktion, dann SQL-zentrierte Alternativen (jOOQ, MyBatis, Slick FRM, Doobie). Datomic gehört in einen separaten Abschnitt — es ist keine andere Implementierung desselben Patterns, sondern ein anderes Datenmodell.

---

## Kernbegriffe / Glossar

| Begriff                                   | Definition                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **ORM (im strengen Sinn)**                | Objekt-relationaler Mapper mit _Objekt-Graph-Management_: Identity Map, Unit of Work, Change Tracking, Lazy Loading. Beispiele: Hibernate, EF Core, SQLAlchemy ORM, Doctrine.                                                                                                                                                                    |
| **Query Builder / Fluent SQL DSL**        | Typsichere Konstruktion von SQL-Statements in der Host-Sprache. _Kein_ Objekt-Graph-Management, _keine_ Persistence-Identity. Beispiele: jOOQ, Slick (FRM), Kysely, Drizzle, SQLAlchemy Core, Knex.js.                                                                                                                                           |
| **Micro-ORM / SQL Mapper**                | Handgeschriebenes SQL + Result-zu-Objekt-Mapping. Kein Change Tracking, kein Graph-Management. Beispiele: Dapper, MyBatis, JDBI, sqlc, sqlx, JdbcTemplate.                                                                                                                                                                                       |
| **Active Record (Fowler PoEAA)**          | „Ein Objekt, das eine Zeile einer Datenbank-Tabelle oder -View kapselt, die Datenbank-Zugriffe kapselt und Domänenlogik auf den Daten hinzufügt." Persistenz lebt _im_ Domänenobjekt.                                                                                                                                                            |
| **Data Mapper (Fowler PoEAA)**            | „Ein Layer von Mappern, der Daten zwischen Objekten und einer Datenbank bewegt, während er sie unabhängig voneinander und vom Mapper hält." Trennt Domänenobjekt strikt von Persistenz.                                                                                                                                                          |
| **Identity Map (Fowler PoEAA)**           | Stellt sicher, dass jedes Objekt nur einmal geladen wird, indem jedes geladene Objekt in einer Map gehalten wird. Voraussetzung für sinnvolles Change Tracking.                                                                                                                                                                                  |
| **Unit of Work (Fowler PoEAA)**           | Hält die Liste aller Objekte, die in einer Geschäftstransaktion betroffen sind, und koordiniert das Schreiben der Änderungen sowie das Lösen von Concurrency-Problemen.                                                                                                                                                                          |
| **Repository (Evans DDD / Fowler PoEAA)** | Sammlungsähnliche Abstraktion über Persistenz, die das _Mapping-Layer und Domänenlayer_ trennt. Typisch: `OrderRepository.findById(id): Order`. Gehört konzeptionell zur Domäne, nicht zur Infrastruktur.                                                                                                                                        |
| **Language-Integrated Query (LINQ)**      | Abfragen als Sprachkonstrukt mit Comprehension-Syntax, vom Compiler verarbeitet und in das Ziel-SQL übersetzt. Erstmals in C# 3.0 (2007); konzeptionell auch in Slick und Quill (Inspiriert durch Philip Wadlers „A practical theory of language-integrated query").                                                                             |
| **Object-Relational Impedance Mismatch**  | Strukturelle Inkompatibilität zwischen relationalem Modell (Mengen, Tupel, Schlüssel) und Objektmodell (Identität, Vererbung, Kapselung, Graphen). Ted Neward prägte den Begriff erstmals bei Microsoft TechEd 2004 in San Diego und veröffentlichte den ausführlichen Essay „The Vietnam of Computer Science" am 26. Juni 2006 auf seinem Blog. |
| **Leaky Abstraction (Spolsky 2002)**      | „All non-trivial abstractions, to some degree, are leaky." Gilt insbesondere für ORMs: Performance, Lazy-Loading-Verhalten und generiertes SQL leaken durch die Abstraktion.                                                                                                                                                                     |
| **N+1 Query Problem**                     | Klassischer ORM-Failure-Mode: Eine Query liefert N Entities, anschließend wird für jedes Entity eine separate Query für eine Beziehung ausgelöst — N+1 Queries statt einer Join-Query.                                                                                                                                                           |
| **FRM (Functional Relational Mapping)**   | Begriff von Slick (Lightbend): Relationen werden als monadische Collections behandelt, Queries als reine, komponierbare Werte. Bewusst als _Gegenentwurf zum ORM_ positioniert.                                                                                                                                                                  |
| **Datalog**                               | Deklarative, logikbasierte Query-Sprache (Subset von Prolog). Verwendet u.a. von Datomic. Pattern-Matching auf Fakten/Tupeln statt SELECT/FROM/WHERE.                                                                                                                                                                                            |

---

## Pattern-Übersicht (Vergleichsachsen)

| Pattern                        | Mapping-Richtung                                  | Wer hält das SQL?                | Objekt-Graph? | Identity Map / UoW?                         | Typsicherheit                   | SQL-Kontrolle      |
| ------------------------------ | ------------------------------------------------- | -------------------------------- | ------------- | ------------------------------------------- | ------------------------------- | ------------------ |
| **Active Record**              | Schema → Klasse (1:1)                             | Framework generiert              | Ja (begrenzt) | Meist nein (außer Rails Persistence Caches) | Schwach (Runtime)               | Niedrig            |
| **Data Mapper / ORM**          | Objektmodell ↔ Schema (via Mapping)               | ORM generiert                    | Ja            | **Ja**                                      | Schwach bis mittel              | Niedrig bis mittel |
| **Repository**                 | Über ORM oder Mapper                              | Delegiert                        | Delegiert     | Delegiert                                   | Abhängig                        | Abhängig           |
| **Query Builder / Fluent DSL** | Manuelle SQL-Konstruktion                         | Entwickler (in DSL)              | **Nein**      | Nein                                        | Stark (Compile-Time)            | Hoch               |
| **Language-Integrated Query**  | Sprachkonstrukt → SQL                             | Compiler + Provider              | Optional      | Optional                                    | Stark                           | Mittel             |
| **SQL Mapper / Micro-ORM**     | SQL → Struct/Klasse                               | **Entwickler (handgeschrieben)** | Nein          | Nein                                        | Stark (mit codegen) bis schwach | Maximal            |
| **Datomic (Datalog/EAVT)**     | Kein O/R-Mapping — Entitäten sind Sets von Datoms | Datalog statt SQL                | Graph-nativ   | Immutable, kein UoW nötig                   | Schwach (dynamisch)             | N/A                |

---

## 1. Active Record

### Definition (Fowler PoEAA)

„An object that wraps a row in a database table or view, encapsulates the database access, and adds domain logic on that data." Eine Klasse repräsentiert eine Tabelle; eine Instanz repräsentiert eine Zeile; statische Methoden bieten Finder (`User.find(id)`), Instanzmethoden bieten Persistenz (`user.save()`).

### Kernidee

Domänenobjekt **enthält** Persistenz-Logik. Maximale Konvention, minimale Konfiguration. Optimiert für Schemata, die nahe an der Domäne sind.

### Konkrete Implementierungen

- **Ruby on Rails ActiveRecord** (Ursprung, 2004) — namensgebend, definiert das Genre. `User.where(active: true).order(:name)`. Migrations, Validations, Callbacks und Assoziationen sind Teil der Klasse.
- **Django ORM Models** (Python) — Active Record mit etwas Mapper-Charakter: `Manager`-Objekte (`User.objects.filter(...)`) entkoppeln Queries vom Modell, aber `save()`/`delete()` leben am Modell.
- **Eloquent** (Laravel/PHP, Querverweis) — Rails-inspiriert, mit Query-Scopes und Relations.
- **GORM** (Grails, JVM) — Active-Record-Stil über Hibernate; demonstriert eindrücklich, dass das Pattern und die zugrunde liegende Implementierung orthogonal sein können.
- **Exposed DAO-API** (Kotlin/JetBrains) — Klassen erben von `IntEntity`, Companion erbt von `IntEntityClass`. Active-Record-artige Syntax über JDBC mit Kotlin-Property-Delegation (`var name by Users.name`).
- **Ktorm** (Kotlin) — Kombination aus Active Record (Entity Interfaces mit `flushChanges()`) und SQL DSL.

### Trade-offs

- **Pro**: Sehr schnelle CRUD-Entwicklung, geringe Boilerplate, niedrige Lernkurve.
- **Pro**: Nahe-1:1-Mapping zwischen Code und Schema reduziert kognitive Last für einfache Modelle.
- **Contra**: Vermischung von Domänen- und Persistenzlogik. Testbarkeit leidet — Modell-Klassen sind nicht ohne DB instanziierbar.
- **Contra**: „Fat Models"-Anti-Pattern: Da Domänenlogik typischerweise im Modell landet (vgl. „Skinny Controller, Fat Model"-Doktrin in Rails), bläht sich die Klasse zur Mülldeponie aller Geschäftsregeln auf.
- **Contra**: Schema-Domäne-Kopplung ist hart: Schemaänderungen sind Quellcode-Änderungen am Modell, und Tabellennamen sind an Klassennamen gebunden (Steve Klabnik: „ActiveRecord's greatest strength is also its problem: Tying class names to table names").

### Wann **nicht** einsetzen

- Wenn Domänenmodell **nicht** dem Schema folgen kann/soll (z.B. Modellierung mehrerer Bounded Contexts auf einer Legacy-DB, polymorphe Aggregate, Schema von externer Authority kontrolliert).
- Wenn Schreibmodelle (Commands) komplex sind, mit Invarianten über mehrere Aggregate hinweg (CQRS-Szenarien).
- Wenn Domänenobjekte rein/immutable sein sollen (FP-Stil).
- Wenn echte Modul-/Schicht-Trennung gefordert ist (DDD mit Persistence Ignorance).

---

## 2. Data Mapper / Identity Map / Unit of Work

### Definition (Fowler PoEAA)

„A layer of Mappers that moves data between objects and a database while keeping them independent of each other and the mapper itself." Das Domänenobjekt weiß **nichts** über Persistenz; der Mapper kennt beide Seiten.

### Kernidee

Strikte Trennung. Persistence Ignorance des Domänenmodells. Ein „Session"/„Context"/„Unit of Work" beobachtet eine Menge von Objekten, trackt Änderungen via Dirty Checking und persistiert sie _als Einheit_ beim Commit. Identity Map garantiert, dass dieselbe DB-Zeile innerhalb einer Session genau einem Objekt entspricht.

### Konkrete Implementierungen

- **Hibernate / JPA** (Java/Kotlin) — kanonische JVM-Implementierung; `Session` = Unit of Work + Identity Map; `@Entity`-Klassen sind die Mapped-Klassen. Lazy Loading via Proxies (führt zu N+1, siehe unten). De-facto-Standard im Java-Enterprise.
- **Entity Framework Core** (C#/.NET) — `DbContext` ist explizit als „Unit of Work + Repository"-Kombination dokumentiert (Microsoft Learn: „The Entity Framework DbContext class is based on the Unit of Work and Repository patterns and can be used directly from your code"). `DbSet<T>` ist konzeptionell ein Repository über einer Entity.
- **SQLAlchemy ORM** (Python) — explizit Data Mapper (im Gegensatz zu Django ORM, das Active Record ist). `Session` = Unit of Work. Bietet sowohl „Declarative" als auch „Imperative/Classical" Mapping-Stile; intern derselbe `Mapper`. Anmerkung: SQLAlchemy hat zwei _Schichten_ — Core (Query Builder, siehe Cluster 4) und ORM (Data Mapper darüber).
- **Doctrine** (PHP, Querverweis) — explizit Hibernate-inspiriert; Data Mapper als Referenz für PHP.
- **MikroORM** (TypeScript) — laut Doku „the only mainstream TS ORM implementing Unit of Work + Identity Map + Data Mapper together"; bewusst nach Doctrine/Hibernate-Vorbild gebaut.
- **TypeORM** (TypeScript) — unterstützt sowohl Active Record als auch Data Mapper, Maintenance jedoch lückenhaft; siehe Sektion „Stand 2025/2026".
- **Prisma** (TypeScript) — kein klassischer Data Mapper im Fowler-Sinn; eher Schema-First-Code-Generator mit Client-API. Kein UoW, keine Entity-Identity über Queries hinweg. Architektonisch näher an einem typsicheren Query Builder mit Object-Hydration.
- **Ent** (Go) — Schema-as-Code + Code-Generation; eher Graph-ORM (Entities + Edges) als klassischer Data Mapper; seit 1. September 2021 unter der Linux Foundation (Linux Foundation Ankündigung: „Ent, an entity framework for Go that was developed and open sourced by Facebook in 2019, has moved under the governance of the Linux Foundation.").
- **Diesel** (Rust) — Data-Mapper-artig mit DSL-Query-Builder; vollständig type-safe via Rusts Typsystem.

### Trade-offs

- **Pro**: Domänenmodell sauber, testbar, sprachidiomatisch.
- **Pro**: Change-Tracking + Cascading machen komplexe Object-Graph-Persistierung trivial _wenn sie passt_.
- **Pro**: Identity Map verhindert Bugs durch doppelte In-Memory-Repräsentation derselben Zeile.
- **Contra**: Komplexe Lernkurve. JPA/Hibernate hat dutzende Annotations, vier Lifecycle-Zustände (transient/managed/detached/removed), Lazy-Loading-Fallstricke.
- **Contra**: _Leaky Abstraction_ (Spolsky-Law) wird hier maximal sichtbar — der Entwickler _muss_ das generierte SQL kennen, sonst sind Performance-Bugs unvermeidlich.
- **Contra**: **N+1 Query Problem** ist das Standard-Failure-Mode. Lazy-Loading + Iteration → eine Query pro Beziehung. Lösungen: JOIN FETCH (JPQL), `@EntityGraph`, `@BatchSize`, `@Fetch(SUBSELECT)` (Hibernate-spezifisch), Eager Fetching (oft schlechter, da Over-Fetching). EF Core: `.Include()`, Split Queries. SQLAlchemy: `selectinload`, `joinedload`. Alle ORMs haben dieses Problem in irgendeiner Form.
- **Contra**: Komplexe Reports/Analyse-Queries sind unnatürlich. Lukas Eder (jOOQ): „ORMs sind gut für CRUD, schlecht für komplexe Queries."

### Wann **nicht** einsetzen

- Schreiblastige Pipelines mit komplexer SQL (Bulk-Updates, Window Functions, CTEs, MERGE). Hibernate generiert hier suboptimales SQL oder erzwingt Native Queries.
- Reporting/Analytics: massive Joins, Aggregationen, Pivot. Hier ist SQL-zentriert (jOOQ, Slick, Doobie) klar überlegen.
- CQRS-Read-Side: Read-Modelle sind eh denormalisiert; ORM bringt nichts.
- High-Performance-Hot-Paths: Hibernate-Sessions, Proxy-Generierung, Change Tracking kosten messbar CPU. Micro-ORMs sind hier signifikant schneller.

### Failure Modes (dokumentiert)

- **N+1 Queries** (siehe oben) — überall, wo Lazy Loading aktiv ist.
- **LazyInitializationException** (Hibernate): Zugriff auf Lazy-Collection außerhalb der Session.
- **DetachedEntityPassedToPersistException** / Cascading-Konflikte.
- **First-Level Cache Staleness**: zweite Query in derselben Session sieht alte Werte aus Identity Map, nicht DB-State (vor allem nach nativen Updates).
- **MultipleBagFetchException** (Hibernate): mehrere `JOIN FETCH` auf `List`-Collections gleichzeitig.

---

## 3. Repository Pattern

### Definition

Evans (DDD): „A Repository represents all objects of a certain type as a conceptual set." Fowler (PoEAA): „Mediates between the domain and data mapping layers using a collection-like interface for accessing domain objects."

### Kernidee

Domänencode arbeitet mit `OrderRepository.findByCustomerId(id)`, nicht mit Session/DbContext/SQL. Repository ist Teil der **Domänenschicht**, seine Implementierung Teil der **Infrastruktur** (Hexagonal/Onion/Clean Architecture).

### Konkrete Implementierungen

- **Spring Data Repositories** (Java/Kotlin) — `JpaRepository<Order, Long>`. Generiert Implementierungen aus Method-Namen oder `@Query`. Reduziert Boilerplate massiv. _Spring-Data_ mischt allerdings den Fowler-Repository und das Generic Repository (alle Methoden für alle Typen).
- **Repository-Interfaces in C#/.NET** — manuell oder via MediatR/Query-Objects. Häufig als `IRepository<T>` mit `Add`, `Update`, `GetById`, `Find`.

### Die kontroverse Debatte: Repository über ORM = Anti-Pattern?

**Position „Anti-Pattern":**

- Microsoft selbst dokumentiert: „The Entity Framework DbContext class is based on the Unit of Work and Repository patterns" (Microsoft Learn). Ergo: ein Custom-Repository über `DbContext` ist „Abstraktion über einer bereits abstrakten Abstraktion."
- Hamid Mosalla (2018): „Another important reason for not using repository pattern with an ORM such as entity framework is that they already implement these patterns. So it would be unnecessary abstraction over an already working abstraction."
- Praktische Probleme:
  - Das Repository deckt nie alle Features des ORM ab → Entwickler greifen am Repository vorbei oder das Repository wuchert.
  - „Wir können später das ORM austauschen": passiert in 99% der Projekte nie. Wenn doch, sind Queries eh komplett anders zu schreiben (relational → NoSQL).
  - **Generic Repository** (`IRepository<T>`) ist besonders kritisiert: bringt keinen Mehrwert gegenüber `DbSet<T>`/`Session`, verletzt aber Single Responsibility, weil ein einziger Typ alle Aggregat-Typen handhabt. Robin Choffardet: „It's a fairly common mistake made mostly by inexperienced but good-willing devs."

**Position „Sinnvoll":**

- DDD-Repository ≠ Generic Repository. Der DDD-Repository ist _Aggregat-spezifisch_ und hat eine Sammlung _domänenspezifischer Methoden_ (`findOrdersPendingPayment()`), nicht generische CRUD.
- Persistence Ignorance der Domäne: kein `using Microsoft.EntityFrameworkCore` in der Domänenschicht.
- Testbarkeit: ein In-Memory-Repository ist trivialer zu schreiben als ein Mock-DbContext.

**Pragmatische Synthese**:

- Verwende den Repository-Pattern als **aggregat-spezifische Domänen-Boundary** (kein Generic Repository).
- Akzeptiere, dass `Repository.save(order)` intern den ORM-Session-Commit triggert; verstecke aber niemals `IQueryable` o.Ä. — das exponiert die Abstraktion.
- Für reine Queries (Read-Side) lieber **Query Objects** / direkt `DbContext`/`EntityManager` verwenden (vgl. Jimmy Bogards „Favor Query Objects over Repositories").

### Wann **nicht** einsetzen

- Triviale CRUD-Anwendungen ohne Domänenkomplexität: Repository ist hier reine Indirektion.
- Wenn das Team das Pattern als „SQL-Wrapper" missbraucht statt als Domain-Boundary.
- Wenn `IQueryable` aus dem Repository herausleckt (häufig in C#): das ist _keine_ Repository-Implementierung, nur ein verkleideter `DbContext`.

---

## 4. Query Builder / Fluent SQL DSL

### Definition

Typsichere, komponierbare Konstruktion von SQL-Statements in der Host-Sprache. **Keine** Persistence-Identity, **kein** Objekt-Graph-Management, **kein** Change Tracking.

### Kernidee

SQL ist die Wahrheit; die Sprache bietet ein typsicheres Frontend. Queries sind Werte, die komponiert werden können. Mapping zu Strukturen ist eine separate, explizite Operation.

### Konkrete Implementierungen

- **jOOQ** (Java) — Goldstandard im JVM. Lukas Eder (jOOQ-Autor): SQL-zentriert, generiert Java-Code aus dem DB-Schema, kompiliert SQL-Queries als Java-Code-DSL. Vendor-übergreifend (Translates SQL-Dialekte). Lukas Eder selbst: „If you 'care' about your database […] then database design is a priority in your project, and jOOQ works extremely well." Empfohlene Trennlinie: jOOQ für komplexe Queries / Reporting, Hibernate für CRUD über CQRS.
- **Slick** (Scala) — Functional Relational Mapping (FRM): Tabellen sind Collections, Queries sind monadische Comprehensions. Bewusst als Anti-ORM positioniert. **Status (2025/2026)**: Slick 3.5.x ist Community-maintained; Scala-3-Support seit 3.5.0. scala-slick.org bestätigt die Maintainer-Übergabe direkt: „Slick is no longer led by Lightbend. It's entirely community-maintained. Around April 2021 I became Slick's primary maintainer." (Maintainer nafg, Ankündigung Slick 3.4.x, 18. September 2022). Offenes Issue-Backlog substanziell. _Realistisches Urteil_: stagnierend, aber für bestehende Codebasen tragfähig.
- **Exposed SQL DSL** (Kotlin) — JetBrains, lebendig in Entwicklung. Dual: DSL- und DAO-API (siehe Active Record).
- **Drizzle ORM** (TypeScript) — SQL-zentriert, „If you know SQL, you know Drizzle." Minimale Abstraktion, edge-fähig (sehr kleines Bundle). Stark wachsend im TypeScript-Ökosystem.
- **Kysely** (TypeScript) — type-safe Query Builder, kein vollständiges ORM. Sehr schöne TypeScript-Inferenz.
- **Knex.js** (TypeScript/JS) — Klassiker, älter, weniger typsicher als Kysely/Drizzle.
- **SQLAlchemy Core** (Python) — der untere Layer von SQLAlchemy. `select(users).where(users.c.name == 'John')`. Komponierbar, datenbankagnostisch, ohne Session-/Identity-Map-Semantik.
- **Squeel/Arel** (Ruby) — Arel ist die SQL-Abstraktion _unter_ ActiveRecord; Squeel war eine Erweiterung darüber (heute überholt).

### Trade-offs

- **Pro**: Volle SQL-Kontrolle bei Typsicherheit zur Compile-Time.
- **Pro**: Performance vorhersagbar; SQL ist sichtbar.
- **Pro**: Komplexe Joins, Window Functions, CTEs sind natürlich ausdrückbar.
- **Pro**: Keine N+1-Probleme „aus Versehen" — Joins sind explizit.
- **Contra**: Mehr Boilerplate für triviale CRUD.
- **Contra**: Kein automatisches Object-Graph-Persistierung.
- **Contra** (sprachabhängig): Code-Generation-Schritt nötig (jOOQ, Drizzle-Optional, sqlc).

### Wann **nicht** einsetzen

- Wenn das Datenmodell sich häufig ändert _und_ die Anwendung nur einfache CRUD-Operationen über wenige Aggregate macht — hier ist ein ORM produktiver.
- Wenn das Team kein SQL beherrscht — Query Builder verstecken SQL nicht, sie machen es nur typsicher.

---

## 5. Language-Integrated Query (LINQ und Verwandte)

### Definition

Abfragen werden als Sprachkonstrukt eingebettet (Comprehensions, Quotations, Macros) und vom Compiler/Provider in das Ziel-SQL übersetzt. Wadlers „A practical theory of language-integrated query" (Inspiration für Quill).

### Kernidee

Queries sehen aus wie idiomatischer Code in der Host-Sprache (`from x in users where x.age > 18 select x.name`), werden aber als Datenstruktur erfasst und transformiert.

### Konkrete Implementierungen

- **LINQ to SQL / LINQ to Entities** (C#/.NET) — die Referenz. C# 3.0 (2007) führte Expression Trees und Comprehension-Syntax explizit für LINQ ein. Entity Framework Core: `db.Users.Where(u => u.Age > 18).Select(u => u.Name)`. Vollintegriert mit dem ORM.
- **Slick** (Scala) — siehe oben; konzeptionell ebenfalls Language-Integrated, mit For-Comprehensions: `for { u <- users if u.age > 18 } yield u.name`.
- **Quill** (Scala) — „Compile-time Language Integrated Query for Scala". Quotations (`quote { query[Person].filter(_.age > 18) }`) werden zur Compile-Time als AST geparst und zu SQL kompiliert; bei Fall-Back zur Runtime-Normalisierung. **Status (2025/2026)**: aktiv als `zio-quill` (ZIO-Ökosystem), Scala-3-Support via ProtoQuill. Lebendig, aber kleinere Community als Slick/Doobie.

### Vergleich C# LINQ ↔ Slick ↔ Quill

Alle drei nutzen Comprehension-Syntax und Compiler-Magie (Expression Trees / Macros) zur SQL-Generierung. Unterschied: LINQ ist generisch (für In-Memory- _und_ DB-Queries derselbe Code), Slick und Quill sind DB-spezifisch.

### Trade-offs

- **Pro**: Beste Lesbarkeit; Queries sehen aus wie normaler Code.
- **Pro**: Type-Safety voll integriert.
- **Contra**: „Magie" — was zu SQL kompiliert wird und was nicht ist nicht immer offensichtlich (LINQ to Entities: `EntityFunctions.TruncateTime` vs. `DateTime.Date`, das eine geht, das andere nicht).
- **Contra**: Performance-Pathologien wenn Query-Provider suboptimales SQL generieren.

### Wann **nicht** einsetzen

- Wenn das Team von SQL abstrahieren _will_, aber kein C# nutzt — die Pattern-Variante hat in Java/Kotlin keine erstklassige Implementierung außerhalb der genannten JVM-Spezialvarianten.

---

## 6. SQL Mapper / Micro-ORM / „Data Access" mit handgeschriebenem SQL

### Definition

Mapping zwischen SQL-Ergebnissen und Objekten, **ohne** vollständiges ORM. Kein Change Tracking, keine Identity Map, kein Lazy Loading. SQL ist handgeschrieben (oder via Codegen abgeleitet).

### Kernidee

„SQL ist die Programmiersprache der Datenbank — schreib sie selbst." Die Library übernimmt nur den lästigen Result-Set-zu-Struct-Boilerplate und Connection-/Transaction-Management.

### Konkrete Implementierungen

- **MyBatis** (Java) — XML- oder Annotations-basiertes SQL-Mapping. Sehr verbreitet im chinesischen/asiatischen Enterprise-Markt, weniger im Westen. Stabil und mature.
- **JdbcTemplate / Spring JDBC** (Java) — `RowMapper`-basiert, keine Abstraktion über JDBC.
- **JDBI** (Java) — Annotations-basiert, deklarativ; Sweet Spot zwischen JdbcTemplate und Hibernate.
- **Dapper** (C#, „Micro-ORM") — bekanntester C#-SQL-Mapper. Stack Overflow setzt ihn produktiv ein. Direkt auf ADO.NET, sehr performant.
- **sqlx** (Rust) — Compile-Time-checked SQL: Makros (`query!`, `query_as!`) verbinden sich während der Compilation mit der Datenbank und verifizieren SQL-Syntax, Spaltennamen, Parametertypen. Voraussetzung: laufende DB oder offline-cache (`.sqlx`-Verzeichnis). **Kein** ORM, **kein** DSL.
- **Diesel** (Rust) — _abweichend_: Diesel hat einen DSL-Query-Builder + Code-Generation aus dem Schema. Compile-Time-Checks im Typsystem, **ohne** DB-Verbindung zur Build-Zeit. Mehr ORM-Charakter als sqlx, aber kein Change Tracking. Gehört konzeptionell zwischen Cluster 4 (Query Builder) und 6 (SQL Mapper).
- **sqlc** (Go) — Code-Generation aus SQL: man schreibt `.sql`-Dateien, sqlc generiert type-safe Go-Funktionen. Reine Inversion: SQL ist die Quelle der Wahrheit, Go-Code ist abgeleitet. _Sehr_ Go-idiomatisch.
- **GORM** (Go) — der „Active Record"-Gegenpol in Go; voll-featured, viel Reflection. Performance-kritische Teams wechseln häufig zu sqlc.

### Trade-offs

- **Pro**: Volle Kontrolle, vorhersagbare Performance.
- **Pro**: Keine Abstraktions-Lecks; SQL ist sichtbar im Code.
- **Pro**: Lernkurve nur SQL + dünne Library.
- **Contra**: Mehr Code für triviale CRUD.
- **Contra**: Keine Hilfe bei komplexer Objekt-Graph-Persistierung; muss manuell strukturiert werden.
- **Contra**: Kein Schema-Drift-Schutz (außer bei sqlc/sqlx mit Compile-Time-Checks).

### Wann **nicht** einsetzen

- Wenn die Anwendung primär aus Object-Graph-Persistierung über tiefe Aggregate besteht.
- Wenn das Team SQL bewusst vermeiden will.

---

## 7. Funktionale / Immutable / alternative Paradigmen

### Scala-Cluster

Scala hat das ausdifferenzierteste Spektrum:

- **Slick** — FRM, Comprehension-based. Siehe Cluster 4/5.
- **Quill** — Compile-Time-Quotations. Siehe Cluster 5.
- **Doobie** (typelevel) — _kein_ ORM, _keine_ relationale Algebra. „A pure functional JDBC layer for Scala." Programme sind `ConnectionIO[A]`-Werte (Cats Effect/IO monad). SQL wird per `sql"..."`-Interpolator als String geschrieben, aber typsicher zu Case-Classes gemappt. Komponierbar via Fragments. Im Self-Statement der Doku: „It is not an ORM, nor is it a relational algebra; it simply provides a functional way to construct programs that use JDBC." Best Practice: kombiniert mit ZIO oder Cats Effect.

### Clojure-Cluster

- **next.jdbc** (von Sean Corfield) — der moderne JDBC-Wrapper für Clojure. _Datenorientierter_ Ansatz: Result-Sets sind Maps oder Vektoren von Maps, keine ORM-Objekte. Keine Konvention, kein Magie.
- **HoneySQL** — datenorientierte SQL-Konstruktion: Queries sind Clojure-Maps (`{:select [:*] :from [:users] :where [:= :age 18]}`). Komponierbar wie jede andere Datenstruktur. Sehr Clojure-idiomatisch.
- **Datomic** — siehe separaten Abschnitt unten; konzeptionell _völlig anders_.

### Trade-offs (funktionale Ansätze allgemein)

- **Pro**: Komponierbar, referenziell transparent. Queries sind Werte.
- **Pro**: Keine versteckten Side-Effects, keine Lazy-Loading-Magie.
- **Pro**: Sehr testfreundlich (Programme als Werte).
- **Contra**: Steile Lernkurve (Effect-Monads, Quotations, ZIO/Cats-Effect).
- **Contra**: Mehr Boilerplate als ORM für CRUD.

---

## 8. Datomic — ein konzeptionell eigenständiges Modell

Datomic ist _kein_ O/R-Mapping-Tool, sondern eine eigenständige Datenbank mit eigenem Datenmodell. Erstellung: Rich Hickey (Clojure-Erfinder) und das Relevance-Team (später Cognitect), öffentliche Ankündigung im März/April 2012 (InfoQ, März 2012; Wikipedia/Rich Hickey: „In 2012, Datomic, a proprietary distributed database was launched which coincided with the incorporation of Cognitect."). Cognitect wurde am 23. Juli 2020 von Nubank übernommen (Nubank Press Release: „São Paulo, July 23 2020 – Nubank, the leading Latin American digital bank, has just announced the acquisition of Cognitect, the US-based software consultancy behind the Clojure programming language and the Datomic database."). Am 27. April 2023 wurde Datomic Pro lizenzkostenfrei (blog.datomic.com: „Nubank is excited to announce today that we are making all editions of Datomic available free of licensing fees. The Datomic binaries are being released under the Apache 2.0 license and will be readily available for direct download and use via Maven Central — no signup required."). Wichtig: Nur die Binaries sind Apache-2.0 — die Engine selbst bleibt proprietär.

### Datenmodell

- **Datom** = 5-Tupel `[Entity, Attribute, Value, Transaction, Added]` (Datomic-Glossar: „An atomic fact in a database, composed of entity/attribute/value/transaction/added. Pronounced like 'datum', but pluralized as datoms."). Jede Änderung ist die Assertion/Retraction eines Datoms.
- **Immutable, append-only**: Updates _überschreiben nicht_, sondern fügen neue Datoms hinzu, optional mit Retraction des alten.
- **Vier Indexe**: EAVT, AEVT, AVET, VAET — automatisch gepflegt, decken alle Zugriffsarten ab (Row-Store, Column-Store, K/V, reverse-Edge).
- **Schema-flexibel**: Attribute sind selbst Entities; jede Entity kann jedes Attribut tragen.

### Query: Datalog + Pull

- **Datalog** (logikbasiert, Pattern-Matching):
  ```clojure
  (d/q '[:find ?name
         :where [?e :user/name ?name]
                [?e :user/age ?a]
                [(> ?a 18)]]
       db)
  ```
- **Pull-Syntax** für hierarchische Daten-Selektion (ähnlich GraphQL):
  ```clojure
  (d/pull db [:user/name {:user/orders [:order/total]}] user-id)
  ```

### Temporale Queries (das eigentliche Killer-Feature)

- `(d/as-of db tx-id)` — Datenbank-Wert zu einem beliebigen früheren Zeitpunkt. _Dieselben_ Queries funktionieren gegen jeden historischen Zustand.
- `(d/since db tx-id)` — nur Änderungen seit Zeitpunkt.
- `(d/history db)` — alle Assertions/Retractions je Datom.
- Cognitect-Doku: „Datomic transactions add datoms, never updating or removing them, so you have a complete audit trail and the ability to query 'as of' points in time."

### Architektur

- **Decoupled**: Storage (DynamoDB, SQL als Backing-Store), Transactor (Single-Writer für serialisierbare Transaktionen), Peers/Clients (lesen direkt aus Storage, halten lokale Caches).
- **ACID, Strong Session Serializable** (Jepsen-Analyse, Datomic Pro 1.0.7075, publiziert 15. Mai 2024, in Zusammenarbeit mit Nubank): „Datomic Pro appeared to offer Strong Session Serializable isolation, and Strong Serializable for histories restricted to update transactions." — d.h. die volle „Strong Serializable"-Garantie gilt nur für Histories, die auf Update-Transaktionen beschränkt sind.
- Spektrum _anders_ als Eventual-Consistent-NoSQL: ACID + horizontal lesbar skalierbar.

### Trade-offs

- **Pro**: Audit-Trail kostenlos. „As of"-Queries ohne Schema-Erweiterung (vgl. SQL Temporal Tables / Bitemporal Pain).
- **Pro**: Programmiermodell extrem konsistent mit Clojure-Werten (Immutability, Datenstrukturen als Werte).
- **Pro**: Datalog ist für rekursive/graphige Queries (Bill-of-Materials, Genealogie, Social Graph) deutlich natürlicher als SQL.
- **Contra**: Single-Writer-Transactor → Schreiblast-Bottleneck, kein hochfrequentes OLTP wie bei verteilten SQL-DBs.
- **Contra**: Proprietär (auch wenn Binaries jetzt frei sind). Ecosystem im Vergleich zu Postgres winzig.
- **Contra**: Mentaler Bruch für Teams, die nur SQL kennen.

### Wann **nicht** einsetzen

- Hochfrequente Schreiblast.
- Kein Clojure-Team — die idiomatische Nutzung bleibt Clojure-zentriert.
- Standard-CRUD ohne Audit-Anforderungen — Overkill.

---

## Die großen Debatten (für die didaktische Abgrenzung)

### Object-Relational Impedance Mismatch

Ted Neward (2006), „The Vietnam of Computer Science":

> „Object/Relational Mapping is the Vietnam of Computer Science. It represents a quagmire which starts well, gets more complicated as time passes, and before long entraps its users in a commitment that has no clear demarcation point, no clear win conditions, and no clear exit strategy."

Die Kernkritik: ORMs lösen das Mismatch _nicht_, sondern verschieben es. Strukturelle Inkompatibilitäten (Identität, Vererbung, Assoziationen vs. Foreign Keys, Pagination + Joins, Aggregation) lassen sich nicht durch ein Tool wegmappen.

### Joel Spolskys Law of Leaky Abstractions, angewendet auf ORM

> „All non-trivial abstractions, to some degree, are leaky." (Spolsky 2002)

Anwendung: Hibernate/EF Core abstrahieren SQL — aber der Entwickler muss SQL-Performance, Query-Pläne, N+1, Cache-Semantik verstehen. Die Abstraktion _spart Tipparbeit, aber keine Lernarbeit_ (Spolsky-Schlussfolgerung).

### Repository über ORM

Siehe Cluster 3. Verifizierte Microsoft-Aussage: `DbContext` _ist_ Unit of Work + Repository. Custom-Repositories darüber sind in den meisten Projekten redundant, _außer_ sie sind DDD-Aggregat-spezifische Domain-Boundaries (nicht generisch).

### jOOQ vs. Hibernate (Lukas Eder selbst)

> „Will your data model drive your application design, or will your application design drive your data model? […] If you 'care' about your database in the sense of whether it might survive your application, […] jOOQ works extremely well in these setups. If you don't necessarily 'care' about your database in the sense that you just want to 'persist' your Java domain somewhere, then Hibernate might be a better choice."
> „Will you do mostly complex reading and simple writing, or will you engage in complex writing? SQL really shines when reading is complex."

Konsens (auch in der Java-Community): hybride Architektur ist legitim. Hibernate/JPA für CRUD-Schreibe-Seite, jOOQ für Reporting/Read-Seite (CQRS).

### Slick FRM (Functional Relational Mapping)

Slick wurde explizit als Anti-ORM positioniert: Tabellen sind Collections, Queries sind komponierbare Comprehensions. Bekannte Kritikpunkte:

- Komplexität: Die Compiler-Macros und Type-Level-Tricks erzeugen oft kryptische Fehlermeldungen.
- Maintenance-Status: Lightbend zog sich aus aktiver Entwicklung zurück; Slick wird seit April 2021 von nafg und der Community gepflegt. Funktional, aber stagnierend.
- Konsens in der Scala-Community 2025/2026: Für neue Projekte eher Doobie + ZIO/Cats Effect oder Quill, nicht mehr Slick.

### Performance-Argument: generiertes vs. handgeschriebenes SQL

- Generiertes SQL (ORM): vom ORM kontrolliert, oft suboptimal bei komplexen Queries; deterministisch nur für triviale CRUD.
- Handgeschriebenes SQL (jOOQ/MyBatis/sqlc): vorhersagbar, optimierbar, aber höherer Aufwand.
- _Empirie_: Bei einfachem CRUD ist der Performance-Unterschied vernachlässigbar; bei komplexen Joins, Pagination, Reports ist handgeschriebenes SQL eine Größenordnung besser.

---

## Tool-Status-Check 2025/2026 (verifizierter Stand)

| Tool                     | Status                                                                                                                                                                                    | Belegt durch                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Hibernate / JPA**      | Aktiv, de-facto-Standard. Hibernate 6.x, Jakarta Persistence 3.2.                                                                                                                         | Red Hat / Hibernate-Team.                     |
| **EF Core**              | Aktiv, EF Core 9 (.NET 9). Microsoft offiziell.                                                                                                                                           | Microsoft Learn aktuelle Doku.                |
| **Spring Data**          | Aktiv (Spring Boot 3.x).                                                                                                                                                                  | Spring-Projekt.                               |
| **jOOQ**                 | Aktiv, kommerziell (Open-Source-Edition + kommerzielle Lizenzen für non-OSS DBs).                                                                                                         | Data Geekery / jooq.org.                      |
| **Slick**                | Community-maintained seit ~April 2021 (Maintainer: nafg). 3.5.x mit Scala 3. Lightbend nur noch administrativ unterstützend.                                                              | scala-slick.org, GitHub Issue-Tracker.        |
| **Quill / zio-quill**    | Aktiv, Scala 3 via ProtoQuill.                                                                                                                                                            | github.com/zio/zio-quill.                     |
| **Doobie**               | Aktiv (Typelevel-Projekt).                                                                                                                                                                | typelevel.org/doobie.                         |
| **MyBatis**              | Stabil, aktiv.                                                                                                                                                                            | mybatis.org.                                  |
| **Exposed**              | Aktiv, JetBrains-getrieben, R2DBC- und JDBC-Module, V1 angekündigt.                                                                                                                       | JetBrains-Blog, github.com/JetBrains/Exposed. |
| **Prisma**               | Aktiv, signifikante Architekturwende: Prisma 6.16 (GA, September 2025) bzw. Prisma 7 (2026) _ohne_ Rust-Engine, TypeScript/WASM-Query-Compiler. Migration weg von Rust ist abgeschlossen. | prisma.io/blog (10.09.2025), InfoQ Jan 2026.  |
| **Drizzle**              | Sehr aktiv wachsend, Edge-First.                                                                                                                                                          | drizzle-team.                                 |
| **Kysely**               | Aktiv, stabil.                                                                                                                                                                            | kysely.dev.                                   |
| **TypeORM**              | Aktiv aber Maintenance-Lücken; viele Issues offen lange.                                                                                                                                  | mehrere Community-Reviews.                    |
| **MikroORM**             | Aktiv, V7 in Arbeit, Data-Mapper-Position.                                                                                                                                                | mikro-orm.io.                                 |
| **SQLAlchemy**           | Aktiv (2.0 GA seit 2023, 2.1 in Arbeit).                                                                                                                                                  | sqlalchemy.org.                               |
| **Django ORM**           | Aktiv.                                                                                                                                                                                    | djangoproject.com.                            |
| **sqlx (Rust)**          | Aktiv.                                                                                                                                                                                    | github.com/launchbadge/sqlx.                  |
| **Diesel (Rust)**        | Aktiv.                                                                                                                                                                                    | diesel.rs.                                    |
| **sqlc (Go)**            | Sehr aktiv.                                                                                                                                                                               | sqlc.dev.                                     |
| **Ent (Go)**             | Aktiv, seit 1. September 2021 unter der Linux Foundation.                                                                                                                                 | linuxfoundation.org / entgo.io.               |
| **Datomic**              | Lizenzkostenfrei seit 27. April 2023 (Binaries Apache 2.0, Engine bleibt proprietär); aktive Pflege durch Nubank.                                                                         | blog.datomic.com 27.04.2023.                  |
| **next.jdbc + HoneySQL** | Aktiv, Clojure-Standard für SQL.                                                                                                                                                          | github.com/seancorfield/next-jdbc.            |

---

## Klare Pattern-Abgrenzungen (das Kernanliegen)

Diese vier Fragen disambiguieren in 80% der Fälle:

1. **Wer hält das SQL — Tool oder Entwickler?**
   - Tool: ORM (Active Record, Data Mapper), Query Builder, LINQ.
   - Entwickler: SQL Mapper (MyBatis, sqlc, Dapper, JdbcTemplate, Doobie).

2. **Gibt es Objekt-Graph-Management (Identity Map + Unit of Work)?**
   - Ja: ORMs im strengen Sinn (Hibernate, EF Core, SQLAlchemy ORM, MikroORM).
   - Nein: Query Builder (jOOQ, Slick, Drizzle), SQL Mapper, Micro-ORMs, Active-Record-Frameworks im engeren Sinn (Rails, Django — _teils_ mit Cache, aber kein klassischer UoW).

3. **Lebt Persistenzlogik im Domänenobjekt?**
   - Ja: Active Record.
   - Nein: Data Mapper, Query Builder, SQL Mapper, Funktionale Ansätze.

4. **Liegt der Boundary zwischen Domäne und Persistenz im Code?**
   - Ja: Repository-Pattern (egal, was darunter liegt).
   - Nein: Domänencode arbeitet direkt mit ORM-Session/DbContext/Query-Builder.

---

## Recommendations

### Wenn du Schulungsmaterial baust (didaktischer Aufbau)

1. **Start: Fowler PoEAA und Evans DDD.** Lehre die _Patterns_ zuerst, abstrakt, mit Pseudocode. Erst danach die Werkzeuge.
2. **Demonstriere denselben Use-Case in drei Implementierungen**, um den konzeptionellen Unterschied zu zeigen:
   - Active Record (Rails ActiveRecord oder Django Models)
   - Data Mapper / ORM (Hibernate/JPA)
   - SQL-zentriert (jOOQ oder MyBatis)
3. **Zeige Failure-Modes live**: N+1-Problem mit aktiviertem SQL-Logging in Hibernate, Lazy-Init-Exception, dann Lösung via JOIN FETCH und EntityGraph. Das ist der pädagogisch wertvollste Moment.
4. **Bringe die Kontroversen explizit ein**: Ted Newards Essay (PDF von odbms.org), Spolskys „Law of Leaky Abstractions", Lukas Eders „jOOQ vs. Hibernate"-Blogpost, die Microsoft-Aussage zu `DbContext = UoW + Repository`. Lese-Material als Hausaufgabe.
5. **Datomic als eigene Einheit** behandeln — _nicht_ als „noch ein ORM-Alternative". Es ist ein anderes Datenmodell.

### Wenn du für ein neues JVM-Projekt entscheidest

- **CRUD-lastig, klassisches Enterprise, viele Aggregate**: JPA/Hibernate + Spring Data, akzeptiere die Lernkurve und die Falltüren. Kombiniere mit jOOQ für Reporting (CQRS-Read-Side).
- **SQL-zentrisch, schema-first, viele komplexe Queries, Mehr-DB-Setup**: jOOQ allein. Lukas Eder empfiehlt das explizit.
- **Scala, FP-Stil**: Doobie + ZIO oder Cats Effect. _Nicht_ Slick für Greenfield.
- **Kotlin, „leichtgewichtig"**: Exposed (DSL-API) als Mittelweg. JetBrains-Support.
- **Clojure**: next.jdbc + HoneySQL als Default. Datomic, _wenn_ das immutable/temporale Modell konzeptionell passt.
- **Microservices / einfache Tabellen**: JDBI oder MyBatis. Weniger Magie, schneller produktiv.

### Schwellwerte, die deine Empfehlung ändern

- _Wenn_ >50% der Queries komplex (Joins über 4+ Tabellen, Window Functions, CTEs) → Query Builder oder SQL Mapper statt ORM.
- _Wenn_ das Team SQL nicht beherrschen will/kann → ORM, akzeptiere Trade-offs.
- _Wenn_ Audit-Anforderungen / Bi-temporale Daten → Datomic ernsthaft prüfen, sonst SQL Temporal Tables (verkrüppelt).
- _Wenn_ Edge/Serverless Cold-Starts kritisch → Drizzle (TS) / sqlc (Go) / sqlx (Rust). Hibernate ist hier disqualifiziert.

---

## Caveats

- **Werkzeug-Schubladen sind unscharf.** Diesel (Rust) ist Query Builder _und_ Code-Generator _und_ hat Mapping-Funktionen — gehört in zwei Cluster gleichzeitig. SQLAlchemy hat Core _und_ ORM — Cluster 4 _und_ 2. Ktorm in Kotlin: Active Record + DSL. Lass dich nicht von der Schublade verwirren; frag immer: „Was übernimmt das Tool konkret in diesem Projekt?"
- **Spring Data ist ein hybrides Tier.** Es ist _Repository-Layer_ (Cluster 3) über Hibernate (Cluster 2). Das macht es konzeptionell schwer einzuordnen und ist ein häufiger Grund, warum Teams das Pattern missverstehen.
- **„ORM ist langsam" ist eine Halbwahrheit.** Bei trivialem CRUD ist der Overhead minimal. Bei komplexen Queries kann generiertes SQL aber kostspielig schlecht sein — _messen, nicht raten_.
- **Slicks Status ist instabil.** Wir haben bestätigt: Community-maintained (seit April 2021 unter nafg), Scala-3-Support seit 3.5.0, aber substanzielles Issue-Backlog. Für _Bestands_-Codebasen weiter tragfähig, für _neue_ Projekte nicht erste Wahl.
- **Prisma hat seine Architektur 2025 grundlegend geändert** (Wegfall der Rust-Query-Engine, GA in 6.16.0 am 10. September 2025). Wer Prisma 5 oder älter im Einsatz hat, sollte den Migrationsplan auf Prisma 6.16+ bzw. Prisma 7 verstehen, bevor er Architekturentscheidungen trifft.
- **Datomic ist proprietär.** Lizenzkostenfreiheit seit April 2023 (Apache-2.0-Binaries) ist _nicht_ Open Source der Engine. Lock-in-Risiko bewusst kalkulieren. Jepsens Konsistenzbewertung „Strong Session Serializable" gilt vollständig nur unter den im Bericht spezifizierten Bedingungen (Update-Transaktionen).
- **MyBatis-Verbreitung im westlichen Markt ist überschaubar.** Im asiatisch-pazifischen Raum dagegen sehr verbreitet (Alibaba, Tencent etc.). Wenn dein Schulungspublikum dort ansässig ist, MyBatis prominenter platzieren.
- **„Active Record vs. Data Mapper" als binäre Wahl ist eine Vereinfachung.** Viele heutige Frameworks haben hybride Modi (z.B. Exposed mit beidem; TypeORM mit beidem). Die Pattern-Definitionen sind klar, die Tool-Realität ist es nicht immer.
