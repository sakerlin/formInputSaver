document.addEventListener('DOMContentLoaded', function() {
  const dataContainer = document.getElementById('data-container');
  const clearButton = document.getElementById('clear-button');
  const blockedSitesList = document.getElementById('blocked-sites-list');

  // --- Load Saved Form Data ---
  function loadSavedForms() {
    chrome.storage.local.get(null, function(items) {
      if (chrome.runtime.lastError) { console.error(chrome.runtime.lastError); return; }
      
      dataContainer.innerHTML = ''; // Clear previous entries
      const sortedKeys = Object.keys(items).filter(k => k.startsWith('form_data_')).sort().reverse();

      if (sortedKeys.length === 0) {
        dataContainer.textContent = '尚未儲存任何資料。';
      }

      for (const key of sortedKeys) {
        const item = items[key];
        const itemDiv = document.createElement('div');
        itemDiv.className = 'data-item';

        const title = document.createElement('h2');
        const timestamp = parseInt(key.replace('form_data_', ''), 10);
        title.textContent = `儲存於: ${new Date(timestamp).toLocaleString()}`;
        
        const content = document.createElement('pre');
        content.textContent = JSON.stringify(item, null, 2);

        const fillButton = document.createElement('button');
        fillButton.textContent = '填入表單';
        fillButton.className = 'fill-button';
        fillButton.onclick = function() {
          chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "fill_form", data: item });
          });
        };

        itemDiv.appendChild(title);
        itemDiv.appendChild(content);
        itemDiv.appendChild(fillButton);
        dataContainer.appendChild(itemDiv);
      }
    });
  }

  // --- Load Blocked Sites ---
  function loadBlockedSites() {
    chrome.storage.local.get(['blockedSites'], function(result) {
      if (chrome.runtime.lastError) { console.error(chrome.runtime.lastError); return; }
      
      blockedSitesList.innerHTML = ''; // Clear previous entries
      const blockedSites = result.blockedSites || [];

      if (blockedSites.length === 0) {
        const li = document.createElement('li');
        li.textContent = '沒有已封鎖的網站。';
        blockedSitesList.appendChild(li);
      }

      for (const site of blockedSites) {
        const li = document.createElement('li');
        li.textContent = site;

        const removeButton = document.createElement('button');
        removeButton.textContent = '移除';
        removeButton.className = 'remove-blocked-site';
        removeButton.onclick = function() {
          const updatedSites = blockedSites.filter(s => s !== site);
          chrome.storage.local.set({ blockedSites: updatedSites }, function() {
            loadBlockedSites(); // Refresh the list
          });
        };
        li.appendChild(removeButton);
        blockedSitesList.appendChild(li);
      }
    });
  }

  // --- Event Listeners ---
  clearButton.addEventListener('click', function() {
    if (confirm('確定要刪除所有已儲存的表單資料嗎？')) {
      chrome.storage.local.get(null, function(items) {
        const keysToRemove = Object.keys(items).filter(k => k.startsWith('form_data_'));
        chrome.storage.local.remove(keysToRemove, function() {
          loadSavedForms();
        });
      });
    }
  });

  // --- Initial Load ---
  loadSavedForms();
  loadBlockedSites();
});