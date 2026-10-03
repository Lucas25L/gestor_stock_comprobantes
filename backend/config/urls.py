from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

from apps.usuarios.views import (
    CustomTokenObtainPairView,
    CustomTokenRefreshView,
    LogoutView,
)

urlpatterns = [
    
    # Habilita el panel administrativo de Django
    path('admin/', admin.site.urls),
    
    # endpoints relacionados con autenticación
    path('api/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
    path('api/logout/', LogoutView.as_view(), name='logout'),
    
    #Acá delegás las rutas de tu aplicación al archivo api_router.py.
    path('api/', include('config.api_router')),

    # Documentación de la API
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]
