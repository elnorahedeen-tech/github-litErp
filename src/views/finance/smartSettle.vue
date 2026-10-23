<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 财务</p>
        <h1>智多结算中心</h1>
        <p class="erp-pagehead-desc">尚未结清的工作单。勾选当前页工单后批量收款或转记账；单张收款点行内"收款"。</p>
      </div>
    </div>

    <div class="erp-toolbar">
      <div class="erp-toolbar-item">
        <label>搜索</label>
        <el-input v-model="search.q" placeholder="工单号 / 客户 / 制作要求" clearable style="width: 220px" />
      </div>
      <div class="erp-toolbar-item">
        <label>登记日期</label>
        <el-date-picker v-model="search.DateRange" type="daterange" range-separator="至" start-placeholder="开始" end-placeholder="结束" value-format="YYYY-MM-DD" style="width: 240px" />
      </div>
      <div class="erp-toolbar-item">
        <label>结算状态</label>
        <el-select v-model="search.settleStatus" clearable placeholder="全部" style="width: 130px">
          <el-option label="尚未结算" value="尚未结算" />
          <el-option label="部分结算" value="部分结算" />
        </el-select>
      </div>
      <div class="erp-toolbar-actions">
        <el-button type="primary" @click="getTbody">筛选</el-button>
        <el-button @click="resetSearch">重置</el-button>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-table-wrap">
        <el-table :data="filteredData" v-loading="loading" stripe style="width: 100%" @selection-change="onSelect">
          <el-table-column type="selection" width="44" />
          <el-table-column prop="OrderCode" label="工单 / 客户" width="220">
            <template #default="{ row }">
              <el-link type="primary" @click="viewDetail(row)">{{ row.OrderCode }}</el-link>
              <div class="sub-text">{{ row.ClientCode }} {{ row.ClientName }} · {{ row.GroupName }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="OrderName" label="制作任务 / 要求" min-width="160">
            <template #default="{ row }">
              {{ row.OrderName || '—' }}
              <div v-if="row.OrderDesc" class="sub-text">{{ row.OrderDesc }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="SpAmt" label="实收（元）" width="110" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.SpAmt) }}</span></template>
          </el-table-column>
          <el-table-column prop="PayAmt" label="已结（元）" width="110" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.PayAmt) }}</span></template>
          </el-table-column>
          <el-table-column label="未结（元）" width="110" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney((row.SpAmt || 0) - (row.PayAmt || 0)) }}</span></template>
          </el-table-column>
          <el-table-column prop="PayStatus" label="结算状态" width="110" align="center">
            <template #default="{ row }">
              <span class="erp-badge" :data-tone="getPayStatusTone(row.PayStatus)">{{ row.PayStatus || '待付款' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="OrderStatus" label="生产流程" width="110" align="center">
            <template #default="{ row }">
              <span class="erp-badge" :data-tone="getOrderStatusTone(row.OrderStatus)">{{ row.OrderStatus }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="CrtTime" label="登记时间" width="170" />
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{ row }">
              <div class="table-actions">
                <el-button link type="primary" size="small" @click="handleSettle(row)">收款</el-button>
                <el-button link type="primary" size="small" @click="handleAR(row)">对账</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div class="erp-pagination" style="padding: 12px 16px">
        <div class="table-actions">
          <el-button size="small" @click="batchSettle" :disabled="selectedRows.length === 0">批量收款（{{ selectedRows.length }}）</el-button>
          <el-button size="small" @click="batchToAR" :disabled="selectedRows.length === 0">转记账</el-button>
        </div>
        <span>共 {{ filteredData.length }} 条记录</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';

const router = useRouter();
const loading = ref(false);
const tableData = ref<any[]>([]);
const selectedRows = ref<any[]>([]);

const search = reactive({ q: '', DateRange: [] as string[], settleStatus: '' });

const fmtMoney = (v: any) => {
  const num = Number(v || 0);
  return '￥' + num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getPayStatusTone = (s: string) => ({ '尚未结算': 'warning', '部分结算': 'warning', '货款收': 'success' } as Record<string, string>)[s] || 'info';
const getOrderStatusTone = (s: string) => ({ '待审核': 'info', '待生产': '', '生产中': 'warning', '完工': 'success', '结单': 'success' } as Record<string, string>)[s] || 'info';

const filteredData = computed(() => {
  let data = tableData.value.filter(r => (r.SpAmt || 0) - (r.PayAmt || 0) > 0);
  if (search.q) {
    const q = search.q.toLowerCase();
    data = data.filter(r => (r.OrderCode + r.ClientName + r.OrderDesc).toLowerCase().includes(q));
  }
  if (search.settleStatus) data = data.filter(r => r.PayStatus === search.settleStatus);
  return data;
});

const onSelect = (rows: any[]) => { selectedRows.value = rows; };
const viewDetail = (row: any) => router.push(`/frontdesk/orderDetail?id=${row.Id}`);
const handleSettle = (row: any) => ElMessage.info(`收款：${row.OrderCode}`);
const handleAR = (row: any) => ElMessage.info(`对账：${row.ClientName}`);
const batchSettle = () => ElMessage.info(`批量收款 ${selectedRows.value.length} 张`);
const batchToAR = () => ElMessage.info(`转记账 ${selectedRows.value.length} 张`);

const resetSearch = () => { search.q = ''; search.DateRange = []; search.settleStatus = ''; };

const getTbody = () => {
  loading.value = true;
  setTimeout(() => {
    tableData.value = [
      { Id: '1', OrderCode: 'GD261021002', ClientCode: '000002', ClientName: '新华书店', GroupName: '企业客户', OrderName: '教材封面覆膜', OrderDesc: '', SpAmt: 3200, PayAmt: 0, PayStatus: '尚未结算', OrderStatus: '生产中', CrtTime: '2026-10-20 14:15' },
      { Id: '2', OrderCode: 'GD261021003', ClientCode: '000003', ClientName: '晨光文具', GroupName: '散户', OrderName: '宣传折页', OrderDesc: '三折页 铜版纸', SpAmt: 860, PayAmt: 500, PayStatus: '部分结算', OrderStatus: '待生产', CrtTime: '2026-10-21 08:00' },
      { Id: '3', OrderCode: 'GD261021004', ClientCode: '000004', ClientName: '万科地产', GroupName: '企业客户', OrderName: '楼书印刷', OrderDesc: '精装', SpAmt: 42000, PayAmt: 20000, PayStatus: '部分结算', OrderStatus: '完工', CrtTime: '2026-10-19 16:40' },
      { Id: '4', OrderCode: 'GD261021005', ClientCode: '000005', ClientName: '华为技术', GroupName: '企业客户', OrderName: '产品手册', OrderDesc: '中英双语', SpAmt: 68000, PayAmt: 0, PayStatus: '尚未结算', OrderStatus: '待审核', CrtTime: '2026-10-21 10:20' },
    ];
    loading.value = false;
  }, 200);
};

onMounted(() => getTbody());
</script>

<style scoped lang="scss">
.table-actions { display: flex; align-items: center; gap: 4px; }
</style>
