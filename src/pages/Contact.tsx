import React, { useState } from 'react';

const Contact: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('感谢您的留言！我们会尽快与您联系。');
    setFormData({ name: '', email: '', message: '' });
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>联系我们</h1>
      <p>有任何问题或建议，请随时与我们联系。</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '20px' }}>
        <div>
          <h2>联系信息</h2>
          <div style={{ marginBottom: '15px' }}>
            <strong>电话:</strong> +86 400-123-4567
          </div>
          <div style={{ marginBottom: '15px' }}>
            <strong>邮箱:</strong> info@travel.com
          </div>
          <div style={{ marginBottom: '15px' }}>
            <strong>地址:</strong> 北京市朝阳区旅游大厦123号
          </div>
          <div style={{ marginBottom: '15px' }}>
            <strong>营业时间:</strong> 周一至周日 9:00-18:00
          </div>
        </div>
        
        <div>
          <h2>发送消息</h2>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>姓名:</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>邮箱:</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>留言:</label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleInputChange}
                required
                rows={5}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', resize: 'vertical' }}
              />
            </div>
            <button
              type="submit"
              style={{ padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              发送消息
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Contact; 