import { beforeAll, describe, expect, it } from "vitest";
import { createHighlighter, type HighlighterGeneric } from "shiki";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { queryLangs } from "../index";

// Slidev highlights with the JavaScript regex engine, so the grammars are
// tested with it, not with Oniguruma. The samples are queries the monitoring
// deck actually shows.

type Hl = HighlighterGeneric<string, string>;
let hl: Hl;

beforeAll(async () => {
  hl = (await createHighlighter({
    themes: ["vitesse-light"],
    langs: queryLangs,
    engine: createJavaScriptRegexEngine(),
  })) as Hl;
});

/** Scope of the first token whose text is exactly `text`, or undefined. */
function scopeOf(lang: string, code: string, text: string): string | undefined {
  const { tokens } = hl.codeToTokens(code, {
    lang,
    theme: "vitesse-light",
    includeExplanation: "scopeName",
  });
  for (const line of tokens)
    for (const t of line)
      for (const e of t.explanation ?? [])
        if (e.content === text)
          return e.scopes.map((s) => s.scopeName).join(" ");
  return undefined;
}

const P = {
  latency: `# P99 Latenz für erfolgreiche interne Requests
histogram_quantile(0.99,
  sum(rate(http_server_requests_seconds_bucket{status=~"2.."}[5m])) by (le, uri))`,
  count: `sum(rate(http_requests_count[5m]))`,
};

describe("promql", () => {
  it("scopes comments, functions, aggregators, durations, matchers", () => {
    expect(
      scopeOf(
        "promql",
        P.latency,
        "# P99 Latenz für erfolgreiche interne Requests",
      ),
    ).toContain("comment.line");
    expect(scopeOf("promql", P.latency, "histogram_quantile")).toContain(
      "support.function",
    );
    expect(scopeOf("promql", P.latency, "rate")).toContain("support.function");
    expect(scopeOf("promql", P.latency, "sum")).toContain(
      "keyword.other.aggregator",
    );
    expect(scopeOf("promql", P.latency, "5m")).toContain(
      "constant.numeric.duration",
    );
    expect(scopeOf("promql", P.latency, "status")).toContain(
      "variable.other.label",
    );
    expect(scopeOf("promql", P.latency, "=~")).toContain(
      "keyword.operator.matcher",
    );
    expect(scopeOf("promql", P.latency, "by")).toContain(
      "keyword.other.modifier",
    );
    expect(scopeOf("promql", P.latency, "le")).toContain(
      "variable.other.label",
    );
    expect(scopeOf("promql", P.latency, "0.99")).toContain("constant.numeric");
  });

  it("keeps `count` inside a metric name a metric", () => {
    expect(scopeOf("promql", P.count, "http_requests_count")).toContain(
      "variable.other.metric",
    );
    expect(scopeOf("promql", P.count, "count")).toBeUndefined();
  });

  it("scopes binary operators and bare metrics", () => {
    const q = "tomcat_threads_busy_threads / tomcat_threads_config_max_threads";
    expect(scopeOf("promql", q, "/")).toContain("keyword.operator");
    expect(scopeOf("promql", q, "tomcat_threads_busy_threads")).toContain(
      "variable.other.metric",
    );
  });
});

describe("logql", () => {
  const q = `{namespace="production", app="quote-service"} | json | level="error"
sum by (app) (rate({namespace="production"} |= "error" [5m]))
{app="quote-service"} |~ "(?i)(NullPointerException)"`;
  it("scopes stream labels, pipe stages and line filters", () => {
    expect(scopeOf("logql", q, "namespace")).toContain("variable.other.label");
    expect(scopeOf("logql", q, "json")).toContain("support.function.stage");
    expect(scopeOf("logql", q, "|=")).toContain("keyword.operator.line-filter");
    expect(scopeOf("logql", q, "|~")).toContain("keyword.operator.line-filter");
    expect(scopeOf("logql", q, "rate")).toContain("support.function");
    expect(scopeOf("logql", q, "sum")).toContain("keyword.other.aggregator");
    expect(scopeOf("logql", q, "5m")).toContain("constant.numeric.duration");
    expect(scopeOf("logql", q, "level")).toContain("variable.other.label");
  });
});

describe("traceql", () => {
  const q = `// Langsame DB-Calls
{ span.db.system = "postgresql" && duration > 500ms }
{ resource.service.name = "quote-service" && status = error }`;
  it("scopes comments, intrinsics, attributes, durations, status", () => {
    expect(scopeOf("traceql", q, "// Langsame DB-Calls")).toContain(
      "comment.line",
    );
    expect(scopeOf("traceql", q, "duration")).toContain(
      "support.variable.intrinsic",
    );
    expect(scopeOf("traceql", q, "span")).toContain("storage.modifier.scope");
    expect(scopeOf("traceql", q, ".db.system")).toContain(
      "variable.other.attribute",
    );
    expect(scopeOf("traceql", q, "500ms")).toContain(
      "constant.numeric.duration",
    );
    expect(scopeOf("traceql", q, "error")).toContain(
      "constant.language.status",
    );
    expect(scopeOf("traceql", q, "&&")).toContain("keyword.operator");
  });
});

describe("control", () => {
  // A check that cannot fail would pass on plain text as well.
  it("plain text yields none of the language scopes", () => {
    expect(scopeOf("text", P.latency, "histogram_quantile")).toBeUndefined();
    expect(scopeOf("text", P.latency, "5m")).toBeUndefined();
  });
});
