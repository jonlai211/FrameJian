// Shared utilities used by both the overlay (content.js) and the library
// page (options.js). Loaded as the first script in each context so its
// top-level declarations are visible to the consumer.
//
// Note: no `export` — content scripts share a single isolated world, and
// options.html uses plain <script> tags. Everything below lives on the
// outer (global) scope.

const fjFormatTime = (seconds) => {
  const total = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const hh = h > 0 ? String(h).padStart(2, "0") + ":" : "";
  return `${hh}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const fjFormatDate = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${dd} ${hh}:${mm}`;
};

// URL values often come from third-party pages (location.href, og:image).
// Only allow http(s)/mailto schemes through; "#" otherwise.
const fjSafeUrl = (url) => {
  if (!url) return "#";
  try {
    const u = new URL(url, location.href);
    return /^(https?|mailto):$/.test(u.protocol) ? url : "#";
  } catch { return "#"; }
};

const fjEscapeHtml = (s) => s
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;");

const _fjRenderInline = (s) => s
  .replace(/`([^`\n]+)`/g, "<code>$1</code>")
  .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
  .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
  .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');

// Minimal markdown renderer — headings, bold/italic, inline & fenced code,
// `-`/`*`/`1.` lists, `>` blockquotes, [text](url), `---` hr. Input is
// HTML-escaped first. Timestamp tokens like [12:34] are left as plain text
// so a follow-up `fjLinkifyTimestamps()` pass can swap them for click links.
const fjRenderMarkdown = (raw) => {
  let text = fjEscapeHtml(raw);

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
    if (h) { flushP(); closeList(); closeBq(); out.push(`<h${h[1].length}>${_fjRenderInline(h[2].trim())}</h${h[1].length}>`); continue; }
    if (line.startsWith("&gt; ") || line.startsWith("> ")) {
      flushP(); closeList();
      if (!inBlockquote) { out.push("<blockquote>"); inBlockquote = true; }
      out.push(`<p>${_fjRenderInline(line.replace(/^(&gt;|>)\s+/, ""))}</p>`);
      continue;
    }
    closeBq();
    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    if (ul) { flushP(); if (listType !== "ul") { closeList(); out.push("<ul>"); listType = "ul"; } out.push(`<li>${_fjRenderInline(ul[1])}</li>`); continue; }
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ol) { flushP(); if (listType !== "ol") { closeList(); out.push("<ol>"); listType = "ol"; } out.push(`<li>${_fjRenderInline(ol[1])}</li>`); continue; }
    closeList();
    paragraphBuf.push(_fjRenderInline(line));
  }
  flushP(); closeList(); closeBq();

  let html = out.join("\n");
  html = html.replace(/\x00CB(\d+)\x00/g, (_m, i) => codeBlocks[Number(i)]);
  return html;
};

// Walk a rendered DOM tree and swap [MM:SS] text patterns for an element
// produced by `makeLink(seconds, label)`. The caller decides whether to
// build a button (overlay → seek the video) or an anchor (options → open
// the video at that timestamp in a new tab).
const fjLinkifyTimestamps = (root, makeLink) => {
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
      frag.appendChild(makeLink(secs, m[0]));
      lastIdx = m.index + m[0].length;
    }
    if (lastIdx < value.length) frag.appendChild(document.createTextNode(value.slice(lastIdx)));
    parent.replaceChild(frag, textNode);
  });
};

// Gemini's streaming sometimes appends a private conversation link to the
// summary text. Strip a trailing instance so storage and UI stay clean.
const fjCleanSummaryText = (text) => (text || "")
  .replace(/\s*https?:\/\/googleusercontent\.com\/lmdx_content\/\S+\s*$/i, "")
  .trim();

// Common UI words shared between overlay and library page. Each context
// spreads this into its own STRINGS object so adding a translation here
// fixes both at once.
const FJ_STRINGS_COMMON = {
  en: {
    save:    "Save",
    cancel:  "Cancel",
    copy:    "Copy",
    edit:    "Edit",
    delete:  "Delete",
    export:  "Export",
    copied:  "Copied",
    untitled:"Untitled",
  },
  zh: {
    save:    "保存",
    cancel:  "取消",
    copy:    "复制",
    edit:    "编辑",
    delete:  "删除",
    export:  "导出",
    copied:  "已复制",
    untitled:"Untitled",
  },
};
