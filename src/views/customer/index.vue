<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 客户</p>
        <h1>客户资料</h1>
        <p class="erp-pagehead-desc">客户档案台账。点编号查看客户综合信息；分组决定默认价格与折扣。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button type="primary" @click="openAdd">
          <el-icon><Plus /></el-icon> 新建客户
        </el-button>
        <el-button @click="toggleColumns">{{ isFullView ? '基础列' : '全面列' }}</el-button>
        <el-button @click="handleExport">导出</el-button>
      </div>
    </div>

    <div class="erp-toolbar">
      <div class="erp-toolbar-item">
        <label>客户名称</label>
        <el-input v-model="search.ClientName" placeholder="输入客户名称" clearable style="width: 180px" />
      </div>
      <div class="erp-toolbar-item">
        <label>客户分组</label>
        <el-select v-model="search.CustomerType" clearable placeholder="全部分组" style="width: 160px">
          <el-option v-for="g in custTypes" :key="g.Code || g.code" :label="g.Name || g.name" :value="g.Name || g.name" />
        </el-select>
      </div>
      <div class="erp-toolbar-item">
        <label>销售代表</label>
        <el-input v-model="search.SalerName" placeholder="输入销售代表" clearable style="width: 140px" />
      </div>
      <div class="erp-toolbar-item">
        <label>注册手机号</label>
        <el-input v-model="search.RegisterPhone" placeholder="输入手机号" clearable style="width: 160px" />
      </div>
      <div class="erp-toolbar-actions">
        <el-button type="primary" @click="getTbody">筛选</el-button>
        <el-button @click="resetSearch">重置</el-button>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-table-wrap">
        <el-table :data="tableData" v-loading="loading" stripe style="width: 100%">
          <el-table-column prop="ClientCode" label="客户编号" width="120" fixed>
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="viewDetail(row)"><span class="mono-text">{{ row.ClientCode }}</span></el-button>
            </template>
          </el-table-column>
          <el-table-column prop="ClientName" label="客户名称" min-width="200" show-overflow-tooltip />
          <el-table-column prop="CustomerType" label="客户分组" width="120" />
          <el-table-column prop="SalerName" label="销售代表" width="100" />
          <el-table-column prop="DepName" label="门店名称" width="120" />
          <el-table-column prop="PriceTableName" label="价格表" width="120" />
          <el-table-column prop="AccountPeriod" label="账期" width="80" align="right" />
          <el-table-column prop="AccountAmt" label="账额（元）" width="110" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.AccountAmt) }}</span></template>
          </el-table-column>
          <el-table-column prop="CardBalance" label="储值卡余额（元）" width="130" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.CardBalance) }}</span></template>
          </el-table-column>
          <el-table-column prop="RegisterPhone" label="注册手机号" width="130">
            <template #default="{ row }"><span class="mono-text">{{ row.RegisterPhone || '未提供' }}</span></template>
          </el-table-column>
          <!-- 全面列 -->
          <template v-if="isFullView">
            <el-table-column prop="LastOrderTime" label="最后下单日期" width="120">
              <template #default="{ row }">{{ row.LastOrderTime ? row.LastOrderTime.slice(0, 10) : '—' }}</template>
            </el-table-column>
            <el-table-column prop="OrderCostAmt" label="总消费金额（元）" width="130" align="right">
              <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.OrderCostAmt) }}</span></template>
            </el-table-column>
            <el-table-column prop="CouponsNum" label="优惠券数量" width="100" align="right" />
            <el-table-column prop="CreateTime" label="创建时间" width="170">
              <template #default="{ row }">{{ row.CreateTime ? row.CreateTime.slice(0, 16) : '—' }}</template>
            </el-table-column>
            <el-table-column prop="Creator" label="创建人" width="90" />
            <el-table-column prop="UpdateTime" label="更新时间" width="170">
              <template #default="{ row }">{{ row.UpdateTime ? row.UpdateTime.slice(0, 16) : '—' }}</template>
            </el-table-column>
            <el-table-column prop="Updater" label="更新人" width="90" />
          </template>
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <div class="table-actions">
                <el-button link type="primary" size="small" @click="viewDetail(row)">详情</el-button>
                <el-button link type="primary" size="small" @click="editClient(row)">编辑</el-button>
                <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div class="erp-pagination" style="padding: 12px 16px">
        <span>共 {{ total }} 条记录</span>
        <el-pagination
          v-model:current-page="search.PageIndex"
          v-model:page-size="search.PageLimit"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="sizes, prev, pager, next"
          @current-change="getTbody"
          @size-change="onPageSizeChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/api';

const router = useRouter();
const loading = ref(false);
const isFullView = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);
const custTypes = ref<any[]>([]);

const search = reactive({
  PageIndex: 1,
  PageLimit: 20,
  Count: 0,
  ClientName: '',
  ClientCode: '',
  SalerName: '',
  CustomerType: '',
  RegisterPhone: '',
});

const fmtMoney = (v: any) => '￥' + Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const getCustTypes = async () => {
  try {
    const res: any = await api.customer.GetAllCustTypes();
    if (res?.Data) custTypes.value = Array.isArray(res.Data) ? res.Data : [];
  } catch {
    custTypes.value = [];
  }
};

const getTbody = async () => {
  loading.value = true;
  try {
    const res: any = await api.customer.QueryClientsInfos({ ...search });
    if (res?.Data) {
      search.Count = res.Data.Count || 0;
      total.value = res.Data.Count || 0;
      tableData.value = res.Data.children || [];
    }
  } catch {
    tableData.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
};

const onPageSizeChange = () => {
  search.PageIndex = 1;
  getTbody();
};

const resetSearch = () => {
  search.ClientName = '';
  search.ClientCode = '';
  search.SalerName = '';
  search.CustomerType = '';
  search.RegisterPhone = '';
  search.PageIndex = 1;
  getTbody();
};

const toggleColumns = () => { isFullView.value = !isFullView.value; };
const handleExport = () => { ElMessage.info('导出客户资料 CSV'); };
const viewDetail = (row: any) => { router.push(`/customer/detail?code=${row.ClientCode}`); };
const editClient = (row: any) => { router.push(`/customer/edit?code=${row.ClientCode}`); };
const openAdd = () => { router.push('/customer/edit?type=new'); };

const handleDelete = async (row: any) => {
  try {
    await ElMessageBox.confirm(`确定删除客户「${row.ClientName}」（${row.ClientCode}）？删除后不可恢复。`, '删除确认', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' });
    await api.customer.DelCustomer({ ClientCode: row.ClientCode });
    ElMessage.success('删除成功');
    getTbody();
  } catch {
    // cancelled or error
  }
};

onMounted(() => {
  getCustTypes();
  getTbody();
});
</script>

<style scoped lang="scss">
.table-actions { display: flex; align-items: center; gap: 4px; }
.mono-text { font-family: var(--erp-font-mono); font-variant-numeric: tabular-nums; }
</style>
