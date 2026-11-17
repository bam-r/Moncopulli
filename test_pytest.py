#archivo de pruebas automatizadas con pytest cubriendo los casos de prueba P05, P06, P07, P11, P15 y P19 del proyecto Moncopulli.

from datetime import date
from decimal import Decimal
import pytest
from rest_framework.test import APIClient

from inventario.models import (
    Bodega,
    Consumo,
    DetalleInventario,
    DocumentoCompra,
    Inventario,
    Producto,
    Proveedor,
    StockBodega,
    Usuario,
)
from inventario.servicios import mover_stock


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def entorno_base(db):
    """Crea datos iniciales limpios en la BD de pruebas para cada test."""
    admin = Usuario.objects.create(
        rut="11.111.111-1",
        nombre_completo="Admin Moncopulli",
        puesto="Administrador",
        departamento="Gerencia",
        telefono="912345678",
        email="admin@moncopulli.cl",
        contrasena="hashed_password_123",
        rol="ADMIN",
        estado="Activo",
    )
    trabajador = Usuario.objects.create(
        rut="22.222.222-2",
        nombre_completo="Juan Operario",
        puesto="Operario Agrícola",
        departamento="Campo",
        telefono="987654321",
        email="juan@moncopulli.cl",
        contrasena="hashed_password_456",
        rol="TRABAJADOR",
        estado="Activo",
    )
    bodega = Bodega.objects.create(
        nombre="Bodega Central",
        ubicacion="Fundo Moncopulli Sector 1",
        estado=True,
    )
    proveedor = Proveedor.objects.create(
        razon_social="Insumos Agrícolas del Sur SpA",
        nombre="AgroSur",
        rut="76.123.456-7",
        domicilio_legal="Ruta 5 Sur Km 920, Osorno",
        telefono="642234567",
        correo="ventas@agrosur.cl",
        contacto="Carlos Pérez",
        plazo_pago=30,
        limite_credito=5000000,
        categoria="Fertilizantes",
        estado=True,
    )
    producto = Producto.objects.create(
        codigo="FERT-001",
        nombre="Urea Granulada 25kg",
        categoria="Fertilizantes",
        unidad_medida="Saco",
        costo_promedio=Decimal("15000.00"),
        stock_actual=Decimal("0.00"),
        stock_minimo=Decimal("10.00"),
    )

    mover_stock(producto.id, bodega.id, Decimal("20.00"))
    producto.refresh_from_db()

    return {
        "admin": admin,
        "trabajador": trabajador,
        "bodega": bodega,
        "proveedor": proveedor,
        "producto": producto,
    }


# ==============================================================================
# P05: Registro de consumo descuenta stock y guarda trazabilidad del usuario
# ==============================================================================
@pytest.mark.django_db
def test_p05_registro_consumo_descuenta_stock_y_trazabilidad(api_client, entorno_base):
    producto = entorno_base["producto"]
    bodega = entorno_base["bodega"]
    trabajador = entorno_base["trabajador"]
    api_client.force_authenticate(user=trabajador)

    payload = {
        "cantidad_retirada": "5.00",
        "usuario": trabajador.id,
        "producto": producto.id,
        "bodega": bodega.id,
    }
    response = api_client.post("/api/consumos/", payload, format="json")

    assert response.status_code == 201
    producto.refresh_from_db()
    stock_bodega = StockBodega.objects.get(producto=producto, bodega=bodega)

    assert producto.stock_actual == Decimal("15.00")
    assert stock_bodega.cantidad == Decimal("15.00")

    consumo = Consumo.objects.get(id=response.data["id"])
    assert consumo.usuario_id == trabajador.id
    assert consumo.estado == "CONFIRMADO"


# ==============================================================================
# P06: Rechazar retiro mayor al stock disponible sin alterar inventario
# ==============================================================================
@pytest.mark.django_db
def test_p06_consumo_supera_stock_rechazado(api_client, entorno_base):
    producto = entorno_base["producto"]  # Stock actual = 20.00
    bodega = entorno_base["bodega"]
    trabajador = entorno_base["trabajador"]
    api_client.force_authenticate(user=trabajador)

    payload = {
        "cantidad_retirada": "25.00",  # Supera los 20 disponibles
        "usuario": trabajador.id,
        "producto": producto.id,
        "bodega": bodega.id,
    }
    response = api_client.post("/api/consumos/", payload, format="json")

    assert response.status_code == 400
    assert "cantidad_retirada" in response.data

    producto.refresh_from_db()
    assert producto.stock_actual == Decimal("20.00")
    assert Consumo.objects.count() == 0


# ==============================================================================
# P07: Ingreso de factura de compra con detalles incrementa stock y recalcula costo
# ==============================================================================
@pytest.mark.django_db
def test_p07_ingreso_compra_incrementa_stock(api_client, entorno_base):
    producto = entorno_base["producto"]  # Stock = 20, costo_promedio = 15000
    bodega = entorno_base["bodega"]
    proveedor = entorno_base["proveedor"]
    admin = entorno_base["admin"]
    api_client.force_authenticate(user=admin)

    payload = {
        "numero_folio": "98765",
        "tipo_documento": "FACTURA",
        "fecha_emision": str(date.today()),
        "condicion_pago": "CREDITO",
        "dias_credito": 30,
        "proveedor": proveedor.id,
        "bodega": bodega.id,
        "usuario": admin.id,
        "detalles": [
            {
                "producto": producto.id,
                "cantidad": "10.00",
                "precio_unitario": 18000,
            }
        ],
    }
    response = api_client.post("/api/documentos-compra/", payload, format="json")

    assert response.status_code == 201
    assert DocumentoCompra.objects.filter(numero_folio="98765").exists()

    producto.refresh_from_db()
    assert producto.stock_actual == Decimal("30.00")
    # Costo promedio ponderado: (20*15000 + 10*18000) / 30 = 16000.00
    assert producto.costo_promedio == Decimal("16000.00")


# ==============================================================================
# P11: Creación de inventario físico y cálculo automático de desviación
# ==============================================================================
@pytest.mark.django_db
def test_p11_inventario_calcula_desviacion(api_client, entorno_base):
    producto = entorno_base["producto"]  # Stock sistema = 20.00
    bodega = entorno_base["bodega"]
    admin = entorno_base["admin"]
    api_client.force_authenticate(user=admin)

    payload = {
        "fecha": str(date.today()),
        "usuario": admin.id,
        "bodega": bodega.id,
        "detalles": [
            {
                "producto": producto.id,
                "stock_real": "17.50",  # Faltan 2.50 unidades respecto al sistema
            }
        ],
    }
    response = api_client.post("/api/inventarios/", payload, format="json")

    assert response.status_code == 201
    inventario = Inventario.objects.get(id=response.data["id"])
    detalle = DetalleInventario.objects.get(inventario=inventario, producto=producto)

    assert detalle.stock_sistema == Decimal("20.00")
    assert detalle.stock_real == Decimal("17.50")
    assert detalle.desviacion == Decimal("-2.50")


# ==============================================================================
# P15: Consumo deja producto bajo stock mínimo activando condición de alerta
# ==============================================================================
@pytest.mark.django_db
def test_p15_consumo_activa_alerta_stock_minimo(api_client, entorno_base):
    producto = entorno_base["producto"]  # Stock = 20.00, stock_minimo = 10.00
    bodega = entorno_base["bodega"]
    trabajador = entorno_base["trabajador"]
    api_client.force_authenticate(user=trabajador)

    payload = {
        "cantidad_retirada": "13.00",  # Quedarán 7.00 (< 10.00 mínimo)
        "usuario": trabajador.id,
        "producto": producto.id,
        "bodega": bodega.id,
    }
    response = api_client.post("/api/consumos/", payload, format="json")

    assert response.status_code == 201
    producto.refresh_from_db()
    assert producto.stock_actual == Decimal("7.00")
    assert producto.stock_actual <= producto.stock_minimo


# ==============================================================================
# P19: Validación de unicidad (RUT proveedor, RUT usuario, código producto)
# ==============================================================================
@pytest.mark.django_db
def test_p19_rechaza_datos_duplicados(api_client, entorno_base):
    api_client.force_authenticate(user=entorno_base["admin"])
    # 1. RUT de proveedor duplicado
    resp_prov = api_client.post(
        "/api/proveedores/",
        {
            "razon_social": "Otra Empresa SpA",
            "nombre": "Otra",
            "rut": "76.123.456-7",  # Ya existe en entorno_base
            "domicilio_legal": "Calle 1",
            "telefono": "911111111",
            "correo": "a@b.cl",
            "contacto": "Juan",
            "plazo_pago": 15,
            "limite_credito": 100000,
            "categoria": "Varios",
        },
        format="json",
    )
    assert resp_prov.status_code == 400

    # 2. RUT de usuario duplicado
    resp_user = api_client.post(
        "/api/usuarios/",
        {
            "rut": "22.222.222-2",  # Ya existe en entorno_base
            "nombre_completo": "Duplicado",
            "puesto": "Operario",
            "departamento": "Campo",
            "telefono": "922222222",
            "email": "dup@moncopulli.cl",
            "contrasena": "password123",
            "rol": "TRABAJADOR",
            "estado": "Activo",
        },
        format="json",
    )
    assert resp_user.status_code == 400

    # 3. Código de producto duplicado
    resp_prod = api_client.post(
        "/api/productos/",
        {
            "codigo": "FERT-001",  # Ya existe en entorno_base
            "nombre": "Otro Producto",
            "categoria": "Varios",
            "unidad_medida": "Unidad",
            "costo_promedio": "1000.00",
            "stock_actual": "0.00",
            "stock_minimo": "5.00",
        },
        format="json",
    )
    assert resp_prod.status_code == 400