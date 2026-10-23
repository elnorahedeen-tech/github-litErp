export const setStorage = (key: string, value: any) => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const getStorage = (key: string) => {
  const val = localStorage.getItem(key);
  return val ? JSON.parse(val) : null;
};

export const removeStorage = (key: string) => {
  localStorage.removeItem(key);
};

const storage = {
  set: setStorage,
  get: getStorage,
  remove: removeStorage,
};

export default storage;
