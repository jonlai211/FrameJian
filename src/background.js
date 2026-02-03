chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === "VN_OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage(() => {
      sendResponse({ ok: true });
    });
    return true;
  }
  return false;
});
