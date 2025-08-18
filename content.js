// --- MODAL AND UI INJECTION ---

function injectModalCSS() {
  const styleId = 'form-saver-modal-style';
  if (document.getElementById(styleId)) return;
  const css = `
    .form-saver-backdrop { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: rgba(0, 0, 0, 0.5); z-index: 999998; display: flex; justify-content: center; align-items: center; }
    .form-saver-modal { background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); z-index: 999999; width: 90%; max-width: 400px; text-align: center; font-family: sans-serif; }
    .form-saver-modal h3 { margin-top: 0; }
    .form-saver-modal p { margin: 10px 0 15px 0; }
    .form-saver-modal input { width: calc(100% - 20px); padding: 8px 10px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 4px; }
    .form-saver-modal button { padding: 10px 15px; border: none; border-radius: 5px; cursor: pointer; margin: 5px; font-size: 14px; }
    .form-saver-modal .form-chooser-list { list-style: none; padding: 0; max-height: 200px; overflow-y: auto; }
    .form-saver-modal .form-chooser-list li { padding: 10px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 5px; cursor: pointer; }
    .form-saver-modal .form-chooser-list li:hover { background-color: #f0f0f0; }
    .form-saver-btn-save { background-color: #28a745; color: white; }
    .form-saver-btn-confirm { background-color: #007bff; color: white; }
    .form-saver-btn-ignore { background-color: #6c757d; color: white; }
  `;
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = css;
  document.head.appendChild(style);
}

function showModal(html, onRender) {
  // Remove any existing backdrops before showing a new one
  const existingBackdrops = document.querySelectorAll('.form-saver-backdrop');
  existingBackdrops.forEach(bd => {
    if (bd.parentNode) {
      bd.parentNode.removeChild(bd);
    }
  });

  injectModalCSS();
  const backdrop = document.createElement('div');
  backdrop.className = 'form-saver-backdrop';
  const modal = document.createElement('div');
  modal.className = 'form-saver-modal';
  modal.innerHTML = html;
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  if (onRender) onRender(modal);
  console.log('Modal shown. Backdrop:', backdrop);

  // Add event listener to dismiss modal on backdrop click
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      console.log('Backdrop clicked, removing modal.');
      if (backdrop.parentNode) {
        backdrop.parentNode.removeChild(backdrop);
      }
    }
  });

  return { modal, backdrop };
}

// --- SAVE PROCESS LOGIC ---

function initiateSaveProcess(form, onComplete) {
  const hostname = window.location.hostname;

  const { modal, backdrop } = showModal(`
    <h3>為這筆儲存命名</h3>
    <p>請輸入一個好記的名稱</p>
    <input type="text" id="form-saver-name-input" placeholder="例如：我的個人資料">
    <button class="form-saver-btn-confirm">儲存</button>
    <button class="form-saver-btn-ignore">取消</button>
  `);

  const nameInput = modal.querySelector('#form-saver-name-input');
  nameInput.focus();

  const cleanup = () => {
    console.log('Calling cleanup for naming modal. Backdrop:', backdrop);
    document.body.removeChild(backdrop);
  };

  modal.querySelector('.form-saver-btn-ignore').onclick = () => {
    cleanup();
    if (onComplete) onComplete();
  };

  modal.querySelector('.form-saver-btn-confirm').onclick = () => {
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.style.border = '1px solid red';
      return;
    }

    chrome.storage.local.get(['savedForms'], (result) => {
      const savedForms = result.savedForms || {};
      if (!savedForms[hostname]) savedForms[hostname] = [];

      const newEntry = {
        name: name,
        timestamp: Date.now(),
        data: {}
      };

      const formData = new FormData(form);
      const formEntries = Array.from(formData.entries());

      if (formEntries.length > 0) {
        newEntry.data = Object.fromEntries(formEntries);
      } else {
        // Fallback for forms without name attributes
        console.warn('FormData was empty. Attempting fallback data capture.');
        const fallbackData = {};
        for (const element of form.elements) {
          if (element.type !== 'submit' && element.type !== 'button' && (element.id || element.type)) {
            const key = element.id || `${element.type}_${Math.floor(Math.random() * 1000)}`;
            if (element.type === 'radio' || element.type === 'checkbox') {
              if (element.checked) {
                fallbackData[key] = element.value;
              }
            } else if (element.value) {
              fallbackData[key] = element.value;
            }
          }
        }
        newEntry.data = fallbackData;
      }

      savedForms[hostname].push(newEntry);
      chrome.storage.local.set({ savedForms }, () => {
        cleanup();
        if (onComplete) onComplete();
      });
    });
  };
}

// --- EVENT LISTENERS ---

// Listener for form submission
document.addEventListener('submit', function(event) {
  if (event.target.tagName.toLowerCase() !== 'form' || event.target.dataset.formSaverHandled) return;

  const form = event.target;
  event.preventDefault();

  const { modal, backdrop } = showModal(`
    <h3>要儲存這次的表單資料嗎？</h3>
    <button class="form-saver-btn-save">確定儲存</button>
    <button class="form-saver-btn-ignore">現在不要</button>
  `);

  const cleanupAndSubmit = () => {
    console.log('Calling cleanupAndSubmit for submission modal. Backdrop:', backdrop);
    document.body.removeChild(backdrop);
    form.dataset.formSaverHandled = 'true';
    form.submit();
  };

  modal.querySelector('.form-saver-btn-ignore').onclick = cleanupAndSubmit;
  modal.querySelector('.form-saver-btn-save').onclick = () => {
    console.log('Saving from submission modal. Removing backdrop:', backdrop);
    document.body.removeChild(backdrop);
    initiateSaveProcess(form, () => {
      form.dataset.formSaverHandled = 'true';
      form.submit();
    });
  };
}, true);

// Listener for messages from background script or popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "fill_form") {
    const data = request.data;
    const remainingKeys = new Set(Object.keys(data));
    let attempts = 0;
    const maxAttempts = 25; // 5 seconds total

    function attemptToFill() {
      for (const name of Array.from(remainingKeys)) {
        const elements = document.querySelectorAll(`[name="${name}"], [id="${name}"]`); // Also check for ID

        if (elements.length > 0) {
          const value = data[name];
          elements.forEach(element => {
            const type = element.type;
            if (type === 'radio') {
              if (element.value === value) element.checked = true;
            } else if (type === 'checkbox') {
              element.checked = !!value;
            } else {
              element.value = value;
            }
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
          });
          remainingKeys.delete(name);
        }
      }
    }

    attemptToFill(); // Initial pass

    if (remainingKeys.size > 0) {
      const retryInterval = setInterval(() => {
        attempts++;
        attemptToFill();

        if (remainingKeys.size === 0 || attempts >= maxAttempts) {
          clearInterval(retryInterval);
          if (remainingKeys.size > 0) {
            console.warn('Form Saver: Could not fill all fields after 5 seconds:', Array.from(remainingKeys));
          }
        }
      }, 200);
    }

    sendResponse({ status: "success" });
    return; // Indicate synchronous response
  }
  
  if (request.action === "manual_save_trigger") {
    const forms = Array.from(document.querySelectorAll('form'));
    if (forms.length === 0) {
      alert('此頁面沒有找到任何表單。');
    } else if (forms.length === 1) {
      initiateSaveProcess(forms[0]);
    } else {
      // Multiple forms found, ask user to choose
      let formListHTML = '<ul class="form-chooser-list">';
      forms.forEach((f, index) => {
        const formId = f.id ? `#${f.id}` : '';
        const formAction = f.action ? ` (action: ${f.action.substring(f.action.lastIndexOf('/'))})` : '';
        formListHTML += `<li data-index="${index}">表單 ${index + 1}${formId}${formAction}</li>`;
      });
      formListHTML += '</ul>';

      const { modal, backdrop } = showModal(`<h3>請選擇要儲存的表單</h3>${formListHTML}`);
      modal.querySelectorAll('.form-chooser-list li').forEach(li => {
        li.onclick = () => {
          console.log('Removing form chooser modal backdrop:', backdrop);
          document.body.removeChild(backdrop);
          initiateSaveProcess(selectedForm);
        };
      });
    }
  }
});

// --- EVENT LISTENERS ---

// Listener for form submission
document.addEventListener('submit', function(event) {
  if (event.target.tagName.toLowerCase() !== 'form' || event.target.dataset.formSaverHandled) return;

  const form = event.target;
  event.preventDefault();

  const { modal, backdrop } = showModal(`
    <h3>要儲存這次的表單資料嗎？</h3>
    <button class="form-saver-btn-save">確定儲存</button>
    <button class="form-saver-btn-ignore">現在不要</button>
  `);

  const cleanupAndSubmit = () => {
    document.body.removeChild(backdrop);
    form.dataset.formSaverHandled = 'true';
    form.submit();
  };

  modal.querySelector('.form-saver-btn-ignore').onclick = cleanupAndSubmit;
  modal.querySelector('.form-saver-btn-save').onclick = () => {
    document.body.removeChild(backdrop);
    initiateSaveProcess(form, () => {
      form.dataset.formSaverHandled = 'true';
      form.submit();
    });
  };
}, true);

// Listener for messages from background script or popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "fill_form") {
    const data = request.data;
    const remainingKeys = new Set(Object.keys(data));
    let attempts = 0;
    const maxAttempts = 25; // 5 seconds total

    function attemptToFill() {
      for (const name of Array.from(remainingKeys)) {
        const elements = document.querySelectorAll(`[name="${name}"], [id="${name}"]`); // Also check for ID

        if (elements.length > 0) {
          const value = data[name];
          elements.forEach(element => {
            const type = element.type;
            if (type === 'radio') {
              if (element.value === value) element.checked = true;
            } else if (type === 'checkbox') {
              element.checked = !!value;
            } else {
              element.value = value;
            }
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
          });
          remainingKeys.delete(name);
        }
      }
    }

    attemptToFill(); // Initial pass

    if (remainingKeys.size > 0) {
      const retryInterval = setInterval(() => {
        attempts++;
        attemptToFill();

        if (remainingKeys.size === 0 || attempts >= maxAttempts) {
          clearInterval(retryInterval);
          if (remainingKeys.size > 0) {
            console.warn('Form Saver: Could not fill all fields after 5 seconds:', Array.from(remainingKeys));
          }
        }
      }, 200);
    }

    sendResponse({ status: "success" });
    return; // Indicate synchronous response
  }
  
  if (request.action === "manual_save_trigger") {
    const forms = Array.from(document.querySelectorAll('form'));
    if (forms.length === 0) {
      alert('此頁面沒有找到任何表單。');
    } else if (forms.length === 1) {
      initiateSaveProcess(forms[0]);
    } else {
      // Multiple forms found, ask user to choose
      let formListHTML = '<ul class="form-chooser-list">';
      forms.forEach((f, index) => {
        const formId = f.id ? `#${f.id}` : '';
        const formAction = f.action ? ` (action: ${f.action.substring(f.action.lastIndexOf('/'))})` : '';
        formListHTML += `<li data-index="${index}">表單 ${index + 1}${formId}${formAction}</li>`;
      });
      formListHTML += '</ul>';

      const { modal, backdrop } = showModal(`<h3>請選擇要儲存的表單</h3>${formListHTML}`);
      modal.querySelectorAll('.form-chooser-list li').forEach(li => {
        li.onclick = () => {
          const selectedForm = forms[parseInt(li.dataset.index)];
          document.body.removeChild(backdrop);
          initiateSaveProcess(selectedForm);
        };
      });
    }
  }
});