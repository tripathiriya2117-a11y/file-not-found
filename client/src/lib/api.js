import axios from 'axios';
import { supabase } from './supabase';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
});

// Attach Supabase access token to every request automatically
api.interceptors.request.use(async (config) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
  } catch (err) {
    console.warn('Could not attach session token:', err);
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// API helper functions
export async function uploadFiles(files, onProgress) {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  const response = await api.post('/files/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percent);
      }
    },
  });
  return response.data;
}

export async function fetchFiles() {
  const response = await api.get('/files');
  return response.data.documents || [];
}

export async function searchFiles(query) {
  const response = await api.post('/search', { query });
  return response.data;
}

export async function getFileViewUrl(fileId) {
  const response = await api.get(`/files/${fileId}/view-url`);
  return response.data;
}

export async function deleteFile(fileId) {
  const response = await api.delete(`/files/${fileId}`);
  return response.data;
}

export default api;
