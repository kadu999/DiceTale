// 统一 Tauri 构建入口（仅 Android 壳）：
//   先探测并设置 Rust/Android 环境（cargo PATH、ANDROID_HOME、JAVA_HOME），
//   再调用 @tauri-apps/cli。这样 npm scripts 在任何机器上都能直接跑，
//   不需要用户手动配全局环境变量。
//
// 用法：
//   node scripts/run-tauri.js android -> tauri android build --apk --debug（Android APK）
//
// 说明：PC 端已回归"浏览器 + serve-web.bat"（后端同源托管页面），不再有 Tauri PC 壳；
//       Android 壳只内嵌引导页（填后端地址 → 跳转），前端迭代不需要重打包。
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

// ---- 生成工程补丁：Gradle 依赖仓库镜像 ----
// dl.google.com 在某些网络（如国内）不可达/被拦截，Gradle 拉 AGP 等依赖会 404。
// 在生成的 gen/android Gradle 文件里把阿里云镜像插到 google() 前面（幂等：已含镜像则跳过）。
// gen/android 由 tauri android init 生成，重跑 init 后本函数会在下次构建前自动重新打补丁。
function patchGradleMirrors() {
  const genAndroid = path.join(ROOT, 'src-tauri', 'gen', 'android');
  if (!fs.existsSync(genAndroid)) return; // 工程尚未生成（CLI 首次会 init），下次构建再打补丁
  for (const rel of ['build.gradle.kts', 'buildSrc/build.gradle.kts']) {
    const file = path.join(genAndroid, rel);
    if (!fs.existsSync(file)) continue;
    let src = fs.readFileSync(file, 'utf8');
    if (src.includes('maven.aliyun.com')) continue;
    const before = src;
    src = src.replace(/^([ \t]*)google\(\)\r?\n\1mavenCentral\(\)/gm, (_m, indent) => {
      return `${indent}maven { url = uri("https://maven.aliyun.com/repository/google") }\n` +
        `${indent}maven { url = uri("https://maven.aliyun.com/repository/central") }\n` +
        `${indent}google()\n${indent}mavenCentral()`;
    });
    if (src !== before) {
      fs.writeFileSync(file, src, 'utf8');
      console.log(`[run-tauri] 已为 ${rel} 添加阿里云 Maven 镜像（dl.google.com 不可达时必需）`);
    }
  }
}

const command = process.argv[2];
if (!command) {
  console.error('用法: node scripts/run-tauri.js <android>');
  process.exit(1);
}

// ---- 组装 tauri CLI 参数 ----
const tauriArgs = {
  android: ['android', 'build', '--apk', '--debug'],
}[command];
if (!tauriArgs) {
  console.error('未知命令: ' + command);
  process.exit(1);
}

// ---- 设置环境 ----
const env = { ...process.env };
// 保证 PATH 至少包含 cargo、项目 scripts（pnpm.cmd 垫片）、node 与系统基础目录
const nodeBin = path.dirname(process.execPath);
const SCRIPTS_DIR = __dirname;
const basePath = [
  env.PATH,
  nodeBin,
  path.join(env.SystemRoot || 'C:\\Windows', 'System32'),
  env.SystemRoot || 'C:\\Windows',
].filter(Boolean).join(path.delimiter);
env.PATH = [CARGO_BIN, SCRIPTS_DIR, basePath].filter(Boolean).join(path.delimiter);

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

// Android 构建前先确保 Gradle 仓库镜像已就位
if (command === 'android') patchGradleMirrors();

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
