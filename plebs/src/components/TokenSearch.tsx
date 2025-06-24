import React, { useState } from 'react';

const TokenSearch = ({ onTokenSelect }) => {
  const [query, setQuery] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      onTokenSelect(query.trim());
    }
  };

  return (
    <form onSubmit={handleSearch} style={{ margin: '24px 0' }}>
      <input
        type="text"
        placeholder="Search token by name, symbol, or address"
        value={query}
        onChange={e => setQuery(e.target.value)}
        style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc', width: 300 }}
      />
      <button type="submit" style={{ marginLeft: 8, padding: '8px 16px', borderRadius: '6px', background: '#1976d2', color: '#fff', border: 'none' }}>
        Search
      </button>
    </form>
  );
};

export default TokenSearch;
