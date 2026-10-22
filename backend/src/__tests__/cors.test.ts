import { corsAllowed } from '../app.js';

describe('CORS_ORIGINS', () => {
  const allowed = ['http://localhost:5500', 'https://*.*.devtunnels.ms'];

  test('acepta los orígenes exactos', () => {
    expect(corsAllowed('http://localhost:5500', allowed)).toBe(true);
    expect(corsAllowed('http://localhost:5501', allowed)).toBe(false);
  });

  test('cada «*» cubre un nombre del host (puertos reenviados de VS Code)', () => {
    expect(corsAllowed('https://k8f2x9-5500.usw2.devtunnels.ms', allowed)).toBe(true);
    expect(corsAllowed('https://k8f2x9-5600.brs.devtunnels.ms', allowed)).toBe(true);
    expect(corsAllowed('https://abc.devtunnels.ms', allowed)).toBe(false);
  });

  test('no se puede engañar con otro dominio o protocolo', () => {
    expect(corsAllowed('https://a.b.devtunnels.ms.evil.com', allowed)).toBe(false);
    expect(corsAllowed('https://evil.com/a.b.devtunnels.ms', allowed)).toBe(false);
    expect(corsAllowed('http://a-5500.usw2.devtunnels.ms', allowed)).toBe(false);
  });
});
