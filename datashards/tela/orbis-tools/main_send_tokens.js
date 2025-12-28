"use strict";

window.sendToken = async function(scid) {

const details = window.assetDetails.get(scid);
if (!details) {
showMessage('error', 'Token details not found');
return;
}
openSendTokenModal(details);
};

window.sendDero = async function() {

if (!window.isWalletConnected) {
showMessage('error', 'Please connect your wallet first');
return;
}
const deroBalance = window.deroBalance || 0;
openSendDeroModal(deroBalance);
};

async function sendRPCDaemon(method, params = {}) {
const daemonAddress = window.deroNodeAddress || 'node.derofunds.io';
const endpoint = `https://${daemonAddress}/json_rpc`;
try {
const response = await fetch(endpoint, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
jsonrpc: '2.0',
id: '1',
method: method,
params: params
})
});
const data = await response.json();
if (data.error) {
return { error: data.error };
}
return data.result;
} catch (error) {
throw error;
}
}

function openSendTokenModal(details) {
closeSendTokenModal();
const modal = document.createElement('div');
modal.id = 'send-token-modal';
modal.className = 'modal-overlay';
const maxBalance = details.balance || 0;
const tokenName = details.name || 'Token';
modal.innerHTML = `
<div class="modal-content send-modal">
<div class="modal-header">
<h2>📤 Send ${tokenName}</h2>
<button class="modal-close" onclick="closeSendTokenModal()">×</button>
</div>
<div class="modal-body">
<div class="form-group">
<label>Token:</label>
<div class="token-info-display">
<span class="token-name">${tokenName}</span>
<span class="token-scid">${details.scid.substring(0, 8)}...${details.scid.substring(details.scid.length - 8)}</span>
</div>
</div>
<div class="form-group">
<label for="token-destination">Destination Address:</label>
<input type="text"
id="token-destination"
class="form-input"
placeholder="dero1... or @name"
oninput="validateTokenAddressInModal(this.value)">
<div id="token-address-validation" class="form-text"></div>
</div>
<div class="form-group">
<label for="token-amount">Amount:</label>
<div class="amount-input-wrapper">
<input type="number"
id="token-amount"
class="form-input"
placeholder="0.00000"
min="0"
max="${maxBalance}"
step="0.00001">
<button class="max-btn" onclick="setMaxTokenAmount(${maxBalance})">MAX</button>
</div>
<div class="form-text">Available: ${formatTokenBalance(maxBalance)}</div>
</div>
<div class="form-group">
<label for="token-ringsize">Ring Size:</label>
<select id="token-ringsize" class="form-input">
<option value="2">2 (Fastest)</option>
<option value="4">4</option>
<option value="8" selected>8 (Recommended)</option>
<option value="16">16</option>
<option value="32">32</option>
<option value="64">64</option>
<option value="128">128 (Most Private)</option>
</select>
<div class="form-text">Higher ring size = more privacy, slower</div>
</div>
</div>
<div class="modal-footer">
<button class="btn-secondary" onclick="closeSendTokenModal()">Cancel</button>
<button class="btn-primary" onclick="confirmSendToken('${details.scid}', ${maxBalance})">Send Token</button>
</div>
</div>
`;
document.body.appendChild(modal);
setTimeout(() => {
const input = document.getElementById('token-destination');
if (input) input.focus();
}, 100);
}
function openSendDeroModal(maxBalance) {
closeSendDeroModal();
const modal = document.createElement('div');
modal.id = 'send-dero-modal';
modal.className = 'modal-overlay';
modal.innerHTML = `
<div class="modal-content send-modal">
<div class="modal-header">
<h2>💰 Send DERO</h2>
<button class="modal-close" onclick="closeSendDeroModal()">×</button>
</div>
<div class="modal-body">
<div class="form-group">
<label for="dero-destination">Destination Address:</label>
<input type="text"
id="dero-destination"
class="form-input"
placeholder="dero1... or @name"
oninput="validateDeroAddressInModal(this.value)">
<div id="dero-address-validation" class="form-text"></div>
</div>
<div class="form-group">
<label for="dero-amount">Amount (DERO):</label>
<div class="amount-input-wrapper">
<input type="number"
id="dero-amount"
class="form-input"
placeholder="0.00000"
min="0"
max="${maxBalance / 100000}"
step="0.00001">
<button class="max-btn" onclick="setMaxDeroAmount(${maxBalance})">MAX</button>
</div>
<div class="form-text">Available: ${(maxBalance / 100000).toFixed(5)} DERO</div>
</div>
<div class="form-group">
<label for="dero-ringsize">Ring Size:</label>
<select id="dero-ringsize" class="form-input">
<option value="2">2 (Fastest)</option>
<option value="4">4</option>
<option value="8" selected>8 (Recommended)</option>
<option value="16">16</option>
<option value="32">32</option>
<option value="64">64</option>
<option value="128">128 (Most Private)</option>
</select>
<div class="form-text">Higher ring size = more privacy, slower</div>
</div>
</div>
<div class="modal-footer">
<button class="btn-secondary" onclick="closeSendDeroModal()">Cancel</button>
<button class="btn-primary" onclick="confirmSendDero(${maxBalance})">Send DERO</button>
</div>
</div>
`;
document.body.appendChild(modal);
setTimeout(() => {
const input = document.getElementById('dero-destination');
if (input) input.focus();
}, 100);
}

function showTransactionSummary(destination, amount, ringsize, onConfirm) {
const existingModal = document.getElementById('tx-summary-modal');
if (existingModal) existingModal.remove();
const modal = document.createElement('div');
modal.id = 'tx-summary-modal';
modal.className = 'modal-overlay';
const amountDero = (amount / 100000).toFixed(5);
const displayAddress = destination.length > 20
? `${destination.substring(0, 10)}...${destination.substring(destination.length - 10)}`
: destination;
modal.innerHTML = `
<div class="modal-content send-modal">
<div class="modal-header">
<h2>📋 Transaction Summary</h2>
<button class="modal-close" onclick="closeTransactionSummary()">×</button>
</div>
<div class="modal-body">
<div class="tx-summary-section">
<div class="tx-summary-item">
<span class="tx-label">Destination:</span>
<span class="tx-value" title="${destination}">${displayAddress}</span>
</div>
<div class="tx-summary-item">
<span class="tx-label">Amount:</span>
<span class="tx-value tx-amount">${amountDero} DERO</span>
</div>
<div class="tx-summary-item">
<span class="tx-label">Ring Size:</span>
<span class="tx-value">${ringsize}</span>
</div>
</div>
<div class="tx-warning">
<p>⚠️ Please verify all details before confirming. This action cannot be undone.</p>
<p style="margin-top: 0.5rem; font-size: 0.85rem;">Note: Transaction fees will be calculated and deducted automatically by the wallet.</p>
</div>
</div>
<div class="modal-footer">
<button class="btn-secondary" onclick="closeTransactionSummary()">Cancel</button>
<button class="btn-primary" onclick="confirmTransactionFromSummary()">Confirm & Send</button>
</div>
</div>
`;
document.body.appendChild(modal);
window._pendingTransaction = {
destination,
amount,
ringsize,
onConfirm
};
}
window.closeTransactionSummary = function() {
const modal = document.getElementById('tx-summary-modal');
if (modal) modal.remove();
window._pendingTransaction = null;
};
window.confirmTransactionFromSummary = function() {
if (window._pendingTransaction && window._pendingTransaction.onConfirm) {
window._pendingTransaction.onConfirm();
closeTransactionSummary();
}
};

window.closeSendTokenModal = function() {
const modal = document.getElementById('send-token-modal');
if (modal) modal.remove();
};
window.closeSendDeroModal = function() {
const modal = document.getElementById('send-dero-modal');
if (modal) modal.remove();
};

async function validateTokenAddressInModal(address) {
if (typeof window.validateDeroAddress === 'function') {
return await window.validateDeroAddress(address, 'token-address-validation');
}
return { valid: false, address: null };
}
async function validateDeroAddressInModal(address) {
if (typeof window.validateDeroAddress === 'function') {
return await window.validateDeroAddress(address, 'dero-address-validation');
}
return { valid: false, address: null };
}

window.setMaxTokenAmount = function(maxBalance) {
const amountInput = document.getElementById('token-amount');
if (amountInput) {
amountInput.value = formatTokenBalance(maxBalance);
}
};
window.setMaxDeroAmount = function(maxBalance) {
const amountInput = document.getElementById('dero-amount');
if (!amountInput) return;

const reservedForFees = 5000;
const maxAmountAfterFees = maxBalance - reservedForFees;
if (maxAmountAfterFees <= 0) {
showMessage('error', 'Insufficient balance. Need at least 0.05 DERO for transaction fees.');
return;
}
amountInput.value = (maxAmountAfterFees / 100000).toFixed(5);
showMessage('success', 'MAX amount set (0.05 DERO reserved for fees)');
};

window.confirmSendToken = async function(scid, maxBalance) {
const addressInput = document.getElementById('token-destination');
const amountInput = document.getElementById('token-amount');
const ringsizeSelect = document.getElementById('token-ringsize');
if (!addressInput || !amountInput || !ringsizeSelect) {
showMessage('error', 'Form elements not found');
return;
}
const address = addressInput.value.trim();
const amount = parseFloat(amountInput.value);
const ringsize = parseInt(ringsizeSelect.value);
if (!address) {
showMessage('error', 'Please enter a destination address');
return;
}
if (!amount || amount <= 0) {
showMessage('error', 'Please enter a valid amount');
return;
}
const atomicAmount = Math.floor(amount * 100000);
if (atomicAmount > maxBalance) {
showMessage('error', 'Insufficient balance');
return;
}
try {

const transferResult = await sendRPC('transfer', {
transfers: [{
destination: address,
scid: scid,
amount: atomicAmount,
ringsize: ringsize
}]
});
if (transferResult && transferResult.txid) {
const txid = transferResult.txid;
const shortTxid = `${txid.substring(0, 8)}...${txid.substring(txid.length - 8)}`;
showMessage('success', `Token sent! TXID: ${shortTxid}`);
closeSendTokenModal();
setTimeout(async () => {

try {
const balanceResult = await sendRPC('GetBalance', { scid: scid });
if (balanceResult && typeof balanceResult.balance !== 'undefined') {
const details = window.assetDetails.get(scid);
if (details) {
details.balance = balanceResult.balance;
window.assetDetails.set(scid, details);

}
}
} catch (e) {

}
if (window.location.hash === '#tokens') {
window.displayTokens();
}
}, 50000);
}
} catch (error) {

let errorMessage = 'Failed to send token';
if (error.message) {
if (error.message.includes('user rejected')) {
errorMessage = 'Transaction rejected by user';
} else if (error.message.includes('insufficient')) {
errorMessage = 'Insufficient balance';
} else {
errorMessage = error.message;
}
}
showMessage('error', errorMessage);
}
};

window.confirmSendDero = async function(maxBalance) {
const addressInput = document.getElementById('dero-destination');
const amountInput = document.getElementById('dero-amount');
const ringsizeSelect = document.getElementById('dero-ringsize');
if (!addressInput || !amountInput || !ringsizeSelect) {
showMessage('error', 'Form elements not found');
return;
}
const address = addressInput.value.trim();
const amountDero = parseFloat(amountInput.value);
const ringsize = parseInt(ringsizeSelect.value);
if (!address) {
showMessage('error', 'Please enter a destination address');
return;
}
if (!amountDero || amountDero <= 0) {
showMessage('error', 'Please enter a valid amount');
return;
}
const amountAtomic = Math.floor(amountDero * 100000);

const minBalanceRequired = 5000;
if (maxBalance < minBalanceRequired) {
showMessage('error', 'Insufficient balance. Minimum 0.05 DERO required for transaction fees.');
return;
}
if (amountAtomic > maxBalance) {
showMessage('error', 'Insufficient balance');
return;
}
let resolvedAddress = address;
if (!address.startsWith('dero1') && !address.startsWith('deto1')) {
showMessage('info', 'Resolving name...');
try {
const nameResult = await sendRPCDaemon('DERO.NameToAddress', { name: address });
if (!nameResult || !nameResult.address) {
showMessage('error', 'Invalid address or name');
return;
}
resolvedAddress = nameResult.address;
} catch (error) {
showMessage('error', 'Failed to resolve name');
return;
}
}

showTransactionSummary(resolvedAddress, amountAtomic, ringsize, async () => {
await executeDeroTransfer(resolvedAddress, amountAtomic, ringsize);
});
};

async function executeDeroTransfer(destination, amount, ringsize) {
try {
showMessage('info', 'Sending transaction...');
const result = await sendRPC('transfer', {
transfers: [{
destination: destination,
amount: amount,
burn: 0
}],
ringsize: ringsize
});
if (result && result.txid) {
const txid = result.txid;
const shortTxid = `${txid.substring(0, 8)}...${txid.substring(txid.length - 8)}`;
showMessage('success', `Transaction sent successfully! TXID: ${shortTxid}`);
closeSendDeroModal();
setTimeout(() => {
if (typeof getWalletBalance === 'function') {
getWalletBalance();
}
if (window.location.hash === '#wallet') {
if (typeof window.refreshTransactions === 'function') {
window.refreshTransactions();
}
}
}, 50000);
} else {
showMessage('error', 'Transaction failed: No TXID returned');
}
} catch (error) {

let errorMessage = 'Failed to send DERO';
if (error.message) {
if (error.message.includes('user rejected')) {
errorMessage = 'Transaction rejected by user';
} else if (error.message.includes('insufficient')) {
errorMessage = 'Insufficient balance';
} else {
errorMessage = error.message;
}
}
showMessage('error', errorMessage);
}
}

function formatTokenBalance(balance) {
if (balance === 0) return '0';
if (balance < 100000) return balance.toString();
return (balance / 100000).toFixed(5);
}
