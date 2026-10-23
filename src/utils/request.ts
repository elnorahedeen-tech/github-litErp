import axios from 'axios';
import { ElMessage } from 'element-plus';
import { getStorage } from './local';
import { useUserStore } from '@/store';

const http = axios.create({
  baseURL: '',
  timeout: 1000 * 600,
});

let isReloading = false;

http.interceptors.request.use((config) => {
  const token = getStorage('Token');
  if (token) {
    config.headers['token'] = token;
  }
  config.headers['apikey'] = '6388e2c694f6401ea8fbba986804dcdc';
  const DepCode = useUserStore().DepCode;
  if (DepCode && config.data && !config.data.DepCode) {
    config.data['DepCode'] = DepCode;
  }
  return config;
});

http.interceptors.response.use(
  (response) => {
    const res = response.data;
    const RespCode = Number(res.RespCode);
    if (RespCode < 0) {
      if (res.RespMsg === 'Token已过期' && !isReloading) {
        isReloading = true;
        localStorage.clear();
        window.location.hash = '#/login';
        window.location.reload();
      } else if (!(response.config as any)?.silentError) {
        ElMessage.warning(res.RespMsg || '请求失败');
      }
      return Promise.reject(res);
    }
    return res;
  },
  (error) => {
    const status = error.response?.status;
    if (status === 401) {
      if (!isReloading) {
        isReloading = true;
        localStorage.clear();
        window.location.hash = '#/login';
        window.location.reload();
      }
    } else if (status === 403) {
      ElMessage.error('无权限访问');
    } else if (status === 404) {
      ElMessage.error('请求资源不存在');
    } else if (status === 500) {
      ElMessage.error('服务器错误');
    } else if (status === 502) {
      ElMessage.error('网关错误');
    }
    return Promise.reject(error);
  },
);

export default http;
