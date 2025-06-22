const { supabase } = require('../utils/superbase');

async function getTodos(req, res) {
  const { data, error } = await supabase.from('todos').select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

module.exports = { getTodos };
