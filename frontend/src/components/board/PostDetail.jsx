import { useEffect, useState } from 'react'
import { deletePost, getPost, toggleLike } from '../../api.js'
import { Avatar, LikeButton, Tags } from './common.jsx'
import { providerLabel, timeAgo } from './utils.js'

// 글 하나 보기 — 작성자에게만 [수정] [삭제] 버튼이 보인다
export default function PostDetail({ id, token, onBack, onEdit, onDeleted, onNeedLogin, onAuthError }) {
  const [result, setResult] = useState({ key: '', post: null, error: '' })
  const [busy, setBusy] = useState(false)
  const key = `${id}|${token}`

  useEffect(() => {
    let ignore = false
    getPost(id, token)
      .then((post) => !ignore && setResult({ key, post, error: '' }))
      .catch((err) => !ignore && setResult({ key, post: null, error: err.message }))
    return () => {
      ignore = true
    }
  }, [key, id, token])

  const post = result.key === key ? result.post : null
  const error = result.key === key ? result.error : ''

  async function handleLike() {
    if (!token) return onNeedLogin('좋아요를 누르려면 로그인하세요.')
    try {
      const res = await toggleLike(id, token)
      setResult((r) => ({ ...r, post: { ...r.post, ...res } }))
    } catch (err) {
      if (err.status === 401) onAuthError(err)
    }
  }

  async function handleDelete() {
    if (!window.confirm('이 글을 삭제할까요? 되돌릴 수 없습니다.')) return
    setBusy(true)
    try {
      await deletePost(id, token)
      onDeleted()
    } catch (err) {
      setBusy(false)
      if (err.status === 401) onAuthError(err)
      else window.alert(err.message)
    }
  }

  return (
    <div className="detail">
      <button type="button" className="text-btn" onClick={onBack}>
        ← 목록으로
      </button>

      {error && <p className="board-error" role="alert">{error}</p>}
      {!post && !error && <p className="board-empty">불러오는 중…</p>}

      {post && (
        <article className="detail-card">
          <span className="detail-category">{post.category}</span>
          <h1 className="detail-title">{post.title}</h1>

          <header className="post-author">
            <Avatar name={post.author.username} />
            <div className="post-author-text">
              <strong>{post.author.username}</strong>
              <span>
                {providerLabel(post.author.provider)} · {timeAgo(post.created_at)}
                {post.updated_at !== post.created_at && ' · 수정됨'}
              </span>
            </div>
          </header>

          {post.image_url && <img className="detail-image" src={post.image_url} alt="" />}
          {/* 줄바꿈 그대로 보여 주기 (HTML 로 넣지 않으므로 글 안의 <script> 는 글자로만 보인다) */}
          <div className="detail-content">{post.content}</div>

          <footer className="post-footer">
            <LikeButton count={post.like_count} liked={post.liked} onClick={handleLike} />
            <Tags tags={post.tags} />
          </footer>

          {post.is_mine && (
            <div className="detail-actions">
              <button type="button" className="outline-btn" onClick={() => onEdit(post)} disabled={busy}>
                수정
              </button>
              <button type="button" className="outline-btn danger" onClick={handleDelete} disabled={busy}>
                {busy ? '삭제 중…' : '삭제'}
              </button>
            </div>
          )}
        </article>
      )}
    </div>
  )
}
