import { defineStore } from 'pinia';
import { getStorage, setStorage, removeStorage } from '@/utils/local';

export const useUserStore = defineStore('user', {
  state: () => ({
    token: getStorage('Token') || '',
    userInfo: getStorage('userInfo') || {} as any,
    UserName: '',
    NickName: '',
    UserCode: '',
    RoleName: '',
    DepCode: '',
    CompanyCode: '',
    companyInfo: {} as any,
    menuList: [] as any[],
    pathArr: [] as string[],
    activeMenu: '',
    title: '',
    LogoUrl: '',
    WebCaseNum: '',
    systemSet: {} as any,
    isRefreshFlag: true,
  }),
  actions: {
    setToken(token: string) {
      this.token = token;
      setStorage('Token', token);
    },
    clearToken() {
      this.token = '';
      this.userInfo = {};
      this.UserName = '';
      this.NickName = '';
      this.UserCode = '';
      this.RoleName = '';
      this.DepCode = '';
      this.CompanyCode = '';
      window.localStorage.clear();
    },
    setUserInfo(info: any) {
      this.userInfo = info;
      setStorage('userInfo', info);
    },
    setUserBasic(row: any) {
      const basic = row.userBasic || row;
      this.UserName = basic.UserName || '';
      this.NickName = basic.NickName || '';
      this.UserCode = basic.UserCode || '';
      this.RoleName = Array.isArray(basic.roles)
        ? basic.roles.map((el: any) => el.RoleName).join('/')
        : (basic.RoleName || '');
      this.DepCode = basic.IsAdmin || basic.IsHeadquarter ? '' : (basic.DepCode || '');
      this.CompanyCode = basic.CompanyCode || '';
    },
    setMenuList(list: any[]) {
      this.menuList = list;
    },
  },
});
