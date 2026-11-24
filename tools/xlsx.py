"""Reads just what we need out of the spreadsheet, with no third party packages."""
import os
import re
import xml.etree.ElementTree as ET
import zipfile

NS = {
    "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "xdr": "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
}


def M(t):
    return "{%s}%s" % (NS["m"], t)


def _text(el):
    out = []
    for ch in el:
        if ch.tag == M("t"):
            out.append(ch.text or "")
        elif ch.tag == M("r"):
            t = ch.find(M("t"))
            out.append((t.text or "") if t is not None else "")
    return "".join(out)


def _ref(ref):
    m = re.match(r"([A-Z]+)(\d+)$", ref)
    n = 0
    for c in m.group(1):
        n = n * 26 + ord(c) - 64
    return n, int(m.group(2))


class Book:
    def __init__(self, path):
        self.z = zipfile.ZipFile(path)
        self.strings = [_text(si) for si in self._xml("xl/sharedStrings.xml")]
        rels = self._rels("xl/_rels/workbook.xml.rels")
        self.sheets = {}
        for s in self._xml("xl/workbook.xml").iter(M("sheet")):
            self.sheets[s.attrib["name"]] = "xl/" + rels[s.attrib["{%s}id" % NS["r"]]]

    def _xml(self, p):
        return ET.fromstring(self.z.read(p))

    def _rels(self, p):
        return {x.attrib["Id"]: x.attrib["Target"] for x in self._xml(p)} if p in self.z.namelist() else {}

    def _related(self, sheet, kind):
        p = self.sheets[sheet]
        rp = os.path.join(os.path.dirname(p), "_rels", os.path.basename(p) + ".rels")
        for x in self._xml(rp):
            if x.attrib["Type"].endswith("/" + kind):
                return os.path.normpath(os.path.join(os.path.dirname(p), x.attrib["Target"]))

    def cells(self, sheet):
        out = {}
        for c in self._xml(self.sheets[sheet]).iter(M("c")):
            v = c.find(M("v"))
            if v is None:
                continue
            out[_ref(c.attrib["r"])] = self.strings[int(v.text)] if c.attrib.get("t") == "s" else v.text
        return out

    def comments(self, sheet):
        r = self._xml(self._related(sheet, "comments"))
        return {_ref(c.attrib["ref"]): _text(c.find(M("text"))) for c in r.iter(M("comment"))}

    def images(self, sheet):
        """row -> png bytes"""
        p = self._related(sheet, "drawing")
        rels = self._rels(os.path.join(os.path.dirname(p), "_rels", os.path.basename(p) + ".rels"))
        out = {}
        for anchor in self._xml(p):
            blip = anchor.find(".//a:blip", NS)
            if blip is None:
                continue
            row = int(anchor.find("xdr:from", NS).find("xdr:row", NS).text) + 1
            target = rels[blip.attrib["{%s}embed" % NS["r"]]]
            out[row] = self.z.read(os.path.normpath(os.path.join(os.path.dirname(p), target)))
        return out
