---
theme: default
title: "BiPRO RNext — OpenAPI-Schnittstellen, die LLM-Agents verstehen"
info: |
  Ein Vorschlag für RNext-Referenz-APIs: klare Strukturen und klarer
  Datenfluss statt spekulativer Allgemeinheit — und warum das
  Schnittstellen-Erstellung, -Test und -Pflege für LLM-Agents zugänglich macht.
monaco: true
mdc: true
transition: slide-left
colorSchema: auto
fonts:
  sans: Inter
  mono: 0xProto
hideInToc: true
---

# BiPRO RNext — OpenAPI-Schnittstellen, die LLM-Agents verstehen

Vom generischen SOAP-Objektbaum zu klaren Strukturen und klarem Datenfluss

<div class="mt-8 text-sm opacity-60">

Zielgruppe: Dev- und Architektur-Runde — BiPRO-Vorwissen nicht erforderlich

</div>

<!--
- Es geht um einen konkreten Vorschlag: herstellerneutrale RNext-Referenz-APIs als Soll-Bild.
- Die Norm selbst ist geschützt — alle Beispiele hier sind nachempfunden, keine Original-Inhalte.
- Roter Faden: Was macht eine Schnittstelle maschinen-erschließbar?
-->

---
layout: center
hideInToc: true
---

# Kurzfassung

<div class="text-left mt-8 max-w-3xl mx-auto space-y-4">

1. **RClassic-Schemas sagen fast nichts aus.** Beinahe jedes Feld ist optional, Request und Response teilen denselben Objektbaum — das Wissen steckt in Prosa und Domänenerfahrung.
2. **RNext kann das Schema zur Wahrheit machen.** Schema-valide = fachlich verarbeitbar: strikte Pflichtfelder, Fallunterscheidungen im Typsystem.
3. **In ≠ Out.** Getrennte Eingabe- und Ausgabe-Objekte; berechnete Werte existieren nur in der Antwort. Der Datenfluss steht in der Spezifikation, nicht im Kopf.
4. **Genau das macht die Norm für LLM-Agents erschließbar** — Requests bauen, Antworten prüfen, Tests generieren: ohne spekulative Allgemeinheit, die erst durch Domänenwissen gefüllt werden muss.

</div>

<!--
- Diese vier Thesen sind der Vortrag. Am Ende kommen sie belegt zurück.
-->

---
hideInToc: true
---

# Inhalt

<Toc mode="all" minDepth="1" maxDepth="1" columns="2" listClass="!list-none !pl-0" />

---
layout: section
---

# 1. BiPRO als Rahmen

Normen, Rollen und der Status quo mit RClassic

---
layout: section
---

# 2. Spekulative Allgemeinheit

Warum generische Schemas niemandem helfen — Mensch wie Maschine

---
layout: section
---

# 3. Der RNext-Vorschlag: Bausteine

Pflichtfelder, In/Out-Trennung, Varianten, Fehler, Auth, Traceability

---
layout: section
---

# 4. Die Komponenten-Landkarte

Welche Bausteine wo verwendet werden — interaktiv, zoombar

---
layout: section
---

# 5. Ein Geschäftsvorfall, drei APIs

Datenfluss end-to-end: Tarifierung → Antrag → eVB

---
layout: section
---

# 6. Schnittstellen für LLM-Agents

Warum klare Strukturen der eigentliche Hebel sind

---
hideInToc: true
---

# Fazit

_(Platzhalter — die vier Thesen, belegt)_

---
hideInToc: true
---

# Referenzen

_(Platzhalter — BiPRO e.V., RFC 7807, RFC 8705, OpenAPI 3.1, Querverweise)_

---
layout: end
hideInToc: true
---

# Danke!
