#!/usr/bin/env -S uv --quiet run --frozen --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
#
# [tool.uv]
# exclude-newer = "2026-10-01T00:00:00Z"
# ///
"""
Extrahiert echte Modellwechsel Opus -> Sonnet (`opusplan`) aus den lokalen
Claude-Code-Sitzungsprotokollen und legt sie anonymisiert ab — Datenbasis der
Folien `opusplan` und `opusplan-wechsel` (components/lib/opusplanMath.ts).

Aufruf
------
  ./extract.py [--since 2026-08-30] [--until 2026-09-29] [--root ~/.claude/projects]

Schreibt neben das Skript: phases.tsv, switches.tsv, summary.json.

Was gezaehlt wird
-----------------
* Nur die Hauptkonversation: `subagents/`-Dateien und `isSidechain: true`
  fallen weg. Subagents haben eine andere TTL und wuerden Phasen zerreissen.
* `<synthetic>`-Eintraege (Abbrueche, Fehler) sind kein Modell und erzeugen
  keinen Wechsel.
* Dedup nach `message.id`: Streaming schreibt denselben Request mehrfach
  (gemessen: 115 Zeilen fuer 62 Requests, identische Usage je Kopie). Zusaetzlich
  global ueber alle Dateien — eine fortgesetzte Sitzung kann die Historie ihrer
  Vorgaengerin erneut enthalten. Die Zahl der uebersprungenen Dubletten steht in
  summary.json; ein Dedup, der nichts sieht, wuerde dasselbe melden wie ein
  sauberer Bestand.
* Phase = zusammenhaengender Lauf desselben Modells. Rolle: `plan` (Opus vor dem
  ersten Wechsel zu Sonnet), `exec` (Sonnet), `replan` (Opus nach einer Sonnet-
  Phase). Nur Sitzungen mit mindestens einem Opus -> Sonnet-Wechsel werden
  abgelegt. Ob der Wechsel `opusplan` oder ein manuelles /model war, sagt das
  Protokoll nicht; `exit_plan` markiert Sitzungen mit ExitPlanMode.
* Kontext eines Requests = input + cache_read + cache_creation. Cache-Bruch-
  Anteil (`share`) = cache_creation / Kontext des ersten Requests nach dem Wechsel.

Was NICHT abgelegt wird (Datenschutz, interne Infrastruktur)
-----------------------------------------------------------
Kein cwd, kein Projekt- oder Verzeichnisname, kein Prompt, keine Tool-Inhalte,
kein Branch. Session-ID als sha256[:12], Zeit nur als Tag.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import statistics
import sys
from datetime import date, datetime
from pathlib import Path

HIER = Path(__file__).resolve().parent
VERSION = 1


def familie(modell: str) -> str:
    for f in ("opus", "sonnet", "fable", "haiku"):
        if f in modell:
            return f
    return "other"


def lade_sitzung(pfad: Path, since: str, until: str, gesehen: set[str], stat: dict):
    """Liefert (requests, exit_plan) einer Datei; requests in Dateireihenfolge."""
    reqs: dict[str, dict] = {}
    reihenfolge: list[str] = []
    exit_plan = False
    compact_vor: set[str] = set()
    pending_compact = False
    with pfad.open(encoding="utf-8", errors="replace") as fh:
        for zeile in fh:
            try:
                o = json.loads(zeile)
            except json.JSONDecodeError:
                stat["kaputte_zeilen"] += 1
                continue
            if o.get("type") == "system" and o.get("subtype") == "compact_boundary":
                pending_compact = True
                continue
            if o.get("type") != "assistant" or o.get("isSidechain"):
                continue
            msg = o.get("message") or {}
            mid, modell, usage = msg.get("id"), msg.get("model"), msg.get("usage")
            if not mid or not modell or modell == "<synthetic>" or not usage:
                continue
            tag = (o.get("timestamp") or "")[:10]
            if not (since <= tag <= until):
                continue
            stat["zeilen"] += 1
            if any(
                b.get("type") == "tool_use" and b.get("name") == "ExitPlanMode"
                for b in (msg.get("content") or [])
                if isinstance(b, dict)
            ):
                exit_plan = True
            if mid in reqs:  # Streaming-Kopie derselben Nachricht
                reqs[mid]["usage"] = usage
                continue
            if mid in gesehen:  # Historie einer Vorgaengersitzung
                stat["dubletten_datei"] += 1
                continue
            gesehen.add(mid)
            reqs[mid] = {"tag": tag, "ts": o.get("timestamp") or "", "modell": modell, "usage": usage}
            if pending_compact:
                compact_vor.add(mid)
                pending_compact = False
            reihenfolge.append(mid)
    out = []
    for mid in reihenfolge:
        r = reqs[mid]
        u = r["usage"]
        cc = u.get("cache_creation") or {}
        w = u.get("cache_creation_input_tokens") or 0
        w1h = cc.get("ephemeral_1h_input_tokens")
        out.append(
            {
                "tag": r["tag"],
                "ts": r["ts"],
                "modell": r["modell"],
                "fam": familie(r["modell"]),
                "out": u.get("output_tokens") or 0,
                "read": u.get("cache_read_input_tokens") or 0,
                "write": w,
                "w1h": w1h if w1h is not None else 0,
                "w5m": (w - w1h) if w1h is not None else w,
                "inp": u.get("input_tokens") or 0,
                "compact": mid in compact_vor,
            }
        )
    stat["requests"] += len(out)
    return out, exit_plan


def phasen(reqs: list[dict]) -> list[dict]:
    lauf: list[dict] = []
    for r in reqs:
        if lauf and lauf[-1]["modell"] == r["modell"]:
            lauf[-1]["reqs"].append(r)
        else:
            lauf.append({"modell": r["modell"], "fam": r["fam"], "reqs": [r]})
    return lauf


def minuten(a: str, b: str) -> float:
    """Minuten zwischen zwei ISO-Zeitstempeln (UTC, `Z`-Suffix)."""
    f = lambda s: datetime.fromisoformat(s.replace("Z", "+00:00"))
    return (f(b) - f(a)).total_seconds() / 60


def ctx(r: dict) -> int:
    return r["inp"] + r["read"] + r["write"]


def quantile(werte: list[float], q: float) -> float:
    s = sorted(werte)
    if not s:
        return float("nan")
    k = (len(s) - 1) * q
    lo, hi = int(k), min(int(k) + 1, len(s) - 1)
    return s[lo] + (s[hi] - s[lo]) * (k - lo)


def verteilung(werte: list[float]) -> dict:
    if not werte:
        return {"n": 0}
    return {
        "n": len(werte),
        "p25": round(quantile(werte, 0.25), 4),
        "median": round(statistics.median(werte), 4),
        "p75": round(quantile(werte, 0.75), 4),
        "max": round(max(werte), 4),
    }


# USD/MTok, retrieved 2026-09-30, platform.claude.com/docs/en/about-claude/pricing
# (roh per curl gelesen). Zeilen: Opus 5.5 "$4 / $5 / $8 / $0.20 / $20" mit
# Fussnote 2 („cache hits ... 0.05x"), Opus 5 "$5 / $6.25 / $10 / $0.50 / $25",
# Sonnet 5.5 und Sonnet 5 je "$2 / $2.50 / $4 / $0.20 / $10".
PREISE = {
    "claude-opus-5-5": {"in": 4.0, "out": 20.0, "read": 0.20, "w5m": 5.0, "w1h": 8.0},
    "claude-opus-5": {"in": 5.0, "out": 25.0, "read": 0.50, "w5m": 6.25, "w1h": 10.0},
    "claude-sonnet-5-5": {"in": 2.0, "out": 10.0, "read": 0.20, "w5m": 2.5, "w1h": 4.0},
    "claude-sonnet-5": {"in": 2.0, "out": 10.0, "read": 0.20, "w5m": 2.5, "w1h": 4.0},
}


def kosten(modell: str, out: int, read: int, w5m: int, w1h: int, inp: int) -> float:
    p = PREISE[modell]
    return (out * p["out"] + read * p["read"] + w5m * p["w5m"]
            + w1h * p["w1h"] + inp * p["in"]) / 1e6


def kontrollrechnung(phasen_zeilen: list, wechsel_zeilen: list, kopf_p: list, kopf_w: list) -> dict:
    """Jede Sitzung mit ihren echten Tokens bepreisen, dann kontrafaktisch ‚Nur Opus‘.

    Kontrafaktisch heisst: dieselben Tokens zum Preis des Opus-Modells der Plan-
    Phase, nur ohne Cache-Bruch. Variante A zieht den Bruch des ERSTEN Wechsels
    ab (sein Write waere dort ein Read), Variante B den aller Wechsel — B ist die
    strengere, weil spaetere Wechsel auch nur Delta schreiben, das bei Nur Opus
    ebenfalls anfiele. Was die Rechnung nicht kann: dass Sonnet fuer dieselbe
    Aufgabe mehr oder weniger Tokens braucht als Opus. Das bleibt Vorbehalt.
    """
    pi = {k: i for i, k in enumerate(kopf_p)}
    wi = {k: i for i, k in enumerate(kopf_w)}
    phasen_je: dict[str, list] = {}
    for z in phasen_zeilen:
        phasen_je.setdefault(z[0], []).append(z)
    wechsel_je: dict[str, list] = {}
    for z in wechsel_zeilen:
        wechsel_je.setdefault(z[0], []).append(z)
    zeilen, ausgelassen = [], 0
    for sid, ps in phasen_je.items():
        if any(z[pi["modell"]] not in PREISE for z in ps):
            ausgelassen += 1
            continue
        opus = next((z[pi["modell"]] for z in ps if z[pi["rolle"]] == "plan"), None)
        if opus is None:
            ausgelassen += 1
            continue
        ist = cf_nur = 0.0
        for z in ps:
            args = (z[pi["out"]], z[pi["read"]], z[pi["write_5m"]], z[pi["write_1h"]], z[pi["input"]])
            ist += kosten(z[pi["modell"]], *args)
            cf_nur += kosten(opus, *args)
        ws = wechsel_je.get(sid, [])
        bruch = lambda w: w[wi["write"]] * (PREISE[opus]["w1h"] - PREISE[opus]["read"]) / 1e6
        erster = next((w for w in ws if w[wi["richtung"]] == "opus->sonnet"), None)
        cf_a = cf_nur - (bruch(erster) if erster else 0)
        cf_b = cf_nur - sum(bruch(w) for w in ws)
        zeilen.append({"ist": ist, "a": cf_a, "b": cf_b,
                       "exec_read": sum(z[pi["read"]] for z in ps if z[pi["rolle"]] == "exec") / 1e6,
                       "exec_out": sum(z[pi["out"]] for z in ps if z[pi["rolle"]] == "exec") / 1e6})
    def stat(key: str) -> dict:
        pct = [100 * (1 - z["ist"] / z[key]) for z in zeilen]
        return {"verteilung_prozent": verteilung(pct),
                "sitzungen_billiger": sum(1 for p in pct if p > 0),
                "summe_ist_usd": round(sum(z["ist"] for z in zeilen), 2),
                "summe_kontrafaktisch_usd": round(sum(z[key] for z in zeilen), 2),
                "summe_prozent": round(100 * (1 - sum(z["ist"] for z in zeilen)
                                              / sum(z[key] for z in zeilen)), 1)}
    return {"n_sitzungen": len(zeilen), "ausgelassen": ausgelassen,
            "kontrafaktisch_A_nur_erster_bruch": stat("a"),
            "kontrafaktisch_B_alle_wechsel": stat("b"),
            "exec_read_je_sitzung_mtok": verteilung([z["exec_read"] for z in zeilen]),
            "exec_out_je_sitzung_mtok": verteilung([z["exec_out"] for z in zeilen])}


def sitzungs_kennzahlen(phasen_zeilen: list, wechsel_zeilen: list, kopf_p: list) -> dict:
    """Rueckkehr-Haeufigkeit und erster vs. spaeterer Wechsel."""
    pi = {k: i for i, k in enumerate(kopf_p)}
    je: dict[str, list] = {}
    for z in phasen_zeilen:
        je.setdefault(z[0], []).append(z)
    replans = [sum(1 for z in ps if z[pi["rolle"]] == "replan") for ps in je.values()]
    rp = [z for z in phasen_zeilen if z[pi["rolle"]] == "replan"]
    erste, spaetere, gesehen = [], [], set()
    for w in wechsel_zeilen:
        if w[2] != "opus->sonnet":
            continue
        (spaetere if w[0] in gesehen else erste).append(w)
        gesehen.add(w[0])
    return {
        "sitzungen_mit_rueckkehr": sum(1 for r in replans if r),
        "rueckkehren_je_sitzung_max": max(replans) if replans else 0,
        "rueckkehren_gesamt": len(rp),
        "rueckkehren_ohne_compact": sum(1 for z in rp if not z[pi["compact_before"]]),
        "erster_wechsel_break_share": verteilung([w[7] for w in erste]),
        "erster_wechsel_ctx_mtok": verteilung([w[5] / 1e6 for w in erste]),
        "spaetere_wechsel_break_share": verteilung([w[7] for w in spaetere]),
        "spaetere_wechsel_write_mtok": verteilung([w[6] / 1e6 for w in spaetere]),
        "rueckkehr_write_mtok": verteilung(
            [w[6] / 1e6 for w in wechsel_zeilen if w[2] == "sonnet->opus"]),
        "erste_exec_phase_out_mtok": verteilung([
            next(z[pi["out"]] for z in ps if z[pi["rolle"]] == "exec") / 1e6
            for ps in je.values() if any(z[pi["rolle"]] == "exec" for z in ps)]),
        "erste_exec_phase_read_mtok": verteilung([
            next(z[pi["read"]] for z in ps if z[pi["rolle"]] == "exec") / 1e6
            for ps in je.values() if any(z[pi["rolle"]] == "exec" for z in ps)]),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", default="2026-08-30")
    ap.add_argument("--until", default="2026-09-29")
    ap.add_argument("--root", default=str(Path.home() / ".claude" / "projects"))
    a = ap.parse_args()

    dateien = []
    for p in Path(a.root).glob("*/*.jsonl"):  # Ebene 2: ohne subagents/
        dateien.append(p)
    # Reihenfolge fuer das globale Dedup deterministisch: frueheste Sitzung zuerst
    def erster_tag(p: Path) -> tuple[str, str]:
        with p.open(encoding="utf-8", errors="replace") as fh:
            for z in fh:
                i = z.find('"timestamp":"')
                if i >= 0:
                    return (z[i + 13 : i + 36], p.name)
        return ("9", p.name)

    dateien.sort(key=erster_tag)

    stat = {"dateien": len(dateien), "zeilen": 0, "requests": 0,
            "dubletten_datei": 0, "kaputte_zeilen": 0}
    gesehen: set[str] = set()
    phasen_zeilen, wechsel_zeilen = [], []
    sitzungen = []
    for p in dateien:
        reqs, exit_plan = lade_sitzung(p, a.since, a.until, gesehen, stat)
        ph = phasen(reqs)
        fams = [x["fam"] for x in ph]
        if not any(fams[i] == "opus" and fams[i + 1] == "sonnet" for i in range(len(fams) - 1)):
            continue
        sid = hashlib.sha256(p.stem.encode()).hexdigest()[:12]
        gesehen_sonnet = False
        zuletzt: dict[str, str] = {}  # Modell -> Zeitstempel seines letzten Requests
        for i, x in enumerate(ph):
            if x["fam"] == "sonnet":
                rolle, gesehen_sonnet = "exec", True
            elif x["fam"] == "opus":
                rolle = "replan" if gesehen_sonnet else "plan"
            else:
                rolle = "other"
            rs = x["reqs"]
            phasen_zeilen.append(
                [sid, rs[0]["tag"], i + 1, x["modell"], rolle, len(rs),
                 sum(r["out"] for r in rs), sum(r["read"] for r in rs),
                 sum(r["w5m"] for r in rs), sum(r["w1h"] for r in rs),
                 sum(r["inp"] for r in rs), ctx(rs[-1]),
                 int(rs[0]["compact"]), int(exit_plan)]
            )
            if i > 0:
                prev = ph[i - 1]
                f = rs[0]
                c = ctx(f)
                # Minuten seit dem letzten Request DESSELBEN Modells; leer beim
                # ersten Auftreten. Achtung beim Lesen: die Luecke erklaert den
                # Bruchanteil nicht ueber den TTL-Ablauf (alle Writes sind 1 h),
                # sondern ueber die Menge, die das andere Modell inzwischen an den
                # Kontext angehaengt hat — kurze Luecke, kleines Delta.
                gap = round(minuten(zuletzt[x["modell"]], f["ts"]), 1) if x["modell"] in zuletzt else ""
                ri = f"{prev['fam']}->{x['fam']}"
                wechsel_zeilen.append(
                    [sid, f["tag"], ri, prev["modell"], x["modell"], c, f["write"],
                     round(f["write"] / c, 4) if c else 0, int(f["compact"]), int(exit_plan), gap]
                )
            zuletzt[x["modell"]] = rs[-1]["ts"]
        sitzungen.append(sid)

    kopf_p = ["session", "tag", "phase", "modell", "rolle", "requests", "out", "read",
              "write_5m", "write_1h", "input", "ctx_end", "compact_before", "exit_plan"]
    kopf_w = ["session", "tag", "richtung", "von", "nach", "ctx", "write", "share",
              "compact_before", "exit_plan", "gap_min"]
    for name, kopf, zeilen in (("phases.tsv", kopf_p, phasen_zeilen),
                               ("switches.tsv", kopf_w, wechsel_zeilen)):
        with (HIER / name).open("w", encoding="utf-8", newline="") as fh:
            fh.write("\t".join(kopf) + "\n")
            for z in zeilen:
                fh.write("\t".join(str(v) for v in z) + "\n")

    def col(name: str) -> int:
        return kopf_p.index(name)

    def sel(rolle: str, feld: str, nur_exit: bool = False) -> list[float]:
        return [z[col(feld)] / 1e6 for z in phasen_zeilen
                if z[col("rolle")] == rolle and (z[col("exit_plan")] or not nur_exit)]

    os_w = [z for z in wechsel_zeilen if z[2] == "opus->sonnet"]
    so_w = [z for z in wechsel_zeilen if z[2] == "sonnet->opus"]
    summary = {
        "version": VERSION,
        "retrieved": date.today().isoformat(),
        "fenster": {"since": a.since, "until": a.until},
        "eingelesen": stat,
        "sitzungen_mit_opus_zu_sonnet": len(sitzungen),
        "sitzungen_davon_exit_plan": len({z[0] for z in phasen_zeilen if z[-1]}),
        "wechsel": {"opus->sonnet": len(os_w), "sonnet->opus": len(so_w)},
        "break_share_opus_zu_sonnet": verteilung([z[7] for z in os_w]),
        "break_share_sonnet_zu_opus": verteilung([z[7] for z in so_w]),
        "ctx_beim_wechsel_opus_zu_sonnet_mtok": verteilung([z[5] / 1e6 for z in os_w]),
        "ctx_beim_wechsel_sonnet_zu_opus_mtok": verteilung([z[5] / 1e6 for z in so_w]),
        "plan_out_mtok": verteilung(sel("plan", "out")),
        "plan_read_mtok": verteilung(sel("plan", "read")),
        "plan_write_mtok": verteilung([
            (z[col("write_5m")] + z[col("write_1h")]) / 1e6
            for z in phasen_zeilen if z[col("rolle")] == "plan"]),
        "exec_out_mtok": verteilung(sel("exec", "out")),
        "exec_read_mtok": verteilung(sel("exec", "read")),
        "exec_write_mtok": verteilung([
            (z[col("write_5m")] + z[col("write_1h")]) / 1e6
            for z in phasen_zeilen if z[col("rolle")] == "exec"]),
        "replan_out_mtok": verteilung(sel("replan", "out")),
        "sitzungen": sitzungs_kennzahlen(phasen_zeilen, wechsel_zeilen, kopf_p),
        "kontrollrechnung_usd": kontrollrechnung(phasen_zeilen, wechsel_zeilen, kopf_p, kopf_w),
        "modelle": {m: sum(1 for z in phasen_zeilen if z[col("modell")] == m)
                    for m in sorted({z[col("modell")] for z in phasen_zeilen})},
        "sha256": {n: hashlib.sha256((HIER / n).read_bytes()).hexdigest()
                   for n in ("phases.tsv", "switches.tsv")},
    }
    (HIER / "summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({k: summary[k] for k in
          ("eingelesen", "sitzungen_mit_opus_zu_sonnet", "sitzungen_davon_exit_plan", "wechsel")},
          ensure_ascii=False), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
