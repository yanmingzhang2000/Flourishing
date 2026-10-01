# Flourishing 动作封面素材采购 · 第二轮（最终补全）报告

## 一、本轮范围与结论速览

- 处理上轮待处理清单 **31 个**动作：必换 mismatch 7 + 建议换 approximate 14 + 未找到 not_found 5 + 从未验证 uncertain 5。
- 结果：**替换 15 个**（5 个升级为 ok、10 个补为 approximate）；**维持近似 9 个**（免费图库确无更精确示范）；**无解 7 个**（下方单列）。
- 全库最终状态（67 个动作）：`cover_qa` = **ok 41 / approximate 19 / mismatch 7**；`cover_status` = **direct 60 / search_page 7**。
- `素材/images/` 已落盘 **60 张** `{exercise_id}_cover.jpg`，统一 800×800、单张均 <300KB（PIL 居中裁切+压缩）。

## 二、新源扩源核查结果（本轮核心）

按要求先查了垂直健身图源与 CC 聚合源，**在本执行环境下多数不可用**，逐项记录如下（授权状态与可用性）：

| 源 | 可达性 | 授权/结论 |
|---|---|---|
| Gymvisual（gymvisual.com） | 站内搜索可访问但返回 0 结果 | 素材多为付费/需授权；无可下载直链 → `license_review_needed` |
| Everkinetic | 未取得可下载直链 | 同上，`license_review_needed` |
| ExRx.net | 页面文本可访问（如 `/Stretches/ChestGeneral/Doorway` 确认存在"门框胸肌拉伸"页） | 站内示范图内联 URL 无法提取、无法下载；授权为"个人非商业"，**不满足商用** → 未入库 |
| wger.de | API 可枚举，但按动作名过滤失效 | 图存于 `/media/exercise-images/`，授权 CC-BY-SA（需按 exercise id 定位）；本环境未能取到目标图 |
| Wikimedia Commons | **整站屏蔽**（API/分类页均 fetch failed） | 无法核验/下载 |
| Openverse（openverse.org / api.openverse.org） | **API 与站点均被屏蔽**（返回空） | 仅经子代理间接命中 1 张 Flickr 图（见下） |

**新源唯一有效产出**：`bulgarian_split_squat` 在 Flickr 命中一张 **CC BY 2.0** 保加利亚分腿蹲实拍（后脚搭凳、前腿下蹲，标题 "Bulgarian Squats"，作者 personaltrainertoronto），但**带 `www.PTinTO.com` 水印、横版、男性出镜**，不适合作 App 封面，**未采用**；最终改用 Pexels 台阶分腿蹲近似图。

**防污染关键词已强制改写**（如 `fire hydrant glute exercise`、`bulgarian split squat rear foot elevated`、`prone T raise rear delt face down`、`chin tuck posture correction` 等），未再出现消防栓/城市 Split/猫牛动物/天使雕像等污染命中——但也印证这些动作在免费实拍图库**确实缺精确供给**。

## 三、逐条处理明细（31 项）

| exercise_id | 中文名 | 最终源 URL | license | cover_qa | 判定依据（图里做什么 vs 定义） | 搜索关键词 |
|---|---|---|---|---|---|---|
| glute_bridge | 臀桥 | https://images.pexels.com/photos/39635362/pexels-photo-39635362.jpeg?w=800&h=800&fit=crop | Pexels免费许可(可商用) | ok | 图：Pilates 臀桥，仰卧屈膝、臀发力抬髋成桥（换掉原瑜伽轮式全后弯） | glute bridge |
| fb_glute_bridge | 臀桥（基础体能） | https://images.pexels.com/photos/39635362/pexels-photo-39635362.jpeg?w=800&h=800&fit=crop | Pexels免费许可(可商用) | ok | 同 glute_bridge，Pilates 臀桥仰卧抬髋成桥（换掉原瑜伽轮式） | glute bridge |
| foam_roll_chest_opener | 泡沫轴开胸 | https://images.pexels.com/photos/4804294/pexels-photo-4804294.jpeg?w=800&h=800&fit=crop | Pexels免费许可(可商用) | ok | 图：仰卧、泡沫轴横垫上背、双臂外展开胸（换掉原坐姿滚小腿） | foam roller chest stretch |
| cat_cow_stretch | 猫牛式 | https://images.pexels.com/photos/7663225/pexels-photo-7663225.jpeg?w=800&h=800&fit=crop | Pexels免费许可(可商用) | ok | 图：四足跪姿脊柱屈伸（换掉原站姿前屈） | cat cow stretch |
| donkey_kick | 驴踢 | https://images.pexels.com/photos/6303435/pexels-photo-6303435.jpeg?w=800&h=800&fit=crop | Pexels免费许可(可商用) | ok | 图：四足跪姿、单腿屈膝向后上方蹬伸（换掉原搏击高踢腿） | glute kickback / quadruped leg lift |
| lying_leg_raise | 仰卧举腿 | https://images.pexels.com/photos/20703872/pexels-photo-20703872.jpeg?w=800&h=800&fit=crop | Pexels免费许可(可商用) | approximate | 图：仰卧、双腿上抬（变式，休闲着装）；原为单腿桥式 | leg raise |
| bulgarian_split_squat | 保加利亚分腿蹲 | https://images.pexels.com/photos/12035660/pexels-photo-12035660.jpeg?w=800&h=800&fit=crop | Pexels免费许可(可商用) | approximate | 图：台阶上分腿蹲、后腿抬高的蹲姿；原为普通深蹲（非"后脚踝搭凳"精确） | lunge bench |
| wrist_neck_release | 手腕托颈放松 | https://images.pexels.com/photos/8598372/pexels-photo-8598372.jpeg?w=800&h=800&fit=crop | Pexels免费许可(可商用) | approximate | 图：双手抱于脑后（托颈放松近似）；原为颈部拉伸 | neck release hands |
| scapular_retraction_band | 弹力带肩胛后缩 | https://images.pexels.com/photos/6339607/pexels-photo-6339607.jpeg?w=800&h=800&fit=crop | Pexels免费许可(可商用) | approximate | 图：双人拉弹力带外展（band pull-apart，即肩胛后缩）；原为三人摆拍 | band pull apart shoulders |
| foam_roll_glutes | 泡沫轴臀部放松 | https://images.pexels.com/photos/4587696/pexels-photo-4587696.jpeg?w=800&h=800&fit=crop | Pexels免费许可(可商用) | approximate | 图：仰卧、泡沫轴置于臀/下背放松（教练辅助）；原为滚小腿 | foam roller glutes |
| wall_angel | 靠墙天使 | https://images.pexels.com/photos/6339484/pexels-photo-6339484.jpeg?w=800&h=800&fit=crop | Pexels免费许可(可商用) | approximate | 图：背靠墙、双臂外展贴墙（非完整 W→Y 轨迹）；原为墙面俯身拉伸 | wall angel |
| wall_slide_rs | 靠墙滑动矫正 | https://images.pexels.com/photos/4853072/pexels-photo-4853072.jpeg?w=800&h=800&fit=crop | Pexels免费许可(可商用) | approximate | 图：双手贴墙的靠墙动作；原为多人扶墙拉伸 | wall slide exercise |
| scapular_wall_slide | 靠墙肩胛滑动 | https://images.pexels.com/photos/8401111/pexels-photo-8401111.jpeg?w=800&h=800&fit=crop | Pexels免费许可(可商用) | approximate | 图：侧身、单臂向后贴墙（靠墙滑动近似）；原为俯身撑台面 | scapular wall slide |
| reverse_fly_dumbbell | 哑铃反向飞鸟 | https://images.pexels.com/photos/29793977/pexels-photo-29793977.jpeg?w=800&h=800&fit=crop | Pexels免费许可(可商用) | approximate | 图：持哑铃侧平举（练肩，但站姿、非俯身后束飞鸟）；原为持铃站立 | reverse fly dumbbell |
| prone_t_raise | 俯卧 T 字上举 | https://images.pexels.com/photos/6193552/pexels-photo-6193552.jpeg?w=800&h=800&fit=crop | Pexels免费许可(可商用) | approximate | 图：俯卧脸朝下、双臂外展（近似俯卧 T）；原为俯身推举 | prone arm raise |
| clam_shell | 蚌式开合 | 维持原图 7479759（Pexels） | Pexels免费许可(可商用) | approximate | 侧卧弹力带膝开合类；Pexels 无更精确"侧卧屈膝上膝外展"示范 | clamshell exercise |
| fire_hydrant | 消防栓式抬腿 | 维持原图 6339645（Pexels） | Pexels免费许可(可商用) | approximate | 弹力带下肢外展类；无四足跪姿侧抬膝精确图 | hip abduction exercise |
| hip_warmup_circles | 髋部绕环热身 | 维持原图 4148929（Pexels） | Pexels免费许可(可商用) | approximate | 垫上髋部练习；无站姿单腿画圈/摆腿图 | hip circle exercise |
| dead_bug | 死虫式 | 维持原图 6896485（Pexels） | Pexels免费许可(可商用) | approximate | 仰卧核心动作；无标准"对侧手脚下放"死虫图 | dead bug exercise |
| pelvic_tilt | 骨盆卷动 | 维持原图 4587402（Pexels） | Pexels免费许可(可商用) | approximate | 仰卧骨盆/盆底练习；无小幅卷动精确图 | pelvic tilt |
| scapular_squeeze | 坐姿肩胛夹紧 | 维持原图 6798416（Pexels） | Pexels免费许可(可商用) | approximate | 肩胛区特写；无坐姿主动夹紧图 | shoulder blade squeeze |
| fb_step_touch | 侧点步 | 维持原图 7020828（Pexels） | Pexels免费许可(可商用) | approximate | 站立有氧/高抬膝类；无侧向点步精确图 | step touch aerobics |
| fb_sit_to_stand | 坐站练习 | 维持原图 23224762（Pexels） | Pexels免费许可(可商用) | approximate | 坐椅康复锻炼类；无起立/坐下精确图 | sit to stand chair |
| flutter_kick | 仰卧上下打水 | 维持原图 14942844（Pexels） | Pexels免费许可(可商用) | approximate | 仰卧举腿类；无直腿交替上下打水图 | flutter kick |
| shoulder_shrug_release | 耸肩释放 | https://www.pexels.com/search/shoulder%20shrug/ | 待筛选(检索页) | mismatch | 原图手按斜方肌、新候选为"摊手"表情图，均非耸肩升降 | shoulder shrug |
| fb_low_jack | 低冲击开合 | https://www.pexels.com/search/low%20impact%20exercise/ | 待筛选(检索页) | mismatch | 原图腾空跳跃；无"侧迈步+双臂上举、不跳"图 | low impact exercise |
| full_body_standing_stretch | 站姿全身拉伸 | https://www.pexels.com/search/full%20body%20stretch/ | 待筛选(检索页) | mismatch | 原图交叉胸前肩拉伸；无"上举+侧屈+前屈"全身多方向拉伸 | full body stretch |
| chin_tuck | 收下巴训练 | https://www.pexels.com/search/chin%20tuck/ | 待筛选(检索页) | mismatch | 原图仰头；新候选仅颈部特写，无水平收颌（双下巴方向） | chin tuck |
| band_tricep_kickback | 弹力带臂屈伸 | https://www.pexels.com/search/tricep%20kickback/ | 待筛选(检索页) | mismatch | 原图臂+带局部；新候选为弹力带推/拉，非体侧伸肘 | tricep kickback |
| fb_arm_leg_reach | 四肢伸展热身 | https://www.pexels.com/search/standing%20warm%20up/ | 待筛选(检索页) | mismatch | 原图躯干局部；新候选为弓步/拉伸，非"单臂上举+对侧腿后抬" | standing warm up |
| doorway_pec_stretch | 门框胸肌拉伸 | https://www.pexels.com/search/chest%20stretch/ | 待筛选(检索页) | mismatch | 原图舞者后弯；新候选均为舞者门框艺术照，无"前臂撑框扩胸" | chest stretch |

> 说明：上表 `cover_qa` 为对**当前采用封面**的判定；`search_page` 行的封面已回退为 Pexels 检索页链接（无合格直链可落盘）。

## 四、无解清单（7 项，建议自拍或付费图库）

以下 7 个动作经新源（Gymvisual/Everkinetic/ExRx/wger/Wikimedia/Openverse）与三大图库多轮检索，**均无合格且可商用/免授权的精确实拍封面**。按"禁止近似图冒充 ok"原则列为无解，给出**自拍要点**与**付费图库关键词**：

| exercise_id | 中文名 | 自拍要点 | 推荐付费图库关键词（Shutterstock / Getty） |
|---|---|---|---|
| shoulder_shrug_release | 耸肩释放 | 正/侧机位，站直，双肩向耳耸起保持 2 秒再下沉，可见斜方肌上束收缩 | Shutterstock: `shoulder shrug exercise`；Getty: `shrug shoulders exercise` |
| fb_low_jack | 低冲击开合 | 侧迈一步同时双臂上举，全程至少一脚不离地（不跳跃） | Shutterstock: `low impact jumping jack` / `step jack exercise` |
| full_body_standing_stretch | 站姿全身拉伸 | 双臂上举交握 → 体侧屈 → 体前屈，多方向连贯一套 | Shutterstock: `standing full body stretch workout` |
| chin_tuck | 收下巴训练 | 坐直、目视前方，下巴水平后收做出"双下巴"，**非仰头也非低头** | Shutterstock: `chin tuck neck exercise`；Getty: `cervical retraction exercise` |
| band_tricep_kickback | 弹力带臂屈伸 | 单脚踩带、俯身与地面平行，屈肘贴体侧向后伸直（肘部固定） | Shutterstock: `band tricep kickback` |
| fb_arm_leg_reach | 四肢伸展热身 | 站姿，单臂上举同时对侧腿向后抬起，动态连贯 | Shutterstock: `standing arm and leg reach warm up` |
| doorway_pec_stretch | 门框胸肌拉伸 | 门框内双肘 90° 撑框、身体前倾扩胸，可拍正/侧双机位 | Shutterstock: `doorway chest stretch exercise`；Getty: `pectoral doorframe stretch` |

## 五、授权与合规说明

- 本轮采用的 60 张封面**全部来自 Pexels**，适用 "Pexels 免费许可：可商用、无需署名"；内测可直接使用。
- Flickr 命中的 `bulgarian_split_squat`（CC BY 2.0）因**水印+横版+男性**未采用；如后续采用 CC 图，须保留作者署名。
- ExRx（个人非商业）、Gymvisual/Everkinetic（付费/含糊）图源均标 `license_review_needed`，**未入库**。
- 商用上线前，建议将 19 张 `approximate` 与 7 张无解一并替换为**自有拍摄**或明确 CC0/CC-BY 授权素材，并核对真人肖像授权。

## 六、数据变更说明

- 仅改动 5 列：`cover_url` / `source` / `license` / `cover_qa`，并**新增** `cover_status` 列（放在 `cover_qa` 之后）；`video_url`、`cover_retry` 及 `exercise_id` 未改。
- 全程用 Python `csv` 模块读写，含逗号的 `license` 字段正确转义；已核验 67 行 × 8 列、无串列。
- `素材/images/` 由空目录补齐为 60 张 `{exercise_id}_cover.jpg`（800×800、<300KB）。
