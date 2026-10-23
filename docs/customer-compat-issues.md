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
| `CustomerType` | 客户分组 | `group`（编号）/ `groupName` | 完整版存分组**名称**、也按名称筛选；Lite 用编号 |
| `RegisterPhone` | 注册手机号 | `phone` | 基本对应 |
| `SalerName` | 销售代表 | `owner`（负责人员） | 待确认，见问题 1 |
| `CardBalance` | 储值卡余额 | `prestoreBalance` | 待确认，见问题 2 |
| `AccountPeriod` / `AccountAmt` | 账期 / 账额 | `settleType`（现结/记账/月结）、`creditLimit` | 建模不同，见问题 3 |
| `DepName` | 门店名称 | 无 | Lite 暂无多门店 |
| `PriceTableName` | 价格表 | 无（Lite 用分组折扣 + 协议价） | 见问题 5 |
| `LastOrderTime` / `OrderCostAmt` / `CouponsNum` | 最后下单 / 总消费 / 优惠券数 | 无 | 后端统计字段，Lite 直接显示 |
| `CreateTime` / `Creator` / `UpdateTime` / `Updater` | 创建、更新时间与人 | 仅 `created`（建交日期） | 待确认 `created` 是否就是 `CreateTime` |
| `Debt`（详情接口） | 欠款 | `debt` | 对应；列表接口里没有 |
| `PrestoreBalance`、`TotalSettlement`（详情接口） | 预存余额、累计结算 | `prestoreBalance` | 见问题 2 |

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
   回答：后端没有独立的结算方式字段。使用两个字段组合表示：
   - `AccountPeriod`（C3_314456853250）：账期天数，0 表示现结，>0 表示记账
   - `AccountAmt`（C3_314456863421）：账额/信用额度
   Lite 的 `settleType`（现结/记账/月结）需要根据 `AccountPeriod` 的值来推导显示。

5. **`GetSigCustomerBasic` 的完整返回字段**：请给一条真实返回（脱敏即可）或接口文档。上面那批 Lite 扩展字段能保留多少取决于这个。
   回答：详情接口返回字段如下：
   - 基础信息：`Id`, `DepName`, `DepCode`, `ClientCode`, `ClientName`, `LogUserName`, `LogPassword`, `RegisterPhone`, `ContactPerson`, `SalerName`, `AccountPeriod`, `AccountAmt`
   - 价格相关：`PriceTableName`, `PriceTable`, `CustomerType`
   - 地址相关：`ContactAddress`, `ContactUserName`, `ContactUserPhone`, `IsClientShopAddress`
   - 统计字段：`LastOrderTime`, `OrderCostAmt`, `CouponsNum`, `CardBalance`
   - 审计字段：`Creator`, `CreateTime`, `Updater`, `UpdateTime`
   - 其他：`NotAllOldVerLogin`
   
   Lite 扩展字段对照：简称、固话、QQ、微信、传真、电子邮件、邮编、网址、地址（ContactAddress 有）、城市商圈、取送距离、客户来源、所属行业、机构性质、规模、价值评估、关系等级、信誉等级、无委托提醒天数、开票抬头、税号、开户银行、最近对账日期、说明备注、说明简介 —— 这些字段后端目前**没有**，需要新增数据库列。

6. **价格表**：`PriceTableName` 对应的价格表和「客户分组」是什么关系？客户开单价是怎么取的（价格表 / 分组 / 协议价的优先级）？
   回答：
   - `PriceTable`（C3_334927333156）：价格表编号
   - `PriceTableName`（C3_328976593456）：价格表名称
   - `CustomerType`（C3_758400058259）：客户分组编号
   - 三者是独立字段，客户同时有价格表和分组
   - 开单价优先级：需要确认后端定价逻辑，但从字段设计看，应该是 **价格表 > 分组折扣 > 协议价**

7. **`GetAllCustTypes` 返回字段**：前端写的是 `g.Code || g.code`、`g.Name || g.name`，实际是哪种大小写？`CustomerType` 筛选传名称还是编号？
   回答：
   - 后端返回字段：`CustomerType`（分组名称，不是编号）、`Sort`（排序号）
   - 数据库字段 `C3_758399706712` 别名就是 `CustomerType`，存储的是分组**名称**
   - 前端应该用 `g.CustomerType` 获取名称
   - 筛选时 `CustomerType` 参数传的是分组**名称**（如 "VIP客户"），不是编号
   - 注意：后端没有返回 `Code` 字段，只有 `CustomerType`（名称）和 `Sort`（排序）

8. **`QueryClientsInfos` 的筛选参数**：目前前端传 `ClientName`、`ClientCode`、`SalerName`、`CustomerType`、`RegisterPhone`。Lite 原来是一个关键字框同时搜编号、名称、电话、联系人、地址，后端能否加一个关键字参数（比如 `Keyword`）？是否支持排序参数？
   回答：
   - 当前支持的筛选参数：`ClientCode`, `ClientName`, `SalerName`, `CustomerType`, `PriceTable`, `ExInPriceTable`, `RegisterPhone`, `DepCode`, `PageIndex`, `PageLimit`
   - **不支持** `Keyword` 关键字搜索，需要后端新增
   - **不支持** 排序参数，当前固定按 `C3_509327544331`（创建时间）降序排列
   - 建议：后端新增 `Keyword` 参数，同时搜索编号、名称、电话、联系人、地址；新增 `OrderBy` 和 `OrderDirection` 参数支持排序

9. **删除客户 `DelCustomer`**：后端是否会拦截「已有工单 / 结算 / 预存卡记录」或「有欠款」的客户？Lite 原设计是这类客户不能删、只能合并，需要后端给出明确的 `RespMsg`。散户 `000000` 是否也是系统默认客户、不可删除？
   回答：
   - 后端**会拦截**已有订单的客户：检查 `ct563276270738`（订单表）是否有该客户记录，如果有则返回错误 "客户已创建订单,不能删除"
   - 后端**不检查**结算记录、预存卡记录、欠款等情况
   - 后端**没有**针对散户 `000000` 的特殊保护逻辑
   - 建议：后端增加检查逻辑 —— 有欠款（`AccountAmt > 0`）、有预存余额（`CardBalance > 0`）、有未结算工单的客户不允许删除，返回明确的错误提示

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
      - `CustomerType`（客户分组名称）
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
