// 소셜 로그인 버튼 (회원가입·로그인 화면 공통)
//  - 카카오: FastAPI GET /login/kakao 로 이동 → 카카오 로그인 화면(닉네임·사진만 동의)
//            → FastAPI /auth/kakao/callback (ID 토큰으로 Supabase 로그인)
//  - 구글  : FastAPI GET /login/google 로 이동 → Supabase → 구글 로그인 화면
//            → Supabase → FastAPI /auth/callback (code 를 토큰으로 교환)
//  둘 다 끝나면 이 화면(#access_token=...)으로 돌아와 로그인 완료
export default function SocialLogin() {
  // 페이지 자체를 이동시킨다 (fetch 가 아님) — 카카오·구글 로그인 화면으로 넘어가야 하므로
  function start(provider) {
    window.location.href = `/api/login/${provider}`
  }

  return (
    <div className="social">
      <div className="divider" role="separator">
        <span>또는</span>
      </div>

      <button type="button" className="social-btn kakao" onClick={() => start('kakao')}>
        <KakaoIcon />
        카카오로 시작하기
      </button>
      <button type="button" className="social-btn google" onClick={() => start('google')}>
        <GoogleIcon />
        구글로 시작하기
      </button>
    </div>
  )
}

// 카카오 말풍선 심볼
function KakaoIcon() {
  return (
    <svg className="social-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#000"
        d="M12 3C6.48 3 2 6.48 2 10.78c0 2.78 1.86 5.22 4.66 6.6l-.95 3.5c-.08.3.26.55.53.38l4.13-2.74c.53.06 1.07.1 1.63.1 5.52 0 10-3.48 10-7.84S17.52 3 12 3z"
      />
    </svg>
  )
}

// 구글 G 로고
function GoogleIcon() {
  return (
    <svg className="social-icon" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}
