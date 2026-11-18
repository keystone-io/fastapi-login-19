import { useEffect, useState } from 'react'
import { getMe } from '../api.js'

// 로그인 후 화면: 토큰을 붙여 FastAPI GET /me 를 호출해 "나"의 정보를 보여 준다
//   토큰이 잘못됐거나 만료되면 401 → 자동 로그아웃
export default function MyInfo({ token, onLogout }) {
  const [me, setMe] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false // 화면이 바뀐 뒤 늦게 온 응답은 무시
    getMe(token)
      .then((data) => {
        if (!ignore) setMe(data)
      })
      .catch((err) => {
        if (ignore) return
        if (err.status === 401) onLogout('로그인이 만료되었습니다. 다시 로그인하세요.')
        else setError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [token, onLogout])

  return (
    <div>
      <h1>내 정보</h1>
      <p className="sub">토큰으로 FastAPI <code>/me</code> 를 호출한 결과입니다.</p>

      {error && <p className="error" role="alert">{error}</p>}
      {!me && !error && <p className="sub">불러오는 중…</p>}

      {me && (
        <dl className="info">
          <dt>username</dt>
          <dd>{me.username}</dd>
          <dt>이메일</dt>
          <dd>{me.email ?? '(없음)'}</dd>
          <dt>가입 방식</dt>
          <dd>{me.provider}</dd>
          <dt>회원 id</dt>
          <dd className="mono">{me.id}</dd>
        </dl>
      )}

      <button type="button" className="secondary" onClick={() => onLogout('')}>
        로그아웃
      </button>
    </div>
  )
}
