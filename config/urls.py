from django.contrib import admin
from django.urls import path, include
from inventario.views import LoginTemplateView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('inventario.urls')), 
    path('', LoginTemplateView.as_view(), name='login_view'),
]