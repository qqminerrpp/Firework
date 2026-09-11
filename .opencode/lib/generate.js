// ============================================================================
// fireworks-opencode-plugin · generate.js
// 烟花火箭命令/代码生成：按位置预设、爆裂参数构建 /summon 命令、mcfunction 或
// 纯 NBT，并内置自检（复用 validate.js 规则）。
// 零依赖纯 ESM，可被插件与测试直接引用。
// ============================================================================

import {
  SHAPES,
  MAX_EXPLOSIONS,
  FLIGHT_DURATION_RANGE,
  POSITION_PRESETS,
  lifetimeRange,
  suggestedLifetime,
} from "./knowledge.js";
import { parseColor } from "./colors.js";
import { validateCommand } from "./validate.js";

/** 支持的输出格式 */
const FORMATS = ["command", "mcfunction", "nbt"];

/** 颜色数组规范化：接受 number 或 #RRGGBB/RRGGBB/十进制字符串 */
function normalizeColors(arr, label) {
  if (arr === undefined || arr === null) return [];
  if (!Array.isArray(arr)) {
    throw new Error(`${label} 必须是数组（可空），收到：${JSON.stringify(arr)}`);
  }
  return arr.map((c, i) => {
    let v;
    try {
      v = parseColor(c);
    } catch (err) {
      throw new Error(`${label} 第 ${i + 1} 项无效：${err.message}`);
    }
    return v;
  });
}

/** 解析位置预设，返回 { prefix, coords } */
function resolvePosition(position, { x, y, z, distance, position_override } = {}) {
  const preset = POSITION_PRESETS[position];
  if (!preset) {
    throw new Error(
      `未知位置预设 "${position}"，允许：${Object.keys(POSITION_PRESETS).join("、")}`
    );
  }
  if (position === "absolute") {
    if (![x, y, z].every((v) => Number.isFinite(v))) {
      throw new Error("position=absolute 时必须提供 x、y、z 数值");
    }
    return { prefix: preset.prefix, coords: preset.coords(x, y, z) };
  }
  if (position === "custom") {
    if (!position_override || !String(position_override).trim()) {
      throw new Error('position=custom 时必须提供 position_override（如 "~ ~2 ~" 或 "^ ^ ^5"）');
    }
    return { prefix: preset.prefix, coords: String(position_override).trim() };
  }
  if (position === "player_forward" || position === "player_eyes_forward") {
    const d = distance ?? 2;
    if (!Number.isInteger(d)) {
      throw new Error("distance 必须是整数（可正可负，如 2 或 -1）");
    }
    return { prefix: preset.prefix, coords: preset.coords(d) };
  }
  return { prefix: preset.prefix, coords: preset.coords() };
}

/** 简易 NBT 美化（引号感知；[I; …] 整型数组保持单行） */
export function prettyNbt(input) {
  let out = "";
  let depth = 0;
  let inStr = null;
  const stack = []; // 数组是否内联（[I;…]）
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inStr) {
      out += ch;
      if (ch === "\\" && i + 1 < input.length) {
        out += input[i + 1];
        i++;
      } else if (ch === inStr) {
        inStr = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = ch;
      out += ch;
      continue;
    }
    if (ch === "[") {
      const rest = input.slice(i + 1);
      const inline = /^\s*(I;|\])/.test(rest);
      stack.push(inline);
      if (inline) {
        out += ch;
      } else {
        out += ch + "\n" + "  ".repeat(depth + 1);
        depth++;
      }
      continue;
    }
    if (ch === "]") {
      const inline = stack.pop();
      if (inline) {
        out += ch;
      } else {
        depth = Math.max(0, depth - 1);
        out = out.replace(/[ \t]+\n/g, "\n").replace(/\n?[ \t]*$/, "");
        out += "\n" + "  ".repeat(depth) + ch;
      }
      continue;
    }
    if (ch === "{") {
      out += ch + "\n" + "  ".repeat(depth + 1);
      depth++;
      continue;
    }
    if (ch === "}") {
      depth = Math.max(0, depth - 1);
      out = out.replace(/[ \t]+\n/g, "\n").replace(/\n?[ \t]*$/, "");
      out += "\n" + "  ".repeat(depth) + ch;
      continue;
    }
    if (ch === ",") {
      const inline = stack[stack.length - 1];
      if (inline) {
        out += ", ";
      } else {
        out += ",\n" + "  ".repeat(depth);
      }
      continue;
    }
    out += ch;
  }
  return out.trim();
}

/**
 * 生成烟花火箭命令。
 * @param {object} args
 * @returns {object} { command, nbt, summary, warnings, self_check }
 */
export function generateCommand(args = {}) {
  const {
    position = "player",
    x,
    y,
    z,
    distance,
    position_override,
    flight_duration = 2,
    include_lifetime = true,
    lifetime,
    shot_at_angle = false,
    explosions,
    format = "command",
    use_byte_suffix = true,
    compact = true,
  } = args;

  const warnings = [];

  // ---- format 自检
  if (!FORMATS.includes(format)) {
    throw new Error(`非法 format "${format}"，允许：${FORMATS.join(" / ")}`);
  }

  // ---- flight_duration 自检
  if (
    !Number.isInteger(flight_duration) ||
    flight_duration < FLIGHT_DURATION_RANGE.min ||
    flight_duration > FLIGHT_DURATION_RANGE.max
  ) {
    throw new Error(
      `flight_duration 必须是 ${FLIGHT_DURATION_RANGE.min}–${FLIGHT_DURATION_RANGE.max} 的整数，收到：${flight_duration}`
    );
  }
  if (flight_duration > 3) {
    warnings.push(
      "flight_duration 超过 3（合成台上限），只能通过命令设置（最高 127，约 16 秒）"
    );
  }

  // ---- explosions 自检与构建
  if (explosions !== undefined && explosions !== null && !Array.isArray(explosions)) {
    throw new Error(`explosions 必须是数组，收到：${typeof explosions}`);
  }
  const list =
    Array.isArray(explosions) && explosions.length
      ? explosions
      : [
          {
            shape: "star",
            colors: [16711680, 65280, 255],
            has_trail: true,
            has_twinkle: true,
          },
        ];
  if (list.length > MAX_EXPLOSIONS) {
    throw new Error(`explosions 最多 ${MAX_EXPLOSIONS} 个元素，收到 ${list.length}`);
  }
  const nbtExplosions = list.map((e, i) => {
    if (!e || typeof e !== "object") {
      throw new Error(`explosions 第 ${i + 1} 项必须是对象`);
    }
    const shape = e.shape ?? "small_ball";
    if (!SHAPES.includes(shape)) {
      throw new Error(
        `非法 shape "${shape}"（第 ${i + 1} 个爆裂），允许：${SHAPES.join(" / ")}`
      );
    }
    const colors = normalizeColors(e.colors, `explosions[${i}].colors`);
    const fade = normalizeColors(e.fade_colors, `explosions[${i}].fade_colors`);
    const parts = [`shape:"${shape}"`, `colors:[I;${colors.join(",")}]`];
    if (fade.length) parts.push(`fade_colors:[I;${fade.join(",")}]`);
    if (e.has_trail) parts.push("has_trail:true");
    if (e.has_twinkle) parts.push("has_twinkle:true");
    return `{${parts.join(",")}}`;
  });

  // ---- NBT 组装
  const fd = use_byte_suffix ? `${flight_duration}b` : String(flight_duration);
  const components = `{"minecraft:fireworks":{flight_duration:${fd},explosions:[${nbtExplosions.join(",")}]}}`;
  const item = `{id:"minecraft:firework_rocket",count:1,components:${components}}`;

  let lt = null;
  if (lifetime !== undefined && lifetime !== null) {
    if (!Number.isInteger(lifetime) || lifetime < 0) {
      throw new Error("lifetime 必须是非负整数（刻）");
    }
    lt = lifetime;
  } else if (include_lifetime) {
    lt = suggestedLifetime(flight_duration);
  }
  const entityParts = [];
  if (lt !== null) entityParts.push(`LifeTime:${lt}`);
  if (shot_at_angle) entityParts.push("ShotAtAngle:true");
  entityParts.push(`FireworksItem:${item}`);
  const nbt = `{${entityParts.join(",")}}`;

  // ---- 位置与命令
  const { prefix, coords } = resolvePosition(position, {
    x,
    y,
    z,
    distance,
    position_override,
  });

  let command;
  let nbtPretty = prettyNbt(nbt);
  if (format === "nbt") {
    command = nbtPretty;
  } else {
    const full = `${prefix} ${coords} ${nbt}`;
    command = compact || format === "mcfunction" ? full : `${full}`;
    if (!compact && format === "command") {
      // 多行展示：仅对实体 NBT 部分美化
      const idx = full.lastIndexOf(" {");
      command = idx === -1 ? full : `${full.slice(0, idx + 1)}\n${prettyNbt(nbt)}`;
    }
    if (format === "mcfunction") command = command.replace(/^\/+/, "");
  }
  if (format === "command" && !command.startsWith("/")) {
    command = "/" + command;
  }

  // ---- 内置自检（生成 → 自检闭环）
  let selfCheck;
  try {
    selfCheck = validateCommand(command);
  } catch (err) {
    selfCheck = {
      valid: false,
      status: "error",
      score: 0,
      issues: [{ severity: "error", message: `自检异常：${err.message}`, hint: "" }],
      summary: [],
    };
  }

  const summary = {
    format,
    position,
    position_label: POSITION_PRESETS[position]?.label,
    flight_duration,
    lifetime: lt,
    lifetime_formula_range: lifetimeRange(flight_duration),
    explosions_count: list.length,
    shapes: list.map((e) => e.shape ?? "small_ball"),
    colors_decoded: list.map((e) => normalizeColors(e.colors, "summary").map(decToHexLabel)),
    shot_at_angle: !!shot_at_angle,
    coordinates: coords,
  };

  return { command, nbt: nbtPretty, summary, warnings, self_check: selfCheck };
}

function decToHexLabel(v) {
  return `#${v.toString(16).padStart(6, "0").toUpperCase()}`;
}
