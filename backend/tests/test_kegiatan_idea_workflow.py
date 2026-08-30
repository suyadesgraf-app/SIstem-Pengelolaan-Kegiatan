import os
import uuid

import pytest


# Auth module checks: login, cookie flags, /me endpoint
def test_login_pic_success_sets_http_only_cookies(api_client, base_url):
    response = api_client.post(
        f"{base_url}/api/auth/login",
        json={"email": "pic@baznas.id", "password": "pic12345"},
        timeout=30,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["email"] == "pic@baznas.id"
    assert data["user"]["role"] == "pic"
    assert isinstance(data["access_token"], str) and len(data["access_token"]) > 20

    set_cookie = response.headers.get("set-cookie", "")
    assert "access_token=" in set_cookie
    assert "refresh_token=" in set_cookie
    assert "HttpOnly" in set_cookie


def test_auth_me_works_with_cookie_session(api_client, base_url):
    login = api_client.post(
        f"{base_url}/api/auth/login",
        json={"email": "pic@baznas.id", "password": "pic12345"},
        timeout=30,
    )
    assert login.status_code == 200

    me = api_client.get(f"{base_url}/api/auth/me", timeout=30)
    assert me.status_code == 200
    user = me.json()
    assert user["email"] == "pic@baznas.id"
    assert user["role"] == "pic"


def test_bruteforce_lockout_after_five_failed_attempts(api_client, base_url):
    email = f"lock-{uuid.uuid4().hex[:10]}@baznas.id"

    for _ in range(5):
        failed = api_client.post(
            f"{base_url}/api/auth/login",
            json={"email": email, "password": "salah"},
            timeout=30,
        )
        assert failed.status_code == 401

    blocked = api_client.post(
        f"{base_url}/api/auth/login",
        json={"email": email, "password": "salah"},
        timeout=30,
    )
    assert blocked.status_code == 429
    assert "15 menit" in blocked.json().get("detail", "")


# Ide kegiatan module checks: chat AI, session_id persistence, draft save/submit, progress activation
def test_idea_workflow_chat_save_submit_and_progress(api_client, base_url):
    login = api_client.post(
        f"{base_url}/api/auth/login",
        json={"email": "pic@baznas.id", "password": "pic12345"},
        timeout=30,
    )
    assert login.status_code == 200

    projects = api_client.get(f"{base_url}/api/projects", timeout=30)
    assert projects.status_code == 200
    projects_data = projects.json()
    assert isinstance(projects_data, list) and len(projects_data) > 0
    project = projects_data[0]
    pid = project["id"]

    existing = api_client.get(f"{base_url}/api/projects/{pid}/idea", timeout=30)
    assert existing.status_code == 200
    existing_data = existing.json()
    assert isinstance(existing_data.get("draft"), dict)
    assert isinstance(existing_data.get("messages"), list)

    session_id = existing_data.get("session_id") or str(uuid.uuid4())
    chat = api_client.post(
        f"{base_url}/api/projects/{pid}/idea/chat",
        json={
            "message": "Buat ide kegiatan kesehatan untuk dhuafa di Jakarta Selatan",
            "session_id": session_id,
            "provider": "gemini",
            "draft": existing_data.get("draft", {}),
        },
        timeout=120,
    )
    assert chat.status_code == 200
    chat_data = chat.json()
    assert isinstance(chat_data.get("reply"), str) and len(chat_data["reply"].strip()) > 0
    assert isinstance(chat_data.get("session_id"), str) and len(chat_data["session_id"]) > 0
    assert isinstance(chat_data.get("draft"), dict)
    assert isinstance(chat_data.get("messages"), list) and len(chat_data["messages"]) >= 2

    saved = api_client.put(
        f"{base_url}/api/projects/{pid}/idea/draft",
        json={
            "session_id": chat_data["session_id"],
            "draft": {
                **chat_data["draft"],
                "title": "TEST_Ide Kesehatan Mobile",
                "goal": "Meningkatkan akses layanan kesehatan warga dhuafa",
                "rab_notes": "Obat dasar, transport, konsumsi tim",
            },
        },
        timeout=30,
    )
    assert saved.status_code == 200
    saved_data = saved.json()
    assert saved_data["draft"]["title"] == "TEST_Ide Kesehatan Mobile"
    assert saved_data["draft"]["goal"] == "Meningkatkan akses layanan kesehatan warga dhuafa"

    submitted = api_client.post(
        f"{base_url}/api/projects/{pid}/idea/submit",
        json={
            "session_id": chat_data["session_id"],
            "draft": saved_data["draft"],
        },
        timeout=30,
    )
    assert submitted.status_code == 200
    submitted_data = submitted.json()
    assert submitted_data["status"] == "submitted"
    assert submitted_data["draft"]["title"] == "TEST_Ide Kesehatan Mobile"

    after = api_client.get(f"{base_url}/api/projects/{pid}/idea", timeout=30)
    assert after.status_code == 200
    after_data = after.json()
    assert after_data["status"] == "submitted"
    assert after_data["session_id"] == chat_data["session_id"]
    assert len(after_data["messages"]) >= 2

    projects_after = api_client.get(f"{base_url}/api/projects", timeout=30)
    assert projects_after.status_code == 200
    same_project = next((p for p in projects_after.json() if p["id"] == pid), None)
    assert same_project is not None
    assert same_project.get("progress", {}).get("idea", 0) > 0


# Legacy tabs backend endpoints: RAB/KAK/Keuangan/Laporan should still respond
def test_legacy_tab_endpoints_open_without_500(api_client, base_url):
    login = api_client.post(
        f"{base_url}/api/auth/login",
        json={"email": "pic@baznas.id", "password": "pic12345"},
        timeout=30,
    )
    assert login.status_code == 200

    projects = api_client.get(f"{base_url}/api/projects", timeout=30)
    assert projects.status_code == 200
    pid = projects.json()[0]["id"]

    rab = api_client.get(f"{base_url}/api/rab?project_id={pid}", timeout=30)
    assert rab.status_code == 200
    assert isinstance(rab.json(), list)

    kaks = api_client.get(f"{base_url}/api/projects/{pid}/kaks", timeout=30)
    assert kaks.status_code == 200
    assert isinstance(kaks.json(), list)

    realisasi = api_client.get(f"{base_url}/api/realisasi?project_id={pid}", timeout=30)
    assert realisasi.status_code == 200
    assert isinstance(realisasi.json(), list)

    reports = api_client.get(f"{base_url}/api/projects/{pid}/reports", timeout=30)
    assert reports.status_code == 200
    assert isinstance(reports.json(), list)


# Optional auth playbook DB verification: bcrypt prefix format check
def test_seeded_password_hash_uses_bcrypt_2b_prefix():
    pymongo = pytest.importorskip("pymongo")
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        pytest.skip("MONGO_URL or DB_NAME not set")

    client = pymongo.MongoClient(mongo_url)
    user = client[db_name].users.find_one({"email": "superadmin@baznas.id"})
    assert user is not None
    assert isinstance(user.get("password_hash"), str)
    assert user["password_hash"].startswith("$2b$")
