const HttpError = require('../utils/httpError');

// Zod-based validation middleware: validate(schema, 'body' | 'query' | 'params')
module.exports = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const msg = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return next(new HttpError(400, msg));
  }
  req[source === 'body' ? 'body' : source] = result.data;
  next();
};
