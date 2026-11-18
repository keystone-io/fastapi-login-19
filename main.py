from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy import create_engine, Column, String
from sqlalchemy.orm import declarative_base, Session
from pydantic import BaseModel, EmailStr
from supabase import create_client, ClientOptions, AuthError
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse, RedirectResponse
from pathlib import Path
from dotenv import load_dotenv
import os

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
    email = Column(String(120))
    provider = Column(String(50))

class EmailForm(BaseModel):
    # 로그인(/login)에도 같은 양식을 쓰므로 username 은 안 보내도 되게 기본값 ""
    username: str = ""
    # [수정] str → EmailStr: 'zzzzzz', 'ssssss@ssssss' 처럼 형식이 틀리면
    #        Supabase 에 보내기 전에 FastAPI 가 422 로 거부 (email-validator 패키지 필요)
    email: EmailStr
    password: str

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
        profile = Profile(id=user.id, email=user.email, username=username, provider=provider)
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

# 요청 헤더 "Authorization: Bearer <토큰>" 에서 토큰을 꺼내 주는 도구
# (/docs 오른쪽 위에 Authorize 버튼이 생긴다)
bearer = HTTPBearer()

# 내 정보 — 토큰으로 누구인지 확인 (로그인한 사람만 사용 가능)
@app.get("/me")
def me(cred: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)):
    try:
        user = supabase.auth.get_user(cred.credentials).user
    except AuthError:
        raise HTTPException(status_code=401, detail="토큰이 잘못되었습니다.")

    profile = db.get(Profile, user.id)

    if profile is None:
        # [수정] 안내 문구: 토큰은 맞는데 profiles 에 정보가 없는 경우
        raise HTTPException(status_code=404, detail="프로필 정보가 없습니다.")

    return {
        "id": profile.id,
        "username": profile.username,
        "email": profile.email,
        "provider": profile.provider
    }

# 카카오 로그인 — 브라우저 주소창에 http://127.0.0.1:8000/login/kakao 입력
# Supabase 가 만들어 준 카카오 로그인 주소(res.url)로 브라우저를 보낸다.
# 로그인이 끝나면 카카오 → Supabase → redirect_to 주소(/auth/callback)로 돌아온다
# ※ redirect_to 주소는 Supabase → Authentication → URL Configuration → Redirect URLs 에 등록 필요
@app.get("/login/kakao")
def login_kakao():
    res = supabase.auth.sign_in_with_oauth({
        "provider": "kakao",
        "options": {"redirect_to": "http://127.0.0.1:8000/auth/callback"}
    })
    return RedirectResponse(res.url)
