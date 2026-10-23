<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 客户</p>
        <h1>客户 {{ custInfo.ClientCode }} {{ custInfo.ClientName }}</h1>
        <p class="erp-pagehead-desc">客户综合信息，包括账务、工单、联络人员等。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button type="primary" @click="editCustomer">编辑资料</el-button>
        <el-button @click="router.push('/customer/agreementPrice?code=' + custInfo.ClientCode)">协议价格</el-button>
        <el-button @click="router.push('/customer/contacts?cust=' + custInfo.ClientCode)">联络人员</el-button>
        <el-button @click="router.back()">返回</el-button>
      </div>
    </div>

    <div v-loading="loading">
      <!-- 账务概况 -->
      <div class="erp-panel" style="margin-bottom: 16px">
        <div class="erp-panelhead"><h2>账务概况</h2></div>
        <div class="erp-panelbody">
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-label">欠款（元）</div>
              <div class="summary-value mono-cell">{{ fmtMoney(custInfo.Debt) }}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">预存余额（元）</div>
              <div class="summary-value mono-cell">{{ fmtMoney(custInfo.PrestoreBalance) }}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">结余（元）</div>
              <div class="summary-value mono-cell">{{ fmtMoney((custInfo.PrestoreBalance || 0) - (custInfo.Debt || 0)) }}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">累计结算（元）</div>
              <div class="summary-value mono-cell">{{ fmtMoney(custInfo.TotalSettlement) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 联络人员 -->
      <div class="erp-panel" style="margin-bottom: 16px">
        <div class="erp-panelhead">
          <h2>联络人员（{{ contacts.length }}）</h2>
          <div class="erp-panelhead-actions">
            <el-button type="primary" size="small" @click="addContact">新建联络人员</el-button>
          </div>
        </div>
        <div class="erp-table-wrap">
          <el-table :data="contacts" stripe style="width: 100%">
            <el-table-column prop="Name" label="姓名" width="120">
              <template #default="{ row }">
                {{ row.Name }}
                <div class="sub-text">{{ row.CallName }}</div>
              </template>
            </el-table-column>
            <el-table-column prop="ContactType" label="人员类型" width="100" align="center">
              <template #default="{ row }">
                <span class="erp-badge" :data-tone="row.ContactType === '决策人' ? 'success' : ''">{{ row.ContactType }}</span>
              </template>
            </el-table-column>
            <el-table-column label="部门 / 职务" width="140">
              <template #default="{ row }">{{ [row.Department, row.Title].filter(Boolean).join(' · ') || '—' }}</template>
            </el-table-column>
            <el-table-column prop="Mobile" label="手机" width="130">
              <template #default="{ row }"><span class="mono-text">{{ row.Mobile || '未提供' }}</span></template>
            </el-table-column>
            <el-table-column prop="Phone" label="固定电话" width="140">
              <template #default="{ row }"><span class="mono-text">{{ row.Phone || '—' }}</span></template>
            </el-table-column>
            <el-table-column prop="Email" label="电子邮件" min-width="160" :show-overflow-tooltip="true" />
            <el-table-column label="操作" width="80" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="editContact(row)">编辑</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="contacts.length === 0" description="尚无联络人员" :image-size="60" />
        </div>
      </div>

      <!-- 工单记录 -->
      <div class="erp-panel" style="margin-bottom: 16px">
        <div class="erp-panelhead"><h2>工单记录（{{ workOrders.length }}）</h2></div>
        <div class="erp-table-wrap">
          <el-table :data="workOrders" stripe style="width: 100%">
            <el-table-column prop="OrderCode" label="工单号" width="150">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="viewOrder(row)"><span class="mono-text">{{ row.OrderCode }}</span></el-button>
              </template>
            </el-table-column>
            <el-table-column prop="OrderName" label="订单名称" min-width="200" />
            <el-table-column prop="CrtTime" label="开单日期" width="120">
              <template #default="{ row }">{{ row.CrtTime ? row.CrtTime.slice(0, 10) : '—' }}</template>
            </el-table-column>
            <el-table-column prop="SpAmt" label="金额（元）" width="110" align="right">
              <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.SpAmt) }}</span></template>
            </el-table-column>
            <el-table-column prop="OrderStatus" label="状态" width="100" align="center">
              <template #default="{ row }">
                <span class="erp-badge" :data-tone="getStatusTone(row.OrderStatus)">{{ row.OrderStatus }}</span>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="workOrders.length === 0" description="尚无工单记录" :image-size="60" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import api from '@/api';

const router = useRouter();
const route = useRoute();
const loading = ref(false);
const custInfo = ref<any>({});
const contacts = ref<any[]>([]);
const workOrders = ref<any[]>([]);

const fmtMoney = (v: any) => '￥' + Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const getStatusTone = (status: string): string => {
  const map: Record<string, string> = {
    '待审核': 'info',
    '待生产': '',
    '生产中': 'warning',
    '完工': 'success',
    '结单': 'success',
    '作废': 'danger',
  };
  return map[status] || 'info';
};

const loadCustomerDetail = async () => {
  const code = route.query.code as string;
  if (!code) {
    ElMessage.error('缺少客户编号');
    return;
  }
  loading.value = true;
  try {
    const res: any = await api.customer.GetSigCustomerBasic({ ClientCode: code });
    if (res?.Data) {
      custInfo.value = res.Data;
    }
  } catch (e) {
    console.error('加载客户详情失败', e);
  }
  loading.value = false;
};

const loadContacts = async () => {
  const code = route.query.code as string;
  if (!code) return;
  try {
    const res: any = await api.pricecfg.GetAllSubAccounts({ ClientCode: code });
    if (res?.Data) {
      contacts.value = Array.isArray(res.Data) ? res.Data : [];
    }
  } catch (e) {
    console.error('加载联络人员失败', e);
    contacts.value = [];
  }
};

const loadWorkOrders = async () => {
  const code = route.query.code as string;
  if (!code) return;
  try {
    const res: any = await api.order.GetList({ ClientCode: code, PageIndex: 1, PageLimit: 50 });
    if (res?.Data?.orders) {
      workOrders.value = res.Data.orders;
    }
  } catch (e) {
    console.error('加载工单记录失败', e);
    workOrders.value = [];
  }
};

const editCustomer = () => {
  router.push(`/customer/edit?code=${custInfo.value.ClientCode}`);
};

const addContact = () => {
  router.push(`/customer/contactEdit?cust=${custInfo.value.ClientCode}`);
};

const editContact = (row: any) => {
  router.push(`/customer/contactEdit?id=${row.RecId}&cust=${custInfo.value.ClientCode}`);
};

const viewOrder = (row: any) => {
  router.push(`/frontdesk/orderDetail?id=${row.Id}`);
};

onMounted(() => {
  loadCustomerDetail();
  loadContacts();
  loadWorkOrders();
});
</script>

<style scoped lang="scss">
.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.summary-item {
  padding: 12px 16px;
  border: 1px solid var(--erp-line);
  border-radius: 6px;
  background: var(--erp-bg);
}

.summary-label {
  font-size: 13px;
  color: var(--erp-muted);
  margin-bottom: 4px;
}

.summary-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--erp-ink);
}

.mono-cell {
  font-family: var(--erp-font-mono);
  font-variant-numeric: tabular-nums;
}

.mono-text {
  font-family: var(--erp-font-mono);
  font-variant-numeric: tabular-nums;
}

.sub-text {
  font-size: 12px;
  color: var(--erp-muted);
  margin-top: 2px;
}
</style>
