import { describe, expect, it } from "vitest";
import {
  bestByEffort,
  bestByScore,
  configFront,
  CURRENT,
  EFFORTS,
  fmt,
  makeScale,
  ownFront,
  paretoFront,
  type Pt,
  selfDominated,
  SNAPSHOTS,
  tip,
  V1_COMPARE,
} from "../../paretoData";

// Die Folie „Welches Modell wofür?" behauptet eine Zahl („drei Punkte auf der
// Front") und eine Pointe. Beides ist abgeleitet, nicht getippt: es kippt still,
// sobald irgendwo ein Preis wandert. Genau so ist der DeepSeek-Stand am
// 21.08.2026 veraltet, ohne dass es jemandem auffiel — deshalb dieser Test.
//
// Er hat am 03.09.2026 seinen Zweck erfüllt: gemini-3.8-flash kam ins Board und
// die Erwartung „fünf Punkte bis 10,37 €" brach. Die Zahlen unten sind der
// Nachfolgestand, nicht eine gelockerte Erwartung.

describe("Pareto-Front, Stand 03.09.2026", () => {
  const { front, dom } = paretoFront(CURRENT);

  it("besteht aus drei Punkten von 0,21 € bis 2,07 €", () => {
    expect(front.map((p) => [p.label, p.eur, p.y] as const)).toStrictEqual([
      ["glm-5.3-flash", "0,21", 63],
      ["gpt-5.6-luna", "0,53", 67],
      ["gemini-3.8-flash", "2,07", 74],
    ]);
  });

  it("hat terra, sol und Opus 5 an den Neuzugang verloren", () => {
    const gefallen = ["gpt-5.6-terra", "gpt-5.6-sol", "claude-opus-5"];
    expect(dom.map((p) => p.label)).toEqual(expect.arrayContaining(gefallen));
    // Opus 5 ist nicht knapp draußen, sondern beim gleichen Score fünfmal so
    // teuer — das ist die Aussage der Folie.
    const opus = CURRENT.find((p) => p.label === "claude-opus-5")!;
    const neu = CURRENT.find((p) => p.label === "gemini-3.8-flash")!;
    expect(neu.y).toBe(opus.y);
    expect(opus.x / neu.x).toBeGreaterThan(4.9);
  });

  it("hat beide DeepSeek-Modelle nach der Preiserhöhung vom 16.08. verloren", () => {
    const ds = dom.filter((p) => p.label.startsWith("deepseek-"));
    expect(ds.map((p) => [p.label, p.eur])).toStrictEqual([
      ["deepseek-v4-flash", "0,41"],
      ["deepseek-v4-pro", "1,46"],
    ]);
  });

  it("setzt glm-5.3-flash exakt auf den geräumten Platz von deepseek-v4-pro", () => {
    const glm = CURRENT.find((p) => p.label === "glm-5.3-flash")!;
    const vorher = SNAPSHOTS.find((s) => s.id === "0814")!.pts.find(
      (p) => p.label === "deepseek-v4-pro",
    )!;
    expect([glm.x, glm.y]).toStrictEqual([vorher.x, vorher.y]);
  });

  it("zeigt 22 Modelle: Board-Default plus gpt-5.6-terra", () => {
    expect(CURRENT).toHaveLength(22);
    expect(CURRENT.map((p) => p.label)).toContain("gpt-5.6-terra");
  });

  // Stand 9 ist die Gegenprobe zu Stand 8: dort riss EIN Neuzugang drei Punkte
  // von der Front, hier bewegt einer gar nichts. gpt-6-astra trägt mit 74,12 %
  // auf `xhigh` den höchsten Rohwert des ganzen Boards — gezeigt wird nach der
  // Board-Regel aber `max` mit 73,23 % für 10,84 €, und das ist doppelt
  // dominiert: von gemini-3.8-flash (besser und ein Fünftel des Preises) und
  // von Opus 5 (gleicher gerundeter Score, 47 Cent billiger).
  // astra hat mit 74,12 % den hoechsten Rohwert des Boards und erreicht die
  // Front trotzdem nicht: gerundet steht es gleichauf mit gemini-3.8-flash,
  // das ein Drittel kostet. Das ist die Aussage der Folie in einem Test.
  it("nimmt gpt-6-astra auf, ohne dass die Front sich bewegt", () => {
    const astra = CURRENT.find((p) => p.label === "gpt-6-astra")!;
    expect([astra.eur, astra.y]).toStrictEqual(["5,71", 74]);
    expect(dom.map((p) => p.label)).toContain("gpt-6-astra");

    const gemini = CURRENT.find((p) => p.label === "gemini-3.8-flash")!;
    expect(gemini.y).toBe(astra.y);
    expect(gemini.x).toBeLessThan(astra.x);
    expect(astra.x / gemini.x).toBeGreaterThan(2.5);
  });

  // Der Board-Preis von gemini-3.8-flash ist ein Einführungspreis: Google
  // verdoppelt Input, Output UND Cache am 01.01.2027, der Punkt verdoppelt sich
  // also exakt. Steht die Rechnung hier, veraltet sie nicht still, wenn Google
  // die Aktion verlängert oder streicht.
  it("führt den Einführungspreis als Geisterring auf dem Doppelten", () => {
    const neu = CURRENT.find((p) => p.label === "gemini-3.8-flash")!;
    expect(neu.old?.pre).toBe("ab 01.01.");
    expect(neu.old!.x).toBeCloseTo(neu.x * 2, 2);
    // Auch zum Listenpreis bliebe er auf der Front — dann hinter terra.
    const zumListenpreis = paretoFront(
      CURRENT.map((p) => (p === neu ? { ...p, x: p.old!.x } : p)),
    ).front.map((p) => p.label);
    expect(zumListenpreis).toStrictEqual([
      "glm-5.3-flash",
      "gpt-5.6-luna",
      "gpt-5.6-terra",
      "gemini-3.8-flash",
    ]);
  });
});

describe("Kontingent-Overlay", () => {
  const claude = CURRENT.filter((p) => p.sub !== undefined);

  it("deckt alle vier Claude-Punkte mit beiden Kontingent-Ständen ab", () => {
    expect(claude.map((p) => [p.label, p.sub, p.sub25])).toStrictEqual([
      ["claude-opus-5", 6.91, 8.3],
      ["claude-opus-4.8", 7.72, 9.26],
      ["claude-fable-5", 7.83, 9.4],
      ["claude-sonnet-5", 15.42, 18.5],
    ]);
  });

  it("rechnet ×2/3 für die Aktion bis 13.09. und ×0,8 ab 14.09.", () => {
    for (const p of claude) {
      expect(p.sub).toBeCloseTo((p.x * 2) / 3, 2);
      expect(p.sub25).toBeCloseTo(p.x * 0.8, 2);
    }
    // Der Geisterring liegt immer rechts vom Punkt — sonst zeigte der
    // Wanderungspfeil in die falsche Richtung.
    for (const p of claude) expect(p.sub25!).toBeGreaterThan(p.sub!);
  });
});

describe("tip()", () => {
  // Der Sol-Ring ist mit Stand 8 auf der aktuellen Folie weggefallen (dort zeigt
  // der einzige Ring einen künftigen Preis). Die Wanderung selbst steht weiter
  // in Stand 7 — von dort kommt der Prüfling.
  const sol = SNAPSHOTS.find((s) => s.id === "0826")!.pts.find(
    (p) => p.label === "gpt-5.6-sol",
  )!;

  it("nennt den alten Preis mit dem Standard-Präfix", () => {
    expect(tip(sol)).toBe(
      "gpt-5.6-sol: 73 % ± 2,80 · 5,66 €/Task (vorher 7,35 €)",
    );
  });

  it("übernimmt ein abweichendes Präfix für künftige Stände", () => {
    const ghost = { ...sol, old: { ...sol.old!, pre: "ab 14.09." } };
    expect(tip(ghost)).toContain("(ab 14.09. 7,35 €)");
  });
});

// Geisterringe zeigen vergangene Wanderungen nur an der Station, an der sie
// passiert sind. Stand 7 trägt zwei (sol billiger, deepseek-v4-flash teurer),
// die abgeleiteten Stände 8 und 9 keinen davon, und die Hauptfolie genau einen:
// den künftigen Preis von gemini-3.8-flash.
describe("Geisterringe je Stand", () => {
  const ringe = (id: string) =>
    SNAPSHOTS.find((s) => s.id === id)!
      .pts.filter((p) => p.old)
      .map((p) => [p.label, p.old!.eur, p.eur])
      .sort();

  it("zeigt am 26.08. Sol billiger und deepseek-v4-flash teurer", () => {
    expect(ringe("0826")).toStrictEqual([
      ["deepseek-v4-flash", "0,09", "0,41"],
      ["gpt-5.6-sol", "7,35", "5,66"],
    ]);
    // Ohne Ring fiel deepseek-v4-flash überraschend von der Front: am 14.08.
    // war es für 9 Cent der billigste Frontpunkt. deepseek-v4-pro bekommt
    // keinen Ring, weil der unter dem neuen glm-5.3-flash-Marker läge.
    const vorher = SNAPSHOTS.find((s) => s.id === "0814")!;
    expect(paretoFront(vorher.pts).front[0]!.label).toBe("deepseek-v4-flash");
  });

  it("lässt beide Ringe in den abgeleiteten Ständen weg", () => {
    expect(ringe("0902")).toStrictEqual([]);
    expect(ringe("0903")).toStrictEqual([]);
  });

  it("zeigt auf der Hauptfolie nur den künftigen Preis von gemini-3.8-flash", () => {
    expect(CURRENT.filter((p) => p.old).map((p) => p.label)).toStrictEqual([
      "gemini-3.8-flash",
    ]);
  });
});

// kimi-k2.7-code kostet 2,47 € — `mean_cost_usd` wie jeder andere Punkt.
//
// Am 04.09.2026 stand hier kurz 1,92 €, mit sechs Archivständen belegt. Die
// Stände waren echt, die Spalte war falsch: 1,92 € ist kimis `median_cost_usd`.
// Weil das Modell vom Board ausgeblendet ist und nur unbeschriftet auf der
// Historien-Folie auftaucht, fällt so etwas beim Ansehen nicht auf — dieser
// Test muss es tun. Er prüft deshalb nicht nur den Wert, sondern die Folge, an
// der die falsche Spalte sichtbar geworden wäre: die Front zweier Stände.
describe("kimi-k2.7-code steht auf dem Mittelwert, nicht dem Median", () => {
  const staende = SNAPSHOTS.filter((s) =>
    s.pts.some((p) => p.label === "kimi-k2.7-code"),
  );

  it("steht in jedem Stand auf 2,47 € = $2,8155 × 0,876", () => {
    expect(staende.length).toBeGreaterThan(0);
    expect(fmt(2.8155 * 0.876)).toBe("2,47");
    expect(
      staende.map((s) => [
        s.id,
        s.pts.find((p) => p.label === "kimi-k2.7-code")!.eur,
      ]),
    ).toStrictEqual([
      ["v11", "2,47"],
      ["0710", "2,47"],
      ["0722", "2,47"],
      ["0725", "2,47"],
      ["0730", "2,47"],
      ["0814", "2,47"],
      ["0826", "2,47"],
      ["0902", "2,47"],
      ["0903", "2,47"],
    ]);
  });

  // Der Median hätte kimi auf 1,92 € gezogen und damit unter muse-spark-1.1
  // (2,07 €) — es wäre in diesen beiden Ständen der billigste Punkt und damit
  // per Definition auf der Front gelandet. Genau das darf nicht passieren.
  it("liegt am 22.07. und 25.07. NICHT auf der Front", () => {
    for (const id of ["0722", "0725"]) {
      const s = SNAPSHOTS.find((x) => x.id === id)!;
      const { front } = paretoFront(s.pts);
      expect(front.map((p) => p.label)).not.toContain("kimi-k2.7-code");
      expect(front[0].label).toBe("muse-spark-1.1");
    }
  });

  // v1.1 und der 10.07. sind die Ausnahme: dort ist kimi auch bei 2,47 € der
  // billigste Punkt, muse-spark-1.1 kommt erst am 14.07.
  it("liegt nur in den Ständen v1.1 und 10.07. auf der Front", () => {
    for (const s of staende) {
      const drin = paretoFront(s.pts).front.some(
        (p) => p.label === "kimi-k2.7-code",
      );
      expect([s.id, drin]).toStrictEqual([
        s.id,
        s.id === "v11" || s.id === "0710",
      ]);
    }
  });
});

// Die Historie beginnt mit v1.1. DeepSWE v1 war eine andere Messung (Tests im
// Container des Agenten, Detached HEAD), und nur acht Modelle liefen unter
// beiden. Ein v1-Stand in der Serie hätte 15 Punkte verschwinden lassen, die
// nicht dominiert, sondern nicht gemessen waren — die Frage, mit der diese
// Tests am 05.09.2026 begannen.
describe("Die Serie beginnt mit v1.1", () => {
  it("führt neun Stände von v1.1 bis zum 03.09.", () => {
    expect(SNAPSHOTS.map((s) => s.id)).toStrictEqual([
      "v11",
      "0710",
      "0722",
      "0725",
      "0730",
      "0814",
      "0826",
      "0902",
      "0903",
    ]);
  });

  it("lässt kein Modell zwischen zwei Ständen verschwinden", () => {
    for (let i = 1; i < SNAPSHOTS.length; i++) {
      const vorher = SNAPSHOTS[i - 1]!.pts.map((p) => p.label);
      const jetzt = new Set(SNAPSHOTS[i]!.pts.map((p) => p.label));
      expect(vorher.filter((l) => !jetzt.has(l))).toStrictEqual([]);
    }
  });

  // Die Stationsnotizen erzählen, wann Anthropic auf der Front steht: fable-5
  // an Station 1, von terra verdrängt am 10.07., Opus 5 zurück am 25.07. bis
  // gemini-3.8-flash es am 02.09. verdrängt. „Erstmals" wäre am 25.07. falsch —
  // das stand dort bis 05.09.2026.
  it("führt Claude in genau diesen Ständen auf der Front", () => {
    expect(
      SNAPSHOTS.map((s) => [
        s.id,
        paretoFront(s.pts)
          .front.filter((p) => p.label.startsWith("claude-"))
          .map((p) => p.label)
          .join(","),
      ]),
    ).toStrictEqual([
      ["v11", "claude-fable-5"],
      ["0710", ""],
      ["0722", ""],
      ["0725", "claude-opus-5"],
      ["0730", "claude-opus-5"],
      ["0814", "claude-opus-5"],
      ["0826", "claude-opus-5"],
      ["0902", ""],
      ["0903", ""],
    ]);
    const note = SNAPSHOTS.find((s) => s.id === "0725")!.note;
    expect(note).not.toContain("erstmals");
    expect(note).toContain("zurück auf der Front");
  });

  // Stand 2: die gpt-5.6-Familie nimmt an einem Tag die Front. fable-5 hat
  // terras Score und kostet fast das Dreifache — die Pointe der Station.
  it("zeigt am 10.07. die gpt-5.6-Familie auf der Front", () => {
    const s = SNAPSHOTS.find((x) => x.id === "0710")!;
    expect(s.pts).toHaveLength(13);
    expect(paretoFront(s.pts).front.map((p) => p.label)).toStrictEqual([
      "kimi-k2.7-code",
      "gpt-5.6-luna",
      "gpt-5.6-terra",
      "gpt-5.6-sol",
    ]);
    const fable = s.pts.find((p) => p.label === "claude-fable-5")!;
    const terra = s.pts.find((p) => p.label === "gpt-5.6-terra")!;
    expect(fable.y).toBe(terra.y);
    expect(fable.x / terra.x).toBeGreaterThan(2.5);
    expect(fable.story).toBe(true);
  });
});

// Die Bonusfolie zeigt v1 gegen v1.1. Geisterringe und Kreuze sind aus den
// beiden Punktlisten abgeleitet; hier steht, was daraus folgen muss.
describe("Bonus: v1 gegen v1.1", () => {
  const v1 = V1_COMPARE[0]!;
  const v11 = V1_COMPARE[1]!;

  it("hat zwei Stationen und die Warnung nur an v1", () => {
    expect(V1_COMPARE.map((s) => [s.id, s.warn !== undefined])).toStrictEqual([
      ["v1", true],
      ["v11-vs-v1", false],
    ]);
  });

  it("trägt für die sechs doppelt gemessenen Modelle den v1-Wert als Ring", () => {
    expect(
      v11.pts
        .filter((p) => p.old)
        .map((p) => [p.label, p.old!.y, p.y, p.old!.eur, p.eur]),
    ).toStrictEqual([
      ["claude-sonnet-4.6", 32, 30, "4,83", "4,84"],
      ["gpt-5.4", 56, 52, "3,83", "4,95"],
      ["gpt-5.5", 70, 67, "5,79", "6,33"],
      ["gemini-3.5-flash", 28, 37, "6,50", "6,43"],
      ["gemini-3.1-pro", 10, 12, "1,61", "8,31"],
      ["claude-opus-4.8", 58, 59, "11,02", "11,58"],
    ]);
  });

  it("markiert die 15 v1-Modelle ohne v1.1-Wert als Kreuze", () => {
    const kreuze = v11.gone!.map((p) => p.label);
    expect(kreuze).toHaveLength(15);
    const inV11 = new Set(v11.pts.map((p) => p.label));
    expect(
      v1.pts.filter((p) => !inV11.has(p.label)).map((p) => p.label),
    ).toStrictEqual(kreuze);
    // 13 kehren nie zurück, zwei werden später neu gemessen.
    const spaeter = new Set(
      SNAPSHOTS.flatMap((s) => s.pts.map((p) => p.label)),
    );
    expect(kreuze.filter((l) => spaeter.has(l))).toStrictEqual([
      "glm-5.2",
      "deepseek-v4-pro",
    ]);
    const erst = (l: string) =>
      SNAPSHOTS.find((s) => s.pts.some((p) => p.label === l))!.id;
    expect([erst("glm-5.2"), erst("deepseek-v4-pro")]).toStrictEqual([
      "0710",
      "0814",
    ]);
  });

  it("zeigt acht Frontpunkte ab 0,62 € gegen vier ab 2,47 €", () => {
    const f1 = paretoFront(v1.pts).front;
    expect([f1.length, f1[0]!.eur, f1[f1.length - 1]!.eur]).toStrictEqual([
      8,
      "0,62",
      "5,79",
    ]);
    expect(paretoFront(v11.pts).front.map((p) => p.label)).toStrictEqual([
      "kimi-k2.7-code",
      "gpt-5.4",
      "gpt-5.5",
      "claude-fable-5",
    ]);
  });

  it("nennt im Tooltip Score und Preis des v1-Werts", () => {
    const g = v11.pts.find((p) => p.label === "gemini-3.1-pro")!;
    expect(tip(g)).toBe(
      "gemini-3.1-pro: 12 % · 8,31 €/Task (v1 10 % · 1,61 €)",
    );
  });
});

// Der ⓘ-Dialog nennt eine Zahl: „in acht Übergängen siebenmal verschoben".
// Solche Zahlen veralten still — vorher stand dort „achtmal", was die STÄNDE
// zählte statt der Verschiebungen. Hier wird sie ausgerechnet.
describe("Wie oft sich die Front verschoben hat", () => {
  const front = (i: number) =>
    paretoFront(SNAPSHOTS[i]!.pts)
      .front.map((p) => p.label)
      .join("|");

  it("verschiebt sich in acht Übergängen siebenmal", () => {
    const uebergaenge = SNAPSHOTS.length - 1;
    let verschoben = 0;
    for (let i = 1; i < SNAPSHOTS.length; i++)
      if (front(i) !== front(i - 1)) verschoben++;
    expect([uebergaenge, verschoben]).toStrictEqual([8, 7]);
  });

  // Das ist die Aussage von Stand 9: ein Neuzugang, der nichts bewegt.
  it("lässt den letzten Übergang die Front unberührt", () => {
    const n = SNAPSHOTS.length - 1;
    expect(SNAPSHOTS[n]!.id).toBe("0903");
    expect(front(n)).toBe(front(n - 1));
    expect(front(n)).toBe("glm-5.3-flash|gpt-5.6-luna|gemini-3.8-flash");
  });

  // Der Schlusstext der Historie wiederholt die Zahl aus dem ⓘ.
  it("steht als „siebenmal“ im Schlusstext", () => {
    expect(SNAPSHOTS[SNAPSHOTS.length - 1]!.closing?.note).toContain(
      "siebenmal",
    );
  });
});

// Der letzte Klick der Historie zeigt denselben Stand wie die Hauptfolie
// davor. Sein Schlusstext schließt die Klammer dorthin und nennt die Leiter —
// abgeleitet muss sie sein, sonst veraltet sie mit dem nächsten Board-Eintrag
// so still wie „Opus 5 führt mit 74 %" am 01.09.2026.
describe("Schlusstext der Historie", () => {
  const last = SNAPSHOTS[SNAPSHOTS.length - 1]!;
  const closing = last.closing!;

  it("hängt nur am letzten Stand, nicht an der Bonusfolie", () => {
    expect(closing).toBeDefined();
    expect(SNAPSHOTS.filter((s) => s.closing)).toHaveLength(1);
    expect(V1_COMPARE.some((s) => s.closing)).toBe(false);
  });

  it("heißt „Aktueller Stand“ und schließt die Klammer zur Folie davor", () => {
    expect(closing.title).toMatch(/^Aktueller Stand/);
    expect(closing.note).toContain("Folie davor");
  });

  it("nennt jede Sprosse der Front mit Preis, vom billigsten aufwärts", () => {
    const front = paretoFront(last.pts).front;
    expect(front.length).toBeGreaterThanOrEqual(2);
    const at = front.map((p) => {
      const i = closing.note.indexOf(`${p.label} ${p.eur} €`);
      expect(i, `${p.label} ${p.eur} € fehlt`).toBeGreaterThanOrEqual(0);
      return i;
    });
    for (let i = 1; i < at.length; i++)
      expect(at[i], front[i]!.label).toBeGreaterThan(at[i - 1]!);
  });

  // Der Notizkasten hat weder max-height noch Scroll (siehe pareto-label-qa.ts);
  // die längste Stationsnotiz liegt bei rund 590 Zeichen und reicht bis knapp
  // über die Kante. 480 ist der Kanarienvogel — die Kante selbst misst
  // v1-bonus-qa.ts je Klickschritt.
  it("bleibt kürzer als die längste Stationsnotiz", () => {
    expect(closing.note.length).toBeLessThanOrEqual(480);
    expect(closing.note.length).toBeLessThan(
      Math.max(...SNAPSHOTS.map((s) => s.note.length)),
    );
  });
});

// Die Effort-Tabelle ist eine ZWEITE Datenquelle neben den Punkten oben. Zwei
// Quellen driften, sobald niemand hinsieht — deshalb der erste Test: Er rechnet
// die Board-Regel über die Tabelle und muss exakt die Punkte des aktuellen
// Stands ergeben. Bricht er, meinen Tabelle und Chart verschiedene Board-Stände.
describe("Effort-Tabelle gegen die gezeigten Punkte", () => {
  it("reproduziert CURRENT über die Regel dieses Charts", () => {
    const aus = bestByScore().map((c) => [c.label, Math.round(c.y), c.x]);
    const soll = [...CURRENT]
      .sort((a, b) => a.x - b.x)
      .map((p) => [p.label, p.y, p.x]);
    expect(aus).toStrictEqual(soll);
  });

  it("kennt jedes gezeigte Modell und kein weiteres", () => {
    const inTabelle = new Set(EFFORTS.map((c) => c.label));
    expect([...inTabelle].sort()).toStrictEqual(
      CURRENT.map((p) => p.label).sort(),
    );
    expect(EFFORTS).toHaveLength(63);
  });

  // Der Kern der Umstellung: Die gewählte Konfiguration wird per Konstruktion
  // von keiner eigenen billigeren geschlagen. Unter der Board-Regel gilt das
  // für vier Modelle nicht — der Test darunter zählt sie.
  it("wählt nie eine selbst-dominierte Konfiguration", () => {
    expect(selfDominated(bestByScore())).toStrictEqual([]);
  });
});

// Warum dieses Chart die Board-Regel nicht übernimmt. Die Zahlen stammen aus
// derselben Payload wie die Punkte; hier wird nachgerechnet, welche Modelle das
// Board auf einer Stufe zeigt, die ihre eigene billigere schlägt.
describe("Wo die Board-Regel danebengreift", () => {
  const sd = selfDominated();

  it("betrifft genau vier der 22 Modelle", () => {
    expect(
      sd.map((d) => [
        d.label,
        d.gezeigt.effort,
        d.besser.effort,
        Number(d.spart.toFixed(2)),
        Math.round(d.prozent),
      ]),
    ).toStrictEqual([
      ["claude-fable-5", "max", "xhigh", 7.2, 38],
      ["gpt-6-astra", "max", "high", 5.83, 54],
      ["grok-4.6", "xhigh", "medium", 1.8, 37],
      ["gemini-3.7-flash", "high", "medium", 0.14, 7],
    ]);
  });

  // Bei dreien ist die billigere Stufe sogar die bessere — das ist der Teil,
  // den man nicht erwartet.
  it("liefert bei dreien von vieren auch den höheren Score", () => {
    const hoeher = sd
      .filter((d) => d.besser.y > d.gezeigt.y)
      .map((d) => d.label);
    expect(hoeher).toStrictEqual([
      "claude-fable-5",
      "grok-4.6",
      "gemini-3.7-flash",
    ]);
  });

  it("zeigt astra auf einer Stufe, die dieselben Aufgaben löst", () => {
    const astra = sd.find((d) => d.label === "gpt-6-astra")!;
    expect(astra.gezeigt.y).toBe(astra.besser.y);
    expect(astra.gezeigt.x / astra.besser.x).toBeGreaterThan(2);
  });

  // Genau diese vier Modelle sind die, die sich beim Regelwechsel bewegt haben.
  // Wandert der Kreis, muss auch paretoData.ts wandern.
  it("bewegt genau die vier Punkte, die im Chart links stehen", () => {
    const board = new Map(bestByEffort().map((c) => [c.label, c.x]));
    const anders = [...CURRENT]
      .filter((p) => board.get(p.label) !== p.x)
      .map((p) => [p.label, board.get(p.label), p.x]);
    expect(anders).toStrictEqual([
      ["gemini-3.7-flash", 1.91, 1.77],
      ["grok-4.6", 4.82, 3.02],
      ["gpt-6-astra", 10.84, 5.71],
      ["claude-fable-5", 18.95, 11.75],
    ]);
  });

  // Die Aussage der Folie und des ⓘ-Dialogs: Die Front hängt NICHT an der
  // Auswahlregel — nur die dominierten Punkte bewegen sich.
  it("lässt die Front beider Regeln gleich", () => {
    const alsPt = (cs: { label: string; y: number; x: number }[]) =>
      cs
        .map((c) => ({ label: c.label, x: c.x, y: Math.round(c.y) }) as Pt)
        .sort((a, b) => a.x - b.x);
    expect(paretoFront(alsPt(bestByScore())).front.map((p) => p.label)).toEqual(
      paretoFront(alsPt(bestByEffort())).front.map((p) => p.label),
    );
  });
});

describe("Front über alle Konfigurationen", () => {
  it("hat zwei Punkte mehr als die Front über die Modelle", () => {
    expect(configFront().map((c) => [c.label, c.effort, c.x])).toStrictEqual([
      ["glm-5.3-flash", "max", 0.21],
      ["gpt-5.6-luna", "max", 0.53],
      ["gemini-3.8-flash", "medium", 1.72],
      ["gemini-3.8-flash", "high", 2.07],
      ["gpt-6-astra", "xhigh", 5.71],
    ]);
  });

  // Der Boden ist redaktionell, also muss belegt sein, warum es ihn gibt:
  // ohne ihn führt die Front Punkte, die niemand empfehlen würde.
  it("braucht den Boden gegen entartete Punkte", () => {
    const ohne = configFront(0);
    expect(ohne[0]!.y).toBeLessThan(2);
    expect(ohne[0]!.x).toBeLessThan(0.02);
    expect(ohne.length).toBeGreaterThan(configFront().length);
  });

  // astra steht auf der Konfig-Front, aber nicht auf der Modell-Front: Sein
  // Rohwert ist der höchste des Boards, gerundet ist er der von
  // gemini-3.8-flash — und das kostet ein Drittel. Genau der Unterschied, den
  // die Folie meint, wenn sie „der billigste, der die Aufgabe löst" sagt.
  it("führt astra, obwohl es die Modell-Front nicht erreicht", () => {
    const astra = configFront().find((c) => c.label === "gpt-6-astra")!;
    expect(astra.effort).toBe("xhigh");
    expect(Math.max(...bestByScore().map((c) => c.y))).toBe(astra.y);
    expect(paretoFront(CURRENT).front.map((p) => p.label)).not.toContain(
      "gpt-6-astra",
    );
  });

  it("führt für astra vier nicht selbst-dominierte Stufen", () => {
    expect(ownFront("gpt-6-astra").map((c) => c.effort)).toStrictEqual([
      "low",
      "medium",
      "high",
      "xhigh",
    ]);
  });
});

describe("makeScale mit logarithmischer x-Achse", () => {
  const s = makeScale({
    W: 932,
    H: 306,
    L: 46,
    R: 10,
    T: 10,
    B: 33,
    xMax: 30,
    yMax: 88,
    xLog: { min: 0.08 },
  });

  it("bildet min auf den linken und xMax auf den rechten Rand ab", () => {
    expect(s.px(0.08)).toBeCloseTo(46, 9);
    expect(s.px(30)).toBeCloseTo(922, 9);
  });

  it("ist monoton und klemmt Werte unter min auf den Rand", () => {
    expect(s.px(0)).toBeCloseTo(46, 9);
    expect(s.px(0.21)).toBeLessThan(s.px(0.53));
    expect(s.px(10.37)).toBeLessThan(s.px(23.13));
  });

  it("legt gleiche Faktoren gleich weit auseinander", () => {
    expect(s.px(2) - s.px(1)).toBeCloseTo(s.px(20) - s.px(10), 9);
    expect(s.px(0.53) - s.px(0.21)).toBeGreaterThan(100);
  });
});
