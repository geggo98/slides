<script setup lang="ts">
import TalkXref from "@shared/components/TalkXref.vue";
</script>

<template>
  <div class="xref-grid">
    <div class="col here">
      <header>
        <span class="badge">Dieser Talk</span>
        OpenRewrite — Refactoring at Scale
      </header>
      <ul>
        <li><strong>Wie</strong> migriere ich Annotationen mechanisch?</li>
        <li>
          Recipe
          <code>org.openrewrite.java.jspecify.MigrateToJspecify</code> als
          Building Block
        </li>
        <li>Pattern 1 + 2 als Workflow, Build-Loop als Gate</li>
        <li>LLM-Gap-Fill nur dort, wo der Build es verlangt</li>
      </ul>
    </div>
    <div class="col there">
      <header>
        <span class="badge alt">Querverweis</span>
        <TalkXref slug="20260428-java-null-pointer"
          >Java Null-Sicherheit 2026</TalkXref
        >
      </header>
      <ul>
        <li><strong>Warum</strong> JSpecify und nicht Spring/JSR-305?</li>
        <li>
          Die vier Annotationen: <code>@NullMarked</code>,
          <code>@Nullable</code>, <code>@NonNull</code>,
          <code>@NullUnmarked</code>
        </li>
        <li>Scope-Regeln und <code>package-info.java</code></li>
        <li>NullAway als pragmatischer Checker</li>
      </ul>
      <p class="hint">
        Slides 8–18 im Null-Sicherheit-Talk. Dort wird in Slide 12
        (Quellen-Übersicht) bereits auf dieses Recipe verwiesen — der Kreis
        schließt sich.
      </p>
    </div>
  </div>
</template>

<style scoped>
.xref-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.col {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border-radius: var(--sk-rad);
  border: 0.5px solid var(--color-border-tertiary);
}
.col.here {
  background: var(--color-background-info);
  border-color: var(--color-border-info);
}
.col.there {
  background: var(--color-background-secondary);
}
header {
  font-size: 15px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 10px;
}
.badge {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: var(--color-text-info);
  color: var(--color-background-info);
  padding: 2px 8px;
  border-radius: 4px;
}
.badge.alt {
  background: var(--color-text-secondary);
  color: var(--color-background-secondary);
}
ul {
  margin: 0;
  padding-left: 1.2rem;
  font-size: 13px;
  line-height: 1.7;
}
li {
  margin: 0.2rem 0;
}
code {
  font-family: var(--font-mono);
  font-size: 0.9em;
  background: var(--color-background-primary);
  padding: 1px 5px;
  border-radius: 3px;
}
.hint {
  font-size: 11.5px;
  color: var(--color-text-tertiary);
  margin: 6px 0 0;
  font-style: italic;
  line-height: 1.55;
}
</style>
