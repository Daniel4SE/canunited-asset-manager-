# CANUnited Asset Manager - 实现状态

## 一、功能实现状态

### 1. 认证系统

| 功能 | 状态 | 说明 |
|------|------|------|
| 本地登录 (Email/Password) | ✅ 完成 | JWT + Refresh Token |
| MFA (Google Authenticator) | ✅ 完成 | TOTP 算法，支持备份码 |
| SSO - SAML 2.0 | ✅ 完成 | `src/services/auth/sso.service.ts` |
| SSO - OpenID Connect | ✅ 完成 | Azure AD, Okta, Google 支持 |
| LDAP/LDAPS | ✅ 完成 | `src/services/auth/ldap.service.ts` |
| Session 管理 | ✅ 完成 | Redis 存储 |

### 认证 API 端点

```
POST /api/v1/auth/login              - 本地登录
POST /api/v1/auth/mfa/setup          - 设置 MFA
POST /api/v1/auth/mfa/verify         - 验证 MFA
GET  /api/v1/auth/sso/initiate/:id   - 发起 SSO 登录
GET  /api/v1/auth/sso/oidc/callback  - OIDC 回调
POST /api/v1/auth/sso/saml/callback  - SAML 回调
POST /api/v1/auth/sso/ldap/login     - LDAP 登录
GET  /api/v1/auth/sso/providers      - 获取 SSO 提供者列表
POST /api/v1/auth/sso/providers      - 添加 SSO 提供者 (管理员)
```

### 2. 角色权限 (RBAC)

| 角色 | 权限 |
|------|------|
| Administrator | 全部功能访问 |
| Analyst | 分析报表、只读资产、告警确认 |
| Technician | 维护任务、告警处理、资产查看 |
| Viewer | 仪表板只读 |

### 3. 多租户架构

| 功能 | 状态 |
|------|------|
| Tenant 隔离 | ✅ 数据库层面隔离 |
| Multi-Site | ✅ 每租户多站点 |
| Multi-Asset | ✅ 每站点多资产 |
| 用户站点权限 | ✅ user_site_permissions 表 |

### 4. 数据连接

| 组件 | 状态 | 说明 |
|------|------|------|
| PostgreSQL | ✅ Schema 完成 | 需要 Docker 运行 |
| Redis | ✅ 配置完成 | Session + Cache |
| 后端 API | ⚠️ 部分完成 | Auth 路由已连接数据库 |
| 前端 | ⚠️ DEMO 模式 | 需要切换到生产模式 |

---

## 二、启动真实数据库模式

### 方式 1: Docker Compose (推荐)

```bash
cd canunited-asset-manager
docker-compose up -d
```

服务:
- PostgreSQL: localhost:5432
- Redis: localhost:6379
- Backend: localhost:4000
- Frontend: localhost:3000

### 方式 2: 本地开发

1. 启动 PostgreSQL 和 Redis
2. 运行数据库初始化:
```bash
psql -U postgres -d canunited_asset_manager -f packages/backend/sql/init.sql
```
3. 启动后端:
```bash
cd packages/backend && npm run dev
```
4. 修改前端 DEMO_MODE:
```typescript
// packages/frontend/src/stores/authStore.ts
const DEMO_MODE = false;

// packages/frontend/src/lib/api.ts
const DEMO_MODE = false;
```
5. 启动前端:
```bash
cd packages/frontend && npm run dev
```

---

## 三、Demo 账号

| 邮箱 | 密码 | 角色 | 站点访问 |
|------|------|------|----------|
| admin@canunited.com | password123 | Administrator | 全部 |
| analyst@canunited.com | password123 | Analyst | 全部 |
| tech@canunited.com | password123 | Technician | Singapore |
| viewer@canunited.com | password123 | Viewer | Singapore |

---

## 四、待实现功能

### Phase 1: 连接真实数据库
- [ ] 关闭 DEMO_MODE
- [ ] 验证所有 API 端点
- [ ] 测试不同角色登录

### Phase 2: SSO 集成
- [ ] SAML 2.0 适配器
- [ ] OpenID Connect 适配器
- [ ] Azure AD 示例配置
- [ ] Okta 示例配置

### Phase 3: LDAP 集成
- [ ] LDAP 连接服务
- [ ] LDAPS (TLS) 支持
- [ ] 用户同步
- [ ] 组映射到角色

---

## 五、API 端点

### 认证
```
POST /api/v1/auth/login          - 登录
POST /api/v1/auth/mfa/verify     - MFA 验证
POST /api/v1/auth/mfa/setup      - 设置 MFA
POST /api/v1/auth/mfa/confirm    - 确认 MFA
POST /api/v1/auth/refresh        - 刷新 Token
POST /api/v1/auth/logout         - 登出
GET  /api/v1/auth/me             - 获取当前用户
```

### 资源
```
GET  /api/v1/assets              - 资产列表
GET  /api/v1/assets/:id          - 资产详情
GET  /api/v1/sensors             - 传感器列表
GET  /api/v1/alerts              - 告警列表
GET  /api/v1/maintenance         - 维护任务
GET  /api/v1/sites               - 站点列表
```
