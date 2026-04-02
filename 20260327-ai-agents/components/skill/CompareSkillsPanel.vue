<script setup>
import CollapsibleSection from './CollapsibleSection.vue'
</script>

<template>
  <div>
    <CollapsibleSection id="agents-claude-skill" title="AGENTS.md vs. CLAUDE.md vs. SKILL.md" :open="false">
      <table class="tbl">
        <tr><th>Merkmal</th><th>AGENTS.md</th><th>CLAUDE.md</th><th>SKILL.md</th></tr>
        <tr><td>Zweck</td><td>Projektanweisungen</td><td>Projektanweisungen</td><td>Modulares Domänenwissen</td></tr>
        <tr><td>Standard</td><td><span class="hl">Offen (AAIF / LF)</span></td><td><span class="warn">Proprietär (Anthropic)</span></td><td><span class="hl">Offen (AAIF / LF)</span></td></tr>
        <tr><td>Ladeverhalten</td><td><span class="dng">Immer vollständig</span></td><td><span class="dng">Immer vollständig</span></td><td><span class="succ">On-demand</span></td></tr>
        <tr><td>Format</td><td>Reines Markdown</td><td>Markdown + @Imports</td><td>YAML-Frontmatter + Markdown + Files</td></tr>
        <tr><td>Schema</td><td>Nicht nötig</td><td>Optional</td><td>Pflicht (name, description)</td></tr>
        <tr><td>Subdirectory</td><td>Nächste Datei gewinnt</td><td>Hierarchisch</td><td>Per Skill-Verzeichnis</td></tr>
        <tr><td>@Import</td><td><span class="dng">Nein</span></td><td><span class="succ">Ja (5 Ebenen)</span></td><td>Via references/</td></tr>
        <tr><td>Path-scoped</td><td><span class="dng">Nein</span></td><td><span class="succ">Ja (Globs)</span></td><td>paths Feld (CC only)</td></tr>
        <tr><td>Plattformen</td><td>Codex, Cursor, Gemini, ...</td><td>Nur Claude Code</td><td>26+ (offen)</td></tr>
        <tr><td>CC Support</td><td><span class="dng">Nicht nativ</span></td><td><span class="succ">Nativ</span></td><td><span class="succ">Nativ</span></td></tr>
        <tr><td>Adoption</td><td>60.000+ Projekte</td><td>Next.js, LangChain, ...</td><td>Anthropic + 26+ Tools</td></tr>
      </table>
      <div class="callout">
        <b>Pragmatische Empfehlung:</b> Shared-Konventionen in <code>AGENTS.md</code> (plattformübergreifend). Claude-Features in <code>CLAUDE.md</code> mit <code>See @AGENTS.md</code>. Domänen-Wissen in <code>SKILL.md</code>.
      </div>
    </CollapsibleSection>

    <CollapsibleSection id="agents-md-details" title="AGENTS.md — Details & Status">
      <table class="tbl">
        <tr><th>Eigenschaft</th><th>Detail</th></tr>
        <tr><td>Initiiert von</td><td>OpenAI, Google, Sourcegraph, Cursor, Factory (Mitte 2025)</td></tr>
        <tr><td>Governance</td><td>Agentic AI Foundation (Linux Foundation) seit Dez. 2025</td></tr>
        <tr><td>Co-Founding</td><td>Anthropic, OpenAI, Block — zusammen mit MCP und Goose</td></tr>
        <tr><td>Adoption</td><td>60.000+ Projekte, 20.000+ Repos auf GitHub</td></tr>
        <tr><td>CC Status</td><td><span class="dng">Nicht nativ.</span> Issue #6235 mit 3.200+ Upvotes. Workaround: <code>@AGENTS.md</code></td></tr>
      </table>
      <div class="code"># Beispiel AGENTS.md
## Project overview
E-commerce platform: Next.js 14, Postgres, Stripe.

## Code style
- TypeScript strict, no `any` types
- Functional components with named exports

## Commands
- pnpm dev — Start dev server
- pnpm test — Run Vitest</div>
      <div class="note">Kein YAML-Frontmatter nötig — reines Markdown. Die Einfachheit ist Designziel.</div>
    </CollapsibleSection>

    <CollapsibleSection id="recommendations" title="Strategische Empfehlungen">
      <b>1. AGENTS.md für plattformübergreifende Konventionen.</b> Wenn das Team Cursor, Codex oder andere Tools neben Claude Code nutzt, gehören Shared-Regeln in AGENTS.md.<br><br>
      <b>2. CLAUDE.md für Claude-exklusive Features.</b> @Import, path-scoped Rules, User-/Local-Hierarchie — und <code>See @AGENTS.md</code> als Brücke.<br><br>
      <b>3. SKILL.md für Domänenwissen on-demand.</b> Alles, was nicht in jeder Sitzung relevant ist, gehört in Skills statt in aufgeblähte Projektanweisungen.<br><br>
      <b>4. Description ist alles.</b> Claude entscheidet anhand ~100 Tokens Metadaten. „Pushy" formulieren.<br><br>
      <b>5. Token-Hygiene in Scripts.</b> stdout/stderr = Kontextverbrauch. Ergebnisse in Dateien, nur Pfad + Summary auf die Konsole.<br><br>
      <b>6. Community-Skills auditieren.</b> 36,8% haben mindestens eine Schwachstelle. Immer <code>scripts/</code>-Ordner prüfen.
    </CollapsibleSection>
  </div>
</template>

<style scoped>
.hl { color: var(--color-text-info); font-weight: 500; }
.succ { color: var(--color-text-success); }
.dng { color: var(--color-text-danger); }
.warn { color: var(--color-text-warning); }
.sep { border: none; border-top: 0.5px solid var(--color-border-tertiary); margin: 12px 0; }
.note { font-size: 12px; color: var(--color-text-tertiary); font-style: italic; margin-top: 6px; }
.callout { border-left: 3px solid var(--color-border-warning); background: var(--color-background-warning); padding: 10px 14px; border-radius: 0 var(--sk-radm) var(--sk-radm) 0; margin: 10px 0; font-size: 12px; line-height: 1.6; color: var(--color-text-warning); }
.code { font-family: var(--font-mono); font-size: 12px; background: var(--color-background-secondary); padding: 12px 16px; border-radius: var(--sk-radm); overflow-x: auto; white-space: pre; line-height: 1.6; margin: 8px 0; border: 0.5px solid var(--color-border-tertiary); }
.tbl { width: 100%; border-collapse: collapse; font-size: 12px; margin: 8px 0; }
.tbl th { text-align: left; padding: 6px 10px; border-bottom: 0.5px solid var(--color-border-tertiary); color: var(--color-text-tertiary); font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: .3px; }
.tbl td { padding: 6px 10px; border-bottom: 0.5px solid var(--color-border-tertiary); vertical-align: top; }
.tbl tr:last-child td { border-bottom: none; }
</style>
