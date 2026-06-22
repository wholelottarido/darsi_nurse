module.exports = {
  apps: [
    {
      name: 'darsi-nurse',
      script: '/home/ridho/volt/darsi-nurse/node_modules/next/dist/bin/next',
      args: 'start --port 6767 --hostname 0.0.0.0',
      cwd: '/home/ridho/volt/darsi-nurse',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: '6767',
        HOSTNAME: '0.0.0.0'
      },
      error_file: '/home/ridho/volt/darsi-nurse/logs/err.log',
      out_file: '/home/ridho/volt/darsi-nurse/logs/out.log',
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
