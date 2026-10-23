<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 报表</p>
        <h1>业务提醒</h1>
        <p class="erp-pagehead-desc">交付超期、未结算、欠款超限、预存余额不足、未审核单据。选择提醒类型查看明细；阈值可调整。</p>
      </div>
    </div>

    <!-- 提醒类型与阈值 -->
    <div class="erp-panel" style="margin-bottom: 16px">
      <div class="erp-panelhead"><h2>提醒类型与阈值</h2><span class="erp-panelhead-note">切换提醒类型立即生效；修改阈值后点"应用阈值"</span></div>
      <div class="erp-toolbar">
        <div class="erp-toolbar-item">
          <label>提醒类型</label>
          <el-select v-model="alertType" style="width: 200px" @change="loadAlertData">
            <el-option v-for="a in alertDefs" :key="a.key" :label="`${a.label}（${a.count}）`" :value="a.key" />
          </el-select>
        </div>
        <div class="erp-toolbar-item">
          <label>交付宽限（天）</label>
          <el-input v-model="thresholds.grace" type="number" style="width: 100px" />
        </div>
        <div class="erp-toolbar-item">
          <label>默认信用额度（元）</label>
          <el-input v-model="thresholds.credit" type="number" style="width: 120px" />
        </div>
        <div class="erp-toolbar-item">
          <label>预存预警线（元）</label>
          <el-input v-model="thresholds.low" type="number" style="width: 120px" />
        </div>
        <div class="erp-toolbar-actions">
          <el-button type="primary" @click="applyThresholds">应用阈值</el-button>
        </div>
      </div>
    </div>

    <!-- 提醒明细列表 -->
    <div class="erp-panel">
      <div class="erp-panelhead"><h2>{{ currentAlert.label }}</h2><span class="erp-panelhead-note">{{ currentAlert.note }} 数据截至 {{ now }}</span></div>
      <div class="erp-toolbar">
        <div class="erp-toolbar-item">
          <label>搜索</label>
          <el-input v-model="searchQ" placeholder="编号 / 客户名称" clearable style="width: 220px" />
        </div>
        <div class="erp-toolbar-actions">
          <el-button type="primary" @click="loadAlertData">筛选</el-button>
          <el-button @click="searchQ = ''">重置</el-button>
        </div>
      </div>
      <div class="erp-table-wrap">
        <!-- 交付超期 / 未结算 / 未审核单据 -->
        <el-table v-if="alertType !== 'debt' && alertType !== 'low'" :data="filteredAlertData" v-loading="loading" stripe show-summary :summary-method="getOrderSummaries" style="width: 100%">
          <el-table-column prop="no" label="工单 / 客户" width="180">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="viewOrder(row)"><span class="mono-text">{{ row.no || row.type }}</span></el-button>
              <div class="sub-text">{{ row.custName || row.who }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="task" label="制作任务" min-width="120">
            <template #default="{ row }">{{ row.task || row.no || '—' }}</template>
          </el-table-column>
          <el-table-column prop="amount" label="实收（元）" width="110" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.amount) }}</span></template>
          </el-table-column>
          <el-table-column prop="paid" label="已结（元）" width="110" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.paid) }}</span></template>
          </el-table-column>
          <el-table-column prop="unpaid" label="未结（元）" width="110" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.unpaid) }}</span></template>
          </el-table-column>
          <el-table-column prop="flow" label="生产流程" width="100" align="center">
            <template #default="{ row }">
              <span v-if="row.flow" class="erp-badge">{{ row.flow }}</span>
              <span v-if="row.handler" class="sub-text" style="margin-left: 4px">{{ row.handler }}</span>
            </template>
          </el-table-column>
          <el-table-column v-if="alertType === 'overdue'" label="交付日期" width="120">
            <template #default="{ row }">
              <span class="nowrap-text">{{ row.due ? formatDate(row.due) : '按宽限推算' }}</span>
            </template>
          </el-table-column>
          <el-table-column v-if="alertType === 'overdue'" label="超期" width="100" align="center">
            <template #default="{ row }"><span class="erp-badge" data-tone="danger">超期 {{ row.overDays }} 天</span></template>
          </el-table-column>
          <el-table-column v-if="alertType === 'unsettled'" label="结算状态" width="100" align="center">
            <template #default="{ row }"><span class="erp-badge" data-tone="warning">{{ row.settleStatus }}</span></template>
          </el-table-column>
          <el-table-column v-if="alertType === 'unaudited'" prop="date" label="登记时间" width="140">
            <template #default="{ row }"><span class="nowrap-text">{{ formatTime(row.date) }}</span></template>
          </el-table-column>
          <el-table-column prop="created" label="委托时间" width="140">
            <template #default="{ row }"><span v-if="row.created" class="nowrap-text">{{ formatTime(row.created) }}</span></template>
          </el-table-column>
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <div class="table-actions">
                <el-button link type="primary" size="small" @click="viewOrder(row)">详情</el-button>
                <el-button v-if="row.custCode && row.custCode !== '000000'" link type="primary" size="small" @click="viewCustomer(row)">客户</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <!-- 客户欠款超限 -->
        <el-table v-if="alertType === 'debt'" :data="filteredAlertData" v-loading="loading" stripe show-summary :summary-method="getDebtSummaries" style="width: 100%">
          <el-table-column prop="code" label="客户" width="180">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="viewCustomer(row)"><span class="mono-text">{{ row.code }} {{ row.name }}</span></el-button>
              <div class="sub-text">{{ row.groupName }}</div>
            </template>
          </el-table-column>
          <el-table-column label="联系人 / 电话" min-width="160">
            <template #default="{ row }">
              {{ row.contact || '未提供' }}
              <div class="sub-text">{{ row.phone }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="debt" label="欠款金额（元）" width="130" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.debt) }}</span></template>
          </el-table-column>
          <el-table-column prop="limit" label="信用额度（元）" width="130" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.limit) }}</span></template>
          </el-table-column>
          <el-table-column prop="over" label="超限金额（元）" width="130" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.over) }}</span></template>
          </el-table-column>
          <el-table-column label="结算方式" width="140" align="center">
            <template #default="{ row }">
              <span>{{ row.settleType }}</span>
              <span class="erp-badge" data-tone="warning" style="margin-left: 4px">欠款超限</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="viewCustomer(row)">客户资料</el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- 预存余额不足 -->
        <el-table v-if="alertType === 'low'" :data="filteredAlertData" v-loading="loading" stripe show-summary :summary-method="getCardSummaries" style="width: 100%">
          <el-table-column prop="cardNo" label="卡号" width="140">
            <template #default="{ row }"><span class="mono-text">{{ row.cardNo }}</span></template>
          </el-table-column>
          <el-table-column label="客户" width="180">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="viewCustomer(row)"><span class="mono-text">{{ row.custCode }} {{ row.custName }}</span></el-button>
              <div class="sub-text">{{ row.group }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="balance" label="卡内余额（元）" width="130" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.balance) }}</span></template>
          </el-table-column>
          <el-table-column prop="totalIn" label="累计储值（元）" width="130" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.totalIn) }}</span></template>
          </el-table-column>
          <el-table-column prop="totalOut" label="累计消费（元）" width="130" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.totalOut) }}</span></template>
          </el-table-column>
          <el-table-column prop="issueDate" label="发卡日期" width="110">
            <template #default="{ row }"><span class="nowrap-text">{{ formatDate(row.issueDate) }}</span></template>
          </el-table-column>
          <el-table-column label="状态" width="100" align="center">
            <template #default><span class="erp-badge" data-tone="warning">余额不足</span></template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="viewCustomer(row)">客户资料</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div class="erp-pagination" style="padding: 12px 16px">
        <span>共 {{ filteredAlertData.length }} 条记录</span>
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
const now = new Date().toLocaleString('zh-CN');
const searchQ = ref('');
const alertType = ref('overdue');

const thresholds = reactive({ grace: '3', credit: '2000', low: '1000' });

const fmtMoney = (v: any) => '￥' + Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatDate = (d: any) => { const dt = typeof d === 'string' ? new Date(d) : d; return dt.toLocaleDateString('zh-CN'); };
const formatTime = (d: any) => { const dt = typeof d === 'string' ? new Date(d) : d; return dt.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); };

const alertDefs = reactive([
  { key: 'overdue', label: '交付超期工单', note: '未完工且已过交付日期的工单', count: 0 },
  { key: 'unsettled', label: '未结算工单', note: '尚未结算或部分结算的工单', count: 0 },
  { key: 'debt', label: '客户欠款超限', note: '欠款金额超过信用额度的客户', count: 0 },
  { key: 'low', label: '预存余额不足', note: '会员卡余额低于预警线的预存客户', count: 0 },
  { key: 'unaudited', label: '未审核单据', note: '尚未审核的工作单、结算单与一般收支单据', count: 0 },
]);

const currentAlert = computed(() => alertDefs.find(a => a.key === alertType.value) || alertDefs[0]);

const alertData = ref<any[]>([]);
const filteredAlertData = computed(() => {
  if (!searchQ.value) return alertData.value;
  const q = searchQ.value.toLowerCase();
  return alertData.value.filter(r => {
    const text = (r.no || '') + (r.custName || '') + (r.name || '') + (r.code || '') + (r.cardNo || '') + (r.who || '') + (r.task || '');
    return text.toLowerCase().includes(q);
  });
});

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

const getDebtSummaries = (param: any) => {
  const { columns, data } = param;
  const sums: string[] = [];
  columns.forEach((col: any, i: number) => {
    if (i === 0) { sums[i] = '合计'; return; }
    if (['debt', 'limit', 'over'].includes(col.property)) {
      sums[i] = fmtMoney(data.reduce((s: number, r: any) => s + Number(r[col.property] || 0), 0));
    } else { sums[i] = ''; }
  });
  return sums;
};

const getCardSummaries = (param: any) => {
  const { columns, data } = param;
  const sums: string[] = [];
  columns.forEach((col: any, i: number) => {
    if (i === 0) { sums[i] = '合计'; return; }
    if (['balance', 'totalIn', 'totalOut'].includes(col.property)) {
      sums[i] = fmtMoney(data.reduce((s: number, r: any) => s + Number(r[col.property] || 0), 0));
    } else { sums[i] = ''; }
  });
  return sums;
};

const viewOrder = (row: any) => { router.push(`/frontdesk/orderDetail?no=${row.no}`); };
const viewCustomer = (row: any) => { router.push(`/customer?code=${row.custCode || row.code}`); };

const applyThresholds = () => {
  loadAlertData();
  ElMessage.success('提醒阈值已应用，数量已重新计算');
};

const loadAlertData = () => {
  loading.value = true;
  setTimeout(() => {
    const now = new Date();
    const DAY = 86400000;
    const mkDate = (offset: number) => new Date(now.getTime() + offset * DAY);

    if (alertType.value === 'overdue') {
      alertData.value = [
        { no: 'GD26101410002', custName: '长沙理工大学', custCode: '1010', task: '写真喷绘', amount: 580, paid: 300, unpaid: 280, flow: '喷绘', handler: '管理员', created: mkDate(-8), due: mkDate(-2), overDays: 2 },
        { no: 'GD26092210014', custName: '湖南省测绘院', custCode: '1020', task: '标识标牌', amount: 1200, paid: 600, unpaid: 600, flow: '雕刻', handler: '李四', created: mkDate(-30), due: mkDate(-1), overDays: 1 },
      ];
    } else if (alertType.value === 'unsettled') {
      alertData.value = [
        { no: 'GD26102210001', custName: '散户', custCode: '000000', task: '彩色打印 A4', amount: 120, paid: 0, unpaid: 120, flow: '排版', handler: '', created: mkDate(0), settleStatus: '未结算' },
        { no: 'GD26102110002', custName: '长沙理工大学', custCode: '1010', task: '写真喷绘', amount: 580, paid: 300, unpaid: 280, flow: '喷绘', handler: '管理员', created: mkDate(-1), settleStatus: '部分结算' },
        { no: 'GD26101810005', custName: '商务局', custCode: '1030', task: '雕刻切割', amount: 350, paid: 0, unpaid: 350, flow: '接单', handler: '', created: mkDate(-4), settleStatus: '未结算' },
      ];
    } else if (alertType.value === 'debt') {
      alertData.value = [
        { code: '1010', name: '长沙理工大学', groupName: '设计院', contact: '王老师', phone: '13800138001', debt: 3500, limit: 2000, over: 1500, settleType: '记账' },
      ];
    } else if (alertType.value === 'low') {
      alertData.value = [
        { cardNo: 'HY20260001', custCode: '2001', custName: '张三', group: '普通', balance: 50, totalIn: 500, totalOut: 450, issueDate: mkDate(-365) },
        { cardNo: 'HY20260002', custCode: '2002', custName: '李四', group: '普通', balance: 80, totalIn: 300, totalOut: 220, issueDate: mkDate(-200) },
      ];
    } else {
      alertData.value = [
        { type: '工作单', no: 'GD26102210001', date: mkDate(0), who: '散户', amount: 120, handler: '张三', created: mkDate(0), order: true, custCode: '000000' },
        { type: '结算单', no: 'JS261021001', date: mkDate(-1), who: '长沙理工大学', amount: 580, handler: '张三', custCode: '1010' },
        { type: '工作单', no: 'GD26101810005', date: mkDate(-4), who: '商务局', amount: 350, handler: '张三', created: mkDate(-4), order: true, custCode: '1030' },
        { type: '一般收入', no: 'SR261017001', date: mkDate(-5), who: '其他收入 / 营业外收入', amount: 200, handler: '管理员' },
        { type: '结算单', no: 'JS261016001', date: mkDate(-6), who: '王五', amount: 960, handler: '张三', custCode: '2003' },
      ];
    }

    alertDefs.forEach(a => {
      if (a.key === 'overdue') a.count = 2;
      else if (a.key === 'unsettled') a.count = 3;
      else if (a.key === 'debt') a.count = 1;
      else if (a.key === 'low') a.count = 2;
      else if (a.key === 'unaudited') a.count = 5;
    });

    loading.value = false;
  }, 200);
};

onMounted(() => loadAlertData());
</script>

<style scoped lang="scss">
.table-actions { display: flex; align-items: center; gap: 4px; }
.mono-text { font-family: var(--erp-font-mono); font-variant-numeric: tabular-nums; }
.mono-cell { font-family: var(--erp-font-mono); font-variant-numeric: tabular-nums; }
.sub-text { font-size: 12px; color: var(--erp-text-soft); }
.nowrap-text { white-space: nowrap; }
</style>
