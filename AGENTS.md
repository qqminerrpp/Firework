# AGENTS.md

opencode 烟花命令插件项目：为 Minecraft Java Edition 1.20.5+ 生成 / 校验 / 反馈烟花火箭 `/summon` 命令。

## 结构

- `.opencode/plugins/fireworks-plugin.js` — 插件入口，注册 5 个工具、`/fireworks` 命令、知识注入钩子
- `.opencode/lib/` — 纯 ESM 逻辑：`generate.js` / `validate.js` / `feedback.js` / `colors.js` / `knowledge.js`
- `.opencode/agent/` — 创新类 subagent（发散、收敛、跨域、SCAMPER）
- `.opencode/reference/fireworks-reference.md` — 权威参考文档（唯一来源）

## 约定

- 零运行时依赖（`@opencode-ai/plugin` 除外），lib 与插件可被测试直接 import。
- 范围用 `–`（如 `-128–127`）；`~` 仅作相对坐标，不表示范围。
- 用户可见文案（知识库、错误提示）用中文；工具描述与参数说明用英文。
- 不要新增注释，除非必要。

## 校验与测试

无独立 lint / typecheck 配置，使用以下命令：

```powershell
node .opencode/test-all.mjs          # 功能回归测试
node --check .opencode/lib/*.js      # 语法检查（逐个文件）
```

改动 `lib/` 后请运行功能测试，确保生成的命令括号平衡、自检通过。
