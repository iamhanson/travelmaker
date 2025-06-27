import React from 'react';

const About: React.FC = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h1>关于我们</h1>
      <p>我们是一家专业的旅行服务公司，致力于为客户提供最优质的旅行体验。</p>
      <div style={{ marginTop: '20px' }}>
        <h2>我们的使命</h2>
        <p>让每一次旅行都成为难忘的回忆，为客户创造独特的旅行体验。</p>
        
        <h2>我们的服务</h2>
        <ul>
          <li>定制旅行路线</li>
          <li>酒店预订</li>
          <li>机票预订</li>
          <li>当地导游服务</li>
          <li>24小时客户支持</li>
        </ul>
      </div>
    </div>
  );
};

export default About; 