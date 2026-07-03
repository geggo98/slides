/**
 * Daten für die MatrixPivot-Folie „Agent-Aufgaben × Norm-Generation".
 * Alle Aussagen sind generisch — keine Inhalte der geschützten Norm.
 */

export const AGENT_TASKS_MATRIX = {
  dimensions: [
    { key: "request", label: "Gültigen Request bauen" },
    { key: "validate", label: "Antwort validieren" },
    { key: "errors", label: "Fehler behandeln" },
    { key: "refs", label: "Bestand referenzieren" },
    { key: "tests", label: "Testfälle generieren" },
    { key: "docs", label: "Doku verstehen" },
  ],
  tools: [
    {
      key: "rclassic",
      name: "RClassic (SOAP/XSD)",
      cells: {
        request: {
          mark: "prosa",
          detail:
            "Fast jedes Feld ist optional — welche Kombination fachlich gültig ist, steht in Norm-Prosa und Domänenwissen, nicht im Schema.",
        },
        validate: {
          mark: "prosa",
          detail:
            "Anfrage und Antwort teilen denselben Objektbaum; was die Antwort garantiert enthält, ist nicht maschinenlesbar.",
        },
        errors: {
          mark: "teils",
          detail:
            "Status- und Meldungsstrukturen existieren, sind aber je Service unterschiedlich detailliert und interpretationsbedürftig.",
        },
        refs: {
          mark: "teils",
          detail:
            "IDs sind vorhanden — aber welche Referenz wo zitiert werden darf, erklärt nur die Dokumentation.",
        },
        tests: {
          mark: "prosa",
          detail:
            "Aus einem Schema, das fast alles erlaubt, lassen sich keine fachlich validen Testfälle ableiten.",
        },
        docs: {
          mark: "teils",
          detail:
            "Norm-PDFs sind für Menschen geschrieben und nicht maschinenlesbar mit den Schemas verknüpft.",
        },
      },
    },
    {
      key: "rnext",
      name: "RNext (Vorschlag)",
      color: "#1E4267",
      cells: {
        request: {
          mark: "schema",
          detail:
            "Strikte required-Listen + diskriminierte Varianten: schema-valide = fachlich verarbeitbar. Ein Generator bekommt sofort Feedback.",
        },
        validate: {
          mark: "schema",
          detail:
            "Eigene Output-Schemas beschreiben exakt, was zurückkommt — inklusive Status-Varianten des Ergebnisses.",
        },
        errors: {
          mark: "schema",
          detail:
            "Ein Fehlerformat (RFC 7807) in allen APIs — Fehler sind strukturierte Daten, keine Prosa.",
        },
        refs: {
          mark: "schema",
          detail:
            "Vom VU vergebene Referenzen sind als Eingabe-Felder modelliert — der Kreislauf „Ausgabe wird später Eingabe“ steht im Schema.",
        },
        tests: {
          mark: "schema",
          detail:
            "Aus required, Varianten und durchgängigen examples lassen sich valide Requests und Property-Tests generieren.",
        },
        docs: {
          mark: "schema",
          detail:
            "Bilinguale Beschreibungen und Norm-/GeVo-Extensions hängen direkt an jeder Operation — ideal als Prompt-Kontext.",
        },
      },
    },
  ],
};

export const AGENT_TASKS_LEGEND = [
  { mark: "schema", label: "aus der Spezifikation ableitbar" },
  { mark: "teils", label: "teilweise — Rest ist Domänenwissen" },
  { mark: "prosa", label: "nur mit Domänenwissen / Prosa" },
];

export const AGENT_TASKS_MARKSCHEME = {
  schema: { symbol: "✓", light: "#27500A", dark: "#80c050" },
  teils: { symbol: "◐", light: "#BA7517", dark: "#e0a030" },
  prosa: { symbol: "✗", light: "#791f1f", dark: "#f09595" },
};
