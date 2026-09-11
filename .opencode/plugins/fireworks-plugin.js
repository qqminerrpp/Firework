// ============================================================================
// fireworks-opencode-plugin · fireworks-plugin.js
// opencode 平台插件（.opencode/plugins/ 自动加载）：
//   - 注册 5 个 AI 可调用工具：fireworks_generate / fireworks_validate /
//     fireworks_feedback / fireworks_colors / fireworks_knowledge
//   - 注册斜杠命令 /fireworks
//   - chat.message 钩子：检测到烟花相关请求时注入精简知识
//   - tool.execute.after 钩子：记录本插件工具的使用日志
// 依据《烟花火箭数据组件与实体 NBT 参考》（Java Edition 1.20.5+）。
// 书写约定：工具描述与参数说明用英文；知识库、错误提示等用户可见内容用中文；
//           范围用 –（如 -128–127）；~ 仅作相对坐标。
// ============================================================================

import { tool } from "@opencode-ai/plugin";
import { generateCommand } from "../lib/generate.js";
import { validateCommand } from "../lib/validate.js";
import { feedbackOnCommand } from "../lib/feedback.js";
import {
  convertColor,
  buildPalette,
  standardPalette,
} from "../lib/colors.js";
import {
  knowledgeSection,
  KNOWLEDGE_TOPICS,
  KNOWLEDGE_KEYWORDS,
  KNOWLEDGE_INTRO,
  SHAPES,
  POSITION_PRESETS,
} from "../lib/knowledge.js";

/** 安全的结构化日志 */
async function log(client, level, message, extra) {
  try {
    if (client && typeof client.app?.log === "function") {
      await client.app.log({
        body: {
          service: "fireworks-plugin",
          level,
          message,
          extra: extra || {},
        },
      });
    }
  } catch {
    /* 日志失败不影响主流程 */
  }
}

/** 工具参数错误时的结构化返回（避免 throw 中断整轮） */
function fail(err) {
  return JSON.stringify(
    { error: err instanceof Error ? err.message : String(err) },
    null,
    2
  );
}

export const FireworksPlugin = async ({ client, project, directory }) => {
  await log(client, "info", "fireworks-plugin 已加载", {
    directory: directory || null,
  });

  return {
    // ------------------------------------------------------------------
    // 自定义工具（AI 可直接调用）
    // ------------------------------------------------------------------
    tool: {
      // 1) 生成命令/代码（自带自检）
      fireworks_generate: tool({
        description:
          "Purpose: generate Minecraft Java 1.20.5+ firework rocket /summon commands, mcfunctions, or raw NBT (data component format) from scratch, with a built-in self-check report (same rules as fireworks_validate). " +
          "Inputs & limits: position presets cover player, player head, forward, eyes-forward, pig, all players, absolute, and custom; colors accept decimal integers or #RRGGBB; at most 256 explosions. " +
          "When to use: when a new command is needed. To inspect an existing command use fireworks_validate; for improvement advice and a corrected command use fireworks_feedback.",
        args: {
          position: tool.schema
            .enum(Object.keys(POSITION_PRESETS))
            .default("player")
            .describe(
              "Position preset (default player): here = current execution position; player = nearest player; player_head = 1 block above the nearest player; " +
                "player_forward = N blocks in front of the nearest player by facing (via distance); player_eyes_forward = N blocks in front of the nearest player's eyes (anchored eyes, via distance); " +
                "nearest_pig = 1 block above the nearest pig; all_players = all players; absolute = absolute coordinates (requires x/y/z); custom = custom coordinates (requires position_override)"
            ),
          x: tool.schema.number().optional().describe("Absolute X coordinate (required when position=absolute)"),
          y: tool.schema.number().optional().describe("Absolute Y coordinate (required when position=absolute)"),
          z: tool.schema.number().optional().describe("Absolute Z coordinate (required when position=absolute)"),
          distance: tool.schema
            .number()
            .int()
            .optional()
            .describe("Forward distance for player_forward / player_eyes_forward (default 2, may be negative)"),
          position_override: tool.schema
            .string()
            .optional()
            .describe('Custom coordinate string (required when position=custom), e.g. "~ ~2 ~" or "^ ^ ^5"'),
          flight_duration: tool.schema
            .number()
            .int()
            .min(-128)
            .max(127)
            .optional()
            .describe(
              "Flight duration (Byte, i.e. gunpowder count): crafting caps at 3; commands allow up to 127 (about 16 s). Default 2"
            ),
          include_lifetime: tool.schema
            .boolean()
            .optional()
            .describe(
              "Attach the recommended LifeTime (10 × (f + 1) + 5, inside the formula range). Default true"
            ),
          lifetime: tool.schema
            .number()
            .int()
            .min(0)
            .optional()
            .describe("Custom LifeTime in ticks; overrides include_lifetime when set"),
          shot_at_angle: tool.schema
            .boolean()
            .optional()
            .describe("Shot by crossbow or dispenser (ShotAtAngle:true, horizontal acceleration). Default false"),
          explosions: tool.schema
            .array(
              tool.schema.object({
                shape: tool.schema
                  .enum(SHAPES)
                  .optional()
                  .describe("Burst shape (default small_ball): small_ball, large_ball, star, creeper, burst"),
                colors: tool.schema
                  .array(tool.schema.union([tool.schema.number(), tool.schema.string()]))
                  .optional()
                  .describe("Primary particle colors: decimal integers or #RRGGBB strings, multiple allowed; an empty array renders black"),
                fade_colors: tool.schema
                  .array(tool.schema.union([tool.schema.number(), tool.schema.string()]))
                  .optional()
                  .describe("Fade colors (same format as colors); optional"),
                has_trail: tool.schema.boolean().optional().describe("Trail (diamond), default false"),
                has_twinkle: tool.schema.boolean().optional().describe("Twinkle (glowstone dust), default false"),
              })
            )
            .optional()
            .describe(
              "Explosion effect list, at most 256. Defaults to one star-shaped burst with three colors (red, green, blue), trail and twinkle on"
            ),
          format: tool.schema
            .enum(["command", "mcfunction", "nbt"])
            .optional()
            .describe("Output format: command = full command with leading / (default); mcfunction = no leading /; nbt = formatted raw NBT"),
          use_byte_suffix: tool.schema
            .boolean()
            .optional()
            .describe("Append the b suffix to flight_duration (e.g. 2b, making Byte explicit). Default true"),
          compact: tool.schema
            .boolean()
            .optional()
            .describe("Single-line compact output (default true); false pretty-prints the entity NBT"),
        },
        async execute(args) {
          try {
            const result = generateCommand(args);
            return JSON.stringify({ command: result.command, nbt: result.nbt, summary: result.summary, warnings: result.warnings, self_check: result.self_check }, null, 2);
          } catch (err) {
            return fail(err);
          }
        }
      }),

      // 2) 自检
      fireworks_validate: tool({
        description:
          "Purpose: validate a firework rocket command or NBT snippet and return a structured report (severities, hints, score). " +
          "Inputs & limits: checks include legacy format (tag/Fireworks/Explosions/Type etc.), flight_duration range (-128–127), explosions count (≤ 256) and shape, " +
          "color values (0–16777215), LifeTime vs formula, entity ID (Java firework_rocket vs Bedrock fireworks_rocket), " +
          "mixed ~/^ coordinates and facing, and count range (0 < count ≤ 64). " +
          "When to use: quick error checking of an existing command; it does not generate commands — use fireworks_feedback for suggestions and a corrected command.",
        args: {
          command: tool.schema
            .string()
            .describe("Content to validate: a full /summon firework_rocket ... command, an mcfunction line, or an NBT snippet containing components"),
          strict: tool.schema
            .boolean()
            .optional()
            .describe("Strict mode (default true): out-of-range colors etc. are errors; false downgrades them to warnings"),
        },
        async execute(args) {
          try {
            return JSON.stringify(
              validateCommand(args.command, { strict: args.strict !== false }),
              null,
              2
            );
          } catch (err) {
            return fail(err);
          }
        },
      }),

      // 3) 反馈
      fireworks_feedback: tool({
        description:
          "Purpose: give structured feedback on a firework command: strengths, issues by severity, actionable suggestions, and when possible an auto-corrected command (including legacy → new format conversion). " +
          "Inputs & limits: optional intent describes the desired effect for tailored advice; suggest_fix=false skips the corrected command. " +
          "When to use: the user asks to check, improve, or fix a command; use fireworks_validate when only a score and issue list are needed.",
        args: {
          command: tool.schema.string().describe("Command to review"),
          intent: tool.schema
            .string()
            .optional()
            .describe('Desired effect description (e.g. "birthday party colorful firework") for tailored advice'),
          suggest_fix: tool.schema
            .boolean()
            .optional()
            .describe("Generate a corrected command (default true)"),
        },
        async execute(args) {
          try {
            const report = feedbackOnCommand(args);
            return JSON.stringify({ verdict: report.verdict, score: report.score, corrected_command: report.corrected_command, corrected_note: report.corrected_note, strengths: report.strengths, issues: report.issues }, null, 2);
          } catch (err) {
            return fail(err);
          }
        },
      }),

      // 4) 颜色工具
      fireworks_colors: tool({
        description:
          "Purpose: firework color utility: convert between decimal integers (R × 65536 + G × 256 + B), #RRGGBB, and RGB; look up the standard color table; build palettes. Results can be written into colors:[I; ...] directly. " +
          "Inputs & limits: mode=convert requires value; mode=palette accepts count (1–16, default 6) and colors; mode=standard needs no arguments. " +
          "When to use: compute color values, convert hex to decimal, or choose a palette.",
        args: {
          mode: tool.schema
            .enum(["convert", "palette", "standard"])
            .optional()
            .describe("convert = convert one color (default); palette = build a palette; standard = list the standard color table"),
          value: tool.schema
            .string()
            .optional()
            .describe('Color to convert, e.g. "#FF0000", "16711680", "FF00FF", or a number (required for convert)'),
          count: tool.schema
            .number()
            .int()
            .min(1)
            .max(16)
            .optional()
            .describe("Palette size for mode=palette (1–16, default 6)"),
          colors: tool.schema
            .array(tool.schema.union([tool.schema.number(), tool.schema.string()]))
            .optional()
            .describe("Base colors for mode=palette (optional; falls back to cycling the standard color table)"),
        },
        async execute(args) {
          try {
            const mode = args.mode ?? "convert";
            if (mode === "standard") {
              return JSON.stringify({ mode, colors: standardPalette() }, null, 2);
            }
            if (mode === "palette") {
              const palette = buildPalette({ count: args.count, colors: args.colors });
              return JSON.stringify({ mode, count: palette.length, colors: palette }, null, 2);
            }
            if (!args.value && args.value !== 0) {
              throw new Error("convert 模式需要 value 参数");
            }
            return JSON.stringify({ mode, result: convertColor(args.value) }, null, 2);
          } catch (err) {
            return fail(err);
          }
        },
      }),

      // 5) 知识库查询
      fireworks_knowledge: tool({
        description:
          "Purpose: query the firework rocket knowledge base (source: fireworks-reference.md, Java 1.20.5+). " +
          "Inputs & limits: topic can be components, entity, shapes, colors, formula, coordinates, versions, cheatsheet, or all (default all). " +
          "When to use: confirm field definitions, formulas, or version differences before generating or validating.",
        args: {
          topic: tool.schema
            .enum(KNOWLEDGE_TOPICS)
            .optional()
            .describe(
              "Topic (default all): components, entity, shapes, colors, formula, coordinates, versions, cheatsheet, all"
            ),
        },
        async execute(args) {
          try {
            return knowledgeSection(args.topic ?? "all");
          } catch (err) {
            return fail(err);
          }
        },
      }),
    },

    // ------------------------------------------------------------------
    // 斜杠命令 /fireworks
    // ------------------------------------------------------------------
    config: async (config) => {
      try {
        config.command = config.command || {};
        config.command["fireworks"] = {
          description: "生成 Minecraft Java 1.20.5+ 烟花火箭命令（生成 → 自检 → 反馈）",
          template:
            "Handle the following request with the fireworks tools: $ARGUMENTS\n" +
            "Flow: call fireworks_knowledge first if rules are needed → call fireworks_generate (includes a self-check) → call fireworks_feedback if improvements are needed.\n" +
            "Output: put the command in an mcfunction code block; then explain in 1–3 lines the position, explosion effects, and self-check result. The self-check conclusion must come from the tool output, never invented. Reply in the user's language.",
        };
      } catch (err) {
        await log(client, "warn", "注册 /fireworks 命令失败", { error: String(err) });
      }
    },

    // ------------------------------------------------------------------
    // 知识注入：检测到烟花相关请求时，把精简知识附到用户消息
    // ------------------------------------------------------------------
    "chat.message": async (input, output) => {
      try {
        const texts = (output.parts ?? [])
          .map((p) => (typeof p?.text === "string" ? p.text : ""))
          .join("\n");
        const hay = `${texts}\n${typeof output.message?.content === "string" ? output.message.content : ""}`.toLowerCase();
        if (!KNOWLEDGE_KEYWORDS.some((k) => hay.includes(k.toLowerCase()))) return;

        const sessionID = input?.sessionID ?? output?.message?.sessionID;
        const messageID = input?.messageID ?? output?.message?.id;
        if (!sessionID || !messageID) return;

        if (!Array.isArray(output.parts)) output.parts = [];
        output.parts.push({
          id: `prt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`,
          sessionID,
          messageID,
          type: "text",
          text: KNOWLEDGE_INTRO,
          synthetic: true,
        });
      } catch {
        /* 注入失败不影响对话 */
      }
    },

    // ------------------------------------------------------------------
    // 工具执行日志
    // ------------------------------------------------------------------
    "tool.execute.after": async (input, output) => {
      try {
        if (typeof input?.tool === "string" && input.tool.startsWith("fireworks_")) {
          await log(client, "info", `工具调用：${input.tool}`, {
            sessionID: input.sessionID || null,
          });
        }
      } catch {
        /* 忽略 */
      }
    },
  };
};

export default FireworksPlugin;
