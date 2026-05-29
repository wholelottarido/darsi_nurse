module.exports = {
  apps: [
    {
      name: 'darsi-nurse',
      script: 'npm',
      args: 'run dev -- -p 6767 -H 0.0.0.0',
      cwd: '/home/ridho/volt/darsi-nurse',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'development'
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '1G',
      max_restarts: 10,
      min_uptime: '10s',
      listen_timeout: 5000,
      kill_timeout: 5000
    }
  ]
};
