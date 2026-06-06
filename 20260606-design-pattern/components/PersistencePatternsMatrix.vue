<script setup>
// Bonus: Datenpersistenz-Pattern-Cluster (Compass). Sieben konzeptionell
// unterschiedliche Cluster — Werkzeuge sind Implementierungen *innerhalb*,
// keine austauschbaren Alternativen.
const rows = [
  {
    cluster: "Active Record",
    sql: "Framework",
    graph: "p",
    uow: "n",
    types: "schwach (Runtime)",
    tools: "Rails, Django, Eloquent",
  },
  {
    cluster: "Data Mapper / ORM",
    sql: "ORM generiert",
    graph: "y",
    uow: "y",
    types: "schwach–mittel",
    tools: "Hibernate/JPA, EF Core, SQLAlchemy",
  },
  {
    cluster: "Repository",
    sql: "delegiert",
    graph: "—",
    uow: "—",
    types: "abhängig",
    tools: "Spring Data",
  },
  {
    cluster: "Query Builder / Fluent DSL",
    sql: "Entwickler (DSL)",
    graph: "n",
    uow: "n",
    types: "stark (Compile-Time)",
    tools: "jOOQ, Slick, Drizzle, Kysely",
  },
  {
    cluster: "Language-Integrated Query",
    sql: "Compiler + Provider",
    graph: "p",
    uow: "p",
    types: "stark",
    tools: "LINQ, Quill",
  },
  {
    cluster: "SQL Mapper / Micro-ORM",
    sql: "Entwickler (handgeschr.)",
    graph: "n",
    uow: "n",
    types: "stark (codegen)–schwach",
    tools: "MyBatis, Dapper, JDBI, sqlc, sqlx",
  },
  {
    cluster: "Datomic (Datalog/EAVT)",
    sql: "Datalog statt SQL",
    graph: "y",
    uow: "—",
    types: "dynamisch",
    tools: "Datomic",
  },
];
const MARK = { y: "✓", n: "✗", p: "◐", "—": "—" };
</script>

<template>
  <div class="pm-wrap">
    <table class="pm">
      <thead>
        <tr>
          <th>Cluster</th>
          <th>Wer hält das SQL?</th>
          <th>Objekt-Graph</th>
          <th>Identity&nbsp;Map / UoW</th>
          <th>Typsicherheit</th>
          <th>Beispiele</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in rows" :key="r.cluster">
          <td class="name">{{ r.cluster }}</td>
          <td>{{ r.sql }}</td>
          <td class="ctr" :class="r.graph">{{ MARK[r.graph] }}</td>
          <td class="ctr" :class="r.uow">{{ MARK[r.uow] }}</td>
          <td>{{ r.types }}</td>
          <td class="mono">{{ r.tools }}</td>
        </tr>
      </tbody>
    </table>
    <div class="legend">
      <span><b class="y">✓</b> ja</span>
      <span><b class="p">◐</b> optional / begrenzt</span>
      <span><b class="n">✗</b> nein</span>
      <span>— delegiert / n.&nbsp;a.</span>
      <span class="hint"
        >Werkzeuge sind Implementierungen <em>innerhalb</em> eines Clusters,
        keine austauschbaren Alternativen.</span
      >
    </div>
  </div>
</template>

<style scoped>
.pm-wrap {
  font-family: var(--font-sans);
}
.pm {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  background: var(--color-background-primary);
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: var(--sk-radm);
  overflow: hidden;
  color: var(--color-text-primary);
}
.pm th {
  text-align: left;
  padding: 6px 9px;
  font-weight: 600;
  font-size: 10px;
  background: var(--color-background-secondary);
  color: var(--color-text-secondary);
  border-bottom: 0.5px solid var(--color-border-tertiary);
}
.pm td {
  padding: 5px 9px;
  border-bottom: 0.5px solid var(--color-border-tertiary);
  vertical-align: top;
  color: var(--color-text-secondary);
}
.pm tr:last-child td {
  border-bottom: none;
}
.name {
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
}
.mono {
  font-family: var(--font-mono);
  font-size: 9.5px;
  color: var(--color-text-tertiary);
}
.ctr {
  text-align: center;
  font-weight: 700;
}
.y {
  color: var(--color-text-success);
}
.n {
  color: var(--color-text-danger);
}
.p {
  color: var(--color-text-warning);
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 7px;
  font-size: 9px;
  color: var(--color-text-tertiary);
}
.legend b {
  font-weight: 700;
}
.legend .hint {
  margin-left: auto;
  font-style: italic;
}
</style>
