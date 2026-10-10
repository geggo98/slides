import type { LanguageRegistration } from "shiki";

// Eigene TextMate-Grammatik für TraceQL (Tempo). Deckt Spansets, Intrinsics,
// Attributpfade mit Scope, Vergleiche, Dauern und Strings ab.

const INTRINSICS = [
  "childCount",
  "duration",
  "kind",
  "name",
  "rootName",
  "rootServiceName",
  "status",
  "statusMessage",
  "traceDuration",
].join("|");

export const traceql: LanguageRegistration = {
  name: "traceql",
  scopeName: "source.traceql",
  patterns: [
    { name: "comment.line.double-slash.traceql", match: "//.*$" },
    {
      name: "string.quoted.double.traceql",
      begin: '"',
      end: '"',
      patterns: [{ name: "constant.character.escape.traceql", match: "\\\\." }],
    },
    { name: "string.quoted.other.traceql", begin: "`", end: "`" },
    // matches:  2s   500ms   1h30m
    {
      name: "constant.numeric.duration.traceql",
      match: "\\b(?:\\d+(?:ns|us|µs|ms|s|m|h))+\\b",
    },
    {
      name: "constant.numeric.traceql",
      match: "\\b\\d+(?:\\.\\d+)?\\b",
    },
    // matches:  span.db.system   resource.service.name   .http.status_code
    {
      match:
        "\\b(span|resource|event|link|instrumentation|parent)(\\.[a-zA-Z_][\\w.-]*)",
      captures: {
        1: { name: "storage.modifier.scope.traceql" },
        2: { name: "variable.other.attribute.traceql" },
      },
    },
    { name: "variable.other.attribute.traceql", match: "\\.[a-zA-Z_][\\w.-]*" },
    {
      name: "constant.language.status.traceql",
      match: "\\b(?:ok|error|unset)\\b",
    },
    { name: "constant.language.traceql", match: "\\b(?:true|false|nil)\\b" },
    {
      name: "keyword.control.traceql",
      match:
        "\\b(?:by|select|with|count|avg|min|max|sum|coalesce|rate|quantile_over_time|histogram_over_time|count_over_time)\\b(?=\\s*\\()|\\b(?:and|or|not)\\b",
    },
    {
      name: "support.variable.intrinsic.traceql",
      match: `\\b(?:${INTRINSICS})\\b`,
    },
    // Spanset-Operatoren (>>, ~, |) und Vergleiche
    {
      name: "keyword.operator.traceql",
      match: "&&|\\|\\||=~|!~|!=|>=|<=|>>|[=<>~|!]",
    },
    { name: "punctuation.section.spanset.traceql", match: "[{}()]" },
  ],
} as LanguageRegistration;
