// 高德地图配置
export const MAP_CONFIG = {
  // 请在高德地图开放平台 (https://lbs.amap.com/) 申请API Key
  // 申请步骤：
  // 1. 注册高德地图开发者账号
  // 2. 创建应用
  // 3. 获取Web服务API Key
  // 4. 将下面的 'YOUR_AMAP_KEY' 替换为你的实际API Key
  apiKey: '12c8ea0a7ab630d81fb75492d73a707e',
  
  // 地图版本
  version: '2.0',
  
  // 默认中心点（北京天安门）
  defaultCenter: [116.397428, 39.90923],
  
  // 默认缩放级别
  defaultZoom: 10,
  
  // 地图样式 - 淡雅风格
  mapStyle: 'amap://styles/light'
};

// 如果你有自己的API Key，可以在这里直接替换
// export const MAP_CONFIG = {
//   apiKey: '你的高德地图API Key',
//   version: '2.0',
//   defaultCenter: [116.397428, 39.90923],
//   defaultZoom: 10,
//   mapStyle: 'amap://styles/normal'
// }; 