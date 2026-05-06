#!/usr/bin/env node
const { spawn, execSync } = require('child_process');
const path = require('path');
const os = require('os');

const isWindows = os.platform() === 'win32';
const backendDir = path.join(__dirname, 'backend');
const frontendDir = path.join(__dirname, 'frontend');

console.log('🚀 Starting CryptoWatch Dashboard...\n');

// KILL PROCESSES ON SPECIFIC PORTS (NOT ALL NODE)
console.log('🧹 Cleaning up ports 5000 and 3000...');
try {
  if (isWindows) {
    // Kill only processes on port 5000 and 3000
    execSync('For /F "tokens=5" %a in (\'netstat -aon ^| findstr ":5000 "\') do taskkill /PID %a /F 2>nul', { stdio: 'ignore', shell: 'cmd.exe' });
    execSync('For /F "tokens=5" %a in (\'netstat -aon ^| findstr ":3000 "\') do taskkill /PID %a /F 2>nul', { stdio: 'ignore', shell: 'cmd.exe' });
  } else {
    execSync('lsof -ti:5000,3000 | xargs kill -9 2>/dev/null', { stdio: 'ignore' });
  }
} catch (e) {
  // Ignore errors - ports might already be free
}

// Wait for ports to be freed
console.log('⏳ Waiting for ports to be freed...');
setTimeout(() => {
  console.log('✅ Ready to start!\n');

  // Start Backend
  console.log('📦 Starting Backend Server on Port 5000...');
  const backendProcess = spawn(isWindows ? 'npm.cmd' : 'npm', ['start'], {
    cwd: backendDir,
    stdio: 'inherit',
    shell: true,
  });

  backendProcess.on('error', (err) => {
    console.error('❌ Backend Error:', err);
  });

  // Wait 3 seconds then start Frontend
  setTimeout(() => {
    console.log('\n📦 Starting Frontend Server on Port 3000...\n');
    const frontendProcess = spawn(isWindows ? 'npm.cmd' : 'npm', ['start'], {
      cwd: frontendDir,
      stdio: 'inherit',
      shell: true,
    });

    frontendProcess.on('error', (err) => {
      console.error('❌ Frontend Error:', err);
    });

    // Handle termination
    process.on('SIGINT', () => {
      console.log('\n\n⏹️  Stopping servers...');
      backendProcess.kill();
      frontendProcess.kill();
      process.exit(0);
    });
  }, 3000);

  process.on('SIGINT', () => {
    console.log('\n\n⏹️  Stopping servers...');
    backendProcess.kill();
    process.exit(0);
  });
}, 3000);
