# Railway 部署指南

## 一、准备工作

1. 注册 Railway 账号: https://railway.app
2. 安装 Railway CLI (可选):
   ```bash
   npm install -g @railway/cli
   railway login
   ```

## 二、部署步骤

### 方法 1: 通过 Railway 网站 (推荐)

1. 登录 https://railway.app/dashboard
2. 点击 **"New Project"**
3. 选择 **"Deploy from GitHub repo"**
4. 连接你的 GitHub 账号并选择 `canunited-asset-manager-` 仓库

### 方法 2: 添加服务

在 Railway 项目中添加以下服务：

#### 2.1 PostgreSQL 数据库
1. 点击 **"+ New"** → **"Database"** → **"PostgreSQL"**
2. Railway 会自动创建并提供 `DATABASE_URL`

#### 2.2 Redis 缓存
1. 点击 **"+ New"** → **"Database"** → **"Redis"**
2. Railway 会自动创建并提供 `REDIS_URL`

#### 2.3 后端服务
1. 点击 **"+ New"** → **"GitHub Repo"**
2. 选择你的仓库
3. 设置 Root Directory: `canunited-asset-manager/packages/backend`
   > **注意**: 因为仓库结构是嵌套的，所以需要包含 `canunited-asset-manager/` 前缀
4. 添加环境变量:

```env
NODE_ENV=production
JWT_SECRET=<生成一个强随机字符串>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
MFA_ISSUER=CANUnited Asset Manager
CORS_ORIGIN=https://daniel4se.github.io
```

5. Railway 会自动连接 PostgreSQL 和 Redis 的环境变量

### 方法 3: 使用 Railway CLI

```bash
cd packages/backend

# 登录
railway login

# 创建项目
railway init

# 添加 PostgreSQL
railway add --plugin postgresql

# 添加 Redis
railway add --plugin redis

# 设置环境变量
railway variables set JWT_SECRET="your-secret-key"
railway variables set CORS_ORIGIN="https://daniel4se.github.io"

# 部署
railway up
```

## 三、初始化数据库

部署后，需要运行数据库初始化脚本：

```bash
# 使用 Railway CLI
railway run psql $DATABASE_URL < sql/init.sql

# 或者在 Railway 控制台的 PostgreSQL 服务中
# 点击 "Query" 标签，粘贴 init.sql 内容并执行
```

## 四、获取后端 URL

部署完成后，Railway 会提供一个 URL，格式类似：
```
https://canunited-backend-production.up.railway.app
```

## 五、更新前端配置

1. 在 GitHub 仓库设置中添加 Secret:
   - `VITE_API_URL` = `https://your-railway-url.up.railway.app/api/v1`

2. 或更新 `.github/workflows/deploy.yml`:
```yaml
env:
  VITE_API_URL: "https://your-railway-url.up.railway.app/api/v1"
```

3. 重新触发 GitHub Actions 部署

## 六、验证部署

1. 访问后端健康检查:
   ```
   https://your-railway-url.up.railway.app/health
   ```

2. 访问前端:
   ```
   https://daniel4se.github.io/canunited-asset-manager-/
   ```

3. 使用以下账号登录:
   - admin@canunited.com / password123
   - analyst@canunited.com / password123
   - tech@canunited.com / password123
   - viewer@canunited.com / password123

## 七、费用说明

Railway 免费层包含:
- $5 免费额度/月
- 500 小时执行时间
- 足够运行小型演示项目

## 八、故障排除

### 数据库连接失败
- 检查 `DATABASE_URL` 环境变量是否正确设置
- 确保 PostgreSQL 服务正在运行

### CORS 错误
- 检查 `CORS_ORIGIN` 是否正确设置为前端 URL
- 确保没有尾部斜杠

### 登录失败
- 确保已运行 `init.sql` 初始化数据库
- 检查 Redis 服务是否正常
