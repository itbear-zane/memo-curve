import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'
  const isDevelopment = mode === 'development'

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    base: isProduction ? '/memo-curve/' : '/', // 开发环境使用根路径，生产环境使用 GitHub Pages 路径
    build: {
      outDir: 'dist', // 默认输出到 dist，部署脚本会将其复制到 public
      sourcemap: isDevelopment, // 开发环境生成 sourcemap 便于调试
      rollupOptions: {
        output: {
          manualChunks: mode === 'analyze' ? {
            vendor: ['react', 'react-dom'],
            ui: ['lucide-react']
          } : undefined
        } as any
      }
    },
    server: {
      port: 3000,
      open: true, // 自动打开浏览器
      cors: true, // 启用 CORS
    },
    preview: {
      port: 4173,
      open: true,
    },
    define: {
      __DEV__: isDevelopment,
      __PROD__: isProduction
    }
  }
})