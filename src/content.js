(() => {
  if (window.__vnInjected) return;
  window.__vnInjected = true;

  const STRINGS = {
    en: {
      title: "FrameJian",
      collapse: "Collapse",
      expand: "Expand",
      tabNotes: "Notes",
      tabAi: "AI Summary",
      aiTitle: "AI Summary",
      aiSubtext: "Gemini reads the video and generates a structured summary with timestamps.",
      save: "Save",
      copyAll: "Copy all",
      export: "Export",
      manage: "Manage",
      empty: "No notes yet — start typing.",
      write: "Note this moment…",
      jump: "Jump",
      copy: "Copy",
      edit: "Edit",
      delete: "Delete",
      saved: "Saved",
      updated: "Updated",
      copied: "Copied",
      exported: "Exported",
      needText: "Write something first.",
      openFailed: "Open failed",
      missingVideo: "Video not found yet",
      summarize: "Summarize with AI",
      summarizing: "Summarizing…",
      noTranscript: "YouTube only",
      summaryFailed: "Summary failed",
      summaryDone: "Done",
      notLoggedIn: "Log in to gemini.google.com first",
      regenSummary: "Regenerate",
      cancel: "Cancel",
    },
    zh: {
      title: "帧笺",
      collapse: "收起",
      expand: "展开",
      tabNotes: "笔记",
      tabAi: "AI 摘要",
      aiTitle: "AI 摘要",
      aiSubtext: "Gemini 会读取视频内容，生成带时间戳的结构化摘要。",
      save: "保存",
      copyAll: "复制全部",
      export: "导出",
      manage: "管理",
      empty: "还没有记录 — 开始输入吧。",
      write: "在此处记下这一帧…",
      jump: "跳转",
      copy: "复制",
      edit: "编辑",
      delete: "删除",
      saved: "已保存",
      updated: "已更新",
      copied: "已复制",
      exported: "已导出",
      needText: "先写点内容吧。",
      openFailed: "打开失败",
      missingVideo: "未检测到视频",
      summarize: "AI 总结",
      summarizing: "总结中…",
      noTranscript: "仅支持 YouTube",
      summaryFailed: "总结失败",
      summaryDone: "完成",
      notLoggedIn: "请先登录 gemini.google.com",
      regenSummary: "重新生成",
      cancel: "取消",
    },
  };

  const LOCALE_KEY  = "vn:locale";
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
  let summarizing = false;
  let currentTab = "notes"; // "notes" | "ai"
  let summaryText = "";

  const root = document.createElement("div");
  root.id = "vn-root";
  root.className = "vn-docked";

  const COLLAPSE_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
  const LIBRARY_SVG  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`;

  root.innerHTML = `
    <div id="vn-panel">
      <div id="vn-header">
        <span class="fj-logo"><span class="fj-zhen">笺</span></span>
        <span id="vn-title">${t.title}</span>
        <span id="vn-time-pill">--:--</span>
        <div id="vn-hdr-actions">
          <button class="fj-ic" id="vn-settings" aria-label="library">${LIBRARY_SVG}</button>
          <button class="fj-ic" id="vn-toggle" aria-label="${t.collapse}">${COLLAPSE_SVG}</button>
        </div>
      </div>
      <div id="vn-body">
        <div id="vn-tabs">
          <button class="fj-tab active" id="vn-tab-notes">
            <span class="fj-tab-label">${t.tabNotes}</span> <span class="fj-tab-pill" id="vn-tab-notes-count">0</span>
          </button>
          <button class="fj-tab" id="vn-tab-ai">
            <span class="fj-tab-label">${t.tabAi}</span> <span class="fj-tab-pill">✦</span>
          </button>
        </div>

        <div id="vn-panel-notes">
          <div id="vn-list"></div>
          <div id="vn-composer">
            <div class="fj-composer-wrap">
              <div class="fj-composer-top">
                <span class="fj-ts-now" id="vn-input-ts"></span>
                <textarea id="vn-input" placeholder="${t.write}" maxlength="2000"></textarea>
              </div>
              <div class="fj-composer-bar">
                <span class="fj-kbd-hint"><kbd>⌘</kbd><kbd>↵</kbd></span>
                <button class="fj-save-btn" id="vn-add">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  <span id="vn-save-text">${t.save}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div id="vn-panel-ai">
          <div id="vn-ai-empty">
            <div class="fj-ai-spark">✦</div>
            <div class="fj-ai-h">${t.aiTitle}</div>
            <div class="fj-ai-sub">${t.aiSubtext}</div>
            <button id="vn-summarize">✦ <span id="vn-summarize-label">${t.summarize}</span></button>
          </div>
          <div id="vn-ai-loading">
            <div class="fj-skel long"></div>
            <div class="fj-skel"></div>
            <div class="fj-skel short"></div>
            <div class="fj-skel long"></div>
            <div class="fj-skel short"></div>
          </div>
          <div id="vn-summary"></div>
          <div id="vn-ai-actions">
            <button class="fj-ai-btn primary" id="vn-ai-export"><span id="vn-ai-export-label">${t.export}</span></button>
            <button class="fj-ai-btn" id="vn-ai-copy">${t.copy}</button>
            <button class="fj-ai-btn" id="vn-ai-regen">${t.regenSummary}</button>
          </div>
        </div>

        <div id="vn-footer">
          <button id="vn-lang-toggle">EN</button>
          <div id="vn-status"></div>
          <div class="fj-foot-r">
            <span id="vn-meta"></span>
          </div>
        </div>
      </div>
    </div>
  `;

  // Inject Google Fonts via <link> instead of @import (avoids YouTube CSP blocking)
  if (!document.querySelector("#vn-gfonts")) {
    const link = document.createElement("link");
    link.id   = "vn-gfonts";
    link.rel  = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Serif+SC:wght@900&family=JetBrains+Mono:wght@500;600&display=swap";
    document.head.appendChild(link);
  }

  document.documentElement.appendChild(root);

  const ui = {
    title:           root.querySelector("#vn-title"),
    timePill:        root.querySelector("#vn-time-pill"),
    toggle:          root.querySelector("#vn-toggle"),
    settings:        root.querySelector("#vn-settings"),
    tabNotes:        root.querySelector("#vn-tab-notes"),
    tabAi:           root.querySelector("#vn-tab-ai"),
    tabNotesCount:   root.querySelector("#vn-tab-notes-count"),
    panelNotes:      root.querySelector("#vn-panel-notes"),
    panelAi:         root.querySelector("#vn-panel-ai"),
    list:            root.querySelector("#vn-list"),
    inputTs:         root.querySelector("#vn-input-ts"),
    input:           root.querySelector("#vn-input"),
    add:             root.querySelector("#vn-add"),
    saveText:        root.querySelector("#vn-save-text"),
    aiEmpty:         root.querySelector("#vn-ai-empty"),
    aiLoading:       root.querySelector("#vn-ai-loading"),
    summarize:       root.querySelector("#vn-summarize"),
    summarizeLabel:  root.querySelector("#vn-summarize-label"),
    summary:         root.querySelector("#vn-summary"),
    aiActions:       root.querySelector("#vn-ai-actions"),
    aiExport:        root.querySelector("#vn-ai-export"),
    aiExportLabel:   root.querySelector("#vn-ai-export-label"),
    aiCopy:          root.querySelector("#vn-ai-copy"),
    aiRegen:         root.querySelector("#vn-ai-regen"),
    status:          root.querySelector("#vn-status"),
    meta:            root.querySelector("#vn-meta"),
    langToggle:      root.querySelector("#vn-lang-toggle"),
  };

  // ── Tab switching ─────────────────────────────────────────

  const switchTab = (tab) => {
    currentTab = tab;
    ui.tabNotes.classList.toggle("active", tab === "notes");
    ui.tabAi.classList.toggle("active", tab === "ai");
    ui.panelNotes.style.display = tab === "notes" ? "" : "none";
    ui.panelAi.classList.toggle("active", tab === "ai");
  };

  ui.tabNotes.addEventListener("click", () => switchTab("notes"));
  ui.tabAi.addEventListener("click", () => switchTab("ai"));

  // ── AI panel state ────────────────────────────────────────

  const setAiState = (state) => {
    // state: "empty" | "loading" | "done"
    ui.aiEmpty.style.display    = state === "empty"   ? "" : "none";
    ui.aiLoading.classList.toggle("visible", state === "loading");
    ui.aiActions.classList.toggle("visible", state === "done");
    if (state !== "done") ui.summary.classList.remove("vn-summary-visible");
  };

  setAiState("empty");

  // ── Locale ────────────────────────────────────────────────

  const applyLocaleToUI = () => {
    root.classList.toggle("vn-locale-en", locale === "en");
    root.classList.toggle("vn-locale-zh", locale === "zh");
    ui.title.textContent       = t.title;
    ui.tabNotes.querySelector(".fj-tab-label").textContent = t.tabNotes;
    ui.tabAi.querySelector(".fj-tab-label").textContent    = t.tabAi;
    ui.saveText.textContent    = t.save;
    ui.langToggle.textContent  = locale === "en" ? "EN" : "中";
    ui.input.placeholder       = t.write;
    if (!summarizing) ui.summarizeLabel.textContent = t.summarize;
    // Update AI sub text
    root.querySelector(".fj-ai-h").textContent  = t.aiTitle;
    root.querySelector(".fj-ai-sub").textContent = t.aiSubtext;
    ui.aiCopy.textContent       = t.copy;
    ui.aiRegen.textContent      = t.regenSummary;
    ui.aiExportLabel.textContent = t.export;
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

  // ── Status ────────────────────────────────────────────────

  const setStatus = (msg) => {
    ui.status.textContent = msg;
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { ui.status.textContent = ""; }, 1600);
  };

  // ── Helpers ───────────────────────────────────────────────

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
    if (platform === "bilibili") return location.pathname.includes("/video/");
    return false;
  };

  const storageKey = () => `vn:${videoMeta.platform}:${videoMeta.id}`;

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
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

  // ── Storage ───────────────────────────────────────────────

  let summaryUpdatedAt = 0;

  const loadPayload = async () => {
    return new Promise((resolve) => {
      chrome.storage.local.get([storageKey()], (result) => {
        const payload = result[storageKey()];
        notes = payload && Array.isArray(payload.notes) ? payload.notes : [];
        if (payload && payload.summary && typeof payload.summary.text === "string") {
          summaryText      = payload.summary.text;
          summaryUpdatedAt = payload.summary.updatedAt || 0;
        } else {
          summaryText      = "";
          summaryUpdatedAt = 0;
        }
        resolve();
      });
    });
  };

  // Kept for backwards compatibility with existing callers
  const loadNotes = loadPayload;

  const savePayload = async () => {
    return new Promise((resolve) => {
      const data = {
        title: videoMeta.title,
        url: videoMeta.url,
        platform: videoMeta.platform,
        id: videoMeta.id,
        thumbnail: videoMeta.thumbnail || "",
        notes,
        updatedAt: Date.now(),
      };
      if (summaryText) {
        data.summary = { text: summaryText, updatedAt: summaryUpdatedAt || Date.now() };
      }
      chrome.storage.local.set({ [storageKey()]: data }, resolve);
    });
  };

  const saveNotes = savePayload;

  // ── Render notes ──────────────────────────────────────────

  const renderNotes = () => {
    const count = notes.length;
    ui.tabNotesCount.textContent = String(count);

    ui.list.innerHTML = "";

    if (!count) {
      const empty = document.createElement("div");
      empty.className = "fj-note-empty";
      empty.innerHTML = `<div class="fj-note-empty-icon">∅</div><div class="fj-note-empty-text">${t.empty}</div>`;
      ui.list.appendChild(empty);
      return;
    }

    notes.forEach((note, idx) => {
      // Container is block; main row stays as a flex row, the action menu
      // and inline editor are full-width siblings below it (avoids the
      // flex-stretch chaos when actions were appended into the row itself).
      const item = document.createElement("div");
      item.className = "fj-note";

      const row = document.createElement("div");
      row.className = "fj-note-row";

      const tsBtn = document.createElement("button");
      tsBtn.className = "fj-note-ts";
      tsBtn.textContent = formatTime(note.t);
      tsBtn.title = t.jump;
      tsBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (videoEl) { videoEl.currentTime = note.t; videoEl.play().catch(() => {}); }
      });

      const body = document.createElement("div");
      body.className = "fj-note-body";
      body.textContent = note.text;

      const more = document.createElement("button");
      more.className = "fj-note-more";
      more.textContent = "⋯";

      const mkBtn = (label, cls, handler) => {
        const b = document.createElement("button");
        b.className = "fj-note-act" + (cls ? " " + cls : "");
        b.textContent = label;
        b.addEventListener("click", (ev) => { ev.stopPropagation(); handler(); });
        return b;
      };

      more.addEventListener("click", (e) => {
        e.stopPropagation();
        const existing = item.querySelector(".fj-note-acts");
        if (existing) { existing.remove(); return; }
        const acts = document.createElement("div");
        acts.className = "fj-note-acts";

        acts.appendChild(mkBtn(t.edit, "", () => {
          acts.remove();
          row.style.display = "none";

          const editWrap = document.createElement("div");
          editWrap.className = "fj-note-edit";

          const editor = document.createElement("textarea");
          editor.className = "fj-note-edit-area";
          editor.value = note.text;
          editWrap.appendChild(editor);

          const editActs = document.createElement("div");
          editActs.className = "fj-note-acts fj-note-acts-edit";

          const saveBtn = mkBtn(t.save, "primary", async () => {
            const val = editor.value.trim();
            if (val) { note.text = val; await saveNotes(); }
            renderNotes();
            setStatus(t.updated);
          });
          const cancelBtn = mkBtn(t.cancel, "", () => {
            editWrap.remove();
            row.style.display = "";
          });

          editActs.appendChild(saveBtn);
          editActs.appendChild(cancelBtn);
          editWrap.appendChild(editActs);
          item.appendChild(editWrap);
          editor.focus();
        }));

        acts.appendChild(mkBtn(t.delete, "danger", async () => {
          notes.splice(idx, 1);
          await saveNotes();
          renderNotes();
        }));

        item.appendChild(acts);
      });

      row.appendChild(tsBtn);
      row.appendChild(body);
      row.appendChild(more);
      item.appendChild(row);
      ui.list.appendChild(item);
    });
  };

  // ── Time update ───────────────────────────────────────────

  const updateTime = () => {
    if (!videoEl) {
      ui.timePill.textContent = "--:--";
      ui.inputTs.textContent  = "";
      return;
    }
    const ts = formatTime(videoEl.currentTime);
    ui.timePill.textContent = ts;
    ui.inputTs.textContent  = ts;
  };

  // ── Platform / meta ───────────────────────────────────────

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
      const id = new URLSearchParams(location.search).get("v");
      return id ? `https://www.youtube.com/watch?v=${id}` : location.href.split("#")[0];
    }
    return location.href.split("#")[0];
  };

  const captureThumbnail = (platform, id) => {
    const og = document.querySelector('meta[property="og:image"]')?.content
            || document.querySelector('meta[name="og:image"]')?.content
            || document.querySelector('meta[name="twitter:image"]')?.content
            || "";
    if (og) return og;
    if (platform === "youtube" && id && id !== "unknown") {
      return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
    }
    return "";
  };

  const syncMeta = () => {
    const platform = getPlatform();
    videoMeta.platform  = platform;
    videoMeta.id        = getVideoId(platform);
    videoMeta.url       = normalizeUrl();
    videoMeta.title     = document.title.replace(" - YouTube", "").replace("_哔哩哔哩_bilibili", "");
    videoMeta.thumbnail = captureThumbnail(platform, videoMeta.id);
    if (platform === "bilibili")      ui.meta.textContent = "Bilibili";
    else if (platform === "youtube")  ui.meta.textContent = "YouTube";
    else                              ui.meta.textContent = "";
  };

  const attach = async () => {
    syncMeta();
    await loadPayload();
    renderNotes();
    if (summaryText) {
      renderSummary(summaryText);
      setAiState("done");
    } else {
      renderSummary("");
      setAiState("empty");
    }
    updateTime();
  };

  // ── Video detection ───────────────────────────────────────

  const findVideo = () => document.querySelector("video") || null;

  const waitForVideo = () => new Promise((resolve) => {
    const el = findVideo();
    if (el) return resolve(el);
    const obs = new MutationObserver(() => {
      const found = findVideo();
      if (found) { obs.disconnect(); resolve(found); }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  });

  // ── Collapsed state ───────────────────────────────────────

  const setCollapsed = (next) => {
    if (collapsed && !next) {
      const rect = root.getBoundingClientRect();
      lastCollapsedPos = { left: rect.left, top: rect.top };
    }
    collapsed = next;
    root.classList.toggle("vn-collapsed", collapsed);
    if (collapsed && lastCollapsedPos) {
      root.style.left  = `${lastCollapsedPos.left}px`;
      root.style.top   = `${lastCollapsedPos.top}px`;
      root.style.right = "auto";
    } else if (!collapsed) {
      requestAnimationFrame(clampToViewport);
    }
  };

  const showRoot = (show) => { root.style.display = show ? "block" : "none"; };

  // ── Viewport clamping + drag ──────────────────────────────

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const clampToViewport = () => {
    const rect = root.getBoundingClientRect();
    const maxL = window.innerWidth  - rect.width  - 6;
    const maxT = window.innerHeight - rect.height - 6;
    root.style.left  = `${clamp(rect.left, 6, Math.max(6, maxL))}px`;
    root.style.top   = `${clamp(rect.top,  6, Math.max(6, maxT))}px`;
    root.style.right = "auto";
  };

  let dragState = null, suppressClick = false;

  const onDragMove = (e) => {
    if (!dragState) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) suppressClick = true;
    const maxL = window.innerWidth  - root.offsetWidth  - 6;
    const maxT = window.innerHeight - root.offsetHeight - 6;
    root.style.left  = `${clamp(dragState.startLeft + dx, 6, Math.max(6, maxL))}px`;
    root.style.top   = `${clamp(dragState.startTop  + dy, 6, Math.max(6, maxT))}px`;
    root.style.right = "auto";
  };

  const onDragEnd = () => {
    if (!dragState) return;
    dragState = null;
    root.classList.remove("vn-dragging");
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup",   onDragEnd);
  };

  root.querySelector("#vn-header").addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    const rect = root.getBoundingClientRect();
    suppressClick = false;
    dragState = { startX: e.clientX, startY: e.clientY, startLeft: rect.left, startTop: rect.top };
    root.classList.add("vn-dragging");
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup",   onDragEnd);
  });

  root.querySelector("#vn-header").addEventListener("click", () => {
    if (suppressClick) { suppressClick = false; return; }
    if (collapsed) setCollapsed(false);
  });

  // ── Fullscreen ────────────────────────────────────────────

  const updateMode = () => {
    const isFS = !!document.fullscreenElement;
    root.classList.toggle("vn-fullscreen", isFS);
    root.classList.toggle("vn-docked", !isFS);
    const host = document.fullscreenElement || document.documentElement;
    if (root.parentElement !== host) host.appendChild(root);
  };

  document.addEventListener("fullscreenchange", updateMode);

  // ── Note save ─────────────────────────────────────────────

  ui.add.addEventListener("click", async () => {
    const text = ui.input.value.trim();
    if (!text) { setStatus(t.needText); return; }
    notes.unshift({ t: videoEl ? videoEl.currentTime : 0, text, createdAt: Date.now() });
    ui.input.value = "";
    await saveNotes();
    renderNotes();
    setStatus(t.saved);
  });

  ui.input.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      ui.add.click();
    }
  });

  // ── AI summary ────────────────────────────────────────────

  const PROMPT_TEMPLATE = `You will rewrite a YouTube video into a "readable version", divided into several sections by content topics. The goal is to allow readers to fully understand what the video is about through reading, as if they were reading a blog post.

Video link: {videoUrl}

Output requirements:

1. Overview
Summarize the core topic and conclusion of the video in one paragraph.

2. Organize by topics
- Each section needs to be expanded in detail based on the video content, so I don't need to watch the video again for details. Each section should be at least 500 words.
- If methods/frameworks/processes appear, rewrite them into clear steps or paragraphs.
- If there are key numbers, definitions, or quotes, keep the core terms and add annotations in parentheses.

3. Framework & Mindset
What frameworks & mindsets can be abstracted from the video? Rewrite them into clear steps or paragraphs. Each framework & mindset should be at least 500 words.

Style and constraints:
- Never over-condense!
- Don't add new facts; if there are ambiguous statements, maintain the original meaning and note the uncertainty.
- Keep proper nouns in their original language and provide translations in parentheses (if they appear in the transcription or can be directly translated).
- Don't reflect requirement-type questions (such as > 500 words).
- Avoid too much content in one paragraph; break it into multiple logical paragraphs (using bullet points).
- When referencing specific moments from the video, include the timestamp in [MM:SS] format.
- Answer in {language}`;

  // Minimal markdown renderer (mirrors options.js — headings, bold/italic,
  // inline & fenced code, lists, blockquotes, links, hr). Input is HTML-escaped
  // first; timestamp tokens like [12:34] are left as plain text and converted
  // to clickable buttons in a post-processing step.
  const _esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const _renderInline = (s) => s
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');

  const renderMarkdown = (raw) => {
    let text = _esc(raw);
    const codeBlocks = [];
    text = text.replace(/```([a-z0-9]*)\n?([\s\S]*?)```/gi, (_m, _lang, code) => {
      const i = codeBlocks.length;
      codeBlocks.push(`<pre><code>${code.replace(/\n$/, "")}</code></pre>`);
      return `\x00CB${i}\x00`;
    });

    const lines = text.split(/\r?\n/);
    const out = [];
    let listType = null;
    let inBlockquote = false;
    let paragraphBuf = [];
    const flushP = () => { if (paragraphBuf.length) { out.push(`<p>${paragraphBuf.join("<br>")}</p>`); paragraphBuf = []; } };
    const closeList = () => { if (listType) { out.push(`</${listType}>`); listType = null; } };
    const closeBq = () => { if (inBlockquote) { out.push("</blockquote>"); inBlockquote = false; } };

    for (const raw2 of lines) {
      const line = raw2.trimEnd();
      if (!line.trim()) { flushP(); closeList(); closeBq(); continue; }
      if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(line.trim())) { flushP(); closeList(); closeBq(); out.push("<hr>"); continue; }
      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) { flushP(); closeList(); closeBq(); out.push(`<h${h[1].length}>${_renderInline(h[2].trim())}</h${h[1].length}>`); continue; }
      if (line.startsWith("&gt; ") || line.startsWith("> ")) {
        flushP(); closeList();
        if (!inBlockquote) { out.push("<blockquote>"); inBlockquote = true; }
        out.push(`<p>${_renderInline(line.replace(/^(&gt;|>)\s+/, ""))}</p>`);
        continue;
      }
      closeBq();
      const ul = line.match(/^\s*[-*+]\s+(.*)$/);
      if (ul) { flushP(); if (listType !== "ul") { closeList(); out.push("<ul>"); listType = "ul"; } out.push(`<li>${_renderInline(ul[1])}</li>`); continue; }
      const ol = line.match(/^\s*\d+\.\s+(.*)$/);
      if (ol) { flushP(); if (listType !== "ol") { closeList(); out.push("<ol>"); listType = "ol"; } out.push(`<li>${_renderInline(ol[1])}</li>`); continue; }
      closeList();
      paragraphBuf.push(_renderInline(line));
    }
    flushP(); closeList(); closeBq();

    let html = out.join("\n");
    html = html.replace(/\x00CB(\d+)\x00/g, (_m, i) => codeBlocks[Number(i)]);
    return html;
  };

  // Walk rendered DOM, swap [MM:SS] text patterns with click-to-seek buttons.
  const linkifyTimestampsInOverlay = (root) => {
    const tsRE = /\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/g;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => tsRE.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
    });
    const targets = [];
    let cur;
    while ((cur = walker.nextNode())) targets.push(cur);

    targets.forEach((textNode) => {
      tsRE.lastIndex = 0;
      const parent = textNode.parentNode;
      const value  = textNode.nodeValue;
      const frag   = document.createDocumentFragment();
      let lastIdx  = 0;
      let m;
      while ((m = tsRE.exec(value)) !== null) {
        if (m.index > lastIdx) frag.appendChild(document.createTextNode(value.slice(lastIdx, m.index)));
        const secs = m[3] !== undefined
          ? +m[1] * 3600 + +m[2] * 60 + +m[3]
          : +m[1] * 60 + +m[2];
        const btn = document.createElement("button");
        btn.className   = "vn-ts-link";
        btn.textContent = m[0];
        btn.addEventListener("click", () => {
          if (videoEl) { videoEl.currentTime = secs; videoEl.play().catch(() => {}); }
        });
        frag.appendChild(btn);
        lastIdx = m.index + m[0].length;
      }
      if (lastIdx < value.length) frag.appendChild(document.createTextNode(value.slice(lastIdx)));
      parent.replaceChild(frag, textNode);
    });
  };

  // Gemini's streaming response sometimes appends an internal conversation
  // link (http://googleusercontent.com/lmdx_content/<long-hash>) to the
  // summary text. Strip any trailing instance so it never reaches storage
  // or the UI. Stripping mid-stream is fine — partial URLs match the same
  // pattern, so the noise stays out the whole time.
  const cleanSummaryText = (text) => (text || "")
    .replace(/\s*https?:\/\/googleusercontent\.com\/lmdx_content\/\S+\s*$/i, "")
    .trim();

  const renderSummary = (text) => {
    const cleaned = cleanSummaryText(text);
    summaryText = cleaned;
    ui.summary.innerHTML = "";
    if (!cleaned) { ui.summary.classList.remove("vn-summary-visible"); return; }
    ui.summary.classList.add("vn-summary-visible");
    ui.summary.innerHTML = renderMarkdown(cleaned);
    linkifyTimestampsInOverlay(ui.summary);
  };

  const startSummarize = () => {
    if (summarizing) return;
    if (getPlatform() !== "youtube") { setStatus(t.noTranscript); return; }
    summarizing = true;
    ui.summarize.disabled = true;
    ui.summarizeLabel.textContent = t.summarizing;
    renderSummary("");
    setAiState("loading");
    const language = locale === "en" ? "English" : "Chinese";
    const prompt = PROMPT_TEMPLATE
      .replace("{videoUrl}", videoMeta.url)
      .replace("{language}", language);
    chrome.runtime.sendMessage({ type: "VN_SUMMARIZE", prompt }, (resp) => {
      if (!resp?.ok) {
        summarizing = false;
        ui.summarize.disabled = false;
        ui.summarizeLabel.textContent = t.summarize;
        setAiState("empty");
        setStatus(t.summaryFailed);
      }
    });
  };

  ui.summarize.addEventListener("click", startSummarize);
  ui.aiRegen.addEventListener("click", () => {
    setAiState("empty");
    switchTab("ai");
    startSummarize();
  });

  ui.aiCopy.addEventListener("click", async () => {
    if (summaryText) { await copyText(summaryText); setStatus(t.copied); }
  });

  ui.aiExport.addEventListener("click", () => {
    if (!summaryText) return;
    const lines = [`# ${videoMeta.title || "Untitled"} — AI 摘要`, videoMeta.url, "", summaryText];
    const blob  = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement("a");
    a.href      = url;
    a.download  = `${(videoMeta.title || "summary").replace(/[^a-zA-Z0-9_-]+/g, "-")}-ai.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus(t.exported);
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "VN_SUMMARY_CHUNK") {
      setAiState("done");
      renderSummary(message.text);
      return;
    }
    if (message.type === "VN_SUMMARY_DONE") {
      summarizing = false;
      ui.summarize.disabled = false;
      ui.summarizeLabel.textContent = t.summarize;
      summaryUpdatedAt = Date.now();
      savePayload();
      setStatus(t.summaryDone);
      return;
    }
    if (message.type === "VN_SUMMARY_ERROR") {
      summarizing = false;
      ui.summarize.disabled = false;
      ui.summarizeLabel.textContent = t.summarize;
      setAiState("empty");
      const msg = (message.error === "not_logged_in" || message.error === "auth_failed")
        ? t.notLoggedIn
        : t.summaryFailed;
      setStatus(msg);
    }
  });

  // ── Toggle / manage / lang ────────────────────────────────

  ui.toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    setCollapsed(!collapsed);
  });

  ui.settings.addEventListener("click", (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ type: "VN_OPEN_OPTIONS" }, (resp) => {
      if (!resp?.ok) setStatus(t.openFailed);
    });
  });


  ui.langToggle.addEventListener("click", () => {
    setLocale(locale === "en" ? "zh" : "en");
  });

  // ── Storage change listeners ──────────────────────────────

  chrome.storage.local.get([LOCALE_KEY, ENABLED_KEY], (result) => {
    const stored = result[LOCALE_KEY];
    if (stored === "en" || stored === "zh") setLocale(stored, { persist: false });
    if (typeof result[ENABLED_KEY] === "boolean") setEnabled(result[ENABLED_KEY]);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[ENABLED_KEY]) setEnabled(changes[ENABLED_KEY].newValue);
    if (changes[LOCALE_KEY])  setLocale(changes[LOCALE_KEY].newValue, { persist: false });
  });

  // ── Main init loop ────────────────────────────────────────

  const init = async () => {
    showRoot(false);
    updateMode();
    setInterval(updateTime, 500);

    new MutationObserver(() => {
      const latest = findVideo();
      if (latest && latest !== videoEl) {
        videoEl = latest;
        if (isVideoPage()) attach();
      }
    }).observe(document.documentElement, { childList: true, subtree: true });

    const tick = async () => {
      const urlChanged = currentUrl !== location.href;
      if (urlChanged) { currentUrl = location.href; videoEl = null; }
      if (!enabled || !isVideoPage()) { showRoot(false); return; }
      showRoot(true);
      updateMode();
      if (!videoEl) { const found = findVideo(); if (found) videoEl = found; }
      if (videoEl) {
        const prevKey = storageKey();
        syncMeta();
        if (urlChanged || prevKey !== storageKey()) {
          await loadPayload();
          renderNotes();
          if (summaryText) { renderSummary(summaryText); setAiState("done"); }
          else             { renderSummary(""); setAiState("empty"); }
        }
      }
    };

    setInterval(() => tick().catch(() => {}), 800);

    if (enabled && isVideoPage()) {
      videoEl = await waitForVideo();
      await attach();
      showRoot(true);
    }
  };

  init();
})();
