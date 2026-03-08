// Middleware factory to validate request body against Joi schema
const validateBody = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(d => ({
          field: d.path[0],
          message: d.message
        }))
      });
    }
    
    req.body = value; // Use validated/sanitized values
    next();
  };
};

// Middleware factory to validate query parameters
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, { abortEarly: false });
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(d => ({
          field: d.path[0],
          message: d.message
        }))
      });
    }
    
    req.query = value;
    next();
  };
};

module.exports = { validateBody, validateQuery };
