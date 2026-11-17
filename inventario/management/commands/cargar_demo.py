"""Carga datos de ejemplo para probar y mostrar el sistema.

    python manage.py cargar_demo            # solo si la base está vacía
    python manage.py cargar_demo --reset    # BORRA todo el inventario y carga el ejemplo

Crea 3 bodegas, 16 insumos, 4 proveedores, 5 usuarios, ~3 meses de compras,
consumos y producción de leche, y 2 inventarios. Usa las mismas reglas de stock
que la API, así los totales por bodega quedan consistentes.

Usuarios de ejemplo:
    Administrador  11.111.111-1 / admin123
    Trabajador     12.345.678-5 / trabajador123
"""
import random
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from inventario.models import (
    Bodega, Consumo, DetalleDocumento, DetalleInventario, DocumentoCompra, Inventario,
    ProduccionLeche, Producto, Proveedor, StockBodega, Usuario,
)
from inventario.servicios import mover_stock, stock_en_bodega


def con_dv(cuerpo):
    suma, mult = 0, 2
    for d in reversed(str(cuerpo)):
        suma += int(d) * mult
        mult = 2 if mult == 7 else mult + 1
    r = 11 - suma % 11
    dv = "0" if r == 11 else "K" if r == 10 else str(r)
    s = f"{cuerpo:,}".replace(",", ".")
    return f"{s}-{dv}"


BODEGAS = [
    ("Bodega Principal", "Patio central del predio"),
    ("Bodega de Alimentos", "Junto al galpón de ordeña"),
    ("Bodega Veterinaria", "Oficina de manejo animal"),
]
# código, nombre, categoría, unidad, costo, mínimo, bodega principal, stock inicial, consumo diario aprox.
PRODUCTOS = [
    ("ALI-001", "Concentrado lechero", "Alimentación", "KG", 420, 800, 1, 1200, 90),
    ("ALI-002", "Maíz molido", "Alimentación", "KG", 310, 500, 1, 900, 45),
    ("ALI-003", "Sal mineral", "Alimentación", "KG", 650, 150, 1, 300, 12),
    ("ALI-004", "Fardos de heno", "Alimentación", "UN", 5200, 40, 1, 120, 6),
    ("ORD-001", "Detergente alcalino", "Ordeña", "LTS", 2100, 40, 0, 110, 5),
    ("ORD-002", "Ácido peracético", "Ordeña", "LTS", 3900, 25, 0, 70, 3),
    ("ORD-003", "Sellador de pezones", "Ordeña", "LTS", 2800, 30, 0, 80, 4),
    ("ORD-004", "Filtros de leche", "Ordeña", "UN", 380, 200, 0, 600, 30),
    ("SAN-001", "Antibiótico mastitis", "Sanidad", "UN", 4800, 30, 2, 80, 2),
    ("SAN-002", "Antiparasitario", "Sanidad", "LTS", 15500, 6, 2, 18, 0.4),
    ("SAN-003", "Vitaminas inyectables", "Sanidad", "UN", 3200, 20, 2, 50, 1),
    ("COM-001", "Diésel", "Combustibles", "LTS", 1050, 400, 0, 1500, 70),
    ("COM-002", "Aceite hidráulico", "Combustibles", "LTS", 3600, 20, 0, 60, 1),
    ("FER-001", "Urea", "Fertilizantes", "KG", 780, 500, 0, 2500, 55),
    ("FER-002", "Superfosfato triple", "Fertilizantes", "KG", 920, 400, 0, 1800, 40),
    ("INS-001", "Alambre para cerco", "Infraestructura", "ROLLO", 38000, 3, 0, 9, 1),
]
PROVEEDORES = [
    ("Soprole Insumos S.A.", "Agrocomercial Sur", 76123456, "Av. Industrial 1240, Osorno", "Marcela Soto", 30, 8000000, "Alimentación"),
    ("Veterinaria Los Lagos Ltda.", "Vet Los Lagos", 77456123, "Manuel Rodríguez 850, Osorno", "Iván Guzmán", 15, 3000000, "Sanidad"),
    ("Copec Combustibles", "Copec Osorno", 99520000, "Ruta 5 Sur km 912, Osorno", "Paola Reyes", 30, 6000000, "Combustibles"),
    ("Fertilizantes del Sur SpA", "Fertisur", 76890123, "Ruta U-40 km 5, Río Negro", "Héctor Vidal", 45, 9000000, "Fertilizantes"),
]
TRABAJADORES = [
    (12345678, "Carlos Muñoz Soto", "Operario de ordeña", "Lechería"),
    (13456789, "Ana Vargas Díaz", "Encargada de bodega", "Bodega"),
    (14567890, "Luis Cárdenas Peña", "Tractorista", "Campo"),
    (15678901, "Marta Oyarzo Reyes", "Técnico veterinario", "Sanidad"),
]


# Insumos a los que se les deja de comprar al final, para que aparezcan avisos de stock bajo.
SIN_REPOSICION = {"SAN-002", "COM-002", "ORD-002", "ALI-003", "INS-001"}


class Command(BaseCommand):
    help = "Carga datos de ejemplo (3 meses de movimiento)."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Borra todo el inventario antes de cargar.")

    @transaction.atomic
    def handle(self, *args, **opts):
        if opts["reset"]:
            for m in (DetalleInventario, Inventario, Consumo, DetalleDocumento, DocumentoCompra, StockBodega,
                      ProduccionLeche, Producto, Bodega, Proveedor, Usuario):
                m.objects.all().delete()
        elif Producto.objects.exists() or Usuario.objects.exists():
            raise CommandError("Ya hay datos. Usa --reset si quieres borrarlos y cargar el ejemplo.")

        rnd = random.Random(7)
        hoy = timezone.localdate()
        tz = timezone.get_current_timezone()

        admin = Usuario.objects.create(
            rut=con_dv(11111111), nombre_completo="Andrés Osorio", puesto="Administrador", departamento="Administración",
            telefono="+56 9 1111 1111", email="admin@moncopulli.cl", contrasena=make_password("admin123"), rol="ADMIN", estado="Activo")
        trabajadores = []
        for i, (cuerpo, nombre, puesto, depto) in enumerate(TRABAJADORES):
            trabajadores.append(Usuario.objects.create(
                rut=con_dv(cuerpo), nombre_completo=nombre, puesto=puesto, departamento=depto, telefono=f"+56 9 {2000 + i} 0000",
                email=f"{nombre.split()[0].lower()}@moncopulli.cl", contrasena=make_password("trabajador123"), rol="TRABAJADOR", estado="Activo"))

        bodegas = [Bodega.objects.create(nombre=n, ubicacion=u, estado=True) for n, u in BODEGAS]
        proveedores = [
            Proveedor.objects.create(razon_social=rs, nombre=n, rut=con_dv(r), domicilio_legal=dom, telefono="+56 64 223 0000",
                                     correo=f"ventas@{n.split()[0].lower()}.cl", contacto=c, plazo_pago=p, limite_credito=l, categoria=cat, estado=True)
            for rs, n, r, dom, c, p, l, cat in PROVEEDORES
        ]
        cat_prov = {"Alimentación": 0, "Ordeña": 0, "Sanidad": 1, "Combustibles": 2, "Fertilizantes": 3, "Infraestructura": 0}

        productos = []
        for cod, nombre, cat, uni, costo, minimo, b, inicial, uso in PRODUCTOS:
            p = Producto.objects.create(codigo=cod, nombre=nombre, categoria=cat, unidad_medida=uni, costo_promedio=costo,
                                        stock_actual=0, stock_minimo=minimo)
            mover_stock(p.id, bodegas[b].id, Decimal(int(inicial * 0.6)) if uni in ("UN", "ROLLO") else Decimal(inicial) * Decimal("0.6"))
            productos.append((p, b, uso, minimo))

        ahora = timezone.localtime()

        def en(dia, hora=None):
            if dia == hoy:  # hoy: siempre a una hora que ya pasó
                minutos = max(ahora.hour * 60 + ahora.minute, 2)
                return datetime.combine(dia, time(0, 0), tzinfo=tz) + timedelta(minutes=rnd.randrange(1, minutos))
            h = hora if hora is not None else rnd.choice([7, 8, 9, 11, 14, 16])
            return datetime.combine(dia, time(h, rnd.randrange(0, 60)), tzinfo=tz)

        folio = 1000
        dias = 100
        for k in range(dias, -1, -1):
            dia = hoy - timedelta(days=k)
            # Producción de leche diaria.
            ProduccionLeche.objects.create(fecha=dia, litros=Decimal(rnd.randint(1900, 2600)), usuario=trabajadores[0],
                                           observacion=None)
            # Compras: cada producto se repone cuando está por bajo de su mínimo * 1.4.
            if k % 3 == 0:
                for ip, (p, b, uso, minimo) in enumerate(productos):
                    p.refresh_from_db()
                    if p.codigo in SIN_REPOSICION and k < 18:
                        continue
                    if p.stock_actual < Decimal(minimo) * Decimal("1.5") and rnd.random() < 0.8:
                        prov = proveedores[cat_prov[p.categoria]]
                        cantidad = Decimal(max(int(minimo * rnd.uniform(1.6, 2.6)), 1))
                        destino = b if (p.categoria == "Sanidad" or rnd.random() < 0.65) else (b + 1) % 2
                        folio += 1
                        doc = DocumentoCompra.objects.create(
                            numero_folio=str(folio), tipo_documento=rnd.choice(["Factura", "Factura", "Guía de despacho"]), fecha_emision=dia,
                            proveedor=prov, bodega=bodegas[destino], usuario=admin)
                        precio = int(float(p.costo_promedio) * rnd.uniform(0.96, 1.06))
                        mover_stock(p.id, bodegas[destino].id, cantidad, precio_unitario=precio)
                        DetalleDocumento.objects.create(documento=doc, producto=p, cantidad=cantidad, precio_unitario=precio)
                        if prov.ultima_compra is None or prov.ultima_compra < dia:
                            prov.ultima_compra = dia
                            prov.save(update_fields=["ultima_compra"])
            # Consumos del día (los fines de semana, menos).
            factor = 0.6 if dia.weekday() >= 5 else 1
            for p, b, uso, minimo in productos:
                if rnd.random() > 0.55 * factor + 0.1:
                    continue
                entera = p.unidad_medida in ("UN", "ROLLO") or uso >= 5
                cantidad = Decimal(str(round(uso * rnd.uniform(0.5, 1.5) * factor, 0 if entera else 1)))
                if p.unidad_medida in ("UN", "ROLLO"):
                    cantidad = max(cantidad, Decimal(1))
                if cantidad <= 0:
                    continue
                disponibles = sorted(bodegas, key=lambda x: stock_en_bodega(p.id, x.id), reverse=True)
                bodega = disponibles[0]
                if stock_en_bodega(p.id, bodega.id) < cantidad:
                    continue
                mover_stock(p.id, bodega.id, -cantidad)
                responsable = trabajadores[rnd.choices(range(len(trabajadores)), weights=[5, 3, 3, 2])[0]]
                Consumo.objects.create(fecha=en(dia), cantidad_retirada=cantidad, estado="CONFIRMADO", usuario=responsable,
                                       producto=p, bodega=bodega)

        # Los últimos días: un insumo se acaba y otro queda bajo el mínimo (para mostrar los avisos).
        for codigo, dejar in (("INS-001", Decimal("0")), ("SAN-002", Decimal("4.2")), ("COM-002", Decimal("14"))):
            p = Producto.objects.get(codigo=codigo)
            for b in bodegas:
                actual = stock_en_bodega(p.id, b.id)
                if actual > 0 and p.stock_actual > dejar:
                    sacar = min(actual, p.stock_actual - dejar)
                    mover_stock(p.id, b.id, -sacar)
                    Consumo.objects.create(fecha=en(hoy - timedelta(days=rnd.randint(0, 2))), cantidad_retirada=sacar, estado="CONFIRMADO",
                                           usuario=rnd.choice(trabajadores), producto=p, bodega=b)
                    p.refresh_from_db()

        # Un consumo anulado, para ver cómo se muestra.
        c = Consumo.objects.filter(estado="CONFIRMADO").order_by("-fecha")[3]
        mover_stock(c.producto_id, c.bodega_id, c.cantidad_retirada)
        c.estado, c.motivo_anulacion, c.usuario_anula, c.fecha_anulacion = "ANULADO", "Cantidad mal digitada", admin, c.fecha + timedelta(hours=1)
        c.save()

        # Dos inventarios (conteos físicos) con pequeñas diferencias.
        for hace, bi in ((45, 0), (12, 1)):
            dia = hoy - timedelta(days=hace)
            inv = Inventario.objects.create(fecha=dia, estado="CONFIRMADO", usuario=admin, bodega=bodegas[bi])
            for p, b, uso, minimo in productos:
                sistema = stock_en_bodega(p.id, bodegas[bi].id)
                if sistema <= 0:
                    continue
                real = max(sistema + (sistema * Decimal(str(round(rnd.uniform(-0.04, 0.02), 3)))).quantize(Decimal("0.01")), Decimal(0))
                DetalleInventario.objects.create(inventario=inv, producto=p, stock_sistema=sistema, stock_real=real, desviacion=real - sistema)

        self.stdout.write(self.style.SUCCESS(
            f"Listo: {Producto.objects.count()} insumos, {Consumo.objects.count()} consumos, "
            f"{DocumentoCompra.objects.count()} compras. Admin: 11.111.111-1 / admin123 · Trabajador: {con_dv(12345678)} / trabajador123"))
