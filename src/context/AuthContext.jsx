import { createContext, useState, useEffect, useContext } from 'react';
import { db, getFirebaseAuth } from '../db';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
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
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId) {
      db.scientists.get(String(storedUserId)).then(scientist => {
        if (isTimeout) return;
        clearTimeout(timeoutId);
        if (scientist) {
          setUser({
            id: scientist.id,
            username: scientist.username,
            name: scientist.name,
            role: scientist.role,
            avatar: scientist.avatar
          });
        }
        setLoading(false);
      }).catch(err => {
        if (isTimeout) return;
        clearTimeout(timeoutId);
        console.error('Failed to restore session:', err);
        localStorage.removeItem('userId');
        setLoading(false);
      });
    } else {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    let scientist = await db.scientists.where('username').equals(username).first();
    
    // Allow login by email if username is not found
    if (!scientist) {
      scientist = await db.scientists.where('email').equals(username).first();
    }
    
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
      role: scientist.role,
      avatar: scientist.avatar
    };

    setUser(userData);
    localStorage.setItem('userId', scientist.id);
    return userData;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('userId');
    localStorage.removeItem('googleDriveToken');
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    
    try {
      const auth = getFirebaseAuth();
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;
      const gUser = result.user;
      
      let scientist = await db.scientists.where('email').equals(gUser.email).first();
      
      // Fallback for older Google accounts that saved email as username
      if (!scientist) {
        scientist = await db.scientists.where('username').equals(gUser.email).first();
      }
      
      if (!scientist) {
        const baseName = gUser.displayName ? gUser.displayName.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '') : 'user';
        const randomNum = Math.floor(Math.random() * 10000);
        const newUsername = `${baseName}${randomNum}`;

        const newId = await db.scientists.add({
          username: newUsername,
          email: gUser.email,
          name: gUser.displayName,
          avatar: gUser.photoURL,
          department: 'Member',
          employeeId: 'GOOGLE-' + gUser.uid.substring(0, 8),
          role: 'user',
          accountStatus: 'pending',
          googleDriveToken: token || null,
          createdAt: new Date().toISOString()
        });
        scientist = await db.scientists.get(newId);
      } else {
        await db.scientists.update(scientist.id, { 
          googleDriveToken: token || null,
          avatar: gUser.photoURL,
          name: scientist.name || gUser.displayName
        });
        scientist.avatar = gUser.photoURL;
        if (token) scientist.googleDriveToken = token;
      }

      if (scientist.accountStatus === 'pending') {
        throw new Error('Your account is pending approval by an administrator.');
      }

      const userData = {
        id: scientist.id,
        username: scientist.username,
        name: scientist.name,
        role: scientist.role,
        avatar: scientist.avatar
      };

      setUser(userData);
      localStorage.setItem('userId', scientist.id);
      if (token) localStorage.setItem('googleDriveToken', token);
      
      return userData;
    } catch (error) {
      console.error("Google Sign-in Error:", error);
      throw new Error(error.message || 'Google login failed');
    }
  };

  const linkGoogleAccount = async () => {
    if (!user) throw new Error('You must be logged in to link an account.');
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    try {
      const auth = getFirebaseAuth();
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;
      const gUser = result.user;

      // Check if this Google account is already linked to ANOTHER user profile
      let existingEmailUser = await db.scientists.where('email').equals(gUser.email).first();
      if (!existingEmailUser) {
        existingEmailUser = await db.scientists.where('username').equals(gUser.email).first();
      }

      if (existingEmailUser && String(existingEmailUser.id) !== String(user.id)) {
        // Delete the duplicate auto-generated account before linking
        await db.scientists.delete(existingEmailUser.id);
      }

      await db.scientists.update(user.id, { 
        email: gUser.email,
        googleDriveToken: token || null,
        avatar: user.avatar || gUser.photoURL
      });
      
      const updatedData = { ...user, email: gUser.email };
      if (token) localStorage.setItem('googleDriveToken', token);
      setUser(updatedData);
      return updatedData;
    } catch (error) {
      console.error("Link Google Error:", error);
      throw new Error(error.message || 'Failed to link Google account');
    }
  };

  const changePassword = async (oldPassword, newPassword) => {
    if (!user) throw new Error('You must be logged in.');
    
    // Validate current password
    const scientist = await db.scientists.get(user.id);
    if (!scientist) throw new Error('Account not found.');
    
    // If it's a new account without a password (Google login), we can just set the new password.
    if (scientist.passwordHash) {
      const isMatch = await bcrypt.compare(oldPassword, scientist.passwordHash);
      if (!isMatch) throw new Error('Incorrect current password.');
    }
    
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);
    await db.scientists.update(user.id, { passwordHash: hash });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, loginWithGoogle, linkGoogleAccount, changePassword, setUser }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
