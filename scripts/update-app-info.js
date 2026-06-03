import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  console.log('🔄 开始更新应用信息...');
  
  // 读取package.json中的版本信息
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  console.log('📦 读取 package.json:', packageJsonPath);
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  console.log('   Package.json 版本:', packageJson.version);

  // 读取tauri.conf.json中的版本信息
  const tauriConfigPath = path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json');
  console.log('⚙️  读取 tauri.conf.json:', tauriConfigPath);
  const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));
  console.log('   Tauri 版本:', tauriConfig.version);

  // 获取版本信息
  const version = tauriConfig.version || packageJson.version;
  const productName = tauriConfig.productName || packageJson.name;

  console.log('📋 最终版本信息:');
  console.log('   应用名称:', productName);
  console.log('   版本号:', version);

  // 读取应用信息配置文件
  const appInfoPath = path.join(__dirname, '..', 'src', 'config', 'app-info.ts');
  console.log('📝 读取应用信息配置:', appInfoPath);
  let appInfoContent = fs.readFileSync(appInfoPath, 'utf8');

  // 更新版本信息
  const oldVersionMatch = appInfoContent.match(/version: "[^"]*"/);
  const oldNameMatch = appInfoContent.match(/name: "[^"]*"/);
  
  if (oldVersionMatch) {
    console.log('   原版本:', oldVersionMatch[0]);
  }
  if (oldNameMatch) {
    console.log('   原名称:', oldNameMatch[0]);
  }

  appInfoContent = appInfoContent.replace(
    /version: "[^"]*"/,
    `version: "${version}"`
  );

  // name 字段保持手动设置，不再自动覆盖

  // 写回文件
  fs.writeFileSync(appInfoPath, appInfoContent);
  console.log('💾 已保存更新后的配置');

  console.log(`✅ 应用信息更新完成: ${productName} v${version}`);
} catch (error) {
  console.error('❌ 更新应用信息时出错:', error.message);
  process.exit(1);
} 