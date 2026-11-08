/** An in-memory store for trying things out. Use your database in production (docs/GUIDE.md has a schema). */
export function memoryStore() {
  const rows = new Map();
  let n = 1000;
  return {
    async nextNumber() {
      return ++n;
    },
    async get(id) {
      const o = rows.get(id);
      return o ? structuredClone(o) : null;
    },
    async byToken(token) {
      for (const o of rows.values()) if (o.publicToken === token) return structuredClone(o);
      return null;
    },
    async put(o) {
      rows.set(o.id, structuredClone(o));
    },
    async list() {
      return [...rows.values()].map((o) => structuredClone(o));
    },
  };
}
