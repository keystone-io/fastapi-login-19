import { useCallback, useState } from 'react'
import SignupForm from './components/SignupForm.jsx'
import LoginForm from './components/LoginForm.jsx'
import MyInfo from './components/MyInfo.jsx'
import './App.css'

const TABS = [
  { id: 'login', label: '로그인' },
  { id: 'signup', label: '회원가입' },
]

// 카카오 로그인 후 FastAPI /auth/callback 이 이 화면으로 돌려보낸다
//   성공: http://localhost:5173/#access_token=...
//   실패: http://localhost:5173/#login_error=...
// 주소의 # 부분을 읽고, 토큰이 주소창·방문 기록에 남지 않게 바로 지운다
function readLoginResult() {
  const params = new URLSearchParams(window.location.hash.slice(1))
  const token = params.get('access_token')
  const error = params.get('login_error')
  if (token || error) {
    window.history.replaceState(null, '', window.location.pathname)
  }
  return { token, error }
}

const initial = readLoginResult()

function App() {
  const [tab, setTab] = useState('login')
  // 로그인하면 받은 토큰(출입증)을 여기에 보관 (새로고침하면 사라짐 → 다시 로그인)
  const [token, setToken] = useState(initial.token)
  const [loginEmail, setLoginEmail] = useState('') // 가입 직후 로그인 탭에 미리 채울 이메일
  const [notice, setNotice] = useState(initial.error ?? '')

  function handleLogin(newToken) {
    setNotice('')
    setToken(newToken)
  }

  // MyInfo 의 useEffect 에서 쓰므로 useCallback 으로 고정
  const handleLogout = useCallback((message) => {
    setToken(null)
    setTab('login')
    setNotice(message)
  }, [])

  function goLogin(email) {
    setLoginEmail(email)
    setNotice('')
    setTab('login')
  }

  return (
    <main className="page">
      <div className="card">
        {token ? (
          <MyInfo token={token} onLogout={handleLogout} />
        ) : (
          <>
            <div className="tabs" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className={tab === t.id ? 'tab active' : 'tab'}
                  onClick={() => {
                    setNotice('')
                    setTab(t.id)
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {notice && <p className="notice">{notice}</p>}

            <div role="tabpanel">
              {tab === 'login' ? (
                // key 를 바꾸면 폼이 새로 만들어져 이메일이 미리 채워진다
                <LoginForm key={loginEmail} initialEmail={loginEmail} onLogin={handleLogin} />
              ) : (
                <SignupForm onGoLogin={goLogin} />
              )}
            </div>
          </>
        )}
      </div>
    </main>
  )
}

export default App
