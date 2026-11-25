# -*- coding: utf-8 -*-
"""
acumular_ventas.py — Guarda TODO el historial de ventas mensuales (no solo los últimos 2 años).

Cómo se usa (una vez por mes, DESPUÉS de generar los stats_*.json nuevos):
    1. Generás los stats_fair.json, stats_burzaco.json, stats_korn.json y stats_tucuman.json como siempre.
    2. En la carpeta stock-precios corrés:   python acumular_ventas.py
    3. Subís a GitHub como siempre (git add . / git commit / git push).

Qué hace:
    - Guarda una copia acumulada de cada sucursal en la carpeta  historico_ventas/
      (ahí nunca se borra ningún mes).
    - Junta lo nuevo con lo acumulado: los meses que vienen en el archivo nuevo se toman del nuevo
      (por si se corrigió algo), y los meses viejos que ya no vienen se conservan.
    - Deja los stats_*.json con TODOS los meses, así la app los muestra.
    - Antes de tocar nada guarda un respaldo en historico_ventas/respaldos/.
    - Se puede correr dos veces seguidas sin problema: el resultado es el mismo.
"""
import json
import os
import re
import shutil
import sys
from datetime import datetime

CARPETA = os.path.dirname(os.path.abspath(__file__))
HISTORICO = os.path.join(CARPETA, "historico_ventas")
RESPALDOS = os.path.join(HISTORICO, "respaldos")
SUCURSALES = ["fair", "burzaco", "korn", "tucuman"]

MESES = {"ene": 1, "feb": 2, "mar": 3, "abr": 4, "may": 5, "jun": 6,
         "jul": 7, "ago": 8, "sep": 9, "oct": 10, "nov": 11, "dic": 12}
RE_MES = re.compile(r"^([a-z]{3})_(\d{2})$")


def es_mes(clave):
    m = RE_MES.match(clave)
    return bool(m and m.group(1) in MESES)


def orden_mes(clave):
    m = RE_MES.match(clave)
    return int(m.group(2)) * 100 + MESES[m.group(1)]


def leer(ruta):
    with open(ruta, encoding="utf-8") as f:
        return json.load(f)


def escribir(ruta, datos):
    temporal = ruta + ".tmp"
    with open(temporal, "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, indent=2)
    os.replace(temporal, ruta)          # se reemplaza de golpe: si algo falla, el archivo viejo queda entero


def acumular(sucursal):
    ruta_nuevo = os.path.join(CARPETA, f"stats_{sucursal}.json")
    ruta_acum = os.path.join(HISTORICO, f"stats_{sucursal}_acumulado.json")
    if not os.path.exists(ruta_nuevo):
        print(f"  {sucursal}: no encontré {os.path.basename(ruta_nuevo)}, lo salteo")
        return

    nuevo = leer(ruta_nuevo)
    acumulado = leer(ruta_acum) if os.path.exists(ruta_acum) else []

    meses_nuevo = sorted({k for p in nuevo for k in p if es_mes(k)}, key=orden_mes)
    meses_acum = sorted({k for p in acumulado for k in p if es_mes(k)}, key=orden_mes)
    if not meses_nuevo:
        sys.exit(f"  {sucursal}: el archivo nuevo no tiene meses (ene_25, feb_25…). No toco nada.")
    todos = sorted(set(meses_nuevo) | set(meses_acum), key=orden_mes)

    por_codigo = {str(p.get("codigos")): p for p in acumulado}
    resultado = []
    vistos = set()
    for p in nuevo:                                     # productos del archivo nuevo (datos al día)
        cod = str(p.get("codigos"))
        vistos.add(cod)
        viejo = por_codigo.get(cod, {})
        fila = {k: v for k, v in p.items() if not es_mes(k) and k != "total_vta"}
        for mes in todos:
            fila[mes] = p[mes] if mes in p else viejo.get(mes, 0)
        fila["total_vta"] = round(sum(fila[m] or 0 for m in todos), 2)
        resultado.append(fila)
    for cod, viejo in por_codigo.items():               # productos que ya no vienen: se conservan sus ventas
        if cod in vistos:
            continue
        fila = {k: v for k, v in viejo.items() if not es_mes(k) and k != "total_vta"}
        for mes in todos:
            fila[mes] = viejo.get(mes, 0)
        fila["total_vta"] = round(sum(fila[m] or 0 for m in todos), 2)
        resultado.append(fila)

    # respaldo antes de escribir
    sello = datetime.now().strftime("%Y%m%d_%H%M")
    shutil.copy2(ruta_nuevo, os.path.join(RESPALDOS, f"stats_{sucursal}_{sello}.json"))

    escribir(ruta_acum, resultado)
    escribir(ruta_nuevo, resultado)
    agregados = [m for m in todos if m not in meses_acum]
    print(f"  {sucursal}: {len(resultado)} productos · meses {todos[0]} a {todos[-1]} ({len(todos)})"
          + (f" · nuevos: {', '.join(agregados)}" if agregados and meses_acum else ""))


def main():
    os.makedirs(RESPALDOS, exist_ok=True)
    print("Acumulando ventas…")
    for s in SUCURSALES:
        acumular(s)
    # se dejan solo los últimos 3 respaldos de cada sucursal (no se suben a GitHub)
    for s in SUCURSALES:
        viejos = sorted(f for f in os.listdir(RESPALDOS) if f.startswith(f"stats_{s}_"))
        for f in viejos[:-3]:
            os.remove(os.path.join(RESPALDOS, f))
    print("Listo. Ahora subilo a GitHub como siempre.")


if __name__ == "__main__":
    main()