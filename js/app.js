/**
 * 班级意见箱 - 极简交互逻辑
 */

(function () {
  const storage = window.voiceStorage;

  let allFeedbacks = [];
  let selectedCategory = "study";
  let currentWallCat = "all";
  let currentWallSort = "newest";
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
    item.className = "toast";
    item.textContent = msg;
    container.appendChild(item);
    setTimeout(() => item.remove(), 2400);
  }

  function renderBranding() {
    const cfg = storage.loadMergedConfig();
    document.title = cfg.siteTitle || "班级意见箱";
    document.getElementById("navSiteTitle").textContent = cfg.siteTitle || "班级意见箱";
    document.getElementById("navClassName").textContent = cfg.className || "匿名提交 · 凭回执码查询进度";
  }

  function initSelectors() {
    const catGrid = document.getElementById("categoryGrid");
    catGrid.innerHTML = window.CATEGORIES.map(cat => `
      <button type="button" class="cat-chip ${cat.id === selectedCategory ? "selected" : ""}" data-id="${cat.id}">
        ${cat.name}
      </button>
    `).join("");

    catGrid.querySelectorAll(".cat-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        selectedCategory = btn.dataset.id;
        catGrid.querySelectorAll(".cat-chip").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
      });
    });

    const wallFilters = document.getElementById("wallCategoryFilters");
    wallFilters.innerHTML =
      `<button type="button" class="cat-chip selected" data-cat="all">全部</button>` +
      window.CATEGORIES.map(cat => `
        <button type="button" class="cat-chip" data-cat="${cat.id}">${cat.name}</button>
      `).join("");

    wallFilters.querySelectorAll(".cat-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        currentWallCat = btn.dataset.cat;
        wallFilters.querySelectorAll(".cat-chip").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
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
        <div class="card" style="text-align: center; color: var(--text-light); padding: 2.5rem 1rem;">
          暂无公开意见
        </div>
      `;
      return;
    }

    grid.innerHTML = list.map(item => {
      const cat = window.CATEGORIES.find(c => c.id === item.category) || window.CATEGORIES[0];
      const st = window.STATUS_MAP[item.status] || window.STATUS_MAP.pending;
      const isUpvoted = upvotedIds.includes(item.id);

      return `
        <div class="item-card">
          <div class="item-head">
            <div>
              <span class="code-badge">#${escapeHtml(item.receiptCode)}</span>
              <span style="color: var(--text-sub); margin-left: 0.4rem;">${escapeHtml(cat.name)}</span>
            </div>
            <span class="status-tag ${st.className}">${escapeHtml(st.label)}</span>
          </div>

          <div style="font-weight: 600; font-size: 0.96rem; margin-bottom: 0.35rem;">
            ${escapeHtml(item.title)}
          </div>
          <div class="item-body">${escapeHtml(item.content)}</div>

          ${item.meetingNote ? `
            <div class="item-reply">
              <strong>班会/班委回应：</strong>${escapeHtml(item.meetingNote)}
            </div>
          ` : ""}

          <div class="item-foot">
            <span>${escapeHtml(item.createdAt)}</span>
            <button type="button" class="like-btn ${isUpvoted ? "upvoted" : ""}" data-upvote-id="${escapeHtml(item.id)}">
              附议 ${item.upvotes || 1}
            </button>
          </div>
        </div>
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
        <div style="padding: 1rem; background: var(--bg-muted); border-radius: 8px; font-size: 0.85rem; color: var(--text-sub);">
          未找到回执码 <strong>${escapeHtml(code)}</strong>，请检查是否输入正确。
        </div>
      `;
      return;
    }

    const cat = window.CATEGORIES.find(c => c.id === found.category) || window.CATEGORIES[0];
    const st = window.STATUS_MAP[found.status] || window.STATUS_MAP.pending;
    const followUps = Array.isArray(found.followUps) ? found.followUps : [];

    container.innerHTML = `
      <div class="item-card" style="margin-bottom: 0;">
        <div class="item-head">
          <span class="code-badge">#${escapeHtml(found.receiptCode)}</span>
          <span class="status-tag ${st.className}">${escapeHtml(st.label)}</span>
        </div>
        <div style="font-weight: 600; margin-bottom: 0.35rem;">${escapeHtml(found.title)}</div>
        <div class="item-body">${escapeHtml(found.content)}</div>

        <div class="item-reply">
          <strong>处理进度：</strong>${found.meetingNote ? escapeHtml(found.meetingNote) : escapeHtml(st.desc)}
        </div>

        ${followUps.length > 0 ? `
          <div style="font-size: 0.8rem; color: var(--text-sub); margin-bottom: 0.65rem;">
            <strong>补充记录：</strong>
            ${followUps.map(f => `<div>[${escapeHtml(f.time)}] ${escapeHtml(f.text)}</div>`).join("")}
          </div>
        ` : ""}

        <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border);">
          <input type="text" id="followUpInput" class="input" placeholder="如需补充说明可在此输入..." style="font-size: 0.84rem; padding: 0.45rem 0.7rem;" />
          <button type="button" class="btn-outline" id="submitFollowUpBtn" style="white-space: nowrap;">追加</button>
        </div>
      </div>
    `;

    document.getElementById("submitFollowUpBtn")?.addEventListener("click", async () => {
      const input = document.getElementById("followUpInput");
      const text = (input.value || "").trim();
      if (!text) return;
      await storage.addFollowUpByReceipt(found.receiptCode, text);
      showToast("已追加补充说明");
      await refreshData();
      renderLookupResult(found.receiptCode);
    });
  }

  function renderMyLocalReceipts() {
    const listEl = document.getElementById("myLocalReceiptsList");
    const myList = storage.getMyReceiptsLocal();

    if (myList.length === 0) {
      listEl.innerHTML = `<div style="font-size: 0.84rem; color: var(--text-light);">暂无本机记录</div>`;
      return;
    }

    listEl.innerHTML = myList.map(r => {
      const matched = allFeedbacks.find(f => f.receiptCode === r.receiptCode);
      const st = window.STATUS_MAP[matched?.status || "pending"] || window.STATUS_MAP.pending;
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0; border-bottom: 1px solid var(--border); font-size: 0.85rem;">
          <div>
            <span class="code-badge">#${escapeHtml(r.receiptCode)}</span>
            <span style="margin-left: 0.5rem;">${escapeHtml(r.title)}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="status-tag ${st.className}">${escapeHtml(st.label)}</span>
            <button type="button" class="btn-ghost" data-quick-lookup="${escapeHtml(r.receiptCode)}" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">查看</button>
          </div>
        </div>
      `;
    }).join("");

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
      listContainer.innerHTML = `<div class="card" style="text-align: center; color: var(--text-light);">暂无记录</div>`;
      return;
    }

    listContainer.innerHTML = filtered.map(item => {
      const cat = window.CATEGORIES.find(c => c.id === item.category) || window.CATEGORIES[0];
      return `
        <div class="item-card">
          <div class="item-head">
            <div>
              <span class="code-badge">#${escapeHtml(item.receiptCode)}</span>
              <span style="margin-left: 0.4rem; color: var(--text-sub);">${escapeHtml(cat.name)}</span>
              <span style="margin-left: 0.4rem; color: var(--text-light);">${item.isPublic !== false ? "公开" : "仅班委可见"}</span>
            </div>
            <div style="display: flex; gap: 0.4rem; align-items: center;">
              <select class="select admin-status-select" data-id="${escapeHtml(item.id)}" style="width: auto; padding: 0.2rem 0.5rem; font-size: 0.76rem;">
                <option value="pending" ${item.status === "pending" ? "selected" : ""}>待整理</option>
                <option value="agenda" ${item.status === "agenda" ? "selected" : ""}>已列入班会</option>
                <option value="resolved" ${item.status === "resolved" ? "selected" : ""}>已回应/已落实</option>
              </select>
              <button type="button" class="btn-ghost admin-delete-btn" data-id="${escapeHtml(item.id)}" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; color: var(--red);">删除</button>
            </div>
          </div>

          <div style="font-weight: 600; margin-bottom: 0.3rem;">${escapeHtml(item.title)}</div>
          <div class="item-body">${escapeHtml(item.content)}</div>

          ${item.contact ? `
            <div style="font-size: 0.82rem; padding: 0.45rem 0.7rem; background: var(--accent-soft); color: var(--accent); border-radius: 6px; margin-bottom: 0.6rem;">
              联系方式：${escapeHtml(item.contact)}
            </div>
          ` : ""}

          <div style="display: flex; gap: 0.45rem;">
            <input
              type="text"
              class="input admin-note-input"
              data-id="${escapeHtml(item.id)}"
              value="${escapeHtml(item.meetingNote || "")}"
              placeholder="添加班会处理备注（选填）..."
              style="font-size: 0.82rem; padding: 0.4rem 0.65rem;"
            />
            <button type="button" class="btn-outline admin-save-note-btn" data-id="${escapeHtml(item.id)}" style="white-space: nowrap;">保存</button>
          </div>
        </div>
      `;
    }).join("");

    listContainer.querySelectorAll(".admin-status-select").forEach(sel => {
      sel.addEventListener("change", async () => {
        const id = sel.getAttribute("data-id");
        await storage.updateFeedbackAdmin(id, { status: sel.value });
        showToast("状态已更新");
        await refreshData();
      });
    });

    listContainer.querySelectorAll(".admin-save-note-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const input = listContainer.querySelector(`.admin-note-input[data-id="${id}"]`);
        await storage.updateFeedbackAdmin(id, { meetingNote: input ? input.value.trim() : "" });
        showToast("备注已保存");
        await refreshData();
      });
    });

    listContainer.querySelectorAll(".admin-delete-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        if (!confirm("确定删除这条记录吗？")) return;
        await storage.deleteFeedback(id);
        await refreshData();
      });
    });
  }

  function exportToCsv() {
    const headers = ["回执码", "分类", "主题", "内容", "附议数", "是否公开", "联系方式", "状态", "备注", "提交时间"];
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
    a.download = `班级意见汇总_${new Date().toISOString().slice(0, 10)}.csv`;
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
    // 主题切换
    const savedTheme = localStorage.getItem("class_voice_theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
    document.getElementById("themeToggleBtn").textContent = savedTheme === "dark" ? "☀️" : "🌙";

    document.getElementById("themeToggleBtn").addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("class_voice_theme", next);
      document.getElementById("themeToggleBtn").textContent = next === "dark" ? "☀️" : "🌙";
    });

    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    // 底部班委入口
    document.getElementById("footerAdminLink").addEventListener("click", (e) => {
      e.preventDefault();
      switchTab("admin");
    });

    // 提交表单
    document.getElementById("feedbackForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById("submitBtn");
      submitBtn.disabled = true;
      submitBtn.textContent = "提交中...";

      try {
        const created = await storage.addFeedback({
          category: selectedCategory,
          mood: "suggest",
          title: document.getElementById("fbTitle").value,
          content: document.getElementById("fbContent").value,
          suggestion: "",
          isPublic: document.getElementById("fbIsPublic").checked,
          contact: document.getElementById("fbContact").value
        });

        document.getElementById("fbTitle").value = "";
        document.getElementById("fbContent").value = "";
        document.getElementById("fbContact").value = "";

        document.getElementById("modalReceiptCode").textContent = created.receiptCode;
        document.getElementById("receiptModal").classList.add("open");
        await refreshData();
      } catch (err) {
        alert("提交失败：" + err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "提交意见";
      }
    });

    document.getElementById("copyReceiptBtn").addEventListener("click", () => {
      const code = document.getElementById("modalReceiptCode").textContent.trim();
      navigator.clipboard.writeText(code).then(() => showToast(`已复制回执码 ${code}`));
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

    // 班委解锁
    function updateAdminView() {
      document.getElementById("adminLockCard").style.display = isAdminUnlocked ? "none" : "block";
      document.getElementById("adminDashboard").style.display = isAdminUnlocked ? "block" : "none";
      if (isAdminUnlocked) renderAdminDashboard();
    }
    updateAdminView();

    document.getElementById("adminUnlockBtn").addEventListener("click", () => {
      const val = document.getElementById("adminPassInput").value.trim();
      const cfg = storage.loadMergedConfig();
      if (val === String(cfg.adminPasscode || "8888")) {
        isAdminUnlocked = true;
        sessionStorage.setItem("class_voice_admin_unlocked", "1");
        updateAdminView();
      } else {
        showToast("口令错误");
      }
    });

    document.getElementById("adminFilterSelect").addEventListener("change", renderAdminDashboard);
    document.getElementById("exportCsvBtn").addEventListener("click", exportToCsv);

    document.getElementById("clearDemoBtn").addEventListener("click", async () => {
      if (!confirm("确定清空示例数据吗？")) return;
      await storage.clearDemoData();
      await refreshData();
      showToast("已清空示例数据");
    });

    document.getElementById("openConfigModalBtn").addEventListener("click", () => {
      const cfg = storage.loadMergedConfig();
      document.getElementById("cfgSiteTitle").value = cfg.siteTitle || "班级意见箱";
      document.getElementById("cfgClassName").value = cfg.className || "";
      document.getElementById("cfgAdminPass").value = cfg.adminPasscode || "8888";
      document.getElementById("configModal").classList.add("open");
    });

    document.getElementById("closeConfigModalBtn").addEventListener("click", () => {
      document.getElementById("configModal").classList.remove("open");
    });

    document.getElementById("saveConfigBtn").addEventListener("click", () => {
      storage.saveConfigOverride({
        siteTitle: document.getElementById("cfgSiteTitle").value.trim() || "班级意见箱",
        className: document.getElementById("cfgClassName").value.trim(),
        adminPasscode: document.getElementById("cfgAdminPass").value.trim() || "8888"
      });
      renderBranding();
      document.getElementById("configModal").classList.remove("open");
      showToast("设置已保存");
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    renderBranding();
    initSelectors();
    bindEvents();
    await refreshData();
  });
})();
