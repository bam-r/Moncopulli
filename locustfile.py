import os
import random
from datetime import date
from locust import HttpUser, task, between


class UsuarioMoncopulli(HttpUser):
    wait_time = between(1, 2)

    def on_start(self):
        rut = os.environ.get("LOCUST_RUT", "11.111.111-1")
        claves = [os.environ.get("LOCUST_PASSWORD", "admin123456"), "admin123"]
        token = None
        for clave in claves:
            login_resp = self.client.post(
                "/api/auth/login/",
                json={"rut": rut, "contrasena": clave},
                name="Auth - Login",
            )
            if login_resp.status_code == 200:
                token = login_resp.json().get("token")
                break
        if token:
            self.client.headers.update({"Authorization": f"Bearer {token}"})

        # Busca específicamente un usuario, bodega y proveedor que estén ACTIVOS
        usuarios = self.client.get("/api/usuarios/").json()
        activos = [u for u in usuarios if str(u.get("estado", "")).lower().startswith("activ")]
        self.usuario_id = (activos[0] if activos else usuarios[0])["id"]

        bodegas = self.client.get("/api/bodegas/").json()
        bod_activas = [b for b in bodegas if b.get("estado") is True]
        self.bodega_id = (bod_activas[0] if bod_activas else bodegas[0])["id"]

        proveedores = self.client.get("/api/proveedores/").json()
        prov_activos = [p for p in proveedores if p.get("estado") is True]
        self.proveedor_id = (prov_activos[0] if prov_activos else proveedores[0])["id"]

        self.producto_id = self.client.get("/api/productos/").json()[0]["id"]

        # Carga 50.000 unidades de stock en esa bodega antes de consumir
        resp = self.client.post(
            "/api/documentos-compra/",
            json={
                "numero_folio": str(random.randint(1000000, 9999999)),
                "tipo_documento": "FACTURA",
                "fecha_emision": str(date.today()),
                "condicion_pago": "CONTADO",
                "proveedor": self.proveedor_id,
                "bodega": self.bodega_id,
                "usuario": self.usuario_id,
                "detalles": [
                    {"producto": self.producto_id, "cantidad": "50000.00", "precio_unitario": 10000}
                ],
            },
            name="Setup - Carga Stock Inicial",
        )
        if resp.status_code != 201:
            print("ERROR EN SETUP COMPRA:", resp.status_code, resp.text)

    @task(3)
    def registrar_consumo(self):
        resp = self.client.post(
            "/api/consumos/",
            json={
                "cantidad_retirada": "1.00",
                "usuario": self.usuario_id,
                "producto": self.producto_id,
                "bodega": self.bodega_id,
            },
            name="P16 - Registrar Consumo",
        )
        if resp.status_code != 201:
            print("ERROR EN CONSUMO:", resp.status_code, resp.text)

    @task(1)
    def registrar_proveedor(self):
        sufijo = random.randint(10000, 99999)
        self.client.post(
            "/api/proveedores/",
            json={
                "razon_social": f"Proveedor Carga {sufijo} SpA",
                "nombre": f"Prov {sufijo}",
                "rut": f"76.{sufijo}-K",
                "domicilio_legal": "Osorno, Chile",
                "telefono": "912345678",
                "correo": f"contacto{sufijo}@test.cl",
                "contacto": "Test Carga",
                "plazo_pago": 30,
                "limite_credito": 1000000,
                "categoria": "Insumos",
                "estado": True,
            },
            name="P18 - Crear Proveedor",
        )

    @task(1)
    def registrar_compra(self):
        self.client.post(
            "/api/documentos-compra/",
            json={
                "numero_folio": str(random.randint(100000, 999999)),
                "tipo_documento": "FACTURA",
                "fecha_emision": str(date.today()),
                "condicion_pago": "CONTADO",
                "proveedor": self.proveedor_id,
                "bodega": self.bodega_id,
                "usuario": self.usuario_id,
                "detalles": [
                    {"producto": self.producto_id, "cantidad": "5.00", "precio_unitario": 10000}
                ],
            },
            name="P18 - Registrar Compra",
        )