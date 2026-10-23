<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 系统</p>
        <h1>经营项目</h1>
        <p class="erp-pagehead-desc">经营主项与子项管理。主项为大类（如印刷、设计），子项为具体可售项目。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button type="primary" @click="openAddMain">
          <el-icon><Plus /></el-icon> 新建主项
        </el-button>
      </div>
    </div>

    <div class="biz-layout">
      <div class="biz-main-panel">
        <div class="biz-panel-header">
          <h3>经营主项</h3>
          <span class="biz-panel-count">共 {{ mainTotal }} 项</span>
        </div>
        <div class="biz-main-list" v-loading="mainLoading">
          <div
            v-for="item in mainList"
            :key="item.RecId"
            class="biz-main-item"
            :class="{ active: selectedMain?.RecId === item.RecId }"
            @click="selectMain(item)"
          >
            <div class="biz-main-item-info">
              <span class="mono-text biz-main-code">{{ item.ItemCode }}</span>
              <span class="biz-main-name">{{ item.ItemName }}</span>
            </div>
            <div class="biz-main-item-actions">
              <el-button link type="primary" size="small" @click.stop="editMain(item)">编辑</el-button>
              <el-button link type="danger" size="small" @click.stop="deleteMain(item)">删除</el-button>
            </div>
          </div>
          <el-empty v-if="!mainLoading && mainList.length === 0" description="暂无经营主项" :image-size="60" />
        </div>
      </div>

      <div class="biz-sub-panel">
        <div class="biz-panel-header">
          <h3>经营子项 <template v-if="selectedMain">— {{ selectedMain.ItemName }}</template></h3>
          <div class="biz-panel-actions">
            <el-button type="primary" size="small" @click="openAddSub" :disabled="!selectedMain">
              <el-icon><Plus /></el-icon> 新建子项
            </el-button>
          </div>
        </div>

        <div class="erp-toolbar" v-if="selectedMain">
          <div class="erp-toolbar-item">
            <label>搜索</label>
            <el-input v-model="subSearch" placeholder="编号 / 名称" clearable style="width: 180px" @keyup.enter="loadSubItems" />
          </div>
          <div class="erp-toolbar-actions">
            <el-button type="primary" @click="loadSubItems">筛选</el-button>
          </div>
        </div>

        <div class="erp-table-wrap" v-loading="subLoading">
          <el-table v-if="selectedMain" :data="subList" stripe style="width: 100%">
            <el-table-column prop="SubItemCode" label="项目编号" width="110">
              <template #default="{ row }"><span class="mono-text">{{ row.SubItemCode }}</span></template>
            </el-table-column>
            <el-table-column prop="SubItemName" label="项目名称" min-width="160" />
            <el-table-column prop="Unit" label="单位" width="70" align="center" />
            <el-table-column label="定价量级" width="140" align="center">
              <template #default="{ row }">
                <span v-if="row.TierLow != null && row.TierHigh != null">{{ row.TierLow }} - {{ row.TierHigh }}</span>
                <span v-else>—</span>
              </template>
            </el-table-column>
            <el-table-column prop="SalePrice" label="标准单价（元）" width="130" align="right">
              <template #default="{ row }"><span class="mono-cell">{{ row.SalePrice != null ? fmtMoney(row.SalePrice) : '—' }}</span></template>
            </el-table-column>
            <el-table-column prop="CanRename" label="可改名" width="80" align="center">
              <template #default="{ row }">{{ row.CanRename === 'Y' ? '是' : '否' }}</template>
            </el-table-column>
            <el-table-column prop="PriceMode" label="计价模式" width="100" align="center" />
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <div class="table-actions">
                  <el-button link type="primary" size="small" @click="editSub(row)">编辑</el-button>
                  <el-button link type="danger" size="small" @click="deleteSub(row)">删除</el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!selectedMain" description="请选择左侧经营主项" :image-size="80" />
          <el-empty v-if="selectedMain && !subLoading && subList.length === 0" description="该主项暂无子项" :image-size="60" />
        </div>

        <div class="erp-pagination" v-if="selectedMain && subTotal > 0">
          <el-pagination
            v-model:current-page="subPage"
            :page-size="subPageSize"
            :total="subTotal"
            layout="total, prev, pager, next"
            @current-change="loadSubItems"
          />
        </div>
      </div>
    </div>

    <el-dialog v-model="mainDialogVisible" :title="mainForm.RecId ? '编辑主项' : '新建主项'" width="420px">
      <el-form :model="mainForm" label-width="80px">
        <el-form-item label="主项名称" required>
          <el-input v-model="mainForm.ItemName" placeholder="请输入主项名称" maxlength="50" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="mainDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="mainSaving" @click="saveMain">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="subDialogVisible" :title="subForm.RecId ? '编辑子项' : '新建子项'" width="520px">
      <el-form :model="subForm" label-width="90px">
        <el-form-item label="所属主项">
          <span>{{ selectedMain?.ItemCode }} {{ selectedMain?.ItemName }}</span>
        </el-form-item>
        <el-form-item label="项目名称" required>
          <el-input v-model="subForm.SubItemName" placeholder="请输入子项名称" maxlength="100" />
        </el-form-item>
        <el-form-item label="单位">
          <el-input v-model="subForm.Unit" placeholder="如：盒、张、页、个" maxlength="20" style="width: 160px" />
        </el-form-item>
        <el-form-item label="定价量级">
          <div style="display: flex; align-items: center; gap: 8px">
            <el-input-number v-model="subForm.TierLow" :min="0" :controls="false" placeholder="最低" style="width: 100px" />
            <span>—</span>
            <el-input-number v-model="subForm.TierHigh" :min="0" :controls="false" placeholder="最高" style="width: 100px" />
          </div>
        </el-form-item>
        <el-form-item label="标准单价">
          <el-input-number v-model="subForm.SalePrice" :min="0" :precision="2" :controls="false" placeholder="元" style="width: 160px" />
        </el-form-item>
        <el-form-item label="可改名">
          <el-select v-model="subForm.CanRename" style="width: 100px">
            <el-option label="否" value="N" />
            <el-option label="是" value="Y" />
          </el-select>
        </el-form-item>
        <el-form-item label="计价模式">
          <el-select v-model="subForm.PriceMode" placeholder="请选择" style="width: 160px">
            <el-option label="单价" value="单价" />
            <el-option label="总价" value="总价" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="subDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="subSaving" @click="saveSub">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/api';

const mainLoading = ref(false);
const mainList = ref<any[]>([]);
const mainTotal = ref(0);
const selectedMain = ref<any>(null);

const mainDialogVisible = ref(false);
const mainSaving = ref(false);
const mainForm = ref<any>({ RecId: '', ItemName: '' });

const subLoading = ref(false);
const subList = ref<any[]>([]);
const subTotal = ref(0);
const subPage = ref(1);
const subPageSize = 20;
const subSearch = ref('');

const subDialogVisible = ref(false);
const subSaving = ref(false);
const subForm = ref<any>({
  RecId: '', SubItemName: '', Unit: '', TierLow: null, TierHigh: null,
  SalePrice: null, CanRename: 'N', OperRule: '', PriceMode: '',
});

const fmtMoney = (v: any) => '￥' + Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function loadMainItems() {
  mainLoading.value = true;
  try {
    const res = await api.bizItems.GetBizMainItems({ PageIndex: 1, PageLimit: 200 });
    if (res.RespCode >= 0 && res.Data) {
      mainList.value = res.Data.children || [];
      mainTotal.value = res.Data.Count || 0;
    }
  } catch { /* handled by interceptor */ }
  mainLoading.value = false;
}

function selectMain(item: any) {
  selectedMain.value = item;
  subPage.value = 1;
  subSearch.value = '';
  loadSubItems();
}

async function loadSubItems() {
  if (!selectedMain.value) return;
  subLoading.value = true;
  try {
    const params: any = {
      PageIndex: subPage.value,
      PageLimit: subPageSize,
      MainItemCode: selectedMain.value.ItemCode,
    };
    if (subSearch.value) {
      params.Keyword = subSearch.value;
    }
    const res = await api.bizItems.GetBizSubItems(params);
    if (res.RespCode >= 0 && res.Data) {
      subList.value = res.Data.children || [];
      subTotal.value = res.Data.Count || 0;
    }
  } catch { /* handled by interceptor */ }
  subLoading.value = false;
}

function openAddMain() {
  mainForm.value = { RecId: '', ItemName: '' };
  mainDialogVisible.value = true;
}

function editMain(item: any) {
  mainForm.value = { RecId: item.RecId, ItemName: item.ItemName };
  mainDialogVisible.value = true;
}

async function saveMain() {
  if (!mainForm.value.ItemName?.trim()) {
    ElMessage.warning('请输入主项名称');
    return;
  }
  mainSaving.value = true;
  try {
    const res = await api.bizItems.AddOrModifyBizMainItem({
      RecId: mainForm.value.RecId || '',
      ItemName: mainForm.value.ItemName.trim(),
    });
    if (res.RespCode >= 0) {
      ElMessage.success('保存成功');
      mainDialogVisible.value = false;
      await loadMainItems();
    }
  } catch { /* handled by interceptor */ }
  mainSaving.value = false;
}

async function deleteMain(item: any) {
  try {
    await ElMessageBox.confirm(`删除主项「${item.ItemName}」将同时删除其所有子项，确认删除？`, '提示', { type: 'warning' });
    const res = await api.bizItems.DeleteBizMainItem({ RecId: item.RecId });
    if (res.RespCode >= 0) {
      ElMessage.success('已删除');
      if (selectedMain.value?.RecId === item.RecId) {
        selectedMain.value = null;
        subList.value = [];
        subTotal.value = 0;
      }
      await loadMainItems();
    }
  } catch { /* cancelled or error */ }
}

function openAddSub() {
  subForm.value = {
    RecId: '', SubItemName: '', Unit: '', TierLow: null, TierHigh: null,
    SalePrice: null, CanRename: 'N', OperRule: '', PriceMode: '单价',
  };
  subDialogVisible.value = true;
}

function editSub(row: any) {
  subForm.value = {
    RecId: row.RecId,
    SubItemName: row.SubItemName,
    Unit: row.Unit || '',
    TierLow: row.TierLow,
    TierHigh: row.TierHigh,
    SalePrice: row.SalePrice,
    CanRename: row.CanRename || 'N',
    OperRule: row.OperRule || '',
    PriceMode: row.PriceMode || '单价',
  };
  subDialogVisible.value = true;
}

async function saveSub() {
  if (!subForm.value.SubItemName?.trim()) {
    ElMessage.warning('请输入项目名称');
    return;
  }
  subSaving.value = true;
  try {
    const params: any = {
      RecId: subForm.value.RecId || '',
      MainItemCode: selectedMain.value.ItemCode,
      SubItemName: subForm.value.SubItemName.trim(),
      Unit: subForm.value.Unit || '',
      TierLow: subForm.value.TierLow,
      TierHigh: subForm.value.TierHigh,
      SalePrice: subForm.value.SalePrice,
      CanRename: subForm.value.CanRename || 'N',
      OperRule: subForm.value.OperRule || '',
      PriceMode: subForm.value.PriceMode || '',
    };
    if (subForm.value.RecId) {
      params.SubItemCode = subForm.value.SubItemCode;
    }
    const res = await api.bizItems.AddOrModifyBizSubItem(params);
    if (res.RespCode >= 0) {
      ElMessage.success('保存成功');
      subDialogVisible.value = false;
      await loadSubItems();
    }
  } catch { /* handled by interceptor */ }
  subSaving.value = false;
}

async function deleteSub(row: any) {
  try {
    await ElMessageBox.confirm(`确认删除子项「${row.SubItemName}」？`, '提示', { type: 'warning' });
    const res = await api.bizItems.DeleteBizSubItem({ RecId: row.RecId });
    if (res.RespCode >= 0) {
      ElMessage.success('已删除');
      await loadSubItems();
    }
  } catch { /* cancelled or error */ }
}

onMounted(() => loadMainItems());
</script>

<style scoped lang="scss">
.biz-layout {
  display: flex;
  gap: var(--erp-space-4);
  align-items: flex-start;
}

.biz-main-panel {
  width: 280px;
  flex-shrink: 0;
  border: 1px solid var(--erp-line);
  border-radius: 6px;
  background: var(--erp-bg);
}

.biz-sub-panel {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--erp-line);
  border-radius: 6px;
  background: var(--erp-bg);
}

.biz-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--erp-space-3) var(--erp-space-4);
  border-bottom: 1px solid var(--erp-line);
  h3 { font-size: 14px; font-weight: 600; margin: 0; }
}

.biz-panel-count {
  font-size: var(--erp-caption-size);
  color: var(--erp-muted);
}

.biz-main-list {
  max-height: calc(100vh - 260px);
  overflow-y: auto;
  padding: var(--erp-space-2);
}

.biz-main-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--erp-space-2) var(--erp-space-3);
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
  margin-bottom: 2px;

  &:hover { background: var(--erp-hover); }
  &.active { background: var(--erp-primary-light, #ecf5ff); }
}

.biz-main-item-info {
  display: flex;
  align-items: center;
  gap: var(--erp-space-2);
  min-width: 0;
}

.biz-main-code {
  font-size: var(--erp-caption-size);
  color: var(--erp-muted);
}

.biz-main-name {
  font-size: var(--erp-table-size);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.biz-main-item-actions {
  flex-shrink: 0;
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}

.biz-main-item:hover .biz-main-item-actions {
  opacity: 1;
}

.table-actions { display: flex; align-items: center; gap: 4px; }
.mono-text { font-family: var(--erp-font-mono); font-variant-numeric: tabular-nums; }

.biz-sub-panel .erp-toolbar {
  padding: var(--erp-space-3) var(--erp-space-4);
  margin: 0;
  border-bottom: 1px solid var(--erp-line);
  background: transparent;
}
</style>
