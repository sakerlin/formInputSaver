document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const views = {
    sites: document.getElementById('sites-list-view'),
    snapshots: document.getElementById('snapshots-list-view'),
    settings: document.getElementById('settings-view'),
  };
  const lists = {
    sites: document.getElementById('sites-list'),
    snapshots: document.getElementById('snapshots-list'),
    whitelisted: document.getElementById('whitelisted-sites-list'),
  };
  const title = document.getElementById('view-title');
  const backButton = document.getElementById('back-button');
  const settingsButton = document.getElementById('settings-button');
  const clearAllButton = document.getElementById('clear-all-data-button');
  const emptyState = document.getElementById('empty-state');
  const exportButton = document.getElementById('export-data-button');
  const importInput = document.getElementById('import-file-input');
  const addWhitelistInput = document.getElementById('add-whitelist-input');
  const addWhitelistButton = document.getElementById('add-whitelist-button');

  let currentHostname = null;
  let allData = {};

  // --- State Management ---
  function switchView(viewName, context) {
    Object.values(views).forEach(v => v.classList.add('hidden'));
    if (views[viewName]) views[viewName].classList.remove('hidden');
    backButton.classList.toggle('visible', viewName === 'snapshots' || viewName === 'settings');

    switch (viewName) {
      case 'sites':
        title.textContent = '已存資料的網站';
        renderSitesList();
        break;
      case 'snapshots':
        title.textContent = context; // context is hostname
        renderSnapshotsList(context);
        break;
      case 'settings':
        title.textContent = '設定';
        renderSettings();
        break;
    }
  }

  // --- Render Functions ---
  function renderSitesList() {
    const savedForms = allData.savedForms || {};
    const hostnames = Object.keys(savedForms);
    lists.sites.innerHTML = '';

    if (hostnames.length === 0) {
      emptyState.classList.remove('hidden');
      views.sites.classList.add('hidden');
      return;
    }
    emptyState.classList.add('hidden');

    hostnames.forEach(hostname => {
      const li = document.createElement('li');
      li.className = 'list-item';
      li.textContent = hostname;
      li.onclick = () => switchView('snapshots', hostname);
      lists.sites.appendChild(li);
    });
  }

  function renderSnapshotsList(hostname) {
    const snapshots = allData.savedForms[hostname] || [];
    lists.snapshots.innerHTML = '';
    snapshots.sort((a, b) => b.timestamp - a.timestamp); // Newest first

    snapshots.forEach(snapshot => {
      const li = document.createElement('li');
      li.className = 'list-item';
      li.innerHTML = `
        <div class="item-name">${snapshot.name}</div>
        <div class="item-timestamp">${new Date(snapshot.timestamp).toLocaleString()}</div>
        <div class="snapshot-actions">
          <button class="fill-btn">填入</button>
          <button class="delete-btn">刪除</button>
        </div>
      `;
      li.querySelector('.fill-btn').onclick = (e) => {
        e.stopPropagation();
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs.length > 0) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'fill_form', data: snapshot.data });
          }
        });
      };
      li.querySelector('.delete-btn').onclick = (e) => {
        e.stopPropagation();
        deleteSnapshot(hostname, snapshot.timestamp);
      };
      lists.snapshots.appendChild(li);
    });
  }

  function renderSettings() {
    const whitelistedSites = allData.whitelistedSites || [];
    lists.whitelisted.innerHTML = '';
    if (whitelistedSites.length > 0) {
      whitelistedSites.forEach(site => {
        const li = document.createElement('li');
        li.textContent = site;
        const removeBtn = document.createElement('button');
        removeBtn.className = 'delete-btn';
        removeBtn.textContent = '移除';
        removeBtn.onclick = () => removeWhitelistedSite(site);
        li.appendChild(removeBtn);
        lists.whitelisted.appendChild(li);
      });
    } else {
      lists.whitelisted.innerHTML = '<li>沒有已允許的網站。</li>';
    }
  }

  // --- Data Functions ---
  function deleteSnapshot(hostname, timestamp) {
    if (!confirm('確定要刪除這筆資料嗎？')) return;
    const snapshots = allData.savedForms[hostname] || [];
    allData.savedForms[hostname] = snapshots.filter(s => s.timestamp !== timestamp);
    if (allData.savedForms[hostname].length === 0) {
      delete allData.savedForms[hostname];
    }
    chrome.storage.local.set({ savedForms: allData.savedForms }, () => {
      // If no sites left, go to main view, else refresh current view
      if (Object.keys(allData.savedForms).length === 0) {
        switchView('sites');
      } else {
        renderSnapshotsList(hostname);
      }
    });
  }

  function addWhitelistedSite() {
    const site = addWhitelistInput.value.trim();
    if (site) {
      try {
        const url = new URL(`http://${site}`); // Validate as hostname
        const hostname = url.hostname;
        if (!allData.whitelistedSites.includes(hostname)) {
          allData.whitelistedSites.push(hostname);
          chrome.storage.local.set({ whitelistedSites: allData.whitelistedSites }, () => {
            addWhitelistInput.value = '';
            renderSettings();
          });
        } else {
          alert('此網站已在白名單中。');
        }
      } catch (e) {
        alert('請輸入有效的網址 (例如: example.com)。');
      }
    }
  }

  function removeWhitelistedSite(site) {
    allData.whitelistedSites = (allData.whitelistedSites || []).filter(s => s !== site);
    chrome.storage.local.set({ whitelistedSites: allData.whitelistedSites }, renderSettings);
  }

  function exportData() {
    chrome.storage.local.get(['savedForms', 'whitelistedSites'], (data) => {
      if (!data.savedForms && !data.whitelistedSites) {
        alert('沒有資料可匯出。');
        return;
      }
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `form-input-saver-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        
        if (typeof importedData !== 'object' || importedData === null) {
          throw new Error('無效的檔案格式。');
        }

        if (!confirm('確定要匯入資料嗎？匯入的資料將與現有資料合併。')) {
          return;
        }

        chrome.storage.local.get(['savedForms', 'whitelistedSites'], (existingData) => {
          const mergedForms = existingData.savedForms || {};
          const mergedWhitelisted = new Set(existingData.whitelistedSites || []);

          // Merge savedForms
          if (importedData.savedForms) {
            for (const host in importedData.savedForms) {
              if (mergedForms[host]) {
                const existingTimestamps = new Set(mergedForms[host].map(s => s.timestamp));
                const newSnapshots = importedData.savedForms[host].filter(s => !existingTimestamps.has(s.timestamp));
                mergedForms[host].push(...newSnapshots);
              } else {
                mergedForms[host] = importedData.savedForms[host];
              }
            }
          }

          // Merge whitelistedSites
          if (importedData.whitelistedSites) {
            importedData.whitelistedSites.forEach(site => mergedWhitelisted.add(site));
          }

          chrome.storage.local.set({
            savedForms: mergedForms,
            whitelistedSites: Array.from(mergedWhitelisted)
          }, () => {
            alert('資料匯入成功！');
            // Refresh all data and view
            chrome.storage.local.get(['savedForms', 'whitelistedSites'], (result) => {
              allData = result;
              switchView('settings');
            });
          });
        });

      } catch (error) {
        alert(`匯入失敗：${error.message}`);
      } finally {
        // Reset file input so the same file can be selected again
        importInput.value = '';
      }
    };
    reader.readAsText(file);
  }

  // --- Event Handlers ---
  backButton.onclick = () => switchView('sites');
  settingsButton.onclick = () => switchView('settings');
  clearAllButton.onclick = () => {
    if (confirm('確定要刪除所有儲存的表單資料嗎？此操作無法復原。')) {
      chrome.storage.local.remove('savedForms', () => {
        allData.savedForms = {};
        switchView('sites');
      });
    }
  };
  exportButton.onclick = exportData;
  importInput.onchange = importData;
  addWhitelistButton.onclick = addWhitelistedSite;
  addWhitelistInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addWhitelistedSite();
    }
  });

  // --- Initial Load ---
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url) {
      try {
        currentHostname = new URL(tabs[0].url).hostname;
      } catch (e) { /* Ignore invalid URLs */ }
    }

    chrome.storage.local.get(['savedForms', 'whitelistedSites'], (result) => {
      allData = result;
      if (currentHostname && result.savedForms && result.savedForms[currentHostname]) {
        switchView('snapshots', currentHostname);
      } else {
        switchView('sites');
      }
    });
  });
});