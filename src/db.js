import { initializeApp } from "firebase/app";
import { initializeFirestore, doc, setDoc, deleteDoc, getDoc, getDocs, collection, query, where, addDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { getStorage, ref, uploadBytes, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useState, useEffect } from "react";
import { safeLocalStorage, safeSessionStorage, getCookie } from "./utils/safeStorage";


const firebaseConfig = {
  apiKey: "AIzaSyAPrfR-hG-5CeZiD0EIz_P1r93ywZbxcjc",
  authDomain: "chompchem.firebaseapp.com",
  projectId: "chompchem",
  storageBucket: "chompchem.firebasestorage.app",
  messagingSenderId: "379599502348",
  appId: "1:379599502348:web:d1be32d868ac2a813f0229",
  measurementId: "G-NWEXYL1PQ0"
};

import { getAuth } from "firebase/auth";

const app = initializeApp(firebaseConfig);
export const firestore = initializeFirestore(app, {});
export const storage = getStorage(app);

let authInstance = null;
export const getFirebaseAuth = () => {
  if (!authInstance) {
    authInstance = getAuth(app);
  }
  return authInstance;
};

// File size limit removed by user request
// const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const compressImageToBase64 = (file, maxWidth = 1000) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.onerror = () => reject(new Error('Failed to load image for compression'));
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
  });
};

export const uploadFile = async (file, path, onProgress) => {
  if (!file) throw new Error('No file provided');
  
  // 🔥 EMERGENCY FALLBACK: If it's an image, convert to Base64 and return immediately.
  // This completely bypasses Firebase Storage CORS and timeout issues for Profile Pics & Banners!
  if (file.type.startsWith('image/')) {
    if (onProgress) onProgress(50);
    try {
      const base64Url = await compressImageToBase64(file);
      if (onProgress) onProgress(100);
      return base64Url;
    } catch (e) {
      console.error('Base64 compression failed, falling back to Firebase Storage', e);
    }
  } else if (file.type.startsWith('video/')) {
    // 🔥 EMERGENCY FALLBACK for videos!
    // Splits file into chunks and stores in Firestore to bypass Storage CORS completely!
    if (onProgress) onProgress(5);
    try {
      const CHUNK_SIZE = 750 * 1024; // 750KB (safe under 1MB Firestore limit)
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      
      const fileRef = await addDoc(collection(firestore, getCollectionName('scicomm_files')), {
        name: file.name,
        type: file.type,
        size: file.size,
        totalChunks,
        createdAt: new Date().toISOString()
      });
      
      const fileId = fileRef.id;
      
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.readAsDataURL(chunk);
          reader.onload = () => resolve(reader.result);
        });
        
        await addDoc(collection(firestore, getCollectionName('scicomm_file_chunks')), {
          fileId,
          chunkIndex: i,
          data: base64
        });
        
        if (onProgress) onProgress(Math.round(((i + 1) / totalChunks) * 100));
      }
      
      return `chunked://${fileId}`;
    } catch (e) {
      console.error('Chunked upload failed', e);
      throw e;
    }
  } else if (file.size <= 750 * 1024) {
    // 🔥 EMERGENCY FALLBACK for documents (CVs, PDFs) under 750KB
    // Stores them directly as Base64 in Firestore to bypass Storage CORS completely!
    if (onProgress) onProgress(50);
    try {
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          if (onProgress) onProgress(100);
          resolve(reader.result);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
      });
    } catch (e) {
      console.error('Base64 document fallback failed, falling back to Firebase Storage', e);
    }
  }

  const storageRef = ref(storage, path);
  
  if (onProgress) {
    // Resumable upload with progress
    return new Promise((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, file);
      if (onProgress) onProgress(1); // Show 1% immediately so user knows it started
      const timeout = setTimeout(() => { 
        task.cancel(); 
        reject(new Error('Upload timed out (10 min). This usually means the file is very large or Firebase Storage CORS rules are not configured in your Google Cloud Console for this domain.')); 
      }, 600000); // 10 minute timeout
      
      task.on('state_changed',
        (snapshot) => {
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          if (onProgress) onProgress(pct);
        },
        (error) => { clearTimeout(timeout); reject(new Error('Firebase Storage Error: ' + error.message)); },
        async () => {
          clearTimeout(timeout);
          try { const url = await getDownloadURL(task.snapshot.ref); resolve(url); }
          catch (e) { reject(new Error('Failed to get download URL: ' + e.message)); }
        }
      );
    });
  } else {
    // Simple upload for small files with timeout wrapper
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Upload timed out (10 min). This usually means Firebase Storage CORS rules are not configured in your Google Cloud Console.')), 600000);
      try {
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        clearTimeout(timeout);
        resolve(url);
      } catch (err) {
        clearTimeout(timeout);
        reject(new Error('Firebase Storage Error: ' + err.message));
      }
    });
  }
};

export const getCollectionName = (baseName) => {
  if (baseName === 'scicomm_app_downloads') return baseName;
  
  // Three-layer fallback resolve for workspaceId
  let ws = safeLocalStorage.getItem('workspaceId');
  if (!ws) {
    ws = safeSessionStorage.getItem('workspaceId');
  }
  if (!ws) {
    ws = getCookie('workspaceId');
  }
  
  if (!ws || ws === 'compchem') return baseName;
  return `${ws}_${baseName}`;
};

// React Hook for Real-time listeners
export function useLiveCollection(collectionName) {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    // We listen to changes on the localized collection
    const actualCollection = getCollectionName(collectionName);
    const q = query(collection(firestore, actualCollection));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [collectionName]); // Could add localStorage listener if workspace changes without reload, but app will likely reload
  
  return data;
}

// Data Access Object (DAO) to minimize component refactoring
export const db = {
  chemicals: {
    add: async (chemical) => {
      await setDoc(doc(firestore, getCollectionName('chemicals'), chemical.formula), chemical);
    },
    delete: async (formula) => {
      await deleteDoc(doc(firestore, getCollectionName('chemicals'), formula));
    },
    get: async (formula) => {
      const d = await getDoc(doc(firestore, getCollectionName('chemicals'), formula));
      return d.exists() ? d.data() : null;
    },
    count: async () => {
      const snap = await getDocs(collection(firestore, getCollectionName('chemicals')));
      return snap.size;
    }
  },
  scientists: {
    add: async (scientist) => {
      const ref = await addDoc(collection(firestore, getCollectionName('scientists')), scientist);
      return ref.id;
    },
    update: async (id, data) => {
      if (!id) throw new Error("No ID provided for update");
      await setDoc(doc(firestore, getCollectionName('scientists'), String(id)), data, { merge: true });
    },
    delete: async (id) => {
      await deleteDoc(doc(firestore, getCollectionName('scientists'), String(id)));
    },
    get: async (id) => {
      const d = await getDoc(doc(firestore, getCollectionName('scientists'), String(id)));
      return d.exists() ? { id: d.id, ...d.data() } : null;
    },
    where: (field) => {
      return {
        equals: (value) => {
          return {
            first: async () => {
              const q = query(collection(firestore, getCollectionName('scientists')), where(field, '==', value));
              const snap = await getDocs(q);
              if (snap.empty) return null;
              return { id: snap.docs[0].id, ...snap.docs[0].data() };
            }
          }
        }
      }
    },
    count: async () => {
      const snap = await getDocs(collection(firestore, getCollectionName('scientists')));
      return snap.size;
    }
  },
  usage_logs: {
    add: async (log) => {
      await addDoc(collection(firestore, getCollectionName('usage_logs')), log);
    },
    update: async (id, data) => {
      await updateDoc(doc(firestore, getCollectionName('usage_logs'), String(id)), data);
    }
  },
  devices: {
    add: async (device) => {
      await setDoc(doc(firestore, getCollectionName('devices'), device.id), device);
    },
    delete: async (id) => {
      await deleteDoc(doc(firestore, getCollectionName('devices'), id));
    }
  },
  equipment: {
    add: async (item) => {
      await setDoc(doc(firestore, getCollectionName('equipment'), item.id), item);
    },
    delete: async (id) => {
      await deleteDoc(doc(firestore, getCollectionName('equipment'), id));
    }
  },
  tasks: {
    add: async (task) => {
      await addDoc(collection(firestore, getCollectionName('tasks')), task);
    },
    update: async (id, data) => {
      await updateDoc(doc(firestore, getCollectionName('tasks'), String(id)), data);
    },
    delete: async (id) => {
      await deleteDoc(doc(firestore, getCollectionName('tasks'), String(id)));
    }
  },
  messages: {
    add: async (msg) => {
      await addDoc(collection(firestore, getCollectionName('messages')), msg);
    }
  },
  scicomm_posts: {
    add: async (post) => {
      const ref = await addDoc(collection(firestore, getCollectionName('scicomm_posts')), post);
      return ref.id;
    },
    update: async (id, data) => {
      await updateDoc(doc(firestore, getCollectionName('scicomm_posts'), String(id)), data);
    },
    delete: async (id) => {
      await deleteDoc(doc(firestore, getCollectionName('scicomm_posts'), String(id)));
    }
  },
  scicomm_warnings: {
    add: async (warning) => {
      await addDoc(collection(firestore, getCollectionName('scicomm_warnings')), warning);
    },
    update: async (id, data) => {
      await updateDoc(doc(firestore, getCollectionName('scicomm_warnings'), String(id)), data);
    },
    delete: async (id) => {
      await deleteDoc(doc(firestore, getCollectionName('scicomm_warnings'), String(id)));
    }
  },
  scicomm_connections: {
    add: async (conn) => {
      await addDoc(collection(firestore, getCollectionName('scicomm_connections')), conn);
    },
    update: async (id, data) => {
      await updateDoc(doc(firestore, getCollectionName('scicomm_connections'), String(id)), data);
    },
    delete: async (id) => {
      await deleteDoc(doc(firestore, getCollectionName('scicomm_connections'), String(id)));
    }
  },
  scicomm_meetings: {
    add: async (meeting) => {
      await addDoc(collection(firestore, getCollectionName('scicomm_meetings')), meeting);
    },
    update: async (id, data) => {
      await updateDoc(doc(firestore, getCollectionName('scicomm_meetings'), String(id)), data);
    },
    delete: async (id) => {
      await deleteDoc(doc(firestore, getCollectionName('scicomm_meetings'), String(id)));
    }
  },
  scicomm_chat_rooms: {
    add: async (room) => {
      const ref = await addDoc(collection(firestore, getCollectionName('scicomm_chat_rooms')), room);
      return ref.id;
    },
    update: async (id, data) => {
      await updateDoc(doc(firestore, getCollectionName('scicomm_chat_rooms'), String(id)), data);
    },
    delete: async (id) => {
      await deleteDoc(doc(firestore, getCollectionName('scicomm_chat_rooms'), String(id)));
    }
  },
  scicomm_chat_messages: {
    add: async (msg) => {
      await addDoc(collection(firestore, getCollectionName('scicomm_chat_messages')), msg);
    },
    update: async (id, data) => {
      await updateDoc(doc(firestore, getCollectionName('scicomm_chat_messages'), String(id)), data);
    },
    delete: async (id) => {
      await deleteDoc(doc(firestore, getCollectionName('scicomm_chat_messages'), String(id)));
    }
  },
  scicomm_stories: {
    add: async (story) => {
      await addDoc(collection(firestore, getCollectionName('scicomm_stories')), story);
    },
    update: async (id, data) => {
      await updateDoc(doc(firestore, getCollectionName('scicomm_stories'), String(id)), data);
    },
    delete: async (id) => {
      await deleteDoc(doc(firestore, getCollectionName('scicomm_stories'), String(id)));
    }
  },
  scicomm_banners: {
    add: async (banner) => {
      await addDoc(collection(firestore, getCollectionName('scicomm_banners')), banner);
    },
    update: async (id, data) => {
      await updateDoc(doc(firestore, getCollectionName('scicomm_banners'), String(id)), data);
    },
    delete: async (id) => {
      await deleteDoc(doc(firestore, getCollectionName('scicomm_banners'), String(id)));
    }
  },

  scicomm_recognitions: {
    add: async (recognition) => {
      await addDoc(collection(firestore, getCollectionName('scicomm_recognitions')), recognition);
    },
    update: async (id, data) => {
      await updateDoc(doc(firestore, getCollectionName('scicomm_recognitions'), String(id)), data);
    },
    delete: async (id) => {
      await deleteDoc(doc(firestore, getCollectionName('scicomm_recognitions'), String(id)));
    }
  },
  scicomm_applications: {
    add: async (app) => {
      await addDoc(collection(firestore, getCollectionName('scicomm_applications')), app);
    },
    update: async (id, data) => {
      await updateDoc(doc(firestore, getCollectionName('scicomm_applications'), String(id)), data);
    },
    delete: async (id) => {
      await deleteDoc(doc(firestore, getCollectionName('scicomm_applications'), String(id)));
    }
  },
  scicomm_notifications: {
    add: async (notification) => {
      await addDoc(collection(firestore, getCollectionName('scicomm_notifications')), notification);
    },
    update: async (id, data) => {
      await updateDoc(doc(firestore, getCollectionName('scicomm_notifications'), String(id)), data);
    },
    delete: async (id) => {
      await deleteDoc(doc(firestore, getCollectionName('scicomm_notifications'), String(id)));
    }
  },
  scicomm_app_downloads: {
    add: async (download) => {
      await addDoc(collection(firestore, getCollectionName('scicomm_app_downloads')), download);
    },
    update: async (id, data) => {
      await updateDoc(doc(firestore, getCollectionName('scicomm_app_downloads'), String(id)), data);
    },
    delete: async (id) => {
      await deleteDoc(doc(firestore, getCollectionName('scicomm_app_downloads'), String(id)));
    },
    get: async (id) => {
      const d = await getDoc(doc(firestore, getCollectionName('scicomm_app_downloads'), String(id)));
      return d.exists() ? { id: d.id, ...d.data() } : null;
    }
  }
};
