import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { pool, query } from './connection.js';
import { VendorType, AssetType, SensorType, ProtocolType, AlertSeverity } from '../types/index.js';

async function seed() {
  console.log('🌱 Starting database seed...');

  try {
    // Create demo organization
    const orgId = uuidv4();
    await query(
      `INSERT INTO organizations (id, name, subscription_tier, settings)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [orgId, 'CANUnited Demo Corp', 'enterprise', JSON.stringify({
        default_language: 'en',
        timezone: 'Asia/Singapore',
        health_thresholds: { excellent_min: 80, good_min: 60, fair_min: 40, poor_min: 20 }
      })]
    );
    console.log('✅ Created organization');

    // Create demo users (matching frontend authStore demoUsers)
    const passwordHash = await bcrypt.hash('password123', 12);
    const users = [
      { email: 'admin@canunited.com', name: 'System Admin', role: 'administrator' },
      { email: 'analyst@canunited.com', name: 'Data Analyst', role: 'analyst' },
      { email: 'tech@canunited.com', name: 'Field Technician', role: 'technician' },
      { email: 'viewer@canunited.com', name: 'Report Viewer', role: 'viewer' },
    ];

    for (const user of users) {
      await query(
        `INSERT INTO users (id, organization_id, email, password_hash, name, role, site_access)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (email) DO NOTHING`,
        [uuidv4(), orgId, user.email, passwordHash, user.name, user.role, ['*']]
      );
    }
    console.log('✅ Created users');

    // Create demo sites
    const sites = [
      { name: 'Singapore Main Plant', code: 'SGP-001', city: 'Singapore', country: 'Singapore' },
      { name: 'Malaysia Factory', code: 'MYS-001', city: 'Kuala Lumpur', country: 'Malaysia' },
      { name: 'Thailand Facility', code: 'THA-001', city: 'Bangkok', country: 'Thailand' },
    ];

    const siteIds: string[] = [];
    for (const site of sites) {
      const siteId = uuidv4();
      siteIds.push(siteId);
      await query(
        `INSERT INTO sites (id, organization_id, name, code, address, timezone)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [siteId, orgId, site.name, site.code, JSON.stringify({
          street: '123 Industrial Ave',
          city: site.city,
          country: site.country,
          postalCode: '123456'
        }), 'Asia/Singapore']
      );
    }
    console.log('✅ Created sites');

    // Create demo assets with various vendors and health states
    const assetTemplates = [
      // Schneider assets
      { vendor: VendorType.SCHNEIDER, type: AssetType.MV_SWITCHGEAR, model: 'SM6-24', health: 92 },
      { vendor: VendorType.SCHNEIDER, type: AssetType.CIRCUIT_BREAKER, model: 'Masterpact MTZ1', health: 87 },
      { vendor: VendorType.SCHNEIDER, type: AssetType.TRANSFORMER, model: 'Trihal Cast Resin', health: 78 },
      { vendor: VendorType.SCHNEIDER, type: AssetType.LV_PANEL, model: 'Prisma iPM', health: 95 },
      
      // ABB assets
      { vendor: VendorType.ABB, type: AssetType.CIRCUIT_BREAKER, model: 'Emax 2', health: 85 },
      { vendor: VendorType.ABB, type: AssetType.TRANSFORMER, model: 'Resibloc', health: 45 },
      { vendor: VendorType.ABB, type: AssetType.VFD, model: 'ACS880', health: 72 },
      
      // Siemens assets
      { vendor: VendorType.SIEMENS, type: AssetType.CIRCUIT_BREAKER, model: '3WL', health: 88 },
      { vendor: VendorType.SIEMENS, type: AssetType.MV_SWITCHGEAR, model: 'NXPLUS C', health: 91 },
      { vendor: VendorType.SIEMENS, type: AssetType.METER, model: 'SENTRON PAC4200', health: 98 },
      
      // Eaton assets
      { vendor: VendorType.EATON, type: AssetType.CIRCUIT_BREAKER, model: 'Power Defense', health: 65 },
      { vendor: VendorType.EATON, type: AssetType.BUSWAY, model: 'Pow-R-Way III', health: 82 },
      
      // Bosch sensors
      { vendor: VendorType.BOSCH, type: AssetType.SENSOR, model: 'CISS Multi-Sensor', health: 99 },
      
      // Critical/failing assets for demo
      { vendor: VendorType.SCHNEIDER, type: AssetType.CIRCUIT_BREAKER, model: 'ComPact NSX', health: 25 },
      { vendor: VendorType.ABB, type: AssetType.VFD, model: 'ACS580', health: 35 },
    ];

    const assetIds: string[] = [];
    let assetSeq = 1;

    for (const siteId of siteIds) {
      const siteResult = await query<{ code: string }>('SELECT code FROM sites WHERE id = $1', [siteId]);
      const siteCode = siteResult.rows[0].code;

      for (const template of assetTemplates) {
        const assetId = uuidv4();
        assetIds.push(assetId);
        
        const assetTag = `${siteCode}-${template.type.substring(0, 3).toUpperCase()}-${String(assetSeq++).padStart(4, '0')}`;
        
        // Randomize health a bit
        const healthVariation = Math.floor(Math.random() * 10) - 5;
        const healthScore = Math.max(10, Math.min(100, template.health + healthVariation));
        
        await query(
          `INSERT INTO assets (
            id, site_id, organization_id, name, asset_tag, asset_type, vendor, vendor_model,
            installation_date, health_score, electrical_health, thermal_health, 
            insulation_health, mechanical_health, health_trend, remaining_useful_life
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT DO NOTHING`,
          [
            assetId, siteId, orgId,
            `${template.model} - ${assetTag}`,
            assetTag,
            template.type,
            template.vendor,
            template.model,
            new Date(Date.now() - Math.random() * 5 * 365 * 24 * 60 * 60 * 1000), // Random install date within 5 years
            healthScore,
            healthScore + Math.floor(Math.random() * 10) - 5,
            healthScore + Math.floor(Math.random() * 10) - 5,
            healthScore + Math.floor(Math.random() * 10) - 5,
            healthScore + Math.floor(Math.random() * 10) - 5,
            healthScore < 50 ? 'degrading' : healthScore > 80 ? 'stable' : 'stable',
            Math.floor(healthScore * 10) // RUL in days
          ]
        );
      }
    }
    console.log('✅ Created assets');

    // Create asset connections (electrical topology)
    for (let i = 0; i < assetIds.length - 1; i += 3) {
      if (assetIds[i + 1]) {
        await query(
          `INSERT INTO asset_connections (id, source_asset_id, target_asset_id, relationship, connection_type, is_critical_path)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT DO NOTHING`,
          [uuidv4(), assetIds[i], assetIds[i + 1], 'feeds', 'electrical', Math.random() > 0.7]
        );
      }
      if (assetIds[i + 2]) {
        await query(
          `INSERT INTO asset_connections (id, source_asset_id, target_asset_id, relationship, connection_type, is_critical_path)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT DO NOTHING`,
          [uuidv4(), assetIds[i + 1], assetIds[i + 2], 'feeds', 'electrical', false]
        );
      }
    }
    console.log('✅ Created asset connections');

    // Create gateways
    for (const siteId of siteIds) {
      const gatewayId = uuidv4();
      await query(
        `INSERT INTO gateways (id, site_id, organization_id, name, vendor, model, protocols, is_online, edge_analytics_enabled)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT DO NOTHING`,
        [
          gatewayId, siteId, orgId,
          'PAS600 Edge Gateway',
          VendorType.SCHNEIDER,
          'PAS600',
          [ProtocolType.MODBUS_TCP, ProtocolType.MQTT, ProtocolType.ZIGBEE],
          true,
          true
        ]
      );
    }
    console.log('✅ Created gateways');

    // Create sensors
    const sensorTypes = [
      { type: SensorType.TEMPERATURE_HUMIDITY, vendor: VendorType.SCHNEIDER, model: 'CL110' },
      { type: SensorType.PARTIAL_DISCHARGE, vendor: VendorType.SCHNEIDER, model: 'Easergy PD' },
      { type: SensorType.HEAT_TAG, vendor: VendorType.SCHNEIDER, model: 'HeatTag' },
      { type: SensorType.VIBRATION, vendor: VendorType.BOSCH, model: 'CISS Vibration' },
      { type: SensorType.CURRENT, vendor: VendorType.GENERIC, model: 'CT-100A' },
    ];

    for (let i = 0; i < Math.min(assetIds.length, 20); i++) {
      const sensor = sensorTypes[i % sensorTypes.length];
      const sensorId = uuidv4();
      
      // Get the site_id for this asset
      const assetResult = await query<{ site_id: string }>('SELECT site_id FROM assets WHERE id = $1', [assetIds[i]]);
      if (assetResult.rows.length === 0) continue;
      
      await query(
        `INSERT INTO sensors (id, site_id, organization_id, name, sensor_type, vendor, model, protocol, assigned_asset_id, is_online, battery_level, signal_strength)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT DO NOTHING`,
        [
          sensorId,
          assetResult.rows[0].site_id,
          orgId,
          `${sensor.model} - Sensor ${i + 1}`,
          sensor.type,
          sensor.vendor,
          sensor.model,
          sensor.vendor === VendorType.SCHNEIDER ? ProtocolType.ZIGBEE : ProtocolType.MODBUS_TCP,
          assetIds[i],
          Math.random() > 0.1, // 90% online
          Math.floor(Math.random() * 50) + 50, // 50-100%
          Math.floor(Math.random() * 30) + 70  // 70-100
        ]
      );
    }
    console.log('✅ Created sensors');

    // Create sample alerts
    const alertTemplates = [
      { severity: AlertSeverity.CRITICAL, title: 'High Temperature Detected', category: 'thermal' },
      { severity: AlertSeverity.HIGH, title: 'Partial Discharge Activity', category: 'insulation' },
      { severity: AlertSeverity.MEDIUM, title: 'Breaker Operation Count High', category: 'mechanical' },
      { severity: AlertSeverity.LOW, title: 'Scheduled Maintenance Approaching', category: 'maintenance' },
      { severity: AlertSeverity.INFO, title: 'Sensor Battery Low', category: 'sensor' },
    ];

    for (let i = 0; i < 10; i++) {
      const template = alertTemplates[i % alertTemplates.length];
      const assetResult = await query<{ site_id: string }>('SELECT site_id FROM assets WHERE id = $1', [assetIds[i % assetIds.length]]);
      if (assetResult.rows.length === 0) continue;
      
      await query(
        `INSERT INTO alerts (id, organization_id, site_id, asset_id, severity, status, title, description, category, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT DO NOTHING`,
        [
          uuidv4(),
          orgId,
          assetResult.rows[0].site_id,
          assetIds[i % assetIds.length],
          template.severity,
          i < 5 ? 'active' : 'acknowledged',
          template.title,
          `Automated alert generated for asset monitoring. ${template.title} - requires attention.`,
          template.category,
          'system'
        ]
      );
    }
    console.log('✅ Created alerts');

    // Create maintenance tasks
    const maintenanceTemplates = [
      { type: 'preventive', title: 'Annual Breaker Inspection', priority: 'medium' },
      { type: 'predictive', title: 'Thermal Scan Required', priority: 'high' },
      { type: 'corrective', title: 'Replace Worn Contacts', priority: 'urgent' },
      { type: 'inspection', title: 'Visual Inspection', priority: 'low' },
    ];

    for (let i = 0; i < 8; i++) {
      const template = maintenanceTemplates[i % maintenanceTemplates.length];
      const assetResult = await query<{ site_id: string; vendor: string }>('SELECT site_id, vendor FROM assets WHERE id = $1', [assetIds[i]]);
      if (assetResult.rows.length === 0) continue;
      
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + Math.floor(Math.random() * 30));
      const dueDate = new Date(scheduledDate);
      dueDate.setDate(dueDate.getDate() + 7);
      
      await query(
        `INSERT INTO maintenance_tasks (
          id, organization_id, site_id, asset_id, title, description, task_type, priority,
          status, scheduled_date, due_date, oem_service_required, oem_vendor
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT DO NOTHING`,
        [
          uuidv4(),
          orgId,
          assetResult.rows[0].site_id,
          assetIds[i],
          template.title,
          `${template.title} - scheduled maintenance task`,
          template.type,
          template.priority,
          i < 2 ? 'in_progress' : 'scheduled',
          scheduledDate,
          dueDate,
          Math.random() > 0.5,
          assetResult.rows[0].vendor
        ]
      );
    }
    console.log('✅ Created maintenance tasks');

    // Generate some historical health data
    const now = new Date();
    for (let i = 0; i < Math.min(assetIds.length, 10); i++) {
      for (let day = 30; day >= 0; day--) {
        const timestamp = new Date(now);
        timestamp.setDate(timestamp.getDate() - day);
        
        const baseHealth = 70 + Math.random() * 20;
        await query(
          `INSERT INTO asset_health_history (asset_id, timestamp, health_score, electrical_health, thermal_health, insulation_health, mechanical_health)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT DO NOTHING`,
          [
            assetIds[i],
            timestamp,
            baseHealth + (day * 0.3), // Slight degradation over time
            baseHealth + Math.random() * 10,
            baseHealth + Math.random() * 10,
            baseHealth + Math.random() * 10,
            baseHealth + Math.random() * 10
          ]
        );
      }
    }
    console.log('✅ Created health history');

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📧 Demo accounts created:');
    console.log('   admin@canunited.demo / demo123456 (Admin)');
    console.log('   engineer@canunited.demo / demo123456 (Reliability Engineer)');
    console.log('   manager@canunited.demo / demo123456 (Asset Manager)');
    console.log('   tech@canunited.demo / demo123456 (Field Technician)');
    
  } catch (error) {
    console.error('❌ Seeding error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

seed().catch(console.error);
