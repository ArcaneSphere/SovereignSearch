"use strict";

window.allTransactions = [];
let filteredTransactions = [];
let currentPage = 1;
let itemsPerPage = 10;
let lastTransactionCount = 0;
let currentSearchTerm = '';
let currentTypeFilter = 'all';
let dateFilterFrom = null;
let dateFilterTo = null;
window.filterByType = function(type) {

currentTypeFilter = type;
applyAllFilters();
const buttons = document.querySelectorAll('.filter-btn[data-type]');
buttons.forEach(btn => {
if (btn.dataset.type === type) {
btn.classList.add('active');
} else {
btn.classList.remove('active');
}
});
};
window.filterByDateRange = function() {
const fromInput = document.getElementById('date-from');
const toInput = document.getElementById('date-to');
if (fromInput && fromInput.value) {
dateFilterFrom = new Date(fromInput.value).getTime();
} else {
dateFilterFrom = null;
}
if (toInput && toInput.value) {
dateFilterTo = new Date(toInput.value).setHours(23, 59, 59, 999);
} else {
dateFilterTo = null;
}

applyAllFilters();
};
window.resetDateFilter = function() {
const fromInput = document.getElementById('date-from');
const toInput = document.getElementById('date-to');
if (fromInput) fromInput.value = '';
if (toInput) toInput.value = '';
dateFilterFrom = null;
dateFilterTo = null;

applyAllFilters();
};
function applyAllFilters() {

let result = [...window.allTransactions];
if (currentTypeFilter !== 'all') {
result = result.filter(tx => {
if (currentTypeFilter === 'incoming') return tx.incoming === true;
if (currentTypeFilter === 'outgoing') return tx.incoming === false && tx.coinbase !== true;
if (currentTypeFilter === 'coinbase') return tx.coinbase === true;
return true;
});

}
if (dateFilterFrom || dateFilterTo) {
result = result.filter(tx => {
if (!tx.realTimestamp) return true;
if (dateFilterFrom && tx.realTimestamp < dateFilterFrom) return false;
if (dateFilterTo && tx.realTimestamp > dateFilterTo) return false;
return true;
});

}
if (currentSearchTerm) {
result = result.filter(tx => {
const txid = (tx.txid || tx.hash || '').toLowerCase();
return txid.includes(currentSearchTerm);
});

}
filteredTransactions = result;
currentPage = 1;
displayTransactionsPage();
}
window.filterTransactions = function() {
const searchInput = document.getElementById('transaction-search');
if (!searchInput) return;
const searchTerm = searchInput.value.trim().toLowerCase();
if (searchTerm.length >= 3) {
currentSearchTerm = searchTerm;
} else {
currentSearchTerm = '';
}
applyAllFilters();
};
window.clearTransactionSearch = function() {
const searchInput = document.getElementById('transaction-search');
if (searchInput) searchInput.value = '';
currentSearchTerm = '';
applyAllFilters();
};
async function getTransactionTimestamp(tx) {
try {
if (!tx.height && !tx.topoheight) return null;
const heightToUse = tx.topoheight || tx.height;
const endpoint = `https://${deroNodeAddress}/json_rpc`;
const response = await fetch(endpoint, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
jsonrpc: '2.0',
id: '1',
method: 'getblock',
params: { height: heightToUse }
}),
signal: AbortSignal.timeout(5000)
});
if (!response.ok) return null;
const data = await response.json();
if (data.result?.block_header?.timestamp) {
return normalizeTimestamp(data.result.block_header.timestamp);
}
return null;
} catch (error) {
return null;
}
}
async function extractDeroProofsFromTransactions(transactions) {
if (!transactions || transactions.length === 0) return;
const outgoingTxs = transactions.filter(tx =>
!tx.coinbase &&
!tx.incoming &&
(tx.payloaddata || tx.payload || tx.data)
);
if (outgoingTxs.length === 0) {

return;
}

let proofCount = 0;
for (const tx of outgoingTxs) {
try {
const payloadData = tx.payloaddata || tx.payload || tx.data;
if (payloadData && typeof payloadData === 'object') {
const proofKey = Object.keys(payloadData).find(key =>
key.toLowerCase().includes('proof') ||
key.toLowerCase().includes('c') ||
payloadData[key]?.length > 50
);
if (proofKey && payloadData[proofKey]) {
tx.proof = payloadData[proofKey];
proofCount++;
console.log(`[DEROPROOF] ✓ Extracted proof from ${(tx.txid || tx.hash).substring(0, 16)}...`);
}
} else if (typeof payloadData === 'string' && payloadData.length > 50) {
tx.proof = payloadData;
proofCount++;
console.log(`[DEROPROOF] ✓ Extracted proof from ${(tx.txid || tx.hash).substring(0, 16)}...`);
}
} catch (error) {

}
}

}
window.refreshTransactions = async function() {
if (!window.isWalletConnected) {
showMessage('error', 'Wallet not connected');
return;
}
const btn = document.getElementById('refresh-txs-btn');
if (!btn) return;
btn.disabled = true;
btn.innerHTML = '<span class="loading-spinner"></span> Checking...';
try {
const result = await sendRPC('GetTransfers', {
in: true,
out: true,
coinbase: true,
pool: true
});
if (result?.entries) {
const newCount = result.entries.length;
const coinbaseTxs = result.entries.filter(tx => tx.coinbase === true);
if (newCount > lastTransactionCount) {
const newTxs = newCount - lastTransactionCount;
showMessage('success', `${newTxs} new transaction${newTxs > 1 ? 's' : ''} detected!`);
allTransactions = result.entries.sort((a, b) => (
(b.topoheight || b.height || 0) - (a.topoheight || a.height || 0)
));
filteredTransactions = allTransactions;
lastTransactionCount = newCount;
currentPage = 1;
await extractDeroProofsFromTransactions(allTransactions);
displayTransactionsPage();
updateStats();
await loadTimestampsWithProgress(allTransactions);
if (typeof window.updateTransactionPieChart === 'function') {
window.updateTransactionPieChart();
}
} else {
showMessage('info', 'No new transactions found');
}
const transactionCountElement = document.getElementById('transaction-count');
if (transactionCountElement) {
transactionCountElement.textContent = `${newCount} transactions (${coinbaseTxs.length} mining)`;
}
}
} catch (error) {
showMessage('error', 'Failed to refresh transactions');
} finally {
btn.disabled = false;
btn.textContent = '↻ Refresh';
}
};
window.rescanTransactions = async function() {
if (!window.isWalletConnected) {
showMessage('error', 'Wallet not connected');
return;
}
const btn = document.getElementById('rescan-txs-btn');
if (!btn) return;
btn.disabled = true;
btn.innerHTML = '<span class="loading-spinner"></span> Scanning...';
updateProgressBar(0, 0, 'Starting full transaction scan...');
showMessage('info', 'Starting full transaction scan including mining rewards...');
try {
const result = await sendRPC('GetTransfers', {
in: true,
out: true,
coinbase: true,
pool: true
});
if (result?.entries) {
allTransactions = result.entries.sort((a, b) => (
(b.topoheight || b.height || 0) - (a.topoheight || a.height || 0)
));
filteredTransactions = allTransactions;
lastTransactionCount = allTransactions.length;
const coinbaseTxs = allTransactions.filter(tx => tx.coinbase === true);
currentPage = 1;
displayTransactionsPage();
updateStats();
await loadTimestampsWithProgress(allTransactions);
await extractDeroProofsFromTransactions(allTransactions);
displayTransactionsPage();
if (typeof window.updateTransactionPieChart === 'function') {
window.updateTransactionPieChart();
}
showMessage('success', `Full scan complete: ${allTransactions.length} transactions (${coinbaseTxs.length} mining rewards)`);
} else {
showMessage('info', 'No transactions found');
}
const transactionCountElement = document.getElementById('transaction-count');
if (transactionCountElement) {
const coinbaseTxs = allTransactions.filter(tx => tx.coinbase === true);
transactionCountElement.textContent = `${allTransactions.length || 0} transactions (${coinbaseTxs.length} mining)`;
}
} catch (error) {
showMessage('error', 'Failed to scan transactions');
} finally {
btn.disabled = false;
btn.textContent = '🔍 Full Scan';
}
};
window.getAllTransactions = async function getAllTransactions() {
const walletNotice = document.getElementById('walletNotice');
try {
updateProgressBar(0, 0, 'Loading transactions...');
showMessage('info', 'Loading all transactions including mining rewards...');
const result = await sendRPC('GetTransfers', {
in: true,
out: true,
coinbase: true,
pool: true
});
if (walletNotice) {
walletNotice.classList.add('hidden');
}
if (result && result.entries && result.entries.length > 0) {
allTransactions = result.entries.sort((a, b) => {
const heightA = a.topoheight || a.height || 0;
const heightB = b.topoheight || b.height || 0;
return heightB - heightA;
});
filteredTransactions = allTransactions;
lastTransactionCount = allTransactions.length;
const coinbaseTxs = allTransactions.filter(tx => tx.coinbase === true);
if (coinbaseTxs.length > 0) {
}
const transactionCountElement = document.getElementById('transaction-count');
if (transactionCountElement) {
transactionCountElement.textContent = `${allTransactions.length} transactions (${coinbaseTxs.length} mining)`;
}
currentPage = 1;
displayTransactionsPage();
updateStats();
updateProgressBar(0, allTransactions.length, 'Loading timestamps...');
await loadTimestampsWithProgress(allTransactions);
await extractDeroProofsFromTransactions(allTransactions);
displayTransactionsPage();
if (typeof window.updateTransactionPieChart === 'function') {
window.updateTransactionPieChart();
}
showMessage('success', `All data loaded: ${allTransactions.length} transactions (${coinbaseTxs.length} mining rewards)`);
} else {
const transactionCountElement = document.getElementById('transaction-count');
if (transactionCountElement) {
transactionCountElement.textContent = '0 transactions';
}
updateProgressBar(0, 0, 'No transactions');
}
} catch (error) {
updateProgressBar(0, 0, 'Error loading transactions');
if (walletNotice) {
walletNotice.classList.add('hidden');
}
}
}
function updateStats() {
const totalTxElement = document.getElementById('totalTransactions');
if (totalTxElement) totalTxElement.textContent = allTransactions.length;
let totalFees = 0;
allTransactions.forEach(tx => {
const fee = tx.fees || tx.fee || 0;
totalFees += fee;
});
const totalFeesElement = document.getElementById('totalFees');
if (totalFeesElement) {
totalFeesElement.textContent = (totalFees / 100000).toFixed(5);
}
}
function updateTransactionTimestamp(globalIndex, tx) {
const timeElement = document.getElementById(`tx-time-${globalIndex}`);
if (timeElement && tx.realTimestamp) {
const txHeight = tx.topoheight || tx.height || 0;
timeElement.innerHTML = `
<div>${formatTimestamp(tx.realTimestamp)}</div>
<div style="font-size: 0.65rem; color: var(--text-muted);">Block: ${txHeight.toLocaleString()}</div>
`;
}
}
function displayTransactionsPage() {
const list = document.getElementById('recent-transactions');
const paginationTop = document.getElementById('pagination-controls-top');
const paginationBottom = document.getElementById('pagination-controls-bottom');
if (!list) return;
const transactionsToDisplay = filteredTransactions;

if (transactionsToDisplay.length === 0) {
list.innerHTML = (currentSearchTerm || currentTypeFilter !== 'all' || dateFilterFrom || dateFilterTo)
? '<p class="placeholder">No transactions match your filters</p>'
: '<p class="placeholder">No transactions to display</p>';
if (paginationTop) paginationTop.classList.add('hidden');
if (paginationBottom) paginationBottom.classList.add('hidden');
return;
}
const startIndex = (currentPage - 1) * itemsPerPage;
const endIndex = startIndex + itemsPerPage;
const pageTransactions = transactionsToDisplay.slice(startIndex, endIndex);
const totalPages = Math.ceil(transactionsToDisplay.length / itemsPerPage);
list.innerHTML = '';
pageTransactions.forEach((tx, index) => {
const txElement = document.createElement('div');
txElement.className = 'transaction-item';
const globalIndex = startIndex + index;
txElement.id = `tx-${globalIndex}`;
let type, typeLabel;
if (tx.coinbase === true) {
type = 'coinbase';
typeLabel = '⛏️ Mining Reward';
} else if (tx.incoming) {
type = 'in';
typeLabel = 'Received';
} else {
type = 'out';
typeLabel = 'Sent';
}
const txHeight = tx.topoheight || tx.height || 0;
const txHash = tx.txid || tx.hash || 'unknown';
const explorerUrl = `https://${deroNodeAddress}/tx/${txHash}`;
const fee = tx.fees || tx.fee || 0;
const feeInDero = (tx.incoming || tx.coinbase) ? '0.00000' : (fee / 100000).toFixed(5);
const proofButton = tx.proof && tx.proof.length > 0
? `<button class="btn-copy-proof" onclick="copyDeroProof('${tx.proof}', event)" title="Copy DeroProof">
📋 Copy Proof
</button>`
: '';
txElement.innerHTML = `
<div class="tx-info">
<div class="tx-type ${type}">${typeLabel}</div>
<div class="tx-hash-full">
<a href="${explorerUrl}" target="_blank" rel="noopener noreferrer" class="tx-link">${txHash}</a>
</div>
<div class="tx-time" id="tx-time-${globalIndex}">
${tx.realTimestamp ?
`<div>${formatTimestamp(tx.realTimestamp)}</div>
<div style="font-size: 0.65rem; color: var(--text-muted);">Block: ${txHeight.toLocaleString()}</div>`
:
`<div class="loading-timestamp">Loading timestamp...</div>
<div style="font-size: 0.65rem; color: var(--text-muted);">Block: ${txHeight.toLocaleString()}</div>`
}
</div>
${proofButton}
</div>
<div class="tx-amount">${(tx.amount / 100000).toFixed(5)} DERO</div>
<div class="tx-fees">Fees: ${feeInDero} DERO</div>
`;
list.appendChild(txElement);
});
const pageText = `Page ${currentPage} of ${totalPages}`;
const isPrevDisabled = currentPage === 1;
const isNextDisabled = currentPage === totalPages;
if (paginationTop) {
paginationTop.classList.remove('hidden');
const pageInfoTop = document.getElementById('page-info-top');
const prevBtnTop = document.getElementById('prev-btn-top');
const nextBtnTop = document.getElementById('next-btn-top');
if (pageInfoTop) pageInfoTop.textContent = pageText;
if (prevBtnTop) prevBtnTop.disabled = isPrevDisabled;
if (nextBtnTop) nextBtnTop.disabled = isNextDisabled;
}
if (paginationBottom) {
paginationBottom.classList.remove('hidden');
const pageInfoBottom = document.getElementById('page-info-bottom');
const prevBtnBottom = document.getElementById('prev-btn-bottom');
const nextBtnBottom = document.getElementById('next-btn-bottom');
if (pageInfoBottom) pageInfoBottom.textContent = pageText;
if (prevBtnBottom) prevBtnBottom.disabled = isPrevDisabled;
if (nextBtnBottom) nextBtnBottom.disabled = isNextDisabled;
}
}
window.changeItemsPerPage = function() {
const selectTop = document.getElementById('items-per-page-top');
const selectBottom = document.getElementById('items-per-page-bottom');
let newValue = itemsPerPage;
if (selectTop && document.activeElement === selectTop) {
newValue = parseInt(selectTop.value);
} else if (selectBottom && document.activeElement === selectBottom) {
newValue = parseInt(selectBottom.value);
} else if (selectTop) {
newValue = parseInt(selectTop.value);
}
itemsPerPage = newValue;
if (selectTop) selectTop.value = newValue.toString();
if (selectBottom) selectBottom.value = newValue.toString();
currentPage = 1;
displayTransactionsPage();
};
window.previousPage = function() {
if (currentPage > 1) {
currentPage--;
displayTransactionsPage();
}
};
window.nextPage = function() {
const transactionsToDisplay = currentSearchTerm ? filteredTransactions : allTransactions;
const totalPages = Math.ceil(transactionsToDisplay.length / itemsPerPage);
if (currentPage < totalPages) {
currentPage++;
displayTransactionsPage();
}
};
window.copyDeroProof = function(proof, event) {
if (event) {
event.preventDefault();
event.stopPropagation();
}
if (!proof || proof.length === 0) {
showMessage('error', 'No proof available for this transaction');
return;
}
navigator.clipboard.writeText(proof).then(() => {
showMessage('success', 'DeroProof copied to clipboard!');
if (event && event.target) {
const originalText = event.target.textContent;
event.target.textContent = '✅ Copied!';
event.target.style.background = 'var(--success-color)';
setTimeout(() => {
event.target.textContent = originalText;
event.target.style.background = '';
}, 2000);
}
}).catch(err => {
console.error('[COPY PROOF] Error:', err);
showMessage('error', 'Failed to copy proof to clipboard');
});
};
window.openExportModal = function() {
const modal = document.getElementById('export-modal');
if (!modal) {
return;
}
if (allTransactions.length === 0) {
showMessage('warning', 'No transactions to export');
return;
}
const fromInput = document.getElementById('export-from-date');
const toInput = document.getElementById('export-to-date');
if (fromInput && toInput) {
fromInput.value = '';
toInput.value = '';
}
updateExportSummary();
modal.style.display = 'flex';
};
window.closeExportModal = function() {
const modal = document.getElementById('export-modal');
if (modal) modal.style.display = 'none';
};
window.selectAllDates = function() {
const fromInput = document.getElementById('export-from-date');
const toInput = document.getElementById('export-to-date');
if (fromInput) fromInput.value = '';
if (toInput) toInput.value = '';
updateExportSummary();
};
window.updateExportSummary = function updateExportSummary() {
const fromInput = document.getElementById('export-from-date');
const toInput = document.getElementById('export-to-date');
const summary = document.getElementById('exportSummary');
if (!fromInput || !toInput || !summary) return;
const fromDate = fromInput.value ? new Date(fromInput.value) : null;
const toDate = toInput.value ? new Date(toInput.value + 'T23:59:59') : null;
const filteredTxs = getFilteredTransactionsForExport(fromDate, toDate);
if (fromDate && toDate) {
summary.innerHTML = `<span>${filteredTxs.length} transactions from ${fromInput.value} to ${toInput.value}</span>`;
} else if (fromDate) {
summary.innerHTML = `<span>${filteredTxs.length} transactions from ${fromInput.value}</span>`;
} else if (toDate) {
summary.innerHTML = `<span>${filteredTxs.length} transactions until ${toInput.value}</span>`;
} else {
summary.innerHTML = `<span>All ${filteredTxs.length} transactions</span>`;
}
}
function getFilteredTransactionsForExport(fromDate, toDate) {
return allTransactions.filter(tx => {
if (!tx.realTimestamp) return true;
const txDate = new Date(tx.realTimestamp);
if (fromDate && txDate < fromDate) return false;
if (toDate && txDate > toDate) return false;
return true;
});
}
window.exportTransactions = function() {
const fromInput = document.getElementById('export-from-date');
const toInput = document.getElementById('export-to-date');
const exportBtn = document.getElementById('modal-export-btn');
if (!fromInput || !toInput) return;
const fromDate = fromInput.value ? new Date(fromInput.value) : null;
const toDate = toInput.value ? new Date(toInput.value + 'T23:59:59') : null;
const filteredTxs = getFilteredTransactionsForExport(fromDate, toDate);
if (filteredTxs.length === 0) {
showMessage('warning', 'No transactions in selected date range');
return;
}
if (exportBtn) {
exportBtn.disabled = true;
exportBtn.innerHTML = '<span class="loading-spinner"></span> Exporting...';
}
const exportData = filteredTxs.map(tx => ({
type: tx.coinbase ? 'Coinbase' : (tx.incoming ? 'Incoming' : 'Outgoing'),
txid: tx.txid || tx.hash || 'unknown',
date: tx.realTimestamp ? formatTimestamp(tx.realTimestamp) : 'N/A',
block: tx.topoheight || tx.height || 0,
amount_dero: parseFloat((tx.amount / 100000).toFixed(5)),
fees_dero: parseFloat(((tx.fees || tx.fee || 0) / 100000).toFixed(5))
}));
const jsonString = JSON.stringify(exportData, null, 2);
const blob = new Blob([jsonString], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
const dateStr = new Date().toISOString().split('T')[0];
let filename = `dero_transactions_${dateStr}`;
if (fromDate && toDate) {
filename = `dero_transactions_${fromInput.value}_to_${toInput.value}`;
} else if (fromDate) {
filename = `dero_transactions_from_${fromInput.value}`;
} else if (toDate) {
filename = `dero_transactions_until_${toInput.value}`;
}
link.download = `${filename}.json`;
document.body.appendChild(link);
link.click();
document.body.removeChild(link);
URL.revokeObjectURL(url);
if (exportBtn) {
exportBtn.disabled = false;
exportBtn.textContent = '📥 Export JSON';
}
showMessage('success', `Exported ${filteredTxs.length} transactions`);
closeExportModal();
};
