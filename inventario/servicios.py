"""Reglas de negocio del stock.

Todo lo que sube o baja el stock pasa por aquí, así el frontend no tiene que
(ni puede) tocar Producto.stock_actual a mano:

* Compra  -> sube el stock de la bodega del documento.
* Consumo -> baja el stock de la bodega elegida (si alcanza).
* Anular un consumo -> devuelve el stock a esa bodega.

Producto.stock_actual es siempre la suma de StockBodega de ese producto.
"""
from decimal import Decimal

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
def mover_stock(producto_id, bodega_id, delta, campo_error="cantidad"):
    """Suma (delta > 0) o resta (delta < 0) stock en una bodega.

    Si no alcanza, lanza ValidationError y no cambia nada.
    """
    delta = Decimal(delta)
    # Bloquea la fila del producto para que dos retiros simultáneos no se pisen.
    Producto.objects.select_for_update().get(pk=producto_id)
    fila, _ = StockBodega.objects.select_for_update().get_or_create(
        producto_id=producto_id, bodega_id=bodega_id, defaults={"cantidad": CERO}
    )
    nueva = fila.cantidad + delta
    if nueva < 0:
        raise ValidationError({campo_error: [f"Solo hay {fila.cantidad:.2f} disponibles en esta bodega."]})
    fila.cantidad = nueva
    fila.save(update_fields=["cantidad"])
    return recalcular_total(producto_id)
