import request from '@/utils/request';

const api = {
  GetList(data?: any) {
    return request({ url: '/api/FinancialMan/GetReconList', method: 'post', data });
  },
  GetDetail(data?: any) {
    return request({ url: '/api/FinancialMan/GetReconDetail', method: 'post', data });
  },
  Save(data?: any) {
    return request({ url: '/api/FinancialMan/SaveRecon', method: 'post', data });
  },
  GetAllSkdInfos(data?: any) {
    return request({ url: '/api/FinancialMan/GetAllSkdInfos', method: 'post', data });
  },
};

export default api;
