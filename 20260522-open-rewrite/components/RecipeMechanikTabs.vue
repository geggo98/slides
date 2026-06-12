<script setup>
import "./recipe-tabs.css";
import Tabs from "@shared/components/Tabs.vue";
import MonacoBlockAnnotated from "@shared/components/MonacoBlockAnnotated.vue";
import MonacoBlock from "@shared/components/MonacoBlock.vue";
import MethodMatcherTable from "./MethodMatcherTable.vue";
import JavaTemplateComparison from "./JavaTemplateComparison.vue";
import {
  sayHelloRecipeCode,
  sayHelloAnnotations,
  visitorMechanicsCode,
  visitorAnnotations,
  methodMatcherCode,
} from "./slide-data.ts";

const tabs = [
  { key: "anatomy", label: "Anatomie" },
  { key: "visitor", label: "Visitor" },
  { key: "matcher", label: "MethodMatcher" },
  { key: "template", label: "JavaTemplate" },
];
</script>

<template>
  <div class="or-tabs">
    <Tabs :tabs="tabs" aria-label="Recipe-Mechanik">
      <template #anatomy>
        <div class="panel">
          <p class="lead">
            Drei Teile: Metadaten/Optionen, Constructor, Visitor.
          </p>
          <MonacoBlockAnnotated
            :code="sayHelloRecipeCode"
            language="java"
            height="250px"
            :annotations="sayHelloAnnotations"
          />
        </div>
      </template>

      <template #visitor>
        <div class="panel">
          <p class="lead">
            Depth-first, <code>super.visitX()</code> ist Pflicht. Cursor liefert
            Parent-Kontext.
          </p>
          <MonacoBlockAnnotated
            :code="visitorMechanicsCode"
            language="java"
            height="180px"
            :annotations="visitorAnnotations"
          />
          <div class="callout">
            <strong>JavaIsoVisitor vs. JavaVisitor:</strong>
            Iso ist typerhaltend (Methode bleibt Methode). Faustregel: Iso,
            außer du musst.
          </div>
        </div>
      </template>

      <template #matcher>
        <div class="panel">
          <p class="lead">
            Syntax:
            <code>&lt;fqn.Type&gt; &lt;methodName&gt;(&lt;argTypes&gt;)</code>.
            Wildcards: <code>..</code> = beliebige Args, <code>*</code> =
            beliebiger Typ.
          </p>
          <MonacoBlock
            :code="methodMatcherCode"
            language="java"
            height="160px"
          />
          <MethodMatcherTable />
        </div>
      </template>

      <template #template>
        <div class="panel">
          <p class="lead">
            Niemals String-Concat — JavaTemplate parst mit Imports und Typen.
          </p>
          <JavaTemplateComparison />
          <div class="callout">
            <strong>Coordinates statt Positionen:</strong>
            <code>.replace()</code>, <code>.firstStatement()</code>,
            <code>.before()</code>, <code>.after()</code>. Imports via
            <code>maybeAddImport()</code>, niemals manuell an der
            CompilationUnit.
          </div>
        </div>
      </template>
    </Tabs>
  </div>
</template>
