<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 生产</p>
        <h1>制作明细记录</h1>
        <p class="erp-pagehead-desc">把工单展开到明细行，按经营项目核对制作数量与金额。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button @click="handleExport">导出筛选结果</el-button>
      </div>
    </div>

    <div class="erp-toolbar">
      <div class="erp-toolbar-item">
        <label>快速查找</label>
        <el-input v-model="search.q" placeholder="工单编号 / 客户 / 项目名称" clearable style="width: 240px" />
      </div>
      <div class="erp-toolbar-item">
        <label>生产流程</label>
        <el-select v-model="search.flow" clearable placeholder="全部" style="width: 120px">
          <el-option v-for="f in flowOptions" :key="f" :label="f" :value="f" />
        </el-select>
      </div>
      <div class="erp-toolbar-item">
        <label>经营主项</label>
        <el-select v-model="search.cat" clearable placeholder="全部" style="width: 140px">
          <el-option v-for="c in catOptions" :key="c" :label="c" :value="c" />
        </el-select>
      </div>
      <div class="erp-toolbar-item">
        <label>委托日期</label>
        <el-date-picker v-model="search.dateRange" type="daterange" range-separator="至" start-placeholder="开始" end-placeholder="结束" value-format="YYYY-MM-DD" style="width: 240px" />
      </div>
      <div class="erp-toolbar-actions">
        <el-button type="primary" @click="loadData">筛选</el-button>
        <el-button @click="resetSearch">重置</el-button>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-panelhead"><h2>制作明细</h2><span class="erp-panelhead-note">合计为全部筛选结果 · 委托时间为北京时间</span></div>
      <div class="erp-table-wrap">
        <el-table :data="filteredData" v-loading="loading" stripe show-summary :summary-method="getSummaries" style="width: 100%">
          <el-table-column prop="no" label="工单编号 / 行号" width="170" fixed>
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="viewOrder(row)"><span class="mono-text">{{ row.no }}</span></el-button>
              <div class="sub-text">第 {{ row.seq }} 行</div>
            </template>
          </el-table-column>
          <el-table-column prop="created" label="委托时间" width="140">
            <template #default="{ row }"><span class="nowrap-text">{{ formatTime(row.created) }}</span></template>
          </el-table-column>
          <el-table-column prop="custName" label="客户名称" min-width="160">
            <template #default="{ row }">
              {{ row.custName }}
              <div class="sub-text">{{ row.group }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="code" label="编号" width="100">
            <template #default="{ row }"><span class="mono-text">{{ row.code }}</span></template>
          </el-table-column>
          <el-table-column prop="catName" label="主项" width="110" />
          <el-table-column prop="name" label="子项" min-width="180" />
          <el-table-column prop="unit" label="单位" width="60" align="center" />
          <el-table-column prop="price" label="实价（元）" width="100" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.price) }}</span></template>
          </el-table-column>
          <el-table-column prop="copies" label="份数" width="70" align="right" />
          <el-table-column prop="qty" label="每份数量" width="90" align="right" />
          <el-table-column prop="total" label="制作总数" width="90" align="right" />
          <el-table-column prop="amount" label="金额（元）" width="110" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.amount) }}</span></template>
          </el-table-column>
          <el-table-column prop="flow" label="生产流程" width="100" align="center">
            <template #default="{ row }">
              <span class="erp-badge" :data-tone="row.flow === '完工' ? 'success' : ''">{{ row.flow }}</span>
              <div v-if="row.handler" class="sub-text">{{ row.handler }}</div>
            </template>
          </el-table-column>
          <el-table-column label="制作任务 / 要求" min-width="140">
            <template #default="{ row }">
              {{ row.task || '—' }}
              <div v-if="row.req" class="sub-text">{{ row.req }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="receptionist" label="接待人员" width="90" />
          <el-table-column prop="remark" label="说明" width="100">
            <template #default="{ row }">{{ row.remark || '—' }}</template>
          </el-table-column>
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{ row }">
              <div class="table-actions">
                <el-button link type="primary" size="small" @click="viewOrder(row)">工单详情</el-button>
                <el-button link type="primary" size="small" @click="flowTransfer(row)">流程转单</el-button>
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
import { ElMessage, ElMessageBox } from 'element-plus';

const router = useRouter();
const loading = ref(false);
const tableData = ref<any[]>([]);
const search = reactive({ q: '', flow: '', cat: '', dateRange: [] as string[] });

const flowOptions = ['接单', '排版', '喷绘', '雕刻', '组装', '质检', '完工'];
const catOptions = ['广告喷绘', '标识标牌', '文创产品', '标准产品', '装裱服务'];

const fmtMoney = (v: any) => '￥' + Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatTime = (d: any) => { const dt = typeof d === 'string' ? new Date(d) : d; return dt.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); };

const filteredData = computed(() => {
  let data = tableData.value;
  if (search.q) {
    const q = search.q.toLowerCase();
    data = data.filter(r => (r.no + r.custName + r.name + r.code).toLowerCase().includes(q));
  }
  if (search.flow) data = data.filter(r => r.flow === search.flow);
  if (search.cat) data = data.filter(r => r.catName === search.cat);
  return data;
});

const getSummaries = (param: any) => {
  const { columns, data } = param;
  const sums: string[] = [];
  columns.forEach((col: any, i: number) => {
    if (i === 0) { sums[i] = '合计'; return; }
    if (['copies', 'qty', 'total'].includes(col.property)) {
      sums[i] = String(data.reduce((s: number, r: any) => s + Number(r[col.property] || 0), 0));
    } else if (col.property === 'amount') {
      sums[i] = fmtMoney(data.reduce((s: number, r: any) => s + Number(r.amount || 0), 0));
    } else { sums[i] = ''; }
  });
  return sums;
};

const resetSearch = () => { search.q = ''; search.flow = ''; search.cat = ''; search.dateRange = []; };
const viewOrder = (row: any) => { router.push(`/frontdesk/orderDetail?no=${row.no}`); };

const flowTransfer = (row: any) => {
  const idx = flowOptions.indexOf(row.flow);
  if (idx < 0 || idx >= flowOptions.length - 1) { ElMessage.info('该工单已完工或流程异常'); return; }
  const next = flowOptions[idx + 1];
  ElMessageBox.confirm(`把工单 ${row.no} 从「${row.flow}」转到「${next}」？`, '流程转单', { type: 'info' })
    .then(() => {
      tableData.value.forEach(r => { if (r.no === row.no) r.flow = next; });
      ElMessage.success(`工单 ${row.no} 已转到「${next}」`);
    })
    .catch(() => {});
};

const handleExport = () => { ElMessage.info('导出制作明细记录 CSV'); };

const loadData = () => {
  loading.value = true;
  setTimeout(() => {
    const now = new Date();
    const DAY = 86400000;
    const mkDate = (offset: number) => new Date(now.getTime() + offset * DAY);
    tableData.value = [
      { id: 'GD26102110002#1', no: 'GD26102110002', seq: 1, created: mkDate(-1), custName: '长沙理工大学', group: '设计院', flow: '喷绘', handler: '管理员', task: '写真喷绘', req: '户外防水', receptionist: '张三', code: '250010', cat: 'ad', catName: '广告喷绘', name: '车贴（反光膜）', unit: '㎡', price: 65, copies: 1, qty: 6, total: 6, amount: 390, remark: '' },
      { id: 'GD26102110002#2', no: 'GD26102110002', seq: 2, created: mkDate(-1), custName: '长沙理工大学', group: '设计院', flow: '喷绘', handler: '管理员', task: '写真喷绘', req: '户外防水', receptionist: '张三', code: '250020', cat: 'ad', catName: '广告喷绘', name: '相纸写真', unit: '㎡', price: 45, copies: 1, qty: 4, total: 4, amount: 180, remark: '' },
      { id: 'GD26102010003#1', no: 'GD26102010003', seq: 1, created: mkDate(-2), custName: '湖南省测绘院', group: '政府单位', flow: '雕刻', handler: '李四', task: '标识标牌', req: '不锈钢腐蚀', receptionist: '张三', code: '350010', cat: 'sign', catName: '标识标牌', name: '不锈钢腐蚀牌', unit: '块', price: 180, copies: 1, qty: 5, total: 5, amount: 900, remark: '含安装' },
      { id: 'GD26102010003#2', no: 'GD26102010003', seq: 2, created: mkDate(-2), custName: '湖南省测绘院', group: '政府单位', flow: '雕刻', handler: '李四', task: '标识标牌', req: '不锈钢腐蚀', receptionist: '张三', code: '350020', cat: 'sign', catName: '标识标牌', name: '亚克力标牌', unit: '块', price: 60, copies: 1, qty: 5, total: 5, amount: 300, remark: '' },
      { id: 'GD26101910004#1', no: 'GD26101910004', seq: 1, created: mkDate(-3), custName: '张三', group: '普通', flow: '组装', handler: '管理员', task: '装裱覆膜', req: '冷裱', receptionist: '张三', code: '450010', cat: 'frame', catName: '装裱服务', name: '冷裱覆膜', unit: '㎡', price: 15, copies: 1, qty: 4, total: 4, amount: 60, remark: '' },
      { id: 'GD26101910004#2', no: 'GD26101910004', seq: 2, created: mkDate(-3), custName: '张三', group: '普通', flow: '组装', handler: '管理员', task: '装裱覆膜', req: '冷裱', receptionist: '张三', code: '450020', cat: 'frame', catName: '装裱服务', name: '铝合金相框', unit: '个', price: 25, copies: 1, qty: 1, total: 1, amount: 25, remark: '' },
      { id: 'GD26101810005#1', no: 'GD26101810005', seq: 1, created: mkDate(-4), custName: '商务局', group: '设计院', flow: '接单', handler: '', task: '雕刻切割', req: '亚克力切割', receptionist: '张三', code: '550010', cat: 'craft', catName: '文创产品', name: '亚克力切割件', unit: '个', price: 35, copies: 1, qty: 10, total: 10, amount: 350, remark: '' },
      { id: 'GD26101710006#1', no: 'GD26101710006', seq: 1, created: mkDate(-5), custName: '李四', group: '普通', flow: '完工', handler: '管理员', task: '彩色打印', req: '铜版纸', receptionist: '张三', code: '650010', cat: 'std', catName: '标准产品', name: '铜版纸打印 A4', unit: '页', price: 1, copies: 1, qty: 30, total: 30, amount: 30, remark: '' },
      { id: 'GD26101710006#2', no: 'GD26101710006', seq: 2, created: mkDate(-5), custName: '李四', group: '普通', flow: '完工', handler: '管理员', task: '彩色打印', req: '铜版纸', receptionist: '张三', code: '650020', cat: 'std', catName: '标准产品', name: '装订', unit: '本', price: 5, copies: 1, qty: 3, total: 3, amount: 15, remark: '' },
      { id: 'GD26101610007#1', no: 'GD26101610007', seq: 1, created: mkDate(-6), custName: '王五', group: '普通', flow: '质检', handler: '李四', task: '喷绘写真', req: '室内PP纸', receptionist: '张三', code: '250030', cat: 'ad', catName: '广告喷绘', name: 'PP纸写真', unit: '㎡', price: 40, copies: 2, qty: 12, total: 24, amount: 960, remark: '两幅相同' },
    ];
    loading.value = false;
  }, 200);
};

onMounted(() => loadData());
</script>

<style scoped lang="scss">
.table-actions { display: flex; align-items: center; gap: 4px; }
.mono-text { font-family: var(--erp-font-mono); font-variant-numeric: tabular-nums; }
.mono-cell { font-family: var(--erp-font-mono); font-variant-numeric: tabular-nums; }
.sub-text { font-size: 12px; color: var(--erp-text-soft); }
.nowrap-text { white-space: nowrap; }
</style>
