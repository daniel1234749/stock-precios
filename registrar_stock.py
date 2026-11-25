# -*- coding: utf-8 -*-
"""
registrar_stock.py — Historial de stock: guarda una foto del stock de cada día.

Cómo se usa (TODOS LOS DÍAS, después de actualizar precios.json y antes de subir a GitHub):
    python registrar_stock.py

Qué hace:
    1. Lee precios.json (el stock del día de Fair, Burzaco, A. Korn, Tucumán y el centro de distribución).
    2. Guarda la foto del día en  historico_stock/AAAA-MM-DD.csv.gz   (queda solo en esta PC, no se sube).
       Si lo corrés dos veces el mismo día, la foto de ese día se reemplaza (no se duplica).
    3. Arma  stock_mensual.json  con el resumen de cada mes, por producto y por lugar:
         - cuántos días estuvo SIN STOCK (0 o negativo)
         - el stock promedio del mes
       Ese archivo SÍ se sube a GitHub: es el que lee el Comparador de Compras.
       Los meses viejos que ya están en stock_mensual.json se conservan aunque falten las fotos.
       Formato: meses["2026-11"] = {"dias": días registrados, "p": {codigo: {lugar: [días sin stock, stock promedio]}}}
       (si un lugar no figura para un producto, ese mes estuvo sin stock todos los días registrados)
"""
import csv
import gzip
import io
import json
import os
import sys
from datetime import date, datetime

CARPETA = os.path.dirname(os.path.abspath(__file__))
FOTOS = os.path.join(CARPETA, "historico_stock")
PRECIOS = os.path.join(CARPETA, "precios.json")
RESUMEN = os.path.join(CARPETA, "stock_mensual.json")

# lugar -> campo de precios.json
LUGARES = [("fair", "fair_stock"), ("burzaco", "burzaco_stock"), ("korn", "a_korn_stock"),
           ("tucuman", "tucuman_stock"), ("cd", "cdistrib")]


def numero(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def guardar_foto(hoy):
    with open(PRECIOS, encoding="utf-8") as f:
        productos = json.load(f)
    texto = io.StringIO()
    w = csv.writer(texto, delimiter=";", lineterminator="\n")
    w.writerow(["codigo"] + [l for l, _ in LUGARES])
    filas = 0
    for p in productos:
        if p.get("codigos") is None:
            continue
        valores = [round(numero(p.get(campo)), 3) for _, campo in LUGARES]
        if not any(valores):
            continue                      # sin stock en ningún lado: no hace falta guardarlo (se entiende 0)
        w.writerow([p["codigos"]] + [("%g" % v) for v in valores])
        filas += 1
    os.makedirs(FOTOS, exist_ok=True)
    ruta = os.path.join(FOTOS, f"{hoy.isoformat()}.csv.gz")
    temporal = ruta + ".tmp"
    with gzip.open(temporal, "wt", encoding="utf-8") as g:
        g.write(texto.getvalue())
    os.replace(temporal, ruta)
    return filas, len(productos)


def leer_foto(ruta):
    stock = {}
    with gzip.open(ruta, "rt", encoding="utf-8") as g:
        r = csv.reader(g, delimiter=";")
        next(r, None)
        for fila in r:
            stock[fila[0]] = [float(x) for x in fila[1:]]
    return stock


def resumir():
    resumen = {"meses": {}}
    if os.path.exists(RESUMEN):
        with open(RESUMEN, encoding="utf-8") as f:
            resumen = json.load(f)
    fotos = sorted(f for f in os.listdir(FOTOS) if f.endswith(".csv.gz"))
    por_mes = {}
    for f in fotos:
        por_mes.setdefault(f[:7], []).append(f)       # "2026-11"
    for mes, archivos in por_mes.items():
        dias = len(archivos)
        fotos_mes = [leer_foto(os.path.join(FOTOS, a)) for a in archivos]
        codigos = set().union(*fotos_mes)
        ceros = [0.0] * len(LUGARES)
        productos = {}
        for cod in codigos:
            datos = {}
            for i, (lugar, _) in enumerate(LUGARES):
                valores = [f.get(cod, ceros)[i] for f in fotos_mes]   # si un día no figuraba, tenía 0
                if not any(valores):
                    continue                                            # sin stock todo el mes en este lugar: se omite
                datos[lugar] = [sum(1 for v in valores if v <= 0), round(sum(valores) / dias, 2)]
            productos[cod] = datos
        resumen["meses"][mes] = {"dias": dias, "desde": archivos[0][:10], "hasta": archivos[-1][:10], "p": productos}
    resumen["generado"] = datetime.now().isoformat(timespec="minutes")
    resumen["lugares"] = [l for l, _ in LUGARES]
    temporal = RESUMEN + ".tmp"
    with open(temporal, "w", encoding="utf-8") as f:
        json.dump(resumen, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(temporal, RESUMEN)
    return resumen


def main():
    if not os.path.exists(PRECIOS):
        sys.exit("No encontré precios.json en esta carpeta.")
    hoy = date.today()
    filas, total = guardar_foto(hoy)
    print(f"Foto del stock del {hoy.strftime('%d/%m/%Y')}: {filas} productos con stock (de {total}).")
    resumen = resumir()
    m = resumen["meses"][hoy.strftime("%Y-%m")]
    print(f"Resumen de {hoy.strftime('%m/%Y')}: {m['dias']} días registrados ({m['desde']} a {m['hasta']}).")
    print("Listo. Ahora subilo a GitHub como siempre (stock_mensual.json va incluido).")


if __name__ == "__main__":
    main()