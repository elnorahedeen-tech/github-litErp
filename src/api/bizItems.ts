import request from '@/utils/request';

const api = {
  GetBizMainItems(data?: any) {
    return request({ url: '/api/SimpleErp/GetBizMainItems', method: 'post', data });
  },
  AddOrModifyBizMainItem(data?: any) {
    return request({ url: '/api/SimpleErp/AddOrModifyBizMainItem', method: 'post', data });
  },
  DeleteBizMainItem(data?: any) {
    return request({ url: '/api/SimpleErp/DeleteBizMainItem', method: 'post', data });
  },
  GetBizSubItems(data?: any) {
    return request({ url: '/api/SimpleErp/GetBizSubItems', method: 'post', data });
  },
  AddOrModifyBizSubItem(data?: any) {
    return request({ url: '/api/SimpleErp/AddOrModifyBizSubItem', method: 'post', data });
  },
  DeleteBizSubItem(data?: any) {
    return request({ url: '/api/SimpleErp/DeleteBizSubItem', method: 'post', data });
  },
};

export default api;
