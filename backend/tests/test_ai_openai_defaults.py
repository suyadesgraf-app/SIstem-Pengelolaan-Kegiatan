import os


# AI integration checks: default provider routing + OpenAI quota error mapping + key secrecy
TINY_VALID_PNG_BASE64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2pF9sAAAAASUVORK5CYII="
)


def _login_pic(api_client, base_url):
    response = api_client.post(
        f"{base_url}/api/auth/login",
        json={"email": "pic@baznas.id", "password": "pic12345"},
        timeout=30,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["email"] == "pic@baznas.id"


def _assert_no_api_key_leak(payload_text: str):
    openai_key = os.environ.get("OPENAI_API_KEY")
    if openai_key:
        assert openai_key not in payload_text
    assert "sk-proj-" not in payload_text
    assert "OPENAI_API_KEY" not in payload_text


def test_ai_kak_without_provider_defaults_to_openai_and_returns_402_when_no_credits(api_client, base_url):
    _login_pic(api_client, base_url)
    response = api_client.post(
        f"{base_url}/api/ai/kak",
        json={"raw_text": "Program bantuan sembako untuk 200 mustahik di Jakarta Timur"},
        timeout=120,
    )

    assert response.status_code == 402
    data = response.json()
    detail = str(data.get("detail", ""))
    assert "OpenAI" in detail
    assert "billing" in detail.lower() or "kuota" in detail.lower()
    _assert_no_api_key_leak(str(data))


def test_ai_ocr_without_provider_defaults_to_openai_mini_and_returns_402_when_no_credits(api_client, base_url):
    _login_pic(api_client, base_url)
    response = api_client.post(
        f"{base_url}/api/ai/ocr",
        json={"image_base64": TINY_VALID_PNG_BASE64},
        timeout=120,
    )

    assert response.status_code == 402
    data = response.json()
    detail = str(data.get("detail", ""))
    assert "OpenAI" in detail
    assert "billing" in detail.lower() or "kuota" in detail.lower()
    _assert_no_api_key_leak(str(data))


# Security/auth transport checks related to AI key secrecy and frontend calls
def test_cors_credentials_enabled_with_explicit_origin_not_wildcard(api_client, base_url):
    origin = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
    response = api_client.options(
        f"{base_url}/api/auth/login",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
        timeout=30,
    )

    assert response.status_code in (200, 204)
    assert response.headers.get("access-control-allow-credentials") == "true"
    allow_origin = response.headers.get("access-control-allow-origin", "")
    assert allow_origin and allow_origin != "*"
