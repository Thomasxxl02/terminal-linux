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

  it('GET /api/fs/remote/tree returns remote file explorer tree list', async () => {
    const res = await request(app).get('/api/fs/remote/tree?path=/home/developer');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('currentPath');
    expect(res.body.currentPath).toBe('/home/developer');
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
    
    // Check it contains some expected mock remote items
    const hasDeployScript = res.body.items.some((item: any) => item.name === 'deploy.sh');
    const hasReadme = res.body.items.some((item: any) => item.name === 'README.md');
    expect(hasDeployScript || hasReadme).toBe(true);
  });

  it('GET /api/fs/remote/read returns mock remote file contents', async () => {
    const res = await request(app).get('/api/fs/remote/read?path=/home/developer/README.md');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('path');
    expect(res.body.path).toBe('/home/developer/README.md');
    expect(res.body).toHaveProperty('content');
    expect(res.body.content).toContain('Projet Distant SSH SFTP');
  });

  it('POST /api/fs/remote/write successfully records file content to mock remote registry', async () => {
    const uniquePath = `/home/developer/test_remote_${Date.now()}.txt`;
    const writeRes = await request(app)
      .post('/api/fs/remote/write')
      .send({ path: uniquePath, content: 'Remote Test Content!' });
    
    expect(writeRes.status).toBe(200);
    expect(writeRes.body).toEqual({
      success: true,
      message: 'Fichier distant enregistré avec succès',
      isMock: true
    });

    // Verify written file can be read back
    const readRes = await request(app).get(`/api/fs/remote/read?path=${encodeURIComponent(uniquePath)}`);
    expect(readRes.status).toBe(200);
    expect(readRes.body.content).toBe('Remote Test Content!');
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
