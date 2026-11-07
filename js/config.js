/**
 * 班级民心意见箱 - 全局配置文件
 * 已默认为你预置好免注册云端实时同步频道 (textdb)，部署到 GitHub Pages 后全班跨手机即可直接使用！
 * 你也可以直接在网页右上角【云端已连接 -> 系统与班会设置】中随时修改班级名称和班会预告。
 */
window.CLASS_VOICE_CONFIG = {
  // 1. 班级基本信息
  className: "2026级 班级民心工程",
  siteTitle: "班级民心意见箱",
  siteSubtitle: "匿名倾听每一份声音 · 班会公开回应每一件实事",
  
  // 2. 近期班会预告（显示在首页顶部横幅）
  meetingNotice: {
    enabled: true,
    nextMeetingTime: "本周班会集中回应",
    topic: "班会民心回音壁：按【回执码】公开讨论并回应大家提交的所有建议",
    committeeNote: "大家提交意见后请保存好自己的【回执码】，班会上班委将直接报回执码逐条讨论答复，全程不问姓名、对事不对人！"
  },

  // 3. 班委后台默认口令（用于班委查看选填联系方式、导出数据、开启班会投屏模式）
  adminPasscode: "8888",

  // 4. 云端数据同步配置（已为你默认配好免注册云同步频道，开箱即用！）
  // 支持四种模式：
  // - "textdb"  : 默认已启用！免注册即开即用云端同步（支持全班跨手机实时提交、公开墙同步、回执码状态查询）
  // - "jsonbin" : JSONBin.io 云存储
  // - "supabase": Supabase 云数据库
  // - "local"   : 仅单机本地浏览器缓存模式
  storageMode: "textdb",

  // 免注册云端同步专属频道 ID（已为你生成独立随机频道，全班共用此频道实时同步）
  textdb: {
    channelId: "cv_box_2026_74ec0227_a9f3e1b8"
  },

  // JSONBin.io 备选配置（可选）
  jsonbin: {
    binId: "",
    apiKey: ""
  },

  // Supabase 备选配置（可选）
  supabase: {
    url: "",
    anonKey: ""
  },

  // 5. 额外邮件通知（可选：在 https://web3forms.com 输入邮箱获取 Access Key）
  web3formsAccessKey: ""
};
