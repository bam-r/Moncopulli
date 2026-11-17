import hashlib

from django.utils import timezone
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from .models import ApiToken


class ApiTokenAuthentication(BaseAuthentication):
    def authenticate(self, request):
        authorization = request.headers.get("Authorization", "")
        scheme, separator, token = authorization.partition(" ")
        if not separator or scheme.lower() != "bearer":
            return None

        digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
        api_token = ApiToken.objects.select_related("usuario").filter(digest=digest).first()
        if (
            api_token is None
            or api_token.revocado_en is not None
            or api_token.expira_en <= timezone.now()
            or not api_token.usuario.estado.lower().startswith("activ")
        ):
            raise AuthenticationFailed("La sesión no es válida o expiró.")
        return api_token.usuario, api_token

    def authenticate_header(self, request):
        return "Bearer"
