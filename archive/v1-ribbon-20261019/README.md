# LiteERP Web 原型

旧版 Windows「印特图文快印管理」的 Web 静态页面版本（界面原型，红色主题）。

- `web/` 静态原型：双击 `web/index.html` 即可在浏览器中打开（推荐 Chrome / Edge）。
- `web/DEV-GUIDE.md`：原型代码结构与组件说明。
- `docs/技术方案建议.md`：正式开发的技术选型、架构与迁移建议。
- `sample/`：旧版截图。
- `tools/shot.sh`：用无头 Chrome 给某个页面截图，例如 `tools/shot.sh 'orderDetail?no=GD26082210047' out.png`。

## 在 Ubuntu 上部署（Nginx）

```bash
sudo apt install -y nginx
sudo mkdir -p /var/www/liteerp && sudo cp -r web/* /var/www/liteerp/
sudo tee /etc/nginx/sites-available/liteerp >/dev/null <<'EOF'
server {
    listen 80;
    server_name _;
    root /var/www/liteerp;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
}
EOF
sudo ln -sf /etc/nginx/sites-available/liteerp /etc/nginx/sites-enabled/liteerp
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

直接打开某个功能：`http://服务器/#custManage`、`http://服务器/#newOrder`。
