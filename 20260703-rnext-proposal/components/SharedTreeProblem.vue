<template>
  <div class="stp-wrap">
    <svg
      viewBox="0 0 680 250"
      role="img"
      aria-label="Ein Objektbaum dient als Anfrage und Antwort zugleich"
    >
      <defs>
        <marker
          id="stpArr"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path
            d="M2 1L8 5L2 9"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </marker>
      </defs>

      <g class="card blue">
        <rect x="50" y="14" width="210" height="58" rx="10" />
        <text x="155" y="38" text-anchor="middle" class="t-h">Anfrage</text>
        <text x="155" y="58" text-anchor="middle" class="t-s">
          Baum: Pflicht (1..1)
        </text>
      </g>

      <g class="card green">
        <rect x="420" y="14" width="210" height="58" rx="10" />
        <text x="525" y="38" text-anchor="middle" class="t-h">Antwort</text>
        <text x="525" y="58" text-anchor="middle" class="t-s">
          Baum: optional (0..1)
        </text>
      </g>

      <line
        x1="185"
        y1="72"
        x2="290"
        y2="118"
        class="line"
        marker-end="url(#stpArr)"
      />
      <line
        x1="495"
        y1="72"
        x2="390"
        y2="118"
        class="line"
        marker-end="url(#stpArr)"
      />

      <g class="card gray">
        <rect x="170" y="122" width="340" height="112" rx="10" />
        <text x="340" y="144" text-anchor="middle" class="t-h">
          Derselbe generische Objektbaum
        </text>
        <text x="240" y="168" class="t-f">– Partner (0..∞)</text>
        <text x="240" y="186" class="t-f">– Fahrzeug (0..1)</text>
        <text x="240" y="204" class="t-f">– Zusatzdaten (0..∞)</text>
        <text x="390" y="168" class="t-f">– Deckungen (0..∞)</text>
        <text x="390" y="186" class="t-f">– Preise (0..1)</text>
        <text x="390" y="204" class="t-f">– …</text>
        <text x="340" y="226" text-anchor="middle" class="t-warn">
          fast alles minOccurs="0"
        </text>
      </g>
    </svg>
    <p class="caption">
      Preise in der <em>Anfrage</em>? Partner nur in der <em>Antwort</em>? Das
      Schema erlaubt beides — welche Felder man füllen muss und welche
      zurückkommen, steht nur in Prosa und Implementierung.
    </p>
  </div>
</template>

<style scoped>
.stp-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.stp-wrap svg {
  width: 100%;
  height: auto;
  max-height: 310px;
}
.card rect {
  fill: var(--color-background-secondary);
  stroke: var(--color-border-tertiary);
  stroke-width: 0.5;
}
.card.blue rect {
  fill: var(--color-background-info);
  stroke: var(--color-border-info);
}
.card.green rect {
  fill: var(--color-background-success);
  stroke: var(--color-border-success);
}
.card.gray rect {
  fill: var(--color-background-tertiary);
  stroke: var(--color-border-secondary);
}
.t-h {
  font-size: 14px;
  font-weight: 600;
  fill: var(--color-text-primary);
}
.t-s {
  font-size: 12px;
  fill: var(--color-text-secondary);
}
.t-f {
  font-size: 12px;
  fill: var(--color-text-primary);
  font-family: var(--font-mono);
}
.t-warn {
  font-size: 11px;
  font-style: italic;
  fill: var(--color-text-danger);
}
.line {
  stroke: var(--color-text-tertiary);
  stroke-width: 1.2;
  color: var(--color-text-tertiary);
}
.caption {
  margin: 0;
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--color-text-secondary);
}
</style>
