import React from 'react';
import { Link } from 'react-router-dom';

const Home: React.FC = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h1>欢迎来到旅行网站</h1>
      <p>这里是首页，您可以浏览我们的旅行套餐和目的地。</p>
      
      {/* 特色功能卡片 */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: '20px', 
        marginTop: '30px',
        marginBottom: '30px' 
      }}>
        <div style={{ 
          border: '1px solid #ddd', 
          borderRadius: '8px', 
          padding: '20px', 
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          backgroundColor: '#f8f9fa'
        }}>
          <h3 style={{ color: '#007bff' }}>🗺️ 轨迹追踪</h3>
          <p>在地图上绘制您的旅行路线，创建个性化的旅程轨迹，支持多种颜色标记。</p>
          <Link 
            to="/map-tracker" 
            style={{ 
              display: 'inline-block',
              padding: '8px 16px', 
              backgroundColor: '#007bff', 
              color: 'white', 
              textDecoration: 'none',
              borderRadius: '4px',
              marginTop: '10px'
            }}
          >
            开始绘制路线
          </Link>
        </div>
        
        <div style={{ 
          border: '1px solid #ddd', 
          borderRadius: '8px', 
          padding: '20px', 
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          backgroundColor: '#f8f9fa'
        }}>
          <h3 style={{ color: '#28a745' }}>🌟 热门目的地</h3>
          <p>探索全球精选旅游目的地，发现最适合您的完美旅程。</p>
          <Link 
            to="/destinations" 
            style={{ 
              display: 'inline-block',
              padding: '8px 16px', 
              backgroundColor: '#28a745', 
              color: 'white', 
              textDecoration: 'none',
              borderRadius: '4px',
              marginTop: '10px'
            }}
          >
            查看目的地
          </Link>
        </div>
      </div>
      
      <div style={{ marginTop: '20px' }}>
        <h2>热门目的地</h2>
        <ul>
          <li>巴厘岛 - 热带天堂</li>
          <li>东京 - 现代与传统的结合</li>
          <li>巴黎 - 浪漫之都</li>
          <li>纽约 - 不夜城</li>
        </ul>
      </div>
    </div>
  );
};

export default Home; 