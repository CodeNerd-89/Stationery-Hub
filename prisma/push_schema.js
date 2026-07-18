const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');

  const client = new Client({
    host: '13.214.97.86',
    port: 5432,
    user: 'stationaryhub_user',
    password: 'QTa0fBykqJzPsZM9aLTR6gtTp4eJRQ1X',
    database: 'stationaryhub',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });

  try {
    console.log('Connecting to Render PostgreSQL...');
    await client.connect();
    console.log('Connected! Running schema...');
    await client.query(sql);
    console.log('✅ Schema pushed successfully!');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

main();
