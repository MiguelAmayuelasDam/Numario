"""Tests de la política de robustez de contraseñas."""

from app.core.password_policy import validate_password


def test_strong_password_passes() -> None:
    assert validate_password("Str0ng!Pass") == []


def test_too_short() -> None:
    errors = validate_password("Ab1!x")
    assert any("8 caracteres" in e for e in errors)


def test_requires_each_character_class() -> None:
    assert any("mayúscula" in e for e in validate_password("lowercase1!"))
    assert any("minúscula" in e for e in validate_password("UPPERCASE1!"))
    assert any("número" in e for e in validate_password("NoDigits!"))
    assert any("símbolo" in e for e in validate_password("NoSymbol1"))


def test_rejects_common_password() -> None:
    assert any("común" in e for e in validate_password("password123"))


def test_rejects_password_containing_nickname() -> None:
    errors = validate_password("Miguel123!", nickname="miguel")
    assert any("nick" in e for e in errors)


def test_rejects_password_containing_email_local_part() -> None:
    errors = validate_password("Carlos123!", email="carlos@mail.com")
    assert any("email" in e for e in errors)
