# LiteERP v2 — APB 接入样式原型

按 `design_handoff_apb_liteerp/`（APB 样式交付包 v1.0）实现的 LiteERP 内容模块静态原型：深色顶栏、暖灰工作台、红色主操作、白色台账；ERP 只绘制内容区。

- 打开 `index.html`：带模拟 APB 外壳的预览（顶栏、侧栏仅为预览）。
- 打开 `index.html?mode=embedded`：只显示 ERP 内容区，即接入 APB 后的样子。
- 打开 `index.html?demo=fail`：演示列表“读取失败”状态。
- 直接打开某页：`index.html#/custManage`、`index.html#/orderDetail?no=GD26082210047`。

数据为内存模拟数据，刷新即还原；不连接门店、不打印、不收费。

## 文档

- `docs/使用手册.md`：**使用手册**（门店人员看：打开方式、通用操作、各模块用法、常见问题）
- `DEV-GUIDE.md`：代码结构、组件、必须遵守的样式与交互规则
- `docs/技术方案建议.md`：正式开发的技术选型与接入要点
- 测试：`tools/smoke.sh`（全部页面）、`tools/e2e.sh`（核心流程交互）、`tools/shot.sh`（截图）

## 在 Ubuntu 上预览部署（Nginx）

```bash
sudo apt install -y nginx
sudo mkdir -p /var/www/liteerp-v2 && sudo cp -r index.html assets host-preview js /var/www/liteerp-v2/
sudo tee /etc/nginx/sites-available/liteerp-v2 >/dev/null <<'EOF'
server {
    listen 80;
    server_name _;
    root /var/www/liteerp-v2;
    index index.html;
}
EOF
sudo ln -sf /etc/nginx/sites-available/liteerp-v2 /etc/nginx/sites-enabled/liteerp-v2
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

正式接入 APB 时：只部署 `assets/`（tokens.css、apb-erp.css、liteerp.css）和 ERP 脚本到宿主约定的静态路径，内容挂到 `<main data-apb-erp>`；不加载 `host-preview/`。
