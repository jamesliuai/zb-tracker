#!/usr/bin/env python3
"""Turn tools/zbls.txt into src/data/zbls.json.

    python3 tools/build_zbls.py

Every algorithm is simulated. Each has to solve its case after the AUF it's written with, and the
first one of a case decides its picture. Nothing is written if one of them doesn't.

Saved progress is keyed by case (ZBLS-5-3), so algorithms can be changed and moved around freely,
but a case has to keep its number.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cube import Bad, parse, slot_case, slot_key, slot_solves  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KINDS = ("main", "more")
TURNS = {"": 1, "2": 2, "'": 3}


def read(path):
    sets, case = [], None
    for n, line in enumerate(open(path, encoding="utf-8"), 1):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("=="):
            sid, tab, name = (x.strip() for x in line[2:].split("|"))
            sets.append({"id": sid, "tab": tab, "name": name, "cases": []})
            continue
        kind, _, rest = line.partition(" ")
        if kind not in KINDS:
            assert re.fullmatch(r"\d+-\d+", kind) and not rest, "line %d: %s" % (n, line)
            case = {"name": kind, "main": [], "more": []}
            sets[-1]["cases"].append(case)
            continue
        alg, _, who = (x.strip() for x in rest.partition("|"))
        case[kind].append((alg, who, n))
    return sets


def split(alg):
    """The AUF an algorithm is written with, and the algorithm without it. Any y turns stay in front."""
    moves = parse(alg)
    turns, auf = [], 0
    while moves and moves[0][0] in "Uy":
        m = moves.pop(0)
        if m[0] == "y":
            turns.append(m)
        else:
            auf += TURNS[m[1:]]
    return auf % 4, " ".join(turns + moves)


def main():
    wrong, count, keys = [], 0, set()
    blocks = []
    for s in read(os.path.join(ROOT, "tools", "zbls.txt")):
        subs = {}
        for c in s["cases"]:
            if not c["main"]:
                wrong.append("%s has no algorithm" % c["name"])
                continue
            try:
                pic = slot_case(parse(c["main"][0][0]))
            except Bad:
                pic = None
            if not pic:
                wrong.append("%s: %s doesn't solve the front right slot" % (c["name"], c["main"][0][0]))
                continue
            if slot_key(pic) in keys:
                wrong.append("%s is another case's twin" % c["name"])
            keys.add(slot_key(pic))
            row, seen = {"name": c["name"], "ll": pic}, set()
            for kind, field in (("main", "two"), ("more", "two2")):
                row[field], row[field.replace("two", "by")] = [], []
                for alg, who, n in c[kind]:
                    try:
                        auf, text = split(alg)
                        works = slot_solves(parse(text), pic)
                    except (Bad, KeyError):
                        works = None
                    if not works or auf not in works:
                        wrong.append("line %d: %s doesn't solve %s" % (n, alg, c["name"]))
                    elif text in seen:
                        wrong.append("line %d: %s is in %s twice" % (n, alg, c["name"]))
                    else:
                        seen.add(text)
                        row[field].append("%d%s" % (auf, text))
                        row[field.replace("two", "by")].append(who)
            count += len(seen)
            number = int(c["name"].split("-")[0])
            subs.setdefault(number, []).append("      " + json.dumps({k: v for k, v in row.items() if v}, ensure_ascii=False, separators=(",", ":")))
        head = ",".join("%s:%s" % (json.dumps(k), json.dumps(s[k])) for k in ("id", "tab", "name"))
        body = ",\n".join('    {"n":%d,"cases":[\n%s\n    ]}' % (n, ",\n".join(rows)) for n, rows in subs.items())
        blocks.append("  {%s,\"subs\":[\n%s\n  ]}" % (head, body))
    if wrong:
        raise SystemExit("\n".join(wrong))
    with open(os.path.join(ROOT, "src", "data", "zbls.json"), "w", encoding="utf-8") as f:
        f.write("[\n" + ",\n".join(blocks) + "\n]\n")
    print("%d cases, %d algorithms, all of them simulated" % (len(keys), count))


if __name__ == "__main__":
    main()
