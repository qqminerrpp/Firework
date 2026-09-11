// ============================================================================
// fireworks-opencode-plugin · feedback.js
// 烟花命令结构化反馈：复用自检结果，补充优点识别、改进建议，
// 并在可行时自动生成修正后的命令（含旧格式 → 新格式转换）。
// 零依赖纯 ESM，可被插件与测试直接引用。
// ============================================================================

import { validateCommand, parseCommandToParams } from "./validate.js";
import { generateCommand } from "./generate.js";
import { SHAPE_NAMES } from "./knowledge.js";

/**
 * 对烟花命令给出反馈报告。
 * @param {{command: string, intent?: string, strict?: boolean, suggest_fix?: boolean}} args
 * @returns {object}
 */
export function feedbackOnCommand({
  command,
  intent = "",
  strict = true,
  suggest_fix = true,
} = {}) {
  const report = validateCommand(command, { strict });
  const p = report.parsed || {};
  const strengths = [];
  const suggestions = [];

  // ---- 优点识别
  if (!p.old_format && /minecraft:fireworks/.test(command)) {
    strengths.push("使用 1.20.5+ 数据组件格式 components:{\"minecraft:fireworks\":{...}}");
  }
  if (p.flight_duration !== null && p.flight_duration >= -128 && p.flight_duration <= 127) {
    strengths.push(`flight_duration=${p.flight_duration} 在 Byte 有效范围（-128–127）内`);
  }
  if (p.lifetime !== null && p.flight_duration !== null) {
    // 与公式一致性的判断交由 issues；这里仅在无相关 warning 时加分
    const hasLifeWarning = report.issues.some(
      (i) => i.severity === "warning" && /LifeTime=/.test(i.message)
    );
    if (!hasLifeWarning) strengths.push("LifeTime 与飞行时长公式一致");
  }
  if (p.explosions_count && p.explosions_count <= 256) {
    strengths.push(`爆裂效果数量合法（${p.explosions_count} 个，≤ 256）`);
  }
  if (p.shapes.length && p.shapes.every((s) => SHAPE_NAMES[s])) {
    strengths.push(
      `爆裂形态合法：${p.shapes.map((s) => `${s}(${SHAPE_NAMES[s]})`).join("、")}`
    );
  }
  if (p.colors_ok && p.color_errors === 0) {
    strengths.push("颜色值均在 0–16777215（后 24 位）范围内");
  }
  if (p.coordinates && !p.coordinates.mixed) {
    strengths.push("坐标类型单一清晰（未混用 ~ 与 ^）");
  }
  if (p.coordinates && p.coordinates.usesLocal && /as @p at @s|as @a at @s/.test(command)) {
    strengths.push("^ 局部坐标配合 execute as/at，朝向有保障");
  }
  if (p.entity === "firework_rocket") {
    strengths.push("使用 Java 版实体 ID firework_rocket");
  }
  if (p.count !== null && p.count > 0 && p.count <= 64) {
    strengths.push(`count=${p.count} 在有效范围（0 < count ≤ 64）内`);
  }

  // ---- 改进建议（把 issue 转成可执行建议）
  for (const issue of report.issues) {
    if (issue.severity === "info") continue;
    const prefix =
      issue.severity === "error" ? "必须修复" : "建议处理";
    suggestions.push(`[${prefix}] ${issue.message}${issue.hint ? " → " + issue.hint : ""}`);
  }
  if (intent && intent.trim()) {
    suggestions.push(`需求核对：${intent.trim()} — 请确认生成的爆裂形态/颜色/位置符合该意图。`);
  }

  // ---- 修正命令
  let corrected_command = null;
  let corrected_note = null;
  if (suggest_fix) {
    try {
      const params = parseCommandToParams(command);
      if (params) {
        const gen = generateCommand(params);
        corrected_command = gen.command;
        corrected_note = params.note
          ? params.note
          : "按解析到的参数重新生成（保留原位置与爆裂配置，统一为 1.20.5+ 数据组件格式）";
      } else {
        corrected_note = "无法自动反解参数生成修正命令，请按上述问题手动修改，或重新用 fireworks_generate 生成";
      }
    } catch (err) {
      corrected_note = `自动修正失败：${err.message}`;
    }
  }

  const verdict =
    report.valid === false
      ? "未通过：存在必须修复的问题"
      : report.issues.some((i) => i.severity === "warning")
        ? "基本通过：存在建议处理的问题"
        : "通过：未发现问题";

  return {
    command,
    verdict,
    score: report.score,
    status: report.status,
    intent: intent || null,
    strengths,
    issues: report.issues,
    suggestions,
    corrected_command,
    corrected_note,
    summary: report.summary,
  };
}
