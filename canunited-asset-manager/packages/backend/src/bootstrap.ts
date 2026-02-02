/**
 * Bootstrap script that chooses the right server based on environment
 * - With DATABASE_URL: Use full server with PostgreSQL
 * - Without DATABASE_URL: Use demo mode with in-memory data
 */

const hasDatabase = !!process.env.DATABASE_URL;

console.log(`🔄 Starting in ${hasDatabase ? 'PRODUCTION' : 'DEMO'} mode...`);

if (hasDatabase) {
  // Production mode with database
  import('./server.js').catch((err) => {
    console.error('Failed to start production server:', err);
    console.log('⚠️ Falling back to demo mode...');
    import('./index.js');
  });
} else {
  // Demo mode without database
  import('./index.js');
}
