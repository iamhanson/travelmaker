import React from 'react';

const Destinations: React.FC = () => {
  const destinations = [
    {
      id: 1,
      name: '巴厘岛',
      description: '印尼的热带天堂，拥有美丽的海滩和丰富的文化',
      price: '¥8,999'
    },
    {
      id: 2,
      name: '东京',
      description: '日本首都，现代化都市与传统文化的完美融合',
      price: '¥6,599'
    },
    {
      id: 3,
      name: '巴黎',
      description: '法国的浪漫之都，艺术与时尚的中心',
      price: '¥12,999'
    },
    {
      id: 4,
      name: '纽约',
      description: '美国的不夜城，充满活力的国际大都市',
      price: '¥15,999'
    }
  ];

  return (
    <div style={{ padding: '20px' }}>
      <h1>热门目的地</h1>
      <p>探索世界各地的精彩目的地，开启您的完美旅程。</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '20px' }}>
        {destinations.map(destination => (
          <div key={destination.id} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h3>{destination.name}</h3>
            <p style={{ color: '#666', marginBottom: '10px' }}>{destination.description}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#ff6b35' }}>{destination.price}</span>
              <button style={{ padding: '8px 16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                查看详情
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Destinations; 