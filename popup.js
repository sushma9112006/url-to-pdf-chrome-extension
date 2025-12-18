function showStatus(msg, color) {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.style.color = color || '#b00020';
  el.style.display = "block";
}

document.getElementById("pdfBtn").addEventListener("click", async () => {
  const urlInput = document.getElementById('urlInput').value.trim();
  const filenameInput = document.getElementById('filenameInput').value.trim();
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url) {
    showStatus("No active page found to convert.");
    return;
  }

  const blockedSchemes = ["chrome://", "edge://", "about://"];
  if (blockedSchemes.some(s => tab.url.startsWith(s))) {
    showStatus("This page cannot be saved as PDF due to browser restrictions.");
    return;
  }

  if (urlInput) {
    try {
      new URL(urlInput);
    } catch {
      showStatus("Please enter a valid URL (including https://).", '#b00020');
      return;
    }
  }

  showStatus("Preparing page for PDF…", '#333');

  if (urlInput) {
    const created = await chrome.tabs.create({ url: urlInput });
    tab = created;
    await waitForComplete(created.id);
  }

  if (!tab || !tab.id) return;

  await chrome.tabs.update(tab.id, { active: true });

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (filename) => {
      const originalTitle = document.title;
      if (filename) {
        try { document.title = filename; } catch (e) {}
      }

      const style = document.createElement("style");
      style.id = "__url_to_pdf_print_style__";
      style.innerHTML = `
@media print {
  body {
    font-family: "JetBrains Mono", "Fira Code", "Source Code Pro", Consolas, Menlo, monospace !important;
    font-size: 11px !important;
    line-height: 1.4 !important;
    color: #000 !important;
  }

  code, pre {
    font-family: "JetBrains Mono", "Fira Code", Consolas, monospace !important;
    font-size: 10px !important;
  }

  nav, footer, header, aside, button, input {
    display: none !important;
  }
}
`;
      document.head.appendChild(style);

      window.print();

      setTimeout(() => {
        try { document.title = originalTitle; } catch (e) {}
        const s = document.getElementById("__url_to_pdf_print_style__");
        if (s) s.remove();
      }, 2000);
    },
    args: [filenameInput || '']
  });

  window.close();

  function waitForComplete(tabId) {
    return new Promise((resolve) => {
      let resolved = false;

      const tryResolve = () => {
        if (resolved) return;
        resolved = true;
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      };

      const listener = (id, changeInfo) => {
        if (id === tabId && changeInfo.status === 'complete') {
          tryResolve();
        }
      };

      chrome.tabs.onUpdated.addListener(listener);

      try {
        chrome.tabs.get(tabId).then((t) => {
          if (t && t.status === 'complete') tryResolve();
        }).catch(() => {});
      } catch (e) {
        try {
          chrome.tabs.get(tabId, (t) => {
            if (t && t.status === 'complete') tryResolve();
          });
        } catch (err) {}
      }

      setTimeout(() => {
        if (!resolved) tryResolve();
      }, 10000);
    });
  }
});
