def test_health():
    from main import app
    assert app.title == "Sample API"
