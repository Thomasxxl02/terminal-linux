// @vitest-environment node
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server';

describe('Backend Express API Endpoints', () => {
  it('GET /api/health returns ok status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: 'Tauri Terminal PTY Backend' });
  });

  it('GET /api/system/stats returns metrics and OS info', async () => {
    const res = await request(app).get('/api/system/stats');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('platform');
    expect(res.body).toHaveProperty('cpus');
    expect(res.body).toHaveProperty('totalMem');
    expect(res.body).toHaveProperty('memUsagePercent');
  });

  it('GET /api/pty/sessions returns active sessions list', async () => {
    const res = await request(app).get('/api/pty/sessions');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('sessions');
    expect(Array.isArray(res.body.sessions)).toBe(true);
  });

  it('GET /api/fs/tree returns file explorer tree', async () => {
    const res = await request(app).get('/api/fs/tree');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('currentPath');
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('POST /api/pty/create creates a new terminal PTY session', async () => {
    const res = await request(app)
      .post('/api/pty/create')
      .send({ name: 'Test PTY', shell: 'bash', cwd: '.' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Test PTY');

    // Clean up created session
    const createdId = res.body.id;
    const delRes = await request(app).delete(`/api/pty/${createdId}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body).toEqual({ success: true });
  });
});
