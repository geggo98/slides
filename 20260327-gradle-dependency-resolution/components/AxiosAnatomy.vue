<script setup>
import { reactive } from "vue";

const openTargets = reactive({});
const openBypasses = reactive({});
const openRisks = reactive({});

function toggle(obj, i) {
  obj[i] = !obj[i];
}

const targets = [
  {
    num: "83 Mio.",
    title: "Wöchentliche Downloads",
    sub: "Top-10-Paket im npm-Ökosystem",
    color: "info",
    detail:
      "Axios ist der de-facto-Standard-HTTP-Client für JavaScript \u2013 sowohl im Browser als auch in Node.js. Ein einziges kompromittiertes Paket erreicht damit Frontend-Apps, Backend-Services, CLI-Tools und CI/CD-Pipelines gleichzeitig. Der Multiplikatoreffekt ist enorm.",
  },
  {
    num: "174.000+",
    title: "Direkte Abhängigkeiten",
    sub: "Transitiver Blast Radius",
    color: "info",
    detail:
      "Jedes dieser 174.000 Pakete zieht axios als Dependency \u2013 und jedes Projekt, das eines dieser Pakete nutzt, ist indirekt betroffen. Wiz fand axios in ~80% aller gescannten Cloud-Umgebungen. Der transitive Abhängigkeitsbaum macht die wahre Reichweite praktisch unberechenbar.",
  },
  {
    num: "1",
    title: "Primärer Maintainer",
    sub: "Single Point of Failure",
    color: "warning",
    detail:
      "Das Paket wurde primär von einer einzigen Person mit persönlichen npm-Credentials verwaltet. Kein Mehraugenprinzip für Releases, keine organisatorische Absicherung. Ein einziger kompromittierter Rechner = vollständige Kontrolle über die gesamte Distributionskette.",
  },
  {
    num: "$0",
    title: "Sicherheitsbudget",
    sub: "Ehrenamtlich gewartet",
    color: "danger",
    detail:
      "Trotz Nutzung durch Fortune-500-Unternehmen, Behörden und kritische Infrastruktur existiert kein Sicherheitsbudget, kein dediziertes Security-Team, kein Incident-Response-Plan. Die gesamte Software-Supply-Chain hängt am guten Willen \u2013 und der persönlichen OPSEC \u2013 eines Einzelnen.",
  },
];

const bypasses = [
  {
    icon: "2FA",
    name: "Zwei-Faktor-Authentifizierung (TOTP)",
    verdict: "Wirkungslos",
    type: "fail",
    detail:
      "Saayman hatte 2FA auf seinem npm-Account aktiviert. Da die Angreifer jedoch seinen gesamten Rechner kontrollierten, konnten sie software-basierte TOTP-Codes direkt abgreifen oder die authentifizierte npm-Session nutzen. Feross Aboukhadijeh (Socket.dev): \u00ab2FA doesn\u2019t matter. Game over.\u00bb Was hätte geholfen: Hardware-Security-Keys (FIDO2/WebAuthn) hätten den Account-Takeover potenziell verhindert, da sie physische Präsenz erfordern und nicht remote abgreifbar sind.",
  },
  {
    icon: "CI",
    name: "OIDC Trusted Publishing / SLSA Provenance",
    verdict: "Umgangen",
    type: "bypass",
    detail:
      "Axios nutzte GitHub Actions mit OIDC-basierter Veröffentlichung und SLSA-Attestierungen. Die Angreifer umgingen dies vollständig: Sie publizierten direkt über die npm-CLI mit einem langlebigen klassischen npm-Access-Token. Die kompromittierten Versionen hatten keinerlei Provenance-Attestierungen. Kernproblem: npm erzwingt Provenance nicht.",
  },
  {
    icon: "CR",
    name: "Code-Review / GitHub-Workflow",
    verdict: "Wirkungslos",
    type: "fail",
    detail:
      "Es wurde nie ein Commit oder Tag im GitHub-Repository erstellt. Die einzige Änderung war die package.json \u2013 und die wurde direkt über npm CLI veröffentlicht, ohne den Repository-Workflow zu durchlaufen. Kein Pull Request, kein Review, kein CI-Lauf. Kernproblem: npm-Pakete müssen nicht aus einem Repository stammen.",
  },
  {
    icon: "SC",
    name: "Automatisierte Scanner / Neuheits-Flags",
    verdict: "Umgangen",
    type: "bypass",
    detail:
      "Das Pre-Staging der sauberen plain-crypto-js@4.2.0 (18 Stunden vorher) reduzierte die Neuheits-Flags. Die zweistufige Obfuskation (Reverse-Base64 + XOR) umging statische Mustererkennung. Dennoch: Socket.dev erkannte die Bedrohung in 6 Minuten \u2013 die Erkennung funktionierte, aber die Reaktionskette war zu langsam.",
  },
  {
    icon: "P",
    name: "npm-Berechtigungsmodell / Notfall-Depublizierung",
    verdict: "Versagt",
    type: "fail",
    detail:
      "Der kompromittierte Account besaß als Owner die höchsten Berechtigungen. Collaborator DigitalBrainJS konnte die kompromittierten Versionen nicht selbst entfernen und musste den Umweg über den npm-Support nehmen. Zusätzlich nutzten die Angreifer den Account aktiv, um gemeldete Issues zu löschen.",
  },
  {
    icon: "EP",
    name: "Endpoint-Protection (EDR/AV)",
    verdict: "Teilweise wirksam",
    type: "partial",
    detail:
      "Bitdefender ATC blockierte den Dropper auf Windows nach 18 Minuten, Sophos reagierte ähnlich schnell. Aber: Diese Schutzschicht greift nur auf Endgeräten mit installiertem EDR \u2013 CI/CD-Runner, Docker-Container und headless Build-Server haben typischerweise keinen Endpoint-Schutz.",
  },
];

const bars = [
  {
    label: "Axios-Präsenz in Cloud-Umgebungen",
    value: 80,
    color: "var(--ph1)",
  },
  { label: "npm-Pakete mit nur 1 Maintainer", value: 68, color: "var(--ph2)" },
  {
    label: "npm-Accounts ohne 2FA",
    value: 55,
    color: "var(--color-text-danger)",
  },
  {
    label: "Pakete mit Provenance-Attestierung",
    value: 12,
    color: "var(--ph3)",
  },
];

const risks = [
  {
    title: "Asymmetrie: Aufwand vs. Reichweite",
    sub: "Ein Maintainer \u2192 Millionen Systeme",
    detail:
      "Ein einzelner Social-Engineering-Angriff auf eine Person gab den Angreifern Zugang zu ~600.000 Systemen in unter 3 Stunden. Nordkorea optimiert explizit auf diesen Multiplikatoreffekt: weg von direkten Krypto-Diebstählen (1:1) hin zur Kompromittierung von Infrastruktur (1:N).",
  },
  {
    title: "Maintainer als hochwertige Ziele",
    sub: "Kein Schutz, maximale Verantwortung",
    detail:
      "Open-Source-Maintainer sind öffentlich identifizierbar (GitHub-Profile, Konferenzvorträge), arbeiten oft allein, haben keinen CISO, kein SOC, kein Sicherheitsbudget \u2013 und kontrollieren trotzdem Zugang zu Millionen von Systemen. Socket dokumentierte 6+ parallele Angriffe auf Maintainer von Lodash, Fastify, dotenv, Mocha und weitere.",
  },
  {
    title: "Vertrauensmodell ist kaputt",
    sub: "npm vertraut dem Publisher, nicht dem Code",
    detail:
      "Das npm-Sicherheitsmodell basiert auf der Annahme, dass der Account-Inhaber vertrauenswürdig ist. Sobald diese Annahme fällt \u2013 durch Social Engineering, Malware oder Token-Diebstahl \u2013 gibt es keine zweite Verteidigungslinie. Provenance-Attestierungen existieren, werden aber nicht erzwungen.",
  },
  {
    title: "Kaskaden-Risiko durch Credential-Diebstahl",
    sub: "Der Angriff nach dem Angriff",
    detail:
      "SilentSiphon auf Saaymanns Rechner exfiltrierte Credentials von npm, GitHub, GitLab, AWS, Browsern und Passwort-Managern. Mandiant-CTO Carmakal warnte: Diese gestohlenen Secrets ermöglichen weitere Supply-Chain-Angriffe über Wochen und Monate. Der Axios-Hack ist nicht das Ende, sondern der Anfang einer Angriffskette.",
  },
  {
    title: "Caret-Ranges als Brandbeschleuniger",
    sub: "^1.x = automatisches Vertrauen in jedes Update",
    detail:
      "Die meisten package.json-Einträge nutzen Caret-Ranges (^1.7.2 = akzeptiere alles bis <2.0.0). Bei npm install wird automatisch die neueste kompatible Version aufgelöst \u2013 ohne Review, ohne Wartezeit. Die erste Infektion erfolgte 89 Sekunden nach Veröffentlichung. Arctic Wolf nennt npm config set min-release-age 3 (72-Stunden-Quarantäne) als Minimum; dieser Talk empfiehlt 7 Tage als konservativere Default-Schwelle.",
  },
  {
    title: "Staatliche Akteure vs. Ehrenamtliche",
    sub: "Professionelle Angreifer, amateurhafte Verteidigung",
    detail:
      "UNC1069/BlueNoroff ist eine staatlich finanzierte Einheit mit professionellem OPSEC, dedizierter Infrastruktur und langfristiger strategischer Planung. Die Verteidigung liegt bei einzelnen Personen, die Open-Source-Projekte in ihrer Freizeit warten. Nordkoreanische Akteure stahlen allein 2025 über 2 Milliarden Dollar in Kryptowährungen.",
  },
];
</script>

<template>
  <div class="axios-anatomy">
    <!-- Section 1: Warum gerade axios? -->
    <div class="sec">
      <div class="sec-title">
        <span class="sec-num num-1">1</span>
        Warum gerade axios?
      </div>
      <div class="target-grid">
        <div
          v-for="(t, i) in targets"
          :key="i"
          class="t-card"
          :class="{ open: openTargets[i] }"
          @click.stop="toggle(openTargets, i)"
        >
          <div class="t-num" :class="'text-' + t.color">{{ t.num }}</div>
          <div class="t-title">{{ t.title }}</div>
          <div class="t-sub">{{ t.sub }}</div>
          <div class="t-detail">{{ t.detail }}</div>
        </div>
      </div>
      <div class="quote">
        Historisch zielten diese Akteure auf Krypto-Gründer und VCs. Die
        Evolution hin zu Open-Source-Maintainern ist besorgniserregend, weil sie
        damit Millionen nachgelagerter Nutzer kompromittieren können.
        <div class="attr">Taylor Monahan, Sicherheitsforscherin</div>
      </div>
    </div>

    <!-- Section 2: Umgangene Schutzmechanismen -->
    <div class="sec">
      <div class="sec-title">
        <span class="sec-num num-2">2</span>
        Umgangene Schutzmechanismen
      </div>
      <div class="chain">
        <span class="chain-node cn1">Rechner kompromittiert</span>
        <span class="chain-arr">&rarr;</span>
        <span class="chain-node cn1">Tokens/TOTP gestohlen</span>
        <span class="chain-arr">&rarr;</span>
        <span class="chain-node cn2">npm-Publish via CLI</span>
        <span class="chain-arr">&rarr;</span>
        <span class="chain-node cn3">600k Downloads</span>
      </div>
      <div class="bypass-list">
        <div
          v-for="(b, i) in bypasses"
          :key="i"
          class="bp"
          :class="['v-' + b.type, { open: openBypasses[i] }]"
          @click.stop="toggle(openBypasses, i)"
        >
          <div class="bp-top">
            <div class="bp-icon">{{ b.icon }}</div>
            <div class="bp-mid">
              <div class="bp-name">{{ b.name }}</div>
            </div>
            <span class="bp-verdict">{{ b.verdict }}</span>
            <span class="chv">&#9654;</span>
          </div>
          <div class="bp-detail">{{ b.detail }}</div>
        </div>
      </div>
    </div>

    <!-- Section 3: Systemisches Risiko -->
    <div class="sec">
      <div class="sec-title">
        <span class="sec-num num-3">3</span>
        Systemisches Risiko: Open Source als Angriffsfläche
      </div>
      <div class="bar-vis">
        <div v-for="b in bars" :key="b.label" class="bar-row">
          <span class="bar-label">{{ b.label }}</span>
          <div class="bar-track">
            <div
              class="bar-fill"
              :style="{ width: b.value + '%', background: b.color }"
            ></div>
            <span class="bar-val">~{{ b.value }}%</span>
          </div>
        </div>
      </div>
      <div class="risk-cols">
        <div
          v-for="(r, i) in risks"
          :key="i"
          class="r-card"
          :class="{ open: openRisks[i] }"
          @click.stop="toggle(openRisks, i)"
        >
          <div class="r-title">
            {{ r.title }}<span class="chv">&#9654;</span>
          </div>
          <div class="r-sub">{{ r.sub }}</div>
          <div class="r-detail">{{ r.detail }}</div>
        </div>
      </div>
      <div class="quote" style="margin-top: 18px">
        Der Axios-Angriff sollte als Template verstanden werden, nicht als
        einmaliges Ereignis.
        <div class="attr">Tomislav Peričin, ReversingLabs</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.axios-anatomy {
  --ph1: #7f77dd;
  --ph1b: #eeedfe;
  --ph2: #d85a30;
  --ph2b: #faece7;
  --ph3: #1d9e75;
  --ph3b: #e1f5ee;
  --c1: #534ab7;
  --c1b: #eeedfe;
  --c2: #d85a30;
  --c2b: #faece7;
  --c3: #a32d2d;
  --c3b: #fcebeb;
}
:global(.dark) .axios-anatomy {
  --ph1: #afa9ec;
  --ph1b: #3c3489;
  --ph2: #f0997b;
  --ph2b: #712b13;
  --ph3: #5dcaa5;
  --ph3b: #085041;
  --c1: #afa9ec;
  --c1b: #3c3489;
  --c2: #f0997b;
  --c2b: #712b13;
  --c3: #f09595;
  --c3b: #501313;
}

.sec {
  margin: 0 0 28px;
}
.sec-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.sec-num {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}
.num-1 {
  background: var(--c1b);
  color: var(--c1);
}
.num-2 {
  background: var(--color-background-danger);
  color: var(--color-text-danger);
}
.num-3 {
  background: var(--color-background-warning);
  color: var(--color-text-warning);
}

/* Target cards */
.target-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}
.t-card {
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: var(--border-radius-lg);
  padding: 14px 16px;
  cursor: pointer;
  transition:
    border-color 0.15s,
    background 0.15s;
}
.t-card:hover {
  border-color: var(--color-border-secondary);
  background: var(--color-background-secondary);
}
.t-card.open {
  background: var(--color-background-secondary);
}
.t-num {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 2px;
}
.t-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 2px;
}
.t-sub {
  font-size: 12px;
  color: var(--color-text-secondary);
}
.t-detail {
  display: none;
  margin-top: 10px;
  font-size: 13px;
  color: var(--color-text-secondary);
  border-top: 0.5px solid var(--color-border-tertiary);
  padding-top: 8px;
  line-height: 1.55;
}
.t-card.open .t-detail {
  display: block;
}
.text-info {
  color: var(--color-text-info);
}
.text-warning {
  color: var(--color-text-warning);
}
.text-danger {
  color: var(--color-text-danger);
}

/* Quote */
.quote {
  border-left: 3px solid var(--color-border-secondary);
  padding: 8px 14px;
  margin: 14px 0 0;
  font-size: 13px;
  font-style: italic;
  color: var(--color-text-secondary);
  line-height: 1.55;
}
.attr {
  font-style: normal;
  font-weight: 600;
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

/* Chain */
.chain {
  display: flex;
  align-items: center;
  gap: 0;
  margin: 14px 0;
  flex-wrap: wrap;
  justify-content: center;
}
.chain-node {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.chain-arr {
  color: var(--color-text-tertiary);
  font-size: 14px;
  padding: 0 2px;
}
.cn1 {
  background: var(--c1b);
  color: var(--c1);
}
.cn2 {
  background: var(--c2b);
  color: var(--c2);
}
.cn3 {
  background: var(--c3b);
  color: var(--c3);
}

/* Bypass list */
.bypass-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.bp {
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: var(--border-radius-lg);
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.15s;
}
.bp:hover {
  border-color: var(--color-border-secondary);
}
.bp.open {
  background: var(--color-background-secondary);
}
.bp-top {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
}
.bp-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}
.bp-mid {
  flex: 1;
}
.bp-name {
  font-size: 14px;
  font-weight: 600;
}
.bp-verdict {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  flex-shrink: 0;
}
.chv {
  font-size: 11px;
  color: var(--color-text-tertiary);
  transition: transform 0.2s;
  flex-shrink: 0;
}
.bp.open .chv {
  transform: rotate(90deg);
}
.bp-detail {
  display: none;
  padding: 0 16px 14px 64px;
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.6;
}
.bp.open .bp-detail {
  display: block;
}

.v-fail .bp-icon {
  background: var(--color-background-danger);
  color: var(--color-text-danger);
}
.v-fail .bp-verdict {
  background: var(--color-background-danger);
  color: var(--color-text-danger);
}
.v-bypass .bp-icon {
  background: var(--color-background-warning);
  color: var(--color-text-warning);
}
.v-bypass .bp-verdict {
  background: var(--color-background-warning);
  color: var(--color-text-warning);
}
.v-partial .bp-icon {
  background: var(--color-background-success);
  color: var(--color-text-success);
}
.v-partial .bp-verdict {
  background: var(--color-background-success);
  color: var(--color-text-success);
}

/* Bar visualization */
.bar-vis {
  margin: 16px 0 0;
}
.bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px;
}
.bar-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  width: 120px;
  text-align: right;
  flex-shrink: 0;
}
.bar-track {
  flex: 1;
  height: 20px;
  background: var(--color-background-tertiary);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}
.bar-fill {
  height: 100%;
  border-radius: 4px;
}
.bar-val {
  font-size: 11px;
  font-weight: 600;
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-primary);
}

/* Risk cards */
.risk-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 16px;
}
.r-card {
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: var(--border-radius-lg);
  padding: 14px 16px;
  cursor: pointer;
  transition:
    border-color 0.15s,
    background 0.15s;
}
.r-card:hover {
  border-color: var(--color-border-secondary);
  background: var(--color-background-secondary);
}
.r-card.open {
  background: var(--color-background-secondary);
}
.r-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.r-card.open .r-title .chv {
  transform: rotate(90deg);
}
.r-sub {
  font-size: 12px;
  color: var(--color-text-secondary);
}
.r-detail {
  display: none;
  margin-top: 10px;
  font-size: 13px;
  color: var(--color-text-secondary);
  border-top: 0.5px solid var(--color-border-tertiary);
  padding-top: 8px;
  line-height: 1.55;
}
.r-card.open .r-detail {
  display: block;
}
</style>
