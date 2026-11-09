from rest_framework import serializers
from .models import Consumo, DetalleInventario, Inventario, ProduccionLeche, Proveedor, Bodega, Producto, DocumentoCompra, DetalleDocumento, Usuario

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

class BodegaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bodega
        fields = '__all__'

class ProductoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Producto
        fields = '__all__'

class DetalleDocumentoSerializer(serializers.ModelSerializer):
    class Meta:
        model = DetalleDocumento
        fields = '__all__'

class DocumentoCompraSerializer(serializers.ModelSerializer):
    detalles = DetalleDocumentoSerializer(many=True, read_only=True)

    class Meta:
        model = DocumentoCompra
        fields = '__all__'

class ProduccionLecheSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProduccionLeche
        fields = '__all__'

class ConsumoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Consumo
        fields = '__all__'

class InventarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Inventario
        fields = '__all__'

class DetalleInventarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = DetalleInventario
        fields = '__all__'