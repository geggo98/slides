<script setup lang="ts">
import { computed } from "vue";
import { useDarkMode } from "@slidev/client";
import { MCP_OPT_STRATEGIES } from "./chartData";

const { isDark } = useDarkMode();

const P = computed(() => {
  const d = isDark.value;
  return {
    bg: d ? "#14141c" : "#ffffff",
    headerBg: d ? "#1a1a24" : "#f4f4f5",
    border: d ? "#2a2a35" : "#e4e4e7",
    text: d ? "#c8c8d0" : "#3f3f46",
    hoverBg: d ? "#181820" : "#f9fafb",
    badgeGreenBg: d ? "rgba(74,222,128,0.15)" : "rgba(22,163,74,0.1)",
    badgeGreenText: d ? "#86efac" : "#16a34a",
    badgeYellowBg: d ? "rgba(250,204,21,0.15)" : "rgba(202,138,4,0.1)",
    badgeYellowText: d ? "#fde047" : "#ca8a04",
    badgeRedBg: d ? "rgba(248,113,113,0.15)" : "rgba(220,38,38,0.1)",
    badgeRedText: d ? "#fca5a5" : "#dc2626",
    badgeGrayBg: d ? "rgba(140,140,160,0.15)" : "rgba(113,113,122,0.1)",
    badgeGrayText: d ? "#8a8a9a" : "#71717a",
    barBg: d ? "#2a2a35" : "#e4e4e7",
    barFill: d ? "#4ade80" : "#16a34a",
  };
});

function lazyBadgeClass(v: string) {
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
            <span :style="{ color: s.color }">{{ s.agent }}</span>
          </td>
          <td>
            <span class="badge" :class="lazyBadgeClass(s.lazyLoading)">{{
              lazyBadgeText(s.lazyLoading)
            }}</span>
          </td>
          <td>
            <span class="badge" :class="s.allowDeny ? 'green' : 'red'">{{
              s.allowDeny ? "Ja" : "Nein"
            }}</span>
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
.badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
}
.badge.green {
  background: v-bind("P.badgeGreenBg");
  color: v-bind("P.badgeGreenText");
}
.badge.yellow {
  background: v-bind("P.badgeYellowBg");
  color: v-bind("P.badgeYellowText");
}
.badge.red {
  background: v-bind("P.badgeRedBg");
  color: v-bind("P.badgeRedText");
}
.badge.gray {
  background: v-bind("P.badgeGrayBg");
  color: v-bind("P.badgeGrayText");
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
  background: v-bind("P.barBg");
  border-radius: 3px;
  max-width: 60px;
}
.reduction-fill {
  height: 100%;
  background: v-bind("P.barFill");
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
