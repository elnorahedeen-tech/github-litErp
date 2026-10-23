import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import router from './router';
import App from './App.vue';
import api from './api';
import { useUserStore } from './store';
import '@/styles/global.scss';
import '@/styles/element.scss';

const app = createApp(App);
const pinia = createPinia();

// 注册所有 Element Plus 图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

app.use(pinia);
app.use(router);
app.use(ElementPlus, { locale: zhCn, zIndex: 3000 });

// 全局属性 - 参考 icft_proj1
app.config.globalProperties.$api = api;

app.mount('#app');
