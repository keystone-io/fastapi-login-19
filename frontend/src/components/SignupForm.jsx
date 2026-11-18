import { useState } from 'react'
import { signup, checkUsername } from '../api.js'
import SocialLogin from './SocialLogin.jsx'

const EMPTY = { username: '', email: '', password: '', passwordCheck: '' }

// FastAPI POST /signup 의 입력(EmailForm)에 맞춘 회원가입 화면
//   username: str   (비어 있으면 400)
//   email:    EmailStr (형식이 틀리면 422)
//   password: str   (Supabase 기본: 6자 이상)
// onGoLogin(email): 가입 후 "로그인하러 가기" → 로그인 탭으로 이동
export default function SignupForm({ onGoLogin }) {
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [user, setUser] = useState(null) // 가입 성공 시 FastAPI 응답
  // 중복체크 결과: { username: 확인한 값, ok: true/false, message }  (null 이면 아직 안 함)
  const [usernameCheck, setUsernameCheck] = useState(null)
  const [checking, setChecking] = useState(false)

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
    // username 을 고치면 이전 중복체크 결과는 무효
    if (e.target.name === 'username') setUsernameCheck(null)
  }

  async function handleCheckUsername() {
    const username = form.username.trim()
    if (!username) {
      setUsernameCheck({ username, ok: false, message: '✗ username 을 입력하세요.' })
      return
    }
    setChecking(true)
    try {
      const data = await checkUsername(username)
      setUsernameCheck({
        username,
        ok: data.available,
        message: data.available ? '✓ 사용할 수 있는 username 입니다.' : '✗ 이미 사용 중인 username 입니다.',
      })
    } catch (err) {
      setUsernameCheck({ username, ok: false, message: `✗ ${err.message}` })
    } finally {
      setChecking(false)
    }
  }

  // 지금 입력된 username 으로 중복체크를 통과했는지
  const usernameOk = usernameCheck === null ? null : usernameCheck.ok

  // 실시간 확인 — 입력이 있을 때만 메시지를 보여 준다 (null 이면 표시 안 함)
  const passwordOk = form.password ? form.password.length >= 6 : null
  const passwordCheckOk = form.passwordCheck ? form.password === form.passwordCheck : null

  // ok: true → 초록, false → 빨강, null → 기본
  const stateClass = (ok) => (ok === null ? '' : ok ? 'is-ok' : 'is-bad')

  // 서버에 보내기 전에 화면에서 먼저 확인 (서버도 한 번 더 확인한다)
  function validate() {
    if (!form.username.trim()) return 'username 을 입력하세요.'
    if (!usernameCheck) return 'username 중복체크를 해 주세요.'
    if (!usernameCheck.ok) return '다른 username 을 입력하고 중복체크를 해 주세요.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return '이메일 형식이 올바르지 않습니다.'
    if (form.password.length < 6) return '비밀번호는 6자 이상이어야 합니다.'
    if (form.password !== form.passwordCheck) return '비밀번호 확인이 일치하지 않습니다.'
    return ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const message = validate()
    if (message) {
      setError(message)
      return
    }
    setError('')
    setLoading(true)
    try {
      const data = await signup({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
      })
      setUser(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setUser(null)
    setForm(EMPTY)
    setUsernameCheck(null)
  }

  // 가입 성공 화면
  if (user) {
    return (
      <div>
        <h1>가입 완료</h1>
        <p className="sub">Supabase Auth 에 회원이 생기고, profiles 테이블에 저장되었습니다.</p>
        <dl className="info">
          <dt>username</dt>
          <dd>{user.username}</dd>
          <dt>이메일</dt>
          <dd>{user.email}</dd>
          <dt>회원 id</dt>
          <dd className="mono">{user.id}</dd>
        </dl>
        <button type="button" onClick={() => onGoLogin(user.email)}>
          로그인하러 가기
        </button>
        <button type="button" className="secondary" onClick={reset}>
          다른 계정 가입하기
        </button>
      </div>
    )
  }

  // 가입 입력 화면
  return (
    <form onSubmit={handleSubmit} noValidate>
      <h1>회원가입</h1>
      <p className="sub">이메일로 가입합니다.</p>

      <div className="field">
        <label htmlFor="username">username</label>
        {/* 1행 2열: [입력칸 | 중복체크 버튼] */}
        <div className="input-row">
          <input
            id="username"
            name="username"
            value={form.username}
            onChange={handleChange}
            placeholder="예: 홍길동"
            autoComplete="username"
            className={stateClass(usernameOk)}
            aria-describedby="username-hint"
          />
          <button type="button" className="check-btn" onClick={handleCheckUsername} disabled={checking}>
            {checking ? '확인 중…' : '중복체크'}
          </button>
        </div>
        {usernameCheck && (
          <span id="username-hint" className={`hint ${stateClass(usernameOk)}`} aria-live="polite">
            {usernameCheck.message}
          </span>
        )}
      </div>
      <label>
        이메일
        <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="예: test@example.com" autoComplete="email" />
      </label>
      <label>
        비밀번호
        <input
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          placeholder="6자 이상"
          autoComplete="new-password"
          className={stateClass(passwordOk)}
          aria-describedby="password-hint"
        />
        {passwordOk !== null && (
          <span id="password-hint" className={`hint ${stateClass(passwordOk)}`} aria-live="polite">
            {passwordOk ? '✓ 사용할 수 있는 비밀번호입니다.' : `✗ 6자 이상 입력하세요. (현재 ${form.password.length}자)`}
          </span>
        )}
      </label>
      <label>
        비밀번호 확인
        <input
          name="passwordCheck"
          type="password"
          value={form.passwordCheck}
          onChange={handleChange}
          autoComplete="new-password"
          className={stateClass(passwordCheckOk)}
          aria-describedby="password-check-hint"
        />
        {passwordCheckOk !== null && (
          <span id="password-check-hint" className={`hint ${stateClass(passwordCheckOk)}`} aria-live="polite">
            {passwordCheckOk ? '✓ 비밀번호가 일치합니다.' : '✗ 비밀번호가 일치하지 않습니다.'}
          </span>
        )}
      </label>

      {error && <p className="error" role="alert">{error}</p>}

      <button type="submit" disabled={loading}>
        {loading ? '가입 중…' : '회원가입'}
      </button>

      <SocialLogin />
    </form>
  )
}
