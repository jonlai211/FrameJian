(() => {
  if (window.__vnInjected) return;
  window.__vnInjected = true;

  const STRINGS = {
    en: {
      title: "Notes",
      collapse: "Hide",
      expand: "Show",
      add: "Add",
      copyAll: "Copy All",
      export: "Export",
      manage: "Manage",
      empty: "No notes yet.",
      jump: "Jump",
      copy: "Copy",
      edit: "Edit",
      save: "Save",
      cancel: "Cancel",
      saved: "Saved",
      updated: "Updated",
      copied: "Copied",
      exported: "Exported",
      needText: "Write something first.",
      openFailed: "Open failed",
      missingVideo: "Video not found yet",
    },
    zh: {
      title: "视频笔记",
      collapse: "收起",
      expand: "展开",
      add: "记录",
      copyAll: "复制全部",
      export: "导出",
      manage: "管理",
      empty: "还没有记录。",
      jump: "跳转",
      copy: "复制",
      edit: "编辑",
      save: "保存",
      cancel: "取消",
      saved: "已保存",
      updated: "已更新",
      copied: "已复制",
      exported: "已导出",
      needText: "先写点内容吧。",
      openFailed: "打开失败",
      missingVideo: "未检测到视频",
    },
  };

  const LOCALE_KEY = "vn:locale";
  const ENABLED_KEY = "vn:enabled";
  let locale = "en";
  let t = STRINGS[locale];
  let enabled = true;

  let videoEl = null;
  let notes = [];
  let videoMeta = { id: "", platform: "", title: "", url: "" };
  let statusTimer = null;
  let currentUrl = location.href;
  let collapsed = false;
  let lastCollapsedPos = null;

  const root = document.createElement("div");
  root.id = "vn-root";
  root.className = "vn-docked";

  root.innerHTML = `
    <div id="vn-panel">
      <div id="vn-header">
        <div id="vn-title">${t.title}</div>
        <div id="vn-time">--:--</div>
        <button id="vn-toggle">${t.collapse}</button>
      </div>
      <div id="vn-body">
        <textarea id="vn-input" placeholder="..." maxlength="2000"></textarea>
        <div id="vn-actions">
          <button class="vn-btn" id="vn-add">${t.add}</button>
          <button class="vn-btn" id="vn-copy-all">${t.copyAll}</button>
          <button class="vn-btn" id="vn-export">${t.export}</button>
        </div>
        <div id="vn-list"></div>
        <div id="vn-footer">
          <div class="vn-footer-left">
            <button id="vn-lang-toggle">EN</button>
          </div>
          <div id="vn-status"></div>
          <div class="vn-footer-right">
            <button id="vn-manage">${t.manage}</button>
            <span id="vn-meta"></span>
          </div>
        </div>
      </div>
    </div>
  `;

  document.documentElement.appendChild(root);

  const ui = {
    title: root.querySelector("#vn-title"),
    time: root.querySelector("#vn-time"),
    toggle: root.querySelector("#vn-toggle"),
    input: root.querySelector("#vn-input"),
    add: root.querySelector("#vn-add"),
    copyAll: root.querySelector("#vn-copy-all"),
    exportBtn: root.querySelector("#vn-export"),
    list: root.querySelector("#vn-list"),
    status: root.querySelector("#vn-status"),
    meta: root.querySelector("#vn-meta"),
    manage: root.querySelector("#vn-manage"),
    langToggle: root.querySelector("#vn-lang-toggle"),
  };

  const applyLocaleToUI = () => {
    root.classList.toggle("vn-locale-en", locale === "en");
    root.classList.toggle("vn-locale-zh", locale === "zh");
    ui.title.textContent = t.title;
    ui.toggle.textContent = collapsed ? t.expand : t.collapse;
    ui.add.textContent = t.add;
    ui.copyAll.textContent = t.copyAll;
    ui.exportBtn.textContent = t.export;
    ui.manage.textContent = t.manage;
    ui.langToggle.textContent = locale === "en" ? "EN" : "CN";
  };

  const setEnabled = (next) => {
    enabled = next;
    showRoot(enabled && isVideoPage());
  };

  const setLocale = (next, { persist = true } = {}) => {
    locale = next === "zh" ? "zh" : "en";
    t = STRINGS[locale];
    if (persist) chrome.storage.local.set({ [LOCALE_KEY]: locale });
    applyLocaleToUI();
    renderNotes();
  };

  applyLocaleToUI();

  const setStatus = (msg) => {
    ui.status.textContent = msg;
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      ui.status.textContent = "";
    }, 1400);
  };

  const formatTime = (seconds) => {
    const total = Math.max(0, Math.floor(seconds || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const hh = h > 0 ? String(h).padStart(2, "0") + ":" : "";
    return `${hh}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const getPlatform = () => {
    if (location.hostname.includes("youtube.com") || location.hostname.includes("youtu.be")) return "youtube";
    if (location.hostname.includes("bilibili.com")) return "bilibili";
    return "other";
  };

  const getVideoId = (platform) => {
    if (platform === "youtube") {
      if (location.hostname.includes("youtu.be")) return location.pathname.replace("/", "") || "unknown";
      const params = new URLSearchParams(location.search);
      return params.get("v") || "unknown";
    }
    if (platform === "bilibili") {
      const match = location.pathname.match(/\/video\/([a-zA-Z0-9]+)/);
      return match ? match[1] : "unknown";
    }
    return "unknown";
  };

  const isVideoPage = () => {
    const platform = getPlatform();
    if (platform === "youtube") {
      if (location.hostname.includes("youtu.be")) return true;
      return location.pathname.startsWith("/watch");
    }
    if (platform === "bilibili") {
      return location.pathname.includes("/video/");
    }
    return false;
  };

  const storageKey = () => `vn:${videoMeta.platform}:${videoMeta.id}`;

  const loadNotes = async () => {
    return new Promise((resolve) => {
      chrome.storage.local.get([storageKey()], (result) => {
        const payload = result[storageKey()];
        if (payload && Array.isArray(payload.notes)) {
          notes = payload.notes;
        } else {
          notes = [];
        }
        resolve();
      });
    });
  };

  const saveNotes = async () => {
    return new Promise((resolve) => {
      const payload = {
        title: videoMeta.title,
        url: videoMeta.url,
        platform: videoMeta.platform,
        id: videoMeta.id,
        notes,
        updatedAt: Date.now(),
      };
      chrome.storage.local.set({ [storageKey()]: payload }, resolve);
    });
  };

  const renderNotes = () => {
    ui.list.innerHTML = "";
    if (!notes.length) {
      const empty = document.createElement("div");
      empty.className = "vn-item";
      empty.textContent = t.empty;
      ui.list.appendChild(empty);
      return;
    }

    notes.forEach((note, idx) => {
      const item = document.createElement("div");
      item.className = "vn-item";

      const time = document.createElement("div");
      time.className = "vn-item-time";
      time.textContent = `${formatTime(note.t)} · ${new Date(note.createdAt).toLocaleString()}`;

      const text = document.createElement("div");
      text.className = "vn-item-text";
      text.textContent = note.text;

      const actions = document.createElement("div");
      actions.className = "vn-item-actions";

      const jump = document.createElement("button");
      jump.className = "vn-link";
      jump.textContent = t.jump;
      jump.addEventListener("click", () => {
        if (videoEl) {
          videoEl.currentTime = note.t;
          videoEl.play().catch(() => {});
        }
      });

      const copy = document.createElement("button");
      copy.className = "vn-link";
      copy.textContent = t.copy;
      copy.addEventListener("click", async () => {
        await copyText(`[${formatTime(note.t)}] ${note.text}`);
        setStatus(t.copied);
      });

      const edit = document.createElement("button");
      edit.className = "vn-link";
      edit.textContent = t.edit;

      const del = document.createElement("button");
      del.className = "vn-link";
      del.textContent = "×";
      del.setAttribute("aria-label", "delete");
      del.addEventListener("click", async () => {
        notes.splice(idx, 1);
        await saveNotes();
        renderNotes();
      });

      actions.appendChild(jump);
      actions.appendChild(copy);
      actions.appendChild(edit);
      actions.appendChild(del);
      item.appendChild(time);
      item.appendChild(text);
      item.appendChild(actions);
      ui.list.appendChild(item);

      edit.addEventListener("click", () => {
        const editor = document.createElement("textarea");
        editor.value = note.text;
        editor.id = "vn-input";
        editor.style.minHeight = "64px";
        item.replaceChild(editor, text);

        const save = document.createElement("button");
        save.className = "vn-link";
        save.textContent = t.save;

        const cancel = document.createElement("button");
        cancel.className = "vn-link";
        cancel.textContent = t.cancel;

        actions.innerHTML = "";
        actions.appendChild(save);
        actions.appendChild(cancel);

        save.addEventListener("click", async () => {
          note.text = editor.value.trim();
          await saveNotes();
          renderNotes();
          setStatus(t.updated);
        });

        cancel.addEventListener("click", () => {
          renderNotes();
        });
      });
    });
  };

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
      return true;
    }
  };

  const exportNotes = () => {
    const lines = [];
    lines.push(`# ${videoMeta.title || "Untitled"}`);
    lines.push(videoMeta.url);
    lines.push("");
    notes.forEach((note) => {
      lines.push(`- [${formatTime(note.t)}] ${note.text}`);
    });
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeTitle = (videoMeta.title || "notes").replace(/[^a-zA-Z0-9_-]+/g, "-");
    a.href = url;
    a.download = `${safeTitle || "notes"}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const updateTime = () => {
    if (!videoEl) {
      ui.time.textContent = "--:--";
      return;
    }
    ui.time.textContent = formatTime(videoEl.currentTime);
  };

  const updateMode = () => {
    const isFullscreen = !!document.fullscreenElement;
    root.classList.toggle("vn-fullscreen", isFullscreen);
    root.classList.toggle("vn-docked", !isFullscreen);
    const host = document.fullscreenElement || document.documentElement;
    if (root.parentElement !== host) {
      host.appendChild(root);
    }
  };

  const normalizeUrl = () => {
    if (videoMeta.platform === "bilibili") {
      const match = location.pathname.match(/(\/video\/[a-zA-Z0-9]+)/);
      if (match) return `${location.origin}${match[1]}`;
    }
    if (videoMeta.platform === "youtube") {
      if (location.hostname.includes("youtu.be")) {
        const id = location.pathname.replace("/", "");
        return id ? `https://youtu.be/${id}` : location.href.split("#")[0];
      }
      const params = new URLSearchParams(location.search);
      const id = params.get("v");
      return id ? `https://www.youtube.com/watch?v=${id}` : location.href.split("#")[0];
    }
    return location.href.split("#")[0];
  };

  const syncMeta = () => {
    const platform = getPlatform();
    videoMeta.platform = platform;
    videoMeta.id = getVideoId(platform);
    videoMeta.url = normalizeUrl();
    videoMeta.title = document.title.replace(" - YouTube", "").replace("_哔哩哔哩_bilibili", "");
    if (videoMeta.platform === "bilibili") ui.meta.textContent = "Bilibili";
    else if (videoMeta.platform === "youtube") ui.meta.textContent = "YouTube";
    else ui.meta.textContent = "";
  };

  const attach = async () => {
    syncMeta();
    await loadNotes();
    renderNotes();
    updateTime();
  };

  const findVideo = () => {
    const el = document.querySelector("video");
    return el || null;
  };

  const waitForVideo = () => {
    return new Promise((resolve) => {
      const check = () => {
        const el = findVideo();
        if (el) return resolve(el);
        requestAnimationFrame(check);
      };
      check();
    });
  };

  const setCollapsed = (next) => {
    if (collapsed && !next) {
      const rect = root.getBoundingClientRect();
      lastCollapsedPos = { left: rect.left, top: rect.top };
    }
    collapsed = next;
    root.classList.toggle("vn-collapsed", collapsed);
    ui.toggle.textContent = collapsed ? t.expand : t.collapse;
    if (collapsed && lastCollapsedPos) {
      root.style.left = `${lastCollapsedPos.left}px`;
      root.style.top = `${lastCollapsedPos.top}px`;
      root.style.right = "auto";
    } else if (!collapsed) {
      requestAnimationFrame(() => {
        clampToViewport();
      });
    }
  };

  const showRoot = (show) => {
    root.style.display = show ? "block" : "none";
  };

  ui.add.addEventListener("click", async () => {
    const text = ui.input.value.trim();
    if (!text) {
      setStatus(t.needText);
      return;
    }
    const entry = {
      t: videoEl ? videoEl.currentTime : 0,
      text,
      createdAt: Date.now(),
    };
    notes.unshift(entry);
    ui.input.value = "";
    await saveNotes();
    renderNotes();
    setStatus(t.saved);
  });

  ui.copyAll.addEventListener("click", async () => {
    if (!notes.length) return;
    const header = [videoMeta.title, videoMeta.url].filter(Boolean).join("\n");
    const body = notes.map((n) => `[${formatTime(n.t)}] ${n.text}`).join("\n");
    const lines = header ? `${header}\n\n${body}` : body;
    await copyText(lines);
    setStatus(t.copied);
  });

  ui.exportBtn.addEventListener("click", () => {
    if (!notes.length) return;
    exportNotes();
    setStatus(t.exported);
  });

  document.addEventListener("fullscreenchange", updateMode);

  ui.toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    setCollapsed(!collapsed);
  });

  ui.langToggle.addEventListener("click", () => {
    const next = locale === "en" ? "zh" : "en";
    setLocale(next);
  });

  let dragState = null;
  let dragMoved = false;
  let suppressClick = false;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const clampToViewport = () => {
    const rect = root.getBoundingClientRect();
    const maxLeft = window.innerWidth - rect.width - 6;
    const maxTop = window.innerHeight - rect.height - 6;
    const nextLeft = clamp(rect.left, 6, Math.max(6, maxLeft));
    const nextTop = clamp(rect.top, 6, Math.max(6, maxTop));
    root.style.left = `${nextLeft}px`;
    root.style.top = `${nextTop}px`;
    root.style.right = "auto";
  };

  const onDragMove = (event) => {
    if (!dragState) return;
    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      dragMoved = true;
      suppressClick = true;
    }
    const width = root.offsetWidth;
    const height = root.offsetHeight;
    const maxLeft = window.innerWidth - width - 6;
    const maxTop = window.innerHeight - height - 6;
    const nextLeft = clamp(dragState.startLeft + dx, 6, Math.max(6, maxLeft));
    const nextTop = clamp(dragState.startTop + dy, 6, Math.max(6, maxTop));
    root.style.left = `${nextLeft}px`;
    root.style.top = `${nextTop}px`;
    root.style.right = "auto";
  };

  const onDragEnd = () => {
    if (!dragState) return;
    dragState = null;
    root.classList.remove("vn-dragging");
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", onDragEnd);
  };

  root.querySelector("#vn-header").addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (target && (target.tagName === "BUTTON" || target.closest("button"))) return;
    const rect = root.getBoundingClientRect();
    dragMoved = false;
    dragState = {
      startX: event.clientX,
      startY: event.clientY,
      startLeft: rect.left,
      startTop: rect.top,
    };
    root.classList.add("vn-dragging");
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragEnd);
  });

  root.querySelector("#vn-header").addEventListener("click", () => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    if (collapsed) setCollapsed(false);
  });

  chrome.storage.local.get([LOCALE_KEY, ENABLED_KEY], (result) => {
    const stored = result[LOCALE_KEY];
    if (stored === "en" || stored === "zh") setLocale(stored, { persist: false });
    if (typeof result[ENABLED_KEY] === "boolean") setEnabled(result[ENABLED_KEY]);
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (changes[ENABLED_KEY]) setEnabled(changes[ENABLED_KEY].newValue);
    if (changes[LOCALE_KEY]) setLocale(changes[LOCALE_KEY].newValue, { persist: false });
  });

  ui.manage.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "VN_OPEN_OPTIONS" }, (resp) => {
      if (!resp || !resp.ok) setStatus(t.openFailed);
    });
  });

  const init = async () => {
    showRoot(false);
    updateMode();
    setInterval(updateTime, 500);

    const observer = new MutationObserver(() => {
      const latest = findVideo();
      if (latest && latest !== videoEl) {
        videoEl = latest;
        if (isVideoPage()) attach();
      }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });

    const tick = async () => {
      const urlChanged = currentUrl !== location.href;
      if (urlChanged) {
        currentUrl = location.href;
        videoEl = null;
      }

      if (!enabled || !isVideoPage()) {
        showRoot(false);
        return;
      }

      showRoot(true);
      updateMode();

      if (!videoEl) {
        const found = findVideo();
        if (found) videoEl = found;
      }

      if (videoEl) {
        const prevKey = storageKey();
        syncMeta();
        const nextKey = storageKey();
        if (urlChanged || prevKey !== nextKey) {
          await loadNotes();
          renderNotes();
        }
      }
    };

    setInterval(() => {
      tick().catch(() => {});
    }, 800);

    if (enabled && isVideoPage()) {
      videoEl = await waitForVideo();
      await attach();
      showRoot(true);
    }
  };

  init();
})();
