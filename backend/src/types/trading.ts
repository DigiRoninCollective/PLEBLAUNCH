// Trading Types Definition File
// Location: backend/types/trading.ts

export enum OrderType {
  MARKET = 'market',
  LIMIT = 'limit',
  STOP_LOSS = 'stop_loss',
  TAKE_PROFIT = 'take_profit',
  TRAILING_STOP = 'trailing_stop'
}

export enum OrderStatus {
  PENDING = 'pending',
  FILLED = 'filled',
  PARTIALLY_FILLED = 'partially_filled',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected',
  FAILED = 'failed',
  EXPIRED = 'expired'
}

export enum OrderSide {
  BUY = 'buy',
  SELL = 'sell'
}

export enum TradeStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface Order {
  id: string;
  userId: string;
  userWallet: string;
  type: OrderType;
  side: OrderSide;
  status: OrderStatus;
  
  // Token info
  inputMint: string;
  outputMint: string;
  inputSymbol?: string;
  outputSymbol?: string;
  
  // Amounts and prices
  amount: number;
  limitPrice?: number;
  stopPrice?: number;
  takeProfitPrice?: number;
  marketPrice?: number;
  
  // Execution parameters
  slippageTolerance: number;
  maxRetries?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK'; // Good Till Cancelled, Immediate or Cancel, Fill or Kill
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  executedAt?: Date;
  failureReason?: string;
  
  // Strategy info
  strategyId?: string;
  isAutomated?: boolean;
  parentOrderId?: string; // For bracket orders
}

export interface Trade {
  id: string;
  orderId: string;
  userId: string;
  
  // Token info
  inputMint: string;
  outputMint: string;
  inputSymbol?: string;
  outputSymbol?: string;
  
  // Trade details
  inputAmount: number;
  outputAmount: number;
  price: number;
  side: OrderSide;
  
  // Execution info
  signature: string;
  status: TradeStatus;
  executedAt: Date;
  
  // Costs
  fees: number;
  slippage: number;
  gasUsed?: number;
  
  // DEX info
  dex?: string;
  route?: string[];
  
  // P&L (calculated)
  pnl?: number;
  pnlPercentage?: number;
}

export interface Position {
  id: string;
  userId: string;
  mint: string;
  symbol: string;
  
  // Position details
  size: number; // Current holdings
  averagePrice: number;
  totalInvested: number;
  currentValue: number;
  
  // P&L
  unrealizedPnl: number;
  unrealizedPnlPercentage: number;
  realizedPnl: number;
  
  // Metadata
  firstPurchaseAt: Date;
  lastUpdatedAt: Date;
  
  // Risk management
  stopLossPrice?: number;
  takeProfitPrice?: number;
  trailingStopPercentage?: number;
}

export interface Portfolio {
  id: string;
  userId: string;
  
  // Total values
  totalValue: number;
  totalInvested: number;
  availableBalance: number;
  
  // P&L
  totalPnl: number;
  totalPnlPercentage: number;
  dailyPnl: number;
  dailyPnlPercentage: number;
  
  // Positions
  positions: Position[];
  
  // Metadata
  createdAt: Date;
  lastUpdatedAt: Date;
}

export interface Strategy {
  id: string;
  userId: string;
  name: string;
  description: string;
  
  // Strategy parameters
  type: 'DCA' | 'GRID' | 'ARBITRAGE' | 'MOMENTUM' | 'MEAN_REVERSION' | 'CUSTOM';
  isActive: boolean;
  
  // Target tokens
  inputMint: string;
  outputMint: string;
  
  // Execution parameters
  parameters: Record<string, any>;
  
  // Performance
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  
  // Metadata
  createdAt: Date;
  lastExecutedAt?: Date;
}

export interface MarketData {
  mint: string;
  symbol: string;
  price: number;
  priceChange24h: number;
  priceChangePercentage24h: number;
  volume24h: number;
  marketCap?: number;
  liquidity?: number;
  
  // Technical indicators
  rsi?: number;
  macd?: number;
  bollinger?: {
    upper: number;
    middle: number;
    lower: number;
  };
  
  timestamp: Date;
}

export interface OrderBook {
  mint: string;
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: Date;
}

export interface OrderBookLevel {
  price: number;
  size: number;
  count: number;
}

export interface Quote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee?: {
    amount: string;
    feeBps: number;
  };
  priceImpactPct: string;
  routePlan: RoutePlan[];
  contextSlot?: number;
  timeTaken?: number;
}

export interface RoutePlan {
  swapInfo: {
    ammKey: string;
    label: string;
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    feeAmount: string;
    feeMint: string;
  };
  percent: number;
}

export interface SwapResult {
  success: boolean;
  signature?: string;
  error?: string;
  fees?: number;
  slippage?: number;
  gasUsed?: number;
}

export interface RiskParameters {
  maxPositionSize: number;
  maxPortfolioRisk: number;
  maxDailyLoss: number;
  maxSlippage: number;
  minLiquidity: number;
  blacklistedTokens: string[];
  maxOrdersPerHour: number;
}

export interface BacktestResult {
  strategyId: string;
  period: {
    start: Date;
    end: Date;
  };
  
  // Performance metrics
  totalReturn: number;
  totalReturnPercentage: number;
  annualizedReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  
  // Trade statistics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  averageWin: number;
  averageLoss: number;
  
  // Daily P&L
  dailyReturns: Array<{
    date: Date;
    return: number;
    returnPercentage: number;
    portfolioValue: number;
  }>;
}

export interface ArbitrageOpportunity {
  id: string;
  inputMint: string;
  outputMint: string;
  symbol: string;
  
  // Price difference
  buyPrice: number;
  sellPrice: number;
  priceDifference: number;
  profitPercentage: number;
  
  // DEX info
  buyDex: string;
  sellDex: string;
  
  // Execution info
  maxAmount: number;
  estimatedProfit: number;
  estimatedGas: number;
  netProfit: number;
  
  // Risk factors
  liquidity: number;
  slippage: number;
  timeToExecute: number;
  
  timestamp: Date;
  expiresAt: Date;
}

export interface MEVOpportunity {
  id: string;
  type: 'sandwich' | 'arbitrage' | 'liquidation' | 'frontrun';
  
  // Target transaction
  targetTx: string;
  targetUser: string;
  
  // Opportunity details
  estimatedProfit: number;
  requiredCapital: number;
  riskScore: number;
  
  // Execution window
  discoveredAt: Date;
  expiresAt: Date;
  blockDeadline: number;
  
  // Execution plan
  transactions: Array<{
    type: 'front' | 'back' | 'main';
    instruction: string;
    estimatedGas: number;
  }>;
}

// WebSocket message types
export interface WSMessage {
  type: string;
  data: any;
  timestamp: Date;
}

export interface PriceUpdateMessage extends WSMessage {
  type: 'price_update';
  data: {
    mint: string;
    price: number;
    change24h: number;
  };
}

export interface OrderUpdateMessage extends WSMessage {
  type: 'order_update';
  data: {
    orderId: string;
    status: OrderStatus;
    trade?: Trade;
  };
}

export interface PortfolioUpdateMessage extends WSMessage {
  type: 'portfolio_update';
  data: {
    totalValue: number;
    totalPnl: number;
    positions: Position[];
  };
}