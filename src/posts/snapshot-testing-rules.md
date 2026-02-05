---
date: 2026-02-05

# 摘要
excerpt: <p>本文定义了基于 Snapshot Testing 的交替迭代工作流，通过将快照作为行为不动点，实现测试与实现的解耦迭代。</p>
---

# Agent Rules for “交替迭代 + Snapshot 为不动点”（Rust + insta）

> 目的：交替迭代 / 不动点 / 残差审查 / RT vs CT 的思想浓缩成一套可供 Agent 执行并在 CI 与人类审查之间闭环的**行为级规则**。目标工程语言：**Rust**，快照框架：**insta**（使用 YAML serializer 推荐配置）。文中关于 insta 的具体用法与命令参照官方文档。 ([Insta Snapshots][1])

---

## 1. 总则（High-level）

1. **交替迭代（Alternating Modes）为唯一工作流约束**：Agent 在一个 PR/变更周期里只在两种模式之一工作：
   - **Mode A（测试模式）**：只修改/补充测试（包括 Snapshot）。**不得修改任何“生产实现代码”**（例如 `src/**`、`crates/**/src/**` 等不在测试目录下的 Rust 源码）。如果为了让测试可写/可跑而“必须”改实现，Agent 必须停止并走第 6 节（破坏不动点流程，需人工批准）。
   - **Mode B（实现模式）**：只修改实现代码以满足现有测试。**不得修改测试集合（`tests/core/` 或 `tests/regression/`）**，除非明确记录并经人工批准（见第 6 节）。此外，Mode B **不得引入任何 snapshot 文件变更**（见 §5）。

2. **“残差”原则**：任何 PR 的审查焦点只看测试（快照）与核心测试（CT）的变更差异（snapshot diffs / core test diffs）。Agent 的目标是把变更缩减为最小的、可审查的残差。

3. **测试优先但非“全部正确”**：大量回归测试（RT，snapshot-based）由 Agent 自动生成并由系统记录为“不动点行为基线”。少量核心测试（CT）由人负责确定语义与 expected outputs。两类测试应在工程目录与 CI 流程中明确区分（见 §3）。

---

## 2. 工程约定（目录 / 命名 / Snapshot 存放）

1. 目录约定（强制）：

   ```
   tests/
     core/           # 手工挑出的核心测试（CT）—— 必须人工确认 expected output
     regression/     # Agent 批量生成的回归测试（RT，snapshot 大量存档）
     snapshots/      # （可选）集中快照文件（或使用 insta 默认的 .snap 文件并按库放置）
   ```

2. Snapshot 文件与宏约定：
   - 默认使用 **YAML** 格式（更易 diff 与 redaction 支持）。在 `Cargo.toml` 的 `dev-dependencies.insta` 上启用 `yaml` feature（这是 **insta crate 的 feature**，不是工作区/二进制的 `--features yaml`）。示例：`cargo add --dev insta --features yaml`。 ([Insta Snapshots][1])
   - 常用 assertion 宏（Agent 必须优先使用）：
     - `insta::assert_yaml_snapshot!(value);` —— 推荐用于结构化的序列化值（YAML）。
     - `insta::assert_debug_snapshot!(value);` 或 `insta::assert_snapshot!(string);` —— 用于无法或不需要 serde 序列化的情况。 ([Insta Snapshots][1])

3. 快照注释与元信息：
   - 对于 RT 快照，使用 `insta::with_settings!({ info => &info, description => "..." }, { ... })` 在审查时提供上下文说明（输入 / 场景 / 简短描述），以提高 snapshot review 的可读性。
     - `description`：一句话描述场景（做什么/为什么要 snapshot）。
     - `info`：**短、稳定、可读** 的关键输入信息（例如 seed、case id、关键参数），避免把大对象/巨量文本塞进 review UI。
     - Agent 在生成 RT 时必须**自动提供** `description` 与 `info`。 ([Insta Snapshots][1])

---

## 3. 测试分类与策略（CT 与 RT）

1. **核心测试（CT）**
   - 定义：人工挑选、输出小而可判定、语义清晰的测试用例（关键路径、关键契约、错误码、边界行为）。
   - 编写规则：
     - 断言的 expected output 必须由人工确认（Agent 可以草拟 expected）。
     - 使用 `assert_*_snapshot!` 或传统断言，但必须在 PR 中标明“该测试为 CT，需人工审查”。

2. **回归测试（RT） / Snapshot-based Regression**
   - 定义：由 Agent 批量生成的快照，用于固化“上一个版本的行为”作为不动点。
   - 编写规则：
     - Agent 可以生成大量 snapshots（包括大输出的统计摘要、接口 schema、边界 case 输出摘要）。
     - RT 的目标不是证明语义正确，而是确保**行为连续性**，任何行为变化都会在 diff 中被暴露（由人判断是否为合理变更）。
     - 对于大数据输出，Agent 应优先保存“摘要型快照”（例如 counts、shapes、aggregates、top-k、quantiles），不要直接把 TB 级原始数据放入 snapshot。

3. **从 RT 到 CT 的晋升规则**
   - 如果某个 RT 的 diff 在 N 次迭代中反复出现，Agent 应提交工单或 PR 请求将该 case 提炼为 CT（含人工标注的 expected output）。使用明确标签如 `promote-to-core`。

---

## 4. Mode A（只动测试）的详细 Agent 行为准则

> 目标：在不改实现的前提下，把现有行为准确固化为 snapshot。

1. **执行步骤（顺序不可变）**：
   1. 拉取最新主分支代码并切换到指定分支。
   2. 运行测试：`INSTA_UPDATE=no cargo test`（先**不更新**快照，确认当前实现行为）。这是为了确保我们不会在看不到 diff 的情况下盲写新快照。 ([Insta Snapshots][1])
   3. 对于需要被固化的功能/场景，编写或补充 test 函数，使用 `insta::assert_yaml_snapshot!`（或适当的宏）并用 `with_settings!` 注入 `description` / `info`（便于 review）。
   4. 保证测试的**确定性**（详见 §7）。
   5. 运行 `INSTA_UPDATE=new cargo test`（或 `cargo insta test`）以产生 `.snap.new` 文件（或使用 `cargo insta test --review`）。不要直接在首次运行时把新 snapshot 写进历史版本，而是让 `cargo-insta` / `cargo insta review` 协助人工接收。 ([Insta Snapshots][1])
   6. 把变更提交（包含 `.snap.new`），并发起 PR；PR 中包含自动生成的 `description` 信息与变更原因说明。

2. **测试内容优先级**（Agent 自动排序）：
   1. Schema / 公共 API 输出（snapshot 字段集合、错误码、类型）——优先；
   2. 边界输入与异常路径（空数据、乱序、非法编码）；
   3. 大输出的统计摘要（shape、counts、quantiles、top-k）；
   4. 敏感或个人信息需 redaction（见 §7）

3. **对“测试失败”的默认假设**：
   - 如果新增测试（在 Mode A 中）跑不过：**先假设测试本身表达不准确**，Agent 必须调整测试直到它能可靠反映当前实现（实现代码不得改动）。调整必须留下变更理由和 `with_settings!` 的 `info` 字段记录示例输入 / 输出。

4. **产出文件 / 元数据**：
   - Test 文件位置：`tests/regression/<module>_*.rs`；
   - Snapshot 文件：由 insta 自动放置在相应 `snap` 文件（或 inline snapshot）；
   - 每个 RT snapshot 必须带 `description` 文本（场景、输入示例、为何要保存）。

---

## 5. Mode B（只动实现）的详细 Agent 行为准则

> 目标：在 **不改测试** 的约束下，使实现通过现有测试（RT + CT）。

1. **执行步骤**：
   1. 从 PR 的基线分支拉取（基线包含已确认的 snapshots）。
   2. 运行 `INSTA_UPDATE=no cargo test`。任何失败都视为“实现不满足基线”。
   3. 修复实现直到 `INSTA_UPDATE=no cargo test` 全部通过（Agent 可以在本地使用 `INSTA_UPDATE=always cargo test` 来快速调试，但最终提交前必须在 `INSTA_UPDATE=no` 下验证）。
   4. **红线：Mode B 不得产生任何快照文件变更**。提交前工作区必须满足：
      - 不存在对 `.snap` / `.snap.new` / `.snap.old` 等文件的修改或新增；
      - 若出现快照差异，视为流程违规：必须回滚这些快照变更，并继续通过修改实现来满足既有快照基线。
   5. 若为性能/架构变更确需改动测试（例如：接口签名更改），Agent **必须**：
      - 在 PR 中明确说明为何需要修改测试（变更语义），
      - 更新相应 CT（并在 PR 中把更新的 expected output 标注为“人工须确认”），
      - 标记 PR 为“tests-changed”并请求人工审查（不可自动批准）。

2. **对测试失败的默认假设**：
   - 如果测试失败，默认是实现有问题；Agent 需在不修改测试前提下修复实现。

3. **实现变更的最小化原则**：
   - 优先从兼容性方向改（保持旧接口行为，新增功能或后向兼容），避免大范围的行为变更导致大量 RT diffs。

4. **提交与变更说明**：
   - PR 中必须包含：修改目标、影响的 CT 与 RT 列表、如何验证（运行命令示例），并附带 `cargo insta test --review` 的结果截图/摘要（或 `cargo-insta` 输出片段）。

---

## 6. 当确需修改测试（破坏不动点）时的流程

1. **允许修改测试的严格条件**（任何一个条件满足都需人工批准）：
   - 这是语义级变更（业务逻辑应有意改变）且变更已经经过产品/负责人 sign-off；
   - 存在 bugfix：当前 CT 表现已被确认为错误，必须更正；
   - API contract 明确变更（版本升级或 breaking change）。

2. **流程（强制）**：
   - Agent 提交带有 `WIP` 标记的 PR，包含：
     - 变更 rationale（为什么旧 snapshot 不再代表期望行为）
     - 所有受影响的 snapshots 列表（RT + CT）
     - 一个“回退计划”：如何在发现问题时快速 revert 回上一个快照/实现

   - **人工**必须审查并批准 test 修改（并特别审核 CT 的 expected outputs）。
   - 只有在人工点击 `cargo insta review` 接受新的 snapshot 或明确在 PR 中批准更新后，才能合并。

---

## 7. 确定性（Determinism）与快照可信赖度 checklist

> Agent 在生成任何 snapshot 前必须通过以下自动化检测（这一步非常关键，文章中反复强调确定性）：

1. **固定随机性**：
   - 所有随机数生成必须可注入 seed（测试以固定 seed 运行或由测试传入 seed）。

2. **稳定化集合输出**：
   - 对于 `HashMap` / `HashSet` 等无序集合，输出前强制排序（或将其转换为有序容器）再序列化。

3. **时间相关内容 hook**：
   - 系统时间、now() 等必须通过注入/参数传入，测试通过给定时间参数运行。

4. **并发/多线程注意**：
   - 尽量避免非确定性并发输出；必要时，在测试中使用 deterministic schedulers、repro tools 或把并发部分 mock 为同步版本。

5. **外部依赖隔离**：
   - 文件系统、网络、数据库等外部 IO 在测试中需 mock / 用 deterministic fixtures。

6. **Redactions / Filters**：
   - 对含 PII、时间戳、动态 id 的字段使用 insta 的 redaction / filter 功能（docs 提供 redaction 支持），以避免无关差异。 ([Insta Snapshots][2])

---

## 8. insta 专用细节（必须遵守的操作指令与配置）

1. **安装与配置建议**：
   - dev-deps：`insta` + `yaml` feature（推荐），示例 `cargo add --dev insta --features yaml`。编译性能优化可在 `Cargo.toml` 的 `profile.dev.package` 里为 `insta` 与 `similar` 提高 opt-level（文档建议）。 ([Insta Snapshots][1])

2. **常用命令 & 环境变量**：
   - 本地确认（不写入 snapshot）：
     `INSTA_UPDATE=no cargo test`
   - 生成 .snap.new（本地 review）：
     `INSTA_UPDATE=new cargo test` 或 `cargo insta test`
   - 交互式审查并接受快照（人工步骤）：
     `cargo insta review` 或 `cargo insta test --review`。文档建议使用 `cargo-insta` 改善审查体验。 ([Insta Snapshots][1])
   - CI 环境：务必设 `CI=true`，并让 insta 在 CI 中 **不自动写入快照**（默认行为之一），以防 CI 无意中接受 snapshot。 ([Insta Snapshots][1])
   - `INSTA_UPDATE` 模式说明（Agent 在脚本中可使用）：
     - `auto`（默认，CI 检测不同表现）
     - `always`（覆盖旧快照）
     - `unseen`（对新快照行为为 always，对已有为 new）
     - `new`（写 `.snap.new`）
     - `no`（不更新）
       文档列出这些模式，Agent 的自动流程必须依赖 `no`（验证）或 `new`（产出待审 .new 文件）而非 `always`（除非是专门的 accept-run）。 ([Insta Snapshots][1])

3. **with_settings! 用法**（务必在 RT 中加 metadata）：

   ```rust
   let info = "seed=42, case=render_basic, input=... (keep it short)";
   insta::with_settings!({
       info => &info,
       description => "render template X with ctx Y",
       omit_expression => true
   }, {
       insta::assert_yaml_snapshot!(template.render(ctx));
   });
   ```

   这会在 `cargo insta review` 时显示 input / description，极大提升审查效率。 ([Insta Snapshots][1])

4. **inline snapshots**：允许把 snapshot 存 inline（`assert_yaml_snapshot!(value, @"")`），`cargo-insta` 可自动 update inline snapshots。Agent 在生成小型、易读 snapshot（如单个字符串输出）时可使用 inline 快照减少文件数。 ([Insta Snapshots][1])

---

## 9. Agent Prompt 模板（可直接使用的任务描述）

### Mode A — 生成/固化回归测试（RT）

```
Task: Mode A — 固化当前行为为回归快照（RT）
Language: Rust, insta (YAML snapshots)
Constraints:
 - DO NOT modify production implementation files (e.g. `src/**`, `crates/**/src/**`, or any non-test Rust sources).
 - Tests must be deterministic (see Determinism checklist).
 - Use `insta::assert_yaml_snapshot!` for serializable outputs.
 - Use `insta::with_settings!` to attach `description` (short scenario) and `info` (input example).
Deliverables:
 - tests/regression/<module>_snapshot.rs
 - New .snap.new files (do not overwrite existing snapshots)
Commands to run:
 - INSTA_UPDATE=no cargo test
 - INSTA_UPDATE=new cargo test  # produce .snap.new
Notes:
 - For very large outputs, snapshot only aggregates (counts, shape, top-k, quantiles).
 - Redact PII using insta redactions or filter before snapshotting.
```

### Mode B — 实现修复以通过测试

```
Task: Mode B — 修改实现以通过现有 CT + RT（DO NOT change tests）
Language: Rust
Constraints:
 - DO NOT change tests in tests/core/ or tests/regression/
 - If interface change required, stop and prepare a test-change proposal (requires human approval).
Deliverables:
 - Code changes in production implementation paths (e.g. `src/**`, `crates/**/src/**`) with tests unchanged
 - No snapshot file changes in the working tree (`*.snap*` must remain untouched)
Commands:
 - INSTA_UPDATE=no cargo test
 - Optionally: INSTA_UPDATE=always cargo test (local debug only)
```

---

## 10. 人类审查（Reviewer）Checklist（PR / snapshot diff 时）

1. 对 RT diffs：
   - 只需判断：**这次变化是否是有意的、预期的、或可接受的副作用？**
   - 若不确定，运行相关 test（`INSTA_UPDATE=no cargo test`）并查看 `with_settings` 提供的 `info` 与 `description`。

2. 对 CT 与接口变更：
   - 逐条确认 expected output 与语义（如错误码、字段语义）；
   - 若为 breaking change，确认已有消费者/调用者计划；
   - 若测试修改较多，优先要求更小范围的实现改动或拆分 PR。

3. Promotion：若某 RT diff 频繁出现或非常关键，要求把该 case 提炼为 CT（并补充人工确认的 expected）。
4. 接受快照（交互式）：
   - 使用 `cargo insta review`，在交互界面中阅读 `description` / `info`，人工决定 accept/reject。
   - 绝不在 CI 或自动流程中 blind accept snapshots。

---

## 11. CI 配置建议（确保安全与可追溯）

1. 在 CI 中设置：

   ```
   export CI=true
   export INSTA_UPDATE=no
   cargo test
   ```

   — 任何 snapshot 差异应导致 CI 失败并阻止合并，直到人工审查并在本地运行 `cargo insta review` 接受变更。 ([Insta Snapshots][1])

2. 对于 nightly / auto-accept 流水线（可选，仅限 release window，需审批）：
   - 运行在受控分支上并且由人工触发 accept。禁止自动 `INSTA_UPDATE=always` 在主分支自动写入快照。

3. 把 `cargo-insta` 加入开发工具链（而非 CI 强依赖）以便本地交互式审查。 ([Insta Snapshots][1])

---

## 12. 质量保障与监控（实践细节）

1. **快照大小控制**：Agent 对大输出优先存统计摘要（counts、shape、describe、quantiles）。示例（类比 pandas.describe()）：
   - `assert_yaml_snapshot!(Summary { count: n, min, p25, median, p75, max });`

2. **审计日志**：每次 Agent 自动更新 RT 时，提交必须包含：
   - 触发脚本/command,
   - 输入样例与随机 seed,
   - `with_settings.info` 的 JSON（或 YAML）快照。

3. **回滚**：若合并后发现 regression，必须能用 Git revert 回滚实现 commit，并在回滚 PR 中由 Agent 运行差异分析脚本找出引入变更的最小提交。
4. **Promote & Mature**：把“多次 diff 的 RT”列入 backlog，定期由人工将其转为 CT。

---

## 13. 风险与注意点

1. **不要把 snapshot 当作业务正确性的唯一证据**——CT 用于保证关键语义，RT 用于保障行为连续性与快速发现残差。
2. **审查疲劳仍可能存在**：即便用 RT，大量 snapshot diffs 仍需合理的 prioritization（按影响度排序）以节省注意力（人脑是稀缺资源）。
3. **并发/分布式系统的确定性成本高**：对多线程/分布式服务，建议 Agent 先构造 deterministic unit/integration harness，再做 snapshot。

---

## 14. 附：推荐的 `Cargo.toml` / dev 工具片段（示例）

```toml
[dev-dependencies]
insta = { version = "1.46.1", features = ["yaml"] }

[profile.dev.package]
insta.opt-level = 3
similar.opt-level = 3
```

（安装 cargo-insta）

```bash
# Unix
curl -LsSf https://insta.rs/install.sh | sh

# Run local review
cargo insta test --review
cargo insta review
```

（CI）

```bash
export CI=true
export INSTA_UPDATE=no
cargo test
```

参考：insta 官方文档与命令说明。 ([Insta Snapshots][1])

---

## 15. 小结（Agent 管理者/工程师的职责）

- **Agent**：自动化生产 RT、补全测试、在规定的模式下自我修复（只改测试/只改实现），生成有用的 `description`/`info` 元数据，并确保测试的确定性。
- **人类（Reviewer / Owner）**：负责 CT 的语义确认、批准跨测试的接口变更、在出现关键 RT diffs 时作决策与把控风险。
- **工程管控**：用 `INSTA_UPDATE`、`cargo-insta`、CI `CI=true` 保证 snapshot 流程可审查且不会被自动盲写。

---

## 引用与参考（快捷链接）

- Insta docs（Overview / Getting Started / Commands / with_settings / INSTA_UPDATE 等） — 官方文档（用于宏名、命令、配置、行为描述）。 ([Insta Snapshots][1])

[1]: https://insta.rs/docs/quickstart/ "Getting Started | Insta Snapshots"
[2]: https://insta.rs/docs/ "Overview | Insta Snapshots"
