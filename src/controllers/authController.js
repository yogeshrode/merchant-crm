const { query } = require('../db');
const { 
  generateAccessToken, 
  generateRefreshToken, 
  comparePassword, 
  hashToken,
  hashPassword
} = require('../utils/auth');

// Login handler
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    // Find operator by email
    const result = await query(
      'SELECT id, email, password_hash, first_name, last_name, role, is_active, login_attempts, locked_until FROM operators WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    const operator = result.rows[0];
    
    // Check if account is locked
    if (operator.locked_until && new Date(operator.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(operator.locked_until) - new Date()) / 60000);
      return res.status(423).json({
        success: false,
        message: `Account is locked. Try again in ${minutesLeft} minutes`,
        code: 'ACCOUNT_LOCKED',
        lockedUntil: operator.locked_until
      });
    }
    
    // Check if account is active
    if (!operator.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated'
      });
    }
    
    // Verify password
    const isValidPassword = await comparePassword(password, operator.password_hash);
    
    if (!isValidPassword) {
      // Increment login attempts
      const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
      const newAttempts = operator.login_attempts + 1;
      const shouldLock = newAttempts >= maxAttempts;
      
      await query(
        `UPDATE operators 
         SET login_attempts = $1, 
             locked_until = CASE WHEN $2 THEN CURRENT_TIMESTAMP + INTERVAL '${process.env.LOGIN_LOCKOUT_MINUTES || 15} minutes' ELSE NULL END
         WHERE id = $3`,
        [newAttempts, shouldLock, operator.id]
      );
      
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        attemptsRemaining: shouldLock ? 0 : maxAttempts - newAttempts
      });
    }
    
    // Reset login attempts on successful login
    await query(
      'UPDATE operators SET login_attempts = 0, locked_until = NULL WHERE id = $1',
      [operator.id]
    );
    
    // Generate tokens
    const tokenPayload = {
      operatorId: operator.id,
      email: operator.email,
      role: operator.role
    };
    
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);
    
    // Store refresh token hash
    await query(
      'INSERT INTO refresh_tokens (operator_id, token_hash, expires_at) VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL \'7 days\')',
      [operator.id, hashToken(refreshToken)]
    );
    
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        operator: {
          id: operator.id,
          email: operator.email,
          firstName: operator.first_name,
          lastName: operator.last_name,
          role: operator.role
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: 900 // 15 minutes in seconds
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Refresh token handler
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token required'
      });
    }
    
    // Verify refresh token
    const { verifyRefreshToken } = require('../utils/auth');
    let decoded;
    
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }
    
    // Check if token exists and is not revoked
    const tokenHash = hashToken(refreshToken);
    const tokenResult = await query(
      'SELECT * FROM refresh_tokens WHERE token_hash = $1 AND is_revoked = false AND expires_at > CURRENT_TIMESTAMP',
      [tokenHash]
    );
    
    if (tokenResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token not found or revoked'
      });
    }
    
    // Revoke old refresh token (token rotation for security)
    await query(
      'UPDATE refresh_tokens SET is_revoked = true, revoked_at = CURRENT_TIMESTAMP WHERE token_hash = $1',
      [tokenHash]
    );
    
    // Generate new tokens
    const tokenPayload = {
      operatorId: decoded.operatorId,
      email: decoded.email,
      role: decoded.role
    };
    
    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);
    
    // Store new refresh token
    await query(
      'INSERT INTO refresh_tokens (operator_id, token_hash, expires_at) VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL \'7 days\')',
      [decoded.operatorId, hashToken(newRefreshToken)]
    );
    
    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 900
      }
    });
  } catch (error) {
    next(error);
  }
};

// Logout handler
const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
      // Revoke the refresh token
      await query(
        'UPDATE refresh_tokens SET is_revoked = true, revoked_at = CURRENT_TIMESTAMP WHERE token_hash = $1',
        [hashToken(refreshToken)]
      );
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get current operator info
const me = async (req, res) => {
  res.json({
    success: true,
    data: {
      operator: req.operator
    }
  });
};

// Register new operator
const register = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;
    
    // Check if any operators exist (first user becomes admin)
    const countResult = await query('SELECT COUNT(*) FROM operators');
    const isFirstUser = parseInt(countResult.rows[0].count) === 0;
    
    // Check if email already exists
    const existingResult = await query(
      'SELECT id FROM operators WHERE email = $1',
      [email]
    );
    
    if (existingResult.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered'
      });
    }
    
    // Hash password
    const passwordHash = await hashPassword(password);
    
    // First user is always admin, otherwise use provided role or default to operator
    const userRole = isFirstUser ? 'admin' : (role || 'operator');
    
    // Create operator
    const result = await query(
      `INSERT INTO operators (email, password_hash, first_name, last_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, first_name, last_name, role, is_active, created_at`,
      [email, passwordHash, firstName, lastName, userRole, true]
    );
    
    const operator = result.rows[0];
    
    res.status(201).json({
      success: true,
      message: 'Operator registered successfully',
      data: {
        operator: {
          id: operator.id,
          email: operator.email,
          firstName: operator.first_name,
          lastName: operator.last_name,
          role: operator.role,
          isActive: operator.is_active,
          createdAt: operator.created_at
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { login, refresh, logout, me, register };
