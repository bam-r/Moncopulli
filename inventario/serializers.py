from datetime import timedelta

from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from .models import (
    Bodega, Consumo, DetalleDocumento, DetalleInventario, DocumentoCompra, Inventario,
    ProduccionLeche, Producto, Proveedor, StockBodega, Usuario,
)
from .servicios import es_admin, esta_activo, mover_stock, stock_en_bodega


def exigir_anulador(datos, instancia):
    """Validaciones comunes para anular un consumo o un inventario."""
    motivo = (datos.get("motivo_anulacion") or instancia.motivo_anulacion or "").strip()
    if len(motivo) < 5:
        raise serializers.ValidationError({"motivo_anulacion": ["Cuenta brevemente el motivo (mínimo 5 caracteres)."]})
    anula = datos.get("usuario_anula")
    if anula is None:
        raise serializers.ValidationError({"usuario_anula": ["Indica quién anula."]})
    if not es_admin(anula) or not esta_activo(anula):
        raise serializers.ValidationError({"usuario_anula": ["Solo un administrador activo puede anular."]})
    return motivo, anula


class ProveedorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Proveedor
        fields = '__all__'


class UsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = '__all__'
        extra_kwargs = {
            'contrasena': {'write_only': True}
        }

    def validate_contrasena(self, valor):
        if len(valor) < 6:
            raise serializers.ValidationError("Mínimo 6 caracteres.")
        return valor

    # La contraseña nunca se guarda en texto plano: se guarda su hash.
    def create(self, validated_data):
        validated_data["contrasena"] = make_password(validated_data["contrasena"])
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if "contrasena" in validated_data:
            validated_data["contrasena"] = make_password(validated_data["contrasena"])
        return super().update(instance, validated_data)


class BodegaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bodega
        fields = '__all__'


class StockBodegaSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockBodega
        fields = '__all__'


class ProductoSerializer(serializers.ModelSerializer):
    # Cuánto hay de este producto en cada bodega: [{"bodega": 1, "cantidad": "35.00"}, ...]
    stock_por_bodega = serializers.SerializerMethodField()
    # Solo al crear un insumo con stock inicial: en qué bodega queda ese stock.
    bodega_inicial = serializers.PrimaryKeyRelatedField(queryset=Bodega.objects.all(), write_only=True, required=False)

    class Meta:
        model = Producto
        fields = '__all__'

    def get_stock_por_bodega(self, obj):
        return [{"bodega": s.bodega_id, "cantidad": f"{s.cantidad:.2f}"} for s in obj.stocks.all()]

    @transaction.atomic
    def create(self, validated_data):
        bodega = validated_data.pop("bodega_inicial", None)
        inicial = validated_data.pop("stock_actual", 0) or 0
        if inicial < 0:
            raise serializers.ValidationError({"stock_actual": ["No puede ser negativo."]})
        if inicial > 0 and bodega is None:
            bodega = Bodega.objects.filter(estado=True).order_by("id").first()
            if bodega is None:
                raise serializers.ValidationError({"bodega_inicial": ["Crea una bodega antes de agregar stock."]})
        producto = Producto.objects.create(stock_actual=0, **validated_data)
        if inicial > 0:
            mover_stock(producto.id, bodega.id, inicial)
            producto.refresh_from_db()
        return producto

    def update(self, instance, validated_data):
        # El stock solo cambia con compras, consumos y su anulación; no se edita a mano.
        validated_data.pop("stock_actual", None)
        validated_data.pop("bodega_inicial", None)
        return super().update(instance, validated_data)


class DetalleDocumentoSerializer(serializers.ModelSerializer):
    class Meta:
        model = DetalleDocumento
        fields = '__all__'
        extra_kwargs = {'documento': {'required': False}}

    def validate_cantidad(self, valor):
        if valor <= 0:
            raise serializers.ValidationError("Debe ser mayor a 0.")
        return valor

    def validate_precio_unitario(self, valor):
        if valor < 0:
            raise serializers.ValidationError("No puede ser negativo.")
        return valor

    def create(self, validated_data):
        # POST /api/detalle-documentos/ suelto (sin pasar por la compra completa).
        documento = validated_data.get("documento")
        if documento is None:
            raise serializers.ValidationError({"documento": ["Este campo es requerido."]})
        with transaction.atomic():
            detalle = crear_detalle(documento, validated_data)
            marcar_ultima_compra(documento)
        return detalle


def crear_detalle(documento, datos):
    datos = {k: v for k, v in datos.items() if k != "documento"}
    mover_stock(datos["producto"].id, documento.bodega_id, datos["cantidad"])
    return DetalleDocumento.objects.create(documento=documento, **datos)


def marcar_ultima_compra(documento):
    proveedor = documento.proveedor
    if proveedor.ultima_compra is None or proveedor.ultima_compra < documento.fecha_emision:
        proveedor.ultima_compra = documento.fecha_emision
        proveedor.save(update_fields=["ultima_compra"])


class DocumentoCompraSerializer(serializers.ModelSerializer):
    detalles = DetalleDocumentoSerializer(many=True, required=False)

    class Meta:
        model = DocumentoCompra
        fields = '__all__'

    def validate(self, datos):
        if not datos["bodega"].estado:
            raise serializers.ValidationError({"bodega": ["La bodega está inactiva."]})
        if not datos["proveedor"].estado:
            raise serializers.ValidationError({"proveedor": ["El proveedor está inactivo."]})
        if not esta_activo(datos["usuario"]):
            raise serializers.ValidationError({"usuario": ["Usuario inactivo."]})
        repetido = DocumentoCompra.objects.filter(
            proveedor=datos["proveedor"], tipo_documento=datos["tipo_documento"], numero_folio=datos["numero_folio"]
        )
        if self.instance:
            repetido = repetido.exclude(pk=self.instance.pk)
        if repetido.exists():
            raise serializers.ValidationError({"numero_folio": ["Ya hay un documento con ese folio para este proveedor."]})
        return datos

    @transaction.atomic
    def create(self, validated_data):
        detalles = validated_data.pop("detalles", [])
        documento = DocumentoCompra.objects.create(**validated_data)
        for d in detalles:
            crear_detalle(documento, d)
        marcar_ultima_compra(documento)
        return documento

    def update(self, instance, validated_data):
        # Una compra ya registrada no se edita (movió stock). Solo se puede consultar.
        raise serializers.ValidationError("Las compras registradas no se pueden editar.")


class ProduccionLecheSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProduccionLeche
        fields = '__all__'

    def validate_litros(self, valor):
        if valor <= 0:
            raise serializers.ValidationError("Debe ser mayor a 0.")
        return valor


class ConsumoSerializer(serializers.ModelSerializer):
    # Solo para retiros hechos sin internet: la hora real en que se hizo. El servidor
    # la acepta únicamente si es de los últimos 7 días; si no, usa la hora actual.
    fecha_offline = serializers.DateTimeField(write_only=True, required=False)

    class Meta:
        model = Consumo
        fields = '__all__'
        read_only_fields = ['fecha']
        extra_kwargs = {'estado': {'required': False}}

    def validate_cantidad_retirada(self, valor):
        if valor <= 0:
            raise serializers.ValidationError("Debe ser mayor a 0.")
        return valor

    @transaction.atomic
    def create(self, validated_data):
        offline = validated_data.pop("fecha_offline", None)
        validated_data.pop("estado", None)
        for campo in ("motivo_anulacion", "fecha_anulacion", "usuario_anula"):
            validated_data.pop(campo, None)
        if not esta_activo(validated_data["usuario"]):
            raise serializers.ValidationError({"usuario": ["Usuario inactivo."]})
        if not validated_data["bodega"].estado:
            raise serializers.ValidationError({"bodega": ["La bodega está inactiva."]})

        # La fecha la pone el servidor: el trabajador no puede elegirla ni editarla.
        ahora = timezone.now()
        fecha = ahora
        if offline and ahora - timedelta(days=7) <= offline <= ahora:
            fecha = offline

        mover_stock(
            validated_data["producto"].id, validated_data["bodega"].id,
            -validated_data["cantidad_retirada"], campo_error="cantidad_retirada",
        )
        return Consumo.objects.create(fecha=fecha, estado="CONFIRMADO", **validated_data)

    @transaction.atomic
    def update(self, instance, validated_data):
        # Un consumo no se edita: solo se anula (y el stock vuelve a la bodega).
        if str(validated_data.get("estado", "")).upper() != "ANULADO":
            raise serializers.ValidationError({"estado": ["Un consumo solo se puede anular."]})
        if str(instance.estado).upper() == "ANULADO":
            raise serializers.ValidationError({"estado": ["Este consumo ya está anulado."]})
        motivo, anula = exigir_anulador(validated_data, instance)
        instance.estado = "ANULADO"
        instance.motivo_anulacion = motivo
        instance.usuario_anula = anula
        instance.fecha_anulacion = timezone.now()
        instance.save()
        mover_stock(instance.producto_id, instance.bodega_id, instance.cantidad_retirada)
        return instance


class DetalleInventarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = DetalleInventario
        fields = '__all__'
        # Los calcula el servidor: stock_sistema = lo que había en esa bodega al contar.
        read_only_fields = ['stock_sistema', 'desviacion']
        extra_kwargs = {'inventario': {'required': False}}

    def validate_stock_real(self, valor):
        if valor < 0:
            raise serializers.ValidationError("No puede ser negativo.")
        return valor

    def create(self, validated_data):
        inventario = validated_data.get("inventario")
        if inventario is None:
            raise serializers.ValidationError({"inventario": ["Este campo es requerido."]})
        return crear_detalle_inventario(inventario, validated_data)


def crear_detalle_inventario(inventario, datos):
    datos = {k: v for k, v in datos.items() if k != "inventario"}
    sistema = stock_en_bodega(datos["producto"].id, inventario.bodega_id)
    return DetalleInventario.objects.create(
        inventario=inventario, stock_sistema=sistema, desviacion=datos["stock_real"] - sistema, **datos
    )


class InventarioSerializer(serializers.ModelSerializer):
    detalles = DetalleInventarioSerializer(many=True, required=False)

    class Meta:
        model = Inventario
        fields = '__all__'
        extra_kwargs = {'estado': {'required': False}}

    @transaction.atomic
    def create(self, validated_data):
        detalles = validated_data.pop("detalles", [])
        validated_data.pop("estado", None)
        for campo in ("motivo_anulacion", "fecha_anulacion", "usuario_anula"):
            validated_data.pop(campo, None)
        inventario = Inventario.objects.create(estado="CONFIRMADO", **validated_data)
        for d in detalles:
            crear_detalle_inventario(inventario, d)
        return inventario

    @transaction.atomic
    def update(self, instance, validated_data):
        if str(validated_data.get("estado", "")).upper() != "ANULADO":
            raise serializers.ValidationError({"estado": ["Un inventario solo se puede anular."]})
        if str(instance.estado).upper() == "ANULADO":
            raise serializers.ValidationError({"estado": ["Este inventario ya está anulado."]})
        motivo, anula = exigir_anulador(validated_data, instance)
        instance.estado = "ANULADO"
        instance.motivo_anulacion = motivo
        instance.usuario_anula = anula
        instance.fecha_anulacion = timezone.now()
        instance.save()
        return instance
