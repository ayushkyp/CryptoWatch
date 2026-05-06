const User = require('../models/User');

const getWatchlist = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('watchlist');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ watchlist: user.watchlist });
  } catch (error) {
    console.error('Get watchlist error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

const addToWatchlist = async (req, res) => {
  try {
    const { coin } = req.body;
    if (!coin) {
      return res.status(400).json({ message: 'Coin ID is required' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.watchlist.includes(coin)) {
      user.watchlist.push(coin);
      await user.save();
    }

    res.json({ watchlist: user.watchlist });
  } catch (error) {
    console.error('Add to watchlist error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

const removeFromWatchlist = async (req, res) => {
  try {
    const { coin } = req.body;
    if (!coin) {
      return res.status(400).json({ message: 'Coin ID is required' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.watchlist = user.watchlist.filter((c) => c !== coin);
    await user.save();

    res.json({ watchlist: user.watchlist });
  } catch (error) {
    console.error('Remove from watchlist error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getWatchlist, addToWatchlist, removeFromWatchlist };
