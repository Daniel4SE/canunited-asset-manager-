-- ==========================================
-- CANUnited Asset Manager - Database Schema
-- PostgreSQL 15+ with TimescaleDB Extension
-- ==========================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- ENUMS
-- ==========================================

CREATE TYPE user_role AS ENUM ('administrator', 'analyst', 'technician', 'viewer', 'asset_manager', 'field_technician', 'reliability_engineer');
CREATE TYPE auth_provider AS ENUM ('local', 'ldap', 'sso_saml', 'sso_oidc', 'google');
CREATE TYPE asset_status AS ENUM ('operational', 'needs_attention', 'maintenance', 'offline', 'decommissioned');
CREATE TYPE alert_severity AS ENUM ('info', 'low', 'medium', 'high', 'critical');
CREATE TYPE alert_status AS ENUM ('active', 'acknowledged', 'resolved', 'suppressed');
CREATE TYPE task_type AS ENUM ('preventive', 'corrective', 'predictive', 'inspection', 'emergency');
CREATE TYPE task_status AS ENUM ('scheduled', 'in_progress', 'completed', 'overdue', 'cancelled');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- ==========================================
-- TENANT & ORGANIZATION MANAGEMENT
-- ==========================================

CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    domain VARCHAR(255),
    logo_url TEXT,
    settings JSONB DEFAULT '{}',
    subscription_tier VARCHAR(50) DEFAULT 'standard',
    max_users INTEGER DEFAULT 50,
    max_sites INTEGER DEFAULT 10,
    max_assets INTEGER DEFAULT 1000,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    username VARCHAR(100),
    password_hash VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(50),
    avatar_url TEXT,
    role user_role NOT NULL DEFAULT 'viewer',
    auth_provider auth_provider DEFAULT 'local',
    external_id VARCHAR(255),
    mfa_enabled BOOLEAN DEFAULT false,
    mfa_secret VARCHAR(255),
    mfa_backup_codes TEXT[],
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    email_verification_token VARCHAR(255),
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    password_changed_at TIMESTAMPTZ,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    site_access TEXT[] DEFAULT ARRAY['*']::TEXT[],
    preferences JSONB DEFAULT '{"theme": "dark", "language": "en", "notifications": true}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ,
    UNIQUE(tenant_id, email)
);

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    refresh_token_hash VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    device_info JSONB,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE auth_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider auth_provider NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_enabled BOOLEAN DEFAULT false,
    is_default BOOLEAN DEFAULT false,
    configuration JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, provider, name)
);

-- ==========================================
-- SITE MANAGEMENT
-- ==========================================

CREATE TABLE sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

CREATE TABLE user_site_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    permissions JSONB DEFAULT '{"read": true, "write": false, "delete": false}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, site_id)
);

-- ==========================================
-- ASSET MANAGEMENT
-- ==========================================

CREATE TABLE asset_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(100),
    icon VARCHAR(50),
    default_specifications JSONB,
    maintenance_intervals JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    asset_type_id UUID REFERENCES asset_types(id),
    parent_asset_id UUID REFERENCES assets(id),
    name VARCHAR(255) NOT NULL,
    asset_tag VARCHAR(100) NOT NULL,
    vendor VARCHAR(100),
    vendor_model VARCHAR(100),
    serial_number VARCHAR(100),
    status asset_status DEFAULT 'operational',
    installation_date DATE,
    warranty_expiry DATE,
    expected_lifetime_years INTEGER,
    location JSONB,
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
    electrical_health INTEGER CHECK (electrical_health >= 0 AND electrical_health <= 100),
    thermal_health INTEGER CHECK (thermal_health >= 0 AND thermal_health <= 100),
    insulation_health INTEGER CHECK (insulation_health >= 0 AND insulation_health <= 100),
    mechanical_health INTEGER CHECK (mechanical_health >= 0 AND mechanical_health <= 100),
    remaining_useful_life INTEGER,
    degradation_rate DECIMAL(10, 6),
    failure_probability_30d DECIMAL(5, 4),
    health_trend VARCHAR(20),
    calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE asset_health_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    health_score INTEGER,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- SENSORS & READINGS
-- ==========================================

CREATE TABLE sensors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sensor_type VARCHAR(50) NOT NULL,
    model VARCHAR(100),
    vendor VARCHAR(100),
    serial_number VARCHAR(100),
    protocol VARCHAR(50),
    gateway_id UUID,
    is_online BOOLEAN DEFAULT false,
    battery_level INTEGER,
    signal_strength INTEGER,
    firmware_version VARCHAR(50),
    calibration_date DATE,
    location TEXT,
    configuration JSONB DEFAULT '{}',
    last_reading_value DOUBLE PRECISION,
    last_reading_unit VARCHAR(20),
    last_reading_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sensor_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sensor_id UUID NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
    value DOUBLE PRECISION NOT NULL,
    unit VARCHAR(20),
    quality VARCHAR(20) DEFAULT 'good',
    metadata JSONB,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- ALERTS & NOTIFICATIONS
-- ==========================================

CREATE TABLE alert_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sensor_type VARCHAR(50),
    condition_type VARCHAR(50) NOT NULL,
    threshold_value DOUBLE PRECISION,
    threshold_unit VARCHAR(20),
    severity alert_severity NOT NULL,
    is_active BOOLEAN DEFAULT true,
    notification_channels JSONB DEFAULT '["email", "in_app"]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    sensor_id UUID REFERENCES sensors(id) ON DELETE SET NULL,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES alert_rules(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity alert_severity NOT NULL,
    status alert_status DEFAULT 'active',
    trigger_value DOUBLE PRECISION,
    threshold_value DOUBLE PRECISION,
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    maintenance_task_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- MAINTENANCE MANAGEMENT
-- ==========================================

CREATE TABLE maintenance_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    alert_id UUID REFERENCES alerts(id),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- REPORTS
-- ==========================================

CREATE TABLE report_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    report_type VARCHAR(50) NOT NULL,
    template_config JSONB NOT NULL,
    is_system BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE generated_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    template_id UUID REFERENCES report_templates(id),
    name VARCHAR(255) NOT NULL,
    report_type VARCHAR(50) NOT NULL,
    format VARCHAR(20) NOT NULL,
    file_url TEXT,
    file_size INTEGER,
    parameters JSONB,
    generated_by UUID REFERENCES users(id),
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- CMMS INTEGRATIONS
-- ==========================================

CREATE TABLE cmms_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    configuration JSONB NOT NULL,
    is_active BOOLEAN DEFAULT false,
    last_sync_at TIMESTAMPTZ,
    sync_status VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- AUDIT LOGGING
-- ==========================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- INDEXES
-- ==========================================

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_sites_tenant ON sites(tenant_id);
CREATE INDEX idx_sites_code ON sites(code);
CREATE INDEX idx_assets_tenant ON assets(tenant_id);
CREATE INDEX idx_assets_site ON assets(site_id);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_tag ON assets(asset_tag);
CREATE INDEX idx_asset_health_asset ON asset_health(asset_id);
CREATE INDEX idx_sensors_tenant ON sensors(tenant_id);
CREATE INDEX idx_sensors_asset ON sensors(asset_id);
CREATE INDEX idx_sensors_site ON sensors(site_id);
CREATE INDEX idx_sensor_readings_sensor ON sensor_readings(sensor_id);
CREATE INDEX idx_sensor_readings_time ON sensor_readings(recorded_at);
CREATE INDEX idx_alerts_tenant ON alerts(tenant_id);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_site ON alerts(site_id);
CREATE INDEX idx_maintenance_tenant ON maintenance_tasks(tenant_id);
CREATE INDEX idx_maintenance_status ON maintenance_tasks(status);
CREATE INDEX idx_maintenance_assigned ON maintenance_tasks(assigned_to);
CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- ==========================================
-- FUNCTIONS & TRIGGERS
-- ==========================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON sites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_sensors_updated_at BEFORE UPDATE ON sensors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_maintenance_updated_at BEFORE UPDATE ON maintenance_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==========================================
-- SEED DATA
-- ==========================================

-- Default Tenant
INSERT INTO tenants (id, name, slug, subscription_tier, max_users, max_sites, max_assets)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'CANUnited Demo',
    'demo',
    'enterprise',
    100,
    50,
    5000
);

-- Default Users (passwords are 'password123' hashed with bcrypt)
INSERT INTO users (id, tenant_id, email, username, password_hash, first_name, last_name, role, email_verified)
VALUES
    -- Administrator
    ('b0000000-0000-0000-0000-000000000001',
     'a0000000-0000-0000-0000-000000000001',
     'admin@canunited.com',
     'admin',
     '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.dXHqFqFJHcqzGq',
     'System',
     'Admin',
     'administrator',
     true),
    -- Analyst
    ('b0000000-0000-0000-0000-000000000002',
     'a0000000-0000-0000-0000-000000000001',
     'analyst@canunited.com',
     'analyst',
     '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.dXHqFqFJHcqzGq',
     'Data',
     'Analyst',
     'analyst',
     true),
    -- Technician
    ('b0000000-0000-0000-0000-000000000003',
     'a0000000-0000-0000-0000-000000000001',
     'tech@canunited.com',
     'technician',
     '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.dXHqFqFJHcqzGq',
     'Field',
     'Technician',
     'technician',
     true),
    -- Viewer
    ('b0000000-0000-0000-0000-000000000004',
     'a0000000-0000-0000-0000-000000000001',
     'viewer@canunited.com',
     'viewer',
     '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.dXHqFqFJHcqzGq',
     'Report',
     'Viewer',
     'viewer',
     true);

-- Default Sites
INSERT INTO sites (id, tenant_id, name, code, address, city, country, timezone, contact_name, contact_email)
VALUES
    ('c0000000-0000-0000-0000-000000000001',
     'a0000000-0000-0000-0000-000000000001',
     'Singapore Main Plant',
     'SGP-MAIN',
     '123 Industrial Avenue',
     'Singapore',
     'Singapore',
     'Asia/Singapore',
     'John Manager',
     'john@canunited.com'),
    ('c0000000-0000-0000-0000-000000000002',
     'a0000000-0000-0000-0000-000000000001',
     'Malaysia Factory',
     'MYS-FACT',
     '456 Manufacturing Road',
     'Johor Bahru',
     'Malaysia',
     'Asia/Kuala_Lumpur',
     'Ahmad Supervisor',
     'ahmad@canunited.com'),
    ('c0000000-0000-0000-0000-000000000003',
     'a0000000-0000-0000-0000-000000000001',
     'Thailand Distribution Center',
     'THA-DC',
     '789 Logistics Park',
     'Bangkok',
     'Thailand',
     'Asia/Bangkok',
     'Somchai Manager',
     'somchai@canunited.com');

-- Site Permissions for Users
INSERT INTO user_site_permissions (user_id, site_id, permissions)
VALUES
    -- Admin has all sites
    ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '{"read": true, "write": true, "delete": true}'),
    ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', '{"read": true, "write": true, "delete": true}'),
    ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', '{"read": true, "write": true, "delete": true}'),
    -- Analyst has all sites (read + write)
    ('b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', '{"read": true, "write": true, "delete": false}'),
    ('b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', '{"read": true, "write": true, "delete": false}'),
    ('b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', '{"read": true, "write": true, "delete": false}'),
    -- Technician only Singapore site
    ('b0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', '{"read": true, "write": true, "delete": false}'),
    -- Viewer only Singapore site (read only)
    ('b0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', '{"read": true, "write": false, "delete": false}');

-- Asset Types
INSERT INTO asset_types (id, tenant_id, name, category, icon)
VALUES
    ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Switchgear', 'Electrical', 'zap'),
    ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Transformer', 'Electrical', 'battery'),
    ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Circuit Breaker', 'Electrical', 'power'),
    ('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Motor', 'Mechanical', 'settings'),
    ('d0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'VFD', 'Electrical', 'activity');

-- Assets
INSERT INTO assets (id, tenant_id, site_id, asset_type_id, name, asset_tag, vendor, vendor_model, serial_number, status, installation_date, warranty_expiry, location, specifications, is_critical)
VALUES
    -- Singapore Site Assets
    ('e0000000-0000-0000-0000-000000000001',
     'a0000000-0000-0000-0000-000000000001',
     'c0000000-0000-0000-0000-000000000001',
     'd0000000-0000-0000-0000-000000000001',
     'SM6-24 MV Switchgear',
     'SGP-MVS-0001',
     'schneider',
     'SM6-24',
     'SE-SM6-2023-001',
     'operational',
     '2023-01-15',
     '2028-01-15',
     '{"building": "A", "floor": "1", "room": "MCC-01", "panel": "Panel 1"}',
     '{"rated_voltage": 24000, "rated_current": 630, "frequency": 50}',
     true),
    ('e0000000-0000-0000-0000-000000000002',
     'a0000000-0000-0000-0000-000000000001',
     'c0000000-0000-0000-0000-000000000001',
     'd0000000-0000-0000-0000-000000000003',
     'Masterpact MTZ1 Breaker',
     'SGP-CBR-0001',
     'schneider',
     'MTZ1-10H1',
     'SE-MTZ-2023-042',
     'needs_attention',
     '2023-03-20',
     '2028-03-20',
     '{"building": "A", "floor": "1", "room": "MCC-01", "panel": "Panel 1"}',
     '{"rated_current": 1000, "breaking_capacity": 65, "trip_unit": "Micrologic 6.0"}',
     true),
    ('e0000000-0000-0000-0000-000000000003',
     'a0000000-0000-0000-0000-000000000001',
     'c0000000-0000-0000-0000-000000000001',
     'd0000000-0000-0000-0000-000000000002',
     'Trihal Cast Resin Transformer',
     'SGP-TRF-0001',
     'schneider',
     'Trihal 1000kVA',
     'SE-TRH-2022-015',
     'operational',
     '2022-06-10',
     '2032-06-10',
     '{"building": "A", "floor": "B1", "room": "Transformer Room"}',
     '{"rated_power": 1000, "primary_voltage": 11000, "secondary_voltage": 400, "frequency": 50}',
     true),
    -- Malaysia Site Assets
    ('e0000000-0000-0000-0000-000000000004',
     'a0000000-0000-0000-0000-000000000001',
     'c0000000-0000-0000-0000-000000000002',
     'd0000000-0000-0000-0000-000000000001',
     'ABB UniGear ZS1',
     'MYS-MVS-0001',
     'abb',
     'UniGear ZS1',
     'ABB-UG-2023-008',
     'operational',
     '2023-02-01',
     '2028-02-01',
     '{"building": "Main", "floor": "1", "room": "Electrical Room"}',
     '{"rated_voltage": 17500, "rated_current": 2500}',
     true),
    ('e0000000-0000-0000-0000-000000000005',
     'a0000000-0000-0000-0000-000000000001',
     'c0000000-0000-0000-0000-000000000002',
     'd0000000-0000-0000-0000-000000000002',
     'ABB Resibloc Transformer',
     'MYS-TRF-0001',
     'abb',
     'Resibloc 630kVA',
     'ABB-RES-2022-023',
     'needs_attention',
     '2022-08-15',
     '2032-08-15',
     '{"building": "Main", "floor": "B1", "room": "Transformer Room"}',
     '{"rated_power": 630, "primary_voltage": 11000, "secondary_voltage": 400}',
     false),
    -- Thailand Site Assets
    ('e0000000-0000-0000-0000-000000000006',
     'a0000000-0000-0000-0000-000000000001',
     'c0000000-0000-0000-0000-000000000003',
     'd0000000-0000-0000-0000-000000000001',
     'Siemens SIVACON S8',
     'THA-MVS-0001',
     'siemens',
     'SIVACON S8',
     'SIE-S8-2023-011',
     'operational',
     '2023-04-01',
     '2028-04-01',
     '{"building": "DC1", "floor": "1", "room": "Power Room"}',
     '{"rated_voltage": 690, "rated_current": 6300}',
     true);

-- Asset Health Data
INSERT INTO asset_health (asset_id, overall_score, electrical_health, thermal_health, insulation_health, mechanical_health, remaining_useful_life, degradation_rate, failure_probability_30d, health_trend)
VALUES
    ('e0000000-0000-0000-0000-000000000001', 92, 95, 90, 88, 94, 915, 0.0007, 0.02, 'stable'),
    ('e0000000-0000-0000-0000-000000000002', 78, 82, 75, 72, 80, 456, 0.0015, 0.08, 'declining'),
    ('e0000000-0000-0000-0000-000000000003', 88, 90, 85, 92, 86, 1200, 0.0005, 0.03, 'stable'),
    ('e0000000-0000-0000-0000-000000000004', 95, 97, 93, 94, 96, 1500, 0.0004, 0.01, 'improving'),
    ('e0000000-0000-0000-0000-000000000005', 65, 70, 58, 62, 68, 280, 0.0025, 0.15, 'declining'),
    ('e0000000-0000-0000-0000-000000000006', 91, 93, 89, 90, 92, 1100, 0.0006, 0.02, 'stable');

-- Sensors
INSERT INTO sensors (id, tenant_id, asset_id, site_id, name, sensor_type, model, vendor, serial_number, protocol, is_online, battery_level, signal_strength, last_reading_value, last_reading_unit, last_reading_at)
VALUES
    ('f0000000-0000-0000-0000-000000000001',
     'a0000000-0000-0000-0000-000000000001',
     'e0000000-0000-0000-0000-000000000001',
     'c0000000-0000-0000-0000-000000000001',
     'Temperature Sensor 1',
     'temperature',
     'CL110',
     'schneider',
     'SE-CL110-001',
     'zigbee',
     true, 85, 92, 42.5, '°C', NOW()),
    ('f0000000-0000-0000-0000-000000000002',
     'a0000000-0000-0000-0000-000000000001',
     'e0000000-0000-0000-0000-000000000001',
     'c0000000-0000-0000-0000-000000000001',
     'Partial Discharge Sensor',
     'partial_discharge',
     'PD-SM6',
     'schneider',
     'SE-PD-001',
     'modbus_rtu',
     true, NULL, 95, 15.2, 'pC', NOW()),
    ('f0000000-0000-0000-0000-000000000003',
     'a0000000-0000-0000-0000-000000000001',
     'e0000000-0000-0000-0000-000000000002',
     'c0000000-0000-0000-0000-000000000001',
     'Current Sensor',
     'current',
     'PowerLogic',
     'schneider',
     'SE-PL-001',
     'modbus_tcp',
     true, NULL, 98, 245.8, 'A', NOW()),
    ('f0000000-0000-0000-0000-000000000004',
     'a0000000-0000-0000-0000-000000000001',
     'e0000000-0000-0000-0000-000000000003',
     'c0000000-0000-0000-0000-000000000001',
     'Oil Temperature Sensor',
     'temperature',
     'TH110',
     'schneider',
     'SE-TH-001',
     'lorawan',
     true, 72, 88, 55.3, '°C', NOW()),
    ('f0000000-0000-0000-0000-000000000005',
     'a0000000-0000-0000-0000-000000000001',
     'e0000000-0000-0000-0000-000000000004',
     'c0000000-0000-0000-0000-000000000002',
     'Vibration Sensor',
     'vibration',
     'VIB-100',
     'abb',
     'ABB-VIB-001',
     'wifi',
     true, 90, 85, 2.3, 'mm/s', NOW()),
    ('f0000000-0000-0000-0000-000000000006',
     'a0000000-0000-0000-0000-000000000001',
     'e0000000-0000-0000-0000-000000000005',
     'c0000000-0000-0000-0000-000000000002',
     'Temperature Humidity Sensor',
     'temperature_humidity',
     'TH-200',
     'abb',
     'ABB-TH-001',
     'zigbee',
     false, 15, 45, 38.2, '°C', NOW() - INTERVAL '2 hours');

-- Alerts
INSERT INTO alerts (id, tenant_id, asset_id, sensor_id, site_id, title, description, severity, status, trigger_value, threshold_value)
VALUES
    ('10000000-0000-0000-0000-000000000001',
     'a0000000-0000-0000-0000-000000000001',
     'e0000000-0000-0000-0000-000000000002',
     'f0000000-0000-0000-0000-000000000003',
     'c0000000-0000-0000-0000-000000000001',
     'High Current Detected',
     'Current reading exceeded threshold on Masterpact MTZ1 Breaker',
     'high',
     'active',
     245.8,
     200.0),
    ('10000000-0000-0000-0000-000000000002',
     'a0000000-0000-0000-0000-000000000001',
     'e0000000-0000-0000-0000-000000000005',
     'f0000000-0000-0000-0000-000000000006',
     'c0000000-0000-0000-0000-000000000002',
     'Sensor Offline',
     'Temperature Humidity Sensor has been offline for more than 1 hour',
     'medium',
     'active',
     NULL,
     NULL),
    ('10000000-0000-0000-0000-000000000003',
     'a0000000-0000-0000-0000-000000000001',
     'e0000000-0000-0000-0000-000000000005',
     NULL,
     'c0000000-0000-0000-0000-000000000002',
     'Low Health Score Warning',
     'ABB Resibloc Transformer health score dropped below 70%',
     'critical',
     'active',
     65,
     70);

-- Maintenance Tasks
INSERT INTO maintenance_tasks (id, tenant_id, asset_id, site_id, alert_id, title, description, task_type, priority, status, assigned_to, due_date, estimated_duration_hours, oem_service_required)
VALUES
    ('20000000-0000-0000-0000-000000000001',
     'a0000000-0000-0000-0000-000000000001',
     'e0000000-0000-0000-0000-000000000002',
     'c0000000-0000-0000-0000-000000000001',
     '10000000-0000-0000-0000-000000000001',
     'Inspect High Current Issue',
     'Investigate and resolve high current reading on Masterpact MTZ1 Breaker',
     'corrective',
     'high',
     'scheduled',
     'b0000000-0000-0000-0000-000000000003',
     CURRENT_DATE + INTERVAL '2 days',
     4.0,
     false),
    ('20000000-0000-0000-0000-000000000002',
     'a0000000-0000-0000-0000-000000000001',
     'e0000000-0000-0000-0000-000000000001',
     'c0000000-0000-0000-0000-000000000001',
     NULL,
     'Quarterly Preventive Maintenance',
     'Scheduled quarterly maintenance for SM6-24 MV Switchgear',
     'preventive',
     'medium',
     'scheduled',
     'b0000000-0000-0000-0000-000000000003',
     CURRENT_DATE + INTERVAL '7 days',
     8.0,
     true),
    ('20000000-0000-0000-0000-000000000003',
     'a0000000-0000-0000-0000-000000000001',
     'e0000000-0000-0000-0000-000000000005',
     'c0000000-0000-0000-0000-000000000002',
     '10000000-0000-0000-0000-000000000003',
     'Urgent Transformer Inspection',
     'Critical inspection required for ABB Resibloc Transformer due to low health score',
     'corrective',
     'urgent',
     'in_progress',
     'b0000000-0000-0000-0000-000000000003',
     CURRENT_DATE,
     6.0,
     true);

-- Generate Health History (last 30 days)
INSERT INTO asset_health_history (asset_id, health_score, recorded_at)
SELECT
    a.id,
    GREATEST(50, LEAST(100,
        CASE
            WHEN a.id = 'e0000000-0000-0000-0000-000000000001' THEN 92 + (random() * 4 - 2)
            WHEN a.id = 'e0000000-0000-0000-0000-000000000002' THEN 78 + (random() * 6 - 3) - (30 - generate_series) * 0.1
            WHEN a.id = 'e0000000-0000-0000-0000-000000000003' THEN 88 + (random() * 4 - 2)
            WHEN a.id = 'e0000000-0000-0000-0000-000000000004' THEN 95 + (random() * 3 - 1)
            WHEN a.id = 'e0000000-0000-0000-0000-000000000005' THEN 65 + (random() * 8 - 4) - (30 - generate_series) * 0.2
            ELSE 91 + (random() * 4 - 2)
        END
    ))::INTEGER,
    NOW() - (generate_series || ' days')::INTERVAL
FROM assets a, generate_series(0, 30)
WHERE a.tenant_id = 'a0000000-0000-0000-0000-000000000001';

COMMIT;
