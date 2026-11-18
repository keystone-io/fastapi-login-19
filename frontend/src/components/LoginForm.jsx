import { useState } from 'react'
import { login } from '../api.js'
import SocialLogin from './SocialLogin.jsx'

// FastAPI POST /login 에 맞춘 로그인 화면
//   입력: email, password  → 성공하면 { access_token }
//   틀리면 401 "이메일 또는 비밀번호가 잘못되었습니다."
// onLogin(token): 받은 토큰(출입증)을 App 에 넘긴다
// initialEmail: 회원가입 직후 넘어오면 이메일을 미리 채워 둔다
export default function LoginForm({ onLogin, initialEmail = '' }) {
  const [form, setForm] = useState({ email: initialEmail, password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('이메일 형식이 올바르지 않습니다.')
      return
    }
    if (!form.password) {
      setError('비밀번호를 입력하세요.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const data = await login({ email: form.email.trim(), password: form.password })
      onLogin(data.access_token)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h1>로그인</h1>
      <p className="sub">가입한 이메일과 비밀번호를 입력하세요.</p>

      <label>
        이메일
        <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="예: test@example.com" autoComplete="email" />
      </label>
      <label>
        비밀번호
        <input name="password" type="password" value={form.password} onChange={handleChange} autoComplete="current-password" autoFocus={!!initialEmail} />
      </label>

      {error && <p className="error" role="alert">{error}</p>}

      <button type="submit" disabled={loading}>
        {loading ? '로그인 중…' : '로그인'}
      </button>

      <SocialLogin />
    </form>
  )
}
