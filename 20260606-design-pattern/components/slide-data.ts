// Zentrale Registry aller Pattern-Tab-Datensätze. PatternTabs.vue zieht über
// `name` den passenden Eintrag (PATTERNS[name].tabs). Inhalte je Sektion in data/.
import { schicht1 } from "./data/schicht1.ts";
import { builder } from "./data/builder.ts";
import { lazyInit } from "./data/lazyinit.ts";
import { schicht23 } from "./data/schicht23.ts";
import { meta } from "./data/meta.ts";

export const PATTERNS = {
  ...schicht1,
  ...builder,
  ...lazyInit,
  ...schicht23,
  ...meta,
};
