const Alert = require('../models/Alert');

/**
 * ARCHITECTURE NOTE: Alert checking runs server-side on every price update.
 * This is event-driven architecture — alerts fire the moment a price crosses
 * a threshold, not on a separate polling schedule. There is zero latency
 * between price update and alert notification.
 */
const checkAlerts = async (prices, io) => {
  try {
    const activeAlerts = await Alert.find({ status: 'active' });

    for (const alert of activeAlerts) {
      const coinData = prices.find((p) => p.id === alert.coin);
      if (!coinData) continue;

      const currentPrice = coinData.price;
      let triggered = false;

      if (alert.condition === 'above' && currentPrice >= alert.targetPrice) {
        triggered = true;
      } else if (alert.condition === 'below' && currentPrice <= alert.targetPrice) {
        triggered = true;
      }

      if (triggered) {
        alert.status = 'triggered';
        alert.triggeredAt = new Date();
        await alert.save();

        // Emit to the specific user's socket room (or broadcast if no rooms)
        io.emit('alertTriggered', {
          alertId: alert._id,
          userId: alert.userId,
          coin: alert.coin,
          coinName: alert.coinName,
          condition: alert.condition,
          targetPrice: alert.targetPrice,
          currentPrice,
          triggeredAt: alert.triggeredAt,
        });

        console.log(`Alert triggered: ${alert.coinName} ${alert.condition} ${alert.targetPrice}`);
      }
    }
  } catch (error) {
    console.error('Error checking alerts:', error.message);
  }
};

module.exports = { checkAlerts };
