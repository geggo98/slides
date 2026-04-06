export interface AttackStep {
  id: string
  phase: string
  title: string
  date: string
  icon: string
  detail: string
  tech: string
  prereq: string
}

export interface ThwartedAttack {
  id: string
  title: string
  icon: string
  impact: string
  detail: string
  reason: string
}

export interface TimelineEvent {
  date: string
  event: string
  type: 'vuln' | 'defense' | 'attack' | 'fail'
}

export interface TrifectaElement {
  label: string
  desc: string
  present: boolean
  extended?: boolean
}

export const STEPS: AttackStep[] = [
  {
    id: 'injection',
    phase: 'INITIAL ACCESS',
    title: 'Prompt Injection via Issue-Titel',
    date: '28. Jan 2026',
    icon: '\u{1F489}',
    detail: 'Ein Angreifer (GitHub-User \u201egtlhub-actions\u201c) erstellt Issue #8904 im cline/cline-Repository. Der Titel enth\u00e4lt eine als Fehlermeldung getarnte Anweisung, die Claude dazu bringt, `npm install github:cline/cline#<commit>` auszuf\u00fchren. Der Commit stammt aus einem Angreifer-Fork und ist \u00fcber GitHubs Fork-Architektur erreichbar \u2014 selbst nach L\u00f6schung des Forks (\u201eDangling Commit\u201c).',
    tech: 'Angriffsvektor: Indirect Prompt Injection\nWorkflow: claude-issue-triage.yml\nSchwachstelle: ${{ github.event.issue.title }} direkt im Prompt interpoliert\nZugang: allowed_non_write_users: "*"',
    prereq: 'Cline hatte am 21. Dez. 2025 den claude-issue-triage.yml Workflow hinzugef\u00fcgt \u2014 mit Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch als zugelassene Tools.',
  },
  {
    id: 'execution',
    phase: 'EXECUTION',
    title: 'KI f\u00fchrt Angreifer-Code aus',
    date: '28. Jan 2026',
    icon: '\u{1F916}',
    detail: 'Claude interpretiert die Injection als legitime Aufgabe und f\u00fchrt `npm install` mit dem Angreifer-Fork aus. Das package.json des Forks enth\u00e4lt ein preinstall-Skript, das eine Remote-Shell-Payload herunterl\u00e4dt und ausf\u00fchrt. In Adnan Khans Tests \u201ef\u00fchrte Claude die Payload in allen Versuchen bereitwillig aus.\u201c',
    tech: 'Ausf\u00fchrungskontext: GitHub Actions Runner (ubuntu-latest)\nBerechtigungen: Vollst\u00e4ndiger Shell-Zugang\nPayload-Delivery: npm preinstall lifecycle hook\nKeine menschliche \u00dcberpr\u00fcfung oder Best\u00e4tigung',
    prereq: 'Der Triage-Bot hatte uneingeschr\u00e4nkten Bash-Zugang \u2014 eine Konfiguration, die OWASP LLM06 (Excessive Agency) in allen drei Dimensionen verletzt: \u00fcberm\u00e4\u00dfige Funktionalit\u00e4t, Berechtigungen und Autonomie.',
  },
  {
    id: 'cache',
    phase: 'PERSISTENCE',
    title: 'Cache Poisoning via Cacheract',
    date: '28. Jan \u2013 Feb 2026',
    icon: '\u{1F9EA}',
    detail: 'Das preinstall-Skript setzt Cacheract ein \u2014 ein Open-Source-Tool f\u00fcr GitHub Actions Cache Poisoning. Der Angriff flutet den Cache mit >10 GB Junk-Daten, was GitHubs LRU-Eviction-Policy zwingt, legitime Eintr\u00e4ge zu verdr\u00e4ngen. An deren Stelle treten vergiftete Eintr\u00e4ge, deren Schl\u00fcssel exakt den Cache-Keys des Nightly-Release-Workflows entsprechen.',
    tech: 'Tool: Cacheract (von Adnan Khan entwickelt)\nMechanismus: LRU Cache Eviction Flooding\nZiel: actions/cache Eintr\u00e4ge des Default-Branches\nVolumen: >10 GB Junk-Daten zum Verdr\u00e4ngen',
    prereq: 'GitHub Actions Caches sind branch-\u00fcbergreifend les- und schreibbar f\u00fcr alle Workflows auf dem Default-Branch. Es gibt keine Zugriffskontrolle zwischen Workflows.',
  },
  {
    id: 'credential',
    phase: 'CREDENTIAL ACCESS',
    title: 'Secrets aus Nightly-Workflow exfiltriert',
    date: '~ Feb 2026',
    icon: '\u{1F511}',
    detail: 'Clines n\u00e4chtlicher Publish-Workflow (publish-nightly.yml, ~2:00 UTC) restauriert den kompromittierten Cache. Beim Ausf\u00fchren der vergifteten actions/checkout Post-Step-Phase exfiltriert Cacheract drei Geheimnisse: VSCE_PAT (VS Code Marketplace), OVSX_PAT (OpenVSX) und NPM_RELEASE_TOKEN.',
    tech: 'Exfiltrierte Secrets:\n\u2022 VSCE_PAT \u2192 VS Code Marketplace Publish\n\u2022 OVSX_PAT \u2192 OpenVSX Publish\n\u2022 NPM_RELEASE_TOKEN \u2192 npm Registry Publish\n\nKritischer Design-Fehler: Nightly- und Produktions-Releases teilten dieselben Tokens und denselben Publisher (saoudrizwan).',
    prereq: 'Nightly-Credentials = Produktions-Credentials. Keine Trennung zwischen Test- und Release-Infrastruktur.',
  },
  {
    id: 'publish',
    phase: 'IMPACT',
    title: 'cline@2.3.0 ver\u00f6ffentlicht',
    date: '17. Feb 2026, 03:26 PT',
    icon: '\u{1F4E6}',
    detail: 'Der Angreifer nutzt das noch aktive NPM_RELEASE_TOKEN, um cline@2.3.0 \u00fcber den npm-Account \u201eclinebotorg\u201c zu publizieren. Die einzige \u00c4nderung: ein postinstall-Hook, der global OpenClaw installiert \u2014 einen KI-Agenten mit Festplatten-, Browser- und Messaging-Zugang. Die CLI-Binary (dist/cli.mjs) ist byteidentisch mit der legitimen Version 2.2.3.',
    tech: 'Payload im package.json:\n"postinstall": "npm install -g openclaw@latest"\n\nOpenClaw: 200k+ GitHub Stars\nF\u00e4higkeiten: Dateisystem, Browser, WhatsApp, Telegram, Slack, Discord, iMessage\n\nSHA256 der cli.mjs: identisch mit v2.2.3\n\u2192 Kein Malware-Scanner schl\u00e4gt an',
    prereq: 'Zwischen Khans Disclosure (9. Feb) und dem Angriff (17. Feb) scheiterte die Token-Rotation: Das Cline-Team l\u00f6schte versehentlich das falsche Token.',
  },
]

export const THWARTED: ThwartedAttack[] = [
  {
    id: 'vsce',
    title: 'VS Code Extension kompromittieren',
    icon: '\u{1F9E9}',
    impact: '~5 Mio. Installationen',
    detail: 'Der Angreifer besa\u00df zeitweise den VSCE_PAT. Eine kompromittierte Extension h\u00e4tte \u00fcber Auto-Updates Millionen Entwicklermaschinen erreicht. Verhindert durch rechtzeitige Rotation des VSCE_PAT am 9. Februar.',
    reason: 'VSCE_PAT wurde korrekt rotiert',
  },
  {
    id: 'ovsx',
    title: 'OpenVSX Extension kompromittieren',
    icon: '\u{1F310}',
    impact: 'Hunderttausende Nutzer',
    detail: '\u00dcber OpenVSX werden VS-Code-kompatible Editoren (VSCodium, Gitpod, Eclipse Theia) bedient. Verhindert durch Rotation des OVSX_PAT.',
    reason: 'OVSX_PAT wurde korrekt rotiert',
  },
  {
    id: 'backdoor',
    title: 'Persistente Backdoor in Extension',
    icon: '\u{1F6AA}',
    impact: 'Langfristige Kompromittierung',
    detail: 'Eine modifizierte Extension h\u00e4tte MCP-Server-Konfigurationen \u00fcberschreiben, API-Keys exfiltrieren oder beliebigen Code im Kontext des Entwicklers ausf\u00fchren k\u00f6nnen \u2014 mit Zugang zu jedem Projekt, das der Nutzer \u00f6ffnet.',
    reason: 'Extension-Tokens rechtzeitig rotiert',
  },
  {
    id: 'cascade',
    title: 'Kaskaden-Angriff auf Downstream',
    icon: '\u{1F30A}',
    impact: 'Unbekannt \u2014 potenziell tausende Projekte',
    detail: 'OpenClaw auf Entwicklermaschinen h\u00e4tte als Br\u00fcckenkopf f\u00fcr weitere Supply-Chain-Angriffe dienen k\u00f6nnen: Zugang zu .npmrc, .git-credentials, SSH-Keys, Cloud-Provider-Tokens. Jedes Projekt des betroffenen Entwicklers w\u00e4re kompromittierbar.',
    reason: 'Schnelle Erkennung durch StepSecurity (14 Min.) und Socket.dev begrenzte Downloads auf ~4.000',
  },
]

export const TIMELINE: TimelineEvent[] = [
  { date: '21. Dez 2025', event: 'Triage-Workflow hinzugef\u00fcgt', type: 'vuln' },
  { date: '1. Jan 2026', event: 'Khan meldet Schwachstelle', type: 'defense' },
  { date: '28. Jan 2026', event: 'Issue #8904 erstellt', type: 'attack' },
  { date: '9. Feb 2026', event: 'Public Disclosure', type: 'defense' },
  { date: '9.\u201311. Feb', event: 'Token-Rotation (fehlerhaft)', type: 'fail' },
  { date: '17. Feb, 03:26', event: 'cline@2.3.0 publiziert', type: 'attack' },
  { date: '17. Feb, 03:40', event: 'StepSecurity Alarm', type: 'defense' },
  { date: '17. Feb, 11:30', event: 'Paket deprecated', type: 'defense' },
  { date: '24. Feb 2026', event: 'Post-Mortem', type: 'defense' },
]

export const TRIFECTA: TrifectaElement[] = [
  {
    label: 'Private Data',
    desc: 'Actions-Cache mit Zugang zu Build-Artefakten; Nightly-Workflow mit NPM_RELEASE_TOKEN, VSCE_PAT, OVSX_PAT',
    present: true,
  },
  {
    label: 'Untrusted Content',
    desc: 'Issue-Titel von beliebigen GitHub-Nutzern wird unsanitisiert in den Claude-Prompt interpoliert',
    present: true,
  },
  {
    label: 'External Comms',
    desc: 'Bash-Zugang erlaubt npm install, HTTP-Requests, beliebige Code-Ausf\u00fchrung \u2014 weit \u00fcber typische Exfiltration hinaus',
    present: true,
  },
  {
    label: 'Modify Trusted Artifacts',
    desc: 'Cache-Poisoning ver\u00e4ndert Build-Artefakte, gestohlenes Token erm\u00f6glicht npm publish im Namen des Projekts \u2192 Willisons Trifecta greift hier zu kurz',
    present: true,
    extended: true,
  },
]
