import { describe, expect, it } from "vitest";
import {
  bestByEffort,
  configFront,
  CURRENT,
  EFFORTS,
  fmt,
  ownFront,
  paretoFront,
  selfDominated,
  SNAPSHOTS,
  tip,
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
  it("nimmt gpt-6-astra auf, ohne dass die Front sich bewegt", () => {
    const astra = CURRENT.find((p) => p.label === "gpt-6-astra")!;
    expect([astra.eur, astra.y]).toStrictEqual(["10,84", 73]);
    expect(dom.map((p) => p.label)).toContain("gpt-6-astra");

    const opus = CURRENT.find((p) => p.label === "claude-opus-5")!;
    expect(opus.x).toBeLessThan(astra.x);
    expect(opus.y).toBeGreaterThan(astra.y);
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
      ["claude-fable-5", 12.63, 15.16],
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

  // v1.1 ist die Ausnahme: dort ist kimi auch bei 2,47 € der billigste Punkt.
  it("bleibt nur im Stand v1.1 auf der Front", () => {
    for (const s of staende) {
      const drin = paretoFront(s.pts).front.some(
        (p) => p.label === "kimi-k2.7-code",
      );
      expect([s.id, drin]).toStrictEqual([s.id, s.id === "v11"]);
    }
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
});

// Die Effort-Tabelle ist eine ZWEITE Datenquelle neben den Punkten oben. Zwei
// Quellen driften, sobald niemand hinsieht — deshalb der erste Test: Er rechnet
// die Board-Regel über die Tabelle und muss exakt die Punkte des aktuellen
// Stands ergeben. Bricht er, meinen Tabelle und Chart verschiedene Board-Stände.
describe("Effort-Tabelle gegen die gezeigten Punkte", () => {
  it("reproduziert CURRENT über die Board-Regel", () => {
    const aus = bestByEffort().map((c) => [c.label, Math.round(c.y), c.x]);
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
});

// Das ist die Aussage des Effort-Overlays. Die Zahlen stammen aus derselben
// Payload wie die Punkte; hier wird nur nachgerechnet, welche Modelle das Board
// auf einer Stufe zeigt, die ihre eigene billigere schlägt.
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
  // den man nicht erwartet und der die Folie trägt.
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
});

describe("Front über alle Konfigurationen", () => {
  it("bekommt zwei Punkte mehr als die Board-Regel", () => {
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

  it("nimmt für astra xhigh, nicht die vom Board gezeigte max-Stufe", () => {
    const astra = configFront().find((c) => c.label === "gpt-6-astra")!;
    expect(astra.effort).toBe("xhigh");
    // Höchster Rohwert des ganzen Boards — höher als jeder gezeigte Punkt.
    expect(Math.max(...bestByEffort().map((c) => c.y))).toBeLessThan(astra.y);
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
