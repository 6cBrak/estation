from rest_framework import serializers
from .models import LubricantBrand, LubricantProduct, LubricantStock


class LubricantBrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = LubricantBrand
        fields = ["id", "name"]


class LubricantProductSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source="brand.name", read_only=True)

    class Meta:
        model = LubricantProduct
        fields = [
            "id", "brand", "brand_name", "code", "name", "grade", "packaging",
            "sale_price_boutique_xof", "sale_price_piste_xof", "is_active",
        ]
        read_only_fields = ["id"]


class LubricantStockSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    brand_name = serializers.CharField(source="product.brand.name", read_only=True)
    grade = serializers.CharField(source="product.grade", read_only=True)
    sale_price_boutique_xof = serializers.DecimalField(
        source="product.sale_price_boutique_xof", max_digits=10, decimal_places=2, read_only=True
    )
    sale_price_piste_xof = serializers.DecimalField(
        source="product.sale_price_piste_xof", max_digits=10, decimal_places=2, read_only=True
    )
    station_name = serializers.CharField(source="station.name", read_only=True)

    class Meta:
        model = LubricantStock
        fields = [
            "id", "product", "product_name", "brand_name", "grade",
            "sale_price_boutique_xof", "sale_price_piste_xof",
            "station", "station_name", "quantity",
        ]
        read_only_fields = ["id"]
