// Gemini Web internal API client — uses the user's logged-in cookies, no API key.
// Adapted from TubeNote's reverse-engineered implementation.

class GeminiClient {
  constructor() {
    this.baseUrl = "https://gemini.google.com";
    this.apiPath = "/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate";
    this.cookies = null;
    this.reqId = Math.floor(Math.random() * 10000000);
    this.snlm0e = null;
    this.conversationId = null;
    this.uiLanguage = chrome.i18n.getUILanguage();
  }

  async fetchTokens() {
    const resp = await fetch(`${this.baseUrl}/app`, { credentials: "include" });
    const html = await resp.text();
    const m = html.match(/"SNlM0e":"([^"]+)"/);
    if (m) this.snlm0e = m[1];
    return this.snlm0e !== null;
  }

  async getCookies() {
    const domains = [".google.com", "google.com", ".gemini.google.com", "gemini.google.com"];
    let all = [];
    for (const d of domains) {
      try {
        const cs = await chrome.cookies.getAll({ domain: d });
        all = all.concat(cs);
      } catch {}
    }
    const wanted = [
      "__Secure-1PSID", "__Secure-3PSID",
      "__Secure-1PSIDCC", "__Secure-3PSIDCC",
      "SAPISID", "__Secure-1PAPISID", "__Secure-3PAPISID",
    ];
    const critical = ["__Secure-1PSID", "SAPISID"];
    const map = {};
    all.forEach((c) => { if (wanted.includes(c.name)) map[c.name] = c.value; });
    const missing = critical.filter((n) => !map[n]);
    if (missing.length) throw new Error("not_logged_in");
    this.cookies = map;
    return map;
  }

  async generateSapisidHash() {
    const ts = Math.floor(Date.now() / 1000);
    const data = `${ts} ${this.cookies.SAPISID} ${this.baseUrl}`;
    const buf = new TextEncoder().encode(data);
    const hash = await crypto.subtle.digest("SHA-1", buf);
    const hex = Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return `${ts}_${hex}`;
  }

  buildRequestBody(prompt) {
    const reqData = [
      null,
      JSON.stringify([
        [prompt, 0, null, null, null, null, 0],
        [this.uiLanguage],
        [""],
        "", "",
        null,
        [1], 1,
        null, null, 1, 0,
        null, null, null, null, null,
        [[0]], 0,
      ]),
    ];
    const params = new URLSearchParams();
    params.append("f.req", JSON.stringify(reqData));
    if (this.snlm0e) params.append("at", this.snlm0e);
    return params.toString();
  }

  buildRequestUrl() {
    const params = new URLSearchParams({
      bl: "boq_assistant-bard-web-server_20251014.06_p0",
      "f.sid": String(Math.floor(Math.random() * -1e19)),
      hl: this.uiLanguage,
      _reqid: String(this.reqId++),
      rt: "c",
    });
    return `${this.baseUrl}${this.apiPath}?${params.toString()}`;
  }

  parseStreamingResponse(text) {
    text = text.replace(/^\)\]\}'\n?/, "");
    const lines = text.split("\n").filter((l) => l.trim());
    let latest = "";
    for (const line of lines) {
      if (/^\d+$/.test(line)) continue;
      try {
        const data = JSON.parse(line);
        if (Array.isArray(data) && data[0] && data[0][0] === "wrb.fr") {
          const inner = data[0][2];
          if (typeof inner !== "string") continue;
          const obj = JSON.parse(inner);
          if (obj?.[1]?.[0] && typeof obj[1][0] === "string") {
            this.conversationId = obj[1][0];
          }
          if (Array.isArray(obj?.[4])) {
            for (const chunk of obj[4]) {
              if (Array.isArray(chunk?.[1]) && typeof chunk[1][0] === "string" && chunk[1][0].trim()) {
                latest = chunk[1][0];
              }
            }
          }
        }
      } catch {}
    }
    return latest;
  }

  async streamGenerate(prompt, onChunk) {
    if (!this.cookies) await this.getCookies();
    if (!this.snlm0e) {
      const ok = await this.fetchTokens();
      if (!ok) throw new Error("token_fetch_failed");
    }
    await this.generateSapisidHash();

    const url = this.buildRequestUrl();
    const body = this.buildRequestBody(prompt);

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "X-Goog-AuthUser": "0",
        "X-Same-Domain": "1",
        "Origin": this.baseUrl,
        "Referer": `${this.baseUrl}/app`,
      },
      body,
      credentials: "include",
    });

    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) throw new Error("auth_failed");
      throw new Error(`api_failed_${resp.status}`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let full = "";
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parsed = this.parseStreamingResponse(buf);
      if (parsed && parsed !== full) {
        full = parsed;
        if (onChunk) onChunk(full);
      }
    }
    return full;
  }

  getConversationUrl() {
    if (!this.conversationId) return null;
    let id = this.conversationId;
    if (id.startsWith("c_")) id = id.substring(2);
    return `${this.baseUrl}/app/${id}`;
  }
}

self.GeminiClient = GeminiClient;
