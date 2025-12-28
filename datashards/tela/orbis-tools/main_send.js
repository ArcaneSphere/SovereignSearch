"use strict";

function escapeHtml(unsafe) {
if (!unsafe) return '';
return unsafe
.toString()
.replace(/&/g, "&amp;")
.replace(/</g, "&lt;")
.replace(/>/g, "&gt;")
.replace(/"/g, "&quot;")
.replace(/'/g, "&#039;");
}
window.sendAsset = async function(scid) {

const details = window.assetDetails.get(scid);
if (!details) {
showMessage('error', 'Asset details not found');
return;
}
const isNFTType = isNFTWithDisplayRetrieve(details);
if (isNFTType) {
showMessage('info', 'Checking NFT status...');
const isDisplayed = await checkNFTDisplayStatus(scid);
if (isDisplayed) {
showRetrieveRequiredModal(scid, details.name);
return;
}
}
openSendModal(details);
};

function isNFTWithDisplayRetrieve(details) {
if (!details || !details.raw || !details.raw.stringkeys) {
return false;
}
const typeHex = details.raw.stringkeys.type;
if (!typeHex) {
return false;
}
const NFT_TYPES = [
'4734352d4e4654',
'4734352d43',
'4734352d464154',
'4734352d4e414d45',
'54333435'
];
return NFT_TYPES.includes(typeHex);
}
function showRetrieveRequiredModal(scid, assetName) {
const modal = document.createElement('div');
modal.className = 'modal';
modal.style.display = 'flex';
modal.innerHTML = `
<div class="modal-content" style="max-width: 500px;">
<div class="modal-header">
<h3>⚠️ Retrieve Required</h3>
<span class="modal-close" onclick="this.closest('.modal').remove()">&times;</span>
</div>
<div class="modal-body">
<div class="send-asset-info">
<div class="send-info-item">
<span class="send-info-label">NFT:</span>
<span class="send-info-value">${assetName}</span>
</div>
</div>
<div style="background: rgba(255, 152, 0, 0.1); border-left: 3px solid #FF9800; padding: 1rem; border-radius: 4px; margin-top: 1rem;">
<p style="margin: 0; font-size: 0.9rem; line-height: 1.5;">
<strong>ℹ️ NFT Transfer Process:</strong><br>
This NFT is currently displayed. You must retrieve it before sending.<br><br>
<strong>Steps:</strong><br>
1. Click "📥 Retrieve" to get it back<br>
2. Then click "📤 Send" to transfer it
</p>
</div>
</div>
<div class="modal-footer">
<button type="button" class="modal-cancel-btn" onclick="this.closest('.modal').remove()">Close</button>
</div>
</div>
`;
document.body.appendChild(modal);
modal.onclick = function(event) {
if (event.target === modal) {
modal.remove();
}
};
}
function openSendModal(assetDetails) {
let existingModal = document.getElementById('send-modal');
if (existingModal) {
existingModal.remove();
}
const modal = document.createElement('div');
modal.id = 'send-modal';
modal.className = 'modal';
modal.style.display = 'flex';
const maxBalance = assetDetails.balance;
const formattedBalance = formatAssetBalance(maxBalance, assetDetails.typeHdr);
modal.innerHTML = `
<div class="modal-content" style="max-width: 500px;">
<div class="modal-header">
<h3>Send ${assetDetails.name}</h3>
<span class="modal-close" onclick="closeSendModal()">&times;</span>
</div>
<div class="modal-body">
<div class="send-asset-info">
<div class="send-info-item">
<span class="send-info-label">Asset:</span>
<span class="send-info-value">${assetDetails.name}</span>
</div>
<div class="send-info-item">
<span class="send-info-label">Type:</span>
<span class="send-info-value">${assetDetails.type.toUpperCase()}</span>
</div>
<div class="send-info-item">
<span class="send-info-label">Available:</span>
<span class="send-info-value">${formattedBalance}</span>
</div>
</div>
<div class="form-group">
<label for="send-address">Recipient Address</label>
<input type="text" id="send-address" class="form-control" placeholder="dero1..." maxlength="66">
<small id="address-validation" class="form-text"></small>
</div>
<div class="form-group">
<label for="send-amount">Amount</label>
<input type="number" id="send-amount" class="form-control" value="1" readonly style="background: var(--bg-secondary);">
<small class="form-text">NFT/NFA assets can only send 1 unit</small>
</div>
<div class="form-group">
<label for="send-ringsize">Ring Size (Privacy Level)</label>
<select id="send-ringsize" class="form-control">
<option value="2">2 (Fastest, Lower Privacy)</option>
<option value="4">4</option>
<option value="8" selected>8 (Recommended)</option>
<option value="16">16</option>
<option value="32">32</option>
<option value="64">64</option>
<option value="128">128 (Slowest, Highest Privacy)</option>
</select>
<small class="form-text">Higher ringsize = more privacy but higher fees and slower</small>
</div>
<div id="send-error" class="error-message" style="display: none;"></div>
</div>
<div class="modal-footer">
<button class="btn btn-secondary" onclick="closeSendModal()">Cancel</button>
<button class="btn btn-success" id="confirm-send-btn" onclick="confirmSend('${assetDetails.scid}', ${maxBalance})">
📤 Send
</button>
</div>
</div>
`;
document.body.appendChild(modal);
const addressInput = document.getElementById('send-address');
if (addressInput) {
addressInput.addEventListener('input', function() {
validateAddress(this.value);
});
}
modal.onclick = function(event) {
if (event.target === modal) {
closeSendModal();
}
};
}
window.closeSendModal = function() {
const modal = document.getElementById('send-modal');
if (modal) {
modal.remove();
}
};
async function sendRPCDaemon(method, params = {}) {
const daemonAddress = window.deroNodeAddress || 'node.derofunds.io';
const endpoint = `https://${daemonAddress}/json_rpc`;
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
}
async function validateAddress(address) {
const validationElement = document.getElementById('address-validation');
if (!validationElement) return false;
if (!address || address.length === 0) {
validationElement.textContent = '';
validationElement.className = 'form-text';
return false;
}
validationElement.textContent = '⏳ Validating address...';
validationElement.className = 'form-text text-info';
let finalAddress = address;
if (!address.startsWith('dero1') && !address.startsWith('deto1')) {

try {
const nameResult = await sendRPCDaemon('DERO.NameToAddress', {
name: address,
topoheight: -1
});
if (nameResult && nameResult.address) {
finalAddress = nameResult.address;
validationElement.textContent = `✅ Name "${address}" → ${finalAddress.substring(0, 12)}...`;
validationElement.className = 'form-text text-success';
validationElement.dataset.resolvedAddress = finalAddress;
return true;
} else {
validationElement.textContent = '❌ Name not found on blockchain';
validationElement.className = 'form-text text-danger';
return false;
}
} catch (error) {

validationElement.textContent = '❌ Invalid address or name not found';
validationElement.className = 'form-text text-danger';
return false;
}
}
if (finalAddress.length !== 66) {
validationElement.textContent = `❌ Address must be 66 characters (current: ${finalAddress.length})`;
validationElement.className = 'form-text text-danger';
return false;
}
try {
const balanceCheck = await sendRPCDaemon('DERO.GetEncryptedBalance', {
address: finalAddress,
topoheight: -1
});
if (balanceCheck && !balanceCheck.error) {
validationElement.textContent = '✅ Valid registered address';
validationElement.className = 'form-text text-success';
validationElement.dataset.resolvedAddress = finalAddress;
return true;
} else if (balanceCheck && balanceCheck.error && balanceCheck.error.message === 'Account Unregistered') {
validationElement.textContent = '⚠️ Valid address but not registered on blockchain';
validationElement.className = 'form-text text-warning';
validationElement.dataset.resolvedAddress = finalAddress;
return true;
} else {
validationElement.textContent = '❌ Invalid address';
validationElement.className = 'form-text text-danger';
return false;
}
} catch (error) {

validationElement.textContent = '✅ Address format valid (validation unavailable)';
validationElement.className = 'form-text text-success';
validationElement.dataset.resolvedAddress = finalAddress;
return true;
}
}
window.confirmSend = async function(scid, maxBalance) {
const addressInput = document.getElementById('send-address');
const ringsizeSelect = document.getElementById('send-ringsize');
const errorDiv = document.getElementById('send-error');
const confirmBtn = document.getElementById('confirm-send-btn');
const validationElement = document.getElementById('address-validation');
if (!addressInput || !ringsizeSelect || !errorDiv || !confirmBtn) return;
let address = addressInput.value.trim();
const ringsize = parseInt(ringsizeSelect.value);
errorDiv.style.display = 'none';
if (!address) {
errorDiv.textContent = 'Please enter a recipient address or name';
errorDiv.style.display = 'block';
return;
}
const isValid = await validateAddress(address);
if (!isValid) {
errorDiv.textContent = 'Please enter a valid address or registered name';
errorDiv.style.display = 'block';
return;
}
if (validationElement && validationElement.dataset.resolvedAddress) {
address = validationElement.dataset.resolvedAddress;

}
confirmBtn.disabled = true;
confirmBtn.innerHTML = '<span class="loading-spinner"></span> Sending...';
try {

const transferResult = await sendRPC('transfer', {
transfers: [{
destination: address,
scid: scid,
amount: 1,
ringsize: ringsize
}]
});
if (transferResult && transferResult.txid) {
showMessage('success', `Asset sent! TXID: ${transferResult.txid.substring(0, 16)}...`);
closeSendModal();
setTimeout(async () => {

if (typeof window.refreshSingleAsset === 'function') {
await window.refreshSingleAsset(scid);
}
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
if (window.location.hash === '#assets') {
window.displayAssets();
} else if (window.location.hash === '#tokens') {
window.displayTokens();
}
}, 50000);
}
} catch (error) {

let errorMessage = 'Failed to process NFT transfer';
let errorDetails = '';
if (error.message) {
const msg = error.message.toLowerCase();
if (msg.includes('user rejected') || msg.includes('user denied') || msg.includes('cancelled')) {
errorMessage = '❌ Transaction cancelled';
errorDetails = 'You rejected the transaction in XSWD wallet.';
}
else if (msg.includes('insufficient balance') || msg.includes('not enough')) {
errorMessage = '❌ Insufficient balance';
errorDetails = 'You don\'t have enough DERO to pay transaction fees.';
}
else if (msg.includes('connection') || msg.includes('network') || msg.includes('timeout')) {
errorMessage = '❌ Connection error';
errorDetails = 'Unable to connect to XSWD wallet or DERO network.';
}
else if (msg.includes('wallet locked') || msg.includes('unlock')) {
errorMessage = '❌ Wallet locked';
errorDetails = 'Please unlock your XSWD wallet and try again.';
}
else {
errorMessage = '❌ Transaction failed';
errorDetails = error.message;
}
}
errorDiv.innerHTML = `<strong>${escapeHtml(errorMessage)}</strong><br><small>${escapeHtml(errorDetails)}</small>`;
errorDiv.style.display = 'block';
showMessage('error', errorMessage);
confirmBtn.disabled = false;
confirmBtn.innerHTML = '📤 Send';
}
};
async function checkNFTDisplayStatus(scid) {
try {

const endpoint = `https://${window.deroNodeAddress}/json_rpc`;
const response = await fetch(endpoint, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
jsonrpc: '2.0',
id: '1',
method: 'getsc',
params: {
scid: scid,
code: false,
variables: true
}
})
});
const data = await response.json();

if (data.error) {

return false;
}
if (data.result && data.result.stringkeys) {

const ownerHex = data.result.stringkeys.owner;

if (ownerHex && ownerHex !== "" && ownerHex !== null && ownerHex !== undefined) {
let ownerAddress = '';
try {
const hexBytes = ownerHex.match(/.{1,2}/g);
if (hexBytes) {
ownerAddress = hexBytes.map(byte => String.fromCharCode(parseInt(byte, 16))).join('');

}
} catch (hexError) {

}
if (ownerAddress && window.walletAddress) {
if (ownerAddress === window.walletAddress) {

return true;
} else {

return false;
}
} else {

return true;
}
} else {

return false;
}
}
if (data.result && data.result.balances) {

}

return false;
} catch (error) {

return false;
}
}
function showDisplayNFTModalBeforeSend(scid, assetName) {
const displayModal = document.createElement('div');
displayModal.className = 'modal';
displayModal.style.display = 'flex';
displayModal.innerHTML = `
<div class="modal-content" style="max-width: 500px;">
<div class="modal-header">
<h3>⚠️ Display Required</h3>
<span class="modal-close" onclick="this.closest('.modal').remove()">&times;</span>
</div>
<div class="modal-body">
<p><strong>${assetName}</strong></p>
<p>This NFT must be displayed before it can be sent.</p>
<div style="background: rgba(255, 193, 7, 0.1); border-left: 4px solid #ffc107; padding: 1rem; margin: 1rem 0; border-radius: 4px;">
<strong>📋 G45-NFT Transfer Process:</strong>
<ol style="margin: 0.5rem 0 0 1rem; line-height: 1.8;">
<li>You call <strong>DisplayNFT()</strong> to make it available</li>
<li>The recipient calls <strong>RetrieveNFT()</strong> to claim it</li>
</ol>
</div>
<p>Do you want to display this NFT now?</p>
</div>
<div class="modal-footer">
<button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Deny</button>
<button class="btn btn-primary" id="accept-display-btn">Accept</button>
</div>
</div>
`;
document.body.appendChild(displayModal);
displayModal.onclick = function(event) {
if (event.target === displayModal) {
displayModal.remove();
}
};
const acceptBtn = displayModal.querySelector('#accept-display-btn');
acceptBtn.onclick = async function() {
acceptBtn.disabled = true;
acceptBtn.innerHTML = '<span class="loading-spinner"></span> Displaying NFT...';
try {
const displayResult = await sendRPC('scinvoke', {
scid: scid,
ringsize: 2,
sc_rpc: [
{name: 'entrypoint', datatype: 'S', value: 'DisplayNFT'}
]
});
if (displayResult && displayResult.txid) {
showMessage('success', `NFT displayed successfully! TXID: ${displayResult.txid.substring(0, 16)}...`);
acceptBtn.innerHTML = '<span class="loading-spinner"></span> Waiting for confirmation...';
await new Promise(resolve => setTimeout(resolve, 50000));
const recheckDisplayed = await checkNFTDisplayStatus(scid);
if (recheckDisplayed) {
displayModal.remove();
showMessage('success', 'NFT displayed! You can now send it.');
const details = window.assetDetails.get(scid);
if (details) {
openSendModal(details);
}
} else {
const errorContainer = displayModal.querySelector('.modal-body');
const existingError = errorContainer.querySelector('.error-message');
if (existingError) {
existingError.remove();
}
const errorDiv = document.createElement('div');
errorDiv.className = 'error-message';
errorDiv.style.marginTop = '1rem';
errorDiv.innerHTML = `<strong>⏳ DisplayNFT transaction sent</strong><br><small>Please wait for blockchain confirmation (~1 minute) then try sending again.</small>`;
errorContainer.appendChild(errorDiv);
acceptBtn.disabled = false;
acceptBtn.innerHTML = 'Accept';
}
} else {
throw new Error('DisplayNFT transaction failed');
}
} catch (error) {

let errorMessage = 'Failed to display NFT';
let errorDetails = '';
if (error.message) {
const msg = error.message.toLowerCase();
if (msg.includes('user rejected') || msg.includes('user denied') || msg.includes('cancelled')) {
errorMessage = '❌ Transaction cancelled';
errorDetails = 'You rejected the transaction in XSWD wallet.';
}
else if (msg.includes('insufficient balance') || msg.includes('not enough')) {
errorMessage = '❌ Insufficient balance';
errorDetails = 'You don\'t have enough DERO to pay transaction fees.';
}
else if (msg.includes('connection') || msg.includes('network') || msg.includes('timeout')) {
errorMessage = '❌ Connection error';
errorDetails = 'Unable to connect to XSWD wallet or DERO network.';
}
else if (msg.includes('wallet locked') || msg.includes('unlock')) {
errorMessage = '❌ Wallet locked';
errorDetails = 'Please unlock your XSWD wallet and try again.';
}
else {
errorMessage = '❌ Transaction failed';
errorDetails = error.message;
}
}
const errorContainer = displayModal.querySelector('.modal-body');
const existingError = errorContainer.querySelector('.error-message');
if (existingError) {
existingError.remove();
}
const errorDiv = document.createElement('div');
errorDiv.className = 'error-message';
errorDiv.style.marginTop = '1rem';
errorDiv.innerHTML = `<strong>${escapeHtml(errorMessage)}</strong><br><small>${escapeHtml(errorDetails)}</small>`;
errorContainer.appendChild(errorDiv);
showMessage('error', errorMessage);
acceptBtn.disabled = false;
acceptBtn.innerHTML = 'Accept';
}
};
}
function showDisplayNFTModal(recipientAddress, scid, ringsize, assetName) {
const displayModal = document.createElement('div');
displayModal.className = 'modal';
displayModal.style.display = 'flex';
displayModal.innerHTML = `
<div class="modal-content" style="max-width: 600px;">
<div class="modal-header">
<h3>⚠️ NFT Must Be Displayed First</h3>
<span class="modal-close" onclick="this.closest('.modal').remove()">&times;</span>
</div>
<div class="modal-body">
<p>This NFT must be "displayed" before it can be sent.</p>
<div style="background: rgba(255, 193, 7, 0.1); border-left: 4px solid #ffc107; padding: 1rem; margin: 1rem 0; border-radius: 4px;">
<strong>📋 How G45-NFT Transfer Works:</strong>
<ol style="margin: 0.5rem 0 0 1rem; line-height: 1.8;">
<li><strong>You call DisplayNFT()</strong> to make the NFT available</li>
<li><strong>The recipient</strong> (${recipientAddress.substring(0, 12)}...${recipientAddress.substring(recipientAddress.length - 8)}) must then call <code style="background: var(--bg-tertiary); padding: 0.2rem 0.5rem; border-radius: 4px;">RetrieveNFT()</code></li>
</ol>
</div>
<p><strong>${assetName}</strong> is currently not displayed.</p>
<p>Do you want to display this NFT now?</p>
</div>
<div class="modal-footer">
<button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
<button class="btn btn-primary" id="confirm-display-btn">📤 Display NFT</button>
</div>
</div>
`;
document.body.appendChild(displayModal);
displayModal.onclick = function(event) {
if (event.target === displayModal) {
displayModal.remove();
}
};
const confirmDisplayBtn = displayModal.querySelector('#confirm-display-btn');
confirmDisplayBtn.onclick = async function() {
confirmDisplayBtn.disabled = true;
confirmDisplayBtn.innerHTML = '<span class="loading-spinner"></span> Displaying NFT...';
try {
const displayResult = await sendRPC('transfer', {
scid: scid,
ringsize: 2,
sc_rpc: [
{name: 'entrypoint', datatype: 'S', value: 'DisplayNFT'}
],
transfers: []
});
if (displayResult && displayResult.txid) {
showMessage('success', `NFT displayed successfully! TXID: ${displayResult.txid.substring(0, 16)}...`);
confirmDisplayBtn.innerHTML = '<span class="loading-spinner"></span> Waiting for confirmation...';
await new Promise(resolve => setTimeout(resolve, 50000));
const recheckDisplayed = await checkNFTDisplayStatus(scid);
if (recheckDisplayed) {
displayModal.remove();
showNextStepInstructions(recipientAddress, scid, assetName);
closeSendModal();
} else {
displayModal.remove();
const sendModal = document.getElementById('send-modal');
if (sendModal) {
const errorDiv = sendModal.querySelector('#send-error');
const confirmBtn = sendModal.querySelector('#confirm-send-btn');
if (errorDiv) {
errorDiv.innerHTML = `<strong>⏳ DisplayNFT transaction sent</strong><br><small>Please wait for blockchain confirmation (~1 minute) then try sending again.</small>`;
errorDiv.style.display = 'block';
}
if (confirmBtn) {
confirmBtn.disabled = false;
confirmBtn.innerHTML = '📤 Send';
}
}
}
} else {
throw new Error('DisplayNFT transaction failed');
}
} catch (error) {

let errorMessage = 'Failed to display NFT';
let errorDetails = '';
if (error.message) {
const msg = error.message.toLowerCase();
if (msg.includes('user rejected') || msg.includes('user denied') || msg.includes('cancelled')) {
errorMessage = '❌ Transaction cancelled';
errorDetails = 'You rejected the transaction in XSWD wallet.';
}
else if (msg.includes('insufficient balance') || msg.includes('not enough')) {
errorMessage = '❌ Insufficient balance';
errorDetails = 'You don\'t have enough DERO to pay transaction fees.';
}
else if (msg.includes('connection') || msg.includes('network') || msg.includes('timeout')) {
errorMessage = '❌ Connection error';
errorDetails = 'Unable to connect to XSWD wallet or DERO network.';
}
else if (msg.includes('wallet locked') || msg.includes('unlock')) {
errorMessage = '❌ Wallet locked';
errorDetails = 'Please unlock your XSWD wallet and try again.';
}
else {
errorMessage = '❌ Transaction failed';
errorDetails = error.message;
}
}
const errorContainer = displayModal.querySelector('.modal-body');
const existingError = errorContainer.querySelector('.error-message');
if (existingError) {
existingError.remove();
}
const errorDiv = document.createElement('div');
errorDiv.className = 'error-message';
errorDiv.style.marginTop = '1rem';
errorDiv.innerHTML = `<strong>${escapeHtml(errorMessage)}</strong><br><small>${escapeHtml(errorDetails)}</small>`;
errorContainer.appendChild(errorDiv);
showMessage('error', errorMessage);
confirmDisplayBtn.disabled = false;
confirmDisplayBtn.innerHTML = '📤 Display NFT';
}
};
}
function showNextStepInstructions(recipientAddress, scid, assetName) {
const instructionsModal = document.createElement('div');
instructionsModal.className = 'modal';
instructionsModal.style.display = 'flex';
instructionsModal.innerHTML = `
<div class="modal-content" style="max-width: 600px;">
<div class="modal-header">
<h3>✅ NFT Ready for Transfer</h3>
<span class="modal-close" onclick="this.closest('.modal').remove()">&times;</span>
</div>
<div class="modal-body">
<p><strong>${assetName}</strong> is now displayed and ready to be claimed.</p>
<h4 style="margin-top: 1.5rem; color: var(--primary-color);">📋 Next Steps:</h4>
<ol style="line-height: 1.8; margin-left: 1rem;">
<li><strong>Send this information to the recipient:</strong></li>
</ol>
<div style="background: var(--bg-secondary); padding: 1rem; border-radius: 8px; margin: 1rem 0; font-family: monospace; font-size: 0.9rem;">
<div style="margin-bottom: 0.5rem;"><strong>NFT SCID:</strong></div>
<div style="word-break: break-all; color: var(--primary-color);">${scid}</div>
<button class="btn btn-secondary" style="margin-top: 0.5rem; font-size: 0.85rem;" onclick="navigator.clipboard.writeText('${scid}'); showMessage('success', 'SCID copied!');">
📋 Copy SCID
</button>
</div>
<ol start="2" style="line-height: 1.8; margin-left: 1rem;">
<li>The recipient must call <code style="background: var(--bg-tertiary); padding: 0.2rem 0.5rem; border-radius: 4px;">RetrieveNFT()</code> on this SCID to claim the NFT</li>
<li>They can use their wallet or a dApp like Derosphere to retrieve it</li>
</ol>
<div style="background: rgba(255, 193, 7, 0.1); border-left: 4px solid #ffc107; padding: 1rem; margin-top: 1.5rem; border-radius: 4px;">
<strong>⚠️ Important:</strong> The NFT will remain "displayed" until the recipient retrieves it. If they don't retrieve it, you can call <code style="background: var(--bg-tertiary); padding: 0.2rem 0.5rem; border-radius: 4px;">RetrieveNFT()</code> yourself to get it back.
</div>
</div>
<div class="modal-footer">
<button class="btn btn-primary" onclick="this.closest('.modal').remove();">Got it!</button>
</div>
</div>
`;
document.body.appendChild(instructionsModal);
instructionsModal.onclick = function(event) {
if (event.target === instructionsModal) {
instructionsModal.remove();
}
};
}
function formatAssetBalance(balance, typeHdr) {
if (balance === 0) return '0';
if (typeHdr === 'Image' || typeHdr === 'image') {
return balance.toString();
}
if (balance < 100000) return balance.toString();
return (balance / 100000).toFixed(5);
}
document.addEventListener('keydown', function(event) {
if (event.key === 'Escape') {
closeSendModal();
}
});
window.displayNFT = async function(scid) {
const details = window.assetDetails.get(scid);
if (!details) {
showMessage('error', 'Asset details not found');
return;
}
const modal = document.createElement('div');
modal.className = 'modal';
modal.style.display = 'flex';
modal.innerHTML = `
<div class="modal-content" style="max-width: 500px;">
<div class="modal-header">
<h3>👁️ Display NFT</h3>
<span class="modal-close" onclick="this.closest('.modal').remove()">&times;</span>
</div>
<div class="modal-body">
<div class="send-asset-info">
<div class="send-info-item">
<span class="send-info-label">NFT:</span>
<span class="send-info-value">${details.name}</span>
</div>
<div class="send-info-item">
<span class="send-info-label">SCID:</span>
<span class="send-info-value" style="font-size: 0.75rem; word-break: break-all;">${scid}</span>
</div>
</div>
<div style="background: rgba(33, 150, 243, 0.1); border-left: 3px solid #2196F3; padding: 1rem; border-radius: 4px; margin-top: 1rem;">
<p style="margin: 0; font-size: 0.9rem; line-height: 1.5;">
<strong>ℹ️ What is Display?</strong><br>
Display makes your NFT available for others to retrieve from the blockchain.
You can retrieve it back anytime if no one claims it.
</p>
</div>
</div>
<div class="modal-footer" style="gap: 0.75rem;">
<button type="button" class="modal-cancel-btn" onclick="this.closest('.modal').remove()">Cancel</button>
<button type="button" class="modal-display-btn" id="confirm-display-btn">
👁️ Display NFT
</button>
</div>
</div>
`;
document.body.appendChild(modal);
document.getElementById('confirm-display-btn').onclick = async function() {
this.disabled = true;
this.innerHTML = '<span class="loading-spinner"></span> Displaying...';
modal.remove();
showMessage('info', 'Displaying NFT...');
try {

const displayResult = await sendRPC('transfer', {
scid: scid,
ringsize: 2,
sc_rpc: [
{name: 'entrypoint', datatype: 'S', value: 'DisplayNFT'}
],
transfers: [
{scid: scid, burn: 1}
]
});
if (displayResult && displayResult.txid) {
showMessage('success', `NFT displayed! TXID: ${displayResult.txid.substring(0, 16)}...`);
showMessage('info', 'Waiting for blockchain confirmation...');
await new Promise(resolve => setTimeout(resolve, 50000));
try {
const endpoint = `https://${window.deroNodeAddress}/json_rpc`;
const response = await fetch(endpoint, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
jsonrpc: '2.0',
id: '1',
method: 'getsc',
params: {
scid: scid,
code: false,
variables: true
}
})
});
const data = await response.json();
if (data.result && data.result.stringkeys) {
const ownerHex = data.result.stringkeys.owner;

if (ownerHex && ownerHex !== "" && ownerHex !== null) {
let ownerAddress = '';
try {
const hexBytes = ownerHex.match(/.{1,2}/g);
if (hexBytes) {
ownerAddress = hexBytes.map(byte => String.fromCharCode(parseInt(byte, 16))).join('');

}
} catch (hexError) {

}
if (ownerAddress && window.walletAddress && ownerAddress === window.walletAddress) {
showMessage('success', '✅ NFT successfully displayed!');
if (details.raw && details.raw.stringkeys) {
details.raw.stringkeys.owner = ownerHex;
details.isDisplayed = true;
window.assetDetails.set(scid, details);
}
await window.refreshSingleAsset(scid);
} else {
showMessage('warning', 'NFT displayed but owner verification failed. Refreshing...');
await window.refreshSingleAsset(scid);
}
} else {
showMessage('warning', 'NFT display pending. Please wait and try again.');
}
} else {
showMessage('warning', 'Could not verify NFT status. Refreshing...');
await window.refreshSingleAsset(scid);
}
} catch (verifyError) {

showMessage('warning', 'Transaction sent but verification failed. Refreshing...');
await window.refreshSingleAsset(scid);
}
} else {
throw new Error('DisplayNFT transaction failed');
}
} catch (error) {

let errorMessage = 'Failed to display NFT';
if (error.message) {
const msg = error.message.toLowerCase();
if (msg.includes('user rejected') || msg.includes('cancelled')) {
errorMessage = 'Transaction cancelled';
} else if (msg.includes('insufficient balance')) {
errorMessage = 'Insufficient balance for fees';
}
}
showMessage('error', errorMessage);
}
};
};
window.retrieveNFT = async function(scid) {
const details = window.assetDetails.get(scid);
if (!details) {
showMessage('error', 'Asset details not found');
return;
}
const modal = document.createElement('div');
modal.className = 'modal';
modal.style.display = 'flex';
modal.innerHTML = `
<div class="modal-content" style="max-width: 500px;">
<div class="modal-header">
<h3>📥 Retrieve NFT</h3>
<span class="modal-close" onclick="this.closest('.modal').remove()">&times;</span>
</div>
<div class="modal-body">
<div class="send-asset-info">
<div class="send-info-item">
<span class="send-info-label">NFT:</span>
<span class="send-info-value">${details.name}</span>
</div>
<div class="send-info-item">
<span class="send-info-label">SCID:</span>
<span class="send-info-value" style="font-size: 0.75rem; word-break: break-all;">${scid}</span>
</div>
</div>
<div style="background: rgba(76, 175, 80, 0.1); border-left: 3px solid #4caf50; padding: 1rem; border-radius: 4px; margin-top: 1rem;">
<p style="margin: 0; font-size: 0.9rem; line-height: 1.5;">
<strong>ℹ️ What is Retrieve?</strong><br>
Retrieve takes back your displayed NFT into your wallet.
The NFT will no longer be available for others to claim.
</p>
</div>
</div>
<div class="modal-footer" style="gap: 0.75rem;">
<button type="button" class="modal-cancel-btn" onclick="this.closest('.modal').remove()">Cancel</button>
<button type="button" class="modal-retrieve-btn" id="confirm-retrieve-btn">
📥 Retrieve NFT
</button>
</div>
</div>
`;
document.body.appendChild(modal);
document.getElementById('confirm-retrieve-btn').onclick = async function() {
this.disabled = true;
this.innerHTML = '<span class="loading-spinner"></span> Retrieving...';
modal.remove();
showMessage('info', 'Retrieving NFT...');
try {
const retrieveResult = await sendRPC('transfer', {
scid: scid,
ringsize: 2,
sc_rpc: [
{name: 'entrypoint', datatype: 'S', value: 'RetrieveNFT'}
],
transfers: []
});
if (retrieveResult && retrieveResult.txid) {
showMessage('success', `NFT retrieved! TXID: ${retrieveResult.txid.substring(0, 16)}...`);
showMessage('info', 'Waiting for blockchain confirmation...');
await new Promise(resolve => setTimeout(resolve, 50000));
try {
const endpoint = `https://${window.deroNodeAddress}/json_rpc`;
const response = await fetch(endpoint, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
jsonrpc: '2.0',
id: '1',
method: 'getsc',
params: {
scid: scid,
code: false,
variables: true
}
})
});
const data = await response.json();
if (data.result && data.result.stringkeys) {
const ownerHex = data.result.stringkeys.owner;
if (!ownerHex || ownerHex === "" || ownerHex === null) {
showMessage('success', '✅ NFT successfully retrieved!');
if (details.raw && details.raw.stringkeys) {
details.raw.stringkeys.owner = "";
details.isDisplayed = false;
window.assetDetails.set(scid, details);
}
await window.refreshSingleAsset(scid);
} else {
showMessage('warning', 'NFT retrieve pending. Please wait and try again.');
}
} else {
showMessage('warning', 'Could not verify NFT status. Refreshing...');
await window.refreshSingleAsset(scid);
}
} catch (verifyError) {

showMessage('warning', 'Transaction sent but verification failed. Refreshing...');
await window.refreshSingleAsset(scid);
}
} else {
throw new Error('RetrieveNFT transaction failed');
}
} catch (error) {

let errorMessage = 'Failed to retrieve NFT';
if (error.message) {
const msg = error.message.toLowerCase();
if (msg.includes('user rejected') || msg.includes('cancelled')) {
errorMessage = 'Transaction cancelled';
} else if (msg.includes('insufficient balance')) {
errorMessage = 'Insufficient balance for fees';
}
}
showMessage('error', errorMessage);
}
};
};
