// ===== REACTION TYPES =====
export const REACTIONS = [
  { key: 'like', emoji: '👍', label: 'Like', color: '#0a66c2' },
  { key: 'love', emoji: '❤️', label: 'Love', color: '#df4f60' },
  { key: 'support', emoji: '👏', label: 'Support', color: '#6dae4f' },
  { key: 'care', emoji: '🤗', label: 'Care', color: '#eaaa30' },
  { key: 'brilliant', emoji: '💡', label: 'Brilliant', color: '#f5c400' },
  { key: 'fire', emoji: '🔥', label: 'Fire', color: '#e16745' },
  { key: 'genius', emoji: '🧠', label: 'Genius', color: '#9b59b6' },
];

// ===== AVATARS (SVG-based science-themed) =====
export const AVATARS = [
  { id: 'av1', svg: '🧬', label: 'DNA Explorer', bg: '#dbeafe' },
  { id: 'av2', svg: '🔬', label: 'Microscope Master', bg: '#fce7f3' },
  { id: 'av3', svg: '🧪', label: 'Lab Enthusiast', bg: '#d1fae5' },
  { id: 'av4', svg: '⚗️', label: 'Chemistry Wizard', bg: '#fef3c7' },
  { id: 'av5', svg: '🧫', label: 'Petri Dish Pro', bg: '#ede9fe' },
  { id: 'av6', svg: '🦠', label: 'Micro Hunter', bg: '#ccfbf1' },
  { id: 'av7', svg: '🌡️', label: 'Temperature Tamer', bg: '#fee2e2' },
  { id: 'av8', svg: '🧲', label: 'Magnetic Mind', bg: '#e0e7ff' },
  { id: 'av9', svg: '🔭', label: 'Star Gazer', bg: '#1e1b4b', textColor: '#fff' },
  { id: 'av10', svg: '🪐', label: 'Cosmic Soul', bg: '#312e81', textColor: '#fff' },
  { id: 'av11', svg: '🧑‍🔬', label: 'Scientist', bg: '#ecfdf5' },
  { id: 'av12', svg: '🧑‍🏫', label: 'Educator', bg: '#fff7ed' },
  { id: 'av13', svg: '🎙️', label: 'Speaker', bg: '#fef2f2' },
  { id: 'av14', svg: '📡', label: 'Broadcaster', bg: '#f0f9ff' },
  { id: 'av15', svg: '🧠', label: 'Big Brain', bg: '#fdf4ff' },
  { id: 'av16', svg: '🚀', label: 'Rocket Scientist', bg: '#0f172a', textColor: '#fff' },
  { id: 'av17', svg: '⚛️', label: 'Atomic', bg: '#dbeafe' },
  { id: 'av18', svg: '🌍', label: 'Global Thinker', bg: '#dcfce7' },
  { id: 'av19', svg: '💻', label: 'Tech Savvy', bg: '#f1f5f9' },
  { id: 'av20', svg: '🎓', label: 'Academic', bg: '#fefce8' },
];

// ===== AUTO-ACHIEVEMENT TAGS =====
// { threshold: minimum score to unlock, tag: display name }
export const AUTO_TAGS = [
  { threshold: 50, tag: '🧬 PCR Addict' },
  { threshold: 100, tag: '🧫 Cell Division Survivor' },
  { threshold: 150, tag: '☕ Caffeine Catalyst' },
  { threshold: 220, tag: '⚛️ Periodic Table Menace' },
  { threshold: 300, tag: '🌌 Quantum Confused' },
  { threshold: 400, tag: '☣️ Biohazard Baby' },
  { threshold: 550, tag: '🔬 Microscopy Maniac' },
  { threshold: 750, tag: '🏅 Nobel? Maybe.' },
  { threshold: 1000, tag: '👻 Lab Coat Ghost' },
  { threshold: 1300, tag: '🧟 Data Zombie' },
  { threshold: 1700, tag: '🧠 Neuron on Fire' },
  { threshold: 2200, tag: '⏳ Mutation Loading' },
  { threshold: 2800, tag: '👺 Citation Goblin' },
  { threshold: 3500, tag: '🍎 Gravity Denier' },
];

export function calculateScore({ completedTasks = 0, likesReceived = 0, meetingsAttended = 0, connectionCount = 0, reputationBonus = 0, role = 'user' }) {
  if (role === 'master' || role === 'admin') return Infinity;
  return (completedTasks * 25) + (likesReceived * 5) + (meetingsAttended * 15) + (connectionCount * 2) + reputationBonus;
}

export function getUnlockedTags(score) {
  return AUTO_TAGS.filter(t => score >= t.threshold).map(t => t.tag);
}

export function getNextTag(score) {
  return AUTO_TAGS.find(t => t.threshold > score) || null;
}

// ===== USER LEVELS =====
export const USER_LEVELS = [
  { threshold: 0, level: 1, title: 'Novice', color: '#6b7280', bg: '#f3f4f6' },
  { threshold: 150, level: 2, title: 'Apprentice', color: '#10b981', bg: '#ecfdf5' },
  { threshold: 300, level: 3, title: 'Explorer', color: '#0ea5e9', bg: '#e0f2fe' },
  { threshold: 500, level: 4, title: 'Analyst', color: '#8b5cf6', bg: '#ede9fe' },
  { threshold: 800, level: 5, title: 'Researcher', color: '#ec4899', bg: '#fce7f3' },
  { threshold: 1200, level: 6, title: 'Scholar', color: '#f43f5e', bg: '#ffe4e6' },
  { threshold: 2000, level: 7, title: 'Innovator', color: '#d946ef', bg: '#fae8ff' },
  { threshold: 3000, level: 8, title: 'Luminary', color: '#f59e0b', bg: '#fef3c7' },
  { threshold: 5000, level: 9, title: 'Visionary', color: '#14b8a6', bg: '#ccfbf1' },
  { threshold: 8000, level: 10, title: 'Master', color: '#ef4444', bg: '#fee2e2' }
];

export function getUserLevel(score) {
  if (score === Infinity) return { level: '∞', title: 'Infinite', color: '#10b981', bg: '#ecfdf5', isInfinite: true };
  let current = USER_LEVELS[0];
  for (const l of USER_LEVELS) {
    if (score >= l.threshold) current = l;
    else break;
  }
  const next = USER_LEVELS.find(l => l.threshold > score) || null;
  let progress = 100;
  if (next) {
    progress = Math.min(100, Math.max(0, ((score - current.threshold) / (next.threshold - current.threshold)) * 100));
  }
  return { ...current, next, progress };
}

// ===== SPAM DETECTION =====
export function isSpamPost(content, recentPosts) {
  if (!content || content.trim().length < 10) return true;
  // Check for repetitive content in last 5 posts
  const recent = recentPosts.slice(0, 5);
  for (const p of recent) {
    if (p.content === content) return true;
    // Similarity check (same first 20 chars)
    if (p.content.substring(0, 20) === content.substring(0, 20)) return true;
  }
  return false;
}

// ===== TIME HELPERS =====
export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  return new Date(dateStr).toLocaleDateString();
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
