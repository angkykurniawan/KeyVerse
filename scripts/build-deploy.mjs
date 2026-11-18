import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.cwd());
const distDir = join(root, 'dist');
const apiDir = join(root, 'api');
const outDir = join(root, 'deploy_htdocs');

if (!existsSync(distDir)) {
  console.error('Folder dist/ tidak ditemukan. Jalankan "npm run build" terlebih dahulu.');
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// 1. Salin seluruh hasil build React (termasuk public/.htaccess) ke deploy_htdocs/
cpSync(distDir, outDir, { recursive: true });

// 2. Salin PHP REST API ke deploy_htdocs/api/ (kecuali .env lokal & file sqlite)
const targetApiDir = join(outDir, 'api');
cpSync(apiDir, targetApiDir, {
  recursive: true,
  filter: (src) => {
    const normalized = src.replace(/\\/g, '/');
    if (normalized.endsWith('/.env') || normalized.endsWith('/router.php')) return false;
    if (normalized.includes('/storage/') || normalized.endsWith('/storage')) return false;
    return true;
  },
});

// 3. Salin .env.example ke deploy_htdocs/api/.env.example sebagai template
const envExample = join(root, '.env.example');
if (existsSync(envExample)) {
  cpSync(envExample, join(targetApiDir, '.env.example'));
}

console.log('Berhasil membuat paket deploy InfinityFree di: deploy_htdocs/');
console.log('Langkah berikutnya:');
console.log('1. Upload seluruh isi folder deploy_htdocs/ ke htdocs/ di InfinityFree.');
console.log('2. Buat file htdocs/api/.env (dari .env.example) dan isi DB InfinityFree, JWT_SECRET, dan GEMINI_API_KEY.');
console.log('3. Import database/schema_infinityfree.sql melalui phpMyAdmin InfinityFree.');
