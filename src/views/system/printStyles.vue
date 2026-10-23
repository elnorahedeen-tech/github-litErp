<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 系统</p>
        <h1>打印样式</h1>
        <p class="erp-pagehead-desc">全部单据的打印样式。每种单据可有多个样式，打印时使用"默认"样式。</p>
      </div>
    </div>

    <div class="erp-toolbar">
      <div class="erp-toolbar-item">
        <label>搜索单据</label>
        <el-input v-model="search.q" placeholder="单据名称" clearable style="width: 200px" />
      </div>
      <div class="erp-toolbar-item">
        <label>业务分类</label>
        <el-select v-model="search.sec" clearable placeholder="全部" style="width: 120px">
          <el-option label="前台" value="前台" />
          <el-option label="生产" value="生产" />
          <el-option label="财务" value="财务" />
          <el-option label="客户" value="客户" />
        </el-select>
      </div>
      <div class="erp-toolbar-item">
        <label>常用</label>
        <el-select v-model="search.common" clearable placeholder="全部" style="width: 120px">
          <el-option label="仅常用" value="1" />
          <el-option label="不常用" value="0" />
        </el-select>
      </div>
      <div class="erp-toolbar-actions">
        <el-button type="primary" @click="loadData">筛选</el-button>
        <el-button @click="resetSearch">重置</el-button>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-panelhead"><h2>单据打印样式</h2></div>
      <div class="erp-table-wrap">
        <el-table :data="filteredData" v-loading="loading" stripe style="width: 100%">
          <el-table-column prop="name" label="单据" min-width="240">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="manageStyles(row)">{{ row.name }}</el-button>
            </template>
          </el-table-column>
          <el-table-column prop="sec" label="业务分类" width="100" align="center" />
          <el-table-column label="默认样式" width="180">
            <template #default="{ row }">
              {{ row.styles[row.defaultIdx]?.name || '默认样式' }}
              <div class="sub-text">{{ row.styles[row.defaultIdx]?.paper }} · {{ row.styles[row.defaultIdx]?.dir }}</div>
            </template>
          </el-table-column>
          <el-table-column label="样式数" width="80" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ row.styles.length }}</span></template>
          </el-table-column>
          <el-table-column label="常用" width="80" align="center">
            <template #default="{ row }">
              <span v-if="row.common" class="erp-badge" data-tone="info">常用</span>
              <span v-else class="text-muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <div class="table-actions">
                <el-button link type="primary" size="small" @click="manageStyles(row)">管理样式</el-button>
                <el-button link type="primary" size="small" @click="toggleCommon(row)">{{ row.common ? '取消常用' : '设为常用' }}</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div class="erp-pagination" style="padding: 12px 16px">
        <span>共 {{ filteredData.length }} 条记录</span>
      </div>
    </div>

    <!-- 样式管理对话框 -->
    <el-dialog v-model="styleDialogVisible" :title="`打印样式：${editDoc?.name || ''}`" width="700px" top="5vh">
      <div v-if="editDoc" class="style-manage">
        <p class="style-doc-info">{{ editDoc.sec }} · {{ editDoc.name }}</p>
        <el-table :data="editDoc.styles" stripe size="small" style="width: 100%">
          <el-table-column prop="name" label="样式名称" min-width="140">
            <template #default="{ row }">
              {{ row.name }}
              <span v-if="row === currentStyle" class="sub-text" style="margin-left: 6px">正在预览</span>
            </template>
          </el-table-column>
          <el-table-column prop="paper" label="纸张" width="120" />
          <el-table-column prop="dir" label="方向" width="80" align="center" />
          <el-table-column label="默认" width="80" align="center">
            <template #default="{ row }">
              <span v-if="row.def" class="erp-badge" data-tone="success">默认</span>
              <span v-else class="text-muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="240">
            <template #default="{ row, $index }">
              <div class="table-actions">
                <el-button v-if="row !== currentStyle" link type="primary" size="small" @click="previewStyle(row)">预览</el-button>
                <el-button link type="primary" size="small" @click="editStyle(row)">修改</el-button>
                <el-button link type="primary" size="small" @click="designStyle(row)">设计</el-button>
                <el-button v-if="!row.def" link type="primary" size="small" @click="setDefault(row)">设为默认</el-button>
                <el-button link type="primary" size="small" @click="copyStyle(row)">复制</el-button>
                <el-button v-if="!row.def" link type="danger" size="small" @click="deleteStyle(row, $index)">删除</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <!-- 版式预览 -->
        <div class="style-preview">
          <h3>版式预览</h3>
          <div class="preview-paper" :style="{ maxWidth: previewWidth + 'px' }">
            <p class="preview-title">图片色彩</p>
            <p class="preview-sub">{{ editDoc.name }}</p>
            <div class="preview-info">
              <span>单号：<span class="mono-text">GD26101910003</span></span>
              <span>客户：散户</span>
              <span>日期：2026-10-22</span>
              <span>经手：管理员</span>
            </div>
            <table class="preview-table">
              <thead><tr><th>项目</th><th>数量</th><th>金额（元）</th></tr></thead>
              <tbody>
                <tr><td>彩色打印 A4</td><td style="text-align: right">10</td><td style="text-align: right">20.00</td></tr>
                <tr><td>胶装</td><td style="text-align: right">1</td><td style="text-align: right">10.00</td></tr>
              </tbody>
              <tfoot><tr><td colspan="2" style="text-align: right; font-weight: 600">合计</td><td style="text-align: right; font-weight: 600">￥30.00</td></tr></tfoot>
            </table>
            <p class="preview-footer">{{ currentStyle?.name }} · {{ currentStyle?.paper }} · {{ currentStyle?.dir }}</p>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="styleDialogVisible = false">关闭</el-button>
        <el-button @click="handlePrint">打印预览</el-button>
      </template>
    </el-dialog>

    <!-- 修改样式对话框 -->
    <el-dialog v-model="editStyleDialogVisible" title="修改样式" width="420px">
      <el-form v-if="editingStyle" label-width="80px">
        <el-form-item label="样式名称" required>
          <el-input v-model="editingStyle.name" maxlength="30" />
        </el-form-item>
        <el-form-item label="纸张">
          <el-select v-model="editingStyle.paper" style="width: 100%">
            <el-option v-for="p in papers" :key="p" :label="p" :value="p" />
          </el-select>
        </el-form-item>
        <el-form-item label="方向">
          <el-select v-model="editingStyle.dir" style="width: 100%">
            <el-option label="纵向" value="纵向" />
            <el-option label="横向" value="横向" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editStyleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="doEditStyle">保存样式</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';

interface PrintStyle { name: string; paper: string; dir: string; def: boolean; }
interface PrintDoc { sec: string; name: string; common: boolean; styles: PrintStyle[]; defaultIdx: number; }

const loading = ref(false);
const tableData = ref<PrintDoc[]>([]);
const search = ref({ q: '', sec: '', common: '' });

const papers = ['A4', 'A5', '80mm 小票', '58mm 小票', '标签 60×40mm'];

const filteredData = computed(() => {
  let data = tableData.value;
  if (search.value.q) data = data.filter(d => d.name.includes(search.value.q));
  if (search.value.sec) data = data.filter(d => d.sec === search.value.sec);
  if (search.value.common === '1') data = data.filter(d => d.common);
  if (search.value.common === '0') data = data.filter(d => !d.common);
  return data;
});

const resetSearch = () => { search.value = { q: '', sec: '', common: '' }; };

const styleDialogVisible = ref(false);
const editDoc = ref<PrintDoc | null>(null);
const currentStyle = ref<PrintStyle | null>(null);

const previewWidth = computed(() => {
  if (!currentStyle.value) return 460;
  const p = currentStyle.value.paper;
  if (/小票|标签/.test(p)) return 300;
  return currentStyle.value.dir === '横向' ? 640 : 460;
});

const manageStyles = (row: PrintDoc) => {
  editDoc.value = row;
  currentStyle.value = row.styles[row.defaultIdx] || row.styles[0];
  styleDialogVisible.value = true;
};

const toggleCommon = (row: PrintDoc) => {
  row.common = !row.common;
  ElMessage.success(`「${row.name}」已${row.common ? '设为常用' : '取消常用'}`);
};

const previewStyle = (s: PrintStyle) => { currentStyle.value = s; };

const editStyleDialogVisible = ref(false);
const editingStyle = ref<PrintStyle | null>(null);

const editStyle = (s: PrintStyle) => {
  editingStyle.value = { ...s };
  editStyleDialogVisible.value = true;
};

const doEditStyle = () => {
  if (!editingStyle.value || !editDoc.value) return;
  if (editDoc.value.styles.some(s => s !== editingStyle.value && s.name === editingStyle.value!.name)) {
    ElMessage.warning(`已有同名样式「${editingStyle.value.name}」`);
    return;
  }
  const idx = editDoc.value.styles.indexOf(editingStyle.value);
  if (idx >= 0) Object.assign(editDoc.value.styles[idx], editingStyle.value);
  if (currentStyle.value === editingStyle.value) currentStyle.value = editDoc.value.styles[idx];
  editStyleDialogVisible.value = false;
  ElMessage.success(`样式「${editingStyle.value.name}」已保存`);
};

const designStyle = (s: PrintStyle) => { ElMessage.info(`样式设计器（原型）：${s.name}`); };

const setDefault = (s: PrintStyle) => {
  if (!editDoc.value) return;
  editDoc.value.styles.forEach(x => { x.def = x === s; });
  editDoc.value.defaultIdx = editDoc.value.styles.indexOf(s);
  currentStyle.value = s;
  ElMessage.success(`「${s.name}」已设为默认样式`);
};

const copyStyle = (s: PrintStyle) => {
  if (!editDoc.value) return;
  let n = s.name + '-副本';
  let i = 2;
  while (editDoc.value.styles.some(x => x.name === n)) n = `${s.name}-副本${i++}`;
  editDoc.value.styles.push({ ...s, name: n, def: false });
  ElMessage.success('已复制样式');
};

const deleteStyle = (s: PrintStyle, idx: number) => {
  if (!editDoc.value) return;
  ElMessageBox.confirm(`删除样式「${s.name}」？`, '提示', { type: 'warning' })
    .then(() => {
      editDoc.value!.styles.splice(idx, 1);
      if (currentStyle.value === s) currentStyle.value = editDoc.value!.styles[editDoc.value!.defaultIdx] || editDoc.value!.styles[0];
      ElMessage.success('样式已删除');
    })
    .catch(() => {});
};

const handlePrint = () => { ElMessage.info('打印预览（原型）'); window.print(); };

onMounted(() => {
  loading.value = true;
  setTimeout(() => {
    tableData.value = [
      { sec: '财务', name: '对账单（结算单据-单据记录）', common: true, styles: [{ name: '默认样式', paper: 'A4', dir: '纵向', def: true }, { name: '简洁样式', paper: 'A5', dir: '横向', def: false }], defaultIdx: 0 },
      { sec: '财务', name: '对账单（结算单据-明细记录）', common: true, styles: [{ name: '默认样式', paper: 'A4', dir: '纵向', def: true }, { name: '简洁样式', paper: 'A5', dir: '横向', def: false }], defaultIdx: 0 },
      { sec: '财务', name: '销账记录单', common: true, styles: [{ name: '默认样式', paper: 'A4', dir: '纵向', def: true }], defaultIdx: 0 },
      { sec: '财务', name: '一般收支单', common: false, styles: [{ name: '默认样式', paper: 'A4', dir: '纵向', def: true }], defaultIdx: 0 },
      { sec: '财务', name: '转账单', common: false, styles: [{ name: '默认样式', paper: 'A4', dir: '纵向', def: true }], defaultIdx: 0 },
      { sec: '前台', name: '结算单', common: true, styles: [{ name: '默认样式', paper: 'A4', dir: '纵向', def: true }, { name: '简洁样式', paper: 'A5', dir: '横向', def: false }], defaultIdx: 0 },
      { sec: '前台', name: '营业日报表（仅现金业务明细）', common: true, styles: [{ name: '默认样式', paper: 'A4', dir: '纵向', def: true }], defaultIdx: 0 },
      { sec: '前台', name: '营业日报表（全部的业务明细）', common: true, styles: [{ name: '默认样式', paper: 'A4', dir: '纵向', def: true }], defaultIdx: 0 },
      { sec: '前台', name: '预存单', common: true, styles: [{ name: '默认样式', paper: 'A4', dir: '纵向', def: true }], defaultIdx: 0 },
      { sec: '前台', name: '零收单', common: false, styles: [{ name: '默认样式', paper: 'A4', dir: '纵向', def: true }], defaultIdx: 0 },
      { sec: '前台', name: '退款单', common: false, styles: [{ name: '默认样式', paper: 'A4', dir: '纵向', def: true }], defaultIdx: 0 },
      { sec: '前台', name: '会员卡（卡面）', common: false, styles: [{ name: '默认样式', paper: '标签 60×40mm', dir: '横向', def: true }], defaultIdx: 0 },
      { sec: '生产', name: '工作单', common: true, styles: [{ name: '默认样式', paper: 'A4', dir: '纵向', def: true }, { name: '简洁样式', paper: 'A5', dir: '横向', def: false }], defaultIdx: 0 },
      { sec: '生产', name: '工作单（小票）', common: false, styles: [{ name: '默认样式', paper: '80mm 小票', dir: '纵向', def: true }], defaultIdx: 0 },
      { sec: '生产', name: '送货单', common: false, styles: [{ name: '默认样式', paper: 'A4', dir: '纵向', def: true }], defaultIdx: 0 },
      { sec: '生产', name: '制作标签', common: false, styles: [{ name: '默认样式', paper: '标签 60×40mm', dir: '横向', def: true }], defaultIdx: 0 },
      { sec: '客户', name: '客户资料卡', common: false, styles: [{ name: '默认样式', paper: 'A4', dir: '纵向', def: true }], defaultIdx: 0 },
      { sec: '客户', name: '价格表', common: false, styles: [{ name: '默认样式', paper: 'A4', dir: '纵向', def: true }], defaultIdx: 0 },
    ];
    loading.value = false;
  }, 200);
});
</script>

<style scoped lang="scss">
.table-actions { display: flex; align-items: center; gap: 4px; }
.mono-text { font-family: var(--erp-font-mono); font-variant-numeric: tabular-nums; }
.mono-cell { font-family: var(--erp-font-mono); font-variant-numeric: tabular-nums; }
.text-muted { color: var(--erp-text-soft); }
.sub-text { font-size: 12px; color: var(--erp-text-soft); }

.style-manage { max-height: 70vh; overflow-y: auto; }
.style-doc-info { font-size: 13px; color: var(--erp-text-soft); margin: 0 0 12px; }
.style-preview { margin-top: 20px; h3 { font-size: 15px; margin: 0 0 8px; } }
.preview-paper { padding: 16px; border: 1px solid var(--erp-line); border-radius: 6px; background: var(--erp-surface); }
.preview-title { text-align: center; font-size: 16px; font-weight: 700; margin: 0; color: var(--erp-primary); }
.preview-sub { text-align: center; font-size: 13px; color: var(--erp-text-soft); margin: 4px 0 12px; }
.preview-info { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; font-size: 13px; margin-bottom: 12px; }
.preview-table { width: 100%; border-collapse: collapse; font-size: 13px; th, td { padding: 4px 8px; border: 1px solid var(--erp-line); } th { background: var(--erp-bg); font-weight: 600; } }
.preview-footer { font-size: 12px; color: var(--erp-text-soft); text-align: center; margin: 12px 0 0; }
</style>
