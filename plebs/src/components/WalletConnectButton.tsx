import React, { useState } from 'react';

const WALLET_OPTIONS = [
	{ name: 'Phantom', id: 'phantom' },
	{ name: 'Solflare', id: 'solflare' },
	{ name: 'Backpack', id: 'backpack' },
	{ name: 'Jup', id: 'jup' },
	{ name: 'Connect via Telegram Bot', id: 'telegram' },
];

const WalletConnectButton = () => {
	const [showOptions, setShowOptions] = useState(false);
	const [message, setMessage] = useState('');

	const handleWalletSelect = (walletId: string) => {
		setShowOptions(false);
		setMessage('');
		if (walletId === 'telegram') {
			setMessage('To connect your wallet via Telegram, use the /connect command in the Telegram bot.');
		} else {
			// Placeholder: Integrate with wallet adapter for the selected wallet
			setMessage(`Connecting to ${walletId} wallet... (integration needed)`);
		}
	};

	return (
		<div style={{ position: 'relative', display: 'inline-block' }}>
			<button
				style={{ padding: '8px 16px', borderRadius: '6px', background: '#512da8', color: '#fff', border: 'none' }}
				onClick={() => setShowOptions((v) => !v)}
			>
				Connect Wallet
			</button>
			{showOptions && (
				<div style={{ position: 'absolute', top: '110%', left: 0, background: '#fff', border: '1px solid #ccc', borderRadius: 6, zIndex: 10, minWidth: 180 }}>
					{WALLET_OPTIONS.map((wallet) => (
						<div
							key={wallet.id}
							style={{ padding: '10px 16px', cursor: 'pointer', color: '#333' }}
							onClick={() => handleWalletSelect(wallet.id)}
							onKeyDown={(e) => { if (e.key === 'Enter') handleWalletSelect(wallet.id); }}
							tabIndex={0}
							role="button"
						>
							{wallet.name}
						</div>
					))}
				</div>
			)}
			{message && (
				<div style={{ marginTop: 10, color: '#333', background: '#f5f5f5', padding: 10, borderRadius: 6 }}>{message}</div>
			)}
		</div>
	);
};

export default WalletConnectButton;

npm install --save-dev @types/react @types/react-dom
