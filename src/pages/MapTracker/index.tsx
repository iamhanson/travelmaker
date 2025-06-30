import React, { useEffect, useRef, useState } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';
import { MAP_CONFIG } from '../../config/mapConfig';
import './index.less';

interface TrackPoint {
  lng: number;
  lat: number;
  name?: string;
}

interface TrackRoute {
  id: string;
  name: string;
  points: TrackPoint[];
  color: string;
  polyline?: any;
  markers?: any[];
  routeType?: 'driving' | 'walking' | 'riding';
}

interface TravelPlan {
  id: string;
  name: string;
  routes: TrackRoute[];
  createdAt: Date;
  updatedAt: Date;
}

  const MapTracker: React.FC = () => {
    const mapContainer = useRef<HTMLDivElement>(null);
      const mapRef = useRef<any>(null);
  const AMapRef = useRef<any>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isDrawingRef = useRef(false);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const routePlanningQueueRef = useRef<Array<() => Promise<any>>>([]);
  const isProcessingQueueRef = useRef(false);
  // 路径规划缓存 - 存储已规划的路径段
  const routePlanningCacheRef = useRef<Map<string, number[][]>>(new Map());
    const [map, setMap] = useState<any>(null);
    const [AMap, setAMapInstance] = useState<any>(null);
    const [locationInput, setLocationInput] = useState('');
    const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
  const [travelPlans, setTravelPlans] = useState<TravelPlan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string>('');
  const [routes, setRoutes] = useState<TrackRoute[]>([]);
  const [currentRoute, setCurrentRoute] = useState<TrackRoute>({
    id: Date.now().toString(),
    name: '新路线',
    points: [],
    color: '#e74c3c',
    markers: []
  });
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#e74c3c');
  const [routeType, setRouteType] = useState<'driving' | 'walking' | 'riding'>('driving');
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedLocations, setSelectedLocations] = useState<any[]>([]);
  const [showBatchPanel, setShowBatchPanel] = useState(false);
  const [currentDetailRoute, setCurrentDetailRoute] = useState<TrackRoute | null>(null);
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);
  const [editingRouteName, setEditingRouteName] = useState<string | null>(null);
  const [tempRouteName, setTempRouteName] = useState<string>('');
  const [editingPlanName, setEditingPlanName] = useState<string | null>(null);
  const [tempPlanName, setTempPlanName] = useState<string>('');
  const [isRoutePlanning, setIsRoutePlanning] = useState(false);
  const [planningProgress, setPlanningProgress] = useState<string>('');
  // 路线详情中的搜索状态
  const [routeDetailSearchInput, setRouteDetailSearchInput] = useState<string>('');
  const [routeDetailSuggestions, setRouteDetailSuggestions] = useState<any[]>([]);
  const [isRouteDetailSearching, setIsRouteDetailSearching] = useState(false);
  const [showRouteDetailSearch, setShowRouteDetailSearch] = useState<string | null>(null); // 存储正在添加位置的路线ID

  // 预设颜色选项 - 更柔和的饱和度
  const colorOptions = [
    '#e74c3c', // 温和的红色
    '#27ae60', // 温和的绿色
    '#3498db', // 温和的蓝色
    '#f39c12', // 温和的橙色
    '#9b59b6', // 温和的紫色
    '#1abc9c', // 青绿色
    '#e67e22', // 深橙色
    '#34495e', // 深蓝灰色
    '#95a5a6', // 灰色
    '#2c3e50', // 深色
    '#16a085', // 深青色
    '#8e44ad'  // 深紫色
  ];

  // localStorage 工具函数 - 方案管理
  const savePlansToStorage = (plansToSave: TravelPlan[]) => {
    try {
      const plansData = plansToSave.map(plan => ({
        id: plan.id,
        name: plan.name,
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
        routes: plan.routes.map(route => ({
          id: route.id,
          name: route.name,
          points: route.points,
          color: route.color,
          routeType: route.routeType
        }))
      }));
      localStorage.setItem('mapTracker_plans', JSON.stringify(plansData));
      console.log('方案已保存到localStorage:', plansData.length, '个方案');
    } catch (error) {
      console.error('保存方案到localStorage失败:', error);
    }
  };

  const loadPlansFromStorage = (): TravelPlan[] => {
    try {
      const stored = localStorage.getItem('mapTracker_plans');
      if (stored) {
        const plansData = JSON.parse(stored);
        const loadedPlans = plansData.map((data: any) => ({
          ...data,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
          routes: data.routes.map((route: any) => ({
            ...route,
            markers: [], // 重新初始化markers
            polyline: null // 重新初始化polyline
          }))
        }));
        console.log('从localStorage加载方案:', loadedPlans.length, '个方案');
        return loadedPlans;
      }
    } catch (error) {
      console.error('从localStorage加载方案失败:', error);
    }
    return [];
  };

  const migrateOldRoutesToPlan = (): TravelPlan | null => {
    try {
      const oldRoutes = localStorage.getItem('mapTracker_routes');
      if (oldRoutes) {
        const routesData = JSON.parse(oldRoutes);
        const loadedRoutes = routesData.map((data: any) => ({
          ...data,
          markers: [],
          polyline: null
        }));
        
        if (loadedRoutes.length > 0) {
          const firstPlan: TravelPlan = {
            id: 'plan_1',
            name: '方案一',
            routes: loadedRoutes,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          // 清除旧的路线数据
          localStorage.removeItem('mapTracker_routes');
          console.log('已迁移旧路线数据到第一个方案');
          return firstPlan;
        }
      }
    } catch (error) {
      console.error('迁移旧路线数据失败:', error);
    }
    return null;
  };

  const clearPlansStorage = () => {
    try {
      localStorage.removeItem('mapTracker_plans');
      localStorage.removeItem('mapTracker_routes'); // 同时清除旧数据
      console.log('已清除localStorage中的方案数据');
    } catch (error) {
      console.error('清除localStorage失败:', error);
    }
  };

  useEffect(() => {
    initMap();
    
    // 初始化方案数据
    let loadedPlans = loadPlansFromStorage();
    
    // 如果没有方案数据，尝试迁移旧的路线数据
    if (loadedPlans.length === 0) {
      const migratedPlan = migrateOldRoutesToPlan();
      if (migratedPlan) {
        loadedPlans = [migratedPlan];
      }
    }
    
    // 如果还是没有数据，创建一个默认方案
    if (loadedPlans.length === 0) {
      const defaultPlan: TravelPlan = {
        id: 'plan_1',
        name: '方案一',
        routes: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      loadedPlans = [defaultPlan];
    }
    
    setTravelPlans(loadedPlans);
    setCurrentPlanId(loadedPlans[0].id);
    setRoutes(loadedPlans[0].routes);
  }, []);

  // 监听路线变化，自动保存到localStorage
  useEffect(() => {
    if (routes.length >= 0 && currentPlanId && travelPlans.length > 0) {
      // 更新当前方案的路线
      const updatedPlans = travelPlans.map(plan => {
        if (plan.id === currentPlanId) {
          return {
            ...plan,
            routes: routes,
            updatedAt: new Date()
          };
        }
        return plan;
      });
      
      setTravelPlans(updatedPlans);
      savePlansToStorage(updatedPlans);
    }
  }, [routes, currentPlanId]);

  // 当路线列表变化时的处理逻辑
  useEffect(() => {
    if (routes.length === 0) {
      setCurrentDetailRoute(null);
    } else if (currentDetailRoute && !routes.find(r => r.id === currentDetailRoute.id)) {
      // 如果当前选中的路线被删除了，取消选中状态
      setCurrentDetailRoute(null);
      resetRouteOpacity(); // 重置所有路线透明度
      
      // 调整视窗显示第一个可用路线
      setTimeout(() => {
        if (routes.length > 0 && routes[0].points.length > 0) {
          console.log('选中路线被删除，自动调整视窗显示第一个路线:', routes[0].name);
          fitRouteToView(routes[0]);
        }
      }, 300);
    }
    // 移除自动选中第一个路线的逻辑，改为默认不选中
  }, [routes, currentDetailRoute]);

  // 地图加载完成后，重新绘制保存的路线
  useEffect(() => {
    if (map && AMap && routes.length > 0) {
      console.log('地图或路线变化，绘制路线:', routes.length, '条');
      routes.forEach(route => {
        if (route.points.length >= 2) {
          updateRouteOnMap(route);
        }
      });
      
      // 自动调整视窗逻辑
      setTimeout(() => {
        if (currentDetailRoute && currentDetailRoute.points.length > 0) {
          // 如果有选中的路线，显示选中的路线
          fitRouteToView(currentDetailRoute);
        } else if (routes.length > 0 && routes[0].points.length > 0) {
          // 如果没有选中路线但有路线存在，显示第一个路线
          console.log('没有选中路线，自动调整视窗显示第一个路线:', routes[0].name);
          fitRouteToView(routes[0]);
        }
      }, 500); // 延迟执行，确保路线绘制完成
    }
  }, [map, AMap, routes]); // 正确依赖routes，避免使用过期的routes值

  // 移除重复的useEffect，避免重复调用updateRouteOnMap
  // 新路线的绘制应该在具体的操作函数中处理（如stopDrawing、createBatchRoute等）

  // 监听当前详情路线变化，自动调整视窗（仅在选中路线时）
  useEffect(() => {
    if (map && currentDetailRoute && currentDetailRoute.points.length > 0) {
      setTimeout(() => {
        fitRouteToView(currentDetailRoute);
      }, 300); // 短暂延迟确保界面更新完成
    }
  }, [currentDetailRoute, map]);

  // 确保在没有选中路线时也能看到路线
  useEffect(() => {
    if (map && routes.length > 0 && !currentDetailRoute) {
      // 如果有路线但没有选中任何路线，显示第一个路线
      setTimeout(() => {
        if (routes[0].points.length > 0) {
          console.log('确保路线可见，调整视窗显示第一个路线:', routes[0].name);
          fitRouteToView(routes[0]);
        }
      }, 300);
    }
  }, [map, routes, currentDetailRoute]);

  // 自动调整地图视窗以适应路线
  const fitRouteToView = (route: TrackRoute) => {
    const currentMap = mapRef.current;
    const currentAMap = AMapRef.current;
    
    if (!currentMap || !currentAMap || !route.points || route.points.length === 0) {
      console.log('fitRouteToView: 条件不满足');
      return;
    }

    console.log('自动调整地图视窗，路线:', route.name, '点数:', route.points.length);

         try {
       if (route.points.length === 1) {
         // 单点路线，直接设置中心点和合适的缩放级别
         const point = route.points[0];
         currentMap.setZoomAndCenter(8, [point.lng, point.lat]);
         console.log('单点路线，设置中心点:', point);
       } else {
         // 多点路线，使用setFitView自动调整视窗
         const bounds = route.points.map(point => [point.lng, point.lat]);
         
         // 使用setFitView方法自动调整视窗，增加更大的边距
         currentMap.setFitView(bounds, false, [150, 150, 150, 150]); // 增加到150px的边距
         console.log('多点路线，自动调整视窗，边界点数:', bounds.length);
       }
     } catch (error) {
       console.error('调整地图视窗失败:', error);
       // 备选方案：设置到第一个点
       if (route.points.length > 0) {
         const firstPoint = route.points[0];
         currentMap.setZoomAndCenter(8, [firstPoint.lng, firstPoint.lat]);
         console.log('使用备选方案，设置到第一个点:', firstPoint);
       }
     }
  };

  const initMap = async () => {
    try {
      const AMapInstance = await AMapLoader.load({
        key: MAP_CONFIG.apiKey,
        version: MAP_CONFIG.version,
        plugins: ['AMap.ToolBar', 'AMap.Scale', 'AMap.PlaceSearch', 'AMap.Driving', 'AMap.Walking', 'AMap.Riding', 'AMap.Geocoder']
      });

      if (mapContainer.current) {
        const mapInstance = new AMapInstance.Map(mapContainer.current, {
          zoom: MAP_CONFIG.defaultZoom,
          center: MAP_CONFIG.defaultCenter,
          mapStyle: MAP_CONFIG.mapStyle
        });

        // 添加工具栏和比例尺
        mapInstance.addControl(new AMapInstance.ToolBar());
        mapInstance.addControl(new AMapInstance.Scale());

        // 地图点击事件
        mapInstance.on('click', async (e: any) => {
          console.log('=== 地图点击事件触发 ===');
          console.log('点击坐标:', e.lnglat);
          console.log('当前绘制状态 (ref):', isDrawingRef.current);
          console.log('当前绘制状态 (state):', isDrawing);
          
          // 使用ref来获取最新的绘制状态
          if (isDrawingRef.current) {
            console.log('开始添加点到路线');
            await addPointToCurrentRoute(e.lnglat.lng, e.lnglat.lat);
          } else {
            console.log('未在绘制模式，点击地图空白处，重置路线透明度');
            // 点击地图空白处，重置所有路线透明度
            resetRouteOpacity();
          }
        });

        setMap(mapInstance);
        setAMapInstance(AMapInstance);
        mapRef.current = mapInstance;
        AMapRef.current = AMapInstance;
      }
    } catch (error) {
      console.error('地图加载失败:', error);
      // 如果API key无效，显示提示信息
      alert('地图加载失败，请检查高德地图API key是否正确配置');
    }
  };

  // 将坐标转换为最近的道路点
  const convertToRoadPoint = async (lng: number, lat: number): Promise<TrackPoint> => {
    console.log('=== convertToRoadPoint 被调用 ===');
    console.log('输入坐标:', { lng, lat });
    
    const currentAMap = AMapRef.current;
    
    if (!currentAMap) {
      console.log('AMap实例不存在，返回原坐标');
      return { lng, lat, name: '未知位置' };
    }
    
    try {
      // 使用逆地理编码获取最近的道路信息
      const geocoder = new currentAMap.Geocoder({
        city: '全国',
        radius: 1000 // 搜索半径1000米
      });
      
      return new Promise((resolve) => {
        geocoder.getAddress([lng, lat], (status: string, result: any) => {
          if (status === 'complete' && result.regeocode) {
            console.log('逆地理编码结果:', result);
            
            // 获取最近的道路信息
            const roads = result.regeocode.roads;
            const pois = result.regeocode.pois;
            
            let finalPoint: TrackPoint = { lng, lat, name: '位置点' };
            
            // 优先使用最近的道路点
            if (roads && roads.length > 0) {
              const nearestRoad = roads[0];
              if (nearestRoad.location) {
                let roadLng = lng, roadLat = lat;
                
                if (typeof nearestRoad.location === 'string') {
                  const coords = nearestRoad.location.split(',');
                  roadLng = parseFloat(coords[0]);
                  roadLat = parseFloat(coords[1]);
                } else if (nearestRoad.location.lng !== undefined) {
                  roadLng = nearestRoad.location.lng;
                  roadLat = nearestRoad.location.lat;
                } else if (nearestRoad.location.getLng) {
                  roadLng = nearestRoad.location.getLng();
                  roadLat = nearestRoad.location.getLat();
                }
                
                finalPoint = {
                  lng: roadLng,
                  lat: roadLat,
                  name: nearestRoad.name || '道路点'
                };
                console.log('使用最近道路点:', finalPoint);
              }
            }
            // 如果没有道路信息，使用最近的POI
            else if (pois && pois.length > 0) {
              const nearestPoi = pois[0];
              if (nearestPoi.location) {
                let poiLng = lng, poiLat = lat;
                
                if (typeof nearestPoi.location === 'string') {
                  const coords = nearestPoi.location.split(',');
                  poiLng = parseFloat(coords[0]);
                  poiLat = parseFloat(coords[1]);
                } else if (nearestPoi.location.lng !== undefined) {
                  poiLng = nearestPoi.location.lng;
                  poiLat = nearestPoi.location.lat;
                } else if (nearestPoi.location.getLng) {
                  poiLng = nearestPoi.location.getLng();
                  poiLat = nearestPoi.location.getLat();
                }
                
                finalPoint = {
                  lng: poiLng,
                  lat: poiLat,
                  name: nearestPoi.name || 'POI点'
                };
                console.log('使用最近POI点:', finalPoint);
              }
            }
            // 如果都没有，使用地址信息
            else if (result.regeocode.formattedAddress) {
              finalPoint = {
                lng,
                lat,
                name: result.regeocode.formattedAddress.substring(0, 20) + '...'
              };
              console.log('使用地址信息:', finalPoint);
            }
            
            resolve(finalPoint);
          } else {
            console.log('逆地理编码失败，使用原坐标');
            resolve({ lng, lat, name: '位置点' });
          }
        });
      });
    } catch (error) {
      console.error('坐标转换失败:', error);
      return { lng, lat, name: '位置点' };
    }
  };

  const addPointToCurrentRoute = async (lng: number, lat: number) => {
    console.log('=== addPointToCurrentRoute 被调用 ===');
    console.log('原始坐标:', { lng, lat });
    console.log('当前路线点数:', currentRoute.points.length);
    console.log('地图实例存在:', !!map);
    console.log('AMap实例存在:', !!AMap);
    
    // 将坐标转换为最近的道路点
    const roadPoint = await convertToRoadPoint(lng, lat);
    console.log('转换后的道路坐标:', roadPoint);
    
    setCurrentRoute(prevRoute => {
      const newPoint: TrackPoint = {
        lng: roadPoint.lng,
        lat: roadPoint.lat,
        name: roadPoint.name || `点${prevRoute.points.length + 1}`
      };

      const updatedRoute = {
        ...prevRoute,
        points: [...prevRoute.points, newPoint],
        color: selectedColor,
        routeType: routeType
      };

      console.log('更新后的路线:', updatedRoute);
      
      // 使用setTimeout确保状态更新后再更新地图
      setTimeout(() => {
        updateRouteOnMap(updatedRoute);
      }, 0);
      
      return updatedRoute;
    });
  };

  const updateRouteOnMap = (route: TrackRoute) => {
    console.log('=== updateRouteOnMap 被调用 ===');
    console.log('路线点数:', route.points.length);
    console.log('地图实例 (state):', !!map);
    console.log('AMap实例 (state):', !!AMap);
    console.log('地图实例 (ref):', !!mapRef.current);
    console.log('AMap实例 (ref):', !!AMapRef.current);
    
    const currentMap = mapRef.current;
    const currentAMap = AMapRef.current;
    
    if (!currentMap || !currentAMap || route.points.length === 0) {
      console.log('提前返回，原因:', { 
        hasMap: !!currentMap, 
        hasAMap: !!currentAMap, 
        pointsLength: route.points.length 
      });
      return;
    }

    console.log('开始更新地图轨迹');

    // 删除旧的轨迹线和标记点
    if (route.polyline) {
      console.log('删除旧轨迹线');
      currentMap.remove(route.polyline);
    }
    if (route.markers) {
      console.log('删除旧标记点，数量:', route.markers.length);
      route.markers.forEach(marker => {
        try {
          currentMap.remove(marker);
        } catch (e) {
          console.log('标记点已被移除或不存在');
        }
      });
    }
    
    // 清理地图上所有的标记点（彻底清理）
    const allOverlays = currentMap.getAllOverlays('marker');
    console.log('地图上现有标记点数量:', allOverlays.length);
    allOverlays.forEach((overlay: any) => {
      if (overlay.routeId === route.id) {
        console.log('移除路线相关的标记点');
        currentMap.remove(overlay);
      }
    });

    const markers: any[] = [];

    // 添加标记点
    console.log('开始添加标记点，数量:', route.points.length);
    route.points.forEach((point, index) => {
      console.log(`添加标记点 ${index + 1}:`, point);
      
      const marker = new currentAMap.Marker({
        position: [point.lng, point.lat],
        title: point.name || `点${index + 1}`,
        draggable: true // 设置标记点可拖拽
      });
      
      // 自定义标记样式
      const markerContent = document.createElement('div');
      markerContent.innerHTML = `
        <div style="
          background-color: ${route.color};
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 12px;
          font-weight: bold;
          cursor: move;
        ">${index + 1}</div>
      `;
      marker.setContent(markerContent);
      
      // 添加拖拽事件监听器 - 简化版本
      marker.on('dragend', async (e: any) => {
        console.log('=== 标记点拖拽结束 ===');
        
        // 拖拽开始前先清空路径规划队列
        clearRoutePlanningQueue();
        
        const newPosition = e.lnglat || e.target.getPosition();
        const newLng = newPosition.lng || newPosition.getLng();
        const newLat = newPosition.lat || newPosition.getLat();
        
        console.log(`点${index + 1}拖拽到新位置: [${newLng}, ${newLat}]`);
        
        try {
          // 将新坐标转换为道路点
          const roadPoint = await convertToRoadPoint(newLng, newLat);
          console.log('拖拽后转换的道路坐标:', roadPoint);
          
          // 更新标记点位置到道路点
          marker.setPosition([roadPoint.lng, roadPoint.lat]);
          
          // 直接更新路线对象的点坐标
          route.points[index] = {
            ...route.points[index],
            lng: roadPoint.lng,
            lat: roadPoint.lat,
            name: roadPoint.name || route.points[index].name
          };
          
          // 只更新路径
          await updateRoutePathOnly(route);
          
          // 最后同步更新React状态（不触发重新渲染地图）
          setCurrentRoute(prevRoute => ({
            ...prevRoute,
            points: [...route.points]
          }));
          
          console.log('拖拽处理完成');
        } catch (error) {
          console.error('拖拽处理失败:', error);
        }
      });
      
      // 给标记点添加路线ID和点索引信息，便于调试
      marker.routeId = route.id;
      marker.pointIndex = index;
      
      currentMap.add(marker);
      markers.push(marker);
      console.log(`标记点 ${index + 1} 已添加到地图`);
    });

    // 创建轨迹线（需要至少2个点）
    if (route.points.length >= 2) {
      console.log('开始创建导航规划路线，点数:', route.points.length);
      createNavigationRoute(currentMap, currentAMap, route, markers);
    } else {
      console.log('点数不足，不创建轨迹线');
      // 更新路线对象的polyline和markers
      route.polyline = null;
      route.markers = markers;
      console.log('地图轨迹更新完成');
    }
  };

  // 只更新路径，不重新创建标记点（用于拖拽时）
  const updateRoutePathOnly = async (route: TrackRoute) => {
    console.log('=== updateRoutePathOnly 被调用 ===');
    console.log('只更新路径，路线:', route.name);
    
    const currentMap = mapRef.current;
    const currentAMap = AMapRef.current;
    
    if (!currentMap || !currentAMap || route.points.length < 2) {
      console.log('条件不满足，跳过路径更新');
      return;
    }
    
    // 删除旧的轨迹线
    if (route.polyline) {
      console.log('删除旧轨迹线');
      try {
        currentMap.remove(route.polyline);
      } catch (e) {
        console.log('旧轨迹线已被移除或不存在');
      }
      route.polyline = null;
    }
    
    // 彻底清理地图上所有相关的路径线
    const allPolylines = currentMap.getAllOverlays('polyline');
    console.log('地图上现有路径线数量:', allPolylines.length);
    allPolylines.forEach((polyline: any) => {
      if (polyline.routeId === route.id) {
        console.log('移除路线相关的路径线');
        try {
          currentMap.remove(polyline);
        } catch (e) {
          console.log('路径线已被移除或不存在');
        }
      }
    });
    
    const points = route.points;
    const allRouteSegments: any[] = [];
    
    // 重新规划所有路径段 - 使用队列控制并发
    const planningTasks: Promise<number[][]>[] = [];
    
    for (let i = 0; i < points.length - 1; i++) {
      const startPoint = points[i];
      const endPoint = points[i + 1];
      
      console.log(`准备重新规划路径段 ${i + 1}: 从 [${startPoint.lng}, ${startPoint.lat}] 到 [${endPoint.lng}, ${endPoint.lat}]`);
      
      // 创建规划任务并添加到队列
      const planningTask = new Promise<number[][]>((resolve) => {
        const task = async () => {
          try {
            console.log(`开始执行路径重新规划 ${i + 1}`);
            const routeSegment = await planRoute(currentAMap, startPoint, endPoint, route.routeType || 'driving');
            if (routeSegment && routeSegment.length > 0) {
              console.log(`路径重新规划 ${i + 1} 成功，点数:`, routeSegment.length);
              resolve(routeSegment);
            } else {
              console.log(`路径重新规划 ${i + 1} 返回空结果，使用直线`);
              resolve([[startPoint.lng, startPoint.lat], [endPoint.lng, endPoint.lat]]);
            }
          } catch (error) {
            console.error(`路径规划失败，路径段${i + 1}:`, error);
            // 如果路径规划失败，使用直线连接
            resolve([[startPoint.lng, startPoint.lat], [endPoint.lng, endPoint.lat]]);
          }
        };
        
        addRoutePlanningTask(task);
      });
      
      planningTasks.push(planningTask);
    }
    
    // 等待所有规划任务完成
    console.log('等待所有路径重新规划任务完成...');
    const routeSegments = await Promise.all(planningTasks);
    
    // 合并所有路径段
    routeSegments.forEach(segment => {
      if (segment && segment.length > 0) {
        allRouteSegments.push(...segment);
      }
    });
    
    // 创建新的轨迹线
    if (allRouteSegments.length > 0) {
      const polyline = new currentAMap.Polyline({
        path: allRouteSegments,
        strokeColor: route.color,
        strokeWeight: 4,
        strokeOpacity: 0.8,
        lineJoin: 'round',
        lineCap: 'round'
      });
      
      // 给路径线添加路线ID标识
      polyline.routeId = route.id;
      
      // 添加路径线点击事件
      polyline.on('click', () => {
        console.log('路径线被点击，路线ID:', route.id);
        handleRouteClick(route.id);
      });
      
      currentMap.add(polyline);
      
      // 更新路线对象的polyline
      route.polyline = polyline;
      console.log('路径更新完成');
    } else {
      console.log('未能创建任何路径段');
      route.polyline = null;
    }
  };

  // 创建导航规划路线
  const createNavigationRoute = async (currentMap: any, currentAMap: any, route: TrackRoute, markers: any[]) => {
    console.log('开始创建导航规划路线，类型:', route.routeType);
    
    const points = route.points;
    const allRouteSegments: any[] = [];
    
    // 为每两个相邻点创建路径规划 - 使用队列控制并发
    const planningTasks: Promise<number[][]>[] = [];
    
    for (let i = 0; i < points.length - 1; i++) {
      const startPoint = points[i];
      const endPoint = points[i + 1];
      
      console.log(`准备规划路径 ${i + 1}: 从 [${startPoint.lng}, ${startPoint.lat}] 到 [${endPoint.lng}, ${endPoint.lat}]`);
      
      // 创建规划任务并添加到队列
      const planningTask = new Promise<number[][]>((resolve) => {
        const task = async () => {
          try {
            console.log(`开始执行路径规划 ${i + 1}`);
            const routeSegment = await planRoute(currentAMap, startPoint, endPoint, route.routeType || 'driving');
            if (routeSegment && routeSegment.length > 0) {
              console.log(`路径规划 ${i + 1} 成功，点数:`, routeSegment.length);
              resolve(routeSegment);
            } else {
              console.log(`路径规划 ${i + 1} 返回空结果，使用直线`);
              resolve([[startPoint.lng, startPoint.lat], [endPoint.lng, endPoint.lat]]);
            }
          } catch (error) {
            console.error(`路径规划失败，从点${i + 1}到点${i + 2}:`, error);
            // 如果路径规划失败，使用直线连接
            resolve([[startPoint.lng, startPoint.lat], [endPoint.lng, endPoint.lat]]);
          }
        };
        
        addRoutePlanningTask(task);
      });
      
      planningTasks.push(planningTask);
    }
    
    // 等待所有规划任务完成
    console.log('等待所有路径规划任务完成...');
    const routeSegments = await Promise.all(planningTasks);
    
    // 合并所有路径段
    routeSegments.forEach(segment => {
      if (segment && segment.length > 0) {
        allRouteSegments.push(...segment);
      }
    });
    
    // 创建完整的路径线
    if (allRouteSegments.length > 0) {
      const polyline = new currentAMap.Polyline({
        path: allRouteSegments,
        strokeColor: route.color,
        strokeWeight: 4,
        strokeOpacity: 0.8,
        lineJoin: 'round',
        lineCap: 'round'
      });
      
      // 给路径线添加路线ID标识
      polyline.routeId = route.id;
      
      // 添加路径线点击事件
      polyline.on('click', () => {
        console.log('路径线被点击，路线ID:', route.id);
        handleRouteClick(route.id);
      });
      
      currentMap.add(polyline);
      
      // 更新路线对象
      route.polyline = polyline;
      route.markers = markers;
      console.log('导航规划路线创建完成');
    } else {
      console.log('未能创建任何路径段');
      route.polyline = null;
      route.markers = markers;
    }
  };

  // 队列处理函数 - 限制并发请求
  const processRoutePlanningQueue = async () => {
    if (isProcessingQueueRef.current || routePlanningQueueRef.current.length === 0) {
      return;
    }

    isProcessingQueueRef.current = true;
    setIsRoutePlanning(true);
    
    let completedTasks = 0;
    
    // 动态计算总任务数，包括处理过程中可能添加的新任务
    while (routePlanningQueueRef.current.length > 0 && isProcessingQueueRef.current) {
      // 检查处理状态，如果被清空队列函数重置，则停止处理
      if (!isProcessingQueueRef.current) {
        console.log('队列处理被中断（队列已清空）');
        break;
      }
      
      const currentTotalTasks = completedTasks + routePlanningQueueRef.current.length;
      console.log(`处理路径规划队列，当前队列长度: ${routePlanningQueueRef.current.length}, 总任务数: ${currentTotalTasks}`);
      
      setPlanningProgress(`正在规划路径段 ${completedTasks + 1}/${currentTotalTasks}...`);
      
      const task = routePlanningQueueRef.current.shift();
      if (task) {
        try {
          await task();
          completedTasks++;
          
          // 限制频率：每500ms处理一个请求（2次/秒）
          if (routePlanningQueueRef.current.length > 0 && isProcessingQueueRef.current) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          console.error('队列任务执行失败:', error);
          completedTasks++;
        }
      }
    }

    // 只有在正常完成时才重置状态（避免与clearRoutePlanningQueue冲突）
    if (isProcessingQueueRef.current) {
      isProcessingQueueRef.current = false;
      setIsRoutePlanning(false);
      setPlanningProgress('');
      console.log(`路径规划队列处理完成，共完成 ${completedTasks} 个任务`);
    }
  };

  // 添加路径规划任务到队列
  const addRoutePlanningTask = (task: () => Promise<any>) => {
    routePlanningQueueRef.current.push(task);
    processRoutePlanningQueue();
  };

  // 清空路径规划队列
  const clearRoutePlanningQueue = () => {
    console.log(`清空路径规划队列，当前队列长度: ${routePlanningQueueRef.current.length}`);
    routePlanningQueueRef.current.length = 0; // 清空队列
    isProcessingQueueRef.current = false; // 重置处理状态
    setIsRoutePlanning(false); // 重置规划状态
    setPlanningProgress(''); // 清空进度提示
  };

  // 生成路径缓存的key
  const generateCacheKey = (startPoint: TrackPoint, endPoint: TrackPoint, routeType: string | undefined): string => {
    // 使用起点、终点坐标和路径类型生成唯一key
    const startKey = `${startPoint.lng.toFixed(6)},${startPoint.lat.toFixed(6)}`;
    const endKey = `${endPoint.lng.toFixed(6)},${endPoint.lat.toFixed(6)}`;
    const type = routeType || 'driving'; // 默认使用driving
    return `${type}:${startKey}->${endKey}`;
  };

  // 从缓存获取路径
  const getCachedRoute = (startPoint: TrackPoint, endPoint: TrackPoint, routeType: string): number[][] | null => {
    const cacheKey = generateCacheKey(startPoint, endPoint, routeType);
    const cachedPath = routePlanningCacheRef.current.get(cacheKey);
    if (cachedPath) {
      console.log(`🎯 缓存命中: ${cacheKey}`);
      return cachedPath;
    }
    return null;
  };

  // 将路径存入缓存
  const setCachedRoute = (startPoint: TrackPoint, endPoint: TrackPoint, routeType: string, path: number[][]): void => {
    const cacheKey = generateCacheKey(startPoint, endPoint, routeType);
    routePlanningCacheRef.current.set(cacheKey, path);
    console.log(`💾 路径已缓存: ${cacheKey}, 点数: ${path.length}`);
    
    // 限制缓存大小，避免内存占用过大
    if (routePlanningCacheRef.current.size > 100) {
      // 删除最老的缓存项（Map会保持插入顺序）
      const firstKey = routePlanningCacheRef.current.keys().next().value;
      routePlanningCacheRef.current.delete(firstKey);
      console.log(`🗑️ 删除最老的缓存项: ${firstKey}`);
    }
  };

  // 清空路径缓存（仅在必要时使用，比如用户手动清理或内存不足）
  const clearRouteCache = () => {
    const cacheSize = routePlanningCacheRef.current.size;
    routePlanningCacheRef.current.clear();
    console.log(`🧹 清空路径缓存，共清除 ${cacheSize} 项`);
  };

  // 规划两点之间的路径
  const planRoute = (currentAMap: any, startPoint: TrackPoint, endPoint: TrackPoint, routeType: string | undefined): Promise<number[][]> => {
    return new Promise((resolve, reject) => {
      const actualRouteType = routeType || 'driving'; // 默认使用driving
      console.log(`开始规划路径: ${actualRouteType}模式`);
      console.log('起点:', startPoint);
      console.log('终点:', endPoint);
      
      // 先检查缓存
      const cachedPath = getCachedRoute(startPoint, endPoint, actualRouteType);
      if (cachedPath) {
        console.log('✅ 使用缓存路径，跳过API调用');
        resolve(cachedPath);
        return;
      }
      
      console.log('📡 缓存未命中，调用API规划路径');
      let routePlanner: any;
      
      // 根据路径类型创建相应的规划器
      switch (actualRouteType) {
        case 'driving':
          routePlanner = new currentAMap.Driving({
            map: null, // 不显示默认路线，我们自己绘制
            showTraffic: false,
            policy: currentAMap.DrivingPolicy.LEAST_TIME // 使用最短时间策略
          });
          break;
        case 'walking':
          routePlanner = new currentAMap.Walking({
            map: null,
          });
          break;
        case 'riding':
          routePlanner = new currentAMap.Riding({
            map: null,
          });
          break;
        default:
          routePlanner = new currentAMap.Driving({
            map: null,
            showTraffic: false,
            policy: currentAMap.DrivingPolicy.LEAST_TIME
          });
      }
      
      const startLngLat = new currentAMap.LngLat(startPoint.lng, startPoint.lat);
      const endLngLat = new currentAMap.LngLat(endPoint.lng, endPoint.lat);
      
      // 设置超时处理
      const timeoutId = setTimeout(() => {
        console.error('路径规划超时');
        reject(new Error('路径规划超时'));
      }, 10000); // 10秒超时
      
      routePlanner.search(startLngLat, endLngLat, (status: string, result: any) => {
        clearTimeout(timeoutId);
        
        console.log('路径规划状态:', status);
        console.log('路径规划结果:', result);
        
        if (status === 'complete' && result.routes && result.routes.length > 0) {
          console.log('路径规划成功');
          
          // 提取路径坐标
          const route = result.routes[0];
          const path: number[][] = [];
          
          if (route.steps) {
            route.steps.forEach((step: any) => {
              if (step.path && step.path.length > 0) {
                step.path.forEach((point: any) => {
                  if (point.lng !== undefined && point.lat !== undefined) {
                    path.push([point.lng, point.lat]);
                  } else if (point.getLng && point.getLat) {
                    path.push([point.getLng(), point.getLat()]);
                  }
                });
              }
            });
          }
          
          console.log(`提取的路径点数: ${path.length}`);
          
          if (path.length > 0) {
            // 将成功的路径存入缓存
            setCachedRoute(startPoint, endPoint, actualRouteType, path);
            resolve(path);
          } else {
            console.warn('路径规划成功但没有路径点，使用直线连接');
            const straightPath = [[startPoint.lng, startPoint.lat], [endPoint.lng, endPoint.lat]];
            // 直线路径也可以缓存
            setCachedRoute(startPoint, endPoint, actualRouteType, straightPath);
            resolve(straightPath);
          }
        } else {
          console.error('路径规划失败:', status, result);
          console.log('使用直线连接作为备选方案');
          // 如果路径规划失败，使用直线连接
          const straightPath = [[startPoint.lng, startPoint.lat], [endPoint.lng, endPoint.lat]];
          // 失败的情况也可以缓存直线路径，避免重复调用
          setCachedRoute(startPoint, endPoint, actualRouteType, straightPath);
          resolve(straightPath);
        }
      });
    });
  };

  const startDrawing = () => {
    // 开始新的绘制前先清空路径规划队列
    clearRoutePlanningQueue();
    
    setIsDrawing(true);
    isDrawingRef.current = true;
    setCurrentRoute({
      id: Date.now().toString(),
      name: `路线${routes.length + 1}`,
      points: [],
      color: selectedColor,
      markers: [],
      routeType: routeType
    });
  };

  // 删除当前路线中的单个点
  const removeCurrentRoutePoint = (pointIndex: number) => {
    if (currentRoute.points.length <= 1) {
      return; // 至少保留一个点，或者全部删除
    }

    // 删除点前先清空路径规划队列
    clearRoutePlanningQueue();

    console.log(`删除当前路线的第 ${pointIndex + 1} 个点`);
    
    const currentMap = mapRef.current;
    
    // 先清理地图上所有相关的标记和路径
    if (currentMap) {
      // 清理当前路线的所有标记点
      if (currentRoute.markers) {
        console.log('清理当前路线的标记点，数量:', currentRoute.markers.length);
        currentRoute.markers.forEach(marker => {
          try {
            currentMap.remove(marker);
          } catch (e) {
            console.log('标记点已被移除或不存在');
          }
        });
      }
      
      // 清理当前路线的路径线
      if (currentRoute.polyline) {
        console.log('清理当前路线的路径线');
        try {
          currentMap.remove(currentRoute.polyline);
        } catch (e) {
          console.log('路径线已被移除或不存在');
        }
      }
      
      // 激进清理策略：清理地图上所有的标记点和路径线
      console.log('=== 开始激进清理策略 ===');
      
      // 清理所有标记点
      const allMarkers = currentMap.getAllOverlays('marker');
      console.log('清理地图上所有标记点，总数:', allMarkers.length);
      allMarkers.forEach((marker: any) => {
        try {
          currentMap.remove(marker);
        } catch (e) {
          console.log('清理标记点失败');
        }
      });
      
      // 清理所有路径线
      const allPolylines = currentMap.getAllOverlays('polyline');
      console.log('清理地图上所有路径线，总数:', allPolylines.length);
      allPolylines.forEach((polyline: any) => {
        try {
          currentMap.remove(polyline);
        } catch (e) {
          console.log('清理路径线失败');
        }
      });
      
      console.log('=== 激进清理完成 ===');
    }

    const newPoints = currentRoute.points.filter((_, index) => index !== pointIndex);
    const updatedRoute = {
      ...currentRoute,
      points: newPoints,
      markers: [], // 重置标记数组
      polyline: null // 重置路径线
    };

    setCurrentRoute(updatedRoute);
    
    // 重新绘制所有路线
    setTimeout(() => {
      console.log('=== 开始重新绘制所有路线 ===');
      
      // 重新绘制当前路线
      if (updatedRoute.points.length > 0) {
        updateRouteOnMap(updatedRoute);
      }
      
      // 重新绘制所有保存的路线
      routes.forEach(route => {
        if (route.points.length > 0) {
          updateRouteOnMap(route);
        }
      });
      
      console.log('=== 重新绘制完成 ===');
    }, 200); // 增加延迟确保清理完成
    
    console.log(`删除完成，剩余 ${newPoints.length} 个点`);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    isDrawingRef.current = false;
    if (currentRoute.points.length >= 1) {
      const newRoute = {
        ...currentRoute,
        id: Date.now().toString(),
        name: `路线${routes.length + 1}`
      };
      setRoutes(prev => [...prev, newRoute]);
      // 移除自动选中新路线的逻辑，保持默认不选中状态
      
      // 在地图上绘制新路线
      if (newRoute.points.length >= 2) {
        updateRouteOnMap(newRoute);
      }
      
      // 自动调整视窗以显示新创建的路线（即使没有选中）
      setTimeout(() => {
        console.log('新路线创建完成，调整视窗显示新路线:', newRoute.name);
        fitRouteToView(newRoute);
      }, 500);
    }
    setCurrentRoute({
      id: Date.now().toString(),
      name: '新路线',
      points: [],
      color: selectedColor,
      markers: [],
      routeType: routeType
    });
  };

  const clearAll = () => {
    const confirmed = window.confirm(
      '确定要清除所有路线吗？\n\n这将删除地图上的所有路线和保存的数据。'
    );
    
    if (!confirmed) {
      return;
    }

    // 清除所有路线前先清空路径规划队列
    clearRoutePlanningQueue();

    if (mapRef.current) {
      mapRef.current.clearMap();
    }
    
    setRoutes([]);
    setCurrentDetailRoute(null);
    setCurrentRoute({
      id: Date.now().toString(),
      name: '新路线',
      points: [],
      color: selectedColor,
      markers: [],
      routeType: routeType
    });
    setIsDrawing(false);
    isDrawingRef.current = false;
    
    // 清除localStorage
    clearPlansStorage();
    
    console.log('已清除所有路线和保存数据');
  };

  const deleteRoute = (routeId: string) => {
    // 删除路线前先清空路径规划队列
    clearRoutePlanningQueue();
    
    const routeToDelete = routes.find(r => r.id === routeId);
    if (routeToDelete && mapRef.current) {
      if (routeToDelete.polyline) {
        mapRef.current.remove(routeToDelete.polyline);
      }
      if (routeToDelete.markers) {
        routeToDelete.markers.forEach(marker => mapRef.current.remove(marker));
      }
    }
    
    // 如果删除的是当前详情路线，清除详情显示
    if (currentDetailRoute?.id === routeId) {
      setCurrentDetailRoute(null);
    }
    
    setRoutes(prev => prev.filter(r => r.id !== routeId));
  };

  const toggleRouteVisibility = (routeId: string) => {
    const route = routes.find(r => r.id === routeId);
    if (route && mapRef.current) {
      if (route.polyline) {
        const currentOpacity = route.polyline.getOptions().strokeOpacity;
        route.polyline.setOptions({
          strokeOpacity: currentOpacity > 0 ? 0 : 0.8
        });
      }
      if (route.markers) {
        route.markers.forEach(marker => {
          // 通过DOM元素样式来切换标记点可见性
          const markerElement = marker.getContent();
          if (markerElement) {
            let currentOpacity = '1';
            if (markerElement.style && markerElement.style.opacity) {
              currentOpacity = markerElement.style.opacity;
            } else if (markerElement.querySelector) {
              const innerElement = markerElement.querySelector('div');
              if (innerElement && innerElement.style && innerElement.style.opacity) {
                currentOpacity = innerElement.style.opacity;
              }
            }
            
            const newOpacity = parseFloat(currentOpacity) > 0 ? '0' : '1';
            
            if (markerElement.style) {
              markerElement.style.opacity = newOpacity;
            } else if (markerElement.querySelector) {
              const innerElement = markerElement.querySelector('div');
              if (innerElement && innerElement.style) {
                innerElement.style.opacity = newOpacity;
              }
            }
          }
        });
      }
    }
  };

  // 搜索地点功能
  const searchLocation = async (keyword: string) => {
    if (!keyword.trim() || !AMapRef.current) {
      setSearchSuggestions([]);
      return;
    }

    setIsSearching(true);
    
    try {
      const placeSearch = new AMapRef.current.PlaceSearch({
        city: '全国',
        pageSize: 10
      });

      placeSearch.search(keyword, (status: string, result: any) => {
        setIsSearching(false);
        
        if (status === 'complete' && result.poiList && result.poiList.pois) {
          const formattedPois = result.poiList.pois.map((poi: any) => {
            let lng: number = 0, lat: number = 0;
            
            if (poi.location) {
              if (typeof poi.location === 'string') {
                const coords = poi.location.split(',');
                lng = parseFloat(coords[0]);
                lat = parseFloat(coords[1]);
              } else if (poi.location.lng !== undefined && poi.location.lat !== undefined) {
                lng = poi.location.lng;
                lat = poi.location.lat;
              } else if (poi.location.getLng && poi.location.getLat) {
                lng = poi.location.getLng();
                lat = poi.location.getLat();
              }
            }
            
            return {
              name: poi.name || '未知地点',
              address: poi.address || poi.district || '地址未知',
              location: { lng, lat }
            };
          }).filter((poi: any) => poi.location.lng && poi.location.lat);
          
          setSearchSuggestions(formattedPois);
        } else {
          setSearchSuggestions([]);
        }
      });
    } catch (error) {
      console.error('搜索失败:', error);
      setIsSearching(false);
      setSearchSuggestions([]);
    }
  };

  const handleLocationInputChange = (value: string) => {
    setLocationInput(value);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (value.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        searchLocation(value);
      }, 500);
    } else {
      setSearchSuggestions([]);
    }
  };

  // 处理路线点击事件
  const handleRouteClick = (routeId: string) => {
    console.log('处理路线点击，路线ID:', routeId);
    setSelectedRouteId(routeId);
    setShowColorPicker(true);
  };

  // 更改路线颜色
  const changeRouteColor = (routeId: string, newColor: string) => {
    console.log('更改路线颜色:', routeId, newColor);
    
    // 更新当前路线
    if (currentRoute.id === routeId) {
      const updatedRoute = { ...currentRoute, color: newColor };
      setCurrentRoute(updatedRoute);
      updateRouteOnMap(updatedRoute);
    }
    
    // 更新已保存的路线
    setRoutes(prevRoutes => 
      prevRoutes.map(route => {
        if (route.id === routeId) {
          const updatedRoute = { ...route, color: newColor };
          updateRouteOnMap(updatedRoute);
          return updatedRoute;
        }
        return route;
      })
    );
    
    setShowColorPicker(false);
    setSelectedRouteId(null);
  };

  // 开始批量模式
  const startBatchMode = () => {
    setBatchMode(true);
    setShowBatchPanel(true);
    setSelectedLocations([]);
    console.log('开始批量选择模式');
  };

  // 退出批量模式
  const exitBatchMode = () => {
    setBatchMode(false);
    setShowBatchPanel(false);
    setSelectedLocations([]);
    setLocationInput('');
    setSearchSuggestions([]);
    console.log('退出批量选择模式');
  };

  // 移除选中的位置
  const removeSelectedLocation = (index: number) => {
    setSelectedLocations(prev => prev.filter((_, i) => i !== index));
  };

  // 重新排序选中的位置
  const reorderLocation = (fromIndex: number, toIndex: number) => {
    setSelectedLocations(prev => {
      const newList = [...prev];
      const [removed] = newList.splice(fromIndex, 1);
      newList.splice(toIndex, 0, removed);
      return newList;
    });
  };

  // 批量创建路线
  const createBatchRoute = async () => {
    if (selectedLocations.length < 2) {
      alert('请至少选择2个位置');
      return;
    }

    // 批量创建前先清空路径规划队列
    clearRoutePlanningQueue();

    console.log('开始批量创建路线，位置数量:', selectedLocations.length);

    // 转换所有位置为道路点
    const roadPoints: TrackPoint[] = [];
    for (let i = 0; i < selectedLocations.length; i++) {
      const location = selectedLocations[i];
      const roadPoint = await convertToRoadPoint(location.location.lng, location.location.lat);
      roadPoints.push({
        ...roadPoint,
        name: location.name
      });
      console.log(`位置 ${i + 1} 转换完成:`, roadPoint);
    }

    // 创建新路线
    const newRoute: TrackRoute = {
      id: Date.now().toString(),
      name: `批量路线${routes.length + 1}`,
      points: roadPoints,
      color: selectedColor,
      markers: [],
      routeType: routeType
    };

    // 添加到路线列表
    setRoutes(prev => [...prev, newRoute]);
    // 移除自动选中新路线的逻辑，保持默认不选中状态
    
    // 在地图上显示
    updateRouteOnMap(newRoute);

    // 自动调整视窗以显示新创建的批量路线（即使没有选中）
    setTimeout(() => {
      console.log('批量路线创建完成，调整视窗显示新路线:', newRoute.name);
      fitRouteToView(newRoute);
    }, 500);

    // 退出批量模式
    exitBatchMode();

    console.log('批量路线创建完成');
  };

  // 展开/折叠路线详情
  const toggleRouteExpansion = (route: TrackRoute) => {
    // 如果点击的是当前已展开的路线，则折叠
    if (expandedRouteId === route.id) {
      console.log('折叠路线:', route.name);
      setExpandedRouteId(null);
      setCurrentDetailRoute(null);
      resetRouteOpacity(); // 重置所有路线透明度
    } else {
      // 展开新的路线
      console.log('展开路线详情:', route.name);
      setExpandedRouteId(route.id);
      setCurrentDetailRoute(route);
      highlightSelectedRoute(route.id); // 高亮选中的路线，降低其他路线透明度
    }
  };

  // 高亮选中的路线
  const highlightSelectedRoute = (selectedRouteId: string) => {
    const currentMap = mapRef.current;
    if (!currentMap) return;

    console.log('高亮路线:', selectedRouteId);

    // 遍历所有路线，调整透明度
    routes.forEach(route => {
      if (route.polyline) {
        const isSelected = route.id === selectedRouteId;
        const opacity = isSelected ? 0.9 : 0.3; // 选中路线高透明度，其他路线低透明度
        
        route.polyline.setOptions({
          strokeOpacity: opacity
        });
        
        console.log(`路线 ${route.name} 透明度设置为:`, opacity);
      }
      
      // 调整标记点透明度
      if (route.markers) {
        route.markers.forEach(marker => {
          const isSelected = route.id === selectedRouteId;
          const opacity = isSelected ? 1 : 0.4;
          
          // 通过修改DOM元素样式设置透明度
          const markerElement = marker.getContent();
          if (markerElement) {
            if (markerElement.style) {
              markerElement.style.opacity = opacity.toString();
            } else if (markerElement.querySelector) {
              // 如果是包装元素，查找内部的标记元素
              const innerElement = markerElement.querySelector('div');
              if (innerElement && innerElement.style) {
                innerElement.style.opacity = opacity.toString();
              }
            }
          }
        });
      }
    });
  };

  // 重置所有路线透明度
  const resetRouteOpacity = () => {
    const currentMap = mapRef.current;
    if (!currentMap) return;

    console.log('重置所有路线透明度');

    routes.forEach(route => {
      if (route.polyline) {
        route.polyline.setOptions({
          strokeOpacity: 0.8 // 恢复正常透明度
        });
      }
      
      if (route.markers) {
        route.markers.forEach(marker => {
          // 恢复正常透明度
          const markerElement = marker.getContent();
          if (markerElement) {
            if (markerElement.style) {
              markerElement.style.opacity = '1';
            } else if (markerElement.querySelector) {
              // 如果是包装元素，查找内部的标记元素
              const innerElement = markerElement.querySelector('div');
              if (innerElement && innerElement.style) {
                innerElement.style.opacity = '1';
              }
            }
          }
        });
      }
    });
  };

  // 计算两点之间的直线距离（单位：米）
  const calculateDistance = (point1: TrackPoint, point2: TrackPoint): number => {
    const currentAMap = AMapRef.current;
    if (!currentAMap) return 0;

    try {
      const lngLat1 = new currentAMap.LngLat(point1.lng, point1.lat);
      const lngLat2 = new currentAMap.LngLat(point2.lng, point2.lat);
      
      // 使用高德地图API计算距离
      const distance = lngLat1.distance(lngLat2);
      return Math.round(distance); // 返回四舍五入的米数
    } catch (error) {
      console.error('计算距离失败:', error);
      return 0;
    }
  };

  // 格式化距离显示
  const formatDistance = (distance: number): string => {
    if (distance < 1000) {
      return `${distance}m`;
    } else if (distance < 10000) {
      return `${(distance / 1000).toFixed(1)}km`;
    } else {
      return `${Math.round(distance / 1000)}km`;
    }
  };

  // 计算路线总距离
  const calculateTotalDistance = (route: TrackRoute): string => {
    if (route.points.length < 2) return '0m';
    
    let totalDistance = 0;
    for (let i = 0; i < route.points.length - 1; i++) {
      totalDistance += calculateDistance(route.points[i], route.points[i + 1]);
    }
    
    return formatDistance(totalDistance);
  };

  // 删除路线中的单个点并重新规划
  const deletePointAndReplan = async (routeId: string, pointIndex: number) => {
    const route = routes.find(r => r.id === routeId);
    if (!route || route.points.length <= 2) {
      alert('路线至少需要保留2个点');
      return;
    }

    const pointToDelete = route.points[pointIndex];
    const pointName = pointToDelete.name || `位置 ${pointIndex + 1}`;
    
    // 确认删除
    const confirmed = window.confirm(
      `确定要删除 "${pointName}" 吗？\n\n删除后系统会自动重新规划路径。`
    );
    
    if (!confirmed) {
      return;
    }

    // 删除点前先清空路径规划队列
    clearRoutePlanningQueue();

    console.log(`删除路线 ${route.name} 的第 ${pointIndex + 1} 个点:`, pointToDelete);

    const currentMap = mapRef.current;
    
    // 先清理地图上的旧标记和路径
    if (currentMap) {
      // 清理路线的所有标记点
      if (route.markers) {
        console.log('清理路线标记点，数量:', route.markers.length);
        route.markers.forEach(marker => {
          try {
            currentMap.remove(marker);
          } catch (e) {
            console.log('标记点已被移除或不存在');
          }
        });
      }
      
      // 清理路线的路径线
      if (route.polyline) {
        console.log('清理路线路径线');
        try {
          currentMap.remove(route.polyline);
        } catch (e) {
          console.log('路径线已被移除或不存在');
        }
      }
      
      // 激进清理策略：清理地图上所有的标记点和路径线
      console.log('=== 开始激进清理策略 ===');
      
      // 清理所有标记点
      const allMarkers = currentMap.getAllOverlays('marker');
      console.log('清理地图上所有标记点，总数:', allMarkers.length);
      allMarkers.forEach((marker: any) => {
        try {
          currentMap.remove(marker);
        } catch (e) {
          console.log('清理标记点失败');
        }
      });
      
      // 清理所有路径线
      const allPolylines = currentMap.getAllOverlays('polyline');
      console.log('清理地图上所有路径线，总数:', allPolylines.length);
      allPolylines.forEach((polyline: any) => {
        try {
          currentMap.remove(polyline);
        } catch (e) {
          console.log('清理路径线失败');
        }
      });
      
      console.log('=== 激进清理完成 ===');
    }

    // 创建新的点数组，移除指定点
    const newPoints = route.points.filter((_, index) => index !== pointIndex);
    
    // 更新路线
    const updatedRoute: TrackRoute = {
      ...route,
      points: newPoints,
      markers: [], // 重置标记数组
      polyline: null // 重置路径线
    };

    // 更新路线列表
    setRoutes(prev => prev.map(r => r.id === routeId ? updatedRoute : r));
    
    // 如果是当前详情路线，也更新详情
    if (currentDetailRoute?.id === routeId) {
      setCurrentDetailRoute(updatedRoute);
    }

    // 重新在地图上绘制所有路线
    try {
      setTimeout(async () => {
        console.log('=== 开始重新绘制所有路线 ===');
        
        // 重新绘制更新后的路线
        if (updatedRoute.points.length > 0) {
          await updateRouteOnMap(updatedRoute);
        }
        
        // 重新绘制所有其他路线
        const otherRoutes = routes.filter(r => r.id !== routeId);
        for (const otherRoute of otherRoutes) {
          if (otherRoute.points.length > 0) {
            await updateRouteOnMap(otherRoute);
          }
        }
        
        console.log('=== 重新绘制完成 ===');
        console.log('路线重新规划完成，剩余点数:', newPoints.length);
      }, 200); // 增加延迟确保清理完成
    } catch (error) {
      console.error('重新规划路线失败:', error);
      alert('重新规划路线失败，请重试');
    }
  };

  // 重新排序路线中的点
  const reorderRoutePoints = async (routeId: string, fromIndex: number, toIndex: number) => {
    const route = routes.find(r => r.id === routeId);
    if (!route) return;

    // 重新排序前先清空路径规划队列
    clearRoutePlanningQueue();

    console.log(`重新排序路线 ${route.name}: 从位置 ${fromIndex + 1} 移动到位置 ${toIndex + 1}`);

    // 创建新的点数组
    const newPoints = [...route.points];
    const [movedPoint] = newPoints.splice(fromIndex, 1);
    newPoints.splice(toIndex, 0, movedPoint);
    
    // 更新路线
    const updatedRoute: TrackRoute = {
      ...route,
      points: newPoints
    };

    // 更新路线列表
    setRoutes(prev => prev.map(r => r.id === routeId ? updatedRoute : r));
    
    // 如果是当前详情路线，也更新详情
    if (currentDetailRoute?.id === routeId) {
      setCurrentDetailRoute(updatedRoute);
    }

    // 重新在地图上绘制路线
    try {
      await updateRouteOnMap(updatedRoute);
      console.log('路线重新排序和规划完成');
    } catch (error) {
      console.error('重新规划路线失败:', error);
      alert('重新规划路线失败，请重试');
    }
  };

  // 开始编辑路线名称
  const startEditRouteName = (routeId: string, currentName: string) => {
    setEditingRouteName(routeId);
    setTempRouteName(currentName);
  };

  // 保存路线名称
  const saveRouteName = (routeId: string) => {
    if (!tempRouteName.trim()) {
      alert('路线名称不能为空');
      return;
    }

    // 更新路线列表
    setRoutes(prev => prev.map(route => 
      route.id === routeId 
        ? { ...route, name: tempRouteName.trim() }
        : route
    ));

    // 如果是当前详情路线，也更新详情
    if (currentDetailRoute?.id === routeId) {
      setCurrentDetailRoute(prev => prev ? { ...prev, name: tempRouteName.trim() } : null);
    }

    // 清除编辑状态
    setEditingRouteName(null);
    setTempRouteName('');
    
    console.log('路线名称已更新:', tempRouteName.trim());
  };

  // 取消编辑路线名称
  const cancelEditRouteName = () => {
    setEditingRouteName(null);
    setTempRouteName('');
  };

  const startEditPlanName = (planId: string, currentName: string) => {
    setEditingPlanName(planId);
    setTempPlanName(currentName);
  };

  const savePlanName = (planId: string) => {
    if (tempPlanName.trim() && tempPlanName.trim() !== '') {
      renamePlan(planId, tempPlanName.trim());
    }
    setEditingPlanName(null);
    setTempPlanName('');
  };

  const cancelEditPlanName = () => {
    setEditingPlanName(null);
    setTempPlanName('');
  };

  // 方案管理函数
  const createNewPlan = () => {
    // 创建新方案前先清空路径规划队列，但保留缓存
    clearRoutePlanningQueue();
    // 注意：不清空缓存，新方案也可以复用已有的路径缓存
    
    const newPlan: TravelPlan = {
      id: `plan_${Date.now()}`,
      name: `方案${travelPlans.length + 1}`,
      routes: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const updatedPlans = [...travelPlans, newPlan];
    setTravelPlans(updatedPlans);
    savePlansToStorage(updatedPlans);
    
    // 切换到新方案
    switchToPlan(newPlan.id);
    console.log('创建新方案:', newPlan.name);
  };

  const switchToPlan = (planId: string) => {
    const targetPlan = travelPlans.find(plan => plan.id === planId);
    if (targetPlan) {
      // 切换方案前先清空路径规划队列，但保留缓存
      clearRoutePlanningQueue();
      // 注意：不清空缓存，因为相同的起点终点应该复用缓存
      
      setCurrentPlanId(planId);
      setRoutes(targetPlan.routes);
      setCurrentDetailRoute(null); // 清除当前选中的路线详情
      
      // 清理地图
      if (mapRef.current) {
        mapRef.current.clearMap();
      }
      
      // 路线绘制由useEffect自动处理，这里只需要调整视窗
      setTimeout(() => {
        if (targetPlan.routes.length > 0 && targetPlan.routes[0].points.length > 0) {
          fitRouteToView(targetPlan.routes[0]);
        }
      }, 600); // 延迟时间稍长，确保useEffect完成绘制
      
      console.log('切换到方案:', targetPlan.name);
    }
  };

  const deletePlan = (planId: string) => {
    if (travelPlans.length <= 1) {
      alert('至少需要保留一个方案');
      return;
    }
    
    const planToDelete = travelPlans.find(plan => plan.id === planId);
    if (!planToDelete) return;
    
    const confirmed = window.confirm(`确定要删除方案"${planToDelete.name}"吗？\n\n删除后无法恢复。`);
    if (!confirmed) return;
    
    const updatedPlans = travelPlans.filter(plan => plan.id !== planId);
    setTravelPlans(updatedPlans);
    savePlansToStorage(updatedPlans);
    
    // 如果删除的是当前方案，切换到第一个方案
    if (currentPlanId === planId) {
      switchToPlan(updatedPlans[0].id);
    }
    
    console.log('删除方案:', planToDelete.name);
  };

  const renamePlan = (planId: string, newName: string) => {
    if (!newName.trim()) {
      alert('方案名称不能为空');
      return;
    }
    
    const updatedPlans = travelPlans.map(plan => {
      if (plan.id === planId) {
        return {
          ...plan,
          name: newName.trim(),
          updatedAt: new Date()
        };
      }
      return plan;
    });
    
    setTravelPlans(updatedPlans);
    savePlansToStorage(updatedPlans);
    console.log('重命名方案:', newName);
  };

  const copyPlan = (planId: string) => {
    const planToCopy = travelPlans.find(plan => plan.id === planId);
    if (!planToCopy) return;

    const newPlan: TravelPlan = {
      id: Date.now().toString(),
      name: `${planToCopy.name} - 副本`,
      routes: planToCopy.routes.map(route => ({
        ...route,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        polyline: null, // 重置polyline，会在地图上重新绘制
        markers: [] // 重置markers，会在地图上重新绘制
      })),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const updatedPlans = [...travelPlans, newPlan];
    setTravelPlans(updatedPlans);
    savePlansToStorage(updatedPlans);
    
    // 自动切换到新复制的方案
    switchToPlan(newPlan.id);
    console.log('复制方案:', planToCopy.name, '-> ', newPlan.name);
  };

  const getCurrentPlan = (): TravelPlan | null => {
    return travelPlans.find(plan => plan.id === currentPlanId) || null;
  };

  const selectLocation = (poi: any) => {
    if (batchMode) {
      // 批量模式：添加到选中位置列表
      const isAlreadySelected = selectedLocations.some(loc => 
        loc.name === poi.name && loc.address === poi.address
      );
      
      if (!isAlreadySelected) {
        setSelectedLocations(prev => [...prev, poi]);
        console.log('添加位置到批量列表:', poi.name);
      }
      
      // 清空输入但保留建议
      setLocationInput('');
    } else if (isDrawing && poi.location) {
      // 单个模式：直接添加到路线
      const lng = poi.location.lng;
      const lat = poi.location.lat;
      
      const newPoint: TrackPoint = {
        lng,
        lat,
        name: poi.name
      };

      const updatedRoute = {
        ...currentRoute,
        points: [...currentRoute.points, newPoint],
        color: selectedColor,
        routeType: routeType
      };

      setCurrentRoute(updatedRoute);
      updateRouteOnMap(updatedRoute);
      
      // 移动地图到选中位置
      if (mapRef.current) {
        mapRef.current.setZoomAndCenter(10, [lng, lat]);
      }
      
      // 清空输入和建议
      setLocationInput('');
      setSearchSuggestions([]);
    }
  };

  // 路线详情搜索功能
  const searchRouteDetailLocation = async (keyword: string) => {
    if (!keyword.trim() || !AMapRef.current) {
      setRouteDetailSuggestions([]);
      return;
    }

    setIsRouteDetailSearching(true);
    
    try {
      const placeSearch = new AMapRef.current.PlaceSearch({
        city: '全国',
        pageSize: 10
      });

      placeSearch.search(keyword, (status: string, result: any) => {
        setIsRouteDetailSearching(false);
        
        if (status === 'complete' && result.poiList && result.poiList.pois) {
          const formattedPois = result.poiList.pois.map((poi: any) => {
            let lng: number = 0, lat: number = 0;
            
            if (poi.location) {
              if (typeof poi.location === 'string') {
                const coords = poi.location.split(',');
                lng = parseFloat(coords[0]);
                lat = parseFloat(coords[1]);
              } else if (poi.location.lng !== undefined && poi.location.lat !== undefined) {
                lng = poi.location.lng;
                lat = poi.location.lat;
              } else if (poi.location.getLng && poi.location.getLat) {
                lng = poi.location.getLng();
                lat = poi.location.getLat();
              }
            }
            
            return {
              name: poi.name || '未知地点',
              address: poi.address || poi.district || '地址未知',
              location: { lng, lat }
            };
          }).filter((poi: any) => poi.location.lng && poi.location.lat);
          
          setRouteDetailSuggestions(formattedPois);
        } else {
          setRouteDetailSuggestions([]);
        }
      });
    } catch (error) {
      console.error('路线详情搜索失败:', error);
      setIsRouteDetailSearching(false);
      setRouteDetailSuggestions([]);
    }
  };

  const handleRouteDetailInputChange = (value: string) => {
    setRouteDetailSearchInput(value);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (value.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        searchRouteDetailLocation(value);
      }, 500);
    } else {
      setRouteDetailSuggestions([]);
    }
  };

  // 添加位置到指定路线
  const addLocationToRoute = async (routeId: string, poi: any) => {
    if (!poi.location) return;

    // 添加位置前先清空路径规划队列
    clearRoutePlanningQueue();

    const lng = poi.location.lng;
    const lat = poi.location.lat;
    
    console.log('添加位置到路线:', routeId, poi.name);

    // 将坐标转换为道路点
    const roadPoint = await convertToRoadPoint(lng, lat);
    
    const newPoint: TrackPoint = {
      lng: roadPoint.lng,
      lat: roadPoint.lat,
      name: poi.name
    };

    // 更新路线列表
    setRoutes(prevRoutes => 
      prevRoutes.map(route => {
        if (route.id === routeId) {
          const updatedRoute = {
            ...route,
            points: [...route.points, newPoint]
          };
          
          // 在地图上更新路线
          setTimeout(() => {
            updateRouteOnMap(updatedRoute);
          }, 100);
          
          return updatedRoute;
        }
        return route;
      })
    );

    // 如果是当前详情路线，也更新详情
    if (currentDetailRoute?.id === routeId) {
      setCurrentDetailRoute(prev => prev ? {
        ...prev,
        points: [...prev.points, newPoint]
      } : null);
    }

    // 移动地图到新添加的位置
    if (mapRef.current) {
      mapRef.current.setZoomAndCenter(13, [roadPoint.lng, roadPoint.lat]);
    }

    // 清空搜索状态
    setRouteDetailSearchInput('');
    setRouteDetailSuggestions([]);
    setShowRouteDetailSearch(null);
    
    console.log('位置添加完成:', poi.name);
  };

  // 开始为路线添加位置
  const startAddLocationToRoute = (routeId: string) => {
    setShowRouteDetailSearch(routeId);
    setRouteDetailSearchInput('');
    setRouteDetailSuggestions([]);
  };

  // 取消添加位置
  const cancelAddLocationToRoute = () => {
    setShowRouteDetailSearch(null);
    setRouteDetailSearchInput('');
    setRouteDetailSuggestions([]);
  };

  return (
    <div className="map-tracker">
       {/*<div className="header">
        <h1>地图测试</h1>
        <p className="description">在地图上点击或搜索地点来添加轨迹点，创建你的旅行路线。可以拖拽轨迹点来调整位置，系统会自动重新规划路径。</p>
        
       
        <div className="api-notice">
          <strong>注意：</strong> 如果搜索功能无法使用，请检查 <code>src/config/mapConfig.ts</code> 中的高德地图API密钥配置。
          需要在 <a href="https://lbs.amap.com/" target="_blank" rel="noopener noreferrer">高德地图开放平台</a> 申请API Key并开通PlaceSearch服务。
        </div>
      </div> */}
      
        {/* 控制面板 */}
        <div className="control-panel">
          {/* 其他控制元素 */}
          <div className="control-row">
            <div className="color-selector">
              <div className="color-options">
                {colorOptions.map(color => (
                                  <div
                      key={color}
                      className={`color-option ${selectedColor === color ? 'selected' : ''}`}
                      onClick={() => setSelectedColor(color)}
                      style={{ backgroundColor: color }}
                      title={`选择 ${color} 作为路线颜色`}
                    />
                ))}
              </div>
            </div>

            {/* 路径类型选择 */}
            <div className="route-type-selector">
              <select 
                value={routeType} 
                onChange={(e) => setRouteType(e.target.value as 'driving' | 'walking' | 'riding')}
                className="route-type-select"
                title="选择导航类型：驾车路线会避开步行道，步行路线可穿过小径，骑行路线会选择适合自行车的道路"
              >
                <option value="driving">🚗 驾车</option>
                <option value="walking">🚶 步行</option>
                <option value="riding">🚴 骑行</option>
              </select>
            </div>

            <div className="button-group">
          {/* 绘制按钮 - 只在非批量模式时显示 */}
          {!batchMode && (
            !isDrawing ? (
              <button
                onClick={startDrawing}
                className="btn btn-success"
                title="开始绘制新路线：进入绘制模式，可以通过点击地图或搜索地点来添加轨迹点"
              >
                开始规划
              </button>
            ) : (
              <button
                onClick={stopDrawing}
                className="btn btn-danger"
                title="完成当前路线绘制：保存当前路线到路线列表，退出绘制模式"
              >
                完成绘制
              </button>
            )
          )}
          
          {/* 批量规划按钮 - 只在非绘制且非批量模式时显示 */}
          {!batchMode && !isDrawing && (
            <button
              onClick={startBatchMode}
              className="btn btn-warning batch-mode-btn"
              title="批量规划模式：一次性添加多个地点，系统会按顺序自动规划最优路径"
            >
              批量规划
            </button>
          )}
          </div>
        </div>

          {/* 搜索功能 - 只在绘制模式或批量模式时显示 */}
          {(isDrawing || batchMode) && (
            <div className="search-container">
              <input
                type="text"
                value={locationInput}
                onChange={(e) => handleLocationInputChange(e.target.value)}
                placeholder={
                  batchMode ? "搜索地点添加到批量列表..." : 
                  isDrawing ? "输入地点名称搜索..." : 
                  "地址搜索"
                }
                className="search-input"
                title="地点搜索：输入地点名称、地址或关键词，支持全国范围搜索，选择结果后会自动添加到路线中"
              />
              
              {isSearching && (
                <div className="search-loading">
                  搜索中...
                </div>
              )}
              
              {searchSuggestions.length > 0 && (
                <div className="search-suggestions">
                  {searchSuggestions.map((poi, index) => (
                    <div
                      key={index}
                      className="suggestion-item"
                      onClick={() => selectLocation(poi)}
                    >
                      <div className="suggestion-name">{poi.name}</div>
                      <div className="suggestion-address">{poi.address}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 状态显示 */}
          {isRoutePlanning && (
            <div className="planning-status">
              <span className="planning-spinner">⏳</span>
              <span>{planningProgress}</span>
            </div>
          )}

          {isDrawing && (
            <div className="status-group">
              <div className="drawing-status">
                绘制模式：点击地图或搜索地点添加轨迹点 (已添加 {currentRoute.points.length} 个点)
              </div>
              <div 
                className="road-point-hint"
                title="智能道路吸附功能：点击地图时会自动找到最近的道路点，确保路线规划更加准确和实用"
              >
                🛣️ 系统会自动将点击位置转换为最近的道路点，确保路径规划准确
              </div>
              {currentRoute.points.length > 0 && (
                <div 
                  className="drag-hint"
                  title="交互功能说明：拖拽任意轨迹点可以实时调整路线，系统会自动重新计算最优路径"
                >
                  💡 提示：可以拖拽轨迹点来调整位置，系统会自动重新规划路径
                </div>
              )}
            </div>
          )}

          {batchMode && (
            <div className="batch-mode-status">
              <div className="batch-header">
                <span>🎯 批量规划模式 - 已选择 {selectedLocations.length} 个位置</span>
                <button onClick={exitBatchMode} className="btn btn-secondary btn-small">
                  退出批量模式
                </button>
              </div>
              <div 
                className="batch-hint"
                title="批量规划使用方法：1.搜索地点 2.点击添加到列表 3.调整顺序 4.点击创建路线自动规划最优路径"
              >
                搜索并点击地点添加到列表，然后点击"创建路线"按顺序规划路径
              </div>
            </div>
          )}
        </div>

        {/* 颜色选择器弹窗 */}
        {showColorPicker && selectedRouteId && (
          <div className="color-picker-overlay">
            <div className="color-picker-modal">
              <h3>选择路线颜色</h3>
              <div className="color-picker-options">
                {colorOptions.map(color => (
                  <div
                    key={color}
                    className="color-picker-option"
                    onClick={() => changeRouteColor(selectedRouteId, color)}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <button 
                className="btn btn-secondary"
                onClick={() => {
                  setShowColorPicker(false);
                  setSelectedRouteId(null);
                }}
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* 地图容器 */}
        <div className="main-content">
          <div className="map-container">
            <div
              ref={mapContainer}
              className="map-element"
            />
          </div>

          {/* 路线详情面板 */}
          <div className="route-panel">
            {/* 方案切换器 */}
            <div className="plan-selector">
              <div className="plan-tabs">
                {travelPlans.map(plan => (
                  <div
                    key={plan.id}
                    className={`plan-tab ${currentPlanId === plan.id ? 'active' : ''}`}
                    onClick={() => editingPlanName !== plan.id ? switchToPlan(plan.id) : undefined}
                    title={`方案：${plan.name}\n路线数：${plan.routes.length}\n创建时间：${plan.createdAt.toLocaleString()}`}
                  >
                    <div className="plan-content">
                      {editingPlanName === plan.id ? (
                        <input
                          type="text"
                          value={tempPlanName}
                          onChange={(e) => setTempPlanName(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              savePlanName(plan.id);
                            } else if (e.key === 'Escape') {
                              cancelEditPlanName();
                            }
                          }}
                          onBlur={() => savePlanName(plan.id)}
                          className="plan-name-input"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <div className="plan-name-display">
                          <span className="plan-name">{plan.name}</span>
                        </div>
                      )}
                      <span className="plan-info">({plan.routes.length}条路线)</span>
                    </div>
                    <div className="plan-actions">
                      <button
                        className="plan-edit-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditPlanName(plan.id, plan.name);
                        }}
                        title="编辑方案名称"
                      >
                        ✏️
                      </button>
                      <button
                        className="plan-copy-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyPlan(plan.id);
                        }}
                        title="复制此方案"
                      >
                        📋
                      </button>
                      {travelPlans.length > 1 && (
                        <button
                          className="plan-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePlan(plan.id);
                          }}
                          title="删除此方案"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <button
                  className="plan-add-btn"
                  onClick={createNewPlan}
                  title="创建新方案"
                >
                  + 新方案
                </button>
              </div>
            </div>

            {batchMode ? (
              <div className="batch-panel">
                <h3>批量规划 ({selectedLocations.length})</h3>
                {selectedLocations.length === 0 ? (
                  <p className="no-locations">请搜索并选择地点</p>
                ) : (
                  <div className="location-list">
                    {selectedLocations.map((location, index) => (
                      <div key={index} className="location-item">
                        <div className="location-order">{index + 1}</div>
                        <div className="location-info">
                          <div className="location-name">{location.name}</div>
                          <div className="location-address">{location.address}</div>
                        </div>
                        <div className="location-actions">
                          {index > 0 && (
                            <button
                              onClick={() => reorderLocation(index, index - 1)}
                              className="btn-tiny btn-primary"
                              title="上移"
                            >
                              ↑
                            </button>
                          )}
                          {index < selectedLocations.length - 1 && (
                            <button
                              onClick={() => reorderLocation(index, index + 1)}
                              className="btn-tiny btn-primary"
                              title="下移"
                            >
                              ↓
                            </button>
                          )}
                          <button
                            onClick={() => removeSelectedLocation(index)}
                            className="btn-tiny btn-danger"
                            title="删除"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {selectedLocations.length >= 2 && (
                  <button
                    onClick={createBatchRoute}
                    className="btn btn-success create-route-btn"
                  >
                    创建路线 ({selectedLocations.length} 个点)
                  </button>
                )}
              </div>
            ) : isDrawing ? (
              <div className="drawing-panel">
                <h3>正在绘制路线</h3>
                <div className="drawing-info">
                  <div className="route-meta">
                    <div className="route-color-info">
                      <span>颜色：</span>
                      <div 
                        className="color-indicator" 
                        style={{ backgroundColor: currentRoute.color }}
                      ></div>
                    </div>
                    <div className="route-type-info">
                      <span>类型：</span>
                      <span className="type-badge">
                        {currentRoute.routeType === 'driving' ? '🚗 驾车' : 
                         currentRoute.routeType === 'walking' ? '🚶 步行' : '🚴 骑行'}
                      </span>
                    </div>
                  </div>
                </div>

                {currentRoute.points.length === 0 ? (
                  <div 
                    className="drawing-hint"
                    title="开始绘制路线：点击地图任意位置或使用搜索功能添加轨迹点，系统会智能吸附到最近的道路"
                  >
                    <p>点击地图或搜索地点开始添加轨迹点</p>
                    <p className="hint-detail">系统会自动将位置转换为最近的道路点</p>
                  </div>
                ) : (
                  <div className="current-route-points">
                    <div className="points-header">
                      <span>已添加 {currentRoute.points.length} 个点</span>
                    </div>
                    <div className="points-list">
                      {currentRoute.points.map((point, index) => (
                        <div key={index} className="point-item">
                          <div className="point-marker">
                            <div className="point-number" style={{ backgroundColor: currentRoute.color }}>
                              {index === 0 ? '🚩' : 
                               index === currentRoute.points.length - 1 && currentRoute.points.length > 1 ? '🏁' : 
                               index + 1}
                            </div>
                          </div>
                          <div className="point-content">
                            <div className="point-name">{point.name || `位置 ${index + 1}`}</div>
                            <div className="point-coords">
                              {point.lng.toFixed(6)}, {point.lat.toFixed(6)}
                            </div>
                            <div className="point-labels">
                              {index === 0 && <span className="label start">起点</span>}
                              {index === currentRoute.points.length - 1 && currentRoute.points.length > 1 && 
                               <span className="label end">终点</span>}
                              {index > 0 && index < currentRoute.points.length - 1 && 
                               <span className="label waypoint">途经点</span>}
                            </div>
                          </div>
                          {currentRoute.points.length > 1 && (
                            <button
                              onClick={() => removeCurrentRoutePoint(index)}
                              className="remove-point-btn"
                              title="删除此点"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    {currentRoute.points.length >= 2 && (
                      <div className="drawing-actions">
                        <button
                          onClick={stopDrawing}
                          className="btn btn-success complete-btn"
                        >
                          完成路线 ({currentRoute.points.length} 个点)
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="route-detail-panel">
                <h3>路线列表</h3>
                {routes.length > 0 ? (
                  <div className="route-accordion">
                    {routes.map((route, index) => (
                      <div 
                        key={route.id} 
                        className="route-accordion-item"
                        style={{ borderLeftColor: route.color }}
                      >
                        {/* 路线标题栏 */}
                        <div
                          className={`route-header ${expandedRouteId === route.id ? 'expanded' : ''}`}
                          onClick={() => toggleRouteExpansion(route)}
                        >
                          <div className="route-header-left">
                            <div className="route-basic-info">
                              {editingRouteName === route.id ? (
                                <div className="inline-name-editor">
                                  <input
                                    type="text"
                                    value={tempRouteName}
                                    onChange={(e) => setTempRouteName(e.target.value)}
                                    onKeyPress={(e) => {
                                      if (e.key === 'Enter') {
                                        saveRouteName(route.id);
                                      } else if (e.key === 'Escape') {
                                        cancelEditRouteName();
                                      }
                                    }}
                                    onBlur={() => saveRouteName(route.id)}
                                    className="inline-name-input"
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                              ) : (
                                <div className="route-name-display">
                                  <span className="route-name">{route.name}</span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startEditRouteName(route.id, route.name);
                                    }}
                                    className="inline-edit-btn always-visible"
                                    title="编辑名称"
                                  >
                                    ✏️
                                  </button>
                                </div>
                              )}
                              <span className="route-meta">
                                {route.points.length} 个位置 · {calculateTotalDistance(route)} · 
                                {route.routeType === 'driving' ? ' 🚗 驾车' : 
                                 route.routeType === 'walking' ? ' 🚶 步行' : ' 🚴 骑行'}
                              </span>
                            </div>
                          </div>
                          <div className="route-header-right">
                            <span className={`expand-icon ${expandedRouteId === route.id ? 'expanded' : ''}`}>
                              ▼
                            </span>
                          </div>
                        </div>

                        {/* 路线详情内容 - 折叠展开 */}
                        {expandedRouteId === route.id && (
                                                     <div className="route-timeline">
                             {/* <div className="route-stats">
                               <span className="point-count">共 {route.points.length} 个位置</span>
                               <span className="total-distance">总距离: {calculateTotalDistance(route)}</span>
                             </div> */}

                            <div className="timeline-container">
                              {route.points.map((point, index) => (
                                <div key={index} className="timeline-item">
                                  <div className="timeline-marker">
                                    <div 
                                      className="timeline-dot"
                                      style={{ borderColor: route.color, color: route.color }}
                                    >
                                      {index === 0 ? '🚩' : 
                                       index === route.points.length - 1 ? '🏁' : 
                                       index + 1}
                                    </div>
                                    {index < route.points.length - 1 && (
                                      <div className="timeline-connector">
                                        <div className="timeline-line" style={{ borderColor: route.color }}></div>
                                        <div className="distance-label">
                                          {formatDistance(calculateDistance(route.points[index], route.points[index + 1]))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <div className="timeline-content">
                                    <div className="point-header">
                                      <div className="point-info">
                                        <div className="point-name">
                                          {point.name || `位置 ${index + 1}`}
                                        </div>
                                        <div className="point-coordinates">
                                          {point.lng.toFixed(4)}, {point.lat.toFixed(4)}
                                        </div>
                                      </div>
                                      <div className="point-actions">
                                        {index > 0 && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              reorderRoutePoints(route.id, index, index - 1);
                                            }}
                                            className="move-point-btn move-up"
                                            title="上移"
                                          >
                                            ↑
                                          </button>
                                        )}
                                        {index < route.points.length - 1 && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              reorderRoutePoints(route.id, index, index + 1);
                                            }}
                                            className="move-point-btn move-down"
                                            title="下移"
                                          >
                                            ↓
                                          </button>
                                        )}
                                        {route.points.length > 2 && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              deletePointAndReplan(route.id, index);
                                            }}
                                            className="delete-point-btn"
                                            title="删除此点并重新规划"
                                          >
                                            ×
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    {/* <div className="point-labels">
                                      {index === 0 && (
                                        <div className="point-label start-label">起点</div>
                                      )}
                                      {index === route.points.length - 1 && (
                                        <div className="point-label end-label">终点</div>
                                      )}
                                      {index > 0 && index < route.points.length - 1 && (
                                        <div className="point-label waypoint-label">途经点 {index}</div>
                                      )}
                                    </div> */}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* 添加位置功能 */}
                            {showRouteDetailSearch === route.id ? (
                              <div className="add-location-panel">
                                <div className="add-location-header">
                                  <span>添加新位置到 "{route.name}"</span>
                                  <button
                                    onClick={cancelAddLocationToRoute}
                                    className="cancel-add-btn"
                                    title="取消添加"
                                  >
                                    ×
                                  </button>
                                </div>
                                <div className="route-detail-search-container">
                                  <input
                                    type="text"
                                    value={routeDetailSearchInput}
                                    onChange={(e) => handleRouteDetailInputChange(e.target.value)}
                                    placeholder="搜索地点添加到路线..."
                                    className="route-detail-search-input"
                                    autoFocus
                                  />
                                  
                                  {isRouteDetailSearching && (
                                    <div className="route-detail-search-loading">
                                      搜索中...
                                    </div>
                                  )}
                                  
                                  {routeDetailSuggestions.length > 0 && (
                                    <div className="route-detail-search-suggestions">
                                      {routeDetailSuggestions.map((poi, index) => (
                                        <div
                                          key={index}
                                          className="route-detail-suggestion-item"
                                          onClick={() => addLocationToRoute(route.id, poi)}
                                        >
                                          <div className="suggestion-name">{poi.name}</div>
                                          <div className="suggestion-address">{poi.address}</div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="add-location-trigger">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startAddLocationToRoute(route.id);
                                  }}
                                  className="btn btn-success add-location-btn"
                                  title="添加新位置到此路线"
                                >
                                  +添加位置
                                </button>
                              </div>
                            )}

                            {/* 路线操作按钮 */}
                            <div className="route-actions-panel">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleRouteVisibility(route.id);
                                }}
                                className="btn btn-secondary"
                                title="显示/隐藏此路线"
                              >
                                👁️ 切换
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRouteClick(route.id);
                                }}
                                className="btn btn-primary"
                                title="更改路线颜色"
                              >
                                🎨 调色
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteRoute(route.id);
                                }}
                                className="btn btn-danger"
                                title="删除此路线"
                              >
                                🗑️ 删除
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-routes">
                    <p>还没有路线，开始规划你的旅程吧！</p>
                    <p>点击上方的"开始规划"或"批量规划"按钮来创建路线。</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>


    </div>
  );
};

export default MapTracker; 