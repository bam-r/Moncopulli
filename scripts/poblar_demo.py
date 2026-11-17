"""Pobla la base de datos con datos de demostración (~3 meses de movimiento).

Uso (desde la raíz del proyecto, con la base de datos corriendo):

    venv\\Scripts\\python.exe scripts\\poblar_demo.py           # solo si no hay insumos/bodegas/proveedores
    venv\\Scripts\\python.exe scripts\\poblar_demo.py --reset   # borra los datos de inventario y vuelve a cargar

Qué crea:
    * 10 trabajadores (rol TRABAJADOR)  -> contraseña: trabajador123
    * 5 proveedores, 2 bodegas, 36 insumos (agroquímicos, concentrados, fertilizantes, forraje)
    * Documentos de compra con su detalle y consumos diarios con fechas de los últimos ~3 meses
    * Algunos consumos anulados y algunos insumos que terminan con stock bajo o sin stock

No modifica el código del sistema: usa los modelos y la misma regla de stock que la API
(inventario.servicios.mover_stock), así el stock por bodega y el total quedan consistentes.
Los usuarios que ya existían (por ejemplo el administrador) no se tocan.
"""
import os
import random
import sys
from datetime import datetime, time, timedelta
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from django.contrib.auth.hashers import make_password  # noqa: E402
from django.db import transaction  # noqa: E402
from django.utils import timezone  # noqa: E402

from inventario.models import (  # noqa: E402
    Bodega, Consumo, DetalleDocumento, DetalleInventario, DocumentoCompra, Inventario,
    Producto, Proveedor, StockBodega, Usuario,
)
from inventario.servicios import es_admin, esta_activo, mover_stock, stock_en_bodega  # noqa: E402


def rut(cuerpo):
    """12345678 -> '12.345.678-5' (con dígito verificador válido)."""
    suma, mult = 0, 2
    for d in reversed(str(cuerpo)):
        suma += int(d) * mult
        mult = 2 if mult == 7 else mult + 1
    r = 11 - suma % 11
    dv = "0" if r == 11 else "K" if r == 10 else str(r)
    return f"{cuerpo:,}".replace(",", ".") + f"-{dv}"


# ───────────────────────── Datos base ─────────────────────────

BODEGAS = [
    ("Bodega de Insumos Agrícolas", "Galpón norte, junto al taller de maquinaria"),
    ("Bodega de Alimentos y Forraje", "Sector lechería, al costado de la sala de ordeña"),
]

# rut, nombre, puesto, departamento, área de trabajo (define qué insumos suele retirar)
TRABAJADORES = [
    (16234567, "Pedro Antonio Soto Barría", "Lechero", "Lechería", "lecheria"),
    (17345678, "José Luis Navarro Igor", "Ordeñador", "Lechería", "lecheria"),
    (18456789, "Camila Andrea Ruiz Mansilla", "Encargada de terneros", "Crianza", "terneros"),
    (15987654, "Juan Carlos Pérez Oyarzún", "Tractorista", "Campo", "campo"),
    (19123456, "Miguel Ángel Silva Vera", "Operario agrícola", "Campo", "campo"),
    (17890123, "Francisco Javier Uribe Hott", "Aplicador de agroquímicos", "Campo", "campo"),
    (16543210, "Daniela Paz Gallardo Schwerter", "Encargada de bodega", "Bodega", "todos"),
    (14876543, "Luis Alberto Gómez Paredes", "Alimentador", "Lechería", "lecheria"),
    (18234567, "Cristián Eduardo Alarcón Leal", "Mecánico agrícola", "Taller", "campo"),
    (20123456, "Rosa María Cárcamo Delgado", "Auxiliar de crianza", "Crianza", "terneros"),
]

# razón social, nombre, rut, domicilio, teléfono, contacto, plazo pago, límite crédito, categoría
PROVEEDORES = [
    ("Agroquímicos del Sur SpA", "Agrosur", 76482915, "Av. Real 1450, Osorno", "+56 64 223 4510",
     "Rodrigo Henríquez", 60, 25000000, "Agroquímicos"),
    ("Comercial Agrovet Los Lagos Ltda.", "Agrovet Los Lagos", 77315648, "Ruta 215 km 3, Osorno", "+56 64 224 8830",
     "Patricia Vidal", 45, 18000000, "Agroquímicos"),
    ("Nutrición Animal del Sur S.A.", "Nutrisur", 96718240, "Camino a Puerto Octay km 6, Osorno", "+56 64 226 1190",
     "Marcelo Ojeda", 30, 30000000, "Concentrados"),
    ("Fertilizantes Australes SpA", "Fertiaustral", 76925371, "Parque Industrial Lote 12, Río Negro", "+56 64 237 5520",
     "Verónica Schmidt", 60, 35000000, "Fertilizantes"),
    ("Forrajes y Ensilajes Río Bueno Ltda.", "Forrajes Río Bueno", 77604182, "Fundo El Roble s/n, Río Bueno", "+56 64 234 9070",
     "Héctor Barrientos", 30, 20000000, "Forraje"),
]

# código, nombre, categoría, unidad, costo, stock mínimo, retiro mín, retiro máx, prob. diaria de retiro, proveedor
# (bodega: agroquímicos y fertilizantes -> 0; concentrados y forraje -> 1)
PRODUCTOS = [
    # Agroquímicos (herbicidas, insecticidas y coadyuvantes; se usan más en primavera)
    ("AGR-001", "Cayenne", "Agroquímicos", "LTS", 18500, 10, 2, 6, 0.15, 0),
    ("AGR-002", "Engeo 247", "Agroquímicos", "LTS", 52000, 5, 0.5, 2, 0.10, 0),
    ("AGR-003", "Frontier", "Agroquímicos", "LTS", 38000, 8, 2, 5, 0.10, 0),
    ("AGR-004", "Galant Plus R", "Agroquímicos", "LTS", 45000, 6, 1, 4, 0.10, 1),
    ("AGR-005", "Induce pH 5", "Agroquímicos", "LTS", 9800, 10, 0.5, 2, 0.25, 1),
    ("AGR-006", "MCPA", "Agroquímicos", "LTS", 8900, 20, 4, 10, 0.15, 0),
    ("AGR-007", "Ninja", "Agroquímicos", "LTS", 24000, 5, 0.5, 2, 0.10, 1),
    ("AGR-008", "Option Pro", "Agroquímicos", "LTS", 42000, 5, 1, 3, 0.08, 0),
    ("AGR-009", "Proponit 720 EC", "Agroquímicos", "LTS", 21000, 10, 3, 8, 0.08, 0),
    ("AGR-010", "Refine", "Agroquímicos", "KG", 180000, 0.5, 0.05, 0.2, 0.08, 1),
    ("AGR-011", "Soberan 420 SC", "Agroquímicos", "LTS", 68000, 3, 0.3, 1, 0.08, 0),
    ("AGR-012", "Tripp", "Agroquímicos", "LTS", 12000, 5, 0.5, 2, 0.12, 1),
    ("AGR-013", "Twin", "Agroquímicos", "LTS", 15000, 5, 1, 3, 0.10, 1),
    ("AGR-014", "Venceweed Extra", "Agroquímicos", "LTS", 14500, 15, 3, 8, 0.15, 0),
    ("AGR-015", "Aliado", "Agroquímicos", "LTS", 11000, 5, 0.5, 2, 0.12, 1),
    ("AGR-016", "Keep 10", "Agroquímicos", "LTS", 16000, 5, 1, 3, 0.08, 1),
    ("AGR-017", "Caiman", "Agroquímicos", "LTS", 7800, 40, 8, 20, 0.18, 0),
    ("AGR-018", "Preside 80 WG", "Agroquímicos", "KG", 160000, 0.5, 0.05, 0.25, 0.06, 1),
    # Concentrados (alimentación diaria del ganado y terneros)
    ("CON-001", "Power Growth", "Concentrados", "KG", 620, 1500, 150, 350, 0.80, 2),
    ("CON-002", "Prepower", "Concentrados", "KG", 590, 1000, 100, 250, 0.70, 2),
    ("CON-003", "Starter Plus", "Concentrados", "KG", 740, 300, 20, 60, 0.80, 2),
    ("CON-004", "Concentrado Moncopulli", "Concentrados", "KG", 480, 3000, 400, 800, 0.90, 2),
    ("CON-005", "Starter Plus Medicado", "Concentrados", "KG", 860, 150, 10, 30, 0.50, 2),
    # Fertilizantes (aplicaciones de primavera en praderas y maíz)
    ("FER-001", "Expertia Micro Force", "Fertilizantes", "KG", 1350, 200, 25, 100, 0.10, 3),
    ("FER-002", "Smartblend", "Fertilizantes", "KG", 890, 1000, 250, 750, 0.10, 3),
    ("FER-003", "Soluan 32", "Fertilizantes", "LTS", 650, 1000, 200, 600, 0.12, 3),
    ("FER-004", "Superfosfato Triple", "Fertilizantes", "KG", 920, 1000, 250, 750, 0.10, 3),
    ("FER-005", "Urea", "Fertilizantes", "KG", 780, 1500, 250, 1000, 0.15, 3),
    ("FER-006", "Microforce", "Fertilizantes", "KG", 1250, 200, 25, 100, 0.08, 3),
    ("FER-007", "MZ 8-25-19", "Fertilizantes", "KG", 950, 1000, 250, 750, 0.10, 3),
    ("FER-008", "Basfoliar", "Fertilizantes", "LTS", 9500, 20, 2, 8, 0.10, 3),
    # Forraje (alimentación diaria)
    ("FOR-001", "Bolos Paja", "Forraje", "BOLOS", 14000, 30, 2, 6, 0.70, 4),
    ("FOR-002", "Bolos Silo", "Forraje", "BOLOS", 32000, 40, 3, 8, 0.80, 4),
    ("FOR-003", "Silo Parva Ballica", "Forraje", "KG", 95, 20000, 3000, 6000, 0.85, 4),
    ("FOR-004", "Fardo Heno", "Forraje", "UN", 5500, 50, 5, 15, 0.60, 4),
    ("FOR-005", "Silo Parva Maíz", "Forraje", "KG", 110, 20000, 3000, 6000, 0.60, 4),
]

ENTERAS = {"UN", "BOLOS"}  # unidades que no admiten decimales

# Insumos que se dejan de comprar en las últimas semanas, para que la demo muestre alertas de stock.
SIN_REPOSICION = {"FOR-004", "AGR-005", "CON-005", "FER-008", "AGR-017"}
AGOTAR = {"FOR-004"}  # este se consume hasta quedar en 0 (estado "Sin stock")

AREAS = {
    "Agroquímicos": ["campo", "todos"],
    "Fertilizantes": ["campo", "todos"],
    "Concentrados": ["lecheria", "todos"],
    "Forraje": ["lecheria", "todos"],
}
MOTIVOS_ANULACION = [
    "Cantidad mal digitada",
    "Se registró en la bodega equivocada",
    "Retiro registrado dos veces",
    "El insumo fue devuelto a bodega sin usar",
    "Se eligió un insumo equivocado",
]

DIAS = 92  # cubre el período "Últimos 3 meses" de los reportes


def redondear(valor, unidad, retiro_max):
    """Redondeo con sentido según la unidad y el tamaño del retiro."""
    if unidad in ENTERAS:
        q = Decimal(1)
    elif retiro_max >= 1000:
        q = Decimal(50)
    elif retiro_max >= 100:
        q = Decimal(5)
    elif retiro_max >= 10:
        q = Decimal(1)
    elif retiro_max >= 1:
        q = Decimal("0.5")
    else:
        q = Decimal("0.05")
    v = (Decimal(str(valor)) / q).quantize(Decimal(1), rounding=ROUND_HALF_UP) * q
    return max(v, q).quantize(Decimal("0.01"))


def factor_temporada(categoria, dia):
    """Agroquímicos y fertilizantes se usan sobre todo en primavera (sep-nov en el sur de Chile)."""
    if categoria not in ("Agroquímicos", "Fertilizantes"):
        return 1.0
    return 1.9 * {8: 0.35, 9: 0.8, 10: 1.25, 11: 1.4}.get(dia.month, 0.6)


def factor_fin_de_semana(categoria, dia):
    if categoria in ("Concentrados", "Forraje"):  # los animales comen todos los días
        return 0.9 if dia.weekday() >= 5 else 1.0
    return {5: 0.35, 6: 0.0}.get(dia.weekday(), 1.0)


def borrar_datos():
    for m in (DetalleInventario, Inventario, Consumo, DetalleDocumento, DocumentoCompra, StockBodega, Producto, Bodega, Proveedor):
        m.objects.all().delete()
    Usuario.objects.filter(rut__in=[rut(t[0]) for t in TRABAJADORES]).delete()


@transaction.atomic
def poblar(reset=False):
    if reset:
        borrar_datos()
    elif Producto.objects.exists() or Bodega.objects.exists() or Proveedor.objects.exists():
        sys.exit("Ya hay insumos, bodegas o proveedores. Usa --reset para borrarlos y volver a cargar la demo.")

    admin = next((u for u in Usuario.objects.order_by("id") if es_admin(u) and esta_activo(u)), None)
    if admin is None:
        sys.exit("No hay un usuario administrador activo para registrar las compras. Crea uno antes de poblar.")

    rnd = random.Random(2026)
    tz = timezone.get_current_timezone()
    ahora = timezone.localtime()
    hoy = ahora.date()

    # ── Usuarios, bodegas, proveedores, productos ──
    clave = make_password("trabajador123")
    trabajadores = []
    for i, (cuerpo, nombre, puesto, depto, area) in enumerate(TRABAJADORES):
        partes = nombre.split()
        apellido = partes[2] if len(partes) >= 4 else partes[-1]
        email = f"{partes[0]}.{apellido}@moncopulli.cl".lower()
        email = email.translate(str.maketrans("áéíóúñü", "aeiounu"))
        u = Usuario.objects.create(
            rut=rut(cuerpo), nombre_completo=nombre, puesto=puesto, departamento=depto,
            telefono=f"+56 9 {rnd.randint(5000, 9999)} {rnd.randint(1000, 9999)}", email=email,
            contrasena=clave, rol="TRABAJADOR", estado="Activo",
        )
        trabajadores.append((u, area))

    bodegas = [Bodega.objects.create(nombre=n, ubicacion=ub, estado=True) for n, ub in BODEGAS]

    proveedores = []
    for rs, nombre, r, dom, tel, contacto, plazo, limite, cat in PROVEEDORES:
        dominio = nombre.lower().replace(" ", "").translate(str.maketrans("áéíóúñ", "aeioun"))
        proveedores.append(Proveedor.objects.create(
            razon_social=rs, nombre=nombre, rut=rut(r), domicilio_legal=dom, telefono=tel,
            correo=f"ventas@{dominio}.cl", contacto=contacto, plazo_pago=plazo, limite_credito=limite,
            categoria=cat, estado=True,
        ))

    productos = []
    for cod, nombre, cat, uni, costo, minimo, rmin, rmax, prob, prov in PRODUCTOS:
        p = Producto.objects.create(
            codigo=cod, nombre=nombre, categoria=cat, unidad_medida=uni,
            costo_promedio=Decimal(costo), stock_actual=0, stock_minimo=Decimal(str(minimo)),
        )
        bodega = bodegas[0] if cat in ("Agroquímicos", "Fertilizantes") else bodegas[1]
        productos.append({
            "p": p, "uni": uni, "costo": costo, "min": Decimal(str(minimo)), "rmin": rmin, "rmax": rmax,
            "prob": prob, "prov": proveedores[prov], "bodega": bodega,
        })

    # ── Helpers ──
    folios = {pv.id: rnd.randint(1200, 8800) for pv in proveedores}
    compras = {d["p"].id: [] for d in productos}  # (cantidad, precio) para el costo promedio

    def momento(dia):
        if dia == hoy:  # hoy: siempre una hora que ya pasó
            tope = max(ahora.hour * 60 + ahora.minute - 5, 7 * 60 + 1)
            minutos = rnd.randint(7 * 60, tope) if tope > 7 * 60 else rnd.randint(0, max(tope, 1))
            return datetime.combine(dia, time(0, 0), tzinfo=tz) + timedelta(minutes=minutos)
        return datetime.combine(dia, time(rnd.randint(7, 18), rnd.randint(0, 59)), tzinfo=tz)

    def comprar(proveedor, dia, items, apertura=False, fraccion=1.0):
        folios[proveedor.id] += rnd.randint(1, 40)
        tipo = "Factura" if apertura or rnd.random() < 0.8 else "Guía de despacho"
        es_credito = tipo == "Factura" and rnd.random() < 0.75
        doc = DocumentoCompra.objects.create(
            numero_folio=str(folios[proveedor.id]),
            tipo_documento=tipo,
            fecha_emision=dia,
            condicion_pago="CREDITO" if es_credito else "CONTADO",
            dias_credito=proveedor.plazo_pago if es_credito else None,
            proveedor=proveedor,
            bodega=items[0]["bodega"],
            usuario=admin,
        )
        avance = max(0.0, min(1.0, (dia - (hoy - timedelta(days=DIAS))).days / DIAS))
        alza_cat = {
            "Agroquímicos": 0.19,
            "Fertilizantes": 0.12,
            "Concentrados": 0.08,
            "Forraje": 0.06,
        }
        for d in items:
            mult = rnd.uniform(1.8, 2.8 if apertura else 2.2) * fraccion
            cantidad = redondear(float(d["min"]) * mult, d["uni"], max(d["rmax"] * 2, float(d["min"])))
            tendencia = 1.0 + alza_cat.get(d["p"].categoria, 0.10) * avance + rnd.uniform(-0.012, 0.015)
            precio = max(1, int(round(d["costo"] * tendencia)))
            mover_stock(d["p"].id, doc.bodega_id, cantidad, precio_unitario=precio)
            DetalleDocumento.objects.create(documento=doc, producto=d["p"], cantidad=cantidad, precio_unitario=precio)
            compras[d["p"].id].append((cantidad, precio))
        if proveedor.ultima_compra is None or proveedor.ultima_compra < dia:
            proveedor.ultima_compra = dia
            proveedor.save(update_fields=["ultima_compra"])

    def responsable(categoria, codigo):
        areas = AREAS[categoria]
        if codigo in ("CON-003", "CON-005"):  # starters: crianza de terneros
            areas = ["terneros", "todos"]
        candidatos = [u for u, a in trabajadores if a in areas]
        pesos = [1 if a == "todos" else 4 for u, a in trabajadores if a in areas]
        return rnd.choices(candidatos, weights=pesos)[0]

    # ── Compra inicial (apertura de stock) ──
    inicio = hoy - timedelta(days=DIAS)
    for pv in proveedores:
        items = [d for d in productos if d["prov"].id == pv.id]
        comprar(pv, inicio - timedelta(days=rnd.randint(1, 3)), items, apertura=True)

    # ── Simulación día a día ──
    anulados = 0
    for k in range(DIAS, -1, -1):
        dia = hoy - timedelta(days=k)

        # Reposición: se compra lo que esté cerca del mínimo o reposición programada de temporada (no los domingos).
        if dia.weekday() != 6:
            for pv in proveedores:
                items = []
                for d in productos:
                    if d["prov"].id != pv.id:
                        continue
                    if d["p"].codigo in SIN_REPOSICION and k < 25:
                        continue
                    stock = stock_en_bodega(d["p"].id, d["bodega"].id)
                    if stock < d["min"] * Decimal("1.3") and rnd.random() < 0.75:
                        items.append(d)
                    elif len(compras[d["p"].id]) < 4 and k in (68, 44, 26) and rnd.random() < 0.85:
                        items.append(d)
                if items:
                    comprar(pv, dia, items, fraccion=0.65)

        # Consumos del día.
        for d in productos:
            cat = d["p"].categoria
            prob = d["prob"] * factor_temporada(cat, dia) * factor_fin_de_semana(cat, dia)
            veces = 2 if cat in ("Concentrados", "Forraje") and rnd.random() < 0.35 else 1  # mañana y tarde
            for _ in range(veces):
                if rnd.random() > prob:
                    continue
                cantidad = redondear(rnd.uniform(d["rmin"], d["rmax"]), d["uni"], d["rmax"])
                disponible = stock_en_bodega(d["p"].id, d["bodega"].id)
                if cantidad > disponible:
                    if d["p"].codigo in AGOTAR and disponible > 0:
                        cantidad = disponible
                    else:
                        continue
                mover_stock(d["p"].id, d["bodega"].id, -cantidad)
                fecha = momento(dia)
                c = Consumo.objects.create(
                    fecha=fecha, cantidad_retirada=cantidad, estado="CONFIRMADO",
                    usuario=responsable(cat, d["p"].codigo), producto=d["p"], bodega=d["bodega"],
                )
                # De vez en cuando un retiro se anula (y el stock vuelve a la bodega).
                anulacion = fecha + timedelta(minutes=rnd.randint(20, 180))
                if anulados < 7 and rnd.random() < 0.006 and anulacion < ahora:
                    mover_stock(d["p"].id, d["bodega"].id, cantidad)
                    c.estado = "ANULADO"
                    c.motivo_anulacion = rnd.choice(MOTIVOS_ANULACION)
                    c.usuario_anula = admin
                    c.fecha_anulacion = anulacion
                    c.save()
                    anulados += 1

    # ── Costo promedio ponderado según lo que se compró ──
    for d in productos:
        lista = compras[d["p"].id]
        total = sum(c * Decimal(p) for c, p in lista)
        cantidad = sum(c for c, _ in lista)
        if cantidad:
            Producto.objects.filter(pk=d["p"].id).update(costo_promedio=(total / cantidad).quantize(Decimal("0.01")))

    # ── Resumen ──
    print("Datos de demostración cargados:")
    print(f"  Usuarios trabajadores: {len(trabajadores)}  (contraseña: trabajador123)")
    print(f"  Proveedores: {Proveedor.objects.count()}  ·  Bodegas: {Bodega.objects.count()}  ·  Insumos: {Producto.objects.count()}")
    print(f"  Documentos de compra: {DocumentoCompra.objects.count()}  ·  Líneas de detalle: {DetalleDocumento.objects.count()}")
    print(f"  Consumos: {Consumo.objects.count()}  (anulados: {Consumo.objects.filter(estado='ANULADO').count()})")
    print(f"  Desde {inicio:%d-%m-%Y} hasta {hoy:%d-%m-%Y}")
    print("\n  Insumos bajo el mínimo:")
    for p in Producto.objects.order_by("codigo"):
        if p.stock_actual < p.stock_minimo:
            print(f"    {p.codigo} {p.nombre:<24} {p.stock_actual:>10} / mín {p.stock_minimo} {p.unidad_medida}")
    print("\n  Trabajadores:")
    for u, _ in trabajadores:
        print(f"    {u.rut:<13} {u.nombre_completo} ({u.puesto})")


if __name__ == "__main__":
    poblar(reset="--reset" in sys.argv)
