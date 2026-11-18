# backend (FastAPI)

전체 설명은 상위 폴더의 [README.md](../README.md) 를 본다.

```bash
cd backend
uv sync                              # 처음 한 번
uv run uvicorn main:app --reload     # http://127.0.0.1:8000/docs
```

`.env` 는 이 폴더(`backend/.env`)에 둔다. `.env.example` 참고.
