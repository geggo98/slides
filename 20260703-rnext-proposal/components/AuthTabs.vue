<script setup lang="ts">
import { ref } from "vue";
import Tabs from "@shared/components/Tabs.vue";

const active = ref("oauth2");

const tabs = [
  { key: "oauth2", label: "OAuth 2.0" },
  { key: "oidc", label: "OpenID Connect" },
  { key: "mtls", label: "Mutual TLS" },
  { key: "bridge", label: "RClassic-Brücke" },
];

const content: Record<string, string[]> = {
  oauth2: [
    "Client-Credentials-Flow: Server-zu-Server-Token mit read/write-Scopes.",
    "Token-URL und Scope-Zuschnitt sind bewusst Platzhalter — jeder Versicherer setzt seine realen Endpunkte ein.",
    "Der Standard-Weg für Maschinen-Clients — und damit für Agents.",
  ],
  oidc: [
    "Discovery über die OpenID-Konfiguration des Authorization-Servers.",
    "Alternative bzw. Ergänzung zum reinen OAuth2-Flow.",
  ],
  mtls: [
    "Client-Zertifikat auf Transportebene.",
    "Kombination OAuth2 ∧ mTLS = zertifikatsgebundene Tokens (RFC 8705): ein abgegriffenes Token ist ohne das Zertifikat wertlos.",
    "Die Bindung ist eine optionale, stärkere Variante — sie wird nicht erzwungen.",
  ],
  bridge: [
    "Brücke zur klassischen RClassic-Authentifizierung für hybride Bestände.",
    "Ermöglicht schrittweise Migration statt Big Bang.",
  ],
};
</script>

<template>
  <Tabs v-model="active" :tabs="tabs" aria-label="Authentifizierungsverfahren">
    <ul :key="active" class="auth-list">
      <li v-for="p in content[active]" :key="p">{{ p }}</li>
    </ul>
  </Tabs>
</template>

<style scoped>
.auth-list {
  margin: 10px 4px 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 15px;
  color: var(--color-text-primary);
}
</style>
