import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // React 에서 /api/signup 으로 요청하면 → FastAPI http://127.0.0.1:8000/signup 으로 전달
    // (브라우저 입장에서는 같은 주소라 CORS 설정이 필요 없다)
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
