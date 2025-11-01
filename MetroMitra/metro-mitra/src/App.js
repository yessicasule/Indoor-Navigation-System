import React, { useState } from 'react';
import { QrCode, Camera, Home, Map, Navigation, Compass, User, Train } from 'lucide-react';
import PlanRouteScreen from './components/PlanRouteScreen'; 
import './App.css'; 

const MetroMitra = () => {
  const [activeTab, setActiveTab] = useState('home');

  
  const HomeScreen = () => (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div style={{ textAlign: 'center', paddingTop: '32px', paddingBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '12px' }}>
          <Train style={{ width: '40px', height: '40px', color: '#006494' }} />
          <h1 style={{ fontSize: '36px', fontWeight: 'bold', color: '#13293d', margin: 0 }}>Metro Mitra</h1>
        </div>
        <p style={{ color: '#247ba0', margin: 0 }}>Your Smart Mumbai Metro Companion</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <button
          onClick={() => setActiveTab('ar')}
          style={styles.gridButton}
        >
          <QrCode style={{ width: '32px', height: '32px', margin: '0 auto 12px', color: '#006494' }} />
          <span style={styles.gridButtonText}>Scan QR</span>
        </button>
        <button
          onClick={() => setActiveTab('plan_route')} // This now goes to our new screen
          style={styles.gridButton}
        >
          <Map style={{ width: '32px', height: '32px', margin: '0 auto 12px', color: '#006494' }} />
          <span style={styles.gridButtonText}>Plan Route</span>
        </button>
        <button
          onClick={() => setActiveTab('nearby')}
          style={styles.gridButton}
        >
          <Compass style={{ width: '32px', height: '32px', margin: '0 auto 12px', color: '#006494' }} />
          <span style={styles.gridButtonText}>Nearby Spots</span>
        </button>
        <button
          style={styles.gridButton}
        >
          <Navigation style={{ width: '32px', height: '32px', margin: '0 auto 12px', color: '#006494' }} />
          <span style={styles.gridButtonText}>My Trips</span>
        </button>
      </div>

      <div style={{ padding: '24px', borderRadius: '8px', backgroundColor: '#e8f1f2' }}>
        <h3 style={{ fontWeight: 'bold', marginBottom: '8px', color: '#13293d', marginTop: 0 }}>Quick Tip</h3>
        <p style={{ fontSize: '14px', color: '#247ba0', margin: 0 }}>Scan QR codes at station entrances for instant AR navigation inside the metro</p>
      </div>
    </div>
  );

  const MapScreen = () => ( <div style={{padding: '24px'}}><h2>Metro Map Screen</h2></div> );
  const ARScreen = () => ( <div style={{padding: '24px'}}><h2>AR Screen</h2></div> );
  const NearbyScreen = () => ( <div style={{padding: '24px'}}><h2>Nearby Spots Screen</h2></div> );
  const ProfileScreen = () => ( <div style={{padding: '24px'}}><h2>Profile Screen</h2></div> );

  const renderContent = () => {
    switch (activeTab) {
      case 'home': return <HomeScreen />;
      case 'plan_route': return <PlanRouteScreen />; // RENDER the new component
      case 'map': return <MapScreen />;
      case 'ar': return <ARScreen />;
      case 'nearby': return <NearbyScreen />;
      case 'profile': return <ProfileScreen />;
      default: return <HomeScreen />;
    }
  };

  return (
    <div style={{ maxWidth: '448px', margin: '0 auto', minHeight: '100vh', paddingBottom: '80px', position: 'relative', backgroundColor: '#ffffff' }}>
      {renderContent()}

      {activeTab !== 'ar' && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: 'white', boxShadow: '0 -4px 6px rgba(0,0,0,0.1)', borderTop: '1px solid #e8f1f2', maxWidth: '448px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '12px 16px' }}>
            <button
              onClick={() => setActiveTab('home')}
              style={{ ...styles.navButton, color: activeTab === 'home' || activeTab === 'plan_route' ? '#1b98e0' : '#247ba0' }} // Keep Home active on Plan Route screen
            >
              <Home style={{ width: '24px', height: '24px' }} />
              <span style={styles.navText}>Home</span>
            </button>
            <button
              onClick={() => setActiveTab('map')}
              style={{ ...styles.navButton, color: activeTab === 'map' ? '#1b98e0' : '#247ba0' }}
            >
              <Map style={{ width: '24px', height: '24px' }} />
              <span style={styles.navText}>Map</span>
            </button>
            <button
              onClick={() => setActiveTab('ar')}
              style={styles.cameraButton}
            >
              <div style={styles.cameraButtonCircle}>
                <Camera style={{ width: '28px', height: '28px' }} />
              </div>
            </button>
            <button
              onClick={() => setActiveTab('nearby')}
              style={{ ...styles.navButton, color: activeTab === 'nearby' ? '#1b98e0' : '#247ba0' }}
            >
              <Compass style={{ width: '24px', height: '24px' }} />
              <span style={styles.navText}>Nearby</span>
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              style={{ ...styles.navButton, color: activeTab === 'profile' ? '#1b98e0' : '#247ba0' }}
            >
              <User style={{ width: '24px', height: '24px' }} />
              <span style={styles.navText}>Profile</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  gridButton: { padding: '32px', borderRadius: '8px', backgroundColor: '#e8f1f2', border: 'none', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'},
  gridButtonText: { display: 'block', fontWeight: '600', color: '#13293d' },
  navButton: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer' },
  navText: { fontSize: '12px' },
  cameraButton: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '-32px', background: 'none', border: 'none', cursor: 'pointer' },
  cameraButtonCircle: { width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 15px rgba(0,0,0,0.1)', color: 'white', backgroundColor: '#1b98e0' }
};

export default MetroMitra;

