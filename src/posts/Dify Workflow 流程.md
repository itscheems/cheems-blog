---
title: Dify Workflow 流程

date: 2025-04-10

# 背景图片
cover: ./177c9d9baee1548b.jpg

# 分类（可填多个）
# category:
#   - 计算机基础

#标签（可填多个）
# tag: 
#   - Dify

star: true

# 置顶
sticky: true

# 摘要
excerpt: <p>介绍了 Dify 工作流的架构和执行流程，涵盖了从控制层到图执行的各个层次。</p>
---

# Dify Workflow 流程

> Repository: https://github.com/langgenius/dify

## Workflow 架构

Controller → AppGenerateService → WorkFlowAppGenerator(子) → Worker(Thread) → WorkflowAppRunner → WorkflowEntry → Graph 执行 → node_instance.run(@abstractmethod)

- Controller 层: 接收客户端请求
- Service 层: 生成服务 处理任务
- Generator 层: 工作流生成器，初始化好 XxxGenerateEntity 后启动线程
- Worker 线程执行工作流: 
- Runner 层: 负责整体工作流的执行控制。创建 Entry，初始化 Graph，执行节点
- Entry 层: 是实际执行各个节点逻辑的入口点
- Graph 执行: 解析工作流 DAG 图结构，按照拓扑顺序执行节点。每个节点则需要 准备输入数据、执行节点逻辑、处理输出数据、触发下游节点

## Controller + Service (Workflow Run 入口)

- Request URL：`localhost/api/workflows/run`
- File path: `./api/controllers/console/app/workflow.py`

看到这个路径 `./api/controllers` 就很熟悉了，Controller 就是接受请求的地方。Golang 里面叫路由。Controller 则是学过 Java 的都知道的经典 MVC 三层架构: `Controller → Service → DAO`

``` python
class DraftWorkflowRunApi(Resource):
    @setup_required
    @login_required
    @account_initialization_required
    @get_app_model(mode=[AppMode.WORKFLOW])
    def post(self, app_model: App):
        """
        Run draft workflow
        """
        # The role of the current user in the ta table must be admin, owner, or editor
        if not current_user.is_editor:
            raise Forbidden()

        parser = reqparse.RequestParser()
        parser.add_argument("inputs", type=dict, required=True, nullable=False, location="json")
        parser.add_argument("files", type=list, required=False, location="json")
        args = parser.parse_args()

        response = AppGenerateService.generate(
            app_model=app_model,
            user=current_user,
            args=args,
            invoke_from=InvokeFrom.DEBUGGER,
            streaming=True,
        )
        return helper.compact_generate_response(response)

api.add_resource(DraftWorkflowRunApi, "/apps/<uuid:app_id>/workflows/draft/run")
```

然后，在 Controller 内部调用 Service: `AppGenerateService.generate()`
根据对话类型的不同，走不同分支，这里走的是 `WORKFLOW`

``` python
if app_model.mode == AppMode.COMPLETION.value:
    # ...
elif app_model.mode == AppMode.AGENT_CHAT.value or app_model.is_agent:
    # ...
elif app_model.mode == AppMode.CHAT.value:
    # ...
elif app_model.mode == AppMode.ADVANCED_CHAT.value:
    # ...
elif app_model.mode == AppMode.WORKFLOW.value:
    workflow = cls._get_workflow(app_model, invoke_from)
    return rate_limit.generate(
        WorkflowAppGenerator().generate(
            app_model=app_model,
            workflow=workflow,
            user=user,
            args=args,
            invoke_from=invoke_from,
            stream=streaming,
        ),
        request_id,
    )
```

## Generator

负责工作流的是 `WorkflowAppGenerator`，继承了 `BaseAppGenerator`
``` python
class WorkflowAppGenerator(BaseAppGenerator):
    # ...
```

`BaseAppGenerator` 里负责校验、预处理用户的输入，函数如下:
``` python
class BaseAppGenerator:
    def _prepare_user_inputs(...):
        # ...
    def _validate_input(...):
        # ...
```

来看看 `WorkflowAppGenerator().generate()`，函数负责创建了 `WorkflowAppGenerateEntity`，启动工作线程(Worker)，并初始化 Runner，最后，后置处理工作流返回结果(如写数据入数据库等)

- `WorkflowAppGenerateEntity`: 工作流执行的核心数据载体，它在整个工作流执行过程中起着关键作用
    - **任务标识与追踪**: 通过 task_id 唯一标识一次工作流执行任务；使用 trace_manager 进行执行过程的追踪和监控
    - **上下文管理**: 包含 app_config 应用配置信息；存储用户输入的 inputs 数据；管理上传的 files 文件；记录 user_id 用户身份信息
    - **执行控制**: 通过 stream 标志控制是否使用流式响应；使用 invoke_from 标记调用来源(如调试器、API等)；通过 call_depth 控制调用深度，防止无限递归
    - **数据传递**: 作为工作流执行各层之间的数据传递媒介; 从Generator传递到Worker，再到Runner，最后到Entry层

- `_generate()`: 
    - 创建 queue
    - 线程 worker 处理，调用 `_generate_worker()` 创建 Runner，并通过 queue 同步响应数据
    - `_handle_response()` 等待 worker 的处理，等待 queue 的结果（若是流式，则不阻塞输出，有数据则输出，不必等待全部返回才 return 结果）

- `_generate_worker()`: 创建 `WorkflowAppRunner`，其负责启动工作流。走完这个函数，`WorkflowAppGenerator` 的任务就完成了一半了(请求链路走完了，还差 response 处理)

`generate()` 函数有 3 个重载
``` python
def generate(
    self,
    app_model: App,
    workflow: Workflow,
    user: Union[Account, EndUser],
    args: Mapping[str, Any],
    invoke_from: InvokeFrom,
    stream: bool = True,
    call_depth: int = 0,
    workflow_thread_pool_id: Optional[str] = None,
):
    files: Sequence[Mapping[str, Any]] = args.get("files") or []

    role = CreatedByRole.ACCOUNT if isinstance(user, Account) else CreatedByRole.END_USER

    # parse files
    file_extra_config = FileUploadConfigManager.convert(workflow.features_dict, is_vision=False)
    system_files = file_factory.build_from_mappings(
        mappings=files,
        tenant_id=app_model.tenant_id,
        user_id=user.id,
        role=role,
        config=file_extra_config,
    )

    # convert to app config
    app_config = WorkflowAppConfigManager.get_app_config(
        app_model=app_model,
        workflow=workflow,
    )

    # get tracing instance
    trace_manager = TraceQueueManager(
        app_id=app_model.id,
        user_id=user.id if isinstance(user, Account) else user.session_id,
    )

    inputs: Mapping[str, Any] = args["inputs"]
    # init application generate entity
    application_generate_entity = WorkflowAppGenerateEntity(
        task_id=str(uuid.uuid4()),
        app_config=app_config,
        inputs=self._prepare_user_inputs(user_inputs=inputs, app_config=app_config, user_id=user.id, role=role),
        files=system_files,
        user_id=user.id,
        stream=stream,
        invoke_from=invoke_from,
        call_depth=call_depth,
        trace_manager=trace_manager,
    )
    contexts.tenant_id.set(application_generate_entity.app_config.tenant_id)

    return self._generate(
        app_model=app_model,
        workflow=workflow,
        user=user,
        application_generate_entity=application_generate_entity,
        invoke_from=invoke_from,
        stream=stream,
        workflow_thread_pool_id=workflow_thread_pool_id,
    )

def _generate(
    self,
    *,
    app_model: App,
    workflow: Workflow,
    user: Union[Account, EndUser],
    application_generate_entity: WorkflowAppGenerateEntity,
    invoke_from: InvokeFrom,
    stream: bool = True,
    workflow_thread_pool_id: Optional[str] = None,
) -> dict[str, Any] | Generator[str, None, None]:
    """
    Generate App response.

    :param app_model: App
    :param workflow: Workflow
    :param user: account or end user
    :param application_generate_entity: application generate entity
    :param invoke_from: invoke from source
    :param stream: is stream
    :param workflow_thread_pool_id: workflow thread pool id
    """
    # init queue manager
    queue_manager = WorkflowAppQueueManager(
        task_id=application_generate_entity.task_id,
        user_id=application_generate_entity.user_id,
        invoke_from=application_generate_entity.invoke_from,
        app_mode=app_model.mode,
    )

    # new thread
    worker_thread = threading.Thread(
        target=self._generate_worker,
        kwargs={
            "flask_app": current_app._get_current_object(),  # type: ignore
            "application_generate_entity": application_generate_entity,
            "queue_manager": queue_manager,
            "context": contextvars.copy_context(),
            "workflow_thread_pool_id": workflow_thread_pool_id,
        },
    )

    worker_thread.start()

    # return response or stream generator
    response = self._handle_response(
        application_generate_entity=application_generate_entity,
        workflow=workflow,
        queue_manager=queue_manager,
        user=user,
        stream=stream,
    )

    return WorkflowAppGenerateResponseConverter.convert(response=response, invoke_from=invoke_from)
```

``` python
def _generate_worker(
    self,
    flask_app: Flask,
    application_generate_entity: WorkflowAppGenerateEntity,
    queue_manager: AppQueueManager,
    context: contextvars.Context,
    workflow_thread_pool_id: Optional[str] = None,
) -> None:
    """
    Generate worker in a new thread.
    :param flask_app: Flask app
    :param application_generate_entity: application generate entity
    :param queue_manager: queue manager
    :param workflow_thread_pool_id: workflow thread pool id
    :return:
    """
    for var, val in context.items():
        var.set(val)
    with flask_app.app_context():
        try:
            # workflow app
            runner = WorkflowAppRunner(
                application_generate_entity=application_generate_entity,
                queue_manager=queue_manager,
                workflow_thread_pool_id=workflow_thread_pool_id,
            )

            runner.run()
    # ...
    # ...
```

## Runner(Worker)

`WorkflowAppRunner` 负责创建 `Graph`、`WorkflowEntry`，并启动 `WorkflowEntry`

``` python
def run(self) -> None:
    """
    Run application
    :param application_generate_entity: application generate entity
    :param queue_manager: application queue manager
    :return:
    """
    
    # ...
    workflow = self.get_workflow(app_model=app_record, workflow_id=app_config.workflow_id)
    # ...
    
    # init graph
    graph = self._init_graph(graph_config=workflow.graph_dict)
    
    # RUN WORKFLOW
    workflow_entry = WorkflowEntry(
        tenant_id=workflow.tenant_id,
        app_id=workflow.app_id,
        workflow_id=workflow.id,
        workflow_type=WorkflowType.value_of(workflow.type),
        graph=graph,
        graph_config=workflow.graph_dict,
        user_id=self.application_generate_entity.user_id,
        user_from=(
            UserFrom.ACCOUNT
            if self.application_generate_entity.invoke_from in {InvokeFrom.EXPLORE, InvokeFrom.DEBUGGER}
            else UserFrom.END_USER
        ),
        invoke_from=self.application_generate_entity.invoke_from,
        call_depth=self.application_generate_entity.call_depth,
        variable_pool=variable_pool,
        thread_pool_id=self.workflow_thread_pool_id,
    )

    generator = workflow_entry.run(callbacks=workflow_callbacks)
    
    for event in generator:
        self._handle_event(workflow_entry, event)
```

## Entry

`WorkflowEntry` 是工作流执行系统的核心入口点

`Workflow` 模式和 `Advanced Chat` 模式均依赖 `WorkflowEntry` 执行 `Graph`

### WorkflowEntry

1. 工作流执行的统一入口 ：
   - 作为工作流执行的最终执行层，负责实际运行工作流图
   - 通过 `run()` 方法启动工作流执行，返回一个事件生成器
2. 工作流上下文管理 ：
   - 维护工作流执行所需的完整上下文信息
   - 包含租户ID、应用ID、工作流ID等身份标识
   - 管理工作流类型、用户来源、调用来源等执行环境信息
3. 图执行引擎 ：
   - 接收已初始化的工作流图( `graph` )和图配置( `graph_config` )
   - 负责按照图结构执行各个节点
   - 处理节点间的数据流转和依赖关系
4. 变量管理 ：
   - 通过 `variable_pool` 管理工作流执行过程中的所有变量
   - 包括系统变量、用户输入、环境变量和会话变量
5. 并发控制 ：
   - 通过 `thread_pool_id` 支持工作流的并发执行
   - 管理工作流执行的线程资源
6. 事件生成 ：

   - 生成工作流执行过程中的各种事件
   - 这些事件会被 `Runner` 的 `_handle_event()` 方法处理，用于状态更新和结果返回

简而言之， WorkflowEntry 是连接工作流定义和实际执行的桥梁，它将抽象的工作流图转化为具体的执行逻辑，并管理整个执行过程。

``` python
class WorkflowEntry:

    # ...

    def run(
        self,
        *,
        callbacks: Sequence[WorkflowCallback],
    ) -> Generator[GraphEngineEvent, None, None]:
        """
        :param callbacks: workflow callbacks
        """
        graph_engine = self.graph_engine

        try:
            # run workflow
            generator = graph_engine.run()
            for event in generator:
                if callbacks:
                    for callback in callbacks:
                        callback.on_event(event=event)
                yield event
        # ...
```

## Graph

解析工作流 DAG 图结构，按照拓扑顺序执行节点。每个节点则需要 准备输入数据、执行节点逻辑、处理输出数据、触发下游节点

> 这部分源码，处理各个节点及分支的逻辑较复杂，有兴趣可以看看仓库源码
> 
> Repository: [graph_engine.py](https://github.com/langgenius/dify/blob/main/api/core/workflow/graph_engine/graph_engine.py)

具体的节点执行，在 `_run_node(...)` 中
``` python
def _run(...):
    # ...
    # run node
    generator = self._run_node(
        node_instance=node_instance,
        route_node_state=route_node_state,
        parallel_id=in_parallel_id,
        parallel_start_node_id=parallel_start_node_id,
        parent_parallel_id=parent_parallel_id,
        parent_parallel_start_node_id=parent_parallel_start_node_id,
    )
```

`_run_node()` 会真正执行 node 节点的逻辑。`node_instance.run()` 是位于 `BaseNode` 中的抽象方法，具体在遍历到具体节点时，会执行不同的实现方法
``` python
def _run_node(...):
    # ...
    generator = node_instance.run()
```

抽象方法
``` python
class BaseNode(Generic[GenericNodeData]):

    @abstractmethod
    def _run(self) -> NodeRunResult | Generator[RunEvent | InNodeEvent, None, None]:
        """
        Run node
        :return:
        """
        raise NotImplementedError

    def run(self) -> Generator[RunEvent | InNodeEvent, None, None]:
        try:
            result = self._run()
        except Exception as e:
            logger.exception(f"Node {self.node_id} failed to run: {e}")
            result = NodeRunResult(
                status=WorkflowNodeExecutionStatus.FAILED,
                error=str(e),
            )

        if isinstance(result, NodeRunResult):
            yield RunCompletedEvent(run_result=result)
        else:
            yield from result
```

Nodes 目录下有很多不同种类 Node 的实现，而他们共同的基类则在 `base_node.py` 里。可以看到这里有很多不同的节点类型，如开始节点(start)、llm 节点(llm)、工具节点(tool)、结束节点(end) 等。
```
cjj@cjj:~/dify/api/core/workflow/nodes$ tree -L 1
.
├── ai_scene
├── answer
├── base_node.py
├── code
├── document_extractor
├── end
├── event.py
├── http_request
├── if_else
├── __init__.py
├── iteration
├── knowledge_retrieval
├── list_filter
├── llm
├── loop
├── node_mapping.py
├── parameter_extractor
├── __pycache__
├── question_classifier
├── start
├── template_transform
├── tool
├── variable_aggregator
└── variable_assigner
```

就拿 llm node 为例，`_run()` 中调用了 `_invoke_llm()`、`_handle_invoke_result()` 等函数实现 llm node 的定制化功能

二开时，如需实现一些计量的功能，则可以从这里来添加统计 tokens 的逻辑
``` python
# api/core/workflow/nodes/llm/llm_node.py
class LLMNode(BaseNode):
    def _run(self) -> Generator[RunEvent | InNodeEvent, None, None]:
        # ...
        # handle invoke result
        generator = self._invoke_llm(
            node_data_model=node_data.model,
            model_instance=model_instance,
            prompt_messages=prompt_messages,
            stop=stop,
        )
```

而 tool node 则是走另一条链路，但和 llm node 也大同小异。tool node 有一个叫 `Tool` 的基类，下边管理着很多工具，同时也可以基于这个类来定义子类，从而能自定义一些工具

tool node 逻辑如下:
``` python
# api/core/workflow/nodes/tool/tool_node.py
class ToolNode(BaseNode):
    # ...
    def _run(self) -> NodeRunResult:
        # ...
        # 这是基类 Tool
        tool_runtime = ToolManager.get_workflow_tool_runtime(
            self.tenant_id, self.app_id, self.node_id, node_data, self.invoke_from
        )
        # ...
        # 调用工具节点
        messages = ToolEngine.workflow_invoke(
            tool=tool_runtime,
            tool_parameters=parameters,
            user_id=self.user_id,
            workflow_tool_callback=DifyWorkflowCallbackHandler(),
            workflow_call_depth=self.workflow_call_depth,
            thread_pool_id=self.thread_pool_id,
        )
```

`ToolEngine` 来调用 `Tool`
``` python
# api/core/tools/tool_engine.py
class ToolEngine:
    # ...
    @staticmethod
    def workflow_invoke(
        tool: Tool,
        tool_parameters: Mapping[str, Any],
        user_id: str,
        workflow_tool_callback: DifyWorkflowCallbackHandler,
        workflow_call_depth: int,
        thread_pool_id: Optional[str] = None,
    ) -> list[ToolInvokeMessage]:
        """
        Workflow invokes the tool with the given arguments.
        """
        # ...
        # 调用 Tool(基类) 的 invoke 函数
        response = tool.invoke(user_id=user_id, tool_parameters=tool_parameters)
```

`Tool` 的 `_invoke()` 也是个抽象方法
``` python
# api/core/tools/tool/tool.py
class Tool(BaseModel, ABC):
    def invoke(self, user_id: str, tool_parameters: Mapping[str, Any]) -> list[ToolInvokeMessage]:
        # ...
        tool_parameters = self._transform_tool_parameters_type(tool_parameters)

        result = self._invoke(
            user_id=user_id,
            tool_parameters=tool_parameters,
        )
        # ...
        return result
    
    @abstractmethod
    def _invoke(
        self, user_id: str, tool_parameters: dict[str, Any]
    ) -> Union[ToolInvokeMessage, list[ToolInvokeMessage]]:
        pass
```

`Tool` 的具体实现则是在 `api/core/tools/provider/builtin` 下
比如我需要实现一个文件统计工具（这部分文件夹以及 `.py` 文件都是自定义的）
```
cjj@cjj:~/dify/api/core/tools/provider/builtin$ tree .
.
├── file_statistics
│   ├── _assets
│   │   └── icon.png
│   ├── file_statistics.py
│   ├── file_statistics.yaml
│   └── tools
│       ├── extract.py
│       └── extract.yaml
├── ...
```

我在 `extract.py` 里定义了一个 `Tool` 的实现类并且实现了 `_invoke()` 方法
``` python
class FileStatisticsExtractTool(BuiltinTool):
    def _invoke(self,
        user_id: str,
        tool_parameters: dict[str, Any],
    ) -> Union[ToolInvokeMessage, list[ToolInvokeMessage]]:
        # 自定义逻辑
        result = self.xxx()
        return result
```

`BuiltinTool` 继承 `Tool`
``` python
# api/core/tools/tool/builtin_tool.py
# 新版本 dify 变更了路径: api/core/tools/builtin_tool/tool.py
class BuiltinTool(Tool):
    # ...
```

## Graph 的具体逻辑

### 初始化阶段
- 创建或获取线程池
- 设置执行参数（最大步骤数、最大执行时间等）
- 初始化变量池和运行时状态

相关源码
``` python
class GraphEngine:
    def __init__(...):
        # 如果提供了线程池ID，则获取已有线程池
        if thread_pool_id:
            # ...
        # 否则创建新的线程池
        else:
            # ...

        # 初始化图和初始化参数
        self.graph = graph
        self.init_params = GraphInitParams(
            tenant_id=tenant_id,
            app_id=app_id,
            workflow_type=workflow_type,
            workflow_id=workflow_id,
            graph_config=graph_config,
            user_id=user_id,
            user_from=user_from,
            invoke_from=invoke_from,
            call_depth=call_depth,
        )
        
        # 初始化图运行时状态，包含变量池
        self.graph_runtime_state = GraphRuntimeState(
            variable_pool=variable_pool,
            start_at=time.perf_counter()
        )
```

### 执行阶段
- 从根节点开始执行
- 按照图的连接顺序依次执行节点
- 处理条件分支和并行执行
- 收集执行结果和事件

从根节点开始执行
``` python
class GraphEngine:
    def run(self) -> Generator[GraphEngineEvent, None, None]:
        # ...
        # run graph
        generator = stream_processor.process(
            self._run(start_node_id=self.graph.root_node_id)
        )
        # ...
        
    def _run(
        self,
        start_node_id: str,
        in_parallel_id: Optional[str] = None,
        parent_parallel_id: Optional[str] = None,
        parent_parallel_start_node_id: Optional[str] = None,
    ) -> Generator[GraphEngineEvent, None, None]:
        parallel_start_node_id = None
        if in_parallel_id:
            parallel_start_node_id = start_node_id

        next_node_id = start_node_id
        previous_route_node_state: Optional[RouteNodeState] = None
```

条件分支处理
``` python
class GraphEngine:
    def _run(...):
        # ...

        # 条件分支处理
        edge_mappings = self.graph.edge_mapping.get(next_node_id)
        if not edge_mappings:
            break
        # 往下都是条件分支处理 (略)
```

并行执行
``` python
def _run(...):
    # ...
    else:
        # 多个边的情况，可能是条件分支或并行执行
        final_node_id = None

        if any(edge.run_condition for edge in edge_mappings):
            # 处理条件分支
            # ...
        else:
            # 处理并行执行
            parallel_generator = self._run_parallel_branches(
                edge_mappings=edge_mappings,
                in_parallel_id=in_parallel_id,
                parallel_start_node_id=parallel_start_node_id,
            )
```

并行执行的具体实现，见: `_run_parallel_branches()`
``` python
def _run_parallel_branches(
    self,
    edge_mappings: list[GraphEdge],
    in_parallel_id: Optional[str] = None,
    parallel_start_node_id: Optional[str] = None,
) -> Generator[GraphEngineEvent | str, None, None]:
    # ...
```

### 结果处理

- 生成执行事件
- 更新变量池
- 返回最终输出

生成执行事件
``` python
class GraphEngine:
    # ...
    def _run_node(...)
        # 在_run_node方法中生成各种事件
        yield NodeRunStartedEvent(
            id=node_instance.id,
            node_id=node_instance.node_id,
            node_type=node_instance.node_type,
            node_data=node_instance.node_data,
            route_node_state=route_node_state,
            predecessor_node_id=node_instance.previous_node_id,
            parallel_id=parallel_id,
            parallel_start_node_id=parallel_start_node_id,
            parent_parallel_id=parent_parallel_id,
            parent_parallel_start_node_id=parent_parallel_start_node_id,
        )

        # 节点执行成功事件
        yield NodeRunSucceededEvent(
            id=node_instance.id,
            node_id=node_instance.node_id,
            node_type=node_instance.node_type,
            node_data=node_instance.node_data,
            route_node_state=route_node_state,
            parallel_id=parallel_id,
            parallel_start_node_id=parallel_start_node_id,
            parent_parallel_id=parent_parallel_id,
            parent_parallel_start_node_id=parent_parallel_start_node_id,
        )

        # 在run方法中生成图执行完成事件
        yield GraphRunSucceededEvent(outputs=self.graph_runtime_state.outputs)
```

更新变量池
``` python
def _run_node(...)
    #...
    # 在_run_node方法中更新变量池
    if run_result.outputs:
        for variable_key, variable_value in run_result.outputs.items():
            # 递归添加变量到变量池
            self._append_variables_recursively(
                node_id=node_instance.node_id,
                variable_key_list=[variable_key],
                variable_value=variable_value,
            )

# _append_variables_recursively方法实现
def _append_variables_recursively(self, node_id: str, variable_key_list: list[str], variable_value: VariableValue):
    """
    递归添加变量
    """
    self.graph_runtime_state.variable_pool.add([node_id] + variable_key_list, variable_value)
    
    # 如果变量值是字典，则递归添加
    if isinstance(variable_value, dict):
        for key, value in variable_value.items():
            # 构造新的键列表
            new_key_list = variable_key_list + [key]
            self._append_variables_recursively(
                node_id=node_id, variable_key_list=new_key_list, variable_value=value
            )
```

返回最终输出
``` python
class GraphEngine:
    def run(self) -> Generator[GraphEngineEvent, None, None]:
        # 在run方法中处理END节点的输出
        if isinstance(item, NodeRunSucceededEvent):
            if item.node_type == NodeType.END:
                self.graph_runtime_state.outputs = (
                    item.route_node_state.node_run_result.outputs
                    if item.route_node_state.node_run_result
                    and item.route_node_state.node_run_result.outputs
                    else {}
                )
            elif item.node_type == NodeType.ANSWER:
                if "answer" not in self.graph_runtime_state.outputs:
                    self.graph_runtime_state.outputs["answer"] = ""

                self.graph_runtime_state.outputs["answer"] += "\n" + (
                    item.route_node_state.node_run_result.outputs.get("answer", "")
                    if item.route_node_state.node_run_result
                    and item.route_node_state.node_run_result.outputs
                    else ""
                )

                self.graph_runtime_state.outputs["answer"] = self.graph_runtime_state.outputs[
                    "answer"
                ].strip()

        # 最终返回结果
        yield GraphRunSucceededEvent(outputs=self.graph_runtime_state.outputs)
```

## TODO

- BaseAppGenerator 父子类继承关系图
- WorkflowAppRunner 继承关系


## 文件输入场景的特殊处理

如要输入一个文件，但文件不在本地（无法拖拽到工作流），而是在 s3 时，需要接受一个 s3 地址 `s3://xxx`，这时候为了通过校验，则需要修改源码

文件位置
- `./api/core/app/apps/base_app_generator.py`
- `class BaseAppGenerator`

改这两个函数即可
- `_prepare_user_inputs()`
- `_validate_input()`

``` python
def _prepare_user_inputs(
    self,
    *,
    user_inputs: Optional[Mapping[str, Any]],
    app_config: "AppConfig",
    user_id: str,
    role: "CreatedByRole",
) -> Mapping[str, Any]:
    user_inputs = user_inputs or {}
    
    # Filter input variables from form configuration, handle required fields, default values, and option values
    variables = app_config.variables
    user_inputs = {
        var.variable: self._validate_input(inputs=user_inputs, var=var) 
        for var in variables
    }
    user_inputs = {
        k: self._sanitize_value(v) 
        for k, v in user_inputs.items()
    }
    
    # Convert files in inputs to File
    entity_dictionary = {item.variable: item for item in app_config.variables}
    
    # Convert single file to File
    files_inputs = {
        k: file_factory.build_from_mapping(
            mapping=v,
            tenant_id=app_config.tenant_id,
            user_id=user_id,
            role=role,
            config=FileExtraConfig(
                allowed_file_types=entity_dictionary[k].allowed_file_types,
                allowed_extensions=entity_dictionary[k].allowed_file_extensions,
                allowed_upload_methods=entity_dictionary[k].allowed_file_upload_methods,
            ),
        )
        for k, v in user_inputs.items()
        if isinstance(v, dict) and entity_dictionary[k].type == VariableEntityType.FILE
    }
    
    # Convert list of files to File
    file_list_inputs = {
        k: file_factory.build_from_mappings(
            mappings=v,
            tenant_id=app_config.tenant_id,
            user_id=user_id,
            role=role,
            config=FileExtraConfig(
                allowed_file_types=entity_dictionary[k].allowed_file_types,
                allowed_extensions=entity_dictionary[k].allowed_file_extensions,
                allowed_upload_methods=entity_dictionary[k].allowed_file_upload_methods,
            ),
        )
        for k, v in user_inputs.items()
        if isinstance(v, list)
        # Ensure skip List<File>
        and all(isinstance(item, dict) for item in v)
        and entity_dictionary[k].type == VariableEntityType.FILE_LIST
    }

    """
    上面的部分全是源码，贴在这里方便查看逻辑实现
    在这里了我们可以写一个将 s3 地址字符串转化为 files_inputs 或 file_list_inputs 的函数
    
    如: files_inputs = self._handle_s3_input(xxx)
    
    注意: _handle_s3_input() 函数要返回 dict[str, File] 或 dict[str, Sequence[File]] 类型
    所以 file 还是需要自己构造
    
    类似这样:
        file_instance = File(
            filename=filename,
            type=FileType.from_extension(extension),
            tenant_id=app_config.tenant_id,
            transfer_method=FileTransferMethod.REMOTE_URL,
            remote_url=s3_path,
            extension=extension,
            _extra_config=extra_config,
            size=size,
        )
    """

    # Merge all inputs
    user_inputs = {**user_inputs, **files_inputs, **file_list_inputs}
    return user_inputs
```

还要修改一下校验逻辑

``` python
def _validate_input(
    self,
    *,
    inputs: Mapping[str, Any],
    var: "VariableEntity"
):

    # 前面的代码省略...

    elif var.type == VariableEntityType.FILE:
        if not isinstance(user_input_value, dict) and not isinstance(user_input_value, File):
            # 自己加的
            if not isinstance(user_input_value, str) or "s3://" not in user_input_value:
                raise ValueError(f"{var.variable} in input form must be a file or S3 URL")
    elif var.type == VariableEntityType.FILE_LIST:
        if not (
            isinstance(user_input_value, list)
            and (
                all(isinstance(item, dict) for item in user_input_value)
                or all(isinstance(item, File) for item in user_input_value)
            )
        ):
            # 自己加的
            if not isinstance(user_input_value, str) or "s3://" not in user_input_value:
                raise ValueError(f"{var.variable} in input form must be a list of files or S3 URL")

return user_input_value
```
