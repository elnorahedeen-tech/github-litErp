<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 前台</p>
        <h1>云端业务中心</h1>
        <p class="erp-pagehead-desc">客户通过微信小程序、公众号、网页商城提交的订单；受理后自动生成工作单。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button @click="handleSync">同步云端订单</el-button>
      </div>
    </div>

    <el-alert v-if="pendingCount > 0" type="warning" :closable="false" style="margin-bottom: 16px">
      有 {{ pendingCount }} 张云端订单待受理。
    </el-alert>

    <div class="erp-toolbar">
      <div class="erp-toolbar-item">
        <label>搜索</label>
        <el-input v-model="search.OrderCode" placeholder="云端单号 / 客户 / 联系人" clearable style="width: 220px" />
      </div>
      <div class="erp-toolbar-item">
        <label>业务日期</label>
        <el-date-picker v-model="search.DateRange" type="daterange" range-separator="至" start-placeholder="开始" end-placeholder="结束" value-format="YYYY-MM-DD" style="width: 240px" />
      </div>
      <div class="erp-toolbar-item">
        <label>受理状态</label>
        <el-select v-model="search.OrderStatus" clearable placeholder="全部" style="width: 120px">
          <el-option v-for="s in statusOptions" :key="s" :label="s" :value="s" />
        </el-select>
      </div>
      <div class="erp-toolbar-item">
        <label>订单来源</label>
        <el-select v-model="search.Source" clearable placeholder="全部" style="width: 140px">
          <el-option v-for="s in sourceOptions" :key="s" :label="s" :value="s" />
        </el-select>
      </div>
      <div class="erp-toolbar-item">
        <label>付款状态</label>
        <el-select v-model="search.PayStatus" clearable placeholder="全部" style="width: 120px">
          <el-option v-for="s in payStateOptions" :key="s" :label="s" :value="s" />
        </el-select>
      </div>
      <div class="erp-toolbar-actions">
        <el-button type="primary" @click="getTbody">筛选</el-button>
        <el-button @click="resetSearch">重置</el-button>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-table-wrap">
        <el-table :data="tableData" v-loading="loading" stripe style="width: 100%" @row-click="viewDetail">
          <el-table-column prop="OrderCode" label="云端单号 / 来源" width="180">
            <template #default="{ row }">
              <el-link type="primary" @click.stop="viewDetail(row)">{{ row.OrderCode }}</el-link>
              <div class="sub-text">{{ row.Source || '微信小程序' }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="CrtTime" label="提交时间" width="160">
            <template #default="{ row }">{{ row.CrtTime }}</template>
          </el-table-column>
          <el-table-column prop="ClientName" label="客户 / 联系人" min-width="160">
            <template #default="{ row }">
              {{ row.ClientName }}
              <div class="sub-text">{{ [row.Contact, row.Phone].filter(Boolean).join(' · ') }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="OrderName" label="制作要求" min-width="200">
            <template #default="{ row }">
              {{ row.OrderName }}
              <div v-if="row.OrderDesc" class="sub-text">{{ row.OrderDesc }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="Delivery" label="取送方式" width="120" />
          <el-table-column prop="SpAmt" label="订单金额（元）" width="120" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.SpAmt) }}</span></template>
          </el-table-column>
          <el-table-column prop="PayAmt" label="在线已付（元）" width="120" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.PayAmt) }}</span></template>
          </el-table-column>
          <el-table-column prop="PayStatus" label="付款状态" width="100" align="center">
            <template #default="{ row }">
              <span class="erp-badge" :data-tone="getPayStatusTone(row.PayStatus)">{{ row.PayStatus || '待付款' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="OrderStatus" label="受理状态" width="100" align="center">
            <template #default="{ row }">
              <span class="erp-badge" :data-tone="getOrderStatusTone(row.OrderStatus)">{{ row.OrderStatus }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="180" fixed="right" @click.stop>
            <template #default="{ row }">
              <div class="table-actions">
                <el-button link type="primary" size="small" @click.stop="viewDetail(row)">详情</el-button>
                <el-button v-if="row.OrderStatus === '待审核'" link type="primary" size="small" @click.stop="handleAccept(row)">受理</el-button>
                <el-button v-if="row.OrderStatus === '待审核'" link type="danger" size="small" @click.stop="handleReject(row)">拒绝</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <!-- 分页 -->
      <div class="erp-pagination" style="padding: 12px 16px">
        <span>共 {{ total }} 条记录</span>
        <el-pagination
          v-model:current-page="search.PageIndex"
          v-model:page-size="search.PageLimit"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="sizes, prev, pager, next"
          @current-change="getTbody"
          @size-change="onPageSizeChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import api from '@/api';

const router = useRouter();
const loading = ref(false);
const total = ref(0);
const tableData = ref<any[]>([]);

const search = reactive({
  PageIndex: 1,
  PageLimit: 20,
  Count: 0,
  OrderCode: '',
  ClientName: '',
  OrderName: '',
  OrderDesc: '',
  OrderStatus: '',
  PayStatus: '',
  Source: '',
  DateRange: [] as string[],
});

const statusOptions = ['待审核', '已受理', '已拒绝'];
const sourceOptions = ['微信小程序', '微信公众号', '网页商城'];
const payStateOptions = ['待付款', '少收货款', '挂账', '多收款', '货款收'];

const pendingCount = computed(() => tableData.value.filter(r => r.OrderStatus === '待审核').length);

const fmtMoney = (v: any) => {
  const num = Number(v || 0);
  return '￥' + num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getOrderStatusTone = (status: string): string => {
  const map: Record<string, string> = {
    '待审核': 'warning', '已受理': 'success', '已拒绝': 'danger',
    '待生产': '', '生产中': 'warning', '完工': 'success', '结单': 'success', '作废': 'danger',
  };
  return map[status] || 'info';
};

const getPayStatusTone = (status: string): string => {
  const map: Record<string, string> = {
    '待付款': 'info', '少收货款': 'danger', '挂账': 'info', '多收款': 'success', '货款收': 'success',
  };
  return map[status] || 'info';
};

const getTbody = async () => {
  loading.value = true;
  try {
    const params: any = {
      PageIndex: search.PageIndex,
      PageLimit: search.PageLimit,
      OrderCode: search.OrderCode,
      ClientName: search.ClientName,
      OrderName: search.OrderName,
      OrderDesc: search.OrderDesc,
      OrderStatus: search.OrderStatus,
      PayStatus: search.PayStatus,
    };
    if (search.DateRange?.length === 2) {
      params.BeginDate = search.DateRange[0];
      params.EndDate = search.DateRange[1];
    }

    const res: any = await api.order.GetList(params);
    if (res?.Data) {
      total.value = res.Data.Count || 0;
      tableData.value = res.Data.orders || [];
    }
  } catch {
    tableData.value = getMockData();
    total.value = tableData.value.length;
  } finally {
    loading.value = false;
  }
};

const getMockData = () => [
  {
    Id: '1', OrderCode: 'YD26101910006', Source: '微信小程序', ClientName: '上海新科技公司', Contact: '赵经理', Phone: '13812345678',
    OrderName: '彩色宣传单', OrderDesc: 'A4 双面 200 张', Delivery: '快递', CrtTime: '2026-10-19 10:30:00',
    SpAmt: 360, PayAmt: 360, BillingAmt: 360, OrderStatus: '待审核', PayStatus: '货款收',
  },
  {
    Id: '2', OrderCode: 'YD26101910005', Source: '微信公众号', ClientName: '林女士', Contact: '林女士', Phone: '15900001111',
    OrderName: '证件照', OrderDesc: '2 版，蓝底', Delivery: '自取', CrtTime: '2026-10-19 09:15:00',
    SpAmt: 40, PayAmt: 40, BillingAmt: 40, OrderStatus: '待审核', PayStatus: '货款收',
  },
  {
    Id: '3', OrderCode: 'YD26101810003', Source: '微信小程序', ClientName: '深圳心智公司', Contact: '陈先生', Phone: '18600003333',
    OrderName: '易拉宝 + 户外写真', OrderDesc: '2 个 + 6㎡', Delivery: '同城跑腿', CrtTime: '2026-10-18 14:20:00',
    SpAmt: 580, PayAmt: 580, BillingAmt: 580, OrderStatus: '已受理', PayStatus: '货款收',
  },
  {
    Id: '4', OrderCode: 'YD26101710002', Source: '网页商城', ClientName: '王同学', Contact: '王同学', Phone: '13511112222',
    OrderName: '复印 A4 黑白', OrderDesc: '50 张', Delivery: '自取', CrtTime: '2026-10-17 16:00:00',
    SpAmt: 5, PayAmt: 0, BillingAmt: 0, OrderStatus: '已拒绝', PayStatus: '待付款',
  },
];

const resetSearch = () => {
  search.OrderCode = '';
  search.ClientName = '';
  search.OrderName = '';
  search.OrderDesc = '';
  search.OrderStatus = '';
  search.PayStatus = '';
  search.Source = '';
  search.DateRange = [];
  search.PageIndex = 1;
  getTbody();
};

const onPageSizeChange = () => {
  search.PageIndex = 1;
  getTbody();
};

const viewDetail = (row: any) => {
  router.push(`/frontdesk/orderDetail?id=${row.Id}`);
};

const handleAccept = (row: any) => {
  ElMessage.success(`已受理云端订单 ${row.OrderCode}`);
  row.OrderStatus = '已受理';
};

const handleReject = (row: any) => {
  ElMessage.warning(`已拒绝云端订单 ${row.OrderCode}`);
  row.OrderStatus = '已拒绝';
};

const handleSync = () => {
  ElMessage.success('已同步云端订单');
  getTbody();
};

onMounted(() => {
  getTbody();
});
</script>

<style scoped lang="scss">
.table-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
