#!/usr/bin/env node
import pkg from 'pg';
const { Pool } = pkg;

const isProduction = process.env.DATABASE_URL?.includes('railway.app') || process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

async function addAssetConnections() {
  const client = await pool.connect();

  try {
    console.log('🔗 Adding asset connections for topology...\n');

    // Get all sites
    const sitesResult = await client.query('SELECT id, name FROM sites ORDER BY name');
    const sites = sitesResult.rows;

    console.log(`Found ${sites.length} sites\n`);

    for (const site of sites) {
      console.log(`\n📍 Processing site: ${site.name}`);

      // Get assets for this site, ordered by type for logical connections
      const assetsResult = await client.query(`
        SELECT id, name, asset_type, vendor
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
      console.log(`  Found ${assets.length} assets`);

      if (assets.length < 2) {
        console.log('  ⚠️ Not enough assets for connections');
        continue;
      }

      // Group assets by type
      const byType = {};
      for (const asset of assets) {
        if (!byType[asset.asset_type]) {
          byType[asset.asset_type] = [];
        }
        byType[asset.asset_type].push(asset);
      }

      const connections = [];

      // Create logical electrical connections
      // Transformer -> Switchgear
      const transformers = byType['transformer'] || [];
      const switchgears = byType['mv_switchgear'] || [];
      const breakers = byType['circuit_breaker'] || [];
      const relays = byType['relay'] || [];
      const vfds = byType['vfd'] || [];
      const motors = byType['motor'] || [];
      const batteries = byType['battery_system'] || [];

      // Connect transformers to switchgears
      for (let i = 0; i < transformers.length && i < switchgears.length; i++) {
        connections.push({
          source: transformers[i].id,
          target: switchgears[i].id,
          relationship: 'feeds',
          type: 'electrical',
          critical: true
        });
      }

      // Connect switchgears to breakers
      let breakerIdx = 0;
      for (const sg of switchgears) {
        // Each switchgear feeds 2-3 breakers
        for (let i = 0; i < 3 && breakerIdx < breakers.length; i++, breakerIdx++) {
          connections.push({
            source: sg.id,
            target: breakers[breakerIdx].id,
            relationship: 'feeds',
            type: 'electrical',
            critical: i === 0 // First breaker is critical
          });
        }
      }

      // Connect breakers to VFDs and motors
      let vfdIdx = 0, motorIdx = 0;
      for (const breaker of breakers) {
        if (vfdIdx < vfds.length) {
          connections.push({
            source: breaker.id,
            target: vfds[vfdIdx++].id,
            relationship: 'feeds',
            type: 'electrical',
            critical: false
          });
        }
        if (motorIdx < motors.length) {
          connections.push({
            source: breaker.id,
            target: motors[motorIdx++].id,
            relationship: 'feeds',
            type: 'electrical',
            critical: false
          });
        }
      }

      // Connect VFDs to motors
      for (let i = 0; i < vfds.length && i < motors.length; i++) {
        connections.push({
          source: vfds[i].id,
          target: motors[i].id,
          relationship: 'controls',
          type: 'electrical',
          critical: false
        });
      }

      // Connect relays as monitoring connections
      for (let i = 0; i < relays.length && i < breakers.length; i++) {
        connections.push({
          source: relays[i].id,
          target: breakers[i].id,
          relationship: 'monitors',
          type: 'communication',
          critical: false
        });
      }

      // Connect batteries as backup
      for (let i = 0; i < batteries.length && i < switchgears.length; i++) {
        connections.push({
          source: batteries[i].id,
          target: switchgears[i].id,
          relationship: 'backup',
          type: 'electrical',
          critical: true
        });
      }

      // If we have assets but no connections based on type, create simple chain
      if (connections.length === 0 && assets.length >= 2) {
        for (let i = 0; i < assets.length - 1; i++) {
          connections.push({
            source: assets[i].id,
            target: assets[i + 1].id,
            relationship: 'connected',
            type: 'electrical',
            critical: i === 0
          });
        }
      }

      console.log(`  Creating ${connections.length} connections...`);

      // Insert connections
      for (const conn of connections) {
        try {
          await client.query(`
            INSERT INTO asset_connections (id, source_asset_id, target_asset_id, relationship, connection_type, is_critical_path)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
            ON CONFLICT (source_asset_id, target_asset_id) DO UPDATE
            SET relationship = $3, connection_type = $4, is_critical_path = $5
          `, [conn.source, conn.target, conn.relationship, conn.type, conn.critical]);
        } catch (err) {
          // Ignore duplicate errors
          if (!err.message.includes('duplicate')) {
            console.error(`  Error: ${err.message}`);
          }
        }
      }

      console.log(`  ✅ ${connections.length} connections created`);
    }

    // Summary
    const totalConnections = await client.query('SELECT COUNT(*) FROM asset_connections');
    console.log(`\n✅ Total asset connections in database: ${totalConnections.rows[0].count}`);

  } finally {
    client.release();
    await pool.end();
  }
}

addAssetConnections().catch(console.error);
