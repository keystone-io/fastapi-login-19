import { CATEGORIES } from './utils.js'

// 맨 위 파란 머리글 + 그 아래 분류 탭
export default function Header({ me, mine, category, onHome, onMine, onCategory, onLogin, onMyInfo, onWrite, showSubnav }) {
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <button type="button" className="brand" onClick={onHome}>
            마당
          </button>
          <nav className="topnav" aria-label="주 메뉴">
            <button type="button" className={!mine ? 'active' : ''} onClick={onHome}>
              열린 광장
            </button>
            <button type="button" className={mine ? 'active' : ''} onClick={onMine}>
              내 글
            </button>
          </nav>
          <div className="topbar-right">
            {me ? (
              <button type="button" className="pill-btn" onClick={onMyInfo}>
                {me.username}
              </button>
            ) : (
              <button type="button" className="pill-btn" onClick={onLogin}>
                로그인
              </button>
            )}
          </div>
        </div>
      </header>

      {showSubnav && (
        <div className="subnav">
          <div className="subnav-inner">
            <nav className="subnav-tabs" aria-label="분류">
              <button type="button" className={!category ? 'active' : ''} onClick={() => onCategory(null)}>
                전체
              </button>
              {CATEGORIES.map((c) => (
                <button key={c} type="button" className={category === c ? 'active' : ''} onClick={() => onCategory(c)}>
                  {c}
                </button>
              ))}
            </nav>
            <button type="button" className="write-btn" onClick={onWrite}>
              새 콘텐츠 작성
            </button>
          </div>
        </div>
      )}
    </>
  )
}
