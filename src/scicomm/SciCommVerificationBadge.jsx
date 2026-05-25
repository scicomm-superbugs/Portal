import React from 'react';

export default function SciCommVerificationBadge({ role, userId, scientists = [], size = 14, style = {}, tooltipPosition = 'top' }) {
  // Resolve role if userId and scientists are provided
  let userRole = role;
  if (!userRole && userId && scientists.length > 0) {
    userRole = scientists.find(s => String(s.id) === String(userId))?.role;
  }

  const isGold = userRole === 'master' || userRole === 'admin';
  const isBlue = userRole === 'scicomm';

  if (!isGold && !isBlue) return null;

  const containerClass = `scicomm-verify-badge-container${tooltipPosition === 'bottom' ? ' tooltip-bottom' : ''}`;

  if (isGold) {
    return (
      <span className={containerClass} style={{ ...style }} onClick={e => e.stopPropagation()}>
        <svg
          className="scicomm-verify-badge gold"
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="10" fill="url(#verifyGoldGrad)" />
          <path
            d="M8.5 12.5L11 15L16 9"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <defs>
            <linearGradient id="verifyGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#ca8a04" />
            </linearGradient>
          </defs>
        </svg>
        <span className="scicomm-verify-tooltip">
          <strong>🏆 Verified Administrator</strong>
          This verified badge is for Administrators and Platform Masters. You can earn it by being promoted to Admin or Master by the platform owners!
        </span>
      </span>
    );
  }

  // isBlue (SciComm role)
  return (
    <span className={containerClass} style={{ ...style }} onClick={e => e.stopPropagation()}>
      <svg
        className="scicomm-verify-badge blue"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="12" cy="12" r="10" fill="url(#verifyBlueGrad)" />
        <path
          d="M8.5 12.5L11 15L16 9"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="verifyBlueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>
        </defs>
      </svg>
      <span className="scicomm-verify-tooltip">
        <strong>🔬 Verified SciComm Member</strong>
        This verified badge is for the Science Communication Team. You can earn it by applying and joining the official Science Communication Team!
      </span>
    </span>
  );
}
