import React, { useState } from 'react';
import WalletConnectButton from '../components/WalletConnectButton';
import TokenSearch from '../components/TokenSearch';
import TrendingTokens from '../components/TrendingTokens';
import TokenChart from '../components/TokenChart';
import JupiterTerminalWidget from '../components/JupiterTerminalWidget';

const MainPage = () => {
  const [selectedToken, setSelectedToken] = useState(null);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <h1>PLEBLAUNCH</h1>
      <WalletConnectButton />
      <TokenSearch onTokenSelect={setSelectedToken} />
      {selectedToken && <TokenChart token={selectedToken} />}
      <TrendingTokens />
      <JupiterTerminalWidget />
    </div>
  );
};

export default MainPage;
