<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 前台</p>
        <h1>营业日报表</h1>
        <p class="erp-pagehead-desc">汇总结算、预存、零收、一般收支等财务单据在指定时间范围内的数据。</p>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-panelhead"><h2>统计条件</h2></div>
      <div class="erp-panelbody" style="padding: 0">
        <div class="erp-toolbar">
          <div class="erp-toolbar-item" style="flex: 2 1 520px">
            <label>业务日期</label>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap">
              <el-select v-model="preset" style="width: 120px" @change="onPresetChange">
                <el-option v-for="p in presets" :key="p.value" :label="p.label" :value="p.value" />
              </el-select>
              <el-date-picker v-model="dateFrom" type="date" placeholder="开始日期" value-format="YYYY-MM-DD" style="width: 150px" />
              <span>至</span>
              <el-date-picker v-model="dateTo" type="date" placeholder="结束日期" value-format="YYYY-MM-DD" style="width: 150px" />
            </div>
          </div>
          <div class="erp-toolbar-item">
            <label>经手人员</label>
            <el-select v-model="handler" clearable placeholder="全部" style="width: 120px">
              <el-option v-for="e in empOptions" :key="e" :label="e" :value="e" />
            </el-select>
          </div>
          <div class="erp-toolbar-item">
            <label>支付方式</label>
            <el-select v-model="payWay" clearable placeholder="全部" style="width: 120px">
              <el-option v-for="w in wayOptions" :key="w" :label="w" :value="w" />
            </el-select>
          </div>
          <div class="erp-toolbar-item">
            <label>发票状态</label>
            <el-select v-model="invoice" clearable placeholder="全部" style="width: 100px">
              <el-option label="有票" value="有票" />
              <el-option label="无票" value="无票" />
            </el-select>
          </div>
          <div class="erp-toolbar-actions">
            <el-button type="primary" @click="runReport">统计</el-button>
          </div>
        </div>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-panelhead">
        <h2>汇总</h2>
        <span class="erp-panelhead-note">单位：元 · 共 {{ totalDocs }} 张单据</span>
      </div>
      <div class="erp-panelbody">
        <dl class="erp-summary">
          <div><dt>收款净额（元）</dt><dd class="mono-cell">{{ fmtMoney(summary.paymentNet) }}</dd></div>
          <div><dt>现金净额（元）</dt><dd class="mono-cell">{{ fmtMoney(summary.cashNet) }}</dd></div>
          <div><dt>新增应收（元）</dt><dd class="mono-cell">{{ fmtMoney(summary.arNet) }}</dd></div>
          <div><dt>预存净增（元）</dt><dd class="mono-cell">{{ fmtMoney(summary.prestoreNet) }}</dd></div>
        </dl>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-top: 16px">
          <div v-for="section in summarySections" :key="section.title" class="erp-panel" style="margin: 0">
            <div class="erp-panelhead"><h3 style="font-size: 14px">{{ section.title }}汇总</h3></div>
            <div class="erp-table-wrap">
              <el-table :data="section.rows" size="small" style="width: 100%">
                <el-table-column prop="dir" label="方向" width="60" />
                <el-table-column prop="item" label="项目" min-width="100" />
                <el-table-column prop="count" label="单数" width="60" align="right" />
                <el-table-column prop="value" label="金额（元）" width="110" align="right">
                  <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.value) }}</span></template>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-panelhead">
        <h2>明细</h2>
        <div class="erp-pagehead-actions">
          <el-button @click="handleExport">导出当前页签</el-button>
          <el-button @click="window.print()">打印</el-button>
        </div>
      </div>
      <div class="erp-table-wrap">
        <el-table :data="detailData" stripe style="width: 100%">
          <el-table-column prop="no" label="单据编号" width="140" align="center" />
          <el-table-column prop="bizType" label="业务类型" width="100" />
          <el-table-column prop="doc" label="业务单据" width="140" />
          <el-table-column prop="party" label="往来单位" min-width="140" />
          <el-table-column prop="income" label="收入金额（元）" width="120" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ row.income ? fmtMoney(row.income) : '—' }}</span></template>
          </el-table-column>
          <el-table-column prop="expense" label="支出金额（元）" width="120" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ row.expense ? fmtMoney(row.expense) : '—' }}</span></template>
          </el-table-column>
          <el-table-column prop="account" label="会计科目" width="170" />
          <el-table-column prop="method" label="支付方式" width="100" />
          <el-table-column prop="date" label="业务日期" width="120" />
        </el-table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';

const preset = ref('month');
const dateFrom = ref('');
const dateTo = ref('');
const handler = ref('');
const payWay = ref('');
const invoice = ref('');

const presets = [
  { value: 'today', label: '今天' },
  { value: 'yesterday', label: '昨天' },
  { value: 'month', label: '本月' },
  { value: 'lastMonth', label: '上月' },
  { value: 'last30', label: '近 30 天' },
  { value: 'year', label: '今年' },
  { value: 'custom', label: '自定义' },
];

const empOptions = ['管理员', '张三', '李四'];
const wayOptions = ['现钞', '支票', '刷卡', '汇款', '微信', '支付宝', '其他'];

const totalDocs = ref(0);
const detailData = ref<any[]>([]);

const summary = reactive({
  paymentNet: 0,
  cashNet: 0,
  arNet: 0,
  prestoreNet: 0,
});

const summarySections = ref<any[]>([]);

const fmtMoney = (v: number) => '￥' + (v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const onPresetChange = () => {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  const fmt = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  switch (preset.value) {
    case 'today': dateFrom.value = fmt(now); dateTo.value = fmt(now); break;
    case 'yesterday': { const yd = new Date(y, m, d - 1); dateFrom.value = fmt(yd); dateTo.value = fmt(yd); break; }
    case 'month': dateFrom.value = fmt(new Date(y, m, 1)); dateTo.value = fmt(new Date(y, m + 1, 0)); break;
    case 'lastMonth': dateFrom.value = fmt(new Date(y, m - 1, 1)); dateTo.value = fmt(new Date(y, m, 0)); break;
    case 'last30': dateFrom.value = fmt(new Date(y, m, d - 30)); dateTo.value = fmt(now); break;
    case 'year': dateFrom.value = fmt(new Date(y, 0, 1)); dateTo.value = fmt(new Date(y, 11, 31)); break;
  }
};

const handleExport = () => { ElMessage.success('导出功能开发中'); };

const runReport = () => {
  summary.paymentNet = 19500;
  summary.cashNet = 16300;
  summary.arNet = 22000;
  summary.prestoreNet = 5000;
  totalDocs.value = 7;

  summarySections.value = [
    { title: '支付方式', rows: [
      { dir: '增加', item: '现钞', count: 2, value: 16300 },
      { dir: '增加', item: '微信', count: 1, value: 3200 },
    ] },
    { title: '现金', rows: [
      { dir: '增加', item: '结算单', count: 2, value: 16300 },
      { dir: '增加', item: '预存单', count: 1, value: 5000 },
    ] },
    { title: '应收', rows: [
      { dir: '增加', item: '结算单', count: 1, value: 22000 },
    ] },
    { title: '预存', rows: [
      { dir: '增加', item: '预存单（含赠送）', count: 1, value: 5500 },
    ] },
  ];

  detailData.value = [
    { no: 'JS261021001', bizType: '结算单', doc: '工单结算', party: '世纪出版社', income: 15800, expense: 0, account: '现金>前台钱箱', method: '现钞', date: '2026-10-21' },
    { no: 'JS261021002', bizType: '结算单', doc: '工单结算', party: '新华书店', income: 3200, expense: 0, account: '银行存款>微信', method: '微信', date: '2026-10-21' },
    { no: 'JS261020001', bizType: '结算单', doc: '工单结算', party: '万科地产', income: 0, expense: 0, account: '应收账款', method: '记账', date: '2026-10-20' },
    { no: 'YC26102110001', bizType: '预存单', doc: '会员卡 IC880001', party: '世纪出版社', income: 5000, expense: 0, account: '现金>前台钱箱', method: '现钞', date: '2026-10-21' },
    { no: 'LS26102110001', bizType: '零收单', doc: '复印 A4 黑白', party: '零收散户', income: 5, expense: 0, account: '现金>前台钱箱', method: '现钞', date: '2026-10-21' },
  ];
};

onMounted(() => {
  onPresetChange();
  runReport();
});
</script>
