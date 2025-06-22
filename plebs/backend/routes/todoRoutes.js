const express = require('express');
const router = express.Router();

// Placeholder todo route
router.get('/todos', (req, res) => {
  res.json({ message: 'Todo route working' });
});

module.exports = router;
