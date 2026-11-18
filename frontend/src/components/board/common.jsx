// 게시판 화면에서 같이 쓰는 작은 화면 조각들 (값·함수는 utils.js)

// 프로필 사진 대신: username 첫 글자 + username 으로 정해지는 색
const AVATAR_COLORS = ['#7c5cd6', '#1f8a70', '#d9534f', '#e08a00', '#2f6fde', '#c2417a', '#4a7c2a', '#5b6b7d']

export function Avatar({ name = '?', size = 40 }) {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)) >>> 0
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.42, background: AVATAR_COLORS[hash % AVATAR_COLORS.length] }}
      aria-hidden="true"
    >
      {[...name][0]?.toUpperCase()}
    </span>
  )
}

// 좋아요 버튼 (엄지 아이콘 + 숫자)
export function LikeButton({ count, liked, onClick, disabled }) {
  return (
    <button
      type="button"
      className={liked ? 'like-btn liked' : 'like-btn'}
      onClick={(e) => {
        e.stopPropagation() // 카드 클릭(글 열기)으로 번지지 않게
        onClick()
      }}
      disabled={disabled}
      aria-pressed={liked}
      aria-label={`좋아요 ${count}개${liked ? ', 누름' : ''}`}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          fill={liked ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
          d="M7 10v11H3V10h4zm0 0 4.2-7.3a1.8 1.8 0 0 1 3.3 1.3L13.6 9H19a2 2 0 0 1 2 2.3l-1.3 7.7a2.4 2.4 0 0 1-2.4 2H7"
        />
      </svg>
      {count}
    </button>
  )
}

export function Tags({ tags }) {
  if (!tags?.length) return null
  return (
    <ul className="tags">
      {tags.map((tag) => (
        <li key={tag} className="tag">
          {tag}
        </li>
      ))}
    </ul>
  )
}
