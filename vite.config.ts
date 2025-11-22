import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  base: '/memo-curve/', // <--- 这里改成你的仓库名，前后都要有斜杠
  build: {
    outDir: 'dist', // 默认输出到 dist，部署脚本会将其复制到 public
  }
})