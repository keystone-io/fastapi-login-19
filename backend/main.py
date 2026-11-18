from fastapi import FastAPI, Depends, HTTPException, Query, Response, UploadFile, File
from sqlalchemy import (create_engine, Column, String, BigInteger, Text, DateTime, ForeignKey,
                        JSON, func)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import declarative_base, Session
from pydantic import BaseModel, EmailStr, Field, HttpUrl, StringConstraints
from typing import Annotated, Literal
from supabase import create_client, ClientOptions, AuthError
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse, RedirectResponse
from pathlib import Path
from urllib.parse import quote, urlencode
from dotenv import load_dotenv
import base64
import json
import os
import secrets
import time
import uuid
import httpx  # supabase 가 쓰는 HTTP 라이브러리 (카카오 토큰 요청용)

# [수정] DB 주소·Supabase 키를 코드에 쓰지 않고 .env 에서 읽는다
load_dotenv(Path(__file__).parent / ".env")

DATABASE_URL = os.getenv("DATABASE_URL") or "sqlite:///./local.db"
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)
Base = declarative_base()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError(".env 에 SUPABASE_URL, SUPABASE_KEY 를 입력하고 저장하세요.")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY, options=ClientOptions(flow_type="pkce"))


# 회원 추가 정보 테이블(profiles) — 이메일·비밀번호는 Supabase Auth 가 관리하고,
# 여기에는 username·가입 방식(provider)만 저장한다
class Profile(Base):
    __tablename__ = "profiles"
    # Supabase 회원 id 는 숫자가 아니라 UUID 문자열 (예: "3f2a...-...")
    id = Column(String(50), primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True)
    # [수정] 선택 항목: 카카오 로그인은 이메일을 못 받을 수 있어 비워 둘 수 있게(NULL 허용)
    email = Column(String(120), nullable=True)
    provider = Column(String(50))

class EmailForm(BaseModel):
    # 로그인(/login)에도 같은 양식을 쓰므로 username 은 안 보내도 되게 기본값 ""
    username: str = ""
    # [수정] str → EmailStr: 'zzzzzz', 'ssssss@ssssss' 처럼 형식이 틀리면
    #        Supabase 에 보내기 전에 FastAPI 가 422 로 거부 (email-validator 패키지 필요)
    email: EmailStr
    password: str

# [추가] 게시판 테이블 — Supabase 에는 CLI 마이그레이션으로 만들었다
#   supabase/migrations/20261118042817_create_posts.sql  (여기 모델은 그 테이블을 읽고 쓰는 용도)
class Post(Base):
    __tablename__ = "posts"
    id = Column(BigInteger, primary_key=True)  # DB 가 1, 2, 3 … 자동 번호
    author_id = Column(String(50), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(20), nullable=False, default="토론")
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    tags = Column(JSON().with_variant(JSONB, "postgresql"), nullable=False, default=list)
    image_url = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

class PostLike(Base):
    __tablename__ = "post_likes"
    post_id = Column(BigInteger, ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(String(50), ForeignKey("profiles.id", ondelete="CASCADE"), primary_key=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

# 글 분류 (화면 위쪽 카테고리 탭과 같은 목록)
CATEGORIES = ("시민질문", "뉴스", "소식", "캠페인", "토론", "팩트체크", "모임")

# 앞뒤 공백을 지우고, 비어 있으면 422
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Content = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20000)]
Tag = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)]

class PostForm(BaseModel):
    category: Literal[CATEGORIES] = "토론"
    title: Title
    content: Content
    tags: list[Tag] = Field(default_factory=list, max_length=5)  # 태그는 최대 5개
    # http(s) 주소만 허용 (javascript: 같은 주소로 화면을 공격하지 못하게)
    image_url: HttpUrl | None = None

# 테이블이 없으면 생성
Base.metadata.create_all(bind=engine)

# 요청마다 세션을 열고, 끝나면 닫는 함수
def get_db():
    db = Session(bind=engine)
    try:
        yield db
    finally:
        db.close()

app = FastAPI()

@app.get("/")
def read_home():
    return {
        "hello": "world"
    }

# [추가] 로그인 흐름을 버튼으로 확인하는 연습용 화면 → http://localhost:8000/test
@app.get("/test", include_in_schema=False)
def test_page():
    return FileResponse(Path(__file__).parent / "login_test.html")

# Supabase 회원(user)의 id 로 profiles 에 한 줄 저장 (이미 있으면 그대로 반환)
def save_profile(db: Session, user, username, provider):
    profile = db.get(Profile, user.id)
    if profile is None:
        # [수정] 이메일이 없으면("" 또는 None) NULL 로 저장 — 빈 문자열과 '없음'을 구분하기 위해
        profile = Profile(id=user.id, email=user.email or None, username=username, provider=provider)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile

# 회원가입
@app.post("/signup")
def signup(form: EmailForm, db: Session=Depends(get_db)):
    # [추가] username 은 가입 때 꼭 필요 (기본값 "" 은 로그인용이라 직접 확인)
    if not form.username.strip():
        raise HTTPException(status_code=400, detail="username 을 입력하세요.")
    # [추가] username 중복은 Supabase 가입 전에 확인
    #        (가입부터 하면 Auth 에는 회원이 생기고 profiles 저장만 실패한다)
    if db.query(Profile).filter(Profile.username == form.username).first():
        raise HTTPException(status_code=400, detail="이미 사용 중인 username 입니다.")

    # [추가] 짧은 비밀번호·가입 횟수 제한 등은 Supabase 가 오류를 던짐 → 500 대신 400
    try:
        res = supabase.auth.sign_up({
            "email": form.email,
            "password": form.password
        })
    except AuthError as e:
        raise HTTPException(status_code=400, detail=f"회원가입 실패: {e.message}")

    profile = save_profile(db, res.user, form.username, "email")
    # [추가] Confirm email 이 꺼져 있으면 가입과 동시에 로그인되어 res.session 에 토큰이 들어온다
    return {
        "id": profile.id,
        "email": profile.email,
        "username": profile.username,
        "access_token": res.session.access_token if res.session else None
    }

# 로그인 — 이메일·비밀번호가 맞으면 access_token(출입증) 발급
@app.post("/login")
def login(form: EmailForm):
    try:
        res = supabase.auth.sign_in_with_password({
            "email": form.email,
            "password": form.password
        })
    # [수정] except: (모든 오류) → except AuthError: (Supabase 가 로그인을 거부한 경우만 401)
    except AuthError:
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 잘못되었습니다.")
    return {
        "access_token": res.session.access_token
    }

# 전체 회원 목록 (profiles 테이블)
@app.get("/profiles")
def read_profiles(db: Session = Depends(get_db)):
    profiles = db.query(Profile).all()
    return [
       {
           "id": profile.id,
           "email": profile.email,
           "username": profile.username,
           "provider": profile.provider
        } for profile in profiles
    ]

# [추가] username 중복 확인 — 회원가입 화면의 [중복체크] 버튼용
#   GET /profiles/check?username=홍길동  → {"username": "홍길동", "available": true}
#   (전체 목록 /profiles 를 쓰면 모든 회원 이메일이 브라우저로 가므로 따로 만든다)
@app.get("/profiles/check")
def check_username(username: str, db: Session = Depends(get_db)):
    username = username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="username 을 입력하세요.")
    exists = db.query(Profile).filter(Profile.username == username).first() is not None
    return {
        "username": username,
        "available": not exists
    }

# 요청 헤더 "Authorization: Bearer <토큰>" 에서 토큰을 꺼내 주는 도구
# (/docs 오른쪽 위에 Authorize 버튼이 생긴다)
bearer = HTTPBearer()
# 토큰이 없어도 되는 API 용 (글 목록: 비회원도 보고, 로그인했으면 '내가 누른 좋아요' 표시)
optional_bearer = HTTPBearer(auto_error=False)

# [수정] 토큰 → 로그인한 회원(profiles 한 줄). /me 와 게시판 글쓰기·수정·삭제에서 같이 쓴다
def get_current_profile(cred: HTTPAuthorizationCredentials = Depends(bearer),
                        db: Session = Depends(get_db)) -> Profile:
    try:
        user = supabase.auth.get_user(cred.credentials).user
    except AuthError:
        raise HTTPException(status_code=401, detail="토큰이 잘못되었습니다.")

    profile = db.get(Profile, user.id)
    if profile is None:
        # [수정] 안내 문구: 토큰은 맞는데 profiles 에 정보가 없는 경우
        raise HTTPException(status_code=404, detail="프로필 정보가 없습니다.")
    return profile

def get_optional_profile(cred: HTTPAuthorizationCredentials | None = Depends(optional_bearer),
                         db: Session = Depends(get_db)) -> Profile | None:
    if cred is None:
        return None
    try:
        user = supabase.auth.get_user(cred.credentials).user
    except AuthError:
        return None  # 만료된 토큰이어도 글 목록은 보여 준다
    return db.get(Profile, user.id)

# 내 정보 — 토큰으로 누구인지 확인 (로그인한 사람만 사용 가능)
@app.get("/me")
def me(profile: Profile = Depends(get_current_profile)):
    return {
        "id": profile.id,
        "username": profile.username,
        "email": profile.email,
        "provider": profile.provider
    }

# ─────────────────────────────────────────────────────────────
# [추가] 게시판(토론) CRUD
# ─────────────────────────────────────────────────────────────
#   GET    /posts?category=토론&page=1   목록 (누구나)
#   GET    /posts/{id}                   글 보기 (누구나)
#   POST   /posts                        글쓰기 (로그인)
#   PUT    /posts/{id}                   수정 (작성자만)
#   DELETE /posts/{id}                   삭제 (작성자만)
#   POST   /posts/{id}/like              좋아요 누르기/취소 (로그인)
EXCERPT_LENGTH = 150

def clean_tags(tags: list[str]) -> list[str]:
    """'#AI', 'AI' 처럼 같은 태그가 두 번 들어오면 하나만 남긴다"""
    result = []
    for tag in tags:
        tag = tag.lstrip("#").strip()
        if tag and tag not in result:
            result.append(tag)
    return result

def like_info(db: Session, post_ids: list[int], viewer: Profile | None):
    """글마다 좋아요 수와, 보는 사람이 눌렀는지 여부"""
    if not post_ids:
        return {}, set()
    counts = dict(
        db.query(PostLike.post_id, func.count())
        .filter(PostLike.post_id.in_(post_ids))
        .group_by(PostLike.post_id)
        .all()
    )
    liked = set()
    if viewer is not None:
        liked = {row[0] for row in db.query(PostLike.post_id)
                 .filter(PostLike.post_id.in_(post_ids), PostLike.user_id == viewer.id)}
    return counts, liked

def post_to_dict(post: Post, author: Profile, like_count: int, liked: bool,
                 viewer: Profile | None, full: bool = False):
    data = {
        "id": post.id,
        "category": post.category,
        "title": post.title,
        "tags": post.tags or [],
        "image_url": post.image_url,
        "created_at": post.created_at,
        "updated_at": post.updated_at,
        "author": {"id": author.id, "username": author.username, "provider": author.provider},
        "like_count": like_count,
        "liked": liked,
        "is_mine": viewer is not None and viewer.id == post.author_id,
    }
    if full:
        data["content"] = post.content
    else:
        # 목록에는 앞부분만 (줄바꿈은 공백으로)
        text = " ".join(post.content.split())
        data["excerpt"] = text[:EXCERPT_LENGTH] + ("…" if len(text) > EXCERPT_LENGTH else "")
    return data

def find_post(db: Session, post_id: int) -> Post:
    post = db.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="글을 찾을 수 없습니다.")
    return post

def check_owner(post: Post, profile: Profile):
    if post.author_id != profile.id:
        raise HTTPException(status_code=403, detail="작성자만 수정·삭제할 수 있습니다.")

@app.get("/posts")
def list_posts(category: Literal[CATEGORIES] | None = None,
               mine: bool = False,
               page: int = Query(1, ge=1),
               size: int = Query(12, ge=1, le=50),
               viewer: Profile | None = Depends(get_optional_profile),
               db: Session = Depends(get_db)):
    query = db.query(Post, Profile).join(Profile, Post.author_id == Profile.id)
    if category:
        query = query.filter(Post.category == category)
    if mine:
        if viewer is None:
            raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
        query = query.filter(Post.author_id == viewer.id)

    total = query.count()
    rows = (query.order_by(Post.created_at.desc(), Post.id.desc())
            .offset((page - 1) * size).limit(size).all())
    counts, liked = like_info(db, [post.id for post, _ in rows], viewer)
    return {
        "items": [post_to_dict(post, author, counts.get(post.id, 0), post.id in liked, viewer)
                  for post, author in rows],
        "total": total,
        "page": page,
        "size": size,
    }

@app.get("/posts/{post_id}")
def read_post(post_id: int,
              viewer: Profile | None = Depends(get_optional_profile),
              db: Session = Depends(get_db)):
    post = find_post(db, post_id)
    author = db.get(Profile, post.author_id)
    counts, liked = like_info(db, [post.id], viewer)
    return post_to_dict(post, author, counts.get(post.id, 0), post.id in liked, viewer, full=True)

@app.post("/posts", status_code=201)
def create_post(form: PostForm,
                profile: Profile = Depends(get_current_profile),
                db: Session = Depends(get_db)):
    post = Post(
        author_id=profile.id,
        category=form.category,
        title=form.title,
        content=form.content,
        tags=clean_tags(form.tags),
        image_url=str(form.image_url) if form.image_url else None,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return post_to_dict(post, profile, 0, False, profile, full=True)

@app.put("/posts/{post_id}")
def update_post(post_id: int, form: PostForm,
                profile: Profile = Depends(get_current_profile),
                db: Session = Depends(get_db)):
    post = find_post(db, post_id)
    check_owner(post, profile)
    post.category = form.category
    post.title = form.title
    post.content = form.content
    post.tags = clean_tags(form.tags)
    post.image_url = str(form.image_url) if form.image_url else None
    post.updated_at = func.now()
    db.commit()
    db.refresh(post)
    counts, liked = like_info(db, [post.id], profile)
    return post_to_dict(post, profile, counts.get(post.id, 0), post.id in liked, profile, full=True)

@app.delete("/posts/{post_id}", status_code=204)
def delete_post(post_id: int,
                profile: Profile = Depends(get_current_profile),
                db: Session = Depends(get_db)):
    post = find_post(db, post_id)
    check_owner(post, profile)
    db.delete(post)  # 좋아요는 DB 의 on delete cascade 로 함께 지워진다
    db.commit()
    return Response(status_code=204)

@app.post("/posts/{post_id}/like")
def toggle_like(post_id: int,
                profile: Profile = Depends(get_current_profile),
                db: Session = Depends(get_db)):
    find_post(db, post_id)
    like = db.get(PostLike, (post_id, profile.id))
    if like is None:
        db.add(PostLike(post_id=post_id, user_id=profile.id))
    else:
        db.delete(like)
    try:
        db.commit()
    except IntegrityError:  # 버튼을 아주 빠르게 두 번 누른 경우
        db.rollback()
    counts, liked = like_info(db, [post_id], profile)
    return {"like_count": counts.get(post_id, 0), "liked": post_id in liked}

# ─────────────────────────────────────────────────────────────
# [추가] 대표 이미지 업로드 → Supabase Storage
# ─────────────────────────────────────────────────────────────
#   React [이미지 선택] → POST /uploads/image (파일 + 토큰)
#   → FastAPI: 로그인 확인 · 진짜 이미지인지 · 5MB 이하인지 확인
#   → Supabase Storage 에 "그 회원의 토큰"으로 업로드 (버킷 정책: 자기 id 폴더에만 허용)
#   → 공개 주소(URL)를 돌려줌 → 글 저장 때 image_url 로 보낸다
# 버킷·정책은 supabase/migrations/20261118044307_create_post_images_bucket.sql
IMAGE_BUCKET = "post-images"
MAX_IMAGE_BYTES = 5 * 1024 * 1024
IMAGE_EXT = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}

def sniff_image_type(data: bytes) -> str | None:
    """파일 이름·브라우저가 알려 준 종류는 바꿀 수 있으므로, 파일 첫 부분(서명)을 직접 보고 판단"""
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    return None

@app.post("/uploads/image", status_code=201)
def upload_image(file: UploadFile = File(...),
                 cred: HTTPAuthorizationCredentials = Depends(bearer),
                 profile: Profile = Depends(get_current_profile)):
    data = file.file.read(MAX_IMAGE_BYTES + 1)  # 한도보다 1바이트만 더 읽어 초과 여부 판단
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="이미지는 5MB 이하만 올릴 수 있습니다.")
    content_type = sniff_image_type(data)
    if content_type is None:
        raise HTTPException(status_code=400, detail="jpg, png, webp, gif 이미지만 올릴 수 있습니다.")

    # 파일 이름은 새로 만든다 (원래 이름의 한글·특수문자·겹침 문제를 피함)
    path = f"{profile.id}/{uuid.uuid4().hex}.{IMAGE_EXT[content_type]}"
    try:
        r = httpx.post(
            f"{SUPABASE_URL}/storage/v1/object/{IMAGE_BUCKET}/{path}",
            content=data,
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {cred.credentials}",  # 회원 본인 권한으로 업로드
                "Content-Type": content_type,
                "x-upsert": "false",
            },
            timeout=30,
        )
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Supabase Storage 에 연결하지 못했습니다.")
    if r.status_code not in (200, 201):
        try:
            message = r.json().get("message") or r.text
        except ValueError:
            message = r.text
        raise HTTPException(status_code=502, detail=f"이미지 업로드 실패: {message}")

    return {
        "path": path,
        "url": f"{SUPABASE_URL}/storage/v1/object/public/{IMAGE_BUCKET}/{path}",
    }

# ─────────────────────────────────────────────────────────────
# 카카오 로그인
# ─────────────────────────────────────────────────────────────
# [수정] 우리 서버가 카카오에 직접 로그인 요청 → 받은 ID 토큰으로 Supabase 로그인
#   이유: Supabase 경유(강사 방식, 아래 /login/kakao-supabase)는 이메일을 꼭 요청해서
#         비즈 앱이 아니면 카카오가 KOE205 로 막는다. 직접 요청하면 이메일을 뺄 수 있다.
#
#   React [카카오로 시작하기] → GET /login/kakao → 카카오 로그인·동의 (닉네임·사진만)
#   → GET /auth/kakao/callback?code=... → 카카오에 code 를 주고 ID 토큰(신분증) 받기
#   → supabase.auth.sign_in_with_id_token() → Supabase 회원 로그인 → profiles 저장 → React
#
# 필요한 설정
#   - backend/.env: KAKAO_REST_API_KEY, KAKAO_CLIENT_SECRET (Supabase Kakao 설정과 같은 값)
#   - 카카오디벨로퍼스: Redirect URI 에 KAKAO_REDIRECT_URI 등록, OpenID Connect ON
KAKAO_REST_API_KEY = os.getenv("KAKAO_REST_API_KEY")
KAKAO_CLIENT_SECRET = os.getenv("KAKAO_CLIENT_SECRET")
KAKAO_REDIRECT_URI = "http://127.0.0.1:8000/auth/kakao/callback"

# 로그인이 끝나면 보낼 React 화면 주소
FRONTEND_URL = os.getenv("FRONTEND_URL") or "http://localhost:5173"

# 로그인 요청마다 만든 일회용 값(state) — 돌아온 요청이 우리가 보낸 것인지 확인 (10분 유효)
# ※ 서버 메모리에 보관하므로 로그인 도중 서버가 재시작되면(main.py 저장 등) 다시 시도해야 한다
kakao_states: dict[str, float] = {}

def fail_redirect(message: str):
    """React 화면으로 돌아가 오류 문구를 보여 준다"""
    return RedirectResponse(f"{FRONTEND_URL}/#login_error={quote(message)}")

def success_redirect(access_token: str):
    """React 화면으로 돌아가 토큰을 넘긴다 (# 뒤는 서버로 전송되지 않아 로그에 안 남음)"""
    return RedirectResponse(f"{FRONTEND_URL}/#access_token={access_token}")

# 카카오 닉네임으로 username 을 만들되, 이미 있으면 뒤에 숫자를 붙인다 (username 은 unique)
def make_unique_username(db: Session, user, nickname: str | None = None) -> str:
    meta = user.user_metadata or {}
    base = (nickname or meta.get("nickname") or meta.get("name") or meta.get("full_name")
            or meta.get("preferred_username") or f"kakao_{user.id[:8]}")
    base = base.strip()[:40]
    username, n = base, 2
    while db.query(Profile).filter(Profile.username == username).first():
        username = f"{base}_{n}"
        n += 1
    return username

# ID 토큰(JWT) 가운데 부분(내용)을 읽는다 — 진짜인지 검증은 Supabase 가 이미 했으므로 읽기만
def read_jwt_claims(token: str) -> dict:
    try:
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        return json.loads(base64.urlsafe_b64decode(payload))
    except (IndexError, ValueError):
        return {}

@app.get("/login/kakao")
def login_kakao():
    if not KAKAO_REST_API_KEY or not KAKAO_CLIENT_SECRET:
        return fail_redirect("backend/.env 에 KAKAO_REST_API_KEY, KAKAO_CLIENT_SECRET 를 입력하고 서버를 재시작하세요.")

    now = time.time()
    for s, t in list(kakao_states.items()):  # 오래된 값 정리
        if now - t > 600:
            kakao_states.pop(s, None)
    state = secrets.token_urlsafe(16)
    kakao_states[state] = now

    params = {
        "client_id": KAKAO_REST_API_KEY,
        "redirect_uri": KAKAO_REDIRECT_URI,
        "response_type": "code",
        # openid: ID 토큰 받기 / 이메일(account_email)은 요청하지 않는다
        "scope": "openid profile_nickname profile_image",
        "state": state,
    }
    return RedirectResponse("https://kauth.kakao.com/oauth/authorize?" + urlencode(params))

@app.get("/auth/kakao/callback", include_in_schema=False)
def kakao_callback(code: str = "", state: str = "", error: str = "", error_description: str = "",
                   db: Session = Depends(get_db)):
    # 1) 사용자가 동의를 취소했거나 카카오가 오류를 돌려준 경우
    if error:
        return fail_redirect(f"카카오 로그인 실패: {error_description or error}")
    if not code:
        return fail_redirect("카카오 로그인 실패: 인증 코드가 없습니다.")
    if kakao_states.pop(state, None) is None:
        return fail_redirect("로그인 요청이 만료되었습니다. 다시 시도하세요. (도중에 서버가 재시작됐을 수 있음)")

    # 2) code → 카카오 토큰 (ID 토큰 포함)
    try:
        r = httpx.post("https://kauth.kakao.com/oauth/token", data={
            "grant_type": "authorization_code",
            "client_id": KAKAO_REST_API_KEY,
            "client_secret": KAKAO_CLIENT_SECRET,
            "redirect_uri": KAKAO_REDIRECT_URI,
            "code": code,
        }, timeout=10)
    except httpx.HTTPError:
        return fail_redirect("카카오 서버에 연결하지 못했습니다.")
    data = r.json()
    if r.status_code != 200:
        return fail_redirect(f"카카오 토큰 발급 실패: {data.get('error_description') or data.get('error')}")
    id_token = data.get("id_token")
    if not id_token:
        return fail_redirect("카카오가 ID 토큰을 주지 않았습니다. 카카오디벨로퍼스에서 OpenID Connect 를 켜세요.")

    # 3) ID 토큰 → Supabase 로그인 (처음이면 Supabase 회원도 자동 생성)
    try:
        res = supabase.auth.sign_in_with_id_token({"provider": "kakao", "token": id_token})
    except AuthError as e:
        return fail_redirect(f"Supabase 로그인 실패: {e.message}")

    # 4) 처음 온 사람이면 profiles 에 저장 (username = 카카오 닉네임, 이메일은 없음)
    if db.get(Profile, res.user.id) is None:
        nickname = read_jwt_claims(id_token).get("nickname")
        save_profile(db, res.user, make_unique_username(db, res.user, nickname), "kakao")

    return success_redirect(res.session.access_token)


# ─────────────────────────────────────────────────────────────
# Supabase 경유 소셜 로그인 (강사 방식) — 구글, (비즈 앱이면) 카카오
# ─────────────────────────────────────────────────────────────
#   GET /login/google → Supabase 가 만든 구글 로그인 주소로 이동 → 구글 로그인
#   → 구글 → Supabase → /auth/callback?code=... → code 를 토큰으로 교환(PKCE) → profiles 저장 → React
# 필요한 설정
#   - Google Cloud 콘솔 OAuth 클라이언트: 승인된 리디렉션 URI = https://<ref>.supabase.co/auth/v1/callback
#   - Supabase → Sign In / Providers → Google: 클라이언트 ID·보안 비밀번호 입력 후 켜기
#   - Supabase → URL Configuration → Redirect URLs: http://127.0.0.1:8000/auth/callback
# ※ PKCE 확인값을 서버 메모리에 보관 → 로그인 도중 서버가 재시작되면(main.py 저장 등) 다시 시도
OAUTH_CALLBACK_URL = "http://127.0.0.1:8000/auth/callback"
PROVIDER_NAMES = {"google": "구글", "kakao": "카카오"}

def start_supabase_oauth(provider: str):
    res = supabase.auth.sign_in_with_oauth({
        "provider": provider,
        "options": {"redirect_to": OAUTH_CALLBACK_URL}
    })
    return RedirectResponse(res.url)

# [추가] 구글 로그인 — 구글은 이메일 요청에 제약이 없어 강사 방식 그대로 사용
@app.get("/login/google")
def login_google():
    return start_supabase_oauth("google")

# 강사 방식 카카오 — 비즈 앱 전환 후 이메일 동의항목을 쓸 수 있게 되면 사용 가능
#   지금은 Supabase 가 이메일을 요청해서 카카오가 KOE205 로 막는다 (원래 경로는 /login/kakao)
@app.get("/login/kakao-supabase", include_in_schema=False)
def login_kakao_supabase():
    return start_supabase_oauth("kakao")

# Supabase 경유 로그인의 콜백 — Supabase 가 ?code=... 를 가지고 돌아온다
@app.get("/auth/callback", include_in_schema=False)
def auth_callback(code: str = "", error: str = "", error_description: str = "",
                  db: Session = Depends(get_db)):
    if error or not code:
        return fail_redirect(f"소셜 로그인 실패: {error_description or error or '인증 코드가 없습니다.'}")
    try:
        res = supabase.auth.exchange_code_for_session({"auth_code": code})
    except AuthError as e:
        return fail_redirect(f"소셜 로그인 실패: {e.message} (도중에 서버가 재시작됐다면 다시 시도하세요)")

    user = res.user
    # [수정] 어떤 방식으로 로그인했는지 Supabase 회원 정보에서 읽는다 (google / kakao)
    provider = (user.app_metadata or {}).get("provider", "oauth")
    if db.get(Profile, user.id) is None:
        meta = user.user_metadata or {}
        # 구글: 이름(full_name) → 없으면 이메일 앞부분 / 카카오: 닉네임
        name = (meta.get("full_name") or meta.get("name") or meta.get("nickname")
                or (user.email or "").split("@")[0] or f"{provider}_{user.id[:8]}")
        save_profile(db, user, make_unique_username(db, user, name), provider)

    return success_redirect(res.session.access_token)
