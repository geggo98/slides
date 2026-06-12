<script setup lang="ts">
import { computed } from "vue";
import { usePalette } from "@shared/composables/usePalette";

type Status = "active" | "deprecated" | "dead" | "bridge";

const props = defineProps<{
  variant?: "annotations" | "analyzers" | "languages" | "jeps" | "springboot";
}>();

// Carbon-Familie des Decks (vgl. shared/quiz/lib/carbonTokens.ts) als exakte
// Overrides — die Migration auf usePalette ist ein visueller No-Op.
const P = usePalette({
  light: {
    bg: "#ffffff",
    headerBg: "#f4f4f5",
    headerText: "#7c3aed",
    border: "#e4e4e7",
    text: "#3f3f46",
    hoverBg: "#f9fafb",
    accent: "#ea580c",
    green: "#16a34a",
    greenBg: "rgba(22,163,74,0.1)",
    yellow: "#a16207",
    yellowBg: "rgba(202,138,4,0.12)",
    red: "#dc2626",
    redBg: "rgba(220,38,38,0.1)",
    blue: "#1d4ed8",
    blueBg: "rgba(37,99,235,0.1)",
  },
  dark: {
    bg: "#14141c",
    headerBg: "#1a1a24",
    headerText: "#a78bfa",
    border: "#2a2a35",
    text: "#c8c8d0",
    hoverBg: "#181820",
    accent: "#fb923c",
    green: "#86efac",
    greenBg: "rgba(74,222,128,0.15)",
    yellow: "#fde68a",
    yellowBg: "rgba(250,204,21,0.18)",
    red: "#fca5a5",
    redBg: "rgba(248,113,113,0.15)",
    blue: "#93c5fd",
    blueBg: "rgba(96,165,250,0.15)",
  },
});

const annotations = [
  {
    src: "org.jspecify.annotations.*",
    year: "2024",
    status: "active",
    note: "Standard 2026 — verwenden",
  },
  {
    src: "javax.annotation.* (JSR-305)",
    year: "2006",
    status: "dead",
    note: "Migrieren",
  },
  {
    src: "org.springframework.lang.*",
    year: "2017",
    status: "deprecated",
    note: "Spring 7: deprecated",
  },
  {
    src: "org.jetbrains.annotations.*",
    year: "2010",
    status: "bridge",
    note: "Nur für Kotlin-Bridge",
  },
  {
    src: "org.eclipse.jdt.annotation.*",
    year: "2013",
    status: "active",
    note: "Nur Eclipse + Checker FW",
  },
  {
    src: "lombok.NonNull",
    year: "2014",
    status: "bridge",
    note: "Runtime-Check, ergänzend",
  },
];

const analyzers = [
  {
    tool: "NullAway",
    soundness: "Praktisch",
    overhead: "5–10 %",
    fp: "mittel",
    jspecify: "y",
    reco: "CI",
  },
  {
    tool: "Checker FW",
    soundness: "Formal/Sound",
    overhead: "5–20 ×",
    fp: "hoch",
    jspecify: "y",
    reco: "Sicherheitskritisch",
  },
  {
    tool: "IntelliJ",
    soundness: "Best-Effort",
    overhead: "—",
    fp: "mittel",
    jspecify: "y",
    reco: "IDE",
  },
  {
    tool: "Eclipse JDT",
    soundness: "Gut",
    overhead: "gering",
    fp: "mittel",
    jspecify: "p",
    reco: "Eclipse-spezifisch",
  },
  {
    tool: "SpotBugs",
    soundness: "Mittel",
    overhead: "Post-Build",
    fp: "hoch",
    jspecify: "n",
    reco: "Legacy",
  },
];

const languages = [
  {
    lang: "Java (2026)",
    mech: "Annotationen (JSpecify) + NullAway",
    status: "Pragmatisch, Build-Stack",
  },
  {
    lang: "Kotlin",
    mech: "Typsystem: T vs. T?",
    status: "Produktionsreif seit 2016",
  },
  {
    lang: "Scala 3",
    mech: "-Yexplicit-nulls (opt-in), Union T | Null",
    status: "Experimentell, JSpecify-interop",
  },
  {
    lang: "Groovy",
    mech: "@TypeChecked + JSR-305",
    status: "Außerhalb Sprachfokus",
  },
  {
    lang: "Clojure",
    mech: "nil-punning, dynamisch",
    status: "NPE nur an Java-Boundary",
  },
];

const jeps = [
  {
    jep: "JEP 8303099",
    title: "Null-Restricted / Nullable Types",
    status: "Draft, kein Target",
    earliest: "JDK 28+ (Preview), stable ≥ 2029 (LTS 33)",
  },
  {
    jep: "JEP 8316779",
    title: "Null-Restricted Value Class Types",
    status: "Draft, blockiert auf 8303099",
    earliest: "≥ 2029",
  },
  {
    jep: "JEP 401",
    title: "Value Classes (Preview)",
    status: "Candidate, EA Okt 2025",
    earliest: "JDK 28 Preview, stable ≥ 2028",
  },
  {
    jep: "JEP 402",
    title: "Enhanced Primitive Boxing",
    status: "Candidate",
    earliest: "Gekoppelt an JEP 401",
  },
];

const springboot = [
  {
    sb: "Spring Boot 4.0 (Nov 2025)",
    spring: "Framework 7",
    java: "≥ 17",
    kotlin: "≥ 2.1",
    jspecify: "y",
    note: "Alle APIs @NullMarked",
  },
  {
    sb: "Spring Boot 3.x",
    spring: "Framework 6",
    java: "17",
    kotlin: "1.9 / 2.x",
    jspecify: "p",
    note: "Nur teilweise; org.springframework.lang.*",
  },
  {
    sb: "Spring Boot 2.x (EOL)",
    spring: "Framework 5",
    java: "8/11",
    kotlin: "1.x",
    jspecify: "n",
    note: "Nicht mehr supported",
  },
];

const rows = computed(() => {
  switch (props.variant) {
    case "analyzers":
      return analyzers;
    case "languages":
      return languages;
    case "jeps":
      return jeps;
    case "springboot":
      return springboot;
    case "annotations":
    default:
      return annotations;
  }
});

const headers = computed(() => {
  switch (props.variant) {
    case "analyzers":
      return [
        "Tool",
        "Soundness",
        "Compile-Overhead",
        "False-Positives",
        "JSpecify",
        "Empfehlung",
      ];
    case "languages":
      return ["Sprache", "Mechanismus", "Status"];
    case "jeps":
      return ["JEP", "Titel", "Status (April 2026)", "Frühestens"];
    case "springboot":
      return [
        "Spring Boot",
        "Spring Framework",
        "Java",
        "Kotlin",
        "JSpecify",
        "Hinweis",
      ];
    case "annotations":
    default:
      return ["Quelle", "Seit", "Status", "Was tun?"];
  }
});

function badge(
  value: string,
):
  | { kind: "badge"; label: string; tone: "green" | "yellow" | "red" | "blue" }
  | { kind: "text"; label: string } {
  if (value === "y") return { kind: "badge", label: "Ja", tone: "green" };
  if (value === "n") return { kind: "badge", label: "Nein", tone: "red" };
  if (value === "p")
    return { kind: "badge", label: "Teilweise", tone: "yellow" };
  return { kind: "text", label: value };
}

function statusBadge(s: Status | string): {
  label: string;
  tone: "green" | "yellow" | "red" | "blue";
} {
  switch (s) {
    case "active":
      return { label: "Aktiv", tone: "green" };
    case "deprecated":
      return { label: "Deprecated", tone: "yellow" };
    case "dead":
      return { label: "Tot", tone: "red" };
    case "bridge":
      return { label: "Bridge", tone: "blue" };
    default:
      return { label: String(s), tone: "blue" };
  }
}

const cells = (row: any) => Object.values(row);
</script>

<template>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th v-for="h in headers" :key="h">{{ h }}</th>
        </tr>
      </thead>
      <tbody v-if="variant === 'annotations'">
        <tr v-for="r in rows as typeof annotations" :key="r.src">
          <td class="feature">{{ r.src }}</td>
          <td>{{ r.year }}</td>
          <td>
            <span class="badge" :class="statusBadge(r.status as Status).tone">{{
              statusBadge(r.status as Status).label
            }}</span>
          </td>
          <td>{{ r.note }}</td>
        </tr>
      </tbody>
      <tbody v-else-if="variant === 'analyzers'">
        <tr v-for="r in rows as typeof analyzers" :key="r.tool">
          <td class="feature">{{ r.tool }}</td>
          <td>{{ r.soundness }}</td>
          <td>{{ r.overhead }}</td>
          <td>{{ r.fp }}</td>
          <td>
            <template v-if="badge(r.jspecify).kind === 'badge'">
              <span class="badge" :class="(badge(r.jspecify) as any).tone">{{
                (badge(r.jspecify) as any).label
              }}</span>
            </template>
            <template v-else>{{ (badge(r.jspecify) as any).label }}</template>
          </td>
          <td>{{ r.reco }}</td>
        </tr>
      </tbody>
      <tbody v-else-if="variant === 'languages'">
        <tr v-for="r in rows as typeof languages" :key="r.lang">
          <td class="feature">{{ r.lang }}</td>
          <td>{{ r.mech }}</td>
          <td>{{ r.status }}</td>
        </tr>
      </tbody>
      <tbody v-else-if="variant === 'jeps'">
        <tr v-for="r in rows as typeof jeps" :key="r.jep">
          <td class="feature">{{ r.jep }}</td>
          <td>{{ r.title }}</td>
          <td>{{ r.status }}</td>
          <td>{{ r.earliest }}</td>
        </tr>
      </tbody>
      <tbody v-else-if="variant === 'springboot'">
        <tr v-for="r in rows as typeof springboot" :key="r.sb">
          <td class="feature">{{ r.sb }}</td>
          <td>{{ r.spring }}</td>
          <td>{{ r.java }}</td>
          <td>{{ r.kotlin }}</td>
          <td>
            <template v-if="badge(r.jspecify).kind === 'badge'">
              <span class="badge" :class="(badge(r.jspecify) as any).tone">{{
                (badge(r.jspecify) as any).label
              }}</span>
            </template>
            <template v-else>{{ (badge(r.jspecify) as any).label }}</template>
          </td>
          <td>{{ r.note }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.table-wrap {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  background: v-bind("P.bg");
  border: 1px solid v-bind("P.border");
  border-radius: 8px;
  overflow: hidden;
  font-size: 12px;
}
th,
td {
  padding: 8px 10px;
  text-align: left;
  border-bottom: 1px solid v-bind("P.border");
  color: v-bind("P.text");
}
th {
  background: v-bind("P.headerBg");
  color: v-bind("P.headerText");
  font-weight: 600;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.feature {
  font-weight: 600;
}
tr:last-child td {
  border-bottom: none;
}
tr:hover td {
  background: v-bind("P.hoverBg");
}
.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
}
.badge.green {
  background: v-bind("P.greenBg");
  color: v-bind("P.green");
}
.badge.yellow {
  background: v-bind("P.yellowBg");
  color: v-bind("P.yellow");
}
.badge.red {
  background: v-bind("P.redBg");
  color: v-bind("P.red");
}
.badge.blue {
  background: v-bind("P.blueBg");
  color: v-bind("P.blue");
}
</style>
