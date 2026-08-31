// 统一 Tauri 构建/运行入口：
//   先探测并设置 Rust/Android 环境（cargo PATH、ANDROID_HOME、JAVA_HOME），
//   再调用 @tauri-apps/cli。这样 npm scripts 在任何机器上都能直接跑，
//   不需要用户手动配全局环境变量。
//
// 用法：
//   node scripts/run-tauri.js dev        -> tauri dev            （PC 开发模式）
//   node scripts/run-tauri.js build      -> tauri build          （PC 打包）
//   node scripts/run-tauri.js android    -> tauri android build --apk（Android APK）
//   node scripts/run-tauri.js android:dev-> tauri android dev    （Android 开发/模拟器）
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CARGO_BIN = path.join(os.homedir(), '.cargo', 'bin');

// ---- 环境探测 ----
function detectAndroidHome() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk') : null,
    path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk'),
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(path.join(c, 'platforms'))) return c;
  }
  return null;
}

function detectJavaHome() {
  const candidates = [
    process.env.JAVA_HOME,
    path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Eclipse Adoptium'),
    path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Java'),
    'C:\\Program Files\\Microsoft\\jdk-17',
  ];
  // 若 JAVA_HOME 已设置且存在 bin/java.exe 直接用
  for (const c of candidates) {
    if (!c) continue;
    if (fs.existsSync(path.join(c, 'bin', 'java.exe'))) return c;
    // Program Files 下的目录：找子目录
    if (fs.existsSync(c)) {
      try {
        const subs = fs.readdirSync(c);
        for (const s of subs) {
          const p = path.join(c, s);
          if (fs.existsSync(path.join(p, 'bin', 'java.exe'))) return p;
        }
      } catch (e) { /* ignore */ }
    }
  }
  return null;
}

const command = process.argv[2];
if (!command) {
  console.error('用法: node scripts/run-tauri.js <dev|build|android|android:dev>');
  process.exit(1);
}

// ---- 组装 tauri CLI 参数 ----
const tauriArgs = {
  dev: ['dev'],
  build: ['build'],
  android: ['android', 'build', '--apk'],
  'android:dev': ['android', 'dev'],
}[command];
if (!tauriArgs) {
  console.error('未知命令: ' + command);
  process.exit(1);
}

// ---- 设置环境 ----
const env = { ...process.env };
// 保证 PATH 至少包含 cargo、node 与系统基础目录（后台/受限 shell 里 env.PATH 可能为空）
const nodeBin = path.dirname(process.execPath);
const basePath = [
  env.PATH,
  nodeBin,
  path.join(env.SystemRoot || 'C:\\Windows', 'System32'),
  env.SystemRoot || 'C:\\Windows',
].filter(Boolean).join(path.delimiter);
env.PATH = [CARGO_BIN, basePath].filter(Boolean).join(path.delimiter);

const androidHome = detectAndroidHome();
if (androidHome) {
  env.ANDROID_HOME = androidHome;
  env.ANDROID_SDK_ROOT = androidHome;
} else {
  console.warn('[run-tauri] 未找到 Android SDK，Android 相关命令将失败');
}

const javaHome = detectJavaHome();
if (javaHome) {
  env.JAVA_HOME = javaHome;
} else {
  console.warn('[run-tauri] 未找到 JDK，Android 相关命令将失败');
}

console.log(`[run-tauri] ${command}`);
console.log(`  cargo:  ${CARGO_BIN}`);
console.log(`  ANDROID_HOME: ${env.ANDROID_HOME || '(未找到)'}`);
console.log(`  JAVA_HOME:    ${env.JAVA_HOME || '(未找到)'}`);

// ---- 调用 CLI ----
// @tauri-apps/cli 的 bin 入口是 node_modules/@tauri-apps/cli/tauri.js（NAPI-RS 封装）。
// 用当前 node 可执行文件直接跑它，避免 Windows 上 spawn npx.cmd 的 EINVAL 问题。
const cliEntry = require.resolve('@tauri-apps/cli/tauri.js', { paths: [ROOT] });
const child = spawn(process.execPath, [cliEntry, ...tauriArgs], {
  cwd: ROOT,
  env,
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code == null ? 1 : code);
});
child.on('error', (err) => {
  console.error('[run-tauri] 启动失败:', err.message);
  process.exit(1);
});
