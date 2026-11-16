from django.contrib import admin

from .models import StockBodega


@admin.register(StockBodega)
class StockBodegaAdmin(admin.ModelAdmin):
    """Solo lectura: el stock cambia con compras, consumos e inventarios, no a mano."""

    list_display = ("producto", "bodega", "cantidad")
    list_filter = ("bodega",)
    search_fields = ("producto__nombre", "producto__codigo")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
