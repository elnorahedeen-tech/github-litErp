<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 财务</p>
        <h1>收支记录</h1>
        <p class="erp-pagehead-desc">一般收入、一般支出单据。未审核的可以删除，删除时冲回资金科目余额。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button type="primary" @click="router.push('/finance/generalRecords?type=income')">新建一般收入</el-button>
        <el-button @click="router.push('/finance/generalRecords?type=expense')">新建一般支出</el-button>
      </div>
    </div>

    <div class="erp-toolbar">
      <div class="erp-toolbar-item">
        <label>搜索</label>
        <el-input v-model="search.q" placeholder="单据编号 / 客户单位 / 备注" clearable style="width: 220px" />
      </div>
      <div class="erp-toolbar-item">
        <label>收支类型</label>
        <el-select v-model="search.kind" clearable placeholder="全部" style="width: 120px">
          <el-option label="一般收入" value="一般收入" />
          <el-option label="一般支出" value="一般支出" />
        </el-select>
      </div>
      <div class="erp-toolbar-item">
        <label>资金科目</label>
        <el-select v-model="search.account" clearable placeholder="全部" style="width: 170px">
          <el-option v-for="a in accountOptions" :key="a" :label="a" :value="a" />
        </el-select>
      </div>
      <div class="erp-toolbar-item">
        <label>收支科目</label>
        <el-select v-model="search.type" clearable placeholder="全部" style="width: 140px">
          <el-option v-for="t in typeOptions" :key="t" :label="t" :value="t" />
        </el-select>
      </div>
      <div class="erp-toolbar-item">
        <label>支付方式</label>
        <el-select v-model="search.method" clearable placeholder="全部" style="width: 120px">
          <el-option v-for="m in methodOptions" :key="m" :label="m" :value="m" />
        </el-select>
      </div>
      <div class="erp-toolbar-item">
        <label>审核</label>
        <el-select v-model="search.audit" clearable placeholder="全部" style="width: 120px">
          <el-option label="已审核" value="已审核" />
          <el-option label="未审核" value="未审核" />
        </el-select>
      </div>
      <div class="erp-toolbar-item">
        <label>业务日期</label>
        <el-date-picker v-model="search.DateRange" type="daterange" range-separator="至" start-placeholder="开始" end-placeholder="结束" value-format="YYYY-MM-DD" style="width: 240px" />
      </div>
      <div class="erp-toolbar-actions">
        <el-button type="primary" @click="getTbody">筛选</el-button>
        <el-button @click="resetSearch">重置</el-button>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-table-wrap">
        <el-table :data="tableData" v-loading="loading" stripe show-summary :summary-method="getSummaries" style="width: 100%">
          <el-table-column prop="code" label="单据编号" width="160">
            <template #default="{ row }"><span class="mono-text">{{ row.code }}</span></template>
          </el-table-column>
          <el-table-column prop="date" label="业务日期" width="120" />
          <el-table-column prop="kind" label="收支类型 / 科目" min-width="170">
            <template #default="{ row }">
              <span class="erp-badge" :data-tone="row.kind === '一般收入' ? 'success' : 'danger'">{{ row.kind }}</span>
              <div class="sub-text">{{ row.type }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="account" label="资金科目 / 支付方式" min-width="170">
            <template #default="{ row }">
              {{ row.account }}
              <div v-if="row.method" class="sub-text">{{ row.method }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="inAmt" label="收入金额（元）" width="130" align="right">
            <template #default="{ row }"><span class="mono-cell text-success">{{ row.inAmt ? fmtMoney(row.inAmt) : '—' }}</span></template>
          </el-table-column>
          <el-table-column prop="outAmt" label="支出金额（元）" width="130" align="right">
            <template #default="{ row }"><span class="mono-cell text-danger">{{ row.outAmt ? fmtMoney(row.outAmt) : '—' }}</span></template>
          </el-table-column>
          <el-table-column prop="cust" label="客户单位" min-width="140">
            <template #default="{ row }">{{ row.cust || '—' }}</template>
          </el-table-column>
          <el-table-column prop="bill" label="票据" width="120">
            <template #default="{ row }">
              {{ row.invoice ? '有发票' : '无发票' }}
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
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';

const router = useRouter();
const loading = ref(false);
const tableData = ref<any[]>([]);

const search = reactive({
  q: '', kind: '', account: '', type: '', method: '', audit: '', DateRange: [] as string[],
});

const accountOptions = ['现金>前台钱箱', '现金>备用金', '银行存款>微信', '银行存款>支付宝', '银行存款>工商银行'];
const typeOptions = ['废品变卖', '房租收入', '房租', '水电', '工资', '采购', '办公费', '交通费'];
const methodOptions = ['现钞', '微信', '支付宝', '刷卡', '转账'];

const fmtMoney = (v: any) => '￥' + Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const getSummaries = (param: any) => {
  const { columns, data } = param;
  const sums: string[] = [];
  columns.forEach((col: any, i: number) => {
    if (i === 0) { sums[i] = '合计'; return; }
    if (['inAmt', 'outAmt'].includes(col.property)) {
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
  ElMessageBox.confirm(`删除${row.kind}单 ${row.code}？`, '提示', { type: 'warning' })
    .then(() => { tableData.value = tableData.value.filter(r => r.code !== row.code); ElMessage.success('删除成功'); })
    .catch(() => {});
};

const resetSearch = () => {
  search.q = ''; search.kind = ''; search.account = ''; search.type = '';
  search.method = ''; search.audit = ''; search.DateRange = [];
};

const getTbody = () => {
  loading.value = true;
  setTimeout(() => {
    tableData.value = [
      { code: 'SR261018001', date: '2026-10-18', kind: '一般收入', type: '废品变卖', account: '现金>前台钱箱', method: '现钞', inAmt: 200, outAmt: 0, cust: '废品回收', invoice: false, billInfo: '', handler: '张三', audited: true, remark: '废品变卖' },
      { code: 'ZC261017001', date: '2026-10-17', kind: '一般支出', type: '房租', account: '银行存款>工商银行', method: '转账', inAmt: 0, outAmt: 8000, cust: '房东', invoice: true, billInfo: 'FP261017001', handler: '管理员', audited: true, remark: '10月房租' },
      { code: 'SR261015001', date: '2026-10-15', kind: '一般收入', type: '房租收入', account: '银行存款>工商银行', method: '转账', inAmt: 12000, outAmt: 0, cust: '二楼租户', invoice: true, billInfo: 'FP261015001', handler: '管理员', audited: true, remark: '10月租金' },
      { code: 'ZC261012001', date: '2026-10-12', kind: '一般支出', type: '水电', account: '银行存款>工商银行', method: '转账', inAmt: 0, outAmt: 1850, cust: '供电公司', invoice: true, billInfo: 'FP261012001', handler: '管理员', audited: false, remark: '9月电费' },
      { code: 'ZC261005001', date: '2026-10-05', kind: '一般支出', type: '采购', account: '银行存款>支付宝', method: '支付宝', inAmt: 0, outAmt: 3200, cust: '印刷材料供应商', invoice: false, billInfo: '', handler: '管理员', audited: true, remark: '纸张采购' },
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
