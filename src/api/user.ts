import request from '@/utils/request';

const api = {
  login(data?: any) {
    return request({
      url: '/api/pricetable/GetAuthToken',
      method: 'post',
      data,
    });
  },
  getUserInfo(data?: any) {
    return request({ url: '/api/AuthMan/GetUserComInfo', method: 'post', data });
  },
  GetAllSysUsers(data?: any) {
    return request({ url: '/api/AuthMan/GetAllSysUsers', method: 'post', data });
  },
  GetAllRoles(data?: any) {
    return request({ url: '/api/AuthMan/GetAllRoles', method: 'post', data });
  },
  GetAllDeps(data?: any) {
    return request({ url: '/api/AuthMan/GetAllDeps', method: 'post', data });
  },
};

export default api;
