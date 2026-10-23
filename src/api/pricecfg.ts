import request from '@/utils/request';

const api = {
  GetAllSubAccounts(data?: any) {
    return request({ url: '/api/pricecfg/GetAllSubAccounts', method: 'post', data });
  },
  AddOrModifySubAccount(data?: any) {
    return request({ url: '/api/pricecfg/AddOrModifySubAccount', method: 'post', data });
  },
  DelSubAccount(data?: any) {
    return request({ url: '/api/pricecfg/DelSubAccount', method: 'post', data });
  },
};

export default api;
