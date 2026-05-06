const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  getAlerts,
  createAlert,
  deleteAlert,
  getTriggeredAlerts,
} = require('../controllers/alertController');

router.get('/', authMiddleware, getAlerts);
router.post('/', authMiddleware, createAlert);
router.delete('/:id', authMiddleware, deleteAlert);
router.get('/triggered', authMiddleware, getTriggeredAlerts);

module.exports = router;
