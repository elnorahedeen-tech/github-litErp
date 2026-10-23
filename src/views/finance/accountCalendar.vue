<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 财务</p>
        <h1>会计日历</h1>
        <p class="erp-pagehead-desc">设置会计年度内各期间的起止日期；期末结账按此划分财务月度。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button type="primary" @click="router.push('/finance/periodClose')">期末结账</el-button>
      </div>
    </div>

    <!-- 期间设置 -->
    <div class="erp-panel">
      <div class="erp-panelhead"><h2>期间设置</h2></div>
      <div class="erp-panelbody">
        <div class="erp-toolbar" style="padding: 0; border: none;">
          <div class="erp-toolbar-item">
            <label>会计年度</label>
            <el-select v-model="settings.year" style="width: 120px" @change="generatePeriods">
              <el-option v-for="y in yearOptions" :key="y" :label="`${y} 年`" :value="y" />
            </el-select>
          </div>
          <div class="erp-toolbar-item">
            <label>期间划分</label>
            <el-select v-model="settings.mode" style="width: 140px" @change="onModeChange">
              <el-option label="自然月" value="自然月" />
              <el-option label="固定结账日" value="固定结账日" />
            </el-select>
          </div>
          <div class="erp-toolbar-item">
            <label>结账日</label>
            <el-select v-model="settings.day" :disabled="settings.mode === '自然月'" style="width: 120px" @change="generatePeriods">
              <el-option v-for="d in 28" :key="d" :label="`每月 ${d} 日`" :value="d" />
            </el-select>
          </div>
          <div class="erp-toolbar-actions">
            <el-button type="primary" @click="generatePeriods">生成预览</el-button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="unsaved" class="erp-notice">
      <span>正在预览"{{ settings.mode }}{{ settings.mode === '固定结账日' ? `（每月 ${settings.day} 日）` : '' }}"的期间划分，尚未保存。</span>
      <el-button type="primary" size="small" @click="handleSave">保存会计日历</el-button>
    </div>

    <!-- 期间表格 -->
    <div class="erp-panel">
      <div class="erp-panelhead">
        <h2>{{ settings.year }} 年会计期间</h2>
        <span class="erp-panelhead-note">当前会计期间 {{ periodName(currentPeriod) }} · 期间划分：{{ settings.mode }}{{ settings.mode === '固定结账日' ? `（每月 ${settings.day} 日）` : '' }}</span>
      </div>
      <div class="erp-table-wrap">
        <el-table :data="periodData" stripe style="width: 100%">
          <el-table-column prop="code" label="会计期间" width="120">
            <template #default="{ row }"><span class="mono-text">{{ row.code }}</span></template>
          </el-table-column>
          <el-table-column prop="name" label="期间名称" width="120" />
          <el-table-column prop="start" label="开始日期" width="120" />
          <el-table-column prop="finish" label="结束日期" width="120" />
          <el-table-column prop="days" label="天数" width="80" align="center" />
          <el-table-column prop="status" label="状态" width="120" align="center">
            <template #default="{ row }">
              <span class="erp-badge" :data-tone="row.status === '已结账' ? 'success' : row.status === '当前期间' ? 'primary' : 'info'">{{ row.status }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="closeInfo" label="结账时间 / 结账人" min-width="200">
            <template #default="{ row }">
              <template v-if="row.closeTime">{{ row.closeTime }} · {{ row.closeUser }}</template>
              <template v-else-if="row.status === '已结账'">历史期间，未记录</template>
              <template v-else>—</template>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button v-if="row.status === '当前期间'" link type="primary" size="small" @click="router.push('/finance/periodClose')">期末结账</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <div class="erp-notice">
      <span>已结账的期间不可再调整起止日期；修改期间划分只影响尚未开始的会计期间。</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';

const router = useRouter();
const currentPeriod = ref('202610');

const settings = reactive({
  year: 2026,
  mode: '自然月' as '自然月' | '固定结账日',
  day: 25,
});

const yearOptions = Array.from({ length: 10 }, (_, i) => 2019 + i);
const periodData = ref<any[]>([]);
const savedMode = ref('自然月');
const savedDay = ref(25);

const unsaved = computed(() => settings.mode !== savedMode.value || (settings.mode === '固定结账日' && settings.day !== savedDay.value));

const periodName = (p: string) => `${p.slice(0, 4)}年${+p.slice(4)}月`;

const pad = (n: number) => String(n).padStart(2, '0');

const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const onModeChange = () => {
  if (settings.mode === '自然月') settings.day = 25;
  generatePeriods();
};

const generatePeriods = () => {
  const year = settings.year;
  const cur = currentPeriod.value;
  const rows: any[] = [];

  for (let i = 0; i < 12; i++) {
    const code = `${year}${pad(i + 1)}`;
    const nat = settings.mode === '自然月';
    const start = nat ? new Date(year, i, 1) : new Date(year, i - 1, settings.day + 1);
    const finish = nat ? new Date(year, i + 1, 0) : new Date(year, i, settings.day);
    const days = Math.round((+finish - +start) / 864e5) + 1;
    const status = code < cur ? '已结账' : code === cur ? '当前期间' : '未开始';

    rows.push({
      code,
      name: periodName(code),
      start: formatDate(start),
      finish: formatDate(finish),
      days,
      status,
      closeTime: status === '已结账' ? null : null,
      closeUser: '',
    });
  }

  periodData.value = rows;
};

const handleSave = () => {
  ElMessageBox.confirm('保存新的期间划分？只影响尚未开始的会计期间；已结账期间的起止日期不变。', '提示', { confirmButtonText: '保存' })
    .then(() => {
      savedMode.value = settings.mode;
      savedDay.value = settings.day;
      ElMessage.success('会计日历已保存。');
    }).catch(() => {});
};

onMounted(() => {
  settings.year = +currentPeriod.value.slice(0, 4);
  generatePeriods();
});
</script>

<style scoped lang="scss">
.erp-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--erp-space-3);
  padding: var(--erp-space-3) var(--erp-space-4);
  margin: var(--erp-space-3) 0;
  background: #fffbe6;
  border: 1px solid #ffe58f;
  border-radius: 4px;
  font-size: var(--erp-table-size);
  color: var(--erp-text);
}
.mono-text { font-family: var(--erp-font-mono); font-variant-numeric: tabular-nums; }
</style>
