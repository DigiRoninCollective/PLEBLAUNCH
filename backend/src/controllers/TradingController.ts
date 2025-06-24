import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { Pool } from 'pg';
import winston from 'winston';
import { PortfolioManager } from '../services/portfolio/PortfolioManager';
import { OrderExecutionService } from '../services/tradingEngine/OrderExecutionService';
import { StrategyEngine } from '../services/tradingEngine/StrategyEngine';
import { Order, OrderStatus, OrderType } from '../types/trading';

export class TradingController {
  private pool: Pool;
  private logger: winston.Logger;
  private orderExecutionService: OrderExecutionService;
  private portfolioManager: PortfolioManager;
  private strategyEngine: StrategyEngine;

  constructor(
    pool: Pool,
    logger: winston.Logger,
    orderExecutionService: OrderExecutionService,
    portfolioManager: PortfolioManager,
    strategyEngine: StrategyEngine
  ) {
    this.pool = pool;
    this.logger = logger;
    this.orderExecutionService = orderExecutionService;
    this.portfolioManager = portfolioManager;
    this.strategyEngine = strategyEngine;
  }

  /**
   * Create a new order
   */
  async createOrder(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const {
        type,
        side,
        inputMint,
        outputMint,
        amount,
        limitPrice,
        stopPrice,
        takeProfitPrice,
        slippageTolerance = 0.01,
        timeInForce = 'GTC',
        expiresAt
      } = req.body;

      // Create order object
      const order: Order = {
        id: this.generateOrderId(),
        userId,
        userWallet: req.user?.wallet,
        type,
        side,
        status: OrderStatus.PENDING,
        inputMint,
        outputMint,
        amount: parseFloat(amount),
        limitPrice: limitPrice ? parseFloat(limitPrice) : undefined,
        stopPrice: stopPrice ? parseFloat(stopPrice) : undefined,
        takeProfitPrice: takeProfitPrice ? parseFloat(takeProfitPrice) : undefined,
        slippageTolerance: parseFloat(slippageTolerance),
        timeInForce,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : undefined
      };

      // Save order to database
      await this.saveOrder(order);

      // Execute immediately if market order
      if (type === OrderType.MARKET) {
        const trade = await this.orderExecutionService.executeMarketOrder(order);
        res.status(201).json({ order, trade });
      } else {
        res.status(201).json({ order });
      }

      this.logger.info(`Order created: ${order.id} by user ${userId}`);

    } catch (error) {
      this.logger.error('Error creating order:', error);
      res.status(500).json({ error: 'Failed to create order' });
    }
  }

  /**
   * Get user's orders
   */
  async getUserOrders(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { status, limit = 50, offset = 0 } = req.query;
      const orders = await this.orderExecutionService.getUserOrders(
        userId,
        status as OrderStatus
      );

      res.json({ orders });

    } catch (error) {
      this.logger.error('Error fetching user orders:', error);
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { orderId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const success = await this.orderExecutionService.cancelOrder(orderId, userId);
      
      if (success) {
        res.json({ success: true, message: 'Order cancelled successfully' });
      } else {
        res.status(404).json({ error: 'Order not found or cannot be cancelled' });
      }

    } catch (error) {
      this.logger.error('Error cancelling order:', error);
      res.status(500).json({ error: 'Failed to cancel order' });
    }
  }

  /**
   * Get user's trade history
   */
  async getTradeHistory(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { limit = 50, offset = 0, mint } = req.query;
      
      let query = `
        SELECT t.*, o.type as order_type, o.side as order_side
        FROM trades t
        JOIN orders o ON t.order_id = o.id
        WHERE t.user_id = $1
      `;
      const params: any[] = [userId];

      if (mint) {
        query += ` AND (t.input_mint = $${params.length + 1} OR t.output_mint = $${params.length + 1})`;
        params.push(mint);
      }

      query += ` ORDER BY t.executed_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await this.pool.query(query, params);
      res.json({ trades: result.rows });

    } catch (error) {
      this.logger.error('Error fetching trade history:', error);
      res.status(500).json({ error: 'Failed to fetch trade history' });
    }
  }

  /**
   * Get user's portfolio
   */
  async getPortfolio(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const portfolio = await this.portfolioManager.getUserPortfolio(userId);
      res.json({ portfolio });

    } catch (error) {
      this.logger.error('Error fetching portfolio:', error);
      res.status(500).json({ error: 'Failed to fetch portfolio' });
    }
  }

  /**
   * Get user's positions
   */
  async getPositions(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const positions = await this.portfolioManager.getUserPositions(userId);
      res.json({ positions });

    } catch (error) {
      this.logger.error('Error fetching positions:', error);
      res.status(500).json({ error: 'Failed to fetch positions' });
    }
  }

  /**
   * Get trading statistics
   */
  async getTradingStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { period = '30d' } = req.query;
      
      const stats = await this.calculateTradingStats(userId, period as string);
      res.json({ stats });

    } catch (error) {
      this.logger.error('Error fetching trading stats:', error);
      res.status(500).json({ error: 'Failed to fetch trading statistics' });
    }
  }

  /**
   * Create a trading strategy
   */
  async createStrategy(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const strategy = await this.strategyEngine.createStrategy(userId, req.body);
      res.status(201).json({ strategy });

    } catch (error) {
      this.logger.error('Error creating strategy:', error);
      res.status(500).json({ error: 'Failed to create strategy' });
    }
  }

  /**
   * Get user's strategies
   */
  async getUserStrategies(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { active, limit = 20, offset = 0 } = req.query;
      const strategies = await this.strategyEngine.getUserStrategies(
        userId,
        active === 'true'
      );

      res.json({ strategies });

    } catch (error) {
      this.logger.error('Error fetching user strategies:', error);
      res.status(500).json({ error: 'Failed to fetch strategies' });
    }
  }

  /**
   * Update a strategy
   */
  async updateStrategy(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const userId = req.user?.id;
      const { strategyId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const strategy = await this.strategyEngine.updateStrategy(
        strategyId,
        userId,
        req.body
      );

      if (strategy) {
        res.json({ strategy });
      } else {
        res.status(404).json({ error: 'Strategy not found' });
      }

    } catch (error) {
      this.logger.error('Error updating strategy:', error);
      res.status(500).json({ error: 'Failed to update strategy' });
    }
  }

  /**
   * Delete a strategy
   */
  async deleteStrategy(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { strategyId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const success = await this.strategyEngine.deleteStrategy(strategyId, userId);
      
      if (success) {
        res.json({ success: true, message: 'Strategy deleted successfully' });
      } else {
        res.status(404).json({ error: 'Strategy not found' });
      }

    } catch (error) {
      this.logger.error('Error deleting strategy:', error);
      res.status(500).json({ error: 'Failed to delete strategy' });
    }
  }

  /**
   * Start/Stop a strategy
   */
  async toggleStrategy(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { strategyId } = req.params;
      const { active } = req.body;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const strategy = await this.strategyEngine.toggleStrategy(
        strategyId,
        userId,
        active
      );

      if (strategy) {
        res.json({ strategy });
      } else {
        res.status(404).json({ error: 'Strategy not found' });
      }

    } catch (error) {
      this.logger.error('Error toggling strategy:', error);
      res.status(500).json({ error: 'Failed to toggle strategy' });
    }
  }

  /**
   * Get market data
   */
  async getMarketData(req: Request, res: Response): Promise<void> {
    try {
      const { mint, timeframe = '1h', limit = 100 } = req.query;

      if (!mint) {
        res.status(400).json({ error: 'Mint parameter is required' });
        return;
      }

      const marketData = await this.orderExecutionService.getMarketData(
        mint as string,
        timeframe as string,
        parseInt(limit as string)
      );

      res.json({ marketData });

    } catch (error) {
      this.logger.error('Error fetching market data:', error);
      res.status(500).json({ error: 'Failed to fetch market data' });
    }
  }

  /**
   * Get order book
   */
  async getOrderBook(req: Request, res: Response): Promise<void> {
    try {
      const { inputMint, outputMint, depth = 10 } = req.query;

      if (!inputMint || !outputMint) {
        res.status(400).json({ error: 'inputMint and outputMint parameters are required' });
        return;
      }

      const orderBook = await this.orderExecutionService.getOrderBook(
        inputMint as string,
        outputMint as string,
        parseInt(depth as string)
      );

      res.json({ orderBook });

    } catch (error) {
      this.logger.error('Error fetching order book:', error);
      res.status(500).json({ error: 'Failed to fetch order book' });
    }
  }

  /**
   * Get portfolio performance
   */
  async getPortfolioPerformance(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { period = '30d' } = req.query;
      const performance = await this.portfolioManager.getPortfolioPerformance(
        userId,
        period as string
      );

      res.json({ performance });

    } catch (error) {
      this.logger.error('Error fetching portfolio performance:', error);
      res.status(500).json({ error: 'Failed to fetch portfolio performance' });
    }
  }

  // Private helper methods

  /**
   * Generate unique order ID
   */
  private generateOrderId(): string {
    return `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Save order to database
   */
  private async saveOrder(order: Order): Promise<void> {
    const query = `
      INSERT INTO orders (
        id, user_id, user_wallet, type, side, status, input_mint, output_mint,
        amount, limit_price, stop_price, take_profit_price, slippage_tolerance,
        time_in_force, created_at, updated_at, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    `;

    const values = [
      order.id,
      order.userId,
      order.userWallet,
      order.type,
      order.side,
      order.status,
      order.inputMint,
      order.outputMint,
      order.amount,
      order.limitPrice,
      order.stopPrice,
      order.takeProfitPrice,
      order.slippageTolerance,
      order.timeInForce,
      order.createdAt,
      order.updatedAt,
      order.expiresAt
    ];

    await this.pool.query(query, values);
  }

  /**
   * Calculate trading statistics for a user
   */
  private async calculateTradingStats(userId: string, period: string): Promise<any> {
    const periodDays = this.parsePeriodToDays(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const query = `
      SELECT 
        COUNT(*) as total_trades,
        SUM(CASE WHEN profit_loss > 0 THEN 1 ELSE 0 END) as winning_trades,
        SUM(CASE WHEN profit_loss < 0 THEN 1 ELSE 0 END) as losing_trades,
        SUM(profit_loss) as total_pnl,
        AVG(profit_loss) as avg_pnl,
        MAX(profit_loss) as max_win,
        MIN(profit_loss) as max_loss,
        SUM(fees) as total_fees,
        SUM(volume_usd) as total_volume
      FROM trades 
      WHERE user_id = $1 AND executed_at >= $2
    `;

    const result = await this.pool.query(query, [userId, startDate]);
    const stats = result.rows[0];

    return {
      totalTrades: parseInt(stats.total_trades),
      winningTrades: parseInt(stats.winning_trades),
      losingTrades: parseInt(stats.losing_trades),
      winRate: stats.total_trades > 0 ? (stats.winning_trades / stats.total_trades) * 100 : 0,
      totalPnL: parseFloat(stats.total_pnl) || 0,
      avgPnL: parseFloat(stats.avg_pnl) || 0,
      maxWin: parseFloat(stats.max_win) || 0,
      maxLoss: parseFloat(stats.max_loss) || 0,
      totalFees: parseFloat(stats.total_fees) || 0,
      totalVolume: parseFloat(stats.total_volume) || 0,
      period
    };
  }

  /**
   * Parse period string to number of days
   */
  private parsePeriodToDays(period: string): number {
    const periodMap: { [key: string]: number } = {
      '1d': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365
    };

    return periodMap[period] || 30;
  }

  // Validator middleware methods (to be used in routes)
  static createOrderValidators = [
    body('type').isIn(['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT']).withMessage('Invalid order type'),
    body('side').isIn(['BUY', 'SELL']).withMessage('Invalid order side'),
    body('inputMint').isString().notEmpty().withMessage('Input mint is required'),
    body('outputMint').isString().notEmpty().withMessage('Output mint is required'),
    body('amount').isNumeric().isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    body('limitPrice').optional().isNumeric().withMessage('Limit price must be a number'),
    body('stopPrice').optional().isNumeric().withMessage('Stop price must be a number'),
    body('slippageTolerance').optional().isFloat({ min: 0, max: 1 }).withMessage('Slippage tolerance must be between 0 and 1')
  ];

  static createStrategyValidators = [
    body('name').isString().notEmpty().withMessage('Strategy name is required'),
    body('type').isIn(['DCA', 'GRID', 'MOMENTUM', 'MEAN_REVERSION']).withMessage('Invalid strategy type'),
    body('parameters').isObject().withMessage('Strategy parameters must be an object'),
    body('active').optional().isBoolean().withMessage('Active must be a boolean')
  ];
}