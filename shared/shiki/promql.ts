import type { LanguageRegistration } from "shiki";

// Eigene TextMate-Grammatik für PromQL, nur für Shiki (JS-Regex-Engine, kein
// Oniguruma). Sie deckt ab, was die Decks zeigen, nicht die ganze Sprache.
// Die Bausteine sind exportiert, damit LogQL sie wiederverwendet, statt über
// Scope-Grenzen hinweg zu includen.

type Rule = NonNullable<LanguageRegistration["patterns"]>[number];

const words = (list: readonly string[]): string => list.join("|");

const FUNCTIONS = [
  "abs",
  "absent",
  "absent_over_time",
  "acos",
  "acosh",
  "asin",
  "asinh",
  "atan",
  "atanh",
  "avg_over_time",
  "ceil",
  "changes",
  "clamp",
  "clamp_max",
  "clamp_min",
  "cos",
  "cosh",
  "count_over_time",
  "day_of_month",
  "day_of_week",
  "day_of_year",
  "days_in_month",
  "deg",
  "delta",
  "deriv",
  "exp",
  "floor",
  "histogram_avg",
  "histogram_count",
  "histogram_fraction",
  "histogram_quantile",
  "histogram_stddev",
  "histogram_stdvar",
  "histogram_sum",
  "holt_winters",
  "hour",
  "idelta",
  "increase",
  "irate",
  "label_join",
  "label_replace",
  "last_over_time",
  "ln",
  "log10",
  "log2",
  "max_over_time",
  "min_over_time",
  "minute",
  "month",
  "pi",
  "predict_linear",
  "present_over_time",
  "quantile_over_time",
  "rad",
  "rate",
  "resets",
  "round",
  "scalar",
  "sgn",
  "sin",
  "sinh",
  "sort",
  "sort_desc",
  "sqrt",
  "stddev_over_time",
  "stdvar_over_time",
  "sum_over_time",
  "tan",
  "tanh",
  "time",
  "timestamp",
  "vector",
  "year",
] as const;

const AGGREGATORS = [
  "avg",
  "bottomk",
  "count",
  "count_values",
  "group",
  "limitk",
  "max",
  "min",
  "quantile",
  "stddev",
  "stdvar",
  "sum",
  "topk",
] as const;

export const comment: Rule = {
  name: "comment.line.number-sign.promql",
  match: "#.*$",
};

export const strings: Rule = {
  patterns: [
    {
      name: "string.quoted.double.promql",
      begin: '"',
      end: '"',
      patterns: [{ name: "constant.character.escape.promql", match: "\\\\." }],
    },
    {
      name: "string.quoted.single.promql",
      begin: "'",
      end: "'",
      patterns: [{ name: "constant.character.escape.promql", match: "\\\\." }],
    },
    { name: "string.quoted.other.promql", begin: "`", end: "`" },
  ],
};

// matches:  5m   500ms   1h30m   2.5   1e3
export const duration: Rule = {
  name: "constant.numeric.duration.promql",
  match: "\\b(?:\\d+(?:ms|s|m|h|d|w|y))+\\b",
};
export const number: Rule = {
  name: "constant.numeric.promql",
  match: "\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b",
};

// matches:  [5m]   [30m:1m]
export const range: Rule = {
  begin: "\\[",
  end: "\\]",
  beginCaptures: { 0: { name: "punctuation.section.range.begin.promql" } },
  endCaptures: { 0: { name: "punctuation.section.range.end.promql" } },
  patterns: [duration, { name: "punctuation.separator.promql", match: ":" }],
};

// matches:  {status=~"2..", uri="/x"}   {container!=""}
export const selector: Rule = {
  begin: "\\{",
  end: "\\}",
  beginCaptures: { 0: { name: "punctuation.section.selector.begin.promql" } },
  endCaptures: { 0: { name: "punctuation.section.selector.end.promql" } },
  patterns: [
    strings,
    { name: "keyword.operator.matcher.promql", match: "=~|!~|!=|=" },
    { name: "variable.other.label.promql", match: "[a-zA-Z_][a-zA-Z0-9_]*" },
    { name: "punctuation.separator.promql", match: "," },
  ],
};

// matches:  by (le, uri)   without (pod)   on (instance)
export const grouping: Rule = {
  begin: "\\b(by|without|on|ignoring|group_left|group_right)\\b\\s*(\\()",
  end: "\\)",
  beginCaptures: {
    1: { name: "keyword.other.modifier.promql" },
    2: { name: "punctuation.section.group.begin.promql" },
  },
  endCaptures: { 0: { name: "punctuation.section.group.end.promql" } },
  patterns: [
    { name: "variable.other.label.promql", match: "[a-zA-Z_][a-zA-Z0-9_]*" },
    { name: "punctuation.separator.promql", match: "," },
  ],
};

export const modifier: Rule = {
  name: "keyword.other.modifier.promql",
  match: "\\b(?:bool|offset|by|without|on|ignoring|group_left|group_right)\\b",
};

// Aggregatoren nur vor `(`, `by` oder `without`: `count` in
// `http_requests_count` bleibt dadurch ein Metrikname.
export const aggregator: Rule = {
  name: "keyword.other.aggregator.promql",
  match: `\\b(?:${words(AGGREGATORS)})\\b(?=\\s*(?:\\(|by\\b|without\\b))`,
};

export const functionCall = (extra: readonly string[] = []): Rule => ({
  name: "support.function.promql",
  match: `\\b(?:${words([...FUNCTIONS, ...extra])})\\b(?=\\s*\\()`,
});

export const logicalOperator: Rule = {
  name: "keyword.operator.logical.promql",
  match: "\\b(?:and|or|unless)\\b",
};
export const operator: Rule = {
  name: "keyword.operator.promql",
  match: "==|!=|>=|<=|[-+*/%^<>]",
};
export const metric: Rule = {
  name: "variable.other.metric.promql",
  match: "\\b[a-zA-Z_:][a-zA-Z0-9_:]*\\b",
};

export const promql: LanguageRegistration = {
  name: "promql",
  scopeName: "source.promql",
  patterns: [
    comment,
    strings,
    range,
    selector,
    grouping,
    modifier,
    aggregator,
    functionCall(),
    logicalOperator,
    duration,
    number,
    operator,
    metric,
  ],
} as LanguageRegistration;
