#!/usr/bin/env python3
"""Turn the ZBLL spreadsheet into src/data/zbll.json.

    python3 tools/build_data.py [sheet.xlsx]        (needs Pillow and numpy)

The spreadsheet isn't part of this repository. Save it in the project root first, or pass its path.

Every picture is read sticker by sticker and every algorithm is simulated against its
picture. Wrong AUFs are corrected, single-move typos are repaired when the repair provably
solves the case, and anything left over is dropped. All of it is listed in tools/DATA_NOTES.md.

Saved progress is keyed by position (T3-5 is the fifth case of T3), so editing algorithms is
safe, but adding or reordering rows would shift everyone's progress.
"""
import glob
import io
import json
import os
import re
import sys
from collections import Counter, defaultdict

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cube import ORDER, Bad, canon, clean, parse, shift, solves, turn  # noqa: E402
from xlsx import Book  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEETS = [("T", "T"), ("U", "U"), ("L", "L"), ("H", "H"), ("Pi", "Pi"), ("S", "Sune"), ("AS", "As")]
FULL = {"T": "T", "U": "U", "L": "L", "H": "H", "Pi": "Pi", "S": "Sune", "AS": "Antisune"}
COLL_NAME = {"Diag": "Diagonal", "Pétard": "Pétard"}

# ---------------------------------------------------------------- pictures -> stickers
PAINT = {"Y": (255, 255, 0), "R": (225, 0, 0), "O": (250, 160, 0), "G": (60, 215, 10), "B": (20, 20, 245)}
TO_FACE = {"Y": "U", "B": "F", "R": "R", "G": "B", "O": "L"}  # yellow top, blue front


def read_stickers(png):
    p = Image.open(io.BytesIO(png)).convert("RGBA")
    bg = Image.new("RGBA", p.size, (255, 255, 255, 255))
    bg.alpha_composite(p)
    a = np.array(bg.convert("RGB")).astype(int)
    colorful = (a.max(2) - a.min(2)) > 90
    colorful[:2] = colorful[-2:] = 0
    colorful[:, :2] = colorful[:, -2:] = 0
    ys, xs = np.where(colorful.sum(1) > 3)[0], np.where(colorful.sum(0) > 3)[0]
    x0, y0, w, h = xs[0], ys[0], xs[-1] + 1 - xs[0], ys[-1] + 1 - ys[0]

    def at(fx, fy):
        cx, cy, r = int(x0 + fx * w), int(y0 + fy * h), max(1, int(min(w, h) * 0.018))
        votes = Counter()
        for q in a[cy - r : cy + r + 1, cx - r : cx + r + 1].reshape(-1, 3):
            if q.max() - q.min() > 70:
                votes[min(PAINT, key=lambda k: sum((int(i) - j) ** 2 for i, j in zip(q, PAINT[k])))] += 1
        return votes.most_common(1)[0][0]

    c, e = (0.253, 0.5, 0.747), 0.055
    d = {"U%d" % (i * 3 + j): at(c[j], c[i]) for i in range(3) for j in range(3)}
    for k in range(3):
        d["B%d" % k], d["F%d" % k] = at(c[k], e), at(c[k], 1 - e)
        d["L%d" % k], d["R%d" % k] = at(e, c[k]), at(1 - e, c[k])
    s = "".join(TO_FACE[d[k]] for k in ORDER)
    count = Counter(s)
    assert count["U"] == 9 and all(count[f] == 3 for f in "FRBL"), count
    assert all(s[i] == "U" for i in (1, 3, 4, 5, 7)), s
    return s


# ---------------------------------------------------------------- text -> algorithms
AUF = re.compile(r"^\s*(?:\[(U2'?|U'?)\]\s*)+")
AUF_TURNS = {"": 0, "U": 1, "U2": 2, "U2'": 2, "U'": 3}
TURNS_AUF = ["none", "U", "U2", "U'"]


def tidy(s):
    s = re.sub(r"\(\s+", "(", re.sub(r"\s+\)", ")", s))
    s = re.sub(r"\s*/\s*", " / ", s)
    return re.sub(r"\s+", " ", s).strip()


def split_lines(text):
    out = []
    for l in clean(text or "").split("\n"):
        l = l.strip()
        if not l:
            continue
        l = re.sub(r"^(U2?'?\])", r"[\1", l)  # '[' lost in copy and paste
        l = re.sub(r"\s*(\*.*\*|\((?:[A-Z][a-z]{2,}.*)\))\s*$", "", l)  # trailing remark
        out.append(l)
    return out


def read_line(line):
    m = AUF.match(line)
    pre = sum(AUF_TURNS[p] for p in re.findall(r"\[(U2'?|U'?)\]", m.group(0))) % 4 if m else 0
    return pre, tidy(line[m.end() :] if m else line)


def family(m):
    return "".join(sorted({"R": "RLMx", "L": "RLMx", "M": "RLMx", "r": "RLMx", "l": "RLMx", "x": "RLMx",
                           "U": "UDEy", "D": "UDEy", "E": "UDEy", "u": "UDEy", "d": "UDEy", "y": "UDEy"}.get(m[0], "FBSz")))


def edits(mv):
    """Single typos, most believable first."""
    for i, x in enumerate(mv):  # a prime or a 2 slipped
        for suf in ("", "2", "'"):
            if x[0] + suf != x:
                yield "amount", mv[:i] + [x[0] + suf] + mv[i + 1 :]
    for i, x in enumerate(mv):  # R typed for r
        if x[0].lower() in "rludfb":
            yield "wide", mv[:i] + [x[0].swapcase() + x[1:]] + mv[i + 1 :]
    for i in range(len(mv) - 1):  # two moves swapped
        yield "swap", mv[:i] + [mv[i + 1], mv[i]] + mv[i + 2 :]
    for i in range(len(mv)):  # an extra move
        yield "extra", mv[:i] + mv[i + 1 :]
    for i, x in enumerate(mv):  # the wrong face
        for f in "RULDFB":
            if f != x[0].upper() and f + x[1:] != x:
                yield "face", mv[:i] + [f + x[1:]] + mv[i + 1 :]
    for i in range(len(mv) + 1):  # a missing move
        for f in "RULDFBz":
            for suf in ("", "2", "'"):
                yield "missing", mv[:i] + [f + suf] + mv[i:]


def sensible(mv):
    """No back to back turns on one axis that the original line did not already have."""
    return not any(a[0].upper() == b[0].upper() for a, b in zip(mv, mv[1:]))


def apply_edit(text, before, after):
    """Keep the author's own spelling (brackets, R2', slashes) and change only the typo."""
    parts = re.split(r"\s/\s*", text)
    toks = re.findall(r"[()]|[^\s()]+", parts[0])
    moves = [i for i, t in enumerate(toks) if t not in "()"]
    if len(moves) != len(before):
        return tidy(" ".join(after))
    a = 0
    while a < len(before) and a < len(after) and before[a] == after[a]:
        a += 1
    b = 0
    while b < min(len(before), len(after)) - a and before[-1 - b] == after[-1 - b]:
        b += 1
    old, new = moves[a : len(moves) - b], after[a : len(after) - b]
    start = old[0] if old else (moves[a] if a < len(moves) else len(toks))
    stop = old[-1] + 1 if old else start
    toks[start:stop] = new
    body = tidy(" ".join(toks))
    tail = parts[1:] if b and len(parts) > 1 else []
    return tidy(" / ".join([body] + tail))


def key(alg):
    return " ".join(parse(alg)) + "|" + "/".join(re.split(r"\s/\s*", alg)[1:])


# ---------------------------------------------------------------- main
def main():
    found = sys.argv[1:] or glob.glob(os.path.join(ROOT, "*.xlsx"))
    if not found:
        raise SystemExit("No spreadsheet found. Save it in %s or pass its path." % ROOT)
    book = Book(found[0])
    notes = defaultdict(list)
    stats = Counter()
    sets_out = []

    for sid, sheet in SHEETS:
        cells, comments, images = book.cells(sheet), book.comments(sheet), book.images(sheet)
        rows = sorted(r for (c, r), v in cells.items() if c == 4 and r >= 5 and str(v).strip())
        heads = [r for r in rows if (2, r) in cells]
        subs = []
        for hi, head in enumerate(heads):
            end = heads[hi + 1] if hi + 1 < len(heads) else rows[-1] + 1
            title = re.sub(r"\s+", " ", cells[(2, head)]).strip()
            coll = title.split(":", 1)[1].strip()
            subs.append({"id": "%s%d" % (sid, hi + 1), "name": COLL_NAME.get(coll, coll),
                         "rows": [r for r in rows if head <= r < end], "cases": []})

        for sub in subs:
            pics = {r: read_stickers(images[r]) for r in sub["rows"]}
            # The sheet colors each picture differently. Pick the coloring of the first one and
            # recolor the rest so the corners match and only the edges change.
            corner = [ORDER.index(k) for k in ("B0", "L0", "B2", "R0", "F0", "L2", "F2", "R2", "U0", "U2", "U6", "U8")]
            want = None
            for r in sub["rows"]:
                if want is None:
                    want = [pics[r][i] for i in corner]
                for k in range(4):
                    s = shift(pics[r], k)
                    if [s[i] for i in corner] == want:
                        pics[r] = s
                        break
                else:
                    raise SystemExit("corners differ inside %s" % sub["id"])

            for n, r in enumerate(sub["rows"], 1):
                target, cid = pics[r], "%s-%d" % (sub["id"], n)
                where = "%s (sheet %s, row %d)" % (cid, sheet, r)

                def check(lines, refs, kind):
                    out, i = [], 0
                    while i < len(lines):
                        line = lines[i]
                        i += 1
                        if re.match(r"(?i)same", line):
                            num = re.search(r"(\d)", line)
                            src = refs[0]
                            if num and int(num.group(1)) > len(src):
                                src = refs[1]
                            pick = -1 if "last" in line.lower() else (int(num.group(1)) - 1 if num else 0)
                            if src and pick < len(src) and src[pick] is not None:
                                out.append(src[pick])
                                stats["same"] += 1
                            else:
                                notes["dropped"].append("%s, %s: `%s` points at nothing" % (where, kind, line))
                            continue
                        pre, alg = read_line(line)
                        try:
                            mv = parse(alg)
                            hit = solves(mv, target)
                        except Bad as e:
                            notes["dropped"].append("%s, %s: `%s` %s" % (where, kind, line, e))
                            out.append(None)
                            continue
                        stats["read"] += 1
                        if hit:
                            if pre not in hit:
                                notes["auf"].append("%s, %s: `%s` needs AUF %s" % (where, kind, line, TURNS_AUF[hit[0]]))
                                pre = hit[0]
                            else:
                                stats["ok"] += 1
                            out.append((pre, alg))
                            continue
                        if hit is None and i < len(lines) and not lines[i].startswith("["):
                            joined = tidy(alg + " " + lines[i])  # one line wrapped onto two
                            try:
                                h2 = solves(parse(joined), target)
                            except Bad:
                                h2 = None
                            if h2:
                                i += 1
                                p2 = pre if pre in h2 else h2[0]
                                notes["fixed"].append("%s, %s: rejoined a line that had wrapped, `%s`" % (where, kind, joined))
                                out.append((p2, joined))
                                continue
                        fix = None
                        if hit is None:  # breaks F2L, so it is a typo rather than another case
                            already = not sensible(mv)
                            for label, e in edits(mv):
                                if fix and fix[0] != label:
                                    break  # a more believable kind of typo already explains it
                                if not already and not sensible(e):
                                    continue
                                try:
                                    h = solves(e, target)
                                except Bad:
                                    continue
                                if h and (fix is None or (pre in h and fix[2] != pre)):
                                    fix = (label, e, pre if pre in h else h[0])
                        if fix:
                            new = apply_edit(alg, mv, fix[1])
                            assert solves(parse(new), target), (alg, new)
                            notes["fixed"].append("%s, %s: `%s` to `%s`" % (where, kind, line, (("[%s] " % TURNS_AUF[fix[2]]) if fix[2] else "") + new))
                            out.append((fix[2], new))
                        else:
                            why = "does not solve this picture" if hit == [] else "breaks F2L"
                            notes["dropped"].append("%s, %s: `%s` %s" % (where, kind, line, why))
                            out.append(None)
                    return out

                two = check(split_lines(cells.get((4, r))), ([], []), "two-handed")
                two_more = check(split_lines(comments.get((4, r))), (two, []), "two-handed comment")
                oh = check(split_lines(cells.get((5, r))), (two, two_more), "one-handed")
                oh_more = check(split_lines(comments.get((5, r))), (two, two_more), "one-handed comment")

                def pack(algs, skip=()):
                    seen, out = {key(a) for _, a in filter(None, skip)}, []
                    for a in algs:
                        if a and key(a[1]) not in seen:
                            seen.add(key(a[1]))
                            out.append("%d%s" % a)
                    return out

                case = {"ll": target, "two": pack(two), "oh": pack(oh),
                        "two2": pack(two_more, two), "oh2": pack(oh_more, oh)}
                for k in ("two", "oh"):
                    assert case[k], (cid, k)
                for k in ("two", "oh", "two2", "oh2"):
                    stats[k] += len(case[k])
                    for a in case[k]:  # final proof, on exactly what ships
                        assert int(a[0]) in solves(parse(a[1:]), target), (cid, a)
                sub["cases"].append({k: v for k, v in case.items() if v})
            del sub["rows"]
        sets_out.append({"id": sid, "name": FULL[sid], "subs": subs})

    allc = [c["ll"] for s in sets_out for sub in s["subs"] for c in sub["cases"]]
    uniq = {min(canon(turn(x, k)) for k in range(4)) for x in allc}
    assert len(allc) == len(uniq) == 472, (len(allc), len(uniq))

    os.makedirs(os.path.join(ROOT, "src", "data"), exist_ok=True)
    lines = []
    for s in sets_out:
        subs = ",\n".join(
            '    {"id":%s,"name":%s,"cases":[\n%s\n    ]}' % (
                json.dumps(sub["id"]), json.dumps(sub["name"], ensure_ascii=False),
                ",\n".join("      " + json.dumps(c, ensure_ascii=False, separators=(",", ":")) for c in sub["cases"]))
            for sub in s["subs"])
        lines.append('  {"id":%s,"name":%s,"subs":[\n%s\n  ]}' % (json.dumps(s["id"]), json.dumps(s["name"]), subs))
    with open(os.path.join(ROOT, "src", "data", "zbll.json"), "w") as f:
        f.write("[\n" + ",\n".join(lines) + "\n]\n")

    with open(os.path.join(ROOT, "tools", "DATA_NOTES.md"), "w") as f:
        f.write("# What changed between the spreadsheet and the site\n\n")
        f.write("Written by `tools/build_data.py`. All 472 pictures were read sticker by sticker and every algorithm was "
                "simulated against its picture.\n\n")
        f.write("- %d cases, all different, covering every ZBLL case exactly once\n" % len(allc))
        f.write("- %d algorithm lines simulated, %d matched their picture and AUF as written\n" % (stats["read"], stats["ok"]))
        f.write("- %d two-handed and %d one-handed algorithms ship, plus %d and %d from the hover comments\n"
                % (stats["two"], stats["oh"], stats["two2"], stats["oh2"]))
        for k, title, blurb in (
            ("fixed", "Typos repaired", "Each repair changes one move, or rejoins a line that had wrapped, and was proven to solve the case."),
            ("auf", "AUFs corrected", "The algorithm is right, the AUF in front of it was not."),
            ("dropped", "Left out", "These do not solve their picture and no one-move repair does either."),
        ):
            f.write("\n## %s (%d)\n\n%s\n\n" % (title, len(notes[k]), blurb))
            f.writelines("- %s\n" % l for l in notes[k])
    print(dict(stats))
    print({k: len(v) for k, v in notes.items()})


if __name__ == "__main__":
    main()
