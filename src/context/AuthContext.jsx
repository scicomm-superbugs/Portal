import { createContext, useState, useEffect, useContext } from 'react';
import { db } from '../db';
import bcrypt from 'bcryptjs';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isTimeout = false;
    const timeoutId = setTimeout(() => {
      isTimeout = true;
      console.warn('Firebase auth check timed out. Forcing load.');
      setLoading(false);
    }, 3000);

    // Check if user is logged in
    const storedUserId = sessionStorage.getItem('userId');
    if (storedUserId) {
      db.scientists.get(String(storedUserId)).then(scientist => {
        if (isTimeout) return;
        clearTimeout(timeoutId);
        if (scientist) {
          setUser({
            id: scientist.id,
            username: scientist.username,
            name: scientist.name,
            role: scientist.role
          });
        }
        setLoading(false);
      }).catch(err => {
        if (isTimeout) return;
        clearTimeout(timeoutId);
        console.error('Failed to restore session:', err);
        sessionStorage.removeItem('userId');
        setLoading(false);
      });
    } else {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    let scientist = await db.scientists.where('username').equals(username).first();
    
    // Failsafe for master (Instant login bypass)
    if (username === 'master' && password === 'H2CO3NaOH#') {
      if (!scientist) {
        const salt = await bcrypt.genSalt(4);
        const hash = await bcrypt.hash('H2CO3NaOH#', salt);
        const masterId = await db.scientists.add({
          username: 'master',
          passwordHash: hash,
          name: 'Laboratory Master',
          department: 'Directorate',
          employeeId: 'MASTER-001',
          role: 'master',
          accountStatus: 'active'
        });
        scientist = await db.scientists.get(masterId);
      }
      scientist.role = 'master';
    } 
    // Failsafe for admin (Instant login bypass)
    else if (username === 'admin' && password === 'admin123') {
      if (!scientist) {
        const salt = await bcrypt.genSalt(4);
        const hash = await bcrypt.hash('admin123', salt);
        const adminId = await db.scientists.add({
          username: 'admin',
          passwordHash: hash,
          name: 'System Administrator',
          department: 'Administration',
          employeeId: 'ADMIN-001',
          role: 'admin',
          accountStatus: 'active'
        });
        scientist = await db.scientists.get(adminId);
      }
      // If scientist exists, we skip bcrypt compare because we already know they typed the master password!
      scientist.role = 'admin'; // Ensure role is correct
    } else {
      if (!scientist) {
        throw new Error('Invalid username or password');
      }
      
      const isMatch = await bcrypt.compare(password, scientist.passwordHash);
      if (!isMatch) {
        throw new Error('Invalid username or password');
      }

      if (scientist.accountStatus === 'pending') {
        throw new Error('Your account is pending approval by an administrator.');
      }
    }

    const userData = {
      id: scientist.id,
      username: scientist.username,
      name: scientist.name,
      role: scientist.role
    };

    setUser(userData);
    sessionStorage.setItem('userId', scientist.id);
    return userData;
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem('userId');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
