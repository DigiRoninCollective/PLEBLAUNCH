import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult, ValidationChain } from 'express-validator';

export class ValidationMiddleware {
  /**
   * Handle validation errors
   */
  static handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
      return;
    }
    next();
  };

  /**
   * Order validation rules
   */
  static validateCreateOrder: ValidationChain[] = [
    body('type')
      .isIn(['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT'])
      .withMessage('Invalid order type'),
    
    body('side')
      .isIn(['BUY', 'SELL'])
      .withMessage('Invalid order side'),
    
    body('inputMint')
      .isString()
      .notEmpty()
      .isLength({ min: 32, max: 44 })
      .withMessage('Invalid input mint address'),
    
    body('outputMint')
      .isString()
      .notEmpty()
      .isLength({ min: 32, max: 44 })
      .withMessage('Invalid output mint address'),
    
    body('amount')
      .isNumeric()
      .isFloat({ min: 0.000001 })
      .withMessage('Amount must be a positive number greater than 0.000001'),
    
    body('limitPrice')
      .optional()
      .isNumeric()
      .isFloat({ min: 0 })
      .withMessage('Limit price must be a positive number'),
    
    body('stopPrice')
      .optional()
      .isNumeric()
      .isFloat({ min: 0 })
      .withMessage('Stop price must be a positive number'),
    
    body('takeProfitPrice')
      .optional()
      .isNumeric()
      .isFloat({ min: 0 })
      .withMessage('Take profit price must be a positive number'),
    
    body('slippageTolerance')
      .optional()
      .isFloat({ min: 0, max: 1 })
      .withMessage('Slippage tolerance must be between 0 and 1'),
    
    body('timeInForce')
      .optional()
      .isIn(['GTC', 'IOC', 'FOK'])
      .withMessage('Invalid time in force'),
    
    body('expiresAt')
      .optional()
      .isISO8601()
      .withMessage('Invalid expiration date format')
  ];

  /**
   * Strategy validation rules
   */
  static validateCreateStrategy: ValidationChain[] = [
    body('name')
      .isString()
      .notEmpty()
      .isLength({ min: 1, max: 100 })
      .withMessage('Strategy name must be between 1-100 characters'),
    
    body('type')
      .isIn(['DCA', 'GRID', 'MOMENTUM', 'MEAN_REVERSION', 'ARBITRAGE'])
      .withMessage('Invalid strategy type'),
    
    body('description')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters'),
    
    body('parameters')
      .isObject()
      .withMessage('Strategy parameters must be an object'),
    
    body('active')
      .optional()
      .isBoolean()
      .withMessage('Active must be a boolean'),
    
    body('riskLevel')
      .optional()
      .isIn(['LOW', 'MEDIUM', 'HIGH'])
      .withMessage('Risk level must be LOW, MEDIUM, or HIGH'),
    
    body('maxInvestment')
      .optional()
      .isNumeric()
      .isFloat({ min: 0 })
      .withMessage('Max investment must be a positive number')
  ];

  /**
   * User registration validation
   */
  static validateUserRegistration: ValidationChain[] = [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    
    body('password')
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must be at least 8 characters with uppercase, lowercase, number, and special character'),
    
    body('wallet')
      .isString()
      .isLength({ min: 32, max: 44 })
      .withMessage('Invalid wallet address'),
    
    body('terms')
      .isBoolean()
      .equals(true)
      .withMessage('Must accept terms and conditions')
  ];

  /**
   * User login validation
   */
  static validateUserLogin: ValidationChain[] = [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ];

  /**
   * Pagination validation
   */
  static validatePagination: ValidationChain[] = [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a non-negative integer'),
    
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer')
  ];

  /**
   * Date range validation
   */
  static validateDateRange: ValidationChain[] = [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
    
    query('period')
      .optional()
      .isIn(['1d', '7d', '30d', '90d', '1y'])
      .withMessage('Period must be one of: 1d, 7d, 30d, 90d, 1y')
  ];

  /**
   * Wallet validation
   */
  static validateWallet: ValidationChain[] = [
    body('wallet')
      .isString()
      .isLength({ min: 32, max: 44 })
      .matches(/^[1-9A-HJ-NP-Za-km-z]+$/)
      .withMessage('Invalid Solana wallet address'),
    
    body('signature')
      .optional()
      .isString()
      .isLength({ min: 64, max: 128 })
      .withMessage('Invalid signature format')
  ];

  /**
   * Order ID validation
   */
  static validateOrderId: ValidationChain[] = [
    param('orderId')
      .isString()
      .notEmpty()
      .matches(/^order_[0-9]+_[a-z0-9]+$/)
      .withMessage('Invalid order ID format')
  ];

  /**
   * Strategy ID validation
   */
  static validateStrategyId: ValidationChain[] = [
    param('strategyId')
      .isUUID()
      .withMessage('Invalid strategy ID format')
  ];

  /**
   * Token/Mint validation
   */
  static validateMint: ValidationChain[] = [
    query('mint')
      .isString()
      .isLength({ min: 32, max: 44 })
      .matches(/^[1-9A-HJ-NP-Za-km-z]+$/)
      .withMessage('Invalid mint address')
  ];

  /**
   * Trading pair validation
   */
  static validateTradingPair: ValidationChain[] = [
    query('inputMint')
      .isString()
      .isLength({ min: 32, max: 44 })
      .withMessage('Invalid input mint address'),
    
    query('outputMint')
      .isString()
      .isLength({ min: 32, max: 44 })
      .withMessage('Invalid output mint address')
  ];

  /**
   * Amount validation
   */
  static validateAmount: ValidationChain[] = [
    body('amount')
      .isNumeric()
      .isFloat({ min: 0.000001, max: 1000000000 })
      .withMessage('Amount must be between 0.000001 and 1,000,000,000')
  ];

  /**
   * Custom validator for conditional fields
   */
  static conditionalValidation = (condition: (req: Request) => boolean, validators: ValidationChain[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (condition(req)) {
        // Run validators if condition is true
        Promise.all(validators.map(validator => validator.run(req)))
          .then(() => ValidationMiddleware.handleValidationErrors(req, res, next))
          .catch(next);
      } else {
        next();
      }
    };
  };

  /**
   * Sanitization middleware
   */
  static sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
    // Remove any potential XSS
    const sanitizeObject = (obj: any): any => {
      if (typeof obj === 'string') {
        return obj.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      }
      if (typeof obj === 'object' && obj !== null) {
        Object.keys(obj).forEach(key => {
          obj[key] = sanitizeObject(obj[key]);
        });
      }
      return obj;
    };

    req.body = sanitizeObject(req.body);
    req.query = sanitizeObject(req.query);
    req.params = sanitizeObject(req.params);
    
    next();
  };
}

// Export commonly used validation chains
export const {
  handleValidationErrors,
  validateCreateOrder,
  validateCreateStrategy,
  validateUserRegistration,
  validateUserLogin,
  validatePagination,
  validateDateRange,
  validateWallet,
  validateOrderId,
  validateStrategyId,
  validateMint,
  validateTradingPair,
  validateAmount,
  conditionalValidation,
  sanitizeInput
} = ValidationMiddleware;