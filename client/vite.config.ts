import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 로컬 개발: VITE_API_URL="" 로 두면 /api 를 같은 오리진으로 호출 → 아래 프록시가 백엔드로 전달.
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
