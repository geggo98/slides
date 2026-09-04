import { describe, expect, it } from "vitest";
import { CURRENT, SNAPSHOTS, paretoFront, tip } from "../../paretoData";

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

// kimi-k2.7-code stand bis zum 04.09.2026 in jedem Stand auf 2,47 € — ein Wert
// aus der veralteten CDN-Kopie, den sechs Archivstände des Boards (21.07. bis
// 02.09.) widerlegen. Das Modell ist vom Board ausgeblendet und taucht nur
// unbeschriftet auf der Historien-Folie auf; genau deshalb ist der Fehler zwei
// Monate lang niemandem aufgefallen. Dieser Test macht das Zurückdriften laut.
describe("kimi-k2.7-code, korrigiert am 04.09.2026", () => {
  const staende = SNAPSHOTS.filter((s) =>
    s.pts.some((p) => p.label === "kimi-k2.7-code"),
  );

  it("steht in jedem Stand auf dem Board-Wert 1,92 €", () => {
    expect(staende.length).toBeGreaterThan(0);
    expect(
      staende.map((s) => [
        s.id,
        s.pts.find((p) => p.label === "kimi-k2.7-code")!.eur,
      ]),
    ).toStrictEqual([
      ["v11", "1,92"],
      ["0722", "1,92"],
      ["0725", "1,92"],
      ["0730", "1,92"],
      ["0814", "1,92"],
      ["0826", "1,92"],
      ["0902", "1,92"],
      ["0903", "1,92"],
    ]);
  });

  // Der billigste gemessene Punkt ist per Definition pareto-optimal. In diesen
  // beiden Ständen unterbietet ihn nichts, also gehört er auf die Front — das
  // ist die einzige inhaltliche Folge der Korrektur.
  it("liegt am 22.07. und 25.07. als billigster Punkt auf der Front", () => {
    for (const id of ["0722", "0725"]) {
      const s = SNAPSHOTS.find((x) => x.id === id)!;
      const { front } = paretoFront(s.pts);
      expect(front[0].label).toBe("kimi-k2.7-code");
    }
  });

  it("bleibt sonst dominiert — die übrigen Stände ändern sich nicht", () => {
    for (const id of ["v11", "0730", "0814", "0826", "0902", "0903"]) {
      const s = SNAPSHOTS.find((x) => x.id === id)!;
      const { front } = paretoFront(s.pts);
      const drin = front.some((p) => p.label === "kimi-k2.7-code");
      expect(drin).toBe(id === "v11");
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
