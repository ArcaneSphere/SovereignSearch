"use strict";
let socket = null;
let isWalletConnected = false;
let requestId = 0;
const pendingRequests = new Map();
let blockHeightInterval = null;
let walletAddress = '';
let walletBalance = 0;
let xswdAddress = '127.0.0.1:44326';
let deroNodeAddress = '';
let balanceChart = null;
let currentNetwork = 'mainnet';
let chartDateFilterFrom = null;
let chartDateFilterTo = null;
const DEBUG = true;
let miningInterval = null;
let isMining = false;
let miningStats = {
sessionHashes: 0,
sessionMiniblocks: 0,
totalAttempts: 0,
startTime: null
};
let creatorAddress = 'dero1qyd8vfyuu59vd346we9s5h6zjp8cj4qydssta9hmpx6zpthvtzql7qq85azm9';
let batchSize = 1000;
let miningIntervalTime = 5000;
let maxHashesLimit = 10000;
let allAssets = [];
const assetDetails = new Map();
window.allAssets = allAssets;
window.assetDetails = assetDetails;
window.window.isWalletConnected = window.isWalletConnected;

function debugLog(message, data = null) {
if (DEBUG) {
if (data) {
} else {
}
}
}
function updateProgressBar(current, total, status = null) {
const progressFill = document.getElementById('scanProgressFill');
const progressText = document.getElementById('scanProgressText');
const progressPercentage = document.getElementById('scanProgressPercentage');
if (!progressFill || !progressText || !progressPercentage) return;
const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
progressFill.style.width = `${percentage}%`;
progressPercentage.textContent = `${percentage}%`;
if (status) {
progressText.textContent = status;
} else if (current === 0 && total === 0) {
progressText.textContent = 'Ready to load data';
} else if (current === total && total > 0) {
progressText.textContent = `Done: ${total}/${total} transactions processed`;
} else {
progressText.textContent = `Loading data: ${current}/${total}`;
}
}
async function loadTimestampsWithProgress(transactions, startIndex = 0) {
const total = transactions.length;
let loaded = 0;
let alreadyLoaded = 0;
transactions.forEach(tx => {
if (tx.realTimestamp) alreadyLoaded++;
});
updateProgressBar(alreadyLoaded, total, `Starting: ${alreadyLoaded}/${total} already loaded`);
for (let i = 0; i < transactions.length; i++) {
const tx = transactions[i];
if (!tx.realTimestamp) {
const timestamp = await getTransactionTimestamp(tx);
if (timestamp) {
tx.realTimestamp = timestamp;
loaded++;
}
} else {
loaded++;
}
if (i % 5 === 0 || i === transactions.length - 1) {
updateProgressBar(loaded, total);
}
if (startIndex >= 0) {
updateTransactionTimestamp(startIndex + i, tx);
}
}
updateProgressBar(total, total);
return loaded;
}
function updateWalletStatus(connected) {
const statusDot = document.getElementById('walletStatusDot');
const connectBtn = document.getElementById('connect-wallet-btn');
const btnText = document.querySelector('.wallet-btn-text');
if (statusDot) {
statusDot.className = connected ? 'wallet-status-dot connected' : 'wallet-status-dot disconnected';
}
if (btnText) {
btnText.textContent = connected ? 'Disconnect Wallet' : 'Connect Wallet';
}
if (connectBtn && connected) {
connectBtn.style.background = 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)';
} else if (connectBtn) {
connectBtn.style.background = 'linear-gradient(135deg, #4A90E2 0%, #357ABD 100%)';
}
}
function resetAllData() {
walletAddress = null;
window.walletAddress = null;
walletBalance = 0;
window.deroBalance = 0;
allAssets = [];
assetDetails.clear();
if (typeof window.allTransactions !== 'undefined') {
window.allTransactions = [];
}
if (miningInterval) {
clearInterval(miningInterval);
miningInterval = null;
}
isMining = false;
miningStats = {
sessionHashes: 0,
sessionMiniblocks: 0,
totalAttempts: 0,
startTime: null
};
const modeDevRadio = document.getElementById('mode-dev');
const modeSplitRadio = document.getElementById('mode-split');
const batchSizeInput = document.getElementById('batch-size');
const miningIntervalInput = document.getElementById('mining-interval');
const primaryAddressInput = document.getElementById('primary-address');
const secondaryAddressInput = document.getElementById('secondary-address');
const splitRatioInput = document.getElementById('split-ratio');
const ratioValueSpan = document.getElementById('ratio-value');
if (modeDevRadio) modeDevRadio.checked = true;
if (modeSplitRadio) modeSplitRadio.checked = false;
if (batchSizeInput) batchSizeInput.value = '1000';
if (miningIntervalInput) miningIntervalInput.value = '5000';
if (primaryAddressInput) primaryAddressInput.value = '';
if (secondaryAddressInput) secondaryAddressInput.value = '';
if (splitRatioInput) splitRatioInput.value = '20';
if (ratioValueSpan) ratioValueSpan.textContent = '20%';
const splitConfigSection = document.getElementById('split-config-section');
if (splitConfigSection) splitConfigSection.style.display = 'none';
if (balanceChart && typeof balanceChart.destroy === 'function') {
try {
balanceChart.destroy();
balanceChart = null;
} catch (e) {
balanceChart = null;
}
}
const balanceElement = document.getElementById('balanceDisplay');
if (balanceElement) {
balanceElement.textContent = '-';
}
const balanceHighlight = document.getElementById('walletBalanceHighlight');
if (balanceHighlight) {
balanceHighlight.textContent = '0.00000';
}
const addressHighlight = document.getElementById('walletAddressHighlight');
if (addressHighlight) {
addressHighlight.innerHTML = '<span class="placeholder">Connect wallet</span>';
}
const walletAddressWallet = document.getElementById('walletAddressWallet');
if (walletAddressWallet) {
walletAddressWallet.innerHTML = '<span class="placeholder">Connect wallet to see address</span>';
}
const walletAddressDisplay = document.getElementById('walletAddress');
if (walletAddressDisplay) {
walletAddressDisplay.textContent = 'Not connected';
}
const walletBalanceWallet = document.getElementById('walletBalanceWallet');
if (walletBalanceWallet) {
walletBalanceWallet.textContent = '0.00000';
}
const sidebarBalance = document.getElementById('sidebarBalance');
if (sidebarBalance) {
sidebarBalance.textContent = '0.00000';
}
const sidebarAddress = document.getElementById('sidebarAddress');
if (sidebarAddress) {
sidebarAddress.textContent = 'Not connected';
}
const walletAddressShort = document.getElementById('walletAddressShort');
if (walletAddressShort) {
walletAddressShort.textContent = '';
walletAddressShort.classList.remove('show');
}
const avatarBox = document.getElementById('avatarBox');
if (avatarBox) {
avatarBox.innerHTML = '<div class="avatar-placeholder">Choose<br>Avatar</div>';
avatarBox.classList.remove('show');
}
const scanProgressText = document.getElementById('scanProgressText');
if (scanProgressText) {
scanProgressText.textContent = 'Ready to load data';
}
const scanProgressPercentage = document.getElementById('scanProgressPercentage');
if (scanProgressPercentage) {
scanProgressPercentage.textContent = '0%';
}
const scanProgressFill = document.getElementById('scanProgressFill');
if (scanProgressFill) {
scanProgressFill.style.width = '0%';
}
const blockHeightElement = document.getElementById('blockHeightDisplay');
if (blockHeightElement) {
blockHeightElement.textContent = '-';
}
const totalTransactions = document.getElementById('totalTransactions');
if (totalTransactions) {
totalTransactions.textContent = '0';
}
const totalFees = document.getElementById('totalFees');
if (totalFees) {
totalFees.textContent = '0.00000';
}
const miningStatus = document.getElementById('overviewMiningStatus');
if (miningStatus) {
miningStatus.textContent = '⏸️ Inactive';
}
const hashRate = document.getElementById('overviewHashRate');
if (hashRate) {
hashRate.textContent = '0 H/s';
}
const miningBtn = document.getElementById('toggle-mining-btn');
if (miningBtn) {
miningBtn.textContent = '⛏️ Start Mining';
miningBtn.classList.remove('mining-active');
miningBtn.disabled = false;
}
const miningHashesDisplay = document.getElementById('miningHashes');
if (miningHashesDisplay) {
miningHashesDisplay.textContent = '0';
}
const miningMiniblocksDisplay = document.getElementById('miningMiniblocks');
if (miningMiniblocksDisplay) {
miningMiniblocksDisplay.textContent = '0';
}
const miningAttemptsDisplay = document.getElementById('miningAttempts');
if (miningAttemptsDisplay) {
miningAttemptsDisplay.textContent = '0';
}
const miningStatusDisplay = document.getElementById('mining-status');
if (miningStatusDisplay) {
miningStatusDisplay.textContent = 'Mining inactive';
}
const gallery = document.getElementById('asset-gallery');
if (gallery) {
gallery.innerHTML = '<p class="placeholder">Click "Scan Assets" to load your assets</p>';
}
const tokenGallery = document.getElementById('token-gallery');
if (tokenGallery) {
tokenGallery.innerHTML = '<p class="placeholder">Click "Scan Tokens" to load your tokens</p>';
}
const totalAssetsElement = document.getElementById('totalAssets');
if (totalAssetsElement) {
totalAssetsElement.textContent = '0';
}
const visibleAssetsElement = document.getElementById('visibleAssets');
if (visibleAssetsElement) {
visibleAssetsElement.textContent = '0';
}
const totalTokensElement = document.getElementById('totalTokens');
if (totalTokensElement) {
totalTokensElement.textContent = '0';
}
const transactionsList = document.getElementById('transactionsList');
if (transactionsList) {
transactionsList.innerHTML = '<tr><td colspan="4" class="no-transactions">No transactions</td></tr>';
}
const recentTransactions = document.getElementById('recent-transactions');
if (recentTransactions) {
recentTransactions.innerHTML = '<p class="placeholder">No transactions to display</p>';
}
const transactionSearch = document.getElementById('transaction-search');
if (transactionSearch) {
transactionSearch.value = '';
}
const transactionCount = document.getElementById('transaction-count');
if (transactionCount) {
transactionCount.textContent = '0 transactions';
}
const paginationTop = document.getElementById('pagination-controls-top');
if (paginationTop) {
paginationTop.classList.add('hidden');
}
const paginationBottom = document.getElementById('pagination-controls-bottom');
if (paginationBottom) {
paginationBottom.classList.add('hidden');
}
const pageInfoTop = document.getElementById('page-info-top');
if (pageInfoTop) {
pageInfoTop.textContent = 'Page 1 of 1';
}
const pageInfoBottom = document.getElementById('page-info-bottom');
if (pageInfoBottom) {
pageInfoBottom.textContent = 'Page 1 of 1';
}
const chartDiv = document.getElementById('balanceChart');
if (chartDiv) {
chartDiv.innerHTML = '';
}
const paymentIdInput = document.getElementById('payment-id-input');
if (paymentIdInput) {
paymentIdInput.value = '';
}
const amountInput = document.getElementById('amount-input');
if (amountInput) {
amountInput.value = '';
}
const messageInput = document.getElementById('message-input');
if (messageInput) {
messageInput.value = '';
}
const paymentIdValidation = document.getElementById('payment-id-validation');
if (paymentIdValidation) {
paymentIdValidation.textContent = '';
}
const integratedResult = document.getElementById('integrated-result');
if (integratedResult) {
integratedResult.style.display = 'none';
}
const integratedAddressDisplay = document.getElementById('integrated-address-display');
if (integratedAddressDisplay) {
integratedAddressDisplay.textContent = '';
}
const integratedParamsContent = document.getElementById('integrated-params-content');
if (integratedParamsContent) {
integratedParamsContent.innerHTML = '';
}
window.currentIntegratedAddress = null;
const pieChartCanvas = document.getElementById('transactionPieChart');
if (pieChartCanvas && typeof window.updateTransactionPieChart === 'function') {
window.updateTransactionPieChart();
}
closeAssetModal();
closeAddAssetModal();
closeImportModal();
updateProgressBar(0, 0);
}
function showMessage(type, message) {
const notification = document.getElementById('notification');
if (notification) {
notification.textContent = message;
notification.className = `notification ${type}`;
notification.classList.remove('hidden');
setTimeout(() => {
notification.classList.add('hidden');
}, 5000);
}
}
function normalizeTimestamp(timestamp) {
if (!timestamp || timestamp === 0) return null;
if (timestamp < 10000000000) return timestamp * 1000;
if (timestamp < 10000000000000) return timestamp;
return Math.floor(timestamp / 1000);
}
function formatTimestamp(timestampMs) {
if (!timestampMs || timestampMs === 0) return "N/A";
const date = new Date(timestampMs);
if (isNaN(date.getTime())) return "Invalid date";
const day = String(date.getDate()).padStart(2, '0');
const month = String(date.getMonth() + 1).padStart(2, '0');
const year = date.getFullYear();
const hours = String(date.getHours()).padStart(2, '0');
const minutes = String(date.getMinutes()).padStart(2, '0');
const seconds = String(date.getSeconds()).padStart(2, '0');
return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}
function formatChartDate(timestampMs, timeframe) {
const date = new Date(timestampMs);
const day = String(date.getDate()).padStart(2, '0');
const month = String(date.getMonth() + 1).padStart(2, '0');
const year = date.getFullYear();
const yearShort = String(year).substring(2);
const hours = String(date.getHours()).padStart(2, '0');
const minutes = String(date.getMinutes()).padStart(2, '0');
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
switch(timeframe) {
case 'hourly': return `${day}/${month} ${hours}:${minutes}`;
case 'daily': return `${day}/${month}`;
case 'weekly': return `${day}/${month}`;
case 'monthly': return monthNames[date.getMonth()];
case 'all': return `${monthNames[date.getMonth()]} ${yearShort}`;
default: return `${day}/${month}/${year}`;
}
}
function getWeekNumber(date) {
const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
const dayNum = d.getUTCDay() || 7;
d.setUTCDate(d.getUTCDate() + 4 - dayNum);
const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
document.addEventListener('DOMContentLoaded', function() {
setupNavigation();
loadSavedSettings();
updateWalletStatus(false);
const sidebarWalletCard = document.getElementById('sidebarWalletCard');
if (sidebarWalletCard) {
sidebarWalletCard.classList.add('visible');
}
const fromInput = document.getElementById('export-from-date');
const toInput = document.getElementById('export-to-date');
if (fromInput && typeof window.updateExportSummary === 'function') {
fromInput.addEventListener('change', window.updateExportSummary);
}
if (toInput && typeof window.updateExportSummary === 'function') {
toInput.addEventListener('change', window.updateExportSummary);
}
});
function setupNavigation() {
const navItems = document.querySelectorAll('.nav-item');
navItems.forEach(item => {
item.addEventListener('click', function(e) {
e.preventDefault();
const page = this.getAttribute('data-page');
showPage(page);
navItems.forEach(nav => nav.classList.remove('active'));
this.classList.add('active');
});
});
}
function showPage(pageName) {
const pages = document.querySelectorAll('.page');
pages.forEach(page => page.classList.remove('active'));
const targetPage = document.getElementById(`${pageName}-page`);
if (targetPage) targetPage.classList.add('active');
const sidebarWalletCard = document.getElementById('sidebarWalletCard');
if (sidebarWalletCard) {
if (pageName === 'wallet') {
sidebarWalletCard.classList.remove('visible');
} else {
sidebarWalletCard.classList.add('visible');
}
}
}
window.goToHome = function() {
showPage('highlights');
const navItems = document.querySelectorAll('.nav-item');
navItems.forEach(nav => nav.classList.remove('active'));
const highlightsNav = document.querySelector('[data-page="highlights"]');
if (highlightsNav) highlightsNav.classList.add('active');
};
window.goToSettings = function() {
showPage('settings');
const navItems = document.querySelectorAll('.nav-item');
navItems.forEach(nav => nav.classList.remove('active'));
const settingsNav = document.querySelector('[data-page="settings"]');
if (settingsNav) settingsNav.classList.add('active');
};
function loadSavedSettings() {
try {
const savedXswd = localStorage.getItem('xswdAddress');
if (savedXswd) {
xswdAddress = savedXswd;
const daemonInput = document.getElementById('daemon-address');
if (daemonInput) daemonInput.value = savedXswd;
}
} catch (error) {
}
}
window.saveDaemonAddress = function() {
const input = document.getElementById('daemon-address');
if (!input) return;
const newAddress = input.value.trim();
if (!newAddress) {
showMessage('error', 'Please enter a valid XSWD address');
return;
}
if (window.isWalletConnected) {
showMessage('warning', 'Please disconnect the wallet before changing the XSWD address');
return;
}
xswdAddress = newAddress;
try {
localStorage.setItem('xswdAddress', newAddress);
} catch (error) {
}
showMessage('success', 'XSWD address saved. Connect the wallet to use the new address.');
};
async function sha256(msg) {
const buf = new TextEncoder().encode(msg);
const hash = await crypto.subtle.digest('SHA-256', buf);
return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}
window.toggleWalletConnection = async function() {
const btn = document.getElementById('connect-wallet-btn');
const walletNotice = document.getElementById('walletNotice');
if (!btn) return;
if (window.isWalletConnected) {
showDisconnectModal();
return;
}
if (walletNotice) walletNotice.classList.remove('hidden');
if (walletNotice) walletNotice.textContent = 'Waiting for wallet approval...';
btn.disabled = true;
btn.innerHTML = '<span class="wallet-btn-text">Connecting<span class="loading-spinner"></span></span><span class="wallet-status-dot disconnected"></span>';
try {
socket = new WebSocket(`ws://${xswdAddress}/xswd`);
socket.onopen = async () => {
const appName = "Orbis";
const appId = "ad6b1ab7b054de1d10dd9df87f0c970ff93bf7bcd978605a8131aee8330c9ab5";
const signatureText = `-----BEGIN DERO SIGNED MESSAGE-----
Address: dero1qyd8vfyuu59vd346we9s5h6zjp8cj4qydssta9hmpx6zpthvtzql7qq85azm9
C: 3d9034d15f92ebf974dc99266446ad60f74d1f64ccb1a9d1d85943c7d580b25
S: e2cca085c05bd15bfe6f954ffe5c9f05714840118f8ca37ea21dc9dd953fbdf
YWQ2YjFhYjdiMDU0ZGUxZDEwZGQ5ZGY4N2YwYzk3MGZmOTNiZjdiY2Q5Nzg2MDVh
ODEzMWFlZTgzMzBjOWFiNQ==
-----END DERO SIGNED MESSAGE-----`;
const appData = {
id: appId,
name: appName,
description: "Web interface to interact with the DERO blockchain",
url: window.location.origin,
permissions: {
GetHeight: 3,
GetAddress: 3,
GetBalance: 3,
GetDaemon: 0,
GetTransfers: 3,
GetAssets: 0,
AttemptEPOCHWithAddr: 0,
MakeIntegratedAddress: 0,
transfer: 0
},
signature: btoa(signatureText)
};
socket.send(JSON.stringify(appData));
};
socket.onmessage = (e) => {
try {
const msg = JSON.parse(e.data);
if (msg.accepted === true) {
window.isWalletConnected = true;
updateWalletStatus(true);
btn.disabled = false;
if (walletNotice) {
walletNotice.textContent = 'Loading wallet data...';
}
getWalletAddress();
startBlockHeightRefresh();
showMessage('success', 'Wallet connected successfully');
} else if (msg.accepted === false || msg.rejected === true) {
updateWalletStatus(false);
btn.disabled = false;
if (walletNotice) walletNotice.classList.add('hidden');
showMessage('error', 'Connection refused: ' + (msg.reason || 'Invalid signature or wallet mismatch'));
} else if (msg.jsonrpc && msg.id) {
handleRPCResponse(msg);
} else {
}
} catch (error) {
}
};
socket.onerror = (error) => {
updateWalletStatus(false);
btn.disabled = false;
if (walletNotice) walletNotice.classList.add('hidden');
showMessage('error', 'Connection error. Check XSWD is running.');
};
socket.onclose = (event) => {
if (!btn.disabled) {
stopBlockHeightRefresh();
window.isWalletConnected = false;
updateWalletStatus(false);
resetAllData();
btn.disabled = false;
if (walletNotice) walletNotice.classList.add('hidden');
if (event.code === 1000 || event.code === 1005) {
showMessage('info', 'Wallet disconnected normally');
} else {
showMessage('warning', 'Connection closed unexpectedly (Code: ' + event.code + ')');
}
}
};
} catch (error) {
updateWalletStatus(false);
btn.disabled = false;
if (walletNotice) walletNotice.classList.add('hidden');
showMessage('error', 'Error: ' + error.message);
}
};
function sendRPC(method, params = {}) {
return new Promise((resolve, reject) => {
if (!window.isWalletConnected || !socket || socket.readyState !== WebSocket.OPEN) {
reject(new Error('Not connected to wallet'));
return;
}
const id = (++requestId).toString();
const request = { jsonrpc: "2.0", id: id, method: method };
if (Object.keys(params).length > 0) request.params = params;
pendingRequests.set(id, { resolve, reject, method });
socket.send(JSON.stringify(request));
setTimeout(() => {
if (pendingRequests.has(id)) {
pendingRequests.delete(id);
reject(new Error(`Timeout: ${method}`));
}
}, 30000);
});
}
function handleRPCResponse(response) {
let normalizedId = response.id;
if (typeof normalizedId === 'string' && normalizedId.startsWith('"') && normalizedId.endsWith('"')) {
normalizedId = normalizedId.slice(1, -1);
}
if (normalizedId && pendingRequests.has(normalizedId)) {
const { resolve, reject } = pendingRequests.get(normalizedId);
pendingRequests.delete(normalizedId);
if (response.error) {
reject(new Error(response.error.message || 'RPC error'));
} else {
resolve(response.result);
}
}
}
async function getWalletAddress() {
try {
const result = await sendRPC('GetAddress');
walletAddress = result.address;
window.walletAddress = walletAddress;
updateWalletAddressDisplays();
if (typeof window.updateAvatarUI === 'function') {
window.updateAvatarUI();
}
await getDaemonAddress();
getWalletBalance();
if (typeof window.getAllTransactions === 'function') {
window.getAllTransactions();
}
initializeMiningPage();
} catch (error) {
showMessage('error', 'Error: ' + error.message);
const walletNotice = document.getElementById('walletNotice');
if (walletNotice) {
walletNotice.classList.add('hidden');
}
}
}
function updateWalletAddressDisplays() {
const displays = ['walletAddressHighlight', 'walletAddressWallet', 'sidebarAddress'];
displays.forEach(id => {
const element = document.getElementById(id);
if (element) element.textContent = walletAddress;
});
if (typeof window.updateAvatarUI === 'function') {
window.updateAvatarUI();
}
}
async function getWalletBalance() {
try {
const result = await sendRPC('GetBalance');
const balance = result.balance || result.unlocked_balance || 0;
window.deroBalance = balance; // Store atomic balance
const balanceInDero = balance / 100000;
updateBalanceDisplays(balanceInDero);
} catch (error) {

}
}
async function getDaemonAddress() {
try {

const result = await sendRPC('GetDaemon');

if (result && result.endpoint) {
let daemonAddr = result.endpoint;

if (daemonAddr.includes(':')) {
daemonAddr = daemonAddr.split(':')[0];
}
console.log('[DAEMON] Daemon address received (port removed):', daemonAddr);
deroNodeAddress = daemonAddr;
window.deroNodeAddress = daemonAddr;

} else {

}
} catch (error) {
console.error('[DAEMON] Failed to get daemon address:', error);

}
}
function updateBalanceDisplays(balance) {
const displays = ['walletBalanceHighlight', 'walletBalanceWallet', 'sidebarBalance'];
displays.forEach(id => {
const element = document.getElementById(id);
if (element) element.textContent = balance.toFixed(5);
});
}
window.copyWalletAddress = function() {
if (!walletAddress || walletAddress.includes('Connect')) {
showMessage('error', 'No wallet address to copy');
return;
}
navigator.clipboard.writeText(walletAddress).then(() => {
showMessage('success', 'Wallet address copied!');
}).catch(err => {
showMessage('error', 'Failed to copy address');
});
};
async function getBlockHeight() {
try {
const result = await sendRPC('GetHeight');
if (result && (result.topoheight || result.height)) {
const height = result.topoheight || result.height;
updateBlockHeight(height);
}
} catch (error) {
}
}
function updateBlockHeight(height) {
if (!height) return;
const blockHeightElement = document.getElementById('blockHeightDisplay');
if (blockHeightElement) {
blockHeightElement.textContent = height.toLocaleString();
}
}
function startBlockHeightRefresh() {
getBlockHeight();
if (blockHeightInterval) {
clearInterval(blockHeightInterval);
}
blockHeightInterval = setInterval(getBlockHeight, 23000);
}
function stopBlockHeightRefresh() {
if (blockHeightInterval) {
clearInterval(blockHeightInterval);
blockHeightInterval = null;
}
}
window.validatePaymentIdInput = function(value) {
const validationElement = document.getElementById('payment-id-validation');
if (!validationElement) return;
if (value.length === 0) {
validationElement.textContent = '✓ Optional field';
validationElement.style.color = 'var(--success-color)';
return;
}
const isNumeric = /^\d+$/.test(value);
if (isNumeric) {
const port = parseInt(value);
if (port >= 0 && port <= 65535) {
validationElement.textContent = `✓ Valid port: ${port}`;
validationElement.style.color = 'var(--success-color)';
} else {
validationElement.textContent = '✗ Port must be between 0-65535';
validationElement.style.color = 'var(--danger-color)';
}
return;
}
const hexPattern = /^[0-9a-fA-F]*$/;
if (!hexPattern.test(value)) {
validationElement.textContent = '✗ Only hex (0-9,a-f) or port number';
validationElement.style.color = 'var(--danger-color)';
return;
}
if (value.length < 64) {
validationElement.textContent = `⚠ ${value.length}/64 characters for payment ID`;
validationElement.style.color = 'var(--warning-color)';
return;
}
if (value.length === 64) {
validationElement.textContent = '✓ Valid payment ID (64 hex)';
validationElement.style.color = 'var(--success-color)';
return;
}
};

function showDisconnectModal() {
const existingModal = document.getElementById('disconnect-modal');
if (existingModal) existingModal.remove();
const modal = document.createElement('div');
modal.id = 'disconnect-modal';
modal.className = 'modal-overlay';
modal.innerHTML = `
<div class="modal-content">
<div class="modal-header">
<h2>⚠️ Disconnect Wallet</h2>
<button class="modal-close" onclick="closeDisconnectModal()">×</button>
</div>
<div class="modal-body">
<p>Are you sure you want to disconnect your wallet?</p>
<p style="margin-top: 1rem; color: var(--warning-color);">
<strong>Warning:</strong> This will reload the page and clear all data.
</p>
</div>
<div class="modal-footer">
<button class="btn-secondary" onclick="closeDisconnectModal()">Cancel</button>
<button class="btn-primary" onclick="confirmDisconnect()">Disconnect</button>
</div>
</div>
`;
document.body.appendChild(modal);
}

window.closeDisconnectModal = function() {
const modal = document.getElementById('disconnect-modal');
if (modal) modal.remove();
};

window.confirmDisconnect = function() {
closeDisconnectModal();
if (socket) {
socket.close();
socket = null;
}
if (isMining) {
stopMining();
}
localStorage.removeItem('miningConfig');
localStorage.removeItem('batchSize');
localStorage.removeItem('miningInterval');
localStorage.removeItem('walletAddress');
localStorage.removeItem('deroBalance');
localStorage.removeItem('blockHeight');
location.reload();
};
