<template>
  <div class="xref-grid">
    <div class="col here">
      <header>
        <span class="badge">Dieser Talk</span>
        Entwurfsmuster 2026
      </header>
      <ul>
        <li>
          <strong>Drei Schichten:</strong> was die Sprache übernimmt, was bleibt
        </li>
        <li>
          Builder als Lehrstück für <strong>Typsystem-Ebenen</strong>
          (Laufzeit → Staged → named/default args)
        </li>
        <li>Visitor → ADTs; Metaprogramming <em>implementiert</em> Proxy</li>
      </ul>
    </div>

    <div class="col there">
      <header>
        <span class="badge alt">Querverweis</span>
        Java Null-Sicherheit 2026
      </header>
      <ul>
        <li>
          <strong>Warum</strong> null-Safety dem Builder keine
          Compile-Zeit-Pflichtfelder gibt (JEP 8303099)
        </li>
        <li>
          Null Object → <code>Optional</code>/Nullability; JSpecify, NullAway
        </li>
      </ul>
      <a
        class="xref-link"
        href="https://geggo98.github.io/slides/20260428-java-null-pointer/"
      >
        → geggo98.github.io/slides/20260428-java-null-pointer/
      </a>

      <header class="mt">
        <span class="badge alt">Querverweis</span>
        OpenRewrite — Refactoring at Scale
      </header>
      <ul>
        <li>
          Muster-Migration <strong>mechanisch</strong>: <code>ChangeType</code>,
          sealed-/Visitor-Recipes
        </li>
        <li>
          <code>JavaIsoVisitor</code> — dasselbe double dispatch, jetzt als
          Recipe-Mechanik
        </li>
      </ul>
      <a
        class="xref-link"
        href="https://geggo98.github.io/slides/20260522-open-rewrite/"
      >
        → geggo98.github.io/slides/20260522-open-rewrite/
      </a>
    </div>
  </div>
</template>

<style scoped>
.xref-grid {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: 16px;
  font-family: var(--font-sans);
}
.col {
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: var(--sk-radm);
  padding: 12px 16px;
  background: var(--color-background-secondary);
}
.col header {
  font-weight: 600;
  font-size: 15px;
  color: var(--color-text-primary);
  margin-bottom: 8px;
  line-height: 1.3;
}
.col header.mt {
  margin-top: 14px;
}
.badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 7px;
  border-radius: 4px;
  margin-right: 8px;
  background: var(--color-background-info);
  color: var(--color-text-info);
  border: 0.5px solid var(--color-border-info);
}
.badge.alt {
  background: var(--color-background-warning);
  color: var(--color-text-warning);
  border-color: var(--color-border-warning);
}
.col ul {
  margin: 0;
  padding-left: 18px;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--color-text-secondary);
}
.col li {
  margin-bottom: 4px;
}
.col code {
  font-family: var(--font-mono);
  font-size: 0.9em;
  background: var(--color-background-primary);
  padding: 1px 5px;
  border-radius: 3px;
}
.xref-link {
  display: inline-block;
  margin-top: 8px;
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--color-text-info);
  text-decoration: none;
}
.xref-link:hover {
  text-decoration: underline;
}
</style>
