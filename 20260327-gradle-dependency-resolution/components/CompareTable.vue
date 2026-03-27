<script setup>
const rows = [
  { feature: 'Globale Checksum-DB', go: ['sumdb', 'y'], pnpm: ['Nein', 'n'], uv: ['Nein', 'n'], gradle: ['Nein', 'n'] },
  { feature: 'Checksums im Lock', go: ['go.sum', 'y'], pnpm: ['SHA-512', 'y'], uv: ['In uv.lock', 'y'], gradle: ['Separate XML', 'p'] },
  { feature: 'Auto-lock bei Build', go: ['Ja', 'y'], pnpm: ['Ja', 'y'], uv: ['Ja', 'y'], gradle: ['Nein', 'n'] },
  { feature: 'Release-cooldown', go: ['Nein', 'n'], pnpm: ['Built-in', 'y'], uv: ['--exclude-newer', 'y'], gradle: ['Nur extern', 'n'] },
  { feature: 'BOM / Platform', go: ['Nein', 'n'], pnpm: ['Nein', 'n'], uv: ['Nein', 'n'], gradle: ['Ja', 'y'] },
  { feature: 'Lifecycle-scripts', go: ['Kein Risiko', 'y'], pnpm: ['Default-off', 'p'], uv: ['Kein Risiko', 'y'], gradle: ['Kein Risiko', 'y'] },
  { feature: 'Dep-confusion-Schutz', go: ['GOPROXY', 'y'], pnpm: ['Manuell', 'p'], uv: ['Manuell', 'p'], gradle: ['Content filter', 'y'] },
]
</script>

<template>
  <GradleVars>
    <table class="compare-table">
      <thead>
        <tr><th>Feature</th><th>Go</th><th>pnpm</th><th>uv</th><th>Gradle</th></tr>
      </thead>
      <tbody>
        <tr v-for="r in rows" :key="r.feature">
          <td>{{ r.feature }}</td>
          <td :class="r.go[1]">{{ r.go[0] }}</td>
          <td :class="r.pnpm[1]">{{ r.pnpm[0] }}</td>
          <td :class="r.uv[1]">{{ r.uv[0] }}</td>
          <td :class="r.gradle[1]">{{ r.gradle[0] }}</td>
        </tr>
      </tbody>
    </table>
  </GradleVars>
</template>

<style scoped>
.compare-table { width: 100%; border-collapse: collapse; font-size: 11px; }
.compare-table th { text-align: left; font-weight: 500; font-size: 10px; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; padding: 5px 8px; border-bottom: 0.5px solid var(--color-border-tertiary); }
.compare-table td { padding: 5px 8px; border-bottom: 0.5px solid var(--color-border-tertiary); vertical-align: top; color: var(--color-text-secondary); }
.compare-table tr:last-child td { border-bottom: none; }
.compare-table td:first-child { font-weight: 500; color: var(--color-text-primary); white-space: nowrap; }
.y { color: var(--color-text-success); font-weight: 500; }
.n { color: var(--color-text-danger); }
.p { color: var(--color-text-warning); }
</style>
