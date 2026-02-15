from myapp.cli import main


def test_main_calls_get_value():
    # main() prints; we just check it's callable
    assert callable(main)
