/**
 * 班级民心意见箱 - 精简版前端交互逻辑
 */

(function () {
  const storage = window.voiceStorage;

  let allFeedbacks = [];
  let selectedCategory = "study";
  let selectedIsPublic = true;
  let currentWallCat = "all";
  let currentWallSort = "upvotes";
  let isAdminUnlocked = sessionStorage.getItem("class_voice_admin_unlocked") === "1";

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function showToast(msg) {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const item = document.createElement("div");
    item.className = "toast-item";
    item.textContent = msg;
    container.appendChild(item);
    setTimeout(() => item.remove(), 2500);
  }

  function renderBranding() {
    const cfg = storage.loadMergedConfig();
    document.title = cfg.siteTitle || "班级民心意见箱";
    document.getElementById("navSiteTitle").textContent = cfg.siteTitle || "班级民心意见箱";
    document.getElementById("navClassName").textContent = cfg.className || "匿名倾听 · 班会回应";
  }

  function initSelectors() {
    const catGrid = document.getElementById("categoryGrid");
    catGrid.innerHTML = window.CATEGORIES.map(cat => `
      <div class="category-option ${cat.id === selectedCategory ? "selected" : ""}" data-id="${cat.id}">
        <span>${cat.icon}</span>
        <span>${cat.name}</span>
      </div>
    `).join("");

    catGrid.querySelectorAll(".category-option").forEach(el => {
      el.addEventListener("click", () => {
        selectedCategory = el.dataset.id;
        catGrid.querySelectorAll(".category-option").forEach(c => c.classList.remove("selected"));
        el.classList.add("selected");
      });
    });

    const wallFilters = document.getElementById("wallCategoryFilters");
    wallFilters.innerHTML =
      `<button type="button" class="filter-pill active" data-cat="all">全部</button>` +
      window.CATEGORIES.map(cat => `
        <button type="button" class="filter-pill" data-cat="${cat.id}">${cat.icon} ${cat.name}</button>
      `).join("");

    wallFilters.querySelectorAll(".filter-pill").forEach(btn => {
      btn.addEventListener("click", () => {
        currentWallCat = btn.dataset.cat;
        wallFilters.querySelectorAll(".filter-pill").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        renderPublicWall();
      });
    });
  }

  async function refreshData() {
    allFeedbacks = await storage.getAllFeedbacks();
    const publicCount = allFeedbacks.filter(item => item.isPublic !== false).length;
    document.getElementById("publicCountBadge").textContent = publicCount;
    renderPublicWall();
    renderMyLocalReceipts();
    if (isAdminUnlocked) {
      renderAdminDashboard();
    }
  }

  function renderPublicWall() {
    const grid = document.getElementById("publicWallGrid");
    const upvotedIds = storage.getUpvotedIds();

    let list = allFeedbacks.filter(item => item.isPublic !== false);
    if (currentWallCat !== "all") {
      list = list.filter(item => item.category === currentWallCat);
    }

    if (currentWallSort === "upvotes") {
      list.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
    } else {
      list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    }

    if (list.length === 0) {
      grid.innerHTML = `
        <div class="glass-card" style="text-align: center; padding: 2.5rem 1.5rem; color: var(--text-muted);">
          该分类下暂无公开意见
        </div>
      `;
      return;
    }

    grid.innerHTML = list.map(item => {
      const cat = window.CATEGORIES.find(c => c.id === item.category) || window.CATEGORIES[0];
      const st = window.STATUS_MAP[item.status] || window.STATUS_MAP.pending;
      const isUpvoted = upvotedIds.includes(item.id);

      return `
        <article class="feedback-card">
          <div class="card-top-bar">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="receipt-tag">#${escapeHtml(item.receiptCode)}</span>
              <span class="cat-pill-sm" style="background: ${cat.bg}; color: ${cat.color};">
                ${cat.icon} ${cat.name}
              </span>
            </div>
            <span class="status-badge ${st.className}">${st.icon} ${st.label}</span>
          </div>

          <h3 class="card-title">${escapeHtml(item.title)}</h3>
          <p class="card-content">${escapeHtml(item.content)}</p>

          ${item.meetingNote ? `
            <div class="card-meeting-note">
              <strong>🎙️ 班会/班委回应：</strong>${escapeHtml(item.meetingNote)}
            </div>
          ` : ""}

          <div class="card-footer">
            <span class="card-time">${escapeHtml(item.createdAt)}</span>
            <button type="button" class="upvote-btn ${isUpvoted ? "upvoted" : ""}" data-upvote-id="${escapeHtml(item.id)}">
              <span>👍 附议</span>
              <span>${item.upvotes || 1}</span>
            </button>
          </div>
        </article>
      `;
    }).join("");

    grid.querySelectorAll("[data-upvote-id]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-upvote-id");
        const res = await storage.toggleUpvote(id);
        if (res) {
          await refreshData();
        }
      });
    });
  }

  function renderLookupResult(codeRaw) {
    const container = document.getElementById("lookupResultContainer");
    const code = (codeRaw || "").trim().toUpperCase().replace(/^#/, "");
    if (!code) {
      container.innerHTML = "";
      return;
    }

    const found = allFeedbacks.find(item => item.receiptCode.toUpperCase() === code);
    if (!found) {
      container.innerHTML = `
        <div class="receipt-ticket" style="border-color: var(--rose); text-align: center;">
          <h4 style="font-size: 0.96rem; font-weight: 800;">未找到回执码「${escapeHtml(code)}」</h4>
          <p style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.25rem;">
            请检查回执码格式是否正确（如 <code>MX-8A3F</code>）
          </p>
        </div>
      `;
      return;
    }

    const cat = window.CATEGORIES.find(c => c.id === found.category) || window.CATEGORIES[0];
    const st = window.STATUS_MAP[found.status] || window.STATUS_MAP.pending;
    const followUps = Array.isArray(found.followUps) ? found.followUps : [];

    container.innerHTML = `
      <div class="receipt-ticket">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <span class="receipt-tag" style="font-size: 0.95rem;">#${escapeHtml(found.receiptCode)}</span>
          <span class="status-badge ${st.className}">${st.icon} ${st.label}</span>
        </div>

        <div class="ticket-divider"></div>

        <div style="font-size: 0.8rem; font-weight: 700; color: ${cat.color}; margin-bottom: 0.25rem;">
          ${cat.icon} ${cat.name} · 投递于 ${escapeHtml(found.createdAt)}
        </div>
        <h4 style="font-size: 1.06rem; font-weight: 800; margin-bottom: 0.45rem;">${escapeHtml(found.title)}</h4>
        <p style="font-size: 0.88rem; color: var(--text-secondary); white-space: pre-line; margin-bottom: 0.75rem;">${escapeHtml(found.content)}</p>

        <div class="card-meeting-note">
          <strong>🎙️ 班会进度与回应：</strong><br/>
          ${found.meetingNote ? escapeHtml(found.meetingNote) : escapeHtml(st.desc)}
        </div>

        ${followUps.length > 0 ? `
          <div style="margin-top: 0.75rem; background: var(--bg-subtle); padding: 0.7rem; border-radius: 10px; font-size: 0.82rem;">
            <div style="font-weight: 700; margin-bottom: 0.3rem;">📝 补充记录：</div>
            ${followUps.map(f => `<div style="color: var(--text-secondary);">[${escapeHtml(f.time)}] ${escapeHtml(f.text)}</div>`).join("")}
          </div>
        ` : ""}

        <div style="display: flex; gap: 0.5rem; margin-top: 0.9rem; padding-top: 0.85rem; border-top: 1px dashed var(--border-strong);">
          <input type="text" id="followUpInput" class="form-input" placeholder="凭此回执码继续匿名补充说明..." style="padding: 0.55rem 0.85rem; font-size: 0.86rem;" />
          <button type="button" class="btn-secondary" id="submitFollowUpBtn" style="white-space: nowrap;">追加</button>
        </div>
      </div>
    `;

    document.getElementById("submitFollowUpBtn")?.addEventListener("click", async () => {
      const input = document.getElementById("followUpInput");
      const text = (input.value || "").trim();
      if (!text) return;
      await storage.addFollowUpByReceipt(found.receiptCode, text);
      showToast("✅ 已追加补充说明");
      await refreshData();
      renderLookupResult(found.receiptCode);
    });
  }

  function renderMyLocalReceipts() {
    const listEl = document.getElementById("myLocalReceiptsList");
    const myList = storage.getMyReceiptsLocal();

    if (myList.length === 0) {
      listEl.innerHTML = `<div style="text-align: center; padding: 1.2rem; color: var(--text-muted); font-size: 0.85rem;">暂无本机投递记录</div>`;
      return;
    }

    listEl.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 0.6rem;">
        ${myList.map(r => {
          const matched = allFeedbacks.find(f => f.receiptCode === r.receiptCode);
          const st = window.STATUS_MAP[matched?.status || "pending"] || window.STATUS_MAP.pending;
          return `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.7rem 0.95rem; border-radius: 12px; background: var(--bg-subtle); border: 1px solid var(--border-color); gap: 0.75rem; flex-wrap: wrap;">
              <div style="display: flex; align-items: center; gap: 0.65rem;">
                <span class="receipt-tag">#${escapeHtml(r.receiptCode)}</span>
                <span style="font-size: 0.88rem; font-weight: 700;">${escapeHtml(r.title)}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span class="status-badge ${st.className}">${st.icon} ${st.label}</span>
                <button type="button" class="btn-secondary" data-quick-lookup="${escapeHtml(r.receiptCode)}" style="padding: 0.3rem 0.65rem; font-size: 0.76rem;">
                  查看
                </button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;

    listEl.querySelectorAll("[data-quick-lookup]").forEach(btn => {
      btn.addEventListener("click", () => {
        const code = btn.getAttribute("data-quick-lookup");
        document.getElementById("lookupCodeInput").value = code;
        renderLookupResult(code);
      });
    });
  }

  function renderAdminDashboard() {
    document.getElementById("adminTotalCount").textContent = allFeedbacks.length;
    const filterVal = document.getElementById("adminFilterSelect").value;
    let filtered = [...allFeedbacks];
    if (filterVal === "private") {
      filtered = filtered.filter(f => f.isPublic === false);
    } else if (filterVal === "contact") {
      filtered = filtered.filter(f => Boolean(f.contact && f.contact.trim()));
    } else if (filterVal === "pending") {
      filtered = filtered.filter(f => (f.status || "pending") === "pending");
    }

    const listContainer = document.getElementById("adminFeedbackList");
    if (filtered.length === 0) {
      listContainer.innerHTML = `<div class="glass-card" style="text-align: center; color: var(--text-muted);">暂无符合条件的记录</div>`;
      return;
    }

    listContainer.innerHTML = filtered.map(item => {
      const cat = window.CATEGORIES.find(c => c.id === item.category) || window.CATEGORIES[0];
      return `
        <div class="feedback-card">
          <div class="card-top-bar">
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <span class="receipt-tag">#${escapeHtml(item.receiptCode)}</span>
              <span class="cat-pill-sm" style="background: ${cat.bg}; color: ${cat.color};">${cat.icon} ${cat.name}</span>
              <span style="font-size: 0.76rem; color: var(--text-muted);">${item.isPublic !== false ? "📢 公开" : "🔒 仅班委可见"}</span>
            </div>
            <div style="display: flex; gap: 0.45rem; align-items: center;">
              <select class="form-select admin-status-select" data-id="${escapeHtml(item.id)}" style="width: auto; padding: 0.28rem 0.6rem; font-size: 0.78rem; font-weight: 700;">
                <option value="pending" ${item.status === "pending" ? "selected" : ""}>⏳ 待整理</option>
                <option value="agenda" ${item.status === "agenda" ? "selected" : ""}>📋 列入班会</option>
                <option value="resolved" ${item.status === "resolved" ? "selected" : ""}>✅ 已回应</option>
              </select>
              <button type="button" class="btn-secondary admin-delete-btn" data-id="${escapeHtml(item.id)}" style="padding: 0.28rem 0.6rem; font-size: 0.76rem; color: var(--rose);">删除</button>
            </div>
          </div>

          <h4 class="card-title">${escapeHtml(item.title)}</h4>
          <p class="card-content">${escapeHtml(item.content)}</p>

          ${item.contact ? `
            <div style="background: var(--brand-soft); border: 1px solid rgba(79,70,229,0.25); padding: 0.5rem 0.8rem; border-radius: 8px; font-size: 0.82rem; margin-bottom: 0.65rem;">
              <strong>🙋 联系方式：</strong>${escapeHtml(item.contact)}
            </div>
          ` : ""}

          <div style="display: flex; gap: 0.5rem;">
            <input
              type="text"
              class="form-input admin-note-input"
              data-id="${escapeHtml(item.id)}"
              value="${escapeHtml(item.meetingNote || "")}"
              placeholder="添加班会处理备注（选填）..."
              style="padding: 0.45rem 0.75rem; font-size: 0.83rem;"
            />
            <button type="button" class="btn-secondary admin-save-note-btn" data-id="${escapeHtml(item.id)}" style="white-space: nowrap;">💾 保存</button>
          </div>
        </div>
      `;
    }).join("");

    listContainer.querySelectorAll(".admin-status-select").forEach(sel => {
      sel.addEventListener("change", async () => {
        const id = sel.getAttribute("data-id");
        await storage.updateFeedbackAdmin(id, { status: sel.value });
        showToast("✅ 状态已更新");
        await refreshData();
      });
    });

    listContainer.querySelectorAll(".admin-save-note-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const input = listContainer.querySelector(`.admin-note-input[data-id="${id}"]`);
        await storage.updateFeedbackAdmin(id, { meetingNote: input ? input.value.trim() : "" });
        showToast("💾 备注已保存");
        await refreshData();
      });
    });

    listContainer.querySelectorAll(".admin-delete-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        if (!confirm("确定删除这条意见吗？")) return;
        await storage.deleteFeedback(id);
        await refreshData();
      });
    });
  }

  function exportToCsv() {
    const headers = ["回执码", "分类", "主题", "内容", "附议数", "是否公开", "联系方式", "状态", "班会备注", "提交时间"];
    const rows = allFeedbacks.map(f => {
      const cat = window.CATEGORIES.find(c => c.id === f.category)?.name || "";
      const st = window.STATUS_MAP[f.status]?.label || "";
      return [
        f.receiptCode,
        cat,
        f.title,
        f.content,
        f.upvotes || 1,
        f.isPublic !== false ? "是" : "否",
        f.contact || "",
        st,
        f.meetingNote || "",
        f.createdAt
      ].map(cell => `"${String(cell || "").replace(/"/g, '""')}"`).join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `班级意见台账_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function switchTab(target) {
    document.querySelectorAll(".tab-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.tab === target);
    });
    document.querySelectorAll(".tab-panel").forEach(p => {
      p.classList.toggle("active", p.id === `panel-${target}`);
    });
  }

  function bindEvents() {
    const savedTheme = localStorage.getItem("class_voice_theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
    document.getElementById("themeIcon").textContent = savedTheme === "dark" ? "☀️" : "🌙";

    document.getElementById("themeToggleBtn").addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("class_voice_theme", next);
      document.getElementById("themeIcon").textContent = next === "dark" ? "☀️" : "🌙";
    });

    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    document.getElementById("footerAdminLink").addEventListener("click", (e) => {
      e.preventDefault();
      switchTab("admin");
    });

    const radioCards = document.querySelectorAll("#publicRadioGroup .radio-card");
    radioCards.forEach(card => {
      card.addEventListener("click", () => {
        radioCards.forEach(c => c.classList.remove("selected"));
        card.classList.add("selected");
        const radio = card.querySelector("input[type='radio']");
        if (radio) radio.checked = true;
        selectedIsPublic = card.getAttribute("data-public") === "true";
      });
    });

    document.getElementById("feedbackForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById("submitBtn");
      submitBtn.disabled = true;
      submitBtn.innerHTML = "<span>⏳ 提交中...</span>";

      try {
        const created = await storage.addFeedback({
          category: selectedCategory,
          mood: "suggest",
          title: document.getElementById("fbTitle").value,
          content: document.getElementById("fbContent").value,
          suggestion: "",
          isPublic: selectedIsPublic,
          contact: document.getElementById("fbContact").value
        });

        document.getElementById("fbTitle").value = "";
        document.getElementById("fbContent").value = "";
        document.getElementById("fbContact").value = "";

        document.getElementById("modalReceiptCode").textContent = created.receiptCode;
        document.getElementById("modalReceiptTitle").textContent = created.title;
        document.getElementById("receiptModal").classList.add("open");
        await refreshData();
      } catch (err) {
        alert("提交遇到问题：" + err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = "<span>🚀 提交意见并生成回执码</span>";
      }
    });

    document.getElementById("copyReceiptBtn").addEventListener("click", () => {
      const code = document.getElementById("modalReceiptCode").textContent.trim();
      navigator.clipboard.writeText(code).then(() => showToast(`📋 已复制回执码 ${code}`));
    });

    document.getElementById("closeReceiptModalBtn").addEventListener("click", () => {
      document.getElementById("receiptModal").classList.remove("open");
    });

    document.getElementById("wallSortSelect").addEventListener("change", (e) => {
      currentWallSort = e.target.value;
      renderPublicWall();
    });

    document.getElementById("lookupSearchBtn").addEventListener("click", () => {
      renderLookupResult(document.getElementById("lookupCodeInput").value);
    });
    document.getElementById("lookupCodeInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") renderLookupResult(e.target.value);
    });

    document.getElementById("clearMyReceiptsBtn").addEventListener("click", () => {
      storage.clearMyReceiptsLocal();
      renderMyLocalReceipts();
      showToast("已清空本机记录");
    });

    function updateAdminView() {
      document.getElementById("adminLockCard").style.display = isAdminUnlocked ? "none" : "block";
      document.getElementById("adminDashboard").style.display = isAdminUnlocked ? "block" : "none";
      if (isAdminUnlocked) renderAdminDashboard();
    }
    updateAdminView();

    document.getElementById("adminUnlockBtn").addEventListener("click", () => {
      const val = document.getElementById("adminPassInput").value.trim();
      const cfg = storage.loadMergedConfig();
      const expected = (!cfg.adminPasscode || cfg.adminPasscode === "8888") ? "1145141919810" : String(cfg.adminPasscode);
      if (val === expected) {
        isAdminUnlocked = true;
        sessionStorage.setItem("class_voice_admin_unlocked", "1");
        updateAdminView();
      } else {
        showToast("❌ 口令不正确");
      }
    });

    document.getElementById("adminFilterSelect").addEventListener("change", renderAdminDashboard);
    document.getElementById("exportCsvBtn").addEventListener("click", exportToCsv);

    document.getElementById("clearDemoBtn").addEventListener("click", async () => {
      if (!confirm("确定清空示例数据吗？")) return;
      await storage.clearDemoData();
      await refreshData();
      showToast("🧹 已清空示例数据");
    });

    document.getElementById("openConfigModalBtn").addEventListener("click", () => {
      const cfg = storage.loadMergedConfig();
      document.getElementById("cfgSiteTitle").value = cfg.siteTitle || "班级民心意见箱";
      document.getElementById("cfgClassName").value = cfg.className || "";
      document.getElementById("cfgAdminPass").value = (!cfg.adminPasscode || cfg.adminPasscode === "8888") ? "1145141919810" : cfg.adminPasscode;
      document.getElementById("configModal").classList.add("open");
    });

    document.getElementById("closeConfigModalBtn").addEventListener("click", () => {
      document.getElementById("configModal").classList.remove("open");
    });

    document.getElementById("saveConfigBtn").addEventListener("click", () => {
      storage.saveConfigOverride({
        siteTitle: document.getElementById("cfgSiteTitle").value.trim() || "班级民心意见箱",
        className: document.getElementById("cfgClassName").value.trim(),
        adminPasscode: document.getElementById("cfgAdminPass").value.trim() || "1145141919810"
      });
      renderBranding();
      document.getElementById("configModal").classList.remove("open");
      showToast("✅ 设置已保存");
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    renderBranding();
    initSelectors();
    bindEvents();
    await refreshData();
  });
})();
