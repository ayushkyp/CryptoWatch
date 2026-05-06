const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  coin: {
    type: String,
    required: true,
  },
  coinName: {
    type: String,
    required: true,
  },
  targetPrice: {
    type: Number,
    required: true,
  },
  condition: {
    type: String,
    enum: ['above', 'below'],
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'triggered'],
    default: 'active',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  triggeredAt: {
    type: Date,
    default: null,
  },
});

module.exports = mongoose.model('Alert', alertSchema);
