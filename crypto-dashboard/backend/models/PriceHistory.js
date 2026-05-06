const mongoose = require('mongoose');

const priceHistorySchema = new mongoose.Schema({
  coin: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  change24h: {
    type: Number,
    default: 0,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

/**
 * PERFORMANCE NOTE: Compound index on { coin, timestamp } makes
 * history queries O(log n) instead of O(n). This is critical when
 * we query "last 50 records for bitcoin" — without this index,
 * MongoDB would scan the entire collection.
 */
priceHistorySchema.index({ coin: 1, timestamp: -1 });

module.exports = mongoose.model('PriceHistory', priceHistorySchema);
