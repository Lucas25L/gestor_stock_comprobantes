from django.conf import settings
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .mixins import SetRefreshCookieMixin
from .serializers import (
    CookieTokenRefreshSerializer,
    CustomTokenObtainPairSerializer,
    LogoutSerializer,
)


class CustomTokenObtainPairView(SetRefreshCookieMixin, TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class CustomTokenRefreshView(SetRefreshCookieMixin, TokenRefreshView):
    serializer_class = CookieTokenRefreshSerializer


class LogoutView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        serializer = LogoutSerializer(data={}, context={'request': request})
        serializer.is_valid(raise_exception=True)

        response = Response(status=status.HTTP_205_RESET_CONTENT)
        response.delete_cookie(settings.REFRESH_TOKEN_COOKIE_NAME)
        return response