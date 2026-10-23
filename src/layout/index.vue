<template>
  <div class="erp-layout">
    <!-- 顶部栏 -->
    <header class="erp-topbar">
      <div class="erp-topbar-left">
        <h2 class="erp-logo">LiteERP</h2>
      </div>
      <div class="erp-topbar-right">
        <el-dropdown @command="handleCommand">
          <span class="erp-user-info">
            <el-icon><User /></el-icon>
            {{ displayName }}
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="profile" divided>
                <div class="erp-dropdown-user">
                  <span class="erp-dropdown-name">{{ displayName }}</span>
                  <span v-if="userStore.RoleName" class="erp-dropdown-role">{{ userStore.RoleName }}</span>
                </div>
              </el-dropdown-item>
              <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>

    <!-- 内容区 -->
    <main class="erp-main">
      <!-- 模块导航 -->
      <nav class="erp-nav">
        <a
          v-for="mod in modules"
          :key="mod.path"
          class="erp-nav-item"
          :class="{ active: currentModule === mod.module }"
          @click="router.push(mod.path)"
        >{{ mod.title }}</a>
      </nav>

      <!-- 二级导航（前台模块） -->
      <nav v-if="currentModule === 'front'" class="erp-subnav">
        <a
          v-for="item in frontdeskNav"
          :key="item.path"
          class="erp-subnav-item"
          :class="{ active: currentPath === item.path }"
          @click="router.push(item.path)"
        >{{ item.title }}</a>
      </nav>

      <!-- 二级导航（财务模块） -->
      <nav v-if="currentModule === 'fin'" class="erp-subnav">
        <a
          v-for="item in financeNav"
          :key="item.path"
          class="erp-subnav-item"
          :class="{ active: currentPath === item.path }"
          @click="router.push(item.path)"
        >{{ item.title }}</a>
      </nav>

      <!-- 二级导航（生产模块） -->
      <nav v-if="currentModule === 'prod'" class="erp-subnav">
        <a
          v-for="item in productionNav"
          :key="item.path"
          class="erp-subnav-item"
          :class="{ active: currentPath === item.path }"
          @click="router.push(item.path)"
        >{{ item.title }}</a>
      </nav>

      <!-- 二级导航（报表模块） -->
      <nav v-if="currentModule === 'rpt'" class="erp-subnav">
        <a
          v-for="item in reportsNav"
          :key="item.path"
          class="erp-subnav-item"
          :class="{ active: currentPath === item.path }"
          @click="router.push(item.path)"
        >{{ item.title }}</a>
      </nav>

      <!-- 二级导航（客户模块） -->
      <nav v-if="currentModule === 'cust'" class="erp-subnav">
        <a
          v-for="item in customerNav"
          :key="item.path"
          class="erp-subnav-item"
          :class="{ active: currentPath === item.path }"
          @click="router.push(item.path)"
        >{{ item.title }}</a>
      </nav>

      <!-- 二级导航（系统模块） -->
      <nav v-if="currentModule === 'sys'" class="erp-subnav">
        <a
          v-for="item in systemNav"
          :key="item.path"
          class="erp-subnav-item"
          :class="{ active: currentPath === item.path }"
          @click="router.push(item.path)"
        >{{ item.title }}</a>
      </nav>

      <router-view v-if="isRefresh" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, provide, onBeforeMount } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useUserStore } from '@/store';
import api from '@/api';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const isRefresh = ref(true);

const displayName = computed(() => {
  return userStore.NickName || userStore.UserName || userStore.userInfo?.UserName || '未登录';
});

const fetchUserComInfo = async () => {
  if (!userStore.token) return;
  try {
    const res: any = await api.user.getUserInfo();
    if (res?.Data) {
      userStore.setUserInfo(res.Data);
      userStore.setUserBasic(res.Data);
    }
  } catch {
    // token 过期时拦截器会跳转登录页
  }
};

onBeforeMount(() => {
  fetchUserComInfo();
});

provide('refreshPage', () => {
  isRefresh.value = false;
  nextTick(() => {
    isRefresh.value = true;
  });
});

const modules = [
  { title: '前台', path: '/frontdesk', module: 'front' },
  { title: '生产', path: '/production', module: 'prod' },
  { title: '财务', path: '/finance', module: 'fin' },
  { title: '客户', path: '/customer', module: 'cust' },
  { title: '报表', path: '/reports', module: 'rpt' },
  { title: '系统', path: '/system', module: 'sys' },
];

const frontdeskNav = [
  { title: '前台业务中心', path: '/frontdesk' },
  { title: '新建工单', path: '/frontdesk/newOrder' },
  { title: '工单记录', path: '/frontdesk/orderRecords' },
  { title: '云端业务中心', path: '/frontdesk/cloudCenter' },
  { title: '结算记录', path: '/frontdesk/settleRecords' },
  { title: '预存储值', path: '/frontdesk/prestore' },
  { title: '预存记录', path: '/frontdesk/prestoreRecords' },
  { title: '会员卡资料', path: '/frontdesk/cardInfo' },
  { title: '营业日报', path: '/frontdesk/dailyReport' },
  { title: '零收', path: '/frontdesk/miscIncome' },
  { title: '零收记录', path: '/frontdesk/miscIncomeRecords' },
];

const financeNav = [
  { title: '财务业务中心', path: '/finance' },
  { title: '智多结算中心', path: '/finance/smartSettle' },
  { title: '现金余额', path: '/finance/cashBalance' },
  { title: '银行余额', path: '/finance/bankBalance' },
  { title: '转账记录', path: '/finance/transferRecords' },
  { title: '客户结余', path: '/finance/custBalance' },
  { title: '应收汇总', path: '/finance/arSummary' },
  { title: '客户对账', path: '/finance/custStatement' },
  { title: '销账记录', path: '/finance/writeOffRecords' },
  { title: '收支记录', path: '/finance/generalRecords' },
  { title: '期末结账', path: '/finance/periodClose' },
  { title: '会计日历', path: '/finance/accountCalendar' },
];

const productionNav = [
  { title: '生产业务中心', path: '/production' },
  { title: '制作明细记录', path: '/production/prodDetail' },
];

const reportsNav = [
  { title: '报表中心', path: '/reports' },
  { title: '业务提醒', path: '/reports/bizAlert' },
  { title: '营业收支汇总', path: '/reports/incomeExpense' },
  { title: '工单结算汇总', path: '/reports/orderSettle' },
  { title: '经营项目汇总', path: '/reports/itemsSummary' },
  { title: '客户价值分析', path: '/reports/custValue' },
  { title: '客户新增汇总', path: '/reports/custNew' },
  { title: '会员办卡汇总', path: '/reports/cardSummary' },
  { title: '实收排行', path: '/reports/custRevenueRank' },
  { title: '均价排行', path: '/reports/custAvgRank' },
  { title: '数量排行', path: '/reports/custCountRank' },
];

const customerNav = [
  { title: '客户资料', path: '/customer' },
  { title: '联络人员', path: '/customer/contacts' },
  { title: '分组价格', path: '/customer/groupPrice' },
  { title: '协议价格', path: '/customer/agreementPrice' },
  { title: '客户合并', path: '/customer/custMerge' },
];

const systemNav = [
  { title: '员工资料', path: '/system' },
  { title: '经营项目', path: '/system/bizItems' },
  { title: '客户分组', path: '/system/custGroups' },
  { title: '生产流程', path: '/system/prodFlow' },
  { title: '会计科目', path: '/system/chartOfAccounts' },
  { title: '角色权限', path: '/system/roles' },
  { title: '运行参数', path: '/system/runParams' },
  { title: '打印样式', path: '/system/printStyles' },
  { title: '基础数据', path: '/system/baseData' },
  { title: '数据导入', path: '/system/dataImport' },
];

const currentModule = computed(() => {
  return (route.meta.module as string) || 'front';
});

const currentPath = computed(() => {
  return route.path;
});

const handleCommand = (command: string) => {
  if (command === 'logout') {
    userStore.clearToken();
    router.push('/login');
    window.localStorage.clear();
  }
};
</script>

<style scoped lang="scss">
.erp-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.erp-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 50px;
  padding: 0 var(--erp-space-6);
  background: var(--erp-surface);
  border-bottom: 1px solid var(--erp-line);
  flex-shrink: 0;
  z-index: 100;
}

.erp-logo {
  font-size: 18px;
  font-weight: 700;
  color: var(--erp-primary);
  margin: 0;
}

.erp-user-info {
  display: flex;
  align-items: center;
  gap: var(--erp-space-2);
  cursor: pointer;
  font-size: var(--erp-table-size);
  color: var(--erp-text);

  &:hover {
    color: var(--erp-primary);
  }
}

.erp-main {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.erp-nav {
  display: flex;
  gap: var(--erp-space-1);
  padding: 0 var(--erp-space-6);
  background: var(--erp-surface);
  border-bottom: 1px solid var(--erp-line);
  flex-shrink: 0;
}

.erp-nav-item {
  padding: var(--erp-space-3) var(--erp-space-4);
  font-size: var(--erp-table-size);
  color: var(--erp-text-soft);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;

  &:hover {
    color: var(--erp-primary);
  }

  &.active {
    color: var(--erp-primary);
    border-bottom-color: var(--erp-primary);
    font-weight: 500;
  }
}

.erp-subnav {
  display: flex;
  flex-wrap: wrap;
  gap: var(--erp-space-1);
  padding: var(--erp-space-3) var(--erp-space-6);
  background: var(--erp-bg);
  border-bottom: 1px solid var(--erp-line);
  flex-shrink: 0;
}

.erp-subnav-item {
  padding: var(--erp-space-1) var(--erp-space-3);
  font-size: 13px;
  color: var(--erp-text-soft);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;

  &:hover {
    color: var(--erp-primary);
    background: var(--erp-surface);
  }

  &.active {
    color: var(--erp-primary);
    background: var(--erp-surface);
    font-weight: 500;
  }
}

.erp-dropdown-user {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 0;
}

.erp-dropdown-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--erp-text);
}

.erp-dropdown-role {
  font-size: 12px;
  color: var(--erp-text-soft);
}
</style>
