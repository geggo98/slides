<!--
  Rendert genau ein Timeline-Event des Agent-Lauf-Simulators mit der passenden
  brainless-Komponente des aktiven Vendors (Claude Code bzw. Codex CLI).
  Terminal-UI-Komponenten: Port von https://github.com/theswerd/brainless
  (Ben Swerdlow, MIT) — siehe shared/components/brainless/README.md.
-->
<script setup lang="ts">
import ClaudeDiff from "@shared/components/brainless/claude/ClaudeDiff.vue";
import ClaudeHeader from "@shared/components/brainless/claude/ClaudeHeader.vue";
import ClaudeMessage from "@shared/components/brainless/claude/ClaudeMessage.vue";
import ClaudePrompt from "@shared/components/brainless/claude/ClaudePrompt.vue";
import ClaudeThinking from "@shared/components/brainless/claude/ClaudeThinking.vue";
import ClaudeTodoList from "@shared/components/brainless/claude/ClaudeTodoList.vue";
import ClaudeToolCall from "@shared/components/brainless/claude/ClaudeToolCall.vue";
import CodexDiff from "@shared/components/brainless/codex/CodexDiff.vue";
import CodexExec from "@shared/components/brainless/codex/CodexExec.vue";
import CodexHeader from "@shared/components/brainless/codex/CodexHeader.vue";
import CodexMessage from "@shared/components/brainless/codex/CodexMessage.vue";
import CodexPrompt from "@shared/components/brainless/codex/CodexPrompt.vue";
import CodexWorking from "@shared/components/brainless/codex/CodexWorking.vue";
import type { TermEvent, Vendor } from "./agentRunScript";

const props = withDefaults(
  defineProps<{ event: TermEvent; vendor: Vendor; running?: boolean }>(),
  {
    running: false,
  },
);

const CODEX_STATUS = { success: "ok", error: "error", pending: "run" } as const;

const ISSUE_URL = "https://github.com/openai/codex/issues/28058";

// Lockere Casts für die Template-Props (die Datenfelder sind bewusst weit typisiert).
function anyOf(v: unknown) {
  return v as any;
}

const isClaude = () => props.vendor === "claude";
</script>

<template>
  <ClaudeHeader
    v-if="event.kind === 'header' && isClaude()"
    compact
    :version="event.version"
    :user="event.user"
    :model="event.model"
    :org="event.org"
    :cwd="event.cwd"
    class="ev-block"
  />
  <CodexHeader
    v-else-if="event.kind === 'header'"
    :version="event.version"
    :model="event.model"
    :directory="event.cwd"
    class="ev-block"
  />

  <div v-else-if="event.kind === 'wrapper'" class="ev-wrapper">
    $ {{ event.text }}
  </div>

  <ClaudeMessage
    v-else-if="event.kind === 'user' && isClaude()"
    role="user"
    class="ev-block"
    >{{ event.text }}</ClaudeMessage
  >
  <CodexMessage
    v-else-if="event.kind === 'user'"
    role="user"
    class="ev-block"
    >{{ event.text }}</CodexMessage
  >

  <ClaudeThinking
    v-else-if="event.kind === 'thinking' && isClaude()"
    :running="running"
    :show-tokens="false"
    class="ev-block"
  />
  <CodexWorking
    v-else-if="event.kind === 'thinking'"
    :running="running"
    class="ev-block"
  />

  <ClaudeMessage
    v-else-if="event.kind === 'msg' && isClaude()"
    class="ev-block"
    >{{ event.text }}</ClaudeMessage
  >
  <CodexMessage v-else-if="event.kind === 'msg'" class="ev-block">{{
    event.text
  }}</CodexMessage>

  <ClaudeToolCall
    v-else-if="event.kind === 'tool' && isClaude()"
    :tool="event.label ?? ''"
    :arg="event.arg"
    :result="event.result ?? ''"
    :status="event.status ?? 'success'"
    class="ev-block"
  />
  <CodexExec
    v-else-if="event.kind === 'tool'"
    :command="(event.label ?? '') + (event.arg ? ' ' + event.arg : '')"
    :result="event.result"
    :status="CODEX_STATUS[event.status ?? 'success']"
    class="ev-block"
  />

  <ClaudeTodoList
    v-else-if="event.kind === 'todos' && isClaude()"
    :todos="event.todos ?? []"
    class="ev-block"
  />
  <div v-else-if="event.kind === 'todos'" class="ev-block ev-cxplan">
    <div
      v-for="(t, i) in event.todos"
      :key="i"
      class="ev-cxplan-row"
      :class="`ev-cxplan--${t.status}`"
    >
      {{
        (t.status === "done" ? "✓ " : t.status === "active" ? "→ " : "□ ") +
        t.label
      }}
    </div>
  </div>

  <ClaudeDiff
    v-else-if="event.kind === 'diff'"
    :file="event.file ?? ''"
    :summary="event.summary"
    :lines="anyOf(event.diffLines)"
    class="ev-block"
  />
  <CodexDiff
    v-else-if="event.kind === 'diffPager'"
    :lines="anyOf(event.diffLines)"
    :fill-rows="1"
    class="ev-block"
  />

  <div
    v-else-if="event.kind === 'promptPanel'"
    class="ev-block ev-panel"
    :class="{ 'ev-panel--codex': !isClaude() }"
  >
    <div class="ev-panel-title">{{ event.title }}</div>
    <div
      class="ev-panel-body"
      :class="{ 'ev-panel-body--cipher': event.encrypted }"
    >
      {{ event.text }}
    </div>
    <div v-if="event.note" class="ev-panel-note">
      🔒 {{ event.note }}
      <a
        class="ev-panel-link"
        :href="ISSUE_URL"
        target="_blank"
        rel="noreferrer"
        >openai/codex#28058</a
      >
    </div>
  </div>

  <ClaudePrompt
    v-else-if="event.kind === 'composer' && isClaude()"
    :effort="anyOf(event.effort ?? 'xhigh')"
    :mode="anyOf(event.mode ?? 'auto')"
    class="ev-block"
  />
  <CodexPrompt
    v-else-if="event.kind === 'composer'"
    :model="event.model"
    :directory="event.cwd"
    class="ev-block"
  />
</template>

<style scoped>
.ev-block {
  margin-top: 8px;
}
.ev-wrapper {
  margin-top: 8px;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 12px;
  color: #7a7a7a;
  white-space: pre-wrap;
  word-break: break-all;
}
.ev-cxplan {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 13px;
  line-height: 1.6;
  padding-left: 2ch;
}
.ev-cxplan--done {
  color: #abdfa7;
}
.ev-cxplan--active {
  color: #f6e2b7;
}
.ev-cxplan--todo {
  color: #7a7a7a;
}
.ev-panel {
  border: 1px solid #565f89;
  border-radius: 4px;
  padding: 8px 10px;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 13px;
  line-height: 1.5;
}
.ev-panel--codex {
  border-color: #3a3a3a;
}
.ev-panel-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #7dcfff;
  margin-bottom: 6px;
}
.ev-panel--codex .ev-panel-title {
  color: #5cc2e0;
}
.ev-panel-body {
  color: #c0caf5;
  overflow-wrap: break-word;
}
.ev-panel--codex .ev-panel-body {
  color: #ededed;
}
.ev-panel-body--cipher {
  color: #7a7a7a;
  word-break: break-all;
}
.ev-panel-note {
  margin-top: 8px;
  font-size: 12px;
  color: #f6e2b7;
}
.ev-panel-link {
  color: #5cc2e0;
  text-decoration: underline;
}
</style>
