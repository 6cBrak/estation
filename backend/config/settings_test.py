from config.settings import *  # noqa: F401, F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

# Désactiver argon2 pour les tests (plus rapide)
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
