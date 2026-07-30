/** PM2 process file — run from repo root: pm2 start ecosystem.config.cjs */
module.exports = {
  apps: [
    {
      name: "ptw",
      script: "scripts/vps-server.cjs",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "2800M",
      env_file: ".env",
      kill_timeout: 120000,
    },
  ],
};
