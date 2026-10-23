<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 财务</p>
        <h1>销账记录</h1>
        <p class="erp-pagehead-desc">收回客户记账款项的销账单。未审核的销账单计入客户"销账未审"，可以删除。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button type="primary" @click="router.push('/finance/writeOffRecords?type=new')">新建销账</el-button>
        <el-button @click="router.push('/finance/custBalance')">客户结余</el-button>
      </div>
    </div>

    <div class="erp-toolbar">
      <div class="erp-toolbar-item">
        <label>搜索</label>
        <el-input v-model="search.q" placeholder="销账单号 / 客户 / 票据" clearable style="width: 220px" />
      </div>
      <div class="erp-toolbar-item">
        <label>业务日期</label>
        <el-date-picker v-model="search.DateRange" type="daterange" range-separator="至" start-placeholder="开始" end-placeholder="结束" value-format="YYYY-MM-DD" style="width: 240px" />
      </div>
      <div class="erp-toolbar-item">
        <label>入账科目</label>
        <el-select v-model="search.account" clearable placeholder="全部" style="width: 170px">
          <el-option v-for="a in accountOptions" :key="a" :label="a" :value="a" />
        </el-select>
      </div>
      <div class="erp-toolbar-item">
        <label>支付方式</label>
        <el-select v-model="search.method" clearable placeholder="全部" style="width: 120px">
          <el-option v-for="m in methodOptions" :key="m" :label="m" :value="m" />
        </el-select>
      </div>
      <div class="erp-toolbar-item">
        <label>发票</label>
        <el-select v-model="search.invoice" clearable placeholder="全部" style="width: 120px">
          <el-option label="已开发票" value="y" />
          <el-option label="未开发票" value="n" />
        </el-select>
      </div>
      <div class="erp-toolbar-item">
        <label>审核</label>
        <el-select v-model="search.audit" clearable placeholder="全部" style="width: 120px">
          <el-option label="已审核" value="已审核" />
          <el-option label="未审核" value="未审核" />
        </el-select>
      </div>
      <div class="erp-toolbar-actions">
        <el-button type="primary" @click="getTbody">筛选</el-button>
        <el-button @click="resetSearch">重置</el-button>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-table-wrap">
        <el-table :data="tableData" v-loading="loading" stripe show-summary :summary-method="getSummaries" style="width: 100%">
          <el-table-column prop="code" label="销账单号" width="160">
            <template #default="{ row }"><span class="mono-text">{{ row.code }}</span></template>
          </el-table-column>
          <el-table-column prop="date" label="业务日期" width="120" />
          <el-table-column prop="custName" label="客户" min-width="180">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="router.push(`/finance/custStatement?cust=${row.custCode}`)">{{ row.custName }}</el-button>
              <div v-if="row.custHandler" class="sub-text">{{ row.custHandler }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="amount" label="结算金额（元）" width="130" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.amount) }}</span></template>
          </el-table-column>
          <el-table-column prop="wipe" label="抹零（元）" width="100" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.wipe) }}</span></template>
          </el-table-column>
          <el-table-column prop="real" label="实结（元）" width="110" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.real) }}</span></template>
          </el-table-column>
          <el-table-column prop="cash" label="现金实结（元）" width="130" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.cash) }}</span></template>
          </el-table-column>
          <el-table-column prop="account" label="现金科目 / 支付方式" min-width="170">
            <template #default="{ row }">
              {{ row.account || '—' }}
              <div v-if="row.method" class="sub-text">{{ row.method }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="fee" label="手续费（元）" width="110" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ row.fee ? fmtMoney(row.fee) : '—' }}</span></template>
          </el-table-column>
          <el-table-column prop="prestore" label="预存实结（元）" width="130" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ row.prestore ? fmtMoney(row.prestore) : '—' }}</span></template>
          </el-table-column>
          <el-table-column prop="bill" label="票据" width="120">
            <template #default="{ row }">
              {{ row.invoice ? '已开发票' : '未开发票' }}
              <div v-if="row.billInfo" class="sub-text">{{ row.billInfo }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="handler" label="经手" width="90" />
          <el-table-column prop="audited" label="审核" width="90" align="center">
            <template #default="{ row }">
              <span class="erp-badge" :data-tone="row.audited ? 'success' : 'info'">{{ row.audited ? '已审核' : '未审核' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="120" :show-overflow-tooltip="true" />
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{ row }">
              <div class="table-actions">
                <el-button link type="primary" size="small" @click="toggleAudit(row)">{{ row.audited ? '反审核' : '审核' }}</el-button>
                <el-button v-if="!row.audited" link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div class="erp-pagination" style="padding: 12px 16px">
        <span>共 {{ tableData.length }} 条记录</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';

const router = useRouter();
const route = useRoute();
const loading = ref(false);
const tableData = ref<any[]>([]);

const search = reactive({
  q: '', DateRange: [] as string[], account: '', method: '', invoice: '', audit: '',
});

const accountOptions = ['现金>前台钱箱', '银行存款>微信', '银行存款>支付宝', '银行存款>工商银行'];
const methodOptions = ['现钞', '微信', '支付宝', '刷卡', '转账'];

const fmtMoney = (v: any) => '￥' + Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const getSummaries = (param: any) => {
  const { columns, data } = param;
  const sums: string[] = [];
  columns.forEach((col: any, i: number) => {
    if (i === 0) { sums[i] = '合计'; return; }
    if (['amount', 'wipe', 'real', 'cash', 'fee', 'prestore'].includes(col.property)) {
      sums[i] = fmtMoney(data.reduce((s: number, r: any) => s + Number(r[col.property] || 0), 0));
    } else { sums[i] = ''; }
  });
  return sums;
};

const toggleAudit = (row: any) => {
  row.audited = !row.audited;
  ElMessage.success(row.audited ? '已审核' : '已反审核');
};

const handleDelete = (row: any) => {
  ElMessageBox.confirm(`删除销账单 ${row.code}？结算金额 ${fmtMoney(row.amount)} 元。`, '提示', { type: 'warning' })
    .then(() => { tableData.value = tableData.value.filter(r => r.code !== row.code); ElMessage.success('删除成功'); })
    .catch(() => {});
};

const resetSearch = () => {
  search.q = ''; search.DateRange = []; search.account = ''; search.method = ''; search.invoice = ''; search.audit = '';
};

const getTbody = () => {
  loading.value = true;
  setTimeout(() => {
    tableData.value = [
      { code: 'JS26092210001', date: '2026-09-22', custCode: '100001', custName: '北京印特印科技公司', custHandler: '', amount: 2213.4, wipe: 0, real: 2213.4, cash: 2213.4, account: '银行存款>工商银行', method: '转账', fee: 0, prestore: 0, invoice: false, billInfo: '', handler: '小管', audited: true, remark: '' },
      { code: 'JS26081410006', date: '2026-08-14', custCode: '100002', custName: '旭东洗浴', custHandler: '', amount: 8, wipe: 8, real: 0, cash: 0, account: '', method: '', fee: 0, prestore: 0, invoice: false, billInfo: '', handler: '小管', audited: true, remark: '全额抹零' },
      { code: 'JS26081410005', date: '2026-08-14', custCode: '100003', custName: '商务局', custHandler: '', amount: 5247.7, wipe: 0, real: 5247.7, cash: 5247.7, account: '现金>前台钱箱', method: '现钞', fee: 0, prestore: 0, invoice: false, billInfo: '', handler: '小管', audited: true, remark: '' },
      { code: 'JS26052810001', date: '2026-05-28', custCode: '100004', custName: '北京亚德鲁公司', custHandler: '财务张', amount: 123.12, wipe: 0.12, real: 123, cash: 123, account: '现金>前台钱箱', method: '现钞', fee: 0, prestore: 0, invoice: true, billInfo: 'FP260528001', handler: '小管', audited: false, remark: '' },
      { code: 'JS26022810004', date: '2026-02-28', custCode: '100005', custName: '天津工业大学', custHandler: '', amount: 2332.7, wipe: 32.7, real: 2300, cash: 2300, account: '银行存款>工商银行', method: '转账', fee: 0, prestore: 0, invoice: true, billInfo: 'FP260228001', handler: '小管', audited: true, remark: '' },
    ];
    loading.value = false;
  }, 200);
};

onMounted(() => {
  getTbody();
  const cust = route.query.cust as string;
  if (cust) search.q = cust;
});
</script>

<style scoped lang="scss">
.table-actions { display: flex; align-items: center; gap: 4px; }
.mono-text { font-family: var(--erp-font-mono); font-variant-numeric: tabular-nums; }
</style>
