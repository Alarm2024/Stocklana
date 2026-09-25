/** Peg Watch stock registry — mints verified via xStocks / Backed public API. */

export const THRESHOLDS = {
  /** Flag when |premium/discount| exceeds this many basis points. */
  premiumBps: 100,
  /** Flag reference price as STALE when older than this (seconds) during market hours. */
  staleSeconds: 300,
  /** Approximate Solana slot duration for Jupiter blockId age estimates. */
  slotSeconds: 0.4,
};

export const ENDPOINTS = {
  jupiterPrice: 'https://api.jup.ag/price/v3',
  pythHermesMeta: 'https://hermes.pyth.network/v2/price_feeds',
  solanaRpc: [
    'https://api.mainnet-beta.solana.com',
    'https://solana-rpc.publicnode.com',
  ],
};

/** @typedef {Object} StockConfig */
/** @type {StockConfig[]} */
export const STOCKS = [
  {
    symbol: 'TSLAx',
    underlying: 'TSLA',
    mint: 'XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB',
    pythFeedId: '16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1',
    pythSymbol: 'Equity.US.TSLA/USD',
    pythOnChainAccount: 'E8WFH8brgP58arcuW2wwsPHiomYrSvrgWTsRLZLAEZUQ',
    mintSource: 'https://api.backed.fi/api/v2/public/assets/TSLAx',
  },
  {
    symbol: 'AAPLx',
    underlying: 'AAPL',
    mint: 'XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp',
    pythFeedId: '49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688',
    pythSymbol: 'Equity.US.AAPL/USD',
    pythOnChainAccount: 'DJ2FyTgUAkEtXW3U5P9PF19meFTRtW4ZWKKFgACfVbUy',
    mintSource: 'https://api.backed.fi/api/v2/public/assets/AAPLx',
  },
  {
    symbol: 'NVDAx',
    underlying: 'NVDA',
    mint: 'Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh',
    pythFeedId: 'b1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593',
    pythSymbol: 'Equity.US.NVDA/USD',
    pythOnChainAccount: '2w1Tg1XTZbUib7srfRoStJ4v5JXVsK7roQEGMsMaGZFC',
    mintSource: 'https://api.backed.fi/api/v2/public/assets/NVDAx',
  },
  {
    symbol: 'GOOGLx',
    underlying: 'GOOGL',
    mint: 'XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN',
    pythFeedId: '5a48c03e9b9cb337801073ed9d166817473697efff0d138874e0f6a33d6d5aa6',
    pythSymbol: 'Equity.US.GOOGL/USD',
    pythOnChainAccount: 'HShKFQqhYkUiXpVyyLmrAALXwWqHB7ikLmPbrwJzpRNh',
    mintSource: 'https://api.backed.fi/api/v2/public/assets/GOOGLx',
  },
  {
    symbol: 'SPYx',
    underlying: 'SPY',
    mint: 'XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W',
    pythFeedId: '19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5',
    pythSymbol: 'Equity.US.SPY/USD',
    pythOnChainAccount: '9owhtgrdLiUMAH9JKxYFt5pUY4Luy4EzzLhdcWPVuDyy',
    mintSource: 'https://api.backed.fi/api/v2/public/assets/SPYx',
  },
];
