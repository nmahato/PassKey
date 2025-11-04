// Mobile-compatible version using localStorage instead of chrome.storage
const ENCRYPTION_KEY = 'PassKeeper-2024-SecureKey-v1.0';

// Storage wrapper for mobile compatibility
const storage = {
  get: (keys) => {
    return new Promise((resolve) => {
      const result = {};
      if (Array.isArray(keys)) {
        keys.forEach(key => {
          const value = localStorage.getItem(key);
          result[key] = value ? JSON.parse(value) : undefined;
        });
      } else {
        const value = localStorage.getItem(keys);
        result[keys] = value ? JSON.parse(value) : undefined;
      }
      resolve(result);
    });
  },
  set: (items) => {
    return new Promise((resolve) => {
      Object.keys(items).forEach(key => {
        localStorage.setItem(key, JSON.stringify(items[key]));
      });
      resolve();
    });
  }
};

// Auto-backup for mobile (using setInterval instead of chrome.alarms)
let autoBackupInterval;

function startAutoBackup() {
  if (autoBackupInterval) clearInterval(autoBackupInterval);
  autoBackupInterval = setInterval(performAutoBackup, 5 * 60 * 1000); // 5 minutes
}

function stopAutoBackup() {
  if (autoBackupInterval) {
    clearInterval(autoBackupInterval);
    autoBackupInterval = null;
  }
}

async function performAutoBackup() {
  try {
    const result = await storage.get(['passwords', 'userLoggedIn', 'autoBackupEnabled']);
    
    if (!result.autoBackupEnabled || !result.userLoggedIn || !result.passwords || result.passwords.length === 0) {
      return;
    }

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

    const backup = {
      timestamp: new Date().toISOString(),
      data: decryptedPasswords
    };

    const backups = await storage.get(['autoBackups']);
    let autoBackups = backups.autoBackups || [];
    autoBackups.push(backup);
    
    if (autoBackups.length > 10) {
      autoBackups = autoBackups.slice(-10);
    }

    await storage.set({ autoBackups });
    
  } catch (error) {
    console.error('Auto-backup failed:', error);
  }
}

// Rest of the popup.js code with chrome.storage replaced by storage wrapper
// [Include all the existing popup.js functionality here with storage wrapper]