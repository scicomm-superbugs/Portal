import { useLiveCollection } from '../db';
import { Smartphone, Monitor, Apple, Terminal, Download, ChevronLeft, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

export default function SciCommDownload() {
  const downloadsData = useLiveCollection('scicomm_app_downloads') || [];
  const navigate = useNavigate();
  const [userOS, setUserOS] = useState('Windows');

  useEffect(() => {
    const platform = window.navigator.platform.toLowerCase();
    if (platform.includes('mac')) setUserOS('macOS');
    else if (platform.includes('linux')) setUserOS('Linux');
    else if (platform.includes('win')) setUserOS('Windows');
    else if (platform.includes('android')) setUserOS('Android');
    else if (platform.includes('iphone') || platform.includes('ipad')) setUserOS('iOS');
  }, []);

  const platforms = [
    { 
      id: 'android', 
      name: 'Android', 
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="#3ddc84" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.5 8C18.3284 8 19 8.67157 19 9.5V14.5C19 15.3284 18.3284 16 17.5 16C16.6716 16 16 15.3284 16 14.5V9.5C16 8.67157 16.6716 8 17.5 8Z" />
          <path d="M6.5 8C7.32843 8 8 8.67157 8 9.5V14.5C8 15.3284 7.32843 16 6.5 16C5.67157 16 5 15.3284 5 14.5V9.5C5 8.67157 5.67157 8 6.5 8Z" />
          <path d="M15 15.5C15 16.3284 14.3284 17 13.5 17H10.5C9.67157 17 9 16.3284 9 15.5V11H15V15.5Z" />
          <path d="M15 10H9V8C9 6.34315 10.3431 5 12 5C13.6569 5 15 6.34315 15 8V10Z" />
          <path d="M10 7.5C10 7.77614 9.77614 8 9.5 8C9.22386 8 9 7.77614 9 7.5C9 7.22386 9.22386 7 9.5 7C9.77614 7 10 7.22386 10 7.5Z" />
          <path d="M14 7.5C14 7.77614 13.7761 8 13.5 8C13.2239 8 13 7.77614 13 7.5C13 7.22386 13.2239 7 13.5 7C13.7761 7 14 7.22386 14 7.5Z" />
          <path d="M12 5V3M12 3L10 2M12 3L14 2" stroke="#3ddc84" strokeWidth="1" strokeLinecap="round"/>
        </svg>
      ), 
      color: '#3ddc84', 
      desc: 'Native APK for Android devices.',
      req: 'Android 8.0 (Oreo) or higher'
    },
    { 
      id: 'windows', 
      name: 'Windows', 
      icon: <Monitor size={24} />, 
      color: '#00a4ef', 
      desc: 'Desktop application for Windows.',
      req: 'Windows 10 (64-bit) or higher'
    },
    { 
      id: 'ios', 
      name: 'iOS', 
      icon: <Apple size={24} />, 
      color: '#000000', 
      desc: 'Coming soon to the App Store.',
      req: 'iOS 15.0 or higher'
    },
    { 
      id: 'mac', 
      name: 'macOS', 
      icon: <Apple size={24} />, 
      color: '#000000', 
      desc: 'Universal build for Intel & Silicon.',
      req: 'macOS 12 (Monterey) or higher'
    },
    { 
      id: 'linux', 
      name: 'Linux', 
      icon: <Terminal size={24} />, 
      color: '#333333', 
      desc: 'AppImage for major distributions.',
      req: 'glibc 2.28 or higher'
    }
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'white', color: '#0f172a', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Navigation */}
      <nav style={{ padding: '24px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9' }}>
        <button 
          onClick={() => navigate(-1)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontWeight: 600, fontSize: '14px' }}
        >
          <ChevronLeft size={18} /> Back to Portal
        </button>
        <div style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 500 }}>v3.7.2 Stabilized Build</div>
      </nav>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '80px', flexWrap: 'wrap', gap: '40px' }}>
          <div style={{ maxWidth: '600px' }}>
            <h1 style={{ fontSize: '56px', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: '1.1', marginBottom: '24px', color: '#0f172a' }}>
              Download The Portal <span style={{ color: '#0077b5' }}>Across All Devices</span>
            </h1>
            <p style={{ fontSize: '20px', color: '#64748b', lineHeight: '1.6' }}>
              Experience the future of scientific communication with our native application. 
              Designed for speed, security, and seamless workflow integration.
            </p>
          </div>
          <div style={{ background: '#f8fafc', padding: '12px 24px', borderRadius: '100px', border: '1px solid #e2e8f0', fontSize: '14px', fontWeight: 600, color: '#475569' }}>
            View previous releases
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
          {platforms.map(plat => {
            const dl = downloadsData.find(d => d.platform === plat.id);
            const isAvailable = !!dl?.url;
            
            return (
              <div key={plat.id} style={{ 
                padding: '40px', 
                background: isAvailable ? '#f0f7ff' : '#ffffff', 
                border: isAvailable ? '1px solid #0077b5' : '1px solid #e2e8f0',
                borderRadius: '32px',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                  <div style={{ color: plat.color }}>{plat.icon}</div>
                  <h2 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>{plat.name}</h2>
                </div>

                <p style={{ fontSize: '15px', color: '#475569', marginBottom: '32px', lineHeight: '1.6' }}>
                  {plat.desc}
                </p>

                {isAvailable ? (
                  <button 
                    onClick={() => window.open(dl.url, '_blank')}
                    style={{ 
                      width: '100%', 
                      padding: '16px', 
                      borderRadius: '16px', 
                      border: 'none', 
                      background: '#0077b5', 
                      color: 'white', 
                      fontWeight: 700, 
                      fontSize: '16px', 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      boxShadow: '0 10px 20px rgba(0, 119, 181, 0.2)',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseOut={e => e.currentTarget.style.transform = 'none'}
                  >
                    <Download size={18} /> Download Now
                  </button>
                ) : (
                  <div style={{ 
                    padding: '16px', 
                    borderRadius: '16px', 
                    background: '#f1f5f9', 
                    color: '#94a3b8', 
                    fontWeight: 700, 
                    fontSize: '15px', 
                    textAlign: 'center',
                    border: '1px dashed #cbd5e1'
                  }}>
                    Coming Soon
                  </div>
                )}

                <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                    <Info size={14} /> Minimum Requirements
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>
                    {plat.req}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <footer style={{ padding: '80px 40px', textAlign: 'center', color: '#94a3b8', fontSize: '14px', borderTop: '1px solid #f1f5f9' }}>
        © 2026 The Portal Scientific Communication Platform. All rights reserved.
      </footer>
    </div>
  );
}
