const config = require('../config');

// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, _next) => {
  const status = err.status || (err.code === 'P2002' ? 409 : err.code === 'P2025' ? 404 : 500);
  const message =
    err.code === 'P2002' ? `Duplicate value for unique field: ${err.meta?.target}` :
    err.code === 'P2025' ? 'Record not found' :
    err.status ? err.message : 'Internal server error';
  if (status === 500) console.error(err);
  res.status(status).json({ error: message, ...(config.nodeEnv !== 'production' && status === 500 ? { detail: err.message } : {}) });
};
