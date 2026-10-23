<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 财务</p>
        <h1>转账记录</h1>
        <p class="erp-pagehead-desc">现金、银行科目之间的转账单。未审核的可以删除，删除时冲回两个科目的余额。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button type="primary" @click="router.push('/finance/transferRecords?type=new')">新建转账</el-button>
        <el-button @click="router.push('/finance/cashBalance')">现金余额</el-button>
        <el-button @click="router.push('/finance/bankBalance')">银行余额</el-button>
      </div>
    </div>

    <div class="erp-toolbar">
      <div class="erp-toolbar-item">
        <label>搜索</label>
        <el-input v-model="search.q" placeholder="转账单号 / 票据 / 备注" clearable style="width: 220px" />
      </div>
      <div class="erp-toolbar-item">
        <label>业务日期</label>
        <el-date-picker v-model="search.DateRange" type="daterange" range-separator="至" start-placeholder="开始" end-placeholder="结束" value-format="YYYY-MM-DD" style="width: 240px" />
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
          <el-table-column prop="code" label="转账单号" width="160">
            <template #default="{ row }"><span class="mono-text">{{ row.code }}</span></template>
          </el-table-column>
          <el-table-column prop="date" label="业务日期" width="120" />
          <el-table-column prop="fromAcct" label="转出科目" min-width="170" />
          <el-table-column prop="toAcct" label="转入科目" min-width="170" />
          <el-table-column prop="amount" label="转账金额（元）" width="130" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.amount) }}</span></template>
          </el-table-column>
          <el-table-column prop="fee" label="手续费（元）" width="110" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ row.fee ? fmtMoney(row.fee) : '—' }}</span></template>
          </el-table-column>
          <el-table-column prop="payMethod" label="支付方式" width="100" />
          <el-table-column prop="bill" label="票据" min-width="140">
            <template #default="{ row }">
              {{ row.bill || '—' }}
              <div v-if="row.billInfo" class="sub-text">{{ row.billInfo }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="handler" label="经手" width="90" />
          <el-table-column prop="audited" label="审核" width="90" align="center">
            <template #default="{ row }">
              <span class="erp-badge" :data-tone="row.audited ? 'success' : 'info'">{{ row.audited ? '已审核' : '未审核' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="140" :show-overflow-tooltip="true" />
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
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';

const router = useRouter();
const loading = ref(false);
const tableData = ref<any[]>([]);
const search = reactive({ q: '', DateRange: [] as string[], audit: '' });

const fmtMoney = (v: any) => '￥' + Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const getSummaries = (param: any) => {
  const { columns, data } = param;
  const sums: string[] = [];
  columns.forEach((col: any, i: number) => {
    if (i === 0) { sums[i] = '合计'; return; }
    if (['amount', 'fee'].includes(col.property)) {
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
  ElMessageBox.confirm(`删除转账单 ${row.code}？`, '提示', { type: 'warning' })
    .then(() => { tableData.value = tableData.value.filter(r => r.code !== row.code); ElMessage.success('删除成功'); })
    .catch(() => {});
};

const resetSearch = () => { search.q = ''; search.DateRange = []; search.audit = ''; };

const getTbody = () => {
  loading.value = true;
  setTimeout(() => {
    tableData.value = [
      { code: 'ZZ261020001', date: '2026-10-20', fromAcct: '银行存款>微信', toAcct: '银行存款>工商银行', amount: 10000, fee: 0, payMethod: '转账', bill: '', billInfo: '', handler: '管理员', audited: true, remark: '微信提现' },
      { code: 'ZZ261018001', date: '2026-10-18', fromAcct: '现金>前台钱箱', toAcct: '现金>备用金', amount: 5000, fee: 0, payMethod: '现钞', bill: '', billInfo: '', handler: '管理员', audited: true, remark: '备用金补充' },
      { code: 'ZZ261015001', date: '2026-10-15', fromAcct: '银行存款>支付宝', toAcct: '银行存款>工商银行', amount: 8000, fee: 2, payMethod: '转账', bill: '支付宝提现单', billInfo: 'TX261015001', handler: '管理员', audited: false, remark: '支付宝提现' },
    ];
    loading.value = false;
  }, 200);
};

onMounted(() => getTbody());
</script>

<style scoped lang="scss">
.table-actions { display: flex; align-items: center; gap: 4px; }
.mono-text { font-family: var(--erp-font-mono); font-variant-numeric: tabular-nums; }
</style>
