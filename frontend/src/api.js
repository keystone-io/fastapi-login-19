// FastAPI 호출을 모아 두는 파일
// 모든 요청은 /api 로 시작 → vite.config.js 의 프록시가 FastAPI(8000)로 전달한다

// FastAPI 오류 응답을 한국어 문장으로 바꾼다
//  - 400/401/404: { "detail": "이미 사용 중인 username 입니다." }  (문자열)
//  - 422        : { "detail": [ { "loc": ["body","email"], "msg": "..." } ] }  (형식 오류 목록)
function toMessage(status, data) {
  if (typeof data?.detail === 'string') {
    if (data.detail === 'Not authenticated') return '로그인이 필요합니다.'
    return data.detail
  }
  if (Array.isArray(data?.detail)) {
    const names = { username: 'username', email: '이메일', password: '비밀번호' }
    return data.detail
      .map((d) => {
        const field = names[d.loc?.[d.loc.length - 1]] ?? '입력값'
        if (field === '이메일') return '이메일 형식이 올바르지 않습니다.'
        return `${field} 값을 확인하세요.`
      })
      .join('\n')
  }
  return `요청 실패 (${status})`
}

// 오류에 HTTP 상태 코드(status)를 붙여 던진다 → 화면에서 401 등을 구분할 수 있게
class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function request(method, path, { body, token } = {}) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  // 로그인한 사람만 쓰는 API(/me)에는 토큰(출입증)을 헤더에 붙인다
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('서버에 연결하지 못했습니다.', 0)
  }

  // 백엔드가 꺼져 있으면 Vite 프록시가 JSON 이 아닌 오류를 돌려준다
  const data = await res.json().catch(() => null)
  if (data === null) {
    throw new ApiError('백엔드 서버(8000)가 꺼져 있는 것 같습니다. backend 폴더에서 서버를 실행하세요.', res.status)
  }
  if (!res.ok) throw new ApiError(toMessage(res.status, data), res.status)
  return data
}

// POST /signup  { username, email, password }  → { id, email, username, access_token }
export function signup({ username, email, password }) {
  return request('POST', '/signup', { body: { username, email, password } })
}

// GET /profiles/check?username=...  → { username, available }
export function checkUsername(username) {
  return request('GET', `/profiles/check?username=${encodeURIComponent(username)}`)
}

// POST /login  { email, password }  → { access_token }
export function login({ email, password }) {
  return request('POST', '/login', { body: { email, password } })
}

// GET /me  (헤더: Authorization: Bearer <토큰>)  → { id, username, email, provider }
export function getMe(token) {
  return request('GET', '/me', { token })
}
