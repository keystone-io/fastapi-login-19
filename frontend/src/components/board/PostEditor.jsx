import { useRef, useState } from 'react'
import { createPost, updatePost, uploadImage } from '../../api.js'
import { CATEGORIES } from './utils.js'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_IMAGE_MB = 5

// 글쓰기 / 수정 (post 가 있으면 수정)
export default function PostEditor({ post, defaultCategory, token, onSaved, onCancel, onAuthError }) {
  const [form, setForm] = useState({
    category: post?.category ?? defaultCategory ?? '토론',
    title: post?.title ?? '',
    content: post?.content ?? '',
    tags: post?.tags?.join(', ') ?? '',
    image_url: post?.image_url ?? '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInput = useRef(null)

  function change(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  // 파일을 고르면 바로 Supabase Storage 에 올리고, 받은 공개 주소를 image_url 에 넣는다
  async function handleFile(file) {
    if (!file) return
    setError('')
    // 서버도 다시 확인하지만, 큰 파일을 보내기 전에 먼저 걸러 준다
    if (!IMAGE_TYPES.includes(file.type)) return setError('jpg, png, webp, gif 이미지만 올릴 수 있습니다.')
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) return setError(`이미지는 ${MAX_IMAGE_MB}MB 이하만 올릴 수 있습니다.`)

    setUploading(true)
    try {
      const { url } = await uploadImage(file, token)
      setForm((f) => ({ ...f, image_url: url }))
    } catch (err) {
      if (err.status === 401) onAuthError(err)
      else setError(err.message)
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = '' // 같은 파일을 다시 골라도 동작하게
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    if (!uploading) handleFile(e.dataTransfer.files?.[0])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const tags = form.tags
      .split(/[,\s]+/)
      .map((t) => t.replace(/^#/, '').trim())
      .filter(Boolean)
    if (tags.length > 5) return setError('태그는 5개까지 입력할 수 있습니다.')

    const body = {
      category: form.category,
      title: form.title,
      content: form.content,
      tags,
      image_url: form.image_url.trim() || null,
    }
    setSaving(true)
    try {
      const saved = post ? await updatePost(post.id, body, token) : await createPost(body, token)
      onSaved(saved.id)
    } catch (err) {
      setSaving(false)
      if (err.status === 401) onAuthError(err)
      else setError(err.message)
    }
  }

  return (
    <form className="editor" onSubmit={handleSubmit}>
      <h1 className="board-heading">{post ? '글 수정' : '새 콘텐츠 작성'}</h1>

      <label className="editor-field">
        분류
        <select name="category" value={form.category} onChange={change}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className="editor-field">
        제목
        <input name="title" value={form.title} onChange={change} maxLength={200} required placeholder="제목을 입력하세요" />
      </label>

      <label className="editor-field">
        내용
        <textarea name="content" value={form.content} onChange={change} rows={12} required placeholder="내용을 입력하세요" />
      </label>

      <label className="editor-field">
        태그 <small>(쉼표나 띄어쓰기로 구분, 5개까지)</small>
        <input name="tags" value={form.tags} onChange={change} placeholder="예: 인공지능, AI" />
      </label>

      <div className="editor-field">
        <span id="image-label">
          대표 이미지 <small>(선택, jpg·png·webp·gif, {MAX_IMAGE_MB}MB 이하)</small>
        </span>

        {/* 실제 파일 선택 칸은 숨기고, 아래 상자·버튼으로 연다 */}
        <input
          ref={fileInput}
          type="file"
          accept={IMAGE_TYPES.join(',')}
          hidden
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {form.image_url ? (
          <div className="image-preview">
            <img src={form.image_url} alt="대표 이미지 미리보기" />
            <div className="image-preview-actions">
              <button type="button" className="outline-btn" onClick={() => fileInput.current?.click()} disabled={uploading}>
                {uploading ? '올리는 중…' : '변경'}
              </button>
              <button
                type="button"
                className="outline-btn danger"
                onClick={() => setForm({ ...form, image_url: '' })}
                disabled={uploading}
              >
                삭제
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className={dragOver ? 'dropzone over' : 'dropzone'}
            aria-labelledby="image-label"
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            disabled={uploading}
          >
            <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5"
              />
            </svg>
            {uploading ? '올리는 중…' : '클릭하거나 이미지를 끌어다 놓으세요'}
          </button>
        )}
      </div>

      {error && <p className="board-error" role="alert">{error}</p>}

      <div className="editor-actions">
        <button type="button" className="outline-btn" onClick={onCancel} disabled={saving}>
          취소
        </button>
        <button type="submit" className="primary-btn" disabled={saving || uploading}>
          {saving ? '저장 중…' : post ? '수정 완료' : '등록'}
        </button>
      </div>
    </form>
  )
}
