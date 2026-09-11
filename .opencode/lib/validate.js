// ============================================================================
// fireworks-opencode-plugin · validate.js
// 烟花火箭命令自检：解析 /summon 实体 NBT 与 minecraft:fireworks 数据组件，
// 按《烟花火箭数据组件与实体 NBT 参考》逐项核对，输出问题报告与评分。
// 零依赖纯 ESM，可被插件与测试直接引用。
// ============================================================================

import {
  SHAPES,
  MAX_EXPLOSIONS,
  FLIGHT_DURATION_RANGE,
  COLOR_MAX,
  lifetimeRange,
} from "./knowledge.js";

// ---------------------------------------------------------------------------
// 小工具：字符串/引号感知的括号配对
// ---------------------------------------------------------------------------

/** 返回 text 中从 start（指向 { 或 [）开始的配对闭合下标；未闭合返回 -1 */
function findMatching(text, start) {
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = null;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = ch;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** 统计 content 中顶层 {…} 对象的个数（用于统计 explosions 元素数） */
function countTopObjects(content) {
  let count = 0;
  let depth = 0;
  let inStr = null;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inStr) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = ch;
      continue;
    }
    if (ch === "{") {
      depth++;
      if (depth === 1) count++;
    } else if (ch === "}") {
      depth = Math.max(0, depth - 1);
    }
  }
  return count;
}

/** 提取 content 中所有顶层 {…} 对象子串 */
function topObjectStrings(content) {
  const out = [];
  let depth = 0;
  let inStr = null;
  let start = -1;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inStr) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = ch;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        out.push(content.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return out;
}

/** 提取 text 中紧随 key 之后的平衡数组（[…]）内容；无则返回 null */
function extractArrayAfter(text, key) {
  const re = new RegExp(`\\b${key}\\s*:\\s*\\[`);
  const m = re.exec(text);
  if (!m) return null;
  const end = findMatching(text, m.index + m[0].length - 1);
  if (end === -1) return null;
  return text.slice(m.index + m[0].length - 1, end + 1);
}

/** 解析 int 数组内容 "I; 1, 2, 3" → 数字数组；含非法项时抛错 */
function parseIntArrayContent(content) {
  const cleaned = content.replace(/^\s*I\s*;\s*/, "").trim();
  if (!cleaned) return [];
  return cleaned
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t !== "")
    .map((t) => {
      const m = /^(-?\d+)\s*[bB]?$/.exec(t);
      if (!m) throw new Error(`颜色数组含非整数项：${t}`);
      return parseInt(m[1], 10);
    });
}

// ---------------------------------------------------------------------------
// 主自检
// ---------------------------------------------------------------------------

/**
 * 自检一条烟花命令。
 * @param {string} command
 * @param {{strict?: boolean}} opts strict 默认 true：颜色越界等按 error；false 时降级为 warning
 * @returns {object} 结构化报告
 */
export function validateCommand(command, opts = {}) {
  const strict = opts.strict !== false;
  const issues = [];
  let score = 100;

  const add = (severity, message, hint) => {
    issues.push({ severity, message, hint: hint || "" });
    if (severity === "error") score -= 15;
    else if (severity === "warning") score -= 5;
  };

  let text = (command ?? "").trim();
  if (!text) {
    return {
      valid: false,
      status: "invalid",
      score: 0,
      issues: [{ severity: "error", message: "命令为空", hint: "" }],
      summary: [],
    };
  }
  text = text.replace(/^\/+/, ""); // 去掉前导 /

  // 识别 summon 与实体 ID
  const summon = /\bsummon\s+([\w:]+)/i.exec(text);
  let entityId = null;
  let nbtText = null;
  let positionTokens = [];
  let prefix = text;

  if (summon) {
    entityId = summon[1].toLowerCase();
    prefix = text.slice(0, summon.index).trim();
    const afterId = text.slice(summon.index + summon[0].length);
    const braceIdx = afterId.indexOf("{");
    const posPart =
      braceIdx === -1 ? afterId.trim() : afterId.slice(0, braceIdx).trim();
    positionTokens = posPart.split(/\s+/).filter(Boolean).slice(0, 3);
    if (braceIdx !== -1) {
      const end = findMatching(afterId, braceIdx);
      if (end === -1) {
        add("error", "实体 NBT 括号不匹配（缺少闭合 }）", "补全 NBT 或重新生成");
      } else {
        nbtText = afterId.slice(braceIdx, end + 1);
      }
    } else {
      add(
        "error",
        "未找到实体 NBT（summon 命令需要 {} 数据）",
        "参考 fireworks_knowledge topic=entity"
      );
    }
  } else {
    if (/minecraft:fireworks|FireworksItem|flight_duration|explosions/.test(text)) {
      nbtText = text;
      add(
        "info",
        "未识别为 summon 命令，按 NBT 片段进行组件检查",
        "如需完整自检请提供完整命令"
      );
    } else {
      add(
        "error",
        "无法解析：既不是 summon 命令，也不含烟花数据组件",
        "请输入 /summon firework_rocket ... 完整命令"
      );
    }
  }

  const parsed = {
    entity: entityId,
    coordinates: { tokens: positionTokens, mixed: false, usesLocal: false },
    flight_duration: null,
    lifetime: null,
    life: null,
    shot_at_angle: null,
    explosions_count: null,
    shapes: [],
    colors_ok: true,
    color_errors: 0,
    has_component: false,
    old_format: false,
    id: null,
    count: null,
    has_motion: false,
  };

  // ---- 实体 ID 检查
  if (entityId === "fireworks_rocket") {
    add(
      "warning",
      "检测到基岩版实体 ID fireworks_rocket；Java 版应为 firework_rocket",
      "本知识库仅适用于 Java 版，请改用 minecraft:firework_rocket"
    );
  } else if (entityId && entityId !== "firework_rocket") {
    add(
      "info",
      `实体 ID 为 ${entityId}，不是烟花火箭实体 firework_rocket`,
      "确认命令目标是否正确"
    );
  }

  // ---- 坐标检查
  const toks = positionTokens.join(" ");
  if (toks.includes("~") && toks.includes("^")) {
    parsed.coordinates.mixed = true;
    add(
      "warning",
      "同一坐标中混用了 ~ 与 ^，容易混淆且结果可能异常",
      "同一坐标统一使用一种类型"
    );
  }
  if (toks.includes("^")) {
    parsed.coordinates.usesLocal = true;
    if (!/\b(as|rotated)\b/.test(prefix)) {
      add(
        "warning",
        "^ 为局部坐标，依赖执行者朝向；当前没有 as/rotated 保证朝向（命令方块等非实体执行者通常无有效朝向）",
        "建议：execute as @p at @s ... 或 rotated as ..."
      );
    }
  }

  // ---- NBT 内容检查
  if (nbtText) {
    // 旧格式检测（新格式的 FireworksItem / lowercase colors / flight_duration 不会命中）
    if (
      /\btag\s*:/.test(nbtText) ||
      /\bExplosions\s*:/.test(nbtText) ||
      /\bFadeColors\s*:/.test(nbtText) ||
      /\bFlicker\s*:/.test(nbtText) ||
      /\bType\s*:/.test(nbtText) ||
      /\bFlight\s*:/.test(nbtText) ||
      /\bColors\s*:/.test(nbtText) ||
      /\bTrail\s*:/.test(nbtText) ||
      /\bFireworks\s*:/.test(nbtText)
    ) {
      parsed.old_format = true;
      add(
        "error",
        "检测到 1.20.5 之前的旧格式（tag、Fireworks、Explosions、Type、Colors、FadeColors、Trail、Flicker）",
        "1.20.5+ 请改用 components:{\"minecraft:fireworks\":{flight_duration,explosions:[{shape,colors,fade_colors,has_trail,has_twinkle}]}}"
      );
    }

    // id / count（FireworksItem 内；NBT 键通常不带引号，兼容两种写法）
    const idM = /["']?id["']?\s*:\s*"([^"]+)"/.exec(nbtText);
    if (idM) {
      parsed.id = idM[1];
      if (idM[1] !== "minecraft:firework_rocket") {
        add(
          "warning",
          `FireworksItem.id 为 "${idM[1]}"，文档规范应为 "minecraft:firework_rocket"`,
          "修正 id 或确认意图"
        );
      }
    } else if (!parsed.old_format) {
      add(
        "warning",
        "FireworksItem 中缺少 id 标签",
        "补充 id:\"minecraft:firework_rocket\""
      );
    }
    const countM = /\bcount\s*:\s*(-?\d+)/.exec(nbtText);
    if (countM) {
      parsed.count = parseInt(countM[1], 10);
      if (parsed.count <= 0 || parsed.count > 64) {
        add(
          "error",
          `count=${parsed.count} 超出有效范围（0 < count ≤ 64）`,
          "修正 count（通常为 1）"
        );
      }
    }

    // Life / LifeTime / ShotAtAngle
    const lifeM = /\bLife\s*:\s*(-?\d+)/.exec(nbtText);
    if (lifeM) {
      parsed.life = parseInt(lifeM[1], 10);
      if (parsed.life < 0) add("error", `Life=${parsed.life} 不能为负数`, "修正 Life");
    }
    const ltM = /\bLifeTime\s*:\s*(-?\d+)/.exec(nbtText);
    if (ltM) parsed.lifetime = parseInt(ltM[1], 10);
    const saM = /\bShotAtAngle\s*:\s*(true|false|1b|0b|1B|0B|1|0)/i.exec(nbtText);
    if (saM) parsed.shot_at_angle = /true|1b|1B|1/i.test(saM[1]);

    // flight_duration
    const fdM = /\bflight_duration\s*:\s*(-?\d+)\s*[bB]?/.exec(nbtText);
    if (fdM) {
      parsed.flight_duration = parseInt(fdM[1], 10);
      const { min, max } = FLIGHT_DURATION_RANGE;
      if (parsed.flight_duration < min || parsed.flight_duration > max) {
        add(
          "error",
          `flight_duration=${parsed.flight_duration} 超出 Byte 范围 ${min}–${max}`,
          "修正为 -128–127 的整数"
        );
      } else if (parsed.flight_duration > 3) {
        add(
          "warning",
          `flight_duration=${parsed.flight_duration} 超过合成台上限 3，只能通过命令设置（最高 127，约 16 秒）`,
          "确认意图；若需合成请 ≤ 3"
        );
      }
    }

    // LifeTime 与公式一致性
    if (parsed.lifetime !== null && parsed.flight_duration !== null) {
      const r = lifetimeRange(parsed.flight_duration);
      if (parsed.lifetime < r.min || parsed.lifetime > r.max) {
        add(
          "warning",
          `LifeTime=${parsed.lifetime} 与公式 10 × (f + 1) + rand(0–6) + rand(0–7) 不一致（${r.min}–${r.max}）`,
          "建议取公式区间内数值（如 10 × (f + 1) + 5）"
        );
      }
    }

    // explosions
    const exArr = extractArrayAfter(nbtText, "explosions");
    if (exArr === null) {
      add(
        "info",
        "未找到 explosions 数组（只有飞行、没有爆裂的火箭不会产生爆裂效果）",
        "如需爆裂效果请添加 explosions:[{shape,...}]"
      );
    } else {
      const inner = exArr.slice(1, -1);
      const cnt = countTopObjects(inner);
      parsed.explosions_count = cnt;
      if (cnt > MAX_EXPLOSIONS) {
        add(
          "error",
          `explosions 有 ${cnt} 个元素，超过上限 ${MAX_EXPLOSIONS}`,
          "缩减爆裂数量"
        );
      } else if (cnt === 0) {
        add("info", "explosions 为空数组，不会有爆裂效果", "添加爆裂对象或确认意图");
      } else {
        // 逐对象检查 shape / colors / fade_colors / has_trail / has_twinkle
        const objs = topObjectStrings(inner);
        for (const o of objs) {
          const sh = /\bshape\s*:\s*"([^"]+)"/.exec(o);
          if (sh) {
            parsed.shapes.push(sh[1]);
            if (!SHAPES.includes(sh[1])) {
              add(
                "error",
                `非法 shape "${sh[1]}"（允许：${SHAPES.join(" / ")}）`,
                "修正 shape"
              );
            }
          }
          for (const key of ["colors", "fade_colors"]) {
            const arr = extractArrayAfter(o, key);
            if (arr === null) continue;
            const innerArr = arr.slice(1, -1);
            let vals;
            try {
              vals = parseIntArrayContent(innerArr);
            } catch (err) {
              parsed.colors_ok = false;
              add(
                strict ? "error" : "warning",
                `${key} 数组含非整数项：${err.message}`,
                "颜色值必须为十进制整数（R × 65536 + G × 256 + B）"
              );
              continue;
            }
            for (const v of vals) {
              if (v < 0 || v > COLOR_MAX) {
                parsed.colors_ok = false;
                parsed.color_errors++;
                add(
                  strict ? "error" : "warning",
                  `${key} 中颜色值 ${v} 超出 0–${COLOR_MAX}（仅使用后 24 位）`,
                  `修正为 0–${COLOR_MAX}，例如红色 16711680`
                );
              }
            }
            if (vals.length === 0) {
              add("info", `${key} 为空数组，视为黑色`, "如需颜色请填入十进制整型数组");
            }
          }
          for (const flag of ["has_trail", "has_twinkle"]) {
            const fm = new RegExp(`\\b${flag}\\s*:\\s*([^,\\s}]+)`).exec(o);
            if (fm) {
              if (!/^(true|false|1b|0b|1B|0B|1|0)$/i.test(fm[1])) {
                add(
                  "error",
                  `${flag} 值 "${fm[1]}" 不是布尔值（true、false、1b、0b）`,
                  "修正为 true 或 false"
                );
              }
            }
          }
        }
      }
    }

    // minecraft:fireworks 组件存在性
    if (/minecraft:fireworks/.test(nbtText)) parsed.has_component = true;
    else if (!parsed.old_format) {
      add(
        "warning",
        "未找到 minecraft:fireworks 数据组件；火箭将使用默认烟花（可能无爆裂）",
        "在 FireworksItem.components 中加入 {\"minecraft:fireworks\":{...}}"
      );
    }

    // Motion 提示
    if (/\bMotion\s*:\s*\[/.test(nbtText)) {
      parsed.has_motion = true;
      add(
        "info",
        "检测到 Motion 标签：Motion 是全局坐标速度（非局部坐标）",
        "纯水平飞行建议配合 ShotAtAngle:true"
      );
    }
  }

  score = Math.max(0, Math.min(100, score));
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const valid = errors.length === 0;
  const status = !nbtText
    ? "invalid"
    : valid
      ? warnings.length
        ? "ok_with_warnings"
        : "ok"
      : "invalid";

  const summary = {
    entity: parsed.entity,
    coordinates: parsed.coordinates.tokens.join(" "),
    coordinate_types: parsed.coordinates.mixed
      ? "mixed(~/^)"
      : parsed.coordinates.usesLocal
        ? "local(^)"
        : "relative(~)",
    flight_duration: parsed.flight_duration,
    lifetime: parsed.lifetime,
    life: parsed.life,
    shot_at_angle: parsed.shot_at_angle,
    explosions_count: parsed.explosions_count,
    shapes: parsed.shapes,
    colors_ok: parsed.colors_ok,
    id: parsed.id,
    count: parsed.count,
    old_format: parsed.old_format,
    has_component: parsed.has_component,
    has_motion: parsed.has_motion,
  };

  return {
    valid,
    status,
    score,
    issues,
    summary,
    parsed,
  };
}

// ---------------------------------------------------------------------------
// 从命令反解参数（供 feedback 自动生成修正命令；支持旧格式转新格式）
// ---------------------------------------------------------------------------

/**
 * 尽力从命令中解析出 fireworks_generate 的参数。
 * 解析失败或无法处理时返回 null。
 * @param {string} command
 * @returns {object|null}
 */
export function parseCommandToParams(command) {
  const report = validateCommand(command, { strict: false });
  const p = report.parsed;
  if (!p || !p.entity) return null;
  if (
    report.issues.some(
      (i) => i.severity === "error" && /括号不匹配/.test(i.message)
    )
  ) {
    return null;
  }

  let text = (command ?? "").trim().replace(/^\/+/, "");
  // 位置预设识别（依据 execute 前缀与坐标写法）
  let position = "here";
  let x, y, z, distance;
  const coords = p.coordinates.tokens.join(" ");
  if (/positioned as @p/.test(text)) {
    if (/~ ~1 ~/.test(coords)) position = "player_head";
    else position = "player";
  } else if (/as @a at @s/.test(text)) {
    position = "all_players";
  } else if (/as @p at @s/.test(text)) {
    if (/anchored eyes/.test(text)) {
      position = "player_eyes_forward";
      const dm = /\^\s*\^\s*\^(-?\d+)/.exec(coords);
      if (dm) distance = parseInt(dm[1], 10);
    } else {
      position = "player_forward";
      const dm = /\^\s*\^\s*\^(-?\d+)/.exec(coords);
      if (dm) distance = parseInt(dm[1], 10);
    }
  } else if (/@e\[type=pig/.test(text)) {
    position = "nearest_pig";
  } else if (/summon firework_rocket/.test(text)) {
    const abs = coords.split(/\s+/).filter(Boolean);
    if (abs.length === 3 && abs.every((t) => /^-?\d+(\.\d+)?$/.test(t))) {
      position = "absolute";
      x = parseFloat(abs[0]);
      y = parseFloat(abs[1]);
      z = parseFloat(abs[2]);
    } else if (abs.length === 3 && abs.every((t) => /^[~^]/.test(t))) {
      position = "here";
    } else if (abs.length === 3) {
      position = "custom";
    } else {
      position = "here";
    }
  }

  // 旧格式 → 新格式转换
  const explosions = [];
  if (p.old_format) {
    const fM = /\bFlight\s*:\s*(-?\d+)/.exec(text);
    const flight = fM ? parseInt(fM[1], 10) : 2;
    const exArr = extractArrayAfter(text, "Explosions");
    if (exArr) {
      for (const o of topObjectStrings(exArr.slice(1, -1))) {
        const sh = /\bType\s*:\s*"([^"]+)"/.exec(o);
        const colors = extractColorsFrom(o, "Colors");
        const fade = extractColorsFrom(o, "FadeColors");
        const trail =
          /\bTrail\s*:\s*(1b|0b|1|0|true|false)/i.test(o) &&
          !/Trail\s*:\s*(0b|0|false)/i.test(o);
        const flicker =
          /\bFlicker\s*:\s*(1b|0b|1|0|true|false)/i.test(o) &&
          !/Flicker\s*:\s*(0b|0|false)/i.test(o);
        explosions.push({
          shape: sh ? sh[1] : "small_ball",
          colors,
          fade_colors: fade,
          has_trail: trail,
          has_twinkle: flicker,
        });
      }
    }
    return {
      position,
      x,
      y,
      z,
      distance,
      flight_duration: flight,
      include_lifetime: false,
      shot_at_angle: p.shot_at_angle || undefined,
      explosions: explosions.length ? explosions : undefined,
      format: "command",
      use_byte_suffix: true,
      note: "由旧格式转换而来",
    };
  }

  // 新格式
  let nbtText = text;
  if (p.entity) {
    const summon = /\bsummon\s+([\w:]+)/i.exec(text);
    if (summon) {
      const afterId = text.slice(summon.index + summon[0].length);
      const braceIdx = afterId.indexOf("{");
      if (braceIdx !== -1) {
        const end = findMatching(afterId, braceIdx);
        if (end !== -1) nbtText = afterId.slice(braceIdx, end + 1);
      }
    }
  }
  const fdM = /\bflight_duration\s*:\s*(-?\d+)\s*[bB]?/.exec(nbtText);
  const flight = fdM ? parseInt(fdM[1], 10) : 2;

  const exArr = extractArrayAfter(nbtText, "explosions");
  if (exArr) {
    for (const o of topObjectStrings(exArr.slice(1, -1))) {
      const sh = /\bshape\s*:\s*"([^"]+)"/.exec(o);
      const colors = extractColorsFrom(o, "colors");
      const fade = extractColorsFrom(o, "fade_colors");
      const trail = /has_trail\s*:\s*(true|1b|1B|1)/i.test(o);
      const twinkle = /has_twinkle\s*:\s*(true|1b|1B|1)/i.test(o);
      explosions.push({
        shape: sh ? sh[1] : "small_ball",
        colors,
        fade_colors: fade,
        has_trail: trail,
        has_twinkle: twinkle,
      });
    }
  }

  return {
    position,
    x,
    y,
    z,
    distance,
    flight_duration: flight,
    include_lifetime: false,
    lifetime: p.lifetime ?? undefined,
    shot_at_angle: p.shot_at_angle || undefined,
    explosions: explosions.length ? explosions : undefined,
    format: "command",
    use_byte_suffix: true,
  };
}

/** 从对象子串中提取颜色 int 数组 */
function extractColorsFrom(objText, key) {
  const re = new RegExp(`\\b${key}\\s*:\\s*\\[(?:I;)?\\s*([^\\]]*)\\]`);
  const m = re.exec(objText);
  if (!m) return [];
  try {
    return parseIntArrayContent(m[1]);
  } catch {
    return [];
  }
}
