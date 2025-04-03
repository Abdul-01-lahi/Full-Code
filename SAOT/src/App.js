import React, { useEffect, useState } from 'react';
import { database, ref, onValue, set } from './firebase';
import { Line, Bar } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
import './Style.css';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { 
  FaThermometerHalf, 
  FaTint, 
  FaRunning, 
  FaLeaf, 
  FaWater,
  FaHistory,
  FaSun, 
  FaMoon,
  FaPowerOff,
  FaUser,
  FaChartLine,
  FaDownload,
  FaLock
} from 'react-icons/fa';
import { MdEmail, MdPassword } from 'react-icons/md';
import * as XLSX from 'xlsx';

Chart.register(...registerables);

const App = () => {
  // Sensor data states with default values
  const [sensorData, setSensorData] = useState({
    temperature: 0,
    humidity: 0,
    motion: false,
    soilMoisture: 0,
    pumpStatus: false
  });
  const [localPumpStatus, setLocalPumpStatus] = useState(false);
  const [historicalData, setHistoricalData] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // User authentication states
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  
  // UI states
  const [darkMode, setDarkMode] = useState(false);
  const [showPastValues, setShowPastValues] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [manualPumpControl, setManualPumpControl] = useState(false);
  const [soilMoistureThreshold, setSoilMoistureThreshold] = useState(530);

  const auth = getAuth();

  // Export data to Excel
  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(historicalData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "SensorData");
    XLSX.writeFile(workbook, "greenhouse_data.xlsx");
    
    setAlerts(prev => [...prev, { 
      message: 'Data exported successfully', 
      timestamp: new Date().toLocaleString(), 
      type: 'success' 
    }]);
  };

  // Authentication functions
  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      setUser({ email });
    } catch (error) {
      setAlerts(prev => [...prev, { 
        message: error.message, 
        timestamp: new Date().toLocaleString(), 
        type: 'error' 
      }]);
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const handleLogout = () => {
    auth.signOut();
    setUser(null);
  };

  // Fetch sensor data from Firebase
  useEffect(() => {
    const tempRef = ref(database, 'sensorData/temperature');
    const humidityRef = ref(database, 'sensorData/humidity');
    const motionRef = ref(database, 'sensorData/motion');
    const soilRef = ref(database, 'sensorData/soilMoisture');
    const pumpRef = ref(database, 'sensorData/pumpStatus');
    const manualPumpRef = ref(database, 'settings/manualPumpControl');
    const thresholdRef = ref(database, 'settings/soilMoistureThreshold');

    onValue(manualPumpRef, (snapshot) => {
      setManualPumpControl(snapshot.val() || false);
    });

    onValue(thresholdRef, (snapshot) => {
      setSoilMoistureThreshold(snapshot.val() || 530);
    });

    onValue(tempRef, (snapshot) => {
      const temperature = snapshot.val();
      setSensorData(prev => ({ ...prev, temperature: temperature !== null ? temperature : prev.temperature }));
      updateHistoricalData('Temperature', temperature);
      setLoading(false);
    });

    onValue(humidityRef, (snapshot) => {
      const humidity = snapshot.val();
      setSensorData(prev => ({ ...prev, humidity: humidity !== null ? humidity : prev.humidity }));
      updateHistoricalData('Humidity', humidity);
    });

    onValue(motionRef, (snapshot) => {
      const motion = snapshot.val();
      setSensorData(prev => ({ ...prev, motion: motion !== null ? motion : prev.motion }));
      if (motion) {
        updateHistoricalData('Motion', 'Detected');
      }
    });

    onValue(soilRef, (snapshot) => {
      const soilMoisture = snapshot.val();
      setSensorData(prev => ({ ...prev, soilMoisture: soilMoisture !== null ? soilMoisture : prev.soilMoisture }));
      checkAlerts('Soil Moisture', soilMoisture);
      updateHistoricalData('Soil Moisture', soilMoisture);
    });

    onValue(pumpRef, (snapshot) => {
      const pumpStatus = snapshot.val();
      setSensorData(prev => ({ ...prev, pumpStatus }));
      setLocalPumpStatus(pumpStatus); // Keep local state in sync
      updateHistoricalData('Pump', pumpStatus ? 'ON' : 'OFF');
    });

    return () => {
      // Cleanup listeners if needed
    };
  }, []);

  // Greenhouse management functions
  const saveSoilThreshold = () => {
    set(ref(database, 'settings/soilMoistureThreshold'), soilMoistureThreshold);
    
    setAlerts(prev => [...prev, { 
      message: 'Soil moisture threshold saved successfully', 
      timestamp: new Date().toLocaleString(), 
      type: 'success' 
    }]);
  };

  const togglePump = () => {
    const newStatus = !localPumpStatus;
    setLocalPumpStatus(newStatus); // Update local state immediately
    set(ref(database, 'sensorData/pumpStatus'), newStatus);
    setAlerts(prev => [...prev, { 
      message: `Pump manually turned ${newStatus ? 'ON' : 'OFF'}`, 
      timestamp: new Date().toLocaleString(), 
      type: 'info' 
    }]);
  };

  const toggleAutoPump = () => {
    const newMode = !manualPumpControl;
    set(ref(database, 'settings/manualPumpControl'), newMode);
    setManualPumpControl(newMode);
    
    // If switching to auto mode, ensure pump status is set to false initially
    if (!newMode) {
      set(ref(database, 'sensorData/pumpStatus'), false);
    }
    
    setAlerts(prev => [...prev, { 
      message: `Pump set to ${newMode ? 'manual' : 'auto'} mode`, 
      timestamp: new Date().toLocaleString(), 
      type: 'info' 
    }]);
  };

  const checkAlerts = (type, value) => {
    if (value === null) return;
    
    let message = '';
    let alertType = 'warning';
    
    if (type === 'Soil Moisture' && value < (soilMoistureThreshold * 0.7)) {
      message = `Very dry soil: ${value} (Threshold: ${soilMoistureThreshold})`;
      alertType = 'danger';
    } else if (type === 'Soil Moisture' && value > (soilMoistureThreshold * 1.1)) {
      message = `Overwatered soil: ${value} (Threshold: ${soilMoistureThreshold})`;
    }
    
    if (message) {
      setAlerts(prev => {
        if (!prev.some(alert => alert.message === message)) {
          return [...prev, { message, timestamp: new Date().toLocaleString(), type: alertType }];
        }
        return prev;
      });
    }
  };

  const updateHistoricalData = (type, value) => {
    if (value === null) return;
    
    const now = new Date();
    setHistoricalData(prev => [
      ...prev.slice(-1000), // Keep only the last 1000 entries
      { 
        type, 
        value, 
        timestamp: now.toLocaleTimeString(),
        date: now.toLocaleDateString()
      }
    ]);
  };

  if (!user) {
    return (
      <div className={`auth-container ${darkMode ? 'dark' : ''}`}>
        <div className="auth-card">
          <div className="app-logo">
            <FaLeaf className="logo-icon" />
            <h1>GreenHouse Hub</h1>
          </div>
          <h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
          <p>{isLogin ? 'Sign in to access your greenhouse dashboard' : 'Create an account to monitor your greenhouse'}</p>
          
          <form onSubmit={handleAuth}>
            <div className="input-group">
              <MdEmail className="input-icon" />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <MdPassword className="input-icon" />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="primary-btn">
              {isLogin ? 'Login' : 'Sign Up'}
            </button>
          </form>
          
          <p className="auth-toggle" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Need an account? Sign Up' : 'Already have an account? Login'}
          </p>
          
          <div className="auth-footer">
            <p><FaLock /> Your data is secure and private</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading sensor data...</p>
      </div>
    );
  }

  return (
    <div className={`app-container ${darkMode ? 'dark' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-header">
          <FaLeaf className="logo-icon" />
          <h1>GreenHouse Hub</h1>
        </div>
        
        <nav className="sidebar-nav">
          <button 
            className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <FaChartLine /> Dashboard
          </button>
          
          <button 
            className={`nav-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <FaHistory /> History
          </button>
          
          <button 
            className={`nav-btn ${activeTab === 'controls' ? 'active' : ''}`}
            onClick={() => setActiveTab('controls')}
          >
            <FaPowerOff /> Controls
          </button>
        </nav>
        
        <div className="sidebar-footer">
          <button onClick={toggleDarkMode} className="dark-mode-toggle">
            {darkMode ? <FaSun /> : <FaMoon />} {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </aside>
      
      <main className="main-content">
        {activeTab === 'dashboard' && (
          <>
            <header className="content-header">
              <h2>Greenhouse Dashboard</h2>
              <div className="user-info">
                <FaUser /> {user.email}
                <button onClick={exportToExcel} className="export-btn">
                  <FaDownload /> Export Data
                </button>
              </div>
            </header>
            
            <div className="sensor-metrics">
              <div className="metric-card">
                <div className="metric-header">
                  <FaThermometerHalf className="metric-icon" />
                  <h3>Temperature</h3>
                </div>
                <div className="metric-value">
                  {sensorData.temperature !== null ? sensorData.temperature.toFixed(1) : '--'}°C
                </div>
              </div>
              
              <div className="metric-card">
                <div className="metric-header">
                  <FaTint className="metric-icon" />
                  <h3>Humidity</h3>
                </div>
                <div className="metric-value">
                  {sensorData.humidity !== null ? sensorData.humidity.toFixed(1) : '--'}%
                </div>
              </div>
              
              <div className="metric-card">
                <div className="metric-header">
                  <FaRunning className="metric-icon" />
                  <h3>Motion</h3>
                </div>
                <div className={`motion-status ${sensorData.motion ? 'active' : ''}`}>
                  {sensorData.motion ? 'Detected' : 'No motion'}
                </div>
                <div className="motion-indicator">
                  <div className={`indicator ${sensorData.motion ? 'active' : ''}`}></div>
                </div>
              </div>
              
              <div className="metric-card">
                <div className="metric-header">
                  <FaLeaf className="metric-icon" />
                  <h3>Soil Moisture</h3>
                </div>
                <div className="metric-value">
                  {sensorData.soilMoisture !== null ? sensorData.soilMoisture : '--'}
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress" 
                    style={{ 
                      width: `${Math.min(100, ((sensorData.soilMoisture || 0) / 1023) * 100)}%`,
                      backgroundColor: (sensorData.soilMoisture || 0) < (soilMoistureThreshold * 0.7) ? '#f39c12' : 
                                     (sensorData.soilMoisture || 0) > (soilMoistureThreshold * 1.1) ? '#3498db' : '#2ecc71'
                    }}
                  ></div>
                </div>
                <div className="metric-range">Threshold: {soilMoistureThreshold}</div>
              </div>
            </div>
            
            <div className="pump-status-card">
              <h3>Water Pump Status</h3>
              <div className={`pump-indicator ${sensorData.pumpStatus ? 'active' : ''}`}>
                {sensorData.pumpStatus ? 'ACTIVE' : 'INACTIVE'}
              </div>
              <div className="pump-mode">
                Mode: {manualPumpControl ? 'Manual' : 'Auto'}
              </div>
            </div>
            
            <div className="environment-charts">
              <div className="chart-container">
                <h4>Temperature & Humidity (24h)</h4>
                <Line
                  data={{
                    labels: historicalData
                      .filter(d => (d.type === 'Temperature' || d.type === 'Humidity') && 
                              new Date(d.date).toDateString() === new Date().toDateString())
                      .map(d => d.timestamp),
                    datasets: [
                      {
                        label: 'Temperature (°C)',
                        data: historicalData
                          .filter(d => d.type === 'Temperature' && 
                                  new Date(d.date).toDateString() === new Date().toDateString())
                          .map(d => d.value),
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.2)',
                        yAxisID: 'y',
                        tension: 0.4
                      },
                      {
                        label: 'Humidity (%)',
                        data: historicalData
                          .filter(d => d.type === 'Humidity' && 
                                  new Date(d.date).toDateString() === new Date().toDateString())
                          .map(d => d.value),
                        borderColor: '#3498db',
                        backgroundColor: 'rgba(52, 152, 219, 0.2)',
                        yAxisID: 'y1',
                        tension: 0.4
                      }
                    ]
                  }}
                  options={{
                    responsive: true,
                    interaction: {
                      mode: 'index',
                      intersect: false,
                    },
                    scales: {
                      y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                          display: true,
                          text: 'Temperature (°C)'
                        }
                      },
                      y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                          display: true,
                          text: 'Humidity (%)'
                        },
                        min: 0,
                        max: 100,
                        grid: {
                          drawOnChartArea: false,
                        },
                      },
                    }
                  }}
                />
              </div>
            </div>
          </>
        )}
        
        {activeTab === 'history' && (
          <>
            <header className="content-header">
              <h2>Sensor History</h2>
              <button 
                onClick={() => setShowPastValues(!showPastValues)}
                className="toggle-history-btn"
              >
                <FaHistory /> {showPastValues ? 'Hide Detailed History' : 'Show Detailed History'}
              </button>
            </header>
            
            <div className="history-charts">
              <div className="chart-container">
                <h3>Soil Moisture Trend (Last 24 readings)</h3>
                <Line
                  data={{
                    labels: historicalData
                      .filter(d => d.type === 'Soil Moisture')
                      .slice(-24)
                      .map(d => d.timestamp),
                    datasets: [
                      {
                        label: 'Soil Moisture',
                        data: historicalData
                          .filter(d => d.type === 'Soil Moisture')
                          .slice(-24)
                          .map(d => d.value),
                        borderColor: '#2ecc71',
                        backgroundColor: 'rgba(46, 204, 113, 0.2)',
                        fill: true
                      }
                    ]
                  }}
                />
              </div>
            </div>
            
            {showPastValues && (
              <div className="detailed-history">
                <h3>Detailed Sensor Readings</h3>
                <div className="history-table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Value</th>
                        <th>Date</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historicalData.slice().reverse().map((data, index) => (
                        <tr key={index}>
                          <td>{data.type}</td>
                          <td>{data.value} {data.type === 'Temperature' ? '°C' : 
                                           data.type === 'Humidity' ? '%' : ''}</td>
                          <td>{data.date}</td>
                          <td>{data.timestamp}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
        
        {activeTab === 'controls' && (
          <>
            <header className="content-header">
              <h2>Greenhouse Management</h2>
              <p>Control your greenhouse systems</p>
            </header>
            
            <div className="control-panel">
              {/* Watering System Control */}
              <div className="control-card">
                <h3><FaWater /> Watering System</h3>
                <div className="pump-status">
                  Current Status: <span className={`status ${sensorData.pumpStatus ? 'on' : 'off'}`}>
                    {sensorData.pumpStatus ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
                
                <div className="control-buttons">
                  <button 
                    onClick={togglePump}
                    className={`pump-btn ${sensorData.pumpStatus ? 'stop' : 'start'}`}
                    disabled={!manualPumpControl && sensorData.pumpStatus}
                  >
                    {sensorData.pumpStatus ? 'Stop Watering' : 'Start Watering'}
                  </button>
                  
                  <button 
                    onClick={toggleAutoPump}
                    className={`mode-btn ${manualPumpControl ? 'manual' : 'auto'}`}
                  >
                    {manualPumpControl ? 'Switch to AUTO Mode' : 'Switch to MANUAL Mode'}
                  </button>
                </div>
                
                <div className="pump-settings">
                  <h4>Soil Moisture Settings</h4>
                  <div className="threshold-control">
                    <label>Soil Moisture Threshold:</label>
                    <div className="range-inputs">
                      <input 
                        type="number" 
                        value={soilMoistureThreshold}
                        onChange={(e) => setSoilMoistureThreshold(e.target.value)}
                        min="300"
                        max="800"
                      />
                      <p className="info-text">
                        Current reading: {sensorData.soilMoisture !== null ? sensorData.soilMoisture : '--'} 
                        (Higher values mean drier soil)
                      </p>
                    </div>
                  </div>
                  
                  <button 
                    className="save-btn"
                    onClick={saveSoilThreshold}
                  >
                    Save Threshold
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
        
        <div className="alerts-container">
          <h3>Alerts & Notifications</h3>
          {alerts.length > 0 ? (
            <div className="alerts-list">
              {alerts.slice().reverse().map((alert, index) => (
                <div key={index} className={`alert ${alert.type}`}>
                  <div className="alert-message">{alert.message}</div>
                  <div className="alert-time">{alert.timestamp}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-alerts">No alerts to display</div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;