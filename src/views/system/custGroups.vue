<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 系统</p>
        <h1>客户分组</h1>
        <p class="erp-pagehead-desc">客户分组决定默认价格与折扣。分组可设置折扣率、预存门槛等。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button type="primary" @click="openAdd">
          <el-icon><Plus /></el-icon> 新建分组
        </el-button>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-table-wrap">
        <el-table :data="tableData" v-loading="loading" stripe style="width: 100%">
          <el-table-column prop="CustomerType" label="分组名称" min-width="200" />
          <el-table-column prop="Sort" label="排序" width="80" align="center" />
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <div class="table-actions">
                <el-button link type="primary" size="small" @click="editRow(row)">编辑</el-button>
                <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
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
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/api';

const router = useRouter();
const loading = ref(false);
const tableData = ref<any[]>([]);

const openAdd = () => { router.push('/system/custGroupEdit?type=new'); };
const editRow = (row: any) => { router.push(`/system/custGroupEdit?name=${row.CustomerType}`); };

const handleDelete = (row: any) => {
  ElMessageBox.confirm(`删除客户分组「${row.CustomerType}」？该分组下的客户将变为"未分组"。`, '提示', { type: 'warning' })
    .then(() => { tableData.value = tableData.value.filter(r => r.CustomerType !== row.CustomerType); ElMessage.success('删除成功'); })
    .catch(() => {});
};

const loadData = async () => {
  loading.value = true;
  try {
    const res: any = await api.customer.GetAllCustTypes();
    if (res?.Data) {
      tableData.value = Array.isArray(res.Data) ? res.Data : [];
    }
  } catch {
    tableData.value = [];
  }
  loading.value = false;
};

onMounted(() => loadData());
</script>

<style scoped lang="scss">
.table-actions { display: flex; align-items: center; gap: 4px; }
.mono-text { font-family: var(--erp-font-mono); font-variant-numeric: tabular-nums; }
</style>
