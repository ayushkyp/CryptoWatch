const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
} = require('../controllers/watchlistController');

router.get('/', authMiddleware, getWatchlist);
router.post('/add', authMiddleware, addToWatchlist);
router.delete('/remove', authMiddleware, removeFromWatchlist);

module.exports = router;
