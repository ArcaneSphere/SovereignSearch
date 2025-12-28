"use strict";

// ============================================
// ASSETS SCANNING & MANAGEMENT
// ============================================

window.scanAssets = async function() {
if (!window.isWalletConnected) {
showMessage('error', 'Please connect your wallet first');
return;
}
const btn = document.getElementById('scan-assets-btn');
const progressCard = document.getElementById('assetScanProgress');
const gallery = document.getElementById('asset-gallery');
if (!btn || !gallery) return;
btn.disabled = true;
btn.innerHTML = '<span class="loading-spinner"></span> Scanning...';
if (progressCard) progressCard.style.display = 'block';
gallery.innerHTML = '<div class="asset-loading"><div class="asset-loading-spinner"></div></div>';
try {
if (typeof window.updateAssetScanProgress === 'function') {
updateAssetScanProgress(0, 100, 'Scanning transfers for assets...');
}
const allScids = new Set();
try {
const assetsResult = await sendRPC('GetAssets');
if (assetsResult && (assetsResult.scids || assetsResult.SCIDS)) {
const scids = assetsResult.scids || assetsResult.SCIDS;
if (scids && scids.length > 0) {
scids.forEach(scid => allScids.add(scid));
}
}
} catch (e) {}
try {
let hasMore = true;
let minHeight = 0;
let iteration = 0;
const maxIterations = 20;
while (hasMore && iteration < maxIterations) {
iteration++;
try {
const transfersResult = await sendRPC('GetTransfers', {
in: true,
out: true,
coinbase: false,
min_height: minHeight
});
if (transfersResult && transfersResult.entries && transfersResult.entries.length > 0) {
let maxHeightInBatch = minHeight;
transfersResult.entries.forEach(tx => {
if (tx.height && tx.height > maxHeightInBatch) {
maxHeightInBatch = tx.height;
}
if (tx.scid && tx.scid !== '0000000000000000000000000000000000000000000000000000000000000000') {
allScids.add(tx.scid);
}
if (tx.payload_rpc && Array.isArray(tx.payload_rpc)) {
tx.payload_rpc.forEach(item => {
if (item.name && item.name.toLowerCase().includes('scid') && item.value) {
const cleanScid = item.value.toString().toLowerCase().replace(/[^0-9a-f]/g, '');
if (cleanScid.length === 64 && cleanScid !== '0000000000000000000000000000000000000000000000000000000000000000') {
allScids.add(cleanScid);
}
}
});
}
if (tx.payload && tx.payload.transfers && Array.isArray(tx.payload.transfers)) {
tx.payload.transfers.forEach(transfer => {
if (transfer.scid && transfer.scid !== '0000000000000000000000000000000000000000000000000000000000000000') {
allScids.add(transfer.scid);
}
if (transfer.asset && transfer.asset !== '0000000000000000000000000000000000000000000000000000000000000000') {
allScids.add(transfer.asset);
}
});
}
});
if (transfersResult.entries.length < 100) {
hasMore = false;
} else {
minHeight = maxHeightInBatch + 1;
}
} else {
hasMore = false;
}
} catch (iterError) {
hasMore = false;
}
await new Promise(resolve => setTimeout(resolve, 100));
}
} catch (e) {}
try {
const detailedBalance = await sendRPC('GetBalance', { detailed: true });
if (detailedBalance) {
if (detailedBalance.balances && typeof detailedBalance.balances === 'object') {
const keys = Object.keys(detailedBalance.balances);
keys.forEach(key => {
if (key.length === 64 && /^[0-9a-f]{64}$/i.test(key)) {
allScids.add(key);
}
});
}
}
} catch (e) {}
const scids = Array.from(allScids).filter(scid =>
scid !== '0000000000000000000000000000000000000000000000000000000000000000'
);
if (scids.length > 0) {
window.allAssets = scids;
if (typeof window.updateAssetScanProgress === 'function') {
updateAssetScanProgress(10, 100, 'Loading asset details...');
}
if (typeof window.loadAssetDetails !== 'function') {
throw new Error('loadAssetDetails function not available. Please refresh the page.');
}
await window.loadAssetDetails(window.allAssets);
window.displayAssets();
const assetsOnly = window.allAssets.filter(scid => {
const details = window.assetDetails.get(scid);
return details && details.type !== 'token' && details.balance > 0;
});
const tokensOnly = window.allAssets.filter(scid => {
const details = window.assetDetails.get(scid);
return details && details.type === 'token' && details.balance > 0;
});
if (typeof window.updateAssetScanProgress === 'function') {
updateAssetScanProgress(100, 100, `Complete: ${assetsOnly.length} assets, ${tokensOnly.length} tokens`);
}
showMessage('success', `Found ${assetsOnly.length} asset${assetsOnly.length > 1 ? 's' : ''} and ${tokensOnly.length} token${tokensOnly.length > 1 ? 's' : ''}`);
setTimeout(() => {
if (progressCard) progressCard.style.display = 'none';
}, 2000);
} else {
gallery.innerHTML = '<p class="placeholder">No assets found. Check console for debug info.</p>';
const totalAssetsElement = document.getElementById('totalAssets');
if (totalAssetsElement) {
totalAssetsElement.textContent = '0';
}
showMessage('warning', 'No assets found - check console logs');
if (progressCard) progressCard.style.display = 'none';
}
} catch (error) {
gallery.innerHTML = '<p class="placeholder">Error loading assets. Check console.</p>';
showMessage('error', 'Failed to scan assets: ' + error.message);
if (progressCard) progressCard.style.display = 'none';
} finally {
btn.disabled = false;
btn.innerHTML = '🔍 Scan Assets';
}
};

// ============================================
// TOKENS SCANNING & MANAGEMENT
// ============================================

window.scanTokens = async function() {
if (!window.isWalletConnected) {
showMessage('error', 'Please connect your wallet first');
return;
}
const btn = document.getElementById('scan-tokens-btn');
const progressCard = document.getElementById('tokenScanProgress');
const gallery = document.getElementById('token-gallery');
if (!btn || !gallery) return;
btn.disabled = true;
btn.innerHTML = '<span class="loading-spinner"></span> Scanning...';
if (progressCard) progressCard.style.display = 'block';
gallery.innerHTML = '<div class="asset-loading"><div class="asset-loading-spinner"></div></div>';
try {
if (window.allAssets.length === 0) {
if (typeof window.updateTokenScanProgress === 'function') {
updateTokenScanProgress(0, 100, 'Scanning blockchain...');
}
await window.scanAssets();
}
window.displayTokens();
const tokensOnly = window.allAssets.filter(scid => {
const details = window.assetDetails.get(scid);
return details && details.type === 'token' && details.balance > 0;
});
if (typeof window.updateTokenScanProgress === 'function') {
updateTokenScanProgress(100, 100, `Complete: ${tokensOnly.length} tokens loaded`);
}
showMessage('success', `Found ${tokensOnly.length} token${tokensOnly.length > 1 ? 's' : ''}`);
setTimeout(() => {
if (progressCard) progressCard.style.display = 'none';
}, 2000);
} catch (error) {
gallery.innerHTML = '<p class="placeholder">Error loading tokens. Check console.</p>';
showMessage('error', 'Failed to scan tokens: ' + error.message);
if (progressCard) progressCard.style.display = 'none';
} finally {
btn.disabled = false;
btn.innerHTML = '🔍 Scan Tokens';
}
};

window.updateTokenScanProgress = function updateTokenScanProgress(current, total, status = null) {
const progressFill = document.getElementById('tokenScanProgressFill');
const progressText = document.getElementById('tokenScanProgressText');
const progressPercentage = document.getElementById('tokenScanProgressPercentage');
if (!progressFill || !progressText || !progressPercentage) return;
const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
progressFill.style.width = `${percentage}%`;
progressPercentage.textContent = `${percentage}%`;
if (status) {
progressText.textContent = status;
} else if (current === 0 && total === 0) {
progressText.textContent = 'Ready to scan';
} else if (current === total && total > 0) {
progressText.textContent = `Complete: ${total} tokens loaded`;
} else {
progressText.textContent = `Loading tokens: ${current}/${total}`;
}
};

window.openAddTokenModal = function() {
openAddAssetModal();
};

window.openImportTokensModal = function() {
openImportModal();
};

window.exportTokens = function() {
const tokensOnly = window.allAssets.filter(scid => {
const details = window.assetDetails.get(scid);
return details && details.type === 'token';
});
if (tokensOnly.length === 0) {
showMessage('warning', 'No tokens to export');
return;
}
const tokensData = {
exportDate: new Date().toISOString(),
walletAddress: walletAddress,
totalTokens: tokensOnly.length,
assets: tokensOnly.map(scid => window.assetDetails.get(scid))
};
const dataStr = JSON.stringify(tokensData, null, 2);
const dataBlob = new Blob([dataStr], { type: 'application/json' });
const url = URL.createObjectURL(dataBlob);
const link = document.createElement('a');
link.href = url;
link.download = `dero_tokens_${Date.now()}.json`;
document.body.appendChild(link);
link.click();
document.body.removeChild(link);
URL.revokeObjectURL(url);
showMessage('success', `Exported ${tokensOnly.length} token${tokensOnly.length > 1 ? 's' : ''}`);
};

window.resetTokensGallery = function() {
if (!confirm('Are you sure you want to reset the token gallery? This will remove all tokens from display (you can scan again to reload them).')) {
return;
}
window.allAssets = window.allAssets.filter(scid => {
const details = window.assetDetails.get(scid);
return !details || details.type !== 'token';
});
window.assetDetails.forEach((details, scid) => {
if (details.type === 'token') {
window.assetDetails.delete(scid);
}
});
const gallery = document.getElementById('token-gallery');
if (gallery) {
gallery.innerHTML = '<p class="placeholder">Click "Scan Tokens" to load your tokens</p>';
}
const totalTokensElement = document.getElementById('totalTokens');
if (totalTokensElement) {
totalTokensElement.textContent = '0';
}
showMessage('success', 'Token gallery reset');
};

// ============================================
// ASSET MENU MANAGEMENT
// ============================================

window.toggleAssetMenu = function(scid) {
const menu = document.getElementById('menu-' + scid);
if (!menu) return;
document.querySelectorAll('.asset-menu-dropdown').forEach(m => {
if (m.id !== 'menu-' + scid) m.classList.remove('show');
});
menu.classList.toggle('show');
};

window.createAssetMenuHTML = function(details) {
let menuItems = '';
if (details.type === 'nft') {
if (details.isDisplayed) {
menuItems += `<div class="asset-menu-item" onclick="event.stopPropagation(); retrieveNFT('${details.scid}'); toggleAssetMenu('${details.scid}')">🔄 Retrieve</div>`;
} else {
menuItems += `<div class="asset-menu-item" onclick="event.stopPropagation(); displayNFT('${details.scid}'); toggleAssetMenu('${details.scid}')">👁️ Display</div>`;
}
menuItems += `<div class="asset-menu-item" onclick="event.stopPropagation(); sendAsset('${details.scid}'); toggleAssetMenu('${details.scid}')">📤 Send</div>`;
} else if (details.type === 'nfa') {
menuItems += `<div class="asset-menu-item" onclick="event.stopPropagation(); setAsAvatar('${details.scid}'); toggleAssetMenu('${details.scid}')">🎭 Set Avatar</div>`;
menuItems += `<div class="asset-menu-item" onclick="event.stopPropagation(); sendAsset('${details.scid}'); toggleAssetMenu('${details.scid}')">📤 Send</div>`;
} else {
menuItems += `<div class="asset-menu-item" onclick="event.stopPropagation(); sendAsset('${details.scid}'); toggleAssetMenu('${details.scid}')">📤 Send</div>`;
}
return `
<button class="asset-menu-btn" onclick="event.stopPropagation(); toggleAssetMenu('${details.scid}')">⋮</button>
<div class="asset-menu-dropdown" id="menu-${details.scid}">
${menuItems}
</div>
`;
};

window.setAsAvatar = function(scid) {
const details = window.assetDetails.get(scid);
if (!details) {
showMessage('error', 'Asset not found');
return;
}
if (details.type !== 'nfa') {
showMessage('error', 'Only NFAs can be avatars');
return;
}
if (!details.iconURL) {
showMessage('error', 'This NFA has no icon');
return;
}
window.userAvatar = {
scid: details.scid,
name: details.name,
iconURL: details.iconURL
};
if (typeof window.saveAvatarToStorage === 'function') {
window.saveAvatarToStorage();
}
if (typeof window.updateAvatarUI === 'function') {
window.updateAvatarUI();
}
showMessage('success', 'Avatar set');
};

document.addEventListener('click', (e) => {
if (!e.target.closest('.asset-menu-btn') && !e.target.closest('.asset-menu-dropdown')) {
document.querySelectorAll('.asset-menu-dropdown').forEach(m => m.classList.remove('show'));
}
});
