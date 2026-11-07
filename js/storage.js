/**
 * 班级民心意见箱 - 数据存储与云端同步引擎
 * 支持 TextDB（默认免注册即开即用云同步）、JSONBin.io、Supabase、LocalStorage 及 Web3Forms 邮件推送
 */

const STORAGE_KEYS = {
  ITEMS: "class_voice_feedbacks_v1",
  MY_RECEIPTS: "class_voice_my_receipts_v1",
  UPVOTED_IDS: "class_voice_upvoted_v1",
  CONFIG_OVERRIDE: "class_voice_config_override_v1",
  ADMIN_AUTH: "class_voice_admin_session_v1"
};

// UTF-8 安全的 Base64 编解码（确保中文与 Emoji 在云端无损传输）
function encodeUtf8Base64(obj) {
  const jsonStr = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(jsonStr);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decodeUtf8Base64(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const jsonStr = new TextDecoder().decode(bytes);
  return JSON.parse(jsonStr);
}

// 分类元数据定义
window.CATEGORIES = [
  { id: "study", name: "学习与课程", icon: "📚", color: "#4F46E5", bg: "rgba(79, 70, 229, 0.1)" },
  { id: "management", name: "班级管理与班风", icon: "🏠", color: "#0D9488", bg: "rgba(13, 148, 136, 0.1)" },
  { id: "activity", name: "团建与班级活动", icon: "🎉", color: "#EA580C", bg: "rgba(234, 88, 12, 0.1)" },
  { id: "dorm", name: "宿舍与生活后勤", icon: "🛡️", color: "#2563EB", bg: "rgba(37, 99, 235, 0.1)" },
  { id: "committee", name: "班委工作建议", icon: "🤝", color: "#9333EA", bg: "rgba(147, 51, 234, 0.1)" },
  { id: "other", name: "其他奇思妙想", icon: "💡", color: "#D97706", bg: "rgba(217, 119, 6, 0.1)" }
];

// 情绪/紧迫度定义
window.MOODS = [
  { id: "suggest", name: "温和建议", icon: "😊", badgeClass: "mood-suggest" },
  { id: "question", name: "困惑求助", icon: "🤔", badgeClass: "mood-question" },
  { id: "urgent", name: "急需解决", icon: "🔥", badgeClass: "mood-urgent" },
  { id: "praise", name: "点赞表扬", icon: "🌟", badgeClass: "mood-praise" }
];

// 意见处理状态定义（专为班会回应设计）
window.STATUS_MAP = {
  pending: { label: "待班委整理", icon: "⏳", className: "status-pending", desc: "已匿名投递，等待班委汇总" },
  agenda: { label: "已列入班会议程", icon: "📋", className: "status-agenda", desc: "将在最近一次班会上公开讨论回应" },
  resolved: { label: "班会已回应/已落实", icon: "✅", className: "status-resolved", desc: "已在班会上集中答复或落实解决" }
};

// 初始示例数据（方便首次打开直观预览效果，可在后台一键清空）
const INITIAL_DEMO_DATA = [
  {
    id: "demo-1",
    receiptCode: "MX-8A3F",
    category: "study",
    mood: "suggest",
    title: "希望考前能组织高数和数据结构的小组互助答疑",
    content: "最近数据结构树和图那几章大家普遍觉得有点吃力，平时自己看书效率低。能不能由学习委员牵头，在期中考试前组织一两次晚自习串讲或者结对答疑？",
    suggestion: "可以统计一下班里愿意当小讲师的大神同学，按章节给大家串讲1小时，还可以加综测公益分鼓励一下。",
    isPublic: true,
    contact: "",
    status: "agenda",
    meetingNote: "已纳入本周班会第1号议题！学习委员已联系好3位成绩优秀的同学准备知识点导图，班会现场定时间。",
    upvotes: 18,
    followUps: [
      { time: "2026-11-05 20:15", text: "补充：如果能把历年期末复习题也汇总一份电子版就更好了！" }
    ],
    createdAt: "2026-11-05 18:30",
    isDemo: true
  },
  {
    id: "demo-2",
    receiptCode: "MX-5C92",
    category: "activity",
    mood: "suggest",
    title: "关于本学期班级团建形式的一点小建议",
    content: "之前每次团建都是纯聚餐，感觉大家坐一桌还是只跟同宿舍的人聊天，玩不太开。希望这次秋游或者团建能换点更有参与感的形式。",
    suggestion: "比如去草坪露营野餐+桌游剧本杀，或者羽毛球趣味赛+零食茶话会，预算差不多但大家互动会多很多！",
    isPublic: true,
    contact: "",
    status: "agenda",
    meetingNote: "已列入班会投票议程，文体委员整理了3个备选方案，班会现场举手/扫码定最终方案。",
    upvotes: 24,
    followUps: [],
    createdAt: "2026-11-06 10:12",
    isDemo: true
  },
  {
    id: "demo-3",
    receiptCode: "MX-2E71",
    category: "management",
    mood: "urgent",
    title: "班级群重要通知有时候会被闲聊刷屏漏看",
    content: "平时班级大群消息比较多，有时候交材料或者查课表的通知发出来没多久就被表情包顶上去了，好几次差点错过截止时间。",
    suggestion: "建议设一个禁言的「纯通知群」或者每次重要通知统一用群公告+@全员，并在群待办里挂一下。",
    isPublic: true,
    contact: "",
    status: "resolved",
    meetingNote: "已采纳并落实！即日起所有重要通知均同步发布【群公告】并开启【群待办】提醒，每周日晚班长汇总下周DDL清单。",
    upvotes: 31,
    followUps: [],
    createdAt: "2026-11-04 14:20",
    isDemo: true
  },
  {
    id: "demo-4",
    receiptCode: "MX-9B44",
    category: "committee",
    mood: "praise",
    title: "给心理委员和生活委员点个赞！",
    content: "上周感冒发烧去医务室，生活委员不仅帮忙送了体温计和热水，还帮我向任课老师递了假条，特别暖心，必须匿名夸一夸！",
    suggestion: "希望班委们继续保持，也祝班委们门门满绩！",
    isPublic: true,
    contact: "",
    status: "resolved",
    meetingNote: "收到暖心鼓励！将在班会上公开表扬。",
    upvotes: 27,
    followUps: [],
    createdAt: "2026-11-06 21:05",
    isDemo: true
  },
  {
    id: "demo-5",
    receiptCode: "MX-6D19",
    category: "dorm",
    mood: "question",
    title: "宿舍饮水机报修进度咨询及个人调宿咨询",
    content: "3号楼408附近的公共直饮水机坏了三天还没修好，想问下生活委员能不能帮忙催一下后勤？另外有点个人作息协调问题想私下请教班长。",
    suggestion: "",
    isPublic: false,
    contact: "微信：student_wx_09（周同学，麻烦班长空了私聊我一下）",
    status: "agenda",
    meetingNote: "饮水机问题已在班会后勤通报中说明（周四下午更换滤芯）；个人问题班长已私下对接。",
    upvotes: 1,
    followUps: [],
    createdAt: "2026-11-06 22:40",
    isDemo: true
  }
];

class VoiceStorage {
  constructor() {
    this.config = this.loadMergedConfig();
  }

  // 加载合并后的配置（config.js + 浏览器本地覆盖配置）
  loadMergedConfig() {
    const base = window.CLASS_VOICE_CONFIG || {};
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CONFIG_OVERRIDE);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...base,
          ...parsed,
          meetingNotice: { ...(base.meetingNotice || {}), ...(parsed.meetingNotice || {}) },
          textdb: { ...(base.textdb || {}), ...(parsed.textdb || {}) },
          jsonbin: { ...(base.jsonbin || {}), ...(parsed.jsonbin || {}) },
          supabase: { ...(base.supabase || {}), ...(parsed.supabase || {}) }
        };
      }
    } catch (e) {
      console.warn("读取本地配置失败:", e);
    }
    return base;
  }

  saveConfigOverride(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig,
      meetingNotice: { ...(this.config.meetingNotice || {}), ...(newConfig.meetingNotice || {}) },
      textdb: { ...(this.config.textdb || {}), ...(newConfig.textdb || {}) },
      jsonbin: { ...(this.config.jsonbin || {}), ...(newConfig.jsonbin || {}) },
      supabase: { ...(this.config.supabase || {}), ...(newConfig.supabase || {}) }
    };
    localStorage.setItem(STORAGE_KEYS.CONFIG_OVERRIDE, JSON.stringify(this.config));
    return this.config;
  }

  // 生成易读且无规律的匿名回执码（排除易混淆的 0/O/1/I）
  generateReceiptCode() {
    const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let code = "MX-";
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // 获取当前是否启用了云端模式
  isCloudEnabled() {
    const mode = this.config.storageMode;
    if (mode === "textdb" && this.config.textdb?.channelId) {
      return true;
    }
    if (mode === "jsonbin" && this.config.jsonbin?.binId && this.config.jsonbin?.apiKey) {
      return true;
    }
    if (mode === "supabase" && this.config.supabase?.url && this.config.supabase?.anonKey) {
      return true;
    }
    return false;
  }

  // 获取所有意见列表
  async getAllFeedbacks() {
    const mode = this.config.storageMode;

    // 1. TextDB 免注册即开即用云端模式
    if (mode === "textdb" && this.config.textdb?.channelId) {
      try {
        const channelId = encodeURIComponent(this.config.textdb.channelId.trim());
        const res = await fetch(`https://textdb.dev/api/data/${channelId}`, {
          method: "GET"
        });
        if (res.ok) {
          const text = await res.text();
          if (text && text.trim()) {
            const parsed = JSON.parse(text);
            if (parsed && parsed.payload) {
              const decoded = decodeUtf8Base64(parsed.payload);
              const list = Array.isArray(decoded.feedbacks) ? decoded.feedbacks : [];
              localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(list));
              return list;
            }
          }
          // 如果云端频道首次为空，自动初始化示例数据上云
          await this.saveAllFeedbacks([...INITIAL_DEMO_DATA]);
          return [...INITIAL_DEMO_DATA];
        }
      } catch (err) {
        console.warn("从 TextDB 云频道同步失败，回退到本地缓存:", err);
      }
    }

    // 2. JSONBin.io 云端模式
    if (mode === "jsonbin" && this.config.jsonbin?.binId && this.config.jsonbin?.apiKey) {
      try {
        const res = await fetch(`https://api.jsonbin.io/v3/b/${this.config.jsonbin.binId}/latest`, {
          method: "GET",
          headers: {
            "X-Master-Key": this.config.jsonbin.apiKey,
            "X-Bin-Meta": "false"
          }
        });
        if (!res.ok) throw new Error(`JSONBin HTTP ${res.status}`);
        const data = await res.json();
        const list = Array.isArray(data.feedbacks) ? data.feedbacks : (Array.isArray(data) ? data : []);
        localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(list));
        return list;
      } catch (err) {
        console.warn("从 JSONBin 同步失败，回退到本地缓存:", err);
      }
    }

    // 3. Supabase 云端模式
    if (mode === "supabase" && this.config.supabase?.url && this.config.supabase?.anonKey) {
      try {
        const url = `${this.config.supabase.url.replace(/\/$/, "")}/rest/v1/class_feedbacks?select=*&order=createdAt.desc`;
        const res = await fetch(url, {
          headers: {
            "apikey": this.config.supabase.anonKey,
            "Authorization": `Bearer ${this.config.supabase.anonKey}`
          }
        });
        if (!res.ok) throw new Error(`Supabase HTTP ${res.status}`);
        const list = await res.json();
        localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(list));
        return list;
      } catch (err) {
        console.warn("从 Supabase 同步失败，回退到本地缓存:", err);
      }
    }

    // 4. 本地存储模式或兜底
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ITEMS);
      if (!raw) {
        localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(INITIAL_DEMO_DATA));
        return [...INITIAL_DEMO_DATA];
      }
      return JSON.parse(raw);
    } catch (e) {
      return [...INITIAL_DEMO_DATA];
    }
  }

  // 保存完整意见列表到存储后端
  async saveAllFeedbacks(list) {
    localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(list));
    const mode = this.config.storageMode;

    // 1. TextDB 云端保存
    if (mode === "textdb" && this.config.textdb?.channelId) {
      const channelId = encodeURIComponent(this.config.textdb.channelId.trim());
      const b64 = encodeUtf8Base64({
        feedbacks: list,
        updatedAt: new Date().toISOString()
      });
      const res = await fetch(`https://textdb.dev/api/data/${channelId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ payload: b64 })
      });
      if (!res.ok) {
        throw new Error(`云端同步失败 (${res.status})，请稍后重试`);
      }
    }

    // 2. JSONBin.io 云端保存
    if (mode === "jsonbin" && this.config.jsonbin?.binId && this.config.jsonbin?.apiKey) {
      const res = await fetch(`https://api.jsonbin.io/v3/b/${this.config.jsonbin.binId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Master-Key": this.config.jsonbin.apiKey
        },
        body: JSON.stringify({ feedbacks: list, updatedAt: new Date().toISOString() })
      });
      if (!res.ok) {
        throw new Error(`云端保存失败 (${res.status})，请检查 JSONBin 配置`);
      }
    }
    return list;
  }

  // 新增一条意见
  async addFeedback(payload) {
    const list = await this.getAllFeedbacks();

    // 确保回执码唯一
    let receiptCode = this.generateReceiptCode();
    while (list.some(item => item.receiptCode === receiptCode)) {
      receiptCode = this.generateReceiptCode();
    }

    const now = new Date();
    const formattedTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    // 严格只保留公开声明的业务字段，不含任何设备/IP/指纹信息
    const newItem = {
      id: "fb-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      receiptCode,
      category: payload.category || "study",
      mood: payload.mood || "suggest",
      title: (payload.title || "").trim(),
      content: (payload.content || "").trim(),
      suggestion: (payload.suggestion || "").trim(),
      isPublic: payload.isPublic !== false,
      contact: (payload.contact || "").trim(),
      status: "pending",
      meetingNote: "",
      upvotes: 1,
      followUps: [],
      createdAt: formattedTime
    };

    if (this.config.storageMode === "supabase" && this.config.supabase?.url && this.config.supabase?.anonKey) {
      const url = `${this.config.supabase.url.replace(/\/$/, "")}/rest/v1/class_feedbacks`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": this.config.supabase.anonKey,
          "Authorization": `Bearer ${this.config.supabase.anonKey}`,
          "Prefer": "return=minimal"
        },
        body: JSON.stringify(newItem)
      });
      if (!res.ok) throw new Error(`Supabase 提交失败 (${res.status})`);
    }

    const updated = [newItem, ...list];
    await this.saveAllFeedbacks(updated);

    // 保存回执码到用户自己的手机本地记录（方便自己随时查询，不上传）
    this.saveMyReceiptLocal({
      receiptCode: newItem.receiptCode,
      title: newItem.title,
      category: newItem.category,
      createdAt: newItem.createdAt
    });

    // 如果配置了 Web3Forms 邮箱提醒，异步触发邮件通知班委
    if (this.config.web3formsAccessKey) {
      this.sendWeb3FormsNotification(newItem).catch(err => console.warn("邮件通知发送异常:", err));
    }

    return newItem;
  }

  // 发送 Web3Forms 邮件通知给班委
  async sendWeb3FormsNotification(item) {
    const catObj = window.CATEGORIES.find(c => c.id === item.category) || { name: "其他" };
    await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        access_key: this.config.web3formsAccessKey,
        subject: `【班级意见箱】收到新投递 [${item.receiptCode}] - ${item.title}`,
        from_name: this.config.siteTitle || "班级民心意见箱",
        receipt_code: item.receiptCode,
        category: catObj.name,
        title: item.title,
        content: item.content,
        suggestion: item.suggestion || "无",
        public_allowed: item.isPublic ? "允许班会公开展示" : "仅班委内部查阅",
        optional_contact: item.contact || "未留下联系方式（纯匿名）",
        submitted_at: item.createdAt
      })
    });
  }

  // 凭回执码追加补充说明
  async addFollowUpByReceipt(receiptCode, text) {
    const code = receiptCode.trim().toUpperCase();
    const list = await this.getAllFeedbacks();
    const idx = list.findIndex(item => item.receiptCode.toUpperCase() === code);
    if (idx === -1) return null;

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    if (!Array.isArray(list[idx].followUps)) {
      list[idx].followUps = [];
    }
    list[idx].followUps.push({
      time: timeStr,
      text: text.trim()
    });

    if (this.config.storageMode === "supabase" && this.config.supabase?.url && this.config.supabase?.anonKey) {
      const url = `${this.config.supabase.url.replace(/\/$/, "")}/rest/v1/class_feedbacks?receiptCode=eq.${encodeURIComponent(list[idx].receiptCode)}`;
      await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": this.config.supabase.anonKey,
          "Authorization": `Bearer ${this.config.supabase.anonKey}`
        },
        body: JSON.stringify({ followUps: list[idx].followUps })
      });
    }

    await this.saveAllFeedbacks(list);
    return list[idx];
  }

  // 附议/同感 +1
  async toggleUpvote(id) {
    const upvotedIds = this.getUpvotedIds();
    const alreadyUpvoted = upvotedIds.includes(id);
    const list = await this.getAllFeedbacks();
    const idx = list.findIndex(item => item.id === id);
    if (idx === -1) return null;

    if (alreadyUpvoted) {
      list[idx].upvotes = Math.max(0, (list[idx].upvotes || 1) - 1);
      const nextIds = upvotedIds.filter(item => item !== id);
      localStorage.setItem(STORAGE_KEYS.UPVOTED_IDS, JSON.stringify(nextIds));
    } else {
      list[idx].upvotes = (list[idx].upvotes || 0) + 1;
      upvotedIds.push(id);
      localStorage.setItem(STORAGE_KEYS.UPVOTED_IDS, JSON.stringify(upvotedIds));
    }

    if (this.config.storageMode === "supabase" && this.config.supabase?.url && this.config.supabase?.anonKey) {
      const url = `${this.config.supabase.url.replace(/\/$/, "")}/rest/v1/class_feedbacks?id=eq.${encodeURIComponent(id)}`;
      await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": this.config.supabase.anonKey,
          "Authorization": `Bearer ${this.config.supabase.anonKey}`
        },
        body: JSON.stringify({ upvotes: list[idx].upvotes })
      });
    }

    await this.saveAllFeedbacks(list);
    return { item: list[idx], upvoted: !alreadyUpvoted };
  }

  getUpvotedIds() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.UPVOTED_IDS) || "[]");
    } catch {
      return [];
    }
  }

  // 班委更新状态或班会纪要备注
  async updateFeedbackAdmin(id, updates) {
    const list = await this.getAllFeedbacks();
    const idx = list.findIndex(item => item.id === id);
    if (idx === -1) return null;

    list[idx] = { ...list[idx], ...updates };

    if (this.config.storageMode === "supabase" && this.config.supabase?.url && this.config.supabase?.anonKey) {
      const url = `${this.config.supabase.url.replace(/\/$/, "")}/rest/v1/class_feedbacks?id=eq.${encodeURIComponent(id)}`;
      await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": this.config.supabase.anonKey,
          "Authorization": `Bearer ${this.config.supabase.anonKey}`
        },
        body: JSON.stringify(updates)
      });
    }

    await this.saveAllFeedbacks(list);
    return list[idx];
  }

  // 删除单条意见或清空演示数据
  async deleteFeedback(id) {
    const list = await this.getAllFeedbacks();
    const next = list.filter(item => item.id !== id);

    if (this.config.storageMode === "supabase" && this.config.supabase?.url && this.config.supabase?.anonKey) {
      const url = `${this.config.supabase.url.replace(/\/$/, "")}/rest/v1/class_feedbacks?id=eq.${encodeURIComponent(id)}`;
      await fetch(url, {
        method: "DELETE",
        headers: {
          "apikey": this.config.supabase.anonKey,
          "Authorization": `Bearer ${this.config.supabase.anonKey}`
        }
      });
    }

    await this.saveAllFeedbacks(next);
    return next;
  }

  async clearDemoData() {
    const list = await this.getAllFeedbacks();
    const realOnly = list.filter(item => !item.isDemo);
    await this.saveAllFeedbacks(realOnly);
    return realOnly;
  }

  async resetDemoData() {
    await this.saveAllFeedbacks([...INITIAL_DEMO_DATA]);
    return [...INITIAL_DEMO_DATA];
  }

  // 一键在 JSONBin.io 上创建新的云端意见箱 Bin
  async createJsonBin(apiKey) {
    const currentList = await this.getAllFeedbacks();
    const res = await fetch("https://api.jsonbin.io/v3/b", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": apiKey.trim(),
        "X-Bin-Name": "class_voice_feedback_box"
      },
      body: JSON.stringify({
        feedbacks: currentList,
        updatedAt: new Date().toISOString()
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`创建失败 (${res.status}): ${errText}`);
    }
    const data = await res.json();
    return data.metadata?.id;
  }

  // 本机回执码记录管理（仅存在发信人自己的浏览器中）
  getMyReceiptsLocal() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.MY_RECEIPTS) || "[]");
    } catch {
      return [];
    }
  }

  saveMyReceiptLocal(record) {
    const list = this.getMyReceiptsLocal().filter(r => r.receiptCode !== record.receiptCode);
    list.unshift(record);
    localStorage.setItem(STORAGE_KEYS.MY_RECEIPTS, JSON.stringify(list.slice(0, 30)));
  }

  clearMyReceiptsLocal() {
    localStorage.removeItem(STORAGE_KEYS.MY_RECEIPTS);
  }
}

window.voiceStorage = new VoiceStorage();
