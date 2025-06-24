import fs from 'fs';
import path from 'path';

const samplePath = path.resolve(__dirname, '../.env.sample');
const envPath = path.resolve(__dirname, '../.env');

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf-8');
  return Object.fromEntries(
    content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(line => {
        const [key, ...rest] = line.split('=');
        return [key, rest.join('=')];
      })
  );
}

const sampleVars = parseEnvFile(samplePath);
const envVars = parseEnvFile(envPath);

const missing = Object.keys(sampleVars).filter(
  key => !(key in envVars) || !envVars[key]
);

if (missing.length === 0) {
  console.log('✅ All required environment variables are present in .env');
} else {
  console.warn('⚠️  Missing or empty environment variables in .env:');
  missing.forEach(key => console.warn(`  - ${key}`));
  process.exitCode = 1;
}
