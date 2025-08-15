chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "fill_form") {
    const data = request.data;
    for (const name in data) {
      const value = data[name];
      const elements = document.querySelectorAll(`[name="${name}"]`);
      
      if (elements.length > 0) {
        elements.forEach(element => {
          const type = element.type;
          if (type === 'radio') {
            if (element.value === value) {
              element.checked = true;
            }
          } else if (type === 'checkbox') {
            // This handles a single checkbox. For multiple checkboxes with the same name,
            // the saved data format would need to be an array.
            element.checked = !!value;
          } else {
            element.value = value;
          }
        });
      }
    }
    sendResponse({ status: "success" });
  }
});

document.addEventListener('submit', function(event) {
  // Check if the target is a form
  if (event.target.tagName.toLowerCase() === 'form') {
    const form = event.target;

    // Use window.confirm to ask the user
    const userConfirmed = window.confirm('Do you want to save the data from this form?');

    if (userConfirmed) {
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      // Create a unique key for this form data, e.g., using a timestamp
      const key = `form_data_${Date.now()}`;

      // Save to chrome.storage.local
      chrome.storage.local.set({ [key]: data }, function() {
        if (chrome.runtime.lastError) {
          console.error('Error saving form data:', chrome.runtime.lastError);
        } else {
          console.log('Form data saved successfully!');
        }
      });
    }
  }
}, true); // Use capturing phase to catch the event early