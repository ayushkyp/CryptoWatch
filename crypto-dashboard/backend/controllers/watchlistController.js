const User = require('../models/User');
const { TRACKED_COINS } = require('../config/trackedCoins');

const ID_TO_SYMBOL = TRACKED_COINS.reduce((acc, coin) => {
  acc[coin.id] = coin.symbol;
  return acc;
}, {});

const normalizeWatchlistToken = (token) => {
  const value = String(token || '').trim();
  if (!value) return null;

  if (ID_TO_SYMBOL[value]) return ID_TO_SYMBOL[value];
  return value.toUpperCase();
};

const getWatchlist = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('watchlist');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const normalizedWatchlist = [...new Set(user.watchlist.map(normalizeWatchlistToken).filter(Boolean))];
    if (normalizedWatchlist.length !== user.watchlist.length) {
      user.watchlist = normalizedWatchlist;
      await user.save();
    }

    res.json({ watchlist: normalizedWatchlist });
  } catch (error) {
    console.error('Get watchlist error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

const addToWatchlist = async (req, res) => {
  try {
    const { coin } = req.body;
    const normalizedCoin = normalizeWatchlistToken(coin);
    if (!normalizedCoin) {
      return res.status(400).json({ message: 'Coin symbol is required' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const current = new Set(user.watchlist.map(normalizeWatchlistToken).filter(Boolean));
    current.add(normalizedCoin);

    user.watchlist = [...current];
    await user.save();

    res.json({ watchlist: user.watchlist });
  } catch (error) {
    console.error('Add to watchlist error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

const removeFromWatchlist = async (req, res) => {
  try {
    const { coin } = req.body;
    const normalizedCoin = normalizeWatchlistToken(coin);
    if (!normalizedCoin) {
      return res.status(400).json({ message: 'Coin symbol is required' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.watchlist = user.watchlist
      .map(normalizeWatchlistToken)
      .filter((c) => c && c !== normalizedCoin);
    await user.save();

    res.json({ watchlist: user.watchlist });
  } catch (error) {
    console.error('Remove from watchlist error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getWatchlist, addToWatchlist, removeFromWatchlist };
