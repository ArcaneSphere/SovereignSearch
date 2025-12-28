"use strict";
function isNFTType(details) {
if (!details) {
return false;
}
if (details.raw && details.raw.stringkeys && details.raw.stringkeys.type) {
const typeHex = details.raw.stringkeys.type;
const NFT_TYPES_HEX = [
'4734352d4e4654',
'4734352d43',
'4734352d464154',
'4734352d4e414d45',
'54333435'
];
if (NFT_TYPES_HEX.includes(typeHex)) {
return true;
}
}
if (details.type === 'nft' && details.balance === 1) {
return true;
}
return false;
}
window.updateAssetScanProgress = function updateAssetScanProgress(current, total, status = null) {
const progressFill = document.getElementById('assetScanProgressFill');
const progressText = document.getElementById('assetScanProgressText');
const progressPercentage = document.getElementById('assetScanProgressPercentage');
if (!progressFill || !progressText || !progressPercentage) return;
const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
progressFill.style.width = `${percentage}%`;
progressPercentage.textContent = `${percentage}%`;
if (status) {
progressText.textContent = status;
} else if (current === total && total > 0) {
progressText.textContent = `Complete: ${total} assets loaded`;
} else {
progressText.textContent = `Loading: ${current}/${total}`;
}
};
window.refreshSingleAsset = async function refreshSingleAsset(scid) {

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
code: true,
variables: true
}
})
});
const data = await response.json();
const scData = data.result;
if (!scData) {

return;
}
let isDisplayed = false;
let finalBalance = 1;
const ownerHex = scData.stringkeys?.owner;

if (ownerHex && ownerHex !== "" && ownerHex !== null) {
try {
const hexBytes = ownerHex.match(/.{1,2}/g);
if (hexBytes) {
const ownerAddress = hexBytes.map(byte => String.fromCharCode(parseInt(byte, 16))).join('');

if (ownerAddress === window.walletAddress) {
isDisplayed = true;

} else {
finalBalance = 0;

}
}
} catch (e) {

}
} else {
isDisplayed = false;

}

const existingDetails = window.assetDetails.get(scid);
if (existingDetails) {
existingDetails.balance = finalBalance;
existingDetails.isDisplayed = isDisplayed;
existingDetails.raw = scData;
window.assetDetails.set(scid, existingDetails);

}
if (window.location.hash === '#assets') {
window.displayAssets();
} else if (window.location.hash === '#tokens') {
window.displayTokens();
}

} catch (error) {

}
};
window.loadAssetDetails = async function loadAssetDetails(scids) {

const total = scids.length;
let loaded = 0;

async function loadSingleAsset(scid) {
try {
const endpoint = `https://${window.deroNodeAddress}/json_rpc`;

const scResponse = await fetch(endpoint, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
jsonrpc: '2.0',
id: '1',
method: 'getsc',
params: {
scid: scid,
code: true,
variables: true
}
}),
signal: AbortSignal.timeout(10000)
});
if (!scResponse.ok) {
throw new Error(`HTTP ${scResponse.status}`);
}
const scDataRaw = await scResponse.json();
const scData = scDataRaw.result;
if (!scData) {
throw new Error('No scData');
}

let walletBalance = 0;
try {
const balanceResponse = await sendRPC('GetBalance', { scid: scid });
if (balanceResponse && typeof balanceResponse.balance !== 'undefined') {
walletBalance = balanceResponse.balance;
}
} catch (balanceError) {

walletBalance = 0;
}

const iconURL = extractAssetIconURL(scData);
const coverURL = extractAssetCoverURL(scData);
const fileURL = extractAssetFileURL(scData);
const typeHdr = extractAssetTypeHdr(scData);
const tags = extractAssetTags(scData);
const collection = extractAssetCollection(scData);
let isDisplayedNFT = false;

const NFT_TYPES_HEX = ['4734352d4e4654', '4734352d43', '4734352d464154', '4734352d4e414d45', '54333435'];
const isNFTType = scData.stringkeys && scData.stringkeys.type && NFT_TYPES_HEX.includes(scData.stringkeys.type);
if (isNFTType) {
const ownerHex = scData.stringkeys.owner;
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
isDisplayedNFT = true;
if (walletBalance === 0) {
walletBalance = 1;
}
}
}
}

let assetType = detectAssetType(scData);
if (walletBalance > 1 && (assetType === 'token' || assetType === 'other')) {
const hasNFTMetadata = iconURL || coverURL || fileURL || typeHdr === 'image';
if (!hasNFTMetadata) {
assetType = 'token';
}
}
return {
scid: scid,
name: extractAssetName(scData),
balance: walletBalance,
type: assetType,
typeHdr: typeHdr,
iconURL: iconURL,
coverURL: coverURL,
fileURL: fileURL,
tags: tags,
collection: collection,
isDisplayed: isDisplayedNFT,
raw: scData
};
} catch (error) {

return {
scid: scid,
name: 'Unknown Asset',
balance: 0,
type: 'token',
coverURL: null,
raw: null
};
}
}
const BATCH_SIZE = 7;
for (let i = 0; i < scids.length; i += BATCH_SIZE) {
const batch = scids.slice(i, i + BATCH_SIZE);
console.log(`[LOAD DETAILS] Loading batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(total/BATCH_SIZE)} (${batch.length} assets)`);
const results = await Promise.all(batch.map(scid => loadSingleAsset(scid)));
results.forEach((details, idx) => {
if (details) {
window.assetDetails.set(details.scid, details);
loaded++;
}
});
updateAssetScanProgress(10 + (loaded / total * 80), 100, `Loading details: ${loaded}/${total}`);
await new Promise(resolve => setTimeout(resolve, 300));
}

return loaded;
}
function hexToString(hex) {
if (!hex || typeof hex !== 'string') return null;
if (!/^[0-9a-fA-F]+$/.test(hex)) return hex;
try {
let str = '';
for (let i = 0; i < hex.length; i += 2) {
const charCode = parseInt(hex.substr(i, 2), 16);
str += String.fromCharCode(charCode);
}
return str;
} catch (e) {
return hex;
}
}
function extractAssetName(scData) {
if (!scData || !scData.stringkeys) return 'Unknown Asset';
if (Array.isArray(scData.stringkeys)) {
const nameItem = scData.stringkeys.find(item =>
item.key && item.key === 'nameHdr'
);
if (nameItem && nameItem.value) {
return hexToString(nameItem.value) || 'Asset';
}
const nameItemFallback = scData.stringkeys.find(item =>
item.key && item.key.toLowerCase().includes('name')
);
if (nameItemFallback && nameItemFallback.value) {
return hexToString(nameItemFallback.value) || 'Asset';
}
}
if (scData.stringkeys.nameHdr) {
return hexToString(scData.stringkeys.nameHdr) || 'Asset';
}
const nameKey = Object.keys(scData.stringkeys).find(key =>
key.toLowerCase().includes('name')
);
if (nameKey) {
return hexToString(scData.stringkeys[nameKey]) || 'Asset';
}
return 'Asset';
}
function extractAssetIconURL(scData) {
if (!scData || !scData.stringkeys) return null;
if (Array.isArray(scData.stringkeys)) {
const iconItem = scData.stringkeys.find(item =>
item.key && (item.key === 'iconURLHdr' || item.key === 'iconURL')
);
if (iconItem && iconItem.value) {
return hexToString(iconItem.value);
}
}
if (scData.stringkeys.iconURLHdr) {
return hexToString(scData.stringkeys.iconURLHdr);
}
if (scData.stringkeys.iconURL) {
return hexToString(scData.stringkeys.iconURL);
}
return null;
}
function extractAssetCoverURL(scData) {
if (!scData || !scData.stringkeys) return null;
if (Array.isArray(scData.stringkeys)) {
const coverItem = scData.stringkeys.find(item =>
item.key && (item.key === 'coverURL' || item.key === 'cover')
);
if (coverItem && coverItem.value) {
return hexToString(coverItem.value);
}
}
if (scData.stringkeys.coverURL) {
return hexToString(scData.stringkeys.coverURL);
}
if (scData.stringkeys.cover) {
return hexToString(scData.stringkeys.cover);
}
return null;
}
function extractAssetFileURL(scData) {
if (!scData || !scData.stringkeys) return null;
if (Array.isArray(scData.stringkeys)) {
const fileItem = scData.stringkeys.find(item =>
item.key && item.key === 'fileURL'
);
if (fileItem && fileItem.value) {
return hexToString(fileItem.value);
}
}
if (scData.stringkeys.fileURL) {
return hexToString(scData.stringkeys.fileURL);
}
return null;
}
function extractAssetCollection(scData) {
if (!scData || !scData.stringkeys) return null;
if (Array.isArray(scData.stringkeys)) {
const collectionItem = scData.stringkeys.find(item =>
item.key && item.key === 'collection'
);
if (collectionItem && collectionItem.value) {
return hexToString(collectionItem.value);
}
}
if (scData.stringkeys.collection) {
return hexToString(scData.stringkeys.collection);
}
return null;
}
function extractAssetTypeHdr(scData) {
if (!scData || !scData.stringkeys) return null;
if (Array.isArray(scData.stringkeys)) {
const typeItem = scData.stringkeys.find(item =>
item.key && item.key === 'typeHdr'
);
if (typeItem && typeItem.value) {
return hexToString(typeItem.value);
}
}
if (scData.stringkeys.typeHdr) {
return hexToString(scData.stringkeys.typeHdr);
}
return null;
}
function extractAssetTags(scData) {
if (!scData || !scData.stringkeys) return null;
if (Array.isArray(scData.stringkeys)) {
const tagsItem = scData.stringkeys.find(item =>
item.key && item.key === 'tagsHdr'
);
if (tagsItem && tagsItem.value) {
return hexToString(tagsItem.value);
}
}
if (scData.stringkeys.tagsHdr) {
return hexToString(scData.stringkeys.tagsHdr);
}
return null;
}
function extractAssetBalance(scData) {
if (!scData || !scData.balances) return 0;
if (walletAddress && scData.balances[walletAddress]) {
return scData.balances[walletAddress];
}
const addresses = Object.keys(scData.balances);
if (addresses.length > 0) {
return scData.balances[addresses[0]];
}
return 0;
}
function detectAssetType(scData) {
if (!scData) {
return 'token';
}
if (scData.stringkeys && scData.stringkeys.type) {
const typeHex = scData.stringkeys.type;
const NFT_TYPES = {
'4734352d4e4654': 'nft',
'4734352d43': 'nft',
'4734352d464154': 'nft',
'4734352d4e414d45': 'nft',
'54333435': 'nft'
};
if (NFT_TYPES[typeHex]) {

if (scData.stringkeys.maxSupply) {
const maxSupply = parseInt(scData.stringkeys.maxSupply);

if (maxSupply > 1) {

return 'token';
}
}

let code = '';
if (scData.stringkeys && scData.stringkeys.C) {
code = hexToString(scData.stringkeys.C);

const maxSupplyMatch = code.match(/maxSupply\s*=\s*(\d+)/i);
if (maxSupplyMatch) {
const maxSupply = parseInt(maxSupplyMatch[1]);

if (maxSupply > 1) {

return 'token';
}
}
}
return NFT_TYPES[typeHex];
}
}
let code = '';
if (scData.stringkeys && scData.stringkeys.C) {
code = hexToString(scData.stringkeys.C);
} else if (scData.code) {
code = scData.code;
}
if (!code) {
return 'token';
}
console.log('[DETECT TYPE] Analyzing code:', code.substring(0, 200) + '...');
const hasMultipleTransfers = code.includes('SEND_DERO_TO_ADDRESS(SIGNER(), amount)') ||
code.includes('SEND_ASSET_TO_ADDRESS') && code.includes('amount');
const hasSingleTransfer = code.includes('SEND_DERO_TO_ADDRESS(SIGNER(), 1)') ||
code.includes('SEND_ASSET_TO_ADDRESS') && code.includes(', 1');
const hasNFAKeyword = code.toLowerCase().includes('nfa');
if (hasMultipleTransfers) {

return 'token';
}
if (hasSingleTransfer) {
if (hasNFAKeyword) {

return 'nfa';
} else {

return 'nft';
}
}
const typeHdr = extractAssetTypeHdr(scData);
if (typeHdr && typeHdr.toLowerCase() === 'image') {
return 'nfa';
}
let hasUriOrMetadata = false;
if (Array.isArray(scData.stringkeys)) {
hasUriOrMetadata = scData.stringkeys.some(item =>
item.key && (
item.key.toLowerCase().includes('uri') ||
item.key.toLowerCase().includes('metadata') ||
item.key.toLowerCase().includes('iconurl') ||
item.key.toLowerCase().includes('fileurl') ||
item.key.toLowerCase().includes('coverurl')
)
);
} else if (scData.stringkeys) {
hasUriOrMetadata = Object.keys(scData.stringkeys).some(key =>
key.toLowerCase().includes('uri') ||
key.toLowerCase().includes('metadata') ||
key.toLowerCase().includes('iconurl') ||
key.toLowerCase().includes('fileurl') ||
key.toLowerCase().includes('coverurl')
);
}
if (hasUriOrMetadata) {
return 'nft';
}

return 'token';
}
window.displayAssets = function displayAssets() {

const gallery = document.getElementById('asset-gallery');
if (!gallery) {

return;
}
const assetsOnly = window.allAssets.filter(scid => {
const details = window.assetDetails.get(scid);
return details && details.type !== 'token' && details.balance > 0;
});
console.log('[DISPLAY ASSETS] Assets (non-token):', assetsOnly.length);
assetsOnly.forEach(scid => {
const details = window.assetDetails.get(scid);

});
if (assetsOnly.length === 0) {

gallery.innerHTML = '<p class="placeholder">No assets to display</p>';
const totalAssetsElement = document.getElementById('totalAssets');
if (totalAssetsElement) {
totalAssetsElement.textContent = '0';
}
const visibleElement = document.getElementById('visibleAssets');
if (visibleElement) {
visibleElement.textContent = '0';
}
return;
}

gallery.innerHTML = '';
let nfaCount = 0;
let nftCount = 0;
let otherCount = 0;
assetsOnly.forEach(scid => {
const details = window.assetDetails.get(scid) || {
scid: scid,
name: 'Unknown Asset',
balance: 0,
type: 'other'
};
if (details.type === 'nfa') nfaCount++;
else if (details.type === 'nft') nftCount++;
else otherCount++;
const assetCard = createAssetCard(details);
gallery.appendChild(assetCard);
});

const totalAssetsElement = document.getElementById('totalAssets');
if (totalAssetsElement) {
totalAssetsElement.textContent = assetsOnly.length;
}
const visibleElement = document.getElementById('visibleAssets');
if (visibleElement) {
visibleElement.textContent = assetsOnly.length;
}
filterAssetsByType();
};
window.displayTokens = function displayTokens() {

const gallery = document.getElementById('token-gallery');
if (!gallery) {

return;
}
const tokensOnly = window.allAssets.filter(scid => {
const details = window.assetDetails.get(scid);
return details && details.type === 'token' && details.balance > 0;
});

tokensOnly.forEach(scid => {
const details = window.assetDetails.get(scid);

});
if (tokensOnly.length === 0) {

gallery.innerHTML = '<p class="placeholder">No tokens to display</p>';
const totalTokensElement = document.getElementById('totalTokens');
if (totalTokensElement) {
totalTokensElement.textContent = '0';
}
return;
}
gallery.innerHTML = '';
tokensOnly.forEach(scid => {
const details = window.assetDetails.get(scid) || {
scid: scid,
name: 'Unknown Token',
balance: 0,
type: 'token'
};
const tokenCard = createAssetCard(details);
gallery.appendChild(tokenCard);
});
const totalTokensElement = document.getElementById('totalTokens');
if (totalTokensElement) {
totalTokensElement.textContent = tokensOnly.length;
}
};
function createNFTActionButtons(details) {
if (!details.raw || !details.raw.stringkeys || !details.raw.stringkeys.type) {
return '';
}
const typeHex = details.raw.stringkeys.type;
const NFT_TYPES_HEX = ['4734352d4e4654', '4734352d43', '4734352d464154', '4734352d4e414d45', '54333435'];
if (!NFT_TYPES_HEX.includes(typeHex)) {
return '';
}
const ownerHex = details.raw.stringkeys.owner;
if (!ownerHex || ownerHex === "" || ownerHex === null) {
return `
<button class="asset-display-btn" onclick="event.stopPropagation(); displayNFT('${details.scid}');">
👁️ Display
</button>
`;
} else {
let ownerAddress = '';
try {
const hexBytes = ownerHex.match(/.{1,2}/g);
if (hexBytes) {
ownerAddress = hexBytes.map(byte => String.fromCharCode(parseInt(byte, 16))).join('');
}
} catch (error) {

}
if (ownerAddress && window.walletAddress && ownerAddress === window.walletAddress) {
return `
<button class="asset-retrieve-btn" onclick="event.stopPropagation(); retrieveNFT('${details.scid}');">
📥 Retrieve
</button>
`;
}
}
return '';
}
function createAssetCard(details) {
const card = document.createElement('div');
card.className = 'asset-card';
card.dataset.type = details.type;
card.dataset.name = details.name;
card.dataset.scid = details.scid;
const icon = details.type === 'nft' ? '🖼️' : '🪙';
const explorerUrl = `https://dero-node-ch4k1pu.mysrv.cloud/tx/${details.scid}`;
let iconHTML;
if (details.iconURL) {
iconHTML = `
<div class="asset-icon asset-thumbnail" onclick="event.stopPropagation(); openAssetModal('${details.scid}');">
<img src="${details.iconURL}" alt="${details.name}" class="asset-cover-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
<span style="font-size: 4rem; z-index: 1; display: none;">${icon}</span>
</div>`;
} else {
iconHTML = `
<div class="asset-icon">
<span style="font-size: 4rem; z-index: 1;">${icon}</span>
</div>`;
}
let tagsHTML = '';
if (details.tags || details.isDisplayed || isNFTType(details)) {
const tagsList = details.tags ? details.tags.split(',').map(t => t.trim()).filter(t => t) : [];
if (details.isDisplayed) {
tagsList.unshift('📤 DISPLAYED');
} else if (isNFTType(details)) {
tagsList.unshift('📥 RETRIEVED');
}
if (tagsList.length > 0) {
tagsHTML = `
<div class="asset-tags">
${tagsList.map((tag, index) => {
const isDisplayedBadge = index === 0 && details.isDisplayed;
const isRetrievedBadge = index === 0 && !details.isDisplayed && isNFTType(details);
const badgeClass = isDisplayedBadge ? ' asset-tag-displayed' : (isRetrievedBadge ? ' asset-tag-retrieved' : '');
return `<span class="asset-tag${badgeClass}">${tag}</span>`;
}).join('')}
</div>`;
}
}
card.innerHTML = `
${typeof window.createAssetMenuHTML === 'function' ? window.createAssetMenuHTML(details) : ''}
${iconHTML}
<div class="asset-info">
<div class="asset-name">${details.name}</div>
<a href="${explorerUrl}" target="_blank" rel="noopener noreferrer" class="asset-scid asset-scid-link" title="${details.scid}" onclick="event.stopPropagation();">
${details.scid.substring(0, 8)}...${details.scid.substring(details.scid.length - 8)}
</a>
${details.typeHdr ? `
<div class="asset-detail">
<span class="asset-detail-label">Type:</span>
<span class="asset-badge ${details.type}">${details.typeHdr === 'Image' ? 'NFA' : details.typeHdr}</span>
</div>
` : `
<div class="asset-detail">
<span class="asset-detail-label">Type:</span>
<span class="asset-badge ${details.type}">${details.type.toUpperCase()}</span>
</div>
`}
<div class="asset-detail">
<span class="asset-detail-label">Balance:</span>
<span class="asset-detail-value">${formatAssetBalance(details.balance, details.typeHdr)}</span>
</div>
${tagsHTML}
</div>
<div class="asset-actions">
${createNFTActionButtons(details)}
<button class="asset-send-btn" onclick="event.stopPropagation(); sendAsset('${details.scid}');">
📤 Send
</button>
</div>
`;
return card;
}
function formatAssetBalance(balance, typeHdr) {
if (balance === 0) return '0';
if (typeHdr === 'Image' || typeHdr === 'image') {
if (balance === 1) {
return '1';
}
return balance.toString();
}
if (balance < 100000) return balance.toString();
return (balance / 100000).toFixed(5);
}
window.openAssetModal = function(scid) {
const details = window.assetDetails.get(scid);
if (!details) {
return;
}
let imageUrl = details.fileURL || details.coverURL || details.iconURL;
if (!imageUrl) {
showMessage('info', 'No image available for this asset');
return;
}
let existingModal = document.getElementById('asset-modal');
if (existingModal) {
existingModal.remove();
}
const modal = document.createElement('div');
modal.id = 'asset-modal';
modal.setAttribute('style', `
position: fixed !important;
z-index: 99999 !important;
left: 0 !important;
top: 0 !important;
right: 0 !important;
bottom: 0 !important;
width: 100vw !important;
height: 100vh !important;
background-color: rgba(0, 0, 0, 0.9) !important;
display: flex !important;
justify-content: center !important;
align-items: center !important;
overflow: auto !important;
margin: 0 !important;
padding: 0 !important;
`);
modal.innerHTML = `
<div class="asset-modal-content" style="
position: relative;
background-color: var(--card-bg);
margin: auto;
padding: 2rem;
border: 1px solid var(--border-color);
border-radius: 12px;
max-width: 90%;
max-height: 90vh;
display: flex;
flex-direction: column;
align-items: center;
gap: 1rem;
box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
">
<span class="asset-modal-close" onclick="window.closeAssetModal()" style="
position: absolute;
top: 10px;
right: 20px;
color: #fff;
font-size: 35px;
font-weight: bold;
cursor: pointer;
z-index: 100000;
">&times;</span>
<img id="asset-modal-image" src="${imageUrl}" alt="Asset File" style="
max-width: 100%;
max-height: 70vh;
object-fit: contain;
border-radius: 8px;
">
<div class="asset-modal-info" style="text-align: center; color: var(--text-primary);">
<div id="asset-modal-name" style="font-size: 1.5rem; font-weight: bold; color: var(--primary-color); margin: 0.5rem 0;">${details.name}</div>
<div id="asset-modal-collection" style="margin: 0.5rem 0; font-size: 0.95rem;">${details.collection ? `Collection: ${details.collection}` : ''}</div>
<div id="asset-modal-scid" style="font-family: 'Monaco', 'Courier New', monospace; font-size: 0.85rem; color: var(--text-muted); word-break: break-all; margin: 0.5rem 0;">SCID: ${details.scid}</div>
</div>
</div>
`;
modal.onclick = function(event) {
if (event.target === modal) {
window.closeAssetModal();
}
};
document.body.appendChild(modal);
};
window.closeAssetModal = function() {
const modal = document.getElementById('asset-modal');
if (modal) {
modal.remove();
}
};
document.addEventListener('keydown', function(event) {
if (event.key === 'Escape') {
closeAssetModal();
closeAddAssetModal();
closeImportModal();
}
});
document.addEventListener('click', function(event) {
const addModal = document.getElementById('add-asset-modal');
if (addModal && event.target === addModal) {
closeAddAssetModal();
}
const importModal = document.getElementById('import-modal');
if (importModal && event.target === importModal) {
closeImportModal();
}
});
function showAssetDetails(details) {
const explorerUrl = `https://${window.deroNodeAddress}/sc/${details.scid}`;
const message = `
Asset: ${details.name}
Type: ${details.type.toUpperCase()}
Balance: ${formatAssetBalance(details.balance, details.typeHdr)}
SCID: ${details.scid}
View on explorer:
${explorerUrl}
`;
if (confirm(message + '\n\nCopy SCID to clipboard?')) {
navigator.clipboard.writeText(details.scid).then(() => {
showMessage('success', 'SCID copied to clipboard');
}).catch(() => {
showMessage('error', 'Failed to copy SCID');
});
}
}
function openAddAssetModal() {
const modal = document.getElementById('add-asset-modal');
const input = document.getElementById('asset-scid-input');
const errorDiv = document.getElementById('add-asset-error');
if (modal) {
modal.style.display = 'flex';
if (input) input.value = '';
if (errorDiv) errorDiv.style.display = 'none';
}
}
function closeAddAssetModal() {
const modal = document.getElementById('add-asset-modal');
if (modal) {
modal.style.display = 'none';
}
}
async function addAssetToGallery() {
const input = document.getElementById('asset-scid-input');
const errorDiv = document.getElementById('add-asset-error');
const confirmBtn = document.getElementById('add-asset-confirm-btn');
if (!input || !errorDiv || !confirmBtn) return;
const scid = input.value.trim().toLowerCase();
if (!scid || scid.length !== 64 || !/^[0-9a-f]{64}$/.test(scid)) {
errorDiv.textContent = 'Invalid SCID format. Must be 64 hexadecimal characters.';
errorDiv.style.display = 'block';
return;
}
if (window.assetDetails.has(scid)) {
errorDiv.textContent = 'This asset is already in your gallery.';
errorDiv.style.display = 'block';
return;
}
confirmBtn.disabled = true;
confirmBtn.textContent = 'Loading...';
errorDiv.style.display = 'none';
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
}),
signal: AbortSignal.timeout(10000)
});
if (!response.ok) {
throw new Error(`HTTP ${response.status}`);
}
const data = await response.json();
const scData = data.result;
if (!scData || !scData.stringkeys) {
throw new Error('Asset not found or invalid');
}
const iconURL = extractAssetIconURL(scData);
const coverURL = extractAssetCoverURL(scData);
const fileURL = extractAssetFileURL(scData);
const typeHdr = extractAssetTypeHdr(scData);
const tags = extractAssetTags(scData);
const collection = extractAssetCollection(scData);
let walletBalance = 0;
try {
const balanceResponse = await sendRPC('GetBalance', { scid: scid });
if (balanceResponse && typeof balanceResponse.balance !== 'undefined') {
walletBalance = balanceResponse.balance;
}
} catch (balanceError) {
walletBalance = 0;
}
let assetType = detectAssetType(scData);
if (walletBalance > 1) {
assetType = 'token';
}
const details = {
scid: scid,
name: extractAssetName(scData),
balance: walletBalance,
type: assetType,
typeHdr: typeHdr,
iconURL: iconURL,
coverURL: coverURL,
fileURL: fileURL,
tags: tags,
collection: collection,
raw: scData
};
window.allAssets.push(scid);
window.assetDetails.set(scid, details);
if (details.type === 'token') {
displayTokens();
showMessage('success', `Token "${details.name}" added to gallery`);
} else {
displayAssets();
showMessage('success', `Asset "${details.name}" added to gallery`);
}
updateAssetCount();
closeAddAssetModal();
} catch (error) {
errorDiv.textContent = `Failed to load asset: ${error.message}`;
errorDiv.style.display = 'block';
} finally {
confirmBtn.disabled = false;
confirmBtn.innerHTML = '➕ Add Asset';
}
}
function exportAssets() {
if (assetDetails.size === 0) {
showMessage('warning', 'No assets to export. Scan assets first.');
return;
}
const assetsArray = Array.from(assetDetails.values())
.filter(asset => asset.type !== 'token')
.map(asset => ({
scid: asset.scid,
name: asset.name,
type: asset.type,
typeHdr: asset.typeHdr,
balance: asset.balance,
collection: asset.collection,
tags: asset.tags,
iconURL: asset.iconURL,
coverURL: asset.coverURL,
fileURL: asset.fileURL
}));
if (assetsArray.length === 0) {
showMessage('warning', 'No assets to export (tokens excluded).');
return;
}
const exportData = {
exportDate: new Date().toISOString(),
walletAddress: walletAddress,
totalAssets: assetsArray.length,
assets: assetsArray
};
const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `orbis-assets-${new Date().toISOString().split('T')[0]}.json`;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
showMessage('success', `Exported ${assetsArray.length} assets to JSON`);
}
function updateAssetCount() {
const countElement = document.getElementById('totalAssets');
if (countElement) {
countElement.textContent = assetDetails.size;
}
}
function resetGallery() {
const assetsOnlyCount = window.allAssets.filter(scid => {
const details = window.assetDetails.get(scid);
return details && details.type !== 'token';
}).length;
if (assetsOnlyCount === 0) {
showMessage('info', 'No assets to reset (tokens not affected)');
return;
}
if (!confirm(`Are you sure you want to reset the asset gallery?\n\nThis will remove ${assetsOnlyCount} asset${assetsOnlyCount > 1 ? 's' : ''} (tokens will not be affected).\n\nThis action cannot be undone.`)) {
return;
}
window.allAssets = window.allAssets.filter(scid => {
const details = window.assetDetails.get(scid);
if (details && details.type !== 'token') {
window.assetDetails.delete(scid);
return false;
}
return true;
});
const gallery = document.getElementById('asset-gallery');
if (gallery) {
gallery.innerHTML = '<p class="placeholder">Click "Scan Assets" to load your assets</p>';
}
const totalAssetsElement = document.getElementById('totalAssets');
if (totalAssetsElement) {
totalAssetsElement.textContent = '0';
}
const visibleAssetsElement = document.getElementById('visibleAssets');
if (visibleAssetsElement) {
visibleAssetsElement.textContent = '0';
}
closeAssetModal();
showMessage('success', `Removed ${assetsOnlyCount} asset${assetsOnlyCount > 1 ? 's' : ''} (tokens preserved)`);
}
function handleFilterCheckbox(allCheckbox) {
const checkboxes = document.querySelectorAll('.filter-checkbox');
const isChecked = allCheckbox.checked;
checkboxes.forEach(checkbox => {
if (checkbox.value !== 'all') {
checkbox.checked = isChecked;
}
});
filterAssetsByCheckboxes();
}
function filterAssetsByCheckboxes() {
const checkboxes = Array.from(document.querySelectorAll('.filter-checkbox')).filter(cb => cb.value !== 'all');
const checkedTypes = checkboxes.filter(cb => cb.checked).map(cb => cb.value);
const allCheckbox = document.querySelector('.filter-checkbox[value="all"]');
if (allCheckbox) {
const allChecked = checkboxes.every(cb => cb.checked);
allCheckbox.checked = allChecked;
}
const assetCards = document.querySelectorAll('.asset-card');
let visibleCount = 0;
assetCards.forEach(card => {
const cardType = card.dataset.type;
if (checkedTypes.includes(cardType)) {
card.style.display = 'flex';
visibleCount++;
} else {
card.style.display = 'none';
}
});
const visibleElement = document.getElementById('visibleAssets');
if (visibleElement) {
visibleElement.textContent = visibleCount;
}
}
function filterAssetsByType() {
filterAssetsByCheckboxes();
}
function filterAssets(filterType) {
filterAssetsByCheckboxes();
}
let importedData = null;
function openImportModal() {
const modal = document.getElementById('import-modal');
const input = document.getElementById('import-file-input');
const preview = document.getElementById('import-preview');
const errorDiv = document.getElementById('import-error');
const confirmBtn = document.getElementById('import-confirm-btn');
if (modal) {
modal.style.display = 'flex';
if (input) input.value = '';
if (preview) preview.style.display = 'none';
if (errorDiv) errorDiv.style.display = 'none';
if (confirmBtn) confirmBtn.disabled = true;
importedData = null;
}
}
function closeImportModal() {
const modal = document.getElementById('import-modal');
if (modal) {
modal.style.display = 'none';
}
importedData = null;
}
function handleImportFile(event) {
const file = event.target.files[0];
const errorDiv = document.getElementById('import-error');
const preview = document.getElementById('import-preview');
const previewContent = document.getElementById('import-preview-content');
const confirmBtn = document.getElementById('import-confirm-btn');
if (!file) return;
if (errorDiv) errorDiv.style.display = 'none';
if (preview) preview.style.display = 'none';
if (confirmBtn) confirmBtn.disabled = true;
importedData = null;
const reader = new FileReader();
reader.onload = function(e) {
try {
const data = JSON.parse(e.target.result);
if (!data.assets || !Array.isArray(data.assets)) {
throw new Error('Invalid file format: missing assets array');
}
importedData = data;
if (previewContent) {
previewContent.innerHTML = `
<p><strong>Export Date:</strong> ${data.exportDate ? new Date(data.exportDate).toLocaleString() : 'Unknown'}</p>
<p><strong>Wallet Address:</strong> ${data.walletAddress || 'Unknown'}</p>
<p><strong>Total Assets:</strong> ${data.assets.length}</p>
`;
}
if (preview) preview.style.display = 'block';
if (confirmBtn) confirmBtn.disabled = false;
} catch (error) {
if (errorDiv) {
errorDiv.textContent = `Error reading file: ${error.message}`;
errorDiv.style.display = 'block';
}
}
};
reader.onerror = function() {
if (errorDiv) {
errorDiv.textContent = 'Error reading file';
errorDiv.style.display = 'block';
}
};
reader.readAsText(file);
}
function confirmImport() {
if (!importedData || !importedData.assets) {
showMessage('error', 'No data to import');
return;
}
const confirmBtn = document.getElementById('import-confirm-btn');
if (confirmBtn) {
confirmBtn.disabled = true;
confirmBtn.textContent = 'Importing...';
}
try {
let imported = 0;
let skipped = 0;
importedData.assets.forEach(asset => {
if (!asset.scid) {
skipped++;
return;
}
if (window.assetDetails.has(asset.scid)) {
skipped++;
return;
}
if (asset.balance > 1 && asset.type !== 'token') {
asset.type = 'token';
}
window.allAssets.push(asset.scid);
window.assetDetails.set(asset.scid, asset);
imported++;
});
displayAssets();
displayTokens();
updateAssetCount();
closeImportModal();
showMessage('success', `Imported ${imported} item${imported > 1 ? 's' : ''}${skipped > 0 ? ` (${skipped} skipped)` : ''}`);
} catch (error) {
showMessage('error', `Failed to import: ${error.message}`);
} finally {
if (confirmBtn) {
confirmBtn.disabled = false;
confirmBtn.innerHTML = '📂 Import Assets';
}
}
}
let assetsViewMode = 'gallery';
let tokensViewMode = 'gallery';
window.changeAssetsViewMode = function(mode) {
assetsViewMode = mode;
const buttons = document.querySelectorAll('#assets-page .view-mode-btn');
buttons.forEach(btn => {
if (btn.dataset.view === mode) {
btn.classList.add('active');
} else {
btn.classList.remove('active');
}
});
const gallery = document.getElementById('asset-gallery');
if (gallery) {
if (mode === 'list') {
gallery.classList.add('list-view');
} else {
gallery.classList.remove('list-view');
}
}
displayAssets();
};
window.changeTokensViewMode = function(mode) {
tokensViewMode = mode;
const buttons = document.querySelectorAll('#tokens-page .view-mode-btn');
buttons.forEach(btn => {
if (btn.dataset.view === mode) {
btn.classList.add('active');
} else {
btn.classList.remove('active');
}
});
const gallery = document.getElementById('token-gallery');
if (gallery) {
if (mode === 'list') {
gallery.classList.add('list-view');
} else {
gallery.classList.remove('list-view');
}
}
displayTokens();
};
