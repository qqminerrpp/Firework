// ============================================================================
// fireworks-opencode-plugin · colors.js
// 烟花颜色工具：十进制 / #RRGGBB / RGB 互转，标准色表查询，配色生成。
// 颜色值 = R × 65536 + G × 256 + B（只使用后 24 位）。
// ============================================================================

import { COLOR_MAX, NAMED_COLORS } from "./knowledge.js";

/**
 * 解析颜色输入 → 十进制整数（0–16777215）。
 * 支持：#RRGGBB、RRGGBB、0xRRGGBB、十进制数字字符串、number。
 * @param {string|number} value
 * @returns {number}
 * @throws 格式或范围错误时抛出
 */
export function parseColor(value) {
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0 || value > COLOR_MAX) {
      throw new Error(
        `颜色值需为 0–${COLOR_MAX} 的整数（仅后 24 位），收到 ${value}`
      );
    }
    return value;
  }
  if (typeof value !== "string") {
    throw new Error(`无法识别的颜色：${String(value)}`);
  }
  let s = value.trim();
  if (!s) throw new Error("颜色为空");
  if (/^0x/i.test(s)) s = s.slice(2);
  if (s.startsWith("#")) s = s.slice(1);
  if (/^[0-9a-fA-F]{6}$/.test(s)) {
    return parseInt(s, 16);
  }
  if (/^-?\d+$/.test(s)) {
    const n = parseInt(s, 10);
    if (n < 0 || n > COLOR_MAX) {
      throw new Error(
        `颜色值需为 0–${COLOR_MAX} 的整数，收到 ${n}（若想用十六进制请写 #RRGGBB）`
      );
    }
    return n;
  }
  throw new Error(
    `无法识别的颜色格式（支持 #RRGGBB、RRGGBB、0xRRGGBB、十进制整数）：${value}`
  );
}

/**
 * 十进制 → 6 位大写十六进制（如 16711680 → "FF0000"）。
 * @param {number} dec
 * @returns {string}
 */
export function decToHex(dec) {
  const v = Math.max(0, Math.min(COLOR_MAX, Math.round(dec)));
  return v.toString(16).padStart(6, "0").toUpperCase();
}

/**
 * 十进制 → {r, g, b}。
 * @param {number} dec
 * @returns {{r:number,g:number,b:number}}
 */
export function decToRgb(dec) {
  const v = Math.max(0, Math.min(COLOR_MAX, Math.round(dec)));
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

/**
 * RGB → 十进制。
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {number}
 */
export function rgbToDec(r, g, b) {
  const v = r * 65536 + g * 256 + b;
  if (!Number.isInteger(v) || v < 0 || v > COLOR_MAX) {
    throw new Error(`RGB 需为 0–255 的整数，收到 r=${r} g=${g} b=${b}`);
  }
  return v;
}

/** 在标准色表中查找十进制颜色对应的名称（找不到返回 null） */
export function namedColor(dec) {
  const hit = NAMED_COLORS.find((c) => c.dec === dec);
  return hit ? hit.name : null;
}

/** 标准色表（含转换信息） */
export function standardPalette() {
  return NAMED_COLORS.map((c) => ({
    name: c.name,
    hex: c.hex,
    dec: c.dec,
    rgb: decToRgb(c.dec),
  }));
}

/**
 * 生成一组配色（供 fireworks_colors 工具 palette 模式）。
 * @param {{count?:number, colors?:string[]}} opts
 * @returns {{hex:string, dec:number, rgb:{r:number,g:number,b:number}, name:string|null}[]}
 */
export function buildPalette({ count = 6, colors } = {}) {
  const n = Math.max(1, Math.min(16, Math.floor(count) || 1));
  if (colors && colors.length) {
    return colors.slice(0, n).map((c) => {
      const dec = parseColor(c);
      return {
        hex: decToHex(dec),
        dec,
        rgb: decToRgb(dec),
        name: namedColor(dec),
      };
    });
  }
  // 无基础色时按标准色表循环
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = NAMED_COLORS[i % NAMED_COLORS.length];
    out.push({ hex: c.hex, dec: c.dec, rgb: decToRgb(c.dec), name: c.name });
  }
  return out;
}

/**
 * 转换单个颜色（convert 模式）：返回完整转换信息。
 * @param {string|number} value
 * @returns {object}
 */
export function convertColor(value) {
  const dec = parseColor(value);
  const rgb = decToRgb(dec);
  return {
    input: String(value),
    dec,
    hex: decToHex(dec),
    rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
    nbt_array_value: dec,
    name: namedColor(dec),
    note: "仅使用后 24 位，可直接写入 colors:[I; ...]",
  };
}
