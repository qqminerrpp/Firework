// ============================================================================
// fireworks-opencode-plugin · knowledge.js
// 烟花火箭知识库（依据《烟花火箭数据组件与实体 NBT 参考》，Java Edition 1.20.5+）。
// 零依赖纯 ESM，可被插件与测试直接引用。
// 书写约定：范围用 –（如 -128–127）；~ 仅作相对坐标；中文正文用全角标点。
// ============================================================================

/** 允许的爆裂形态 */
export const SHAPES = ["small_ball", "large_ball", "star", "creeper", "burst"];

/** 爆裂形态中文说明 */
export const SHAPE_NAMES = {
  small_ball: "小型球状",
  large_ball: "大型球状",
  star: "星形",
  creeper: "苦力怕状",
  burst: "喷发状",
};

/** explosions 数组最大元素数 */
export const MAX_EXPLOSIONS = 256;

/** flight_duration 为 Byte（有符号 8 位整数） */
export const FLIGHT_DURATION_RANGE = { min: -128, max: 127 };

/** 合成台上限（命令可设更高，最高 127，约 16 秒） */
export const CRAFTING_MAX_FLIGHT = 3;

/** 颜色最大值（只使用后 24 位，0xFFFFFF = 16777215） */
export const COLOR_MAX = 0xffffff;

/** 标准色表（来自文档 2.2 节） */
export const NAMED_COLORS = [
  { name: "红色 red", hex: "FF0000", dec: 16711680 },
  { name: "绿色 green", hex: "00FF00", dec: 65280 },
  { name: "蓝色 blue", hex: "0000FF", dec: 255 },
  { name: "黄色 yellow", hex: "FFFF00", dec: 16776960 },
  { name: "品红色 magenta", hex: "FF00FF", dec: 16711935 },
  { name: "青色 cyan", hex: "00FFFF", dec: 65535 },
];

/**
 * LifeTime 公式：LifeTime = 10 × (f + 1) + rand(0–6) + rand(0–7)
 * rand(n) 返回 [0, n – 1]，因此随机部分范围为 [0, 5] + [0, 6] = [0, 11]。
 * @param {number} flightDuration
 * @returns {{min: number, max: number}}
 */
export function lifetimeRange(flightDuration) {
  const base = 10 * (flightDuration + 1);
  return { min: base, max: base + 11 };
}

/** 建议 LifeTime（公式区间中点，便于 /summon 直接使用） */
export function suggestedLifetime(flightDuration) {
  return 10 * (flightDuration + 1) + 5;
}

/** 位置预设（generate 工具使用），coords 可为字符串或函数 */
export const POSITION_PRESETS = {
  here: {
    label: "当前执行位置",
    prefix: "summon firework_rocket",
    coords: () => "~ ~ ~",
  },
  player: {
    label: "最近玩家位置",
    prefix: "execute positioned as @p run summon firework_rocket",
    coords: () => "~ ~ ~",
  },
  player_head: {
    label: "最近玩家头顶 1 格",
    prefix: "execute positioned as @p run summon firework_rocket",
    coords: () => "~ ~1 ~",
  },
  player_forward: {
    label: "最近玩家前方（按朝向）",
    prefix: "execute as @p at @s run summon firework_rocket",
    coords: (d) => `^ ^ ^${d}`,
  },
  player_eyes_forward: {
    label: "最近玩家眼睛前方（anchored eyes）",
    prefix: "execute as @p at @s anchored eyes run summon firework_rocket",
    coords: (d) => `^ ^ ^${d}`,
  },
  nearest_pig: {
    label: "最近的猪上方 1 格",
    prefix:
      "execute positioned as @e[type=pig,limit=1,sort=nearest] run summon firework_rocket",
    coords: () => "~ ~1 ~",
  },
  all_players: {
    label: "所有玩家位置",
    prefix: "execute as @a at @s run summon firework_rocket",
    coords: () => "~ ~ ~",
  },
  absolute: {
    label: "绝对坐标",
    prefix: "summon firework_rocket",
    coords: (x, y, z) => `${x} ${y} ${z}`,
  },
  custom: {
    label: "自定义坐标",
    prefix: "summon firework_rocket",
    coords: (override) => override,
  },
};

/** 触发知识注入的关键词（chat.message 钩子用，小写匹配） */
export const KNOWLEDGE_KEYWORDS = [
  "firework",
  "烟花",
  "mcfunction",
  "flight_duration",
  "minecraft:fireworks",
  "fireworks_rocket",
  "firework_rocket",
  "苦力怕状",
  "爆裂",
];

/** 注入到对话消息中的精简知识（保持精简以免污染上下文） */
export const KNOWLEDGE_INTRO = [
  "[fireworks-plugin] 检测到烟花火箭相关请求，要点速记：",
  "- 物品端：components:{\"minecraft:fireworks\":{flight_duration:<Byte>,explosions:[...]}}；1.20.5 之前版本使用旧格式 tag:{Fireworks:{Flight,Explosions:[{Type,Colors,FadeColors,Trail,Flicker}]}}。",
  "- 实体：Java 版实体 ID 为 minecraft:firework_rocket；基岩版为 minecraft:fireworks_rocket（本插件仅支持 Java 版）。",
  "- shape 取值：small_ball、large_ball、star、creeper、burst；colors 为 [I; R × 65536 + G × 256 + B, ...] 十进制整数，空数组视为黑色；explosions 最多 256 个。",
  "- LifeTime = 10 × (flight_duration + 1) + rand(0–6) + rand(0–7)（单位为刻）。",
  "- 坐标：~ 表示相对执行位置，^ 表示相对执行朝向；两者不要混用，^ 需配合 execute as/at（或 rotated as）保证朝向。",
  "- 工具分工：生成用 fireworks_generate（自带自检），检查已有命令用 fireworks_validate，需要改进建议与修正命令用 fireworks_feedback，查规则用 fireworks_knowledge，颜色转换与配色用 fireworks_colors。",
  "- 完整参考：.opencode/reference/fireworks-reference.md",
].join("\n");

/** knowledge 工具支持的主题 */
export const KNOWLEDGE_TOPICS = [
  "components",
  "entity",
  "shapes",
  "colors",
  "formula",
  "coordinates",
  "versions",
  "cheatsheet",
  "all",
];

/** 各主题正文（供 fireworks_knowledge 工具返回） */
const SECTIONS = {
  components: `## minecraft:fireworks 数据组件（物品端）
\`\`\`
minecraft:fireworks = {
  flight_duration: <Byte>,        // 飞行时长（火药数，字节类型），范围 -128–127，默认 0；合成台上限 3，命令最高 127（约 16 秒）
  explosions: [                   // 烟火之星列表，最多 256 个
    {
      shape: <ST>,                // small_ball、large_ball、star、creeper、burst
      colors: [I; ...],           // 主粒子颜色（R × 65536 + G × 256 + B，十进制整数）
      fade_colors: [I; ...],      // 淡化颜色（可省略或为空）
      has_trail: <TF>,            // 拖尾（钻石合成），默认 false
      has_twinkle: <TF>           // 闪烁（荧石粉合成），默认 false
    }
  ]
}
\`\`\`
flight_duration 建议在命令中写 b 后缀（如 2b），明确 Byte 类型。文档中 [I; ...] 为带空格写法，命令输出保持压缩写法 [I;1,2,3]。`,

  entity: `## 烟花火箭实体 NBT
\`\`\`
{
  LifeTime: <I>,        // 存活时间（刻）：从飞行开始到爆裂；发射时随机决定，公式见 formula
  Life: <I>,            // 已飞行时间（刻）；当 Life > LifeTime 时爆裂
  ShotAtAngle: <TF>,    // 是否由弩或发射器射出；true 时水平方向逐渐加速
  FireworksItem: {
    id: "minecraft:firework_rocket",
    count: <I>,         // 0 < count ≤ 64
    components: { "minecraft:fireworks": { ... } }
  }
}
\`\`\`
Motion 是全局坐标速度（非局部坐标）；纯水平飞行可设 ShotAtAngle:true。`,

  shapes: `## shape 可用值
| 值 | 说明 |
|---|---|
| small_ball | 小型球状 |
| large_ball | 大型球状 |
| star | 星形 |
| creeper | 苦力怕状 |
| burst | 喷发状 |`,

  colors: `## colors / fade_colors 颜色编码
- 均为整型数组，只使用后 24 位，每个通道 8 位，按 RGB 依次存储。
- 颜色值 = R × 65536 + G × 256 + B（十进制整数）。
- 不存在或空数组时视为黑色；多个值时每个粒子渲染时随机选择一种。
- 标准色表：红色 16711680（#FF0000）、绿色 65280（#00FF00）、蓝色 255（#0000FF）、黄色 16776960（#FFFF00）、品红色 16711935（#FF00FF）、青色 65535（#00FFFF）。`,

  formula: `## 飞行时长公式
LifeTime = 10 × (flight_duration + 1) + rand(0–6) + rand(0–7)
rand(n) 返回 [0, n – 1] 内的均匀随机整数 → 随机部分合计 0–11。
示例：flight_duration=2 → 区间 30–41（示例常用 LifeTime:40）。`,

  coordinates: `## 坐标类型
| 类型 | 写法 | 含义 |
|---|---|---|
| 绝对坐标 | x y z | 世界坐标 |
| 相对坐标 | ~ ~ ~ | 相对命令执行位置 |
| 局部坐标 | ^ ^ ^ | 相对执行者朝向（^左 ^上 ^前） |

- ^ ^ ^1 前方 1 格，^ ^ ^-1 后方 1 格，^1 ^ ^ 左方 1 格。
- ^ 依赖执行者朝向，建议配合 execute as/at（命令方块等非实体执行者通常没有有效朝向）。
- ~ 依赖执行位置，用 positioned as、at 或 positioned 改变。
- 同一坐标中不要混用 ~ 和 ^。`,

  versions: `## 版本差异
- 数据组件格式自 Java Edition 1.20.5 引入；minecraft:fireworks 取代旧的 Fireworks NBT 标签。
- 1.20.5 之前版本：tag:{Fireworks:{Flight:...,Explosions:[{Type,Colors,FadeColors,Trail,Flicker}]}}。
- 字段改名：Type → shape，Colors → colors，FadeColors → fade_colors，Trail → has_trail，Flicker → has_twinkle。
- 基岩版实体 ID 为 fireworks_rocket（Java 版为 firework_rocket），语法不同。`,

  cheatsheet: `## 常用命令速查
| 需求 | 命令片段 |
|---|---|
| 当前执行位置 | summon firework_rocket ~ ~ ~ {...} |
| 最近玩家位置 | execute positioned as @p run summon firework_rocket ~ ~ ~ {...} |
| 最近玩家头顶 1 格 | execute positioned as @p run summon firework_rocket ~ ~1 ~ {...} |
| 最近玩家前方 2 格（按朝向） | execute as @p at @s run summon firework_rocket ^ ^ ^2 {...} |
| 最近玩家眼睛前方 2 格 | execute as @p at @s anchored eyes run summon firework_rocket ^ ^ ^2 {...} |
| 最近的猪上方 1 格 | execute positioned as @e[type=pig,limit=1,sort=nearest] run summon firework_rocket ~ ~1 ~ {...} |
| 所有玩家位置 | execute as @a at @s run summon firework_rocket ~ ~ ~ {...} |
| 绝对坐标 | summon firework_rocket 100 64 200 {...} |`,
};

/**
 * 返回指定主题的知识正文。
 * @param {string} topic
 * @returns {string}
 */
export function knowledgeSection(topic = "all") {
  if (topic === "all") {
    return [
      "# 烟花火箭知识库（Java 1.20.5+）",
      SECTIONS.components,
      SECTIONS.entity,
      SECTIONS.shapes,
      SECTIONS.colors,
      SECTIONS.formula,
      SECTIONS.coordinates,
      SECTIONS.versions,
      SECTIONS.cheatsheet,
      "---",
      "完整原文参考：.opencode/reference/fireworks-reference.md",
    ].join("\n\n");
  }
  const body = SECTIONS[topic];
  if (!body) {
    return `未知主题：${topic}。可用主题：${KNOWLEDGE_TOPICS.join("、")}`;
  }
  return body;
}
