const express = require('express');
const router = express.Router();

// Placeholder wallet route
router.get('/', (req, res) => {
  res.json({ message: 'Wallet route working' });
});

module.exports = router;
