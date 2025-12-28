"use strict";

// ============================================
// ADDRESS VALIDATION
// ============================================

window.validateDeroAddress = async function(address, validationElementId) {
const validationElement = document.getElementById(validationElementId);
if (!address || address.length === 0) {
if (validationElement) {
validationElement.textContent = '';
validationElement.className = 'form-text';
}
return { valid: false, address: null };
}
if (validationElement) {
validationElement.textContent = '⏳ Validating...';
validationElement.className = 'form-text';
validationElement.style.color = '#888';
}
let finalAddress = address;
if (!address.startsWith('dero1') && !address.startsWith('deto1')) {
try {
const nameResult = await sendRPCDaemon('DERO.NameToAddress', {
name: address,
topoheight: -1
});
if (nameResult && nameResult.address) {
finalAddress = nameResult.address;
if (validationElement) {
validationElement.textContent = `✅ Name "${address}" → ${finalAddress.substring(0, 12)}...`;
validationElement.className = 'form-text';
validationElement.style.color = 'var(--success-color)';
}
return { valid: true, address: finalAddress, isName: true };
} else {
if (validationElement) {
validationElement.textContent = '❌ Name not found';
validationElement.className = 'form-text';
validationElement.style.color = 'var(--danger-color)';
}
return { valid: false, address: null };
}
} catch (error) {
if (validationElement) {
validationElement.textContent = '❌ Invalid address or name';
validationElement.className = 'form-text';
validationElement.style.color = 'var(--danger-color)';
}
return { valid: false, address: null };
}
}
if (finalAddress.length !== 66) {
if (validationElement) {
validationElement.textContent = `❌ Must be 66 characters (${finalAddress.length})`;
validationElement.className = 'form-text';
validationElement.style.color = 'var(--danger-color)';
}
return { valid: false, address: null };
}
try {
const balanceCheck = await sendRPCDaemon('DERO.GetEncryptedBalance', {
address: finalAddress,
topoheight: -1
});
if (balanceCheck && !balanceCheck.error) {
if (validationElement) {
validationElement.textContent = '✅ Valid registered address';
validationElement.className = 'form-text';
validationElement.style.color = 'var(--success-color)';
}
return { valid: true, address: finalAddress, isName: false };
} else {
if (validationElement) {
validationElement.textContent = '⚠️ Address not found on blockchain';
validationElement.className = 'form-text';
validationElement.style.color = 'var(--warning-color)';
}
return { valid: false, address: null };
}
} catch (error) {
if (validationElement) {
validationElement.textContent = '❌ Validation failed';
validationElement.className = 'form-text';
validationElement.style.color = 'var(--danger-color)';
}
return { valid: false, address: null };
}
};
"use strict";
let pieChartInstance = null;
window.updateTransactionPieChart = function() {
const canvas = document.getElementById('transactionPieChart');
if (!canvas) return;
const stats = calculateTransactionStats();
if (stats.total === 0) {
const ctx = canvas.getContext('2d');
ctx.clearRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = '#6C757D';
ctx.font = '14px Arial';
ctx.textAlign = 'center';
ctx.fillText('No transactions', canvas.width / 2, canvas.height / 2);
const legend = document.getElementById('pieChartLegend');
if (legend) {
legend.innerHTML = '<p style="text-align: center; color: #6C757D;">Connect wallet and load transactions</p>';
}
return;
}
drawPieChart(canvas, stats);
updatePieChartLegend(stats);
};
function calculateTransactionStats() {
if (!window.allTransactions || window.allTransactions.length === 0) {
return { incoming: 0, outgoing: 0, coinbase: 0, total: 0 };
}
let incoming = 0;
let outgoing = 0;
let coinbase = 0;
window.allTransactions.forEach(tx => {
if (tx.incoming) {
incoming++;
} else if (tx.coinbase) {
coinbase++;
} else {
outgoing++;
}
});
return {
incoming: incoming,
outgoing: outgoing,
coinbase: coinbase,
total: incoming + outgoing + coinbase
};
}
function drawPieChart(canvas, stats) {
const ctx = canvas.getContext('2d');
const centerX = canvas.width / 2;
const centerY = canvas.height / 2;
const radius = Math.min(canvas.width, canvas.height) / 2 - 20;
const colors = {
incoming: '#28A745',
outgoing: '#DC3545',
coinbase: '#FFC107'
};
const data = [
{ label: 'Incoming', value: stats.incoming, color: colors.incoming },
{ label: 'Outgoing', value: stats.outgoing, color: colors.outgoing },
{ label: 'Coinbase', value: stats.coinbase, color: colors.coinbase }
];
ctx.clearRect(0, 0, canvas.width, canvas.height);
let startAngle = -Math.PI / 2;
data.forEach((item, index) => {
if (item.value === 0) return;
const sliceAngle = (item.value / stats.total) * 2 * Math.PI;
const endAngle = startAngle + sliceAngle;
ctx.beginPath();
ctx.arc(centerX, centerY, radius, startAngle, endAngle);
ctx.lineTo(centerX, centerY);
ctx.fillStyle = item.color;
ctx.fill();
ctx.strokeStyle = '#FFFFFF';
ctx.lineWidth = 2;
ctx.stroke();
const percentage = ((item.value / stats.total) * 100).toFixed(1);
if (percentage >= 5) {
const midAngle = startAngle + sliceAngle / 2;
const textX = centerX + (radius * 0.7) * Math.cos(midAngle);
const textY = centerY + (radius * 0.7) * Math.sin(midAngle);
ctx.fillStyle = '#FFFFFF';
ctx.font = 'bold 14px Arial';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText(percentage + '%', textX, textY);
}
startAngle = endAngle;
});
addPieChartHover(canvas, data, centerX, centerY, radius, stats);
}
function addPieChartHover(canvas, data, centerX, centerY, radius, stats) {
let hoveredSegment = null;
let animationFrame = null;
canvas.onmousemove = function(e) {
const rect = canvas.getBoundingClientRect();
const mouseX = e.clientX - rect.left;
const mouseY = e.clientY - rect.top;
const dx = mouseX - centerX;
const dy = mouseY - centerY;
const distance = Math.sqrt(dx * dx + dy * dy);
if (distance > radius) {
if (hoveredSegment !== null) {
hoveredSegment = null;
if (animationFrame) cancelAnimationFrame(animationFrame);
smoothRedraw(canvas, data, centerX, centerY, radius, stats, null);
}
canvas.style.cursor = 'default';
return;
}
let angle = Math.atan2(dy, dx);
if (angle < -Math.PI / 2) {
angle += 2 * Math.PI;
}
angle += Math.PI / 2;
let startAngle = 0;
let newHoveredSegment = null;
data.forEach((item, index) => {
if (item.value === 0) return;
const sliceAngle = (item.value / stats.total) * 2 * Math.PI;
const endAngle = startAngle + sliceAngle;
if (angle >= startAngle && angle < endAngle) {
newHoveredSegment = index;
}
startAngle = endAngle;
});
if (newHoveredSegment !== hoveredSegment) {
hoveredSegment = newHoveredSegment;
canvas.style.cursor = 'pointer';
if (animationFrame) cancelAnimationFrame(animationFrame);
smoothRedraw(canvas, data, centerX, centerY, radius, stats, hoveredSegment);
}
};
canvas.onmouseleave = function() {
if (hoveredSegment !== null) {
hoveredSegment = null;
if (animationFrame) cancelAnimationFrame(animationFrame);
smoothRedraw(canvas, data, centerX, centerY, radius, stats, null);
}
canvas.style.cursor = 'default';
};
}
function smoothRedraw(canvas, data, centerX, centerY, radius, stats, hoveredSegment) {
const ctx = canvas.getContext('2d');
let progress = 0;
const duration = 200;
const startTime = performance.now();
function animate(currentTime) {
progress = Math.min((currentTime - startTime) / duration, 1);
const easeProgress = 1 - Math.pow(1 - progress, 3);
ctx.clearRect(0, 0, canvas.width, canvas.height);
let startAngle = -Math.PI / 2;
data.forEach((item, index) => {
if (item.value === 0) return;
const sliceAngle = (item.value / stats.total) * 2 * Math.PI;
const endAngle = startAngle + sliceAngle;
const isHovered = index === hoveredSegment;
const targetRadius = isHovered ? radius + 10 : radius;
const currentRadius = radius + (targetRadius - radius) * easeProgress;
const targetOffset = isHovered ? 5 : 0;
const currentOffset = targetOffset * easeProgress;
const offsetX = currentOffset * Math.cos(startAngle + sliceAngle / 2);
const offsetY = currentOffset * Math.sin(startAngle + sliceAngle / 2);
ctx.beginPath();
ctx.arc(centerX + offsetX, centerY + offsetY, currentRadius, startAngle, endAngle);
ctx.lineTo(centerX + offsetX, centerY + offsetY);
ctx.fillStyle = item.color;
ctx.fill();
ctx.strokeStyle = '#FFFFFF';
ctx.lineWidth = isHovered ? 2 + easeProgress : 2;
ctx.stroke();
const percentage = ((item.value / stats.total) * 100).toFixed(1);
if (percentage >= 5) {
const midAngle = startAngle + sliceAngle / 2;
const textX = centerX + offsetX + (currentRadius * 0.7) * Math.cos(midAngle);
const textY = centerY + offsetY + (currentRadius * 0.7) * Math.sin(midAngle);
ctx.fillStyle = '#FFFFFF';
const fontSize = isHovered ? 14 + 2 * easeProgress : 14;
ctx.font = `bold ${fontSize}px Arial`;
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
ctx.shadowBlur = isHovered ? 4 : 0;
ctx.fillText(percentage + '%', textX, textY);
ctx.shadowBlur = 0;
}
startAngle = endAngle;
});
if (hoveredSegment !== null) {
const item = data[hoveredSegment];
const percentage = ((item.value / stats.total) * 100).toFixed(1);
const tooltipAlpha = easeProgress * 0.9;
ctx.fillStyle = `rgba(0, 0, 0, ${tooltipAlpha})`;
ctx.fillRect(10, 10, 180, 50);
ctx.fillStyle = `rgba(255, 255, 255, ${easeProgress})`;
ctx.font = 'bold 14px Arial';
ctx.textAlign = 'left';
ctx.fillText(item.label, 20, 30);
ctx.font = '12px Arial';
ctx.fillText(`Count: ${item.value}`, 20, 48);
ctx.fillText(`${percentage}%`, 140, 48);
}
if (progress < 1) {
requestAnimationFrame(animate);
}
}
requestAnimationFrame(animate);
}
function updatePieChartLegend(stats) {
const legend = document.getElementById('pieChartLegend');
if (!legend) return;
const percentage = (type) => {
return ((stats[type] / stats.total) * 100).toFixed(1);
};
legend.innerHTML = `
<div class="legend-item">
<span class="legend-color" style="background-color: #28A745;"></span>
<span class="legend-label">Incoming</span>
<span class="legend-value">${stats.incoming} (${percentage('incoming')}%)</span>
</div>
<div class="legend-item">
<span class="legend-color" style="background-color: #DC3545;"></span>
<span class="legend-label">Outgoing</span>
<span class="legend-value">${stats.outgoing} (${percentage('outgoing')}%)</span>
</div>
<div class="legend-item">
<span class="legend-color" style="background-color: #FFC107;"></span>
<span class="legend-label">Coinbase</span>
<span class="legend-value">${stats.coinbase} (${percentage('coinbase')}%)</span>
</div>
<div class="legend-total">
<span class="legend-label">Total</span>
<span class="legend-value">${stats.total} transactions</span>
</div>
`;
}
document.addEventListener('DOMContentLoaded', function() {
const walletNavItem = document.querySelector('[data-page="wallet"]');
if (walletNavItem) {
walletNavItem.addEventListener('click', function() {
setTimeout(() => {
window.updateTransactionPieChart();
}, 100);
});
}
});
"use strict";
window.userAvatar = null;
window.loadAvatarFromStorage = function() {
try {
const saved = localStorage.getItem('orbisAvatar');
if (saved) {
window.userAvatar = JSON.parse(saved);
updateAvatarUI();
}
} catch (e) {

}
};
window.saveAvatarToStorage = function() {
try {
if (window.userAvatar) {
localStorage.setItem('orbisAvatar', JSON.stringify(window.userAvatar));
} else {
localStorage.removeItem('orbisAvatar');
}
} catch (e) {

}
};
window.updateAvatarUI = function() {
const avatarBox = document.getElementById('avatarBox');
const addressBox = document.getElementById('walletAddressShort');
if (!window.isWalletConnected) {
if (avatarBox) avatarBox.classList.remove('show');
if (addressBox) addressBox.classList.remove('show');
return;
}
if (avatarBox) {
avatarBox.classList.add('show');
if (window.userAvatar && window.userAvatar.iconURL) {
avatarBox.innerHTML = `<img src="${window.userAvatar.iconURL}" alt="Avatar">`;
} else {
avatarBox.innerHTML = '<div class="avatar-placeholder">Choose<br>Avatar</div>';
}
}
if (addressBox && window.walletAddress) {
const short = window.walletAddress.substring(0, 10) + '...' + window.walletAddress.substring(window.walletAddress.length - 5);
addressBox.textContent = short;
addressBox.classList.add('show');
}
};
window.openAvatarModal = function() {
if (!window.isWalletConnected) {
showMessage('error', 'Please connect wallet first');
return;
}
const modal = document.createElement('div');
modal.className = 'modal-overlay';
modal.id = 'avatarModal';
modal.innerHTML = `
<div class="modal-content" style="max-width: 700px;">
<div class="modal-header">
<h2>Choose Avatar</h2>
<button class="modal-close" onclick="closeAvatarModal()">×</button>
</div>
<div class="modal-body">
<button class="btn-primary" onclick="scanForAvatars()" id="scanAvatarBtn" style="margin-bottom: 1rem;">
🔍 Scan Assets
</button>
<div id="avatarGallery" class="avatar-gallery">
<p class="placeholder">Click "Scan Assets" to find your NFAs</p>
</div>
</div>
</div>
`;
document.body.appendChild(modal);
};
window.closeAvatarModal = function() {
const modal = document.getElementById('avatarModal');
if (modal) modal.remove();
};
window.scanForAvatars = async function() {
const btn = document.getElementById('scanAvatarBtn');
const gallery = document.getElementById('avatarGallery');
if (!btn || !gallery) return;
btn.disabled = true;
btn.innerHTML = '<span class="loading-spinner"></span> Scanning...';
gallery.innerHTML = '<div class="asset-loading"><div class="asset-loading-spinner"></div></div>';
try {
if (!window.allAssets || window.allAssets.length === 0) {
await window.scanAssets();
}
const nfas = [];
for (const scid of window.allAssets) {
const details = window.assetDetails.get(scid);
if (details && details.type === 'nfa' && details.iconURL && details.balance > 0) {
nfas.push(details);
}
}
if (nfas.length === 0) {
gallery.innerHTML = '<p class="placeholder">Nothing to show here</p>';
} else {
gallery.innerHTML = '';
nfas.forEach(nfa => {
const card = document.createElement('div');
card.className = 'avatar-nfa-card';
card.innerHTML = `
<img src="${nfa.iconURL}" alt="${nfa.name}">
<div class="nfa-name">${nfa.name || 'Unnamed'}</div>
`;
card.onclick = () => selectAvatar(nfa);
gallery.appendChild(card);
});
}
showMessage('success', `Found ${nfas.length} NFA${nfas.length !== 1 ? 's' : ''}`);
} catch (error) {
gallery.innerHTML = '<p class="placeholder">Error scanning assets</p>';
showMessage('error', 'Scan failed: ' + error.message);
} finally {
btn.disabled = false;
btn.innerHTML = '🔍 Scan Assets';
}
};
function selectAvatar(nfa) {
window.userAvatar = {
scid: nfa.scid,
name: nfa.name,
iconURL: nfa.iconURL
};
saveAvatarToStorage();
updateAvatarUI();
closeAvatarModal();
showMessage('success', 'Avatar set successfully');
}
window.exportSettings = function() {
const settings = {
avatar: window.userAvatar,
exportDate: new Date().toISOString(),
version: '1.0'
};
const json = JSON.stringify(settings, null, 2);
const blob = new Blob([json], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `orbis-settings-${Date.now()}.json`;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
showMessage('success', 'Settings exported');
};
window.importSettings = function() {
const input = document.createElement('input');
input.type = 'file';
input.accept = '.json';
input.onchange = async (e) => {
try {
const file = e.target.files[0];
if (!file) return;
const text = await file.text();
const settings = JSON.parse(text);
if (settings.avatar) {
window.userAvatar = settings.avatar;
saveAvatarToStorage();
updateAvatarUI();
showMessage('success', 'Settings imported');
} else {
showMessage('warning', 'No avatar found in file');
}
} catch (error) {
showMessage('error', 'Import failed: ' + error.message);
}
};
input.click();
};
