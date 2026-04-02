<script setup>
import CollapsibleSection from './CollapsibleSection.vue'
</script>

<template>
  <div>
    <CollapsibleSection id="patterns" title="Drei Implementierungsmuster" :open="true">
      <div class="cmp-grid">
        <div class="cmp-card"><h4><span class="badge badge-opt">A</span> Prompt-Only</h4><p>Nur Markdown-Anweisungen. Für Brand-Guidelines, Coding-Standards, Review-Checklisten.</p></div>
        <div class="cmp-card"><h4><span class="badge badge-ext">B</span> Prompt + Scripts</h4><p>Markdown plus Python/JS-Skripte. Für PDF/Excel-Manipulation, Datenverarbeitung.</p></div>
      </div>
      <div class="cmp-grid">
        <div class="cmp-card cmp-full"><h4><span class="badge badge-req">C</span> MCP / Subagent-Integration</h4><p>Ruft externe Services auf. Nutzt <code>allowed-tools</code> und <code>context: fork</code>.</p></div>
      </div>
    </CollapsibleSection>

    <CollapsibleSection id="references-folder" title="References-Ordner">
      Enthält Referenzmaterial, das Claude <b>bei Bedarf liest</b>:
      <div class="pill-row">
        <span class="pill">Markdown-Docs</span><span class="pill">API-Referenzen</span><span class="pill">Schema-Definitionen</span><span class="pill">Code-Beispiele</span><span class="pill">Style Guides</span><span class="pill">Templates</span>
      </div>
      <hr class="sep">
      <b>Best Practices:</b> Dateien &gt;300 Zeilen: Inhaltsverzeichnis einfügen. Maximal eine Ebene tief verlinkt. Ungenutztes Material: entweder unnötig oder schlecht signalisiert.
    </CollapsibleSection>

    <CollapsibleSection id="token-hygiene" title="Scripts — Ausführung & Token-Hygiene" :open="true">
      Skills können beliebige ausführbare Skripte enthalten. Claude führt sie via Bash aus — nur das <b>Output</b> gelangt in den Kontext.
      <div class="code"># Im SKILL.md referenzieren:
Nutze das Skript unter
${CLAUDE_SKILL_DIR}/scripts/extract_pdf.py</div>
      <div class="callout callout-d"><b>Token-Hygiene: stdout/stderr = Kontextverbrauch!</b><br>Alles, was ein Skript auf die Konsole schreibt, landet im Kontextfenster und frisst Token-Budget. Verbose Logging, Debug-Output, lange JSON-Dumps — häufigster stiller Budgetkiller.</div>
      <b>Regel:</b> Nur das absolute Minimum auf stdout/stderr. Umfangreiche Ergebnisse in Dateien schreiben, nur Pfad referenzieren.
      <div class="vs-row">
        <div class="vs-col">
          <div class="vs-label dng">Schlecht — alles auf stdout</div>
          <div class="code code-sm">data = process_invoices(...)
# 500 KB JSON direkt auf stdout
print(json.dumps(data, indent=2))
print(f"DEBUG: {len(data)} Rechnungen")
print(f"Verarbeitung in {elapsed}s")</div>
        </div>
        <div class="vs-mid">vs.</div>
        <div class="vs-col">
          <div class="vs-label succ">Gut — Datei schreiben, Pfad ausgeben</div>
          <div class="code code-sm">data = process_invoices(...)
out = Path("/tmp/invoices.json")
out.write_text(json.dumps(data))

# Nur das Nötigste auf stdout
print(f"Ergebnis: {out}")
print(f"{len(data)} Rechnungen OK")</div>
        </div>
      </div>
      <div class="callout callout-i"><b>Tipp: Dateityp je nach Anwendungsfall</b><br>Logs → <code>.log</code> | Strukturierte Daten → <code>.json</code>, <code>.parquet</code> | Reports → <code>.pdf</code>, <code>.md</code> | Tabellen → <code>.csv</code><br>Auf stdout: nur Pfad + Zusammenfassung + Fehlermeldungen.</div>
      <p>Dasselbe gilt für <b>Dynamic Context Injection</b> (<code>!`command`</code>):</p>
      <div class="code code-sm"># Statt:    !`kubectl get pods -o json`          (kann &gt;100KB sein)
# Besser:   !`kubectl get pods -o custom-columns=NAME:.metadata.name,STATUS:.status.phase`
# Oder:     !`./scripts/pod-summary.sh`           (Wrapper, der filtert)</div>
    </CollapsibleSection>

    <CollapsibleSection id="cross-refs" title="Querverweise zwischen Skills">
      Direkte Cross-Referencing-Mechanismen sind <span class="warn">nicht explizit spezifiziert</span>. Ansätze:
      <hr class="sep">
      <b>1. Namentliche Referenz</b> im Markdown-Body<br>
      <b>2. @Import</b> in CLAUDE.md (max 5 Ebenen) — nicht in AGENTS.md verfügbar<br>
      <b>3. Invocation Control:</b> <code>user-invocable: false</code><br>
      <b>4. Plugin-Namespacing:</b> <code>plugin-name:skill-name</code>
    </CollapsibleSection>
  </div>
</template>

<style scoped>
.cmp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0; }
.cmp-card { border: 0.5px solid var(--color-border-tertiary); border-radius: var(--sk-radm); padding: 12px; }
.cmp-card h4 { font-size: 13px; font-weight: 500; margin-bottom: 6px; }
.cmp-card p { font-size: 12px; color: var(--color-text-secondary); line-height: 1.5; }
.cmp-full { grid-column: 1 / -1; }
.badge { display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: var(--sk-radm); font-weight: 500; margin-right: 4px; }
.badge-req { background: var(--color-background-danger); color: var(--color-text-danger); }
.badge-opt { background: var(--color-background-info); color: var(--color-text-info); }
.badge-ext { background: var(--color-background-warning); color: var(--color-text-warning); }
.pill-row { display: flex; gap: 6px; flex-wrap: wrap; margin: 6px 0; }
.pill { font-size: 11px; padding: 3px 10px; border-radius: 20px; border: 0.5px solid var(--color-border-tertiary); color: var(--color-text-secondary); }
.sep { border: none; border-top: 0.5px solid var(--color-border-tertiary); margin: 12px 0; }
.code { font-family: var(--font-mono); font-size: 12px; background: var(--color-background-secondary); padding: 12px 16px; border-radius: var(--sk-radm); overflow-x: auto; white-space: pre; line-height: 1.6; margin: 8px 0; border: 0.5px solid var(--color-border-tertiary); }
.code-sm { font-size: 11px; }
.callout { border-left: 3px solid var(--color-border-warning); background: var(--color-background-warning); padding: 10px 14px; border-radius: 0 var(--sk-radm) var(--sk-radm) 0; margin: 10px 0; font-size: 12px; line-height: 1.6; color: var(--color-text-warning); }
.callout-d { border-left-color: var(--color-border-danger); background: var(--color-background-danger); color: var(--color-text-danger); }
.callout-i { border-left-color: var(--color-border-info); background: var(--color-background-info); color: var(--color-text-info); }
.vs-row { display: grid; grid-template-columns: 1fr auto 1fr; gap: 8px; align-items: start; margin: 10px 0; }
.vs-col { font-size: 12px; line-height: 1.6; }
.vs-label { font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: .3px; margin-bottom: 4px; }
.vs-mid { color: var(--color-text-tertiary); font-size: 18px; padding-top: 18px; }
.dng { color: var(--color-text-danger); }
.succ { color: var(--color-text-success); }
.warn { color: var(--color-text-warning); }
</style>
