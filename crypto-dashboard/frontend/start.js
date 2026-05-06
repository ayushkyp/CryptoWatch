const { execSync, spawn } = require('child_process');
const path = require('path');

const port = process.env.PORT || '3000';
const localUrl = `http://localhost:${port}`;

// Kill only processes bound to frontend port to avoid duplicate dev-server instances.
try {
  execSync('for /f "tokens=5" %a in (\'netstat -aon ^| findstr ":3000 "\') do taskkill /pid %a /f', {
    stdio: 'ignore',
    shell: 'cmd.exe',
  });
} catch (_e) {
  // No process on port 3000.
}

const reactScript = path.join(__dirname, 'node_modules', 'react-scripts', 'bin', 'react-scripts.js');

console.log('Starting frontend development server...');
console.log(`Local URL: ${localUrl}`);

const react = spawn(process.execPath, [reactScript, 'start'], {
  cwd: __dirname,
  stdio: 'inherit',
});

react.on('error', (err) => {
  console.error('Failed to start frontend:', err.message);
  process.exit(1);
});

react.on('exit', (code) => {
  process.exit(code ?? 0);
});






