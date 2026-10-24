# 客户资料：Lite 对接完整版接口的待确认事项

给完整版（根目录 Vue 工程 `src/`）的开发同事看。LiteERP（`v2/`）要向下兼容完整版后端：**沿用完整版原始字段名和状态值，只在前端显示层起中文别名**。下面是客户资料这一块对照后需要你们确认的地方，直接在本文件里回复或改都可以。

对照范围：

- 完整版：`src/views/customer/index.vue`、`src/views/customer/customerDetail.vue`，接口 `src/api/customer.ts`、`src/api/pricecfg.ts`
- Lite：`v2/js/pages/customer.js`（客户资料 `custManage`、客户详情 `customerDetail`）

## 1. 字段对照

| 完整版字段 | 显示名 | Lite v2 现用 | 情况 |
|---|---|---|---|
| `ClientCode` | 客户编号 | `code` | 对应 |
| `ClientName` | 客户名称 | `name` | 对应 |
| `CustomerType` | 客户分组 | `group`（编号）/ `groupName` | 后端存分组**编号**，按编号筛选；Lite 用编号。一致 |
| `RegisterPhone` | 注册手机号 | `phone` | 基本对应 |
| `SalerName` | 销售代表 | `owner`（负责人员） | 待确认，见问题 1 |
| `CardBalance` | 储值卡余额 | `prestoreBalance` | 待确认，见问题 2 |
| `AccountPeriod` / `AccountAmt` | 账期上限 / 账额上限 | `settleType`（现结/记账/月结）、`creditLimit` | 两个都是管控上限，不是欠款本身。见问题 3 |
| `DepName` | 门店名称 | 无 | Lite 暂无多门店 |
| `PriceTableName` | 价格表 | 无（Lite 用分组折扣 + 协议价） | 见问题 5 |
| `LastOrderTime` / `OrderCostAmt` / `CouponsNum` | 最后下单 / 总消费 / 优惠券数 | 无 | 后端统计字段，Lite 直接显示 |
| `CreateTime` / `Creator` / `UpdateTime` / `Updater` | 创建、更新时间与人 | 仅 `created`（建交日期） | 待确认 `created` 是否就是 `CreateTime` |
| `Debt`（详情接口） | 欠款 | `debt` | 不在客户主表，由 `TotalAmtAndPeriod` 实时计算 |
| `PrestoreBalance`、`TotalSettlement`（详情接口） | 预存余额、累计结算 | `prestoreBalance` | `PrestoreBalance` = `CardBalance`；`TotalSettlement` 后端未返回 |

Lite 还有一批照旧版 Windows「客户资料」窗口做的字段，完整版前端目前没用到，不知道后端有没有、叫什么：

> 简称、机构/个人类型、固话、QQ、微信、传真、电子邮件、邮编、网址、地址、城市商圈、取送距离、客户来源、所属行业、机构性质、规模、价值评估、关系等级、信誉等级、无委托提醒天数、开票抬头、税号、开户银行、最近对账日期、说明备注、说明简介

联络人员（`pricecfg/GetAllSubAccounts`）完整版用到：`RecId`、`Name`、`CallName`、`ContactType`、`Department`、`Title`、`Mobile`、`Phone`、`Email`、`CrtTime`。Lite 另有性别、年龄段、QQ、地址、身份证、云端账号、负责人员、说明，同样需要确认。

回答：能用的字段保留，没有的新增

## 2. 需要确认的问题

1. **`SalerName`（销售代表）** 和 Lite 的「负责人员」是不是同一个概念？
   回答：是同一个概念。后端 `C3_314456831953` 字段存储的就是负责人员/销售代表，两者对应同一个字段。

3. **`CardBalance`（储值卡余额）和 `PrestoreBalance`（预存余额）** 有什么区别？列表接口和详情接口各返回一个，是同一个数吗？
   回答：是同一个数。后端数据库字段是 `C3_319816521955`，别名为 `CardBalance`。列表接口 `GetAllCustomerInfo` 和详情接口 `getClientBasicInfo` 都返回这个字段，是同一个值。Lite 的 `prestoreBalance` 对应的就是后端的 `CardBalance`。

4. **结算方式**：后端有没有「现结 / 记账 / 月结」这样的字段？还是用 `AccountPeriod > 0` 表示记账、`AccountAmt` 表示信用额度？
   回答：
   - 后端没有独立的「现结/记账/月结」枚举字段
   - `AccountAmt`（C3_314456863421）：**信用额度上限**，客户最多能欠多少钱
   - `AccountPeriod`（C3_314456853250）：**账期上限**，客户一笔欠款最长能欠多少天
   - 两个都是**管控上限**，不是欠款本身
   - 实际欠款由 `TotalAmtAndPeriod` 接口从订单表实时汇总计算
   - 判断逻辑：`AccountAmt > 0` 表示该客户允许挂账（记账），`AccountPeriod > 0` 表示允许赊账天数

5. **`GetSigCustomerBasic` 的完整返回字段**：请给一条真实返回（脱敏即可）或接口文档。上面那批 Lite 扩展字段能保留多少取决于这个。
   回答：详情接口返回字段如下（见 4.2 第 1 条的真实返回示例）：
   - 基础信息：`Id`, `DepName`, `DepCode`, `ClientCode`, `ClientName`, `LogUserName`, `LogPassword`（建议移除）, `RegisterPhone`, `ContactPerson`, `SalerName`, `AccountPeriod`, `AccountAmt`
   - 价格相关：`PriceTableName`, `PriceTable`, `CustomerType`（分组编号）
   - 地址相关：`ContactAddress`, `ContactUserName`, `ContactUserPhone`, `IsClientShopAddress`
   - 统计字段：`LastOrderTime`, `OrderCostAmt`, `CouponsNum`, `CardBalance`
   - 审计字段：`Creator`, `CreateTime`, `Updater`, `UpdateTime`
   - 其他：`NotAllOldVerLogin`
   
   **缺失字段：**
   - `Debt`（欠款）：不在此接口，需调用 `TotalAmtAndPeriod` 获取
   - `TotalSettlement`（累计结算）：后端未返回，页面显示为空
   - `LogPassword`：建议从返回结果中移除
   
   **Lite 扩展字段对照：**
   - 已有的：地址（`ContactAddress`）、固话（`CompanyTel`，需确认是否在返回中）、传真（`Fax`，需确认）、邮箱（`Email`，需确认）、邮编（`PostCode`，需确认）、联系人（`ContactPerson`）、手机（`RegisterPhone`）
   - 缺失需新增的：简称、QQ、微信、网址、城市商圈、取送距离、客户来源、所属行业、机构性质、规模、价值评估、关系等级、信誉等级、无委托提醒天数、最近对账日期、说明备注、说明简介
   - 开票信息（开票抬头、税号、开户银行）：在独立表 `ct342194900968`，需通过 `GetInvoiceHeader` 接口获取，见 4.2 第 2 条

6. **价格表**：`PriceTableName` 对应的价格表和「客户分组」是什么关系？客户开单价是怎么取的（价格表 / 分组 / 协议价的优先级）？
   回答：
   - `PriceTable`（C3_334927333156）：价格表编号
   - `PriceTableName`（C3_328976593456）：价格表名称
   - `CustomerType`（C3_758400058259）：客户分组编号
   - 三者是独立字段，客户同时有价格表和分组
   - **开单价优先级（业务方确认）：协议价 > 分组价格 > 基础价格表**
   - 即：客户有协议价就用协议价；没有就用所在分组的价格（分组折扣）；再没有就用基础价格表
   - 注意：之前答复中写的「价格表 > 分组折扣 > 协议价」顺序是**错误的**，以此为准

7. **`GetAllCustTypes` 返回字段**：前端写的是 `g.Code || g.code`、`g.Name || g.name`，实际是哪种大小写？`CustomerType` 筛选传名称还是编号？
   回答：
   - 后端返回字段：`CustomerType`（分组编号）、`Sort`（排序号）
   - 数据库字段 `C3_758399706712` 别名是 `CustomerType`，存储的是分组**编号**（如 "VIP"、"NORMAL"）
   - 前端应该用 `g.CustomerType` 获取编号
   - 筛选时 `CustomerType` 参数传的是分组**编号**，不是名称
   - 证据：`QueryClientsInfos` 中筛选条件是 `C3_758400058259 = '{0}'`（精确匹配），说明存的是编号
   - 注意：后端没有返回 `Code` 或 `Name` 字段，只有 `CustomerType`（编号）和 `Sort`（排序）。前端代码里的 `g.Code || g.code` 和 `g.Name || g.name` 都取不到值，需要改为 `g.CustomerType`
   - **之前答复说存的是名称，这是错误的，以此为准：存的是编号**

8. **`QueryClientsInfos` 的筛选参数**：目前前端传 `ClientName`、`ClientCode`、`SalerName`、`CustomerType`、`RegisterPhone`。Lite 原来是一个关键字框同时搜编号、名称、电话、联系人、地址，后端能否加一个关键字参数（比如 `Keyword`）？是否支持排序参数？
   回答：
   - 当前支持的筛选参数：`ClientCode`, `ClientName`, `SalerName`, `CustomerType`, `PriceTable`, `ExInPriceTable`, `RegisterPhone`, `DepCode`, `PageIndex`, `PageLimit`
   - **不支持** `Keyword` 关键字搜索，需要后端新增
   - **不支持** 排序参数，当前固定按 `C3_509327544331`（创建时间）降序排列
   - 建议：后端新增 `Keyword` 参数，同时搜索编号、名称、电话、联系人、地址；新增 `OrderBy` 和 `OrderDirection` 参数支持排序

9. **删除客户 `DelCustomer`**：后端是否会拦截「已有工单 / 结算 / 预存卡记录」或「有欠款」的客户？Lite 原设计是这类客户不能删、只能合并，需要后端给出明确的 `RespMsg`。散户 `000000` 是否也是系统默认客户、不可删除？
   回答：
   - 后端**会拦截**已有订单的客户：检查订单表 `ct563276270738` 是否有该客户记录，如果有则返回错误 "客户已创建订单,不能删除"
   - 后端**目前不检查**欠款、预存余额等情况（需要改进，见 4.2 第 4 条）
   - 后端**没有**针对散户 `000000` 的特殊保护逻辑
   - **之前答复建议用 `AccountAmt > 0` 判断欠款，这是错误的**：`AccountAmt` 是信用额度上限，不是实际欠款。实际欠款由 `TotalAmtAndPeriod` 接口从订单表汇总计算
   - 正确的欠款判断：调用 `checkClientZhangDayAndAmt` 方法，返回的 `amt > 0` 表示有欠款

10. **新建 / 编辑 `AddOrModifyCustomer`**：请求字段和必填项是什么？客户编号由后端生成还是前端填？
    回答：
    - **客户编号生成规则**：后端自动生成，格式为 "LYCC" + 自增序号（如 LYCC1, LYCC2...）
    - **新建时**：`ClientCode` 传空或不传，后端自动生成
    - **编辑时**：必须传 `ClientCode`
    - **必填字段**：
      - `ClientName`（客户名称）- 后端检查不能重复
      - `SalerName`（销售代表/负责人员）
      - `RegisterPhone`（注册手机号）
      - `DepCode`（门店编号）
    - **可选字段**：
      - `LogUserName`（登录用户名）
      - `LogPassword`（登录密码）
      - `ContactPerson`（联系人）
      - `ContactUserPhone`（联系人电话）
      - `ContactAddress`（联系地址）
      - `IsClientShopAddress`（是否门店地址，布尔值）
      - `PriceTable`（价格表编号）
      - `CustomerType`（客户分组编号）
      - `AccountPeriod`（账期天数）
      - `AccountAmt`（账额/信用额度）
      - `Operator`（操作员）
      - `NotAllOldVerLogin`（是否禁止旧版登录，布尔值）

11. **客户合并**：完整版有没有合并接口？Lite 有「客户合并」页面（把重复建档客户的记录并入另一个客户）。
    回答：**没有**合并接口。后端代码中未找到任何客户合并相关的 API 或 DAO 方法。如果需要实现客户合并功能，需要后端新增接口，逻辑包括：
    - 将源客户的所有订单、结算记录、优惠券等关联数据转移到目标客户
    - 删除源客户记录
    - 需要事务保证数据一致性

## 3. 完整版前端里顺带发现的问题

只是记下来，Lite 这边没有改动这些代码。

- **客户相关跳转到不存在的路由**：`/customer/edit`（新建、编辑客户）、`/customer/contactEdit`（联络人）未在 `src/router/index.ts` 注册，点击后落到 404。`/system/employeeEdit` 同样。
- **客户列表的搜索条件 `ClientCode`** 在 `search` 里有，但界面上没有对应输入框。
- **经营子项编辑丢编码**（`src/views/system/bizItems.vue`）：`editSub` 没把 `SubItemCode` 放进表单，保存修改时传的 `SubItemCode` 是 `undefined`。
- **新建工单不保存**（`src/views/frontdesk/newOrder.vue`）：`submitForm` 只提示成功，没有调用 `CrtEmptyOrderInfo`。
- **接口失败时假装成功**：登录失败会用模拟 token 进入系统（`src/views/login/index.vue`）；工单列表失败显示模拟数据；作废失败提示「作废成功（模拟）」。正式环境会掩盖真实故障。
- **密钥在前端**：`apikey`（`src/utils/request.ts`）、登录签名用的 `AppId` / `AppSecret`（`src/views/login/index.vue`）写死在前端代码里，并已推到本仓库。如果是生产值，建议后端轮换。

## 4. 第二轮：业务口径确认与追问（2026-10-23）

谢谢回复。下面是 Lite 侧（业务方）对几处答复的确认和更正，以及需要你们进一步核查的问题。题号对应第 2 节里的编号。

### 4.1 业务口径（业务方确认，以此为准）

- **客户分组存编号。** 客户上的 `CustomerType` 应该是分组**编号**，不是名称。第 6 条和第 7 条的答复互相矛盾（一处说编号、一处说名称），请按编号核对后端实际存储和 `GetAllCustTypes` 的返回；如果现在确实存的是名称，请说明，我们一起定迁移方案。
- **开单价优先级：协议价 > 分组价格 > 基础价格表。** 客户有协议价就用协议价；没有就用所在分组的价格（分组折扣）；再没有就用基础价格表。第 6 条答复里的「价格表 > 分组折扣 > 协议价」顺序是反的，请对照后端真实定价代码确认是否按这个顺序实现，不一致的地方请列出来。
- **账额和账期是两个独立的限制。**
  - `AccountAmt` 账额：客户最多能欠多少钱（信用额度）。
  - `AccountPeriod` 账期：客户一笔欠款最长能欠多少天。
  - 两个都是管控上限，**不是欠款本身**。
- **欠款的来源：开单形成欠款，核销减少欠款。**
- **有欠款的客户不能删除。** 第 9 条答复建议用 `AccountAmt > 0` 判断「有欠款」，这是不对的：`AccountAmt` 是信用额度，按这个判断，所有给过额度的客户都删不掉。应按客户**实际欠款余额 > 0** 拦截。

### 4.2 请进一步说明或核查（后端回复）

#### 1. 详情接口补充说明

**GetSigCustomerBasic 真实返回示例（脱敏）：**
```json
{
  "Id": "1729654321098",
  "DepName": "总店",
  "DepCode": "D001",
  "ClientCode": "LYCC1001",
  "ClientName": "张三印刷厂",
  "LogUserName": "zhangsan",
  "LogPassword": "加密后的密码",
  "RegisterPhone": "13800138000",
  "ContactPerson": "李四",
  "SalerName": "王业务",
  "AccountPeriod": "30",
  "AccountAmt": "50000",
  "PriceTableName": "标准价格表",
  "PriceTable": "PT001",
  "CustomerType": "VIP",
  "ContactAddress": "北京市朝阳区XX路XX号",
  "ContactUserName": "李四",
  "ContactUserPhone": "13900139000",
  "IsClientShopAddress": "true",
  "LastOrderTime": "2026-10-20 14:30:00",
  "OrderCostAmt": "125000.50",
  "CouponsNum": "5",
  "CardBalance": "3000.00",
  "Creator": "admin",
  "CreateTime": "2025-01-15 10:00:00",
  "Updater": "admin",
  "UpdateTime": "2026-10-20 14:30:00",
  "NotAllOldVerLogin": 0
}
```

**Debt、PrestoreBalance、TotalSettlement 来源：**
- `Debt`（欠款）：不在客户主表，由 `TotalAmtAndPeriod` 接口实时计算返回。查询订单表 `ct556479606591`，统计状态为"挂账"且未核销的订单总金额。
- `PrestoreBalance`（预存余额）：就是 `CardBalance`，来自客户主表 `C3_319816521955` 字段。
- `TotalSettlement`（累计结算）：后端目前没有返回这个字段，前端显示为空。需要后端新增统计逻辑。

**TotalAmtAndPeriod 接口返回字段：**
```json
{
  "AccountAmt": "15000.00",  // 当前实际欠款金额（不是信用额度）
  "AccountPeriod": "45"      // 最早一笔欠款的天数（不是账期上限）
}
```
计算逻辑：从订单表查询该客户所有"挂账"状态且未核销的订单，`AccountAmt` = 欠款总额，`AccountPeriod` = 最早一笔欠款距今的天数。

**方法名对应关系：**
- `GetAllCustomerInfo` 是后端 DAO 方法名，对应前端接口 `QueryClientsInfos`
- `getClientBasicInfo` 是后端 DAO 方法名，对应前端接口 `GetSigCustomerBasic`
- 前端调用的是 Controller 层的接口名，Controller 内部调用 DAO 方法

**LogPassword 安全问题：**
确认是加密存储的密码哈希值，不是明文。但前端确实不需要这个字段，建议从 `GetSigCustomerBasic` 返回结果中移除。

#### 2. 开票信息

**表名：** `ct342194900968`（开票信息表）

**字段清单：**
| C3_ 列名 | 别名 | 说明 |
|---|---|---|
| `C3_796307944110` | CompanyCode | 公司编号（关联客户表的 C3_589570928743） |
| `C3_507553104926` | ClientCode | 客户编号（关联客户表的 C3_314456699328） |
| `C3_342195020421` | InvoiceHeader / ConpanynNames | 开票抬头 |
| `C3_507551356025` | TaxNo / Taxpayer | 税号 |
| `C3_507551356353` | InvoiceBank | 开户银行 |
| `C3_507551356287` | InvoiceAddress | 银行账号 |
| `C3_507551378462` | InvoiceType | 发票类型 |
| `C3_842820885746` | BipUserCode | 用友客户编号 |
| `C3_844103387852` | BipUserName | 用友客户名称 |

**关联方式：** 一个客户一条开票记录，通过 `ClientCode` 关联。

**现有接口：**
- `GetInvoiceHeader`：查询开票信息列表（支持分页、按客户编号/名称/开票抬头筛选）
- `ModBipCustomerInfo`：修改用友客户信息（BipUserCode、BipUserName）
- 前端 API：`/api/CustomerMan/GetInvoiceHeader`

#### 3. CRM 类信息

**客户主表 `ct314456162312` 已有字段：**
| C3_ 列名 | 别名 | 说明 |
|---|---|---|
| `C3_314456717328` | ClientName | 客户名称（可作简称用） |
| `C3_363871601703` | CompanyTel | 固话 |
| `C3_344096054140` | Email | 电子邮件 |
| `C3_363871665343` | Fax | 传真 |
| `C3_318857585359` | PostCode | 邮编 |
| `C3_318857579765` | Address | 地址 |
| `C3_363873090062` | ContactPerson | 联系人 |
| `C3_344425630953` | ContactUserPhone | 手机号 |

**后端目前缺失的字段（需要新增）：**
- QQ、微信、网址
- 城市商圈、取送距离、客户来源、所属行业
- 机构性质、规模、价值评估、关系等级、信誉等级
- 无委托提醒天数、最近对账日期
- 说明备注、说明简介

这些字段在客户主表中没有找到对应列，需要后端评估是否新增数据库列或创建扩展表。

#### 4. 删除拦截

**当前逻辑：**
- 检查订单表 `ct563276270738` 是否有该客户的订单记录
- 有订单则返回错误："客户已创建订单,不能删除"

**建议改为：**
```csharp
// 1. 检查是否有订单
int orderCount = 查询订单表 where ClientCode = @clientCode;
if (orderCount > 0) {
    errorMsg = "客户已创建订单,不能删除";
    return false;
}

// 2. 检查是否有欠款（调用 TotalAmtAndPeriod 的逻辑）
int debtDays = 0;
decimal debtAmt = 0;
bool hasDebt = VTOrderSecDao.checkClientZhangDayAndAmt(companyCode, clientCode, out debtDays, out debtAmt);
if (hasDebt && debtAmt > 0) {
    errorMsg = "客户有未结清欠款，不能删除";
    return false;
}

// 3. 检查是否有预存余额
decimal cardBalance = 查询客户表 CardBalance where ClientCode = @clientCode;
if (cardBalance > 0) {
    errorMsg = "客户有预存余额，不能删除";
    return false;
}

// 4. 执行删除
delete from 客户表 where ClientCode = @clientCode;
```

**预存余额拦截：** 建议拦截。`CardBalance > 0` 说明客户还有钱没用完，删除会导致财务数据不一致。

## 5. 第三轮：对第二轮回复的确认与追问（2026-10-23）

题号对应 Lite 侧对第二轮回复的复核。5.1 是 Lite 侧自己处理的，5.2 起需要你们回复或开发。

### 5.1 Lite 侧自己处理

- **同名字段两种含义。** `TotalAmtAndPeriod` 返回的 `AccountAmt` / `AccountPeriod` 是「当前实际欠款 / 最早一笔欠款已欠天数」，客户资料里同名字段是「信用额度上限 / 账期上限」。Lite 保留原字段名，但按来源分开处理，显示名分别为「当前欠款」「最长欠款天数」和「信用额度」「账期」，不会混用。后端不用改。

### 5.2 欠款口径（后端回复）

**`checkClientZhangDayAndAmt` 实际 SQL：**
```sql
SELECT DATEDIFF(day, MIN(C3_556480132234), GETDATE()) Day,
       SUM(CONVERT(numeric(15,2), C3_556479818689)) Amt
FROM ct556479606591
WHERE C3_565176230693 = @companyCode
  AND C3_556479754869 = @clientCode
  AND C3_556480145150 = '挂账'
  AND (C3_659185409750 <> 'Y' OR C3_659185409750 IS NULL)
```

**字段含义：**
- `C3_556480132234`：订单日期
- `C3_556479818689`：订单金额（应收金额）
- `C3_556480145150`：结算状态（'挂账' = 未结清）
- `C3_659185409750`：核销标记（'Y' = 已核销）

**与业务口径的差异：**

1. **部分收款（少收货款）**：当前实现**未区分**部分收款。只要结算状态是"挂账"且未完全核销，就按订单全额计入欠款。少收的差额**没有单独处理**。

2. **部分核销**：当前实现**按订单全额计算**，不是剩余未核销金额。只要 `C3_659185409750 <> 'Y'`（未完全核销），整个订单金额都计入欠款。

3. **预存抵扣、退款、作废、红冲**：
   - **预存抵扣**：如果抵扣后订单状态变为非"挂账"，则不计入；否则仍计入
   - **退款**：未看到退款金额冲减欠款的逻辑
   - **作废**：作废订单如果结算状态仍是"挂账"，会被计入欠款（可能有问题）
   - **红冲**：红冲订单如果未单独处理，会导致欠款重复计算

**结论**：当前实现与业务口径**不一致**。建议改为：
- 欠款 = 订单应收金额 - 已收款金额 - 已核销金额 - 预存抵扣金额 - 退款金额
- 作废和红冲订单应排除或冲减

### 5.3 两张订单表（后端回复）

**表说明：**
- `ct556479606591`：**订单主表**（老表），存储工单/订单的主要信息，包含结算状态、金额、核销标记等
- `ct563276270738`：**优惠券/订单关联表**（可能是订单明细或优惠券使用记录），用于检查客户是否有订单记录

**问题：**
- 删除检查用的是 `ct563276270738`，欠款计算用的是 `ct556479606591`
- **可能出现不一致**：客户在 `ct556479606591` 有欠款记录，但在 `ct563276270738` 没有记录，导致可以删除有欠款的客户

**建议**：删除检查应同时检查两张表，或统一使用 `ct556479606591`（订单主表）作为判断依据。

### 5.4 客户主表已有、接口没返回的字段（后端回复）

**需要补充的字段：**
- `CompanyTel`（C3_363871601703）：固话
- `Email`（C3_344096054140）：电子邮件
- `Fax`（C3_363871665343）：传真
- `PostCode`（C3_318857585359）：邮编
- `Address`（C3_318857579765）：地址

**字段区别说明：**
- `Address` vs `ContactAddress`：
  - `Address`（C3_318857579765）：客户注册地址/通信地址
  - `ContactAddress`（C3_318857579765）：联系人地址（可能与注册地址不同）
  - **注意**：两个字段在数据库中是**同一个列** `C3_318857579765`，只是别名不同，实际存储的是同一个值

- `ContactPerson` vs `ContactUserName`：
  - `ContactPerson`（C3_363873090062）：联系人姓名
  - `ContactUserName`（C3_341682565281）：联系人用户名（可能是登录账号）
  - 两者不同，`ContactPerson` 是真实姓名，`ContactUserName` 是系统账号

- `ContactUserPhone`（C3_344425630953）：联系人手机号

**开发计划**：在 `GetSigCustomerBasic` 和 `AddOrModifyCustomer` 中补充这些字段，优先级中。

### 5.5 分组名称、分组价格、协议价（后端回复）

#### 1. 分组名称

**表名：** `ct758399425415`（客户分组表）

**字段清单：**
| C3_ 列名 | 别名 | 说明 |
|---|---|---|
| `C3_758399706712` | CustomerType | 分组编号（如 "VIP"、"NORMAL"） |
| `C3_758399712493` | Sort | 排序号 |
| `C3_758399695509` | CompanyCode | 公司编号 |

**现状：**
- 分组表**没有名称字段**，只有编号和排序
- `GetAllCustTypes` 接口只返回 `CustomerType`（编号）和 `Sort`（排序）
- 分组编号本身就是显示名称（如 "VIP"、"普通会员"），不需要额外的名称字段

**结论：** 分组名称就是分组编号本身，无需新增字段。前端直接显示 `CustomerType` 的值即可。

**相关接口：**

##### GetAllCustTypes（获取所有客户分组）

**接口路径：** `POST /api/CustomerMan/GetAllCustTypes`

**请求参数：**
```json
{
  "Token": "xxx"
}
```

**返回字段：**
```json
{
  "Code": "0",
  "Msg": "成功",
  "Data": [
    {
      "CustomerType": "VIP",
      "Sort": 1
    },
    {
      "CustomerType": "普通会员",
      "Sort": 2
    }
  ]
}
```

**说明：** 返回该公司所有客户分组列表，按 `Sort` 排序。

##### AddOrModOrderCustTypes（添加/修改客户分组）

**接口路径：** `POST /api/CustomerMan/AddOrModOrderCustTypes`

**请求参数：**
```json
{
  "Token": "xxx",
  "OrderCustType": "Add",  // Add（新增）、Mod（修改）、Del（删除）
  "list": [
    {
      "CustomerType": "VIP",
      "Sort": 1
    }
  ]
}
```

**返回字段：**
```json
{
  "Code": "0",
  "Msg": "成功",
  "Data": true
}
```

#### 2. 分组价格（价格表）

**表名：** `ct315248337421`（价格表主表）

**字段清单：**
| C3_ 列名 | 别名 | 说明 |
|---|---|---|
| `C3_315248441156` | PriceTable | 价格表编号 |
| `C3_315248368734` | PriceName | 价格表名称 |
| `C3_579630274308` | CompanyCode | 公司编号 |
| `C3_601380801328` | IsDefault | 是否默认价格表（'Y' = 是） |

**价格表明细表：** `ct317685184859`
- 存储价格表的具体价格项（纸张、颜色、单双面、克重等维度的单价）

**前端页面：** `#/price/order`（价格配置页面）

**说明：** 分组价格就是价格表。客户所在分组决定使用哪个价格表，但实际存储是客户直接关联价格表编号（`PriceTable` 字段），不是通过分组间接关联。

**相关接口：**

##### GetPriceTbDetails（获取价格表明细列表）

**接口路径：** `POST /api/PriceTable/GetPriceTbDetails`

**请求参数：**
```json
{
  "Token": "xxx",
  "PriceTable": "PT001",  // 价格表编号，为空则取默认价格表
  "PageIndex": 1,
  "PageLimit": 20,
  "Color": "彩色",        // 可选筛选
  "SigOrDbl": "单面",     // 可选筛选
  "MatericalCode": "xxx", // 可选筛选
  "MachineSize": "A4",    // 可选筛选
  "WeightRangeBot": 80    // 可选筛选
}
```

**返回字段：**
```json
{
  "Code": "0",
  "Msg": "成功",
  "Data": {
    "PageIndex": 1,
    "PageLimit": 20,
    "Count": 100,
    "children": [
      {
        "Id": "123456",
        "PriceTable": "PT001",
        "PriceTableName": "标准价格表",
        "MachineName": "印刷机1",
        "MacSizeNickName": "A4",
        "PaperCateCode": "P001",
        "PaperCateName": "铜版纸",
        "SigOrDbl": "单面",
        "Color": "彩色",
        "WeightBot": 80,
        "WeightTop": 100,
        "ModulusNumBot": 1,
        "ModulusNumTop": 10,
        "PriceModel": "按张",
        "UnitPrice": "0.50",
        "NumBotLimit": 1,
        "NumTopLimit": 100,
        "CaclBySize": "N"
      }
    ]
  }
}
```

##### AddPriceTbDetails（添加价格表明细）

**接口路径：** `POST /api/PriceTable/AddPriceTbDetails`

**请求参数：**
```json
{
  "Token": "xxx",
  "PriceTable": "PT001",
  "PriceTableName": "标准价格表",
  "items": [
    {
      "MachineName": "印刷机1",
      "MacSizeNickName": "A4",
      "PaperCateCode": "P001",
      "PaperCateName": "铜版纸",
      "SigOrDbl": "单面",
      "Color": "彩色",
      "WeightBot": 80,
      "WeightTop": 100,
      "ModulusNumBot": 1,
      "ModulusNumTop": 10,
      "PriceModel": "按张",
     UnitPrice": "0.50",
      "NumBotLimit": 1,
      "NumTopLimit": 100
    }
  ]
}
```

**返回字段：**
```json
{
  "Code": "0",
  "Msg": "成功",
  "Data": true
}
```

##### ModifyPriceTbDetails（修改价格表明细）

**接口路径：** `POST /api/PriceTable/ModifyPriceTbDetails`

**请求参数：**
```json
{
  "Token": "xxx",
  "PriceTable": "PT001",
  "PriceTableName": "标准价格表",
  "items": [
    {
      "Id": "123456",
      "UnitPrice": "0.60"  // 修改的字段
    }
  ]
}
```

**返回字段：**
```json
{
  "Code": "0",
  "Msg": "成功",
  "Data": true
}
```

##### DelPriceTbDetailsByIds（删除价格表明细）

**接口路径：** `POST /api/PriceTable/DelPriceTbDetailsByIds`

**请求参数：**
```json
{
  "Token": "xxx",
  "PriceTable": "PT001",
  "Ids": ["123456", "123457"]
}
```

**返回字段：**
```json
{
  "Code": "0",
  "Msg": "成功",
  "Data": true
}
```

#### 3. 协议价（客户专属价格）

协议价按业务类型分为三种，存储在不同的表：

**3.1 输出协议价（印刷价格）**

**表名：** `ct582225077929`（客户输出协议价表）

**关键字段：**
| C3_ 列名 | 别名 | 说明 |
|---|---|---|
| `C3_627495790368` | CompanyCode | 公司编号 |
| `C3_582225149326` | ClientCode | 客户编号 |
| `C3_627495847782` | DisposeCode | 处理编号 |
| `C3_582225552023` | SingleSide | 单双面（1=单面，2=双面） |
| `C3_582225671796` | Color | 颜色 |
| `C3_582225868985` | PaperMaterialCode | 纸张材质编号 |
| `C3_648661258159` | OutputUnitPrice | 输出单价 |
| `C3_684865463346` | PriceModel | 价格模式 |

**3.2 装订协议价**

**表名：** `ct512527547714`（客户装订协议价表）

**关键字段：**
| C3_ 列名 | 别名 | 说明 |
|---|---|---|
| `C3_626950770579` | CompanyCode | 公司编号 |
| `C3_512527563097` | ClientCode | 客户编号 |
| `C3_512527584006` | ZdCode | 装订编号 |
| `C3_512527685975` | ZdPropertyCode | 装订属性编号 |
| `C3_512527749216` | ArgeeUnitPrice | 协议单价 |
| `C3_626951096735` | IntervalUpper | 区间上限 |
| `C3_626951117096` | IntervalLower | 区间下限 |

**3.3 印后协议价**

**表名：** `ct512486665345`（客户印后协议价表）

**关键字段：**
| C3_ 列名 | 别名 | 说明 |
|---|---|---|
| `C3_627484563209` | CompanyCode | 公司编号 |
| `C3_512486818926` | ClientCode | 客户编号 |
| `C3_512495703032` | PostPrintCode | 印后编号 |
| `C3_512486832519` | PostPrintProperty | 印后属性 |
| `C3_512486869634` | PostPreeAgreeUnitPrice | 协议单价 |
| `C3_627484616047` | IntervalRangeUpper | 区间上限 |
| `C3_627484626717` | IntervalRangeLower | 区间下限 |

**前端页面：** `#/client` 中的【客户协议价】按钮，点击后显示该客户的协议价配置页面

**相关接口：**

##### GetClientPriceDetails（获取客户输出协议价列表）

**接口路径：** `POST /api/PriceTable/GetClientPriceDetails`

**请求参数：**
```json
{
  "Token": "xxx",
  "ClientCode": "LYCC1001",
  "PageIndex": 1,
  "PageLimit": 20,
  "Color": "彩色",        // 可选筛选
  "SigOrDbl": "单面",     // 可选筛选
  "MatericalCode": "xxx", // 可选筛选
  "MachineSize": "A4",    // 可选筛选
  "WeightRangeBot": 80    // 可选筛选
}
```

**返回字段：**
```json
{
  "Code": "0",
  "Msg": "成功",
  "Data": {
    "PageIndex": 1,
    "PageLimit": 20,
    "Count": 50,
    "children": [
      {
        "Id": "123456",
        "ClientCode": "LYCC1001",
        "MachineName": "印刷机1",
        "MacSizeNickName": "A4",
        "PaperCateCode": "P001",
        "PaperCateName": "铜版纸",
        "SigOrDbl": "单面",
        "Color": "彩色",
        "WeightBot": 80,
        "WeightTop": 100,
        "ModulusNumBot": 1,
        "ModulusNumTop": 10,
        "PriceModel": "按张",
        "UnitPrice": "0.45",
        "NumBotLimit": 1,
        "NumTopLimit": 100,
        "CaclBySize": "N"
      }
    ]
  }
}
```

##### BindingPropertyData（获取装订协议价列表）

**接口路径：** `POST /YpCfgAdmin/YprintCustPrice/BindingPropertyData`

**请求参数：**
```json
{
  "EnbindCode": "加密后的装订编号",
  "EnbindProCode": "加密后的装订属性编号",
  "EnClientCode": "加密后的客户编号"
}
```

**返回字段：**
```json
{
  "code": 0,
  "data": [
    {
      "Recid": "123456",
      "ZdPropertyCode": "加密后的属性编号",
      "IntervalUpper": "100",
      "IntervalLower": "1",
      "ArgeeUnitPrice": "0.50",
      "Sort": 1,
      "PriceType": "按张"
    }
  ],
  "count": 1,
  "bindProCode": "加密后的属性编号"
}
```

##### AddBindArgeePrice（添加装订协议价）

**接口路径：** `POST /YpCfgAdmin/YprintCustPrice/AddBindArgeePrice`

**请求参数：**
```json
{
  "clientCode": "加密后的客户编号",
  "zdCode": "加密后的装订编号",
  "proPertyCode": "加密后的装订属性编号"
}
```

**返回字段：**
```json
{
  "result": true
}
```

##### EditBindArgeePrice（修改装订协议价）

**接口路径：** `POST /YpCfgAdmin/YprintCustPrice/EditBindArgeePrice`

**请求参数：**
```json
{
  "EnRecID": "加密后的记录ID",
  "sort": "1",
  "intervalUpper": "100",
  "intervalLower": "1",
  "argeeUnitPrice": "0.50",
  "priceType": "按张"
}
```

**返回字段：**
```json
{
  "result": true
}
```

##### delBindArgeePrice（删除装订协议价）

**接口路径：** `POST /YpCfgAdmin/YprintCustPrice/delBindArgeePrice`

**请求参数：**
```json
{
  "EnRecID": "加密后的记录ID"
}
```

**返回字段：**
```json
{
  "result": true
}
```

##### 印后协议价接口

##### PostPressPropertyData（获取印后协议价列表）

**接口路径：** `POST /YpCfgAdmin/YprintCustPrice/PostPressPropertyData`

**请求参数：**
```json
{
  "postPreeCode": "印后编号",
  "postPreePropCode": "印后属性编号",
  "ClientCode": "加密后的客户编号",
  "postPreePropInterRecID": "加密后的区间记录ID"
}
```

**返回字段：**
```json
{
  "code": 0,
  "data": [
    {
      "REC_ID": "123456",
      "EnREC_ID": "加密后的记录ID",
      "CommpayCode": "公司编号",
      "ClientCode": "客户编号",
      "PostPrintCode": "印后编号",
      "PostPrintProperty": "印后属性",
      "IntervalRangeUpper": "100",
      "IntervalRangeLower": "1",
      "PostPreeAgreeUnitPrice": "0.50",
      "Sort": 1,
      "PriceType": "按张"
    }
  ],
  "count": 1,
  "postPreePropInterRecID": "加密后的区间记录ID"
}
```

##### AddPostPreeArgeePrice（添加印后协议价）

**接口路径：** `POST /YpCfgAdmin/YprintCustPrice/AddPostPreeArgeePrice`

**请求参数：**
```json
{
  "clientCode": "加密后的客户编号",
  "postPreeCode": "印后编号",
  "postPreePropCode": "印后属性编号",
  "IntervalRangeUpper": "100",
  "IntervalRangeLower": "1",
  "postPreePropIntervalRecID": "加密后的区间记录ID"
}
```

**返回字段：**
```json
{
  "result": true
}
```

##### EditPostPreeArgeePrice（修改印后协议价）

**接口路径：** `POST /YpCfgAdmin/YprintCustPrice/EditPostPreeArgeePrice`

**请求参数：**
```json
{
  "EnRecID": "加密后的记录ID",
  "sort": "1",
  "IntervalRangeUpper": "100",
  "IntervalRangeLower": "1",
  "PostPreeAgreeUnitPrice": "0.50",
  "priceType": "按张"
}
```

**返回字段：**
```json
{
  "result": true
}
```

##### delPostPreeArgeePrice（删除印后协议价）

**接口路径：** `POST /YpCfgAdmin/YprintCustPrice/delPostPreeArgeePrice`

**请求参数：**
```json
{
  "EnRecID": "加密后的记录ID"
}
```

**返回字段：**
```json
{
  "result": true
}
```

##### 输出协议价接口

##### OutputAgreePriceData（获取输出协议价数据）

**接口路径：** `POST /YpCfgAdmin/YprintCustPrice/OutputAgreePriceData`

**请求参数：**
```json
{
  "enClientCode": "加密后的客户编号",
  "page": 1,
  "limit": 20,
  "equipmentType": "设备类型",      // 可选筛选
  "paperMaterial": "纸张材质",      // 可选筛选
  "color": "彩色",                  // 可选筛选
  "dblOrSigVal": "单面",            // 可选筛选
  "weightMin": "80",                // 可选筛选
  "kaiShuMin": "1"                  // 可选筛选
}
```

**返回字段：**
```json
{
  "code": 0,
  "data": [
    {
      "Rec_ID": "123456",
      "DisposeCode": "处理编号",
      "SingleSide": "单面",
      "EquipmentType": "设备类型",
      "PrintSingleSide": "单面",
      "Color": "彩色",
      "PaperMaterialCode": "纸张材质编号",
      "GweightFloor": 80,
      "GweightUpper": 100,
      "OpenNumFloor": 1,
      "OpenNumUpper": 10,
      "SizeName": "A4",
      "IsMeasurePrice": "N",
      "SetLower": 1,
      "SetUpper": 100,
      "OutputUnitPrice": "0.45",
      "PriceModel": "按张",
      "BtnAmt": 0
    }
  ],
  "count": 50
}
```

##### AddClientPriceTbDetails（添加客户输出协议价）

**接口路径：** `POST /api/PriceTable/AddClientPriceTbDetails`

**请求参数：**
```json
{
  "Token": "xxx",
  "ClientCode": "LYCC1001",
  "items": [
    {
      "MachineName": "印刷机1",
      "MacSizeNickName": "A4",
      "PaperCateCode": "P001",
      "PaperCateName": "铜版纸",
      "SigOrDbl": "单面",
      "Color": "彩色",
      "WeightBot": 80,
      "WeightTop": 100,
      "ModulusNumBot": 1,
      "ModulusNumTop": 10,
      "PriceModel": "按张",
      "UnitPrice": "0.45",
      "NumBotLimit": 1,
      "NumTopLimit": 100
    }
  ]
}
```

**返回字段：**
```json
{
  "Code": "0",
  "Msg": "成功",
  "Data": true
}
```

##### ModifyClientPriceTbDetails（修改客户输出协议价）

**接口路径：** `POST /api/PriceTable/ModifyClientPriceTbDetails`

**请求参数：**
```json
{
  "Token": "xxx",
  "ClientCode": "LYCC1001",
  "items": [
    {
      "Id": "123456",
      "UnitPrice": "0.50"
    }
  ]
}
```

**返回字段：**
```json
{
  "Code": "0",
  "Msg": "成功",
  "Data": true
}
```

##### DelClientPriceTbDetailsByIds（删除客户输出协议价）

**接口路径：** `POST /api/PriceTable/DelClientPriceTbDetailsByIds`

**请求参数：**
```json
{
  "Token": "xxx",
  "ClientCode": "LYCC1001",
  "Ids": ["123456", "123457"]
}
```

**返回字段：**
```json
{
  "Code": "0",
  "Msg": "成功",
  "Data": true
}
```

#### 4. 开单取价接口

**现状：**
- 当前**没有**统一的按「协议价 > 分组价格 > 基础价格表」返回单价的接口
- 开单时，前端需要根据业务类型（印刷、装订、印后）分别查询对应的协议价表
- 如果没有协议价，再查询价格表（基础价格）

**建议新增接口：**

**接口名称：** `GetCustomerPrice`

**请求参数：**
```json
{
  "ClientCode": "LYCC1001",
  "BusinessType": "Print",  // Print（印刷）、Binding（装订）、PostPrint（印后）
  "ItemCode": "xxx",        // 项目编号（根据业务类型不同，含义不同）
  "Specifications": {       // 规格参数（纸张、颜色、单双面等）
    "PaperCode": "xxx",
    "Color": "彩色",
    "SingleSide": "单面"
  }
}
```

**返回字段：**
```json
{
  "UnitPrice": 0.50,
  "PriceSource": "Agreement",  // Agreement（协议价）、PriceTable（价格表）
  "PriceTableCode": "PT001",
  "Remark": "客户协议价"
}
```

**取价逻辑：**
1. 根据 `BusinessType` 查询对应的协议价表
2. 如果找到匹配的协议价，返回协议价
3. 如果没有协议价，查询客户关联的价格表（`PriceTable` 字段）
4. 返回价格表中的对应单价

**优先级：** 高，开单定价依赖此功能。

#### 5. 总结

| 概念 | 说明 | 存储位置 | 前端页面 |
|---|---|---|---|
| 分组名称 | 就是分组编号本身 | `ct758399425415.C3_758399706712` | 客户资料页面 |
| 分组价格 | 就是价格表 | `ct315248337421`（主表）、`ct317685184859`（明细） | `#/price/order` |
| 协议价 | 客户专属价格 | `ct582225077929`（输出）、`ct512527547714`（装订）、`ct512486665345`（印后） | `#/client` 中的【客户协议价】 |

**开单价优先级：** 协议价 > 价格表（分组价格）

### 5.6 开票信息读写接口（后端回复）

1. **新增/修改接口**：
   - 当前只有 `GetInvoiceHeader`（查询）和 `ModBipCustomerInfo`（只改用友字段）
   - **缺少**开票抬头、税号、开户银行、银行账号、发票类型的新增/修改接口
   - 需要新增接口或扩展现有接口

2. **InvoiceAddress 别名问题**：
   - `C3_507551356287` 别名是 `InvoiceAddress`，但实际存储的是**银行账号**
   - **别名起错了**，应该改为 `BankAccount` 或 `InvoiceBankAccount`
   - 建议：保持字段不变，修正别名和文档说明

3. **注册地址、注册电话**：
   - 当前开票信息表 `ct342194900968` **没有**注册地址、注册电话字段
   - 开增值税专票需要这些信息，需要新增字段：
     - `C3_507551356xxx`：注册地址（RegisteredAddress）
     - `C3_507551356xxx`：注册电话（RegisteredPhone）

### 5.7 返回数据类型（后端回复）

1. **示例来源**：
   - 第二轮的示例是**手写的**，不是从接口真实抓取
   - 真实返回需要实际调用接口获取

2. **后端返回类型约定**：
   - **数字**：金额、数量等返回字符串（如 `"3000.00"`），前端需要 `parseFloat()` 转换
   - **布尔**：返回字符串 `"true"`/`"false"` 或数字 `0`/`1`（不一致）
   - **日期**：返回字符串 `"yyyy-MM-dd HH:mm:ss"` 格式
   - **空值**：返回 `null` 或空字符串 `""`（取决于字段类型）

**问题**：类型不统一，建议后端统一约定：
- 数字：返回数字类型（`3000.00`），不是字符串
- 布尔：返回布尔类型（`true`/`false`）
- 日期：保持字符串格式
- 空值：统一返回 `null`

### 5.8 客户列表带出欠款（后端回复）

**评估结果**：

**首选方案（列表接口汇总欠款）可行**，理由：
- 订单表 `ct556479606591` 在 `C3_556479754869`（ClientCode）上应该有索引
- 使用 `GROUP BY ClientCode` 汇总，一次查询搞定，性能可接受
- 与 `TotalAmtAndPeriod` 口径一致，无需维护额外数据

**实现建议**：
```sql
-- 在 QueryClientsInfos 的 SQL 中 LEFT JOIN 欠款汇总
LEFT JOIN (
    SELECT C3_556479754869 AS ClientCode,
           SUM(CONVERT(numeric(15,2), C3_556479818689)) AS DebtAmt,
           DATEDIFF(day, MIN(C3_556480132234), GETDATE()) AS DebtDays
    FROM ct556479606591
    WHERE C3_565176230693 = @companyCode
      AND C3_556480145150 = '挂账'
      AND (C3_659185409750 <> 'Y' OR C3_659185409750 IS NULL)
    GROUP BY C3_556479754869
) debt ON t3.ClientCode = debt.ClientCode
```

**返回字段**：
- `DebtAmt`：当前欠款金额
- `DebtDays`：最早欠款天数

**筛选参数**：
- `HasDebt`：`"Y"` 只看有欠款，`"N"` 只看无欠款，空值看全部

**排序**：
- 支持按 `DebtAmt` 降序排列（欠款最多的在前）

**备选方案（存储字段）**：
- 如果订单量超过 100 万条，汇总查询可能变慢
- 此时再考虑在客户表新增 `C3_319816521956`（DebtAmt）字段
- 但必须保证所有改动应收的操作都在同一事务里更新此字段
- 加定时对账任务校正

**建议**：先实施首选方案，监控性能，必要时再改为备选方案。

## 6. 第四轮：业务决定、整改要求与专业意见（2026-10-23）

6.1、6.2 是业务方的决定，请按此整改；6.3 需要一起研究；6.4 是 Lite 侧对 5.3–5.7 回复的意见和理由。

### 6.1 欠款与应收：按标准财务体系整改（业务方决定）

5.2 的结论是现有欠款算法与业务口径不一致（订单全额计入、部分收款和部分核销不扣、退款不冲减、作废可能计入、红冲可能重复）。业务方决定：**按标准财务体系处理，请老系统修改逻辑，增加必要字段**。要求如下。

**1. 欠款以应收账款明细为准，不再按订单状态估算。**

每一笔影响应收的业务都要留下一条应收明细（借：增加应收，贷：减少应收），客户欠款 = 该客户应收明细的余额。

| 业务 | 对应收的影响 |
|---|---|
| 开单 / 订单确认 | 增加应收（订单应收金额） |
| 收款 | 减少应收（实收金额，可部分） |
| 核销 | 减少应收（核销金额，可部分） |
| 预存抵扣 | 减少应收（抵扣金额） |
| 退款 | 增加应收或冲回原收款（按退款对应的原单据） |
| 作废 | 冲回该订单产生的全部应收 |
| 红冲 | 生成一条金额相反的冲销记录，指向被冲的原记录，原记录不删除 |

请先确认：老系统是否已经有应收或核销的流水表？（完整版有「应收汇总」「销账记录」「客户结余」等页面。）如果有，以现有表为基础补齐；没有再新建。

**2. 订单上需要有可追溯的金额字段。**

建议每张订单维护：应收金额、已收金额、已核销金额、已抵扣金额、未清余额（= 应收 − 已收 − 已核销 − 已抵扣 ± 退款）。这些字段和应收明细必须在**同一个事务**里更新。

**3. 欠款天数按未清余额算。**

`DebtDays`（最早欠款天数）应取「未清余额 > 0 的订单中最早的订单日期」到今天的天数，而不是所有挂账订单的最早日期。已部分收款但未结清的订单仍计入；已结清的不计入。

**4. 只有一处定义。**

欠款金额和欠款天数做成**一个**数据库视图或函数，`TotalAmtAndPeriod`、`checkClientZhangDayAndAmt`、删除客户检查、客户列表的 `DebtAmt` / `DebtDays`（5.8）全部调用它，不能各写一套 SQL。5.8 给出的列表 SQL 沿用了旧的错误逻辑，请等新口径完成后一起改。

**5. 切换前先对账。**

上线新算法前，请用新旧两套逻辑把所有客户的欠款各算一遍，列出差异清单（客户、旧值、新值、差异原因）给业务方确认后再切换。这会直接改变线上看到的欠款数字，不能静默切换。

**6. 请先给方案再动手。**

请把表结构变更（新增表 / 字段的 `C3_` 列名和别名）、历史数据如何补齐期初余额、上线步骤和回退方案写进本文件，确认后再开发。

### 6.2 价格表体系（业务方决定）

业务方说明：**分组价格就是价格表**，5.5 的回复没有错。规则如下：

- 所有价格表结构完全相同。
- 其中**一张是标准价格表**（底层标准价格），**必须存在、不得删除**，一般就是第一张价格表（`IsDefault = 'Y'`）。
- 其他价格表都是**分组价格表**，通常是标准价格表的副本，可以删除。它们和标准价格表的区别只是应用的范围和对象不同。
- 开单取价：**协议价 > 客户所用的分组价格表 > 标准价格表**。

请据此确认或整改：

1. **标准价格表保护**：后端是否保证有且只有一张 `IsDefault = 'Y'` 的价格表，并拒绝删除它？没有的话请加上校验，并返回明确的 `RespMsg`。
2. **复制价格表**：有没有「从标准价格表复制出一张新价格表」的接口？没有请评估新增。
3. **删除分组价格表**：还有客户在用这张价格表时，删除会怎样？建议：有客户引用时拒绝删除，并提示有多少客户在用；或者删除时把这些客户统一改回标准价格表。请说明现状并选一种。
4. **逐项回落**：客户的分组价格表里**没有**某个价格项时，是否回落到标准价格表的同一价格项？业务上应该回落，请确认现有实现。
5. **客户未指定价格表**：`PriceTable` 为空时是否直接用标准价格表？
6. 5.5 建议的统一取价接口 `GetCustomerPrice` 同意新增，取价链按上面的顺序实现，并在返回里注明价格来源（协议价 / 分组价格表 / 标准价格表）。

### 6.3 两套计价体系（需要一起研究）

5.5 给出的是印刷输出的多维矩阵价（设备、尺寸、纸张、颜色、单双面、克重、开数、数量阶梯），协议价分输出、装订、印后三张表。但完整版 Vue 开单（`src/views/frontdesk/newOrder.vue`）和经营项目设置（`src/views/system/bizItems.vue`）用的是 `SimpleErp` 的**经营项目**：主项 / 子项，按 `SalePrice` 单价、`TierLow` / `TierHigh` 阶梯、`PriceMode` 计价。Lite 的开单也是这种简单模型。

能否兼容还是需要独立，要先弄清楚两套的关系。请说明：

1. `SimpleErp` 经营项目存在哪些表，字段清单（含 `C3_` 列名和别名）。
2. 哪些业务用经营项目开单，哪些用价格表矩阵开单？订单明细里怎么区分一行用的是哪套？
3. 经营项目有没有对应的**分组价格**和**协议价**？如果有，存在哪里；如果没有，现在门店怎么给老客户优惠？
4. 两套之间有没有关联（比如经营项目的单价是否从价格表取）？
5. 开单计算金额的后端代码在哪里，两套各自怎么算？

### 6.4 对 5.3–5.7 回复的意见

#### 5.3 两张订单表、删除检查

**意见：** `ct563276270738` 是什么，请查表结构和代码里的实际用途后确认，不要用「可能是」。删除检查请按下面的思路重做：

- 把所有引用客户编号的表分成两类：
  - **业务和财务记录**（订单、收款单、预存卡、应收明细、核销记录、优惠券使用记录等）：只要有一条，就**拒绝删除**；
  - **客户自己的附属资料**（联络人、开票信息、协议价）：在同一个事务里随客户一起删除。
- 散户 `000000`（或你们系统里对应的默认客户）不允许删除。
- 有过业务往来的客户，建议提供**停用**而不是删除：停用后不能再开单，但历史记录照常可查。

**理由：** 财务记录引用的客户被删掉后，对账、审计、报表都会出现找不到客户的孤立数据。只检查一张表必然有遗漏，按「拒绝 / 级联」两类梳理一遍才能保证完整。

#### 5.4 地址与联系人字段

**意见：**

- `Address` 和 `ContactAddress` 是同一列 `C3_318857579765`，两个别名都**保留**（现有调用方可能在用），文档里注明是同义字段。Lite 统一使用 `ContactAddress`，因为它已经在详情和保存接口里。保存接口如果同时收到两个，请定一个以谁为准。
- `ContactUserName` 说是「系统账号」，但客户表里已经有登录用户名 `LogUserName`。请说明这两个的区别；如果其实是同一个意思，请在文档里写清楚哪个是真正在用的。
- 补字段时，新增字段要**同时**加进详情接口、保存接口，以及（需要的话）列表接口，避免只能读不能写。

**理由：** 同一个值有两个名字、同一个意思有两个字段，是后续出错的主要来源；保留旧名保证兼容，在文档里写清楚就能避免误用。

#### 5.5 协议价相关接口

**意见：**

- Lite 只调用 `/api/*` 这一套接口（请求头带 `token`，返回 `{ RespCode, RespMsg, Data }`）。`/YpCfgAdmin/YprintCustPrice/*` 这一套参数是加密后的编号、返回格式也不同，看起来是后台管理端内部使用的，**不建议给 Lite 用**。请为装订协议价、印后协议价提供 `/api/*` 下的等价接口（参数用明文编号，鉴权走 token）。
- 5.5 文档里写的返回格式是 `{ Code, Msg, Data }`，请求体里还带 `Token`，和前端实际使用的不一致（前端读 `RespCode` / `RespMsg`，token 放在请求头）。请以真实抓取的请求和返回为准修正文档。

**理由：** 一套鉴权、一种返回格式，前端只需要一个请求层；在前端做参数加密既不安全（密钥会暴露在前端），也会把后台的实现细节泄露给调用方。

#### 5.6 开票信息

**意见：**

- **不要改别名** `InvoiceAddress`。完整版前端、小程序或其他调用方可能已经在用这个名字，改了会直接导致它们拿不到数据。只在文档里注明「`InvoiceAddress` 实际是银行账号」，Lite 显示为「银行账号」。如果你们的框架支持同一列挂两个别名，可以**新增** `BankAccount` 别名，但旧别名保留。
- 新增开票信息保存接口，建议命名 `AddOrModifyInvoiceHeader`，按 `ClientCode` 新增或更新（一个客户一条）。字段包括开票抬头、税号、开户银行、银行账号、发票类型、注册地址、注册电话。
- 注册地址、注册电话两个新字段，建好后请把**真实的 `C3_` 列名**补进本文件（5.6 里写的是 `C3_507551356xxx` 占位）。
- 请列出 `InvoiceType` 的全部取值（如：增值税普通发票 / 增值税专用发票 / 不开票）。
- 税号建议做基本格式校验（统一社会信用代码为 18 位）。

**理由：** 改别名是破坏性变更，收益只是名字好看，风险是现有调用方静默出错；保存接口按客户唯一记录做新增或更新，前端不需要先判断有没有记录。

#### 5.7 返回数据类型

**意见：**

- **现有接口不要改返回类型。** 把 `"3000.00"` 改成 `3000.00`、把 `"true"` 改成 `true`，完整版前端、小程序以及其他调用方里所有按字符串处理的代码都可能出错。Lite 会在自己的请求层统一转换（金额和数量转数字，`"true"` / `"Y"` / `1` 统一转布尔），后端不需要为 Lite 改现有接口。
- **新接口**按统一约定返回，建议：
  - 金额：保留两位小数的**字符串**（如 `"3000.00"`），避免浮点误差，也和现有接口一致；
  - 数量、天数、排序号：整数；
  - 布尔：`true` / `false`；
  - 日期时间：`"yyyy-MM-dd HH:mm:ss"`，北京时间；
  - 空值：统一返回 `null`，不要有时 `null` 有时 `""`。
- **文档里的示例必须是真实抓取的。** 前两轮的示例是手写的，字段和格式都和实际对不上，Lite 照着写会出错。请对本文件提到的接口（`QueryClientsInfos`、`GetSigCustomerBasic`、`TotalAmtAndPeriod`、`GetAllCustTypes`、`GetInvoiceHeader`、`GetPriceTbDetails`、`GetClientPriceDetails`）各抓一条真实的请求和返回（脱敏）补进来。也可以给 Lite 侧一个测试环境账号，由我们自己抓。

**理由：** 兼容性优先于整洁。类型统一只对新接口立规矩，旧接口由调用方适配，这样不会破坏任何正在运行的系统。
