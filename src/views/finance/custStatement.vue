<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 财务</p>
        <h1>客户对账<template v-if="custName"> · {{ custName }}</template></h1>
        <p class="erp-pagehead-desc">客户的结算单据与工作单据，可打印对账单或直接销账。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button v-if="custCode && custDebt > 0" type="primary" @click="router.push(`/finance/writeOffRecords?cust=${custCode}`)">新建销账</el-button>
        <el-button @click="handlePrint">打印对账单</el-button>
        <el-button @click="handleExport">导出当前页签</el-button>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-panelhead"><h2>选择客户</h2></div>
      <div class="erp-panelbody">
        <div class="erp-toolbar" style="padding: 0; border: none;">
          <div class="erp-toolbar-item">
            <label>对账客户</label>
            <el-select v-model="custCode" placeholder="请选择客户" filterable style="width: 280px" @change="onCustChange">
              <el-option v-for="c in custOptions" :key="c.code" :label="`${c.code} ${c.name}`" :value="c.code" />
            </el-select>
          </div>
          <div class="erp-toolbar-actions">
            <el-button type="primary" @click="loadData">查询</el-button>
          </div>
        </div>
      </div>
    </div>

    <template v-if="custCode">
      <div class="erp-panel">
        <div class="erp-panelhead"><h2>客户与结余</h2></div>
        <div class="erp-panelbody">
          <div class="cust-info-grid">
            <div class="cust-info-item"><dt>客户</dt><dd>{{ custCode }} {{ custName }} · {{ custGroupName }}</dd></div>
            <div class="cust-info-item"><dt>联系人 / 电话</dt><dd>{{ custContact || '未提供' }}</dd></div>
            <div class="cust-info-item"><dt>记账结余（元）</dt><dd><span class="mono-cell">{{ fmtMoney(custDebt) }}</span></dd></div>
            <div class="cust-info-item"><dt>销账未审（元）</dt><dd><span class="mono-cell">{{ fmtMoney(custPending) }}</span></dd></div>
            <div class="cust-info-item"><dt>预存余额（元）</dt><dd><span class="mono-cell">{{ custCardNo ? `${fmtMoney(custPrestoreBalance)}（卡号 ${custCardNo}）` : '无预存卡' }}</span></dd></div>
            <div class="cust-info-item"><dt>结算方式</dt><dd>{{ custSettleType || '未提供' }}</dd></div>
          </div>
        </div>
      </div>

      <div class="erp-panel">
        <div class="erp-tabs">
          <a class="erp-tab-item" :class="{ active: activeTab === 'docs' }" @click="activeTab = 'docs'">结算单据</a>
          <a class="erp-tab-item" :class="{ active: activeTab === 'orders' }" @click="activeTab = 'orders'">工作单据</a>
        </div>
      </div>

      <!-- 结算单据 -->
      <template v-if="activeTab === 'docs'">
        <div class="erp-toolbar">
          <div class="erp-toolbar-item">
            <label>结算日期</label>
            <el-date-picker v-model="docFilter.dateRange" type="daterange" range-separator="至" start-placeholder="开始" end-placeholder="结束" value-format="YYYY-MM-DD" style="width: 240px" />
          </div>
          <div class="erp-toolbar-item">
            <label>结清状态</label>
            <el-select v-model="docFilter.scope" clearable placeholder="全部" style="width: 120px">
              <el-option label="未结清" value="open" />
              <el-option label="已结清" value="closed" />
            </el-select>
          </div>
          <div class="erp-toolbar-item">
            <label>结算方式</label>
            <el-select v-model="docFilter.method" clearable placeholder="全部" style="width: 120px">
              <el-option v-for="m in methodOptions" :key="m" :label="m" :value="m" />
            </el-select>
          </div>
          <div class="erp-toolbar-actions">
            <el-button type="primary" @click="loadData">筛选</el-button>
            <el-button @click="resetDocFilter">重置</el-button>
          </div>
        </div>

        <div class="erp-panel">
          <div class="erp-panelhead"><h2>按结算方式汇总</h2><span class="erp-panelhead-note">随上方筛选变化 · 单位：元</span></div>
          <div class="erp-panelbody">
            <table class="erp-mini-table">
              <thead><tr><th>结算方式</th><th>单数</th><th>结算金额（元）</th><th>已清金额（元）</th><th>未清金额（元）</th></tr></thead>
              <tbody>
                <tr v-for="s in methodSummary" :key="s.method">
                  <td>{{ s.method }}</td><td>{{ s.n }}</td>
                  <td class="num"><span class="mono-cell">{{ fmtMoney(s.amount) }}</span></td>
                  <td class="num"><span class="mono-cell">{{ fmtMoney(s.cleared) }}</span></td>
                  <td class="num"><span class="mono-cell">{{ fmtMoney(s.uncleared) }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="erp-panel">
          <div class="erp-table-wrap">
            <el-table :data="docData" v-loading="loading" stripe show-summary :summary-method="getDocSummaries" style="width: 100%">
              <el-table-column prop="no" label="结算单号" width="160">
                <template #default="{ row }"><span class="mono-text">{{ row.no }}</span></template>
              </el-table-column>
              <el-table-column prop="date" label="结算日期" width="120" />
              <el-table-column prop="handler" label="经手" width="90" />
              <el-table-column prop="method" label="结算方式" width="100" />
              <el-table-column prop="orderNo" label="工作单号" width="150">
                <template #default="{ row }"><span class="mono-text">{{ row.orderNo || '—' }}</span></template>
              </el-table-column>
              <el-table-column prop="task" label="工单任务" min-width="140" />
              <el-table-column prop="amount" label="结算金额（元）" width="130" align="right">
                <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.amount) }}</span></template>
              </el-table-column>
              <el-table-column prop="cleared" label="已清金额（元）" width="130" align="right">
                <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.cleared) }}</span></template>
              </el-table-column>
              <el-table-column prop="uncleared" label="未清金额（元）" width="130" align="right">
                <template #default="{ row }"><span class="mono-cell" :class="{ 'text-danger': row.uncleared > 0 }">{{ fmtMoney(row.uncleared) }}</span></template>
              </el-table-column>
              <el-table-column prop="age" label="欠款账龄" width="100" align="center">
                <template #default="{ row }">
                  <span v-if="row.uncleared > 0" class="erp-badge" :data-tone="row.age > 90 ? 'danger' : 'warning'">{{ row.age }} 天</span>
                  <span v-else>—</span>
                </template>
              </el-table-column>
            </el-table>
          </div>
          <div class="erp-pagination" style="padding: 12px 16px">
            <span>共 {{ docData.length }} 条记录</span>
          </div>
        </div>
      </template>

      <!-- 工作单据 -->
      <template v-if="activeTab === 'orders'">
        <div class="erp-toolbar">
          <div class="erp-toolbar-item">
            <label>登记日期</label>
            <el-date-picker v-model="orderFilter.dateRange" type="daterange" range-separator="至" start-placeholder="开始" end-placeholder="结束" value-format="YYYY-MM-DD" style="width: 240px" />
          </div>
          <div class="erp-toolbar-item">
            <label>结清状态</label>
            <el-select v-model="orderFilter.scope" clearable placeholder="全部" style="width: 120px">
              <el-option label="未结清" value="open" />
              <el-option label="已结清" value="closed" />
            </el-select>
          </div>
          <div class="erp-toolbar-actions">
            <el-button type="primary" @click="loadData">筛选</el-button>
            <el-button @click="resetOrderFilter">重置</el-button>
          </div>
        </div>

        <div class="erp-panel">
          <div class="erp-table-wrap">
            <el-table :data="orderData" v-loading="loading" stripe show-summary :summary-method="getOrderSummaries" style="width: 100%">
              <el-table-column prop="no" label="工单编号" width="160">
                <template #default="{ row }"><span class="mono-text">{{ row.no }}</span></template>
              </el-table-column>
              <el-table-column prop="created" label="登记日期" width="120" />
              <el-table-column prop="task" label="制作任务 / 要求" min-width="180">
                <template #default="{ row }">
                  {{ row.task || '—' }}
                  <div v-if="row.req" class="sub-text">{{ row.req }}</div>
                </template>
              </el-table-column>
              <el-table-column prop="amount" label="实收（元）" width="120" align="right">
                <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.amount) }}</span></template>
              </el-table-column>
              <el-table-column prop="paid" label="已结（元）" width="120" align="right">
                <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.paid) }}</span></template>
              </el-table-column>
              <el-table-column prop="unpaid" label="未结（元）" width="120" align="right">
                <template #default="{ row }"><span class="mono-cell" :class="{ 'text-danger': row.unpaid > 0 }">{{ fmtMoney(row.unpaid) }}</span></template>
              </el-table-column>
              <el-table-column prop="settleStatus" label="结算状态" width="100" align="center">
                <template #default="{ row }">
                  <span class="erp-badge" :data-tone="row.settleStatus === '完成结算' ? 'success' : row.settleStatus === '部分结算' ? 'warning' : 'info'">{{ row.settleStatus }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="flow" label="生产流程" width="100" />
            </el-table>
          </div>
          <div class="erp-pagination" style="padding: 12px 16px">
            <span>共 {{ orderData.length }} 条记录</span>
          </div>
        </div>
      </template>
    </template>

    <div v-else class="erp-panel">
      <div class="erp-empty">
        <h3>请选择对账客户</h3>
        <p>选择客户后显示其结算单据、工作单据与结余。</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';

const router = useRouter();
const route = useRoute();
const loading = ref(false);
const activeTab = ref('docs');

const custCode = ref('');
const custName = ref('');
const custGroupName = ref('');
const custContact = ref('');
const custDebt = ref(0);
const custPending = ref(0);
const custCardNo = ref('');
const custPrestoreBalance = ref(0);
const custSettleType = ref('');

const custOptions = [
  { code: '100001', name: '世纪出版社', group: '企业客户', contact: '王经理', phone: '13800001111', debt: 22000, pending: 0, cardNo: 'YC260101001', prestoreBalance: 36800, settleType: '月结' },
  { code: '100002', name: '新华书店', group: '企业客户', contact: '李主管', phone: '13900002222', debt: 9700, pending: 1200, cardNo: 'YC260205002', prestoreBalance: 13500, settleType: '月结' },
  { code: '100003', name: '万科地产', group: 'VIP客户', contact: '张总', phone: '13700003333', debt: 68000, pending: 0, cardNo: '', prestoreBalance: 0, settleType: '现结' },
  { code: '100004', name: '华为技术', group: 'VIP客户', contact: '赵经理', phone: '13600004444', debt: 18000, pending: 3000, cardNo: '', prestoreBalance: 0, settleType: '月结' },
  { code: '100005', name: '晨光文具', group: '散户', contact: '孙老板', phone: '13500005555', debt: 0, pending: 0, cardNo: 'YC260310003', prestoreBalance: 2300, settleType: '现结' },
];

const docFilter = reactive({ dateRange: [] as string[], scope: '', method: '' });
const orderFilter = reactive({ dateRange: [] as string[], scope: '' });
const methodOptions = ['记账', '现钞', '微信', '支付宝', '预存'];

const docData = ref<any[]>([]);
const orderData = ref<any[]>([]);
const methodSummary = ref<any[]>([]);

const fmtMoney = (v: any) => '￥' + Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const onCustChange = (code: string) => {
  const c = custOptions.find(x => x.code === code);
  if (c) {
    custName.value = c.name;
    custGroupName.value = c.group;
    custContact.value = c.contact;
    custDebt.value = c.debt;
    custPending.value = c.pending;
    custCardNo.value = c.cardNo;
    custPrestoreBalance.value = c.prestoreBalance;
    custSettleType.value = c.settleType;
  }
};

const getDocSummaries = (param: any) => {
  const { columns, data } = param;
  const sums: string[] = [];
  columns.forEach((col: any, i: number) => {
    if (i === 0) { sums[i] = '合计'; return; }
    if (['amount', 'cleared', 'uncleared'].includes(col.property)) {
      sums[i] = fmtMoney(data.reduce((s: number, r: any) => s + Number(r[col.property] || 0), 0));
    } else { sums[i] = ''; }
  });
  return sums;
};

const getOrderSummaries = (param: any) => {
  const { columns, data } = param;
  const sums: string[] = [];
  columns.forEach((col: any, i: number) => {
    if (i === 0) { sums[i] = '合计'; return; }
    if (['amount', 'paid', 'unpaid'].includes(col.property)) {
      sums[i] = fmtMoney(data.reduce((s: number, r: any) => s + Number(r[col.property] || 0), 0));
    } else { sums[i] = ''; }
  });
  return sums;
};

const resetDocFilter = () => { docFilter.dateRange = []; docFilter.scope = ''; docFilter.method = ''; };
const resetOrderFilter = () => { orderFilter.dateRange = []; orderFilter.scope = ''; };

const handlePrint = () => { window.print(); };
const handleExport = () => { ElMessage.info(`导出客户对账-${custName.value} ${activeTab.value === 'docs' ? '结算单据' : '工作单据'}`); };

const loadData = () => {
  if (!custCode.value) return;
  loading.value = true;
  setTimeout(() => {
    const now = new Date();
    docData.value = [
      { no: 'JZ26090110001', date: '2026-09-01', handler: '管理员', method: '记账', orderNo: 'GD260901001', task: '画册印刷 500本', amount: 12000, cleared: 0, uncleared: 12000, age: Math.floor((+now - new Date('2026-09-01').getTime()) / 864e5) },
      { no: 'JZ26091510002', date: '2026-09-15', handler: '管理员', method: '记账', orderNo: 'GD260915002', task: '宣传册印刷 200本', amount: 5000, cleared: 0, uncleared: 5000, age: Math.floor((+now - new Date('2026-09-15').getTime()) / 864e5) },
      { no: 'JS261001001', date: '2026-10-01', handler: '前台', method: '微信', orderNo: 'GD261001003', task: '名片印刷 100盒', amount: 3200, cleared: 3200, uncleared: 0, age: 0 },
      { no: 'JZ26101010003', date: '2026-10-10', handler: '管理员', method: '记账', orderNo: 'GD261010004', task: '信封印刷 1000个', amount: 5000, cleared: 0, uncleared: 5000, age: Math.floor((+now - new Date('2026-10-10').getTime()) / 864e5) },
    ];

    const m: Record<string, any> = {};
    docData.value.forEach(r => {
      const s = m[r.method] || { method: r.method, n: 0, amount: 0, cleared: 0, uncleared: 0 };
      s.n++; s.amount += r.amount; s.cleared += r.cleared; s.uncleared += r.uncleared;
      m[r.method] = s;
    });
    methodSummary.value = Object.values(m);

    orderData.value = [
      { no: 'GD260901001', created: '2026-09-01', task: '画册印刷 500本', req: '铜版纸 157g', amount: 12000, paid: 0, unpaid: 12000, settleStatus: '未结算', flow: '已完成' },
      { no: 'GD260915002', created: '2026-09-15', task: '宣传册印刷 200本', req: '哑粉纸 128g', amount: 5000, paid: 0, unpaid: 5000, settleStatus: '未结算', flow: '已完成' },
      { no: 'GD261001003', created: '2026-10-01', task: '名片印刷 100盒', req: '特种纸', amount: 3200, paid: 3200, unpaid: 0, settleStatus: '完成结算', flow: '已完成' },
      { no: 'GD261010004', created: '2026-10-10', task: '信封印刷 1000个', req: '双胶纸 80g', amount: 5000, paid: 0, unpaid: 5000, settleStatus: '未结算', flow: '生产中' },
    ];
    loading.value = false;
  }, 200);
};

onMounted(() => {
  const cust = route.query.cust as string;
  if (cust) {
    custCode.value = cust;
    onCustChange(cust);
    loadData();
  }
});
</script>

<style scoped lang="scss">
.erp-tabs {
  display: flex;
  gap: var(--erp-space-1);
  padding: var(--erp-space-3) var(--erp-space-4);
  border-bottom: 1px solid var(--erp-line);
}
.erp-tab-item {
  padding: var(--erp-space-2) var(--erp-space-4);
  font-size: var(--erp-table-size);
  color: var(--erp-text-soft);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
  &:hover { color: var(--erp-primary); }
  &.active {
    color: var(--erp-primary);
    border-bottom-color: var(--erp-primary);
    font-weight: 500;
  }
}
.cust-info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--erp-space-3) var(--erp-space-6);
  dt { font-size: 13px; color: var(--erp-muted); margin-bottom: 2px; }
  dd { font-size: var(--erp-table-size); color: var(--erp-text); margin: 0; }
}
.erp-mini-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--erp-table-size);
  th, td { padding: var(--erp-space-2) var(--erp-space-3); border-bottom: 1px solid var(--erp-line); text-align: left; }
  th { font-weight: 500; color: var(--erp-muted); background: var(--erp-bg); }
  td.num { text-align: right; white-space: nowrap; }
}
.erp-empty {
  padding: var(--erp-space-12) var(--erp-space-6);
  text-align: center;
  color: var(--erp-muted);
  h3 { margin: 0 0 var(--erp-space-2); font-size: 16px; color: var(--erp-text-soft); }
  p { margin: 0; font-size: var(--erp-table-size); }
}
.table-actions { display: flex; align-items: center; gap: 4px; }
.mono-text { font-family: var(--erp-font-mono); font-variant-numeric: tabular-nums; }
</style>
