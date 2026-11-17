from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth.hashers import make_password
from django.db import IntegrityError, transaction
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import Bodega, Consumo, DocumentoCompra, Producto, Proveedor, StockBodega, Usuario


def crear_usuario(rut, rol="TRABAJADOR", estado="Activo", clave="clave123", plano=False):
    return Usuario.objects.create(
        rut=rut, nombre_completo=f"Persona {rut}", puesto="x", departamento="x", telefono="1", email="a@b.cl",
        contrasena=clave if plano else make_password(clave), rol=rol, estado=estado)


class BaseApi(APITestCase):
    def setUp(self):
        self.admin = crear_usuario("11.111.111-1", "ADMIN")
        self.trab = crear_usuario("12.345.678-5")
        self.b1 = Bodega.objects.create(nombre="Principal", ubicacion="x")
        self.b2 = Bodega.objects.create(nombre="Alimentos", ubicacion="x")
        self.prov = Proveedor.objects.create(
            razon_social="P", nombre="P", rut="76.000.000-0", domicilio_legal="x", telefono="1", correo="p@p.cl",
            contacto="x", plazo_pago=30, limite_credito=0, categoria="x")
        self.prod = Producto.objects.create(codigo="A-1", nombre="Sal", categoria="Alim", unidad_medida="KG",
                                            costo_promedio=100, stock_actual=0, stock_minimo=10)

    def comprar(self, cantidad, bodega=None, folio="1", precio=100):
        return self.client.post("/api/documentos-compra/", {
            "numero_folio": folio, "tipo_documento": "Factura", "fecha_emision": str(date.today()),
            "proveedor": self.prov.id, "bodega": (bodega or self.b1).id, "usuario": self.admin.id,
            "detalles": [{"producto": self.prod.id, "cantidad": cantidad, "precio_unitario": precio}],
        }, format="json")

    def retirar(self, cantidad, bodega=None, **extra):
        return self.client.post("/api/consumos/", {
            "cantidad_retirada": cantidad, "usuario": self.trab.id, "producto": self.prod.id,
            "bodega": (bodega or self.b1).id, **extra}, format="json")

    def stock(self, bodega):
        f = StockBodega.objects.filter(producto=self.prod, bodega=bodega).first()
        return f.cantidad if f else Decimal(0)


class LoginTests(BaseApi):
    def test_login_ok_y_no_devuelve_clave(self):
        r = self.client.post("/api/auth/login/", {"rut": "12345678-5", "contrasena": "clave123"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["usuario"]["id"], self.trab.id)
        self.assertNotIn("contrasena", r.data["usuario"])

    def test_clave_incorrecta_y_rut_inexistente_dan_el_mismo_error(self):
        a = self.client.post("/api/auth/login/", {"rut": "12.345.678-5", "contrasena": "mala"}, format="json")
        b = self.client.post("/api/auth/login/", {"rut": "99.999.999-9", "contrasena": "clave123"}, format="json")
        self.assertEqual((a.status_code, b.status_code), (400, 400))
        self.assertEqual(a.data, b.data)

    def test_usuario_inactivo(self):
        crear_usuario("10.000.000-8", estado="Inactivo")
        r = self.client.post("/api/auth/login/", {"rut": "10.000.000-8", "contrasena": "clave123"}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_clave_antigua_en_texto_plano_se_acepta_y_se_pasa_a_hash(self):
        u = crear_usuario("9.999.999-3", clave="vieja123", plano=True)
        r = self.client.post("/api/auth/login/", {"rut": "9.999.999-3", "contrasena": "vieja123"}, format="json")
        self.assertEqual(r.status_code, 200)
        u.refresh_from_db()
        self.assertTrue(u.contrasena.startswith("pbkdf2_"))

    def test_crear_usuario_guarda_hash(self):
        r = self.client.post("/api/usuarios/", {
            "rut": "8.888.888-8", "nombre_completo": "N", "puesto": "p", "departamento": "d", "telefono": "1",
            "email": "n@n.cl", "contrasena": "secreta1", "rol": "TRABAJADOR", "estado": "Activo"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertNotIn("contrasena", r.data)
        self.assertTrue(Usuario.objects.get(rut="8.888.888-8").contrasena.startswith("pbkdf2_"))


class StockTests(BaseApi):
    def test_compra_suma_en_la_bodega_y_en_el_total(self):
        r = self.comprar(50, self.b1)
        self.assertEqual(r.status_code, 201)
        self.assertEqual(len(r.data["detalles"]), 1)
        self.comprar(30, self.b2, folio="2")
        self.prod.refresh_from_db()
        self.assertEqual(self.prod.stock_actual, 80)
        self.assertEqual((self.stock(self.b1), self.stock(self.b2)), (50, 30))
        self.prov.refresh_from_db()
        self.assertEqual(self.prov.ultima_compra, date.today())

    def test_folio_repetido_del_mismo_proveedor_se_rechaza(self):
        self.comprar(5)
        r = self.comprar(5)
        self.assertEqual(r.status_code, 400)
        self.assertIn("numero_folio", r.data)
        self.prod.refresh_from_db()
        self.assertEqual(self.prod.stock_actual, 5)
        # También a nivel de base de datos (sin pasar por la API)
        with self.assertRaises(IntegrityError), transaction.atomic():
            DocumentoCompra.objects.create(
                numero_folio="1", tipo_documento="Factura", fecha_emision=date.today(),
                proveedor=self.prov, bodega=self.b1, usuario=self.admin,
            )

    def test_compra_recalcula_costo_promedio_ponderado(self):
        # Sin stock previo: toma el precio de la compra (200)
        self.comprar(10, self.b1, folio="1", precio=200)
        self.prod.refresh_from_db()
        self.assertEqual(self.prod.costo_promedio, Decimal("200.00"))
        # Con 10 a $200 + 30 a $400 -> (2000 + 12000) / 40 = $350.00
        self.comprar(30, self.b2, folio="2", precio=400)
        self.prod.refresh_from_db()
        self.assertEqual(self.prod.costo_promedio, Decimal("350.00"))

    def test_compra_invalida_no_deja_nada_a_medias(self):
        r = self.client.post("/api/documentos-compra/", {
            "numero_folio": "9", "tipo_documento": "Factura", "fecha_emision": str(date.today()),
            "proveedor": self.prov.id, "bodega": self.b1.id, "usuario": self.admin.id,
            "detalles": [{"producto": self.prod.id, "cantidad": 5, "precio_unitario": 1},
                         {"producto": self.prod.id, "cantidad": -1, "precio_unitario": 1}]}, format="json")
        self.assertEqual(r.status_code, 400)
        self.prod.refresh_from_db()
        self.assertEqual(self.prod.stock_actual, 0)

    def test_consumo_descuenta_de_la_bodega_elegida(self):
        self.comprar(50, self.b1)
        self.comprar(30, self.b2, folio="2")
        r = self.retirar(20, self.b2)
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["estado"], "CONFIRMADO")
        self.assertEqual((self.stock(self.b1), self.stock(self.b2)), (50, 10))
        self.prod.refresh_from_db()
        self.assertEqual(self.prod.stock_actual, 60)

    def test_no_se_puede_retirar_mas_de_lo_que_hay_en_esa_bodega(self):
        self.comprar(50, self.b1)
        self.comprar(5, self.b2, folio="2")
        r = self.retirar(10, self.b2)  # en total hay 55, pero en Alimentos solo 5
        self.assertEqual(r.status_code, 400)
        self.assertIn("cantidad_retirada", r.data)
        self.assertEqual(Consumo.objects.count(), 0)
        self.assertEqual(self.stock(self.b2), 5)

    def test_la_fecha_la_pone_el_servidor(self):
        self.comprar(50)
        r = self.retirar(5, fecha="2020-01-01T00:00:00Z")
        self.assertLess(abs((timezone.now() - Consumo.objects.get(pk=r.data["id"]).fecha).total_seconds()), 10)

    def test_fecha_offline_se_acepta_solo_si_es_reciente(self):
        self.comprar(50)
        hace_2h = (timezone.now() - timedelta(hours=2)).isoformat()
        r = self.retirar(1, fecha_offline=hace_2h)
        self.assertLess(abs((timezone.now() - timedelta(hours=2) - Consumo.objects.get(pk=r.data["id"]).fecha).total_seconds()), 5)
        hace_un_mes = (timezone.now() - timedelta(days=30)).isoformat()
        r = self.retirar(1, fecha_offline=hace_un_mes)
        self.assertLess(abs((timezone.now() - Consumo.objects.get(pk=r.data["id"]).fecha).total_seconds()), 10)
        futuro = (timezone.now() + timedelta(days=2)).isoformat()
        r = self.retirar(1, fecha_offline=futuro)
        self.assertLess(abs((timezone.now() - Consumo.objects.get(pk=r.data["id"]).fecha).total_seconds()), 10)

    def test_usuario_inactivo_no_puede_retirar(self):
        self.comprar(50)
        self.trab.estado = "Inactivo"
        self.trab.save()
        self.assertEqual(self.retirar(1).status_code, 400)

    def test_anular_devuelve_el_stock_y_solo_una_vez(self):
        self.comprar(50)
        cid = self.retirar(20).data["id"]
        datos = {"estado": "ANULADO", "motivo_anulacion": "Se registró por error", "usuario_anula": self.admin.id}
        r = self.client.patch(f"/api/consumos/{cid}/", datos, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(self.stock(self.b1), 50)
        self.assertIsNotNone(r.data["fecha_anulacion"])
        self.assertEqual(self.client.patch(f"/api/consumos/{cid}/", datos, format="json").status_code, 400)
        self.assertEqual(self.stock(self.b1), 50)

    def test_un_trabajador_no_puede_anular_y_hace_falta_motivo(self):
        self.comprar(50)
        cid = self.retirar(20).data["id"]
        r = self.client.patch(f"/api/consumos/{cid}/", {"estado": "ANULADO", "motivo_anulacion": "No lo quiero", "usuario_anula": self.trab.id}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.client.patch(f"/api/consumos/{cid}/", {"estado": "ANULADO", "motivo_anulacion": "x", "usuario_anula": self.admin.id}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.stock(self.b1), 30)

    def test_un_consumo_no_se_edita_ni_se_borra(self):
        self.comprar(50)
        cid = self.retirar(20).data["id"]
        self.assertEqual(self.client.patch(f"/api/consumos/{cid}/", {"cantidad_retirada": 1}, format="json").status_code, 400)
        self.assertEqual(self.client.delete(f"/api/consumos/{cid}/").status_code, 405)

    def test_stock_actual_no_se_edita_a_mano(self):
        self.comprar(50)
        self.client.patch(f"/api/productos/{self.prod.id}/", {"stock_actual": "999.00", "nombre": "Sal gruesa"}, format="json")
        self.prod.refresh_from_db()
        self.assertEqual((self.prod.stock_actual, self.prod.nombre), (50, "Sal gruesa"))

    def test_insumo_nuevo_con_stock_inicial_queda_en_la_bodega_elegida(self):
        r = self.client.post("/api/productos/", {
            "codigo": "B-2", "nombre": "Maíz", "categoria": "Alim", "unidad_medida": "KG", "costo_promedio": "10",
            "stock_actual": "40", "stock_minimo": "5", "bodega_inicial": self.b2.id}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["stock_por_bodega"], [{"bodega": self.b2.id, "cantidad": "40.00"}])
        self.assertEqual(Producto.objects.get(codigo="B-2").stock_actual, 40)

    def test_listado_de_productos_trae_stock_por_bodega(self):
        self.comprar(50, self.b1)
        self.comprar(30, self.b2, folio="2")
        fila = next(p for p in self.client.get("/api/productos/").data if p["id"] == self.prod.id)
        self.assertEqual({s["bodega"]: s["cantidad"] for s in fila["stock_por_bodega"]},
                         {self.b1.id: "50.00", self.b2.id: "30.00"})
        todo = self.client.get(f"/api/stock-bodega/?producto={self.prod.id}&bodega={self.b2.id}").data
        self.assertEqual(len(todo), 1)

    def test_las_lineas_de_compra_no_se_editan(self):
        self.comprar(50)
        did = self.client.get("/api/detalle-documentos/").data[0]["id"]
        self.assertEqual(self.client.patch(f"/api/detalle-documentos/{did}/", {"cantidad": 1}, format="json").status_code, 405)


class InventarioTests(BaseApi):
    def test_el_sistema_calcula_stock_sistema_y_desviacion_de_esa_bodega(self):
        self.comprar(50, self.b1)
        self.comprar(30, self.b2, folio="2")
        r = self.client.post("/api/inventarios/", {
            "fecha": str(date.today()), "usuario": self.admin.id, "bodega": self.b2.id,
            "detalles": [{"producto": self.prod.id, "stock_real": "28.00", "stock_sistema": "999", "desviacion": "999"}],
        }, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        d = r.data["detalles"][0]
        self.assertEqual((d["stock_sistema"], d["stock_real"], d["desviacion"]), ("30.00", "28.00", "-2.00"))
        self.assertEqual(r.data["estado"], "CONFIRMADO")
        # guardar el inventario no cambia el stock
        self.assertEqual(self.stock(self.b2), 30)

    def test_anular_inventario(self):
        iid = self.client.post("/api/inventarios/", {"fecha": str(date.today()), "usuario": self.admin.id, "bodega": self.b1.id}, format="json").data["id"]
        r = self.client.patch(f"/api/inventarios/{iid}/", {"estado": "ANULADO", "motivo_anulacion": "Conteo repetido", "usuario_anula": self.admin.id}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["estado"], "ANULADO")
