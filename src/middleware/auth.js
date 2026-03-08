const { verifyAccessToken } = require('../utils/auth');
const { query } = require('../db');

// Middleware to verify JWT token
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access token required' 
      });
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = verifyAccessToken(token);
      
      // Check if operator still exists and is active
      const result = await query(
        'SELECT id, email, role, first_name, last_name FROM operators WHERE id = $1 AND is_active = true',
        [decoded.operatorId]
      );
      
      if (result.rows.length === 0) {
        return res.status(401).json({ 
          success: false, 
          message: 'Operator not found or inactive' 
        });
      }
      
      req.operator = result.rows[0];
      next();
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          success: false, 
          message: 'Token expired',
          code: 'TOKEN_EXPIRED'
        });
      }
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token' 
      });
    }
  } catch (error) {
    next(error);
  }
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.operator.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Admin access required' 
    });
  }
  next();
};

module.exports = { authenticate, requireAdmin };
