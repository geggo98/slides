#!/usr/bin/env python3
"""Writes golden-live.json: expected values for the live replay, taken from the ORIGINAL study 9 code.

Origin: the TypeScript port in components/lib/erosionLiveLogic.ts must reproduce parse_list, apply_delta,
compact_message, test_message and the request bodies of study 9 byte for byte. Expected values therefore
come from the original Python module and from its stored database, never from the TypeScript code.

Usage (stdlib only, no uv header needed):
  python3 -I golden-live-gen.py <study9/run.py of context-rot-experiments> <experiment.sqlite> <out.json>

The database is the decompressed study9/results/experiment.sqlite.gz. Decompress it OUTSIDE this repository.
The generator checks itself against the database before it writes anything: the original functions must
reproduce every stored list, and the original compact_message must reproduce every stored compact prompt.
Python's Mersenne-Twister seeding is not part of the fixtures: the port draws filler with its own PRNG.
"""
import importlib.util
import json
import re
import sqlite3
import sys
from pathlib import Path

run_py, db_path, out_path = (Path(a) for a in sys.argv[1:4])
spec = importlib.util.spec_from_file_location("study9_run", run_py)
S = importlib.util.module_from_spec(spec)
spec.loader.exec_module(S)
db = sqlite3.connect(db_path)

WRAP = re.compile(r"\[reference material\]\n(.*?)\n\[end of reference material\]", re.S)


def prev_state(chain, rnd):
    return json.loads(db.execute("SELECT items FROM s9_state WHERE chain=? AND round=?", (chain, rnd)).fetchone()[0])


# ---------- parse cases from the database ----------
rows = db.execute("SELECT chain, round, raw, items, parse_ok, note FROM s9_state WHERE round > 0 ORDER BY chain, round").fetchall()
by_arm = {}
for chain, rnd, raw, items, ok, note in rows:
    by_arm.setdefault(chain.split("-")[0], []).append((chain, rnd, raw, items, ok, note))
picked = []
for arm, rs in sorted(by_arm.items()):
    # spread over chains and rounds; always include rows with a note
    noted = [r for r in rs if r[5]]
    rest = [r for r in rs if not r[5]]
    step = max(1, len(rest) // 8)
    picked += noted + rest[::step][:8]
parse_cases = []
for chain, rnd, raw, items, ok, note in picked:
    arm = chain.split("-")[0]
    prev = prev_state(chain, rnd - 1)
    if arm == "D":
        got_items, got_ok, got_note = S.apply_delta(prev, raw)
    else:
        got_items, got_ok = S.parse_list(raw)
        got_note = ""
    # self-check: the original functions reproduce what the database stored
    assert json.dumps(got_items, ensure_ascii=False) == items, (chain, rnd)
    assert (got_ok, got_note) == (ok, note), (chain, rnd)
    parse_cases.append(dict(source=f"db:{chain}:r{rnd}", arm=arm, prev=prev, raw=raw, items=json.loads(items), ok=ok, note=note))

# ---------- synthetic parse cases, expected values computed by the original functions ----------
P = [["R01", "alpha"], ["R02", "beta"], ["R03", "gamma"]]
synthetic = [
    ("F", P, "- first\n* second\n  continued here\n3) third"),
    ("C", P, "```text\n1. one\n2. two\n```"),
    ("F", P, "```\n1. one\n   wrapped\n2. two"),
    ("F", P, "I cannot do that.\n\nSorry."),
    ("F", P, ""),
    ("N", P, "Here is the list:\n\n1. A\n2. B\nTrailing prose"),
    ("F", P, "1.\tTabbed\n10) Ten\n continuation after separator"),
    ("D", P, '{"remove": ["R01"], "reword": {"R03": "gamma2"}, "add": ["delta", "epsilon"]}'),
    ("D", [["R02", "b"], ["R05", "e"]], '{"add": ["x"]}'),
    ("D", P, '{"remove": ["R09", 3], "reword": {"R77": "z", "R01": 5, "R02": null}}'),
    ("D", P, '```json\n{"remove": "R01"}\n```'),
    ("D", P, "I would remove the second rule."),
    ("D", P, '{"remove": ["R01",]}'),
    ("D", P, "{}"),
    ("D", P, '{"remove": [], "reword": {}, "add": [], "note": 1}'),
    ("D", P, 'Sure! {"remove": ["R03"]} Hope that helps.'),
    ("D", P, '{"add": [1, true, null, "x"]}'),
    ("D", P, '{"reword": ["R01"]}'),
    ("D", [], '{"add": ["only"]}'),
    ("D", [["R01", "it's"]], '{"remove": ["it\'s", "a\\"b"]}'),
]
for arm, prev, raw in synthetic:
    if arm == "D":
        it, ok, note = S.apply_delta(prev, raw)
    else:
        it, ok = S.parse_list(raw)
        note = ""
    parse_cases.append(dict(source="synthetic", arm=arm, prev=prev, raw=raw, items=it, ok=ok, note=note))
assert any(c["ok"] == 0 for c in parse_cases), "no parse_ok=0 case"
assert {c["arm"] for c in parse_cases} == set("FCDN")

# ---------- compact_message with a controlled filler: the ORIGINAL wrapper decides the exact text ----------
SENT = {k: f"<{k}> piece\nsecond line  \n\n" for k in ("prose", "math", "code", "foreign")}
real_pieces = S.PIECES
S.PIECES = {k: [v] for k, v in SENT.items()}
compact_cases = []
try:
    for arm, n in (("F", 3), ("C", 1), ("D", 4), ("N", 2), ("D", 0), ("F", 5)):
        items = [[f"R{i + 1:02d}" if arm != "D" else f"R{i * 2 + 3:02d}", f"rule {i}"] for i in range(n)]
        chain, rnd = f"{arm}-luna-00", 1
        msg = S.compact_message(arm, chain, rnd, items)
        wrapped = WRAP.findall(msg)
        assert len(wrapped) == n + 1
        pieces = [next(v for v in SENT.values() if v.rstrip() == w) for w in wrapped]
        compact_cases.append(dict(arm=arm, items=items, pieces=pieces, message=msg))
finally:
    S.PIECES = real_pieces

# ---------- real compact requests: prompt, body and the pieces that were really drawn ----------
real_compact = []
for arm in "FCDN":
    for chain_prefix, rnd in ((f"{arm}-luna-03", 4), (f"{arm}-terra-01", 2)):
        row = db.execute("""SELECT q.chain, q.round, q.model, r.body FROM s9_requests q JOIN requests r USING(request_key)
                            WHERE q.kind='compact' AND q.chain=? AND q.round=?""", (chain_prefix, rnd)).fetchone()
        if row is None:
            continue
        chain, rnd, model, body = row
        body = json.loads(body)
        prev = prev_state(chain, rnd - 1)
        user = body["messages"][1]["content"]
        # self-check: the original filler (real PRNG) and compact_message reproduce the stored prompt
        assert S.compact_message(arm, chain, rnd, prev) == user, (chain, rnd)
        pieces = WRAP.findall(user)
        assert len(pieces) == len(prev) + 1
        real_compact.append(dict(arm=arm, chain=chain, round=rnd, items=prev, pieces=pieces, body=body))

# ---------- real test requests ----------
real_test = []
for arm in "FCDN":
    row = db.execute("""SELECT q.chain, q.round, q.site, r.body FROM s9_requests q JOIN requests r USING(request_key)
                        WHERE q.kind='test' AND q.arm=? AND q.round=2 AND q.site IN ('c025','c066') ORDER BY q.chain, q.site LIMIT 1""", (arm,)).fetchone()
    if row is None:
        continue
    chain, rnd, site, body = row
    body = json.loads(body)
    items = prev_state(chain, rnd)
    prefix = S.SPEC["sites"][site]["prefix"]
    text = S.render_numbered(items)
    assert S.test_message(text, prefix) == body["messages"][1]["content"], (chain, site)
    real_test.append(dict(arm=arm, chain=chain, round=rnd, site=site, items=items, prefix=prefix, body=body))
original_body = db.execute("""SELECT r.body FROM s9_requests q JOIN requests r USING(request_key)
                              WHERE q.kind='test' AND q.chain='O' AND q.site='c066' LIMIT 1""").fetchone()
original_body = json.loads(original_body[0])
assert original_body["messages"][1]["content"] == S.test_message(S.render_numbered(S.initial_items()), S.SPEC["sites"]["c066"]["prefix"])

out = dict(
    note="Expected values from study 9 run.py and its database (see golden-live-gen.py). Do not edit by hand.",
    source_commit="7e5e7c7",
    parse=parse_cases,
    compact=compact_cases,
    realCompact=real_compact,
    realTest=real_test,
    originalTest=dict(items=S.initial_items(), site="c066", prefix=S.SPEC["sites"]["c066"]["prefix"], body=original_body),
    constants=dict(MAX_OUT=S.MAX_OUT, SYS_COMPACT=S.SYS_COMPACT, TASK_RULES=S.TASK_RULES, SYSTEM_PROMPT=S.R.SYSTEM_PROMPT, instructions=S.SPEC["instructions"]),
)
out_path.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
print(f"wrote {out_path}: {len(parse_cases)} parse, {len(compact_cases)} compact, {len(real_compact)} real compact, {len(real_test)} real test", file=sys.stderr)
