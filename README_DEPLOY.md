# 王者荣耀策划联赛竞猜系统 — 云端部署指南

## 一、腾讯云 Lighthouse（轻量应用服务器）部署

### 1. 购买服务器

推荐配置：
- **系统镜像**：Ubuntu 22.04 / Debian 12 / CentOS 7+
- **配置**：2 核 2G 起步即可（80 人使用绰绰有余）
- **带宽**：3~5 Mbps
- **地域**：选择离选手最近的区域

### 2. 服务器环境准备

SSH 登录服务器后执行：

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y   # Ubuntu/Debian
# 或 yum update -y                        # CentOS

# 安装 Node.js (v18+)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs               # Ubuntu/Debian

# 验证安装
node -v   # 应显示 v20.x.x
npm -v
```

### 3. 上传项目文件

**方式 A — 使用 SCP 直接上传**（在你本地 Windows 终端执行）：

```bash
# 将整个项目文件夹上传到服务器的 /opt 目录
scp -r C:\Users\pengxwen\Desktop\竞猜 root@你的服务器IP:/opt/quiz
```

**方式 B — 使用 Git**（如果项目在 Git 仓库中）：

```bash
# 在服务器上
cd /opt
git clone 你的仓库地址 quiz
cd quiz
```

**方式 C — 使用 SFTP 工具**（如 WinSCP、FileZilla）

### 4. 安装依赖并启动

```bash
cd /opt/quiz

# 安装依赖
npm install --production

# 启动服务
node server.js
```

看到以下输出说明启动成功：

```
  🏆 王者荣耀策划联赛竞猜 - 已启动
  📍 http://localhost:3000
  👤 管理员: admin / admin123
  👥 选手: 英文名 / 000000
```

浏览器访问 `http://你的服务器IP:3000` 即可使用。

### 5. 设置为后台运行 + 开机自启

#### 方式一：使用 PM2（推荐）

```bash
# 安装 PM2
npm install -g pm2

# 用 PM2 启动
pm2 start server.js --name "quiz"

# 设为开机自启
pm2 startup
pm2 save
```

常用 PM2 命令：
```bash
pm2 list              # 查看所有进程
pm2 logs quiz         # 查看日志
pm2 restart quiz      # 重启
pm2 stop quiz         # 停止
pm2 delete quiz       # 删除进程
```

#### 方式二：使用 systemd 服务

创建 service 文件：

```bash
sudo nano /etc/systemd/system/quiz.service
```

写入以下内容：

```ini
[Unit]
Description=Quiz Betting System
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/quiz
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

然后启用：

```bash
sudo systemctl daemon-reload
sudo systemctl enable quiz    # 开机自启
sudo systemctl start quiz     # 启动
sudo systemctl status quiz    # 查看状态
journalctl -u quiz -f        # 查看日志
```

## 二、安全组 / 防火墙设置

在腾讯云控制台 → **安全组规则** 中放行端口：

| 协议 | 端口 | 来源 |
|------|------|------|
| TCP | **3000** | **0.0.0.0/0**（所有人可访问） |
| TCP | **22** | 你的 IP（SSH 管理，不要开 0.0.0.0） |

服务器内部防火墙（如有）：
```bash
# Ubuntu UFW 放行 3000 端口
sudo ufw allow 3000/tcp

# CentOS firewalld
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

## 三、可选优化

### 1. 绑定域名（推荐）

1. 在域名解析商添加 A 记录指向服务器 IP
2. 安装 Nginx 反向代理：

```bash
sudo apt install nginx -y
sudo nano /etc/nginx/sites-available/quiz
```

Nginx 配置：

```nginx
server {
    listen 80;
    server_name your-domain.com;   # 换成你的域名

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/quiz /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 2. 配置 HTTPS（Let's Encrypt 免费证书）

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

自动续期已默认开启。

## 四、数据库备份

SQLite 数据库是单个文件，备份非常简单：

```bash
# 手动备份
cp /opt/quiz/oracle.db /opt/quiz/oracle.db.bak.$(date +%Y%m%d)

# 定时自动备份（每天凌晨 3 点）
crontab -e
# 添加一行：
0 3 * * * cp /opt/quiz/oracle.db /opt/quiz/backups/oracle.db.$(date +\%Y\%m\%d)

# 创建备份目录
mkdir -p /opt/quiz/backups
```

## 五、常见问题

### Q：端口被占用？
```bash
lsof -i :3000   # 查看占用进程
kill -9 <PID>   # 结束进程
```

### Q：better-sqlite3 编译失败？
```bash
# 确保安装了编译工具
sudo apt install build-essential python3 -y   # Ubuntu/Debian
# 或 yum groupinstall "Development Tools" -y    # CentOS

# 重新安装依赖
rm -rf node_modules
npm install --build-from-source
```

### Q：如何更新代码？

```bash
cd /opt/quiz
git pull          # 如果用 Git
# 或者重新上传文件

# 重启服务
pm2 restart quiz
# 或 sudo systemctl restart quiz
```

## 六、部署检查清单

- [ ] 购买云服务器，获取 IP 地址
- [ ] 安装 Node.js v18+
- [ ] 上传项目文件到 `/opt/quiz`
- [ ] 执行 `npm install`
- [ ] 执行 `node server.js` 测试能否正常启动
- [ ] 安全组开放 3000 端口
- [ ] 浏览器访问 `http://IP:3000` 能否打开
- [ ] 配置 PM2/systemd 实现后台运行和开机自启
- [ ] （可选）绑定域名 + Nginx 反向代理 + HTTPS
- [ ] （可选）设置定时数据库备份
