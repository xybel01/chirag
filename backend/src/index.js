const app = require('./app');
const config = require('./config');
const { startAlertScheduler } = require('./services/alerts');

app.listen(config.port, () => {
  console.log(`IT Inventory API listening on port ${config.port} (${config.nodeEnv})`);
  startAlertScheduler();
});
