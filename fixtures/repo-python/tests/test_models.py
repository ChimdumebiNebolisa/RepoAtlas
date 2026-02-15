from myapp.models import get_value


def test_get_value():
    assert get_value(1) == 3
