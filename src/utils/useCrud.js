import { crud, api } from './api';

export default function useCrud(basePath, searchPath) {
  const { useEffect, useState, useCallback } = require('react');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const normalize = (r) => (r?.data?.data ?? r?.data ?? []);
  const fetchAll = useCallback(async () => {
    try {
      setLoading(true); setErr('');
      const r = await crud.list(basePath);
      setRows(Array.isArray(normalize(r)) ? normalize(r) : []);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Error fetching data');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [basePath]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const refresh = fetchAll;

  const create = async (payload) => {
    await crud.create(basePath, payload);
    await fetchAll();
  };
  const update = async (id, payload) => {
    await crud.update(basePath, id, payload);
    await fetchAll();
  };
  const remove = async (id) => {
    await crud.remove(basePath, id);
    await fetchAll();
  };

  const search = async (query) => {
    if (!searchPath) return fetchAll();
    try {
      setLoading(true); setErr('');
      const r = await api.get(searchPath, { params: { query } });
      setRows(Array.isArray(normalize(r)) ? normalize(r) : []);
    } catch {
      await fetchAll();
    } finally {
      setLoading(false);
    }
  };

  return { rows, loading, err, refresh, create, update, remove, search };
}