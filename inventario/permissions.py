from rest_framework.permissions import BasePermission, SAFE_METHODS

from .servicios import es_admin, esta_activo


class UsuarioActivo(BasePermission):
    def has_permission(self, request, view):
        usuario = request.user
        return usuario.is_authenticated and esta_activo(usuario)


class SoloAdministradores(UsuarioActivo):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and es_admin(request.user)


class AdministradorEscritura(UsuarioActivo):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and (
            request.method in SAFE_METHODS or es_admin(request.user)
        )
