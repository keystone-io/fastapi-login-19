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
| 도구 | **Supabase CLI** 설치·로그인, `supabase init` (루트에 `supabase/` 폴더) |
| DB | 게시판 테이블 `posts`, `post_likes` 를 **CLI 마이그레이션**으로 생성 (`supabase/migrations/…_create_posts.sql`). RLS 켬 (정책 없음 → Data API 직접 접근 차단, FastAPI 로만 읽고 씀) |
| 백엔드 | 게시판 CRUD `/posts` + 좋아요 `/posts/{id}/like`. 토큰 확인을 `get_current_profile` 로 묶어 `/me` 와 같이 사용 |
| Storage | 대표 이미지 **파일 업로드** → Supabase Storage 버킷 `post-images` (마이그레이션 `…_create_post_images_bucket.sql`). `POST /uploads/image`, 글쓰기 화면에 [클릭·끌어놓기] 업로드 상자 + 미리보기 |
| 프론트 | 게시판 화면 (campaigns.do 토론 목록 레이아웃 참고): 파란 머리글, 분류 탭, 2열 카드, 글 보기·쓰기·수정·삭제, 좋아요, 페이지 번호. 로그인 화면은 머리글 [로그인] 으로 이동 |

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
│     ├─ api.js            FastAPI 호출 (회원·게시판), 오류 문구 한국어화
│     ├─ App.jsx           화면 전환(목록·글·글쓰기·로그인·내 정보), 토큰 보관, 소셜 로그인 결과(#access_token) 읽기
│     └─ components/       SignupForm, LoginForm, MyInfo, SocialLogin
│        └─ board/         Header, PostList, PostDetail, PostEditor, common(아바타·좋아요·태그), utils
├─ supabase/               Supabase CLI (supabase init)
│  ├─ config.toml
│  └─ migrations/          테이블 만드는 SQL (git 에 기록)
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

- http://localhost:5173 : React 화면 (게시판, 머리글 [로그인] → 회원가입·로그인·카카오·구글)
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

**게시판** (목록·보기는 누구나, 나머지는 `Authorization: Bearer <토큰>` 필요)

| 메서드·경로 | 설명 |
| --- | --- |
| `GET /posts?category=&mine=&page=&size=` | 목록 (최신순, 기본 12개) → `{items, total, page, size}`. 글마다 `excerpt`(150자), `like_count`, `liked`, `is_mine` |
| `GET /posts/{id}` | 글 보기 (`content` 전체) |
| `POST /posts` | 글쓰기 `{category, title, content, tags[], image_url}` → 201 |
| `PUT /posts/{id}` | 수정 (작성자만, 아니면 403) |
| `DELETE /posts/{id}` | 삭제 (작성자만) → 204. 좋아요도 같이 삭제 |
| `POST /posts/{id}/like` | 좋아요 누르기/취소 → `{like_count, liked}` |
| `POST /uploads/image` | 이미지 파일 업로드 (form-data `file`) → `{path, url}`. 글 저장 때 `url` 을 `image_url` 로 보낸다 |

- 분류: 시민질문·뉴스·소식·캠페인·토론·팩트체크·모임 (다른 값은 422)
- 제목·내용 앞뒤 공백 제거 후 비면 422, 태그 5개까지(`#` 제거·중복 제거), 이미지 주소는 http(s) 만

**테이블을 바꿀 때** (CLI 마이그레이션)

```bash
# 프로젝트 폴더(루트)에서
supabase migration new 바꿀내용          # supabase/migrations/ 에 빈 SQL 파일 생성 → SQL 작성
supabase db push --remote="<DATABASE_URL>" --dry-run   # 무엇이 반영될지 미리 보기
supabase db push --remote="<DATABASE_URL>"             # 실제 반영
```

`<DATABASE_URL>` 은 `backend/.env` 의 값 (명령 기록에 남으니 화면 공유·캡처 주의).

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

public.profiles ──< public.posts       id · author_id(=profiles.id) · category · title · content · tags · image_url · created_at · updated_at
       │                 │
       └──────< public.post_likes     post_id · user_id   (둘을 합친 값이 기본키 → 한 사람이 한 글에 좋아요 1번)
```

- 카카오 회원의 username 은 **카카오 닉네임** (겹치면 `닉네임_2`, 닉네임이 없으면 `kakao_xxxxxxxx`), 이메일은 NULL
- 이메일 회원가입·로그인은 이메일이 필수 (Supabase 이메일 로그인의 아이디)
- 회원이 지워지면 그 회원의 글·좋아요가, 글이 지워지면 그 글의 좋아요가 함께 지워진다 (`on delete cascade`)

## CRUD

데이터를 다루는 기본 동작 4가지의 머리글자. 게시판·회원 기능은 거의 다 이 네 가지로 이루어진다.

| 글자 | 뜻 | 게시판에서 | HTTP | 우리 API | SQL |
| --- | --- | --- | --- | --- | --- |
| **C**reate | 만들기 | 글쓰기 | `POST` | `POST /posts` | `INSERT` |
| **R**ead | 읽기 | 목록·글 보기 | `GET` | `GET /posts`, `GET /posts/3` | `SELECT` |
| **U**pdate | 고치기 | 글 수정 | `PUT` | `PUT /posts/3` | `UPDATE` |
| **D**elete | 지우기 | 글 삭제 | `DELETE` | `DELETE /posts/3` | `DELETE` |

```
글쓰기 예:
[등록] 버튼 → React: POST /api/posts {제목, 내용…} + Authorization: Bearer <토큰>
           → (Vite 프록시) → FastAPI POST /posts: 토큰으로 누구인지 확인 → INSERT INTO posts …
           → Supabase DB 에 한 줄 추가 → 저장된 글을 돌려줌 → React 가 글 보기 화면으로 이동
```

- 회원가입 = 회원 **C**, `/me` = 내 정보 **R**. 게시판에서 처음으로 **U**·**D** 까지 네 가지를 다 만들었다
- 수정·삭제는 **작성자만**: FastAPI 가 토큰의 회원 id 와 글의 `author_id` 를 비교해 다르면 403
- 화면에서 [수정] [삭제] 버튼을 숨기는 것(`is_mine`)은 편의일 뿐, 실제로 막는 곳은 FastAPI

## Supabase CLI

명령어로 Supabase 를 다루는 도구. 테이블 구조를 **SQL 파일(마이그레이션)**로 남겨서 git 에 기록되고, 같은 구조를 다른 DB 에도 똑같이 만들 수 있다
(대시보드에서 클릭으로 만들거나 SQLAlchemy `create_all` 로 만들면 무엇을 바꿨는지 기록이 남지 않는다).

```bash
supabase --version          # 설치 확인 (3.2.0)
supabase login              # 브라우저에서 승인 → 확인 코드를 터미널에 입력 (토큰 sbp_… 는 PC 에 저장, 어디에도 붙여넣지 않기)
supabase projects list      # 로그인 확인: 내 프로젝트 목록
supabase init               # 루트에 supabase/ 폴더 생성 (config.toml)
supabase migration new create_posts    # supabase/migrations/<시각>_create_posts.sql 생성 → SQL 작성
supabase db push --remote="<DATABASE_URL>" --dry-run   # 미리 보기 (반영할 파일 목록만)
supabase db push --remote="<DATABASE_URL>"             # 실제 반영
```

- 반영한 마이그레이션은 Supabase 의 `supabase_migrations` 기록 테이블에 남아서, 다음 `db push` 때 같은 파일을 두 번 실행하지 않는다
- 한 번 반영한 SQL 파일은 고치지 않는다. 바꿀 게 생기면 `migration new` 로 새 파일을 만든다
- `--db-url` 은 v4 에서 없어질 옵션이라 `--remote` 를 쓴다

## 이미지 업로드 (Supabase Storage)

```
글쓰기 화면 [이미지 선택 / 끌어놓기]
  → React: 종류·크기 먼저 확인 → POST /api/uploads/image (파일 + 토큰)
  → FastAPI: 로그인 확인 → 파일 첫 부분(서명)으로 진짜 jpg·png·webp·gif 인지 확인 → 5MB 이하 확인
           → Supabase Storage 에 "그 회원의 토큰"으로 업로드: post-images/<회원 id>/<임의 이름>.png
  → 공개 주소(url) 를 돌려줌 → 미리보기 표시 → [등록] 때 image_url 로 저장
```

| 설정 | 값 | 이유 |
| --- | --- | --- |
| 버킷 | `post-images`, **공개**(public) | 목록·글 보기에서 누구나 이미지를 볼 수 있어야 함 |
| 크기·종류 | 5MB, jpg·png·webp·gif | svg 는 안에 스크립트를 넣을 수 있어 제외 |
| 업로드 정책 | 로그인 회원만, **자기 회원 id 폴더에만** | publishable 키만으로는 업로드 불가 (확인: `new row violates row-level security policy`) |
| 삭제 정책 | 자기 파일만 | 나중에 정리 기능용 |

- 비밀 키(service_role)를 쓰지 않는다. FastAPI 가 회원 본인의 토큰을 그대로 Storage 에 넘겨서, Supabase 가 "누가 올리는지" 직접 확인한다
- 파일 이름은 서버가 새로 만든다 (원래 이름의 한글·특수문자·겹침 문제 방지)
- 파일 업로드를 받으려면 FastAPI 에 `python-multipart` 패키지가 필요하다 (`uv add python-multipart`)
- 올린 파일은 Supabase → **Storage → post-images** 에서 볼 수 있다
- **알아둘 점**: 이미지를 올린 뒤 [삭제]·[변경]하거나 글을 지워도 Storage 의 파일은 남는다 (정리 기능은 아직 없음)

## RLS (Row Level Security, 행 단위 보안)

Supabase DB 에는 들어가는 문이 두 개 있다.

| 문 | 누가 쓰나 | 열쇠 |
| --- | --- | --- |
| ① 직접 접속 (`DATABASE_URL`) | 우리 FastAPI | DB 비밀번호 (`.env` 에만). 관리자(postgres)로 접속 → RLS 에 막히지 않음 |
| ② Data API (`https://<ref>.supabase.co/rest/v1/<테이블>`) | Supabase 가 자동으로 열어 둔 문. 브라우저에서 바로 DB 를 읽게 해 주는 기능 | **publishable 키** — 화면 코드에 넣으라고 만든 **공개용** 키 (남이 봐도 되는 키) |

RLS 는 ②번 문에 다는 자물쇠다. "이 테이블은 누가 어떤 줄을 볼 수 있다" 는 규칙을 테이블마다 정한다.

| 상태 | ②번 문으로 요청하면 | 해당 테이블 |
| --- | --- | --- |
| RLS 꺼짐 | publishable 키만 있으면 **모든 줄이 보인다** (설정에 따라 쓰기·삭제도) | `profiles` (Table Editor 에 **UNRESTRICTED** 표시) |
| RLS 켬 + 규칙 없음 | 아무것도 안 보인다 (빈 목록) | `posts`, `post_likes` |

- 비유: 정문에는 안내데스크(FastAPI)가 있어 신분을 확인하는데, 옆문(Data API)이 잠겨 있지 않은 상태 → RLS 를 켜면 옆문이 잠긴다
- 켜도 FastAPI 기능(가입·로그인·`/me`·중복체크·게시판)은 그대로 동작한다 (①번 문은 영향 없음)
- **할 일**: `profiles` 는 아직 꺼져 있음 → 켜려면 마이그레이션 한 줄 `alter table public.profiles enable row level security;`
- 실제로 ②번 요청으로 이메일이 보이는지는 시험하지 않았다 (DB 에서 RLS 꺼짐 상태만 확인)

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
| 게시판 버튼이 로그인 버튼처럼 파랗고 꽉 차게 나옴 | 로그인 카드용 `button`·`input`·`label` 스타일이 화면 전체에 적용돼 있었음 | 그 스타일을 `.card` 안에서만 적용되게 범위를 좁힘 |
| 저장 버튼 경고 `only-export-components` | 화면 조각(.jsx) 파일에서 상수·함수도 같이 내보내면 빠른 새로고침이 안 됨 | 상수·함수는 `board/utils.js` 로 분리 |
| `supabase db push` 경고 `--db-url is deprecated` | CLI v3 에서 옵션 이름이 바뀜 | `--remote="<DATABASE_URL>"` 사용 |

## 강사 저장소와 맞추기

강사 저장소의 기록(커밋)에는 DB 비밀번호·키가 들어 있어 내 저장소에는 기록 없이 새로 올렸다.
강사 코드는 루트 기준(`main.py`)이고 내 코드는 `backend/main.py` 이므로, 바뀐 내용을 보고 직접 반영한다.

```bash
git fetch instructor
git diff 6745e2e instructor/master    # 6745e2e 이후 바뀐 내용 확인 → backend/main.py 에 반영
```
