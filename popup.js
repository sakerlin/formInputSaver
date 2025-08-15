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
    blocked: document.getElementById('blocked-sites-list'),
  };
  const title = document.getElementById('view-title');
  const backButton = document.getElementById('back-button');
  const settingsButton = document.getElementById('settings-button');
  const clearAllButton = document.getElementById('clear-all-data-button');
  const emptyState = document.getElementById('empty-state');

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
    const blockedSites = allData.blockedSites || [];
    lists.blocked.innerHTML = '';
    if (blockedSites.length > 0) {
      blockedSites.forEach(site => {
        const li = document.createElement('li');
        li.textContent = site;
        const removeBtn = document.createElement('button');
        removeBtn.className = 'delete-btn';
        removeBtn.textContent = '移除';
        removeBtn.onclick = () => removeBlockedSite(site);
        li.appendChild(removeBtn);
        lists.blocked.appendChild(li);
      });
    } else {
      lists.blocked.innerHTML = '<li>沒有已封鎖的網站。</li>';
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

  function removeBlockedSite(site) {
    allData.blockedSites = (allData.blockedSites || []).filter(s => s !== site);
    chrome.storage.local.set({ blockedSites: allData.blockedSites }, renderSettings);
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

  // --- Initial Load ---
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url) {
      try {
        currentHostname = new URL(tabs[0].url).hostname;
      } catch (e) { /* Ignore invalid URLs */ }
    }

    chrome.storage.local.get(['savedForms', 'blockedSites'], (result) => {
      allData = result;
      if (currentHostname && result.savedForms && result.savedForms[currentHostname]) {
        switchView('snapshots', currentHostname);
      } else {
        switchView('sites');
      }
    });
  });
});