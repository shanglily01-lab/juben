# 墨本

短剧剧本和小说放在同一个站里。手机浏览器和电脑共用注册、金币和稿件。

## 本地运行

```bash
npm install
npm run icons
npm run dev
npm test
```

`npm test` 跑单元测试和集成测试，数据库写在系统临时目录，不会改动 `data/moben.sqlite`。

电脑打开 http://localhost:3000 。手机和电脑连同一个 Wi-Fi 时，用终端里显示的局域网地址打开。首次若打不开，在 Windows 防火墙里放行 3000 端口。

手机浏览器菜单里选「添加到主屏幕」后，会以全屏方式打开。

## 稿从哪来

- 编辑室稿件是 `content/seed` 里的 Markdown，第一次启动时导入。
- 注册用户在「投稿」里上传 `.md`，或直接写。付费正文只存在数据库里，不会放到公开目录。

## 审核和金币

不配置模型时，用内置规则打分。要换成大模型，复制 `.env.example` 为 `.env.local`。

推荐直接用 Gemini（同一把钥匙审稿 + 按主剧情出封面）：

```
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
AI_API_KEY=你的_Gemini_密钥
AI_MODEL=gemini-2.0-flash

AI_IMAGE_PROVIDER=gemini
AI_IMAGE_MODEL=gemini-2.5-flash-image
AI_IMAGE_SIZE=2:3

SESSION_SECRET=一长串随机字符
```

密钥在 https://aistudio.google.com/apikey 申请。也可用 DeepSeek 审稿 + SiliconFlow 出图，见 `.env.example`。不配图生模型时，封面回退到站内 SVG 模板。

注册后要到邮箱点开激活链接。激活成功赠送 20 金币。每天签到从 2 金币起，连续 7 天后每天 10。邀请的新用户激活后，邀请人得 15，新用户额外得 10。充值是演示入账，不会产生真实扣款。金币同时用来解锁短剧和小说。规则详见 `docs/金币签到与邀请.md`。

不配置发信时，激活链接写在 `data/outbox`，开发环境的激活页会直接显示。要真正发信，在 `.env.local` 里加上 `SMTP_HOST`、`SMTP_PORT`、`MAIL_FROM`，需要登录时再加 `SMTP_USER` 和 `SMTP_PASS`。手机和电脑不在本机时，把 `APP_ORIGIN` 设成实际打开的地址，激活链接才会指回这个站。

## 过审大概看什么

短剧要有场次、人物、动作和对白。小说要有完整段落。少于 400 字，或重复、不成句，会被拒绝，作者本人仍能看到意见。
