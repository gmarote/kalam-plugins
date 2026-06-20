#!/usr/bin/env python3
"""
Extractor determinista de mediciones (MQT) -> tabla canónica de una sola hoja.

NOTA: la lógica que se publica vive en `app/normalizar.core.js` (JS), que es la
fuente de verdad. Este script es el extractor de referencia / oráculo de
validación del plugin; no se mantiene en lockstep con el JS.

NO es un parser "mágico": recibe una CONFIG (familia, mapeo de columnas, hojas,
trato de parciales…) que el agente acuerda con el cliente, y aplica esa receta
de forma reproducible. La IA decide la ESTRUCTURA; este script extrae las
CIFRAS. Nunca se transcriben mediciones a mano.

Uso:
    python extraer.py <entrada.xlsx|.xls> <config.json> <salida.xlsx>

CONFIG (JSON):
{
  "familia": "codigo" | "formato",
  "hojas": ["MQT"],                 # null/ausente = todas las hojas con datos
  "hojas_excluidas": ["Resumo"],
  "columnas": {"code":0,"desc":1,"unit":2,"qty":3,"price":4},  # 0-based; opcional
  "cabecera": {"marcadores": ["item","art","designa"]},        # opcional
  "parciales": "conservar" | "colapsar",     # por defecto conservar
  "capitulo_desde_hoja": true,               # familia formato: capítulo = nombre de pestaña
  "volcar_notas": false                      # si true, hoja extra "Notas"
}
"""
import sys, json, re
import pandas as pd
from openpyxl.styles import Font, Alignment, PatternFill
from openpyxl.utils import get_column_letter

CANON = ["archivo", "hoja", "fila_origen", "capitulo", "subcapitulo", "seccion",
         "ruta", "codigo", "partida", "detalle", "unidad", "medicion"]

# ---------- formato de salida (presentación; nunca toca los datos) ----------
ANCHOS = {"archivo": 22, "hoja": 16, "fila_origen": 9, "capitulo": 22,
          "subcapitulo": 24, "seccion": 20, "ruta": 42, "codigo": 10,
          "partida": 52, "detalle": 34, "unidad": 7, "medicion": 13,
          "nota": 90}
WRAP = {"partida", "detalle", "ruta", "subcapitulo", "seccion", "nota"}
# Formato PT/ES (punto de millares, coma decimal) forzado con locale pt-PT [$-816],
# para que se vea igual sea cual sea el idioma del Excel del cliente.
NUMFMT = {"medicion": "[$-816]#,##0.00"}

def formatear(ws, columnas):
    ws.freeze_panes = "A2"                 # cabecera siempre visible
    ws.row_dimensions[1].height = 26
    bold = Font(bold=True)
    gris = PatternFill("solid", fgColor="E6E6E6")   # gris suave para la cabecera
    top = Alignment(vertical="top")
    top_wrap = Alignment(vertical="top", wrap_text=True)
    for j, name in enumerate(columnas, start=1):
        head = ws.cell(row=1, column=j)
        head.font = bold
        head.fill = gris
        head.alignment = top
        ws.column_dimensions[get_column_letter(j)].width = ANCHOS.get(name, 16)
        fmt, align = NUMFMT.get(name), (top_wrap if name in WRAP else top)
        for i in range(2, ws.max_row + 1):
            c = ws.cell(row=i, column=j)
            c.alignment = align            # todo alineado arriba
            if fmt: c.number_format = fmt

DEFAULT_COLS = {
    "codigo":  {"code": 0, "desc": 1, "unit": 2, "qty": 3, "price": 4},
    "formato": {"code": 1, "desc": 3, "unit": 4, "qty": 5, "price": 7},
}

# ---------- helpers de celda ----------
def txt(v):
    if v is None: return ""
    if isinstance(v, float) and pd.isna(v): return ""
    return str(v).strip()

def to_num(v):
    if isinstance(v, (int, float)) and not (isinstance(v, float) and pd.isna(v)):
        return float(v)
    s = txt(v).replace("€", "").replace(" ", "")
    if not s: return None
    if "," in s:                       # formato PT: coma decimal, punto de millares
        s = s.replace(".", "").replace(",", ".")
    try: return float(s)
    except ValueError: return None

def is_caps(s):
    letters = re.sub(r"[^A-Za-zÀ-ÿ]", "", s)
    return len(letters) > 2 and s == s.upper()

_STRUCT = re.compile(r"^[A-Za-z]{0,4}\d*(\.[A-Za-z0-9]+)*$")
def is_struct_code(s):
    return bool(_STRUCT.match(s)) and bool(re.search(r"\d", s)) and not s.upper().startswith("CG")
def is_letter_chapter(s):
    return bool(re.match(r"^[A-Za-z]{1,4}$", s))

def rec(**kw):
    r = {c: "" for c in CANON}
    for c in CANON:            # solo columnas del esquema (precio/importe se ignoran)
        if c in kw:
            r[c] = kw[c]
    return r

# ---------- localizar cabecera ----------
def find_header(grid, col, marcadores):
    for i, row in enumerate(grid):
        cell = txt(row[col] if col < len(row) else "").lower().replace("\n", " ")
        if any(m in cell for m in marcadores):
            return i
    return -1

# ---------- familia CÓDIGO (jerarquía por el código) ----------
def parse_codigo(grid, cols, archivo, hoja, stats):
    hdr = find_header(grid, cols["code"], ["item", "art", "designa", "nº"])
    out, titles = [], {}
    start = hdr + 1 if hdr >= 0 else 0
    for i in range(start, len(grid)):
        row = grid[i]
        fila = i + 1                      # 1-based, como se ve en Excel
        g = lambda k: row[cols[k]] if cols[k] < len(row) else None
        code, desc, unit = txt(g("code")), txt(g("desc")), txt(g("unit"))
        if unit == "0": unit = ""          # "0" fantasma (fórmula) en cabeceras: no es unidad
        qty, price = to_num(g("qty")), to_num(g("price"))
        if not code and not desc and qty is None:
            stats["vacia"] += 1; continue
        if re.match(r"(?i)^(sub\s*total|total)\b", desc) and qty is None:
            stats["subtotal"] += 1; continue                  # subtotal/total: se descarta
        if is_letter_chapter(code) and qty is None:           # capítulo solo-letra (E)
            stats["titulo"] += 1; titles = {1: desc}; continue
        if not is_struct_code(code):
            if qty is not None and unit:                      # ítem real sin código útil: NO se pierde
                stats["partida"] += 1
                ruta = " > ".join(titles[k] for k in sorted(titles) if titles.get(k))
                out.append(rec(archivo=archivo, hoja=hoja, fila_origen=fila,
                               capitulo=titles.get(1, ""), subcapitulo=titles.get(2, ""),
                               seccion=titles.get(3, ""), ruta=ruta, codigo="", partida=desc,
                               unidad=unit, medicion=qty))
            else:
                stats["nota" if desc else "vacia"] += 1
                if desc: out.append(("__nota__", hoja, fila, desc))
            continue
        nivel = len(code.split("."))
        if qty is not None and unit:                          # partida (hoja de medición)
            stats["partida"] += 1
            ruta = " > ".join(titles[k] for k in sorted(titles) if k < nivel and titles.get(k))
            out.append(rec(archivo=archivo, hoja=hoja, fila_origen=fila,
                           capitulo=(titles.get(1, "") if nivel > 1 else ""),
                           subcapitulo=(titles.get(2, "") if nivel > 2 else ""),
                           seccion=(titles.get(3, "") if nivel > 3 else ""),
                           ruta=ruta, codigo=code, partida=desc,
                           unidad=unit, medicion=qty))
        else:                                                 # título
            stats["titulo"] += 1
            titles[nivel] = desc
            for k in list(titles):
                if k > nivel: del titles[k]
    return out

# ---------- familia FORMATO (jerarquía por mayúsculas / posición) ----------
def parse_formato(grid, cols, archivo, hoja, capitulo_hoja, stats):
    hdr = find_header(grid, cols["code"], ["art"])
    capitulo = capitulo_hoja
    if hdr >= 0:
        d = txt(grid[hdr][cols["desc"]] if cols["desc"] < len(grid[hdr]) else "")
        capitulo = d or capitulo_hoja
    out, subcap, partida = [], "", None
    start = (hdr + 1) if hdr >= 0 else 0
    for i in range(start, len(grid)):
        row = grid[i]
        fila = i + 1                      # 1-based, como se ve en Excel
        g = lambda k: row[cols[k]] if cols[k] < len(row) else None
        code, desc, unit = txt(g("code")), txt(g("desc")), txt(g("unit"))
        if unit == "0": unit = ""          # "0" fantasma (fórmula) en cabeceras: no es unidad
        qty, price = to_num(g("qty")), to_num(g("price"))
        if desc == "DESCRITIVO": continue
        if not code and not desc and qty is None:
            stats["vacia"] += 1; continue
        if re.match(r"(?i)^total\b", desc) and qty is None:
            stats["subtotal"] += 1; continue
        ruta = " > ".join(x for x in (capitulo, subcap) if x)
        if code:
            if is_caps(desc) and qty is None:                 # título de subcapítulo
                subcap, partida = desc, None; stats["titulo"] += 1; continue
            partida = {"code": code, "desc": desc}; stats["partida"] += 1
            if qty is not None:                               # partida simple
                out.append(rec(archivo=archivo, hoja=hoja, fila_origen=fila,
                               capitulo=capitulo, subcapitulo=subcap, ruta=ruta,
                               codigo=code, partida=desc, unidad=unit, medicion=qty))
            continue
        if qty is not None:                                   # parcial
            stats["parcial"] += 1
            base = partida or {"code": "", "desc": ""}
            out.append(rec(archivo=archivo, hoja=hoja, fila_origen=fila,
                           capitulo=capitulo, subcapitulo=subcap, ruta=ruta,
                           codigo=base["code"], partida=base["desc"],
                           detalle=desc, unidad=unit, medicion=qty))
        elif desc:
            stats["nota"] += 1; out.append(("__nota__", hoja, fila, desc))
    return out

# ---------- colapsar parciales (opcional) ----------
def colapsar(rows):
    agg, order = {}, []
    for r in rows:
        if isinstance(r, tuple): order.append(r); continue
        key = (r["hoja"], r["capitulo"], r["subcapitulo"], r["seccion"],
               r["codigo"], r["partida"], r["unidad"])
        if key in agg:
            agg[key]["medicion"] = round((agg[key]["medicion"] or 0) + (r["medicion"] or 0), 4)
            agg[key]["detalle"] = ""
        else:
            r = dict(r); r["detalle"] = ""
            agg[key] = r; order.append(key)
    out = []
    for k in order:
        if isinstance(k, tuple) and k and k[0] == "__nota__":   # nota, no clave de agregación
            out.append(k)
        else:
            out.append(rec(**{c: agg[k][c] for c in CANON}))
    return out

# ---------- principal ----------
def main():
    src, cfg_path, dst = sys.argv[1], sys.argv[2], sys.argv[3]
    cfg = json.load(open(cfg_path, encoding="utf-8"))
    familia = cfg["familia"]
    cols = {**DEFAULT_COLS[familia], **cfg.get("columnas", {})}
    archivo = src.split("/")[-1]
    xls = pd.ExcelFile(src)
    hojas = cfg.get("hojas") or xls.sheet_names
    excl = set(cfg.get("hojas_excluidas", []))

    rows, notas, stats = [], [], dict(titulo=0, partida=0, parcial=0, nota=0, subtotal=0, vacia=0)
    for hoja in hojas:
        if hoja in excl: continue
        df = pd.read_excel(src, sheet_name=hoja, header=None, dtype=object)
        grid = df.values.tolist()
        if familia == "codigo":
            res = parse_codigo(grid, cols, archivo, hoja, stats)
        else:
            cap_hoja = hoja if cfg.get("capitulo_desde_hoja", True) else ""
            res = parse_formato(grid, cols, archivo, hoja, cap_hoja, stats)
        rows += res

    if cfg.get("parciales", "conservar") == "colapsar":
        rows = colapsar(rows)

    medic = [r for r in rows if not isinstance(r, tuple)]
    notas = [{"hoja": r[1], "fila_origen": r[2], "nota": r[3]} for r in rows if isinstance(r, tuple)]

    with pd.ExcelWriter(dst, engine="openpyxl") as w:
        pd.DataFrame(medic, columns=CANON).to_excel(w, sheet_name="Mediciones", index=False)
        formatear(w.sheets["Mediciones"], CANON)
        if cfg.get("volcar_notas") and notas:
            notas_cols = ["hoja", "fila_origen", "nota"]
            pd.DataFrame(notas, columns=notas_cols).to_excel(w, sheet_name="Notas", index=False)
            formatear(w.sheets["Notas"], notas_cols)

    print(f"Familia: {familia} · hojas: {[h for h in hojas if h not in excl]}")
    print(f"Clasificación: {json.dumps(stats, ensure_ascii=False)}")
    print(f"Mediciones extraídas: {len(medic)}  ·  Notas: {len(notas)}")
    print(f"Salida: {dst}")

if __name__ == "__main__":
    main()
