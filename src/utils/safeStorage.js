export const safeLocalStorage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn("localStorage.getItem blocked or unavailable:", e);
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("localStorage.setItem blocked or unavailable:", e);
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn("localStorage.removeItem blocked or unavailable:", e);
    }
  }
};

export const safeSessionStorage = {
  getItem: (key) => {
    try {
      return sessionStorage.getItem(key);
    } catch (e) {
      console.warn("sessionStorage.getItem blocked or unavailable:", e);
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      sessionStorage.setItem(key, value);
    } catch (e) {
      console.warn("sessionStorage.setItem blocked or unavailable:", e);
    }
  },
  removeItem: (key) => {
    try {
      sessionStorage.removeItem(key);
    } catch (e) {
      console.warn("sessionStorage.removeItem blocked or unavailable:", e);
    }
  }
};

export const getCookie = (name) => {
  try {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
  } catch (e) {
    console.warn("getCookie failed or blocked:", e);
  }
  return null;
};

export const setCookie = (name, value, days = 365) => {
  try {
    const d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = `expires=${d.toUTCString()}`;
    document.cookie = `${name}=${value};${expires};path=/;SameSite=Strict`;
  } catch (e) {
    console.warn("setCookie failed or blocked:", e);
  }
};

export const deleteCookie = (name) => {
  try {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;SameSite=Strict`;
  } catch (e) {
    console.warn("deleteCookie failed or blocked:", e);
  }
};

