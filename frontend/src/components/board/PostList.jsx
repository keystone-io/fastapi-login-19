import { useEffect, useState } from 'react'
import { listPosts, toggleLike } from '../../api.js'
import { Avatar, LikeButton, Tags } from './common.jsx'
import { providerLabel, timeAgo } from './utils.js'

// 글 목록: 2열 카드 + 페이지 번호
//   category: null 이면 전체 / mine: 내 글만 / page: 몇 쪽
export default function PostList({ category, mine, page, token, onPage, onOpen, onNeedLogin, onAuthError }) {
  const [result, setResult] = useState({ key: '', data: null, error: '' })
  const key = `${category}|${mine}|${page}|${token}`

  useEffect(() => {
    let ignore = false
    listPosts({ category, mine, page, token })
      .then((data) => !ignore && setResult({ key, data, error: '' }))
      .catch((err) => {
        if (ignore) return
        if (err.status === 401) onAuthError(err)
        else setResult({ key, data: null, error: err.message })
      })
    return () => {
      ignore = true
    }
  }, [key, category, mine, page, token, onAuthError])

  // 좋아요를 누르면 목록을 다시 불러오지 않고 그 카드만 숫자를 바꾼다
  async function handleLike(post) {
    if (!token) return onNeedLogin('좋아요를 누르려면 로그인하세요.')
    try {
      const res = await toggleLike(post.id, token)
      setResult((r) => ({
        ...r,
        data: { ...r.data, items: r.data.items.map((p) => (p.id === post.id ? { ...p, ...res } : p)) },
      }))
    } catch (err) {
      if (err.status === 401) onAuthError(err)
    }
  }

  const loading = result.key !== key
  const data = loading ? null : result.data

  if (!loading && result.error) return <p className="board-error" role="alert">{result.error}</p>
  if (loading) return <p className="board-empty">불러오는 중…</p>
  if (data.items.length === 0) {
    return <p className="board-empty">{mine ? '아직 쓴 글이 없습니다.' : '아직 글이 없습니다. 첫 글을 써 보세요.'}</p>
  }

  const lastPage = Math.max(1, Math.ceil(data.total / data.size))

  return (
    <>
      <div className="post-grid">
        {data.items.map((post) => (
          <PostCard key={post.id} post={post} onOpen={() => onOpen(post.id)} onLike={() => handleLike(post)} />
        ))}
      </div>
      {lastPage > 1 && <Pagination page={page} lastPage={lastPage} onPage={onPage} />}
    </>
  )
}

function PostCard({ post, onOpen, onLike }) {
  return (
    // 카드 어디를 눌러도 글이 열린다 (키보드는 제목 버튼으로)
    <article className="post-card" onClick={onOpen}>
      <header className="post-author">
        <Avatar name={post.author.username} />
        <div className="post-author-text">
          <strong>{post.author.username}</strong>
          <span>
            {providerLabel(post.author.provider)} · {timeAgo(post.created_at)}
          </span>
        </div>
      </header>

      <div className="post-body">
        <div className="post-text">
          <h2 className="post-title">
            <button type="button" onClick={onOpen}>
              {post.category !== '토론' && <span className="post-category">[{post.category}] </span>}
              {post.title}
            </button>
          </h2>
          <p className="post-excerpt">{post.excerpt}</p>
        </div>
        {post.image_url && <img className="post-thumb" src={post.image_url} alt="" loading="lazy" />}
      </div>

      <footer className="post-footer">
        <LikeButton count={post.like_count} liked={post.liked} onClick={onLike} />
        <Tags tags={post.tags} />
      </footer>
    </article>
  )
}

function Pagination({ page, lastPage, onPage }) {
  // 현재 쪽 기준 앞뒤 2쪽씩
  const start = Math.max(1, page - 2)
  const end = Math.min(lastPage, page + 2)
  const pages = []
  for (let p = start; p <= end; p++) pages.push(p)

  return (
    <nav className="pagination" aria-label="페이지">
      {page > 1 && (
        <button type="button" onClick={() => onPage(1)}>
          처음
        </button>
      )}
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          className={p === page ? 'current' : ''}
          aria-current={p === page ? 'page' : undefined}
          onClick={() => onPage(p)}
        >
          {p}
        </button>
      ))}
      {page < lastPage && (
        <button type="button" onClick={() => onPage(lastPage)}>
          마지막
        </button>
      )}
    </nav>
  )
}
