// PromQL, LogQL und TraceQL kennt Shiki nicht. Die Grammatiken kommen aus
// shared/shiki und gelten für ```promql-Fences (Build) und für QueryCode.vue
// (Laufzeit); Slidev lädt dieses Setup für beides.
import { defineShikiSetup } from "@slidev/types";
import { queryLangs } from "../../shared/shiki";

export default defineShikiSetup(() => ({ langs: queryLangs }));
