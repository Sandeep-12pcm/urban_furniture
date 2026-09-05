const request = require('supertest');

async function login(app, loginId, password = 'Secure@123') {
  const response = await request(app).post('/api/auth/login').send({ loginId, password });
  if (response.status !== 200) {
    throw new Error(`Login failed for "${loginId}": ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.headers['set-cookie'];
}

module.exports = { login };
