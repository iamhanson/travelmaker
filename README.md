# 智能旅行路线规划应用

基于React和高德地图API的智能旅行路线规划应用，支持多方案管理、实时路径规划、批量地点添加等功能。

## 🌟 功能特性

### 核心功能
- **智能道路吸附** - 自动将点击位置转换为最近道路点，确保路径规划准确
- **多种导航模式** - 支持驾车🚗、步行🚶、骑行🚴三种路径规划模式
- **实时路径规划** - 点击或拖拽即时更新路线，支持API队列管理避免频率限制
- **多方案管理** - 创建、切换、复制、删除多个旅行方案
- **批量规划** - 一次性添加多个地点，自动按顺序规划最优路径
- **数据持久化** - 自动保存到localStorage，支持数据迁移

### 交互特性
- **拖拽优化** - 支持标记点拖拽调整，实时重新规划路径
- **智能视窗** - 自动调整地图视窗以最佳角度显示路线
- **路线高亮** - 选中路线高亮显示，其他路线半透明
- **搜索功能** - 全国范围地点搜索，支持POI和地址搜索
- **响应式设计** - 适配不同屏幕尺寸，悬浮控制面板设计

## 🏗️ 技术架构

### 数据结构设计

```mermaid
classDiagram
    class TrackPoint {
        +number lng
        +number lat
        +string name
    }
    
    class TrackRoute {
        +string id
        +string name
        +TrackPoint[] points
        +string color
        +any polyline
        +any[] markers
        +string routeType
    }
    
    class TravelPlan {
        +string id
        +string name
        +TrackRoute[] routes
        +Date createdAt
        +Date updatedAt
    }
    
    class AppState {
        +TravelPlan[] travelPlans
        +string currentPlanId
        +TrackRoute[] routes
        +TrackRoute currentRoute
        +boolean isDrawing
        +boolean batchMode
        +string selectedRouteId
        +TrackPoint[] selectedLocations
    }
    
    TravelPlan --> TrackRoute
    TrackRoute --> TrackPoint
    AppState --> TravelPlan
    AppState --> TrackRoute
```

### 系统架构特点

#### 性能优化
- **API请求队列** - 限制并发请求(500ms/次)，避免频率限制
- **智能缓存** - 地图对象复用，减少重复创建
- **异步处理** - 路径规划和UI更新分离

#### 用户体验
- **实时反馈** - 拖拽、点击即时响应
- **进度提示** - 长时间操作显示进度条
- **智能默认** - 自动选择合适的视窗和缩放级别

#### 数据管理
- **状态分离** - 地图状态与业务数据分离
- **版本兼容** - 支持旧版本数据自动迁移
- **容错处理** - API失败时使用直线连接作为备选方案

## 📊 核心流程图

### 应用主流程

```mermaid
graph TD
    A["用户进入应用"] --> B["地图初始化"]
    B --> C["加载保存的方案数据"]
    C --> D["显示第一个方案的路线"]
    D --> E["用户操作选择"]
    
    E --> F["开始规划模式"]
    E --> G["批量规划模式"]
    E --> H["方案管理"]
    E --> I["路线管理"]
    
    F --> F1["点击地图添加点"]
    F --> F2["搜索地点添加"]
    F1 --> F3["坐标转道路点"]
    F2 --> F3
    F3 --> F4["实时路径规划"]
    F4 --> F5["地图显示更新"]
    F5 --> F6["完成绘制保存"]
    
    G --> G1["搜索添加多个地点"]
    G1 --> G2["调整地点顺序"]
    G2 --> G3["批量创建路线"]
    G3 --> G4["自动路径规划"]
    G4 --> G5["保存到当前方案"]
    
    H --> H1["创建新方案"]
    H --> H2["切换方案"]
    H --> H3["复制方案"]
    H --> H4["删除方案"]
    H1 --> H5["自动保存到localStorage"]
    H2 --> H5
    H3 --> H5
    H4 --> H5
    
    I --> I1["选择路线查看详情"]
    I --> I2["编辑路线名称"]
    I --> I3["删除路线点"]
    I --> I4["拖拽调整点位"]
    I --> I5["删除整条路线"]
    I1 --> I6["高亮显示选中路线"]
    I3 --> I7["重新规划路径"]
    I4 --> I7
    I7 --> I8["更新地图显示"]
    
    F6 --> J["数据持久化"]
    G5 --> J
    H5 --> J
    I8 --> J
    J --> K["自动保存完成"]
```

### 路线绘制流程

```mermaid
flowchart TD
    A["点击开始规划"] --> B["进入绘制模式"]
    B --> C["设置当前路线属性<br/>颜色、类型、名称"]
    C --> D["等待用户操作"]
    
    D --> E["点击地图"]
    D --> F["搜索地点"]
    
    E --> G["获取点击坐标"]
    F --> H["选择搜索结果"]
    H --> G
    
    G --> I["调用convertToRoadPoint"]
    I --> J["逆地理编码获取道路信息"]
    J --> K["返回最近道路点坐标"]
    K --> L["添加到当前路线"]
    L --> M["调用updateRouteOnMap"]
    
    M --> N["清理旧的地图元素"]
    N --> O["创建新的标记点"]
    O --> P["路线点数 >= 2?"]
    
    P -->|是| Q["调用路径规划API"]
    P -->|否| R["只显示标记点"]
    
    Q --> S["加入规划队列"]
    S --> T["限频处理 500ms/次"]
    T --> U["获取路径坐标"]
    U --> V["绘制路径线"]
    V --> W["更新地图显示"]
    
    R --> W
    W --> X["返回绘制模式等待下一个点"]
    X --> D
    
    D --> Y["点击完成绘制"]
    Y --> Z["保存路线到方案"]
    Z --> AA["退出绘制模式"]
```

### API请求队列管理

```mermaid
flowchart TD
    A["路径规划请求"] --> B["创建规划任务"]
    B --> C["addRoutePlanningTask"]
    C --> D["添加到队列数组"]
    D --> E["触发processQueue"]
    
    E --> F["检查是否正在处理"]
    F -->|是| G["等待当前处理完成"]
    F -->|否| H["开始处理队列"]
    
    H --> I["设置处理状态为true"]
    I --> J["显示规划进度"]
    J --> K["队列是否为空?"]
    
    K -->|是| L["处理完成"]
    K -->|否| M["取出第一个任务"]
    
    M --> N["更新进度显示"]
    N --> O["执行路径规划API"]
    O --> P["等待500ms<br/>限制频率"]
    P --> Q["任务完成"]
    Q --> K
    
    L --> R["重置处理状态"]
    R --> S["清除进度显示"]
    
    O --> T["API调用失败?"]
    T -->|是| U["使用直线连接<br/>作为备选方案"]
    T -->|否| V["使用API返回路径"]
    U --> Q
    V --> Q
```

### 数据持久化流程

```mermaid
flowchart TD
    A["应用启动"] --> B["loadPlansFromStorage"]
    B --> C["从localStorage读取数据"]
    C --> D["数据存在?"]
    
    D -->|否| E["migrateOldRoutesToPlan"]
    E --> F["检查旧版本路线数据"]
    F --> G["旧数据存在?"]
    G -->|是| H["迁移到新格式"]
    G -->|否| I["创建默认方案"]
    H --> I
    
    D -->|是| J["解析JSON数据"]
    J --> K["重建对象结构"]
    K --> L["设置到应用状态"]
    
    I --> L
    L --> M["监听数据变化"]
    
    M --> N["routes变化触发"]
    N --> O["更新当前方案的routes"]
    O --> P["设置updatedAt时间"]
    P --> Q["savePlansToStorage"]
    
    Q --> R["序列化方案数据"]
    R --> S["过滤地图对象<br/>只保存纯数据"]
    S --> T["保存到localStorage"]
    T --> U["保存完成"]
    
    U --> V["继续监听变化"]
    V --> N
```

### 路线高亮与视窗调整

```mermaid
flowchart TD
    A["用户点击路线标题"] --> B["toggleRouteExpansion"]
    B --> C["当前路线已展开?"]
    
    C -->|是| D["折叠路线"]
    C -->|否| E["展开路线"]
    
    D --> F["setExpandedRouteId(null)"]
    F --> G["setCurrentDetailRoute(null)"]
    G --> H["resetRouteOpacity"]
    H --> I["所有路线恢复透明度0.8"]
    I --> J["所有标记点恢复透明度1"]
    
    E --> K["setExpandedRouteId(routeId)"]
    K --> L["setCurrentDetailRoute(route)"]
    L --> M["highlightSelectedRoute"]
    
    M --> N["遍历所有路线"]
    N --> O["当前路线?"]
    O -->|是| P["设置透明度0.9<br/>标记点透明度1"]
    O -->|否| Q["设置透明度0.3<br/>标记点透明度0.4"]
    
    P --> R["视窗调整"]
    Q --> R
    J --> S["完成操作"]
    
    R --> T["fitRouteToView"]
    T --> U["路线点数 = 1?"]
    U -->|是| V["设置中心点和缩放级别8"]
    U -->|否| W["使用setFitView自动调整"]
    W --> X["计算边界点"]
    X --> Y["设置150px边距"]
    Y --> Z["自动调整视窗"]
    
    V --> S
    Z --> S
```

## 🔧 关键算法

### 道路吸附算法
```typescript
// 使用逆地理编码将任意坐标转换为最近道路点
const convertToRoadPoint = async (lng: number, lat: number): Promise<TrackPoint> => {
  // 1. 创建逆地理编码器
  // 2. 获取最近道路信息
  // 3. 优先使用道路点，其次POI点，最后地址信息
  // 4. 返回优化后的坐标
}
```

### 视窗自适应算法
```typescript
// 智能调整地图视窗以最佳显示路线
const fitRouteToView = (route: TrackRoute) => {
  if (route.points.length === 1) {
    // 单点：设置中心点和固定缩放
    map.setZoomAndCenter(8, [point.lng, point.lat]);
  } else {
    // 多点：计算边界并自动调整
    map.setFitView(bounds, false, [150, 150, 150, 150]);
  }
}
```

### 队列控制算法
```typescript
// API请求频率控制，避免超出限制
const processRoutePlanningQueue = async () => {
  while (queue.length > 0) {
    const task = queue.shift();
    await task();
    await new Promise(resolve => setTimeout(resolve, 500)); // 限频500ms
  }
}
```

## 🚀 快速开始

### 环境要求
- Node.js 16+
- npm 或 yarn

### 安装依赖
```bash
npm install
# 或
yarn install
```

### 配置高德地图API
1. 在[高德地图开放平台](https://lbs.amap.com/)申请API Key
2. 编辑 `src/config/mapConfig.ts` 文件
3. 将 `apiKey` 替换为你的实际API Key

```typescript
export const MAP_CONFIG = {
  apiKey: '你的高德地图API Key',
  version: '2.0',
  defaultCenter: [116.397428, 39.90923],
  defaultZoom: 10,
  mapStyle: 'amap://styles/light'
};
```

### 启动开发服务器
```bash
npm start
# 或
yarn start
```

应用将在 `http://localhost:3000` 启动。

### 构建生产版本
```bash
npm run build
# 或
yarn build
```

## 📖 使用指南

### 基本操作
1. **创建路线** - 点击"开始规划"进入绘制模式
2. **添加地点** - 点击地图或使用搜索功能添加轨迹点
3. **调整路线** - 拖拽标记点实时调整路径
4. **批量规划** - 使用"批量规划"一次性添加多个地点
5. **方案管理** - 创建多个方案，随时切换和比较

### 高级功能
- **路线详情** - 点击路线标题查看详细信息和时间线
- **点位管理** - 在详情面板中删除、重排序路线点
- **视觉效果** - 选中路线高亮，支持自定义颜色
- **数据导出** - 所有数据自动保存到浏览器本地存储

## 🛠️ 技术栈

- **前端框架**: React 18 + TypeScript
- **地图服务**: 高德地图 JavaScript API 2.0
- **样式**: Less + CSS3
- **状态管理**: React Hooks
- **数据持久化**: localStorage
- **构建工具**: Create React App

## 📁 项目结构

```
src/
├── components/          # 可复用组件
├── config/             # 配置文件
│   └── mapConfig.ts    # 地图API配置
├── pages/              # 页面组件
│   └── MapTracker/     # 主要功能组件
│       ├── index.tsx   # 主组件
│       └── index.less  # 样式文件
└── ...
```

## 🔄 版本历史

### v2.0.0
- ✨ 新增多方案管理功能
- ✨ 新增批量规划模式
- ✨ 新增API请求队列管理
- 🎨 优化界面设计，采用悬浮控制面板
- 🐛 修复API频率限制问题
- 🐛 修复标记点清理问题

### v1.0.0
- ✨ 基础路线绘制功能
- ✨ 拖拽调整路径
- ✨ 智能道路吸附
- ✨ 数据持久化

## 🤝 贡献指南

欢迎提交Issue和Pull Request来改进这个项目！

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- 创建 [Issue](../../issues)
- 发送邮件到 [your-email@example.com]

---

⭐ 如果这个项目对你有帮助，请给它一个星标！
