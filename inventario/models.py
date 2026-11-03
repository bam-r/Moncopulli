from django.db import models


class Proveedor(models.Model):
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

    def __str__(self):
        return f"{self.nombre} ({self.rut})"


class Usuario(models.Model):
    rut = models.CharField(max_length=12)
    nombre_completo = models.CharField(max_length=100)
    puesto = models.CharField(max_length=50)
    departamento = models.CharField(max_length=50)
    telefono = models.CharField(max_length=15)
    email = models.CharField(max_length=80)
    contrasena = models.CharField(max_length=255)
    rol = models.CharField(max_length=20)
    estado = models.CharField(max_length=10)

    def __str__(self):
        return f"{self.nombre_completo} ({self.rut})"


class Bodega(models.Model):
    nombre = models.CharField(max_length=80)
    ubicacion = models.CharField(max_length=150)
    estado = models.BooleanField(default=True)

    def __str__(self):
        return self.nombre


class Producto(models.Model):
    codigo = models.CharField(max_length=20)
    nombre = models.CharField(max_length=100)
    categoria = models.CharField(max_length=50)
    unidad_medida = models.CharField(max_length=20)
    costo_promedio = models.DecimalField(max_digits=10, decimal_places=2)
    stock_actual = models.DecimalField(max_digits=10, decimal_places=2)
    stock_minimo = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.codigo} - {self.nombre}"


class ProduccionLeche(models.Model):
    fecha = models.DateField()
    litros = models.DecimalField(max_digits=10, decimal_places=2)
    observacion = models.CharField(max_length=200, null=True, blank=True)
    usuario = models.ForeignKey(Usuario, on_delete=models.PROTECT)

    def __str__(self):
        return f"Producción {self.id} - {self.fecha}"


class DocumentoCompra(models.Model):
    numero_folio = models.CharField(max_length=20)
    tipo_documento = models.CharField(max_length=30)
    fecha_emision = models.DateField()
    proveedor = models.ForeignKey(Proveedor, on_delete=models.PROTECT)
    bodega = models.ForeignKey(Bodega, on_delete=models.PROTECT)
    usuario = models.ForeignKey(Usuario, on_delete=models.PROTECT)

    def __str__(self):
        return f"{self.tipo_documento} N° {self.numero_folio}"


class DetalleDocumento(models.Model):
    cantidad = models.DecimalField(max_digits=10, decimal_places=2)
    precio_unitario = models.IntegerField()
    documento = models.ForeignKey(DocumentoCompra, on_delete=models.CASCADE)
    producto = models.ForeignKey(Producto, on_delete=models.PROTECT)

    def __str__(self):
        return f"Detalle {self.id} - Doc {self.documento_id}"


class Consumo(models.Model):
    fecha = models.DateTimeField()
    cantidad_retirada = models.DecimalField(max_digits=10, decimal_places=2)
    estado = models.CharField(max_length=10)
    motivo_anulacion = models.CharField(max_length=200, null=True, blank=True)
    fecha_anulacion = models.DateTimeField(null=True, blank=True)
    usuario = models.ForeignKey(
        Usuario, on_delete=models.PROTECT, related_name="consumos_registrados"
    )
    producto = models.ForeignKey(Producto, on_delete=models.PROTECT)
    bodega = models.ForeignKey(Bodega, on_delete=models.PROTECT)
    usuario_anula = models.ForeignKey(
        Usuario,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="consumos_anulados",
    )

    def __str__(self):
        return f"Consumo {self.id} - {self.producto.nombre}"


class Inventario(models.Model):
    fecha = models.DateField()
    estado = models.CharField(max_length=10)
    motivo_anulacion = models.CharField(max_length=200, null=True, blank=True)
    fecha_anulacion = models.DateTimeField(null=True, blank=True)
    usuario = models.ForeignKey(
        Usuario, on_delete=models.PROTECT, related_name="inventarios_registrados"
    )
    bodega = models.ForeignKey(Bodega, on_delete=models.PROTECT)
    usuario_anula = models.ForeignKey(
        Usuario,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inventarios_anulados",
    )

    def __str__(self):
        return f"Inventario {self.id} - {self.fecha}"


class DetalleInventario(models.Model):
    stock_sistema = models.DecimalField(max_digits=10, decimal_places=2)
    stock_real = models.DecimalField(max_digits=10, decimal_places=2)
    desviacion = models.DecimalField(max_digits=10, decimal_places=2)
    inventario = models.ForeignKey(Inventario, on_delete=models.CASCADE)
    producto = models.ForeignKey(Producto, on_delete=models.PROTECT)

    def __str__(self):
        return f"Detalle Inv {self.id} - {self.producto.nombre}"