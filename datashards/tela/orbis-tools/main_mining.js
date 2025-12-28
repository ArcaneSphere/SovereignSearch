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
let miningConfig = {
mode: 'dev',
primaryAddress: '',
secondaryAddress: '',
secondaryIsDevAddress: true,
splitRatio: 20,
batchCounter: 0,
last10Batches: [],
primaryAttempts: 0,
secondaryAttempts: 0
};
function loadMiningConfig() {
try {
const savedConfig = localStorage.getItem('miningConfig');
if (savedConfig) {
const parsed = JSON.parse(savedConfig);
miningConfig = { ...miningConfig, ...parsed };
}
const savedBatchSize = localStorage.getItem('batchSize');
const savedMiningInterval = localStorage.getItem('miningInterval');
if (savedBatchSize) {
batchSize = parseInt(savedBatchSize);
const batchInput = document.getElementById('batch-size');
if (batchInput) batchInput.value = batchSize;
}
if (savedMiningInterval) {
miningIntervalTime = parseInt(savedMiningInterval);
const intervalInput = document.getElementById('mining-interval');
if (intervalInput) intervalInput.value = miningIntervalTime;
}
updateMiningConfigUI();
} catch (error) {
console.error('Error loading mining config:', error);
}
}
function saveMiningConfigToStorage() {
try {
localStorage.setItem('miningConfig', JSON.stringify(miningConfig));
localStorage.setItem('batchSize', batchSize.toString());
localStorage.setItem('miningInterval', miningIntervalTime.toString());
} catch (error) {
console.error('Error saving mining config:', error);
}
}
function updateMiningConfigUI() {
const devRadio = document.getElementById('mode-dev');
const splitRadio = document.getElementById('mode-split');
const splitConfigSection = document.getElementById('split-config-section');
if (devRadio) devRadio.checked = (miningConfig.mode === 'dev');
if (splitRadio) splitRadio.checked = (miningConfig.mode === 'split');
if (splitConfigSection) {
splitConfigSection.style.display = (miningConfig.mode === 'split') ? 'block' : 'none';
}
const primaryAddressInput = document.getElementById('primary-address');
const secondaryAddressInput = document.getElementById('secondary-address');
const ratioSlider = document.getElementById('split-ratio');
const ratioValue = document.getElementById('ratio-value');
if (primaryAddressInput) primaryAddressInput.value = miningConfig.primaryAddress || '';
if (secondaryAddressInput) {
if (miningConfig.secondaryIsDevAddress) {
secondaryAddressInput.value = creatorAddress;
secondaryAddressInput.disabled = true;
} else {
secondaryAddressInput.value = miningConfig.secondaryAddress || '';
secondaryAddressInput.disabled = false;
}
}
if (ratioSlider) ratioSlider.value = miningConfig.splitRatio;
if (ratioValue) ratioValue.textContent = `${miningConfig.splitRatio}%`;
const secondaryDevRadio = document.getElementById('secondary-dev');
const secondaryOtherRadio = document.getElementById('secondary-other');
if (secondaryDevRadio) secondaryDevRadio.checked = miningConfig.secondaryIsDevAddress;
if (secondaryOtherRadio) secondaryOtherRadio.checked = !miningConfig.secondaryIsDevAddress;
updateMiningToDisplay();
}
window.setMiningMode = function(mode) {
miningConfig.mode = mode;
if (mode === 'split' && !miningConfig.primaryAddress && window.walletAddress) {
miningConfig.primaryAddress = window.walletAddress;
const primaryAddressInput = document.getElementById('primary-address');
if (primaryAddressInput) {
primaryAddressInput.value = window.walletAddress;
}
}
updateMiningConfigUI();
};
window.setSecondaryAddressType = function(isDevAddress) {
miningConfig.secondaryIsDevAddress = isDevAddress;
const secondaryAddressInput = document.getElementById('secondary-address');
if (secondaryAddressInput) {
if (isDevAddress) {
secondaryAddressInput.value = creatorAddress;
secondaryAddressInput.disabled = true;
miningConfig.secondaryAddress = creatorAddress;
} else {
secondaryAddressInput.disabled = false;
}
}
};
window.updatePrimaryAddress = function() {
const primaryAddressInput = document.getElementById('primary-address');
if (primaryAddressInput) {
miningConfig.primaryAddress = primaryAddressInput.value.trim();
}
};
window.updateSecondaryAddress = function() {
const secondaryAddressInput = document.getElementById('secondary-address');
if (secondaryAddressInput && !miningConfig.secondaryIsDevAddress) {
miningConfig.secondaryAddress = secondaryAddressInput.value.trim();
}
};
window.updateSplitRatio = function(value) {
miningConfig.splitRatio = parseInt(value);
const ratioValue = document.getElementById('ratio-value');
if (ratioValue) {
ratioValue.textContent = `${miningConfig.splitRatio}%`;
}
};
window.applyMiningConfig = function() {
const batchInput = document.getElementById('batch-size');
const intervalInput = document.getElementById('mining-interval');
if (batchInput) batchSize = parseInt(batchInput.value);
if (intervalInput) miningIntervalTime = parseInt(intervalInput.value);
if (miningConfig.mode === 'split') {
if (!miningConfig.primaryAddress || !miningConfig.primaryAddress.startsWith('dero1')) {
showMessage('error', 'Please enter a valid primary DERO address');
return;
}
const secondaryAddr = miningConfig.secondaryIsDevAddress ? creatorAddress : miningConfig.secondaryAddress;
if (!secondaryAddr || !secondaryAddr.startsWith('dero1')) {
showMessage('error', 'Please enter a valid secondary DERO address');
return;
}
}
saveMiningConfigToStorage();
updateMiningToDisplay();
getEpochLimits();
showMessage('success', 'Mining configuration saved successfully');
if (window.isWalletConnected) {
const startBtn = document.getElementById('start-mining-btn');
if (startBtn) startBtn.disabled = false;
}
};
window.resetMiningConfig = function() {
if (isMining) {
showResetConfirmModal();
} else {
performReset();
}
};
function showResetConfirmModal() {
const modal = document.createElement('div');
modal.className = 'mining-modal-overlay';
modal.id = 'reset-confirm-modal';
modal.innerHTML = `
<div class="mining-modal">
<div class="mining-modal-header">
<h3>⚠️ Stop Mining?</h3>
</div>
<div class="mining-modal-body">
<p>Mining is currently active. Do you want to stop mining and reset the configuration?</p>
</div>
<div class="mining-modal-footer">
<button class="btn btn-secondary" onclick="dismissResetModal()">No, Continue</button>
<button class="btn btn-danger" onclick="confirmResetAndStop()">Yes, Stop & Reset</button>
</div>
</div>
`;
document.body.appendChild(modal);
}
window.dismissResetModal = function() {
const modal = document.getElementById('reset-confirm-modal');
if (modal) {
modal.remove();
}
};
window.confirmResetAndStop = function() {
dismissResetModal();
stopMining();
performReset();
};
function performReset() {
miningConfig = {
mode: 'dev',
primaryAddress: '',
secondaryAddress: '',
secondaryIsDevAddress: true,
splitRatio: 20,
batchCounter: 0,
last10Batches: []
};
batchSize = 1000;
miningIntervalTime = 5000;
saveMiningConfigToStorage();
updateMiningConfigUI();
const batchInput = document.getElementById('batch-size');
const intervalInput = document.getElementById('mining-interval');
if (batchInput) batchInput.value = batchSize;
if (intervalInput) intervalInput.value = miningIntervalTime;
showMessage('success', 'Mining configuration reset to default');
}
function updateMiningToDisplay() {
const displayElement = document.getElementById('miningToAddress');
if (displayElement) {
let displayText = '';
if (miningConfig.mode === 'dev') {
displayText = `${creatorAddress.substring(0, 12)}...${creatorAddress.substring(creatorAddress.length - 8)}`;
} else {
const primary = miningConfig.primaryAddress || 'Not set';
const secondary = miningConfig.secondaryIsDevAddress ? creatorAddress : (miningConfig.secondaryAddress || 'Not set');
const primaryShort = primary.startsWith('dero1') ?
`${primary.substring(0, 10)}...${primary.substring(primary.length - 6)}` : primary;
const secondaryShort = secondary.startsWith('dero1') ?
`${secondary.substring(0, 10)}...${secondary.substring(secondary.length - 6)}` : secondary;
displayText = `${primaryShort} (${100-miningConfig.splitRatio}%) / ${secondaryShort} (${miningConfig.splitRatio}%)`;
}
displayElement.textContent = displayText;
displayElement.style.color = 'var(--primary-color)';
displayElement.style.fontFamily = 'monospace';
displayElement.style.fontSize = '0.9rem';
}
}
async function getEpochLimits() {
try {
maxHashesLimit = 10000;
const maxHashesElement = document.getElementById('maxHashes');
if (maxHashesElement) {
maxHashesElement.textContent = maxHashesLimit.toLocaleString();
}
} catch (error) {
}
}
async function getEpochSession() {
try {
const sessionHashesElement = document.getElementById('sessionHashes');
const sessionMiniblocksElement = document.getElementById('sessionMiniblocks');
if (sessionHashesElement) {
sessionHashesElement.textContent = miningStats.sessionHashes.toLocaleString();
sessionHashesElement.style.fontSize = '1rem';
}
if (sessionMiniblocksElement) {
sessionMiniblocksElement.textContent = miningStats.sessionMiniblocks.toLocaleString();
sessionMiniblocksElement.style.fontSize = '1rem';
}
if (miningStats.sessionHashes > 0) {
const efficiency = (miningStats.sessionMiniblocks / miningStats.sessionHashes * 100).toFixed(4);
const efficiencyElement = document.getElementById('miningEfficiency');
if (efficiencyElement) {
efficiencyElement.textContent = `${efficiency}%`;
efficiencyElement.style.fontSize = '1rem';
}
}
const totalAttemptsElement = document.getElementById('totalAttempts');
if (totalAttemptsElement) {
totalAttemptsElement.textContent = miningStats.totalAttempts.toLocaleString();
totalAttemptsElement.style.fontSize = '1rem';
}
} catch (error) {
}
}
function getTargetAddress() {
if (miningConfig.mode === 'dev') {
return creatorAddress;
}
miningConfig.batchCounter++;
const position = miningConfig.batchCounter % 10;
const secondaryBatches = Math.round(miningConfig.splitRatio / 10);
let targetAddress;
let isPrimary;
if (position > (10 - secondaryBatches) || position === 0) {
targetAddress = miningConfig.secondaryIsDevAddress ? creatorAddress : miningConfig.secondaryAddress;
isPrimary = false;
} else {
targetAddress = miningConfig.primaryAddress;
isPrimary = true;
}
miningConfig.last10Batches.push(isPrimary ? 'primary' : 'secondary');
if (miningConfig.last10Batches.length > 10) {
miningConfig.last10Batches.shift();
}
if (isPrimary) {
miningConfig.primaryAttempts++;
} else {
miningConfig.secondaryAttempts++;
}
updateDistributionDisplay();
return targetAddress;
}
function updateDistributionDisplay() {
const distributionCard = document.getElementById('split-distribution-card');
if (miningConfig.mode !== 'split' || !isMining) {
if (distributionCard) distributionCard.style.display = 'none';
return;
}
if (distributionCard) distributionCard.style.display = 'block';
const primaryCount = miningConfig.last10Batches.filter(b => b === 'primary').length;
const secondaryCount = miningConfig.last10Batches.filter(b => b === 'secondary').length;
const totalAttempts = miningConfig.primaryAttempts + miningConfig.secondaryAttempts;
const primaryCountEl = document.getElementById('primaryCount');
const secondaryCountEl = document.getElementById('secondaryCount');
if (primaryCountEl) primaryCountEl.textContent = `${miningConfig.primaryAttempts}/${totalAttempts}`;
if (secondaryCountEl) secondaryCountEl.textContent = `${miningConfig.secondaryAttempts}/${totalAttempts}`;
const primaryAddrEl = document.getElementById('primaryAddressShort');
const secondaryAddrEl = document.getElementById('secondaryAddressShort');
if (primaryAddrEl && miningConfig.primaryAddress) {
primaryAddrEl.textContent = `${miningConfig.primaryAddress.substring(0, 10)}...${miningConfig.primaryAddress.substring(miningConfig.primaryAddress.length - 6)}`;
}
if (secondaryAddrEl) {
const secAddr = miningConfig.secondaryIsDevAddress ? creatorAddress : miningConfig.secondaryAddress;
if (secAddr) {
secondaryAddrEl.textContent = `${secAddr.substring(0, 10)}...${secAddr.substring(secAddr.length - 6)}`;
}
}
const primaryBar = document.getElementById('distributionPrimaryBar');
const secondaryBar = document.getElementById('distributionSecondaryBar');
if (primaryBar) primaryBar.style.width = `${primaryCount * 10}%`;
if (secondaryBar) secondaryBar.style.width = `${secondaryCount * 10}%`;
}
async function performMiningAttempt() {
if (!window.isWalletConnected || !isMining) {

return;
}
try {
const targetAddress = getTargetAddress();
console.log('[MINING] Attempt #' + (miningStats.totalAttempts + 1) + ' to address:', targetAddress);
const startTime = Date.now();
const result = await sendRPC('AttemptEPOCHWithAddr', {
address: targetAddress,
hashes: batchSize
});
const endTime = Date.now();
const duration = endTime - startTime;

if (result) {
miningStats.sessionHashes += result.epochHashes || 0;
miningStats.totalAttempts++;
if (result.jobTemplate && result.powHash && result.epochWork && result.epochDifficulty) {

try {
const submitResult = await sendRPC('SubmitEPOCH', {
jobTemplate: result.jobTemplate,
powHash: result.powHash,
epochWork: result.epochWork,
epochDifficulty: result.epochDifficulty
});

miningStats.sessionMiniblocks++;
addMiningLog(result, 0, duration, targetAddress, '🎉 MINIBLOCK SUBMITTED!');
showMessage('success', 'Miniblock found and submitted to network!');
} catch (submitError) {
console.error('[MINING] Submit error:', submitError);
addMiningLog(result, 0, duration, targetAddress, '❌ Submit failed: ' + submitError.message);
}
}
const hashRate = duration > 0 ? ((result.epochHashes || 0) / duration) * 1000 : 0;
updateMiningDisplays(result, hashRate, duration, targetAddress);
addMiningLog(result, hashRate, duration, targetAddress);
}
} catch (error) {
console.error('[MINING] Error:', error.message);
if (error.message && error.message.includes('Timeout')) {
addMiningLog(null, 0, 0, null, 'Timeout - Mining attempt took too long');
} else if (error.message && error.message.includes('Permission not granted')) {
addMiningLog(null, 0, 0, null, 'EPOCH permissions not granted. Please approve in your wallet.');
showMessage('warning', 'Please grant EPOCH permissions in your wallet and try again.');
stopMining();
} else if (error.message && error.message.includes('invalid checksum')) {
addMiningLog(null, 0, 0, null, 'Invalid DERO address. Please configure a valid address.');
showMessage('error', 'Invalid DERO address. Please configure a valid address.');
stopMining();
} else if (error.message && error.message.includes('leaf not found')) {
addMiningLog(null, 0, 0, null, 'DERO address not found. Please check the address.');
showMessage('error', 'DERO address not found. Please check the address.');
stopMining();
} else {
addMiningLog(null, 0, 0, null, error.message);
}
}
}
function updateMiningDisplays(result, hashRate, duration, targetAddress) {
const hashRateElement = document.getElementById('currentHashRate');
const sessionHashesElement = document.getElementById('sessionHashes');
const sessionMiniblocksElement = document.getElementById('sessionMiniblocks');
const totalAttemptsElement = document.getElementById('totalAttempts');
if (hashRateElement) {
hashRateElement.textContent = `${Math.round(hashRate)} H/s`;
}
if (sessionHashesElement) {
sessionHashesElement.textContent = miningStats.sessionHashes.toLocaleString();
}
if (sessionMiniblocksElement) {
sessionMiniblocksElement.textContent = miningStats.sessionMiniblocks.toLocaleString();
}
if (totalAttemptsElement) {
totalAttemptsElement.textContent = miningStats.totalAttempts.toLocaleString();
}
if (miningStats.sessionHashes > 0) {
const efficiency = (miningStats.sessionMiniblocks / miningStats.sessionHashes * 100).toFixed(4);
const efficiencyElement = document.getElementById('miningEfficiency');
if (efficiencyElement) {
efficiencyElement.textContent = `${efficiency}%`;
}
}
const overviewStatusElement = document.getElementById('overviewMiningStatus');
const overviewHashRateElement = document.getElementById('overviewHashRate');
if (overviewStatusElement) {
overviewStatusElement.textContent = '⛏️ Active';
overviewStatusElement.style.color = 'var(--success-color)';
overviewStatusElement.style.fontSize = '2rem';
}
if (overviewHashRateElement) {
overviewHashRateElement.textContent = `${Math.round(hashRate)} H/s`;
}
}
function addMiningLog(result, hashRate, duration, targetAddress, errorMsg = null) {
const logElement = document.getElementById('mining-log');
if (!logElement) return;
const placeholder = logElement.querySelector('.placeholder');
if (placeholder) {
logElement.innerHTML = '';
}
const logEntry = document.createElement('div');
logEntry.className = 'mining-log-entry';
const timestamp = new Date().toLocaleTimeString();
if (errorMsg) {
const timeSpan = document.createElement('span');
timeSpan.className = 'log-time';
timeSpan.textContent = timestamp;
const errorSpan = document.createElement('span');
errorSpan.className = 'log-error';
errorSpan.textContent = errorMsg;
logEntry.appendChild(timeSpan);
logEntry.appendChild(errorSpan);
} else if (result) {
const hashes = result.epochHashes || 0;
const submitted = result.epochSubmitted || 0;
const icon = submitted > 0 ? '✅' : '⛏️';
const addressShort = targetAddress ?
`${targetAddress.substring(0, 10)}...${targetAddress.substring(targetAddress.length - 6)}` :
'unknown';
const timeSpan = document.createElement('span');
timeSpan.className = 'log-time';
timeSpan.textContent = timestamp;
const msgSpan = document.createElement('span');
msgSpan.className = 'log-message';
msgSpan.textContent = `${icon} ${hashes.toLocaleString()} hashes in ${duration}ms | ${Math.round(hashRate)} H/s | Submitted: ${submitted} | To: ${addressShort}`;
logEntry.appendChild(timeSpan);
logEntry.appendChild(msgSpan);
}
logElement.insertBefore(logEntry, logElement.firstChild);
while (logElement.children.length > 50) {
logElement.removeChild(logElement.lastChild);
}
}
window.startMining = async function() {
if (!window.isWalletConnected) {
showMessage('error', 'Please connect your wallet first');
return;
}
if (miningConfig.mode === 'dev') {
if (!creatorAddress || !creatorAddress.startsWith('dero1')) {
showMessage('error', 'Invalid dev address configuration');
return;
}
} else {
if (!miningConfig.primaryAddress || !miningConfig.primaryAddress.startsWith('dero1')) {
showMessage('error', 'Please configure a valid primary address');
return;
}
const secondaryAddr = miningConfig.secondaryIsDevAddress ? creatorAddress : miningConfig.secondaryAddress;
if (!secondaryAddr || !secondaryAddr.startsWith('dero1')) {
showMessage('error', 'Please configure a valid secondary address');
return;
}
}
if (isMining) {
showMessage('warning', 'Mining is already running');
return;
}
isMining = true;
miningStats.startTime = Date.now();
miningConfig.batchCounter = 0;
miningConfig.last10Batches = [];
miningConfig.primaryAttempts = 0;
miningConfig.secondaryAttempts = 0;
const statusElement = document.getElementById('miningStatus');
const startBtn = document.getElementById('start-mining-btn');
const stopBtn = document.getElementById('stop-mining-btn');
if (statusElement) {
statusElement.textContent = '⛏️ Mining Active';
statusElement.style.color = 'var(--success-color)';
}
if (startBtn) startBtn.disabled = true;
if (stopBtn) stopBtn.disabled = false;
let miningModeText = miningConfig.mode === 'dev' ?
'Dev Address' :
`Split Mode (${100-miningConfig.splitRatio}% / ${miningConfig.splitRatio}%)`;
showMessage('success', `Mining started! Mode: ${miningModeText}`);
const logElement = document.getElementById('mining-log');
if (logElement) {
const startEntry = document.createElement('div');
startEntry.className = 'mining-log-entry';
startEntry.innerHTML = `
<span class="log-time">${new Date().toLocaleTimeString()}</span>
<span class="log-message" style="color: var(--success-color);">Mining started - Mode: ${miningModeText}, Batch: ${batchSize}, Interval: ${miningIntervalTime}ms</span>
`;
logElement.insertBefore(startEntry, logElement.firstChild);
}
miningInterval = setInterval(performMiningAttempt, miningIntervalTime);
performMiningAttempt();
};
window.stopMining = function() {
if (!isMining) {
showMessage('warning', 'Mining is not running');
return;
}
isMining = false;
if (miningInterval) {
clearInterval(miningInterval);
miningInterval = null;
}
const statusElement = document.getElementById('miningStatus');
const startBtn = document.getElementById('start-mining-btn');
const stopBtn = document.getElementById('stop-mining-btn');
if (statusElement) {
statusElement.textContent = '⏸️ Stopped';
statusElement.style.color = 'var(--text-muted)';
}
if (startBtn) startBtn.disabled = false;
if (stopBtn) stopBtn.disabled = true;
const distributionCard = document.getElementById('split-distribution-card');
if (distributionCard) distributionCard.style.display = 'none';
const duration = miningStats.startTime ? Date.now() - miningStats.startTime : 0;
const durationMinutes = Math.floor(duration / 60000);
const durationSeconds = Math.floor((duration % 60000) / 1000);
const overviewStatusElement = document.getElementById('overviewMiningStatus');
const overviewHashRateElement = document.getElementById('overviewHashRate');
if (overviewStatusElement) {
overviewStatusElement.textContent = '⏸️ Inactive';
overviewStatusElement.style.color = 'var(--text-muted)';
overviewStatusElement.style.fontSize = '2.5rem';
}
if (overviewHashRateElement) {
overviewHashRateElement.textContent = '0 H/s';
}
showMessage('info', `Mining stopped after ${durationMinutes}m ${durationSeconds}s`);
const logElement = document.getElementById('mining-log');
if (logElement) {
const stopEntry = document.createElement('div');
stopEntry.className = 'mining-log-entry';
stopEntry.innerHTML = `
<span class="log-time">${new Date().toLocaleTimeString()}</span>
<span class="log-message" style="color: var(--warning-color);">Mining stopped - Duration: ${durationMinutes}m ${durationSeconds}s</span>
`;
logElement.insertBefore(stopEntry, logElement.firstChild);
}
};
function initializeMiningPage() {
loadMiningConfig();
getEpochLimits();
updateMiningToDisplay();
if (window.isWalletConnected) {
const startBtn = document.getElementById('start-mining-btn');
if (startBtn) startBtn.disabled = false;
}
}
window.addEventListener('beforeunload', function(e) {
if (isMining) {
stopMining();
}
});
document.addEventListener('DOMContentLoaded', function() {
initializeMiningPage();
});
