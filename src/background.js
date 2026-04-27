importScripts("gemini-client.js");

const runSummarize = async (tabId, prompt) => {
  try {
    const client = new GeminiClient();
    let lastChunkAt = 0;
    await client.streamGenerate(prompt, (text) => {
      // Throttle chunk messages to avoid flooding (max ~10/sec)
      const now = Date.now();
      if (now - lastChunkAt < 100) return;
      lastChunkAt = now;
      chrome.tabs.sendMessage(tabId, { type: "VN_SUMMARY_CHUNK", text }).catch(() => {});
    });
    // Final full text
    chrome.tabs.sendMessage(tabId, {
      type: "VN_SUMMARY_DONE",
      conversationUrl: client.getConversationUrl(),
    }).catch(() => {});
  } catch (err) {
    console.error("[VN] summarize error:", err);
    chrome.tabs.sendMessage(tabId, {
      type: "VN_SUMMARY_ERROR",
      error: err.message,
    }).catch(() => {});
  }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "VN_OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage(() => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message && message.type === "VN_SUMMARIZE") {
    const tabId = sender.tab.id;
    runSummarize(tabId, message.prompt);
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

chrome.action.onClicked.addListener(() => {
  chrome.storage.local.get(["vn:enabled"], (result) => {
    const current = result["vn:enabled"];
    const next = current === undefined ? false : !current;
    chrome.storage.local.set({ "vn:enabled": next }, () => {
      setActionIcon(next !== false);
    });
  });
});

const setActionIcon = (enabled) => {
  const icon = enabled
    ? {
        16: "icons/icon16.png",
        32: "icons/icon32.png",
        48: "icons/icon48.png",
        128: "icons/icon128.png",
      }
    : {
        16: "icons/icon16_disabled.png",
        32: "icons/icon32_disabled.png",
        48: "icons/icon48_disabled.png",
        128: "icons/icon128_disabled.png",
      };
  chrome.action.setIcon({ path: icon }, () => {
    if (chrome.runtime.lastError) setActionIconImageData(enabled);
  });
};

const iconCache = new Map();

const loadImageData = async (path, size) => {
  const key = `${path}|${size}`;
  if (iconCache.has(key)) return iconCache.get(key);
  const url = chrome.runtime.getURL(path);
  const resp = await fetch(url);
  const blob = await resp.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(bitmap, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size);
  iconCache.set(key, data);
  return data;
};

const setActionIconImageData = async (enabled) => {
  const base = enabled ? "icons/icon" : "icons/icon";
  const suffix = enabled ? ".png" : "_disabled.png";
  const imageData = {
    16: await loadImageData(`${base}16${suffix}`, 16),
    32: await loadImageData(`${base}32${suffix}`, 32),
    48: await loadImageData(`${base}48${suffix}`, 48),
    128: await loadImageData(`${base}128${suffix}`, 128),
  };
  chrome.action.setIcon({ imageData });
};

const syncBadge = () => {
  chrome.storage.local.get(["vn:enabled"], (result) => {
    const enabled = result["vn:enabled"];
    setActionIcon(enabled !== false);
  });
};

chrome.runtime.onInstalled.addListener(syncBadge);
chrome.runtime.onStartup.addListener(syncBadge);
