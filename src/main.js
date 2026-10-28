import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'
import dica from './utils/dica'

const app = createApp(App)

app.use(router)
app.directive('dica', dica)

app.mount('#app')