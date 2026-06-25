import pytest
from django.urls import reverse


@pytest.mark.django_db
class TestAuth:
    def test_login_success(self, api_client, admin_user):
        res = api_client.post("/api/v1/auth/login/", {
            "username": "admin",
            "password": "admin123",
        })
        assert res.status_code == 200
        assert "access" in res.data
        assert "refresh" in res.data

    def test_login_wrong_password(self, api_client, admin_user):
        res = api_client.post("/api/v1/auth/login/", {
            "username": "admin",
            "password": "wrong",
        })
        assert res.status_code == 401

    def test_me_authenticated(self, auth_client, admin_user):
        res = auth_client.get("/api/v1/auth/users/me/")
        assert res.status_code == 200
        assert res.data["username"] == "admin"
        assert res.data["role"] == "super_admin"

    def test_me_unauthenticated(self, api_client):
        res = api_client.get("/api/v1/auth/users/me/")
        assert res.status_code == 401

    def test_list_users_admin(self, auth_client):
        res = auth_client.get("/api/v1/auth/users/")
        assert res.status_code == 200

    def test_list_users_unauthenticated(self, api_client):
        res = api_client.get("/api/v1/auth/users/")
        assert res.status_code == 401

    def test_create_user(self, auth_client, station):
        res = auth_client.post("/api/v1/auth/users/", {
            "username": "newuser",
            "password": "pass1234",
            "first_name": "Nouveau",
            "last_name": "User",
            "role": "cashier",
            "station": str(station.id),
        })
        assert res.status_code == 201
        assert res.data["username"] == "newuser"
