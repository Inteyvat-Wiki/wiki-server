# Inteyvat-Wiki server

[Inteyvat-Wiki](https://github.com/Inteyvat-Wiki/wiki) 的服务端子模块，由 Inteyvat-Wiki 组织维护。

## 数据根目录

父 Wiki 的私有 Nuxt runtimeConfig 提供 `wikiDataProjectRoot`。`utils/data_root.ts` 在运行时解析 `WIKI_DATA_ROOT`：绝对路径直接使用，相对路径基于该项目目录，空值默认 `data`。不使用 `import.meta.url` 推导 JSON 位置，因为 Nitro 编译后它可能指向 `.output/server/index.mjs`。

`utils/read.ts` 与只读的 `routes/images/[...path].ts` 共用该根目录；后者只提供 `images/` 内的图片，支持 GET/HEAD 与条件缓存，拒绝路径越界及逃逸符号链接。图片不经构建复制。父仓库的 `scripts/check_data_root.mjs` 提供独立及编译产物回归。

## 完整数据集上传

`GET /api/admin/data` 和 `POST /api/admin/data` 是仅供受信任发布工具使用的管理接口。设置服务端环境变量 `WIKI_UPLOAD_TOKEN` 为由随机 32 字节生成的 64 位小写十六进制密钥；未设置、空值或格式不合法均返回 503。客户端仅通过 `Authorization: Bearer <token>` 提交，服务端对固定长度 SHA-256 摘要作恒定时间比较。认证先于任何请求体读取，不接受查询字符串或 Cookie，拒绝任何 `Origin`，不启用 CORS，不记录密钥、请求头或上传内容。密钥保存在环境/密钥管理服务中，不进入 Nuxt public 配置、URL、仓库或命令行参数。

GET 返回共享契约 `UploadStatus`（schema、当前 releaseId 或 null、limits）。POST 必须有 `x-wiki-base-release`，取先前 GET 的 releaseId 或 `none`：缺失 428，当前版本不匹配或其他进程持锁 409。发布工具应重新 GET 后由操作人决定是否重试，不能自动覆盖冲突。POST 返回 `UploadResult`（schema、releaseId、fileCount、totalBytes）；不返回服务端路径。

只支持 `application/vnd.inteyvat-wiki.data-bundle` 和未压缩/identity 编码，不解压归档。线格式为 UTF-8 `INTEYVAT-WIKI-DATA/1\n`、4 字节大端 manifest 长度、原始 UTF-8 JSON manifest、按 manifest 顺序的精确文件字节、32 字节原始 SHA-256(manifest 字节) 完成尾标，随后必须 EOF。releaseId 是该摘要的小写十六进制。Content-Length 如有必须等于所有字段总长度；无论是否提供它，都在流式读取时检查总量、每文件长度、哈希和 EOF。尾标表明客户端已完成最终源文件检查；缺失尾标不能发布。

共享 manifest 校验限定完整快照、ASCII 排序安全路径、大小及哈希，拒绝大小写重复和文件/目录冲突。仅允许 `common/**/*.json`、`en/**/*.json`、`zh_hans/**/*.json`、`images/**/*.png`。完整性包含菜单、地图索引、地图任务依赖、全部栏目 ID 与双语页面索引、双语地图 catalogue/scenes。服务端逐文件严格 UTF-8/JSON 解析、校验页面关系及双语成员、索引对应条目、地图契约和本地图片引用。内容条目复用已有共享信任边界，不承诺所有嵌套剧情/技能字段的深层语义校验。PNG 只进行签名、IHDR 字段/CRC、尺寸合法性和 IEND 检查，不解码像素或完整校验压缩图像；不猜测较低的地图像素上限。

### 存储与原子切换

`WIKI_DATA_ROOT` 是原有数据的基准目录。发布管理目录固定为其同级 `${WIKI_DATA_ROOT}.publish`，内有 `staging/`、`releases/<releaseId>/`、`current.json` 和短期 `upload.lock`；不进入导出器输入目录或图片 webroot。配置根目录及管理目录的已有路径组件不得是符号链接/junction。首次部署允许基准目录不存在，但它的父目录必须已存在且安全；无需复制或创建空数据目录。

认证后先取得排他创建的跨进程锁，再检查预期版本、解析验证上传。每个文件持久化后，新建目录按自底向上顺序同步，完整 staging 原子重命名为不可变 release，最后复查当前版本并原子替换指针。POSIX 还同步管理目录父项和重命名涉及的目录；Windows 的 Node API 不支持目录 fsync，保留原子可见性但不承诺同等断电持久性。磁盘/连接故障发生在指针提交之后时，客户端可能未收到成功响应，需 GET 核实；不得据响应丢失就假定回滚。

第一次发布前读原数据目录，发布后所有 JSON 与图片读指针选定的 release；原数据不被移动、替换或删除，之后直接修改原目录不会激活，需再次发布。Nitro 请求包装器通过 AsyncLocalStorage 固定整次响应的根目录，避免多次异步读取混用版本。旧 release 永远保留，不自动清理；同 manifest 重发会校验并复用已有 release，绝不覆盖它。失败仅清理本次拥有的 staging/指针临时文件；已完成 release 即使尚未激活也保留。

管理目录应仅允许服务账号写入，其他用户不得编辑 release、锁或指针。服务崩溃可能留下锁或 staging；不会按时间擅自抢锁。恢复时先停止所有使用同一目录的服务进程，确认没有发布者，再由操作人处理残留；不要删除旧 release 或手动编辑指针来处理普通 409。锁依赖本地/共享文件系统的排他创建与原子 rename 语义，不适用于缺少这些语义的对象存储。

### 资源上限与反向代理

环境变量只允许降低硬上限，必须是正十进制安全整数；非法配置返回 503。

| 环境变量 | 默认/硬上限 |
| --- | --- |
| `WIKI_UPLOAD_MAX_FILES` | 250000 |
| `WIKI_UPLOAD_MAX_FILE_BYTES` | 256 MiB |
| `WIKI_UPLOAD_MAX_BYTES` | 20 GiB 文件总字节 |
| `WIKI_UPLOAD_MAX_MANIFEST_BYTES` | 64 MiB |
| `WIKI_UPLOAD_TIMEOUT_MS` | 1800000（30 分钟，总上传及验证时间） |
| `WIKI_UPLOAD_IDLE_TIMEOUT_MS` | 60000（60 秒） |

文件内容流式落盘、哈希，图片仅保留小头尾；JSON 最多单文件 256 MiB 加解析对象，不能据总量 20 GiB 配置过小堆内存或磁盘。预留 staging、一份新 release 与全部保留 release 的磁盘容量。

生产环境必须由受信任反向代理终止 TLS，服务监听回环或受限内部网络；客户端对非回环地址只使用 HTTPS 并校验证书。服务端不根据 `X-Forwarded-*` 自行认可外部 HTTPS，也不放开 CORS。禁止代理访问日志记录 Authorization/请求体。对管理路由配置网络访问控制及请求速率限制。

代理的请求体上限须覆盖 `maxTotalBytes + maxManifestBytes + magic长度 + 4 + 32`，例如默认上限下可设为 21 GiB；关闭该路由的请求缓冲以保留背压/早拒绝，或为代理临时盘另留足量空间。空闲超时至少 60 秒，整请求/上游响应等待至少 30 分钟并计入验证耗时。

Node 默认整请求截止为 300 秒，与 `req.setTimeout` 的空闲超时独立。默认不会修改它，因此超过五分钟的巨型上传需要部署配置：优先在自有 Node 启动适配器上配置足够的 `server.requestTimeout`；标准 Nitro Node 入口也可显式设置 `WIKI_UPLOAD_EXTEND_NODE_TIMEOUT=1`（默认关闭，仅接受 `0`/`1`）。启用后，第一次认证上传开始时会把非零且较短的 Node `requestTimeout` 提升到上传总超时，不改变更长/禁用值或 headersTimeout。注意这是整个监听器的持久设置，会同时放宽其他路由的整请求截止，故必须配合受限后端网络、反向代理各路由的请求速率/大小/超时控制，不能将该监听器直接开放到互联网。每次管理上传仍有独立的总超时与空闲超时。其他适配器必须配置自己的截止时间，不能只修改代理超时。

父 Wiki 运行 `node scripts/check_upload_http.mjs`：真实 H3 HTTP、仅临时合成数据，覆盖认证前不读 body、首次空部署、完整上传、并发跨进程锁、指针冲突、帧/尾标/EOF、路径/大小/哈希/JSON/PNG、断连/超时清理、旧版本保留、整响应版本固定及 symlink 拒绝，并注入持久化与指针失败验证提交前不激活。Windows 下 POSIX 目录同步调用以测试替身验证顺序，不声称测试了 Windows 目录 fsync。此脚本不做生产部署或远程上传。

## 许可与署名

项目代码采用 [MIT 许可](LICENSE)，贡献者记录见 Git 历史。与主仓库一同分发时仍应保留本仓库的许可证及 [NOTICES.md](NOTICES.md)。游戏文本、图片及上传数据的权利不由服务器代码的许可证授予；本项目为非官方社区项目。
