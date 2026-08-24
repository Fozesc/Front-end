import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: true,
    port: 5173,
    // --- ADICIONADO P/ RODAR LOCAL ---
    // Em producao o nginx faz "location /api -> backend:5001" (ver nginx.conf).
    // Em dev o Vite nao tem esse proxy, entao o front chamaria /api em localhost:5173
    // (que nao existe). Este proxy replica o nginx: encaminha /api -> backend local,
    // mantendo o path /api intacto (mesmo comportamento do nginx, sem rewrite).
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true
      }
    }
  }
})