import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Microscope, Atom, Network, GraduationCap, BookOpen, ChevronRight } from 'lucide-react';

// Advanced 3D iOS-style Glass Card Component
const GlassCard = ({ title, subtitle, description, logoSrc, tags, accentColor, onClick, delay }) => {
  const cardRef = useRef(null);
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });
  const [transform, setTransform] = useState('perspective(1000px) rotateX(0deg) rotateY(0deg)');

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Smooth 3D tilt calculation
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -6;
    const rotateY = ((x - centerX) / centerX) * 6;
    
    setTransform(`perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`);
    // Dynamic glare effect following mouse
    setGlare({ x: (x / rect.width) * 100, y: (y / rect.height) * 100, opacity: 1 });
  };

  const handleMouseLeave = () => {
    setTransform('perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)');
    setGlare({ ...glare, opacity: 0 });
  };

  return (
    <div 
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className="glass-card"
      style={{
        '--accent': accentColor,
        transform,
        animationDelay: delay
      }}
    >
      {/* iOS Glossy Reflection */}
      <div className="ios-gloss"></div>

      {/* Dynamic Glare effect */}
      <div 
        className="card-glare" 
        style={{
          background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.15) 0%, transparent 60%)`,
          opacity: glare.opacity
        }}
      />
      
      {/* Glowing Edge Line */}
      <div className="card-edge-glow" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }}></div>
      
      {/* Pop-out Huge Logo */}
      <div className="logo-wrapper">
        <div className="logo-halo" style={{ background: `radial-gradient(circle, ${accentColor} 0%, transparent 70%)` }}></div>
        <img src={logoSrc} alt={title} className="lab-logo" onError={e => e.target.style.display = 'none'} />
      </div>
      
      <div className="card-content">
        <h2 className="card-title">
          {title}
        </h2>
        <div className="card-subtitle" style={{ color: accentColor }}>
          {subtitle}
        </div>
        
        <div className="card-tags">
          {tags.map((tag, i) => (
            <span key={i} className="tag">{tag.icon} {tag.label}</span>
          ))}
        </div>
        
        <p className="card-description">
          {description}
        </p>
        
        <button className="action-button" style={{ '--btn-accent': accentColor }}>
          Initialize Protocol <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
};

export default function Portal() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);

  useEffect(() => {
    document.title = 'Science Communication & Research Hub';
  }, []);

  const handleSelectWorkspace = (workspaceId) => {
    localStorage.setItem('workspaceId', workspaceId);
    sessionStorage.removeItem('userId'); 
    window.location.href = '#/login';
    window.location.reload();
  };

  // Interactive Particle Network Background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let particles = [];
    
    // Setup Canvas
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Mouse Interaction
    let mouse = { x: null, y: null, radius: 180 };
    const handleMouseMove = (e) => { mouse.x = e.x; mouse.y = e.y; };
    const handleMouseLeave = () => { mouse.x = null; mouse.y = null; };
    // Handle touch for mobile
    const handleTouchMove = (e) => { mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseout', handleMouseLeave);
    window.addEventListener('touchmove', handleTouchMove);

    // Particle Class
    class Particle {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 1;
        this.baseX = this.x;
        this.baseY = this.y;
        this.density = (Math.random() * 30) + 1;
        // Sci-fi themed glowing colors
        const colors = ['rgba(16, 185, 129, 0.8)', 'rgba(56, 189, 248, 0.8)', 'rgba(249, 115, 22, 0.8)', 'rgba(168, 85, 247, 0.8)'];
        this.color = colors[Math.floor(Math.random() * colors.length)];
      }
      
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.shadowBlur = 0; // Reset for performance
      }
      
      update() {
        // Natural slight float
        this.baseX += Math.sin(Date.now() / 1000 + this.density) * 0.1;
        this.baseY += Math.cos(Date.now() / 1000 + this.density) * 0.1;

        if (mouse.x != null && mouse.y != null) {
          let dx = mouse.x - this.x;
          let dy = mouse.y - this.y;
          let distance = Math.sqrt(dx * dx + dy * dy);
          let forceDirectionX = dx / distance;
          let forceDirectionY = dy / distance;
          let maxDistance = mouse.radius;
          let force = (maxDistance - distance) / maxDistance;
          let directionX = forceDirectionX * force * this.density * 1.5;
          let directionY = forceDirectionY * force * this.density * 1.5;
          
          if (distance < mouse.radius) {
            this.x -= directionX;
            this.y -= directionY;
          } else {
            if (this.x !== this.baseX) this.x -= (this.x - this.baseX) / 10;
            if (this.y !== this.baseY) this.y -= (this.y - this.baseY) / 10;
          }
        } else {
          if (this.x !== this.baseX) this.x -= (this.x - this.baseX) / 10;
          if (this.y !== this.baseY) this.y -= (this.y - this.baseY) / 10;
        }
        
        this.draw();
      }
    }

    // Initialize Particles
    const init = () => {
      particles = [];
      // Adjust density for mobile vs desktop
      const divider = window.innerWidth < 768 ? 20000 : 12000;
      const numberOfParticles = (canvas.width * canvas.height) / divider;
      for (let i = 0; i < numberOfParticles; i++) {
        particles.push(new Particle());
      }
    };

    // Animation Loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
      }
      connect();
      animationFrameId = requestAnimationFrame(animate);
    };

    // Draw connecting lines
    const connect = () => {
      let opacityValue = 1;
      for (let a = 0; a < particles.length; a++) {
        for (let b = a; b < particles.length; b++) {
          let distance = ((particles[a].x - particles[b].x) * (particles[a].x - particles[b].x))
                       + ((particles[a].y - particles[b].y) * (particles[a].y - particles[b].y));
          if (distance < (canvas.width / 7) * (canvas.height / 7)) {
            opacityValue = 1 - (distance / 20000);
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacityValue * 0.1})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(particles[a].x, particles[a].y);
            ctx.lineTo(particles[b].x, particles[b].y);
            ctx.stroke();
          }
        }
      }
    };

    init();
    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseout', handleMouseLeave);
      window.removeEventListener('touchmove', handleTouchMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <>
      <style>{`
        @keyframes slideUpFade {
          0% { opacity: 0; transform: translateY(40px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }

        .portal-wrapper {
          min-height: 100dvh;
          background: #020617; /* Ultra dark sci-fi background */
          background-image: radial-gradient(circle at 50% -20%, #1e293b 0%, #020617 80%);
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          font-family: 'Inter', system-ui, sans-serif;
          overflow-x: hidden;
          overflow-y: auto;
        }

        #science-network-canvas {
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          z-index: 0;
          pointer-events: none;
        }
        
        .portal-header {
          text-align: center;
          z-index: 10;
          margin-bottom: 5rem;
          margin-top: 2rem;
          animation: slideUpFade 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          position: relative;
        }
        
        .role-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(16, 185, 129, 0.05);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          color: #10b981;
          padding: 0.6rem 1.5rem;
          border-radius: 50px;
          font-weight: 700;
          font-size: 0.8rem;
          letter-spacing: 2px;
          text-transform: uppercase;
          box-shadow: 0 0 20px rgba(16, 185, 129, 0.1);
          margin-bottom: 1.5rem;
          border: 1px solid rgba(16, 185, 129, 0.2);
        }

        .cards-container {
          display: flex;
          gap: 2rem;
          flex-wrap: wrap;
          justify-content: center;
          width: 100%;
          max-width: 1000px;
          z-index: 10;
          perspective: 2000px;
          padding-bottom: 3rem;
        }

        /* --- ADVANCED IOS GLASS CARD --- */
        .glass-card {
          flex: 1;
          min-width: 320px;
          max-width: 380px; /* Smaller, sleeker boxes */
          margin-top: 40px; /* Room for pop-out logo */
          
          /* Authentic iOS Frosted Glass */
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(40px) saturate(180%);
          -webkit-backdrop-filter: blur(40px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 32px;
          padding: 0;
          box-shadow: 0 30px 60px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.1);
          
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          position: relative;
          opacity: 0;
          animation: slideUpFade 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          
          transition: transform 0.2s ease-out, box-shadow 0.3s ease;
          transform-style: preserve-3d;
        }

        .ios-gloss {
          position: absolute;
          top: 0; left: 0; right: 0; height: 50%;
          background: linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 100%);
          border-radius: 32px 32px 0 0;
          pointer-events: none;
        }

        .glass-card:hover {
          box-shadow: 0 40px 80px rgba(0, 0, 0, 0.6), inset 0 1px 2px rgba(255, 255, 255, 0.2), 0 0 40px rgba(255, 255, 255, 0.05);
          z-index: 20;
          border-color: rgba(255, 255, 255, 0.2);
        }

        .card-glare {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          border-radius: 32px;
          pointer-events: none;
          z-index: 10;
          transition: opacity 0.3s;
        }

        .card-edge-glow {
          position: absolute;
          top: 0; left: 10%; right: 10%;
          height: 1px;
          opacity: 0.5;
          transition: opacity 0.3s ease;
        }

        .glass-card:hover .card-edge-glow {
          opacity: 1;
        }

        /* --- POP OUT HUGE LOGO --- */
        .logo-wrapper {
          position: relative;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: -60px; /* Popping out of the box! */
          margin-bottom: 1rem;
          transform: translateZ(40px); /* 3D pop out */
        }

        .logo-halo {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 180px; height: 180px;
          opacity: 0.15;
          filter: blur(30px);
          border-radius: 50%;
          z-index: 0;
          transition: all 0.5s ease;
          animation: pulseGlow 4s infinite;
        }

        .glass-card:hover .logo-halo {
          opacity: 0.3;
          transform: translate(-50%, -50%) scale(1.2);
        }

        .lab-logo {
          height: 220px; /* HUGE LOGO */
          width: 100%;
          max-width: 360px;
          object-fit: contain;
          z-index: 1;
          filter: drop-shadow(0 20px 30px rgba(0,0,0,0.5));
          transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .glass-card:hover .lab-logo {
          transform: scale(1.15) translateY(-5px);
        }

        /* --- CARD CONTENT --- */
        .card-content {
          padding: 0 2rem 2.5rem 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          flex: 1;
          transform: translateZ(20px);
        }

        .card-title {
          font-size: 1.6rem;
          color: #f8fafc;
          margin-bottom: 0.5rem;
          font-weight: 800;
          letter-spacing: -0.5px;
          text-shadow: 0 2px 10px rgba(0,0,0,0.5);
        }

        .card-subtitle {
          font-weight: 700;
          font-size: 0.8rem;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          margin-bottom: 1.5rem;
        }

        .card-tags {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          justify-content: center;
        }

        .tag {
          font-size: 0.7rem;
          font-weight: 600;
          padding: 0.3rem 0.6rem;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: #94a3b8;
          display: flex;
          align-items: center;
          gap: 0.3rem;
          backdrop-filter: blur(10px);
          transition: all 0.3s;
        }

        .glass-card:hover .tag {
          background: rgba(255, 255, 255, 0.1);
          color: #e2e8f0;
        }

        .card-description {
          color: #94a3b8;
          font-size: 0.95rem;
          line-height: 1.6;
          margin-bottom: 2rem;
          font-weight: 400;
          position: relative;
          z-index: 2;
        }

        .action-button {
          margin-top: auto;
          background: rgba(255, 255, 255, 0.03);
          color: #e2e8f0;
          border: 1px solid rgba(255,255,255,0.1);
          padding: 0.8rem 1.5rem;
          border-radius: 50px;
          font-weight: 600;
          font-size: 0.95rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.3s ease;
          transform: translateZ(25px);
          backdrop-filter: blur(10px);
          cursor: pointer;
        }

        .glass-card:hover .action-button {
          background: var(--btn-accent);
          color: white;
          border-color: var(--btn-accent);
          box-shadow: 0 10px 25px rgba(0,0,0,0.3), 0 0 20px var(--btn-accent);
          transform: translateZ(30px) scale(1.05);
        }

        /* --- MOBILE RESPONSIVENESS --- */
        @media (max-width: 768px) {
          .portal-wrapper {
            padding: 1rem;
          }
          .portal-header h1 {
            font-size: 2.2rem !important;
          }
          .portal-header p {
            font-size: 1rem !important;
            padding: 0 1rem;
          }
          .cards-container {
            gap: 4rem; /* More gap for popped out logos on mobile */
            flex-direction: column;
            align-items: center;
          }
          .glass-card {
            width: 100%;
            max-width: 340px;
            margin-top: 50px; /* Room for pop-out logo */
          }
          .lab-logo {
            height: 140px; /* Still huge on mobile */
          }
        }
      `}</style>

      <div className="portal-wrapper">
        
        {/* Interactive Science Network Canvas */}
        <canvas id="science-network-canvas" ref={canvasRef}></canvas>

        <div className="portal-header">
          <div className="role-badge">
            <Users size={16} />
            Science Communication & Research Hub
          </div>
          <h1 style={{ fontSize: '4rem', fontWeight: 900, color: '#f8fafc', marginBottom: '1rem', letterSpacing: '-1.5px', textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
            Inspiring Minds, Advancing Science.
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '1.25rem', maxWidth: '700px', margin: '0 auto', lineHeight: 1.6, fontWeight: 500 }}>
            Welcome to the centralized platform where cutting-edge research meets accessible education. Choose your workspace to begin exploring, teaching, and managing data.
          </p>
        </div>

        <div className="cards-container">
          


          <GlassCard 
            title="Alamein International University"
            subtitle="Faculty of Science Hub"
            description="The interactive hub for the Faculty of Science. Empowering educators to manage inventory, track student progress, and communicate effectively."
            logoSrc="./alamein_logo.png"
            accentColor="#8b5cf6"
            delay="0.4s"
            onClick={() => handleSelectWorkspace('alamein')}
            tags={[
              { icon: <GraduationCap size={12}/>, label: 'Education' },
              { icon: <BookOpen size={12}/>, label: 'Teaching' },
              { icon: <Users size={12}/>, label: 'Faculty Hub' }
            ]}
          />

          <GlassCard 
            title="AIU SciComm Team"
            subtitle="Science Communication Team"
            description="The dedicated platform for the Science Communication Team at Alamein International University. Fostering outreach, collaboration, and scientific dialogue."
            logoSrc="./aiu_scicomm_dark.png"
            accentColor="#10b981"
            delay="0.6s"
            onClick={() => handleSelectWorkspace('aiuscicomm')}
            tags={[
              { icon: <Users size={12}/>, label: 'Outreach' },
              { icon: <Network size={12}/>, label: 'Communication' },
              { icon: <BookOpen size={12}/>, label: 'Science' }
            ]}
          />

        </div>
        
      </div>
    </>
  );
}
