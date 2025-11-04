// Auto-backup functionality
chrome.runtime.onInstalled.addListener(() => {
  // Set default auto-backup enabled
  chrome.storage.local.set({ autoBackupEnabled: true });
  // Create alarm for auto-backup every 5 minutes
  chrome.alarms.create('autoBackup', { periodInMinutes: 5 });
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleAutoBackup') {
    if (message.enabled) {
      chrome.alarms.create('autoBackup', { periodInMinutes: 5 });
    } else {
      chrome.alarms.clear('autoBackup');
    }
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'autoBackup') {
    performAutoBackup();
  }
});

async function performAutoBackup() {
  try {
    const result = await chrome.storage.local.get(['passwords', 'userLoggedIn', 'autoBackupEnabled']);
    
    // Only backup if enabled, user is logged in and has passwords
    if (!result.autoBackupEnabled || !result.userLoggedIn || !result.passwords || result.passwords.length === 0) {
      return;
    }

    // Decrypt passwords for backup
    const decryptedPasswords = [];
    for (const item of result.passwords) {
      const decryptedPassword = await decrypt(item.password);
      decryptedPasswords.push({
        site: item.site,
        username: item.username,
        password: decryptedPassword,
        remark: item.remark || '',
        id: item.id
      });
    }

    // Store backup with timestamp
    const backup = {
      timestamp: new Date().toISOString(),
      data: decryptedPasswords
    };

    // Keep only last 10 backups
    const backups = await chrome.storage.local.get(['autoBackups']);
    let autoBackups = backups.autoBackups || [];
    autoBackups.push(backup);
    
    if (autoBackups.length > 10) {
      autoBackups = autoBackups.slice(-10);
    }

    await chrome.storage.local.set({ autoBackups });
    
  } catch (error) {
    console.error('Auto-backup failed:', error);
  }
}

// Encryption functions (same as popup.js)
const ENCRYPTION_KEY = 'PassKeeper-2024-SecureKey-v1.0';

async function decrypt(encryptedText) {
  try {
    const data = new Uint8Array(atob(encryptedText).split('').map(c => c.charCodeAt(0)));
    const iv = data.slice(0, 12);
    const encrypted = data.slice(12);
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encrypted
    );
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    return encryptedText;
  }
}