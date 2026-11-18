// 게시판에서 같이 쓰는 값·함수 (화면 조각은 common.jsx)

// 글 분류 — FastAPI 의 CATEGORIES 와 같은 목록
export const CATEGORIES = ['시민질문', '뉴스', '소식', '캠페인', '토론', '팩트체크', '모임']

const PROVIDER_LABEL = { email: '이메일 회원', kakao: '카카오 회원', google: '구글 회원' }

export function providerLabel(provider) {
  return PROVIDER_LABEL[provider] ?? '회원'
}

// "3분 전", "2일 전", 일주일이 넘으면 날짜
export function timeAgo(iso) {
  const date = new Date(iso)
  const sec = (Date.now() - date.getTime()) / 1000
  if (sec < 60) return '방금 전'
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)}일 전`
  return date.toLocaleDateString('ko-KR')
}
