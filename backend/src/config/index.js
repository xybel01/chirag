require('dotenv').config();

const env = (key, fallback) => process.env[key] ?? fallback;

module.exports = {
  nodeEnv: env('NODE_ENV', 'development'),
  port: parseInt(env('PORT', '5000'), 10),
  appUrl: env('APP_URL', 'http://localhost:5173'),
  jwt: {
    secret: env('JWT_SECRET', 'dev-secret-change-me'),
    expiresIn: env('JWT_EXPIRES_IN', '8h'),
  },
  ms: {
    clientId: env('MS_CLIENT_ID', ''),
    clientSecret: env('MS_CLIENT_SECRET', ''),
    tenantId: env('MS_TENANT_ID', ''),
    redirectUri: env('MS_REDIRECT_URI', ''),
    enabled: Boolean(env('MS_CLIENT_ID', '')),
  },
  smtp: {
    host: env('SMTP_HOST', ''),
    port: parseInt(env('SMTP_PORT', '587'), 10),
    secure: env('SMTP_SECURE', 'false') === 'true',
    user: env('SMTP_USER', ''),
    pass: env('SMTP_PASS', ''),
    from: env('MAIL_FROM', 'IT Inventory <no-reply@nationwide-paper.com>'),
  },
  itManagerEmail: env('IT_MANAGER_EMAIL', ''),
  teamsWebhookUrl: env('TEAMS_WEBHOOK_URL', ''),
  warrantyAlertDays: parseInt(env('WARRANTY_ALERT_DAYS', '30'), 10),
  licenseAlertDays: parseInt(env('LICENSE_ALERT_DAYS', '30'), 10),
  alertCron: env('ALERT_CRON', '0 8 * * *'),
  maxUploadMb: parseInt(env('MAX_UPLOAD_MB', '10'), 10),
};
