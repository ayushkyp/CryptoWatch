const Alert = require('../models/Alert');
const { TRACKED_COINS } = require('../config/trackedCoins');

const ID_TO_SYMBOL = TRACKED_COINS.reduce((acc, coin) => {
  acc[coin.id] = coin.symbol;
  return acc;
}, {});

const normalizeSymbol = (symbol, coin) => {
  const raw = String(symbol || ID_TO_SYMBOL[coin] || coin || '').trim().toUpperCase();
  return raw.endsWith('USDT') ? raw.replace(/USDT$/, '') : raw;
};

const getAlerts = async (req, res) => {
  try {
    const alerts = await Alert.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json({ alerts });
  } catch (error) {
    console.error('Get alerts error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

const createAlert = async (req, res) => {
  try {
    const { coin, symbol, coinName, targetPrice, condition } = req.body;
    const numericTargetPrice = Number(targetPrice);

    if (!symbol || !coinName || !condition || !Number.isFinite(numericTargetPrice) || numericTargetPrice <= 0) {
      return res.status(400).json({ message: 'symbol, coinName, condition and positive targetPrice are required' });
    }

    if (!['above', 'below'].includes(condition)) {
      return res.status(400).json({ message: 'Condition must be above or below' });
    }

    const normalizedSymbol = normalizeSymbol(symbol, coin);

    const alert = await Alert.create({
      userId: req.userId,
      coin: coin || String(symbol).toLowerCase(),
      symbol: normalizedSymbol,
      coinName,
      targetPrice: numericTargetPrice,
      condition,
    });

    res.status(201).json({ alert });
  } catch (error) {
    console.error('Create alert error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteAlert = async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    if (alert.userId.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized to delete this alert' });
    }

    await Alert.findByIdAndDelete(req.params.id);
    res.json({ message: 'Alert deleted' });
  } catch (error) {
    console.error('Delete alert error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

const getTriggeredAlerts = async (req, res) => {
  try {
    const alerts = await Alert.find({
      userId: req.userId,
      status: 'triggered',
    }).sort({ triggeredAt: -1 });
    res.json({ alerts });
  } catch (error) {
    console.error('Get triggered alerts error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getAlerts, createAlert, deleteAlert, getTriggeredAlerts };
