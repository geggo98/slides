<script setup>
import { ref, computed } from "vue";

const activeTab = ref("gradle");

const renovateJson = `{
  "packageRules": [
    {
      "matchManagers": ["gradle"],
      "minimumReleaseAge": "7 days"
    },
    {
      "matchManagers": ["gradle"],
      "matchPackageNames": ["com.example:trusted-lib"],
      "minimumReleaseAge": "0 days"
    }
  ]
}`;

const dependabotYml = `updates:
  - package-ecosystem: gradle
    schedule: { interval: weekly }
    cooldown:
      default-days: 7
      semver-major-days: 30
      exclude:
        - "com.example:trusted-lib"`;

const npmRc = `# .npmrc (projekt-lokal oder ~/.npmrc)
min-release-age=7`;

const pnpmWorkspace = `# pnpm-workspace.yaml (ab pnpm 10) oder package.json
minimumReleaseAge: 10080
minimumReleaseAgeExclude:
  - "@internal/*"
  - "typescript"`;

const pnpmNpmrc = `# .npmrc — kebab-case!
minimum-release-age=10080
minimum-release-age-exclude[]=@internal/*
minimum-release-age-exclude[]=typescript`;

const bunToml = `# bunfig.toml
[install]
minimumReleaseAge = 604800
minimumReleaseAgeExcludes = ["@internal/shared", "typescript"]`;

const yarnRc = `# .yarnrc.yml
npmMinimalAgeGate: 10080

npmPreapprovedPackages:
  "@internal/*": "*"
  typescript: "*"`;

const uvToml = `# pyproject.toml
[tool.uv]
exclude-newer = "7 days"
exclude-newer-package = { "browser-use" = "2026-04-03" }`;

const denoShell = `deno install --minimum-dependency-age=7d
deno add --minimum-dependency-age=7d npm:lodash`;

const tabs = [
  {
    id: "gradle",
    label: "Gradle",
    layout: "row",
    snippets: [
      {
        code: renovateJson,
        language: "json",
        caption: "renovate.json",
        height: "260px",
      },
      {
        code: dependabotYml,
        language: "yaml",
        caption: ".github/dependabot.yml",
        height: "260px",
      },
    ],
    info: {
      tone: "info",
      title: "Dependabot — semver-granular",
      body: "Dependabot unterstützt <code>semver-major-days</code>, <code>semver-minor-days</code>, <code>semver-patch-days</code> — Patches dürfen z.&nbsp;B. sofort durch, Majors warten 30 Tage. Renovate hat diese Granularität via <code>matchUpdateTypes</code>.",
    },
  },
  {
    id: "npm",
    label: "npm",
    snippets: [
      { code: npmRc, language: "ini", caption: ".npmrc", height: "120px" },
    ],
    info: {
      tone: "warning",
      title: "Erst ab npm 11.5.0 (Sept 2025)",
      body: "Ältere npm-Versionen ignorieren den Key <strong>stillschweigend</strong> — Supply-Chain-Risiko, wenn Teile des Teams/CI auf älteren Versionen laufen. Erzwinge <code>engines.npm</code> oder nimm Volta/fnm. Einheit: Tage (Integer). Keine Exclude-Liste.",
    },
  },
  {
    id: "pnpm",
    label: "pnpm",
    snippets: [
      {
        code: pnpmWorkspace,
        language: "yaml",
        caption: "pnpm-workspace.yaml (camelCase)",
        height: "115px",
      },
      {
        code: pnpmNpmrc,
        language: "ini",
        caption: ".npmrc (kebab-case)",
        height: "95px",
      },
    ],
    info: {
      tone: "warning",
      title: "camelCase vs. kebab-case",
      body: "<code>pnpm-workspace.yaml</code> / <code>package.json</code> nutzt <strong>camelCase</strong>, <code>.npmrc</code> nutzt <strong>kebab-case</strong>. Falsche Schreibweise wird <strong>still ignoriert</strong> — keine Warnung, keine Fehlermeldung.",
    },
  },
  {
    id: "bun",
    label: "Bun",
    snippets: [
      {
        code: bunToml,
        language: "ini",
        caption: "bunfig.toml",
        height: "150px",
      },
    ],
    info: {
      tone: "info",
      title: "Einheit: Sekunden",
      body: "Bun ist das <strong>einzige</strong> Tool, das die Cooldown-Zeit in Sekunden ausdrückt — <code>604800</code> = 7 Tage. <code>bunfig.toml</code> nutzt camelCase.",
    },
  },
  {
    id: "yarn",
    label: "Yarn ≥ 4.10",
    snippets: [
      {
        code: yarnRc,
        language: "yaml",
        caption: ".yarnrc.yml",
        height: "170px",
      },
    ],
    info: {
      tone: "info",
      title: "Map von Glob → Semver-Range",
      body: '<code>npmPreapprovedPackages</code> ist <strong>keine Liste</strong>, sondern eine <strong>Map</strong> — Werte sind Semver-Ranges. <code>"*"</code> erlaubt alle Versionen, <code>"^5.0.0"</code> nur Patches/Minors ab 5.0.0. Damit lässt sich gezielt „nur Patches ohne Wartezeit" erlauben.',
    },
  },
  {
    id: "uv",
    label: "uv",
    snippets: [
      {
        code: uvToml,
        language: "ini",
        caption: "pyproject.toml",
        height: "140px",
      },
    ],
    info: {
      tone: "info",
      title: "Override, kein Allowlist-Exclude",
      body: "<code>exclude-newer-package</code> ist <strong>semantisch anders</strong> als bei npm/pnpm/Bun/Yarn: Es setzt pro Paket ein <strong>anderes Cutoff-Datum</strong> (Override) statt die Altersgrenze zu umgehen. Ein Datum statt eines Age-Werts — granularer, aber nicht vergleichbar.",
    },
  },
  {
    id: "deno",
    label: "Deno",
    snippets: [
      {
        code: denoShell,
        language: "shell",
        caption: "CLI (keine Config-Datei)",
        height: "120px",
      },
    ],
    info: {
      tone: "info",
      title: "Exclude via gepinnte Imports",
      body: "Kein Config-File, keine Per-Package-Excludes im Flag selbst. Idiomatisch: <code>deno.json</code> <code>imports</code> mit <strong>expliziter Version</strong> — gepinnte Pakete werden nicht durch Age-Checks geblockt (nur Auto-Resolutions). Format: Duration-String (<code>7d</code>, <code>24h</code>, <code>168h</code>).",
    },
  },
];

const activeEntry = computed(() => tabs.find((t) => t.id === activeTab.value));
</script>

<template>
  <GradleVars>
    <div class="ct-wrap">
      <p class="ct-intro">
        Einheiten-Inkonsistenz ist die eigentliche Story: Tage · Minuten ·
        Sekunden · Duration-String · Datum — alle für denselben Cooldown.
      </p>

      <div class="ct-tabs">
        <button
          v-for="t in tabs"
          :key="t.id"
          class="ct-tab"
          :class="{ active: activeTab === t.id }"
          @click.stop="activeTab = t.id"
        >
          {{ t.label }}
        </button>
      </div>

      <div :key="activeTab" class="ct-panel">
        <div class="ct-snippets" :class="{ row: activeEntry.layout === 'row' }">
          <div
            v-for="(s, i) in activeEntry.snippets"
            :key="i"
            class="ct-snippet"
          >
            <p class="ct-caption">{{ s.caption }}</p>
            <MonacoBlock
              :code="s.code"
              :language="s.language"
              :height="s.height"
            />
          </div>
        </div>

        <div class="ct-info" :class="activeEntry.info.tone">
          <p class="ct-info-title">{{ activeEntry.info.title }}</p>
          <p class="ct-info-body" v-html="activeEntry.info.body" />
        </div>
      </div>
    </div>
  </GradleVars>
</template>

<style scoped>
.ct-wrap {
  width: 100%;
}
.ct-intro {
  font-size: 12.5px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin: 0 0 10px;
}

.ct-tabs {
  display: flex;
  gap: 4px;
  margin: 0 0 10px;
  flex-wrap: wrap;
}
.ct-tab {
  font-size: 12.5px;
  padding: 5px 14px;
  border-radius: var(--border-radius-md);
  border: 0.5px solid var(--color-border-tertiary);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}
.ct-tab:hover {
  background: var(--color-background-secondary);
}
.ct-tab.active {
  background: var(--color-background-secondary);
  color: var(--color-text-primary);
  border-color: var(--color-text-secondary);
  font-weight: 500;
}

.ct-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ct-snippets {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.ct-snippets.row {
  flex-direction: row;
  gap: 10px;
}
.ct-snippets.row .ct-snippet {
  flex: 1 1 0;
}
.ct-snippet {
  min-width: 0;
}
.ct-caption {
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--color-text-tertiary);
  margin: 0 0 2px 2px;
  text-transform: lowercase;
}

.ct-info {
  border-radius: var(--border-radius-lg);
  padding: 10px 14px;
  border: 0.5px solid var(--color-border-tertiary);
}
.ct-info.info {
  background: var(--color-background-info);
  border-color: var(--color-border-info);
}
.ct-info.warning {
  background: var(--color-background-warning);
  border-color: var(--color-border-warning);
}
.ct-info-title {
  font-size: 12.5px;
  font-weight: 600;
  margin: 0 0 4px;
  color: var(--color-text-primary);
  letter-spacing: 0.01em;
}
.ct-info.info .ct-info-title {
  color: var(--color-text-info);
}
.ct-info.warning .ct-info-title {
  color: var(--color-text-warning);
}
.ct-info-body {
  font-size: 12px;
  line-height: 1.55;
  margin: 0;
  color: var(--color-text-primary);
}
.ct-info-body :deep(code) {
  font-family: var(--font-mono);
  font-size: 11px;
  background: var(--color-background-tertiary);
  padding: 1px 5px;
  border-radius: 4px;
}
.ct-info-body :deep(strong) {
  font-weight: 600;
}
</style>
