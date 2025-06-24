const { 
  Transaction, 
  SystemProgram, 
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  PublicKey,
  ComputeBudgetProgram
} = require('@solana/web3.js');
const fetch = require('node-fetch');

class SolanaService {
  constructor() {
    this.connection = { getParsedTransaction: async () => null };
    this.feePayer = { publicKey: 'placeholder' };
  }

  async createToken2022WithExtensions() {
    return { mint: 'mint_placeholder', signature: 'sig_placeholder' };
  }

  /**
   * Parse Solana transactions using Helius Enhanced API
   * @param {string[]} signatures - Array of transaction signatures
   * @returns {Promise<Object>} - Parsed transaction data from Helius
   */
  async parseTransactionsWithHelius(signatures) {
    const apiKey = process.env.HELIUS_API_KEY;
    const url = `https://api.helius.xyz/v0/transactions/?api-key=${apiKey}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions: signatures })
    });
    if (!resp.ok) throw new Error(`Helius API error: ${resp.statusText}`);
    return await resp.json();
  }

  /**
   * Get parsed transaction history for a Solana address using Helius Enhanced API
   * @param {string} address - Solana wallet address
   * @param {object} [options] - Optional query params (e.g., limit, before, until)
   * @returns {Promise<Object>} - Parsed transaction history from Helius
   */
  async getParsedTransactionHistory(address, options = {}) {
    const apiKey = process.env.HELIUS_API_KEY;
    let url = `https://api.helius.xyz/v0/addresses/${address}/transactions/?api-key=${apiKey}`;
    const params = new URLSearchParams(options).toString();
    if (params) url += `&${params}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Helius API error: ${resp.statusText}`);
    return await resp.json();
  }
}

module.exports = new SolanaService();