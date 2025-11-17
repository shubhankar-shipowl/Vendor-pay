module.exports = {
  apps: [
    {
      name: 'vendor-payout-app',
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '4G',
      node_args: '--max-old-space-size=4096',
      env: {
        NODE_ENV: 'development',
        NODE_OPTIONS: '--max-old-space-size=4096',
      },
      env_production: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=4096',
      },
    },
  ],
};
