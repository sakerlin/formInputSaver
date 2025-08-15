document.addEventListener('DOMContentLoaded', function() {
  const dataContainer = document.getElementById('data-container');
  const clearButton = document.getElementById('clear-button');

  // Load saved data
  chrome.storage.local.get(null, function(items) {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      return;
    }

    const sortedKeys = Object.keys(items).sort().reverse(); // Show newest first

    if (sortedKeys.length === 0) {
        dataContainer.textContent = 'No data saved yet.';
    }

    for (const key of sortedKeys) {
      if (key.startsWith('form_data_')) {
        const item = items[key];
        const itemDiv = document.createElement('div');
        itemDiv.className = 'data-item';

        const title = document.createElement('h2');
        const timestamp = parseInt(key.replace('form_data_', ''), 10);
        title.textContent = `Saved on: ${new Date(timestamp).toLocaleString()}`;
        
        const content = document.createElement('pre');
        content.textContent = JSON.stringify(item, null, 2);

        const fillButton = document.createElement('button');
        fillButton.textContent = 'Fill Form';
        fillButton.className = 'fill-button'; // Add a class for styling if needed
        fillButton.onclick = function() {
          chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "fill_form", data: item });
          });
        };

        itemDiv.appendChild(title);
        itemDiv.appendChild(content);
        itemDiv.appendChild(fillButton); // Add the button to the item div
        dataContainer.appendChild(itemDiv);
      }
    }
  });

  // Clear button functionality
  clearButton.addEventListener('click', function() {
    if (confirm('Are you sure you want to delete all saved data?')) {
      chrome.storage.local.clear(function() {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
        } else {
          dataContainer.innerHTML = 'All data has been cleared.';
        }
      });
    }
  });
});
