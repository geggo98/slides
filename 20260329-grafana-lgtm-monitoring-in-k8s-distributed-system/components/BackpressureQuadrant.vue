<script setup>
/**
 * Back-Pressure als Regelkreise — Magic-Quadrant-Streudiagramm.
 *
 * Zwei Achsen ordnen jeden Back-Pressure-Mechanismus ein und quantifizieren
 * seine Ausprägung *relativ* über die Position:
 *   X (Bremsform):  binär · Bang-Bang  →  proportional
 *   Y (Gedächtnis): zustandsarm · Rate →  zustandsbehaftet · Pegel
 *
 * Y-Leitlinie: zustandsbehaftet ist ein Mechanismus, dessen Auslöser ein
 * gespeicherter Zähler oder Füllstand ist (Puffer, Heap, Lag, Credit- oder
 * Fensterzähler, Token-Bucket, In-Flight-Zahl). Zustandsarm ist er nur, wenn
 * der Auslöser ein Momentanwert ist (Zeit pro Request, CPU-Rate, Erfolgsquote
 * im kurzen Fenster). Je länger das Glättungsfenster, desto höher der Punkt.
 *
 * Jeder der vier Quadranten trägt einen Namen. Der „Metastabile Fehler“ ist
 * kein eigener Punkt, sondern eine Eskalation aus dem Schwellwert-Wehr heraus
 * (super-lineare Rückkopplung = effektiv unendliche Hysterese) und wird als
 * roter Pfeil über die obere-linke Ecke hinaus markiert.
 *
 * In jeder Ecke läuft zusätzlich eine kleine Spur (grau = Last, Farbe =
 * Reaktion), die das typische Verhalten des Quadranten zeigt. Ein Klick auf
 * die Spur (ⓘ) hält alle Spuren an, dimmt die Folie und öffnet einen Dialog
 * mit der vergrößerten Spur und einer Abgrenzung zu den anderen Quadranten;
 * Klick irgendwohin oder Escape schließt und setzt die Animationen fort.
 * Jeder Datenpunkt ist ebenfalls klickbar und öffnet einen Dialog mit
 * Einordnung, Back-Pressure-Hinweis und Link auf die Original-Doku.
 */
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { onSlideLeave, useDarkMode } from "@slidev/client";

const { isDark } = useDarkMode();

// Quadranten-Akzentfarben (heller im Dark-Mode für Kontrast auf dunklem Grund).
const QUAD_COLORS = {
  wehr: { dark: "#fb923c", light: "#ea580c" }, // orange
  regler: { dark: "#4ade80", light: "#16a34a" }, // grün
  reflex: { dark: "#c084fc", light: "#9333ea" }, // violett
  daempfer: { dark: "#22d3ee", light: "#0891b2" }, // cyan
};

const cssVars = computed(() => {
  const d = isDark.value;
  const c = (k) => QUAD_COLORS[k][d ? "dark" : "light"];
  return {
    "--bpq-text": d ? "#e2e8f0" : "#1e293b",
    "--bpq-muted": d ? "#94a3b8" : "#64748b",
    "--bpq-dim": d ? "#64748b" : "#94a3b8",
    "--bpq-card": d ? "#0f172a" : "#ffffff",
    "--bpq-line": d ? "rgba(148,163,184,0.28)" : "rgba(100,116,139,0.32)",
    "--bpq-frame": d ? "rgba(148,163,184,0.22)" : "rgba(100,116,139,0.22)",
    "--bpq-danger": d ? "#f87171" : "#dc2626",
    "--bpq-wehr": c("wehr"),
    "--bpq-regler": c("regler"),
    "--bpq-reflex": c("reflex"),
    "--bpq-daempfer": c("daempfer"),
  };
});

// Vier Quadranten: corner steuert die Platzierung des Namens-Chips.
const QUADS = [
  {
    key: "wehr",
    name: "Schwellwert-Wehr",
    sub: "hohe Hysterese · gut vorhersagbar",
    corner: "tl",
  },
  {
    key: "regler",
    name: "Pegel-Regler",
    sub: "vorhersagbar · sanft",
    corner: "tr",
  },
  {
    key: "reflex",
    name: "Stop-and-Go-Reflex",
    sub: "schnell · nur detektierbar",
    corner: "bl",
  },
  {
    key: "daempfer",
    name: "Mitlauf-Dämpfer",
    sub: "selbststabilisierend",
    corner: "br",
  },
];

// Eck-Animationen: je Quadrant eine winzige, endlos scrollende Spur. Grau =
// Last (Zufluss), Quadrantenfarbe = Reaktion. Fläche = Pegel (Gedächtnis),
// Linie = Rate; harte Kanten = binär, glatte Kurve = proportional.
// Alle Folgen sind periodisch mit Periode PERIOD; der Pfad deckt zwei
// Perioden ab und wird per CSS um genau eine verschoben (nahtlose Schleife).
const PERIOD = 64;
const TH = 24; // Spurhöhe
const yOf = (v) => (TH - 1 - v * (TH - 2)).toFixed(1);
const linePath = (vals) =>
  vals.map((v, i) => `${i ? "L" : "M"}${i},${yOf(v)}`).join("");
const areaPath = (vals) =>
  `M0,${TH}${vals.map((v, i) => `L${i},${yOf(v)}`).join("")}L${vals.length - 1},${TH}Z`;
const samples = (f) => Array.from({ length: 2 * PERIOD + 1 }, (_, i) => f(i));
const phase = (i) => i % PERIOD;
const TAU = 2 * Math.PI;

// Wehr: Pegel steigt bis zur Set-Schwelle, Bremse an, fällt bis zur
// Reset-Schwelle (Sägezahn im Hystereseband).
const WEHR = { set: 0.8, reset: 0.3 };
const wehr = {
  level: samples((i) => {
    const p = phase(i);
    return p < 38
      ? WEHR.reset + ((WEHR.set - WEHR.reset) * p) / 38
      : WEHR.set - ((WEHR.set - WEHR.reset) * (p - 38)) / 26;
  }),
  load: samples(() => 0.92),
};

// Regler: Zufluss ∝ Abstand zum Sollwert — Pegel nähert sich exponentiell.
const regler = (() => {
  const load = (p) => (p < 32 ? 0.9 : 0.4);
  const out = [];
  let level = 0.4;
  for (let i = 0; i < 4 * PERIOD + 1; i++) {
    level += (load(phase(i)) - level) * 0.09;
    out.push(level);
  }
  return {
    level: out.slice(2 * PERIOD),
    load: samples((i) => load(phase(i))),
  };
})();

// Reflex: sobald die Last die Grenze reißt, fällt die Rate sofort auf 0 und
// kehrt ebenso sofort zurück — kein Gedächtnis, kein Band.
const REFLEX_LIMIT = 0.68;
const reflexLoad = (i) => {
  const p = phase(i);
  const spike = p >= 20 && p < 28 ? 0.3 : 0;
  return 0.42 + 0.14 * Math.sin((TAU * p) / 16) + spike;
};
const reflex = {
  load: samples(reflexLoad),
  rate: samples((i) => (reflexLoad(i) > REFLEX_LIMIT ? 0.04 : reflexLoad(i))),
};

// Dämpfer: Rate folgt der welligen Last, oberhalb des Knies weich gestaucht.
const daempferLoad = (i) => {
  const p = phase(i);
  return (
    0.55 +
    0.3 * Math.sin((TAU * p) / PERIOD) +
    0.12 * Math.sin((TAU * 3 * p) / PERIOD)
  );
};
const daempfer = {
  load: samples(daempferLoad),
  rate: samples((i) => 0.65 * Math.tanh(daempferLoad(i) / 0.65)),
};

const TRACES = {
  wehr: {
    dur: 5.2,
    fill: areaPath(wehr.level),
    line: linePath(wehr.level),
    load: linePath(wehr.load),
    marks: [WEHR.set, WEHR.reset],
  },
  regler: {
    dur: 6.4,
    fill: areaPath(regler.level),
    line: linePath(regler.level),
    load: linePath(regler.load),
    marks: [0.65],
  },
  reflex: {
    dur: 4.4,
    line: linePath(reflex.rate),
    load: linePath(reflex.load),
    marks: [REFLEX_LIMIT],
  },
  daempfer: {
    dur: 5.8,
    line: linePath(daempfer.rate),
    load: linePath(daempfer.load),
    marks: [],
  },
};

// Mechanismen mit *relativer* Ausprägung auf beiden Achsen (0..1).
// s = Seite des Labels relativ zum Punkt ('r' rechts, 'l' links) — Labels
// wachsen zur Mitte, damit die Plot-Ränder frei bleiben.
// Dialog je Punkt: name (voller Name), what (Was ist es), why (Warum steht
// es hier), watch (Worauf achten) und doc (Original-Doku). Einordnung und
// Belege: geprüft gegen die Primärdoku (Stand 10.10.2026); was nur aus dem
// Quellcode stammt, ist im Text als solches benannt.
const POINTS = [
  // Schwellwert-Wehr — zustandsbehaftet + binär
  {
    l: "OOM-Kill",
    name: "OOM-Kill (cgroup memory.max)",
    x: 0.07,
    y: 0.93,
    q: "wehr",
    s: "r",
    what: "Erreicht ein Container sein Memory-Limit (`memory.max`) und lässt sich nichts mehr freigeben, beendet der Kernel einen Prozess der cgroup.",
    why: "Der Kernel kennt nur laufen oder töten: binär. Auslöser ist der gespeicherte Speicherstand: Pegel. Eine Reset-Schwelle gibt es nicht, der Reset ist ein Neustart mit kaltem Cache. Das ist die härteste Form des Wehrs.",
    watch:
      "Page-Cache zählt zum Limit. `working_set` gegen Limit beobachten (`container_memory_working_set_bytes`), dazu den Grund `OOMKilled` und `restartCount`.",
    doc: "https://docs.kernel.org/admin-guide/cgroup-v2.html#memory-interface-files",
  },
  {
    l: "ZGC-Stall",
    name: "ZGC Allocation Stall",
    x: 0.14,
    y: 0.886,
    q: "wehr",
    s: "r",
    what: "Kann ein Java-Thread nicht allokieren, weil ZGC keinen freien Speicher mehr hat, hält ZGC ihn an, bis Seiten frei sind.",
    why: "Der Thread steht oder läuft: binär. Auslöser ist der freie Heap: Pegel. Eine eigene Reset-Schwelle gibt es nicht, sobald Speicher frei ist, läuft der Thread weiter.",
    watch:
      "Jeder Stall ist ein Alarm, ein gesundes ZGC stallt praktisch nie. JFR-Event `jdk.ZAllocationStall` und GC-Log-Ursache „Allocation Stall“ beobachten, Heap-Headroom oder CPU erhöhen.",
    doc: "https://openjdk.org/jeps/439",
  },
  {
    l: "RabbitMQ-Block",
    name: "RabbitMQ Connection-Blocking",
    x: 0.24,
    y: 0.842,
    q: "wehr",
    s: "r",
    what: "Übersteigt der Speicher den `vm_memory_high_watermark` (Standard 0,6 des RAM) oder fällt der freie Platz unter `disk_free_limit`, blockiert RabbitMQ alle publizierenden Verbindungen.",
    why: "Alles oder nichts: binär. Auslöser ist der Speicherstand: Pegel. Anders als bei Galera gibt es keine eigene Reset-Schwelle, der Alarm endet, sobald der Pegel wieder unter derselben Watermark liegt.",
    watch:
      "Consumer bleiben unblockiert. Clients sollten `connection.blocked` behandeln. `memory.used` gegen die Watermark und den Verbindungsstatus `blocked/blocking` beobachten.",
    doc: "https://www.rabbitmq.com/docs/alarms",
  },
  {
    l: "Netty Watermark",
    name: "Netty isWritable (Write Buffer Water Mark)",
    x: 0.08,
    y: 0.798,
    q: "wehr",
    s: "r",
    what: "`Channel.isWritable()` meldet false, sobald die ausgehenden Bytes die High Water Mark überschreiten, und wieder true, wenn sie unter die Low Water Mark fallen.",
    why: "Das Signal ist ein Schalter: binär. Er hängt am Füllstand der Schreibwarteschlange: Pegel. High und Low Water Mark bilden eine echte Hysterese mit getrennter Set- und Reset-Schwelle.",
    watch:
      "Nur ein Hinweis: Wer `isWritable()` oder `channelWritabilityChanged` ignoriert, puffert weiter bis zum OutOfMemoryError. `bytesBeforeUnwritable()` zeigt den Abstand zur Schwelle.",
    doc: "https://netty.io/4.1/api/io/netty/channel/WriteBufferWaterMark.html",
  },
  {
    l: "Galera-FC",
    name: "Galera Flow Control",
    x: 0.2,
    y: 0.754,
    q: "wehr",
    s: "r",
    what: "Wächst die Receive-Queue eines Nodes über `gcs.fc_limit` (Standard 16), pausiert der Cluster die Replikation (`FC_PAUSE`).",
    why: "Pause oder Weiter: binär. Die Queue-Länge ist ein Pegel. Eine Doppelschwelle entsteht nur, wenn `gcs.fc_factor` kleiner als 1 ist: der Standard 1,0 setzt Pause und Resume auf dieselbe Schwelle.",
    watch:
      "Ein langsamer Node bremst alle. `wsrep_flow_control_paused` (Anteil der Pausenzeit) und `wsrep_flow_control_sent` (welcher Node ist der Verursacher) beobachten.",
    doc: "https://mariadb.com/docs/galera-cluster/reference/wsrep-variable-details/wsrep_provider_options",
  },
  {
    l: "Kafka-Buffer",
    name: "Kafka Producer buffer.memory",
    x: 0.29,
    y: 0.71,
    q: "wehr",
    s: "r",
    what: "Ist der Producer-Puffer `buffer.memory` (Standard 32\u00a0MB) voll, blockiert `send()` bis `max.block.ms` und wirft dann eine Exception.",
    why: "`send()` blockiert oder nicht: binär. Auslöser ist der Füllstand des Puffers: Pegel. Eine Hysterese gibt es nicht, sobald genug Bytes frei sind, geht es weiter.",
    watch:
      "`send()` blockiert den aufrufenden Thread, in einem Event-Loop also das ganze Programm. Producer-Metriken `buffer-available-bytes` und `buffer-exhausted-rate` beobachten.",
    doc: "https://kafka.apache.org/40/generated/producer_config.html#producerconfigs_buffer.memory",
  },
  {
    l: "TCP Zero-Window",
    name: "TCP Zero-Window",
    x: 0.07,
    y: 0.666,
    q: "wehr",
    s: "r",
    what: "Ist der Empfangspuffer voll, meldet der Empfänger Window 0. Der Sender stoppt und fragt in Abständen mit Zero-Window-Probes nach.",
    why: "Window 0 ist ein harter Stopp: binär. Das Fenster ist der freie Pufferplatz: Pegel. Die Silly-Window-Vermeidung (RFC 9293) öffnet es erst wieder, wenn ein größerer Block frei ist, das wirkt wie ein Reset-Band.",
    watch:
      "Die Probes folgen mit wachsendem Abstand, ein Stillstand kann die Ursache überdauern. Im Mitschnitt zeigt der Wireshark-Filter `tcp.analysis.zero_window` die Fälle.",
    doc: "https://www.rfc-editor.org/rfc/rfc9293.html#section-3.8.6.1",
  },
  {
    l: "HTTP/2",
    name: "HTTP/2 Flow Control",
    x: 0.22,
    y: 0.622,
    q: "wehr",
    s: "r",
    what: "HTTP/2 begrenzt die gesendeten Daten pro Stream und pro Verbindung durch ein Credit-Fenster, das der Empfänger mit `WINDOW_UPDATE` auffüllt.",
    why: "RFC 9113 nennt es „credit-based“: Ist das Fenster verbraucht, darf der Sender nichts mehr schicken (binär), der Restkredit ist ein gespeicherter Zähler (Pegel). Proportional wäre nur eine Implementierung, die ihr Fenster adaptiv anpasst. Das Protokoll schreibt es nicht vor.",
    watch:
      "Das Standardfenster von 65.535\u00a0Byte begrenzt den Durchsatz auf Fenster/RTT. Das Verbindungsfenster kann alle Streams gleichzeitig aushungern.",
    doc: "https://www.rfc-editor.org/rfc/rfc9113.html#section-5.2.1",
  },
  {
    l: "RabbitMQ credit_flow",
    name: "RabbitMQ credit_flow",
    x: 0.12,
    y: 0.578,
    q: "wehr",
    s: "r",
    what: "Zwischen den Erlang-Prozessen reader → channel → queue → `msg_store` gewährt jeder Prozess dem Vorgänger Credits: 200 am Anfang, 50 weitere nach je 50 verarbeiteten Nachrichten.",
    why: "Sind die Credits verbraucht, blockt der Prozess: binär. Die Credits sind ein Zähler, also ein Pegel mit kleinem Reset-Band (+50), nur im Millisekundenbereich. Darum liegt der Punkt am unteren Rand des Wehrs.",
    watch:
      "Die Bremse wirkt stromaufwärts: Ein langsamer Message-Store kann den Reader blockieren, Publisher werden ohne Alarm langsamer. Der Verbindungsstatus „flow“ in der Management-UI zeigt es.",
    doc: "https://www.rabbitmq.com/blog/2015/10/06/new-credit-flow-settings-on-rabbitmq-3-5-5",
  },
  {
    l: "Reactive Streams",
    name: "Reactive Streams request(n)",
    x: 0.24,
    y: 0.534,
    q: "wehr",
    s: "r",
    what: "Ein Publisher darf nur so viele Elemente senden, wie der Subscriber per `request(n)` angefordert hat.",
    why: "Der offene Bedarf ist ein Zähler: Pegel. Bei 0 herrscht harter Stopp (Regel 1.1): binär. Wie viel angefordert wird, regelt die Spezifikation nicht. Proportional wird es erst durch eine Operator-Strategie wie `limitRate`.",
    watch:
      "`request(Long.MAX_VALUE)` gilt als „effectively unbounded“ und schaltet Back-Pressure ab (Regel 3.17). Prefetch-Puffer in Operatoren verstecken Warteschlangen.",
    doc: "https://github.com/reactive-streams/reactive-streams-jvm/blob/v1.0.4/README.md#1.1",
  },
  // Pegel-Regler — zustandsbehaftet + proportional
  {
    l: "InnoDB-Checkpoint",
    name: "InnoDB Adaptive Flushing / Checkpoint",
    x: 0.78,
    y: 0.92,
    q: "regler",
    s: "l",
    what: "InnoDB schreibt veränderte Seiten (Dirty Pages) schneller zurück, je weiter der Checkpoint hinter dem Redo-Log-Kopf liegt (Adaptive Flushing).",
    why: "Die Flush-Rate wächst mit der Checkpoint-Age: proportional und pegelbasiert. Das letzte Stück ist hart: Füllt sich das Redo-Log, folgt ein Sharp Checkpoint mit Durchsatzeinbruch. Darum liegt der Punkt rechts, aber nicht am Rand.",
    watch:
      "`Innodb_checkpoint_age` gegen die Redo-Kapazität und den Dirty-Page-Anteil gegen `innodb_max_dirty_pages_pct_lwm` (Standard 10\u00a0%) beobachten. Die Stufen Async 7/8 und Sync 15/16 nennt das MySQL-Handbuch nicht.",
    doc: "https://dev.mysql.com/doc/refman/8.4/en/innodb-buffer-pool-flushing.html",
  },
  {
    l: "cgroup memory.high",
    name: "cgroup v2 memory.high",
    x: 0.9,
    y: 0.86,
    q: "regler",
    s: "l",
    what: "Weiche Speichergrenze der cgroup v2: Darüber werden die Prozesse gedrosselt und unter Reclaim-Druck gesetzt, der OOM-Killer läuft nicht.",
    why: "Auslöser ist der Speicherstand: Pegel. Die Bremse wirkt gestuft statt hart: proportional. Dass die Verzögerung mit der Überschreitung wächst, ist aus dem Kernel-Code abgeleitet, das Handbuch beschreibt nur Drosselung und Reclaim-Druck.",
    watch:
      "Unter extremen Bedingungen kann die Grenze überschritten werden. `memory.pressure` (PSI) beobachten und `memory.max` als harten Backstop setzen.",
    doc: "https://docs.kernel.org/admin-guide/cgroup-v2.html#memory-interface-files",
  },
  {
    l: "CockroachDB",
    name: "CockroachDB Admission Control",
    x: 0.7,
    y: 0.8,
    q: "regler",
    s: "l",
    what: "Admission Control vergibt Schreib-Tokens je Store anhand der Gesundheit des LSM-Baums (L0). Arbeit ohne Token wartet in einer Prioritätswarteschlange.",
    why: "Die Token-Menge sinkt stufenlos mit wachsendem L0-Druck: proportional. Die Eingangsgröße (L0-Sublevels, IO-Overload-Score) ist ein Füllstand: Pegel.",
    watch:
      "Ein Overload-Score über 1,0 deutet auf Überlast. `admission.granter.io_tokens_exhausted_duration.kv` und das IO-Overload-Diagramm beobachten. Sind viele Nodes betroffen, ist der Cluster zu klein.",
    doc: "https://www.cockroachlabs.com/docs/stable/admission-control",
  },
  {
    l: "MongoDB-FC",
    name: "MongoDB Flow Control",
    x: 0.7,
    y: 0.68,
    q: "regler",
    s: "l",
    what: "Flow Control begrenzt auf dem Primary die Schreibrate über Tickets, damit der Majority-Commit-Lag unter `flowControlTargetLagSeconds` (Standard 10) bleibt.",
    why: "Je näher der Lag dem Ziel kommt, desto weniger Tickets pro Sekunde: proportional. Der Lag ist ein aufgelaufener Wert: Pegel.",
    watch:
      "Bei PSA (Primary-Secondary-Arbiter: zwei Datenknoten plus ein Arbiter, der nur abstimmt und keine Daten hält) kann der Majority-Commit-Punkt nicht mehr vorrücken, sobald der Secondary ausfällt. Der Lag wächst dann ohne Lastproblem, und Flow Control drosselt den Primary unnötig. `flowControl.isLagged` und `timeAcquiringMicros` beobachten.",
    doc: "https://www.mongodb.com/docs/manual/replication/#replication-lag-and-flow-control",
  },
  {
    l: "Shenandoah ≤ JDK 25",
    name: "Shenandoah Pacing (bis JDK 25)",
    x: 0.86,
    y: 0.74,
    q: "regler",
    s: "l",
    what: "Der Pacer lässt allokierende Threads bis zu `ShenandoahPacingMaxDelay` (10\u00a0ms) warten, wenn ihr Allokationsbudget im laufenden GC-Zyklus aufgebraucht ist.",
    why: "Das Budget ergibt sich aus Heap-Ständen (Live-Daten und Belegung, laut JDK-21-Quellcode): Pegel. Die Wartezeit wächst stufenlos: proportional. Der Deckel liegt bei 10\u00a0ms, Set- und Reset-Schwellen gibt es nicht.",
    watch:
      "Pacing erscheint nur im GC-Log, nicht als JFR-Event. Das Verfahren wurde mit JDK-8350050 für JDK 26 entfernt, die verlinkte Seite ist das Ticket.",
    doc: "https://bugs.openjdk.org/browse/JDK-8350050",
  },
  {
    l: "Go GC-assist",
    name: "Go GC Mutator Assist",
    x: 0.88,
    y: 0.62,
    q: "regler",
    s: "l",
    what: "Während der Mark-Phase müssen allokierende Goroutinen Scan-Arbeit im Verhältnis zu ihrer Allokation leisten (Mutator Assist).",
    why: "Die Assist-Arbeit pro Byte ergibt sich laut Quellcode (`mgcpacer.go`) aus dem Restabstand zum Heap-Ziel: Scan-Rest geteilt durch Heap-Rest. Stufenlos und pegelbasiert: Regler.",
    watch:
      "Die Kosten landen als Latenz bei der Goroutine, die gerade allokiert. `GODEBUG=gcpacertrace=1` zeigt den Pacer.",
    doc: "https://go.dev/doc/gc-guide#Latency",
  },
  // Stop-and-Go-Reflex — zustandsarm + binär
  {
    l: "gRPC-Deadline",
    name: "gRPC Deadline",
    x: 0.07,
    y: 0.16,
    q: "reflex",
    s: "r",
    what: "Jeder Aufruf trägt eine Deadline. Ist sie verstrichen, bricht der Client mit `DEADLINE_EXCEEDED` ab und der Server beendet die Arbeit (`CANCELLED`).",
    why: "Auslöser ist die Laufzeit dieses einen Aufrufs gegen eine Uhr, ohne Systemfüllstand und ohne Verlauf: zustandsarm. Der Abbruch ist alles oder nichts: binär.",
    watch:
      "Die Deadline spart Arbeit, auf die niemand mehr wartet, und misst keine Überlast. Zu knapp gesetzt, sieht jede Verzögerung wie Überlast aus. Metrik: `grpc_server_handled_total` mit `grpc_code=DeadlineExceeded`.",
    doc: "https://grpc.io/docs/guides/deadlines/",
  },
  {
    l: "Readiness-Probe",
    name: "Kubernetes Readiness-Probe",
    x: 0.22,
    y: 0.24,
    q: "reflex",
    s: "r",
    what: "Schlägt der Readiness-Check `failureThreshold`-mal in Folge fehl (Standard 3), nimmt Kubernetes den Pod aus den Service-Endpoints. Es kommt kein Traffic mehr an.",
    why: "Der Pod ist im Verkehr oder draußen: binär. Auslöser sind die letzten Probe-Ergebnisse, kein Füllstand: zustandsarm. Der Zähler der Fehlschläge ist ein kleines Gedächtnis. Mit `failureThreshold` 1 wäre es ein reiner Reflex.",
    watch:
      "Der Traffic wandert auf die übrigen Pods. Sind auch sie fast voll, kippen sie nacheinander (Kaskade). `kube_pod_status_ready` mit `condition=false` beobachten.",
    doc: "https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/",
  },
  {
    l: "Envoy CPU-Schwelle",
    name: "Envoy Overload Manager (threshold)",
    x: 0.09,
    y: 0.32,
    q: "reflex",
    s: "r",
    what: "Der Overload Manager beantwortet neue Requests sofort mit 503, solange der CPU-Druck über dem Schwellwert liegt (Aktion `stop_accepting_requests`).",
    why: "Der Trigger `threshold` kennt nur 1 über der Schwelle und 0 darunter, ohne Reset-Schwelle: binär und ohne Hysterese. Die CPU-Auslastung ist eine Rate, geglättet nur kurz (laut Quellcode ein EWMA mit alpha 0,05): darum knapp über der Basis.",
    watch:
      "Ohne Haltezeit flattert die Bremse um die Schwelle. Gauge `overload.envoy.resource_monitors.cpu_utilization.pressure` beobachten. Mit Trigger `scaled` wird dieselbe Aktion zum Dämpfer.",
    doc: "https://www.envoyproxy.io/docs/envoy/latest/configuration/operations/overload_manager/overload_manager",
  },
  {
    l: "Mimir CPU-Limit",
    name: "Mimir Ingester Read-Path-Limit (CPU)",
    x: 0.24,
    y: 0.41,
    q: "reflex",
    s: "r",
    what: "Ingester lehnen Leseanfragen mit 503 ab, solange die CPU-Auslastung im gleitenden Mittel das Limit erreicht oder überschreitet. So bleibt der Schreibpfad gesund.",
    why: "Ablehnen oder nicht: binär. Auslöser ist die CPU-Rate, im Quellcode über 60\u00a0Sekunden gemittelt: etwas Gedächtnis, aber kein Füllstand. Darum liegt der Punkt in der oberen Hälfte des Reflex. Das Speicherlimit derselben Funktion ist ein Heap-Pegel und gehörte ins Wehr.",
    watch:
      "Abfragen scheitern, während die Ingestion gesund bleibt: Dashboards werden zuerst leer. Metrik `cortex_ingester_utilization_limited_read_requests_total`.",
    doc: "https://grafana.com/docs/mimir/latest/configure/configure-resource-utilization-based-ingester-read-path-limiting/",
  },
  // Mitlauf-Dämpfer — zustandsarm + proportional
  {
    l: "Envoy Admission",
    name: "Envoy Admission Control",
    x: 0.76,
    y: 0.34,
    q: "daempfer",
    s: "l",
    what: "Der Admission-Control-Filter lehnt Requests clientseitig mit einer Wahrscheinlichkeit ab, die steigt, wenn die Erfolgsquote des Upstreams fällt.",
    why: "Die Ablehnungswahrscheinlichkeit `P = ((n_total − s)/(n_total + 1))^(1/aggression)` wächst stufenlos: proportional. Eingang ist die Erfolgsquote der letzten 60\u00a0Sekunden, kein Füllstand: zustandsarm.",
    watch:
      "Was als Erfolg zählt, entscheidet alles: Ein Sturm von 4xx kann die Bremse auslösen. Metrik `admission_control.rq_rejected`.",
    doc: "https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/admission_control_filter",
  },
  {
    l: "Envoy CPU-Rampe",
    name: "Envoy Overload Manager (scaled)",
    x: 0.88,
    y: 0.16,
    q: "daempfer",
    s: "l",
    what: "Dieselbe Aktion `stop_accepting_requests`, aber mit Trigger `scaled`: Die 503-Wahrscheinlichkeit steigt linear zwischen `scaling_threshold` und `saturation_threshold`.",
    why: "Ein einziger Konfigurationswert verschiebt Envoy vom Reflex in den Dämpfer: Aus der harten Kante wird eine Rampe, der Eingang bleibt dieselbe CPU-Rate. Die Zufallsentscheidung pro Request steht im Quellcode (Bernoulli).",
    watch:
      "Gemessen wird Envoys eigene CPU oder die seines Containers, nicht die des Backends. Die Doku zeigt das Beispiel mit `mode: CONTAINER` und 0,80 bis 0,95.",
    doc: "https://www.envoyproxy.io/docs/envoy/latest/configuration/operations/overload_manager/overload_manager",
  },
  {
    l: "Adaptive Throttling",
    name: "Adaptive Throttling (Google SRE)",
    x: 0.84,
    y: 0.43,
    q: "daempfer",
    s: "l",
    what: "Jeder Client verwirft Requests lokal mit der Wahrscheinlichkeit `max(0, (requests − K·accepts)/(requests + 1))`, berechnet über die letzten zwei Minuten.",
    why: "Die Wahrscheinlichkeit wächst stufenlos mit der Ablehnungsquote: proportional. Eingang sind Zähler im kurzen Fenster, kein Füllstand: zustandsarm. Zwei Minuten sind etwas mehr Gedächtnis als bei Envoy, darum liegt der Punkt etwas höher.",
    watch:
      "Ablehnungen kosten das Backend selbst noch Arbeit, das Buch schlägt dafür K = 1,1 vor. Metrik: Anteil lokal abgelehnter an gesendeten Requests je Client.",
    doc: "https://sre.google/sre-book/handling-overload/",
  },
  {
    l: "Kafka Quotas",
    name: "Kafka Client Quotas",
    x: 0.7,
    y: 0.25,
    q: "daempfer",
    s: "l",
    what: "Überschreitet ein Client seine Quote, berechnet der Broker eine Verzögerung und hält die Antwort entsprechend lange zurück.",
    why: "Die Verzögerung wächst mit der Überschreitung: proportional. Gemessen wird die Rate über mehrere kleine Fenster (zum Beispiel 30\u00a0×\u00a01\u00a0Sekunde), kein Füllstand: zustandsarm.",
    watch:
      "Producer sehen Latenz, keine Fehler, das versteckt sich als „Kafka ist langsam“. `produce-throttle-time-avg` und `fetch-throttle-time-avg` im Client beobachten.",
    doc: "https://kafka.apache.org/documentation/#design_quotas",
  },
];

// Datenkoordinaten in die um INSET eingerückte Plotfläche abbilden, damit die
// Ecken Platz für die Quadranten-Chips und die Achsenpole lassen.
const INSET = 12; // %
const span = 100 - 2 * INSET;
const px = (x) => INSET + x * span;
const py = (y) => 100 - (INSET + y * span); // y=0 unten → top=hoch
const dotStyle = (p) => ({
  left: px(p.x) + "%",
  top: py(p.y) + "%",
  "--c": `var(--bpq-${p.q})`,
});

// ⓘ-Dialog: Text je Quadrant. Absatz = Liste von Segmenten, b = fett.
// `marks` benennt die gestrichelten Linien von oben nach unten.
const INFO = {
  wehr: {
    axes: "zustandsbehaftet · binär",
    marks: "gestrichelt: Set-Schwelle (oben), Reset-Schwelle (unten)",
    paras: [
      [
        { t: "Ein Pegel (Puffer, Heap, Queue) läuft bis zur " },
        { t: "Set-Schwelle", b: true },
        {
          t: " voll. Dann bremst das Wehr ganz und hält, bis der Pegel unter die ",
        },
        { t: "Reset-Schwelle", b: true },
        { t: " gefallen ist. Das Band dazwischen ist die Hysterese." },
      ],
      [
        { t: "Anders als die anderen: ", b: true },
        {
          t: "harte Kanten wie der Reflex, aber mit Gedächtnis. Es flattert nicht, dafür gibt es einen Sägezahn und lange Stopp-Phasen. Kippt die Bremse in positive Rückkopplung, wird daraus der metastabile Fehler.",
        },
      ],
    ],
  },
  regler: {
    axes: "zustandsbehaftet · proportional",
    marks: "gestrichelt: Sollwert",
    paras: [
      [
        { t: "Der Zufluss wird proportional zum Abstand vom " },
        { t: "Sollwert", b: true },
        {
          t: " gedrosselt. Nach einem Lastsprung nähert sich der Pegel exponentiell an, ohne Überschwingen und ohne Stopp.",
        },
      ],
      [
        { t: "Anders als die anderen: ", b: true },
        {
          t: "hat einen Pegel wie das Wehr, bremst aber stufenlos. Der Dämpfer hat keinen Pegel. Er hält den Sollwert auch bei dauerhaft hoher Last und ist darum am besten vorhersagbar.",
        },
      ],
    ],
  },
  reflex: {
    axes: "zustandsarm · binär",
    marks: "gestrichelt: Grenze",
    paras: [
      [
        { t: "Reißt die momentane Last die " },
        { t: "Grenze", b: true },
        {
          t: ", fällt die durchgelassene Rate sofort auf 0 und kommt ebenso sofort zurück.",
        },
      ],
      [
        { t: "Anders als die anderen: ", b: true },
        {
          t: "kein Band und kein Gedächtnis, nur der Momentanwert. Der Reflex reagiert am schnellsten, flattert aber bei Last nahe der Grenze. Man sieht ihn nur an seiner Wirkung: detektierbar, nicht vorhersagbar.",
        },
      ],
    ],
  },
  daempfer: {
    axes: "zustandsarm · proportional",
    marks: "",
    paras: [
      [
        { t: "Die Rate folgt der Last. Oberhalb eines Knies wird sie " },
        { t: "weich gestaucht", b: true },
        { t: ": Spitzen werden abgeflacht statt abgeschnitten." },
      ],
      [
        { t: "Anders als die anderen: ", b: true },
        {
          t: "weder Stopp (Reflex, Wehr) noch Pegel (Regler). Die Bremskraft wächst mit der Last, deshalb stabilisiert sich das System selbst.",
        },
      ],
    ],
  },
};

// Welcher Quadrant ist im Dialog offen (null = keiner)?
const open = ref(null);
const openQ = computed(() => QUADS.find((q) => q.key === open.value));
const examples = computed(() =>
  POINTS.filter((p) => p.q === open.value)
    .map((p) => p.l)
    .join(" · "),
);

// Dialogtexte: `…` markiert Konfigurationsparameter, Metriken und Formeln als
// Inline-Code (Code-Schrift). Liefert Segmente { t, code } für das Template.
const PT_FIELDS = [
  { k: "what", h: "Was" },
  { k: "why", h: "Warum hier" },
  { k: "watch", h: "Achtung" },
];
const parts = (text) =>
  text
    .split("`")
    .map((t, i) => ({ t, code: i % 2 === 1 }))
    .filter((seg) => seg.t);

// Welcher Datenpunkt ist im Dialog offen (null = keiner)? Gleicher Overlay,
// gleiche Pause; es ist immer nur ein Dialog offen.
const openP = ref(null);
const openPt = computed(() => POINTS.find((p) => p.l === openP.value));
const openPtQ = computed(() => QUADS.find((q) => q.key === openPt.value?.q));
const isOpen = computed(() => !!(openQ.value || openPt.value));
const showQuad = (key) => {
  openP.value = null;
  open.value = key;
};
const showPoint = (label) => {
  open.value = null;
  openP.value = label;
};
const closeAll = () => {
  open.value = null;
  openP.value = null;
};

function onKey(ev) {
  if (ev.key === "Escape") closeAll();
}
watch(isOpen, (o) => {
  if (o) window.addEventListener("keydown", onKey);
  else window.removeEventListener("keydown", onKey);
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));
onSlideLeave(closeAll);
</script>

<template>
  <div class="bpq" :class="{ paused: isOpen }" :style="cssVars">
    <div class="bpq-plot">
      <!-- Quadranten-Tönung -->
      <div class="quad q-tl" />
      <div class="quad q-tr" />
      <div class="quad q-bl" />
      <div class="quad q-br" />
      <!-- Achsenkreuz -->
      <div class="axis axis-v" />
      <div class="axis axis-h" />

      <!-- Achsenpole -->
      <div class="pole pole-top">zustandsbehaftet · Pegel</div>
      <div class="pole pole-bottom">zustandsarm · Rate</div>
      <div class="pole pole-left">binär ·<br />Bang-Bang</div>
      <div class="pole pole-right">propor-<br />tional</div>

      <!-- Quadranten-Namen -->
      <div
        v-for="q in QUADS"
        :key="q.key"
        class="qname"
        :class="'c-' + q.corner"
        :style="{ '--c': `var(--bpq-${q.key})` }"
      >
        <span class="qtext">
          <span class="qname-t">{{ q.name }}</span>
          <span class="qname-s">{{ q.sub }}</span>
        </span>
        <button
          type="button"
          class="trace-btn"
          :aria-label="`${q.name}: Verhalten vergrößert erklären`"
          @click.stop="showQuad(q.key)"
        >
          <svg
            class="trace"
            :viewBox="`0 0 ${PERIOD} ${TH}`"
            :width="PERIOD"
            :height="TH"
            aria-hidden="true"
          >
            <line
              v-for="m in TRACES[q.key].marks"
              :key="m"
              class="t-mark"
              x1="0"
              :x2="PERIOD"
              :y1="yOf(m)"
              :y2="yOf(m)"
            />
            <g class="t-scroll" :style="{ '--dur': TRACES[q.key].dur + 's' }">
              <path class="t-load" :d="TRACES[q.key].load" />
              <path
                v-if="TRACES[q.key].fill"
                class="t-fill"
                :d="TRACES[q.key].fill"
              />
              <path class="t-line" :d="TRACES[q.key].line" />
            </g>
          </svg>
          <span class="info-badge" aria-hidden="true">i</span>
        </button>
      </div>

      <!-- Metastabiler Fehler: Eskalation aus dem Schwellwert-Wehr -->
      <div class="meta">↖ metastabil · ∞&nbsp;Hysterese</div>

      <!-- Datenpunkte -->
      <button
        v-for="p in POINTS"
        :key="p.l"
        type="button"
        class="pt"
        :style="dotStyle(p)"
        :aria-label="`${p.name}: Einordnung erklären`"
        @click.stop="showPoint(p.l)"
      >
        <span class="dot" />
        <span class="lab" :class="p.s === 'l' ? 'lab-l' : 'lab-r'">{{
          p.l
        }}</span>
      </button>
    </div>

    <!-- ⓘ-Dialog: dimmt die Folie, zeigt die Spur groß; Klick schließt -->
    <div v-if="isOpen" class="bpq-overlay" @click="closeAll">
      <div
        v-if="openQ"
        class="bpq-card"
        :style="{ '--c': `var(--bpq-${openQ.key})` }"
        role="dialog"
        :aria-label="openQ.name"
      >
        <div class="card-h">
          <span class="card-t">{{ openQ.name }}</span>
          <span class="card-axes">{{ INFO[openQ.key].axes }}</span>
        </div>
        <svg
          class="trace big"
          :viewBox="`0 0 ${PERIOD} ${TH}`"
          :width="PERIOD * 6"
          :height="TH * 6"
          aria-hidden="true"
        >
          <line
            v-for="m in TRACES[openQ.key].marks"
            :key="m"
            class="t-mark"
            x1="0"
            :x2="PERIOD"
            :y1="yOf(m)"
            :y2="yOf(m)"
          />
          <g class="t-scroll" :style="{ '--dur': TRACES[openQ.key].dur + 's' }">
            <path class="t-load" :d="TRACES[openQ.key].load" />
            <path
              v-if="TRACES[openQ.key].fill"
              class="t-fill"
              :d="TRACES[openQ.key].fill"
            />
            <path class="t-line" :d="TRACES[openQ.key].line" />
          </g>
        </svg>
        <div class="card-legend">
          grau: Last · Farbe: Reaktion ·
          {{ TRACES[openQ.key].fill ? "Fläche: Pegel" : "Linie: Rate" }}
          <template v-if="INFO[openQ.key].marks">
            · {{ INFO[openQ.key].marks }}
          </template>
        </div>
        <p v-for="(para, i) in INFO[openQ.key].paras" :key="i" class="card-p">
          <template v-for="(s, j) in para" :key="j">
            <strong v-if="s.b">{{ s.t }}</strong>
            <template v-else>{{ s.t }}</template>
          </template>
        </p>
        <div class="card-ex">Beispiele: {{ examples }}</div>
        <div class="card-hint">Klick irgendwohin schließt</div>
      </div>

      <!-- Datenpunkt: Was · Warum hier · Achtung · Doku -->
      <div
        v-else-if="openPt"
        class="bpq-card pt-card"
        :style="{ '--c': `var(--bpq-${openPt.q})` }"
        role="dialog"
        :aria-label="openPt.name"
      >
        <div class="card-h">
          <span class="card-t">{{ openPt.name }}</span>
          <span class="card-axes">{{ openPtQ.name }}</span>
        </div>
        <div class="card-legend">{{ INFO[openPt.q].axes }}</div>
        <p v-for="f in PT_FIELDS" :key="f.k" class="card-p">
          <strong>{{ f.h }}: </strong>
          <template v-for="(seg, i) in parts(openPt[f.k])" :key="i">
            <code v-if="seg.code" class="ic">{{ seg.t }}</code>
            <template v-else>{{ seg.t }}</template>
          </template>
        </p>
        <div class="card-ex">
          <a
            :href="openPt.doc"
            target="_blank"
            rel="noopener noreferrer"
            @click.stop
            >Original-Doku ↗</a
          >
        </div>
        <div class="card-hint">Klick irgendwohin schließt</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bpq {
  font-size: 0.72em;
  color: var(--bpq-text);
}
.bpq-plot {
  position: relative;
  width: 100%;
  height: 322px;
  border: 1px solid var(--bpq-frame);
  border-radius: 8px;
}
.quad {
  position: absolute;
  width: 50%;
  height: 50%;
}
.q-tl {
  top: 0;
  left: 0;
  background: var(--bpq-wehr);
  opacity: 0.05;
  border-top-left-radius: 8px;
}
.q-tr {
  top: 0;
  right: 0;
  background: var(--bpq-regler);
  opacity: 0.05;
  border-top-right-radius: 8px;
}
.q-bl {
  bottom: 0;
  left: 0;
  background: var(--bpq-reflex);
  opacity: 0.05;
  border-bottom-left-radius: 8px;
}
.q-br {
  bottom: 0;
  right: 0;
  background: var(--bpq-daempfer);
  opacity: 0.05;
  border-bottom-right-radius: 8px;
}
.axis {
  position: absolute;
  background: var(--bpq-line);
}
.axis-v {
  left: 50%;
  top: 0;
  bottom: 0;
  width: 0;
  border-left: 1px dashed var(--bpq-line);
  background: none;
}
.axis-h {
  top: 50%;
  left: 0;
  right: 0;
  height: 0;
  border-top: 1px dashed var(--bpq-line);
  background: none;
}

.pole {
  position: absolute;
  font-size: 0.74em;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--bpq-muted);
  text-transform: uppercase;
  text-align: center;
  line-height: 1.15;
}
.pole-top {
  top: 3px;
  left: 50%;
  transform: translateX(-50%);
}
.pole-bottom {
  bottom: 3px;
  left: 50%;
  transform: translateX(-50%);
}
.pole-left {
  left: 4px;
  top: 50%;
  transform: translateY(-50%);
}
.pole-right {
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
}

.qname {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 47%;
  color: var(--c);
}
.qtext {
  display: flex;
  flex-direction: column;
}
/* Spur sitzt zur Plotmitte hin: links neben dem Text bei rechten Ecken. */
.c-tr .qtext,
.c-br .qtext {
  align-items: flex-end;
}
.trace {
  flex: none;
  overflow: hidden;
  border-radius: 3px;
  background: color-mix(in srgb, var(--c) 8%, transparent);
}
.t-scroll {
  animation: bpq-scroll var(--dur, 5s) linear infinite;
}
@keyframes bpq-scroll {
  to {
    transform: translateX(-64px);
  }
}
.t-mark {
  stroke: var(--bpq-muted);
  stroke-width: 0.6;
  stroke-dasharray: 2 2;
}
.t-load,
.t-line {
  fill: none;
  stroke-linejoin: round;
}
.t-load {
  stroke: var(--bpq-dim);
  stroke-width: 1;
}
.t-line {
  stroke: var(--c);
  stroke-width: 1.6;
}
.t-fill {
  fill: color-mix(in srgb, var(--c) 28%, transparent);
}
@media (prefers-reduced-motion: reduce) {
  .t-scroll {
    animation: none;
  }
}

/* ⓘ-Knopf: die ganze Spur ist Klickfläche, das Badge sitzt an der äußeren
   oberen Ecke (weg von den Datenpunkt-Labels). */
.trace-btn {
  position: relative;
  flex: none;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  line-height: 0;
  cursor: pointer;
  order: 0;
}
.c-tr .trace-btn,
.c-br .trace-btn {
  order: -1;
}
.trace-btn:focus-visible {
  outline: 2px solid var(--c);
  outline-offset: 2px;
}
.info-badge {
  position: absolute;
  top: -5px;
  left: -5px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--c);
  color: var(--bpq-card);
  font-size: 8px;
  font-weight: 800;
  font-style: italic;
  line-height: 11px;
  text-align: center;
}
.c-tr .info-badge,
.c-br .info-badge {
  left: auto;
  right: -5px;
}
.trace-btn:hover .trace {
  background: color-mix(in srgb, var(--c) 18%, transparent);
}

/* Angehalten, solange der Dialog offen ist; die große Spur im Dialog liegt
   außerhalb von .bpq-plot und läuft weiter. */
.bpq.paused .bpq-plot .t-scroll {
  animation-play-state: paused;
}

/* position:fixed bezieht sich wegen des Slidev-Scaler-Transforms auf den
   Folien-Canvas (siehe BunPopover). */
.bpq-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.5);
  cursor: pointer;
  font-size: 13px;
  text-align: left;
}
.bpq-card {
  width: 420px;
  max-width: 100%;
  padding: 14px 18px;
  background: var(--bpq-card);
  color: var(--bpq-text);
  border: 1px solid var(--c);
  border-radius: 12px;
  line-height: 1.45;
}
.bpq-card.pt-card {
  width: 500px;
}
.card-h {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.card-t {
  font-size: 1.25em;
  font-weight: 800;
  color: var(--c);
}
.card-axes {
  font-size: 0.85em;
  color: var(--bpq-muted);
}
.trace.big {
  display: block;
  margin: 0 auto;
  border-radius: 6px;
}
.big .t-load {
  stroke-width: 0.3;
}
.big .t-line {
  stroke-width: 0.5;
}
.big .t-mark {
  stroke-width: 0.15;
  stroke-dasharray: 0.8 0.8;
}
.card-legend {
  margin: 6px 0 8px;
  font-size: 0.85em;
  color: var(--bpq-muted);
}
.card-p {
  margin: 0 0 6px;
}
.card-ex {
  margin-top: 8px;
  font-size: 0.85em;
  color: var(--bpq-muted);
}
.card-p code.ic {
  padding: 0.05em 0.35em;
  border-radius: 4px;
  background: color-mix(in srgb, var(--c) 14%, transparent);
  color: var(--bpq-text);
  font-family: var(--slidev-code-font-family);
  font-size: 0.88em;
  overflow-wrap: anywhere;
}
.card-ex a {
  color: var(--c);
  font-weight: 700;
  cursor: pointer;
}
.card-hint {
  margin-top: 8px;
  font-size: 0.8em;
  color: var(--bpq-dim);
}
.qname-t {
  font-weight: 800;
  font-size: 0.84em;
  line-height: 1.1;
}
.qname-s {
  font-size: 0.66em;
  color: var(--bpq-muted);
  line-height: 1.1;
}
.c-tl {
  top: 18px;
  left: 8px;
  text-align: left;
}
.c-tr {
  top: 18px;
  right: 8px;
  text-align: right;
}
.c-bl {
  bottom: 18px;
  left: 8px;
  text-align: left;
}
.c-br {
  bottom: 18px;
  right: 8px;
  text-align: right;
}

.meta {
  position: absolute;
  top: 2px;
  left: 6px;
  font-size: 0.66em;
  font-weight: 700;
  color: var(--bpq-danger);
  white-space: nowrap;
}

.pt {
  position: absolute;
  width: 0;
  height: 0;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  line-height: 0;
  cursor: pointer;
  user-select: none;
}
/* Größere Trefferfläche um den Punkt; Layout bleibt unberührt. */
.pt::before {
  content: "";
  position: absolute;
  left: -9px;
  top: -9px;
  width: 18px;
  height: 18px;
}
.pt:focus-visible {
  outline: none;
}
.pt:hover .dot,
.pt:focus-visible .dot {
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--c) 45%, transparent);
}
.pt:hover .lab,
.pt:focus-visible .lab {
  text-decoration: underline;
}
.dot {
  position: absolute;
  left: 0;
  top: 0;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--c);
  border: 1.5px solid var(--bpq-text);
  transform: translate(-50%, -50%);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--c) 22%, transparent);
}
.lab {
  position: absolute;
  top: 0;
  transform: translateY(-50%);
  font-size: 0.72em;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  color: var(--bpq-text);
}
.lab-r {
  left: 9px;
}
.lab-l {
  right: 9px;
}
</style>
