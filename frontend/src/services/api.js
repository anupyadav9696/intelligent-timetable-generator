import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 20000,
});

export async function generateValidDemo() {
  const { data } = await api.get('/timetable/sample');
  return data;
}

export async function generateConflictDemo() {
  const { data } = await api.get('/timetable/sample-conflict');
  return data;
}

export async function generateTimetable(payload) {
  const { data } = await api.post('/timetable/generate', payload);
  return data;
}

export async function fetchSampleEntities(kind) {
  const { data } = await api.get(`/timetable/sample-data/${kind}`);
  return data;
}

export default api;
