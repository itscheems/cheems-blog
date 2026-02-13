---
date: 2026-02-14
excerpt: <p>在现代计算机系统中，为了提高性能，CPU 和编译器会进行各种优化。如指令重排、缓存系统、编译器优化等，这些优化在单线程程序中是安全的，但在多线程程序中可能导致问题。</p>
---

<!-- more -->

# 并发编程基础：内存序与 Happens-Before 关系

## 目录

1. [为什么需要内存序？](#为什么需要内存序)
2. [Happens-Before 关系](#happens-before-关系)
3. [Rust 的内存序类型](#rust-的内存序类型)
4. [Release-Acquire 模式详解](#release-acquire-模式详解)
5. [代码实例分析](#代码实例分析)
6. [常见模式与最佳实践](#常见模式与最佳实践)
7. [总结](#总结)

---

## 为什么需要内存序？

### 问题的根源：CPU 和编译器的优化

在现代计算机系统中，为了提高性能，CPU 和编译器会进行各种优化：

1. **指令重排序**：CPU 可能会改变指令的执行顺序
2. **缓存系统**：每个 CPU 核心有自己的缓存，数据可能不会立即同步到主内存
3. **编译器优化**：编译器可能会重新排列代码以提高效率

这些优化在单线程程序中是安全的，但在多线程程序中可能导致问题。

### 一个简单的例子

想象两个线程共享一个变量：

```rust
// 线程 A
data = 42;        // 写入数据
ready = true;     // 设置标志

// 线程 B
if ready {        // 检查标志
    print(data);  // 读取数据
}
```

**问题**：如果没有内存序/同步保证，线程 B 可能会看到 `ready = true`，但 `data` 仍然是旧值（比如 0）！

> 注：在 Rust 中，像这样跨线程读写普通变量本身就构成数据竞争，属于未定义行为（UB）。这里用它做示意，是为了说明“即便你以为按顺序写了两个变量，另一个线程也可能观察到不同的顺序”，真实代码应使用原子/锁/通道等同步原语。

这是因为：

- CPU 可能先执行 `ready = true`，再执行 `data = 42`
- 或者线程 B 的 CPU 缓存中 `data` 还没有更新

---

## Happens-Before 关系

### 什么是 Happens-Before？

**Happens-Before** 是一个偏序关系，定义了"事件 A 必须在事件 B 之前发生"的保证。

如果 A happens-before B，那么：

- A 的所有副作用（写入）对 B 都是可见的
- B 能看到 A 执行后的所有状态

### 建立 Happens-Before 关系的方式

1. **程序顺序**：同一线程中，前面的操作 happens-before 后面的操作
2. **同步原语**：通过锁、原子操作、通道等建立跨线程的 happens-before 关系
3. **内存序**：通过原子操作的内存序参数建立 happens-before 关系

### 关键点

**没有 happens-before 关系的操作，执行顺序是不确定的！**

这就是为什么我们需要内存序：它帮助我们建立明确的 happens-before 关系。

---

## Rust 的内存序类型

Rust 提供了 5 种内存序（`std::sync::atomic::Ordering`）：

### 1. Relaxed（最弱）

```rust
atomic.store(value, Ordering::Relaxed);
atomic.load(Ordering::Relaxed);
```

- **保证**：原子性（在该原子变量上不会出现数据竞争）
- **不保证**：任何顺序约束
- **用途**：计数器、简单的标志位（不需要同步其他数据）

### 2. Release（释放）

```rust
atomic.store(value, Ordering::Release);
```

- **保证**：
  - 原子性
  - 若另一个线程的 `load(Acquire)` **读到了这次 `store(Release)` 写入的值**，则该 `store` 之前的所有写入/副作用，对该线程在该 `load` 之后的操作可见
- **用途**：通常用于"发布"数据，表示"我写完了，其他线程可以读取了"

### 3. Acquire（获取）

```rust
atomic.load(Ordering::Acquire);
```

- **保证**：
  - 原子性
  - 若本次 `load(Acquire)` **读到了某个 `store(Release)` 写入的值**，则该 `store` 之前的写入/副作用，在本线程该 `load` 之后的操作中可见（并且本线程后续访问不会被重排序到该 `load` 之前）
- **用途**：通常用于"获取"已发布的数据：当你通过某个原子“标志/指针/版本号”来发布数据时，用 Acquire 来读取它，从而在读到发布者写入的值后，安全地读取其发布的数据

### 4. AcqRel（获取-释放）

```rust
atomic.compare_and_swap(old, new, Ordering::AcqRel);
```

- **保证**：同时具有 Acquire 和 Release 的保证
- **用途**：读-改-写操作（如 `compare_and_swap`、`fetch_add`）

### 5. SeqCst（顺序一致性，最强）

```rust
atomic.store(value, Ordering::SeqCst);
atomic.load(Ordering::SeqCst);
```

- **保证**：所有 `SeqCst` 操作有一个全局一致的顺序
- **用途**：需要全局顺序的场景（较少使用，性能开销较大）

---

## Release-Acquire 模式详解

### 核心概念

**Release-Acquire 配对**是最常用的同步模式之一：

- **Release Store**：发布者写入数据
- **Acquire Load**：接收者读取数据

### 建立 Happens-Before 关系

```
线程 A（发布者）               线程 B（接收者）
─────────────────            ─────────────────
准备数据
  ↓
store(flag, Release) ──────> load(flag, Acquire)
                              ↓
                              使用数据
```

**关键保证**：

- 如果线程 B 的 `load` 看到了线程 A 的 `store` 写入的值
- 那么线程 A 在 `store` **之前**的所有操作，对线程 B 在 `load` **之后**的所有操作都是可见的

### 内存屏障的作用

内存序在许多架构上会对应到某种形式的**内存屏障**（Memory Barrier）或等效约束：

- **Release（发布）侧约束**：在本线程内，禁止把 Release 之前的读/写重排序到该 `store` 之后
- **Acquire（获取）侧约束**：在本线程内，禁止把 Acquire 之后的读/写重排序到该 `load` 之前；并且当它读到某次 Release 写入的值时，获得相应的可见性保证

这就像在代码中插入了一道"墙"，确保操作的顺序。

---

## 实际使用场景

### 典型的使用流程

在实际应用中，`pause()`、`resume()` 和 `is_paused()` 通常这样使用：

```rust
use rsketch_common_worker::{Manager, Worker, WorkerContext, Pausable};
use std::time::Duration;

#[tokio::main]
async fn main() {
    let mut manager = Manager::new();

    // 创建一个每 1 秒执行一次的 Worker
    let handle = manager
        .worker(MyWorker)
        .interval(Duration::from_secs(1))
        .spawn();

    // 让 Worker 运行一段时间
    tokio::time::sleep(Duration::from_secs(5)).await;

    // 暂停 Worker（使用 Release 内存序）
    handle.pause();
    println!("Worker paused");

    // 检查状态（使用 Acquire 内存序）
    if handle.is_paused() {
        println!("Confirmed: Worker is paused");
    }

    // 做一些其他工作...
    tokio::time::sleep(Duration::from_secs(2)).await;

    // 恢复 Worker（使用 Release 内存序 + 通知）
    handle.resume();
    println!("Worker resumed");

    // 继续运行...
    tokio::time::sleep(Duration::from_secs(3)).await;

    manager.shutdown().await;
}
```

### 多线程场景

在更复杂的场景中，可能有多个线程同时操作同一个 handle：

```rust
// 线程 1：控制线程
tokio::spawn(async move {
    loop {
        if should_pause() {
            handle.pause();  // Release store
        } else {
            handle.resume(); // Release store + notify
        }
        tokio::time::sleep(Duration::from_secs(1)).await;
    }
});

// 线程 2：监控线程
tokio::spawn(async move {
    loop {
        let status = handle.is_paused(); // Acquire load
        report_status(status);
        tokio::time::sleep(Duration::from_secs(1)).await;
    }
});
```

**关键点**：即使多个线程同时调用这些方法，Release-Acquire 内存序也能确保：

- 对 `paused` 这个原子变量的读写是原子的（不会在该变量上产生数据竞争）
- 当某个线程的 `load(Acquire)` **读到** 另一个线程的 `store(Release)` 写入的值时，会建立同步关系（happens-before / synchronizes-with），从而带来“发布-获取”的可见性保证

但它不保证“所有线程立刻看到最新值”，也不自动解决更高层的逻辑竞态（例如多个线程同时 `resume()` 的幂等性/竞争问题）。

---

## 代码实例分析

让我们分析你代码中的 `IntervalHandle` 实现：

### 代码结构

```rust
pub struct IntervalHandle {
    paused: Arc<AtomicBool>,  // 共享的原子布尔值
    notify: Arc<Notify>,      // 通知机制
}

impl Pausable for IntervalHandle {
    fn pause(&self) {
        self.paused.store(true, Ordering::Release);  // Release 写入
    }

    fn resume(&self) {
        self.paused.store(false, Ordering::Release); // Release 写入
        self.notify.notify_one();                   // 唤醒等待的线程
    }

    fn is_paused(&self) -> bool {
        self.paused.load(Ordering::Acquire)         // Acquire 读取
    }
}
```

### Worker 主循环（在 manager.rs 中）

```rust
// Worker 线程
while driver.wait_next(&ctx).await {
    if paused.load(Ordering::Acquire) {  // Acquire 读取
        // 处理暂停逻辑
        // ...
    }
    // 执行工作
    worker.work(ctx.clone()).await;
}
```

### 执行流程分析

#### 场景 1：暂停 Worker

```
时间线：

线程 A（控制线程）           线程 B（Worker 线程）
─────────────────          ────────────────────
handle.pause()
  ↓
paused.store(true, Release)
  [Release 屏障]
  ↓
所有之前的操作完成
                          while 循环
                            ↓
                          paused.load(Acquire)
                            ↓
                          [Acquire 屏障]
                            ↓
                          看到 paused = true
                            ↓
                          进入暂停逻辑
```

**Happens-Before 关系**：

- `pause()` 中的 `store(Release)` happens-before Worker 线程中看到 `true` 的 `load(Acquire)`
- 这意味着 `pause()` 中在 `store` 之前的所有操作（比如更新指标），对 Worker 线程都是可见的

#### 场景 2：恢复 Worker

```
线程 A（控制线程）           线程 B（Worker 线程）
─────────────────          ────────────────────
handle.resume()
  ↓
paused.store(false, Release)
  [Release 屏障]
  ↓
notify.notify_one()
  ↓
所有之前的操作完成
                          paused.load(Acquire)
                            ↓
                          [Acquire 屏障]
                            ↓
                          看到 paused = false
                            ↓
                          继续执行
```

**关键点**：

1. `store(false, Release)` 用于“发布”：禁止本线程中 `store` 之前的访问被重排序到 `store` 之后；若 Worker 的 `load(Acquire)` **读到这次写入**，则 Worker 在该 `load` 之后能看到发布者在该 `store` 之前的写入/副作用
2. `notify_one()` 唤醒可能正在等待的 Worker 线程
3. Worker 线程使用 `load(Acquire)` 用于“获取”：若读到某次 `store(Release)` 的写入，则建立可见性与顺序保证；但“是否读到最新值/多久读到”取决于程序是否持续检查、是否等待/唤醒以及调度，不是内存序本身能保证的

### 为什么需要 Release-Acquire？

#### 如果没有内存序（错误示例）

```rust
// 错误：使用 Relaxed
fn pause(&self) {
    self.paused.store(true, Ordering::Relaxed);  // ❌ 错误！
}

// Worker 线程
if paused.load(Ordering::Relaxed) {  // ❌ 错误！
    // ...
}
```

**可能的问题**：

- `load(Relaxed)` 允许反复读到旧值（规范允许），因此不能把它当作可靠的跨线程“通知/同步点”
- 更重要的是：它不与其它内存访问建立 happens-before 关系，因此不能用它来“发布/保护”其他共享数据
- 对 `paused` 这个原子变量本身不会产生数据竞争；但如果还存在其它未同步的共享数据读写（普通变量/非原子），那些读写会形成数据竞争（Rust: UB）

#### 使用 Release-Acquire（正确示例）

```rust
// 正确：使用 Release-Acquire
fn pause(&self) {
    self.paused.store(true, Ordering::Release);  // ✅ 正确！
}

// Worker 线程
if paused.load(Ordering::Acquire) {  // ✅ 正确！
    // ...
}
```

**保证**：

- 当 Worker 的 `load(Acquire)` **读到** `pause()` 的 `store(true, Release)` 写入的值时，Worker 在该 `load` 之后的操作能看到 `store` 之前的写入/副作用（例如 `pause()` 里在 `store` 之前更新的指标）
- 这时建立了明确的 happens-before / synchronizes-with 关系
- 是否“及时读到”取决于程序逻辑与调度；内存序只约束一旦读到时的排序与可见性

---

## 常见错误与陷阱

### 错误 1：混用不同的内存序

```rust
// ❌ 错误：Release 和 Relaxed 不配对
fn pause(&self) {
    self.paused.store(true, Ordering::Release);
}

// Worker 线程
if paused.load(Ordering::Relaxed) {  // ❌ 错误！
    // 即便读到了 paused=true，也不具备看到 pause() 中其它写入的可见性保证；
    // 并且 load(Relaxed) 也允许读到旧值
}
```

**问题**：`load(Relaxed)` 既不保证会读到对应的 `store(Release)` 写入，也不具备 Acquire 语义；即便“碰巧读到了”该值，也不会因此建立 happens-before。

**正确做法**：使用 Release-Acquire 配对。

### 错误 2：忘记通知机制

```rust
// ❌ 错误：只更新状态，不通知等待的线程
fn resume(&self) {
    self.paused.store(false, Ordering::Release);
    // 忘记调用 notify_one()！
}
```

**问题**：如果 Worker 线程在 `pause_notify.notified()` 上等待，它永远不会被唤醒。

**正确做法**：在 `resume()` 中调用 `notify_one()`。

### 错误 3：在错误的时机检查状态

```rust
// ❌ 错误：在 Release store 之前检查
fn resume(&self) {
    if self.paused.load(Ordering::Acquire) {  // 检查
        self.paused.store(false, Ordering::Release);  // 更新
    }
}
```

**问题**：这个检查本身没问题，但如果有多个线程同时调用 `resume()`，可能出现竞态条件。

**正确做法**：使用原子操作（如 `compare_and_swap`）或者接受"幂等性"（多次调用 `resume()` 也没问题）。

### 错误 4：过度使用 SeqCst

```rust
// ❌ 不必要：使用 SeqCst 而不是 Release-Acquire
fn pause(&self) {
    self.paused.store(true, Ordering::SeqCst);  // 性能开销大
}
```

**问题**：SeqCst 的性能开销比 Release-Acquire 大，除非真的需要全局顺序，否则应该避免使用。

**正确做法**：使用 Release-Acquire 配对。

### 错误 5：忽略其他共享数据

```rust
// ❌ 错误：只同步 paused，不同步其他数据
struct Worker {
    paused: AtomicBool,
    config: String,  // 普通字段，没有同步！
}

fn update_config(&self, new_config: String) {
    self.config = new_config;  // 没有同步！
    self.paused.store(false, Ordering::Release);
}
```

**问题**：

- 如果 Worker 线程在没有互斥/同步的情况下读取 `config`，而控制线程同时写入 `config`，这是数据竞争（Rust: 未定义行为 UB），问题不只是“可能读到旧值”
- 即便你试图用 `paused.store(false, Release)` 来“发布配置”，也只有在 Worker 的 `paused.load(Acquire)` **确实读到这次 store 写入的值**时才建立 happens-before
- 另外，布尔值无法区分“这次更新后的 false”和“旧的 false”（比如初始值或更早的写入），因此单靠 `paused == false` 通常不足以作为“配置已更新”的可靠信号

**正确做法**：

- 使用 `Mutex` 保护 `config`
- 或者用 `Arc`/指针交换（例如 `ArcSwap` 思路）以原子方式替换整个配置对象，并用 Release/Acquire 建立发布-获取关系
- 或者用通道/消息传递把“新配置”发送给 Worker，让配置只在 Worker 线程内被读写

---

## 常见模式与最佳实践

### 1. 标志位同步（Flag Synchronization）

```rust
// 发布者
data = compute_data();
ready.store(true, Ordering::Release);  // 发布数据

// 接收者
if ready.load(Ordering::Acquire) {
    use_data(data);  // 安全使用数据
}
```

### 2. 一次性初始化（Once Pattern）

```rust
static INIT: AtomicBool = AtomicBool::new(false);
static DATA: Mutex<Option<Data>> = Mutex::new(None);

fn init() {
    if !INIT.load(Ordering::Acquire) {
        let mut data = DATA.lock().unwrap();
        *data = Some(compute_data());
        INIT.store(true, Ordering::Release);  // 发布初始化完成
    }
}
```

### 3. 读写锁模式

```rust
// 写入者
data = new_value;
version.store(version.load() + 1, Ordering::Release);

// 读取者
let v = version.load(Ordering::Acquire);
let d = data;  // 安全读取
```

### 4. 你的代码中的模式

你的代码使用了**生产者-消费者模式**：

- **生产者**：`pause()` 和 `resume()` 方法（控制线程）
- **消费者**：Worker 主循环（工作线程）
- **同步机制**：`AtomicBool` + `Notify`

### 最佳实践总结

1. **配对使用**：Release 和 Acquire 应该配对使用
   - 写入用 Release，读取用 Acquire
   - 或者都用 AcqRel（读-改-写操作）

2. **最小化使用**：只在需要同步的地方使用强内存序
   - 简单的计数器可以用 Relaxed
   - 需要同步其他数据时用 Release-Acquire

3. **避免 SeqCst**：除非真的需要全局顺序，否则避免使用 SeqCst（性能开销大）

4. **文档说明**：在代码中注释为什么使用特定的内存序

---

## 总结

### 核心要点

1. **内存序的作用**：
   - 表达并约束跨线程的排序/同步关系（happens-before / synchronizes-with）
   - 在正确的发布-获取协议中，提供“读到发布值后”的可见性保证
   - 配合原子/锁/通道等同步原语与正确的数据结构设计，避免数据竞争（内存序本身不是“自动消除数据竞争”的魔法）

2. **Release-Acquire 模式**：
   - Release：发布某个值；若对方用 Acquire 读到这次写入，则 Release 之前的写入/副作用对对方可见
   - Acquire：获取某个值；若读到某次 Release 写入，则后续操作能看到该 Release 之前的写入/副作用
   - 配对使用，在“读到发布值”的前提下建立跨线程同步

3. **你的代码**：
   - `pause()` 和 `resume()` 使用 `Release` 发布状态变更
   - Worker 线程使用 `Acquire` 获取状态
   - 这为状态变更提供发布-获取语义；配合 `Notify` 才能让等待中的线程及时被唤醒并继续推进

### 学习路径建议

1. **理解基础概念**：
   - 为什么需要内存序
   - Happens-Before 关系
   - CPU 缓存和指令重排序

2. **掌握常用模式**：
   - Release-Acquire（最常用）
   - 读写锁模式
   - 一次性初始化

3. **实践**：
   - 阅读标准库的原子操作实现
   - 编写简单的多线程程序
   - 使用工具（如 `loom`）测试并发代码

4. **深入学习**：
   - C++ 内存模型（Rust 基于此）
   - 无锁数据结构
   - 并发算法

### 推荐资源

- **Rust 官方文档**：`std::sync::atomic`
- **书籍**：《Rust 并发编程》（如果存在）
- **在线资源**：Rustonomicon 的并发章节

---

## 附录：内存序对比表

| 内存序  | 保证              | 性能 | 常用场景               |
| ------- | ----------------- | ---- | ---------------------- |
| Relaxed | 仅原子性          | 最快 | 计数器、简单标志       |
| Release | 原子性 + 发布语义 | 快   | 写入端（配对 Acquire） |
| Acquire | 原子性 + 获取语义 | 快   | 读取端（配对 Release） |
| AcqRel  | Release + Acquire | 中等 | 读-改-写操作           |
| SeqCst  | 全局顺序一致性    | 最慢 | 需要全局顺序的场景     |
