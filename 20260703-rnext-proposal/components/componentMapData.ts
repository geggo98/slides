/**
 * Datenmodell + Layout der interaktiven Komponenten-Landkarte.
 *
 * Eine Datenquelle speist alle Zoom-Ebenen: layoutMap() rechnet die
 * deklarierten Säulen/Gruppen/Detail-Platten einmalig in EIN
 * Welt-Koordinatensystem. Die Übersicht ist der Ausschnitt 0/0/1000/430;
 * Detail-Platten liegen räumlich daneben (x ≥ 1080), die Kamera fliegt hin.
 * Detail-Platten sind im Seitenverhältnis des Viewports (~2,3:1) angelegt,
 * damit beim Rein-Zoomen kein Letterboxing Zoomfaktor verschenkt.
 *
 * Alle Namen sind generische Sammelbegriffe — keine Bezeichner aus der
 * geschützten Norm oder dem Referenz-Vorschlag.
 */

export type Direction = "in" | "out" | "both";
export type GroupCategory =
  | "envelope"
  | "input"
  | "output"
  | "variant"
  | "process"
  | "error"
  | "shared";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AttrGroup {
  label: string;
  attrs: string[];
  note?: string;
}

export interface SchemaGroup {
  id: string;
  label: string;
  category: GroupCategory;
  direction: Direction;
  note?: string;
  /** Verweis auf eine Detail-Platte → Gruppe ist auf Ebene 2 klickbar. */
  detailId?: string;
}

export interface Pillar {
  id: string;
  label: string;
  /** Kurzname für den Schnellwahl-Button. */
  short: string;
  norm?: string;
  kind: "pillar" | "core";
  stats: string[];
  groups: SchemaGroup[];
  /** Welt-Position in der Übersicht (Layout-Absicht, bewusst deklariert). */
  rect: Rect;
}

export interface DetailPlate {
  id: string;
  /** Säule, zu der Esc/Zurück von dieser Platte zurückführt. */
  parent: string;
  title: string;
  /** Kurzname für den Schnellwahl-Button. */
  short: string;
  inAttrs: AttrGroup;
  sharedAttrs: AttrGroup;
  outAttrs: AttrGroup;
  footnote?: string;
  rect: Rect;
}

export interface MapEdgeSpec {
  from: string;
  to: string;
  kind: "flow" | "reuse";
  label?: string;
}

export interface MapEdge extends MapEdgeSpec {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface LaidOutGroup extends SchemaGroup {
  rect: Rect;
}

export interface LaidOutPillar extends Omit<Pillar, "groups"> {
  groups: LaidOutGroup[];
}

export interface LaidOutMap {
  world: Rect;
  pillars: LaidOutPillar[];
  plates: DetailPlate[];
  edges: MapEdge[];
  /** Kamera-Ziele: "overview" | "pillar:<id>" | "detail:<id>". */
  targets: Record<string, Rect>;
}

// ---------------------------------------------------------------------------
// Inhalte (generisch)
// ---------------------------------------------------------------------------

const PILLARS: Pillar[] = [
  {
    id: "tarif",
    label: "Tarifierung",
    short: "Tarif",
    norm: "Norm 423",
    kind: "pillar",
    stats: ["4 Operationen", "75 Schemas", "rein synchron"],
    rect: { x: 150, y: 14, w: 280, h: 138 },
    groups: [
      {
        id: "tarif-req",
        label: "Anfrage-Hüllen",
        category: "envelope",
        direction: "in",
        note: "Einzel · Varianten · Schnell",
      },
      {
        id: "tarif-res",
        label: "Antwort-Hüllen",
        category: "envelope",
        direction: "out",
        note: "Preise je Variante",
      },
      {
        id: "tarif-in",
        label: "Fachobjekte (Eingabe)",
        category: "input",
        direction: "in",
        note: "ohne Preise",
        detailId: "detail:produkt",
      },
      {
        id: "tarif-out",
        label: "Fachobjekte (Ausgabe)",
        category: "output",
        direction: "out",
        note: "mit berechneten Preisen",
        detailId: "detail:produkt",
      },
      {
        id: "tarif-values",
        label: "Wertelisten",
        category: "shared",
        direction: "both",
        note: "zulässige Ausprägungen",
      },
      {
        id: "tarif-err",
        label: "Fehlerformat",
        category: "error",
        direction: "out",
        note: "RFC 7807",
      },
    ],
  },
  {
    id: "antrag",
    label: "Antrag & eVB",
    short: "Antrag",
    norm: "Norm 423 · 460",
    kind: "pillar",
    stats: ["12 Operationen", "85 Schemas", "sync + 202/Polling"],
    rect: { x: 570, y: 14, w: 280, h: 138 },
    groups: [
      {
        id: "antrag-req",
        label: "Kommando-Hüllen",
        category: "envelope",
        direction: "in",
        note: "Entwurf · Antrag · Bestätigung",
      },
      {
        id: "antrag-in",
        label: "Antrags-Eingabe",
        category: "input",
        direction: "in",
        note: "Fachobjekte + Zahlungsangabe",
        detailId: "detail:produkt",
      },
      {
        id: "antrag-out",
        label: "Antrags-Ausgabe",
        category: "output",
        direction: "out",
        note: "Vertragsnr. · vergebene Referenzen",
      },
      {
        id: "antrag-var",
        label: "Ergebnis-Varianten",
        category: "variant",
        direction: "out",
        note: "je Status eine Variante",
      },
      {
        id: "antrag-proc",
        label: "Prozess (Polling)",
        category: "process",
        direction: "both",
        note: "202 → Abfrage",
      },
      {
        id: "antrag-doc",
        label: "Dokumente & eVB",
        category: "shared",
        direction: "both",
        note: "Abruf · Kontingent",
      },
    ],
  },
  {
    id: "kern",
    label: "Geteilter Kern",
    short: "Kern",
    kind: "core",
    stats: ["richtungsneutrale Bausteine", "verwendet in 2–5 der 5 APIs"],
    rect: { x: 280, y: 180, w: 440, h: 92 },
    groups: [
      {
        id: "kern-err",
        label: "Fehlerformat",
        category: "error",
        direction: "out",
        note: "5/5 · RFC 7807",
      },
      {
        id: "kern-proc",
        label: "Prozess-Ressource",
        category: "process",
        direction: "both",
        note: "4/5 · Polling",
      },
      {
        id: "kern-vid",
        label: "Vertragsidentifikation",
        category: "shared",
        direction: "in",
        note: "4/5 · Nr. oder Kennzeichen",
      },
      {
        id: "kern-addr",
        label: "Adress-Familie",
        category: "shared",
        direction: "both",
        note: "4/5 · 3 Format-Varianten",
      },
      {
        id: "kern-pay",
        label: "Zahlungs-Familie",
        category: "shared",
        direction: "both",
        note: "3/5 · nach Zahlart",
        detailId: "detail:zahlung",
      },
      {
        id: "kern-partner",
        label: "Partner-Familie",
        category: "shared",
        direction: "both",
        note: "2/5 · natürlich/juristisch",
      },
    ],
  },
  {
    id: "zahlung",
    label: "Partner & Zahlung",
    short: "Zahlung",
    norm: "Norm 502",
    kind: "pillar",
    stats: ["7 Operationen", "55 Schemas", "201/202 hybrid"],
    rect: { x: 16, y: 300, w: 295, h: 116 },
    groups: [
      {
        id: "zahlung-req",
        label: "Kommando-Hüllen",
        category: "envelope",
        direction: "in",
        note: "Adresse · Bank · Mandat · VN",
      },
      {
        id: "zahlung-op",
        label: "Operations-Varianten",
        category: "variant",
        direction: "in",
        note: "Anlegen · Ändern · Entfernen",
      },
      {
        id: "zahlung-in",
        label: "Zahlungs-Eingabe",
        category: "input",
        direction: "in",
        note: "Kundendaten + Unterschrift",
        detailId: "detail:zahlung",
      },
      {
        id: "zahlung-out",
        label: "Zahlungs-Ausgabe",
        category: "output",
        direction: "out",
        note: "vergebene Referenzen",
        detailId: "detail:zahlung",
      },
      {
        id: "zahlung-var",
        label: "Ergebnis-Varianten",
        category: "variant",
        direction: "out",
        note: "vollzogen · Vorgang · abgelehnt",
      },
      {
        id: "zahlung-proc",
        label: "Prozess (Polling)",
        category: "process",
        direction: "both",
      },
    ],
  },
  {
    id: "aenderung",
    label: "Vertragsänderung Kfz",
    short: "Änderung",
    norm: "Norm 502.1",
    kind: "pillar",
    stats: ["7 Operationen", "53 Schemas", "201/202 hybrid"],
    rect: { x: 352, y: 300, w: 295, h: 116 },
    groups: [
      {
        id: "aend-req",
        label: "Kommando-Hüllen",
        category: "envelope",
        direction: "in",
        note: "Deckung · Fahrzeug · Fahrer · Ruhen",
      },
      {
        id: "aend-op",
        label: "Änderungs-Varianten",
        category: "variant",
        direction: "in",
        note: "diskriminiert nach Absicht",
      },
      {
        id: "aend-out",
        label: "Ergebnis + Beitragsfolge",
        category: "output",
        direction: "out",
        note: "neuer Beitrag sofort",
      },
      {
        id: "aend-proc",
        label: "Prozess (Polling)",
        category: "process",
        direction: "both",
      },
    ],
  },
  {
    id: "ende",
    label: "Vertragsbeendigung",
    short: "Beendigung",
    norm: "Norm 502",
    kind: "pillar",
    stats: ["5 Operationen", "13 Schemas", "201/202 hybrid"],
    rect: { x: 688, y: 300, w: 295, h: 116 },
    groups: [
      {
        id: "ende-req",
        label: "Kommando-Hüllen",
        category: "envelope",
        direction: "in",
        note: "Kündigung · Widerruf · Rücknahme",
      },
      {
        id: "ende-var",
        label: "Ergebnis-Varianten",
        category: "variant",
        direction: "out",
        note: "vollzogen · Vorgang · abgelehnt",
      },
      {
        id: "ende-proc",
        label: "Prozess (Polling)",
        category: "process",
        direction: "both",
      },
    ],
  },
];

const PLATES: DetailPlate[] = [
  {
    id: "detail:produkt",
    parent: "tarif",
    title: "In/Out: Produktbaustein",
    short: "In/Out Produkt",
    rect: { x: 1080, y: 40, w: 460, h: 200 },
    inAttrs: {
      label: "Nur Eingabe",
      attrs: [
        "Produkt- & Paketwahl",
        "Selbstbeteiligungen",
        "Risikomerkmale (Fahrzeug, Nutzung)",
        "gewünschte Zahlweise",
      ],
      note: "Consumer → VU",
    },
    sharedAttrs: {
      label: "Gemeinsam (Echo)",
      attrs: ["Deckungsbeginn", "Produktstruktur", "Vorgangs-Identifikation"],
      note: "in beiden Richtungen",
    },
    outAttrs: {
      label: "Nur Ausgabe",
      attrs: [
        "Preise (je Zahlweise)",
        "Einstufungen / Klassen",
        "Hinweise zur Berechnung",
      ],
      note: "vom VU berechnet",
    },
    footnote:
      "Getrennte Schemas je Richtung — ein Preis in der Anfrage ist schema-invalide.",
  },
  {
    id: "detail:zahlung",
    parent: "zahlung",
    title: "In/Out: Zahlungsangabe",
    short: "In/Out Zahlung",
    rect: { x: 1080, y: 290, w: 460, h: 200 },
    inAttrs: {
      label: "Nur Eingabe",
      attrs: [
        "Kunden-IBAN & Kontoinhaber",
        "Mandats-Unterschrift (Datum, Ort)",
        "gewünschte Zahlart & Rhythmus",
      ],
      note: "Consumer → VU",
    },
    sharedAttrs: {
      label: "Gemeinsam",
      attrs: ["Zahlart-Diskriminator", "Vertragsidentifikation"],
      note: "in beiden Richtungen",
    },
    outAttrs: {
      label: "Nur Ausgabe",
      attrs: [
        "Mandatsreferenz",
        "Gläubiger-ID",
        "Konto-Referenz (Bestand)",
        "VU-Referenzkonto (Überweisung)",
      ],
      note: "vom VU vergeben",
    },
    footnote:
      "Vergebene Referenzen werden später als Eingabe zitiert, um Bestandsdaten zu identifizieren.",
  },
];

const EDGES: MapEdgeSpec[] = [
  { from: "tarif", to: "antrag", kind: "flow", label: "Angebot übernehmen" },
  { from: "antrag", to: "kern", kind: "flow", label: "vergibt Vertragsnummer" },
  { from: "kern", to: "tarif", kind: "reuse" },
  { from: "kern", to: "zahlung", kind: "reuse" },
  { from: "kern", to: "aenderung", kind: "reuse" },
  { from: "kern", to: "ende", kind: "reuse" },
];

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/** Kopfzeile (Titel + Stats) innerhalb einer Säule, in Welt-px. */
export const PILLAR_HEADER_H = 34;
const GROUP_GAP = 5;
const PILLAR_PAD = 8;

function layoutGroups(pillar: Pillar): LaidOutGroup[] {
  const cols = pillar.kind === "core" ? 3 : 2;
  const rows = Math.ceil(pillar.groups.length / cols);
  const area: Rect = {
    x: pillar.rect.x + PILLAR_PAD,
    y: pillar.rect.y + PILLAR_HEADER_H,
    w: pillar.rect.w - 2 * PILLAR_PAD,
    h: pillar.rect.h - PILLAR_HEADER_H - PILLAR_PAD,
  };
  const cellW = (area.w - (cols - 1) * GROUP_GAP) / cols;
  const cellH = (area.h - (rows - 1) * GROUP_GAP) / rows;
  return pillar.groups.map((group, i) => ({
    ...group,
    rect: {
      x: area.x + (i % cols) * (cellW + GROUP_GAP),
      y: area.y + Math.floor(i / cols) * (cellH + GROUP_GAP),
      w: cellW,
      h: cellH,
    },
  }));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Achsenparallele Rechteck-Überlappung (für Kamera-Sichtbarkeits-Filter). */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

/** Punkt auf dem Rand von `a`, der in Richtung `b` zeigt. */
function borderAnchor(a: Rect, b: Rect): { x: number; y: number } {
  const ca = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const cb = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const dx = cb.x - ca.x;
  const dy = cb.y - ca.y;
  if (Math.abs(dx) * a.h > Math.abs(dy) * a.w) {
    return {
      x: dx > 0 ? a.x + a.w : a.x,
      y: clamp(cb.y, a.y + 12, a.y + a.h - 12),
    };
  }
  return {
    x: clamp(cb.x, a.x + 20, a.x + a.w - 20),
    y: dy > 0 ? a.y + a.h : a.y,
  };
}

function layoutEdges(pillarById: Map<string, Pillar>): MapEdge[] {
  return EDGES.flatMap((spec) => {
    const from = pillarById.get(spec.from);
    const to = pillarById.get(spec.to);
    if (!from || !to) return [];
    const p1 = borderAnchor(from.rect, to.rect);
    const p2 = borderAnchor(to.rect, from.rect);
    return [{ ...spec, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }];
  });
}

function layoutMap(): LaidOutMap {
  const world: Rect = { x: 0, y: 0, w: 1000, h: 430 };
  const pillarById = new Map(PILLARS.map((p) => [p.id, p]));
  const pillars = PILLARS.map((p) => ({ ...p, groups: layoutGroups(p) }));

  const targets: Record<string, Rect> = { overview: world };
  for (const p of pillars) targets[`pillar:${p.id}`] = p.rect;
  for (const plate of PLATES) targets[plate.id] = plate.rect;

  return {
    world,
    pillars,
    plates: PLATES,
    edges: layoutEdges(pillarById),
    targets,
  };
}

export const MAP: LaidOutMap = layoutMap();
