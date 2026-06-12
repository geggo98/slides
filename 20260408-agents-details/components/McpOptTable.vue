<script setup lang="ts">
import { useDarkMode } from "@slidev/client";
import Badge from "./Badge.vue";
import { MCP_OPT_STRATEGIES } from "./chartData";
import { resolveColor } from "./chartConfig";
import { useDeckPalette } from "./palette";

const { isDark } = useDarkMode();
const P = useDeckPalette();

function lazyBadgeTone(v: string) {
  if (v === "auto") return "green";
  if (v === "file") return "yellow";
  if (v === "n/a") return "gray";
  return "red";
}

function lazyBadgeText(v: string) {
  if (v === "auto") return "Auto";
  if (v === "file") return "Datei";
  if (v === "n/a") return "N/A";
  return "Nein";
}
</script>

<template>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Agent</th>
          <th>Lazy Loading</th>
          <th>Allow/Deny</th>
          <th>Limit</th>
          <th>Reduktion</th>
          <th>Ansatz</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="s in MCP_OPT_STRATEGIES" :key="s.agent">
          <td class="agent-name">
            <span :style="{ color: resolveColor(s.color, isDark) }">{{
              s.agent
            }}</span>
          </td>
          <td>
            <Badge :tone="lazyBadgeTone(s.lazyLoading)">{{
              lazyBadgeText(s.lazyLoading)
            }}</Badge>
          </td>
          <td>
            <Badge :tone="s.allowDeny ? 'green' : 'red'">{{
              s.allowDeny ? "Ja" : "Nein"
            }}</Badge>
          </td>
          <td>{{ s.hardLimit ?? "—" }}</td>
          <td>
            <template v-if="s.measuredReduction != null">
              <div class="reduction-cell">
                <span class="reduction-value">{{ s.measuredReduction }}%</span>
                <div class="reduction-bar">
                  <div
                    class="reduction-fill"
                    :style="{ width: s.measuredReduction + '%' }"
                  />
                </div>
              </div>
            </template>
            <template v-else>
              <span class="no-data">—</span>
            </template>
          </td>
          <td class="approach">{{ s.approach }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.table-wrap {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  background: v-bind("P.bg");
  border: 1px solid v-bind("P.border");
  border-radius: 8px;
  overflow: hidden;
  font-size: 11px;
}
th,
td {
  padding: 7px 8px;
  text-align: left;
  border-bottom: 1px solid v-bind("P.border");
}
th {
  background: v-bind("P.headerBg");
  font-weight: 600;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: v-bind("P.text");
}
td {
  color: v-bind("P.text");
}
.agent-name {
  font-weight: 600;
}
tr:last-child td {
  border-bottom: none;
}
tr:hover td {
  background: v-bind("P.hoverBg");
}
.reduction-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}
.reduction-value {
  font-weight: 700;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  color: v-bind("P.badgeGreenText");
  min-width: 32px;
}
.reduction-bar {
  flex: 1;
  height: 6px;
  background: v-bind("P.border");
  border-radius: 3px;
  max-width: 60px;
}
.reduction-fill {
  height: 100%;
  background: v-bind("P.accentGreen");
  border-radius: 3px;
  transition: width 0.3s;
}
.no-data {
  color: v-bind("P.badgeGrayText");
}
.approach {
  font-size: 10px;
  max-width: 200px;
}
</style>
