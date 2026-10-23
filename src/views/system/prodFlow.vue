<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 系统</p>
        <h1>生产流程</h1>
        <p class="erp-pagehead-desc">定义工单从接单到交付的生产环节与流转步骤。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button type="primary" @click="openAdd">
          <el-icon><Plus /></el-icon> 新建流程
        </el-button>
      </div>
    </div>

    <div class="erp-toolbar">
      <div class="erp-toolbar-item">
        <label>搜索流程</label>
        <el-input v-model="search.q" placeholder="流程名称 / 说明" clearable style="width: 220px" />
      </div>
      <div class="erp-toolbar-item">
        <label>状态</label>
        <el-select v-model="search.status" clearable placeholder="全部" style="width: 120px">
          <el-option label="启用" value="启用" />
          <el-option label="停用" value="停用" />
        </el-select>
      </div>
      <div class="erp-toolbar-actions">
        <el-button type="primary" @click="loadData">筛选</el-button>
        <el-button @click="resetSearch">重置</el-button>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-table-wrap">
        <el-table :data="filteredData" v-loading="loading" stripe style="width: 100%">
          <el-table-column prop="code" label="流程编号" width="100">
            <template #default="{ row }"><span class="mono-text">{{ row.code }}</span></template>
          </el-table-column>
          <el-table-column prop="name" label="流程名称" min-width="160" />
          <el-table-column prop="steps" label="生产步骤" min-width="240">
            <template #default="{ row }">
              <div class="flow-steps">
                <span v-for="(step, i) in row.stepList" :key="i" class="flow-step">
                  {{ step }}<template v-if="i < row.stepList.length - 1"> → </template>
                </span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="defaultFlow" label="默认" width="80" align="center">
            <template #default="{ row }">
              <span class="erp-badge" :data-tone="row.defaultFlow ? 'success' : 'info'">{{ row.defaultFlow ? '是' : '否' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="80" align="center">
            <template #default="{ row }">
              <span class="erp-badge" :data-tone="row.status === '启用' ? 'success' : 'info'">{{ row.status }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="说明" min-width="140" :show-overflow-tooltip="true" />
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <div class="table-actions">
                <el-button link type="primary" size="small" @click="editRow(row)">编辑</el-button>
                <el-button link type="danger" size="small" @click="toggleStatus(row)">{{ row.status === '启用' ? '停用' : '启用' }}</el-button>
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
const search = reactive({ q: '', status: '' });

const filteredData = computed(() => {
  let data = tableData.value;
  if (search.q) {
    const q = search.q.toLowerCase();
    data = data.filter(r => (r.name + r.remark).toLowerCase().includes(q));
  }
  if (search.status) data = data.filter(r => r.status === search.status);
  return data;
});

const resetSearch = () => { search.q = ''; search.status = ''; };
const openAdd = () => { router.push('/system/prodFlowEdit?type=new'); };
const editRow = (row: any) => { router.push(`/system/prodFlowEdit?code=${row.code}`); };

const toggleStatus = (row: any) => {
  const action = row.status === '启用' ? '停用' : '启用';
  ElMessageBox.confirm(`${action}生产流程「${row.name}」？`, '提示', { type: 'warning' })
    .then(() => { row.status = action === '停用' ? '停用' : '启用'; ElMessage.success(`已${action}`); })
    .catch(() => {});
};

const loadData = () => {
  loading.value = true;
  setTimeout(() => {
    tableData.value = [
      { code: 'F01', name: '标准印刷流程', stepList: ['接单', '设计', '排版', '印刷', '裁切', '质检', '交付'], steps: '接单→设计→排版→印刷→裁切→质检→交付', defaultFlow: true, status: '启用', remark: '适用于大部分印刷订单' },
      { code: 'F02', name: '快速印刷流程', stepList: ['接单', '印刷', '裁切', '交付'], steps: '接单→印刷→裁切→交付', defaultFlow: false, status: '启用', remark: '适用于简单传单、名片' },
      { code: 'F03', name: '设计-only流程', stepList: ['接单', '设计', '修改', '交付'], steps: '接单→设计→修改→交付', defaultFlow: false, status: '启用', remark: '纯设计服务' },
      { code: 'F04', name: '安装流程', stepList: ['接单', '制作', '运输', '安装', '验收'], steps: '接单→制作→运输→安装→验收', defaultFlow: false, status: '启用', remark: '需要现场安装的订单' },
      { code: 'F05', name: '旧版流程', stepList: ['接单', '生产', '交付'], steps: '接单→生产→交付', defaultFlow: false, status: '停用', remark: '已废弃' },
    ];
    loading.value = false;
  }, 200);
};

onMounted(() => loadData());
</script>

<style scoped lang="scss">
.table-actions { display: flex; align-items: center; gap: 4px; }
.mono-text { font-family: var(--erp-font-mono); font-variant-numeric: tabular-nums; }
.flow-steps { display: flex; flex-wrap: wrap; gap: 2px; font-size: var(--erp-caption-size); }
.flow-step {
  color: var(--erp-text-soft);
  white-space: nowrap;
}
</style>
