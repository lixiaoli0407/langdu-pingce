# 《陈太丘与友期行》朗读评测系统 - 部署手册

本系统 = **大屏端**（教室一体机打开）+ **手机端**（老师手机微信扫码打开）+ **讯飞语音评测 ISE 真实打分**。

学生朗读 → 手机录音上传 → 讯飞ISE分析 → 大屏自动显示**准确度 / 流利度 / 完整度** + 问题清单 → 第二次评测后自动生成**柱状图对比 + 对比表格**。

---

## 部署前你需要准备的东西（共 3 样）

| 东西 | 你有吗 | 去哪拿 |
|---|---|---|
| GitHub 账号 | ✅ 已有 | github.com |
| 讯飞三件套（APPID / APIKey / APISecret） | ⬜ 见下文第一节 | xfyun.cn 控制台 |
| Vercel 账号 | ⬜ 现注册（10秒） | vercel.com（用 GitHub 一键登录） |

---

## 第一节：拿讯飞三件套

你的应用「语文助手」（APPID = **7c6ddc0f**）已开通语音评测（流式版），剩余 10500 次。

1. 打开 https://www.xfyun.cn → 右上角头像 → **控制台**
2. 找到应用「语文助手」，点右侧 **✏️（编辑）**
3. 在应用详情页能看到三行：
   - **APPID**：7c6ddc0f
   - **APIKey**：32位字母数字
   - **APISecret**：32位字母数字
4. 把 APIKey 和 APISecret **先复制到电脑记事本**，第 4.3 步要填

> ⚠️ 三件套相当于账号钥匙：不要发到微信群、不要提交到 GitHub 公开仓库。只填在 Vercel 的环境变量设置里（那里是私密加密的）。

---

## 第二节：把代码上传到 GitHub（约 5 分钟）

1. 打开 https://github.com/new （登录后新建仓库页）
2. **Repository name** 填：`langdu-pingce`
3. 选 **Public**（免费），其余默认，点绿色按钮 **Create repository**
4. 创建后页面中间有个 **"uploading an existing file"** 链接，点它
5. 把本文件夹 `langdu-pingce` 里的**全部 4 项内容**一起拖进上传区：
   - `api` 文件夹（含 3 个 .js 文件）
   - `public` 文件夹（含 index.html 和 qrcode.min.js）
   - `package.json`
   - `vercel.json`
   - （README.md 本文件可传可不传）
6. 拖完后点绿色按钮 **Commit changes**，等待上传完成
7. 上传后检查：仓库页面应能看到 `api/` 和 `public/` 两个文件夹

---

## 第三节：Vercel 部署（约 5 分钟）

### 3.1 注册并导入项目

1. 打开 https://vercel.com → 点 **Sign Up** → 选 **Continue with GitHub** → 用你的 GitHub 账号授权登录
2. 登录后点 **Add New... → Project**
3. 在 "Import Git Repository" 列表里找到 `langdu-pingce`，点 **Import**
4. 进入配置页，**先不要点 Deploy**，往下走 3.2

### 3.2 填讯飞密钥（关键步骤，跳过必然失败）

在配置页找到 **Environment Variables** 区域，逐条添加以下 3 个变量（每条：Name 填名字，Value 填值，然后点 Add）：

| Name | Value |
|---|---|
| `XF_APPID` | 7c6ddc0f |
| `XF_API_KEY` | 你的 APIKey（第一节抄的） |
| `XF_API_SECRET` | 你的 APISecret（第一节抄的） |

> 注意 Name 必须一字不差（全大写、下划线），Value 前后不要带空格。

### 3.3 点 Deploy

点 **Deploy** 按钮，等待约 1 分钟，出现 🎉祝贺页面。此时先别急着打开网站，继续第四节（不连 Blob，评测记录保存不了）。

---

## 第四节：连接 Vercel Blob（约 2 分钟）

1. 在 Vercel 进入你的项目页（刚部署完会自动进入）
2. 点顶部标签 **Storage**
3. 点 **Create Database** → 选 **Blob** → 起名 `langdu`（随意）→ 点 Create
4. 创建后点 **Connect to Project** → 选 `langdu-pingce` → 确认
5. 连接后，回到项目页，点顶部 **Deployments** 标签
6. 找到最上面那次部署，点右侧 ⋯ → **Redeploy** → 确认
   （这一步让 Blob 密钥生效，必须做）

---

## 第五节：开始使用

1. 部署成功后，项目页顶部有你的网址，形如：
   `https://langdu-pingce-xxxx.vercel.app`
2. **教室一体机**浏览器打开这个网址 → 显示大屏端：课文 + 二维码 + 房间号（5个大写字母）
3. **老师手机**微信扫大屏上的二维码 → 打开手机端录音页
4. 学生开始朗读 → 手机点 **开始录音** → 读完点 **结束录音** → 点 **上传到大屏评测**
5. 等待约 5~20 秒 → 大屏自动显示准确度 / 流利度 / 完整度 + 问题清单
6. 第二个学生（或同一学生再读一遍）再录一次上传 → 大屏自动出现**两次对比柱状图 + 表格**
7. 换班级/重新开始：点大屏上的 **清空重来**

> 💡 建议把大屏网址收藏到浏览器书签。房间号在网址里，刷新页面房间号不变。

---

## 常见问题

| 问题 | 处理 |
|---|---|
| 手机录音提示"未获得麦克风权限" | 微信里点允许；或用手机自带录音机录好，再在手机页"选择已有录音文件"上传 |
| 大屏一直显示"等待上传" | 检查手机端上传时提示是否成功；确认两边房间号一致 |
| 显示"评测失败：讯飞接口错误" | 截图错误码发给助手排查；先确认额度未用完（控制台→语音扩展→语音评测流式版） |
| 显示"讯飞密钥未配置" | Vercel → Settings → Environment Variables 检查 3 个变量拼写，改完需 Redeploy |
| 分数显示"—" | 说明该维度讯飞未返回，截图发给助手调整解析字段 |
| 想换课文 | 把课文原文发给助手，改 `api/upload.js` 里的 TEXT 和 `public/index.html` 里的 text 数组 |

## 计费与额度

- 讯飞ISE：当前剩余 10500 次，到期 2027-01-03（控制台可查）
- Vercel 免费层 / Vercel Blob 免费层：课堂使用量级完全够
- 以上全部免费，无付费项
