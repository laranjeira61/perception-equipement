// Wrapper IndexedDB minimal — stores "fiches" et "personnes"
const DB = (() => {
  const DB_NAME = 'perception-equipement';
  const DB_VERSION = 2;
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('fiches')) {
          const store = db.createObjectStore('fiches', { keyPath: 'id' });
          store.createIndex('dateMission', 'dateMission');
        }
        if (!db.objectStoreNames.contains('personnes')) {
          const store = db.createObjectStore('personnes', { keyPath: 'nom' });
          store.createIndex('role', 'role');
        }
        if (!db.objectStoreNames.contains('reglages')) {
          db.createObjectStore('reglages', { keyPath: 'cle' });
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    });
    return dbPromise;
  }

  async function tx(storeName, mode) {
    const db = await open();
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  return {
    async saveFiche(fiche) {
      const store = await tx('fiches', 'readwrite');
      return new Promise((resolve, reject) => {
        const req = store.put(fiche);
        req.onsuccess = () => resolve(fiche);
        req.onerror = (e) => reject(e.target.error);
      });
    },

    async getAllFiches() {
      const store = await tx('fiches', 'readonly');
      return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result.sort((a, b) => b.dateMission.localeCompare(a.dateMission)));
        req.onerror = (e) => reject(e.target.error);
      });
    },

    async deleteFiche(id) {
      const store = await tx('fiches', 'readwrite');
      return new Promise((resolve, reject) => {
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = (e) => reject(e.target.error);
      });
    },

    async getFiche(id) {
      const store = await tx('fiches', 'readonly');
      return new Promise((resolve, reject) => {
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = (e) => reject(e.target.error);
      });
    },

    async upsertPersonne(nom, role, nigend, grade) {
      if (!nom) return;
      const store = await tx('personnes', 'readwrite');
      return new Promise((resolve, reject) => {
        const req = store.put({ nom, role, nigend, grade });
        req.onsuccess = () => resolve();
        req.onerror = (e) => reject(e.target.error);
      });
    },

    async getPersonnesByRole(role) {
      const store = await tx('personnes', 'readonly');
      return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result.filter(p => p.role === role));
        req.onerror = (e) => reject(e.target.error);
      });
    },

    async getReglage(cle) {
      const store = await tx('reglages', 'readonly');
      return new Promise((resolve, reject) => {
        const req = store.get(cle);
        req.onsuccess = () => resolve(req.result ? req.result.valeur : null);
        req.onerror = (e) => reject(e.target.error);
      });
    },

    async setReglage(cle, valeur) {
      const store = await tx('reglages', 'readwrite');
      return new Promise((resolve, reject) => {
        const req = store.put({ cle, valeur });
        req.onsuccess = () => resolve();
        req.onerror = (e) => reject(e.target.error);
      });
    }
  };
})();
