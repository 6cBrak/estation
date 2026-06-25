import pytest


@pytest.fixture
def api_client():
    from rest_framework.test import APIClient
    return APIClient()


@pytest.fixture
def station(db):
    from apps.stations.models import Station
    return Station.objects.create(
        code="ST01",
        name="Station Test",
        address="123 Rue Test",
        city="Ouagadougou",
        gauge_tolerance_pct="2.00",
        cash_tolerance_xof="5000",
    )


@pytest.fixture
def admin_user(db):
    from apps.accounts.models import User
    return User.objects.create_user(
        username="admin",
        password="admin123",
        role="super_admin",
        first_name="Admin",
        last_name="Test",
    )


@pytest.fixture
def manager_user(db, station):
    from apps.accounts.models import User
    return User.objects.create_user(
        username="manager",
        password="manager123",
        role="manager",
        station=station,
        first_name="Manager",
        last_name="Test",
    )


@pytest.fixture
def auth_client(api_client, admin_user):
    from rest_framework_simplejwt.tokens import RefreshToken
    token = RefreshToken.for_user(admin_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return api_client


@pytest.fixture
def manager_client(api_client, manager_user):
    from rest_framework_simplejwt.tokens import RefreshToken
    token = RefreshToken.for_user(manager_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return api_client
