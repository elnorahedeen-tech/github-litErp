<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 财务</p>
        <h1>财务业务中心</h1>
        <p class="erp-pagehead-desc">按支付方式、现金、应收、预存四栏汇总财务单据的增减；点汇总项可只看对应明细。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button @click="router.push('/finance/transferRecords')">新建转账</el-button>
        <el-button @click="router.push('/finance/generalRecords')">一般收入</el-button>
        <el-button @click="router.push('/finance/generalRecords')">一般支出</el-button>
        <el-button type="primary" @click="router.push('/finance/writeOffRecords')">新建销账</el-button>
      </div>
    </div>

    <!-- 汇总面板 -->
    <div class="erp-panel">
      <div class="erp-panelhead"><h2>财务汇总</h2></div>
      <div class="erp-panelbody">
        <div class="fin-summary-grid">
          <!-- 支付方式 -->
          <div class="fin-summary-col">
            <h3 class="fin-summary-title">支付方式</h3>
            <table class="fin-summary-table">
              <tbody>
                <tr v-for="item in summaryByMethod" :key="item.label" class="fin-summary-row" :class="{ active: activeFilter === item.key }" @click="toggleFilter(item.key)">
                  <td>{{ item.label }}</td>
                  <td class="num"><span class="mono-cell">{{ fmtMoney(item.increase) }}</span></td>
                  <td class="num"><span class="mono-cell">{{ fmtMoney(item.decrease) }}</span></td>
                  <td class="num"><span class="mono-cell" :class="{ 'text-danger': item.balance < 0 }">{{ fmtMoney(item.balance) }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <!-- 现金 -->
          <div class="fin-summary-col">
            <h3 class="fin-summary-title">现金</h3>
            <table class="fin-summary-table">
              <tbody>
                <tr v-for="item in summaryCash" :key="item.label" class="fin-summary-row" :class="{ active: activeFilter === item.key }" @click="toggleFilter(item.key)">
                  <td>{{ item.label }}</td>
                  <td class="num"><span class="mono-cell">{{ fmtMoney(item.increase) }}</span></td>
                  <td class="num"><span class="mono-cell">{{ fmtMoney(item.decrease) }}</span></td>
                  <td class="num"><span class="mono-cell" :class="{ 'text-danger': item.balance < 0 }">{{ fmtMoney(item.balance) }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <!-- 应收 -->
          <div class="fin-summary-col">
            <h3 class="fin-summary-title">应收</h3>
            <table class="fin-summary-table">
              <tbody>
                <tr v-for="item in summaryAR" :key="item.label" class="fin-summary-row" :class="{ active: activeFilter === item.key }" @click="toggleFilter(item.key)">
                  <td>{{ item.label }}</td>
                  <td class="num"><span class="mono-cell">{{ fmtMoney(item.increase) }}</span></td>
                  <td class="num"><span class="mono-cell">{{ fmtMoney(item.decrease) }}</span></td>
                  <td class="num"><span class="mono-cell" :class="{ 'text-danger': item.balance < 0 }">{{ fmtMoney(item.balance) }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <!-- 预存 -->
          <div class="fin-summary-col">
            <h3 class="fin-summary-title">预存</h3>
            <table class="fin-summary-table">
              <tbody>
                <tr v-for="item in summaryPrestore" :key="item.label" class="fin-summary-row" :class="{ active: activeFilter === item.key }" @click="toggleFilter(item.key)">
                  <td>{{ item.label }}</td>
                  <td class="num"><span class="mono-cell">{{ fmtMoney(item.increase) }}</span></td>
                  <td class="num"><span class="mono-cell">{{ fmtMoney(item.decrease) }}</span></td>
                  <td class="num"><span class="mono-cell" :class="{ 'text-danger': item.balance < 0 }">{{ fmtMoney(item.balance) }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- 搜索栏 -->
    <div class="erp-toolbar">
      <div class="erp-toolbar-item">
        <label>搜索</label>
        <el-input v-model="search.q" placeholder="单据编号 / 客户 / 备注" clearable style="width: 220px" />
      </div>
      <div class="erp-toolbar-item">
        <label>业务日期</label>
        <el-date-picker v-model="search.DateRange" type="daterange" range-separator="至" start-placeholder="开始" end-placeholder="结束" value-format="YYYY-MM-DD" style="width: 240px" />
      </div>
      <div class="erp-toolbar-item">
        <label>资金科目</label>
        <el-select v-model="search.Account" clearable placeholder="全部" style="width: 160px">
          <el-option v-for="a in accountOptions" :key="a" :label="a" :value="a" />
        </el-select>
      </div>
      <div class="erp-toolbar-item">
        <label>支付方式</label>
        <el-select v-model="search.PayMethod" clearable placeholder="全部" style="width: 120px">
          <el-option v-for="m in payMethodOptions" :key="m" :label="m" :value="m" />
        </el-select>
      </div>
      <div class="erp-toolbar-item">
        <label>审核</label>
        <el-select v-model="search.AuditStatus" clearable placeholder="全部" style="width: 120px">
          <el-option label="已审核" value="已审核" />
          <el-option label="未审核" value="未审核" />
        </el-select>
      </div>
      <div class="erp-toolbar-actions">
        <el-button type="primary" @click="getTbody">筛选</el-button>
        <el-button @click="resetSearch">重置</el-button>
      </div>
    </div>

    <!-- 明细列表 -->
    <div class="erp-panel">
      <div class="erp-table-wrap">
        <el-table :data="filteredData" v-loading="loading" stripe style="width: 100%">
          <el-table-column prop="type" label="单据类型" width="110" align="center">
            <template #default="{ row }">
              <span class="erp-badge" :data-tone="getTypeTone(row.type)">{{ row.type }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="code" label="单据编号" width="160">
            <template #default="{ row }">
              <span class="mono-text">{{ row.code }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="time" label="业务时间" width="170" />
          <el-table-column prop="client" label="客户" min-width="180">
            <template #default="{ row }">
              {{ row.client }}
              <div v-if="row.clientCode" class="sub-text">{{ row.clientCode }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="payMethod" label="支付方式" width="100" />
          <el-table-column prop="account" label="资金科目" min-width="160" />
          <el-table-column prop="amount" label="金额（元）" width="120" align="right">
            <template #default="{ row }">
              <span class="mono-cell" :class="row.direction === 'out' ? 'text-danger' : 'text-success'">
                {{ row.direction === 'out' ? '-' : '+' }}{{ fmtMoney(row.amount) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="handler" label="经手" width="90" />
          <el-table-column prop="audited" label="审核" width="90" align="center">
            <template #default="{ row }">
              <span class="erp-badge" :data-tone="row.audited ? 'success' : 'info'">{{ row.audited ? '已审核' : '未审核' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="说明备注" min-width="140" :show-overflow-tooltip="true" />
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <div class="table-actions">
                <el-button link type="primary" size="small" @click="viewSource(row)">来源</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div class="erp-pagination" style="padding: 12px 16px">
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
const activeFilter = ref('');
const allEntries = ref<any[]>([]);

const search = reactive({
  q: '',
  DateRange: [] as string[],
  Account: '',
  PayMethod: '',
  AuditStatus: '',
});

const accountOptions = ['现金>前台钱箱', '现金>备用金', '银行存款>微信', '银行存款>支付宝', '银行存款>工商银行', '应收账款'];
const payMethodOptions = ['现钞', '微信', '支付宝', '刷卡', '转账', '记账', '预存扣款'];

const fmtMoney = (v: any) => {
  const num = Number(v || 0);
  return '￥' + num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getTypeTone = (type: string): string => {
  const map: Record<string, string> = {
    '收款': 'success', '销账': 'success', '储值': '', '退款': 'warning',
    '转账': 'info', '收入': 'success', '支出': 'danger', '记账': 'warning',
  };
  return map[type] || 'info';
};

const summaryByMethod = computed(() => {
  const methods = ['现钞', '微信', '支付宝', '刷卡', '转账'];
  return methods.map(m => {
    const items = allEntries.value.filter(e => e.payMethod === m);
    const inc = items.filter(e => e.direction === 'in').reduce((s, e) => s + e.amount, 0);
    const dec = items.filter(e => e.direction === 'out').reduce((s, e) => s + e.amount, 0);
    return { key: `method:${m}`, label: m, increase: inc, decrease: dec, balance: inc - dec };
  });
});

const summaryCash = computed(() => {
  const accts = ['现金>前台钱箱', '现金>备用金'];
  return accts.map(a => {
    const items = allEntries.value.filter(e => e.account === a);
    const inc = items.filter(e => e.direction === 'in').reduce((s, e) => s + e.amount, 0);
    const dec = items.filter(e => e.direction === 'out').reduce((s, e) => s + e.amount, 0);
    return { key: `acct:${a}`, label: a.replace('现金>', ''), increase: inc, decrease: dec, balance: inc - dec };
  });
});

const summaryAR = computed(() => {
  const items = allEntries.value.filter(e => e.account === '应收账款');
  const inc = items.filter(e => e.direction === 'in').reduce((s, e) => s + e.amount, 0);
  const dec = items.filter(e => e.direction === 'out').reduce((s, e) => s + e.amount, 0);
  return [
    { key: 'acct:应收账款', label: '应收账款', increase: inc, decrease: dec, balance: inc - dec },
    { key: 'ar:pending', label: '未销记账', increase: inc, decrease: dec * 0.7, balance: inc - dec * 0.7 },
  ];
});

const summaryPrestore = computed(() => {
  const items = allEntries.value.filter(e => e.type === '储值' || e.type === '退款');
  const inc = items.filter(e => e.direction === 'in').reduce((s, e) => s + e.amount, 0);
  const dec = items.filter(e => e.direction === 'out').reduce((s, e) => s + e.amount, 0);
  return [
    { key: 'prestore:total', label: '预存总额', increase: inc, decrease: dec, balance: inc - dec },
    { key: 'prestore:gift', label: '赠送余额', increase: inc * 0.1, decrease: dec * 0.1, balance: inc * 0.1 - dec * 0.1 },
  ];
});

const filteredData = computed(() => {
  let data = allEntries.value;
  if (activeFilter.value) {
    const [prefix, val] = activeFilter.value.split(':');
    if (prefix === 'method') data = data.filter(e => e.payMethod === val);
    else if (prefix === 'acct') data = data.filter(e => e.account === val);
  }
  if (search.q) {
    const q = search.q.toLowerCase();
    data = data.filter(e => (e.code + e.client + e.remark).toLowerCase().includes(q));
  }
  if (search.Account) data = data.filter(e => e.account === search.Account);
  if (search.PayMethod) data = data.filter(e => e.payMethod === search.PayMethod);
  if (search.AuditStatus === '已审核') data = data.filter(e => e.audited);
  if (search.AuditStatus === '未审核') data = data.filter(e => !e.audited);
  return data;
});

const toggleFilter = (key: string) => {
  activeFilter.value = activeFilter.value === key ? '' : key;
};

const getTbody = () => {
  loading.value = true;
  setTimeout(() => {
    allEntries.value = getMockEntries();
    loading.value = false;
  }, 200);
};

const getMockEntries = () => [
  { type: '收款', code: 'SKD261021001', time: '2026-10-21 09:30', client: '世纪出版社', clientCode: '000001', payMethod: '现钞', account: '现金>前台钱箱', amount: 15800, direction: 'in', handler: '管理员', audited: true, remark: '工单 GD261021001 收款' },
  { type: '收款', code: 'SKD261021002', time: '2026-10-21 14:15', client: '新华书店', clientCode: '000002', payMethod: '微信', account: '银行存款>微信', amount: 3200, direction: 'in', handler: '管理员', audited: true, remark: '工单 GD261021002 收款' },
  { type: '储值', code: 'YC26102110001', time: '2026-10-21 10:00', client: '世纪出版社', clientCode: '000001', payMethod: '现钞', account: '现金>前台钱箱', amount: 5000, direction: 'in', handler: '管理员', audited: true, remark: '会员卡充值' },
  { type: '转账', code: 'ZZ261020001', time: '2026-10-20 16:00', client: '', clientCode: '', payMethod: '转账', account: '银行存款>工商银行', amount: 10000, direction: 'in', handler: '管理员', audited: true, remark: '微信提现到银行' },
  { type: '转账', code: 'ZZ261020001', time: '2026-10-20 16:00', client: '', clientCode: '', payMethod: '转账', account: '银行存款>微信', amount: 10000, direction: 'out', handler: '管理员', audited: true, remark: '微信提现到银行' },
  { type: '销账', code: 'XS261019001', time: '2026-10-19 11:30', client: '万科地产', clientCode: '000004', payMethod: '现钞', account: '应收账款', amount: 22000, direction: 'out', handler: '管理员', audited: true, remark: '收回记账款' },
  { type: '收入', code: 'SR261018001', time: '2026-10-18 09:00', client: '废品回收', clientCode: '', payMethod: '现钞', account: '现金>前台钱箱', amount: 200, direction: 'in', handler: '张三', audited: true, remark: '废品变卖' },
  { type: '支出', code: 'ZC261017001', time: '2026-10-17 15:00', client: '房东', clientCode: '', payMethod: '转账', account: '银行存款>工商银行', amount: 8000, direction: 'out', handler: '管理员', audited: true, remark: '10月房租' },
  { type: '退款', code: 'YT26101910001', time: '2026-10-19 16:40', client: '晨光文具', clientCode: '000003', payMethod: '现钞', account: '现金>前台钱箱', amount: 300, direction: 'out', handler: '管理员', audited: true, remark: '预存退款' },
  { type: '收款', code: 'SKD261018001', time: '2026-10-18 10:30', client: '华为技术', clientCode: '000005', payMethod: '记账', account: '应收账款', amount: 68000, direction: 'in', handler: '管理员', audited: false, remark: '工单 GD261021005 记账' },
];

const resetSearch = () => {
  search.q = '';
  search.DateRange = [];
  search.Account = '';
  search.PayMethod = '';
  search.AuditStatus = '';
  activeFilter.value = '';
};

const viewSource = (row: any) => {
  ElMessage.info(`查看来源单据：${row.code}`);
};

onMounted(() => {
  getTbody();
});
</script>

<style scoped lang="scss">
.fin-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--erp-space-6);
}

.fin-summary-col {
  min-width: 0;
}

.fin-summary-title {
  font-size: var(--erp-table-size);
  font-weight: 600;
  color: var(--erp-muted);
  margin: 0 0 var(--erp-space-2);
  padding-bottom: var(--erp-space-2);
  border-bottom: 1px solid var(--erp-line);
}

.fin-summary-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--erp-caption-size);

  td {
    padding: var(--erp-space-1) var(--erp-space-2);
    border-bottom: 1px solid var(--erp-line);
  }

  td.num {
    text-align: right;
    white-space: nowrap;
  }
}

.fin-summary-row {
  cursor: pointer;
  transition: background var(--erp-motion-duration);

  &:hover {
    background: var(--erp-background);
  }

  &.active {
    background: var(--erp-primary-light);
  }
}

.mono-text {
  font-family: var(--erp-font-mono);
  font-variant-numeric: tabular-nums;
}

.table-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

@media (max-width: 1100px) {
  .fin-summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .fin-summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
