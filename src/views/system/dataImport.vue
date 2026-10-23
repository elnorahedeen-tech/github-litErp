<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 系统</p>
        <h1>数据导入</h1>
        <p class="erp-pagehead-desc">从 CSV 文件批量导入客户资料、经营项目、员工资料。按编号判断记录是否已存在。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button @click="downloadTemplate">下载导入模板</el-button>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-panelhead"><h2>导入向导</h2></div>
      <div class="import-body">
        <!-- 步骤指示器 -->
        <ol class="import-steps">
          <li v-for="(s, i) in steps" :key="i" :class="{ active: i === step, done: i < step }">{{ s }}</li>
        </ol>

        <!-- 错误提示 -->
        <div v-if="errorMsg" class="import-error">
          <el-alert :title="errorMsg" type="error" show-icon :closable="true" @close="errorMsg = ''" />
        </div>

        <!-- 步骤 0：选择数据类型 -->
        <div v-if="step === 0" class="import-pane">
          <h3>第 1 步：选择数据类型</h3>
          <fieldset class="import-fieldset">
            <legend>要导入的数据</legend>
            <div class="import-radios">
              <label v-for="x in importTypes" :key="x.key" class="import-radio">
                <input type="radio" :value="x.key" v-model="importType" />
                <div>
                  <strong>{{ x.label }}</strong>
                  <p>{{ x.desc }}</p>
                </div>
              </label>
            </div>
          </fieldset>
          <el-alert title="支持 CSV 文件（UTF-8 或 GBK 编码，逗号或制表符分隔），首行须为列标题。Excel 文件请先另存为 CSV。建议先下载导入模板，按模板整理数据。" type="info" show-icon :closable="false" style="margin-top: 12px" />
        </div>

        <!-- 步骤 1：选择文件 -->
        <div v-if="step === 1" class="import-pane">
          <h3>第 2 步：选择文件</h3>
          <div class="import-file-row">
            <el-form label-width="160px">
              <el-form-item :label="`选择「${currentTypeLabel}」文件`">
                <input type="file" accept=".csv,.txt,.xlsx,.xls" @change="readFile" ref="fileInput" />
                <p class="form-help">CSV 或 TXT；首行为列标题。</p>
              </el-form-item>
            </el-form>
            <el-button @click="useSampleData">使用示例数据</el-button>
          </div>
          <div v-if="csvData.header.length" class="import-file-info">
            <p>已读取：<strong>{{ csvData.fileName }}</strong>，{{ csvData.rows.length }} 行 × {{ csvData.header.length }} 列</p>
            <h4>文件内容（前 20 行）</h4>
            <el-table :data="csvPreviewRows" stripe size="small" style="width: 100%">
              <el-table-column v-for="(h, i) in csvData.header" :key="i" :label="h || `第 ${i + 1} 列`" :prop="'c' + i" min-width="120" />
            </el-table>
          </div>
          <div v-else class="import-placeholder">
            <p>尚未选择文件。</p>
          </div>
        </div>

        <!-- 步骤 2：字段对应 -->
        <div v-if="step === 2" class="import-pane">
          <h3>第 3 步：字段对应</h3>
          <div class="import-mapping-head">
            <span>编号已存在的记录：</span>
            <el-radio-group v-model="dupMode">
              <el-radio value="skip">跳过</el-radio>
              <el-radio value="update">覆盖更新</el-radio>
            </el-radio-group>
            <el-button style="margin-left: 12px" @click="autoMap">重新自动匹配</el-button>
          </div>
          <el-table :data="mappingRows" stripe style="width: 100%; margin-top: 12px">
            <el-table-column prop="label" label="目标字段" width="180">
              <template #default="{ row }">{{ row.label }} <span v-if="row.required" class="text-danger">（必填）</span></template>
            </el-table-column>
            <el-table-column label="对应文件列" width="240">
              <template #default="{ row }">
                <el-select v-model="row.mapIdx" size="small" style="width: 100%">
                  <el-option :value="-1" label="（不导入）" />
                  <el-option v-for="(h, i) in csvData.header" :key="i" :value="i" :label="`第 ${i + 1} 列：${h}`" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100" align="center">
              <template #default="{ row }">
                <span v-if="row.mapIdx >= 0" class="erp-badge" data-tone="success">已对应</span>
                <span v-else-if="row.required" class="erp-badge" data-tone="danger">未对应</span>
                <span v-else class="erp-badge">不导入</span>
              </template>
            </el-table-column>
            <el-table-column label="示例值（第 1 行数据）" min-width="160">
              <template #default="{ row }">{{ row.mapIdx >= 0 ? (csvData.rows[0]?.[row.mapIdx] || '（空）') : '—' }}</template>
            </el-table-column>
          </el-table>
        </div>

        <!-- 步骤 3：预览校验 -->
        <div v-if="step === 3" class="import-pane">
          <h3>第 4 步：预览校验</h3>
          <div class="import-preview-badges">
            <span class="erp-badge" data-tone="success">新增 {{ previewCounts.add }} 条</span>
            <span class="erp-badge" data-tone="info">覆盖 {{ previewCounts.update }} 条</span>
            <span class="erp-badge">跳过 {{ previewCounts.skip }} 条</span>
            <span class="erp-badge" data-tone="danger">错误 {{ previewCounts.error }} 条</span>
          </div>
          <el-alert v-if="previewCounts.error > 0" :title="`${previewCounts.error} 行有错误，不会导入。可以返回上一步调整字段对应，或修改文件后重新选择。`" type="warning" show-icon :closable="false" style="margin-bottom: 12px" />
          <el-table :data="previewRows" stripe size="small" style="width: 100%">
            <el-table-column prop="_line" label="文件行" width="80" align="right" />
            <el-table-column label="校验结果" width="200">
              <template #default="{ row }">
                <span class="erp-badge" :data-tone="statusTone[row._status]">{{ row._status }}</span>
                <span v-if="row._note" class="sub-text" style="margin-left: 4px">{{ row._note }}</span>
              </template>
            </el-table-column>
            <el-table-column v-for="f in currentFields" :key="f.key" :prop="f.key" :label="f.label" min-width="120">
              <template #default="{ row }">{{ row[f.key] || '—' }}</template>
            </el-table-column>
          </el-table>
        </div>

        <!-- 步骤 4：导入完成 -->
        <div v-if="step === 4" class="import-pane">
          <h3>第 5 步：导入完成</h3>
          <el-alert :title="`「${currentTypeLabel}」导入完成（${new Date().toLocaleString('zh-CN')}）。来源文件：${csvData.fileName}。`" type="success" show-icon :closable="false" />
          <div class="import-result">
            <p>新增：<strong>{{ importResult.add }} 条</strong></p>
            <p>覆盖更新：<strong>{{ importResult.update }} 条</strong></p>
            <p>跳过：<strong>{{ importResult.skip }} 条</strong></p>
            <p>错误未导入：<strong>{{ importResult.error }} 条</strong></p>
          </div>
          <el-button type="primary" @click="goToList">查看{{ currentTypeLabel }}</el-button>
        </div>

        <!-- 底部按钮 -->
        <div class="import-actions">
          <el-button v-if="step > 0 && step < 4" @click="step--">上一步</el-button>
          <el-button v-if="step < 3" type="primary" @click="goNext">{{ step === 2 ? '预览校验' : '下一步' }}</el-button>
          <el-button v-if="step === 3" type="primary" @click="doImport">开始导入</el-button>
          <el-button v-if="step === 4" type="primary" @click="restart">继续导入</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';

const router = useRouter();

const steps = ['选择数据类型', '选择文件', '字段对应', '预览校验', '导入完成'];
const step = ref(0);
const errorMsg = ref('');

const importTypes = [
  { key: 'customers', label: '客户资料', desc: '客户编号、名称、分组、联系人、手机、地址' },
  { key: 'items', label: '经营项目', desc: '项目编号、经营主项、名称、单位、定价量级、销售单价' },
  { key: 'employees', label: '员工资料', desc: '员工编号、姓名、角色、部门岗位、手机、性别、入职日期' },
];
const importType = ref('customers');
const currentTypeLabel = computed(() => importTypes.find(t => t.key === importType.value)?.label || '');

const typeFields: Record<string, { key: string; label: string; required: boolean }[]> = {
  customers: [
    { key: 'code', label: '客户编号', required: true },
    { key: 'name', label: '客户名称', required: true },
    { key: 'groupName', label: '客户分组', required: false },
    { key: 'type', label: '客户类型', required: false },
    { key: 'contact', label: '联系人', required: false },
    { key: 'phone', label: '手机', required: false },
    { key: 'address', label: '地址', required: false },
    { key: 'remark', label: '说明备注', required: false },
  ],
  items: [
    { key: 'code', label: '项目编号', required: true },
    { key: 'catName', label: '经营主项', required: true },
    { key: 'name', label: '项目名称', required: true },
    { key: 'unit', label: '单位', required: false },
    { key: 'tier', label: '定价量级', required: false },
    { key: 'price', label: '销售单价', required: true },
  ],
  employees: [
    { key: 'code', label: '员工编号', required: true },
    { key: 'name', label: '员工姓名', required: true },
    { key: 'role', label: '员工角色', required: false },
    { key: 'dept', label: '部门岗位', required: false },
    { key: 'mobile', label: '手机号码', required: false },
    { key: 'gender', label: '性别', required: false },
    { key: 'joinDate', label: '入职日期', required: false },
  ],
};

const currentFields = computed(() => typeFields[importType.value] || []);

const aliasMap: Record<string, string[]> = {
  code: ['编号', '编码', '工号', '代码'],
  name: ['名称', '姓名', '客户', '项目'],
  groupName: ['分组'], type: ['类型'], contact: ['联系人'], phone: ['手机', '电话'],
  address: ['地址'], remark: ['备注', '说明'], catName: ['主项', '大类', '类别'],
  unit: ['单位'], tier: ['量级'], price: ['单价', '价格'], role: ['角色'],
  dept: ['部门', '岗位'], mobile: ['手机', '电话'], gender: ['性别'], joinDate: ['入职'],
};

const csvData = reactive<{ fileName: string; header: string[]; rows: string[][] }>({ fileName: '', header: [], rows: [] });
const fieldMap = reactive<Record<string, number>>({});
const dupMode = ref('skip');
const fileInput = ref<HTMLInputElement | null>(null);

const csvPreviewRows = computed(() => csvData.rows.slice(0, 20).map(r => {
  const o: Record<string, string> = {};
  csvData.header.forEach((_, i) => { o['c' + i] = r[i] ?? ''; });
  return o;
}));

const mappingRows = computed(() => currentFields.value.map(f => ({
  ...f,
  mapIdx: fieldMap[f.key] ?? -1,
})));

const statusTone: Record<string, string> = { '新增': 'success', '覆盖': 'info', '跳过': '', '错误': 'danger' };

const previewRows = computed(() => {
  if (!csvData.rows.length) return [];
  const seen = new Set<string>();
  return csvData.rows.map((r, i) => {
    const o: Record<string, any> = { _line: i + 2 };
    currentFields.value.forEach(f => { o[f.key] = fieldMap[f.key] != null && fieldMap[f.key] >= 0 ? (r[fieldMap[f.key]] ?? '').trim() : ''; });
    const errs: string[] = [];
    currentFields.value.filter(f => f.required && !o[f.key]).forEach(f => errs.push('缺少' + f.label));
    if (importType.value === 'items' && o.price && !/^\d+(\.\d{1,4})?$/.test(o.price)) errs.push('销售单价不是数字');
    if (importType.value === 'employees' && o.joinDate && isNaN(Date.parse(o.joinDate.replace(/\//g, '-')))) errs.push('入职日期格式');
    if (o.code && seen.has(o.code)) errs.push('文件内编号重复');
    if (o.code) seen.add(o.code);
    o._status = errs.length ? '错误' : o._exists ? (dupMode.value === 'skip' ? '跳过' : '覆盖') : '新增';
    o._note = errs.length ? errs.join('、') : o._exists ? (dupMode.value === 'skip' ? '编号已存在，跳过' : '编号已存在，覆盖更新') : '';
    o._exists = false;
    return o;
  });
});

const previewCounts = computed(() => {
  const rows = previewRows.value;
  return {
    add: rows.filter(r => r._status === '新增').length,
    update: rows.filter(r => r._status === '覆盖').length,
    skip: rows.filter(r => r._status === '跳过').length,
    error: rows.filter(r => r._status === '错误').length,
  };
});

const importResult = reactive({ add: 0, update: 0, skip: 0, error: 0 });

const sampleData: Record<string, string[][]> = {
  customers: [
    ['客户编号', '客户名称', '分组', '类型', '联系人', '手机号码', '地址', '备注'],
    ['2001', '长沙理工大学设计学院', '设计院', '机构', '王老师', '13800138001', '长沙市天心区万家丽南路2段960号', ''],
    ['2002', '湖南省测绘院', '政府单位', '机构', '李工', '13900139002', '长沙市岳麓区', '月结'],
    ['2003', '张三', '普通', '个人', '', '13700137003', '', ''],
    ['1010', '商务局（更新）', '设计院', '机构', '赵科长', '13600136004', '', ''],
    ['', '缺少编号的客户', '普通', '', '', '', '', ''],
  ],
  items: [
    ['编号', '主项', '名称', '单位', '量级', '单价'],
    ['250010', '广告喷绘◎', '车贴（反光膜）', '㎡', '-', '65'],
    ['350010', '标识标牌◎', '不锈钢腐蚀牌', '块', '-', '180'],
    ['880001', '文创产品', '帆布袋印刷', '个', '-', '18'],
    ['500020', '标准产品', '', '个', '-', '10'],
    ['500021', '标准产品', '台历', '本', '-', '十五'],
  ],
  employees: [
    ['工号', '姓名', '角色', '部门', '手机', '性别', '入职日期'],
    ['0101', '陈晓', '前台', '生产制作>前台', '13511112222', '女', '2026-09-01'],
    ['0102', '刘设计', '设计', '生产制作>设计', '13511113333', '男', '2026-09-15'],
    ['0103', '周后道', '后道', '生产制作>后道', '', '男', '2026/10/08'],
    ['0101', '陈晓（重复）', '前台', '', '', '女', ''],
  ],
};

const parseCsv = (text: string): string[][] => {
  const sep = text.split('\n')[0].includes('\t') ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
      continue;
    }
    if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
};

const autoMap = () => {
  const used = new Set<number>();
  currentFields.value.forEach(f => {
    let idx = csvData.header.findIndex(h => h.trim() === f.label);
    if (idx < 0) idx = csvData.header.findIndex((h, i) => !used.has(i) && (aliasMap[f.key] || []).some(a => h.includes(a)));
    if (idx >= 0) used.add(idx);
    fieldMap[f.key] = idx;
  });
  ElMessage.success('已按列标题重新匹配');
};

const readFile = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  if (/\.xlsx?$/i.test(file.name)) {
    errorMsg.value = `暂不能直接读取 Excel 文件「${file.name}」。请在 Excel 中"另存为 CSV（逗号分隔）"后重新选择。`;
    return;
  }
  const reader = new FileReader();
  reader.onerror = () => { errorMsg.value = `读取文件「${file.name}」失败`; };
  reader.onload = () => {
    let text = new TextDecoder('utf-8').decode(reader.result as ArrayBuffer);
    if (text.includes('\uFFFD')) {
      try { text = new TextDecoder('gbk').decode(reader.result as ArrayBuffer); } catch { /* keep utf-8 */ }
    }
    const table = parseCsv(text.replace(/^\uFEFF/, ''));
    loadTable(table, file.name);
  };
  reader.readAsArrayBuffer(file);
};

const loadTable = (table: string[][], name: string) => {
  if (table.length < 2) { errorMsg.value = `文件「${name}」没有数据行。首行须为列标题，从第 2 行开始是数据。`; return; }
  csvData.header = table[0];
  csvData.rows = table.slice(1);
  csvData.fileName = name;
  errorMsg.value = '';
  autoMap();
};

const useSampleData = () => { loadTable(sampleData[importType.value], '示例数据.csv'); };

const goNext = () => {
  errorMsg.value = '';
  if (step.value === 1 && !csvData.rows.length) { errorMsg.value = '还没有读取到数据。请选择 CSV 文件，或点"使用示例数据"。'; return; }
  if (step.value === 2) {
    const miss = currentFields.value.filter(f => f.required && (fieldMap[f.key] == null || fieldMap[f.key] < 0));
    if (miss.length) { errorMsg.value = `请为必填字段指定对应的文件列：${miss.map(f => f.label).join('、')}。`; return; }
  }
  step.value++;
};

const doImport = () => {
  const counts = previewCounts.value;
  if (!counts.add && !counts.update) { errorMsg.value = '没有可导入的记录：全部为错误或跳过。'; return; }
  ElMessageBox.confirm(`导入「${currentTypeLabel.value}」：新增 ${counts.add} 条、覆盖 ${counts.update} 条？跳过 ${counts.skip} 条，错误 ${counts.error} 条不导入。导入后不能自动撤销。`, '开始导入', { type: 'warning' })
    .then(() => {
      importResult.add = counts.add;
      importResult.update = counts.update;
      importResult.skip = counts.skip;
      importResult.error = counts.error;
      step.value = 4;
      ElMessage.success(`「${currentTypeLabel.value}」导入完成：新增 ${counts.add} 条，更新 ${counts.update} 条`);
    })
    .catch(() => {});
};

const restart = () => {
  step.value = 0;
  csvData.fileName = '';
  csvData.header = [];
  csvData.rows = [];
  Object.keys(fieldMap).forEach(k => delete fieldMap[k]);
  errorMsg.value = '';
};

const goToList = () => {
  const pages: Record<string, string> = { customers: '/customer', items: '/system/bizItems', employees: '/system' };
  router.push(pages[importType.value] || '/system');
};

const downloadTemplate = () => {
  const fields = currentFields.value;
  const csv = '\uFEFF' + fields.map(f => f.label).join(',') + '\r\n';
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentTypeLabel.value}导入模板.csv`;
  a.click();
  URL.revokeObjectURL(url);
  ElMessage.success(`已下载「${currentTypeLabel.value}」导入模板（CSV）`);
};
</script>

<style scoped lang="scss">
.import-body { padding: 16px; }
.import-steps { display: flex; gap: 0; margin: 0 0 20px; padding: 0; list-style: none; counter-reset: step;
  li { flex: 1; text-align: center; padding: 8px 4px; font-size: 13px; color: var(--erp-text-soft); border-bottom: 3px solid var(--erp-line); position: relative;
    &::before { counter-increment: step; content: counter(step); display: inline-block; width: 22px; height: 22px; line-height: 22px; border-radius: 50%; background: var(--erp-line); color: var(--erp-text-soft); font-size: 12px; margin-right: 4px; vertical-align: middle; }
    &.active { color: var(--erp-primary); border-bottom-color: var(--erp-primary); font-weight: 600; &::before { background: var(--erp-primary); color: #fff; } }
    &.done { color: var(--erp-text); &::before { background: var(--erp-primary); color: #fff; } }
  }
}
.import-error { margin-bottom: 12px; }
.import-pane h3 { font-size: 15px; margin: 0 0 12px; }
.import-fieldset { border: 1px solid var(--erp-line); border-radius: 6px; padding: 12px 16px; legend { font-size: 13px; color: var(--erp-text-soft); padding: 0 4px; } }
.import-radios { display: flex; flex-direction: column; gap: 8px; }
.import-radio { display: flex; align-items: flex-start; gap: 8px; cursor: pointer; padding: 8px; border-radius: 4px;
  &:hover { background: var(--erp-bg); }
  input[type="radio"] { margin-top: 3px; }
  strong { display: block; margin-bottom: 2px; }
  p { margin: 0; font-size: 12px; color: var(--erp-text-soft); }
}
.import-file-row { display: flex; align-items: flex-end; gap: 16px; }
.import-file-info { margin-top: 16px; h4 { font-size: 13px; margin: 12px 0 6px; } }
.import-placeholder { padding: 20px; color: var(--erp-text-soft); }
.import-mapping-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.import-preview-badges { display: flex; gap: 8px; margin-bottom: 12px; }
.import-result { margin: 12px 0; p { margin: 4px 0; } }
.import-actions { display: flex; gap: 8px; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--erp-line); }
.form-help { font-size: 12px; color: var(--erp-text-soft); margin: 4px 0 0; }
.text-danger { color: var(--erp-danger); }
.sub-text { font-size: 12px; color: var(--erp-text-soft); }
.mono-text { font-family: var(--erp-font-mono); font-variant-numeric: tabular-nums; }
</style>
