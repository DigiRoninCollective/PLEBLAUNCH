import { Connection } from '@solana/web3.js';
import { Pool } from 'pg';
import winston from 'winston';
import { Order, OrderStatus, OrderType, Trade } from '../../types/trading';
import { JupiterService } from '../dataProviders/JupiterService';
import { PortfolioManager } from '../portfolio/PortfolioManager';
import { RiskManager } from './RiskManager';

export class OrderExecutionService {
  private connection: Connection;
  private pool: Pool;
  private logger: winston.Logger;
  private jupiterService: JupiterService;
  private riskManager: RiskManager;
  private portfolioManager: PortfolioManager;

  constructor(
    connection: Connection,
    pool: Pool,
    logger: winston.Logger,
    jupiterService: JupiterService,
    riskManager: RiskManager,
    portfolioManager: PortfolioManager
  ) {
    this.connection = connection;
    this.pool = pool;
    this.logger = logger;
    this.jupiterService = jupiterService;
    this.riskManager = riskManager;
    this.portfolioManager = portfolioManager;
  }

  /**
   * Execute a market order immediately at current market price
   */
  async executeMarketOrder(order: Order): Promise<Trade | null> {
    try {
      // 1. Risk check
      const riskCheck = await this.riskManager.validateOrder(order);
      if (!riskCheck.isValid) {
        await this.updateOrderStatus(order.id, OrderStatus.REJECTED, riskCheck.reason);
        return null;
      }

      // 2. Get current market price
      const quote = await this.jupiterService.getQuote(
        order.inputMint,
        order.outputMint,
        order.amount
      );

      if (!quote) {
        await this.updateOrderStatus(order.id, OrderStatus.FAILED, 'Unable to get quote');
        return null;
      }

      // 3. Check slippage tolerance
      const slippageCheck = this.checkSlippage(order, quote);
      if (!slippageCheck.isValid) {
        await this.updateOrderStatus(order.id, OrderStatus.REJECTED, slippageCheck.reason);
        return null;
      }

      // 4. Execute the swap
      const swapResult = await this.jupiterService.executeSwap(
        quote,
        order.userWallet,
        order.slippageTolerance
      );

      if (!swapResult.success) {
        await this.updateOrderStatus(order.id, OrderStatus.FAILED, swapResult.error);
        return null;
      }

      // 5. Create trade record
      const trade = await this.createTrade(order, swapResult, quote);

      // 6. Update portfolio
      await this.portfolioManager.updatePortfolioAfterTrade(trade);

      // 7. Update order status
      await this.updateOrderStatus(order.id, OrderStatus.FILLED);

      this.logger.info(`Market order executed successfully: ${order.id}`);
      return trade;

    } catch (error) {
      this.logger.error(`Error executing market order ${order.id}:`, error);
      await this.updateOrderStatus(order.id, OrderStatus.FAILED, error.message);
      return null;
    }
  }

  /**
   * Execute a limit order (check if conditions are met)
   */
  async executeLimitOrder(order: Order): Promise<Trade | null> {
    try {
      // 1. Get current market price
      const currentPrice = await this.jupiterService.getTokenPrice(
        order.inputMint,
        order.outputMint
      );

      if (!currentPrice) {
        this.logger.warn(`Unable to get current price for limit order ${order.id}`);
        return null;
      }

      // 2. Check if limit price is reached
      const shouldExecute = this.shouldExecuteLimitOrder(order, currentPrice);
      if (!shouldExecute) {
        return null; // Wait for better price
      }

      // 3. Execute as market order now
      return await this.executeMarketOrder(order);

    } catch (error) {
      this.logger.error(`Error checking limit order ${order.id}:`, error);
      return null;
    }
  }

  /**
   * Execute stop-loss order
   */
  async executeStopLossOrder(order: Order): Promise<Trade | null> {
    try {
      const currentPrice = await this.jupiterService.getTokenPrice(
        order.inputMint,
        order.outputMint
      );

      if (!currentPrice) {
        return null;
      }

      // Check if stop price is reached
      const shouldExecute = this.shouldExecuteStopLoss(order, currentPrice);
      if (!shouldExecute) {
        return null;
      }

      // Execute immediately to minimize losses
      return await this.executeMarketOrder(order);

    } catch (error) {
      this.logger.error(`Error checking stop-loss order ${order.id}:`, error);
      return null;
    }
  }

  /**
   * Process pending orders (called by scheduler)
   */
  async processPendingOrders(): Promise<void> {
    try {
      const pendingOrders = await this.getPendingOrders();
      
      for (const order of pendingOrders) {
        switch (order.type) {
          case OrderType.LIMIT:
            await this.executeLimitOrder(order);
            break;
          case OrderType.STOP_LOSS:
            await this.executeStopLossOrder(order);
            break;
          case OrderType.TAKE_PROFIT:
            await this.executeTakeProfitOrder(order);
            break;
        }
      }
    } catch (error) {
      this.logger.error('Error processing pending orders:', error);
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string, userId: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 AND status = $4',
        [OrderStatus.CANCELLED, orderId, userId, OrderStatus.PENDING]
      );

      return result.rowCount > 0;
    } catch (error) {
      this.logger.error(`Error cancelling order ${orderId}:`, error);
      return false;
    }
  }

  /**
   * Get user's open orders
   */
  async getUserOrders(userId: string, status?: OrderStatus): Promise<Order[]> {
    try {
      let query = 'SELECT * FROM orders WHERE user_id = $1';
      const params: any[] = [userId];

      if (status) {
        query += ' AND status = $2';
        params.push(status);
      }

      query += ' ORDER BY created_at DESC';

      const result = await this.pool.query(query, params);
      return result.rows;
    } catch (error) {
      this.logger.error(`Error getting user orders for ${userId}:`, error);
      return [];
    }
  }

  // Private helper methods

  private async getPendingOrders(): Promise<Order[]> {
    const result = await this.pool.query(
      'SELECT * FROM orders WHERE status = $1 ORDER BY created_at ASC',
      [OrderStatus.PENDING]
    );
    return result.rows;
  }

  private checkSlippage(order: Order, quote: any): { isValid: boolean; reason?: string } {
    const expectedPrice = order.limitPrice || order.marketPrice;
    const quotedPrice = parseFloat(quote.outAmount) / parseFloat(quote.inAmount);
    
    const slippage = Math.abs(quotedPrice - expectedPrice) / expectedPrice;
    
    if (slippage > order.slippageTolerance) {
      return {
        isValid: false,
        reason: `Slippage ${(slippage * 100).toFixed(2)}% exceeds tolerance ${(order.slippageTolerance * 100).toFixed(2)}%`
      };
    }

    return { isValid: true };
  }

  private shouldExecuteLimitOrder(order: Order, currentPrice: number): boolean {
    if (order.side === 'buy') {
      return currentPrice <= order.limitPrice;
    } else {
      return currentPrice >= order.limitPrice;
    }
  }

  private shouldExecuteStopLoss(order: Order, currentPrice: number): boolean {
    if (order.side === 'sell') {
      return currentPrice <= order.stopPrice;
    }
    return false;
  }

  private async executeTakeProfitOrder(order: Order): Promise<Trade | null> {
    const currentPrice = await this.jupiterService.getTokenPrice(
      order.inputMint,
      order.outputMint
    );

    if (!currentPrice) return null;

    // Execute when profit target is reached
    if (order.side === 'sell' && currentPrice >= order.takeProfitPrice) {
      return await this.executeMarketOrder(order);
    }

    return null;
  }

  private async createTrade(order: Order, swapResult: any, quote: any): Promise<Trade> {
    const trade: Trade = {
      id: this.generateTradeId(),
      orderId: order.id,
      userId: order.userId,
      inputMint: order.inputMint,
      outputMint: order.outputMint,
      inputAmount: parseFloat(quote.inAmount),
      outputAmount: parseFloat(quote.outAmount),
      price: parseFloat(quote.outAmount) / parseFloat(quote.inAmount),
      side: order.side,
      signature: swapResult.signature,
      status: 'completed',
      executedAt: new Date(),
      fees: swapResult.fees || 0,
      slippage: swapResult.slippage || 0
    };

    // Save to database
    await this.pool.query(`
      INSERT INTO trades (
        id, order_id, user_id, input_mint, output_mint, 
        input_amount, output_amount, price, side, signature, 
        status, executed_at, fees, slippage
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [
      trade.id, trade.orderId, trade.userId, trade.inputMint, trade.outputMint,
      trade.inputAmount, trade.outputAmount, trade.price, trade.side, trade.signature,
      trade.status, trade.executedAt, trade.fees, trade.slippage
    ]);

    return trade;
  }

  private async updateOrderStatus(orderId: string, status: OrderStatus, reason?: string): Promise<void> {
    await this.pool.query(
      'UPDATE orders SET status = $1, failure_reason = $2, updated_at = NOW() WHERE id = $3',
      [status, reason, orderId]
    );
  }

  private generateTradeId(): string {
    return `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}