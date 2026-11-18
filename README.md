# fastapi-login-19

FastAPI + Supabase Auth 로 회원가입·로그인(토큰)·카카오 로그인을 만드는 수업 실습 (2026-11-17).
이전 수업 fastapi-db-19(회원 CRUD)에서 이어진다.

강사 저장소 https://github.com/himzei/fastapi-login-19 (`master`) 의 코드를 기준으로 아래를 바꿨다.

- DB 주소·Supabase 키를 코드에서 빼서 `.env` 로 읽음
- 버그 수정: `profiles.id` 를 문자열(UUID)로, `save_profile()` 에서 만든 객체를 변수에 담기
- 이메일 형식 검사(`EmailStr`), username 중복·빈 값 400, Supabase 오류는 500 대신 400/401
- 연습용 테스트 화면 `/test` (`login_test.html`)

## 실행

```bash
uv sync                              # 처음 한 번
uv run uvicorn main:app --reload     # 서버 실행, 끄기는 Ctrl+C
```

- http://127.0.0.1:8000/docs : API 문서·테스트
- http://127.0.0.1:8000/test : 회원가입 → 로그인 → 내 정보를 버튼으로 확인
- http://127.0.0.1:8000/login/kakao : 카카오 로그인 시작 (콜백 `/auth/callback` 은 아직 없음)

## .env

`.env.example` 을 복사해 `.env` 를 만들고 값을 넣는다. `.env` 는 git 에 올라가지 않는다.

| 키 | 위치 (Supabase 대시보드) |
| --- | --- |
| `DATABASE_URL` | Connect → Direct → Session pooler (URI) |
| `SUPABASE_URL` | Integrations → Data API 의 API URL 에서 끝의 `/rest/v1/` 를 뺀 주소 |
| `SUPABASE_KEY` | Project Settings → API Keys → Publishable key (secret 키 사용 금지) |

## API

| 메서드·경로 | 설명 |
| --- | --- |
| `POST /signup` | 회원가입 `{"username", "email", "password"}` → Supabase Auth 가입 + `profiles` 저장 |
| `POST /login` | 로그인 `{"email", "password"}` → `access_token` 발급 |
| `GET /profiles` | 전체 프로필 목록 |
| `GET /me` | 헤더 `Authorization: Bearer <토큰>` 으로 내 정보 확인 |
| `GET /login/kakao` | 카카오 로그인 페이지로 이동 |

## 구조

```
/signup ─┬─> Supabase auth.users  (이메일·비밀번호 해시, Supabase 가 관리)
         └─> public.profiles      (username·provider, 내 코드가 관리)  ← 같은 UUID 로 연결
/login   ──> access_token 발급 → /me 요청 헤더에 붙여 "나" 확인
```

## 강사 저장소와 맞추기

강사 저장소의 기록(커밋)에는 DB 비밀번호·키가 들어 있어 이 저장소에는 기록 없이 새로 올렸다.
마지막으로 합친 강사 커밋: `6745e2e` (2026-11-17 14:21)

```bash
git fetch instructor
git diff 6745e2e instructor/master    # 그 뒤로 바뀐 내용 확인 후 반영
```
