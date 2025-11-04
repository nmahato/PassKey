document.addEventListener('DOMContentLoaded', function() {
  const saveBtn = document.getElementById('save');
  const siteInput = document.getElementById('site');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const remarkInput = document.getElementById('remark');
  const pinInput = document.getElementById('pin');
  const passwordsList = document.getElementById('passwords-list');
  const exportBtn = document.getElementById('export');
  const importBtn = document.getElementById('import');
  const importFile = document.getElementById('import-file');
  const generateBtn = document.getElementById('generate');
  const viewAllBtn = document.getElementById('view-all');
  const searchInput = document.getElementById('search');
  const menuItems = document.querySelectorAll('.menu-item');
  const pageTitle = document.getElementById('page-title');
  const menuToggle = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  
  // Menu navigation
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      switchPage(page);
      closeMobileMenu();
    });
  });
  
  // Toggle menu functionality
  if (menuToggle) {
    menuToggle.addEventListener('click', toggleMobileMenu);
  }
  
  if (overlay) {
    overlay.addEventListener('click', closeMobileMenu);
  }
  
  function toggleMobileMenu() {
    if (sidebar) {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('show');
    }
  }
  
  function closeMobileMenu() {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  }
  
  function switchPage(page) {
    // Update menu active state
    menuItems.forEach(item => item.classList.remove('active'));
    document.querySelector(`[data-page="${page}"]`).classList.add('active');
    
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    
    // Show selected page
    const targetPage = document.getElementById(`${page}-page`);
    if (targetPage) {
      targetPage.classList.add('active');
    }
    
    // Update page title
    const titles = {
      add: 'Add Password',
      view: 'View Passwords', 
      export: 'Export Data',
      import: 'Import Data',
      login: 'Login',
      register: 'Register'
    };
    pageTitle.textContent = titles[page] || 'PassKeeper';
    
    // Close mobile menu after page switch
    closeMobileMenu();
  }
  
  let showingPasswords = false;
  let allPasswords = [];
  let isLoggedIn = false;
  let showingRecords = false;

  // Encryption key (in production, this should be user-specific)
  const ENCRYPTION_KEY = 'PassKeeper-2024-SecureKey-v1.0';

  // Check login status
  checkLoginStatus();
  
  // Load auto-backups when export page is shown
  document.addEventListener('click', (e) => {
    if (e.target.dataset.page === 'export') {
      loadAutoBackups();
      loadAutoBackupSetting();
    }
  });
  
  // Auto-backup toggle handler
  document.addEventListener('change', (e) => {
    if (e.target.id === 'auto-backup-toggle') {
      toggleAutoBackup(e.target.checked);
    }
  });
  
  function checkLoginStatus() {
    chrome.storage.local.get(['userRegistered', 'userLoggedIn', 'loginTime'], function(result) {
      const loginTime = result.loginTime || 0;
      const now = Date.now();
      const sessionTimeout = 30 * 60 * 1000; // 30 minutes
      
      if (!result.userRegistered) {
        showRegistrationInterface();
      } else if (result.userLoggedIn && (now - loginTime) < sessionTimeout) {
        isLoggedIn = true;
        showMainInterface();
        loadPasswords();
      } else {
        showLoginInterface();
      }
    });
  }
  
  function showRegistrationInterface() {
    hideMenuAndSidebar();
    switchPage('register');
  }
  
  function showLoginInterface() {
    hideMenuAndSidebar();
    switchPage('login');
  }
  
  function showMainInterface() {
    showMenuAndSidebar();
    switchPage('add');
  }
  
  function hideMenuAndSidebar() {
    if (sidebar) {
      sidebar.classList.remove('show');
    }
    const menuToggle = document.querySelector('.menu-toggle');
    if (menuToggle) {
      menuToggle.classList.remove('show');
    }
    
    // Show login and register menu items
    const loginMenuItem = document.querySelector('[data-page="login"]');
    const registerMenuItem = document.querySelector('[data-page="register"]');
    if (loginMenuItem) loginMenuItem.classList.remove('hidden');
    if (registerMenuItem) registerMenuItem.classList.remove('hidden');
    
    // Hide user info and logout menu
    const userInfo = document.getElementById('user-info');
    const logoutMenu = document.getElementById('logout-menu');
    
    if (userInfo) {
      userInfo.classList.remove('show');
    }
    
    if (logoutMenu) {
      logoutMenu.style.display = 'none';
    }
  }
  
  function showMenuAndSidebar() {
    if (sidebar) {
      sidebar.classList.add('show');
    }
    const menuToggle = document.querySelector('.menu-toggle');
    if (menuToggle) {
      menuToggle.classList.add('show');
    }
    
    // Hide login and register menu items
    const loginMenuItem = document.querySelector('[data-page="login"]');
    const registerMenuItem = document.querySelector('[data-page="register"]');
    if (loginMenuItem) loginMenuItem.classList.add('hidden');
    if (registerMenuItem) registerMenuItem.classList.add('hidden');
    
    // Show user info and logout menu
    chrome.storage.local.get(['username'], function(result) {
      const userInfo = document.getElementById('user-info');
      const logoutMenu = document.getElementById('logout-menu');
      
      if (userInfo && result.username) {
        userInfo.textContent = `Welcome, ${result.username}`;
        userInfo.classList.add('show');
      }
      
      if (logoutMenu) {
        logoutMenu.style.display = 'block';
      }
    });
  }

  // Encryption functions
  async function encrypt(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)),
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      data
    );
    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv);
    result.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode(...result));
  }

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
      return encryptedText; // Return original if decryption fails (backward compatibility)
    }
  }

  // Email validation
  usernameInput.addEventListener('blur', validateEmail);
  pinInput.addEventListener('input', validatePin);
  
  function validateEmail() {
    const email = usernameInput.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = !email || emailRegex.test(email);
    
    usernameInput.classList.toggle('invalid', !isValid);
    document.getElementById('username-error').style.display = isValid ? 'none' : 'block';
    
    return isValid;
  }
  
  function validatePin() {
    const pin = pinInput.value;
    const isValid = !pin || (/^\d{4,6}$/.test(pin));
    
    pinInput.classList.toggle('invalid', !isValid);
    document.getElementById('pin-error').style.display = isValid ? 'none' : 'block';
    
    return isValid;
  }

  saveBtn.addEventListener('click', async function() {
    const site = siteInput.value.trim();
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    const remark = remarkInput.value.trim();
    const pin = pinInput.value.trim();

    // Validate inputs
    const isEmailValid = validateEmail();
    const isPinValid = validatePin();
    
    if (!isEmailValid || !isPinValid) {
      return;
    }

    if (site && username && password) {
      await savePassword(site, username, password, remark, pin);
      siteInput.value = '';
      usernameInput.value = '';
      passwordInput.value = '';
      remarkInput.value = '';
      pinInput.value = '';
      loadPasswords();
    }
  });

  exportBtn.addEventListener('click', exportPasswords);
  importBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', importPasswords);
  generateBtn.addEventListener('click', generatePassword);
  viewAllBtn.addEventListener('click', toggleViewAll);
  searchInput.addEventListener('input', filterPasswords);
  
  const logoutMenu = document.getElementById('logout-menu');
  const loginBtn = document.getElementById('login-btn');
  const registerBtn = document.getElementById('register-btn');
  
  if (logoutMenu) {
    logoutMenu.addEventListener('click', logout);
  }
  
  if (loginBtn) {
    loginBtn.addEventListener('click', handleLogin);
  }
  
  if (registerBtn) {
    registerBtn.addEventListener('click', handleRegister);
  }
  
  function logout() {
    chrome.storage.local.set({ userLoggedIn: false });
    showLoginInterface();
  }
  
  function handleLogin() {
    const loginPassword = document.getElementById('login-password');
    const loginError = document.getElementById('login-error');
    
    chrome.storage.local.get(['masterPassword'], function(result) {
      if (loginPassword.value === result.masterPassword) {
        chrome.storage.local.set({ 
          userLoggedIn: true, 
          loginTime: Date.now() 
        });
        isLoggedIn = true;
        showMainInterface();
        loadPasswords();
      } else {
        loginError.style.display = 'block';
      }
    });
  }
  
  function handleRegister() {
    const regUsername = document.getElementById('reg-username');
    const regPassword = document.getElementById('reg-password');
    const regConfirm = document.getElementById('reg-confirm');
    const regError = document.getElementById('reg-error');
    
    const username = regUsername.value.trim();
    const password = regPassword.value;
    const confirm = regConfirm.value;
    
    if (!username || !password) {
      regError.textContent = 'Please fill all fields';
      regError.style.display = 'block';
      return;
    }
    
    if (password !== confirm) {
      regError.textContent = 'Passwords do not match';
      regError.style.display = 'block';
      return;
    }
    
    if (password.length < 6) {
      regError.textContent = 'Password must be at least 6 characters';
      regError.style.display = 'block';
      return;
    }
    
    chrome.storage.local.set({ 
      userRegistered: true,
      username: username,
      masterPassword: password,
      userLoggedIn: false
    });
    
    alert('Registration successful! Please login.');
    showLoginInterface();
  }

  async function savePassword(site, username, password, remark = '', pin = '') {
    const encryptedPassword = await encrypt(password);
    const encryptedPin = pin ? await encrypt(pin) : '';
    chrome.storage.local.get(['passwords'], function(result) {
      const passwords = result.passwords || [];
      passwords.push({ site, username, password: encryptedPassword, remark, pin: encryptedPin, id: Date.now() });
      chrome.storage.local.set({ passwords });
    });
  }

  async function loadPasswords() {
    chrome.storage.local.get(['passwords'], async function(result) {
      allPasswords = result.passwords || [];
      await displayPasswords(allPasswords);
    });
  }
  
  async function displayPasswords(passwords) {
    passwordsList.innerHTML = '';
    
    if (!showingRecords) {
      passwordsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔒</div>
          <div>Click "View All" to see saved passwords</div>
        </div>
      `;
      return;
    }
    
    if (passwords.length === 0) {
      passwordsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔒</div>
          <div>No saved passwords</div>
        </div>
      `;
      return;
    }
    
    for (const item of passwords) {
      const div = document.createElement('div');
      div.className = 'password-item';
      
      let passwordDisplay = '';
      if (showingPasswords) {
        const decryptedPassword = await decrypt(item.password);
        let pinDisplay = '';
        if (item.pin) {
          const decryptedPin = await decrypt(item.pin);
          pinDisplay = `<div class="username" style="color: #f56500; font-weight: 500;">PIN: ${escapeHtml(decryptedPin)}</div>`;
        }
        passwordDisplay = `<div class="username" style="color: #d93025; font-weight: 500;">Password: ${escapeHtml(decryptedPassword)}</div>${pinDisplay}`;
      }
      
      div.innerHTML = `
        <div class="password-info">
          <div class="site-name">${escapeHtml(item.site)}</div>
          <div class="username">${escapeHtml(item.username)}</div>
          ${passwordDisplay}
          ${item.remark ? `<div class="remark">${escapeHtml(item.remark)}</div>` : ''}
        </div>
        <div class="password-actions">
          <button class="btn-icon" onclick="fillPassword('${escapeHtml(item.username)}', '${escapeHtml(item.password)}')" title="Fill password">→</button>
          <button class="btn-icon btn-delete" onclick="deletePassword(${item.id})" title="Delete">×</button>
        </div>
      `;
      passwordsList.appendChild(div);
    }
  }
  
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  window.fillPassword = async function(username, encryptedPassword) {
    const password = await decrypt(encryptedPassword);
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'fillPassword',
        username: username,
        password: password
      });
      window.close();
    });
  };

  window.deletePassword = function(id) {
    chrome.storage.local.get(['passwords'], function(result) {
      const passwords = result.passwords || [];
      const filtered = passwords.filter(p => p.id !== id);
      chrome.storage.local.set({ passwords: filtered });
      loadPasswords();
    });
  };

  async function exportPasswords() {
    chrome.storage.local.get(['passwords'], async function(result) {
      const passwords = result.passwords || [];
      const decryptedPasswords = [];
      
      for (const item of passwords) {
        const decryptedPassword = await decrypt(item.password);
        decryptedPasswords.push({
          site: item.site,
          username: item.username,
          password: decryptedPassword,
          remark: item.remark || '',
          id: item.id
        });
      }
      
      const dataStr = JSON.stringify(decryptedPasswords, null, 2);
      const dataBlob = new Blob([dataStr], {type: 'application/json'});
      const url = URL.createObjectURL(dataBlob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `passkeeper-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
    });
  }

  async function importPasswords(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function(e) {
      try {
        const importedPasswords = JSON.parse(e.target.result);
        
        for (const item of importedPasswords) {
          if (item.site && item.username && item.password) {
            await savePassword(item.site, item.username, item.password, item.remark || '');
          }
        }
        
        loadPasswords();
        alert(`Successfully imported ${importedPasswords.length} passwords!`);
      } catch (error) {
        alert('Error importing passwords. Please check the file format.');
      }
    };
    reader.readAsText(file);
    
    // Reset file input
    event.target.value = '';
  }

  function generatePassword() {
    const length = 16;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    // Ensure at least one character from each type
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
    password += '0123456789'[Math.floor(Math.random() * 10)];
    password += '!@#$%^&*'[Math.floor(Math.random() * 8)];
    
    // Fill remaining length with random characters
    for (let i = 4; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
    
    // Shuffle the password
    password = password.split('').sort(() => Math.random() - 0.5).join('');
    
    passwordInput.value = password;
    passwordInput.type = 'text';
    
    // Hide password after 3 seconds
    setTimeout(() => {
      passwordInput.type = 'password';
    }, 3000);
  }
  
  function toggleViewAll() {
    if (!showingRecords) {
      showingRecords = true;
      viewAllBtn.textContent = 'Hide All';
    } else {
      showingRecords = false;
      showingPasswords = false;
      viewAllBtn.textContent = 'View All';
    }
    filterPasswords();
  }
  
  function filterPasswords() {
    if (!showingRecords) {
      displayPasswords([]);
      return;
    }
    const searchTerm = searchInput.value.toLowerCase();
    const filtered = allPasswords.filter(item => 
      item.site.toLowerCase().includes(searchTerm) ||
      item.username.toLowerCase().includes(searchTerm) ||
      (item.remark && item.remark.toLowerCase().includes(searchTerm))
    );
    displayPasswords(filtered);
  }
  
  async function loadAutoBackupSetting() {
    const result = await chrome.storage.local.get(['autoBackupEnabled']);
    const toggle = document.getElementById('auto-backup-toggle');
    if (toggle) {
      toggle.checked = result.autoBackupEnabled !== false; // Default to true
    }
  }
  
  async function toggleAutoBackup(enabled) {
    await chrome.storage.local.set({ autoBackupEnabled: enabled });
    
    // Send message to background script
    chrome.runtime.sendMessage({ 
      action: 'toggleAutoBackup', 
      enabled: enabled 
    });
  }
  
  async function loadAutoBackups() {
    const result = await chrome.storage.local.get(['autoBackups']);
    const backups = result.autoBackups || [];
    const backupList = document.getElementById('backup-list');
    
    if (backups.length === 0) {
      backupList.innerHTML = '<p style="color: #718096;">No auto-backups yet</p>';
      return;
    }
    
    backupList.innerHTML = backups.map((backup, index) => `
      <div style="padding: 8px; border: 1px solid #e2e8f0; border-radius: 4px; margin: 4px 0; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 12px;">${new Date(backup.timestamp).toLocaleString()}</span>
        <button class="btn-secondary" onclick="restoreBackup(${index})" style="margin: 0; padding: 4px 8px;">Restore</button>
      </div>
    `).join('');
  }
  
  window.restoreBackup = async function(index) {
    const result = await chrome.storage.local.get(['autoBackups']);
    const backup = result.autoBackups[index];
    
    if (confirm('Restore this backup? Current passwords will be replaced.')) {
      // Encrypt passwords before storing
      const encryptedPasswords = [];
      for (const item of backup.data) {
        const encryptedPassword = await encrypt(item.password);
        encryptedPasswords.push({
          site: item.site,
          username: item.username,
          password: encryptedPassword,
          remark: item.remark,
          id: item.id
        });
      }
      
      await chrome.storage.local.set({ passwords: encryptedPasswords });
      loadPasswords();
      alert('Backup restored successfully!');
    }
  };
});