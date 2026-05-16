import { createContext, useState, useEffect, useContext } from 'react';
import { db, getFirebaseAuth } from '../db';
import { signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider } from 'firebase/auth';
import bcrypt from 'bcryptjs';
import { Capacitor } from '@capacitor/core';

const isMedian = () => {
  return typeof window !== 'undefined' && (
    !!window.gonative || 
    !!window.median || 
    navigator.userAgent.toLowerCase().includes('gonative') ||
    navigator.userAgent.toLowerCase().includes('median')
  );
};

const isCapacitor = () => Capacitor.isNativePlatform();

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      let isTimeout = false;
      const timeoutId = setTimeout(() => {
        isTimeout = true;
        console.warn('Firebase auth check timed out. Forcing load.');
        setLoading(false);
      }, 7000); // Slightly longer timeout for Median redirect processing

      try {
        const auth = getFirebaseAuth();
        
        // 1. Check for Google Redirect Result (Required for Median.co app flow)
        const result = await getRedirectResult(auth);
        
        if (result) {
          const credential = GoogleAuthProvider.credentialFromResult(result);
          const token = credential?.accessToken;
          const gUser = result.user;

          const pendingLink = localStorage.getItem('pendingGoogleLink');
          localStorage.removeItem('pendingGoogleLink');
          const storedUserId = localStorage.getItem('userId');

          if (pendingLink && storedUserId) {
            // LINK flow
            const currentUser = await db.scientists.get(String(storedUserId));
            await db.scientists.update(storedUserId, {
              email: gUser.email, googleLinked: true, googleLinkedEmail: gUser.email,
              googleDriveToken: token || null,
              avatar: currentUser?.avatar || gUser.photoURL
            });
            if (currentUser) {
              setUser({ id: currentUser.id, username: currentUser.username, name: currentUser.name, role: currentUser.role, avatar: currentUser.avatar });
            }
          } else {
            // LOGIN flow
            let scientist = await db.scientists.where('email').equals(gUser.email).first();
            if (!scientist) scientist = await db.scientists.where('username').equals(gUser.email).first();

            if (!scientist) {
              const baseName = gUser.displayName ? gUser.displayName.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '') : 'user';
              const randomNum = Math.floor(Math.random() * 10000);
              const newId = await db.scientists.add({
                username: `${baseName}${randomNum}`,
                email: gUser.email, name: gUser.displayName, avatar: gUser.photoURL,
                department: 'Member', employeeId: 'GOOGLE-' + gUser.uid.substring(0, 8),
                role: 'user', accountStatus: 'pending', googleDriveToken: token || null,
                createdAt: new Date().toISOString()
              });
              scientist = await db.scientists.get(newId);
            } else {
              const updateData = { googleDriveToken: token || null, name: scientist.name || gUser.displayName };
              if (!scientist.avatar || scientist.avatar.includes('googleusercontent.com')) updateData.avatar = gUser.photoURL;
              await db.scientists.update(scientist.id, updateData);
              if (updateData.avatar) scientist.avatar = updateData.avatar;
            }

            if (scientist.accountStatus === 'pending') {
              sessionStorage.setItem('googlePendingMsg', 'Your account is pending approval by an administrator.');
              setLoading(false);
              return;
            }

            setUser({ id: scientist.id, username: scientist.username, name: scientist.name, role: scientist.role, avatar: scientist.avatar });
            localStorage.setItem('userId', scientist.id);
          }
          setLoading(false);
          clearTimeout(timeoutId);
          return;
        }

        // 2. No redirect, check local session
        const storedUserId = localStorage.getItem('userId');
        if (storedUserId) {
          const scientist = await db.scientists.get(String(storedUserId));
          if (!isTimeout && scientist) {
            setUser({ id: scientist.id, username: scientist.username, name: scientist.name, role: scientist.role, avatar: scientist.avatar });
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        if (!isTimeout) {
          clearTimeout(timeoutId);
          setLoading(false);
        }
      }
    };

    initializeAuth();
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
      let gUser, token;
      
      if (isCapacitor()) {
        const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
        GoogleAuth.initialize({
          clientId: '379599502348-vj7r5v0v6u0p0p0p0p0p.apps.googleusercontent.com', // Firebase Client ID
          scopes: ['profile', 'email', 'https://www.googleapis.com/auth/drive.file'],
          grantOfflineAccess: true,
        });
        const nativeUser = await GoogleAuth.signIn();
        const { signInWithCredential } = await import('firebase/auth');
        const credential = GoogleAuthProvider.credential(nativeUser.authentication.idToken);
        const result = await signInWithCredential(auth, credential);
        gUser = result.user;
        token = nativeUser.authentication.accessToken;
      }
      // Special handling for Median.co (GoNative) app wrapper
      else if (isMedian()) {
        if (window.median && window.median.google && window.median.google.login) {
          // Use Median Native Plugin
          const medianResult = await new Promise((resolve, reject) => {
            window.median.google.login({
              callback: function(data) {
                if (data.error) reject(new Error(data.error));
                else resolve(data);
              }
            });
          });
          const { signInWithCredential } = await import('firebase/auth');
          const credential = GoogleAuthProvider.credential(medianResult.idToken);
          const result = await signInWithCredential(auth, credential);
          gUser = result.user;
          token = medianResult.serverAuthCode || medianResult.idToken;
        } else {
          throw new Error('Google Sign-In is blocked in this app wrapper. Please enable the "Google Sign-In" native plugin in your Median.co build settings, or use Email/Password.');
        }
      } else {
        // Standard Web Popup
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        token = credential?.accessToken;
        gUser = result.user;
      }
      
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
        // Only update avatar if user hasn't set a custom one
        const updateData = { 
          googleDriveToken: token || null,
          name: scientist.name || gUser.displayName
        };
        // Preserve custom avatar — only set Google photo if avatar is empty or still a Google URL
        if (!scientist.avatar || scientist.avatar.includes('googleusercontent.com')) {
          updateData.avatar = gUser.photoURL;
        }
        await db.scientists.update(scientist.id, updateData);
        if (updateData.avatar) scientist.avatar = updateData.avatar;
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
      // Token is stored in Firestore on the scientist record, no need for localStorage
      
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
      let gUser, token;

      if (isCapacitor()) {
        const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
        GoogleAuth.initialize({
          clientId: '379599502348-vj7r5v0v6u0p0p0p0p0p.apps.googleusercontent.com',
          scopes: ['profile', 'email', 'https://www.googleapis.com/auth/drive.file'],
          grantOfflineAccess: true,
        });
        const nativeUser = await GoogleAuth.signIn();
        const { linkWithCredential } = await import('firebase/auth');
        const credential = GoogleAuthProvider.credential(nativeUser.authentication.idToken);
        const result = await linkWithCredential(auth.currentUser, credential);
        gUser = result.user;
        token = nativeUser.authentication.accessToken;
      }
      // Special handling for Median.co (GoNative) app wrapper
      else if (isMedian()) {
        if (window.median && window.median.google && window.median.google.login) {
          // Use Median Native Plugin
          const medianResult = await new Promise((resolve, reject) => {
            window.median.google.login({
              callback: function(data) {
                if (data.error) reject(new Error(data.error));
                else resolve(data);
              }
            });
          });
          const { linkWithCredential } = await import('firebase/auth');
          const credential = GoogleAuthProvider.credential(medianResult.idToken);
          const result = await linkWithCredential(auth.currentUser, credential);
          gUser = result.user;
          token = medianResult.serverAuthCode || medianResult.idToken;
        } else {
          throw new Error('Google Link is blocked in this app wrapper. Please enable the "Google Sign-In" native plugin in your Median.co build settings.');
        }
      } else {
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        token = credential?.accessToken;
        gUser = result.user;
      }

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
        googleLinked: true,
        googleLinkedEmail: gUser.email,
        googleDriveToken: token || null,
        avatar: user.avatar || gUser.photoURL
      });
      
      const updatedData = { ...user, email: gUser.email };
      // Token is stored in Firestore on the scientist record, no need for localStorage
      setUser(updatedData);
      return updatedData;
    } catch (error) {
      console.error("Link Google Error:", error);
      throw new Error(error.message || 'Failed to link Google account');
    }
  };

  const unlinkGoogleAccount = async () => {
    if (!user) throw new Error('You must be logged in.');
    await db.scientists.update(user.id, {
      googleLinked: false,
      googleLinkedEmail: null,
      googleDriveToken: null
    });
    localStorage.removeItem('googleDriveToken');
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
    <AuthContext.Provider value={{ user, loading, login, logout, loginWithGoogle, linkGoogleAccount, unlinkGoogleAccount, changePassword, setUser }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
