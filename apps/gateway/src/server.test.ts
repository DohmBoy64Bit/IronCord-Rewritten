import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createServer } from './server.js';

describe('Server', () => {
  const app = createServer();

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        status: 'healthy',
      });
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('404 handler', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app).get('/non-existent-route');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: 'Route not found',
      });
    });
  });

  describe('CORS', () => {
    it('should have CORS headers', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('JSON body parser', () => {
    it('should parse JSON bodies', async () => {
      const response = await request(app)
        .post('/test')
        .send({ test: 'data' })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(404);
    });
  });
});
