const express = require('express');
const router = express.Router();

// Placeholder login route
router.post('/login', (req, res) => {
  res.json({ message: 'Auth route working' });
});

module.exports = router;
