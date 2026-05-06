const Alert = require('../models/Alert');

/**
 * ARCHITECTURE NOTE: Alert checking runs server-side on every price update.
 * This is event-driven architecture — alerts fire the moment a price crosses
 * a threshold, not on a separate polling schedule. There is zero latency
 * between price update and alert notification.
 */
const checkAlerts = async (pricesBySymbol, io) => {
  try {
    const activeAlerts = await Alert.find({ status: 'active' });

    for (const alert of activeAlerts) {
      const normalizedSymbol = String(alert.symbol || alert.coin || '').toUpperCase();
      const pairSymbol = normalizedSymbol.endsWith('USDT') ? normalizedSymbol : `${normalizedSymbol}USDT`;

      const coinData = pricesBySymbol[pairSymbol];
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

        const alertPayload = {
          alertId: alert._id,
          userId: alert.userId,
          coin: alert.coin,
          coinName: alert.coinName,
          symbol: alert.symbol,
          condition: alert.condition,
          targetPrice: alert.targetPrice,
          currentPrice,
          triggeredAt: alert.triggeredAt,
        };

        // Emit to specific user's room if available, otherwise broadcast
        if (alert.userId) {
          const userRoom = `user:${alert.userId}`;
          io.to(userRoom).emit('alertTriggered', alertPayload);
          console.log(`Alert triggered for user ${alert.userId}: ${alert.coinName} ${alert.condition} ${alert.targetPrice}`);
        } else {
          io.emit('alertTriggered', alertPayload);
          console.log(`Alert triggered (broadcast): ${alert.coinName} ${alert.condition} ${alert.targetPrice}`);
        }
      }
    }
  } catch (error) {
    console.error('Error checking alerts:', error.message);
  }
};

module.exports = { checkAlerts };
