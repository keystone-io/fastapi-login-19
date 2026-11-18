# fastapi-login-19

FastAPI + Supabase Auth 로 회원가입·로그인(토큰)·카카오 로그인을 만들고, React(Vite) 화면을 붙인 수업 실습.
이전 수업 fastapi-db-19(회원 CRUD)에서 이어진다.

- 강사 저장소: https://github.com/himzei/fastapi-login-19 (`master`) — 마지막으로 합친 커밋 `6745e2e` (2026-11-17 14:21)
- 내 저장소: https://github.com/keystone-io/fastapi-login-19 (`main`)

## 변경 이력

### 2026-11-17 — 수업 (회원가입·로그인·카카오 설정)

강사 코드를 받아 아래를 고치거나 더했다.

| 구분 | 내용 |
| --- | --- |
| 보안 | DB 주소·Supabase 키를 코드에서 빼서 `.env` 로 읽음 (강사 코드에는 직접 적혀 있음). `.gitignore` 에 `.env` 추가 |
| 버그 | `profiles.id` 가 `Integer` → Supabase 회원 id 는 UUID 문자열이라 `String` 으로 (강사도 이후 같은 수정) |
| 버그 | `save_profile()` 에서 `Profile(...)` 을 변수에 안 담아 `db.add(None)` → 500 (강사도 이후 같은 수정) |
| 검증 | 이메일 `str` → `EmailStr` (`zzzz`, `ssss@ssss` 는 422). `email-validator` 추가 |
| 오류 처리 | username 빈 값·중복 → 400, Supabase 가입 오류 → 400, 로그인 실패만 401 (`except:` → `except AuthError:`) |
| 응답 | `/signup` 응답에 `access_token` 추가 (Confirm email 이 꺼져 있으면 가입과 동시에 로그인됨) |
| 문구 | `/me` 에서 프로필이 없으면 401 "비밀번호가 잘못" → 404 "프로필 정보가 없습니다" |
| 연습 | 버튼으로 흐름을 보는 테스트 화면 `/test` (`backend/login_test.html`) |

### 2026-11-18 — 구조 변경 + React 화면 + 카카오 로그인 완성

| 구분 | 내용 |
| --- | --- |
| 구조 | 폴더를 `backend/`(FastAPI) + `frontend/`(React 19 + Vite 8) 로 나눔. `git mv` 로 이동해 이력 유지 |
| 프론트 | 로그인 \| 회원가입 **탭**, 로그인 후 `/me` 로 **내 정보** 화면, 로그아웃 |
| 프론트 | 회원가입: 비밀번호 6자 이상·비밀번호 확인 일치를 **실시간 표시**(빨강/초록) |
| 프론트 | 회원가입: username 옆 **[중복체크]** 버튼 (1행 2열) |
| 프론트 | 두 화면 아래 "또는" 구분선 + **카카오로 시작하기**, **구글로 시작하기**(구글은 설정 전 안내만) |
| 프론트 | Vite 프록시: React 의 `/api/*` → FastAPI `:8000` (CORS 설정 불필요) |
| 백엔드 | `GET /profiles/check?username=` 추가 (중복체크용. 전체 목록 `/profiles` 는 이메일이 노출돼 따로 만듦) |
| 백엔드 | `profiles.email` 을 **선택 항목**으로 (`nullable=True`, 빈 값은 NULL 저장) — 카카오는 이메일이 없을 수 있음 |
| 백엔드 | **카카오 로그인을 직접 요청 방식으로 변경** (아래 "카카오 로그인" 참고). 강사 방식은 `/login/kakao-supabase` 로 보존 |
| 백엔드 | `httpx` 를 정식 의존성으로 추가 (카카오 토큰 요청) |
| 백엔드 | **구글 로그인** `GET /login/google` 추가 (강사 방식 = Supabase 경유). `/auth/callback` 이 구글·카카오 공통으로 provider 를 회원 정보에서 읽어 저장 |
| 프론트 | [구글로 시작하기] 버튼 연결 (안내 문구 → 실제 로그인) |
| 확인 | 카카오 로그인 성공: Supabase `auth.users` 에 provider=kakao·이메일 없이 생성, `profiles` 에 username=카카오 닉네임·email=NULL 저장 |

## 폴더 구조

```
fastapi-login-19/
├─ backend/                FastAPI
│  ├─ main.py              API 전부
│  ├─ login_test.html      연습용 테스트 화면 (/test)
│  ├─ .env / .env.example  키 (git 제외 / 빈 값 예시)
│  └─ pyproject.toml, uv.lock
├─ frontend/               React 19 + Vite 8
│  ├─ vite.config.js       /api → http://127.0.0.1:8000 프록시
│  └─ src/
│     ├─ api.js            FastAPI 호출 (signup, login, getMe, checkUsername), 오류 문구 한국어화
│     ├─ App.jsx           탭 구조, 토큰 보관, 카카오 로그인 후 돌아온 결과(#access_token) 읽기
│     └─ components/       SignupForm, LoginForm, MyInfo, SocialLogin
└─ README.md
```

## 실행

터미널 2개를 열어 각각 실행한다. 끄기는 `Ctrl+C`.

```bash
# 터미널 1 — 백엔드 (http://127.0.0.1:8000)
cd backend
uv sync                              # 처음 한 번
uv run uvicorn main:app --reload

# 터미널 2 — 프론트엔드 (http://localhost:5173)
cd frontend
npm install                          # 처음 한 번
npm run dev
```

- http://localhost:5173 : React 화면 (회원가입·로그인·카카오)
- http://127.0.0.1:8000/docs : API 문서·테스트
- http://127.0.0.1:8000/test : 연습용 테스트 화면

## .env (`backend/.env`)

`backend/.env.example` 을 복사해 값을 넣는다. `.env` 는 git 에 올라가지 않는다. 바꾸면 백엔드를 재시작해야 반영된다.

| 키 | 위치 |
| --- | --- |
| `DATABASE_URL` | Supabase → Connect → Direct → Session pooler (URI) |
| `SUPABASE_URL` | Supabase → Integrations → Data API 의 API URL 에서 끝의 `/rest/v1/` 를 뺀 주소 |
| `SUPABASE_KEY` | Supabase → Project Settings → API Keys → Publishable key (**secret 키 사용 금지**) |
| `KAKAO_REST_API_KEY` | 카카오디벨로퍼스 → 앱 → 앱 키 → REST API 키 |
| `KAKAO_CLIENT_SECRET` | 카카오디벨로퍼스 → 카카오 로그인 → 보안 → Client Secret |

## API

| 메서드·경로 | 설명 |
| --- | --- |
| `POST /signup` | 회원가입 `{"username", "email", "password"}` → Supabase Auth 가입 + `profiles` 저장 → `{id, email, username, access_token}` |
| `POST /login` | 로그인 `{"email", "password"}` → `{access_token}` (틀리면 401) |
| `GET /profiles` | 전체 프로필 목록 |
| `GET /profiles/check?username=` | username 중복 확인 → `{username, available}` *(내가 추가)* |
| `GET /me` | 헤더 `Authorization: Bearer <토큰>` → 내 프로필 (토큰 없음·잘못됨 401) |
| `GET /login/kakao` | 카카오 로그인 시작 → 카카오 → `/auth/kakao/callback` → React 로 돌아감 |
| `GET /login/google` | 구글 로그인 시작 → Supabase → 구글 → Supabase → `/auth/callback` → React 로 돌아감 |

`/docs` 에 안 보이는 경로: `/test`(테스트 화면), `/auth/kakao/callback`(카카오 콜백),
`/auth/callback`(구글 등 Supabase 경유 콜백), `/login/kakao-supabase`(강사 방식 카카오, 비즈 앱 전환 후 사용).

## 구글 로그인

구글은 이메일 요청에 제약이 없어서 강사 방식(Supabase `sign_in_with_oauth`) 그대로 쓴다.
username 은 구글 이름(없으면 이메일 앞부분), 이메일도 저장된다.

| 어디 | 설정 |
| --- | --- |
| Google Cloud → Google 인증 플랫폼 → 클라이언트 | OAuth 클라이언트(웹 애플리케이션), 승인된 리디렉션 URI `https://<ref>.supabase.co/auth/v1/callback` |
| Supabase → Sign In / Providers → Google | 클라이언트 ID·보안 비밀번호 입력 후 켜기 |
| Supabase → URL Configuration → Redirect URLs | `http://127.0.0.1:8000/auth/callback` |

## 데이터 구조

```
회원가입(이메일) ─┬─> Supabase auth.users   이메일·비밀번호 해시 (Supabase 가 관리)
카카오 로그인    ─┘                         provider = email / kakao
                  └─> public.profiles      id(같은 UUID) · username · email(선택) · provider (내 코드가 관리)
로그인 ──> access_token(JWT) ──> /me 요청 헤더에 붙여 "나" 확인
```

- 카카오 회원의 username 은 **카카오 닉네임** (겹치면 `닉네임_2`, 닉네임이 없으면 `kakao_xxxxxxxx`), 이메일은 NULL
- 이메일 회원가입·로그인은 이메일이 필수 (Supabase 이메일 로그인의 아이디)

## 카카오 로그인

강사 방식(Supabase `sign_in_with_oauth`)은 Supabase 가 카카오에 **이메일을 항상 요청**한다.
이메일 동의항목은 **비즈 앱**에서만 켤 수 있어서, 비즈 앱이 아니면 카카오가 `KOE205` 로 막는다.
그래서 FastAPI 가 카카오에 직접 요청해 이메일을 뺐다.

```
[카카오로 시작하기] → FastAPI /login/kakao
  → 카카오 로그인·동의 (요청: openid · 닉네임 · 프로필 사진)
  → FastAPI /auth/kakao/callback
      ① code → 카카오에서 ID 토큰(신분증) 받기
      ② supabase.auth.sign_in_with_id_token(ID 토큰) → Supabase 회원 생성·로그인
      ③ 처음이면 profiles 저장
  → React http://localhost:5173/#access_token=... → "내 정보" 화면 (토큰은 읽자마자 주소창에서 지움)
```

필요한 설정

| 어디 | 설정 |
| --- | --- |
| 카카오디벨로퍼스 | 카카오 로그인 ON, Client Secret 활성화, **OpenID Connect ON**, 동의항목 닉네임·프로필 사진 |
| 카카오디벨로퍼스 Redirect URI | `http://127.0.0.1:8000/auth/kakao/callback` (+ 강사 방식용 `https://<ref>.supabase.co/auth/v1/callback`) |
| Supabase → Sign In / Providers → Kakao | 켜기, REST API 키·Client Secret 입력, **Allow users without an email ON** |
| Supabase → URL Configuration → Redirect URLs | `http://127.0.0.1:8000/auth/callback` (강사 방식용) |

> **카카오 로그인 도중(버튼을 누르고 돌아오기 전)에는 `main.py` 를 저장하지 않는다.**
> `--reload` 가 서버를 재시작하면 메모리에 둔 확인값(state)이 사라져 "로그인 요청이 만료되었습니다" 가 나온다. 그때는 버튼을 다시 누르면 된다.

## 주의·참고

- 토큰은 React state(메모리)에만 보관 → **새로고침하면 로그아웃** (연습용)
- `127.0.0.1` 과 `localhost` 는 브라우저에서 다른 주소다. 카카오·Supabase 에 등록한 주소와 코드의 주소를 한 글자도 다르지 않게 맞춘다
- Supabase **Confirm email** 은 테스트 편의상 끔 (켜면 가입 시 인증 메일 발송, 무료 플랜은 시간당 발송 제한)
- `npm audit` 의 high 5개는 개발 도구(`picomatch`) 문제라 수업에 영향 없음. `npm audit fix --force` 는 실행하지 않는다

## 겪은 문제와 해결

| 문제 | 원인 | 해결 |
| --- | --- | --- |
| 가입하면 500 | 강사 코드 `id = Integer` (UUID 못 넣음), `Profile(...)` 미할당 | `String` id, `profile = Profile(...)`. 잘못 만들어진 빈 `profiles` 테이블은 삭제 후 재생성 (`create_all` 은 기존 테이블을 고치지 않음) |
| `.env` 가 git 에 올라갈 뻔 | 강사 `.gitignore` 에 `.env` 없음 | `.env`, `.env.*`, `!.env.example`, `*.db` 추가 |
| `Could not import module "main"` | 구조 변경 후 맨 위 폴더에서 서버 실행 | `cd backend` 후 실행 |
| 카카오 로그인 후 `KOE205` | Supabase 경유 시 이메일을 필수로 요청, 이메일 동의항목은 비즈 앱 전용 | 카카오 직접 요청 + `sign_in_with_id_token` |
| 카카오 로그인 후 404 | 돌아올 콜백 경로가 없었음 | `/auth/kakao/callback` 구현 |
| `SUPABASE_URL` 오류 가능 | Data API 화면의 주소 끝에 `/rest/v1/` 가 붙어 있음 | `https://<ref>.supabase.co` 까지만 |

## 강사 저장소와 맞추기

강사 저장소의 기록(커밋)에는 DB 비밀번호·키가 들어 있어 내 저장소에는 기록 없이 새로 올렸다.
강사 코드는 루트 기준(`main.py`)이고 내 코드는 `backend/main.py` 이므로, 바뀐 내용을 보고 직접 반영한다.

```bash
git fetch instructor
git diff 6745e2e instructor/master    # 6745e2e 이후 바뀐 내용 확인 → backend/main.py 에 반영
```
