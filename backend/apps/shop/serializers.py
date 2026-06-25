from rest_framework import serializers
from .models import ProductCategory, Product, ProductStock


class ProductCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductCategory
        fields = ["id", "name"]


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = Product
        fields = [
            "id", "category", "category_name", "code", "barcode", "name",
            "purchase_price_xof", "sale_price_xof", "vat_rate", "is_active",
        ]
        read_only_fields = ["id"]


class ProductStockSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_code = serializers.CharField(source="product.code", read_only=True)
    barcode = serializers.CharField(source="product.barcode", read_only=True)
    sale_price_xof = serializers.DecimalField(
        source="product.sale_price_xof", max_digits=10, decimal_places=2, read_only=True
    )
    station_name = serializers.CharField(source="station.name", read_only=True)
    is_low = serializers.BooleanField(read_only=True)

    class Meta:
        model = ProductStock
        fields = [
            "id", "product", "product_name", "product_code", "barcode",
            "sale_price_xof", "station", "station_name",
            "quantity", "low_threshold", "is_low",
        ]
        read_only_fields = ["id"]
