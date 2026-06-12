// Code constants and annotation specs for the OpenRewrite talk.
// Kept out of slides.md so the deck reads cleanly.

export const sayHelloRecipeCode = `public final class SayHelloRecipe extends Recipe {

  @Option(displayName = "Fully Qualified Class Name",
          description = "Klasse, die eine hello()-Methode bekommen soll.",
          example = "com.example.FooBar")
  private final String fullyQualifiedClassName;

  public SayHelloRecipe(String fqcn) {
    this.fullyQualifiedClassName = fqcn;
  }

  @Override public String getDisplayName() { return "Say 'Hello'"; }
  @Override public String getDescription() { return "Adds a hello() method."; }

  @Override
  public TreeVisitor<?, ExecutionContext> getVisitor() {
    return new JavaIsoVisitor<ExecutionContext>() {
      @Override
      public J.ClassDeclaration visitClassDeclaration(
              J.ClassDeclaration cd, ExecutionContext ctx) {
        if (!TypeUtils.isOfClassType(cd.getType(), fullyQualifiedClassName)) {
          return cd;
        }
        return cd; // ... Mutation via JavaTemplate
      }
    };
  }
}`;

export const sayHelloAnnotations = [
  {
    id: "options",
    lines: [3, 7],
    label: "Metadaten + Optionen",
    detail: {
      title: "@Option und Constructor",
      body:
        "Recipe-Parameter werden als <code>@Option</code> deklariert " +
        "und im Constructor gebunden. Die OpenRewrite-Engine generiert " +
        "daraus automatisch die UI für CLI/Plugin und liest die Werte aus YAML.",
    },
    tone: "info",
  },
  {
    id: "visitor",
    lines: [16, 25],
    label: "Visitor — neue Instanz pro Call",
    detail: {
      title: "getVisitor() — drei Idiom-Punkte",
      body:
        "<strong>(1)</strong> Jede Invokation liefert eine <em>neue</em> Instanz — " +
        'sonst leakt State zwischen Cycles. <strong>(2)</strong> „Do no harm": ' +
        "bei Unsicherheit nicht ändern. <strong>(3)</strong> Determinismus: " +
        "keine Cross-File-State in Instance-Fields.",
    },
    tone: "success",
  },
];

export const visitorMechanicsCode = `@Override
public J.MethodInvocation visitMethodInvocation(
    J.MethodInvocation method, ExecutionContext ctx) {
  method = super.visitMethodInvocation(method, ctx);  // erst children
  if (!matcher.matches(method)) {
    return method;
  }
  return method.withName(method.getName().withSimpleName("newName"));
}

// Parent-Kontext via Cursor-API
J.ClassDeclaration enclosingClass =
    getCursor().firstEnclosing(J.ClassDeclaration.class);`;

export const visitorAnnotations = [
  {
    id: "super-visit",
    lines: 4,
    label: "Pflicht: super.visitX() aufrufen",
    detail: {
      title: "Depth-First-Traversal",
      body:
        "Wer <code>super.visitX()</code> nicht aufruft, bricht die " +
        "Traversierung ab — Children werden nicht mehr besucht. Standard-" +
        "Reihenfolge: zuerst Children, dann der eigene Match.",
    },
    tone: "warning",
  },
  {
    id: "cursor",
    lines: [12, 13],
    label: "Cursor → Parent-Kontext",
    detail: {
      title: "Cursor-API",
      body:
        "<code>getCursor().firstEnclosing(...)</code> liefert den " +
        "nächstgelegenen Vorfahr-Knoten. Typisch: „nur in " +
        '<code>@Configuration</code>-Klassen ändern".',
    },
    tone: "info",
  },
];

export const methodMatcherCode = `private final MethodMatcher matcher =
    new MethodMatcher("com.fasterxml.jackson.databind.ObjectMapper readValue(..)");

@Override
public J.MethodInvocation visitMethodInvocation(
    J.MethodInvocation mi, ExecutionContext ctx) {
  mi = super.visitMethodInvocation(mi, ctx);
  if (matcher.matches(mi)) {
    // hier ist es ein objectMapper.readValue(...)-Call
  }
  return mi;
}`;

export const methodMatcherPatterns = [
  {
    pattern: "java.util.List add(..)",
    meaning: "List.add mit beliebigen Args",
  },
  {
    pattern: "org.springframework.boot.SpringApplication run(..)",
    meaning: "Spring-Boot-Entry-Point",
  },
  {
    pattern: "javax.persistence.EntityManager merge(..)",
    meaning: "JPA EntityManager.merge",
  },
  {
    pattern: "org.springframework.jdbc.core.JdbcTemplate queryForObject(..)",
    meaning: "JdbcTemplate-Query",
  },
  { pattern: "* equals(Object)", meaning: "equals auf beliebigem Typ" },
];

export const javaTemplateAntiCode = `String code = "this.x = " + value + ";";

// kein Typ, keine Imports
// keine Formatierung
// LST kennt das nicht
// Recipe macht in Tests Mist`;

export const javaTemplateIdiomCode = `JavaTemplate template =
    JavaTemplate.builder(
        "this.x = #{any(int)};"
    ).build();

md = md.withBody(template.apply(
    new Cursor(getCursor(), md.getBody()),
    md.getBody().getCoordinates().firstStatement()
));
return maybeAutoFormat(md, md, ctx);`;

export const preconditionsCode = `@Override
public TreeVisitor<?, ExecutionContext> getVisitor() {
  return Preconditions.check(
      Preconditions.and(
          new UsesType<>("org.springframework.boot.context.properties.ConfigurationProperties", false),
          new UsesJavaVersion<>(17)
      ),
      new JavaIsoVisitor<ExecutionContext>() {
        // dein eigentlicher Visitor
      }
  );
}`;

export const preconditionTypes = [
  { name: "UsesType<>", purpose: "Wird die Klasse irgendwo verwendet?" },
  { name: "UsesMethod<>", purpose: "Wird diese Methode aufgerufen?" },
  { name: "UsesJavaVersion<>", purpose: "Minimum-Java-Level" },
  {
    name: "HasSourcePath<>",
    purpose: "File-pfad-basiert (z. B. application*.yml)",
  },
  {
    name: "FindDependency, ModuleHasDependency",
    purpose: "Repo-/Modul-Level Dependency-Check",
  },
];

export const yamlRecipeCode = `---
type: specs.openrewrite.org/v1beta/recipe
name: com.example.MigrateInternalApiV1ToV2
displayName: Migriere Legacy-API V1 zu V2
description: Migriert vom Legacy-Pattern zur V2-Konvention.
tags: [internal, api-migration]
preconditions:
  - org.openrewrite.java.search.UsesType:
      fullyQualifiedTypeName: com.example.api.v1.LegacyApi
recipeList:
  - org.openrewrite.java.ChangeType:
      oldFullyQualifiedTypeName: com.example.api.v1.LegacyApi
      newFullyQualifiedTypeName: com.example.api.v2.Api
  - org.openrewrite.java.ChangeMethodName:
      methodPattern: com.example.api.v2.Api compute(..)
      newMethodName: calculate
  - org.openrewrite.java.dependencies.UpgradeDependencyVersion:
      groupId: com.example
      artifactId: api-client
      newVersion: 2.0.x`;

export const yamlRecipeAnnotations = [
  {
    id: "precond",
    lines: [7, 9],
    label: "Preconditions — global für alle Sub-Recipes",
    detail: {
      title: "Globale Preconditions",
      body:
        "Die <code>preconditions</code> gelten für <em>alle</em> Sub-Recipes " +
        "im <code>recipeList</code>. Nur Files, die <code>UsesType</code> " +
        "erfüllen, werden überhaupt angefasst.",
    },
    tone: "info",
  },
  {
    id: "list",
    lines: [10, 20],
    label: "recipeList — sequenziell, mixed declarative + imperative",
    detail: {
      title: "Sub-Recipes",
      body:
        "Die Liste läuft sequenziell — jede Sub-Recipe sieht die " +
        "Änderungen der vorigen. Sub-Recipes können declarative oder " +
        "imperative sein. Diese hier sind alle Java-Stdlib-Recipes.",
    },
    tone: "success",
  },
];

// --- JSpecify migration example -------------------------------------------

export const jspecifyMixedCode = `package com.example;

import org.springframework.lang.Nullable;
import javax.annotation.Nonnull;
import org.springframework.stereotype.Service;
import java.util.Optional;

@Service
public class UserService {

  @Nullable
  public User findByEmail(@Nonnull String email) {
    if (email.isBlank()) return null;
    Optional<User> found = repo.findByEmail(email);
    if (found.isPresent() && found.get().isActive()) {
      return found.get();
    }
    return null;
  }

  public String greet(@Nullable User user) {
    return user == null ? "Hi!" : "Hi, " + user.name() + "!";
  }
}`;

export const jspecifyMixedAnnotations = [
  {
    id: "spring-null",
    lines: 3,
    label: "Spring-Lang-Annotation",
    detail: {
      title: "org.springframework.lang.Nullable",
      body:
        "Spring-eigene Annotation, JSR-305-kompatibel, aber inkompatibel " +
        "mit JSpecify-Type-Use-Semantik. Wird in Spring Framework 7 zugunsten " +
        "von JSpecify deprecated.",
    },
    tone: "warning",
  },
  {
    id: "javax",
    lines: 4,
    label: "JSR-305 (nie standardisiert)",
    detail: {
      title: "javax.annotation.Nonnull",
      body:
        "Der JSR-305-Versuch wurde 2012 abgebrochen — die Annotation lebt " +
        "trotzdem in vielen Projekten. Auch sie ist JSpecify-inkompatibel.",
    },
    tone: "danger",
  },
  {
    id: "method-logic",
    lines: [12, 19],
    label: "Komplexe Null-Logik — braucht LLM-Review",
    detail: {
      title: "Hier endet die Mechanik",
      body:
        "Diese Methode kann <code>null</code> oder ein <code>User</code> " +
        "zurückgeben. Ob der Rückgabetyp wirklich " +
        "<code>@Nullable User</code> oder <code>Optional&lt;User&gt;</code> " +
        "sein sollte, hängt von Aufrufer-Erwartungen ab — keine reine " +
        "Annotation-Umbau-Frage mehr.",
    },
    tone: "info",
  },
];

export const jspecifyRecipeYaml = `---
type: specs.openrewrite.org/v1beta/recipe
name: com.example.MigrateNullAnnotationsToJSpecify
displayName: Migriere Null-Annotationen zu JSpecify
description: Ersetzt Spring- und javax-Null-Annotationen durch JSpecify.
tags: [null-safety, jspecify, mechanical]
preconditions:
  - org.openrewrite.java.search.UsesType:
      fullyQualifiedTypeName: org.springframework.lang.Nullable
recipeList:
  - org.openrewrite.java.ChangeType:
      oldFullyQualifiedTypeName: org.springframework.lang.Nullable
      newFullyQualifiedTypeName: org.jspecify.annotations.Nullable
  - org.openrewrite.java.ChangeType:
      oldFullyQualifiedTypeName: org.springframework.lang.NonNull
      newFullyQualifiedTypeName: org.jspecify.annotations.NonNull
  - org.openrewrite.java.ChangeType:
      oldFullyQualifiedTypeName: javax.annotation.Nullable
      newFullyQualifiedTypeName: org.jspecify.annotations.Nullable
  - org.openrewrite.java.ChangeType:
      oldFullyQualifiedTypeName: javax.annotation.Nonnull
      newFullyQualifiedTypeName: org.jspecify.annotations.NonNull
  - org.openrewrite.java.dependencies.AddDependency:
      groupId: org.jspecify
      artifactId: jspecify
      version: 1.0.0
      onlyIfUsing: org.jspecify.annotations.Nullable`;

export const jspecifyRecipeAnnotations = [
  {
    id: "rename",
    lines: [10, 22],
    label: "Mechanische ChangeType — 100 % deterministisch",
    detail: {
      title: "ChangeType",
      body:
        "Standard-Recipe-Building-Block: ersetzt FQN-Typ, passt Imports " +
        "automatisch an, idempotent. Vier Annotationen-Paare = vier " +
        "<code>ChangeType</code>-Aufrufe.",
    },
    tone: "success",
  },
  {
    id: "dep",
    lines: [23, 27],
    label: "Dependency hinzufügen (nur wenn Typ verwendet)",
    detail: {
      title: "AddDependency",
      body:
        "Conditional: fügt <code>org.jspecify:jspecify:1.0.0</code> erst " +
        "hinzu, wenn die Annotation auch wirklich verwendet wird. " +
        "Vermeidet Pollution in Modulen ohne Null-Annotationen.",
    },
    tone: "info",
  },
];

export const jspecifyAfterCode = `package com.example;

import org.jspecify.annotations.NullMarked;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import java.util.Optional;

@NullMarked   // ← package-info.java besser, hier zur Demo
@Service
public class UserService {

  // Frage an den LLM-Agenten: @Nullable User oder Optional<User>?
  // Vertrag der Aufrufer entscheidet — Annotation allein reicht nicht.
  public @Nullable User findByEmail(String email) {
    if (email.isBlank()) return null;
    Optional<User> found = repo.findByEmail(email);
    if (found.isPresent() && found.get().isActive()) {
      return found.get();
    }
    return null;
  }

  public String greet(@Nullable User user) {
    return user == null ? "Hi!" : "Hi, " + user.name() + "!";
  }
}`;

export const jspecifyAfterAnnotations = [
  {
    id: "nullmarked",
    lines: 8,
    label: "@NullMarked — non-null by default",
    detail: {
      title: "JSpecify-Scoping",
      body:
        "<code>@NullMarked</code> macht den Default <code>@NonNull</code>. " +
        "Auf Package-Ebene (<code>package-info.java</code>) idiomatischer als " +
        "pro Klasse. NullAway prüft den Rest.",
    },
    tone: "success",
  },
  {
    id: "gap",
    lines: [12, 21],
    label: "LLM füllt die Lücke (Pattern 1, Build-Loop)",
    detail: {
      title: "Hier ist die KI dran",
      body:
        "Build schlägt fehl, weil <code>@NullMarked</code> jetzt " +
        "<code>String email</code> als <code>@NonNull</code> liest und der " +
        "Rückgabewert nicht annotiert ist. Der Coding-Agent analysiert " +
        "Kontrollfluss, schlägt <code>@Nullable User</code> oder " +
        "<code>Optional&lt;User&gt;</code> vor — bis der Build grün ist.",
    },
    tone: "warning",
  },
];

export const scanningRecipeSnippet = `public class FindOrphanBeans extends ScanningRecipe<Map<String, Path>> {
  @Override public Map<String, Path> getInitialValue(ExecutionContext ctx) {
    return new HashMap<>();
  }
  @Override public TreeVisitor<?, ExecutionContext> getScanner(Map<String, Path> acc) {
    return new JavaIsoVisitor<>() { /* ... füllt acc über alle Files */ };
  }
  @Override public TreeVisitor<?, ExecutionContext> getVisitor(Map<String, Path> acc) {
    return new JavaIsoVisitor<>() { /* ... ändert mit Wissen aus acc */ };
  }
}`;
