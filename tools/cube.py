"""A tiny sticker-level 3x3 simulator, used only to check the algorithms in the sheet.

Pictures are read as a 21 character string in this order:
  U0..U8  top face, left to right, back row first
  B0..B2  back strip,  left to right
  R0..R2  right strip, back to front
  F0..F2  front strip, left to right
  L0..L2  left strip,  back to front
"""
import itertools
import re

POS = []  # (cubie position, sticker normal)
for x, y, z in itertools.product((-1, 0, 1), repeat=3):
    for axis, v in enumerate((x, y, z)):
        if v:
            n = [0, 0, 0]
            n[axis] = v
            POS.append(((x, y, z), tuple(n)))
IDX = {p: i for i, p in enumerate(POS)}
ID = list(range(54))

# clockwise quarter turns seen from +x / +y / +z
ROT = {
    "x": lambda p: (p[0], p[2], -p[1]),
    "y": lambda p: (-p[2], p[1], p[0]),
    "z": lambda p: (p[1], -p[0], p[2]),
}
# face -> axis, layers, number of clockwise quarter turns
BASE = {
    "R": ("x", (1,), 1), "L": ("x", (-1,), 3), "M": ("x", (0,), 3),
    "r": ("x", (0, 1), 1), "l": ("x", (-1, 0), 3), "x": ("x", (-1, 0, 1), 1),
    "U": ("y", (1,), 1), "D": ("y", (-1,), 3), "E": ("y", (0,), 3),
    "u": ("y", (0, 1), 1), "d": ("y", (-1, 0), 3), "y": ("y", (-1, 0, 1), 1),
    "F": ("z", (1,), 1), "B": ("z", (-1,), 3), "S": ("z", (0,), 1),
    "f": ("z", (0, 1), 1), "b": ("z", (-1, 0), 3), "z": ("z", (-1, 0, 1), 1),
}


def comp(p, q):
    """Do p, then q. perm[i] is where the sticker at i ends up."""
    return [q[i] for i in p]


def inv(p):
    out = [0] * 54
    for i, v in enumerate(p):
        out[v] = i
    return out


def _quarter(axis, layers):
    a, r, perm = "xyz".index(axis), ROT[axis], list(range(54))
    for i, (p, n) in enumerate(POS):
        if p[a] in layers:
            perm[i] = IDX[(r(p), r(n))]
    return perm


MOVE = {}
for name, (axis, layers, turns) in BASE.items():
    q, p = _quarter(axis, layers), ID
    for _ in range(turns):
        p = comp(p, q)
    MOVE[name] = p
    MOVE[name + "2"] = comp(p, p)
    MOVE[name + "'"] = comp(comp(p, p), p)


class Bad(Exception):
    """The text is not a readable algorithm."""


TOK = re.compile(r"([UDRLFBMESudrlfbxyz])([23]?)('?)")


def clean(s):
    for a in "’‘′`":
        s = s.replace(a, "'")
    return s.replace(" ", " ").replace("‌", "").replace("​", "")


def parse(alg):
    """Turn text into moves. '(R l)' is a grouping, 'L / r' means either, so use the first."""
    s = re.split(r"\s/\s*", clean(alg))[0]
    for c in "(),":
        s = s.replace(c, " ")
    out, i = [], 0
    while i < len(s):
        if s[i].isspace():
            i += 1
            continue
        m = TOK.match(s, i)
        if not m:
            raise Bad("cannot read %r" % s[i : i + 8])
        face, digits, prime = m.groups()
        n = {"": 1, "2": 2, "3": 3}[digits]
        if prime:
            n = (4 - n) % 4
        out.append(face + {1: "", 2: "2", 3: "'"}[n])
        i = m.end()
    return out


def perm_of(moves):
    p = ID
    for m in moves:
        p = comp(p, MOVE[m])
    return p


ROTS = [perm_of([q for q in (a, b) if q])
        for a in ("", "x", "x2", "x'", "z", "z'") for b in ("", "y", "y2", "y'")]
CENTERS = [i for i, (p, _) in enumerate(POS) if sum(map(abs, p)) == 1]


def fix_rotation(p):
    """Undo any whole-cube rotation the algorithm leaves behind."""
    for r in ROTS:
        q = comp(p, r)
        if all(q[c] == c for c in CENTERS):
            return q
    raise Bad("no rotation fits")


FACE = {(0, 1, 0): "U", (0, -1, 0): "D", (0, 0, 1): "F", (0, 0, -1): "B", (1, 0, 0): "R", (-1, 0, 0): "L"}
SOLVED = [FACE[n] for _, n in POS]


def case_state(moves):
    """The position these moves solve."""
    ip = inv(fix_rotation(perm_of(moves)))
    st = [None] * 54
    for i in range(54):
        st[ip[i]] = SOLVED[i]
    return st


LL = {}
for i, (x, z) in enumerate((x, z) for z in (-1, 0, 1) for x in (-1, 0, 1)):
    LL["U%d" % i] = IDX[((x, 1, z), (0, 1, 0))]
for k, x in enumerate((-1, 0, 1)):
    LL["B%d" % k] = IDX[((x, 1, -1), (0, 0, -1))]
    LL["F%d" % k] = IDX[((x, 1, 1), (0, 0, 1))]
for k, z in enumerate((-1, 0, 1)):
    LL["L%d" % k] = IDX[((-1, 1, z), (-1, 0, 0))]
    LL["R%d" % k] = IDX[((1, 1, z), (1, 0, 0))]
ORDER = ["U%d" % i for i in range(9)] + [f + str(i) for f in "BRFL" for i in range(3)]
REST = [i for i in range(54) if i not in set(LL.values())]


def f2l_ok(st):
    return all(st[i] == SOLVED[i] for i in REST)


def ll(st):
    return "".join(st[LL[k]] for k in ORDER)


CYCLE = "FRBL"


def shift(s, k):
    """Recolor the sides by k quarter turns. Same case, different final AUF."""
    return "".join(c if c == "U" else CYCLE[(CYCLE.index(c) + k) % 4] for c in s)


def canon(s):
    return min(shift(s, k) for k in range(4))


def turn(s, k):
    """The picture after U^k."""
    d = dict(zip(ORDER, s))
    for _ in range(k % 4):
        n = {}
        for i in range(3):
            for j in range(3):
                n["U%d" % (j * 3 + 2 - i)] = d["U%d" % (i * 3 + j)]
        for t in range(3):
            n["R%d" % t] = d["B%d" % t]
            n["F%d" % (2 - t)] = d["R%d" % t]
            n["L%d" % t] = d["F%d" % t]
            n["B%d" % (2 - t)] = d["L%d" % t]
        d = n
    return "".join(d[k2] for k2 in ORDER)


def solves(moves, target):
    """Which pre-AUFs (0..3 quarter U turns) make `moves` solve `target`? [] if none."""
    st = case_state(moves)
    if not f2l_ok(st):
        return None
    got = canon(ll(st))
    # picture + U^k must equal the position the bare moves solve
    return [k for k in range(4) if canon(turn(target, k)) == got]
