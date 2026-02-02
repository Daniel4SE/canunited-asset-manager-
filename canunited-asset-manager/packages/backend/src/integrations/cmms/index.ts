import type { CMSSAdapter, CMSSConfig, CMSSType } from './types.js';
import { SapPmAdapter } from './adapters/sap-pm.adapter.js';
import { MaximoAdapter } from './adapters/maximo.adapter.js';
import { ServiceNowAdapter } from './adapters/servicenow.adapter.js';

export * from './types.js';

/**
 * CMMS Adapter Factory
 * Creates the appropriate adapter based on CMMS type
 */
export function createCMSSAdapter(config: CMSSConfig): CMSSAdapter {
  switch (config.type) {
    case 'sap_pm':
      return new SapPmAdapter(config);
    case 'maximo':
      return new MaximoAdapter(config);
    case 'servicenow':
      return new ServiceNowAdapter(config);
    default:
      throw new Error(`Unsupported CMMS type: ${config.type}`);
  }
}

/**
 * Get supported CMMS types
 */
export function getSupportedCMSSTypes(): Array<{ type: CMSSType; name: string; description: string }> {
  return [
    {
      type: 'sap_pm',
      name: 'SAP Plant Maintenance',
      description: 'Integration with SAP PM module for enterprise asset management',
    },
    {
      type: 'maximo',
      name: 'IBM Maximo',
      description: 'Integration with IBM Maximo Asset Management',
    },
    {
      type: 'servicenow',
      name: 'ServiceNow',
      description: 'Integration with ServiceNow ITOM/ITSM',
    },
  ];
}

/**
 * Validate CMMS configuration
 */
export function validateCMSSConfig(config: CMSSConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.type) {
    errors.push('CMMS type is required');
  }

  if (!config.apiUrl) {
    errors.push('API URL is required');
  } else {
    try {
      new URL(config.apiUrl);
    } catch {
      errors.push('Invalid API URL format');
    }
  }

  if (!config.credentials) {
    errors.push('Credentials are required');
  } else {
    // Check for required credentials based on type
    if (config.type === 'sap_pm') {
      if (!config.credentials.username || !config.credentials.password) {
        errors.push('SAP PM requires username and password');
      }
    } else if (config.type === 'maximo') {
      if (!config.credentials.apiKey && (!config.credentials.username || !config.credentials.password)) {
        errors.push('Maximo requires API key or username/password');
      }
    } else if (config.type === 'servicenow') {
      if (!config.credentials.clientId || !config.credentials.clientSecret) {
        errors.push('ServiceNow requires OAuth client ID and secret');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Re-export adapters for direct use if needed
export { SapPmAdapter } from './adapters/sap-pm.adapter.js';
export { MaximoAdapter } from './adapters/maximo.adapter.js';
export { ServiceNowAdapter } from './adapters/servicenow.adapter.js';
