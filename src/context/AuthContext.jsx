import { createContext, useState, useEffect, useContext } from 'react';
import { db, getFirebaseAuth } from '../db';
import { signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider } from 'firebase/auth';
import bcrypt from 'bcryptjs';
import { Capacitor } from '@capacitor/core';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '../db';
import { safeLocalStorage, safeSessionStorage, getCookie, setCookie, deleteCookie } from '../utils/safeStorage';


const isMedian = () => {
  return typeof window !== 'undefined' && (
    !!window.gonative || 
    !!window.median || 
    navigator.userAgent.toLowerCase().includes('gonative') ||
    navigator.userAgent.toLowerCase().includes('median')
  );
};

const isCapacitor = () => {
  return (typeof window !== 'undefined' && (
    window.Capacitor?.isNative || 
    !!window.Capacitor?.Commands ||
    navigator.userAgent.toLowerCase().includes('capacitor') ||
    window.location.protocol === 'capacitor:' ||
    !!window.android
  ));
};

const AuthContext = createContext(null);

const getUserId = () => {
  let uid = safeLocalStorage.getItem('userId');
  if (uid) return uid;
  uid = safeSessionStorage.getItem('userId');
  if (uid) return uid;
  return getCookie('userId');
};

const getWorkspaceId = () => {
  let ws = safeLocalStorage.getItem('workspaceId');
  if (ws) return ws;
  ws = safeSessionStorage.getItem('workspaceId');
  if (ws) return ws;
  return getCookie('workspaceId');
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleFirebaseUserLogin = async (gUser, token) => {
    if (!gUser) {
      throw new Error('No user returned from Google sign-in');
    }

    const userEmail = gUser.email;
    const photo = gUser.photoURL || gUser.photoUrl;
    const displayName = gUser.displayName || gUser.name || 'User';

    let scientist = await db.scientists.where('email').equals(userEmail).first();
    // Fallback for older Google accounts that saved email as username
    if (!scientist) {
      scientist = await db.scientists.where('username').equals(userEmail).first();
    }
    // Fallback: check by googleLinkedEmail
    if (!scientist) {
      scientist = await db.scientists.where('googleLinkedEmail').equals(userEmail).first();
    }

    if (userEmail === 'abdullah.amr.makky@gmail.com') {
      if (!scientist) {
        const newId = await db.scientists.add({
          username: 'abdullah.amr871',
          email: userEmail,
          name: displayName || 'Abdullah Amr Maged',
          avatar: photo || null,
          department: 'Directorate',
          employeeId: 'MASTER-001',
          role: 'master',
          accountStatus: 'active',
          googleDriveToken: token || null,
          createdAt: new Date().toISOString()
        });
        scientist = await db.scientists.get(newId);
      } else if (scientist.role !== 'master' || scientist.accountStatus !== 'active') {
        await db.scientists.update(scientist.id, {
          role: 'master',
          accountStatus: 'active'
        });
        scientist.role = 'master';
        scientist.accountStatus = 'active';
      }
    }

    const pendingLink = localStorage.getItem('pendingGoogleLink');
    localStorage.removeItem('pendingGoogleLink');
    const storedUserId = localStorage.getItem('userId');

    if (pendingLink && storedUserId) {
      // LINK flow
      const currentUser = await db.scientists.get(String(storedUserId));
      await db.scientists.update(storedUserId, {
        email: userEmail,
        googleLinked: true,
        googleLinkedEmail: userEmail,
        googleDriveToken: token || null,
        avatar: currentUser?.avatar || photo || null
      });
      if (currentUser) {
        const updatedUser = { id: currentUser.id, username: currentUser.username, name: currentUser.name, role: currentUser.role, avatar: currentUser.avatar };
        setUser(updatedUser);
        return updatedUser;
      }
    } else {
      // LOGIN flow
      if (!scientist) {
        const baseName = displayName ? displayName.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '') : 'user';
        const randomNum = Math.floor(Math.random() * 10000);
        const newUsername = `${baseName}${randomNum}`;

        const newId = await db.scientists.add({
          username: newUsername,
          email: userEmail,
          name: displayName,
          avatar: photo || null,
          department: 'Member',
          employeeId: 'GOOGLE-' + gUser.uid.substring(0, 8),
          role: 'user',
          accountStatus: 'pending',
          googleDriveToken: token || null,
          createdAt: new Date().toISOString()
        });
        scientist = await db.scientists.get(newId);
      } else {
          const updateData = { 
            googleDriveToken: token || null,
            name: scientist.name || displayName
          };
          if (!scientist.avatar || scientist.avatar.includes('googleusercontent.com')) {
            updateData.avatar = photo || null;
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
      safeLocalStorage.setItem('userId', scientist.id);
      safeSessionStorage.setItem('userId', scientist.id);
      setCookie('userId', scientist.id, 365);
      
      const ws = getWorkspaceId();
      if (ws) {
        safeLocalStorage.setItem('workspaceId', ws);
        safeSessionStorage.setItem('workspaceId', ws);
        setCookie('workspaceId', ws, 365);
        try {
            await db.scientists.update(scientist.id, { lastActiveWorkspace: ws });
        } catch (e) {
          console.warn("Failed to update lastActiveWorkspace:", e);
        }
      }
      return userData;
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      let isTimeout = false;
      const timeoutId = setTimeout(() => {
        isTimeout = true;
        console.warn('Firebase auth check timed out. Forcing load.');
        setLoading(false);
      }, 7000);

      try {
        if (isCapacitor()) {
          try {
            const { App } = await import('@capacitor/app');
            App.addListener('appUrlOpen', async (data) => {
              console.log('App opened with URL:', data.url);
              if (data.url.includes('google-oauth-callback')) {
                let idToken = '';
                let accessToken = '';
                
                try {
                  const urlString = data.url;
                  const searchPart = urlString.split('?')[1];
                  if (searchPart) {
                    const params = new URLSearchParams(searchPart);
                    idToken = params.get('idToken') || '';
                    accessToken = params.get('accessToken') || '';
                  }
                } catch (parseErr) {
                  console.error('Failed to parse deep link search params:', parseErr);
                }
                
                if (idToken) {
                  setLoading(true);
                  try {
                    const auth = getFirebaseAuth();
                    const { signInWithCredential } = await import('firebase/auth');
                    const credential = GoogleAuthProvider.credential(idToken);
                    const webResult = await signInWithCredential(auth, credential);
                    const gUser = webResult.user;
                    
                    await handleFirebaseUserLogin(gUser, accessToken);
                  } catch (err) {
                    console.error('Deep link Google Sign-In failed:', err);
                    sessionStorage.setItem('googlePendingMsg', 'Login failed: ' + err.message);
                    window.location.reload();
                  } finally {
                    setLoading(false);
                  }
                }
              }
            });
          } catch (err) {
            console.warn('Failed to register deep link listener:', err);
          }
        }
        const auth = getFirebaseAuth();
        
        // 1. Check for Google Redirect Result (Required for Median.co app flow)
        let result = null;
        try {
          result = await getRedirectResult(auth);
        } catch (e) {
          console.warn("getRedirectResult not available or failed:", e);
        }
        
        if (result) {
          const credential = GoogleAuthProvider.credentialFromResult(result);
          const token = credential?.accessToken;
          const gUser = result.user;
          await handleFirebaseUserLogin(gUser, token);
          setLoading(false);
          clearTimeout(timeoutId);
          return;
        }

        // 2. Check if already signed in locally
        let storedUserId = getUserId();
        let currentWorkspace = getWorkspaceId();
        
        if (storedUserId) {
          let scientist = null;
          let foundWorkspace = null;
          
          if (storedUserId === 'master-bypass') {
            // master-bypass is deprecated; clear storage
            safeLocalStorage.removeItem('userId');
            safeSessionStorage.removeItem('userId');
            deleteCookie('userId');
          } else if (currentWorkspace) {
            try {
              scientist = await db.scientists.get(String(storedUserId));
              if (scientist) foundWorkspace = currentWorkspace;
            } catch (err) {
              console.warn("Failed to fetch scientist from primary workspace:", err);
            }
          }
          
          if (!scientist) {
            // Scan workspaces to recover the correct workspace
            const prefixes = ['aiuscicomm', 'alamein', 'compchem', ''];
            for (const prefix of prefixes) {
              try {
                const colName = prefix ? `${prefix}_scientists` : 'scientists';
                const docRef = doc(firestore, colName, String(storedUserId));
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                  scientist = { id: docSnap.id, ...docSnap.data() };
                  foundWorkspace = prefix || 'compchem';
                  break;
                }
              } catch (e) {
                // Skip if error/permission denied for this prefix
              }
            }
          }
          
          if (!isTimeout && scientist) {
            // Restore workspace if found and different
            if (foundWorkspace && foundWorkspace !== currentWorkspace) {
              safeLocalStorage.setItem('workspaceId', foundWorkspace);
              safeSessionStorage.setItem('workspaceId', foundWorkspace);
              setCookie('workspaceId', foundWorkspace, 365);
              currentWorkspace = foundWorkspace;
            }
            
            // Sync with cookie/storage
            safeLocalStorage.setItem('userId', scientist.id);
            safeSessionStorage.setItem('userId', scientist.id);
            setCookie('userId', scientist.id, 365);
            
            // If the scientist record has a lastActiveWorkspace, restore it too
            if (scientist.lastActiveWorkspace && scientist.lastActiveWorkspace !== currentWorkspace) {
              safeLocalStorage.setItem('workspaceId', scientist.lastActiveWorkspace);
              safeSessionStorage.setItem('workspaceId', scientist.lastActiveWorkspace);
              setCookie('workspaceId', scientist.lastActiveWorkspace, 365);
              
              // Force reload to let changes take effect in routes
              window.location.reload();
              return;
            }
            
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

    const userData = {
      id: scientist.id,
      username: scientist.username,
      name: scientist.name,
      role: scientist.role,
      avatar: scientist.avatar
    };

    setUser(userData);
    safeLocalStorage.setItem('userId', scientist.id);
    safeSessionStorage.setItem('userId', scientist.id);
    setCookie('userId', scientist.id, 365);
    
    const ws = getWorkspaceId();
    if (ws) {
      safeLocalStorage.setItem('workspaceId', ws);
      safeSessionStorage.setItem('workspaceId', ws);
      setCookie('workspaceId', ws, 365);
      try {
        await db.scientists.update(scientist.id, { lastActiveWorkspace: ws });
      } catch (e) {
        console.warn("Failed to update lastActiveWorkspace:", e);
      }
    }
    return userData;
  };

  const logout = async () => {
    const auth = getFirebaseAuth();
    try {
      await auth.signOut();
    } catch (e) {
      console.warn("Signout error:", e);
    }
    setUser(null);
    safeLocalStorage.removeItem('userId');
    safeLocalStorage.removeItem('googleDriveToken');
    safeSessionStorage.removeItem('userId');
    safeSessionStorage.removeItem('googleDriveToken');
    deleteCookie('userId');
    deleteCookie('googleDriveToken');
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    
    try {
      const auth = getFirebaseAuth();
      let gUser, token;
      
      if (isCapacitor()) {
        try {
          console.log("Using Capacitor-Firebase Native Google Sign-In...");
          const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
          const result = await FirebaseAuthentication.signInWithGoogle();
          
          if (!result.credential?.idToken) {
            throw new Error('Native Google sign-in failed: no ID token returned.');
          }
          
          const { signInWithCredential } = await import('firebase/auth');
          const credential = GoogleAuthProvider.credential(result.credential.idToken);
          const webResult = await signInWithCredential(auth, credential);
          gUser = webResult.user;
          token = result.credential.accessToken || null;
        } catch (nativeError) {
          console.error("Capacitor Native Google login failed:", nativeError);
          throw nativeError;
        }
      } else if (isMedian()) {
        if (window.median && window.median.google && window.median.google.login) {
          const medianResult = await window.median.google.login({
            scopes: ['profile', 'email', 'https://www.googleapis.com/auth/drive.file']
          });
          const { signInWithCredential } = await import('firebase/auth');
          const credential = GoogleAuthProvider.credential(medianResult.idToken);
          const webResult = await signInWithCredential(auth, credential);
          gUser = webResult.user;
          token = medianResult.accessToken;
        } else {
          throw new Error('Google Sign-In is blocked in this app wrapper. Please enable the "Google Sign-In" native plugin in your Median.co build settings, or use Email/Password.');
        }
      } else {
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        gUser = result.user;
        token = credential.accessToken;
      }

      if (!gUser) {
        throw new Error('No user returned from Google sign-in');
      }

      const userEmail = gUser.email;
      const photo = gUser.photoURL || gUser.photoUrl;
      const displayName = gUser.displayName || gUser.name || 'User';

      let scientist = await db.scientists.where('email').equals(userEmail).first();
      // Fallback for older Google accounts that saved email as username
      if (!scientist) {
        scientist = await db.scientists.where('username').equals(userEmail).first();
      }
      // Fallback: check by googleLinkedEmail
      if (!scientist) {
        scientist = await db.scientists.where('googleLinkedEmail').equals(userEmail).first();
      }

      if (userEmail === 'abdullah.amr.makky@gmail.com') {
        if (!scientist) {
          const newId = await db.scientists.add({
            username: 'abdullah.amr871',
            email: userEmail,
            name: displayName || 'Abdullah Amr Maged',
            avatar: photo || null,
            department: 'Directorate',
            employeeId: 'MASTER-001',
            role: 'master',
            accountStatus: 'active',
            googleDriveToken: token || null,
            createdAt: new Date().toISOString()
          });
          scientist = await db.scientists.get(newId);
        } else if (scientist.role !== 'master' || scientist.accountStatus !== 'active') {
          await db.scientists.update(scientist.id, {
            role: 'master',
            accountStatus: 'active'
          });
          scientist.role = 'master';
          scientist.accountStatus = 'active';
        }
      }
      
      if (!scientist) {
        const baseName = displayName ? displayName.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '') : 'user';
        const randomNum = Math.floor(Math.random() * 10000);
        const newUsername = `${baseName}${randomNum}`;

        const newId = await db.scientists.add({
          username: newUsername,
          email: userEmail,
          name: displayName,
          avatar: photo || null,
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
            name: scientist.name || displayName
          };
          // Preserve custom avatar — only set Google photo if avatar is empty or still a Google URL
          if (!scientist.avatar || scientist.avatar.includes('googleusercontent.com')) {
            updateData.avatar = photo || null;
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
      safeLocalStorage.setItem('userId', scientist.id);
      safeSessionStorage.setItem('userId', scientist.id);
      setCookie('userId', scientist.id, 365);
      
      const ws = getWorkspaceId();
      if (ws) {
        safeLocalStorage.setItem('workspaceId', ws);
        safeSessionStorage.setItem('workspaceId', ws);
        setCookie('workspaceId', ws, 365);
        try {
            await db.scientists.update(scientist.id, { lastActiveWorkspace: ws });
        } catch (e) {
          console.warn("Failed to update lastActiveWorkspace:", e);
        }
      }
      return userData;
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
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
        try {
          console.log("Using Capacitor-Firebase Native Google account linking...");
          const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
          const result = await FirebaseAuthentication.signInWithGoogle();
          
          if (!result.credential?.idToken) {
            throw new Error('Native Google account link failed: no ID token returned.');
          }
          
          const { signInWithCredential } = await import('firebase/auth');
          const credential = GoogleAuthProvider.credential(result.credential.idToken);
          const webResult = await signInWithCredential(auth, credential);
          gUser = webResult.user;
          token = result.credential.accessToken || null;
        } catch (nativeError) {
          console.error("Capacitor Native Google account link failed:", nativeError);
          throw nativeError;
        }
      } else if (isMedian()) {
        if (window.median && window.median.google && window.median.google.login) {
          const medianResult = await window.median.google.login({
            scopes: ['profile', 'email', 'https://www.googleapis.com/auth/drive.file']
          });
          const { signInWithCredential } = await import('firebase/auth');
          const credential = GoogleAuthProvider.credential(medianResult.idToken);
          const webResult = await signInWithCredential(auth, credential);
          gUser = webResult.user;
          token = medianResult.accessToken;
        } else {
          throw new Error('Google Link is blocked in this app wrapper. Please enable the "Google Sign-In" native plugin in your Median.co build settings.');
        }
      } else {
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        gUser = result.user;
        token = credential.accessToken;
      }

      if (!gUser) {
        throw new Error('No user returned from Google account link');
      }

      const userEmail = gUser.email;
      const photo = gUser.photoURL || gUser.photoUrl;

      // Check if this Google account is already linked to ANOTHER user profile
      let existingEmailUser = await db.scientists.where('email').equals(userEmail).first();
      if (!existingEmailUser) {
        existingEmailUser = await db.scientists.where('username').equals(userEmail).first();
      }

      if (existingEmailUser && String(existingEmailUser.id) !== String(user.id)) {
        // Delete the duplicate auto-generated account before linking
        await db.scientists.delete(existingEmailUser.id);
      }

      await db.scientists.update(user.id, { 
        email: userEmail,
        googleLinked: true,
        googleLinkedEmail: userEmail,
        googleDriveToken: token || null,
        avatar: user.avatar || photo || null
      });
      
      const updatedData = { ...user, email: userEmail };
      setUser(updatedData);
      return updatedData;
    } catch (error) {
      console.error('Account link error:', error);
      throw error;
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

  const dismissBanner = async (bannerKey) => {
    safeLocalStorage.setItem(bannerKey, 'true');
    if (user && user.id) {
      try {
        const scientist = await db.scientists.get(user.id);
        const currentDismissed = scientist?.dismissedBanners || [];
        if (!currentDismissed.includes(bannerKey)) {
          await db.scientists.update(user.id, { dismissedBanners: [...currentDismissed, bannerKey] });
        }
      } catch (e) {
        console.warn("Failed to sync banner dismissal to cloud:", e);
      }
    }
  };

  const isBannerDismissed = (bannerKey, meDoc) => {
    if (safeLocalStorage.getItem(bannerKey) === 'true') return true;
    if (safeSessionStorage.getItem(bannerKey) === 'true') return true;
    if (meDoc?.dismissedBanners?.includes(bannerKey)) {
      safeLocalStorage.setItem(bannerKey, 'true');
      return true;
    }
    return false;
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      loginWithGoogle,
      linkGoogleAccount,
      unlinkGoogleAccount,
      changePassword,
      setUser,
      dismissBanner,
      isBannerDismissed
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
