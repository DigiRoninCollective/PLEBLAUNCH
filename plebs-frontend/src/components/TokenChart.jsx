import React from 'react';

const TokenChart = ({ token }) => (
  <div style={{ margin: '24px 0' }}>
    <h2>Token Chart</h2>
    {/* Placeholder for chart. Integrate Chart.js or Recharts for real data. */}
    <div style={{ height: 300, background: '#eee', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      Chart for {token || 'selected token'} coming soon...
    </div>
  </div>
);

export default TokenChart;
