import { useCallback, useEffect, useState } from 'react';

// Shared data-fetching hook for every Master Data list page: tracks loading,
// empty, and error states, and refetches whenever the filter params change
// or reload() is called (e.g. after create/update/archive/restore).
export function useResourceList(apiClient, params, dataKey) {
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    apiClient
      .list(params)
      .then((result) => {
        if (cancelled) return;
        setData(result[dataKey] || []);
        setPagination(result.pagination || null);
      })
      .catch((requestError) => {
        if (cancelled) return;
        setError(requestError.message || 'Unable to load data. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // paramsKey is the stable, comparable representation of params.

  }, [paramsKey, reloadToken]);

  return { data, pagination, loading, error, reload };
}

export function useDebouncedValue(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
