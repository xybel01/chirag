import { useEffect, useState } from 'react';
import api from '../api/client';

// Loads lookup tables (categories, departments, locations, vendors) once.
export default function useMeta() {
  const [meta, setMeta] = useState({ categories: [], departments: [], locations: [], vendors: [] });
  useEffect(() => {
    Promise.all(['categories', 'departments', 'locations', 'vendors'].map((t) => api.get(`/meta/${t}`)))
      .then(([c, d, l, v]) => setMeta({ categories: c.data, departments: d.data, locations: l.data, vendors: v.data }))
      .catch(() => {});
  }, []);
  const opts = (list) => list.map((x) => ({ value: x.id, label: x.name }));
  return { ...meta, opts };
}
