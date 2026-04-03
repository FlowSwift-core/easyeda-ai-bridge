module.exports = {
  apps: [
    {
      name: 'easy-eda-bridge',
      script: './scripts/bridge-server.mjs',
      cwd: './apps/bridge',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 49620,
      },
      error_file: './logs/bridge-error.log',
      out_file: './logs/bridge-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
  ],
};
