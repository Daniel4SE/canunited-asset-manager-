# CANUnited Asset Manager - Enterprise Upgrade Plan

## Overview

This document outlines the comprehensive upgrade plan to transform CANUnited Asset Manager into an enterprise-grade application with:
- Full database integration
- Role-Based Access Control (RBAC)
- Multi-Tenancy, Multi-Site, Multi-Asset architecture
- Enterprise authentication (SSO, MFA, LDAP/LDAPS, Google Authenticator)

---

## Phase 1: Database Architecture & Schema Design

### 1.1 Database Selection
- **Primary Database**: PostgreSQL 15+
- **Cache Layer**: Redis
- **Session Store**: Redis
- **Time-Series Data**: TimescaleDB (PostgreSQL extension) for sensor data

### 1.2 Core Schema Design

```sql
-- ==========================================
-- TENANT & ORGANIZATION MANAGEMENT
-- ==========================================

CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    domain VARCHAR(255),
    logo_url TEXT,
    settings JSONB DEFAULT '{}',
    subscription_tier VARCHAR(50) DEFAULT 'standard', -- standard, professional, enterprise
    max_users INTEGER DEFAULT 50,
    max_sites INTEGER DEFAULT 10,
    max_assets INTEGER DEFAULT 1000,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    parent_org_id UUID REFERENCES organizations(id),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- USER & AUTHENTICATION
-- ==========================================

CREATE TYPE user_role AS ENUM ('administrator', 'analyst', 'technician', 'viewer');
CREATE TYPE auth_provider AS ENUM ('local', 'ldap', 'sso_saml', 'sso_oidc', 'google');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    username VARCHAR(100),
    password_hash VARCHAR(255), -- NULL for SSO/LDAP users
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(50),
    avatar_url TEXT,
    role user_role NOT NULL DEFAULT 'viewer',
    auth_provider auth_provider DEFAULT 'local',
    external_id VARCHAR(255), -- For SSO/LDAP mapping
    mfa_enabled BOOLEAN DEFAULT false,
    mfa_secret VARCHAR(255), -- TOTP secret for Google Authenticator
    mfa_backup_codes TEXT[], -- Encrypted backup codes
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    password_changed_at TIMESTAMPTZ,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);

CREATE TABLE user_site_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    permissions JSONB DEFAULT '{"read": true, "write": false, "delete": false}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, site_id)
);

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    refresh_token_hash VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    device_info JSONB,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- SITE MANAGEMENT
-- ==========================================

CREATE TABLE sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    timezone VARCHAR(50) DEFAULT 'UTC',
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, code)
);

-- ==========================================
-- ASSET MANAGEMENT
-- ==========================================

CREATE TYPE asset_status AS ENUM ('operational', 'needs_attention', 'maintenance', 'offline', 'decommissioned');

CREATE TABLE asset_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(100),
    icon VARCHAR(50),
    default_specifications JSONB,
    maintenance_intervals JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    asset_type_id UUID REFERENCES asset_types(id),
    parent_asset_id UUID REFERENCES assets(id), -- For hierarchical assets
    name VARCHAR(255) NOT NULL,
    asset_tag VARCHAR(100) NOT NULL,
    vendor VARCHAR(100),
    vendor_model VARCHAR(100),
    serial_number VARCHAR(100),
    status asset_status DEFAULT 'operational',
    installation_date DATE,
    warranty_expiry DATE,
    expected_lifetime_years INTEGER,
    location JSONB, -- {building, floor, room, panel, position}
    specifications JSONB,
    metadata JSONB DEFAULT '{}',
    qr_code_url TEXT,
    is_critical BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, asset_tag)
);

CREATE TABLE asset_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
    electrical_health INTEGER CHECK (electrical_health >= 0 AND electrical_health <= 100),
    thermal_health INTEGER CHECK (thermal_health >= 0 AND thermal_health <= 100),
    insulation_health INTEGER CHECK (insulation_health >= 0 AND insulation_health <= 100),
    mechanical_health INTEGER CHECK (mechanical_health >= 0 AND mechanical_health <= 100),
    remaining_useful_life INTEGER, -- days
    degradation_rate DECIMAL(10, 6),
    failure_probability_30d DECIMAL(5, 4),
    health_trend VARCHAR(20), -- improving, stable, declining
    calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- SENSORS & TIME-SERIES DATA
-- ==========================================

CREATE TABLE sensors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sensor_type VARCHAR(50) NOT NULL,
    model VARCHAR(100),
    vendor VARCHAR(100),
    serial_number VARCHAR(100),
    protocol VARCHAR(50), -- zigbee, lorawan, modbus_rtu, modbus_tcp, wifi, bluetooth
    gateway_id UUID,
    is_online BOOLEAN DEFAULT false,
    battery_level INTEGER,
    signal_strength INTEGER,
    firmware_version VARCHAR(50),
    calibration_date DATE,
    location TEXT,
    configuration JSONB DEFAULT '{}',
    last_reading_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TimescaleDB hypertable for sensor readings
CREATE TABLE sensor_readings (
    time TIMESTAMPTZ NOT NULL,
    sensor_id UUID NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
    value DOUBLE PRECISION NOT NULL,
    unit VARCHAR(20),
    quality VARCHAR(20) DEFAULT 'good', -- good, uncertain, bad
    metadata JSONB
);

SELECT create_hypertable('sensor_readings', 'time');

-- ==========================================
-- ALERTS & NOTIFICATIONS
-- ==========================================

CREATE TYPE alert_severity AS ENUM ('info', 'low', 'medium', 'high', 'critical');
CREATE TYPE alert_status AS ENUM ('active', 'acknowledged', 'resolved', 'suppressed');

CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    sensor_id UUID REFERENCES sensors(id) ON DELETE SET NULL,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity alert_severity NOT NULL,
    status alert_status DEFAULT 'active',
    rule_id UUID, -- Reference to alert rule that triggered this
    trigger_value DOUBLE PRECISION,
    threshold_value DOUBLE PRECISION,
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    maintenance_task_id UUID, -- Link to created maintenance task
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- MAINTENANCE MANAGEMENT
-- ==========================================

CREATE TYPE task_type AS ENUM ('preventive', 'corrective', 'predictive', 'inspection', 'emergency');
CREATE TYPE task_status AS ENUM ('scheduled', 'in_progress', 'completed', 'overdue', 'cancelled');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TABLE maintenance_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    alert_id UUID REFERENCES alerts(id), -- If created from alert
    title VARCHAR(255) NOT NULL,
    description TEXT,
    task_type task_type NOT NULL,
    priority task_priority DEFAULT 'medium',
    status task_status DEFAULT 'scheduled',
    assigned_to UUID REFERENCES users(id),
    assigned_team VARCHAR(100),
    due_date DATE,
    scheduled_start TIMESTAMPTZ,
    scheduled_end TIMESTAMPTZ,
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,
    estimated_duration_hours DECIMAL(5, 2),
    oem_service_required BOOLEAN DEFAULT false,
    instructions TEXT,
    safety_notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES maintenance_tasks(id) ON DELETE CASCADE,
    work_order_number VARCHAR(50) UNIQUE NOT NULL,
    completed_by UUID REFERENCES users(id),
    completion_date TIMESTAMPTZ,
    actual_duration_hours DECIMAL(5, 2),
    labor_cost DECIMAL(10, 2),
    parts_cost DECIMAL(10, 2),
    total_cost DECIMAL(10, 2),
    parts_used TEXT,
    work_performed TEXT,
    findings TEXT,
    recommendations TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE work_order_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100),
    file_size INTEGER,
    file_url TEXT NOT NULL,
    thumbnail_url TEXT,
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- AUDIT LOGGING
-- ==========================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL, -- create, read, update, delete, login, logout, etc.
    entity_type VARCHAR(50) NOT NULL, -- user, asset, sensor, alert, etc.
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- AUTHENTICATION CONFIGURATIONS
-- ==========================================

CREATE TABLE auth_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider auth_provider NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_enabled BOOLEAN DEFAULT false,
    is_default BOOLEAN DEFAULT false,
    configuration JSONB NOT NULL, -- Provider-specific config (encrypted sensitive fields)
    -- LDAP: {host, port, baseDn, bindDn, bindPassword, userFilter, groupFilter, useTls}
    -- SAML: {entityId, ssoUrl, sloUrl, certificate, attributeMapping}
    -- OIDC: {clientId, clientSecret, discoveryUrl, scopes, attributeMapping}
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, provider, name)
);

-- ==========================================
-- INDEXES
-- ==========================================

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_sites_tenant ON sites(tenant_id);
CREATE INDEX idx_assets_tenant ON assets(tenant_id);
CREATE INDEX idx_assets_site ON assets(site_id);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_sensors_tenant ON sensors(tenant_id);
CREATE INDEX idx_sensors_asset ON sensors(asset_id);
CREATE INDEX idx_alerts_tenant ON alerts(tenant_id);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_maintenance_tenant ON maintenance_tasks(tenant_id);
CREATE INDEX idx_maintenance_status ON maintenance_tasks(status);
CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
```

---

## Phase 2: Role-Based Access Control (RBAC)

### 2.1 Role Definitions

| Role | Description | Access Level |
|------|-------------|--------------|
| **Administrator** | Full system access | All features, user management, settings, integrations |
| **Analyst** | Data analysis & reporting | Read all data, create reports, view analytics, no config changes |
| **Technician** | Field operations | Assigned sites/assets, maintenance tasks, work orders |
| **Viewer** | Read-only access | View dashboards and assigned resources only |

### 2.2 Permission Matrix

```typescript
// packages/backend/src/auth/permissions.ts

export const PERMISSIONS = {
  // Dashboard
  'dashboard:view': ['administrator', 'analyst', 'technician', 'viewer'],

  // Users
  'users:list': ['administrator'],
  'users:create': ['administrator'],
  'users:update': ['administrator'],
  'users:delete': ['administrator'],

  // Sites
  'sites:list': ['administrator', 'analyst', 'technician', 'viewer'],
  'sites:create': ['administrator'],
  'sites:update': ['administrator'],
  'sites:delete': ['administrator'],

  // Assets
  'assets:list': ['administrator', 'analyst', 'technician', 'viewer'],
  'assets:create': ['administrator', 'analyst'],
  'assets:update': ['administrator', 'analyst'],
  'assets:delete': ['administrator'],
  'assets:export': ['administrator', 'analyst'],

  // Sensors
  'sensors:list': ['administrator', 'analyst', 'technician', 'viewer'],
  'sensors:create': ['administrator'],
  'sensors:update': ['administrator', 'technician'],
  'sensors:delete': ['administrator'],
  'sensors:calibrate': ['administrator', 'technician'],

  // Alerts
  'alerts:list': ['administrator', 'analyst', 'technician', 'viewer'],
  'alerts:acknowledge': ['administrator', 'analyst', 'technician'],
  'alerts:resolve': ['administrator', 'analyst', 'technician'],
  'alerts:configure': ['administrator'],

  // Maintenance
  'maintenance:list': ['administrator', 'analyst', 'technician', 'viewer'],
  'maintenance:create': ['administrator', 'analyst'],
  'maintenance:update': ['administrator', 'analyst', 'technician'],
  'maintenance:assign': ['administrator', 'analyst'],
  'maintenance:complete': ['administrator', 'technician'],
  'maintenance:delete': ['administrator'],

  // Work Orders
  'workorders:list': ['administrator', 'analyst', 'technician'],
  'workorders:create': ['administrator', 'technician'],
  'workorders:update': ['administrator', 'technician'],

  // Reports
  'reports:view': ['administrator', 'analyst', 'viewer'],
  'reports:create': ['administrator', 'analyst'],
  'reports:export': ['administrator', 'analyst'],

  // Analytics
  'analytics:view': ['administrator', 'analyst', 'viewer'],
  'analytics:advanced': ['administrator', 'analyst'],

  // Settings
  'settings:view': ['administrator'],
  'settings:update': ['administrator'],
  'integrations:manage': ['administrator'],

  // Audit
  'audit:view': ['administrator'],
} as const;
```

### 2.3 UI View Differences by Role

#### Administrator View
- Full navigation menu
- User management section
- System settings & integrations
- All sites/assets access
- Audit logs

#### Analyst View
- Dashboard with all KPIs
- Assets (read + create/update)
- Full analytics & reports
- Alerts (acknowledge/resolve)
- Maintenance (create/assign)
- No user management
- No system settings

#### Technician View
- Simplified dashboard (assigned tasks focus)
- Only assigned sites/assets
- Maintenance tasks (assigned only)
- Work order completion
- Sensor readings
- Limited alerts (assigned assets only)

---

## Phase 3: Authentication System

### 3.1 Local Authentication
- Email + Password
- Password policies (min length, complexity, expiry)
- Account lockout after failed attempts
- Password reset via email

### 3.2 Multi-Factor Authentication (MFA)

```typescript
// packages/backend/src/auth/mfa.service.ts

import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

export class MFAService {
  // Generate TOTP secret
  generateSecret(userEmail: string, tenantName: string) {
    return speakeasy.generateSecret({
      name: `${tenantName}:${userEmail}`,
      issuer: 'CANUnited Asset Manager',
      length: 32,
    });
  }

  // Generate QR code for Google Authenticator
  async generateQRCode(secret: string): Promise<string> {
    return QRCode.toDataURL(secret);
  }

  // Verify TOTP token
  verifyToken(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1, // Allow 30 seconds clock drift
    });
  }

  // Generate backup codes
  generateBackupCodes(count: number = 10): string[] {
    return Array.from({ length: count }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );
  }
}
```

### 3.3 LDAP/LDAPS Integration

```typescript
// packages/backend/src/auth/ldap.service.ts

import ldap from 'ldapjs';

export interface LDAPConfig {
  host: string;
  port: number;
  baseDn: string;
  bindDn: string;
  bindPassword: string;
  userFilter: string;
  groupFilter: string;
  useTls: boolean;
  tlsCertificate?: string;
}

export class LDAPService {
  private client: ldap.Client;

  async connect(config: LDAPConfig): Promise<void> {
    const url = `${config.useTls ? 'ldaps' : 'ldap'}://${config.host}:${config.port}`;

    this.client = ldap.createClient({
      url,
      tlsOptions: config.useTls ? {
        rejectUnauthorized: true,
        ca: config.tlsCertificate,
      } : undefined,
    });

    await this.bind(config.bindDn, config.bindPassword);
  }

  async authenticate(username: string, password: string, config: LDAPConfig): Promise<LDAPUser | null> {
    const userDn = await this.findUserDn(username, config);
    if (!userDn) return null;

    try {
      await this.bind(userDn, password);
      return this.getUserAttributes(userDn, config);
    } catch {
      return null;
    }
  }

  async syncUsers(config: LDAPConfig): Promise<LDAPUser[]> {
    // Sync users from LDAP directory
  }
}
```

### 3.4 SSO - SAML 2.0

```typescript
// packages/backend/src/auth/saml.service.ts

import { Strategy as SamlStrategy } from 'passport-saml';

export interface SAMLConfig {
  entityId: string;
  ssoUrl: string;
  sloUrl?: string;
  certificate: string;
  privateKey: string;
  attributeMapping: {
    email: string;
    firstName: string;
    lastName: string;
    groups?: string;
  };
}

export const createSamlStrategy = (config: SAMLConfig, tenantId: string) => {
  return new SamlStrategy({
    path: `/api/auth/saml/${tenantId}/callback`,
    entryPoint: config.ssoUrl,
    issuer: config.entityId,
    cert: config.certificate,
    privateKey: config.privateKey,
    identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    acceptedClockSkewMs: 5000,
  }, (profile, done) => {
    // Map SAML attributes to user
    const user = {
      email: profile[config.attributeMapping.email],
      firstName: profile[config.attributeMapping.firstName],
      lastName: profile[config.attributeMapping.lastName],
      groups: profile[config.attributeMapping.groups],
    };
    done(null, user);
  });
};
```

### 3.5 SSO - OpenID Connect (OIDC)

```typescript
// packages/backend/src/auth/oidc.service.ts

import { Strategy as OIDCStrategy } from 'passport-openidconnect';

export interface OIDCConfig {
  clientId: string;
  clientSecret: string;
  discoveryUrl: string; // e.g., https://accounts.google.com/.well-known/openid-configuration
  scopes: string[];
  attributeMapping: {
    email: string;
    firstName: string;
    lastName: string;
  };
}

export const createOIDCStrategy = (config: OIDCConfig, tenantId: string) => {
  return new OIDCStrategy({
    issuer: config.discoveryUrl,
    clientID: config.clientId,
    clientSecret: config.clientSecret,
    callbackURL: `/api/auth/oidc/${tenantId}/callback`,
    scope: config.scopes.join(' '),
  }, (issuer, profile, done) => {
    const user = {
      email: profile.emails?.[0]?.value,
      firstName: profile.name?.givenName,
      lastName: profile.name?.familyName,
      externalId: profile.id,
    };
    done(null, user);
  });
};
```

---

## Phase 4: Multi-Tenancy Architecture

### 4.1 Tenant Isolation Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    CANUnited Platform                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Tenant A   │  │   Tenant B   │  │   Tenant C   │      │
│  │  (Company A) │  │  (Company B) │  │  (Company C) │      │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤      │
│  │ Site 1       │  │ Site 1       │  │ Site 1       │      │
│  │ Site 2       │  │ Site 2       │  │ Site 2       │      │
│  │ ...          │  │ ...          │  │ ...          │      │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤      │
│  │ Users        │  │ Users        │  │ Users        │      │
│  │ Assets       │  │ Assets       │  │ Assets       │      │
│  │ Sensors      │  │ Sensors      │  │ Sensors      │      │
│  │ Alerts       │  │ Alerts       │  │ Alerts       │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Tenant Context Middleware

```typescript
// packages/backend/src/middleware/tenant.middleware.ts

export const tenantMiddleware = async (req, res, next) => {
  // Extract tenant from subdomain, header, or JWT
  const tenantSlug = req.subdomains[0] || req.headers['x-tenant-id'];

  if (!tenantSlug) {
    return res.status(400).json({ error: 'Tenant not specified' });
  }

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant || !tenant.is_active) {
    return res.status(404).json({ error: 'Tenant not found' });
  }

  req.tenant = tenant;
  req.tenantId = tenant.id;

  next();
};

// All queries automatically filtered by tenant
export const scopedQuery = (baseQuery, tenantId) => {
  return baseQuery.where('tenant_id', tenantId);
};
```

---

## Phase 5: Implementation Roadmap

### Sprint 1 (Week 1-2): Database Setup
- [ ] Set up PostgreSQL with TimescaleDB
- [ ] Create database migrations
- [ ] Set up Redis for caching/sessions
- [ ] Implement database connection pooling
- [ ] Create seed data scripts

### Sprint 2 (Week 3-4): Core API Refactoring
- [ ] Refactor all endpoints to use database
- [ ] Implement tenant-scoped queries
- [ ] Add database transactions
- [ ] Implement audit logging
- [ ] Create API documentation (OpenAPI/Swagger)

### Sprint 3 (Week 5-6): Authentication - Phase 1
- [ ] Local authentication with JWT
- [ ] Password policies & account lockout
- [ ] Session management
- [ ] Password reset flow
- [ ] Email verification

### Sprint 4 (Week 7-8): Authentication - Phase 2
- [ ] MFA with Google Authenticator
- [ ] Backup codes generation
- [ ] MFA enrollment flow
- [ ] MFA bypass for recovery

### Sprint 5 (Week 9-10): LDAP/LDAPS Integration
- [ ] LDAP connection service
- [ ] User authentication via LDAP
- [ ] User sync from LDAP
- [ ] Group mapping to roles
- [ ] LDAPS (TLS) support

### Sprint 6 (Week 11-12): SSO Integration
- [ ] SAML 2.0 service provider
- [ ] OpenID Connect client
- [ ] SSO configuration UI
- [ ] Just-in-time user provisioning
- [ ] Single logout support

### Sprint 7 (Week 13-14): RBAC Implementation
- [ ] Permission system
- [ ] Role-based route guards
- [ ] UI component visibility by role
- [ ] Site-level permissions
- [ ] Custom permission rules

### Sprint 8 (Week 15-16): Multi-Tenancy
- [ ] Tenant management API
- [ ] Tenant provisioning
- [ ] Subdomain routing
- [ ] Tenant-specific configurations
- [ ] Tenant billing/quotas

### Sprint 9 (Week 17-18): Frontend Updates
- [ ] Login page with provider selection
- [ ] MFA enrollment UI
- [ ] Role-based navigation
- [ ] Technician mobile view
- [ ] Admin console

### Sprint 10 (Week 19-20): Testing & Deployment
- [ ] Integration tests
- [ ] Security audit
- [ ] Performance testing
- [ ] Documentation
- [ ] Production deployment

---

## Phase 6: File Structure

```
canunited-asset-manager/
├── packages/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── strategies/
│   │   │   │   │   ├── local.strategy.ts
│   │   │   │   │   ├── jwt.strategy.ts
│   │   │   │   │   ├── ldap.strategy.ts
│   │   │   │   │   ├── saml.strategy.ts
│   │   │   │   │   └── oidc.strategy.ts
│   │   │   │   ├── mfa/
│   │   │   │   │   ├── mfa.service.ts
│   │   │   │   │   └── mfa.controller.ts
│   │   │   │   ├── guards/
│   │   │   │   │   ├── auth.guard.ts
│   │   │   │   │   ├── roles.guard.ts
│   │   │   │   │   └── permissions.guard.ts
│   │   │   │   └── permissions.ts
│   │   │   ├── tenants/
│   │   │   │   ├── tenant.controller.ts
│   │   │   │   ├── tenant.service.ts
│   │   │   │   └── tenant.middleware.ts
│   │   │   ├── users/
│   │   │   │   ├── user.controller.ts
│   │   │   │   ├── user.service.ts
│   │   │   │   └── user.dto.ts
│   │   │   ├── sites/
│   │   │   ├── assets/
│   │   │   ├── sensors/
│   │   │   ├── alerts/
│   │   │   ├── maintenance/
│   │   │   ├── reports/
│   │   │   ├── audit/
│   │   │   ├── database/
│   │   │   │   ├── migrations/
│   │   │   │   ├── seeds/
│   │   │   │   └── connection.ts
│   │   │   └── config/
│   │   └── package.json
│   │
│   └── frontend/
│       ├── src/
│       │   ├── components/
│       │   │   ├── auth/
│       │   │   │   ├── LoginPage.tsx
│       │   │   │   ├── MFASetup.tsx
│       │   │   │   ├── MFAVerify.tsx
│       │   │   │   ├── PasswordReset.tsx
│       │   │   │   └── SSOButton.tsx
│       │   │   └── ...
│       │   ├── contexts/
│       │   │   ├── AuthContext.tsx
│       │   │   ├── TenantContext.tsx
│       │   │   └── PermissionContext.tsx
│       │   ├── hooks/
│       │   │   ├── useAuth.ts
│       │   │   ├── usePermissions.ts
│       │   │   └── useTenant.ts
│       │   ├── guards/
│       │   │   ├── AuthGuard.tsx
│       │   │   ├── RoleGuard.tsx
│       │   │   └── PermissionGuard.tsx
│       │   └── pages/
│       │       ├── admin/
│       │       │   ├── UsersPage.tsx
│       │       │   ├── TenantsPage.tsx
│       │       │   └── AuthConfigPage.tsx
│       │       └── ...
│       └── package.json
│
├── docker/
│   ├── docker-compose.yml
│   ├── docker-compose.dev.yml
│   └── Dockerfile
│
└── docs/
    ├── UPGRADE_PLAN.md
    ├── API.md
    ├── DEPLOYMENT.md
    └── SECURITY.md
```

---

## Phase 7: Security Considerations

### 7.1 Data Protection
- All passwords hashed with bcrypt (cost factor 12)
- MFA secrets encrypted at rest (AES-256)
- LDAP bind passwords encrypted
- SSO certificates stored securely
- Database connection via SSL

### 7.2 API Security
- JWT tokens with short expiry (15 min access, 7 day refresh)
- Rate limiting per tenant
- CORS configuration per tenant
- Request signing for sensitive operations
- IP whitelisting option

### 7.3 Audit Requirements
- All authentication events logged
- All data modifications logged
- Admin actions require reason
- Audit logs immutable (append-only)
- Log retention policy configurable

---

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (optional)

### Quick Start

```bash
# Start development databases
docker-compose -f docker/docker-compose.dev.yml up -d

# Run database migrations
cd packages/backend
npm run db:migrate

# Seed initial data
npm run db:seed

# Start backend
npm run dev

# Start frontend (new terminal)
cd packages/frontend
npm run dev
```

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/canunited
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# MFA
MFA_ISSUER=CANUnited Asset Manager

# LDAP (if enabled)
LDAP_ENABLED=false

# SSO (if enabled)
SSO_SAML_ENABLED=false
SSO_OIDC_ENABLED=false

# Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
```

---

## Next Steps

1. Review and approve this plan
2. Set up development environment
3. Begin Sprint 1: Database Setup
4. Weekly progress reviews

---

*Document Version: 1.0*
*Last Updated: 2026-02-02*
*Author: Development Team*
