import request from '@/utils/request';

const api = {
  QueryClientsInfos(data?: any) {
    return request({ url: '/api/CustomerMan/QueryClientsInfos', method: 'post', data });
  },
  AddOrModifyCustomer(data?: any) {
    return request({ url: '/api/CustomerMan/AddOrModifyCustomer', method: 'post', data });
  },
  GetSigCustomerBasic(data?: any) {
    return request({ url: '/api/CustomerMan/GetSigCustomerBasic', method: 'post', data });
  },
  DelCustomer(data?: any) {
    return request({ url: '/api/CustomerMan/DelCustomer', method: 'post', data });
  },
  GetAllCustTypes(data?: any) {
    return request({ url: '/api/CustomerMan/GetAllCustTypes', method: 'post', data });
  },
  BatchModifyCustomerPriceTable(data?: any) {
    return request({ url: '/api/CustomerMan/BatchModifyCustomerPriceTable', method: 'post', data });
  },
  TotalAmtAndPeriod(data?: any) {
    return request({ url: '/api/CustomerMan/TotalAmtAndPeriod', method: 'post', data });
  },
};

export default api;
