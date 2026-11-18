from datetime import timedelta
from django.utils import timezone
import requests

BASE_URL = "http://127.0.0.1:8000/api"


def test_p17_sincronizacion_consumos_offline():

    login_resp = requests.post(
        f"{BASE_URL}/auth/login/",
        json={"rut": "333.333.33-3", "contrasena": "123456"},
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Enviar 20 consumos offline
    fecha_en_terreno = (timezone.now() - timedelta(hours=1)).isoformat()
    respuestas_ok = 0

    for i in range(20):
            payload = {
                "producto": 93,
                "bodega": 6,
                "cantidad_retirada": 1,
                "fecha_offline": fecha_en_terreno,
            }
            res = requests.post(f"{BASE_URL}/consumos/", json=payload, headers=headers)
            if res.status_code == 201:
                respuestas_ok += 1

    assert respuestas_ok == 20

def _contar_registros(data):
    return data["count"] if isinstance(data, dict) and "count" in data else len(data)


def test_p19_datos_duplicados():

    #login de admin
    login_resp = requests.post(
        f"{BASE_URL}/auth/login/",
        json={"rut": "123.123.12-3", "contrasena": "123"},
    )
    assert login_resp.status_code == 200, f"Fallo login admin: {login_resp.text}"
    token = login_resp.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Conteo previo en BD para verificacion
    prov_antes = _contar_registros(requests.get(f"{BASE_URL}/proveedores/", headers=headers).json())
    user_antes = _contar_registros(requests.get(f"{BASE_URL}/usuarios/", headers=headers).json())
    prod_antes = _contar_registros(requests.get(f"{BASE_URL}/productos/", headers=headers).json())

    # 2. Proveedor con RUT ya existente
    res_prov = requests.post(
        f"{BASE_URL}/proveedores/",
        json={
            "rut": "76.40416-K",
            "razon_social": "Proveedor Duplicado Test",
            "telefono": "912345678",
            "email": "prov_duplicado@test.cl",
        },
        headers=headers,
    )
    assert res_prov.status_code == 400, f"recibido {res_prov.status_code}"

    # 3. Usuario con RUT ya existente
    res_user = requests.post(
        f"{BASE_URL}/usuarios/",
        json={
            "rut": "33.333.333-3",
            "nombre_completo": "Usuario Duplicado Test",
            "puesto": "Operario",
            "departamento": "Campo",
            "telefono": "987654321",
            "email": "user_duplicado@test.cl",
            "rol": "TRABAJADOR",
            "estado": "Activo",
            "contrasena": "Password123456",
        },
        headers=headers,
    )
    assert res_user.status_code == 400, f"recibido {res_user.status_code}"

    # 4. Producto con código ya existente
    res_prod = requests.post(
        f"{BASE_URL}/productos/",
        json={
            "codigo": "AGR-008",
            "nombre": "Producto Duplicado Test",
            "unidad_medida": "kg",
            "stock_minimo": 5,
        },
        headers=headers,
    )
    assert res_prod.status_code == 400, f"recibido {res_prod.status_code}"

    # 5. Confirmar que el total de registros en BD se mantuvo intacto
    assert _contar_registros(requests.get(f"{BASE_URL}/proveedores/", headers=headers).json()) == prov_antes
    assert _contar_registros(requests.get(f"{BASE_URL}/usuarios/", headers=headers).json()) == user_antes
    assert _contar_registros(requests.get(f"{BASE_URL}/productos/", headers=headers).json()) == prod_antes