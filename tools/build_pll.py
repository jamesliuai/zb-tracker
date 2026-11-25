#!/usr/bin/env python3
"""Turn tools/pll.txt into src/data/pll.json.

    python3 tools/build_pll.py

Every algorithm is simulated. They all have to solve the case they're listed under, and the AUF each
one needs is worked out from the picture. Nothing is written if one of them doesn't.

Saved progress is keyed by name (PLL-Ja), so algorithms and cases can be moved around freely.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cube import Bad, case_state, f2l_ok, ll, parse, shift, solves  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KINDS = ("yiheng", "two", "two+", "oh", "oh+")

# ---------------------------------------------------------------- the picture
SOLVED = "UUUUUUUUUBBBRRRFFFLLL"
CORNERS = {"BL": (9, 18), "BR": (11, 12), "FR": (17, 14), "FL": (15, 20)}
EDGES = {"B": (10,), "R": (13,), "F": (16,), "L": (19,)}


def picture(alg):
    """The position `alg` solves, colored so the arrows on it are the ones everybody draws."""
    s = ll(case_state(parse(alg)))
    assert s[:9] == "U" * 9, alg

    def rank(p):
        ok = lambda pieces: {k for k, at in pieces.items() if all(p[i] == SOLVED[i] for i in at)}
        corners, edges = ok(CORNERS), ok(EDGES)
        blocks = sum(e in c for c in corners for e in edges)
        return -len(corners) - len(edges), -blocks, -len(corners), "B" in edges

    return min((shift(s, k) for k in range(4)), key=rank)


# ---------------------------------------------------------------- reading
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
            assert not rest, "line %d: %s" % (n, line)
            case = {"name": kind, **{k: [] for k in KINDS}}
            sets[-1]["cases"].append(case)
            continue
        alg, _, tip = (x.strip() for x in rest.partition("|"))
        assert not tip or kind == "yiheng", "line %d: only Yiheng's have fingertricks" % n
        case[kind].append((alg, tip, n))
    return sets


def main():
    wrong, count, pictures = [], 0, set()
    sets = read(os.path.join(ROOT, "tools", "pll.txt"))
    blocks = []
    for s in sets:
        rows = []
        for c in s["cases"]:
            pic = picture(c["yiheng"][0][0])
            assert pic not in pictures, c["name"]
            pictures.add(pic)

            def pack(*kinds):
                out, seen = [], set()
                for kind in kinds:
                    for alg, _, n in c[kind]:
                        try:
                            auf = solves(parse(alg), pic)
                        except (Bad, ValueError):
                            auf = None
                        key = " ".join(parse(alg))
                        if not auf:
                            wrong.append("line %d: %s doesn't solve %s" % (n, alg, c["name"]))
                        elif key in seen:
                            wrong.append("line %d: %s is in %s twice" % (n, alg, c["name"]))
                        else:
                            seen.add(key)
                            out.append("%d%s" % (auf[0], alg))
                return out

            row = {"name": c["name"], "ll": pic, "two": pack("yiheng", "two"), "oh": pack("oh"),
                   "two2": pack("two+"), "oh2": pack("oh+"),
                   "yiheng": len(c["yiheng"]), "tips": [tip for _, tip, _ in c["yiheng"]]}
            both = [a[1:] for a in row["two"] + row["two2"]]
            if len(set(both)) < len(both):
                wrong.append("%s has an algorithm twice" % c["name"])
            while row["tips"] and not row["tips"][-1]:
                row["tips"].pop()
            assert row["oh"], c["name"]
            count += sum(len(row[k]) for k in ("two", "oh", "two2", "oh2"))
            rows.append("    " + json.dumps({k: v for k, v in row.items() if v}, ensure_ascii=False, separators=(",", ":")))
        head = ",".join("%s:%s" % (json.dumps(k), json.dumps(s[k])) for k in ("id", "tab", "name"))
        blocks.append("  {%s,\"cases\":[\n%s\n  ]}" % (head, ",\n".join(rows)))
    if wrong:
        raise SystemExit("\n".join(wrong))
    assert len(pictures) == 21, len(pictures)
    with open(os.path.join(ROOT, "src", "data", "pll.json"), "w", encoding="utf-8") as f:
        f.write("[\n" + ",\n".join(blocks) + "\n]\n")
    print("%d cases, %d algorithms, all of them simulated" % (len(pictures), count))


if __name__ == "__main__":
    main()
