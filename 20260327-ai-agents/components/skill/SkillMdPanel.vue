<script setup>
import CollapsibleSection from "./CollapsibleSection.vue";
import CrossRefLink from "./CrossRefLink.vue";
</script>

<template>
  <div>
    <CollapsibleSection
      id="directory-structure"
      title="Verzeichnisstruktur"
      :open="false"
    >
      <div class="tree-root">skill-name/</div>
      <div class="tree-list">
        <div class="tree-item">
          <span class="fname">SKILL.md</span
          ><span class="fdesc"
            >— Pflicht: YAML-Frontmatter + Markdown-Instruktionen</span
          >
        </div>
        <div class="tree-item">
          <span class="fname">scripts/</span
          ><span class="fdesc"
            >— Optional: Python, Bash, JS (Output in Kontext, nicht Code)</span
          >
        </div>
        <div class="tree-item">
          <span class="fname">references/</span
          ><span class="fdesc"
            >— Optional: API-Referenzen, Style Guides, Schemas</span
          >
        </div>
        <div class="tree-item">
          <span class="fname">assets/</span
          ><span class="fdesc">— Optional: Templates, Icons, Schriftarten</span>
        </div>
      </div>
    </CollapsibleSection>

    <CollapsibleSection
      id="yaml-frontmatter"
      title="YAML-Frontmatter — Schema"
      :open="false"
    >
      <p style="margin-bottom: 8px">
        <b>Pflichtfelder</b> <span class="badge badge-req">required</span>
      </p>
      <table class="tbl">
        <thead>
          <tr>
            <th>Feld</th>
            <th>Constraints</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>name</code></td>
            <td>
              Max 64 Zeichen. Nur Kleinbuchstaben, Zahlen, Bindestriche. =
              Verzeichnisname.
            </td>
          </tr>
          <tr>
            <td><code>description</code></td>
            <td>
              Max 1024 Zeichen. <b>Was</b> der Skill tut + <b>wann</b> er
              aktiviert werden soll.
            </td>
          </tr>
        </tbody>
      </table>
      <hr class="sep" />
      <p style="margin-bottom: 8px">
        <b>Optionale Standard-Felder</b>
        <span class="badge badge-opt">optional</span>
      </p>
      <table class="tbl">
        <thead>
          <tr>
            <th>Feld</th>
            <th>Beschreibung</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>license</code></td>
            <td>Lizenzname oder Pfad zur Lizenzdatei</td>
          </tr>
          <tr>
            <td><code>compatibility</code></td>
            <td>Max 500 Zeichen — Umgebungsanforderungen (experimentell)</td>
          </tr>
          <tr>
            <td><code>metadata</code></td>
            <td>Key-Value-Map: author, version, etc.</td>
          </tr>
          <tr>
            <td><code>allowed-tools</code></td>
            <td>Vorab genehmigte Tools (experimentell)</td>
          </tr>
        </tbody>
      </table>
      <hr class="sep" />
      <p style="margin-bottom: 8px">
        <b>Claude-Code-Erweiterungen</b>
        <span class="badge badge-ext">CC only</span>
      </p>
      <table class="tbl">
        <thead>
          <tr>
            <th>Feld</th>
            <th>Funktion</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>argument-hint</code></td>
            <td>Autovervollständigung, z.B. [issue-number]</td>
          </tr>
          <tr>
            <td><code>disable-model-invocation</code></td>
            <td>Verhindert automatisches Laden</td>
          </tr>
          <tr>
            <td><code>user-invocable</code></td>
            <td>false = verbirgt aus /slash-Menü</td>
          </tr>
          <tr>
            <td><code>model</code></td>
            <td>Spezifisches Modell für diesen Skill</td>
          </tr>
          <tr>
            <td><code>effort</code></td>
            <td>low | medium | high | max</td>
          </tr>
          <tr>
            <td><code>context</code></td>
            <td>fork = Ausführung in eigenem Subagent</td>
          </tr>
          <tr>
            <td><code>agent</code></td>
            <td>Subagent-Typ: Explore, Plan, etc.</td>
          </tr>
          <tr>
            <td><code>hooks</code></td>
            <td>Lifecycle-Hooks an Skill gebunden</td>
          </tr>
          <tr>
            <td><code>paths</code></td>
            <td>Glob-Patterns für Aktivierungs-Scope</td>
          </tr>
          <tr>
            <td><code>shell</code></td>
            <td>bash (default) | powershell</td>
          </tr>
        </tbody>
      </table>
    </CollapsibleSection>

    <CollapsibleSection id="cc-extensions" title="Beispiel SKILL.md">
      <div class="note">
        Die Description ist das kritischste Element — Claude entscheidet allein
        anhand ~100 Tokens Metadaten, ob ein Skill relevant ist.
      </div>
      <div style="margin-top: 8px">
        <CrossRefLink
          tab="explorer"
          label="Vollständiges Beispiel im Example Explorer ansehen"
        />
      </div>
    </CollapsibleSection>
  </div>
</template>

<style scoped>
.tree-root {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
  padding: 4px 0;
  color: var(--color-text-primary);
}
.tree-list {
  margin: 10px 0;
}
.tree-item {
  padding: 4px 0 4px 20px;
  font-size: 12px;
  color: var(--color-text-secondary);
  position: relative;
}
.tree-item::before {
  content: "";
  position: absolute;
  left: 6px;
  top: 0;
  bottom: 0;
  width: 0.5px;
  background: var(--color-border-tertiary);
}
.tree-item::after {
  content: "";
  position: absolute;
  left: 6px;
  top: 50%;
  width: 10px;
  height: 0.5px;
  background: var(--color-border-tertiary);
}
.fname {
  font-family: var(--font-mono);
  color: var(--color-text-primary);
  font-size: 12px;
}
.fdesc {
  color: var(--color-text-tertiary);
  margin-left: 6px;
}
.badge {
  display: inline-block;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--sk-radm);
  font-weight: 500;
  margin-right: 4px;
}
.badge-req {
  background: var(--color-background-danger);
  color: var(--color-text-danger);
}
.badge-opt {
  background: var(--color-background-info);
  color: var(--color-text-info);
}
.badge-ext {
  background: var(--color-background-warning);
  color: var(--color-text-warning);
}
.sep {
  border: none;
  border-top: 0.5px solid var(--color-border-tertiary);
  margin: 12px 0;
}
.note {
  font-size: 12px;
  color: var(--color-text-tertiary);
  font-style: italic;
  margin-top: 6px;
}
.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  margin: 8px 0;
}
.tbl th {
  text-align: left;
  padding: 6px 10px;
  border-bottom: 0.5px solid var(--color-border-tertiary);
  color: var(--color-text-tertiary);
  font-weight: 500;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.tbl td {
  padding: 6px 10px;
  border-bottom: 0.5px solid var(--color-border-tertiary);
  vertical-align: top;
}
.tbl tr:last-child td {
  border-bottom: none;
}
</style>
