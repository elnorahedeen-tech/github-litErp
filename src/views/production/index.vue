<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 生产</p>
        <h1>生产业务中心</h1>
        <p class="erp-pagehead-desc">在制工单：按生产特征、流程和交付预警筛选；点工单号查看详情，"流程转单"推进到下一流程。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button @click="handleExport">导出筛选结果</el-button>
      </div>
    </div>

    <!-- 超期提醒 -->
    <div v-if="overdueCount > 0" class="erp-notice erp-notice-warning" style="margin-bottom: 12px">
      {{ overdueCount }} 张工单已过交付日期仍未完工。
      <el-button link type="warning" size="small" @click="search.warn = 'over'">只看已超期</el-button>
    </div>

    <div class="erp-toolbar">
      <div class="erp-toolbar-item">
        <label>搜索工单</label>
        <el-input v-model="search.q" placeholder="工单号 / 客户 / 制作要求 / 处理员工" clearable style="width: 260px" />
      </div>
      <div class="erp-toolbar-item">
        <label>生产特征</label>
        <el-select v-model="search.feat" clearable placeholder="全部" style="width: 140px">
          <el-option label="我处理的" value="mine" />
          <el-option label="无人处理" value="nobody" />
          <el-option label="未完工" value="open" />
        </el-select>
      </div>
      <div class="erp-toolbar-item">
        <label>生产流程</label>
        <el-select v-model="search.flow" clearable placeholder="全部" style="width: 120px">
          <el-option v-for="f in flowOptions" :key="f" :label="f" :value="f" />
        </el-select>
      </div>
      <div class="erp-toolbar-item">
        <label>交付预警</label>
        <el-select v-model="search.warn" clearable placeholder="全部" style="width: 140px">
          <el-option label="已超期" value="over" />
          <el-option label="今天交付" value="today" />
          <el-option label="明天交付" value="tomorrow" />
          <el-option label="2～3 天内" value="soon" />
          <el-option label="未约定交付日期" value="none" />
        </el-select>
      </div>
      <div class="erp-toolbar-actions">
        <el-button type="primary" @click="loadData">筛选</el-button>
        <el-button @click="resetSearch">重置</el-button>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-panelhead"><h2>生产工单</h2><span class="erp-panelhead-note">当前员工：管理员 · 按委托时间倒序 · 北京时间</span></div>
      <div class="erp-table-wrap">
        <el-table :data="filteredData" v-loading="loading" stripe style="width: 100%">
          <el-table-column prop="no" label="工单编号" width="150" fixed>
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="viewDetail(row)"><span class="mono-text">{{ row.no }}</span></el-button>
            </template>
          </el-table-column>
          <el-table-column prop="task" label="制作任务" min-width="140">
            <template #default="{ row }">{{ row.task || '未指定' }}</template>
          </el-table-column>
          <el-table-column prop="flow" label="生产流程" width="100" align="center">
            <template #default="{ row }">
              <span class="erp-badge" :data-tone="flowTone(row.flow)">{{ row.flow }}</span>
            </template>
          </el-table-column>
          <el-table-column label="工单类型 / 取送" width="140">
            <template #default="{ row }">
              {{ row.orderType || '未指定' }}
              <div v-if="row.delivery" class="sub-text">取送：{{ row.delivery }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="created" label="委托时间" width="150">
            <template #default="{ row }"><span class="nowrap-text">{{ formatTime(row.created) }}</span></template>
          </el-table-column>
          <el-table-column label="交付日期" width="110">
            <template #default="{ row }"><span class="nowrap-text">{{ row.due ? formatDate(row.due) : '未约定' }}</span></template>
          </el-table-column>
          <el-table-column label="距离交付" width="110" align="center">
            <template #default="{ row }">
              <span v-if="getDaysToDue(row) == null" class="text-muted">未约定</span>
              <span v-else-if="isDone(row)" class="erp-badge" data-tone="success">已完工</span>
              <span v-else class="erp-badge" :data-tone="distTone(row)">{{ distText(row) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="receptionist" label="接待人员" width="100">
            <template #default="{ row }">{{ row.receptionist || '未知' }}</template>
          </el-table-column>
          <el-table-column prop="handler" label="当前处理" width="100">
            <template #default="{ row }">{{ row.handler || '无人处理' }}</template>
          </el-table-column>
          <el-table-column label="保留文件" width="90" align="center">
            <template #default="{ row }">
              <el-checkbox :model-value="row.keepFile" @change="(val: boolean) => toggleKeepFile(row, val)" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <div class="table-actions">
                <el-button link type="primary" size="small" @click="viewDetail(row)">详情</el-button>
                <el-button v-if="!isMine(row) && !isDone(row)" link type="primary" size="small" @click="takeOver(row)">我来处理</el-button>
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
const search = reactive({ q: '', feat: '', flow: '', warn: '' });

const currentUser = '管理员';
const flowOptions = ['接单', '排版', '喷绘', '雕刻', '组装', '质检', '完工'];
const DAY = 86400000;

const fmtMoney = (v: any) => '￥' + Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatDate = (d: any) => { const dt = typeof d === 'string' ? new Date(d) : d; return dt.toLocaleDateString('zh-CN'); };
const formatTime = (d: any) => { const dt = typeof d === 'string' ? new Date(d) : d; return dt.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); };

const isDone = (w: any) => w.flow === '完工';
const isMine = (w: any) => (w.handler || '').split(/[、,]/).map((s: string) => s.trim()).includes(currentUser);

const getDaysToDue = (w: any) => {
  if (!w.due) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(w.due); due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / DAY);
};

const distText = (w: any) => {
  const d = getDaysToDue(w);
  if (d == null) return '未约定';
  if (isDone(w)) return '已完工';
  return d < 0 ? `超期 ${-d} 天` : d === 0 ? '今天交付' : d === 1 ? '明天交付' : `${d} 天后`;
};

const distTone = (w: any) => {
  const d = getDaysToDue(w);
  if (d == null) return '';
  if (isDone(w)) return 'success';
  return d < 0 ? 'danger' : d <= 1 ? 'warning' : '';
};

const flowTone = (flow: string) => {
  if (flow === '完工') return 'success';
  if (flow === '接单') return 'info';
  return '';
};

const overdueCount = computed(() => tableData.value.filter(w => {
  const d = getDaysToDue(w);
  return d != null && d < 0 && !isDone(w);
}).length);

const filteredData = computed(() => {
  let data = tableData.value;
  if (search.q) {
    const q = search.q.toLowerCase();
    data = data.filter(r => (r.no + r.custName + r.req + r.task + r.handler).toLowerCase().includes(q));
  }
  if (search.feat === 'mine') data = data.filter(r => isMine(r));
  if (search.feat === 'nobody') data = data.filter(r => !r.handler && !isDone(r));
  if (search.feat === 'open') data = data.filter(r => !isDone(r));
  if (search.flow) data = data.filter(r => r.flow === search.flow);
  if (search.warn) {
    data = data.filter(r => {
      const d = getDaysToDue(r);
      if (search.warn === 'none') return !r.due;
      if (search.warn === 'over') return d != null && d < 0 && !isDone(r);
      if (search.warn === 'today') return d === 0 && !isDone(r);
      if (search.warn === 'tomorrow') return d === 1 && !isDone(r);
      if (search.warn === 'soon') return d != null && d >= 2 && d <= 3 && !isDone(r);
      return true;
    });
  }
  return data;
});

const resetSearch = () => { search.q = ''; search.feat = ''; search.flow = ''; search.warn = ''; };

const viewDetail = (row: any) => { router.push(`/frontdesk/orderDetail?no=${row.no}`); };

const takeOver = (row: any) => {
  row.handler = currentUser;
  ElMessage.success(`已接手工单 ${row.no}`);
};

const toggleKeepFile = (row: any, val: boolean) => {
  row.keepFile = val;
  ElMessage.success(`工单 ${row.no}：${val ? '保留' : '不保留'}客户文件`);
};

const flowTransfer = (row: any) => {
  const idx = flowOptions.indexOf(row.flow);
  if (idx < 0 || idx >= flowOptions.length - 1) { ElMessage.info('该工单已完工或流程异常'); return; }
  const next = flowOptions[idx + 1];
  ElMessageBox.confirm(`把工单 ${row.no} 从「${row.flow}」转到「${next}」？`, '流程转单', { type: 'info' })
    .then(() => { row.flow = next; row.handler = currentUser; ElMessage.success(`工单 ${row.no} 已转到「${next}」`); })
    .catch(() => {});
};

const handleExport = () => { ElMessage.info('导出生产业务中心 CSV'); };

const loadData = () => {
  loading.value = true;
  setTimeout(() => {
    const now = new Date();
    const mkDate = (offset: number) => new Date(now.getTime() + offset * DAY);
    tableData.value = [
      { no: 'GD26102210001', custName: '散户', custCode: '000000', group: '普通', task: '彩色打印 A4', req: '双面打印，装订', flow: '排版', handler: '', orderType: '普通工单', delivery: '客户自取', created: mkDate(-0.1), due: null, receptionist: '张三', keepFile: false, amount: 120, paid: 0, unpaid: 120 },
      { no: 'GD26102110002', custName: '长沙理工大学', custCode: '1010', group: '设计院', task: '写真喷绘', req: '户外防水', flow: '喷绘', handler: '管理员', orderType: '普通工单', delivery: '门店送货', created: mkDate(-1), due: mkDate(0), receptionist: '张三', keepFile: true, amount: 580, paid: 300, unpaid: 280 },
      { no: 'GD26102010003', custName: '湖南省测绘院', custCode: '1020', group: '政府单位', task: '标识标牌', req: '不锈钢腐蚀', flow: '雕刻', handler: '李四', orderType: '加急工单', delivery: '门店送货', created: mkDate(-2), due: mkDate(1), receptionist: '张三', keepFile: true, amount: 1200, paid: 1200, unpaid: 0 },
      { no: 'GD26101910004', custName: '张三', custCode: '2001', group: '普通', task: '装裱覆膜', req: '冷裱', flow: '组装', handler: '管理员', orderType: '普通工单', delivery: '客户自取', created: mkDate(-3), due: mkDate(-1), receptionist: '张三', keepFile: false, amount: 85, paid: 85, unpaid: 0 },
      { no: 'GD26101810005', custName: '商务局', custCode: '1030', group: '设计院', task: '雕刻切割', req: '亚克力切割', flow: '接单', handler: '', orderType: '普通工单', delivery: '快递寄送', created: mkDate(-4), due: mkDate(3), receptionist: '张三', keepFile: false, amount: 350, paid: 0, unpaid: 350 },
      { no: 'GD26101710006', custName: '李四', custCode: '2002', group: '普通', task: '彩色打印', req: '铜版纸', flow: '完工', handler: '管理员', orderType: '普通工单', delivery: '客户自取', created: mkDate(-5), due: mkDate(-3), receptionist: '张三', keepFile: false, amount: 45, paid: 45, unpaid: 0 },
      { no: 'GD26101610007', custName: '王五', custCode: '2003', group: '普通', task: '喷绘写真', req: '室内PP纸', flow: '质检', handler: '李四', orderType: '普通工单', delivery: '门店送货', created: mkDate(-6), due: mkDate(7), receptionist: '张三', keepFile: true, amount: 960, paid: 500, unpaid: 460 },
      { no: 'GD26101510008', custName: '散户', custCode: '000000', group: '普通', task: '制作标签', req: '不干胶', flow: '排版', handler: '', orderType: '普通工单', delivery: '客户自取', created: mkDate(-7), due: null, receptionist: '张三', keepFile: false, amount: 30, paid: 0, unpaid: 30 },
    ];
    loading.value = false;
  }, 200);
};

onMounted(() => loadData());
</script>

<style scoped lang="scss">
.table-actions { display: flex; align-items: center; gap: 4px; }
.mono-text { font-family: var(--erp-font-mono); font-variant-numeric: tabular-nums; }
.sub-text { font-size: 12px; color: var(--erp-text-soft); }
.text-muted { color: var(--erp-text-soft); }
.nowrap-text { white-space: nowrap; }
.erp-notice-warning { padding: 8px 16px; background: var(--erp-warning-bg, #fff7e6); border: 1px solid var(--erp-warning-border, #ffd591); border-radius: 4px; color: var(--erp-warning-color, #d46b08); font-size: 13px; }
</style>
