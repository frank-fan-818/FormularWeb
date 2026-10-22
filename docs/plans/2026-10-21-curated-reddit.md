# Reddit 精选帖子

用户已选择人工精选帖子，并接受按需官方嵌入与原帖链接。作为尚未发布的 news feat 继续使用准备中的 1.2.0，不重复 bump、不提交或部署。

## 页面设计

- 受众：希望跟进 F1 社区讨论的网站访客。首要任务：从中文导读选择值得阅读的讨论。
- `/news?category=social` 展示三条人工核实过的 r/formula1 帖子；来源栏有明确入口及数量。筛选状态可刷新 / 返回恢复。
- 列表显示本站撰写的双语标题与导读、社区、收录日期；收录时间不冒充发帖时间，不编造热度 / 点赞 / 评论数。
- `/news/picks/:id` 独立站内详情，不依赖 RSS 请求成功。保留原题与原帖链接，区分本站导读和社区内容。
- 复用围场新闻版式、字体及 design tokens；桌面密集列表、移动端自然换行，44px 控件。
- 官方 iframe 仅点击后加载；不在本站运行外站脚本。地址及 resize.embed 消息协议实读自 https://embed.reddit.com/widgets.js。iframe 的来源 / 路径固定校验，消息同时验证 origin、source、类型和有界高度。
- 加载中、超时 / 失败、重试、空搜索、未知 ID 均有明确状态。iframe onload 不代表帖子成功显示，必须收到官方 resize 消息；无法访问时仍可读本站导读并打开原帖。
- CSP 仅增加精确 frame-src https://embed.reddit.com，保持其余策略。

## 实施与验收

1. 添加类型、精选数据和固定来源 URL / 消息校验。
2. 列表与站内详情、按需嵌入；双语文案和懒加载路由。
3. 单元测试校验来源、消息，浏览器验证筛选 / 搜索 / 返回 / 刷新、嵌入未自动加载、成功 / 超时 / 重试、RSS 故障独立可读。
4. 构建、lint、UTF-8、部署配置检查；1440×900 / 375×812 / 768×1024 截图、控制台 / 网络检查及既有关键路由 smoke。

## 维护

数据入口 `src/data/curatedPosts.ts`；新增 / 移除精选走代码审查。本站导读独立撰写，仅使用已核实的主题信息；帖子正文、媒体、作者及实时状态由 Reddit 嵌入提供。首版没有后台管理和自动采集。

已核实原帖：
- https://www.reddit.com/r/formula1/comments/1x38muu/2026_singapore_grand_prix_postrace_discussion/
- https://www.reddit.com/r/formula1/comments/1wyclgu/radio_rewind_2026_bahrain_grand_prix_in_malaysia/
- https://www.reddit.com/r/formula1/comments/1v1ia6n/2026_belgian_gp_day_after_debrief/

官方嵌入说明：https://support.reddithelp.com/hc/en-us/articles/360043033532-How-do-I-embed-a-Reddit-post-or-comment-in-an-article-or-other-publication
