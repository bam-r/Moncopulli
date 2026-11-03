from django.db import models

from django.db import models


class Proveedor(models.Model):
    id_proveedor = models.AutoField(primary_key=True)
    razon_social = models.CharField(max_length=100)
    nombre = models.CharField(max_length=100)
    rut = models.CharField(max_length=12)
    domicilio_legal = models.CharField(max_length=150)
    telefono = models.CharField(max_length=15)
    correo = models.CharField(max_length=80)
    contacto = models.CharField(max_length=100)
    plazo_pago = models.IntegerField()
    limite_credito = models.IntegerField()
    ultima_compra = models.DateField(null=True, blank=True)
    categoria = models.CharField(max_length=50)
    estado = models.BooleanField(default=True)

    class Meta:
        db_table = 'proveedor'

    def __str__(self):
        return f"{self.nombre} ({self.rut})"


class Usuario(models.Model):
    id_usuario = models.AutoField(primary_key=True)
    rut = models.CharField(max_length=12)
    nombre_completo = models.CharField(max_length=100)
    puesto = models.CharField(max_length=50)
    departamento = models.CharField(max_length=50)
    telefono = models.CharField(max_length=15)
    email = models.CharField(max_length=80)
    contrasena = models.CharField(max_length=255)
    rol = models.CharField(max_length=20)
    estado = models.CharField(max_length=10)

    class Meta:
        db_table = 'usuario'

    def __str__(self):
        return f"{self.nombre_completo} ({self.rut})"


class Bodega(models.Model):
    id_bodega = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=80)
    ubicacion = models.CharField(max_length=150)
    estado = models.BooleanField(default=True)

    class Meta:
        db_table = 'bodega'

    def __str__(self):
        return self.nombre


class Producto(models.Model):
    id_producto = models.AutoField(primary_key=True)
    codigo = models.CharField(max_length=20)
    nombre = models.CharField(max_length=100)
    categoria = models.CharField(max_length=50)
    unidad_medida = models.CharField(max_length=20)
    costo_promedio = models.DecimalField(max_digits=10, decimal_places=2)
    stock_actual = models.DecimalField(max_digits=10, decimal_places=2)
    stock_minimo = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = 'producto'

    def __str__(self):
        return f"{self.codigo} - {self.nombre}"


class ProduccionLeche(models.Model):
    id_produccion = models.AutoField(primary_key=True)
    fecha = models.DateField()
    litros = models.DecimalField(max_digits=10, decimal_places=2)
    observacion = models.CharField(max_length=200, null=True, blank=True)
    usuario = models.ForeignKey(
        Usuario,
        on_delete=models.PROTECT,
        db_column='usuario_id',
        related_name='producciones_leche'
    )

    class Meta:
        db_table = 'produccion_leche'

    def __str__(self):
        return f"Producción {self.id_produccion} - {self.fecha}"


class DocumentoCompra(models.Model):
    id_documento = models.AutoField(primary_key=True)
    numero_folio = models.CharField(max_length=20)
    tipo_documento = models.CharField(max_length=30)
    fecha_emision = models.DateField()
    proveedor = models.ForeignKey(
        Proveedor,
        on_delete=models.PROTECT,
        db_column='proveedor_id',
        related_name='documentos_compra'
    )
    bodega = models.ForeignKey(
        Bodega,
        on_delete=models.PROTECT,
        db_column='bodega_id',
        related_name='documentos_compra'
    )
    usuario = models.ForeignKey(
        Usuario,
        on_delete=models.PROTECT,
        db_column='usuario_id',
        related_name='documentos_compra'
    )

    class Meta:
        db_table = 'documento_compra'

    def __str__(self):
        return f"{self.tipo_documento} N° {self.numero_folio}"


class DetalleDocumento(models.Model):
    id_detalle = models.AutoField(primary_key=True)
    cantidad = models.DecimalField(max_digits=10, decimal_places=2)
    precio_unitario = models.IntegerField()
    documento = models.ForeignKey(
        DocumentoCompra,
        on_delete=models.CASCADE,
        db_column='documento_id',
        related_name='detalles'
    )
    producto = models.ForeignKey(
        Producto,
        on_delete=models.PROTECT,
        db_column='producto_id',
        related_name='detalles_documento'
    )

    class Meta:
        db_table = 'detalle_documento'

    def __str__(self):
        return f"Detalle {self.id_detalle} - Doc {self.documento_id}"


class Consumo(models.Model):
    id_consumo = models.AutoField(primary_key=True)
    fecha = models.DateTimeField()
    cantidad_retirada = models.DecimalField(max_digits=10, decimal_places=2)
    estado = models.CharField(max_length=10)
    motivo_anulacion = models.CharField(max_length=200, null=True, blank=True)
    fecha_anulacion = models.DateTimeField(null=True, blank=True)
    usuario = models.ForeignKey(
        Usuario,
        on_delete=models.PROTECT,
        db_column='usuario_id',
        related_name='consumos_registrados'
    )
    producto = models.ForeignKey(
        Producto,
        on_delete=models.PROTECT,
        db_column='producto_id',
        related_name='consumos'
    )
    bodega = models.ForeignKey(
        Bodega,
        on_delete=models.PROTECT,
        db_column='bodega_id',
        related_name='consumos'
    )
    usuario_anula = models.ForeignKey(
        Usuario,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='usuario_anula_id',
        related_name='consumos_anulados'
    )

    class Meta:
        db_table = 'consumo'

    def __str__(self):
        return f"Consumo {self.id_consumo} - {self.producto.nombre}"


class Inventario(models.Model):
    id_inventario = models.AutoField(primary_key=True)
    fecha = models.DateField()
    estado = models.CharField(max_length=10)
    motivo_anulacion = models.CharField(max_length=200, null=True, blank=True)
    fecha_anulacion = models.DateTimeField(null=True, blank=True)
    usuario = models.ForeignKey(
        Usuario,
        on_delete=models.PROTECT,
        db_column='usuario_id',
        related_name='inventarios_registrados'
    )
    bodega = models.ForeignKey(
        Bodega,
        on_delete=models.PROTECT,
        db_column='bodega_id',
        related_name='inventarios'
    )
    usuario_anula = models.ForeignKey(
        Usuario,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='usuario_anula_id',
        related_name='inventarios_anulados'
    )

    class Meta:
        db_table = 'inventario'

    def __str__(self):
        return f"Inventario {self.id_inventario} - {self.fecha}"


class DetalleInventario(models.Model):
    id_detalle_inventario = models.AutoField(primary_key=True)
    stock_sistema = models.DecimalField(max_digits=10, decimal_places=2)
    stock_real = models.DecimalField(max_digits=10, decimal_places=2)
    desviacion = models.DecimalField(max_digits=10, decimal_places=2)
    inventario = models.ForeignKey(
        Inventario,
        on_delete=models.CASCADE,
        db_column='inventario_id',
        related_name='detalles'
    )
    producto = models.ForeignKey(
        Producto,
        on_delete=models.PROTECT,
        db_column='producto_id',
        related_name='detalles_inventario'
    )

    class Meta:
        db_table = 'detalle_inventario'

    def __str__(self):
        return f"Detalle Inv {self.id_detalle_inventario} - {self.producto.nombre}"