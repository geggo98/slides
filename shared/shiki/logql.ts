import type { LanguageRegistration } from "shiki";
import {
  aggregator,
  comment,
  duration,
  functionCall,
  grouping,
  logicalOperator,
  modifier,
  number,
  operator,
  range,
  selector,
  strings,
} from "./promql";

// Eigene TextMate-Grammatik für LogQL. Stream-Selektor, Range, Aggregation und
// Funktionen kommen aus der PromQL-Grammatik; dazu Zeilenfilter und
// Pipeline-Stufen.

const STAGES = [
  "decolorize",
  "drop",
  "json",
  "keep",
  "label_format",
  "line_format",
  "logfmt",
  "pattern",
  "regexp",
  "unpack",
  "unwrap",
].join("|");

export const logql: LanguageRegistration = {
  name: "logql",
  scopeName: "source.logql",
  patterns: [
    comment,
    strings,
    range,
    selector,
    grouping,
    // matches:  |= "error"   != "debug"   |~ "(?i)panic"   !~ "x"
    // Vor dem Operator, damit `!=` und `|=` nicht als PromQL-Operator enden.
    {
      name: "keyword.operator.line-filter.logql",
      match: "\\|=|\\|~|!=|!~",
    },
    // matches:  | json   | logfmt   | line_format
    {
      match: `(\\|)\\s*\\b(${STAGES})\\b`,
      captures: {
        1: { name: "keyword.operator.pipe.logql" },
        2: { name: "support.function.stage.logql" },
      },
    },
    { name: "keyword.operator.pipe.logql", match: "\\|" },
    modifier,
    aggregator,
    functionCall(["bytes_over_time", "bytes_rate", "rate_counter"]),
    logicalOperator,
    duration,
    number,
    operator,
    // Label-Filter nach einer Stufe: level="error", status>=500
    {
      name: "variable.other.label.logql",
      match: "\\b[a-zA-Z_][a-zA-Z0-9_]*\\b",
    },
  ],
} as LanguageRegistration;
