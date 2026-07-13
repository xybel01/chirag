const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const { apiLimiter } = require('./middleware/rateLimit');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.set('trust proxy', 1); // behind nginx

app.use(helmet());
app.use(cors({ origin: config.appUrl, credentials: true }));
app.use(express.json({ limit: '2mb' })); // signatures come as base64 PNG
app.use(express.urlencoded({ extended: true }));
app.use('/api', apiLimiter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/meta', require('./routes/meta.routes'));
app.use('/api/assets', require('./routes/asset.routes'));
app.use('/api/assignments', require('./routes/assignment.routes'));
app.use('/api/stock', require('./routes/stock.routes'));
app.use('/api/repairs', require('./routes/repair.routes'));
app.use('/api/licenses', require('./routes/license.routes'));
app.use('/api/reports', require('./routes/report.routes'));
app.use('/api/dashboard', require('./routes/dashboard.routes'));
app.use('/api/audit', require('./routes/audit.routes'));
app.use('/api/files', require('./routes/files.routes'));
app.use('/api/ai', require('./routes/ai.routes'));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

module.exports = app;
