chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'fillPassword') {
    const usernameField = document.querySelector('input[type="email"], input[name*="user"], input[name*="login"], input[id*="user"], input[id*="login"]');
    const passwordField = document.querySelector('input[type="password"]');
    
    if (usernameField) {
      usernameField.value = request.username;
      usernameField.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    if (passwordField) {
      passwordField.value = request.password;
      passwordField.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
});