from rest_framework.permissions import BasePermission


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.is_authenticated and request.user.role == "super_admin")


class IsManager(BasePermission):
    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in ("super_admin", "manager")
        )


class IsCashier(BasePermission):
    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in ("super_admin", "manager", "cashier")
        )


class IsManagerOrAdmin(BasePermission):
    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in ("super_admin", "manager")
        )


class StationFilterMixin:
    """Filtre automatique des querysets par station de l'utilisateur connecté."""

    def filter_by_station(self, queryset):
        user = self.request.user
        if user.role == "super_admin":
            station_id = self.request.query_params.get("station")
            if station_id:
                return queryset.filter(station_id=station_id)
            return queryset
        if user.station_id:
            return queryset.filter(station_id=user.station_id)
        return queryset.none()

    # Alias conservé pour compatibilité
    def get_station_queryset(self, queryset):
        return self.filter_by_station(queryset)
