import { useCallback, useEffect, useState } from 'react'
import SignupForm from './components/SignupForm.jsx'
import LoginForm from './components/LoginForm.jsx'
import MyInfo from './components/MyInfo.jsx'
import Header from './components/board/Header.jsx'
import PostList from './components/board/PostList.jsx'
import PostDetail from './components/board/PostDetail.jsx'
import PostEditor from './components/board/PostEditor.jsx'
import { getMe } from './api.js'
import './App.css'

const TABS = [
  { id: 'login', label: '로그인' },
  { id: 'signup', label: '회원가입' },
]

// 카카오·구글 로그인 후 FastAPI 가 이 화면으로 돌려보낸다
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

// 화면(view) 종류
//   list   : 글 목록          post  : 글 보기 { id }
//   write  : 글쓰기           edit  : 글 수정 { post }
//   auth   : 로그인·회원가입  { back: 로그인 후 돌아갈 화면 }
//   me     : 내 정보
function App() {
  // 로그인하면 받은 토큰(출입증)을 여기에 보관 (새로고침하면 사라짐 → 다시 로그인)
  const [token, setToken] = useState(initial.token)
  const [me, setMe] = useState(null) // { token, data } — 어느 토큰으로 받은 정보인지 같이 보관
  const [view, setView] = useState(initial.error ? { name: 'auth' } : { name: 'list' })
  const [list, setList] = useState({ category: null, mine: false, page: 1 })
  const [authTab, setAuthTab] = useState('login')
  const [loginEmail, setLoginEmail] = useState('') // 가입 직후 로그인 탭에 미리 채울 이메일
  const [notice, setNotice] = useState(initial.error ?? '')

  const currentMe = token && me?.token === token ? me.data : null

  function go(next) {
    setView(next)
    window.scrollTo(0, 0)
  }

  // 자식 화면의 useEffect 에서 쓰므로 useCallback 으로 고정
  const handleLogout = useCallback((message) => {
    setToken(null)
    setMe(null)
    setNotice(message)
    setList((l) => ({ ...l, mine: false, page: 1 }))
    if (message) {
      setAuthTab('login')
      setView({ name: 'auth' })
    } else {
      setView({ name: 'list' })
    }
  }, [])

  const handleAuthError = useCallback(() => {
    handleLogout('로그인이 만료되었습니다. 다시 로그인하세요.')
  }, [handleLogout])

  // 토큰이 생기면 머리글에 보여 줄 username 을 가져온다
  useEffect(() => {
    if (!token) return
    let ignore = false
    getMe(token)
      .then((data) => !ignore && setMe({ token, data }))
      .catch((err) => {
        if (!ignore && err.status === 401) handleAuthError()
      })
    return () => {
      ignore = true
    }
  }, [token, handleAuthError])

  // 로그인이 필요한 버튼을 눌렀을 때: 로그인 화면으로 갔다가, 로그인하면 원래 화면으로
  function needLogin(message, back = view) {
    setNotice(message)
    setAuthTab('login')
    go({ name: 'auth', back })
  }

  function handleLogin(newToken) {
    setNotice('')
    setToken(newToken)
    go(view.back ?? { name: 'list' })
  }

  function goLogin(email) {
    setLoginEmail(email)
    setNotice('')
    setAuthTab('login')
  }

  function showList(next) {
    setList({ category: null, mine: false, page: 1, ...next })
    go({ name: 'list' })
  }

  function handleWrite() {
    if (!token) return needLogin('글을 쓰려면 로그인하세요.', { name: 'write' })
    go({ name: 'write' })
  }

  function handleMine() {
    if (!token) return needLogin('내 글을 보려면 로그인하세요.', { name: 'list' })
    showList({ mine: true })
  }

  const showSubnav = view.name === 'list' || view.name === 'post'
  const heading = list.mine ? '내 글' : (list.category ?? '전체')

  return (
    <>
      <Header
        me={currentMe}
        mine={list.mine && view.name === 'list'}
        category={list.category}
        showSubnav={showSubnav}
        onHome={() => showList({})}
        onMine={handleMine}
        onCategory={(category) => showList({ category })}
        onLogin={() => needLogin('', { name: 'list' })}
        onMyInfo={() => go({ name: 'me' })}
        onWrite={handleWrite}
      />

      <main className="board">
        {view.name === 'list' && (
          <>
            <h1 className="board-heading">{heading}</h1>
            <PostList
              category={list.category}
              mine={list.mine}
              page={list.page}
              token={token}
              onPage={(page) => {
                setList({ ...list, page })
                window.scrollTo(0, 0)
              }}
              onOpen={(id) => go({ name: 'post', id })}
              onNeedLogin={(msg) => needLogin(msg)}
              onAuthError={handleAuthError}
            />
          </>
        )}

        {view.name === 'post' && (
          <PostDetail
            id={view.id}
            token={token}
            onBack={() => go({ name: 'list' })}
            onEdit={(post) => go({ name: 'edit', post })}
            onDeleted={() => go({ name: 'list' })}
            onNeedLogin={(msg) => needLogin(msg)}
            onAuthError={handleAuthError}
          />
        )}

        {(view.name === 'write' || view.name === 'edit') && (
          <PostEditor
            key={view.post?.id ?? 'new'}
            post={view.post}
            defaultCategory={list.category}
            token={token}
            onSaved={(id) => go({ name: 'post', id })}
            onCancel={() => go(view.post ? { name: 'post', id: view.post.id } : { name: 'list' })}
            onAuthError={handleAuthError}
          />
        )}

        {view.name === 'me' && token && (
          <div className="auth-page">
            <div className="card">
              <MyInfo token={token} onLogout={handleLogout} />
            </div>
          </div>
        )}

        {view.name === 'auth' && (
          <div className="auth-page">
            <div className="card">
              <div className="tabs" role="tablist">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={authTab === t.id}
                    className={authTab === t.id ? 'tab active' : 'tab'}
                    onClick={() => {
                      setNotice('')
                      setAuthTab(t.id)
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {notice && <p className="notice">{notice}</p>}

              <div role="tabpanel">
                {authTab === 'login' ? (
                  // key 를 바꾸면 폼이 새로 만들어져 이메일이 미리 채워진다
                  <LoginForm key={loginEmail} initialEmail={loginEmail} onLogin={handleLogin} />
                ) : (
                  <SignupForm onGoLogin={goLogin} />
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  )
}

export default App
