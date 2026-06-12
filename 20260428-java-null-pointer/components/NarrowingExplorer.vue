<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { usePalette } from "@shared/composables/usePalette";
import MonacoBlock from "@shared/components/MonacoBlock.vue";

type Nullness = "nonnull" | "nullable" | "bottom" | "other";
type StoreEntry = [path: string, nullness: Nullness];
type Step = {
  line: number;
  store: StoreEntry[];
  note: string;
  error?: boolean;
  warn?: boolean;
};
type Verdict = "pass" | "fail" | "warn";
type Scenario = {
  title: string;
  desc: string;
  code: string[];
  steps: Step[];
  verdict: Verdict;
  verdictNote: string;
};

const scenarios: Scenario[] = [
  {
    title: "1. Basis-Narrowing",
    desc: "Klassisches Pattern. Refinement gilt nur innerhalb des if-Branch.",
    code: [
      "@Nullable String s = getInput();",
      "if (s != null) {",
      "    System.out.println(s.length());",
      "}",
      "s.length();",
    ],
    steps: [
      {
        line: 0,
        store: [["s", "nullable"]],
        note: "s deklariert als @Nullable. Initialer Store: s ↦ Nullable.",
      },
      {
        line: 1,
        store: [["s", "nullable"]],
        note: "NullAway sieht Vergleich s != null. Die Transferfunktion produziert zwei Stores: einen für den then-Branch, einen für den else-Branch.",
      },
      {
        line: 2,
        store: [["s", "nonnull"]],
        note: "Im then-Branch: s ist refined zu @NonNull. s.length() ist sicher dereferenzierbar.",
      },
      {
        line: 4,
        store: [["s", "nullable"]],
        note: "Nach dem if: keine Information aus dem Branch übrig. s wieder nullable. Dereferenz schlägt fehl.",
        error: true,
      },
    ],
    verdict: "fail",
    verdictNote: "NullAway: dereferenced expression s is @Nullable (Zeile 5)",
  },
  {
    title: "2. Boolean-Indirektion",
    desc: "Issue #98, seit 2017 offen. Refinement folgt nicht durch eine boolean-Variable.",
    code: [
      "@Nullable String s = getInput();",
      "boolean isNull = (s == null);",
      "if (!isNull) {",
      "    s.length();",
      "}",
    ],
    steps: [
      {
        line: 0,
        store: [["s", "nullable"]],
        note: "s deklariert als @Nullable.",
      },
      {
        line: 1,
        store: [
          ["s", "nullable"],
          ["isNull", "other"],
        ],
        note: "isNull ist eine bool-Variable. NullAway speichert keine Korrelation zwischen isNull und der Nullness von s.",
      },
      {
        line: 2,
        store: [
          ["s", "nullable"],
          ["isNull", "other"],
        ],
        note: "Im then-Branch von !isNull: NullAway weiß nicht, dass das mit s != null äquivalent ist. s bleibt nullable.",
        warn: true,
      },
      {
        line: 3,
        store: [
          ["s", "nullable"],
          ["isNull", "other"],
        ],
        note: "s.length() — Dereferenz auf @Nullable. Fehler.",
        error: true,
      },
    ],
    verdict: "fail",
    verdictNote: "Umgehung: direkt if (s != null) — nicht über bool umleiten",
  },
  {
    title: "3. Field + Methodenaufruf",
    desc: "Die unsound assumption von NullAway: Methoden mutieren Felder nicht.",
    code: [
      "class C {",
      "  @Nullable Foo field;",
      "  void m() {",
      "    if (this.field != null) {",
      "      doSomething();",
      "      this.field.bar();",
      "    }",
      "  }",
      "}",
    ],
    steps: [
      {
        line: 3,
        store: [["this.field", "nullable"]],
        note: "this.field ist @Nullable. Null-Check beginnt — Refinement startet im then-Branch.",
      },
      {
        line: 4,
        store: [["this.field", "nonnull"]],
        note: "Refined zu @NonNull. doSomething() könnte this.field auf null setzen — NullAway invalidiert den Store NICHT (dokumentierte unsound assumption).",
        warn: true,
      },
      {
        line: 5,
        store: [["this.field", "nonnull"]],
        note: "this.field.bar() — NullAway akzeptiert. Zur Laufzeit kann hier eine NPE auftreten, wenn doSomething() das Feld geändert hat.",
        warn: true,
      },
    ],
    verdict: "warn",
    verdictNote:
      "Build passt — aber Laufzeit-NPE möglich. Siehe NullAway-Wiki, How NullAway Works.",
  },
  {
    title: "4. Lokale Kopie (idiomatisch)",
    desc: "Das Standard-Idiom. Sound, weil eine lokale Variable nicht durch andere Methoden mutiert werden kann.",
    code: [
      "void m() {",
      "  Foo local = this.field;",
      "  if (local != null) {",
      "    doSomething();",
      "    local.bar();",
      "  }",
      "}",
    ],
    steps: [
      {
        line: 1,
        store: [
          ["local", "nullable"],
          ["this.field", "nullable"],
        ],
        note: "Lokale Kopie. local erbt initial die Nullness von this.field.",
      },
      {
        line: 2,
        store: [
          ["local", "nullable"],
          ["this.field", "nullable"],
        ],
        note: "Null-Check auf der lokalen Variable, nicht auf dem Feld.",
      },
      {
        line: 3,
        store: [
          ["local", "nonnull"],
          ["this.field", "nullable"],
        ],
        note: "Im then-Branch: local refined zu @NonNull. doSomething() kann this.field mutieren — local nicht (lokale Variable, keine Aliase).",
      },
      {
        line: 4,
        store: [
          ["local", "nonnull"],
          ["this.field", "nullable"],
        ],
        note: "local.bar() — sicher. Sound, weil das Refinement an die lokale Variable gebunden ist.",
      },
    ],
    verdict: "pass",
    verdictNote:
      "Build passt UND ist sound. Bevorzugtes Pattern in Spring, Chromium, Uber.",
  },
  {
    title: "5. Objects.requireNonNull",
    desc: "NullAway erkennt requireNonNull als Narrowing-Idiom — auch als Ausdruck verwendet.",
    code: [
      "@Nullable String s = getInput();",
      "String t = Objects.requireNonNull(s);",
      "t.length();",
      "s.length();",
    ],
    steps: [
      {
        line: 0,
        store: [["s", "nullable"]],
        note: "s deklariert als @Nullable.",
      },
      {
        line: 1,
        store: [
          ["s", "nonnull"],
          ["t", "nonnull"],
        ],
        note: "requireNonNull wirft NPE wenn null. Die Folgezeile ist nur erreichbar, wenn s tatsächlich non-null war. Beide refined.",
      },
      {
        line: 2,
        store: [
          ["s", "nonnull"],
          ["t", "nonnull"],
        ],
        note: "t.length() — sicher.",
      },
      {
        line: 3,
        store: [
          ["s", "nonnull"],
          ["t", "nonnull"],
        ],
        note: "s.length() — auch sicher, weil s ebenfalls refined wurde.",
      },
    ],
    verdict: "pass",
    verdictNote:
      "In NullAway als library model modelliert. Auch Preconditions.checkNotNull, Verify.verifyNotNull funktionieren so.",
  },
  {
    title: "6. @EnsuresNonNull (interprozedural)",
    desc: "Aufrufer-Refinement durch Methoden-Kontrakte. NullAway-spezifisch — JSpecify hat (Stand 1.0) kein Äquivalent.",
    code: [
      "class C {",
      "  @Nullable Foo field;",
      '  @EnsuresNonNull("field")',
      "  void init() { this.field = new Foo(); }",
      "  void use() {",
      "    init();",
      "    this.field.bar();",
      "  }",
      "}",
    ],
    steps: [
      {
        line: 2,
        store: [["this.field", "nullable"]],
        note: '@EnsuresNonNull("field") deklariert den Kontrakt: nach Rückkehr ist field non-null.',
      },
      {
        line: 3,
        store: [["this.field", "nonnull"]],
        note: "NullAway prüft den Kontrakt: am exit-node von init() muss this.field nicht-null sein. OK — wurde gerade zugewiesen.",
      },
      {
        line: 4,
        store: [["this.field", "nullable"]],
        note: "use() beginnt. this.field zunächst nullable (so deklariert).",
      },
      {
        line: 5,
        store: [["this.field", "nonnull"]],
        note: "init() hat @EnsuresNonNull. Nach dem Aufruf: this.field refined zu @NonNull.",
      },
      {
        line: 6,
        store: [["this.field", "nonnull"]],
        note: "this.field.bar() — sicher dank Kontrakt.",
      },
    ],
    verdict: "pass",
    verdictNote:
      "Inter-prozedural durch Annotation. NullAway-eigene @EnsuresNonNull, nicht JSpecify.",
  },
];

// Carbon-Familie des Decks (vgl. shared/quiz/lib/carbonTokens.ts) als exakte
// Overrides — die Migration auf usePalette ist ein visueller No-Op.
const P = usePalette({
  light: {
    bg: "#ffffff",
    panelBg: "#f4f4f5",
    border: "#e4e4e7",
    text: "#3f3f46",
    textMuted: "rgba(63,63,70,0.65)",
    accent: "#ea580c",
    accentBg: "rgba(234,88,12,0.08)",
    green: "#16a34a",
    greenBg: "rgba(22,163,74,0.12)",
    yellow: "#a16207",
    yellowBg: "rgba(202,138,4,0.14)",
    red: "#dc2626",
    redBg: "rgba(220,38,38,0.12)",
    blue: "#1d4ed8",
    blueBg: "rgba(37,99,235,0.12)",
  },
  dark: {
    bg: "#14141c",
    panelBg: "#1a1a24",
    border: "#2a2a35",
    text: "#c8c8d0",
    textMuted: "rgba(200,200,208,0.6)",
    accent: "#fb923c",
    accentBg: "rgba(251,146,60,0.12)",
    green: "#86efac",
    greenBg: "rgba(74,222,128,0.18)",
    yellow: "#fde68a",
    yellowBg: "rgba(250,204,21,0.20)",
    red: "#fca5a5",
    redBg: "rgba(248,113,113,0.18)",
    blue: "#93c5fd",
    blueBg: "rgba(96,165,250,0.18)",
  },
});

const paletteVars = computed(() => ({
  "--nrw-bg": P.value.bg,
  "--nrw-panel-bg": P.value.panelBg,
  "--nrw-border": P.value.border,
  "--nrw-text": P.value.text,
  "--nrw-text-muted": P.value.textMuted,
  "--nrw-accent": P.value.accent,
  "--nrw-accent-bg": P.value.accentBg,
  "--nrw-green": P.value.green,
  "--nrw-green-bg": P.value.greenBg,
  "--nrw-yellow": P.value.yellow,
  "--nrw-yellow-bg": P.value.yellowBg,
  "--nrw-red": P.value.red,
  "--nrw-red-bg": P.value.redBg,
  "--nrw-blue": P.value.blue,
  "--nrw-blue-bg": P.value.blueBg,
}));

const currentIdx = ref(0);
const stepIdx = ref(0);

const sc = computed(() => scenarios[currentIdx.value]);
const st = computed(() => sc.value.steps[stepIdx.value]);
const isLast = computed(() => stepIdx.value === sc.value.steps.length - 1);
const isFirst = computed(() => stepIdx.value === 0);
const codeText = computed(() => sc.value.code.join("\n"));

const verdictLabel = computed(() => {
  const v = sc.value.verdict;
  return v === "pass"
    ? "pass"
    : v === "warn"
      ? "pass (unsound)"
      : "NullAway error";
});

let editor: any = null;
let monaco: any = null;
let deco: any = null;

function applyHighlight() {
  if (!editor || !monaco) return;
  if (deco) deco.clear();
  const cls = st.value.error
    ? "nrw-line-error"
    : st.value.warn
      ? "nrw-line-warn"
      : "nrw-line-active";
  const lineNo = st.value.line + 1;
  deco = editor.createDecorationsCollection([
    {
      range: new monaco.Range(lineNo, 1, lineNo, 1),
      options: { isWholeLine: true, className: cls },
    },
  ]);
}

function onReady(ctx: { editor: any; monaco: any }) {
  editor = ctx.editor;
  monaco = ctx.monaco;
  applyHighlight();
}

watch(currentIdx, () => {
  stepIdx.value = 0;
  if (editor) editor.getModel()?.setValue(codeText.value);
  nextTick(applyHighlight);
});
watch(stepIdx, applyHighlight);

function selectScenario(i: number) {
  currentIdx.value = i;
}
function prevLine() {
  if (!isFirst.value) stepIdx.value--;
}
function nextLine() {
  if (!isLast.value) stepIdx.value++;
}

const tagLabel: Record<Nullness, string> = {
  nonnull: "@NonNull",
  nullable: "@Nullable",
  bottom: "⊥",
  other: "untracked",
};
</script>

<template>
  <div class="narrowing-explorer" :style="paletteVars">
    <div class="scenario-row" role="tablist" aria-label="Refinement-Szenarien">
      <button
        v-for="(s, i) in scenarios"
        :key="i"
        class="scenario-btn"
        :class="{ active: i === currentIdx }"
        role="tab"
        :aria-selected="i === currentIdx"
        @click="selectScenario(i)"
      >
        {{ s.title }}
      </button>
    </div>

    <div v-if="!isLast" class="desc">{{ sc.desc }}</div>
    <div v-else class="verdict" :class="`verdict-${sc.verdict}`">
      <span class="verdict-tag">{{ verdictLabel }}</span>
      <span class="verdict-note">{{ sc.verdictNote }}</span>
    </div>

    <MonacoBlock
      :code="codeText"
      language="java"
      height="176px"
      @ready="onReady"
    />

    <div class="controls">
      <button
        class="step-btn"
        :disabled="isFirst"
        aria-label="Vorherige Zeile"
        @click="prevLine"
      >
        <span class="tri">▲</span>
        <span>Zeile zurück</span>
      </button>
      <span class="step-info"
        >Schritt {{ stepIdx + 1 }} / {{ sc.steps.length }}</span
      >
      <button
        class="step-btn"
        :disabled="isLast"
        aria-label="Nächste Zeile"
        @click="nextLine"
      >
        <span>Zeile weiter</span>
        <span class="tri">▼</span>
      </button>
    </div>

    <div class="panel-row">
      <div class="panel">
        <p class="panel-label">store (access path → nullness)</p>
        <p v-if="!st.store.length" class="store-empty">leer</p>
        <div v-for="[path, nn] in st.store" :key="path" class="store-row">
          <span class="path">{{ path }}</span>
          <span class="tag" :class="`tag-${nn}`">{{ tagLabel[nn] }}</span>
        </div>
      </div>
      <div class="panel">
        <p class="panel-label">erklärung</p>
        <p class="note-text">{{ st.note }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.narrowing-explorer {
  font-family: "Inter", sans-serif;
  color: var(--nrw-text);
  font-size: 12px;
  line-height: 1.5;
}

.scenario-row {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin: 0 0 6px;
}
.scenario-btn {
  font-size: 10.5px;
  padding: 4px 9px;
  cursor: pointer;
  background: transparent;
  border: 0.5px solid var(--nrw-border);
  border-radius: 5px;
  color: var(--nrw-text-muted);
  font-family: inherit;
  transition:
    border-color 0.15s,
    color 0.15s,
    background 0.15s;
}
.scenario-btn:hover {
  border-color: var(--nrw-accent);
  color: var(--nrw-text);
}
.scenario-btn.active {
  background: var(--nrw-accent-bg);
  border-color: var(--nrw-accent);
  color: var(--nrw-accent);
  font-weight: 500;
}

.desc {
  font-size: 11.5px;
  color: var(--nrw-text-muted);
  margin: 0 0 6px;
  min-height: 17px;
}

.verdict {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border-radius: 5px;
  margin: 0 0 6px;
  font-size: 11.5px;
  min-height: 17px;
}
.verdict-pass {
  background: var(--nrw-green-bg);
  color: var(--nrw-green);
}
.verdict-fail {
  background: var(--nrw-red-bg);
  color: var(--nrw-red);
}
.verdict-warn {
  background: var(--nrw-yellow-bg);
  color: var(--nrw-yellow);
}
.verdict-tag {
  font-family: "0xProto", monospace;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.12);
  font-size: 10px;
  letter-spacing: 0.02em;
}

.controls {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 6px 0;
}
.step-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 5px;
  border: 0.5px solid var(--nrw-border);
  background: var(--nrw-panel-bg);
  color: var(--nrw-text);
  font-family: inherit;
  cursor: pointer;
  transition:
    border-color 0.15s,
    opacity 0.15s;
}
.step-btn:not(:disabled):hover {
  border-color: var(--nrw-accent);
}
.step-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.tri {
  font-size: 13px;
  line-height: 1;
  color: var(--nrw-accent);
}
.step-info {
  flex: 1;
  text-align: center;
  font-family: "0xProto", monospace;
  font-size: 10.5px;
  color: var(--nrw-text-muted);
}

.panel-row {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 8px;
}
.panel {
  background: var(--nrw-panel-bg);
  border: 0.5px solid var(--nrw-border);
  border-radius: 5px;
  padding: 7px 10px;
  min-height: 88px;
}
.panel-label {
  font-size: 9.5px;
  color: var(--nrw-text-muted);
  letter-spacing: 0.05em;
  text-transform: lowercase;
  margin: 0 0 5px;
}
.store-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3px 0;
  font-family: "0xProto", monospace;
  font-size: 11px;
  border-bottom: 0.5px dashed var(--nrw-border);
}
.store-row:last-child {
  border-bottom: none;
}
.store-empty {
  margin: 0;
  font-style: italic;
  font-size: 11px;
  color: var(--nrw-text-muted);
}
.path {
  color: var(--nrw-text);
}
.tag {
  font-family: "Inter", sans-serif;
  font-size: 9.5px;
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 500;
}
.tag-nonnull {
  background: var(--nrw-green-bg);
  color: var(--nrw-green);
}
.tag-nullable {
  background: var(--nrw-yellow-bg);
  color: var(--nrw-yellow);
}
.tag-bottom {
  background: var(--nrw-red-bg);
  color: var(--nrw-red);
}
.tag-other {
  background: var(--nrw-border);
  color: var(--nrw-text-muted);
}
.note-text {
  margin: 0;
  font-size: 11px;
  line-height: 1.45;
  color: var(--nrw-text);
}
</style>

<style>
/* Monaco line decorations — global so :deep selectors are not needed.
   Scoped to .narrowing-explorer ancestor so the vars resolve and other
   Monaco instances on the page are not affected. */
.narrowing-explorer .monaco-editor .nrw-line-active {
  background: var(--nrw-blue-bg) !important;
}
.narrowing-explorer .monaco-editor .nrw-line-warn {
  background: var(--nrw-yellow-bg) !important;
}
.narrowing-explorer .monaco-editor .nrw-line-error {
  background: var(--nrw-red-bg) !important;
}
</style>
