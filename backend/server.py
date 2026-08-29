from dotenv import load_dotenv
load_dotenv()

import os
import re
import json
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent, TextDelta, StreamDone

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret")
JWT_ALGORITHM = "HS256"
LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

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
    return user


class LoginIn(BaseModel):
    email: str
    password: str


@api.post("/auth/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.lower().strip()
    identifier = f"{request.client.host if request.client else 'x'}:{email}"
    att = await db.login_attempts.find_one({"identifier": identifier})
    if att and att.get("count", 0) >= 5:
        try:
            last = datetime.fromisoformat(att.get("last", ""))
            if (datetime.now(timezone.utc) - last).total_seconds() < 900:
                raise HTTPException(429, "Terlalu banyak percobaan. Coba lagi dalam 15 menit.")
        except ValueError:
            pass
    user = await db.users.find_one({"email": email})
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


# ---------- Projects & Dashboard ----------

@api.get("/")
async def root():
    return {"message": "Sistem Integrasi Pengelolaan Kegiatan BAZNAS DKI"}


@api.get("/projects")
async def list_projects(user=Depends(get_current_user)):
    return await db.projects.find({}, {"_id": 0}).to_list(200)


@api.get("/dashboard/stats")
async def dashboard_stats(user=Depends(get_current_user)):
    projects = await db.projects.find({}, {"_id": 0}).to_list(200)
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
    return {"ok": True}


class SubmitIn(BaseModel):
    nomor_indeks: str


@api.post("/projects/submit")
async def submit_report(body: SubmitIn, user=Depends(get_current_user)):
    res = await db.projects.update_one(
        {"nomor_indeks": body.nomor_indeks},
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


@api.get("/rab")
async def list_rab(user=Depends(get_current_user)):
    return await db.rab_items.find({}, {"_id": 0}).to_list(1000)


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
    nota_image: Optional[str] = None


@api.get("/realisasi")
async def list_realisasi(mine: bool = False, user=Depends(get_current_user)):
    query = {"user_id": user["id"]} if mine else {}
    return await db.realisasi.find(query, {"_id": 0, "nota_image": 0}).sort("created_at", -1).to_list(1000)


@api.post("/realisasi")
async def add_realisasi(body: RealisasiIn, user=Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), **body.model_dump(),
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
    doc = await db.realisasi.find_one({"id": rid}, {"_id": 0, "nota_image": 1})
    if not doc or not doc.get("nota_image"):
        raise HTTPException(404, "Nota tidak tersedia")
    return {"image": doc["nota_image"]}


# ---------- AI (LLM) ----------

async def llm_complete(system: str, text: str, image_b64: Optional[str] = None, model: str = "gpt-5.4") -> str:
    chat = LlmChat(api_key=LLM_KEY, session_id=str(uuid.uuid4()),
                   system_message=system).with_model("openai", model)
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


class OcrIn(BaseModel):
    image_base64: str


@api.post("/ai/ocr")
async def ocr_nota(body: OcrIn, user=Depends(get_current_user)):
    b64 = body.image_base64.split(",", 1)[-1]
    system = ('Anda mesin OCR nota/kuitansi Indonesia. Balas HANYA JSON valid tanpa teks lain: '
              '{"merchant": str, "nominal": number, "tanggal": "DD/MM/YYYY"}. '
              'nominal adalah integer rupiah tanpa titik atau "Rp". Jika tidak terbaca, isi string kosong/0.')
    try:
        raw = await llm_complete(system, "Ekstrak nama merchant, total nominal, dan tanggal dari foto nota ini.",
                                 image_b64=b64, model="gpt-5.4-mini")
        return parse_llm_json(raw)
    except Exception as e:
        logger.error(f"OCR error: {e}")
        raise HTTPException(422, "AI tidak dapat membaca nota. Isi manual atau coba foto lebih jelas.")


KAK_SECTIONS = ["1. Pendahuluan", "2. Deskripsi Program", "3. Landasan Hukum", "4. Tujuan Program",
                "5. Sasaran & Target", "6. Tempat & Waktu Pelaksanaan", "7. Indikator Keberhasilan",
                "8. Pelaksana & Penanggung Jawab", "9. Mekanisme Pelaksanaan", "10. Rencana Anggaran Biaya",
                "11. Jadwal Kegiatan", "12. Penutup"]


class KakIn(BaseModel):
    raw_text: str


@api.post("/ai/kak")
async def generate_kak(body: KakIn, user=Depends(get_current_user)):
    system = ("Anda penyusun dokumen resmi BAZNAS BAZIS Provinsi DKI Jakarta. Susun Kerangka Acuan Kegiatan (KAK) "
              "formal dalam Bahasa Indonesia baku berdasarkan poin mentah pengguna. Balas HANYA JSON valid: "
              '{"title": str, "sections": [{"heading": str, "body": str}]} dengan tepat 12 bagian berjudul persis: '
              + "; ".join(KAK_SECTIONS) + ". Landasan hukum merujuk UU No. 23 Tahun 2011 tentang Pengelolaan Zakat.")
    try:
        raw = await llm_complete(system, f"Poin mentah kegiatan:\n{body.raw_text}")
        return parse_llm_json(raw)
    except Exception as e:
        logger.error(f"KAK error: {e}")
        raise HTTPException(500, "AI gagal menyusun KAK, coba lagi")


class ReportIn(BaseModel):
    nomor_indeks: str
    points: str
    kak_name: Optional[str] = None


@api.post("/ai/report")
async def generate_report(body: ReportIn, user=Depends(get_current_user)):
    system = ("Anda penyusun Laporan Pertanggungjawaban (LPJ) resmi BAZNAS BAZIS Provinsi DKI Jakarta. "
              "Balas HANYA JSON valid: {\"title\": str, \"sections\": [{\"heading\": str, \"body\": str}]} "
              "dengan bagian: BAB I: PENDAHULUAN; BAB II: PELAKSANAAN KEGIATAN; BAB III: REALISASI ANGGARAN; "
              "BAB IV: PENUTUP. Bahasa Indonesia formal, naratif, akuntabel.")
    try:
        raw = await llm_complete(
            system,
            f"Nomor indeks: {body.nomor_indeks}\nReferensi KAK: {body.kak_name or '-'}\nPoin lapangan:\n{body.points}")
        return parse_llm_json(raw)
    except Exception as e:
        logger.error(f"Report error: {e}")
        raise HTTPException(500, "AI gagal menyusun laporan, coba lagi")


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
    for u in SEED_USERS:
        existing = await db.users.find_one({"email": u["email"]})
        if not existing:
            await db.users.insert_one({
                "id": str(uuid.uuid4()), "email": u["email"], "name": u["name"], "role": u["role"],
                "password_hash": hash_password(u["password"]),
                "created_at": datetime.now(timezone.utc).isoformat()})
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


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
