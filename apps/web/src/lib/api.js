const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method || 'GET',
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(Array.isArray(data.message) ? data.message[0] : data.message || 'Request failed.');
  }
  return data;
}

export async function downloadFile(path, defaultFilename = 'document.pdf') {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to download document.');
  }
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition');
  let filename = defaultFilename;
  if (disposition) {
    const match = disposition.match(/filename="?([^";]+)"?/i);
    if (match && match[1]) filename = match[1];
  }
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(blobUrl);
}
