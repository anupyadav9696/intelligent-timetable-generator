const request = require('supertest');
const { createApp } = require('../app');

const app = createApp();

describe('Timetable API', () => {
  test('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /api/timetable/sample returns a SUCCESS timetable', async () => {
    const res = await request(app).get('/api/timetable/sample');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SUCCESS');
    expect(Array.isArray(res.body.schedule)).toBe(true);
    expect(res.body.schedule.length).toBeGreaterThan(0);
  });

  test('GET /api/timetable/sample-conflict returns a non-SUCCESS status with diagnostics', async () => {
    const res = await request(app).get('/api/timetable/sample-conflict');
    expect(res.status).toBe(200);
    expect(res.body.status).not.toBe('SUCCESS');
    expect(res.body.diagnostics.length).toBeGreaterThan(0);
  });

  test('POST /api/timetable/generate with useSample=valid mirrors the sample endpoint', async () => {
    const res = await request(app).post('/api/timetable/generate').send({ useSample: 'valid' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SUCCESS');
  });

  test('POST /api/timetable/generate rejects an invalid payload', async () => {
    const res = await request(app).post('/api/timetable/generate').send({ useSample: 'not-a-real-option' });
    expect(res.status).toBe(400);
  });

  test('unknown route returns 404', async () => {
    const res = await request(app).get('/api/not-a-real-route');
    expect(res.status).toBe(404);
  });
});
