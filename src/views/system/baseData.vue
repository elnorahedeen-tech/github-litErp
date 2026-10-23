<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 系统</p>
        <h1>基础数据</h1>
        <p class="erp-pagehead-desc">各模块共用的枚举数据（制作任务、结算方式、部门岗位等）。先选数据类型，再维护条目。</p>
      </div>
    </div>

    <div class="base-layout">
      <!-- 左侧：数据类型 -->
      <div class="base-sidebar">
        <div class="erp-panel">
          <div class="erp-panelhead"><h2>数据类型</h2><span class="erp-panelhead-note">"联动"表示修改后开单、结算等界面立即生效</span></div>
          <div class="base-tree">
            <div v-for="cat in categories" :key="cat.name" class="base-tree-cat">
              <strong>{{ cat.name }}</strong>
              <ul>
                <li v-for="t in cat.types" :key="t.name">
                  <a :class="{ active: selectedType?.name === t.name }" @click="selectType(t)">
                    {{ t.name }}
                    <span class="base-tree-count">{{ t.entries.length }} 项<span v-if="t.link"> · 联动</span></span>
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：条目列表 -->
      <div class="base-main">
        <div class="erp-panel">
          <div class="erp-panelhead">
            <h2>{{ selectedType?.name || '请选择数据类型' }}</h2>
            <span class="erp-panelhead-note">{{ selectedType?.link ? '联动数据：与开单、结算等界面共用' : `共 ${selectedType?.entries.length || 0} 项` }}</span>
            <div class="erp-panelhead-actions">
              <el-button v-if="selectedType" type="primary" size="small" @click="addEntry">
                <el-icon><Plus /></el-icon> 新建条目
              </el-button>
            </div>
          </div>

          <div v-if="selectedType" class="erp-toolbar">
            <div class="erp-toolbar-item">
              <label>搜索条目</label>
              <el-input v-model="entrySearch" placeholder="编号 / 名称" clearable style="width: 200px" />
            </div>
            <div class="erp-toolbar-actions">
              <el-button type="primary" @click="filterEntries">筛选</el-button>
              <el-button @click="entrySearch = ''">重置</el-button>
            </div>
          </div>

          <div v-if="selectedType" class="erp-table-wrap">
            <el-table :data="filteredEntries" stripe style="width: 100%">
              <el-table-column prop="code" label="编号" width="100">
                <template #default="{ row }"><span class="mono-text">{{ row.code }}</span></template>
              </el-table-column>
              <el-table-column prop="name" label="名称" min-width="200" />
              <el-table-column prop="desc" label="描述" min-width="200">
                <template #default="{ row }">{{ row.desc || '—' }}</template>
              </el-table-column>
              <el-table-column label="操作" width="140" fixed="right">
                <template #default="{ row }">
                  <div class="table-actions">
                    <el-button link type="primary" size="small" @click="editEntry(row)">修改</el-button>
                    <el-button link type="danger" size="small" @click="deleteEntry(row)">删除</el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <div v-if="!selectedType" class="erp-empty">
            <p>请在左侧选择数据类型</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 新建/编辑条目对话框 -->
    <el-dialog v-model="entryDialogVisible" :title="editingEntry.isNew ? `新建${selectedType?.name}` : `修改${selectedType?.name}`" width="480px">
      <el-form label-width="80px">
        <el-form-item label="编号" required>
          <el-input v-model="editingEntry.code" maxlength="6" placeholder="1～6 位数字" style="width: 160px" />
          <span class="form-help">决定排列顺序，请慎重修改</span>
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="editingEntry.name" maxlength="30" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editingEntry.desc" type="textarea" maxlength="200" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="entryDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="doSaveEntry">{{ editingEntry.isNew ? '新建' : '保存' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';

interface Entry { code: string; name: string; desc: string; }
interface DataType { name: string; link: boolean; entries: Entry[]; }
interface Category { name: string; types: DataType[]; }

const categories = ref<Category[]>([]);
const selectedType = ref<DataType | null>(null);
const entrySearch = ref('');

const filteredEntries = computed(() => {
  if (!selectedType.value) return [];
  const q = entrySearch.value.toLowerCase();
  if (!q) return selectedType.value.entries;
  return selectedType.value.entries.filter(e => (e.code + e.name + e.desc).toLowerCase().includes(q));
});

const filterEntries = () => {};

const selectType = (t: DataType) => { selectedType.value = t; entrySearch.value = ''; };

const entryDialogVisible = ref(false);
const editingEntry = reactive<{ isNew: boolean; code: string; name: string; desc: string; _ref: Entry | null }>({ isNew: true, code: '', name: '', desc: '', _ref: null });

const addEntry = () => {
  if (!selectedType.value) return;
  const maxCode = Math.max(995, ...selectedType.value.entries.map(e => +e.code));
  editingEntry.isNew = true;
  editingEntry.code = String(maxCode + 5);
  editingEntry.name = '';
  editingEntry.desc = '';
  editingEntry._ref = null;
  entryDialogVisible.value = true;
};

const editEntry = (e: Entry) => {
  editingEntry.isNew = false;
  editingEntry.code = e.code;
  editingEntry.name = e.name;
  editingEntry.desc = e.desc;
  editingEntry._ref = e;
  entryDialogVisible.value = true;
};

const doSaveEntry = () => {
  if (!selectedType.value) return;
  const code = editingEntry.code.trim();
  const name = editingEntry.name.trim();
  if (!/^\d{1,6}$/.test(code)) { ElMessage.warning('编号为 1～6 位数字'); return; }
  if (!name) { ElMessage.warning('请填写名称'); return; }
  if (selectedType.value.entries.some(e => e !== editingEntry._ref && e.code === code)) { ElMessage.warning(`编号 ${code} 已存在`); return; }
  if (selectedType.value.entries.some(e => e !== editingEntry._ref && e.name === name)) { ElMessage.warning(`「${name}」已存在`); return; }

  if (editingEntry.isNew) {
    selectedType.value.entries.push({ code, name, desc: editingEntry.desc.trim() });
  } else if (editingEntry._ref) {
    Object.assign(editingEntry._ref, { code, name, desc: editingEntry.desc.trim() });
  }
  selectedType.value.entries.sort((a, b) => +a.code - +b.code);
  entryDialogVisible.value = false;
  ElMessage.success(`${editingEntry.isNew ? '已新建' : '已保存'}：${name}`);
};

const deleteEntry = (e: Entry) => {
  if (!selectedType.value) return;
  ElMessageBox.confirm(`删除${selectedType.value.name}「${e.code} ${e.name}」？已使用该值的历史单据不受影响；新单据不能再选择。`, '提示', { type: 'warning' })
    .then(() => {
      selectedType.value!.entries.splice(selectedType.value!.entries.indexOf(e), 1);
      ElMessage.success(`已删除：${e.name}`);
    })
    .catch(() => {});
};

onMounted(() => {
  categories.value = [
    { name: '客户', types: [
      { name: '关系等级', link: false, entries: [
        { code: '1385', name: '密切', desc: '' }, { code: '1390', name: '较好', desc: '' }, { code: '1395', name: '一般', desc: '' }, { code: '1400', name: '较差', desc: '' }, { code: '1405', name: '未评估', desc: '' },
      ] },
      { name: '人员规模', link: false, entries: [{ code: '1000', name: '1-10人', desc: '' }, { code: '1005', name: '11-50人', desc: '' }, { code: '1010', name: '51-200人', desc: '' }, { code: '1015', name: '200人以上', desc: '' }] },
      { name: '机构类型', link: false, entries: [{ code: '1000', name: '企业', desc: '' }, { code: '1005', name: '政府机关', desc: '' }, { code: '1010', name: '事业单位', desc: '' }, { code: '1015', name: '学校', desc: '' }, { code: '1020', name: '社会团体', desc: '' }] },
      { name: '价值评估', link: false, entries: [{ code: '1000', name: 'A', desc: '' }, { code: '1005', name: 'B', desc: '' }, { code: '1010', name: 'C', desc: '' }, { code: '1015', name: '未评估', desc: '' }] },
      { name: '主营行业', link: false, entries: [{ code: '1000', name: '建筑设计', desc: '' }, { code: '1005', name: '教育', desc: '' }, { code: '1010', name: '政府', desc: '' }, { code: '1015', name: '制造业', desc: '' }, { code: '1020', name: '广告传媒', desc: '' }, { code: '1025', name: '其他', desc: '' }] },
      { name: '联系人分类', link: false, entries: [{ code: '1000', name: '决策人', desc: '' }, { code: '1005', name: '经办人', desc: '' }, { code: '1010', name: '财务', desc: '' }, { code: '1015', name: '其他', desc: '' }] },
      { name: '身份证件', link: false, entries: [{ code: '1000', name: '居民身份证', desc: '' }, { code: '1005', name: '护照', desc: '' }, { code: '1010', name: '港澳通行证', desc: '' }, { code: '1015', name: '营业执照', desc: '' }] },
      { name: '信用等级', link: false, entries: [{ code: '1000', name: 'AAA', desc: '' }, { code: '1005', name: 'AA', desc: '' }, { code: '1010', name: 'A', desc: '' }, { code: '1015', name: 'B', desc: '' }, { code: '1020', name: 'C', desc: '' }] },
      { name: '来源方式', link: false, entries: [{ code: '1000', name: '互联网', desc: '' }, { code: '1005', name: '老客户介绍', desc: '' }, { code: '1010', name: '路过', desc: '' }, { code: '1015', name: '电话', desc: '' }, { code: '1020', name: '其他', desc: '' }] },
    ] },
    { name: '生产', types: [
      { name: '制作任务', link: true, entries: [{ code: '1000', name: '彩色打印', desc: '' }, { code: '1005', name: '黑白打印', desc: '' }, { code: '1010', name: '写真喷绘', desc: '' }, { code: '1015', name: '标识标牌', desc: '' }, { code: '1020', name: '装裱覆膜', desc: '' }, { code: '1025', name: '雕刻切割', desc: '' }] },
      { name: '工单类型', link: true, entries: [{ code: '1000', name: '普通工单', desc: '' }, { code: '1005', name: '加急工单', desc: '' }, { code: '1010', name: '返工工单', desc: '' }] },
      { name: '取送要求', link: true, entries: [{ code: '1000', name: '客户自取', desc: '' }, { code: '1005', name: '门店送货', desc: '' }, { code: '1010', name: '快递寄送', desc: '' }] },
      { name: '计量单位', link: false, entries: [{ code: '1000', name: '张', desc: '' }, { code: '1005', name: '页', desc: '' }, { code: '1010', name: '本', desc: '' }, { code: '1015', name: '套', desc: '' }, { code: '1020', name: '㎡', desc: '' }, { code: '1025', name: '个', desc: '' }, { code: '1030', name: '盒', desc: '' }, { code: '1035', name: '块', desc: '' }] },
    ] },
    { name: '财务', types: [
      { name: '结算方式', link: true, entries: [{ code: '1000', name: '现金', desc: '' }, { code: '1005', name: '微信', desc: '' }, { code: '1010', name: '支付宝', desc: '' }, { code: '1015', name: '银行卡', desc: '' }, { code: '1020', name: '记账', desc: '' }] },
      { name: '收入类型', link: true, entries: [{ code: '1000', name: '营业收入', desc: '' }, { code: '1005', name: '预存储值', desc: '' }, { code: '1010', name: '零收', desc: '' }, { code: '1015', name: '其他收入', desc: '' }] },
      { name: '支出类型', link: true, entries: [{ code: '1000', name: '材料采购', desc: '' }, { code: '1005', name: '水电费', desc: '' }, { code: '1010', name: '工资', desc: '' }, { code: '1015', name: '其他支出', desc: '' }] },
      { name: '发票类型', link: false, entries: [{ code: '1000', name: '增值税普通发票', desc: '' }, { code: '1005', name: '增值税专用发票', desc: '' }, { code: '1010', name: '电子发票', desc: '' }] },
    ] },
    { name: '通用', types: [
      { name: '城市', link: false, entries: [{ code: '1000', name: '北京', desc: '' }, { code: '1005', name: '上海', desc: '' }, { code: '1010', name: '广州', desc: '' }, { code: '1015', name: '深圳', desc: '' }, { code: '1020', name: '长沙', desc: '' }, { code: '1025', name: '武汉', desc: '' }, { code: '1030', name: '天津', desc: '' }, { code: '1035', name: '重庆', desc: '' }, { code: '1040', name: '合肥', desc: '' }, { code: '1045', name: '漳州', desc: '' }] },
      { name: '节假日', link: false, entries: [{ code: '1000', name: '元旦', desc: '' }, { code: '1005', name: '春节', desc: '' }, { code: '1010', name: '清明', desc: '' }, { code: '1015', name: '劳动节', desc: '' }, { code: '1020', name: '端午', desc: '' }, { code: '1025', name: '中秋', desc: '' }, { code: '1030', name: '国庆', desc: '' }] },
    ] },
    { name: '人员', types: [
      { name: '部门岗位', link: true, entries: [{ code: '1000', name: '办公室', desc: '' }, { code: '1005', name: '前台', desc: '' }, { code: '1010', name: '设计部', desc: '' }, { code: '1015', name: '生产部', desc: '' }, { code: '1020', name: '财务部', desc: '' }] },
      { name: '学历', link: false, entries: [{ code: '1000', name: '初中', desc: '' }, { code: '1005', name: '高中', desc: '' }, { code: '1010', name: '大专', desc: '' }, { code: '1015', name: '本科', desc: '' }, { code: '1020', name: '硕士', desc: '' }] },
      { name: '离职原因', link: false, entries: [{ code: '1000', name: '个人原因', desc: '' }, { code: '1005', name: '合同到期', desc: '' }, { code: '1010', name: '辞退', desc: '' }, { code: '1015', name: '其他', desc: '' }] },
    ] },
    { name: '系统', types: [
      { name: '门店', link: false, entries: [{ code: '1000', name: '0 - 本店', desc: '' }] },
      { name: '单据状态', link: false, entries: [{ code: '1000', name: '未审核', desc: '' }, { code: '1005', name: '已审核', desc: '' }, { code: '1010', name: '已冲红', desc: '' }] },
    ] },
  ];

  selectedType.value = categories.value[0].types[0];
});
</script>

<style scoped lang="scss">
.table-actions { display: flex; align-items: center; gap: 4px; }
.mono-text { font-family: var(--erp-font-mono); font-variant-numeric: tabular-nums; }
.form-help { font-size: 12px; color: var(--erp-text-soft); margin-left: 8px; }

.base-layout { display: flex; gap: 16px; align-items: flex-start; }
.base-sidebar { flex: 0 0 260px; min-width: 0; }
.base-main { flex: 1 1 0; min-width: 0; }

.base-tree { padding: 8px 0; }
.base-tree-cat { margin-bottom: 8px; strong { display: block; padding: 4px 16px; font-size: 13px; color: var(--erp-text-soft); } }
.base-tree-cat ul { list-style: none; margin: 0; padding: 0; }
.base-tree-cat li a { display: flex; justify-content: space-between; align-items: center; padding: 6px 16px 6px 24px; cursor: pointer; font-size: 13px; color: var(--erp-text); text-decoration: none; border-left: 3px solid transparent; transition: all 0.15s;
  &:hover { background: var(--erp-bg); color: var(--erp-primary); }
  &.active { font-weight: 600; color: var(--erp-primary); border-left-color: var(--erp-primary); background: var(--erp-bg); }
}
.base-tree-count { font-size: 12px; color: var(--erp-text-soft); }

.erp-panelhead-actions { margin-left: auto; }
.erp-empty { padding: 40px; text-align: center; color: var(--erp-text-soft); }
</style>
