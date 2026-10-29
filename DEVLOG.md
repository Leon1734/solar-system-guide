# 开发日志（DEVLOG）——交接与续作指南

> 本文件是 ZCode 会话的交接日志：上下文压缩后凭此文件 + 记忆可直接续作。
> 最后更新：2026-10-30（v29.0 已发布）

## 项目定位

「太阳系漫游指南」——零依赖、双击即用、完全离线的交互式三维太阳系科普演示。
在线版 https://leon1734.github.io/solar-system-guide （GitHub Pages，push 自动部署）。
本地仓库 `E:\Workspace_AI\ZCODE\Keke\sun`（main 分支，GitHub 账号 Leon1734）。

## 当前状态（v29.0，断言 214 项全过）

版本线（tag 已全部推送）：
- **v29.0 性能与刻度盘**：?fpsdbg=1 取证（SIM 0.0ms/REN 972ms——JS 零热点瓶颈在 GPU）、画质自动升回（20s 高帧率逐级恢复）、cosmos 粒子最低档减半、月相刻度盘（29.53 天环+月龄指针）
- **v28.0 掩带速查**：掩星城市可见性 occCityList（月地平视差 0.95° 一阶修正，12 城 <0.28° 可见/<0.42° 擦边；必须叠昼夜+地平 5° 过滤防假阳性；锚点 2026-12-27 月掩木星→悉尼可见，真实掩带在大洋洲）
- **v27.0 行动指南**：冲日观测指南 riseTransitSet（升/中天/落+最大高度，观测点当地时；锚点土星 10-04 北京 17:49/23:49/52°）；题库 26 题；修 RST 返回键 set/set2 不一致
- **v26.0 观测工具箱**：卫星家族直达（行星卡 #moon-family 点击跟随）；掩星矢量法 PA+掩食时长（横向角速度 vLen/dt 是 rad/day，乘 86400 错 86400 倍；径向速度在极小时刻≈0 会虚高 10 倍）；ICS 双导出（全部/仅本地可见）
- **v25.x**：第 10 课深空旅行者（cam.dsky 运镜，停点须 ~200；自动开星座层退出恢复）；宇宙级别点按导航 #cosmos-dots；视觉基线重建（尺寸偏差>15% 判失败，指纹仅参考；calendar 单独 45% 容差）
- **v24.x**：系外系统隔离（exoActive+sysKey——exoBodies/exoGroup 跨系统累积曾致多系统叠加残留）；入口简化（顶栏 dd-labs/dd-more 下拉、底栏 #dock-adv 折叠、首次引导 #onboard/solar_onboard_v1）；标签防重叠 placedLbl
- **v23.0**：cosmos.js 宇宙四级缩放（太阳系→银河系→本星系群→可观测宇宙；三级组挂 y=40000/76000/112000；goLevel 相机重锚+黑幕过渡；11 科普标记；?cosmos=1/2/3）
- 更早：v22 月亮说明书课/掩星抛光 _occPolish/ICS 定时；v21 小时级时刻+观测性徽标 eclToHorizLocal；v20 真 3D 月相剧场（moon3d.js）+月掩亮星 findStarOccultations+VVEJ

## 架构速览

- **经典脚本共享全局词法作用域**（defer 按序，无 IIFE 的 solar-*.js 互相裸用 const/function——新增顶层名必须查重）。**不要改 ESM/importmap**（破坏 file:// 双击即用）。
- 文件职责：data.js（数据+预言机 find*）→ i18n.js → textures.js → solar-core.js（state/camera/controls/scene/T 贴图/星空）→ solar-bodies.js（天体/卫星/彗星/带/深空坐标 raDecToScene R=48000）→ solar-ui.js（卡片/开关/pref solar_prefs_v2/URL 参数）→ solar-main.js（simulate/renderFrame/SolarApp API）→ tours.js → gravity.js → cosmos.js → moonphase.js（2D）→ moon3d.js（3D 剧场）→ calendar.js（日历+观测性+RST+城市可见性）→ sky.js（地平线罗盘 obs solar_obs_v1）→ boot.js。
- 版本三层：index.html 全部 `?v=N`（当前 33）、data.js `window.DATA_VERSION`（32）、sw.js `solar-guide-vN`（33）——**改版必须同步递增**。
- 测试：`node test/v2.test.js`（209 断言，CI 同脚本）；`node test/boot-check.js`（id 交叉核对，动态 id 在白名单）；`node test/visual.js compare`（18 场景视觉基线）。
- 调试 URL 参数：?freeze=1、?camdbg=1（相机状态写 title）、?syscycle=1 / ?sysseq=a,b（系统切换链路）、?cosmos=N、?zen=1、?tour=id、?view=面板名、?date=、?follow=、?novx=1。

## 关键坑（血泪清单）

1. Bash 工具传输**吞一层反斜杠**（[\s\S]→[sS]、\n→换行）——需字面反斜杠用 String.fromCharCode(92)/(10) 或行级操作；heredoc 同理。
2. vm.runInContext 顶层 const 不进 context 对象——用 `this.__r=` 挂结果；测试用**固定日期窗口**防时间漂移。
3. 无头 --virtual-time-budget 下 rAF+THREE.Clock **补间冻结**（截图必伪象，真实浏览器正常）；带 setInterval 实验室场景会超时。
4. Git Bash 连续 fork 十几次 Edge **耗尽进程资源**（fork retry 崩溃）——分批跑；崩溃时写的半张基线图要删掉重拍。
5. GitHub push 偶发中断——等 60s 重试；API 查 CI 常不通（推送输出成功即可，本地测试与 CI 同脚本）。
6. 掩星/天象数值验证锚点必须用**事件时刻**而非正午（窗口边界差 1 小时误判）；字段名 set/set2 类不一致 bug 用"函数内注入打印"定位。
7. i18n：中文是源语言；导出对象可变状态用 getter（get lang()）；STATIC 静态映射缓存 ZH_STATIC 支持往返；新动态文案 t8(path, 中文回退)+i18n.js EN 补键。
8. 改 index.html 后必跑 boot-check（id 交叉核对）；DOM 动态创建的 id 加白名单。

## 下一步（v30 候选，按价值排序）

1. **掩食带地图**：occCityList 的视差模型扩展成世界地图带状渲染。
2. **月相面板日期拖动直连刻度盘**（拖环上指针改日期）。
3. **quiz 错题本**（blue-planet 已有成熟模式可搬）。

## 工作约定

- 用户中文交流；每轮结束汇报：完成了什么/修了什么/测试结果/下一步。
- 发布流程：改码→断言+boot-check→（涉及 UI 则截图验证）→版本三层递增→README/ROADMAP 更新→commit+tag vx.y.0+push→CI 确认（API 不通则凭推送成功+同脚本断言）。
- 记忆文件：`memories/projects/keke-deb24b9e1fe6d765/memory/sun-project-v2-arch.md`（与本文件互补，偏经验）。
