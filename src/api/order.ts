import request from '@/utils/request';

const api = {
  GetList(data?: any) {
    return request({ url: '/api/OrderMan/GetOrderList', method: 'post', data });
  },
  GetDetail(data?: any) {
    return request({ url: '/api/OrderMan/GetOrderDetails', method: 'post', data });
  },
  Save(data?: any) {
    return request({ url: '/api/OrderMan/CrtEmptyOrderInfo', method: 'post', data });
  },
  Delete(data?: any) {
    return request({ url: '/api/OrderMan/ChgOrderStatus', method: 'post', data });
  },
  CopyOrder(data?: any) {
    return request({ url: '/api/OrderMan/CopyOrder', method: 'post', data });
  },
  PrintReceipt(data?: any) {
    return request({ url: '/api/OrderMan/PrintReceipt', method: 'post', data });
  },
  PrintJSD(data?: any) {
    return request({ url: '/api/OrderMan/PrintJSD', method: 'post', data });
  },
};

export default api;
