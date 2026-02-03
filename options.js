const list = document.getElementById("list");
const empty = document.getElementById("empty");
const refreshBtn = document.getElementById("refresh");
const exportAllBtn = document.getElementById("export-all");

const formatTime = (seconds) => {
  const total = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const hh = h > 0 ? String(h).padStart(2, "0") + ":" : "";
  return `${hh}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const exportPayload = (payload) => {
  const lines = [];
  lines.push(`# ${payload.title || "Untitled"}`);
  lines.push(payload.url || "");
  lines.push("");
  payload.notes.forEach((note) => {
    lines.push(`- [${formatTime(note.t)}] ${note.text}`);
  });
  return lines.join("\n");
};

const downloadText = (text, filename) => {
  const blob = new Blob([text], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const loadAll = () => {
  chrome.storage.local.get(null, (items) => {
    const entries = Object.entries(items)
      .filter(([key]) => key.startsWith("vn:"))
      .map(([key, payload]) => ({ key, payload }))
      .sort((a, b) => (b.payload?.updatedAt || 0) - (a.payload?.updatedAt || 0));

    list.innerHTML = "";
    empty.style.display = entries.length ? "none" : "block";

    entries.forEach(({ key, payload }) => {
      const card = document.createElement("div");
      card.className = "card";

      const title = document.createElement("h3");
      title.textContent = payload.title || "Untitled";

      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = `${payload.platform || ""} · ${payload.id || ""}`;

      const link = document.createElement("a");
      link.href = payload.url || "#";
      link.textContent = payload.url || "";
      link.target = "_blank";
      link.rel = "noreferrer";
      link.style.fontSize = "12px";
      link.style.color = "#0ea5e9";

      const cardActions = document.createElement("div");
      cardActions.className = "card-actions";

      const exportBtn = document.createElement("button");
      exportBtn.textContent = "Export";
      exportBtn.addEventListener("click", () => {
        const safeTitle = (payload.title || "notes").replace(/[^a-zA-Z0-9_-]+/g, "-");
        downloadText(exportPayload(payload), `${safeTitle || "notes"}.md`);
      });

      const clearBtn = document.createElement("button");
      clearBtn.textContent = "Delete Video Notes";
      clearBtn.addEventListener("click", () => {
        chrome.storage.local.remove(key, loadAll);
      });

      cardActions.appendChild(exportBtn);
      cardActions.appendChild(clearBtn);

      card.appendChild(title);
      card.appendChild(meta);
      card.appendChild(link);
      card.appendChild(cardActions);

      payload.notes.forEach((note, idx) => {
        const row = document.createElement("div");
        row.className = "note";

        const time = document.createElement("div");
        time.className = "time";
        time.textContent = `${formatTime(note.t)} · ${new Date(note.createdAt).toLocaleString()}`;

        const text = document.createElement("div");
        text.className = "text";
        text.textContent = note.text;

        const actions = document.createElement("div");
        actions.className = "note-actions";

        const editBtn = document.createElement("button");
        editBtn.textContent = "Edit";

        const delBtn = document.createElement("button");
        delBtn.textContent = "Delete";

        editBtn.addEventListener("click", () => {
          const textarea = document.createElement("textarea");
          textarea.value = note.text;
          row.replaceChild(textarea, text);

          const saveBtn = document.createElement("button");
          saveBtn.textContent = "Save";
          const cancelBtn = document.createElement("button");
          cancelBtn.textContent = "Cancel";

          actions.innerHTML = "";
          actions.appendChild(saveBtn);
          actions.appendChild(cancelBtn);

          saveBtn.addEventListener("click", () => {
            note.text = textarea.value.trim();
            chrome.storage.local.set({ [key]: payload }, loadAll);
          });

          cancelBtn.addEventListener("click", () => loadAll());
        });

        delBtn.addEventListener("click", () => {
          payload.notes.splice(idx, 1);
          chrome.storage.local.set({ [key]: payload }, loadAll);
        });

        actions.appendChild(editBtn);
        actions.appendChild(delBtn);

        row.appendChild(time);
        row.appendChild(text);
        row.appendChild(actions);
        card.appendChild(row);
      });

      list.appendChild(card);
    });
  });
};

exportAllBtn.addEventListener("click", () => {
  chrome.storage.local.get(null, (items) => {
    const payloads = Object.values(items).filter((item) => item && item.notes);
    const merged = payloads
      .map((payload) => exportPayload(payload))
      .join("\n\n---\n\n");
    downloadText(merged || "", "all-notes.md");
  });
});

refreshBtn.addEventListener("click", loadAll);
loadAll();
