<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 系统</p>
        <h1>角色配置</h1>
        <p class="erp-pagehead-desc">员工按角色获得权限。停用的角色不能登录；有员工使用的角色不能删除。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button type="primary" @click="createRole">
          <el-icon><Plus /></el-icon> 新建角色
        </el-button>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-panelhead"><h2>角色</h2><span class="erp-panelhead-note">权限共 {{ allPermsCount }} 项，分 {{ permModules }} 个模块</span></div>
      <div class="erp-table-wrap">
        <el-table :data="tableData" v-loading="loading" stripe style="width: 100%">
          <el-table-column prop="code" label="角色编号" width="120">
            <template #default="{ row }"><span class="mono-text">{{ row.code }}</span></template>
          </el-table-column>
          <el-table-column prop="name" label="角色名称" width="140">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="editPerms(row)">{{ row.name }}</el-button>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100" align="center">
            <template #default="{ row }">
              <span class="erp-badge" :data-tone="row.enabled ? 'success' : 'warning'">{{ row.enabled ? '已启用' : '已停用' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="prod" label="参与生产" width="100" align="center">
            <template #default="{ row }">{{ row.prod ? '是' : '否' }}</template>
          </el-table-column>
          <el-table-column prop="users" label="员工数" width="90" align="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="viewUsers(row)">{{ row.users }}</el-button>
            </template>
          </el-table-column>
          <el-table-column prop="perms" label="已授权限" width="120" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ row.perms }} / {{ allPermsCount }}</span></template>
          </el-table-column>
          <el-table-column prop="maxDiscount" label="最大折扣" width="100" align="right">
            <template #default="{ row }">{{ row.maxDiscount || '不限' }}</template>
          </el-table-column>
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <div class="table-actions">
                <el-button link type="primary" size="small" @click="editPerms(row)">配置权限</el-button>
                <el-button link type="primary" size="small" @click="toggleEnabled(row)">{{ row.enabled ? '停用' : '启用' }}</el-button>
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

    <!-- 新建角色对话框 -->
    <el-dialog v-model="createDialogVisible" title="新建角色" width="460px">
      <el-form label-width="100px">
        <el-form-item label="角色名称" required>
          <el-input v-model="newRole.name" maxlength="10" placeholder="请输入角色名称" />
        </el-form-item>
        <el-form-item label="复制权限自">
          <el-select v-model="newRole.copyFrom" placeholder="（不复制，空白权限）" clearable style="width: 100%">
            <el-option v-for="r in tableData" :key="r.name" :label="r.name" :value="r.name" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="doCreateRole">创建角色</el-button>
      </template>
    </el-dialog>

    <!-- 权限配置对话框 -->
    <el-dialog v-model="permDialogVisible" :title="`角色权限：${permEditRole.name}`" width="720px" top="5vh">
      <div class="perm-section">
        <h3>基本资料</h3>
        <el-form label-width="120px" size="small">
          <el-form-item label="角色编号"><el-input v-model="permEditRole.code" maxlength="10" style="width: 160px" /></el-form-item>
          <el-form-item label="角色名称"><el-input v-model="permEditRole.name" maxlength="10" style="width: 200px" /></el-form-item>
          <el-form-item label="状态">
            <span class="erp-badge" :data-tone="permEditRole.enabled ? 'success' : 'warning'">{{ permEditRole.enabled ? '已启用' : '已停用' }}</span>
          </el-form-item>
        </el-form>
      </div>
      <div class="perm-section">
        <h3>界面与生产</h3>
        <div class="perm-checks">
          <el-checkbox v-model="permEditRole.collapse">默认折叠主菜单</el-checkbox>
          <el-checkbox v-model="permEditRole.noToolbar">不启用工具栏</el-checkbox>
          <el-checkbox v-model="permEditRole.prod">参与生产（可被选为处理员工）</el-checkbox>
        </div>
      </div>
      <div class="perm-section">
        <h3>角色权限 <span class="perm-count">已选 {{ permEditRole.selectedPerms.length }} / {{ allPermsCount }} 项权限</span></h3>
        <el-tabs v-model="permTab">
          <el-tab-pane v-for="mod in permModulesList" :key="mod" :label="mod">
            <div v-for="sec in getPermSections(mod)" :key="sec" class="perm-group">
              <div class="perm-group-head">
                <strong>{{ sec }}</strong>
                <el-button link type="primary" size="small" @click="toggleAll(mod, sec)">全选 / 全不选</el-button>
              </div>
              <div class="perm-checks">
                <el-checkbox v-for="p in getPermItems(mod, sec)" :key="p" :model-value="permEditRole.selectedPerms.includes(`${mod}|${sec}|${p}`)" @change="(val: boolean) => togglePerm(mod, sec, p, val)">{{ p }}</el-checkbox>
              </div>
            </div>
            <div v-if="mod === '前台'" class="perm-discount">
              <el-form-item label="普通客户最大整单折扣">
                <el-input v-model="permEditRole.maxDiscount" placeholder="如 8.5，留空不限" style="width: 180px" />
              </el-form-item>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
      <template #footer>
        <el-button @click="permDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="savePerms">保存角色</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';

const router = useRouter();
const loading = ref(false);
const tableData = ref<any[]>([]);
const allPermsCount = 48;
const permModules = 6;

const createDialogVisible = ref(false);
const newRole = reactive({ name: '', copyFrom: '' });

const permDialogVisible = ref(false);
const permEditRole = reactive<any>({ name: '', code: '', enabled: true, collapse: false, noToolbar: false, prod: true, selectedPerms: [] as string[], maxDiscount: '' });
const permTab = ref('前台');

const permModulesList = ['前台', '生产', '财务', '客户', '报表', '系统'];
const permSectionsMap: Record<string, Record<string, string[]>> = {
  '前台': { '开单': ['新建工单', '编辑工单', '删除工单', '查看工单'], '结算': ['现金结算', '在线收款', '退款'], '客户': ['新建客户', '编辑客户'] },
  '生产': { '流程': ['接收任务', '完工登记', '流程跳转'], '质检': ['质量检查', '返工处理'] },
  '财务': { '收款': ['审核结算', '反审核'], '支出': ['新建支出', '审核支出'], '转账': ['新建转账', '审核转账'] },
  '客户': { '客户管理': ['新建客户', '编辑客户', '删除客户', '合并客户'], '协议价格': ['新建协议', '修改协议', '删除协议'] },
  '报表': { '查看': ['营业日报', '财务报表', '客户报表'] },
  '系统': { '基础设置': ['员工管理', '角色管理', '参数设置'], '数据管理': ['基础数据', '数据导入', '数据备份'] },
};

const getPermSections = (mod: string) => Object.keys(permSectionsMap[mod] || {});
const getPermItems = (mod: string, sec: string) => permSectionsMap[mod]?.[sec] || [];

const togglePerm = (mod: string, sec: string, p: string, val: boolean) => {
  const key = `${mod}|${sec}|${p}`;
  if (val) { if (!permEditRole.selectedPerms.includes(key)) permEditRole.selectedPerms.push(key); }
  else { permEditRole.selectedPerms = permEditRole.selectedPerms.filter((k: string) => k !== key); }
};

const toggleAll = (mod: string, sec: string) => {
  const items = getPermItems(mod, sec);
  const keys = items.map(p => `${mod}|${sec}|${p}`);
  const allOn = keys.every(k => permEditRole.selectedPerms.includes(k));
  if (allOn) permEditRole.selectedPerms = permEditRole.selectedPerms.filter((k: string) => !keys.includes(k));
  else keys.forEach(k => { if (!permEditRole.selectedPerms.includes(k)) permEditRole.selectedPerms.push(k); });
};

const createRole = () => { newRole.name = ''; newRole.copyFrom = ''; createDialogVisible.value = true; };

const doCreateRole = () => {
  if (!newRole.name.trim()) { ElMessage.warning('请填写角色名称'); return; }
  if (tableData.value.some(r => r.name === newRole.name.trim())) { ElMessage.warning(`角色「${newRole.name}」已存在`); return; }
  const src = newRole.copyFrom ? tableData.value.find(r => r.name === newRole.copyFrom) : null;
  const code = String(10000 + (tableData.value.length + 1) * 1000);
  tableData.value.push({
    code, name: newRole.name.trim(), enabled: true, prod: false, users: 0,
    perms: src ? src.perms : 0, maxDiscount: src?.maxDiscount || '',
    _selectedPerms: src ? [...(src._selectedPerms || [])] : [],
    collapse: false, noToolbar: false,
  });
  createDialogVisible.value = false;
  ElMessage.success(`已新建角色「${newRole.name.trim()}」`);
};

const editPerms = (row: any) => {
  Object.assign(permEditRole, {
    name: row.name, code: row.code, enabled: row.enabled, collapse: row.collapse, noToolbar: row.noToolbar, prod: row.prod,
    selectedPerms: [...(row._selectedPerms || [])], maxDiscount: row.maxDiscount || '',
  });
  permTab.value = '前台';
  permDialogVisible.value = true;
};

const savePerms = () => {
  const row = tableData.value.find(r => r.name === permEditRole.name || r.code === permEditRole.code);
  if (row) {
    const oldName = row.name;
    Object.assign(row, {
      code: permEditRole.code, name: permEditRole.name, enabled: permEditRole.enabled,
      collapse: permEditRole.collapse, noToolbar: permEditRole.noToolbar, prod: permEditRole.prod,
      perms: permEditRole.selectedPerms.length, maxDiscount: permEditRole.maxDiscount,
      _selectedPerms: [...permEditRole.selectedPerms],
    });
    if (oldName !== permEditRole.name) {
      tableData.value.forEach(r => { if (r.role === oldName) r.role = permEditRole.name; });
    }
  }
  permDialogVisible.value = false;
  ElMessage.success(`角色「${permEditRole.name}」已保存：${permEditRole.selectedPerms.length} 项权限`);
};

const toggleEnabled = (row: any) => {
  if (row.enabled) {
    ElMessageBox.confirm(`停用角色「${row.name}」？${row.users ? `${row.users} 名员工使用该角色，停用后他们不能登录。` : '没有员工使用该角色。'}`, '提示', { type: 'warning' })
      .then(() => { row.enabled = false; ElMessage.success(`角色「${row.name}」已停用`); })
      .catch(() => {});
  } else {
    row.enabled = true;
    ElMessage.success(`角色「${row.name}」已启用`);
  }
};

const handleDelete = (row: any) => {
  if (row.users > 0) {
    ElMessage.warning(`不能删除角色「${row.name}」：有 ${row.users} 名员工使用。请先把他们改为其他角色。`);
    return;
  }
  ElMessageBox.confirm(`删除角色「${row.name}」？角色的权限配置一并删除，不能恢复。`, '提示', { type: 'warning' })
    .then(() => { tableData.value = tableData.value.filter(r => r.code !== row.code); ElMessage.success(`角色「${row.name}」已删除`); })
    .catch(() => {});
};

const viewUsers = (row: any) => { router.push(`/system?role=${row.name}`); };

onMounted(() => {
  loading.value = true;
  setTimeout(() => {
    tableData.value = [
      { code: '10001', name: '管理员', enabled: true, prod: false, users: 1, perms: 48, maxDiscount: '', collapse: false, noToolbar: false, _selectedPerms: [] },
      { code: '10002', name: '前台', enabled: true, prod: true, users: 2, perms: 24, maxDiscount: '8.5', collapse: false, noToolbar: false, _selectedPerms: ['前台|开单|新建工单', '前台|开单|编辑工单', '前台|结算|现金结算', '前台|客户|新建客户'] },
      { code: '10003', name: '总管', enabled: true, prod: true, users: 1, perms: 40, maxDiscount: '', collapse: false, noToolbar: false, _selectedPerms: [] },
      { code: '10004', name: '设计师', enabled: true, prod: true, users: 1, perms: 12, maxDiscount: '', collapse: true, noToolbar: false, _selectedPerms: ['生产|流程|接收任务'] },
      { code: '10005', name: '生产员', enabled: true, prod: true, users: 3, perms: 8, maxDiscount: '', collapse: false, noToolbar: true, _selectedPerms: ['生产|流程|接收任务', '生产|流程|完工登记'] },
      { code: '10006', name: '财务', enabled: true, prod: false, users: 1, perms: 20, maxDiscount: '', collapse: false, noToolbar: false, _selectedPerms: ['财务|收款|审核结算'] },
      { code: '10007', name: '后道', enabled: false, prod: true, users: 0, perms: 6, maxDiscount: '', collapse: false, noToolbar: true, _selectedPerms: [] },
    ];
    loading.value = false;
  }, 200);
});
</script>

<style scoped lang="scss">
.table-actions { display: flex; align-items: center; gap: 4px; }
.mono-text { font-family: var(--erp-font-mono); font-variant-numeric: tabular-nums; }
.mono-cell { font-family: var(--erp-font-mono); font-variant-numeric: tabular-nums; }
.perm-section { margin-bottom: 16px; h3 { font-size: 15px; margin: 0 0 8px; } }
.perm-count { font-size: 13px; color: var(--erp-text-soft); font-weight: 400; margin-left: 8px; }
.perm-checks { display: flex; flex-wrap: wrap; gap: 8px 16px; }
.perm-group { border-top: 1px solid var(--erp-line); padding: 8px 0; }
.perm-group-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.perm-discount { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--erp-line); }
</style>
