# 烟花火箭数据组件与实体 NBT 参考

> 适用：Java Edition 1.20.5+（数据组件格式自 1.20.5 引入）
> 主题：`minecraft:fireworks` 数据组件、烟花火箭实体 NBT、常用命令示例
> 说明：本文只讨论 Java 版，基岩版语法不同。

---

## 符号约定

| 符号 | 含义 |
|---|---|
| `{}` | NBT 复合标签 / JSON 对象 |
| `[]` | NBT 列表 / JSON 数组 |
| `[I;]` | 整型数组 |
| `Byte` | 字节类型（1 字节有符号整数） |
| `I` | int 类型（4 字节有符号整数） |
| `TF` | boolean 类型 |
| `ST` | 字符串 |

---

## 1. 快速参考

### 1.1 `minecraft:fireworks` 数据组件（物品端）

```text
minecraft:fireworks = {
  flight_duration: <Byte>,
  explosions: [
    {
      shape: <ST>,
      colors: [I; ...],
      fade_colors: [I; ...],
      has_trail: <TF>,
      has_twinkle: <TF>
    }
  ]
}
```

### 1.2 烟花火箭实体 NBT

```text
{
  LifeTime: <I>,
  Life: <I>,
  ShotAtAngle: <TF>,
  FireworksItem: {
    id: "minecraft:firework_rocket",
    count: <I>,
    components: { ... }
  }
}
```

### 1.3 常用命令示例

```mcfunction
# 在玩家位置生成向上飞的烟花
/execute positioned as @p run summon firework_rocket ~ ~ ~ {LifeTime:40,FireworksItem:{id:"minecraft:firework_rocket",count:1,components:{"minecraft:fireworks":{flight_duration:2,explosions:[{shape:"star",colors:[I;16711680,65280,255],has_trail:true,has_twinkle:true}]}}}}
```

---

## 2. `minecraft:fireworks` 数据组件详解

`components` 是物品堆的组件修订，用于修改物品的数据组件信息。`minecraft:fireworks` 组件控制烟花火箭的飞行时间与爆裂效果。

### 2.1 `flight_duration`

| 属性 | 值 |
|---|---|
| 类型 | Byte（有符号 8 位整数） |
| 默认值 | 0 |
| 范围 | -128–127 |

表示烟花火箭的飞行时长，单位为“火药”（等于工作台上合成时使用的火药数）。合成台上限为 3，通过 `/give` 或 `/summon` 可设至 127（约 16 秒），适用于鞘翅长时间加速或空中表演。

实际存活时间由以下公式计算：

```
LifeTime = 10 × (f + 1) + rand(0–6) + rand(0–7)
```

其中 `f` 为 `flight_duration` 的值，`rand(n)` 返回 `[0, n – 1]` 内的均匀随机整数。

### 2.2 `explosions`

烟花火箭对应的烟火之星数据列表，最多 256 个元素。每个元素描述一个爆裂效果。

#### `explosions[]` 单个元素结构

| 标签 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `shape` | ST | — | 爆裂形态，见下表 |
| `colors` | `[I;]` | 空数组（黑色） | 主粒子颜色 |
| `fade_colors` | `[I;]` | 空数组 | 淡化粒子颜色 |
| `has_trail` | TF | `false` | 是否有拖尾（拖曳痕迹，钻石合成） |
| `has_twinkle` | TF | `false` | 是否有闪烁（荧石粉合成） |

#### `shape` 可用值

| 值 | 说明 |
|---|---|
| `small_ball` | 小型球状 |
| `large_ball` | 大型球状 |
| `star` | 星形 |
| `creeper` | 苦力怕状 |
| `burst` | 喷发状 |

#### `colors` / `fade_colors` 颜色编码

`colors` 和 `fade_colors` 均为整型数组，只使用后 24 位，每个颜色通道占 8 位，按 RGB 依次存储。多个值时，每个爆裂粒子渲染时随机选择一种颜色。不存在或空数组时视为黑色。

颜色值 = `R × 65536 + G × 256 + B`

示例：

```mcfunction
colors:[I;16711680,65280,255,16776960,16711935,65535]
```

对应颜色：

| 十进制值 | 十六进制 | 颜色 |
|---|---|---|
| 16711680 | `FF0000` | 红色 |
| 65280 | `00FF00` | 绿色 |
| 255 | `0000FF` | 蓝色 |
| 16776960 | `FFFF00` | 黄色 |
| 16711935 | `FF00FF` | 品红色 |
| 65535 | `00FFFF` | 青色 |

---

## 3. 烟花火箭实体 NBT 详解

烟花火箭实体继承了“实体共通标签”和“弹射物共通标签”，并额外拥有以下标签。

### 3.1 实体专属标签

| 标签 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `Life` | I | 0 | 已飞行时间（刻）。当 `Life > LifeTime` 时烟花爆裂 |
| `LifeTime` | I | — | 存活时间（刻）：从飞行开始到爆裂的时间。发射时随机决定，公式见 2.1 |
| `ShotAtAngle` | TF | `false` | 是否由弩或发射器射出。`true` 时水平方向逐渐加速；`false` 时受打上天的加速度影响 |
| `FireworksItem` | `{}` | 默认烟花火箭 | 发射此火箭的物品，决定烟火样式和伤害 |

### 3.2 `FireworksItem` 物品结构

`FireworksItem` 采用标准物品格式：

| 标签 | 类型 | 说明 |
|---|---|---|
| `id` | ST | 物品命名空间 ID，应为 `minecraft:firework_rocket` |
| `count` | I | 堆叠数，`0 < 值 ≤ 最大堆叠数`，默认 1 |
| `components` | `{}` | 物品组件修订，内部放置 `minecraft:fireworks` 组件 |

> **注意**：1.20.5 之前版本使用的 `tag:{Fireworks:{Flight:...,Explosions:[...]}}` 格式在 1.20.5 起被数据组件格式取代。`Explosions` 中的子标签名也发生了变化：`Type` → `shape`，`Colors` → `colors`，`FadeColors` → `fade_colors`，`Trail` → `has_trail`，`Flicker` → `has_twinkle`。

### 3.3 完整示例

```mcfunction
/summon firework_rocket ~ ~ ~ {
  LifeTime: 40,
  FireworksItem: {
    id: "minecraft:firework_rocket",
    count: 1,
    components: {
      "minecraft:fireworks": {
        flight_duration: 2b,
        explosions: [
          {
            shape: "star",
            colors: [I; 16711680, 65280, 255, 16776960, 16711935, 65535],
            has_trail: true,
            has_twinkle: true
          }
        ]
      }
    }
  }
}
```

---

## 4. 常用命令速查

| 需求 | 命令片段 |
|---|---|
| 当前执行位置 | `summon firework_rocket ~ ~ ~ {...}` |
| 最近玩家位置 | `execute positioned as @p run summon firework_rocket ~ ~ ~ {...}` |
| 最近玩家头顶 1 格 | `execute positioned as @p run summon firework_rocket ~ ~1 ~ {...}` |
| 最近玩家前方 2 格（按朝向） | `execute as @p at @s run summon firework_rocket ^ ^ ^2 {...}` |
| 最近的猪上方 1 格 | `execute positioned as @e[type=pig,limit=1,sort=nearest] run summon firework_rocket ~ ~1 ~ {...}` |
| 所有玩家位置 | `execute as @a at @s run summon firework_rocket ~ ~ ~ {...}` |
| 绝对坐标 | `summon firework_rocket 100 64 200 {...}` |

**坐标类型说明：**

| 类型 | 写法 | 含义 |
|---|---|---|
| 绝对坐标 | `x y z` | 世界坐标 |
| 相对坐标 | `~ ~ ~` | 相对命令执行位置 |
| 局部坐标 | `^ ^ ^` | 相对执行者朝向（`^左 ^上 ^前`） |

- `^ ^ ^1`：执行者前方 1 格
- `^ ^ ^-1`：执行者后方 1 格
- `^1 ^ ^`：执行者左方 1 格

> `^` 依赖执行者朝向；命令方块等非实体执行者通常没有有效朝向，建议配合 `execute as/at` 使用。

> 本文用 `–` 表示数值范围（如 `-128–127`、`rand(0–6)`）；`~` 仅作相对坐标，不表示范围。

### 目标选择器

目标选择器用于指定命令作用的实体，`execute as/positioned`、`summon` 的落点等都会用到。

| 选择器 | 含义 | 说明 |
|---|---|---|
| `@s` | 执行者自己 | 指当前命令的执行者；在 `execute as <实体>` 中代表该实体。常用于“对某个已知实体”操作 |
| `@p` | 最近的玩家 | 距离执行位置最近的玩家。烟花定位最常用 |
| `@r` | 随机一名玩家 | 在所有在线玩家中随机选一个。适合随机发烟花 |
| `@a` | 所有玩家 | 选择全部在线玩家（默认不含已死亡玩家，可加 `[gamemode=...]` 等筛选） |
| `@e` | 所有实体 | 包含玩家以外的所有实体（生物、掉落物、盔甲架、烟花火箭等） |
| `@n` | 最近的实体 | 1.13+ 加入，距离最近的实体，**包含非玩家实体**（`@p` 只挑玩家） |
| 玩家名 | 指定玩家 | 直接写玩家名（如 `Notch`），只选中该玩家 |

**常用筛选参数（方括号，可组合）：**

| 参数 | 示例 | 说明 |
|---|---|---|
| `type` | `@e[type=pig]` | 限定实体类型 |
| `distance` | `@e[distance=..10]` | 距离范围（`..10` 表示 ≤ 10） |
| `limit` | `@e[limit=1]` | 最多选择的数量 |
| `sort` | `@e[sort=nearest]` | 排序方式：`nearest`、`furthest`、`random`、`arbitrary` |
| `tag` | `@e[tag=foo]` | 按记分板标签筛选 |
| `name` | `@e[name=Steve]` | 按实体名筛选 |
| `team` | `@a[team=red]` | 按队伍筛选 |

> 在 `execute` 中，`@s` 通常是配合 `as` 使用：先 `as @e[...]` 选定实体，再用 `@s` 指代“当前这一个”。例如 `execute as @e[type=pig] at @s run ...` 会对每只猪在其位置执行。

---

## 5. 完整命令示例

### 5.1 在最近玩家位置生成，向上飞

```mcfunction
/execute positioned as @p run summon firework_rocket ~ ~ ~ {LifeTime:40,FireworksItem:{id:"minecraft:firework_rocket",count:1,components:{"minecraft:fireworks":{flight_duration:2,explosions:[{shape:"star",colors:[I;16711680,65280,255,16776960,16711935,65535],has_trail:true,has_twinkle:true}]}}}}
```

### 5.2 在最近玩家眼睛前方 2 格生成

```mcfunction
/execute as @p at @s anchored eyes run summon firework_rocket ^ ^ ^2 {LifeTime:40,FireworksItem:{id:"minecraft:firework_rocket",count:1,components:{"minecraft:fireworks":{flight_duration:2,explosions:[{shape:"star",colors:[I;16711680,65280,255,16776960,16711935,65535],has_trail:true,has_twinkle:true}]}}}}
```

### 5.3 在最近的猪上方 1 格生成

```mcfunction
/execute positioned as @e[type=pig,limit=1,sort=nearest] run summon firework_rocket ~ ~1 ~ {LifeTime:40,FireworksItem:{id:"minecraft:firework_rocket",count:1,components:{"minecraft:fireworks":{flight_duration:2,explosions:[{shape:"star",colors:[I;16711680,65280,255,16776960,16711935,65535],has_trail:true,has_twinkle:true}]}}}}
```

---

## 6. 重要注意事项

- **版本要求**：数据组件格式自 Java Edition 1.20.5 引入，`minecraft:fireworks` 组件取代了旧的 `Fireworks` NBT 标签。1.20.5 之前版本仍使用旧格式。
- **仅 Java 版**：烟花火箭实体 ID 为 `firework_rocket`；基岩版为 `fireworks_rocket`。
- **`Motion` 是全局坐标速度**，不是局部坐标。`Motion:[1.0,0.0,0.0]` 表示向世界 X 轴正方向飞。
- **烟花火箭自身有向上加速度**，纯水平飞行需要额外处理（如设置 `ShotAtAngle:true`）。
- **`^` 局部坐标依赖执行者朝向**，用 `at @s` 或 `rotated as` 确保朝向正确。
- **`~` 依赖执行位置**，用 `positioned as`、`at`、`positioned` 改变。
- **同一坐标中通常不要混用 `~` 和 `^`**，容易混淆。
- **命令方块执行 `^` 时通常没有有效实体朝向**，结果可能与预期不同。
- **颜色值使用十进制表示**，可按 `R × 65536 + G × 256 + B` 计算。
- **`flight_duration` 为 Byte 类型**，在命令中建议写为 `2b` 以明确类型。

---

## 7. 快速记忆

- `~`：相对“执行位置”
- `^`：相对“执行朝向”
- `positioned as @p`：把执行位置搬到玩家
- `at @s`：把执行位置、朝向、维度都搬到执行者
- `as @p at @s`：最常用于“在玩家位置并按玩家朝向”
- `minecraft:fireworks`：物品端数据组件，控制飞行时长与爆裂效果
- `LifeTime` / `Life` / `ShotAtAngle`：实体端 NBT，控制实体行为
- 1.20.5+ 用 `components`，1.20.5 之前版本用 `tag`
