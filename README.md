# Moncopulli
Software de gestión de stock para predio Moncopulli (Agrícola Moncopulli S.A.).

- **Backend:** Django + Django REST Framework + PostgreSQL (`docker compose up -d`).
- **Frontend:** React + Vite (PWA) en `frontend/`.


Configuración local (PowerShell; usar valores locales propios):

```powershell
$env:DB_PASSWORD = "contraseña-local"
$env:DJANGO_DEBUG = "true"
$env:DJANGO_SECRET_KEY = "clave-local-no-productiva"
docker compose up -d
python manage.py migrate
python manage.py runserver
```

