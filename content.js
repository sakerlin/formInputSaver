// Function to inject CSS for the modal into the page
function injectModalCSS() {
  const styleId = 'form-saver-modal-style';
  if (document.getElementById(styleId)) return; // Avoid injecting twice

  const css = `
    .form-saver-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background-color: rgba(0, 0, 0, 0.5);
      z-index: 999998;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .form-saver-modal {
      background-color: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      z-index: 999999;
      width: 90%;
      max-width: 400px;
      text-align: center;
    }
    .form-saver-modal h3 {
      margin-top: 0;
      font-family: sans-serif;
    }
    .form-saver-modal button {
      padding: 10px 15px;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      margin: 5px;
      font-size: 14px;
    }
    .form-saver-btn-save {
      background-color: #28a745;
      color: white;
    }
    .form-saver-btn-ignore {
      background-color: #ffc107;
      color: black;
    }
    .form-saver-btn-block {
      background-color: #dc3545;
      color: white;
    }
  `;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = css;
  document.head.appendChild(style);
}

// Function to show the custom confirmation modal
function showCustomConfirm(callback) {
  injectModalCSS();

  const backdrop = document.createElement('div');
  backdrop.className = 'form-saver-backdrop';

  const modal = document.createElement('div');
  modal.className = 'form-saver-modal';
  modal.innerHTML = `
    <h3>要儲存這次的表單資料嗎？</h3>
    <button class="form-saver-btn-save">確定儲存</button>
    <button class="form-saver-btn-ignore">現在不要</button>
    <button class="form-saver-btn-block">不要在這個網站上儲存</button>
  `;

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  const cleanup = () => document.body.removeChild(backdrop);

  modal.querySelector('.form-saver-btn-save').onclick = () => { cleanup(); callback('save'); };
  modal.querySelector('.form-saver-btn-ignore').onclick = () => { cleanup(); callback('ignore'); };
  modal.querySelector('.form-saver-btn-block').onclick = () => { cleanup(); callback('block'); };
}

// Main submit event listener
document.addEventListener('submit', function(event) {
  if (event.target.tagName.toLowerCase() !== 'form') return;
  
  // A flag to prevent re-triggering on our own submit call
  if (event.target.dataset.formSaverHandled) return;

  const form = event.target;
  event.preventDefault(); // Stop submission to show modal

  const hostname = window.location.hostname;

  chrome.storage.local.get(['blockedSites'], function(result) {
    const blockedSites = result.blockedSites || [];
    if (blockedSites.includes(hostname)) {
      form.submit(); // Site is blocked, submit without asking
      return;
    }

    showCustomConfirm(function(choice) {
      if (choice === 'save') {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const key = `form_data_${Date.now()}`;
        chrome.storage.local.set({ [key]: data });
      } else if (choice === 'block') {
        const newBlockedSites = [...blockedSites, hostname];
        chrome.storage.local.set({ blockedSites: newBlockedSites });
      }
      // For all choices (save, ignore, block), we submit the form.
      form.dataset.formSaverHandled = 'true';
      form.submit();
    });
  });
}, true);

// Listener for fill form action from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "fill_form") {
    const data = request.data;
    for (const name in data) {
      const value = data[name];
      const elements = document.querySelectorAll(`[name="${name}"]`);
      if (elements.length > 0) {
        elements.forEach(element => {
          const type = element.type;
          // Set the value/state first
          if (type === 'radio') {
            if (element.value === value) element.checked = true;
          } else if (type === 'checkbox') {
            element.checked = !!value;
          } else {
            element.value = value;
          }

          // Dispatch events to simulate user interaction
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        });
      }
    }
    sendResponse({ status: "success" });
  }
});