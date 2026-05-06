const Alert = require('../models/Alert');

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
    const { coin, coinName, targetPrice, condition } = req.body;

    if (!coin || !coinName || !targetPrice || !condition) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (!['above', 'below'].includes(condition)) {
      return res.status(400).json({ message: 'Condition must be above or below' });
    }

    const alert = await Alert.create({
      userId: req.userId,
      coin,
      coinName,
      targetPrice: Number(targetPrice),
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
