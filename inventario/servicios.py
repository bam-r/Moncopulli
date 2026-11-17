"""Reglas de negocio del stock.

Todo lo que sube o baja el stock pasa por aquí, así el frontend no tiene que
(ni puede) tocar Producto.stock_actual a mano:

* Compra  -> sube el stock de la bodega del documento.
* Consumo -> baja el stock de la bodega elegida (si alcanza).
* Anular un consumo -> devuelve el stock a esa bodega.

Producto.stock_actual es siempre la suma de StockBodega de ese producto.
"""
from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.db.models import Sum
from rest_framework.exceptions import ValidationError

from .models import Producto, StockBodega

CERO = Decimal("0")


def esta_activo(usuario):
    return str(usuario.estado).strip().lower().startswith("activ")


def es_admin(usuario):
    return str(usuario.rol).strip().upper() == "ADMIN"


def stock_en_bodega(producto_id, bodega_id):
    fila = StockBodega.objects.filter(producto_id=producto_id, bodega_id=bodega_id).first()
    return fila.cantidad if fila else CERO


def recalcular_total(producto_id):
    total = StockBodega.objects.filter(producto_id=producto_id).aggregate(t=Sum("cantidad"))["t"] or CERO
    Producto.objects.filter(pk=producto_id).update(stock_actual=total)
    return total


@transaction.atomic
def mover_stock(producto_id, bodega_id, delta, campo_error="cantidad", precio_unitario=None):
    """Suma (delta > 0) o resta (delta < 0) stock en una bodega.

    Si se indica `precio_unitario` en una entrada (delta > 0), recalcula el
    costo promedio ponderado del producto con el stock existente.
    Si no alcanza, lanza ValidationError y no cambia nada.
    """
    delta = Decimal(delta)
    # Bloquea la fila del producto para que dos retiros simultáneos no se pisen.
    producto = Producto.objects.select_for_update().get(pk=producto_id)
    stock_previo = max(producto.stock_actual or CERO, CERO)
    costo_previo = max(producto.costo_promedio or CERO, CERO)

    fila, _ = StockBodega.objects.select_for_update().get_or_create(
        producto_id=producto_id, bodega_id=bodega_id, defaults={"cantidad": CERO}
    )
    nueva = fila.cantidad + delta
    if nueva < 0:
        raise ValidationError({campo_error: [f"Solo hay {fila.cantidad:.2f} disponibles en esta bodega."]})
    fila.cantidad = nueva
    fila.save(update_fields=["cantidad"])

    total = StockBodega.objects.filter(producto_id=producto_id).aggregate(t=Sum("cantidad"))["t"] or CERO
    cambios = {"stock_actual": total}
    if precio_unitario is not None and delta > 0:
        precio = Decimal(precio_unitario)
        if stock_previo > 0 and costo_previo > 0:
            nuevo_costo = (stock_previo * costo_previo + delta * precio) / (stock_previo + delta)
        else:
            nuevo_costo = precio
        cambios["costo_promedio"] = nuevo_costo.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    Producto.objects.filter(pk=producto_id).update(**cambios)
    return total
