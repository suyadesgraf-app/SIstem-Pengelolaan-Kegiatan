from dotenv import load_dotenv
load_dotenv()

import os
import re
import io
import json
import uuid
import base64
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Any, Dict, List

import bcrypt
import jwt
import requests
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent, TextDelta, StreamDone

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

app = FastAPI()
api = APIRouter(prefix="/api")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------- Auth ----------

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "type": "access",
               "exp": datetime.now(timezone.utc) + timedelta(hours=12)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "type": "refresh",
               "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def login_attempt_identifier(email: str) -> str:
    return f"login:{email}"


async def get_current_user(request: Request):
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "Sesi berakhir, silakan masuk kembali")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(401, "Token tidak valid")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "Pengguna tidak ditemukan")
    if user.get("is_active") is False:
        raise HTTPException(403, "Akun dinonaktifkan. Hubungi admin Anda.")
    return user


class LoginIn(BaseModel):
    email: str
    password: str


@api.post("/auth/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.lower().strip()
    identifier = login_attempt_identifier(email)
    att = await db.login_attempts.find_one({"identifier": identifier})
    if att and att.get("count", 0) >= 5:
        try:
            last = datetime.fromisoformat(att.get("last", ""))
            if (datetime.now(timezone.utc) - last).total_seconds() < 900:
                raise HTTPException(429, "Terlalu banyak percobaan. Coba lagi dalam 15 menit.")
        except ValueError:
            pass
    user = await db.users.find_one({"email": email})
    if user and user.get("is_active") is False:
        raise HTTPException(403, "Akun dinonaktifkan. Hubungi admin Anda.")
    if not user or not verify_password(body.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1}, "$set": {"last": datetime.now(timezone.utc).isoformat()}},
            upsert=True)
        raise HTTPException(401, "Email atau kata sandi salah")
    await db.login_attempts.delete_one({"identifier": identifier})
    access = create_access_token(user["id"], email)
    refresh = create_refresh_token(user["id"])
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=43200, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=604800, path="/")
    return {"user": {k: user[k] for k in ("id", "email", "name", "role")}, "access_token": access}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user


# ---------- User Management (Super Admin -> PIC -> Relawan) ----------

class UserIn(BaseModel):
    name: str
    email: str
    password: str


@api.post("/users")
async def create_user(body: UserIn, user=Depends(get_current_user)):
    if user["role"] == "superadmin":
        role, pic_id = "pic", None
    elif user["role"] == "pic":
        role, pic_id = "relawan", user["id"]
    else:
        raise HTTPException(403, "Relawan tidak dapat membuat akun")
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "Email sudah terdaftar")
    if len(body.password) < 6:
        raise HTTPException(400, "Kata sandi minimal 6 karakter")
    doc = {"id": str(uuid.uuid4()), "email": email, "name": body.name, "role": role,
           "pic_id": pic_id, "password_hash": hash_password(body.password),
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.users.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("_id", "password_hash")}


@api.get("/users")
async def list_users(user=Depends(get_current_user)):
    if user["role"] == "superadmin":
        query = {"role": {"$in": ["pic", "relawan"]}}
    elif user["role"] == "pic":
        query = {"pic_id": user["id"]}
    else:
        raise HTTPException(403, "Tidak diizinkan")
    return await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(500)


@api.post("/users/{uid}/toggle-active")
async def toggle_user_active(uid: str, user=Depends(get_current_user)):
    target = await db.users.find_one({"id": uid})
    if not target:
        raise HTTPException(404, "Akun tidak ditemukan")
    allowed = (user["role"] == "superadmin" and target["role"] in ("pic", "relawan")) or \
              (user["role"] == "pic" and target.get("pic_id") == user["id"])
    if not allowed:
        raise HTTPException(403, "Anda tidak berhak mengubah akun ini")
    new_state = not target.get("is_active", True)
    await db.users.update_one({"id": uid}, {"$set": {"is_active": new_state}})
    return {"is_active": new_state}


# ---------- Notifikasi ----------

@api.get("/notifications")
async def list_notifications(user=Depends(get_current_user)):
    return await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)


@api.post("/notifications/read-all")
async def read_all_notifications(user=Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}


# ---------- Projects & Dashboard ----------

@api.get("/")
async def root():
    return {"message": "Sistem Integrasi Pengelolaan Kegiatan BAZNAS DKI"}


TINTS = [
    {"bg": "#fde68a", "fg": "#b45309"},
    {"bg": "#dcfce7", "fg": "#047857"},
    {"bg": "#bae6fd", "fg": "#0369a1"},
    {"bg": "#f3e8ff", "fg": "#7e22ce"},
    {"bg": "#fee2e2", "fg": "#b91c1c"},
]


@api.get("/projects")
async def list_projects(user=Depends(get_current_user)):
    if user["role"] == "pic":
        query = {"created_by": user["id"]}
    elif user["role"] == "relawan":
        query = {"created_by": user.get("pic_id") or "__none__"}
    else:
        query = {}
    projects = await db.projects.find(query, {"_id": 0}).to_list(200)
    creator_map = {}
    if user["role"] == "superadmin" and projects:
        creator_ids = list({p.get("created_by") for p in projects if p.get("created_by")})
        creators = await db.users.find(
            {"id": {"$in": creator_ids}},
            {"_id": 0, "id": 1, "name": 1, "email": 1, "role": 1},
        ).to_list(500)
        creator_map = {c["id"]: c for c in creators}
    for p in projects:
        if user["role"] == "superadmin":
            creator = creator_map.get(p.get("created_by"))
            p["created_by_name"] = creator.get("name") if creator else "Tidak diketahui"
            p["created_by_email"] = creator.get("email") if creator else ""
        p["progress"] = {
            "idea": await db.activity_ideas.count_documents({"project_id": p["id"], "status": "submitted"}),
            "kak": await db.kaks.count_documents({"project_id": p["id"]}),
            "rab": await db.rab_items.count_documents({"project_id": p["id"]}),
            "keuangan": await db.realisasi.count_documents({"project_id": p["id"]}),
            "laporan": await db.reports.count_documents({"project_id": p["id"]}),
        }
    return projects


class ProjectIn(BaseModel):
    name: str
    loc: str = ""
    date: str = ""
    plafon: int = 0


class ProjectIndexIn(BaseModel):
    nomor_indeks: str


@api.post("/projects")
async def create_project(body: ProjectIn, user=Depends(get_current_user)):
    if user["role"] == "relawan":
        raise HTTPException(403, "Relawan tidak dapat membuat kegiatan")
    count = await db.projects.count_documents({})
    tint = TINTS[count % len(TINTS)]
    doc = {"id": str(uuid.uuid4()), "nomor_indeks": "",
           "name": body.name, "loc": body.loc, "date": body.date,
           "plafon": body.plafon, "realisasi": 0, "slaDays": 0, "status": "Perencanaan",
           "tint": {**tint, "ini": body.name[:2].upper()}, "created_by": user["id"],
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.projects.insert_one(doc)
    if user["role"] == "pic":
        relawans = await db.users.find({"pic_id": user["id"], "role": "relawan", "is_active": {"$ne": False}}).to_list(500)
        if relawans:
            await db.notifications.insert_many([
                {"id": str(uuid.uuid4()), "user_id": r["id"],
                 "message": f"Kegiatan baru: {doc['name']}"
                            + (f" di {doc['loc']}." if doc['loc'] else ".")
                            + " Anda dapat mulai input laporan nota.",
                 "read": False, "created_at": datetime.now(timezone.utc).isoformat()}
                for r in relawans])
    doc.pop("_id", None)
    return doc


async def ensure_project_access(pid: str, user: dict):
    project = await db.projects.find_one({"id": pid}, {"_id": 0})
    if not project:
        raise HTTPException(404, "Kegiatan tidak ditemukan")
    allowed = user["role"] == "superadmin" or project.get("created_by") == user["id"]
    if not allowed:
        raise HTTPException(403, "Anda tidak berhak mengakses kegiatan ini")
    return project


def normalize_nomor_indeks(value: str) -> str:
    nomor = (value or "").strip()
    if not nomor:
        raise HTTPException(400, "Nomor indeks wajib diisi saat membuat laporan kegiatan")
    if len(nomor) > 80:
        raise HTTPException(400, "Nomor indeks maksimal 80 karakter")
    return nomor


async def set_project_nomor_indeks(pid: str, nomor_indeks: str, user: dict):
    project = await ensure_project_access(pid, user)
    nomor = normalize_nomor_indeks(nomor_indeks)
    duplicate = await db.projects.find_one({"nomor_indeks": nomor, "id": {"$ne": pid}}, {"_id": 0, "id": 1})
    if duplicate:
        raise HTTPException(409, "Nomor indeks sudah digunakan kegiatan lain")
    old_nomor = project.get("nomor_indeks") or ""
    now = datetime.now(timezone.utc).isoformat()
    await db.projects.update_one({"id": pid}, {"$set": {
        "nomor_indeks": nomor,
        "nomor_indeks_updated_by": user["id"],
        "nomor_indeks_updated_at": now,
    }})
    if old_nomor and old_nomor != nomor:
        await db.files.update_many({"ref": old_nomor}, {"$set": {"ref": nomor}})
        await db.reports.update_many({"project_id": pid}, {"$set": {"nomor_indeks": nomor}})
    updated = await db.projects.find_one({"id": pid}, {"_id": 0})
    return updated


@api.put("/projects/{pid}/nomor-indeks")
async def update_project_nomor_indeks(pid: str, body: ProjectIndexIn, user=Depends(get_current_user)):
    if user["role"] == "relawan":
        raise HTTPException(403, "Relawan tidak dapat mengubah nomor indeks")
    return await set_project_nomor_indeks(pid, body.nomor_indeks, user)


@api.delete("/projects/{pid}")
async def delete_project(pid: str, user=Depends(get_current_user)):
    if user["role"] not in ("superadmin", "pic"):
        raise HTTPException(403, "Hanya PIC/Admin atau Super Admin yang dapat menghapus kegiatan")
    project = await ensure_project_access(pid, user)
    deleted = {
        "projects": (await db.projects.delete_one({"id": pid})).deleted_count,
        "activity_ideas": (await db.activity_ideas.delete_many({"project_id": pid})).deleted_count,
        "rab_items": (await db.rab_items.delete_many({"project_id": pid})).deleted_count,
        "kaks": (await db.kaks.delete_many({"project_id": pid})).deleted_count,
        "reports": (await db.reports.delete_many({"project_id": pid})).deleted_count,
        "realisasi": (await db.realisasi.delete_many({"project_id": pid})).deleted_count,
    }
    file_refs = [ref for ref in [pid, project.get("nomor_indeks")] if ref]
    files_res = await db.files.update_many(
        {"ref": {"$in": file_refs}, "is_deleted": False},
        {"$set": {"is_deleted": True, "deleted_by": user["id"], "deleted_at": datetime.now(timezone.utc).isoformat()}},
    )
    deleted["files"] = files_res.modified_count
    return {"ok": True, "deleted": deleted, "project_id": pid}


IDEA_DRAFT_FIELDS = {
    "title": "",
    "background": "",
    "goal": "",
    "beneficiaries": "",
    "location": "",
    "schedule": "",
    "activity_format": "",
    "budget_outline": "",
    "rab_notes": "",
    "kak_notes": "",
}


def normalize_idea_draft(draft: Optional[Dict[str, Any]] = None) -> Dict[str, str]:
    source = draft or {}
    return {k: str(source.get(k, "") or "")[:3000] for k in IDEA_DRAFT_FIELDS}


def idea_to_prompt(draft: Dict[str, str]) -> str:
    labels = {
        "title": "Judul",
        "background": "Latar Belakang",
        "goal": "Tujuan",
        "beneficiaries": "Sasaran/Penerima Manfaat",
        "location": "Lokasi",
        "schedule": "Waktu",
        "activity_format": "Bentuk Kegiatan",
        "budget_outline": "Gambaran Anggaran",
        "rab_notes": "Catatan RAB",
        "kak_notes": "Catatan KAK",
    }
    return "\n".join([f"{labels[k]}: {draft.get(k) or '-'}" for k in IDEA_DRAFT_FIELDS])


@api.get("/projects/{pid}/idea")
async def get_activity_idea(pid: str, user=Depends(get_current_user)):
    await ensure_project_access(pid, user)
    idea = await db.activity_ideas.find_one({"project_id": pid}, {"_id": 0})
    if not idea:
        return {"project_id": pid, "status": "draft", "draft": normalize_idea_draft(), "messages": []}
    idea["draft"] = normalize_idea_draft(idea.get("draft"))
    idea["messages"] = idea.get("messages", [])[-80:]
    return idea


class IdeaDraftIn(BaseModel):
    session_id: str = ""
    draft: Dict[str, Any] = {}


@api.put("/projects/{pid}/idea/draft")
async def save_activity_idea(pid: str, body: IdeaDraftIn, user=Depends(get_current_user)):
    await ensure_project_access(pid, user)
    now = datetime.now(timezone.utc).isoformat()
    existing = await db.activity_ideas.find_one({"project_id": pid}, {"_id": 0})
    doc_id = existing.get("id") if existing else str(uuid.uuid4())
    session_id = body.session_id or (existing or {}).get("session_id") or str(uuid.uuid4())
    draft = normalize_idea_draft(body.draft)
    update = {"id": doc_id, "project_id": pid, "session_id": session_id, "draft": draft,
              "status": (existing or {}).get("status", "draft"), "updated_by": user["id"], "updated_at": now}
    if not existing:
        update["created_at"] = now
        update["messages"] = []
    await db.activity_ideas.update_one({"project_id": pid}, {"$set": update}, upsert=True)
    return await db.activity_ideas.find_one({"project_id": pid}, {"_id": 0})


@api.post("/projects/{pid}/idea/submit")
async def submit_activity_idea(pid: str, body: IdeaDraftIn, user=Depends(get_current_user)):
    await ensure_project_access(pid, user)
    now = datetime.now(timezone.utc).isoformat()
    draft = normalize_idea_draft(body.draft)
    if not draft.get("title") or not draft.get("goal"):
        raise HTTPException(400, "Judul dan tujuan ide wajib diisi sebelum submit")
    existing = await db.activity_ideas.find_one({"project_id": pid}, {"_id": 0})
    doc_id = existing.get("id") if existing else str(uuid.uuid4())
    session_id = body.session_id or (existing or {}).get("session_id") or str(uuid.uuid4())
    update = {"id": doc_id, "project_id": pid, "session_id": session_id, "draft": draft,
              "status": "submitted", "submitted_by": user["id"], "submitted_at": now, "updated_at": now}
    if not existing:
        update["created_at"] = now
        update["messages"] = []
    await db.activity_ideas.update_one({"project_id": pid}, {"$set": update}, upsert=True)
    return await db.activity_ideas.find_one({"project_id": pid}, {"_id": 0})


@api.get("/dashboard/stats")
async def dashboard_stats(user=Depends(get_current_user)):
    if user["role"] == "pic":
        query = {"created_by": user["id"]}
    elif user["role"] == "relawan":
        query = {"created_by": user.get("pic_id") or "__none__"}
    else:
        query = {}
    projects = await db.projects.find(query, {"_id": 0}).to_list(200)
    total = len(projects) or 1
    tepat = sum(1 for p in projects if p.get("slaDays", 0) == 0)
    mendekati = sum(1 for p in projects if 0 < p.get("slaDays", 0) <= 2)
    terlambat = sum(1 for p in projects if p.get("slaDays", 0) > 2)
    return {
        "totalPlafon": sum(p.get("plafon", 0) for p in projects),
        "totalRealisasi": sum(p.get("realisasi", 0) for p in projects),
        "slaCompliance": round(100 * (tepat + mendekati) / total, 1),
        "totalKegiatan": len(projects),
        "proses": sum(1 for p in projects if p.get("status") == "Menunggu"),
        "selesai": sum(1 for p in projects if p.get("status") in ("Selesai", "Diverifikasi")),
        "slaBuckets": [tepat, mendekati, terlambat],
    }


@api.post("/projects/{pid}/approve")
async def approve_project(pid: str, user=Depends(get_current_user)):
    if user["role"] not in ("superadmin", "pic"):
        raise HTTPException(403, "Hanya Pimpinan/PIC yang dapat mengesahkan")
    res = await db.projects.update_one({"id": pid}, {"$set": {"status": "Diverifikasi", "slaDays": 0}})
    if res.matched_count == 0:
        raise HTTPException(404, "Kegiatan tidak ditemukan")
    project = await db.projects.find_one({"id": pid})
    if project and project.get("created_by") and project["created_by"] != user["id"]:
        index_label = f" ({project.get('nomor_indeks')})" if project.get("nomor_indeks") else ""
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()), "user_id": project["created_by"],
            "message": f"Laporan kegiatan \"{project['name']}\"{index_label} telah DISAHKAN oleh {user['name']}.",
            "read": False, "created_at": datetime.now(timezone.utc).isoformat()})
    return {"ok": True}


class RevisionIn(BaseModel):
    message: str = ""


@api.post("/projects/{pid}/revise")
async def revise_project(pid: str, body: Optional[RevisionIn] = None, user=Depends(get_current_user)):
    if user["role"] not in ("superadmin", "pic"):
        raise HTTPException(403, "Hanya Pimpinan/PIC yang dapat meminta revisi")
    revision_message = (body.message if body else "").strip()
    if len(revision_message) > 1000:
        raise HTTPException(400, "Pesan revisi maksimal 1000 karakter")
    res = await db.projects.update_one({"id": pid}, {"$set": {
        "status": "Perencanaan",
        "slaDays": 0,
        "revision_message": revision_message,
        "revision_requested_by": user["id"],
        "revision_requested_at": datetime.now(timezone.utc).isoformat(),
    }})
    if res.matched_count == 0:
        raise HTTPException(404, "Kegiatan tidak ditemukan")
    project = await db.projects.find_one({"id": pid})
    if project and project.get("created_by") and project["created_by"] != user["id"]:
        note = f" Poin perbaikan: {revision_message}" if revision_message else ""
        index_label = f" ({project.get('nomor_indeks')})" if project.get("nomor_indeks") else ""
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()), "user_id": project["created_by"],
            "message": f"Laporan kegiatan \"{project['name']}\"{index_label} PERLU REVISI.{note} Silakan perbarui dokumen lalu submit ulang.",
            "read": False, "created_at": datetime.now(timezone.utc).isoformat()})
    return {"ok": True}


class SubmitIn(BaseModel):
    nomor_indeks: str
    project_id: Optional[str] = None


@api.post("/projects/submit")
async def submit_report(body: SubmitIn, user=Depends(get_current_user)):
    nomor = normalize_nomor_indeks(body.nomor_indeks)
    if body.project_id:
        project = await set_project_nomor_indeks(body.project_id, nomor, user)
        res = await db.projects.update_one(
            {"id": project["id"]},
            {"$set": {"status": "Menunggu", "slaDays": 2}})
        if res.matched_count == 0:
            raise HTTPException(404, "Kegiatan tidak ditemukan")
        return {"ok": True}
    res = await db.projects.update_one(
        {"nomor_indeks": nomor},
        {"$set": {"status": "Menunggu", "slaDays": 2}})
    if res.matched_count == 0:
        raise HTTPException(404, "Nomor indeks kegiatan tidak ditemukan")
    return {"ok": True}


# ---------- RAB ----------

class RabItemIn(BaseModel):
    kategori: str
    uraian: str
    qty: int = 0
    satuanQty: str = "Pcs"
    frek: int = 1
    satuanFrek: str = "Kali"
    harga: int = 0
    project_id: Optional[str] = None


@api.get("/rab")
async def list_rab(project_id: str = "", user=Depends(get_current_user)):
    query = {"project_id": project_id} if project_id else {}
    return await db.rab_items.find(query, {"_id": 0}).to_list(1000)


@api.post("/rab/items")
async def add_rab(body: RabItemIn, user=Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), **body.model_dump()}
    await db.rab_items.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/rab/items/{item_id}")
async def update_rab(item_id: str, body: RabItemIn, user=Depends(get_current_user)):
    await db.rab_items.update_one({"id": item_id}, {"$set": body.model_dump()})
    doc = await db.rab_items.find_one({"id": item_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Item tidak ditemukan")
    return doc


@api.delete("/rab/items/{item_id}")
async def delete_rab(item_id: str, user=Depends(get_current_user)):
    await db.rab_items.delete_one({"id": item_id})
    return {"ok": True}


# ---------- Realisasi (nota keuangan) ----------

class RealisasiIn(BaseModel):
    tanggal: str
    merchant: str
    nominal: int
    kegiatan: str
    project_id: Optional[str] = None
    nota_image: Optional[str] = None


@api.get("/realisasi")
async def list_realisasi(mine: bool = False, project_id: str = "", user=Depends(get_current_user)):
    query = {}
    if mine or user["role"] == "relawan":
        query["user_id"] = user["id"]
    if project_id:
        query["project_id"] = project_id
    return await db.realisasi.find(query, {"_id": 0, "nota_image": 0}).sort("created_at", -1).to_list(1000)


@api.post("/realisasi")
async def add_realisasi(body: RealisasiIn, user=Depends(get_current_user)):
    nota_path = None
    if body.nota_image:
        try:
            raw = base64.b64decode(body.nota_image.split(",", 1)[-1])
            nota_path = put_object(f"{APP_NAME}/nota/{user['id']}/{uuid.uuid4()}.jpg", raw, "image/jpeg")["path"]
        except Exception as e:
            logger.error(f"nota upload failed: {e}")
    doc = {"id": str(uuid.uuid4()), "tanggal": body.tanggal, "merchant": body.merchant,
           "nominal": body.nominal, "kegiatan": body.kegiatan, "project_id": body.project_id,
           "nota_image": None, "nota_path": nota_path,
           "uploader": user["name"], "user_id": user["id"],
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.realisasi.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("_id", "nota_image")}


@api.put("/realisasi/{rid}")
async def update_realisasi(rid: str, body: RealisasiIn, user=Depends(get_current_user)):
    await db.realisasi.update_one({"id": rid}, {"$set": body.model_dump()})
    doc = await db.realisasi.find_one({"id": rid}, {"_id": 0, "nota_image": 0})
    if not doc:
        raise HTTPException(404, "Data tidak ditemukan")
    return doc


@api.delete("/realisasi/{rid}")
async def delete_realisasi(rid: str, user=Depends(get_current_user)):
    await db.realisasi.delete_one({"id": rid})
    return {"ok": True}


@api.get("/realisasi/{rid}/nota")
async def get_nota(rid: str, user=Depends(get_current_user)):
    doc = await db.realisasi.find_one({"id": rid}, {"_id": 0, "nota_image": 1, "nota_path": 1})
    if not doc:
        raise HTTPException(404, "Nota tidak tersedia")
    if doc.get("nota_path"):
        try:
            data, ct = get_object(doc["nota_path"])
            return {"image": f"data:{ct};base64," + base64.b64encode(data).decode()}
        except Exception as e:
            logger.error(f"nota download failed: {e}")
            raise HTTPException(404, "File nota tidak ditemukan di penyimpanan")
    if doc.get("nota_image"):
        return {"image": doc["nota_image"]}
    raise HTTPException(404, "Nota tidak tersedia")


# ---------- File & Media Storage (lampiran, referensi KAK) ----------

@api.post("/files/upload")
async def upload_file(file: UploadFile = File(...), kind: str = "lampiran", label: str = "",
                      ref: str = "", user=Depends(get_current_user)):
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "bin"
    ct = file.content_type or "application/octet-stream"
    if kind == "idea_chat" and not (ct == "application/pdf" or ct.startswith("image/") or ext == "pdf"):
        raise HTTPException(400, "Lampiran chat hanya mendukung dokumen PDF atau foto")
    data = await file.read()
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(413, "Ukuran file maksimal 15MB")
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4()}.{ext}"
    result = put_object(path, data, ct)
    doc = {"id": str(uuid.uuid4()), "storage_path": result["path"], "original_filename": file.filename,
           "content_type": ct, "size": result.get("size", len(data)), "kind": kind, "label": label,
           "ref": ref, "user_id": user["id"], "is_deleted": False,
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.files.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/files")
async def list_files(ref: str = "", user=Depends(get_current_user)):
    query = {"is_deleted": False}
    if ref:
        query["ref"] = ref
    return await db.files.find(query, {"_id": 0}).to_list(200)


@api.get("/files/{fid}/download")
async def download_file(fid: str, user=Depends(get_current_user)):
    record = await db.files.find_one({"id": fid, "is_deleted": False})
    if not record:
        raise HTTPException(404, "File tidak ditemukan")
    data, ct = get_object(record["storage_path"])
    return Response(content=data, media_type=record.get("content_type", ct),
                    headers={"Content-Disposition": f'inline; filename="{record["original_filename"]}"'})


async def ensure_file_editable(fid: str, user: dict):
    record = await db.files.find_one({"id": fid, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(404, "File tidak ditemukan")
    project = None
    if record.get("ref"):
        project = await db.projects.find_one({"nomor_indeks": record["ref"]}, {"_id": 0})
    allowed = user["role"] == "superadmin" or record.get("user_id") == user["id"]
    if project and user["role"] == "pic" and project.get("created_by") == user["id"]:
        allowed = True
    if not allowed:
        raise HTTPException(403, "Anda tidak berhak mengubah lampiran ini")
    if project and project.get("status") != "Perencanaan":
        raise HTTPException(409, "Lampiran hanya bisa diubah sebelum laporan disubmit")
    return record


@api.delete("/files/{fid}")
async def delete_file(fid: str, user=Depends(get_current_user)):
    await ensure_file_editable(fid, user)
    await db.files.update_one({"id": fid}, {"$set": {
        "is_deleted": True,
        "deleted_by": user["id"],
        "deleted_at": datetime.now(timezone.utc).isoformat(),
    }})
    return {"ok": True}


@api.put("/files/{fid}/replace")
async def replace_file(fid: str, file: UploadFile = File(...), user=Depends(get_current_user)):
    await ensure_file_editable(fid, user)
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "bin"
    ct = file.content_type or "application/octet-stream"
    data = await file.read()
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(413, "Ukuran file maksimal 15MB")
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4()}.{ext}"
    result = put_object(path, data, ct)
    await db.files.update_one({"id": fid}, {"$set": {
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": ct,
        "size": result.get("size", len(data)),
        "updated_by": user["id"],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }})
    return await db.files.find_one({"id": fid}, {"_id": 0})


# ---------- AI (LLM) ----------

MODEL_MAP = {
    "openai": {"doc": "gpt-5.4", "ocr": "gpt-5.4-mini"},
    "gemini": {"doc": "gemini-3.1-pro-preview", "ocr": "gemini-3.7-flash"},
}


def resolve_model(provider: str, kind: str):
    if provider not in MODEL_MAP:
        raise HTTPException(400, "Provider AI tidak dikenal (openai/gemini)")
    return provider, MODEL_MAP[provider][kind]


def provider_label(provider: str) -> str:
    return "Gemini" if provider == "gemini" else "OpenAI"


# Sementara: Gemini pakai Universal Key sampai GEMINI_API_KEY pengguna aktif.
GEMINI_USE_EMERGENT_FALLBACK = True


def resolve_ai_api_key(provider: str):
    if provider == "gemini" and GEMINI_API_KEY and not GEMINI_USE_EMERGENT_FALLBACK:
        return GEMINI_API_KEY, "provider"
    if provider == "openai" and OPENAI_API_KEY:
        return OPENAI_API_KEY, "provider"
    if EMERGENT_LLM_KEY:
        return EMERGENT_LLM_KEY, "emergent"
    raise HTTPException(500, f"Konfigurasi API key untuk {provider_label(provider)} belum tersedia di server")


async def llm_complete(system: str, text: str, image_b64: Optional[str] = None,
                       provider: str = "gemini", model: str = "gemini-3.1-pro-preview",
                       session_id: Optional[str] = None) -> str:
    api_key, _ = resolve_ai_api_key(provider)
    chat = LlmChat(api_key=api_key, session_id=session_id or str(uuid.uuid4()),
                   system_message=system).with_model(provider, model)
    kwargs = {"text": text}
    if image_b64:
        kwargs["file_contents"] = [ImageContent(image_base64=image_b64)]
    parts = []
    async for ev in chat.stream_message(UserMessage(**kwargs)):
        if isinstance(ev, TextDelta):
            parts.append(ev.content)
        elif isinstance(ev, StreamDone):
            break
    return "".join(parts)


def parse_llm_json(raw: str):
    cleaned = re.sub(r"```(?:json)?", "", raw).strip()
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if not match:
        raise ValueError("no json")
    return json.loads(match.group(0))


def raise_ai_http_error(err: Exception, action: str, provider: str = "gemini"):
    message = str(err).lower()
    _, key_source = resolve_ai_api_key(provider)
    label = provider_label(provider)
    if "budget has been exceeded" in message or "max budget" in message:
        if key_source == "emergent":
            raise HTTPException(
                402,
                "Saldo AI Universal Key habis. Tambahkan balance di Profile → Manage plan → Universal Key → Add Balance, atau aktifkan auto top up lalu coba generate lagi."
            )
        raise HTTPException(
            402,
            f"Kuota atau billing API {label} habis/bermasalah. Periksa API key dan billing akun {label} Anda lalu coba lagi."
        )
    if any(keyword in message for keyword in ["insufficient_quota", "exceeded your current quota", "quota", "billing", "credit balance"]):
        raise HTTPException(402, f"Kuota atau billing API {label} habis/bermasalah. Periksa API key dan billing akun {label} Anda lalu coba lagi.")
    if any(keyword in message for keyword in ["invalid api key", "incorrect api key", "api key not valid", "unauthorized", "authentication", "permission denied"]):
        raise HTTPException(401, f"API key {label} tidak valid atau tidak punya akses ke model yang dipilih.")
    if any(keyword in message for keyword in ["service unavailable", "currently experiencing high demand", '"status": "unavailable"']):
        raise HTTPException(503, f"Layanan AI {label} sedang sibuk atau mengalami lonjakan trafik. Coba lagi beberapa saat.")
    if any(keyword in message for keyword in ["ratelimit", "rate limit", "too many requests", "resource_exhausted"]):
        raise HTTPException(429, f"Layanan AI {label} sedang membatasi permintaan. Tunggu sebentar lalu coba lagi.")
    raise HTTPException(500, f"AI {label} gagal {action}, coba lagi")


class IdeaChatAttachmentIn(BaseModel):
    id: str
    filename: str = ""
    content_type: str = ""
    size: int = 0


class IdeaChatIn(BaseModel):
    message: str
    session_id: str = ""
    provider: str = "gemini"
    draft: Dict[str, Any] = {}
    attachments: List[IdeaChatAttachmentIn] = []


@api.post("/projects/{pid}/idea/chat")
async def chat_activity_idea(pid: str, body: IdeaChatIn, user=Depends(get_current_user)):
    project = await ensure_project_access(pid, user)
    message = body.message.strip()
    if not message and not body.attachments:
        raise HTTPException(400, "Pesan chat wajib diisi")
    if len(body.attachments) > 3:
        raise HTTPException(400, "Maksimal tiga lampiran untuk setiap pesan")
    attachment_ids = [item.id for item in body.attachments]
    if len(attachment_ids) != len(set(attachment_ids)):
        raise HTTPException(400, "Lampiran chat tidak boleh duplikat")
    attachments = []
    if attachment_ids:
        records = await db.files.find({
            "id": {"$in": attachment_ids}, "user_id": user["id"], "kind": "idea_chat",
            "ref": pid, "is_deleted": False,
        }, {"_id": 0, "id": 1, "original_filename": 1, "content_type": 1, "size": 1, "storage_path": 1}).to_list(3)
        if len(records) != len(attachment_ids):
            raise HTTPException(400, "Satu atau lebih lampiran chat tidak valid")
        records_by_id = {record["id"]: record for record in records}
        attachments = [{
            "id": records_by_id[file_id]["id"],
            "filename": records_by_id[file_id].get("original_filename", "Lampiran"),
            "content_type": records_by_id[file_id].get("content_type", "application/octet-stream"),
            "size": records_by_id[file_id].get("size", 0),
        } for file_id in attachment_ids]
    prov, model = resolve_model(body.provider, "doc")
    session_id = body.session_id or str(uuid.uuid4())
    existing = await db.activity_ideas.find_one({"project_id": pid}, {"_id": 0})
    current_draft = normalize_idea_draft({**(existing or {}).get("draft", {}), **body.draft})
    history = (existing or {}).get("messages", [])[-12:]
    system = (
        "Anda adalah konsultan perancang program BAZNAS BAZIS Provinsi DKI Jakarta. "
        "Bantu PIC menggali ide kegiatan melalui obrolan yang ramah, praktis, dan bertahap. "
        "Setiap jawaban wajib memperbarui Draft Ide agar bisa menjadi bahan RAB dan KAK. "
        "Balas HANYA JSON valid dengan struktur: "
        "{\"reply\": str, \"draft\": {\"title\": str, \"background\": str, \"goal\": str, "
        "\"beneficiaries\": str, \"location\": str, \"schedule\": str, \"activity_format\": str, "
        "\"budget_outline\": str, \"rab_notes\": str, \"kak_notes\": str}, \"next_questions\": [str, str]}. "
        "Jika informasi belum lengkap, isi draft dengan asumsi wajar dan pertanyaan lanjutan singkat."
    )
    prompt = (
        f"Kegiatan saat ini: {project.get('name', '')} ({project.get('nomor_indeks', '')})\n"
        f"Lokasi awal: {project.get('loc', '-')}; tanggal awal: {project.get('date', '-')}\n\n"
        f"Draft saat ini:\n{idea_to_prompt(current_draft)}\n\n"
        f"Riwayat chat ringkas JSON:\n{json.dumps(history, ensure_ascii=False)}\n\n"
        f"Lampiran PIC terbaru (nama file):\n{json.dumps(attachments, ensure_ascii=False)}\n\n"
        f"Pesan PIC terbaru:\n{message}"
    )
    try:
        raw = await llm_complete(system, prompt, provider=prov, model=model, session_id=session_id)
        data = parse_llm_json(raw)
        reply = str(data.get("reply", "Baik, saya perbarui Draft Ide kegiatan."))
        new_draft = normalize_idea_draft({**current_draft, **(data.get("draft") or {})})
        next_questions = data.get("next_questions") if isinstance(data.get("next_questions"), list) else []
    except Exception as e:
        logger.error(f"Idea chat error: {e}")
        raise_ai_http_error(e, "membantu menyusun ide", prov)
    now = datetime.now(timezone.utc).isoformat()
    user_msg = {"id": str(uuid.uuid4()), "role": "user", "content": message, "attachments": attachments, "created_at": now}
    assistant_msg = {"id": str(uuid.uuid4()), "role": "assistant", "content": reply, "created_at": now,
                     "next_questions": [str(q)[:240] for q in next_questions[:3]]}
    messages = (existing or {}).get("messages", []) + [user_msg, assistant_msg]
    update = {"id": (existing or {}).get("id", str(uuid.uuid4())), "project_id": pid, "session_id": session_id,
              "draft": new_draft, "messages": messages[-80:], "status": (existing or {}).get("status", "draft"),
              "updated_by": user["id"], "updated_at": now}
    if not existing:
        update["created_at"] = now
    await db.activity_ideas.update_one({"project_id": pid}, {"$set": update}, upsert=True)
    return {"reply": reply, "draft": new_draft, "messages": messages[-80:], "session_id": session_id,
            "status": update["status"], "next_questions": assistant_msg["next_questions"]}


class OcrIn(BaseModel):
    image_base64: str
    provider: str = "gemini"


@api.post("/ai/ocr")
async def ocr_nota(body: OcrIn, user=Depends(get_current_user)):
    prov, model = resolve_model(body.provider, "ocr")
    b64 = body.image_base64.split(",", 1)[-1]
    system = ('Anda mesin OCR nota/kuitansi Indonesia. Balas HANYA JSON valid tanpa teks lain: '
              '{"merchant": str, "nominal": number, "tanggal": "DD/MM/YYYY"}. '
              'nominal adalah integer rupiah tanpa titik atau "Rp". Jika tidak terbaca, isi string kosong/0.')
    try:
        raw = await llm_complete(system, "Ekstrak nama merchant, total nominal, dan tanggal dari foto nota ini.",
                                 image_b64=b64, provider=prov, model=model)
        return parse_llm_json(raw)
    except Exception as e:
        logger.error(f"OCR error: {e}")
        if any(keyword in str(e).lower() for keyword in [
            "budget has been exceeded", "max budget", "insufficient_quota", "quota", "billing",
            "invalid api key", "incorrect api key", "api key not valid", "unauthorized",
            "authentication", "permission denied", "ratelimit", "rate limit", "too many requests", "resource_exhausted",
            "service unavailable", "currently experiencing high demand", '"status": "unavailable"'
        ]):
            raise_ai_http_error(e, "membaca nota", prov)
        raise HTTPException(422, "AI tidak dapat membaca nota. Isi manual atau coba foto lebih jelas.")


KAK_SECTIONS = ["1. Pendahuluan", "2. Deskripsi Program", "3. Landasan Hukum", "4. Tujuan Program",
                "5. Sasaran & Target", "6. Tempat & Waktu Pelaksanaan", "7. Indikator Keberhasilan",
                "8. Pelaksana & Penanggung Jawab", "9. Mekanisme Pelaksanaan", "10. Rencana Anggaran Biaya",
                "11. Jadwal Kegiatan", "12. Penutup"]


class KakIn(BaseModel):
    raw_text: str
    provider: str = "gemini"
    project_id: Optional[str] = None


@api.post("/ai/kak")
async def generate_kak(body: KakIn, user=Depends(get_current_user)):
    prov, model = resolve_model(body.provider, "doc")
    system = ("Anda penyusun dokumen resmi BAZNAS BAZIS Provinsi DKI Jakarta. Susun Kerangka Acuan Kegiatan (KAK) "
              "formal dalam Bahasa Indonesia baku berdasarkan poin mentah pengguna. Balas HANYA JSON valid: "
              '{"title": str, "sections": [{"heading": str, "body": str}]} dengan tepat 12 bagian berjudul persis: '
              + "; ".join(KAK_SECTIONS) + ". Landasan hukum merujuk UU No. 23 Tahun 2011 tentang Pengelolaan Zakat.")
    try:
        raw = await llm_complete(system, f"Poin mentah kegiatan:\n{body.raw_text}", provider=prov, model=model)
        data = parse_llm_json(raw)
        if body.project_id:
            await db.kaks.insert_one({"id": str(uuid.uuid4()), "project_id": body.project_id,
                                      "title": data.get("title", ""), "sections": data.get("sections", []),
                                      "provider": prov, "created_by": user["id"],
                                      "created_at": datetime.now(timezone.utc).isoformat()})
        return data
    except Exception as e:
        logger.error(f"KAK error: {e}")
        raise_ai_http_error(e, "menyusun KAK", prov)


class ReportIn(BaseModel):
    nomor_indeks: str
    points: str
    kak_name: Optional[str] = None
    provider: str = "gemini"
    project_id: Optional[str] = None


@api.post("/ai/report")
async def generate_report(body: ReportIn, user=Depends(get_current_user)):
    prov, model = resolve_model(body.provider, "doc")
    nomor = normalize_nomor_indeks(body.nomor_indeks)
    if body.project_id:
        await set_project_nomor_indeks(body.project_id, nomor, user)
    system = ("Anda penyusun Laporan Pertanggungjawaban (LPJ) resmi BAZNAS BAZIS Provinsi DKI Jakarta. "
              "Balas HANYA JSON valid: {\"title\": str, \"sections\": [{\"heading\": str, \"body\": str}]} "
              "dengan bagian: BAB I: PENDAHULUAN; BAB II: PELAKSANAAN KEGIATAN; BAB III: REALISASI ANGGARAN; "
              "BAB IV: PENUTUP. Bahasa Indonesia formal, naratif, akuntabel.")
    try:
        raw = await llm_complete(
            system,
            f"Nomor indeks: {nomor}\nReferensi KAK: {body.kak_name or '-'}\nPoin lapangan:\n{body.points}",
            provider=prov, model=model)
        data = parse_llm_json(raw)
        if body.project_id:
            await db.reports.insert_one({"id": str(uuid.uuid4()), "project_id": body.project_id,
                                         "nomor_indeks": nomor, "kak_name": body.kak_name,
                                         "title": data.get("title", ""), "sections": data.get("sections", []),
                                         "provider": prov, "created_by": user["id"],
                                         "created_at": datetime.now(timezone.utc).isoformat()})
        return data
    except Exception as e:
        logger.error(f"Report error: {e}")
        raise_ai_http_error(e, "menyusun laporan", prov)


@api.get("/projects/{pid}/kaks")
async def list_kaks(pid: str, user=Depends(get_current_user)):
    return await db.kaks.find({"project_id": pid}, {"_id": 0}).sort("created_at", -1).to_list(50)


@api.get("/projects/{pid}/reports")
async def list_reports(pid: str, user=Depends(get_current_user)):
    return await db.reports.find({"project_id": pid}, {"_id": 0}).sort("created_at", -1).to_list(50)


# ---------- Ekspor Dokumen Nyata ----------

def _rp(n):
    return f"Rp {int(n or 0):,}".replace(",", ".")


KAK_COMPONENT_LABELS = [
    "Pendahuluan",
    "Deskripsi Program",
    "Landasan Hukum",
    "Tujuan Program",
    "Sasaran & Target",
    "Tempat & Waktu Pelaksanaan",
    "Indikator Keberhasilan",
    "Pelaksana & Penanggung Jawab",
    "Mekanisme Pelaksanaan",
    "Rencana Anggaran Biaya",
    "Jadwal Kegiatan",
    "Penutup",
]

SIGNERS = [
    {"label": "Dibuat oleh;", "name": "Saiful Rahman", "role": "Staff Kebencanaan"},
    {"label": "Diajukan oleh;", "name": "Lina Yunita", "role": "Kasie Pendistribusian"},
    {"label": "Disetujui oleh;", "name": "Muhammad Nurminto", "role": "Kepala Bidang II"},
    {"label": "Disetujui oleh;", "name": "Muhamad Bahaudin", "role": "Pimpinan Bidang II"},
]


def _plain_component(value: str) -> str:
    return re.sub(r"^\s*\d+[.)-]?\s*", "", value or "").strip().lower().replace("dan", "&")


def _kak_rows(kak: dict):
    sections = kak.get("sections", []) or []
    rows = []
    for idx, component in enumerate(KAK_COMPONENT_LABELS):
        normalized = _plain_component(component)
        match = next((s for s in sections if normalized in _plain_component(s.get("heading", ""))), None)
        rows.append({
            "no": idx + 1,
            "component": component,
            "explanation": (match or (sections[idx] if idx < len(sections) else {})).get("body", ""),
        })
    return rows


def _rab_total(items: list) -> int:
    return sum((it.get("qty", 0) or 0) * (it.get("frek", 0) or 0) * (it.get("harga", 0) or 0) for it in items)


@api.get("/projects/{pid}/export/rab.xlsx")
async def export_rab_xlsx(pid: str, user=Depends(get_current_user)):
    project = await db.projects.find_one({"id": pid}, {"_id": 0})
    if not project:
        raise HTTPException(404, "Kegiatan tidak ditemukan")
    items = await db.rab_items.find({"project_id": pid}, {"_id": 0}).to_list(1000)
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill
    wb = Workbook()
    ws = wb.active
    ws.title = "RAB"
    header_fill = PatternFill("solid", fgColor="047857")
    white_bold = Font(bold=True, color="FFFFFF")
    ws.append(["RENCANA ANGGARAN BIAYA (RAB)"])
    ws["A1"].font = Font(bold=True, size=14)
    ws.append([project["name"]])
    ws["A2"].font = Font(bold=True)
    ws.append([f"{project.get('nomor_indeks', '')}  •  {project.get('loc', '')}  •  {project.get('date', '')}"])
    ws.append([])
    ws.append(["No", "Kategori", "Uraian", "Qty", "Satuan Qty", "Frek", "Satuan Frek", "Harga Satuan", "Jumlah"])
    for c in ws[5]:
        c.font = white_bold
        c.fill = header_fill
    total = 0
    for i, it in enumerate(items, 1):
        jumlah = (it.get("qty", 0) or 0) * (it.get("frek", 0) or 0) * (it.get("harga", 0) or 0)
        total += jumlah
        ws.append([i, it.get("kategori", ""), it.get("uraian", ""), it.get("qty", 0), it.get("satuanQty", ""),
                   it.get("frek", 0), it.get("satuanFrek", ""), it.get("harga", 0), jumlah])
    ws.append(["", "", "", "", "", "", "", "JUMLAH TOTAL", total])
    for c in ws[ws.max_row]:
        c.font = white_bold
        c.fill = header_fill
    for col, w in zip("ABCDEFGHI", [6, 16, 34, 8, 12, 8, 12, 16, 18]):
        ws.column_dimensions[col].width = w
    buf = io.BytesIO()
    wb.save(buf)
    return Response(content=buf.getvalue(),
                    media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f'attachment; filename="RAB-{project.get("nomor_indeks", "doc")}.xlsx"'})


@api.get("/projects/{pid}/export/rab.pdf")
async def export_rab_pdf(pid: str, user=Depends(get_current_user)):
    project = await db.projects.find_one({"id": pid}, {"_id": 0})
    if not project:
        raise HTTPException(404, "Kegiatan tidak ditemukan")
    items = await db.rab_items.find({"project_id": pid}, {"_id": 0}).to_list(1000)
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib import colors
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), leftMargin=40, rightMargin=40, topMargin=40)
    styles = getSampleStyleSheet()
    story = [
        Paragraph("BAZNAS BAZIS PROVINSI DKI JAKARTA", styles["Title"]),
        Paragraph(f"RENCANA ANGGARAN BIAYA (RAB) — {project['name']}", styles["Heading2"]),
        Paragraph(f"{project.get('nomor_indeks', '')} • {project.get('loc', '')} • {project.get('date', '')}", styles["Normal"]),
        Spacer(1, 16),
    ]
    data = [["No", "Kategori", "Uraian", "Qty", "Satuan", "Frek", "Satuan", "Harga Satuan", "Jumlah"]]
    total = 0
    for i, it in enumerate(items, 1):
        jumlah = (it.get("qty", 0) or 0) * (it.get("frek", 0) or 0) * (it.get("harga", 0) or 0)
        total += jumlah
        data.append([str(i), it.get("kategori", ""), it.get("uraian", ""), str(it.get("qty", 0)),
                     it.get("satuanQty", ""), str(it.get("frek", 0)), it.get("satuanFrek", ""),
                     _rp(it.get("harga", 0)), _rp(jumlah)])
    data.append(["", "", "", "", "", "", "", "JUMLAH TOTAL", _rp(total)])
    t = Table(data, colWidths=[25, 80, 180, 40, 55, 35, 55, 90, 100])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#047857")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#f0fdf4")]),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#047857")),
        ("TEXTCOLOR", (0, -1), (-1, -1), colors.white),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (3, 1), (-1, -1), "RIGHT"),
    ]))
    story.append(t)
    doc.build(story)
    return Response(content=buf.getvalue(), media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="RAB-{project.get("nomor_indeks", "doc")}.pdf"'})


async def _latest_kak(pid: str):
    kak = await db.kaks.find_one({"project_id": pid}, {"_id": 0}, sort=[("created_at", -1)])
    if not kak:
        raise HTTPException(404, "Generate KAK terlebih dahulu agar dokumen tersimpan")
    return kak


@api.get("/projects/{pid}/export/kak.pdf")
async def export_kak_pdf(pid: str, user=Depends(get_current_user)):
    project = await db.projects.find_one({"id": pid}, {"_id": 0})
    if not project:
        raise HTTPException(404, "Kegiatan tidak ditemukan")
    kak = await _latest_kak(pid)
    from reportlab.lib.pagesizes import A4
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as ReportImage
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    from xml.sax.saxutils import escape
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=50, rightMargin=50, topMargin=50)
    styles = getSampleStyleSheet()
    body_style = ParagraphStyle("body", parent=styles["Normal"], fontSize=8, leading=11, spaceAfter=0)
    title_style = ParagraphStyle("officialTitle", parent=styles["Heading2"], alignment=1, fontSize=12, leading=15, spaceAfter=4)
    subtitle_style = ParagraphStyle("officialSubtitle", parent=styles["Normal"], alignment=1, fontSize=9, leading=12, textColor=colors.HexColor("#475569"))
    story = []
    try:
        logo_response = requests.get("https://baznasbazisdki.id/assets/img/logo-dark-min.png", timeout=5)
        if logo_response.ok:
            logo = ReportImage(io.BytesIO(logo_response.content), width=90, height=30)
            logo.hAlign = "CENTER"
            story.append(logo)
            story.append(Spacer(1, 8))
    except Exception as e:
        logger.warning(f"KAK logo load skipped: {e}")
    story.extend([
        Paragraph(escape((project.get("name") or kak.get("title") or "NAMA KEGIATAN").upper()), title_style),
        Paragraph(escape(" • ".join([x for x in [kak.get("title"), project.get("loc"), project.get("date")] if x]) or "Keterangan kegiatan"), subtitle_style),
        Spacer(1, 14),
    ])
    kak_data = [["NO", "KOMPONEN", "PENJELASAN"]]
    for row in _kak_rows(kak):
        kak_data.append([str(row["no"]), Paragraph(f"<b>{escape(row['component'])}</b>", body_style), Paragraph(escape(row["explanation"] or "-"), body_style)])
    kak_table = Table(kak_data, colWidths=[32, 145, 300], repeatRows=1)
    kak_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.6, colors.HexColor("#111827")),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(kak_table)
    story.append(Spacer(1, 18))
    rab_items = await db.rab_items.find({"project_id": pid}, {"_id": 0}).to_list(1000)
    story.append(Paragraph("RENCANA ANGGARAN BIAYA (RAB)", title_style))
    rab_data = [["No", "Uraian", "Qty", "Frek", "Harga Satuan", "Jumlah"]]
    for idx, it in enumerate(rab_items, 1):
        jumlah = (it.get("qty", 0) or 0) * (it.get("frek", 0) or 0) * (it.get("harga", 0) or 0)
        rab_data.append([
            str(idx),
            Paragraph(f"<b>{escape(it.get('uraian', ''))}</b><br/><font color='#64748b'>{escape(it.get('kategori', ''))}</font>", body_style),
            f"{it.get('qty', 0)} {it.get('satuanQty', '')}",
            f"{it.get('frek', 0)} {it.get('satuanFrek', '')}",
            _rp(it.get("harga", 0)),
            _rp(jumlah),
        ])
    if not rab_items:
        rab_data.append(["", "Belum ada item RAB", "", "", "", ""])
    rab_data.append(["", "", "", "", "TOTAL", _rp(_rab_total(rab_items))])
    rab_table = Table(rab_data, colWidths=[28, 190, 55, 55, 74, 75], repeatRows=1)
    rab_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#f1f5f9")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.6, colors.HexColor("#111827")),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("ALIGN", (2, 1), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
    ]))
    story.append(rab_table)
    story.append(Spacer(1, 18))
    signer_data = [[s["label"] for s in SIGNERS], []]
    for signer in SIGNERS:
        signer_data[1].append(Paragraph(f"<br/><br/><br/><b>{escape(signer['name'])}</b><br/>{escape(signer['role'])}", body_style))
    signer_table = Table(signer_data, colWidths=[119, 119, 119, 119])
    signer_table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.6, colors.HexColor("#111827")),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
    ]))
    story.append(signer_table)
    doc.build(story)
    return Response(content=buf.getvalue(), media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="KAK-{pid[:8]}.pdf"'})


@api.get("/projects/{pid}/export/kak.docx")
async def export_kak_docx(pid: str, user=Depends(get_current_user)):
    project = await db.projects.find_one({"id": pid}, {"_id": 0})
    if not project:
        raise HTTPException(404, "Kegiatan tidak ditemukan")
    kak = await _latest_kak(pid)
    from docx import Document
    document = Document()
    document.add_heading((project.get("name") or kak.get("title") or "NAMA KEGIATAN").upper(), level=1)
    document.add_paragraph(" • ".join([x for x in [kak.get("title"), project.get("loc"), project.get("date")] if x]) or "Keterangan kegiatan")
    table = document.add_table(rows=1, cols=3)
    table.style = "Table Grid"
    headers = table.rows[0].cells
    headers[0].text = "NO"
    headers[1].text = "KOMPONEN"
    headers[2].text = "PENJELASAN"
    for row in _kak_rows(kak):
        cells = table.add_row().cells
        cells[0].text = str(row["no"])
        cells[1].text = row["component"]
        cells[2].text = row["explanation"] or "-"
    document.add_paragraph("")
    document.add_heading("RENCANA ANGGARAN BIAYA (RAB)", level=2)
    rab_items = await db.rab_items.find({"project_id": pid}, {"_id": 0}).to_list(1000)
    rab_table = document.add_table(rows=1, cols=6)
    rab_table.style = "Table Grid"
    rab_headers = rab_table.rows[0].cells
    for cell, label in zip(rab_headers, ["No", "Uraian", "Qty", "Frek", "Harga Satuan", "Jumlah"]):
        cell.text = label
    for idx, it in enumerate(rab_items, 1):
        jumlah = (it.get("qty", 0) or 0) * (it.get("frek", 0) or 0) * (it.get("harga", 0) or 0)
        cells = rab_table.add_row().cells
        cells[0].text = str(idx)
        cells[1].text = f"{it.get('uraian', '')}\n{it.get('kategori', '')}"
        cells[2].text = f"{it.get('qty', 0)} {it.get('satuanQty', '')}"
        cells[3].text = f"{it.get('frek', 0)} {it.get('satuanFrek', '')}"
        cells[4].text = _rp(it.get("harga", 0))
        cells[5].text = _rp(jumlah)
    total_cells = rab_table.add_row().cells
    total_cells[4].text = "TOTAL"
    total_cells[5].text = _rp(_rab_total(rab_items))
    document.add_paragraph("")
    signer_table = document.add_table(rows=2, cols=4)
    signer_table.style = "Table Grid"
    for idx, signer in enumerate(SIGNERS):
        signer_table.rows[0].cells[idx].text = signer["label"]
        signer_table.rows[1].cells[idx].text = f"\n\n\n{signer['name']}\n{signer['role']}"
    buf = io.BytesIO()
    document.save(buf)
    return Response(content=buf.getvalue(),
                    media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    headers={"Content-Disposition": f'attachment; filename="KAK-{pid[:8]}.docx"'})


async def _latest_report(pid: str):
    rep = await db.reports.find_one({"project_id": pid}, {"_id": 0}, sort=[("created_at", -1)])
    if not rep:
        raise HTTPException(404, "Generate laporan terlebih dahulu agar dokumen tersimpan")
    return rep


@api.get("/projects/{pid}/export/report.pdf")
async def export_report_pdf(pid: str, user=Depends(get_current_user)):
    rep = await _latest_report(pid)
    from reportlab.lib.pagesizes import A4
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=50, rightMargin=50, topMargin=50)
    styles = getSampleStyleSheet()
    body_style = ParagraphStyle("body", parent=styles["Normal"], fontSize=10, leading=14, spaceAfter=8)
    story = [
        Paragraph("BAZNAS BAZIS PROVINSI DKI JAKARTA", styles["Title"]),
        Paragraph(rep.get("title", "LAPORAN PERTANGGUNGJAWABAN"), styles["Heading2"]),
        Paragraph(rep.get("nomor_indeks", ""), ParagraphStyle("n", parent=styles["Heading3"], textColor=colors.HexColor("#047857"))),
        Spacer(1, 14),
    ]
    for s in rep.get("sections", []):
        story.append(Paragraph(f"<b>{s.get('heading', '')}</b> {s.get('body', '')}", body_style))
    doc.build(story)
    return Response(content=buf.getvalue(), media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="LPJ-{rep.get("nomor_indeks", pid[:8])}.pdf"'})


@api.get("/projects/{pid}/export/report.docx")
async def export_report_docx(pid: str, user=Depends(get_current_user)):
    rep = await _latest_report(pid)
    from docx import Document
    document = Document()
    document.add_heading("BAZNAS BAZIS PROVINSI DKI JAKARTA", level=1)
    document.add_heading(rep.get("title", "LAPORAN PERTANGGUNGJAWABAN"), level=2)
    document.add_heading(rep.get("nomor_indeks", ""), level=3)
    for s in rep.get("sections", []):
        document.add_heading(s.get("heading", ""), level=4)
        document.add_paragraph(s.get("body", ""))
    buf = io.BytesIO()
    document.save(buf)
    return Response(content=buf.getvalue(),
                    media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    headers={"Content-Disposition": f'attachment; filename="LPJ-{rep.get("nomor_indeks", pid[:8])}.docx"'})


def _doc_table_style():
    from reportlab.lib.styles import getSampleStyleSheet  # noqa
    from reportlab.platypus import TableStyle
    from reportlab.lib import colors
    return TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#047857")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#f0fdf4")]),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#047857")),
        ("TEXTCOLOR", (0, -1), (-1, -1), colors.white),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (-2, 1), (-1, -1), "RIGHT"),
    ])


@api.get("/projects/{pid}/export/paket.pdf")
async def export_paket_pdf(pid: str, user=Depends(get_current_user)):
    project = await db.projects.find_one({"id": pid}, {"_id": 0})
    if not project:
        raise HTTPException(404, "Kegiatan tidak ditemukan")
    kak = await db.kaks.find_one({"project_id": pid}, {"_id": 0}, sort=[("created_at", -1)])
    rab = await db.rab_items.find({"project_id": pid}, {"_id": 0}).to_list(1000)
    realisasi = await db.realisasi.find({"project_id": pid}, {"_id": 0, "nota_image": 0}).to_list(1000)
    report = await db.reports.find_one({"project_id": pid}, {"_id": 0}, sort=[("created_at", -1)])
    from reportlab.lib.pagesizes import A4
    from reportlab.platypus import SimpleDocTemplate, Table, Paragraph, Spacer, PageBreak
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=50, rightMargin=50, topMargin=50)
    styles = getSampleStyleSheet()
    body = ParagraphStyle("body", parent=styles["Normal"], fontSize=10, leading=14, spaceAfter=6)
    story = [
        Paragraph("BAZNAS BAZIS PROVINSI DKI JAKARTA", styles["Title"]),
        Paragraph("PAKET DOKUMEN KEGIATAN", styles["Heading2"]),
        Paragraph(project["name"], styles["Heading3"]),
        Paragraph(f"{project.get('nomor_indeks', '')} • {project.get('loc', '')} • {project.get('date', '')} • Status: {project.get('status', '')}", body),
        Spacer(1, 10),
        Paragraph("BAGIAN I — KERANGKA ACUAN KEGIATAN (KAK)", styles["Heading2"]),
    ]
    if kak:
        story.append(Paragraph(kak.get("title", ""), styles["Heading3"]))
        for s in kak.get("sections", []):
            story.append(Paragraph(f"<b>{s.get('heading', '')}</b> {s.get('body', '')}", body))
    else:
        story.append(Paragraph("KAK belum dibuat.", body))
    story.append(PageBreak())
    story.append(Paragraph("BAGIAN II — RENCANA ANGGARAN BIAYA (RAB)", styles["Heading2"]))
    if rab:
        data = [["No", "Kategori", "Uraian", "Qty", "Frek", "Harga Satuan", "Jumlah"]]
        total = 0
        for i, it in enumerate(rab, 1):
            j = (it.get("qty", 0) or 0) * (it.get("frek", 0) or 0) * (it.get("harga", 0) or 0)
            total += j
            data.append([str(i), it.get("kategori", ""), it.get("uraian", ""),
                         f"{it.get('qty', 0)} {it.get('satuanQty', '')}", f"{it.get('frek', 0)} {it.get('satuanFrek', '')}",
                         _rp(it.get("harga", 0)), _rp(j)])
        data.append(["", "", "", "", "", "JUMLAH TOTAL", _rp(total)])
        t = Table(data, colWidths=[25, 70, 150, 55, 55, 80, 85])
        t.setStyle(_doc_table_style())
        story.append(t)
    else:
        story.append(Paragraph("RAB belum diisi.", body))
    story.append(PageBreak())
    story.append(Paragraph("BAGIAN III — LAPORAN KEUANGAN (REALISASI NOTA)", styles["Heading2"]))
    if realisasi:
        data = [["No", "Tanggal", "Nama Barang/Jasa", "Nominal", "Dibuat Oleh"]]
        total_r = 0
        for i, it in enumerate(realisasi, 1):
            total_r += it.get("nominal", 0) or 0
            data.append([str(i), it.get("tanggal", ""), it.get("merchant", ""), _rp(it.get("nominal", 0)), it.get("uploader", "")])
        data.append(["", "", "TOTAL", _rp(total_r), ""])
        t = Table(data, colWidths=[25, 80, 180, 100, 105])
        t.setStyle(_doc_table_style())
        story.append(t)
    else:
        story.append(Paragraph("Belum ada laporan keuangan dari relawan.", body))
    if report:
        story.append(PageBreak())
        story.append(Paragraph("BAGIAN IV — LAPORAN KEGIATAN", styles["Heading2"]))
        story.append(Paragraph(report.get("title", ""), styles["Heading3"]))
        for s in report.get("sections", []):
            story.append(Paragraph(f"<b>{s.get('heading', '')}</b> {s.get('body', '')}", body))
    doc.build(story)
    return Response(content=buf.getvalue(), media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="Paket-{project.get("nomor_indeks", pid[:8])}.pdf"'})


# ---------- Object Storage ----------

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = "baznas-dki"
storage_key = None


def init_storage(force: bool = False):
    global storage_key
    if storage_key and not force:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key, "Content-Type": content_type},
                        data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": storage_key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ---------- Seed ----------

SEED_USERS = [
    {"email": "superadmin@baznas.id", "password": "admin123", "name": "Cheng Suya", "role": "superadmin"},
    {"email": "pic@baznas.id", "password": "pic12345", "name": "Lina Yunita", "role": "pic"},
    {"email": "relawan@baznas.id", "password": "relawan123", "name": "Budi Santoso", "role": "relawan"},
]

SEED_PROJECTS = [
    {"nomor_indeks": "00-26000001", "name": "Santunan Yatim", "loc": "Jakarta Selatan", "date": "24 Agustus 2026",
     "plafon": 450, "realisasi": 312, "slaDays": 2, "status": "Menunggu",
     "tint": {"bg": "#fde68a", "fg": "#b45309", "ini": "YT"}},
    {"nomor_indeks": "00-26000002", "name": "Pelatihan Wirausaha", "loc": "Jakarta Timur", "date": "20 Agustus 2026",
     "plafon": 250, "realisasi": 180, "slaDays": 6, "status": "Selesai",
     "tint": {"bg": "#dcfce7", "fg": "#047857", "ini": "WR"}},
    {"nomor_indeks": "00-26000003", "name": "Bedah Rumah", "loc": "Jakarta Barat", "date": "15 Agustus 2026",
     "plafon": 500, "realisasi": 420, "slaDays": 0, "status": "Diverifikasi",
     "tint": {"bg": "#bae6fd", "fg": "#0369a1", "ini": "RM"}},
    {"nomor_indeks": "00-26000004", "name": "Charity Inclusion", "loc": "Jakarta Pusat", "date": "10 Agustus 2026",
     "plafon": 150, "realisasi": 115, "slaDays": 0, "status": "Selesai",
     "tint": {"bg": "#f3e8ff", "fg": "#7e22ce", "ini": "CH"}},
]

SEED_RAB = [
    {"kategori": "Branding", "uraian": "Rollup Banner", "qty": 4, "satuanQty": "Pcs", "frek": 1, "satuanFrek": "Kali", "harga": 350000},
    {"kategori": "Branding", "uraian": "Banner 3x1 Meter", "qty": 2, "satuanQty": "Set", "frek": 1, "satuanFrek": "Kali", "harga": 100000},
    {"kategori": "Perlengkapan", "uraian": "Paket Perlengkapan Medis", "qty": 1000, "satuanQty": "Paket", "frek": 1, "satuanFrek": "Kali", "harga": 55000},
    {"kategori": "Konsumsi", "uraian": "Konsumsi Tim Lapangan", "qty": 1, "satuanQty": "Paket", "frek": 4, "satuanFrek": "Hari", "harga": 1750000},
]


@app.on_event("startup")
async def seed():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    try:
        init_storage()
        logger.info("Object storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
    for u in SEED_USERS:
        existing = await db.users.find_one({"email": u["email"]})
        if not existing:
            await db.users.insert_one({
                "id": str(uuid.uuid4()), "email": u["email"], "name": u["name"], "role": u["role"],
                "password_hash": hash_password(u["password"]),
                "created_at": datetime.now(timezone.utc).isoformat()})
        else:
            updates = {"name": u["name"], "role": u["role"]}
            try:
                needs_password_update = not verify_password(u["password"], existing.get("password_hash", ""))
            except Exception:
                needs_password_update = True
            if needs_password_update:
                updates["password_hash"] = hash_password(u["password"])
            await db.users.update_one({"email": u["email"]}, {"$set": updates})
    if await db.projects.count_documents({}) == 0:
        await db.projects.insert_many([{**p, "id": str(uuid.uuid4())} for p in SEED_PROJECTS])
    if await db.rab_items.count_documents({}) == 0:
        await db.rab_items.insert_many([{**r, "id": str(uuid.uuid4())} for r in SEED_RAB])
    if await db.realisasi.count_documents({}) == 0:
        admin = await db.users.find_one({"email": "superadmin@baznas.id"})
        await db.realisasi.insert_one({
            "id": str(uuid.uuid4()), "tanggal": "23/08/2026", "merchant": "CV Printing Jaya",
            "nominal": 1250000, "kegiatan": "Pelatihan Wirausaha", "uploader": admin["name"],
            "user_id": admin["id"], "nota_image": None,
            "created_at": datetime.now(timezone.utc).isoformat()})
    pic = await db.users.find_one({"email": "pic@baznas.id"})
    if pic:
        await db.projects.update_many({"created_by": {"$exists": False}}, {"$set": {"created_by": pic["id"]}})
        rel = await db.users.find_one({"email": "relawan@baznas.id"})
        if rel and not rel.get("pic_id"):
            await db.users.update_one({"id": rel["id"]}, {"$set": {"pic_id": pic["id"]}})
        p1 = await db.projects.find_one({"nomor_indeks": "00-26000001"})
        if p1:
            await db.rab_items.update_many({"project_id": {"$exists": False}}, {"$set": {"project_id": p1["id"]}})
        async for r in db.realisasi.find({"project_id": {"$exists": False}}):
            p = await db.projects.find_one({"name": r.get("kegiatan", "")})
            if p:
                await db.realisasi.update_one({"_id": r["_id"]}, {"$set": {"project_id": p["id"]}})


app.include_router(api)

cors_origins = [origin.strip() for origin in os.environ["CORS_ORIGINS"].split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
