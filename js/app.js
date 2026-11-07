/**
 * 班级民心意见箱 - 前端交互主逻辑
 */

(function () {
  const storage = window.voiceStorage;

  // 页面状态
  let allFeedbacks = [];
  let selectedCategory = "study";
  let selectedMood = "suggest";
  let selectedIsPublic = true;
  let currentWallCat = "all";
  let currentWallStatus = "all";
  let currentWallSort = "upvotes";
  let isAdminUnlocked = sessionStorage.getItem("class_voice_admin_unlocked") === "1";

  // 投屏演示模式状态
  let projectorList = [];
  let projectorIndex = 0;

  // HTML 转义防 XSS
  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // 轻提示 Toast
  function showToast(msg) {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const item = document.createElement("div");
    item.className = "toast-item";
    item.textContent = msg;
    container.appendChild(item);
    setTimeout(() => {
      item.style.opacity = "0";
      item.style.transition = "opacity 0.25s ease";
      setTimeout(() => item.remove(), 260);
    }, 2800);
  }

  // 初始化页面头部与班会公告信息
  function renderSiteBranding() {
    const cfg = storage.loadMergedConfig();
    document.title = `${cfg.siteTitle || "班级民心意见箱"} · ${cfg.className || ""}`;
    document.getElementById("navClassName").textContent = cfg.className || "班级民心工程";
    document.getElementById("navSiteTitle").textContent = cfg.siteTitle || "班级民心意见箱";
    document.getElementById("projClassName").textContent = `${cfg.className || ""} · 班会民心回音壁`;

    const notice = cfg.meetingNotice || {};
    const banner = document.getElementById("meetingBanner");
    if (notice.enabled === false) {
      banner.style.display = "none";
    } else {
      banner.style.display = "flex";
      document.getElementById("bannerMeetingTime").textContent = notice.nextMeetingTime || "近期班会";
      document.getElementById("bannerMeetingTopic").textContent = notice.topic || "集中回应本周收集的所有回执码意见";
      document.getElementById("bannerMeetingNote").textContent =
        notice.committeeNote || "大家提交意见后请保存好自己的【回执码】，班会上班委将直接报回执码逐条讨论答复！";
    }

    // 云端状态指示器
    const cloudPill = document.getElementById("cloudStatusBtn");
    const cloudText = document.getElementById("cloudStatusText");
    if (storage.isCloudEnabled()) {
      cloudPill.classList.add("is-cloud");
      cloudText.textContent = "☁️ 云端实时同步已连接";
    } else {
      cloudPill.classList.remove("is-cloud");
      cloudText.textContent = "💻 本地演示模式（点此配置云端）";
    }
  }

  // 初始化表单的分类与情绪选择器
  function initFormSelectors() {
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

    const moodRow = document.getElementById("moodRow");
    moodRow.innerHTML = window.MOODS.map(m => `
      <div class="mood-chip ${m.id === selectedMood ? "selected" : ""}" data-id="${m.id}">
        <span>${m.icon}</span>
        <span>${m.name}</span>
      </div>
    `).join("");

    moodRow.querySelectorAll(".mood-chip").forEach(el => {
      el.addEventListener("click", () => {
        selectedMood = el.dataset.id;
        moodRow.querySelectorAll(".mood-chip").forEach(c => c.classList.remove("selected"));
        el.classList.add("selected");
      });
    });

    // 民心墙分类筛选栏初始化
    const wallFilters = document.getElementById("wallCategoryFilters");
    wallFilters.innerHTML = `<button type="button" class="filter-pill active" data-cat="all">全部声音</button>` +
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

  // 刷新所有数据并重新渲染各板块
  async function refreshData() {
    allFeedbacks = await storage.getAllFeedbacks();
    updateNavBadges();
    renderPublicWall();
    renderMyLocalReceipts();
    if (isAdminUnlocked) {
      renderAdminDashboard();
    }
  }

  function updateNavBadges() {
    const publicCount = allFeedbacks.filter(item => item.isPublic !== false).length;
    document.getElementById("publicCountBadge").textContent = publicCount;
    const myReceipts = storage.getMyReceiptsLocal();
    document.getElementById("myReceiptCountBadge").textContent = myReceipts.length;
  }

  // ==================== 渲染公开民心墙 ====================
  function renderPublicWall() {
    const grid = document.getElementById("publicWallGrid");
    const upvotedIds = storage.getUpvotedIds();

    let list = allFeedbacks.filter(item => item.isPublic !== false);

    if (currentWallCat !== "all") {
      list = list.filter(item => item.category === currentWallCat);
    }
    if (currentWallStatus !== "all") {
      list = list.filter(item => (item.status || "pending") === currentWallStatus);
    }

    if (currentWallSort === "upvotes") {
      list.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
    } else {
      list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    }

    if (list.length === 0) {
      grid.innerHTML = `
        <div class="glass-card" style="grid-column: 1 / -1; text-align: center; padding: 3rem 1.5rem;">
          <div style="font-size: 2.6rem; margin-bottom: 0.6rem;">🌱</div>
          <h4 style="font-size: 1.08rem; font-weight: 800;">该分类下暂时还没有公开声音</h4>
          <p style="font-size: 0.86rem; color: var(--text-secondary); margin-top: 0.3rem;">
            快去「匿名投递」写下第一条建议吧，班会上我们将逐条公开讨论！
          </p>
        </div>
      `;
      return;
    }

    grid.innerHTML = list.map(item => {
      const cat = window.CATEGORIES.find(c => c.id === item.category) || window.CATEGORIES[0];
      const mood = window.MOODS.find(m => m.id === item.mood) || window.MOODS[0];
      const st = window.STATUS_MAP[item.status] || window.STATUS_MAP.pending;
      const isUpvoted = upvotedIds.includes(item.id);

      return `
        <article class="feedback-card">
          <div>
            <div class="card-top-bar">
              <span class="receipt-tag" title="匿名回执码">#${escapeHtml(item.receiptCode)}</span>
              <span class="status-badge ${st.className}">${st.icon} ${st.label}</span>
            </div>

            <div class="card-cat-row">
              <span class="cat-pill-sm" style="background: ${cat.bg}; color: ${cat.color};">
                ${cat.icon} ${cat.name}
              </span>
              <span class="mood-pill-sm">${mood.icon} ${mood.name}</span>
              ${item.isDemo ? `<span style="font-size:0.7rem; color:var(--text-muted); border:1px solid var(--border-color); padding:0.05rem 0.4rem; border-radius:4px;">示例</span>` : ""}
            </div>

            <h3 class="card-title">${escapeHtml(item.title)}</h3>
            <p class="card-content">${escapeHtml(item.content)}</p>

            ${item.suggestion ? `
              <div class="card-suggestion-box">
                <strong>💡 同学建议方案：</strong>${escapeHtml(item.suggestion)}
              </div>
            ` : ""}

            ${item.meetingNote ? `
              <div class="card-meeting-note">
                <strong>🎙️ 班会/班委回应纪要：</strong>${escapeHtml(item.meetingNote)}
              </div>
            ` : ""}
          </div>

          <div class="card-footer">
            <span class="card-time">🕒 ${escapeHtml(item.createdAt)}</span>
            <button type="button" class="upvote-btn ${isUpvoted ? "upvoted" : ""}" data-upvote-id="${escapeHtml(item.id)}">
              <span>👍 我也有同感</span>
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
          showToast(res.upvoted ? "👍 已附议！高票意见将在班会优先讨论" : "已取消附议");
          await refreshData();
        }
      });
    });
  }

  // ==================== 回执码查询与本机历史 ====================
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
          <div style="font-size: 1.8rem;">🔎</div>
          <h4 style="font-size: 1rem; font-weight: 800; margin-top: 0.3rem;">未找到回执码「${escapeHtml(code)}」</h4>
          <p style="font-size: 0.84rem; color: var(--text-secondary); margin-top: 0.25rem;">
            请检查回执码是否输入正确（格式如 <code>MX-8A3F</code>）。
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
          <div>
            <span class="receipt-tag" style="font-size: 1rem;">#${escapeHtml(found.receiptCode)}</span>
            <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 0.5rem;">
              ${found.isPublic !== false ? "📢 公开民心墙可见" : "🔒 仅班委内部可见"}
            </span>
          </div>
          <span class="status-badge ${st.className}">${st.icon} ${st.label}</span>
        </div>

        <div class="ticket-divider"></div>

        <div style="font-size: 0.82rem; font-weight: 700; color: ${cat.color}; margin-bottom: 0.25rem;">
          ${cat.icon} ${cat.name} · 投递于 ${escapeHtml(found.createdAt)} · 👍 ${found.upvotes || 1} 人附议
        </div>
        <h4 style="font-size: 1.12rem; font-weight: 800; margin-bottom: 0.5rem;">${escapeHtml(found.title)}</h4>
        <p style="font-size: 0.9rem; color: var(--text-secondary); white-space: pre-line; margin-bottom: 0.75rem;">${escapeHtml(found.content)}</p>

        ${found.suggestion ? `
          <div class="card-suggestion-box">
            <strong>💡 你的建议方案：</strong>${escapeHtml(found.suggestion)}
          </div>
        ` : ""}

        <div class="card-meeting-note" style="margin-top: 0.75rem;">
          <strong>🎙️ 班会排期与处理进度：</strong><br/>
          ${found.meetingNote ? escapeHtml(found.meetingNote) : `<span style="color: var(--text-secondary);">${st.desc}，我们将在班会上直接播报回执码 <strong>${escapeHtml(found.receiptCode)}</strong> 进行集中答复。</span>`}
        </div>

        ${followUps.length > 0 ? `
          <div style="margin-top: 0.85rem; background: var(--bg-subtle); padding: 0.75rem; border-radius: 10px;">
            <div style="font-size: 0.8rem; font-weight: 700; margin-bottom: 0.4rem;">📝 匿名追加补充记录：</div>
            ${followUps.map(f => `
              <div style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 0.25rem;">
                <span style="color: var(--text-muted);">[${escapeHtml(f.time)}]</span> ${escapeHtml(f.text)}
              </div>
            `).join("")}
          </div>
        ` : ""}

        <!-- 凭回执码继续匿名补充说明 -->
        <div style="margin-top: 1rem; padding-top: 0.9rem; border-top: 1px dashed var(--border-strong);">
          <label style="font-size: 0.84rem; font-weight: 700; display: block; margin-bottom: 0.45rem;">
            💬 还有遗漏细节？凭此回执码匿名追加说明（班委可见）：
          </label>
          <div style="display: flex; gap: 0.5rem;">
            <input type="text" id="followUpInput" class="form-input" placeholder="输入你想补充的情况或后续反馈..." />
            <button type="button" class="btn-secondary" id="submitFollowUpBtn" style="white-space: nowrap;">➕ 追加</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById("submitFollowUpBtn")?.addEventListener("click", async () => {
      const input = document.getElementById("followUpInput");
      const text = (input.value || "").trim();
      if (!text) {
        showToast("请输入要补充的内容");
        return;
      }
      await storage.addFollowUpByReceipt(found.receiptCode, text);
      showToast("✅ 已成功追加补充说明！");
      await refreshData();
      renderLookupResult(found.receiptCode);
    });
  }

  function renderMyLocalReceipts() {
    const listEl = document.getElementById("myLocalReceiptsList");
    const myList = storage.getMyReceiptsLocal();

    if (myList.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 1.5rem; color: var(--text-muted); font-size: 0.86rem;">
          你在这台设备上还没有投递记录，或已清除本地缓存。
        </div>
      `;
      return;
    }

    listEl.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 0.6rem;">
        ${myList.map(r => {
          const matched = allFeedbacks.find(f => f.receiptCode === r.receiptCode);
          const st = window.STATUS_MAP[matched?.status || "pending"] || window.STATUS_MAP.pending;
          return `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; border-radius: 12px; background: var(--bg-subtle); border: 1px solid var(--border-color); gap: 0.75rem; flex-wrap: wrap;">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <span class="receipt-tag">#${escapeHtml(r.receiptCode)}</span>
                <div>
                  <div style="font-size: 0.9rem; font-weight: 700;">${escapeHtml(r.title)}</div>
                  <div style="font-size: 0.75rem; color: var(--text-muted);">投递于 ${escapeHtml(r.createdAt)}</div>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 0.6rem;">
                <span class="status-badge ${st.className}">${st.icon} ${st.label}</span>
                <button type="button" class="btn-secondary" data-quick-lookup="${escapeHtml(r.receiptCode)}" style="padding: 0.35rem 0.75rem; font-size: 0.78rem;">
                  查看详情
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
        window.scrollTo({ top: 180, behavior: "smooth" });
      });
    });
  }

  // ==================== 班委工作台与班会投屏 ====================
  function renderAdminDashboard() {
    const statsGrid = document.getElementById("adminStatsGrid");
    const total = allFeedbacks.length;
    const agendaCount = allFeedbacks.filter(f => f.status === "agenda").length;
    const resolvedCount = allFeedbacks.filter(f => f.status === "resolved").length;
    const withContactCount = allFeedbacks.filter(f => Boolean(f.contact && f.contact.trim())).length;

    statsGrid.innerHTML = `
      <div class="stat-card">
        <div class="stat-value">${total}</div>
        <div class="stat-label">📬 累计收到意见总数</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #D97706;">${agendaCount}</div>
        <div class="stat-label">📋 已列入本期班会议程</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: var(--emerald);">${resolvedCount}</div>
        <div class="stat-label">✅ 班会已公开回应/落实</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #9333EA;">${withContactCount}</div>
        <div class="stat-label">🙋 自愿留下联系方式同学</div>
      </div>
    `;

    const filterVal = document.getElementById("adminFilterSelect").value;
    let filtered = [...allFeedbacks];
    if (filterVal === "private") {
      filtered = filtered.filter(f => f.isPublic === false);
    } else if (filterVal === "contact") {
      filtered = filtered.filter(f => Boolean(f.contact && f.contact.trim()));
    } else if (filterVal === "pending" || filterVal === "agenda") {
      filtered = filtered.filter(f => (f.status || "pending") === filterVal);
    }

    const listContainer = document.getElementById("adminFeedbackList");
    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="glass-card" style="text-align: center; padding: 2.5rem;">
          <p style="color: var(--text-secondary);">当前筛选条件下没有意见记录。</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = filtered.map(item => {
      const cat = window.CATEGORIES.find(c => c.id === item.category) || window.CATEGORIES[0];
      const st = window.STATUS_MAP[item.status] || window.STATUS_MAP.pending;
      const followUps = Array.isArray(item.followUps) ? item.followUps : [];

      return `
        <div class="glass-card" style="padding: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.6rem; margin-bottom: 0.7rem;">
            <div style="display: flex; align-items: center; gap: 0.55rem; flex-wrap: wrap;">
              <span class="receipt-tag" style="font-size: 0.9rem;">#${escapeHtml(item.receiptCode)}</span>
              <span class="cat-pill-sm" style="background: ${cat.bg}; color: ${cat.color};">${cat.icon} ${cat.name}</span>
              <span style="font-size: 0.78rem; font-weight: 700; color: ${item.isPublic !== false ? "var(--emerald)" : "var(--rose)"};">
                ${item.isPublic !== false ? "📢 允许公开与班会投屏" : "🔒 仅班委内部查阅（投屏默认跳过）"}
              </span>
              <span style="font-size: 0.78rem; color: var(--text-muted);">👍 ${item.upvotes || 1} 附议 · ${escapeHtml(item.createdAt)}</span>
            </div>

            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <select class="form-select admin-status-select" data-id="${escapeHtml(item.id)}" style="width: auto; padding: 0.32rem 0.65rem; font-size: 0.8rem; font-weight: 700;">
                <option value="pending" ${item.status === "pending" ? "selected" : ""}>⏳ 待班委整理</option>
                <option value="agenda" ${item.status === "agenda" ? "selected" : ""}>📋 列入班会议程</option>
                <option value="resolved" ${item.status === "resolved" ? "selected" : ""}>✅ 班会已回应/落实</option>
              </select>
              <button type="button" class="btn-secondary admin-delete-btn" data-id="${escapeHtml(item.id)}" style="padding: 0.32rem 0.65rem; font-size: 0.78rem; color: var(--rose);">
                删除
              </button>
            </div>
          </div>

          <h4 style="font-size: 1.05rem; font-weight: 800; margin-bottom: 0.35rem;">${escapeHtml(item.title)}</h4>
          <p style="font-size: 0.88rem; color: var(--text-secondary); white-space: pre-line; margin-bottom: 0.6rem;">${escapeHtml(item.content)}</p>

          ${item.suggestion ? `
            <div class="card-suggestion-box" style="margin-bottom: 0.6rem;">
              <strong>💡 建议方案：</strong>${escapeHtml(item.suggestion)}
            </div>
          ` : ""}

          ${item.contact ? `
            <div style="background: rgba(147, 51, 234, 0.1); border: 1px solid rgba(147, 51, 234, 0.3); padding: 0.55rem 0.85rem; border-radius: 8px; font-size: 0.83rem; color: var(--text-primary); margin-bottom: 0.6rem;">
              <strong>🙋 同学自愿留下的私密联系方式（投屏时会自动隐藏）：</strong> ${escapeHtml(item.contact)}
            </div>
          ` : ""}

          ${followUps.length > 0 ? `
            <div style="background: var(--bg-subtle); padding: 0.55rem 0.85rem; border-radius: 8px; font-size: 0.8rem; margin-bottom: 0.6rem;">
              <strong>📝 同学凭回执码追加的说明：</strong>
              ${followUps.map(f => `<div>[${escapeHtml(f.time)}] ${escapeHtml(f.text)}</div>`).join("")}
            </div>
          ` : ""}

          <!-- 班会回应纪要/备注编辑行 -->
          <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
            <input
              type="text"
              class="form-input admin-note-input"
              data-id="${escapeHtml(item.id)}"
              value="${escapeHtml(item.meetingNote || "")}"
              placeholder="选填：班会讨论结论或简短处理备注（如：已在周五班会讨论通过，下周起执行）..."
              style="font-size: 0.83rem; padding: 0.48rem 0.8rem;"
            />
            <button type="button" class="btn-secondary admin-save-note-btn" data-id="${escapeHtml(item.id)}" style="white-space: nowrap; font-size: 0.82rem;">
              💾 保存备注
            </button>
          </div>
        </div>
      `;
    }).join("");

    // 绑定状态切换事件
    listContainer.querySelectorAll(".admin-status-select").forEach(sel => {
      sel.addEventListener("change", async () => {
        const id = sel.getAttribute("data-id");
        await storage.updateFeedbackAdmin(id, { status: sel.value });
        showToast("✅ 已更新班会议程状态");
        await refreshData();
      });
    });

    // 绑定保存备注事件
    listContainer.querySelectorAll(".admin-save-note-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const input = listContainer.querySelector(`.admin-note-input[data-id="${id}"]`);
        await storage.updateFeedbackAdmin(id, { meetingNote: input ? input.value.trim() : "" });
        showToast("💾 已保存班会回应纪要");
        await refreshData();
      });
    });

    // 绑定删除事件
    listContainer.querySelectorAll(".admin-delete-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        if (!confirm("确定要删除这条意见记录吗？")) return;
        await storage.deleteFeedback(id);
        showToast("🗑️ 已删除该条记录");
        await refreshData();
      });
    });
  }

  // ==================== 班会全屏投屏模式 (Spotlight Projector) ====================
  function openProjectorMode() {
    // 默认只投屏允许公开展示的意见，按附议数从高到低排序
    projectorList = allFeedbacks
      .filter(f => f.isPublic !== false)
      .sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));

    if (projectorList.length === 0) {
      showToast("当前没有可公开投屏的意见记录");
      return;
    }

    projectorIndex = 0;
    document.getElementById("projectorOverlay").classList.add("open");
    renderProjectorSlide();
  }

  function renderProjectorSlide() {
    if (projectorList.length === 0) return;
    const item = projectorList[projectorIndex];
    const cat = window.CATEGORIES.find(c => c.id === item.category) || window.CATEGORIES[0];
    const mood = window.MOODS.find(m => m.id === item.mood) || window.MOODS[0];
    const st = window.STATUS_MAP[item.status] || window.STATUS_MAP.pending;

    document.getElementById("projCounter").textContent = `议题 ${projectorIndex + 1} / ${projectorList.length}`;

    const stage = document.getElementById("projectorStage");
    stage.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
        <div style="display: flex; align-items: center; gap: 0.85rem;">
          <span class="projector-receipt">#${escapeHtml(item.receiptCode)}</span>
          <span style="font-size: 1.05rem; font-weight: 700; color: #E2E8F0; background: rgba(255,255,255,0.1); padding: 0.4rem 0.9rem; border-radius: 10px;">
            ${cat.icon} ${cat.name} · ${mood.icon} ${mood.name}
          </span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.85rem;">
          <span style="font-size: 1.1rem; font-weight: 800; color: #FBBF24;">
            🔥 全班 ${item.upvotes || 1} 人同感附议
          </span>
          <span class="status-badge ${st.className}" style="font-size: 0.95rem; padding: 0.35rem 0.9rem;">
            ${st.icon} ${st.label}
          </span>
        </div>
      </div>

      <h2 class="projector-title">${escapeHtml(item.title)}</h2>
      <div class="projector-content">${escapeHtml(item.content)}</div>

      ${item.suggestion ? `
        <div style="background: rgba(99, 102, 241, 0.18); border-left: 4px solid #818CF8; padding: 1.1rem 1.4rem; border-radius: 0 14px 14px 0; font-size: 1.15rem; color: #E0E7FF; margin-bottom: 1.2rem;">
          <strong>💡 投递同学建议方案：</strong>${escapeHtml(item.suggestion)}
        </div>
      ` : ""}

      ${item.meetingNote ? `
        <div style="background: rgba(16, 185, 129, 0.18); border: 1px solid rgba(16, 185, 129, 0.4); padding: 1rem 1.35rem; border-radius: 14px; font-size: 1.1rem; color: #D1FAE5;">
          <strong>🎙️ 班委前期准备纪要：</strong>${escapeHtml(item.meetingNote)}
        </div>
      ` : ""}
    `;
  }

  // ==================== 导出班会汇报稿 (.md) 与 Excel (.csv) ====================
  function exportToMarkdown() {
    const cfg = storage.loadMergedConfig();
    const lines = [
      `# ${cfg.className || ""} - 班会民心意见集中回应台账`,
      `> 导出时间：${new Date().toLocaleString()} | 共计 ${allFeedbacks.length} 条声音`,
      ""
    ];

    allFeedbacks.forEach((f, idx) => {
      const cat = window.CATEGORIES.find(c => c.id === f.category) || { name: "其他" };
      const st = window.STATUS_MAP[f.status] || window.STATUS_MAP.pending;
      lines.push(`## ${idx + 1}. 【回执码 #${f.receiptCode}】${f.title}`);
      lines.push(`- **所属分类**：${cat.name} | **同感附议**：${f.upvotes || 1} 人 | **当前状态**：${st.label}`);
      lines.push(`- **公开属性**：${f.isPublic !== false ? "公开上墙" : "仅班委内部可见"}`);
      if (f.contact) {
        lines.push(`- **自愿留名/联系方式（勿公开）**：${f.contact}`);
      }
      lines.push(`- **具体内容**：\n  ${f.content.replace(/\n/g, "\n  ")}`);
      if (f.suggestion) {
        lines.push(`- **同学建议方案**：${f.suggestion}`);
      }
      if (f.meetingNote) {
        lines.push(`- **班会回应纪要**：${f.meetingNote}`);
      }
      lines.push("");
    });

    downloadBlob(lines.join("\n"), `班会民心意见汇总_${new Date().toISOString().slice(0, 10)}.md`, "text/markdown;charset=utf-8");
    showToast("📄 已导出班会 Markdown 汇报稿！");
  }

  function exportToCsv() {
    const headers = ["回执码", "分类", "性质", "标题", "详细内容", "改进建议", "附议数", "是否允许公开", "自愿联系方式(仅班委)", "状态", "班会纪要", "投递时间"];
    const rows = allFeedbacks.map(f => {
      const cat = window.CATEGORIES.find(c => c.id === f.category)?.name || "";
      const mood = window.MOODS.find(m => m.id === f.mood)?.name || "";
      const st = window.STATUS_MAP[f.status]?.label || "";
      return [
        f.receiptCode,
        cat,
        mood,
        f.title,
        f.content,
        f.suggestion || "",
        f.upvotes || 1,
        f.isPublic !== false ? "是" : "否",
        f.contact || "",
        st,
        f.meetingNote || "",
        f.createdAt
      ].map(cell => `"${String(cell || "").replace(/"/g, '""')}"`).join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    downloadBlob(csvContent, `班级意见箱台账_${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8");
    showToast("📊 已导出 Excel (CSV) 台账表格！");
  }

  function downloadBlob(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ==================== 透明性检测数据包实时预览 ====================
  function openTransparencyModal() {
    const titleVal = document.getElementById("fbTitle").value || "希望考前组织高数答疑";
    const contentVal = document.getElementById("fbContent").value || "（你在表单中填写的正文内容）";
    const contactVal = document.getElementById("fbContact").value || "";

    const samplePayload = {
      receiptCode: "MX-随机生成4位码",
      category: selectedCategory,
      mood: selectedMood,
      title: titleVal,
      content: contentVal,
      suggestion: document.getElementById("fbSuggestion").value || "",
      isPublic: selectedIsPublic,
      contact: contactVal || "（未填写，100%纯匿名）",
      "// 隐私审计声明": "无 IP、无 User-Agent、无 Cookie、无设备指纹字段"
    };

    document.getElementById("livePayloadPreview").textContent = JSON.stringify(samplePayload, null, 2);
    document.getElementById("transparencyModal").classList.add("open");
  }

  // ==================== 云端配置弹窗逻辑 ====================
  function openConfigModal() {
    const cfg = storage.loadMergedConfig();
    document.getElementById("cfgClassName").value = cfg.className || "";
    document.getElementById("cfgMeetingTime").value = cfg.meetingNotice?.nextMeetingTime || "";
    document.getElementById("cfgMeetingTopic").value = cfg.meetingNotice?.topic || "";
    document.getElementById("cfgAdminPass").value = cfg.adminPasscode || "8888";
    document.getElementById("cfgStorageMode").value = cfg.storageMode || "textdb";
    document.getElementById("cfgTextdbChannel").value = cfg.textdb?.channelId || "cv_box_2026_74ec0227_a9f3e1b8";
    document.getElementById("cfgJsonbinKey").value = cfg.jsonbin?.apiKey || "";
    document.getElementById("cfgJsonbinId").value = cfg.jsonbin?.binId || "";
    document.getElementById("cfgSupabaseUrl").value = cfg.supabase?.url || "";
    document.getElementById("cfgSupabaseKey").value = cfg.supabase?.anonKey || "";
    document.getElementById("cfgWeb3FormsKey").value = cfg.web3formsAccessKey || "";

    toggleStorageModeBoxes(cfg.storageMode || "textdb");
    document.getElementById("configModal").classList.add("open");
  }

  function toggleStorageModeBoxes(mode) {
    document.getElementById("cfgTextdbBox").style.display = mode === "textdb" ? "block" : "none";
    document.getElementById("cfgJsonbinBox").style.display = mode === "jsonbin" ? "block" : "none";
    document.getElementById("cfgSupabaseBox").style.display = mode === "supabase" ? "block" : "none";
  }

  function collectConfigFromModal() {
    return {
      className: document.getElementById("cfgClassName").value.trim() || "2026级 班级民心工程",
      adminPasscode: document.getElementById("cfgAdminPass").value.trim() || "8888",
      storageMode: document.getElementById("cfgStorageMode").value,
      meetingNotice: {
        enabled: true,
        nextMeetingTime: document.getElementById("cfgMeetingTime").value.trim(),
        topic: document.getElementById("cfgMeetingTopic").value.trim()
      },
      textdb: {
        channelId: document.getElementById("cfgTextdbChannel").value.trim() || "cv_box_2026_74ec0227_a9f3e1b8"
      },
      jsonbin: {
        apiKey: document.getElementById("cfgJsonbinKey").value.trim(),
        binId: document.getElementById("cfgJsonbinId").value.trim()
      },
      supabase: {
        url: document.getElementById("cfgSupabaseUrl").value.trim(),
        anonKey: document.getElementById("cfgSupabaseKey").value.trim()
      },
      web3formsAccessKey: document.getElementById("cfgWeb3FormsKey").value.trim()
    };
  }

  // ==================== 事件绑定初始化 ====================
  function bindEvents() {
    // 主题切换
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

    // 顶部 Tab 切换
    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.tab;
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
        document.getElementById(`panel-${target}`).classList.add("active");
      });
    });

    // 快捷提示词插入
    document.querySelectorAll(".prompt-tag").forEach(tag => {
      tag.addEventListener("click", () => {
        const textarea = document.getElementById("fbContent");
        const promptText = tag.getAttribute("data-prompt");
        textarea.value = textarea.value ? `${textarea.value}\n${promptText}\n` : `${promptText}\n`;
        textarea.focus();
      });
    });

    // 公开/私密单选卡片
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

    // 选填联系方式折叠展开
    document.getElementById("contactToggleBtn").addEventListener("click", () => {
      const body = document.getElementById("contactCollapseBody");
      const arrow = document.getElementById("contactToggleArrow");
      const isOpen = body.classList.toggle("open");
      arrow.textContent = isOpen ? "收起 ▲" : "展开选填 ▼";
    });

    // 提交意见表单
    document.getElementById("feedbackForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById("submitBtn");
      submitBtn.disabled = true;
      submitBtn.innerHTML = "<span>⏳ 正在加密生成回执码...</span>";

      try {
        const created = await storage.addFeedback({
          category: selectedCategory,
          mood: selectedMood,
          title: document.getElementById("fbTitle").value,
          content: document.getElementById("fbContent").value,
          suggestion: document.getElementById("fbSuggestion").value,
          isPublic: selectedIsPublic,
          contact: document.getElementById("fbContact").value
        });

        // 清空表单
        document.getElementById("fbTitle").value = "";
        document.getElementById("fbContent").value = "";
        document.getElementById("fbSuggestion").value = "";
        document.getElementById("fbContact").value = "";

        // 展示回执码凭证弹窗
        document.getElementById("modalReceiptCode").textContent = created.receiptCode;
        document.getElementById("modalReceiptTitle").textContent = created.title;
        document.getElementById("modalReceiptMeta").textContent =
          `投递时间：${created.createdAt} · ${created.isPublic ? "将在班会公开回应" : "仅班委内部查阅"}`;
        document.getElementById("receiptModal").classList.add("open");

        await refreshData();
      } catch (err) {
        alert("提交遇到问题：" + err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = "<span>🚀 匿名投递并生成我的【回执码】</span>";
      }
    });

    // 复制回执码按钮
    document.getElementById("copyReceiptBtn").addEventListener("click", () => {
      const code = document.getElementById("modalReceiptCode").textContent.trim();
      navigator.clipboard.writeText(code).then(() => {
        showToast(`📋 已复制回执码 ${code} 到剪贴板！`);
      });
    });

    document.getElementById("closeReceiptModalBtn").addEventListener("click", () => {
      document.getElementById("receiptModal").classList.remove("open");
    });

    // 民心墙筛选与排序
    document.getElementById("wallStatusFilter").addEventListener("change", (e) => {
      currentWallStatus = e.target.value;
      renderPublicWall();
    });
    document.getElementById("wallSortSelect").addEventListener("change", (e) => {
      currentWallSort = e.target.value;
      renderPublicWall();
    });

    // 回执码查询
    document.getElementById("lookupSearchBtn").addEventListener("click", () => {
      const val = document.getElementById("lookupCodeInput").value;
      renderLookupResult(val);
    });
    document.getElementById("lookupCodeInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        renderLookupResult(e.target.value);
      }
    });

    // 清除本机回执码缓存
    document.getElementById("clearMyReceiptsBtn").addEventListener("click", () => {
      if (!confirm("确定要清除本机浏览器保存的回执码历史记录吗？（请确保你已记住重要回执码）")) return;
      storage.clearMyReceiptsLocal();
      updateNavBadges();
      renderMyLocalReceipts();
      showToast("🗑️ 已清除本机回执码缓存记录");
    });

    // 班委口令解锁
    function checkAdminUnlockState() {
      if (isAdminUnlocked) {
        document.getElementById("adminLockCard").style.display = "none";
        document.getElementById("adminDashboard").style.display = "block";
        renderAdminDashboard();
      } else {
        document.getElementById("adminLockCard").style.display = "block";
        document.getElementById("adminDashboard").style.display = "none";
      }
    }
    checkAdminUnlockState();

    document.getElementById("adminUnlockBtn").addEventListener("click", () => {
      const inputVal = document.getElementById("adminPassInput").value.trim();
      const cfg = storage.loadMergedConfig();
      if (inputVal === String(cfg.adminPasscode || "8888")) {
        isAdminUnlocked = true;
        sessionStorage.setItem("class_voice_admin_unlocked", "1");
        checkAdminUnlockState();
        showToast("🔓 欢迎进入班委工作台！");
      } else {
        showToast("❌ 口令不正确，请重试");
      }
    });

    document.getElementById("adminPassInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        document.getElementById("adminUnlockBtn").click();
      }
    });

    document.getElementById("adminFilterSelect").addEventListener("change", () => {
      renderAdminDashboard();
    });

    document.getElementById("clearDemoBtn").addEventListener("click", async () => {
      if (!confirm("确定要清空内置的 5 条示例意见吗？真实投递的数据会被保留。")) return;
      await storage.clearDemoData();
      await refreshData();
      showToast("🧹 已清空内置示例数据");
    });

    document.getElementById("resetDemoBtn").addEventListener("click", async () => {
      if (!confirm("确定要恢复初始示例数据吗？")) return;
      await storage.resetDemoData();
      await refreshData();
      showToast("🔄 已恢复示例数据");
    });

    // 导出按钮
    document.getElementById("exportMarkdownBtn").addEventListener("click", exportToMarkdown);
    document.getElementById("exportCsvBtn").addEventListener("click", exportToCsv);

    // 透明自检弹窗
    document.getElementById("openTransparencyBtn").addEventListener("click", openTransparencyModal);
    document.getElementById("heroTrustPill").addEventListener("click", openTransparencyModal);
    document.getElementById("sideTransparencyBtn").addEventListener("click", openTransparencyModal);
    document.getElementById("closeTransparencyBtn").addEventListener("click", () => {
      document.getElementById("transparencyModal").classList.remove("open");
    });

    // 云端配置弹窗
    document.getElementById("cloudStatusBtn").addEventListener("click", () => {
      if (!isAdminUnlocked) {
        // 跳转到班委标签页先解锁，或直接打开配置
        openConfigModal();
      } else {
        openConfigModal();
      }
    });
    document.getElementById("openConfigModalBtn").addEventListener("click", openConfigModal);
    document.getElementById("closeConfigModalBtn").addEventListener("click", () => {
      document.getElementById("configModal").classList.remove("open");
    });

    document.getElementById("cfgStorageMode").addEventListener("change", (e) => {
      toggleStorageModeBoxes(e.target.value);
    });

    // 随机生成全新专属云频道 ID
    document.getElementById("regenChannelBtn").addEventListener("click", () => {
      const rand = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
      const newChannel = `cv_box_2026_${rand}`;
      document.getElementById("cfgTextdbChannel").value = newChannel;
      showToast("🎲 已生成新云频道 ID，点击下方保存即可生效");
    });

    // 一键在 JSONBin 创建云端库
    document.getElementById("autoCreateBinBtn").addEventListener("click", async () => {
      const apiKey = document.getElementById("cfgJsonbinKey").value.trim();
      if (!apiKey) {
        alert("请先粘贴你在 jsonbin.io 获取的 X-Master-Key！");
        return;
      }
      const btn = document.getElementById("autoCreateBinBtn");
      btn.disabled = true;
      btn.textContent = "⏳ 创建中...";
      try {
        const binId = await storage.createJsonBin(apiKey);
        document.getElementById("cfgJsonbinId").value = binId;
        showToast("🎉 云端意见箱创建成功！Bin ID 已自动填入");
      } catch (err) {
        alert(err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = "✨ 一键自动创建";
      }
    });

    // 保存配置
    document.getElementById("saveConfigBtn").addEventListener("click", async () => {
      const nextCfg = collectConfigFromModal();
      storage.saveConfigOverride(nextCfg);
      renderSiteBranding();
      await refreshData();
      document.getElementById("configModal").classList.remove("open");
      showToast("✅ 配置已保存并立即生效！");
    });

    // 复制 config.js 代码用于上传 GitHub Pages
    document.getElementById("copyConfigJsBtn").addEventListener("click", () => {
      const nextCfg = collectConfigFromModal();
      const merged = storage.saveConfigOverride(nextCfg);
      const code = `window.CLASS_VOICE_CONFIG = ${JSON.stringify(merged, null, 2)};\n`;
      navigator.clipboard.writeText(code).then(() => {
        showToast("📋 已复制最新 config.js 代码！可直接粘贴覆盖 js/config.js 后上传 GitHub");
      });
    });

    // 班会全屏投屏控制
    document.getElementById("startProjectorBtn").addEventListener("click", openProjectorMode);
    document.getElementById("exitProjectorBtn").addEventListener("click", () => {
      document.getElementById("projectorOverlay").classList.remove("open");
    });
    document.getElementById("projPrevBtn").addEventListener("click", () => {
      if (projectorList.length === 0) return;
      projectorIndex = (projectorIndex - 1 + projectorList.length) % projectorList.length;
      renderProjectorSlide();
    });
    document.getElementById("projNextBtn").addEventListener("click", () => {
      if (projectorList.length === 0) return;
      projectorIndex = (projectorIndex + 1) % projectorList.length;
      renderProjectorSlide();
    });
    document.getElementById("projMarkResolvedBtn").addEventListener("click", async () => {
      if (projectorList.length === 0) return;
      const currentItem = projectorList[projectorIndex];
      await storage.updateFeedbackAdmin(currentItem.id, { status: "resolved" });
      currentItem.status = "resolved";
      renderProjectorSlide();
      await refreshData();
      showToast(`✅ 已将 #${currentItem.receiptCode} 标记为「班会已回应」`);
    });

    // 投屏键盘快捷键支持（左右方向键翻页、ESC退出）
    document.addEventListener("keydown", (e) => {
      const overlay = document.getElementById("projectorOverlay");
      if (!overlay.classList.contains("open")) return;
      if (e.key === "Escape") {
        overlay.classList.remove("open");
      } else if (e.key === "ArrowRight" || e.key === "PageDown") {
        document.getElementById("projNextBtn").click();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        document.getElementById("projPrevBtn").click();
      }
    });
  }

  // 启动应用
  document.addEventListener("DOMContentLoaded", async () => {
    renderSiteBranding();
    initFormSelectors();
    bindEvents();
    await refreshData();
  });
})();
