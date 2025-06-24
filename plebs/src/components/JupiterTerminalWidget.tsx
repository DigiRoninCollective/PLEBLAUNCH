import React from 'react';

const JupiterTerminalWidget = () => (
  <div>
    <h2>Jupiter Terminal</h2>
    <iframe
      src="https://terminal.jup.ag/main-v4.html"
      title="Jupiter Terminal"
      width="100%"
      height="600"
      style={{ border: 'none', borderRadius: '12px' }}
      allow="clipboard-write"
    />
  </div>
);

export default JupiterTerminalWidget;
