from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from apps.core.permissions import IsSuperAdmin, IsManager
from .models import User
from .serializers import UserSerializer, UserCreateSerializer, ChangePasswordSerializer


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.filter(is_active=True).select_related("station")
    serializer_class = UserSerializer

    def get_permissions(self):
        if self.action in ("create", "destroy"):
            return [IsSuperAdmin()]
        if self.action in ("list", "retrieve", "update", "partial_update"):
            return [IsManager()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        return UserSerializer

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if user.role == "super_admin":
            return qs
        if user.station_id:
            return qs.filter(station_id=user.station_id)
        return qs.none()

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def me(self, request: Request) -> Response:
        return Response(UserSerializer(request.user).data)

    @action(detail=False, methods=["post"], permission_classes=[IsAuthenticated])
    def change_password(self, request: Request) -> Response:
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(serializer.validated_data["old_password"]):
            return Response({"detail": "Ancien mot de passe incorrect."}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(serializer.validated_data["new_password"])
        user.save()
        return Response({"detail": "Mot de passe modifié avec succès."})
