import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navigation: React.FC = () => {
  const location = useLocation();

  const navStyle = {
    backgroundColor: '#2c3e50',
    padding: '1rem 0',
    marginBottom: '0'
  };

  const containerStyle = {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 20px'
  };

  const logoStyle = {
    color: 'white',
    fontSize: '24px',
    fontWeight: 'bold',
    textDecoration: 'none'
  };

  const navListStyle = {
    display: 'flex',
    listStyle: 'none',
    margin: 0,
    padding: 0,
    gap: '25px'
  };

  const getLinkStyle = (path: string) => ({
    color: location.pathname === path ? '#3498db' : 'white',
    textDecoration: 'none',
    fontSize: '16px',
    fontWeight: location.pathname === path ? 'bold' : 'normal',
    transition: 'color 0.3s ease',
    padding: '5px 10px',
    borderRadius: '4px',
    backgroundColor: location.pathname === path ? 'rgba(52, 152, 219, 0.1)' : 'transparent'
  });

  return (
    <nav style={navStyle}>
      <div style={containerStyle}>
        <Link to="/" style={logoStyle}>
          🌍 
        </Link>
        <ul style={navListStyle}>
          <li>
            <Link to="/" style={getLinkStyle('/')}>
              首页
            </Link>
          </li>
          <li>
            <Link to="/destinations" style={getLinkStyle('/destinations')}>
              目的地
            </Link>
          </li>
          <li>
            <Link to="/map-tracker" style={getLinkStyle('/map-tracker')}>
              轨迹追踪
            </Link>
          </li>
          <li>
            <Link to="/about" style={getLinkStyle('/about')}>
              关于我们
            </Link>
          </li>
          <li>
            <Link to="/contact" style={getLinkStyle('/contact')}>
              联系我们
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navigation; 