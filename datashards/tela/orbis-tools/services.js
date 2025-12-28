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

window.generateIntegratedAddress = async function() {
if (!window.isWalletConnected || !window.walletAddress) {
showMessage('error', 'Please connect your wallet first');
return;
}
const btn = document.getElementById('generate-integrated-btn');
const paymentIdInput = document.getElementById('payment-id-input');
const amountInput = document.getElementById('amount-input');
const messageInput = document.getElementById('message-input');
const resultDiv = document.getElementById('integrated-result');
const integratedDisplay = document.getElementById('integrated-address-display');
const paramsContent = document.getElementById('integrated-params-content');
if (!btn || !resultDiv || !integratedDisplay || !paramsContent) {
showMessage('error', 'Required elements not found');
return;
}
const paymentIdValue = paymentIdInput.value.trim();
const amountValue = amountInput.value.trim();
const messageValue = messageInput.value.trim();
let paymentId = '';
let isPort = false;
if (paymentIdValue.length > 0) {
const isNumeric = /^\d+$/.test(paymentIdValue);
if (isNumeric) {
const port = parseInt(paymentIdValue);
if (port < 0 || port > 65535) {
showMessage('error', 'Port must be between 0-65535');
return;
}
isPort = true;
paymentId = paymentIdValue;
} else {
if (paymentIdValue.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(paymentIdValue)) {
showMessage('error', 'Payment ID must be 64 hex characters or a port number');
return;
}
paymentId = paymentIdValue;
}
}
btn.disabled = true;
btn.innerHTML = '<span class="loading-spinner"></span> Generating...';
resultDiv.style.display = 'none';
try {
const params = {
address: window.walletAddress
};
const payload_rpc = [];
payload_rpc.push({
name: 'N',
datatype: 'U',
value: 1
});
let atomicAmount = 0;
if (amountValue.length > 0) {
const amount = parseFloat(amountValue);
if (isNaN(amount) || amount <= 0) {
showMessage('error', 'Invalid amount');
btn.disabled = false;
btn.innerHTML = '🔐 Generate Integrated Address';
return;
}
atomicAmount = Math.floor(amount * 100000);
}
payload_rpc.push({
name: 'V',
datatype: 'U',
value: atomicAmount
});
if (paymentId.length > 0) {
if (isPort) {
payload_rpc.push({
name: 'D',
datatype: 'U',
value: parseInt(paymentId)
});
} else {
payload_rpc.push({
name: 'paymentid',
datatype: 'S',
value: paymentId
});
}
}
if (messageValue.length > 0) {
payload_rpc.push({
name: 'C',
datatype: 'S',
value: messageValue
});
}
if (payload_rpc.length > 0) {
params.payload_rpc = payload_rpc;
}
const result = await sendRPC('MakeIntegratedAddress', params);
if (!result || !result.integrated_address) {
throw new Error('Failed to generate integrated address');
}
window.currentIntegratedAddress = result.integrated_address;
integratedDisplay.textContent = result.integrated_address;
let paramsHTML = '<div class="param-item"><span class="param-label">Address Type:</span><span class="param-value">Integrated (deroi1)</span></div>';
if (paymentId.length > 0) {
if (isPort) {
paramsHTML += `<div class="param-item"><span class="param-label">Destination Port:</span><span class="param-value">${paymentId}</span></div>`;
} else {
paramsHTML += `<div class="param-item"><span class="param-label">Payment ID:</span><span class="param-value">${paymentId}</span></div>`;
}
}
if (atomicAmount > 0) {
const displayAmount = (atomicAmount / 100000).toFixed(5);
paramsHTML += `<div class="param-item"><span class="param-label">Amount:</span><span class="param-value">${displayAmount} DERO</span></div>`;
} else {
paramsHTML += `<div class="param-item"><span class="param-label">Amount:</span><span class="param-value">Not specified (0 DERO)</span></div>`;
}
if (messageValue.length > 0) {
const displayMessage = messageValue.length > 50 ? messageValue.substring(0, 50) + '...' : messageValue;
paramsHTML += `<div class="param-item"><span class="param-label">Comment:</span><span class="param-value">${displayMessage}</span></div>`;
}
paramsContent.innerHTML = paramsHTML;
resultDiv.style.display = 'block';
showMessage('success', 'Integrated address generated!');
} catch (error) {
showMessage('error', 'Failed to generate: ' + (error.message || 'Unknown error'));
} finally {
btn.disabled = false;
btn.innerHTML = '🔐 Generate Integrated Address';
}
};
window.copyIntegratedAddress = function() {
if (!window.currentIntegratedAddress) {
showMessage('error', 'No integrated address to copy');
return;
}
navigator.clipboard.writeText(window.currentIntegratedAddress).then(() => {
showMessage('success', 'Integrated address copied!');
}).catch(err => {
showMessage('error', 'Failed to copy');
});
};
window.resetIntegratedAddressForm = function() {
const paymentIdInput = document.getElementById('payment-id-input');
const amountInput = document.getElementById('amount-input');
const messageInput = document.getElementById('message-input');
const resultDiv = document.getElementById('integrated-result');
const validationDiv = document.getElementById('payment-id-validation');
if (paymentIdInput) paymentIdInput.value = '';
if (amountInput) amountInput.value = '';
if (messageInput) messageInput.value = '';
if (resultDiv) resultDiv.style.display = 'none';
if (validationDiv) {
validationDiv.textContent = '';
validationDiv.className = 'form-text';
}
window.currentIntegratedAddress = null;
showMessage('success', 'Form reset');
};

let nameCheckTimeout = null;
window.checkAccountNameAvailability = async function(name) {
const validationDiv = document.getElementById('account-name-validation');
const registerBtn = document.getElementById('register-name-btn');
if (!validationDiv) return;
name = name.trim();
if (name.length === 0) {
validationDiv.textContent = '';
validationDiv.className = 'form-text';
if (registerBtn) registerBtn.disabled = true;
return;
}
if (name.length < 6) {
validationDiv.textContent = '⚠️ Name must be at least 6 characters';
validationDiv.className = 'form-text warning';
if (registerBtn) registerBtn.disabled = true;
return;
}
if (/\s/.test(name)) {
validationDiv.textContent = '⚠️ Name cannot contain spaces';
validationDiv.className = 'form-text warning';
if (registerBtn) registerBtn.disabled = true;
return;
}
validationDiv.textContent = '🔍 Checking availability...';
validationDiv.className = 'form-text';
if (nameCheckTimeout) {
clearTimeout(nameCheckTimeout);
}
nameCheckTimeout = setTimeout(async () => {
try {
const result = await sendRPCDaemon('DERO.NameToAddress', {
name: name,
topoheight: -1
});

if (result && result.address && result.address.length > 0) {
validationDiv.textContent = `❌ Name already taken by: ${result.address.substring(0, 20)}...`;
validationDiv.className = 'form-text error';
if (registerBtn) registerBtn.disabled = true;
} else if (result && result.error) {
validationDiv.textContent = '✅ Name is available!';
validationDiv.className = 'form-text success';
if (registerBtn) registerBtn.disabled = false;
} else {
validationDiv.textContent = '✅ Name is available!';
validationDiv.className = 'form-text success';
if (registerBtn) registerBtn.disabled = false;
}
} catch (error) {
console.log('NameToAddress error (name likely available):', error);
validationDiv.textContent = '✅ Name is available!';
validationDiv.className = 'form-text success';
if (registerBtn) registerBtn.disabled = false;
}
}, 500);
};
window.registerAccountName = async function() {
if (!window.isWalletConnected || !window.walletAddress) {
showMessage('error', 'Please connect your wallet first');
return;
}
const btn = document.getElementById('register-name-btn');
const nameInput = document.getElementById('account-name-input');
const resultDiv = document.getElementById('register-name-result');
if (!btn || !nameInput || !resultDiv) {
showMessage('error', 'Required elements not found');
return;
}
const accountName = nameInput.value.trim();
if (accountName.length < 6) {
showMessage('error', 'Name must be at least 6 characters');
return;
}
if (/\s/.test(accountName)) {
showMessage('error', 'Name cannot contain spaces');
return;
}
btn.disabled = true;
btn.innerHTML = '<span class="loading-spinner"></span> Registering...';
resultDiv.style.display = 'none';
try {
showMessage('info', 'Please approve the registration transaction in your wallet...');
const result = await sendRPC('scinvoke', {
scid: '0000000000000000000000000000000000000000000000000000000000000001',
ringsize: 2,
sc_rpc: [
{ name: 'entrypoint', datatype: 'S', value: 'Register' },
{ name: 'name', datatype: 'S', value: accountName }
]
});

if (result && result.txid) {
resultDiv.innerHTML = `
<div class="success-message">
<div class="success-icon">✅</div>
<div class="success-text">
<strong>Name registration submitted!</strong>
<p>Your account name <code>${accountName}</code> will be linked to your wallet once the transaction is confirmed.</p>
<p><small>TXID: ${result.txid.substring(0, 16)}...</small></p>
</div>
</div>
`;
resultDiv.style.display = 'block';
showMessage('success', `Name "${accountName}" registration submitted!`);
nameInput.value = '';
document.getElementById('account-name-validation').textContent = '';
if (document.getElementById('register-name-btn')) {
document.getElementById('register-name-btn').disabled = true;
}
} else {
throw new Error('Registration failed - no transaction ID received');
}
} catch (error) {
console.error('Registration error:', error);
showMessage('error', 'Failed to register name: ' + (error.message || 'Unknown error'));
} finally {
btn.disabled = false;
btn.innerHTML = '📝 Register Name';
}
};
window.resetAccountNameForm = function() {
const nameInput = document.getElementById('account-name-input');
const resultDiv = document.getElementById('register-name-result');
const validationDiv = document.getElementById('account-name-validation');
const registerBtn = document.getElementById('register-name-btn');
if (nameInput) nameInput.value = '';
if (resultDiv) resultDiv.style.display = 'none';
if (validationDiv) {
validationDiv.textContent = '';
validationDiv.className = 'form-text';
}
if (registerBtn) registerBtn.disabled = true;
if (nameCheckTimeout) {
clearTimeout(nameCheckTimeout);
nameCheckTimeout = null;
}
showMessage('success', 'Form reset');
};

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
function bech32Polymod(values) {
const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
let chk = 1;
for (const v of values) {
const b = chk >> 25;
chk = (chk & 0x1ffffff) << 5 ^ v;
for (let i = 0; i < 5; i++) {
chk ^= ((b >> i) & 1) ? GEN[i] : 0;
}
}
return chk;
}
function bech32HrpExpand(hrp) {
const ret = [];
for (let i = 0; i < hrp.length; i++) {
ret.push(hrp.charCodeAt(i) >> 5);
}
ret.push(0);
for (let i = 0; i < hrp.length; i++) {
ret.push(hrp.charCodeAt(i) & 31);
}
return ret;
}
function bech32VerifyChecksum(hrp, data) {
return bech32Polymod(bech32HrpExpand(hrp).concat(data)) === 1;
}
function bech32Decode(bechString) {
try {
const pos = bechString.lastIndexOf('1');
if (pos < 1 || pos + 7 > bechString.length || bechString.length > 90) {
console.error('[Bech32] Invalid format');
return null;
}
const hrp = bechString.substring(0, pos);
const data = bechString.substring(pos + 1);
const decoded = [];
for (let i = 0; i < data.length; i++) {
const d = BECH32_CHARSET.indexOf(data[i]);
if (d === -1) {
console.error('[Bech32] Invalid character:', data[i]);
return null;
}
decoded.push(d);
}
if (!bech32VerifyChecksum(hrp, decoded)) {
console.error('[Bech32] Checksum failed');
return null;
}
return decoded.slice(0, -6);
} catch (error) {
console.error('[Bech32] Decode error:', error);
return null;
}
}
function convertBits(data, fromBits, toBits, pad) {
let acc = 0;
let bits = 0;
const ret = [];
const maxv = (1 << toBits) - 1;
const maxAcc = (1 << (fromBits + toBits - 1)) - 1;
for (const value of data) {
if (value < 0 || (value >> fromBits)) {
return null;
}
acc = ((acc << fromBits) | value) & maxAcc;
bits += fromBits;
while (bits >= toBits) {
bits -= toBits;
ret.push((acc >> bits) & maxv);
}
}
if (pad) {
if (bits) {
ret.push((acc << (toBits - bits)) & maxv);
}
} else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv)) {
return null;
}
return ret;
}
function addressToHex(address) {
try {

if (!address || !address.startsWith('dero1')) {
console.error('[addressToHex] Invalid format');
return null;
}
const decoded5bit = bech32Decode(address);
if (!decoded5bit) {
console.error('[addressToHex] Bech32 decode failed');
return null;
}
const decoded8bit = convertBits(decoded5bit, 5, 8, false);
if (!decoded8bit) {
console.error('[addressToHex] Bit conversion failed');
return null;
}
if (decoded8bit.length > 0 && decoded8bit[0] === 0x01) {
decoded8bit.shift();
}
const hex = decoded8bit.map(b => b.toString(16).padStart(2, '0')).join('');

return hex;
} catch (error) {
console.error('[addressToHex] Error:', error);
return null;
}
}
let currentMyNames = [];
window.loadMyAccountNames = async function() {
if (!window.isWalletConnected || !window.walletAddress) {
showMessage('error', 'Please connect your wallet first');
return;
}
const btn = document.getElementById('load-names-btn');
const listDiv = document.getElementById('my-names-list');
if (!btn || !listDiv) return;
btn.disabled = true;
btn.innerHTML = '<span class="loading-spinner"></span> Loading...';
listDiv.style.display = 'none';
try {
console.log('=== LOADING ACCOUNT NAMES (OPTIMIZED) ===');

const myAddressHex = addressToHex(window.walletAddress);
if (!myAddressHex) {
throw new Error('Failed to convert wallet address to hex');
}

console.log('Wallet address (hex):', myAddressHex);

const scVariables = await sendRPCDaemon('DERO.GetSC', {
scid: '0000000000000000000000000000000000000000000000000000000000000001',
code: false,
variables: true
});

if (!scVariables) {
console.error('❌ scVariables is null/undefined');
listDiv.innerHTML = '<p class="error-text">Failed to get SC data (null response)</p>';
listDiv.style.display = 'block';
return;
}
if (!scVariables.stringkeys) {
console.error('❌ stringkeys is missing');
listDiv.innerHTML = '<p class="info-text">No names registered on the blockchain yet.</p>';
listDiv.style.display = 'block';
return;
}
const stringkeys = scVariables.stringkeys;
console.log('Total entries in contract:', Object.keys(stringkeys).length);

const myNames = [];
let totalChecked = 0;
let matchCount = 0;
for (const [name, ownerAddressHex] of Object.entries(stringkeys)) {
totalChecked++;

if (name === 'C' || name === 'owner' || name.length < 6) {
continue;
}

if (totalChecked <= 5 || ownerAddressHex.toLowerCase() === myAddressHex.toLowerCase()) {

console.log('  Owner (hex):', ownerAddressHex);
}

if (ownerAddressHex && ownerAddressHex.toLowerCase() === myAddressHex.toLowerCase()) {
matchCount++;

myNames.push({
name: name,
addressHex: ownerAddressHex
});
}
}

console.log('My names:', myNames.map(n => n.name));
currentMyNames = myNames;

if (myNames.length === 0) {
listDiv.innerHTML = '<p class="info-text">You have not registered any names yet.</p>';
} else {
let html = '<div class="names-grid">';
myNames.forEach((nameObj, index) => {
html += `
<div class="name-card">
<div class="name-card-header">
<span class="name-label">🏷️ ${escapeHtml(nameObj.name)}</span>
</div>
<div class="name-card-body">
<button class="btn btn-small btn-secondary" onclick="openTransferNameModalByIndex(${index})">
🔄 Transfer Ownership
</button>
</div>
</div>
`;
});
html += '</div>';
listDiv.innerHTML = html;
}
listDiv.style.display = 'block';
showMessage('success', `Found ${myNames.length} name(s)`);
} catch (error) {
console.error('Load names error:', error);
showMessage('error', 'Failed to load names: ' + (error.message || 'Unknown error'));
listDiv.innerHTML = '<p class="error-text">Failed to load names. Please try again.</p>';
listDiv.style.display = 'block';
} finally {
btn.disabled = false;
btn.innerHTML = '🔄 Load My Names';
}
};

window.debugSearchName = async function(searchName) {

try {
const scVariables = await sendRPCDaemon('DERO.GetSC', {
scid: '0000000000000000000000000000000000000000000000000000000000000001',
code: false,
variables: true
});
if (!scVariables || !scVariables.stringkeys) {
console.error('Failed to get SC data');
return;
}
const stringkeys = scVariables.stringkeys;
console.log('Total entries:', Object.keys(stringkeys).length);

if (searchName in stringkeys) {

console.log('  Owner (hex):', stringkeys[searchName]);
return;
}

const lowerSearch = searchName.toLowerCase();
let found = false;
for (const [name, owner] of Object.entries(stringkeys)) {
if (name.toLowerCase() === lowerSearch) {

console.log('  Owner (hex):', owner);
found = true;
break;
}
}
if (!found) {

let similar = [];
for (const name of Object.keys(stringkeys)) {
if (name.toLowerCase().includes(lowerSearch) || lowerSearch.includes(name.toLowerCase())) {
similar.push(name);
if (similar.length >= 10) break;
}
}
if (similar.length > 0) {

} else {

}
}
} catch (error) {
console.error('Debug search error:', error);
}
};

function hexToString(hex) {
if (!hex || hex.length === 0) return '';
let str = '';
for (let i = 0; i < hex.length; i += 2) {
const charCode = parseInt(hex.substr(i, 2), 16);
if (charCode === 0) break;
str += String.fromCharCode(charCode);
}
return str;
}
function hexToAddress(hex) {
if (!hex || hex.length < 64) {
throw new Error('Invalid hex length');
}
const bytes = new Uint8Array(hex.length / 2);
for (let i = 0; i < hex.length; i += 2) {
bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
}
const base64 = btoa(String.fromCharCode.apply(null, bytes));
const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
return 'dero1' + base64url;
}
function escapeHtml(text) {
const map = {
'&': '&amp;',
'<': '&lt;',
'>': '&gt;',
'"': '&quot;',
"'": '&#039;'
};
return text.replace(/[&<>"']/g, m => map[m]);
}

let currentTransferName = '';
window.openTransferNameModalByIndex = function(index) {

if (!currentMyNames || !currentMyNames[index]) {
console.error('[TRANSFER] Name not found at index', index);
showMessage('error', 'Name not found');
return;
}
const nameObj = currentMyNames[index];

openTransferNameModal(nameObj.name);
};
window.openTransferNameModal = function(name) {

currentTransferName = name;

const modal = document.getElementById('transfer-name-modal');
const nameDisplay = document.getElementById('transfer-name-display');
const addressInput = document.getElementById('transfer-address-input');
const confirmBtn = document.getElementById('transfer-confirm-btn');
const errorDiv = document.getElementById('transfer-error');
const validationDiv = document.getElementById('transfer-address-validation');
if (!modal || !nameDisplay || !addressInput || !confirmBtn) return;

nameDisplay.textContent = name;
addressInput.value = '';
confirmBtn.disabled = true;
errorDiv.style.display = 'none';
validationDiv.textContent = '';

modal.style.display = 'flex';
};
window.closeTransferNameModal = function() {
const modal = document.getElementById('transfer-name-modal');
if (modal) {
modal.style.display = 'none';
}
currentTransferName = '';
};
window.validateTransferAddress = async function(address) {
const validationDiv = document.getElementById('transfer-address-validation');
const confirmBtn = document.getElementById('transfer-confirm-btn');
const errorDiv = document.getElementById('transfer-error');
if (!validationDiv || !confirmBtn) return;
errorDiv.style.display = 'none';
const trimmed = address.trim();
if (trimmed.length === 0) {
validationDiv.textContent = '';
validationDiv.className = 'form-text';
confirmBtn.disabled = true;
return;
}
validationDiv.textContent = '⏳ Validating address...';
validationDiv.className = 'form-text';
confirmBtn.disabled = true;
let finalAddress = trimmed;

if (!trimmed.startsWith('dero1') && !trimmed.startsWith('deto1')) {
try {
const nameResult = await sendRPCDaemon('DERO.NameToAddress', {
name: trimmed,
topoheight: -1
});
if (nameResult && nameResult.address) {
finalAddress = nameResult.address;
validationDiv.textContent = `✅ Name "${trimmed}" → ${finalAddress.substring(0, 12)}...`;
validationDiv.className = 'form-text success';
validationDiv.dataset.resolvedAddress = finalAddress;
confirmBtn.disabled = false;
return;
} else {
validationDiv.textContent = '❌ Name not found on blockchain';
validationDiv.className = 'form-text error';
confirmBtn.disabled = true;
return;
}
} catch (error) {
validationDiv.textContent = '❌ Invalid address or name not found';
validationDiv.className = 'form-text error';
confirmBtn.disabled = true;
return;
}
}

if (finalAddress.length !== 66) {
validationDiv.textContent = `❌ Address must be 66 characters (current: ${finalAddress.length})`;
validationDiv.className = 'form-text error';
confirmBtn.disabled = true;
return;
}

try {
const balanceCheck = await sendRPCDaemon('DERO.GetEncryptedBalance', {
address: finalAddress,
topoheight: -1
});
if (balanceCheck && !balanceCheck.error) {
validationDiv.textContent = '✅ Valid registered address';
validationDiv.className = 'form-text success';
validationDiv.dataset.resolvedAddress = finalAddress;
confirmBtn.disabled = false;
} else if (balanceCheck && balanceCheck.error && balanceCheck.error.message === 'Account Unregistered') {
validationDiv.textContent = '⚠️ Valid address but not registered on blockchain';
validationDiv.className = 'form-text success';
validationDiv.dataset.resolvedAddress = finalAddress;
confirmBtn.disabled = false;
} else {
validationDiv.textContent = '❌ Invalid address';
validationDiv.className = 'form-text error';
confirmBtn.disabled = true;
}
} catch (error) {
validationDiv.textContent = '✅ Address format valid (validation unavailable)';
validationDiv.className = 'form-text success';
validationDiv.dataset.resolvedAddress = finalAddress;
confirmBtn.disabled = false;
}
};
window.confirmTransferName = function() {
const addressInput = document.getElementById('transfer-address-input');
const validationDiv = document.getElementById('transfer-address-validation');
const errorDiv = document.getElementById('transfer-error');
if (!addressInput || !validationDiv) return;
const inputValue = addressInput.value.trim();
if (!inputValue || inputValue.length === 0) {
errorDiv.textContent = 'Please enter a destination address or name';
errorDiv.style.display = 'block';
return;
}

const finalAddress = validationDiv.dataset.resolvedAddress || inputValue;

const nameToTransfer = currentTransferName;

closeTransferNameModal();

transferAccountName(nameToTransfer, finalAddress);
};

document.addEventListener('click', function(event) {
const modal = document.getElementById('transfer-name-modal');
if (modal && event.target === modal) {
closeTransferNameModal();
}
});

async function transferAccountName(name, newOwner) {

if (!window.isWalletConnected || !window.walletAddress) {
showMessage('error', 'Please connect your wallet first');
return;
}
try {
showMessage('info', 'Please approve the ownership transfer in your wallet...');

const result = await sendRPC('scinvoke', {
scid: '0000000000000000000000000000000000000000000000000000000000000001',
ringsize: 2,
sc_rpc: [
{ name: 'entrypoint', datatype: 'S', value: 'TransferOwnership' },
{ name: 'name', datatype: 'S', value: name },
{ name: 'newowner', datatype: 'S', value: newOwner }
]
});

if (result && result.txid) {
showMessage('success', `Ownership transfer submitted! TXID: ${result.txid.substring(0, 16)}...`);
setTimeout(() => loadMyAccountNames(), 2000);
} else {
throw new Error('Transfer failed - no transaction ID received');
}
} catch (error) {
console.error('Transfer ownership error:', error);
showMessage('error', 'Failed to transfer ownership: ' + (error.message || 'Unknown error'));
}
}
