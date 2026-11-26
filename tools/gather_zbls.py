#!/usr/bin/env python3
"""Gather the ZBLS algorithms from where they're published into tools/zbls.txt.

    python3 tools/gather_zbls.py path/to/ZBs_Xuanyi_Qixian_Tymon.xlsx

Then run tools/build_zbls.py. Running this again starts zbls.txt over, so make changes by hand after
the last run of it.

The sources, in the order they count:

1. The ZBLS library at https://cyrickyarar.github.io/zbls_site_static/ by CYRickyArAr, the data its
   pages are made from. 305 cases in the order of speedcubingtips.eu, each algorithm marked with the
   pros who use it. Its pictures, and the AUFs written into its algorithms, are the ones used here.
2. Yota Ueda's sheet of the ZBLS that Xuanyi Geng, Qixian Cai and Tymon Kolasinski did in solves
   reconstructed on reco.nz, its FR tab. It credits Qixian, whom the library doesn't track, and adds
   what they did that the library doesn't have. Its other tabs are for the other slots.
3. solved.no's ZBLS page, for the most used algorithms there that no pro above uses, if at least five
   people use them.

Within a case, Xuanyi's algorithms come first, in the library's order and then the sheet's. The rest
of the pros' follow, the ones more pros use first. solved.no's go behind "more".
"""
import json
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cube import parse, slot_case, slot_key, slot_solves  # noqa: E402
from xlsx import Book  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIBRARY = "https://cyrickyarar.github.io/zbls_site_static/data.js"
SOLVED_NO = "https://solved.no/algs/3x3/zbls"

# the library's marks, as the pros are known
PEOPLE = {"耿": "Xuanyi", "Qixian": "Qixian", "Tymon": "Tymon", "杜": "Yufang", "连": "Yunzhi", "昆": "Zhaokun",
          "藩": "Bofan", "懿": "Yi", "王": "Yiheng", "董": "Yize", "余": "Hansen", "南": "Seung Hyuk", "Park": "Max",
          "Feliks": "Feliks", "Leo": "Leo", "Matty": "Matty", "Luke": "Luke"}
ORDER = list(PEOPLE.values())

SETS = [
    ("ZBLS-basic", "Basic", "Basic inserts", range(1, 5)),
    ("ZBLS-side", "Side", "White to the side", range(5, 17)),
    ("ZBLS-up", "Up", "White facing up", range(17, 25)),
    ("ZBLS-corner", "Corner", "Corner in the slot", range(25, 31)),
    ("ZBLS-edge", "Edge", "Edge in the slot", range(31, 37)),
    ("ZBLS-both", "Both", "Both in the slot", range(37, 43)),
]
# from solved.no: up to two of its most used algorithms that aren't here yet, each used by this many
MORE, MORE_USERS = 2, 5
AUF = ["", "U", "U2", "U'"]
EFFORT = [0, 1, 2, 1]


def fetch(url):
    # curl, because the Python from python.org has no certificates to check a site with until it's set up
    return subprocess.run(["curl", "-fsSL", "--max-time", "60", "-A", "Mozilla/5.0 (zb-tracker data tool)", url], check=True, capture_output=True).stdout.decode("utf-8")


def split(alg):
    """The y turns at the front of an algorithm, and the rest without the U turns among them."""
    moves = parse(alg)
    turns = []
    while moves and moves[0][0] in "Uy":
        m = moves.pop(0)
        if m[0] == "y":
            turns.append(m)
    return turns, moves


def core(alg):
    """The same algorithm whatever AUF it's written with."""
    turns, rest = split(alg)
    return " ".join(turns + rest)


def written(alg, picture):
    """The algorithm with the AUF it needs from `picture`, after any y turns."""
    turns, rest = split(alg)
    aufs = slot_solves(turns + rest, picture)
    assert aufs, alg
    auf = min(aufs, key=EFFORT.__getitem__)
    return " ".join(turns + ([AUF[auf]] if auf else []) + rest)


def library():
    text = fetch(LIBRARY)
    data = json.loads(text[text.index("{"): text.rindex("}") + 1])
    for cat in data["categories"]:
        for sub in cat["subcategories"]:
            for f in sub["formulas"]:
                yield f["id"][1:], [(line["alg"], [PEOPLE[m] for m in line.get("marks", [])]) for line in f["lines"]]


def solved_no():
    page = fetch(SOLVED_NO)
    data = json.loads(re.search(r'<script[^>]*id="algs-template-server-data"[^>]*>(.*?)</script>', page, re.S).group(1))
    algs = data["algorithmsDict"]
    for ids in data["caseAlgorithms"].values():
        yield [(algs[str(i)]["alg"], algs[str(i)]["usercount"]) for i in ids]


def sheet(path):
    """(algorithm, who, solves it was seen in) for every algorithm on the FR tab."""
    cells = Book(path).cells("FR")
    for r in sorted({k[1] for k in cells})[1:]:
        for alg_col, link_col, tymon in ((2, 3, False), (4, 5, True)):
            alg, links = cells.get((alg_col, r)), cells.get((link_col, r)) or ""
            if alg:
                who = ["Tymon"] if tymon else [n for tag, n in (("(x)", "Xuanyi"), ("(q)", "Qixian")) if tag in links]
                yield alg, who, links.count("reco.nz")


class Case:
    def __init__(self, name, lines):
        self.name = name
        self.picture = slot_case(parse(lines[0][0]))
        self.algs = {}  # core -> Alg
        self.more = []
        for n, (alg, who) in enumerate(lines):
            assert slot_case(parse(alg)) == self.picture, (name, alg)
            self.add(alg, who, (0, n))

    def add(self, alg, who, source, seen=0):
        a = self.algs.get(core(alg))
        if not a:
            a = self.algs[core(alg)] = Alg(written(alg, self.picture), source)
        a.who += [w for w in who if w not in a.who]
        if "Xuanyi" in who:
            a.seen += seen
        return a


class Alg:
    def __init__(self, text, source):
        self.text, self.source, self.who, self.seen = text, source, [], 0

    def rank(self):
        if "Xuanyi" in self.who:
            return (0, self.source[0], -self.seen, self.source[1])
        return (1, -len(self.who), self.source)


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__.split("\n\n")[1])
    cases = [Case(name, lines) for name, lines in library()]
    by_key = {slot_key(c.picture): c for c in cases}
    assert len(by_key) == len(cases) == 305

    before = sum(len(c.algs) for c in cases)
    for n, (alg, who, seen) in enumerate(sheet(sys.argv[1])):
        by_key[slot_key(slot_case(parse(alg)))].add(alg, who, (1, n), seen)
    from_sheet = sum(len(c.algs) for c in cases) - before

    for algs in solved_no():
        c = by_key[slot_key(slot_case(parse(algs[0][0])))]
        for alg, users in sorted(algs, key=lambda a: -a[1]):
            if core(alg) in c.algs or core(alg) in [core(a) for a, _ in c.more]:
                continue
            if len(c.more) == MORE or users < MORE_USERS:
                break
            c.more.append((written(alg, c.picture), users))

    out = [HEAD]
    for sid, tab, name, numbers in SETS:
        out.append("== %s | %s | %s\n" % (sid, tab, name))
        for c in cases:
            if int(c.name.split("-")[0]) not in numbers:
                continue
            out.append(c.name)
            for a in sorted(c.algs.values(), key=Alg.rank):
                out.append(("main  %-46s | %s" % (a.text, ", ".join(sorted(a.who, key=ORDER.index)))).rstrip())
            for alg, users in c.more:
                out.append("more  %-46s | %d on solved.no" % (alg, users))
            out.append("")
    with open(os.path.join(ROOT, "tools", "zbls.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(out).rstrip() + "\n")
    print("305 cases. %d algorithms from the library, %d more from the sheet, %d from solved.no" % (before, from_sheet, sum(len(c.more) for c in cases)))


HEAD = """# The ZBLS algorithms. Run tools/build_zbls.py after changing anything here.
#
# tools/gather_zbls.py wrote this from the sources below. Running it again starts this file over.
#
#   == id | tab | name   a set of cases
#   5-3                  a case, the third of the eight in F2L case 5, which differ in their edges
#   main                 an algorithm shown with the case. The first is the one it starts with.
#   more                 an algorithm behind "more"
#   After a | comes who uses it, or how many use it on solved.no.
#
# Every algorithm is written with the AUF it needs from the case as the library draws it, after any
# y turn. The first of a case also decides which way its picture faces.
#
# Where they come from
#   The library: https://cyrickyarar.github.io/zbls_site_static/ by CYRickyArAr, with its cases
#   numbered as on https://www.speedcubingtips.eu/zbls-zborowski-bruchem-last-slot/
#   The sheet: Yota Ueda's (2016UEDA01) collection of the ZBLS that Xuanyi Geng, Qixian Cai and Tymon
#   Kolasinski did in solves reconstructed on https://reco.nz/
#   solved.no: https://solved.no/algs/3x3/zbls, with how many people there use each one.
#
# Xuanyi's come first, in the library's order and then by how often he did them in the sheet. The
# other pros' follow, the ones more of them use first.
"""

if __name__ == "__main__":
    main()
