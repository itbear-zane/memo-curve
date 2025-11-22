import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/memo-curve/', // <--- 这里改成你的仓库名，前后都要有斜杠
})