// Global variables
let socket = null;
let isConnected = false;
let requestId = 0;
const pendingRequests = new Map();
let nfaList = [];
let blockHeightInterval = null;

// Utility Functions
async function sha256(msg) {
  const buf = new TextEncoder().encode(msg);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function updateStatus(msg, type = 'info') {
  document.getElementById('statusText').textContent = msg;
  document.getElementById('statusDot').className = `status-dot ${type}`;
}

function updateProgress(percent, text) {
  document.getElementById('progressBar').style.width = percent + '%';
  document.getElementById('progressText').textContent = text;
}

function showMessage(type, message) {
  const errorEl = document.getElementById('lookupError');
  const successEl = document.getElementById('lookupSuccess');
  
  if (type === 'error') {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
    successEl.classList.add('hidden');
  } else {
    successEl.textContent = message;
    successEl.classList.remove('hidden');
    errorEl.classList.add('hidden');
  }
  
  setTimeout(() => {
    errorEl.classList.add('hidden');
    successEl.classList.add('hidden');
  }, 5000);
}

// Wallet Connection
window.connectWallet = async function() {
  const btn = document.getElementById('btnConnect');
  btn.disabled = true;
  btn.innerHTML = 'Connecting<span class="loading-spinner"></span>';
  updateStatus('Connecting...', 'connecting');

  socket = new WebSocket("ws://localhost:44326/xswd");

  socket.onopen = async () => {
    const appName = "NFA Gallery Viewer";
    const appId = await sha256(appName);
    
    // Get the proper URL - use href for file protocol, origin for http/https
    let appUrl;
    if (window.location.protocol === 'file:') {
      appUrl = window.location.href;
    } else {
      appUrl = window.location.origin;
    }
    
    console.log('Connecting with URL:', appUrl);
    
    socket.send(JSON.stringify({
      id: appId,
      name: appName,
      description: "View your DERO Non-Fungible Assets",
      url: appUrl
    }));
  };

  socket.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    console.log('📨 RAW MESSAGE:', e.data);
    console.log('📨 PARSED:', msg);

    if (msg.accepted === true) {
      isConnected = true;
      btn.textContent = '✓ Connected';
      btn.style.background = 'linear-gradient(135deg,#10b981 0%,#059669 100%)';
      btn.disabled = true;
      document.getElementById('btnDisconnect').classList.remove('hidden');
      updateStatus('Connected', 'connected');
      getAddress();
    } else if (msg.accepted === false || msg.rejected) {
      updateStatus('Connection rejected', 'error');
      btn.disabled = false;
      btn.textContent = 'Connect Wallet';
    } else if (msg.jsonrpc && msg.id) {
      handleRPCResponse(msg);
    }
  };

  socket.onerror = () => {
    updateStatus('Connection error', 'error');
    btn.disabled = false;
    btn.textContent = 'Connect Wallet';
  };

  socket.onclose = () => {
    isConnected = false;
    updateStatus('Disconnected', 'info');
    btn.disabled = false;
    btn.textContent = 'Connect Wallet';
    document.getElementById('btnDisconnect').classList.add('hidden');
    document.getElementById('infoCartouche').classList.add('hidden');
    document.getElementById('lookupCartouche').classList.add('hidden');
    stopBlockHeightRefresh();
  };
}

window.disconnectWallet = function() {
  if (socket) { socket.close(); socket = null; }
  isConnected = false;
  stopBlockHeightRefresh();
}

// RPC Communication
function sendRPC(method, params = {}) {
  return new Promise((resolve, reject) => {
    if (!isConnected || !socket || socket.readyState !== WebSocket.OPEN) {
      reject(new Error('Not connected'));
      return;
    }
    const id = (++requestId).toString();
    const request = { jsonrpc: "2.0", id: id, method: method };
    if (Object.keys(params).length > 0) request.params = params;
    
    console.log('📤 SENDING REQUEST:', request);
    pendingRequests.set(id, { resolve, reject, method });
    socket.send(JSON.stringify(request));
    
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        console.log('⏰ TIMEOUT for request ID:', id);
        pendingRequests.delete(id);
        reject(new Error(`Timeout: ${method}`));
      }
    }, 30000);
  });
}

function handleRPCResponse(response) {
  console.log('🔄 HANDLING RPC RESPONSE:', response);
  let normalizedId = response.id;
  if (typeof normalizedId === 'string' && normalizedId.startsWith('"') && normalizedId.endsWith('"')) {
    normalizedId = normalizedId.slice(1, -1);
    console.log('🔧 Normalized ID from', response.id, 'to', normalizedId);
  }
  
  if (normalizedId && pendingRequests.has(normalizedId)) {
    const { resolve, reject } = pendingRequests.get(normalizedId);
    pendingRequests.delete(normalizedId);
    console.log('✅ Found matching request, resolving...');
    if (response.error) {
      reject(new Error(response.error.message || 'RPC error'));
    } else {
      resolve(response.result);
    }
  }
}

// Wallet Operations
async function getDaemonEndpoint() {
  // Method 1: Try GetHeight RPC call to see if wallet provides endpoint
  try {
    const heightResult = await sendRPC('GetHeight');
    console.log('GetHeight result for daemon endpoint:', heightResult);
    
    if (heightResult && heightResult.daemon_endpoint) {
      return heightResult.daemon_endpoint;
    }
  } catch (err) {
    console.log('GetHeight failed:', err);
  }
  
  // Method 2: Try GetInfo RPC call
  try {
    const infoResult = await sendRPC('GetInfo');
    console.log('GetInfo result:', infoResult);
    
    if (infoResult && infoResult.daemon_endpoint) {
      return infoResult.daemon_endpoint;
    }
  } catch (err) {
    console.log('GetInfo failed:', err);
  }
  
  // Method 3: Use custom DERO node as fallback
  console.log('Using custom DERO node as fallback');
  return 'https://dero-node-ch4k1pu.mysrv.cloud';
}

async function getAddress() {
  try {
    updateStatus('Waiting for approval...', 'connecting');
    document.getElementById('walletNotice').classList.remove('hidden');
    const result = await sendRPC('GetAddress');
    document.getElementById('walletNotice').classList.add('hidden');
    console.log('GetAddress result:', result);
    
    document.getElementById('walletAddress').textContent = result.address;
    document.getElementById('infoCartouche').classList.remove('hidden');
    document.getElementById('lookupCartouche').classList.remove('hidden');
    
    // Automatically detect daemon endpoint
    updateStatus('Detecting daemon endpoint...', 'connecting');
    const detectedEndpoint = await getDaemonEndpoint();
    
    if (detectedEndpoint) {
      document.getElementById('daemonAddress').textContent = detectedEndpoint;
      document.getElementById('daemonRPC').value = detectedEndpoint;
      console.log('✓ Using daemon endpoint:', detectedEndpoint);
      
      if (detectedEndpoint === 'https://dero-node-ch4k1pu.mysrv.cloud') {
        // Show a note that we're using custom node
        updateStatus('Using custom DERO node', 'connected');
      } else {
        updateStatus('Ready to scan', 'connected');
      }
    } else {
      document.getElementById('daemonAddress').textContent = 'Enter manually';
      document.getElementById('daemonAddress').style.color = '#f59e0b';
      console.log('⚠️ No daemon endpoint available');
      updateStatus('Please enter daemon endpoint', 'info');
    }
    
    getBalance();
    
    // Start block height auto-refresh
    startBlockHeightRefresh();
  } catch (error) {
    document.getElementById('walletNotice').classList.add('hidden');
    console.error('Error getting address:', error);
    updateStatus('Request denied or timeout', 'error');
  }
}

async function getBalance() {
  try {
    updateStatus('Waiting for approval...', 'connecting');
    document.getElementById('walletNotice').classList.remove('hidden');
    const result = await sendRPC('GetBalance');
    document.getElementById('walletNotice').classList.add('hidden');
    const balance = (result.unlocked_balance / 100000).toFixed(5);
    document.getElementById('walletBalance').textContent = balance + ' DERO';
    updateStatus('Ready to scan', 'connected');
  } catch (error) {
    document.getElementById('walletNotice').classList.add('hidden');
    console.error('Error getting balance:', error);
    updateStatus('Request denied or timeout', 'error');
  }
}

async function getBlockHeight() {
  try {
    const result = await sendRPC('GetHeight');
    if (result && result.height) {
      document.getElementById('blockHeight').textContent = result.height.toLocaleString();
      console.log('Block height updated:', result.height);
    }
  } catch (error) {
    console.error('Error getting block height:', error);
    document.getElementById('blockHeight').textContent = 'Error';
  }
}

function startBlockHeightRefresh() {
  // Clear any existing interval
  if (blockHeightInterval) {
    clearInterval(blockHeightInterval);
  }
  
  // Get initial block height
  getBlockHeight();
  
  // Refresh every 21 seconds
  blockHeightInterval = setInterval(() => {
    getBlockHeight();
  }, 21000);
}

function stopBlockHeightRefresh() {
  if (blockHeightInterval) {
    clearInterval(blockHeightInterval);
    blockHeightInterval = null;
  }
}

// NFA Lookup
window.lookupNFA = async function() {
  const scidInput = document.getElementById('manualScid');
  const scid = scidInput.value.trim();
  const btn = document.getElementById('btnLookup');
  
  // Validate SCID
  if (!scid) {
    showMessage('error', '❌ Please enter an SCID');
    return;
  }
  
  if (!/^[0-9a-fA-F]{64}$/.test(scid)) {
    showMessage('error', '❌ Invalid SCID format (must be 64 hex characters)');
    return;
  }
  
  // Disable button and show loading
  btn.disabled = true;
  btn.innerHTML = 'Looking up<span class="loading-spinner"></span>';
  
  try {
    updateStatus('Fetching NFA data...', 'connecting');
    document.getElementById('walletNotice').classList.remove('hidden');
    
    // Get balance for this specific SCID
    const balanceResult = await sendRPC('GetBalance', { scid: scid });
    console.log('NFA Balance Result:', balanceResult);
    
    // Fetch SC variables to get metadata
    let scVars = {};
    
    // List of variables to fetch from SC storage
    const variables = [
      'nameHdr', 'descrHdr', 'typeHdr', 'iconURLHdr', 'tagsHdr',
      'collection', 'fileURL', 'coverURL'
    ];
    
    // Get the daemon RPC endpoint from user input or from wallet
    let daemonEndpoint = document.getElementById('daemonRPC').value.trim();
    
    if (!daemonEndpoint) {
      // Try to use the endpoint from the connected wallet
      const walletEndpoint = document.getElementById('daemonAddress').textContent;
      if (walletEndpoint && walletEndpoint !== 'Not connected') {
        daemonEndpoint = walletEndpoint;
      }
    }
    
    // Try direct HTTP call to daemon to get SC variables
    if (daemonEndpoint) {
      try {
        console.log('Fetching SC data from daemon:', daemonEndpoint);
        
        // Make sure endpoint has https:// or http://
        if (!daemonEndpoint.startsWith('http://') && !daemonEndpoint.startsWith('https://')) {
          daemonEndpoint = 'https://' + daemonEndpoint;
        }
        
        const response = await fetch(daemonEndpoint + '/json_rpc', {
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
        console.log('Daemon getsc full response:', JSON.stringify(data, null, 2));
        
        if (data.result) {
          // Parse stringkeys - this contains all the STORE() variables
          if (data.result.stringkeys) {
            console.log('stringkeys found:', data.result.stringkeys);
            
            // Map the stringkeys to our variables - ALWAYS decode from hex
            for (const [key, value] of Object.entries(data.result.stringkeys)) {
              if (variables.includes(key)) {
                // DERO stores strings as hex in stringkeys, so always decode
                const decodedValue = hexToString(value);
                scVars[key] = decodedValue;
                console.log(`✓ Got ${key}: "${decodedValue}" (hex: ${value})`);
              }
            }
          }
          
          // Check if there's a 'balances' field
          if (data.result.balances) {
            console.log('balances found:', data.result.balances);
            for (const [key, value] of Object.entries(data.result.balances)) {
              if (variables.includes(key) && !scVars[key]) {
                const decodedValue = typeof value === 'string' ? hexToString(value) : value;
                scVars[key] = decodedValue;
                console.log(`✓ Got ${key} from balances:`, decodedValue);
              }
            }
          }
          
          // Also check variablestring (alternative location)
          if (data.result.variablestring) {
            console.log('variablestring found:', data.result.variablestring);
            
            for (const [key, value] of Object.entries(data.result.variablestring)) {
              if (variables.includes(key) && !scVars[key]) {
                const decodedValue = hexToString(value);
                scVars[key] = decodedValue;
                console.log(`✓ Got ${key} from variablestring: "${decodedValue}"`);
              }
            }
          }
          
          // Log what we actually got
          console.log('Final decoded SC variables:', scVars);
          
        } else if (data.error) {
          console.log('Daemon returned error:', data.error);
          showMessage('error', `⚠️ Daemon error: ${data.error.message || 'Unknown error'}`);
        }
      } catch (httpErr) {
        console.log('HTTP daemon query failed:', httpErr);
        showMessage('error', '⚠️ Could not fetch metadata from daemon. Check the RPC endpoint.');
      }
    } else {
      console.log('No daemon endpoint available - metadata cannot be fetched');
      showMessage('error', '⚠️ Please enter a Daemon RPC endpoint to fetch metadata');
    }
    
    console.log('All fetched SC variables:', scVars);
    
    document.getElementById('walletNotice').classList.add('hidden');
    
    if (balanceResult && (balanceResult.balance !== undefined || balanceResult.unlocked_balance !== undefined)) {
      // Calculate balance - handle both locked and unlocked
      let totalBalance = 0;
      
      if (balanceResult.balance !== undefined && balanceResult.balance !== 0) {
        totalBalance = balanceResult.balance;
      } else if (balanceResult.unlocked_balance !== undefined && balanceResult.unlocked_balance !== 0) {
        totalBalance = balanceResult.unlocked_balance;
      }
      
      // DERO uses 5 decimal places (100000 = 1 DERO)
      const balance = totalBalance / 100000;
      
      console.log('Raw balance:', totalBalance, 'Converted:', balance);
      
      // Check if this NFA already exists in our list
      const existingIndex = nfaList.findIndex(nfa => nfa.scid === scid);
      
      const nfaData = {
        scid: scid,
        name: scVars.nameHdr || balanceResult.name || 'Unnamed NFA',
        collection: scVars.collection || balanceResult.collection || '',
        description: scVars.descrHdr || '',
        type: scVars.typeHdr || '',
        tags: scVars.tagsHdr || '',
        balance: balance,
        icon: getRandomIcon(),
        icondata: scVars.fileURL || scVars.iconURLHdr || balanceResult.icondata || '',
        fileURL: scVars.fileURL || '',
        coverURL: scVars.coverURL || ''
      };
      
      console.log('Created NFA data:', nfaData);
      
      if (existingIndex >= 0) {
        // Update existing NFA
        nfaList[existingIndex] = nfaData;
        showMessage('success', '✓ NFA updated in gallery');
      } else {
        // Add new NFA
        nfaList.push(nfaData);
        showMessage('success', '✓ NFA added to gallery');
      }
      
      // Show gallery and render
      document.getElementById('galleryContainer').classList.remove('hidden');
      renderGallery();
      
      // Refresh balance to show current balance of this SCID
      try {
        console.log('Refreshing balance for SCID:', scid);
        const refreshBalance = await sendRPC('GetBalance', { scid: scid });
        console.log('Refreshed balance:', refreshBalance);
        
        if (refreshBalance && (refreshBalance.balance !== undefined || refreshBalance.unlocked_balance !== undefined)) {
          let updatedBalance = 0;
          if (refreshBalance.balance !== undefined && refreshBalance.balance !== 0) {
            updatedBalance = refreshBalance.balance;
          } else if (refreshBalance.unlocked_balance !== undefined && refreshBalance.unlocked_balance !== 0) {
            updatedBalance = refreshBalance.unlocked_balance;
          }
          
          const balanceInDero = updatedBalance / 100000;
          console.log('Updated balance:', balanceInDero);
          
          // Update the NFA in the list with the refreshed balance
          const updateIndex = nfaList.findIndex(nfa => nfa.scid === scid);
          if (updateIndex >= 0) {
            nfaList[updateIndex].balance = balanceInDero;
            renderGallery(); // Re-render to show updated balance
          }
        }
      } catch (balanceErr) {
        console.log('Could not refresh balance:', balanceErr);
      }
      
      // Clear input
      scidInput.value = '';
      
    } else {
      showMessage('error', '❌ No balance found for this SCID or you do not own this NFA');
    }
    
    updateStatus('Ready', 'connected');
    
  } catch (error) {
    document.getElementById('walletNotice').classList.add('hidden');
    console.error('Error looking up NFA:', error);
    showMessage('error', '❌ Error: ' + error.message);
    updateStatus('Request denied or timeout', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Look Up NFA';
  }
}

// Asset Scanning
window.scanForAssets = async function() {
  document.getElementById('scanProgress').classList.remove('hidden');
  document.getElementById('galleryContainer').classList.remove('hidden');
  
  updateProgress(30, 'Fetching wallet balance...');
  
  try {
    // Try to get balance to see if we get asset entries
    const balanceResult = await sendRPC('GetBalance');
    console.log('Balance result:', balanceResult);
    
    updateProgress(100, 'Scan complete');
    
    // Unfortunately, XSWD GetBalance doesn't return asset entries
    // and there's no direct way to query Gnomon through XSWD
    setTimeout(() => {
      document.getElementById('scanProgress').classList.add('hidden');
      showEmptyState();
    }, 1000);
    
  } catch (error) {
    console.error('Error scanning:', error);
    updateProgress(100, 'Error: ' + error.message);
    setTimeout(() => {
      document.getElementById('scanProgress').classList.add('hidden');
      showEmptyState();
    }, 2000);
  }
}

// Helper Functions
function getRandomIcon() {
  const icons = ['🎨','🖼️','🎭','🎪','🎬','🎸','🎺','🎯','🎲','🎰','💎','👑','🏆','🌟','⭐','✨'];
  return icons[Math.floor(Math.random() * icons.length)];
}

function hexToString(hex) {
  // Convert hex string to regular string
  if (!hex || typeof hex !== 'string') return '';
  
  // Remove 0x prefix if present
  hex = hex.replace(/^0x/, '');
  
  // If it's an odd length, it's probably not hex
  if (hex.length % 2 !== 0) return hex;
  
  // Check if it's already a normal string (not hex)
  if (!/^[0-9a-fA-F]+$/.test(hex)) return hex;
  
  let str = '';
  try {
    for (let i = 0; i < hex.length; i += 2) {
      const charCode = parseInt(hex.substr(i, 2), 16);
      if (charCode === 0) break; // Stop at null terminator
      str += String.fromCharCode(charCode);
    }
    
    // Check if result is printable ASCII/UTF-8
    if (str && /^[\x20-\x7E\s]+$/.test(str)) {
      return str;
    }
    
    // If not printable, return original
    return hex;
  } catch (e) {
    console.log('Error decoding hex:', e);
    return hex; // Return original if decoding fails
  }
}

// Gallery Rendering
function renderGallery() {
  const grid = document.getElementById('galleryGrid');
  const empty = document.getElementById('emptyState');
  const nfaCount = document.getElementById('nfaCount');
  
  nfaCount.textContent = `${nfaList.length} NFA${nfaList.length !== 1 ? 's' : ''}`;
  
  if (nfaList.length === 0) {
    showEmptyState();
    return;
  }
  
  empty.classList.add('hidden');
  grid.innerHTML = '';
  
  nfaList.forEach((nfa, i) => {
    const card = document.createElement('div');
    card.className = 'nfa-card';
    card.style.animationDelay = `${i * 0.1}s`;
    
    let imageContent;
    if (nfa.icondata && nfa.icondata.startsWith('http')) {
      imageContent = `<img src="${nfa.icondata}" alt="${nfa.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                      <div class="placeholder" style="display:none;">${nfa.icon}</div>`;
    } else if (nfa.icondata && nfa.icondata.startsWith('data:image')) {
      imageContent = `<img src="${nfa.icondata}" alt="${nfa.name}">`;
    } else {
      imageContent = `<span class="placeholder">${nfa.icon}</span>`;
    }
    
    let detailsHTML = `
      <div class="nfa-image">${imageContent}</div>
      <div class="nfa-details">
        <div class="nfa-name">${escapeHtml(nfa.name)}</div>
        ${nfa.type ? `<span class="nfa-type">${escapeHtml(nfa.type)}</span>` : ''}
        ${nfa.collection ? `<div class="nfa-collection">📁 ${escapeHtml(nfa.collection)}</div>` : ''}
        ${nfa.description ? `<div class="nfa-description">${escapeHtml(nfa.description)}</div>` : ''}
        ${nfa.tags ? `<div class="nfa-tags">${escapeHtml(nfa.tags)}</div>` : ''}
        <div class="nfa-scid">${nfa.scid}</div>
        <div class="nfa-balance">
          <span class="nfa-balance-label">Balance:</span>
          <span class="nfa-balance-value">${nfa.balance.toFixed(5)}</span>
        </div>
    `;
    
    // Add metadata section if we have additional fields
    if (nfa.fileURL || nfa.coverURL) {
      detailsHTML += '<div class="nfa-metadata">';
      
      if (nfa.fileURL) {
        detailsHTML += `
          <div class="nfa-metadata-item">
            <span class="nfa-metadata-label">File:</span>
            <a href="${escapeHtml(nfa.fileURL)}" target="_blank" style="color:#667eea;text-decoration:none;font-size:0.85em;">🔗 View</a>
          </div>`;
      }
      
      if (nfa.coverURL && nfa.coverURL !== nfa.icondata) {
        detailsHTML += `
          <div class="nfa-metadata-item">
            <span class="nfa-metadata-label">Cover:</span>
            <a href="${escapeHtml(nfa.coverURL)}" target="_blank" style="color:#667eea;text-decoration:none;font-size:0.85em;">🔗 View</a>
          </div>`;
      }
      
      detailsHTML += '</div>';
    }
    
    detailsHTML += '</div>';
    
    card.innerHTML = detailsHTML;
    grid.appendChild(card);
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showEmptyState() {
  document.getElementById('galleryGrid').innerHTML = '';
  document.getElementById('emptyState').classList.remove('hidden');
  document.getElementById('nfaCount').textContent = '0 NFAs';
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  const scidInput = document.getElementById('manualScid');
  if (scidInput) {
    scidInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        lookupNFA();
      }
    });
  }
});

window.addEventListener('beforeunload', () => { 
  if (socket) socket.close();
  stopBlockHeightRefresh();
});