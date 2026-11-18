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
    const names = {
      username: 'username',
      email: '이메일',
      password: '비밀번호',
      title: '제목',
      content: '내용',
      tags: '태그',
      image_url: '이미지 주소',
      category: '분류',
    }
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

async function request(method, path, { body, formData, token } = {}) {
  const headers = {}
  // 파일(formData)은 브라우저가 Content-Type(multipart/form-data; boundary=…)을 직접 붙인다
  if (body) headers['Content-Type'] = 'application/json'
  // 로그인한 사람만 쓰는 API(/me)에는 토큰(출입증)을 헤더에 붙인다
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: formData ?? (body ? JSON.stringify(body) : undefined),
    })
  } catch {
    throw new ApiError('서버에 연결하지 못했습니다.', 0)
  }

  // 204 No Content (삭제 성공): 돌려줄 내용이 없다
  if (res.status === 204) return null

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

// ── 게시판 ──────────────────────────────────────────────
// 글 목록·보기는 토큰이 없어도 된다 (있으면 '내가 누른 좋아요'·'내 글' 표시)

// GET /posts?category=토론&mine=true&page=1  → { items, total, page, size }
export function listPosts({ category, mine, page = 1, token }) {
  const params = new URLSearchParams({ page: String(page) })
  if (category) params.set('category', category)
  if (mine) params.set('mine', 'true')
  return request('GET', `/posts?${params}`, { token })
}

// GET /posts/{id}  → 글 하나 (content 전체 포함)
export function getPost(id, token) {
  return request('GET', `/posts/${id}`, { token })
}

// POST /posts  { category, title, content, tags, image_url }
export function createPost(post, token) {
  return request('POST', '/posts', { body: post, token })
}

// PUT /posts/{id}  (작성자만)
export function updatePost(id, post, token) {
  return request('PUT', `/posts/${id}`, { body: post, token })
}

// DELETE /posts/{id}  (작성자만)  → 204
export function deletePost(id, token) {
  return request('DELETE', `/posts/${id}`, { token })
}

// POST /uploads/image  (파일)  → { path, url }  — Supabase Storage 공개 주소
export function uploadImage(file, token) {
  const formData = new FormData()
  formData.append('file', file)
  return request('POST', '/uploads/image', { formData, token })
}

// POST /posts/{id}/like  → { like_count, liked }  (누를 때마다 켜기/끄기)
export function toggleLike(id, token) {
  return request('POST', `/posts/${id}/like`, { token })
}
