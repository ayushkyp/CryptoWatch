const { execSync, spawn } = require('child_process');

// Kill only processes bound to backend port to avoid EADDRINUSE.
try {
  execSync('for /f "tokens=5" %a in (\'netstat -aon ^| findstr ":5000 "\') do taskkill /pid %a /f', {
    stdio: 'ignore',
    shell: 'cmd.exe',
  });
} catch (_e) {
  // No process on port 5000.
}

const server = spawn(process.execPath, ['server.js'], {
  cwd: __dirname,
  stdio: 'inherit',
});

server.on('error', (err) => {
  console.error('Failed to start backend:', err.message);
  process.exit(1);
});

server.on('exit', (code) => {
  process.exit(code ?? 0);
});




