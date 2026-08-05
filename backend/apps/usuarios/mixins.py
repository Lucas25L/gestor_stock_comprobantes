from django.conf import settings


class SetRefreshCookieMixin:
    """Mueve el refresh token del body de la respuesta a una cookie httpOnly."""

    def finalize_response(self, request, response, *args, **kwargs):
        if response.data.get('refresh'):
            response.set_cookie(
                key=settings.REFRESH_TOKEN_COOKIE_NAME,
                value=response.data['refresh'],
                max_age=settings.REFRESH_TOKEN_COOKIE_MAX_AGE,
                httponly=settings.REFRESH_TOKEN_COOKIE_HTTPONLY,
                secure=settings.REFRESH_TOKEN_COOKIE_SECURE,
                samesite=settings.REFRESH_TOKEN_COOKIE_SAMESITE,
            )
            del response.data['refresh']

        return super().finalize_response(request, response, *args, **kwargs)