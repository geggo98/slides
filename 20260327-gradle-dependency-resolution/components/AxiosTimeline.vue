<script setup>
import { reactive, computed } from 'vue'

const openCards = reactive({})
function toggleCard(i) {
  openCards[i] = !openCards[i]
}

const events = [
  { ph: 1, t: '~14. März', time: '', title: 'Erster Kontakt mit Jason Saayman', crit: false,
    d: 'UNC1069 gibt sich als Gründer eines realen, renommierten Unternehmens aus. Saayman wird in einen professionell inszenierten Slack-Workspace eingeladen \u2013 mit LinkedIn-Posts, Mitarbeiter-Accounts und mehreren Channels. Parallel werden mindestens 6 weitere Node.js-Maintainer (Lodash, Fastify, dotenv, Mocha u.\u202fa.) mit ähnlichen Methoden kontaktiert.',
    tags: ['Slack', 'Fake Identität', '6+ Maintainer'] },
  { ph: 1, t: '~28. März', time: '', title: 'Gefälschtes Teams-Meeting \u2013 ClickFix-Angriff', crit: true,
    d: 'Saayman nimmt an einem Microsoft-Teams-Call teil. Beim Beitritt wird eine gefälschte Fehlermeldung angezeigt: eine Systemkomponente sei veraltet. Das \u00bbUpdate\u00ab installiert einen RAT (Remote Access Trojan), der den Angreifern volle Kontrolle über Saaymanns Rechner gibt \u2013 einschließlich npm-Tokens, TOTP-Codes und Browser-Sessions.',
    tags: ['ClickFix', 'RAT', 'Credential theft'] },
  { ph: 2, t: '30. März', time: '05:57', title: 'Decoy-Paket plain-crypto-js@4.2.0 veröffentlicht', crit: false,
    d: 'Account \u00bbnrwise\u00ab (nrwise@proton.me) publiziert eine saubere Version, um eine Veröffentlichungshistorie aufzubauen und Scanner zu beruhigen, die bei brandneuen Paketen Alarm schlagen. 18 Stunden Vorlauf vor dem eigentlichen Angriff.',
    tags: ['Pre-staging', 'Anti-Detection', 'npm'] },
  { ph: 2, t: '30. März', time: '23:59', title: 'Bösartige plain-crypto-js@4.2.1 mit Payload', crit: false,
    d: 'Die Version enthält den SILKBELL-Dropper (setup.js) mit zweistufiger Obfuskation: Reverse-Base64 + XOR-Cipher (Schlüssel: OrDeR_7077, Konstante 333). Der postinstall-Hook führt den Dropper automatisch bei npm install aus. C2-Server: sfrclak[.]com:8000/6202033 (Pfad = umgekehrtes Angriffsdatum).',
    tags: ['SILKBELL', 'XOR', 'postinstall'] },
  { ph: 2, t: '31. März', time: '00:21', title: 'axios@1.14.1 als \u00bblatest\u00ab veröffentlicht', crit: true,
    d: 'Die trojanisierte Version enthält eine neue Dependency auf plain-crypto-js@4.2.1. Kein Commit, kein Tag im GitHub-Repository \u2013 direkte CLI-Veröffentlichung mit gestohlenem npm-Token. Keine Provenance-Attestierung vorhanden (Bruch mit dem bisherigen Muster). CI/CD-Pipelines mit Caret-Ranges (^1.x) lösen sofort die neueste Version auf.',
    tags: ['latest', 'Kein OIDC', 'Kein Commit'] },
  { ph: 3, t: '31. März', time: '00:23', title: 'Erste Infektion \u2013 89 Sekunden nach Veröffentlichung', crit: true,
    d: 'Huntress registriert den ersten C2-Kontakt eines infizierten Systems. Automatisierte CI/CD-Pipelines haben die Version bereits aufgelöst, installiert und den postinstall-Hook ausgeführt. Der WAVESHAPER.V2-RAT beacont alle 60 Sekunden zum C2 und überträgt Hostname, OS-Version, Prozessliste und Verzeichnisinhalte.',
    tags: ['WAVESHAPER.V2', 'CI/CD', '60s Beacon'] },
  { ph: 3, t: '31. März', time: '00:27', title: 'Socket.dev-Scanner schlägt Alarm', crit: false,
    d: 'Automatische Erkennung durch Sockets Dependency-Monitoring \u2013 6 Minuten nach Veröffentlichung. Die Warnung wird an die Community weitergeleitet. Weitere Scanner (Snyk, Phylum) folgen innerhalb von Minuten.',
    tags: ['Socket.dev', '6 min', 'Automated'] },
  { ph: 3, t: '31. März', time: '~00:39', title: 'Bitdefender blockiert Ausführung auf Windows', crit: false,
    d: 'Bitdefender Advanced Threat Control erkennt und blockiert den Dropper auf Windows-Systemen \u2013 18 Minuten nach Veröffentlichung. Sophos-Telemetrie registriert ebenfalls Aktivität. Auf macOS und Linux fehlt zu diesem Zeitpunkt weitgehend eine automatische Blockierung.',
    tags: ['Bitdefender', 'Windows', '18 min'] },
  { ph: 2, t: '31. März', time: '~01:00', title: 'axios@0.30.4 als \u00bblegacy\u00ab veröffentlicht', crit: true,
    d: 'Beide aktiven Versionslinien (latest + legacy) sind nun vergiftet. Maximale Reichweite über alle axios-Nutzer. Gleichzeitig löschen die Angreifer Community-Reports über den kompromittierten Maintainer-Account, um die Entdeckung zu verzögern.',
    tags: ['legacy', 'Issue-Löschung', 'Beide Branches'] },
  { ph: 4, t: '31. März', time: '01:38', title: 'Collaborator DigitalBrainJS startet Gegenmaßnahmen', crit: false,
    d: 'Öffnet PR #10591, depreciert die kompromittierten Versionen und kontaktiert npm-Support direkt. Problem: Als Collaborator (nicht Owner) fehlen ihm die Berechtigungen, die Versionen selbst zu entfernen \u2013 kritische Zeit geht verloren.',
    tags: ['PR #10591', 'Deprecation', 'Berechtigungsproblem'] },
  { ph: 4, t: '31. März', time: '01:50', title: 'Elastic Security Labs reicht GitHub Security Advisory ein', crit: false,
    d: 'Elastic veröffentlicht initiale technische Analyse des SILKBELL-Droppers und der WAVESHAPER.V2-RAT-Familie. Detection-Rules für Elastic SIEM und Endpoint werden bereitgestellt. Parallel arbeiten Google GTIG, Unit 42 und Datadog an eigenen Analysen.',
    tags: ['Elastic', 'Advisory', 'Detection Rules'] },
  { ph: 4, t: '31. März', time: '03:15', title: 'Bösartige axios-Versionen von npm entfernt', crit: true,
    d: '2 Stunden 54 Minuten nach der ersten Veröffentlichung werden 1.14.1 und 0.30.4 aus der npm-Registry entfernt. In diesem Zeitfenster wurden schätzungsweise 600.000 Downloads registriert. Wiz stellt später fest, dass ~3% der gescannten Cloud-Umgebungen die Versionen tatsächlich ausgeführt haben.',
    tags: ['Entfernung', '~600k Downloads', '3% ausgeführt'] },
  { ph: 4, t: '31. März', time: '03:29', title: 'plain-crypto-js von npm entfernt', crit: false,
    d: 'Das Trägerpaket mit dem eigentlichen Schadcode wird 14 Minuten nach den axios-Versionen ebenfalls aus der Registry genommen. Der C2-Server sfrclak[.]com bleibt zu diesem Zeitpunkt noch erreichbar.',
    tags: ['plain-crypto-js', 'C2 aktiv'] },
  { ph: 4, t: '1. April', time: '', title: 'Attribution: Google \u2192 UNC1069, Microsoft \u2192 Sapphire Sleet', crit: false,
    d: 'Google GTIG ordnet den Angriff formal der nordkoreanischen Gruppe UNC1069 zu (BlueNoroff/Lazarus-Untergr.). Belege: Debug-Pfad \u00bbJain_DEV/client_mac/macWebT\u00ab verknüpft mit RustBucket-Kampagne 2023, WAVESHAPER-Backdoor-Familie, AstrillVPN-Knoten, C2-Infrastrukturüberlappungen. Microsoft attribuiert parallel zu \u00bbSapphire Sleet\u00ab.',
    tags: ['UNC1069', 'Nordkorea', 'BlueNoroff'] },
  { ph: 4, t: '3. April', time: '', title: 'Offizielles Post-Mortem (GitHub Issue #10636)', crit: false,
    d: 'Jason Saayman veröffentlicht das Post-Mortem und bestätigt den Social-Engineering-Angriff. Beschreibt den gefälschten Slack-Workspace, das Teams-Meeting und den ClickFix-Angriff. Auf seinem Rechner werden zusätzliche Malware-Familien identifiziert: CosmicDoor (Nim-Backdoor), SilentSiphon (Credential-Stealer für npm/GitHub/AWS), sowie HYPERCALL, SUGARLOADER und weitere Module.',
    tags: ['Post-Mortem', 'SilentSiphon', 'CosmicDoor'] },
]

const grouped = computed(() => {
  const groups = []
  let currentDay = ''
  for (let i = 0; i < events.length; i++) {
    const e = events[i]
    if (e.t !== currentDay) {
      currentDay = e.t
      groups.push({ type: 'sep', day: e.t })
    }
    groups.push({ type: 'event', index: i, event: e })
  }
  return groups
})

const phaseLabels = { 1: 'Social Engineering', 2: 'Angriff / Payload', 3: 'Erkennung', 4: 'Reaktion' }

const stats = [
  { num: '89 s', label: 'Bis erste Infektion', ph: 2 },
  { num: '~14 d', label: 'Social Engineering', ph: 1 },
  { num: '6 min', label: 'Erste Erkennung', ph: 3 },
  { num: '2h 54min', label: 'Bis npm-Entfernung', ph: 4 },
]
</script>

<template>
  <div class="axios-timeline">
    <div class="hdr">
      <div class="hdr-title">Axios Supply-Chain-Angriff: Zeitleiste</div>
      <div class="hdr-sub">UNC1069 / BlueNoroff — 14. März bis 3. April 2026 (UTC)</div>
    </div>

    <div class="legend">
      <span v-for="(label, ph) in phaseLabels" :key="ph" class="legend-item">
        <span class="dot" :class="'dot-ph' + ph"></span>{{ label }}
      </span>
    </div>

    <div class="track">
      <template v-for="item in grouped" :key="item.type === 'sep' ? 's-' + item.day : 'e-' + item.index">
        <div v-if="item.type === 'sep'" class="sep">
          <span class="sep-line">{{ item.day }}</span>
        </div>
        <div v-else class="evt">
          <div class="marker" :class="['marker-ph' + item.event.ph, { crit: item.event.crit }]"></div>
          <div class="card" :class="{ open: openCards[item.index] }" @click.stop="toggleCard(item.index)">
            <div class="card-top">
              <span v-if="item.event.time" class="ts-label" :class="'ts-ph' + item.event.ph">{{ item.event.time }}</span>
              <span class="card-title">{{ item.event.title }}</span>
              <span class="chevron">&#9654;</span>
            </div>
            <div class="detail">
              <p>{{ item.event.d }}</p>
              <div class="tags">
                <span v-for="tag in item.event.tags" :key="tag" class="tag">{{ tag }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <div class="stats">
      <div v-for="s in stats" :key="s.label" class="stat">
        <span class="stat-num" :class="'num-ph' + s.ph">{{ s.num }}</span>
        <span class="stat-label">{{ s.label }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.axios-timeline {
  --ph1: #7F77DD; --ph1b: #EEEDFE;
  --ph2: #D85A30; --ph2b: #FAECE7;
  --ph3: #1D9E75; --ph3b: #E1F5EE;
  --ph4: #378ADD; --ph4b: #E6F1FB;
}
:global(.dark) .axios-timeline {
  --ph1: #AFA9EC; --ph1b: #3C3489;
  --ph2: #F0997B; --ph2b: #712B13;
  --ph3: #5DCAA5; --ph3b: #085041;
  --ph4: #85B7EB; --ph4b: #0C447C;
}

.hdr { text-align: center; margin: 0 0 8px; }
.hdr-title { font-size: 18px; font-weight: 600; margin: 0 0 4px; }
.hdr-sub { font-size: 13px; color: var(--color-text-secondary); }

.legend { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; margin: 12px 0 20px; font-size: 12px; color: var(--color-text-secondary); }
.legend-item { display: flex; align-items: center; gap: 5px; }
.dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.dot-ph1 { background: var(--ph1); }
.dot-ph2 { background: var(--ph2); }
.dot-ph3 { background: var(--ph3); }
.dot-ph4 { background: var(--ph4); }

.track { position: relative; padding-left: 28px; }
.track::before { content: ''; position: absolute; left: 13px; top: 0; bottom: 0; width: 1.5px; background: var(--color-border-tertiary); }

.evt { position: relative; margin-bottom: 6px; }
.marker { position: absolute; left: -28px; top: 6px; width: 12px; height: 12px; border-radius: 50%; border: 2px solid; z-index: 1; }
.marker.crit { width: 16px; height: 16px; left: -30px; top: 4px; }
.marker-ph1 { border-color: var(--ph1); background: var(--ph1b); }
.marker-ph2 { border-color: var(--ph2); background: var(--ph2b); }
.marker-ph3 { border-color: var(--ph3); background: var(--ph3b); }
.marker-ph4 { border-color: var(--ph4); background: var(--ph4b); }

.card { border: 0.5px solid var(--color-border-tertiary); border-radius: var(--border-radius-md); padding: 10px 14px; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
.card:hover { border-color: var(--color-border-secondary); background: var(--color-background-secondary); }
.card.open { background: var(--color-background-secondary); }
.card-top { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.ts-label { font-size: 11px; font-weight: 600; white-space: nowrap; padding: 2px 8px; border-radius: 4px; flex-shrink: 0; }
.ts-ph1 { background: var(--ph1b); color: var(--ph1); }
.ts-ph2 { background: var(--ph2b); color: var(--ph2); }
.ts-ph3 { background: var(--ph3b); color: var(--ph3); }
.ts-ph4 { background: var(--ph4b); color: var(--ph4); }
.card-title { font-size: 14px; font-weight: 600; flex: 1; }
.chevron { font-size: 12px; color: var(--color-text-tertiary); transition: transform 0.2s; flex-shrink: 0; }
.card.open .chevron { transform: rotate(90deg); }
.detail { display: none; margin-top: 8px; font-size: 13px; color: var(--color-text-secondary); line-height: 1.6; border-top: 0.5px solid var(--color-border-tertiary); padding-top: 8px; }
.card.open .detail { display: block; }

.tags { margin-top: 6px; }
.tag { display: inline-block; font-size: 11px; padding: 1px 6px; border-radius: 4px; background: var(--color-background-tertiary); color: var(--color-text-secondary); margin: 2px 2px 0 0; }

.sep { margin: 16px 0 12px; position: relative; }
.sep-line { font-size: 12px; font-weight: 600; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }

.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0 0; }
.stat { background: var(--color-background-secondary); border-radius: var(--border-radius-md); padding: 10px 12px; text-align: center; }
.stat-num { font-size: 20px; font-weight: 600; display: block; }
.stat-label { font-size: 11px; color: var(--color-text-secondary); }
.num-ph1 { color: var(--ph1); }
.num-ph2 { color: var(--ph2); }
.num-ph3 { color: var(--ph3); }
.num-ph4 { color: var(--ph4); }
</style>
