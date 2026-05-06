const TRACKED_COINS = [
  {
    id: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    binanceSymbol: 'BTCUSDT',
    image: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/btc.png',
  },
  {
    id: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    binanceSymbol: 'ETHUSDT',
    image: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/eth.png',
  },
  {
    id: 'solana',
    symbol: 'SOL',
    name: 'Solana',
    binanceSymbol: 'SOLUSDT',
    image: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/sol.png',
  },
  {
    id: 'dogecoin',
    symbol: 'DOGE',
    name: 'Dogecoin',
    binanceSymbol: 'DOGEUSDT',
    image: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/doge.png',
  },
  {
    id: 'ripple',
    symbol: 'XRP',
    name: 'XRP',
    binanceSymbol: 'XRPUSDT',
    image: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/xrp.png',
  },
  {
    id: 'cardano',
    symbol: 'ADA',
    name: 'Cardano',
    binanceSymbol: 'ADAUSDT',
    image: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/ada.png',
  },
  {
    id: 'polkadot',
    symbol: 'DOT',
    name: 'Polkadot',
    binanceSymbol: 'DOTUSDT',
    image: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/dot.png',
  },
  {
    id: 'chainlink',
    symbol: 'LINK',
    name: 'Chainlink',
    binanceSymbol: 'LINKUSDT',
    image: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/link.png',
  },
  {
    id: 'litecoin',
    symbol: 'LTC',
    name: 'Litecoin',
    binanceSymbol: 'LTCUSDT',
    image: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/ltc.png',
  },
  {
    id: 'avalanche-2',
    symbol: 'AVAX',
    name: 'Avalanche',
    binanceSymbol: 'AVAXUSDT',
    image: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/avax.png',
  },
];

const TRACKED_BY_BINANCE = TRACKED_COINS.reduce((acc, coin) => {
  acc[coin.binanceSymbol] = coin;
  return acc;
}, {});

const TRACKED_BY_SYMBOL = TRACKED_COINS.reduce((acc, coin) => {
  acc[coin.symbol] = coin;
  return acc;
}, {});

module.exports = { TRACKED_COINS, TRACKED_BY_BINANCE, TRACKED_BY_SYMBOL };