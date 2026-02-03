#!/usr/bin/env node
/**
 * Database Migration Script
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." node scripts/run-migrations.mjs
 *
 * Or with Railway:
 *   railway run node scripts/run-migrations.mjs
 */

import pkg from 'pg';
const { Pool } = pkg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  console.log('\nUsage:');
  console.log('  DATABASE_URL="postgresql://..." node scripts/run-migrations.mjs');
  console.log('\nOr with Railway CLI:');
  console.log('  railway run node scripts/run-migrations.mjs');
  process.exit(1);
}

const isProduction = DATABASE_URL.includes('railway.app') || DATABASE_URL.includes('aws') || DATABASE_URL.includes('azure');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

async function runMigrations() {
  const client = await pool.connect();

  try {
    console.log('🚀 Running database migrations...\n');

    // 1. Add details column to audit_logs
    console.log('📦 Migration 1: audit_logs.details column');
    await client.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details JSONB;`);
    await client.query(`ALTER TABLE audit_logs ALTER COLUMN tenant_id DROP NOT NULL;`);
    console.log('   ✅ Done\n');

    // 2. Add organization_id to sensors
    console.log('📦 Migration 2: sensors.organization_id column');
    await client.query(`
      ALTER TABLE sensors ADD COLUMN IF NOT EXISTS organization_id UUID;
      UPDATE sensors SET organization_id = tenant_id WHERE organization_id IS NULL;
    `);
    console.log('   ✅ Done\n');

    // 3. Add organization_id to maintenance_tasks
    console.log('📦 Migration 3: maintenance_tasks columns');
    await client.query(`
      ALTER TABLE maintenance_tasks ADD COLUMN IF NOT EXISTS organization_id UUID;
      UPDATE maintenance_tasks SET organization_id = tenant_id WHERE organization_id IS NULL;
    `);
    await client.query(`
      ALTER TABLE maintenance_tasks ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE maintenance_tasks ADD COLUMN IF NOT EXISTS actual_duration_hours DECIMAL(5, 2);
    `);
    console.log('   ✅ Done\n');

    // 4. Add missing columns to alerts table
    console.log('📦 Migration 4: alerts table columns');
    await client.query(`
      ALTER TABLE alerts ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'system';
      ALTER TABLE alerts ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'system';
      ALTER TABLE alerts ADD COLUMN IF NOT EXISTS triggered_at TIMESTAMPTZ;
      ALTER TABLE alerts ADD COLUMN IF NOT EXISTS organization_id UUID;
    `);
    await client.query(`UPDATE alerts SET triggered_at = created_at WHERE triggered_at IS NULL;`);
    await client.query(`UPDATE alerts SET organization_id = tenant_id WHERE organization_id IS NULL;`);
    console.log('   ✅ Done\n');

    // 5. Add organization_id to sites
    console.log('📦 Migration 5: sites.organization_id column');
    await client.query(`
      ALTER TABLE sites ADD COLUMN IF NOT EXISTS organization_id UUID;
      UPDATE sites SET organization_id = tenant_id WHERE organization_id IS NULL;
    `);
    console.log('   ✅ Done\n');

    // 6. Add columns to assets
    console.log('📦 Migration 6: assets table columns');
    await client.query(`
      ALTER TABLE assets ADD COLUMN IF NOT EXISTS organization_id UUID;
      ALTER TABLE assets ADD COLUMN IF NOT EXISTS asset_type VARCHAR(50);
      ALTER TABLE assets ADD COLUMN IF NOT EXISTS health_score INTEGER;
      ALTER TABLE assets ADD COLUMN IF NOT EXISTS health_status VARCHAR(20);
    `);
    await client.query(`UPDATE assets SET organization_id = tenant_id WHERE organization_id IS NULL;`);
    console.log('   ✅ Done\n');

    // 7. Update health_score and health_status from asset_health
    console.log('📦 Migration 7: Syncing asset health data');
    await client.query(`
      UPDATE assets a SET
        health_score = ah.overall_score,
        health_status = CASE
          WHEN ah.overall_score >= 85 THEN 'excellent'
          WHEN ah.overall_score >= 70 THEN 'good'
          WHEN ah.overall_score >= 50 THEN 'fair'
          WHEN ah.overall_score >= 30 THEN 'poor'
          ELSE 'critical'
        END
      FROM asset_health ah
      WHERE ah.asset_id = a.id
      AND (a.health_score IS NULL OR a.health_status IS NULL);
    `);
    console.log('   ✅ Done\n');

    // 8. Create asset connections for topology
    console.log('📦 Migration 8: Creating asset connections for topology');
    const existing = await client.query('SELECT COUNT(*) FROM asset_connections');
    if (parseInt(existing.rows[0].count) > 0) {
      console.log(`   ⏭️  Skipped (${existing.rows[0].count} connections already exist)\n`);
    } else {
      await createAssetConnections(client);
      const total = await client.query('SELECT COUNT(*) FROM asset_connections');
      console.log(`   ✅ Created ${total.rows[0].count} connections\n`);
    }

    console.log('✅ All migrations completed successfully!\n');

    // Print summary
    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM sites) as sites,
        (SELECT COUNT(*) FROM assets) as assets,
        (SELECT COUNT(*) FROM sensors) as sensors,
        (SELECT COUNT(*) FROM alerts) as alerts,
        (SELECT COUNT(*) FROM maintenance_tasks) as maintenance,
        (SELECT COUNT(*) FROM asset_connections) as connections
    `);

    console.log('📊 Database Summary:');
    console.log(`   Sites: ${counts.rows[0].sites}`);
    console.log(`   Assets: ${counts.rows[0].assets}`);
    console.log(`   Sensors: ${counts.rows[0].sensors}`);
    console.log(`   Alerts: ${counts.rows[0].alerts}`);
    console.log(`   Maintenance Tasks: ${counts.rows[0].maintenance}`);
    console.log(`   Asset Connections: ${counts.rows[0].connections}`);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function createAssetConnections(client) {
  const sitesResult = await client.query('SELECT id FROM sites');

  for (const site of sitesResult.rows) {
    const assetsResult = await client.query(`
      SELECT id, name, asset_type
      FROM assets
      WHERE site_id = $1
      ORDER BY
        CASE asset_type
          WHEN 'transformer' THEN 1
          WHEN 'mv_switchgear' THEN 2
          WHEN 'circuit_breaker' THEN 3
          WHEN 'relay' THEN 4
          WHEN 'vfd' THEN 5
          WHEN 'motor' THEN 6
          WHEN 'battery_system' THEN 7
          ELSE 8
        END,
        name
    `, [site.id]);

    const assets = assetsResult.rows;
    if (assets.length < 2) continue;

    const byType = {};
    for (const asset of assets) {
      if (!byType[asset.asset_type]) byType[asset.asset_type] = [];
      byType[asset.asset_type].push(asset);
    }

    const connections = [];

    const transformers = byType['transformer'] || [];
    const switchgears = byType['mv_switchgear'] || byType['switchgear'] || [];
    const breakers = byType['circuit_breaker'] || [];
    const vfds = byType['vfd'] || [];
    const motors = byType['motor'] || [];
    const batteries = byType['battery_system'] || [];

    // Transformer -> Switchgear
    for (let i = 0; i < transformers.length && i < switchgears.length; i++) {
      connections.push({ source: transformers[i].id, target: switchgears[i].id, rel: 'feeds', type: 'electrical', critical: true });
    }

    // Switchgear -> Breakers
    let breakerIdx = 0;
    for (const sg of switchgears) {
      for (let i = 0; i < 3 && breakerIdx < breakers.length; i++, breakerIdx++) {
        connections.push({ source: sg.id, target: breakers[breakerIdx].id, rel: 'feeds', type: 'electrical', critical: i === 0 });
      }
    }

    // Breakers -> VFDs/Motors
    let vfdIdx = 0, motorIdx = 0;
    for (const breaker of breakers) {
      if (vfdIdx < vfds.length) {
        connections.push({ source: breaker.id, target: vfds[vfdIdx++].id, rel: 'feeds', type: 'electrical', critical: false });
      }
      if (motorIdx < motors.length) {
        connections.push({ source: breaker.id, target: motors[motorIdx++].id, rel: 'feeds', type: 'electrical', critical: false });
      }
    }

    // VFDs -> Motors
    for (let i = 0; i < vfds.length && i < motors.length; i++) {
      connections.push({ source: vfds[i].id, target: motors[i].id, rel: 'controls', type: 'electrical', critical: false });
    }

    // Batteries -> Switchgears
    for (let i = 0; i < batteries.length && i < switchgears.length; i++) {
      connections.push({ source: batteries[i].id, target: switchgears[i].id, rel: 'backup', type: 'electrical', critical: true });
    }

    // Fallback: chain assets
    if (connections.length === 0) {
      for (let i = 0; i < assets.length - 1; i++) {
        connections.push({ source: assets[i].id, target: assets[i + 1].id, rel: 'connected', type: 'electrical', critical: i === 0 });
      }
    }

    for (const conn of connections) {
      try {
        await client.query(`
          INSERT INTO asset_connections (id, source_asset_id, target_asset_id, relationship, connection_type, is_critical_path)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
          ON CONFLICT (source_asset_id, target_asset_id) DO NOTHING
        `, [conn.source, conn.target, conn.rel, conn.type, conn.critical]);
      } catch (err) {
        // Ignore duplicate errors
      }
    }
  }
}

runMigrations().catch(err => {
  console.error(err);
  process.exit(1);
});
