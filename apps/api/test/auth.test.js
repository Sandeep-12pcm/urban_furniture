const bcrypt = require('bcryptjs');
const request = require('supertest');
const { createApp } = require('../src/app');

function aliasUser(user) {
  return {
    id: user.id,
    loginId: user.login_id,
    email: user.email,
    role: user.role,
    isActive: user.is_active,
    contactId: user.contact_id,
    accountType: user.account_type,
    approvalStatus: user.approval_status,
    approvedAt: user.approved_at,
    approvedBy: user.approved_by,
    lastLoginAt: user.last_login_at,
    createdAt: user.created_at,
  };
}

function createDb() {
  const users = [];
  const auditLogs = [];
  const resetTokens = [];

  return {
    users,
    auditLogs,
    resetTokens,
    async query(sql, params = []) {
      const text = String(sql).replace(/\s+/g, ' ').trim();

      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(text)) return { rows: [], rowCount: 0 };

      if (text.startsWith('SELECT * FROM users WHERE login_id')) {
        const user = users.find((item) => item.login_id === params[0]);
        return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
      }

      if (text.startsWith('SELECT * FROM users WHERE login_id = $1 OR email = $2')) {
        const user = users.find((item) => item.login_id === params[0] || item.email === params[1]);
        return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
      }

      if (text.includes('FROM users ORDER BY created_at DESC')) {
        return { rows: users.map(aliasUser), rowCount: users.length };
      }

      if (text.includes("WHERE id = $1 OR role = 'CONTACT'")) {
        const visible = users.filter((item) => item.id === params[0] || item.role === 'CONTACT');
        return { rows: visible.map(aliasUser), rowCount: visible.length };
      }

      if (text.includes('FROM users WHERE id = $1')) {
        const user = users.find((item) => item.id === params[0]);
        return { rows: user ? [aliasUser(user)] : [], rowCount: user ? 1 : 0 };
      }

      if (text.startsWith('UPDATE users SET last_login_at')) {
        const user = users.find((item) => item.id === params[0]);
        user.last_login_at = new Date();
        return { rows: [aliasUser(user)], rowCount: 1 };
      }

      if (text.startsWith('UPDATE users SET is_active = TRUE')) {
        const user = users.find((item) => item.id === params[0]);
        user.is_active = true;
        user.approval_status = 'APPROVED';
        user.approved_at = new Date();
        user.approved_by = params[1];
        return { rows: [aliasUser(user)], rowCount: 1 };
      }

      if (text.startsWith('INSERT INTO users')) {
        const [id, loginId, email, passwordHash, role] = params;
        const isSignupInsert = text.includes('is_active, account_type, approval_status');
        const isActive = isSignupInsert ? params[5] : true;
        const accountType = isSignupInsert ? params[6] : null;
        const approvalStatus = isSignupInsert ? params[7] : 'APPROVED';
        const contactId = isSignupInsert ? null : params[5] || null;
        if (users.some((item) => item.login_id === loginId)) {
          throw { code: '23505', constraint: 'users_login_id_key' };
        }
        if (users.some((item) => item.email === email)) {
          throw { code: '23505', constraint: 'users_email_key' };
        }
        const user = {
          id,
          login_id: loginId,
          email,
          password_hash: passwordHash,
          role,
          is_active: isActive,
          contact_id: contactId,
          account_type: accountType,
          approval_status: approvalStatus,
          approved_at: null,
          approved_by: null,
          created_at: new Date(),
          updated_at: new Date(),
          last_login_at: null,
        };
        users.push(user);
        return { rows: [aliasUser(user)], rowCount: 1 };
      }

      if (text.startsWith('INSERT INTO audit_logs')) {
        auditLogs.push(params);
        return { rows: [], rowCount: 1 };
      }

      if (text.startsWith('INSERT INTO password_reset_tokens')) {
        resetTokens.push(params);
        return { rows: [], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    },
  };
}

async function addUser(db, role, overrides = {}) {
  const password = overrides.password || 'Secure@123';
  db.users.push({
    id: overrides.id || `${role.toLowerCase()}-1`,
    login_id: overrides.loginId || role.toLowerCase(),
    email: overrides.email || `${role.toLowerCase()}@urbanfurniture.local`,
    password_hash: await bcrypt.hash(password, 12),
    role,
    is_active: overrides.isActive ?? true,
    contact_id: overrides.contactId || null,
    account_type: overrides.accountType || null,
    approval_status: overrides.approvalStatus || 'APPROVED',
    approved_at: overrides.approvedAt || null,
    approved_by: overrides.approvedBy || null,
    created_at: new Date(),
    updated_at: new Date(),
    last_login_at: null,
  });
}

describe('Express auth and RBAC', () => {
  let db;
  let app;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRES_IN = '1d';
    db = createDb();
    app = createApp(db);
  });

  async function login(loginId, password = 'Secure@123') {
    const response = await request(app).post('/api/auth/login').send({ loginId, password });
    return response.headers['set-cookie'];
  }

  test('successful login returns safe user and cookie', async () => {
    await addUser(db, 'ADMIN');

    const response = await request(app)
      .post('/api/auth/login')
      .send({ loginId: 'admin', password: 'Secure@123' })
      .expect(200);

    expect(response.headers['set-cookie'][0]).toContain('access_token');
    expect(response.body.user.role).toBe('ADMIN');
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(db.users[0].password_hash).not.toBe('Secure@123');
  });

  test('wrong password and unknown login use generic error', async () => {
    await addUser(db, 'ADMIN');

    await request(app)
      .post('/api/auth/login')
      .send({ loginId: 'admin', password: 'Wrong@123' })
      .expect(401)
      .expect(({ body }) => expect(body.message).toBe('Invalid Login ID or Password.'));

    await request(app)
      .post('/api/auth/login')
      .send({ loginId: 'missing', password: 'Secure@123' })
      .expect(401)
      .expect(({ body }) => expect(body.message).toBe('Invalid Login ID or Password.'));
  });

  test('inactive account is rejected', async () => {
    await addUser(db, 'ADMIN', { isActive: false });

    await request(app)
      .post('/api/auth/login')
      .send({ loginId: 'admin', password: 'Secure@123' })
      .expect(403);
  });

  test('validates weak password on admin-created users', async () => {
    await addUser(db, 'ADMIN');
    const cookie = await login('admin');

    await request(app)
      .post('/api/users')
      .set('Cookie', cookie)
      .send({ loginId: 'weak', email: 'weak@example.com', password: 'weak', role: 'ACCOUNTANT' })
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('Password does not meet the required security requirements.'));
  });

  test('admin can create accountant and duplicate constraints are handled', async () => {
    await addUser(db, 'ADMIN');
    await addUser(db, 'CONTACT', { loginId: 'taken', email: 'taken@example.com' });
    const cookie = await login('admin');

    await request(app)
      .post('/api/users')
      .set('Cookie', cookie)
      .send({ loginId: 'accountant2', email: 'accountant2@example.com', password: 'Secure@123', role: 'ACCOUNTANT' })
      .expect(201)
      .expect(({ body }) => {
        expect(body.user.role).toBe('ACCOUNTANT');
        expect(body.user.passwordHash).toBeUndefined();
      });

    await request(app)
      .post('/api/users')
      .set('Cookie', cookie)
      .send({ loginId: 'taken', email: 'fresh@example.com', password: 'Secure@123', role: 'ACCOUNTANT' })
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe('Login ID is already in use.'));
  });

  test('non-admin cannot create users and contact cannot access admin route', async () => {
    await addUser(db, 'CONTACT', { loginId: 'contact' });
    const cookie = await login('contact');

    await request(app)
      .post('/api/users')
      .set('Cookie', cookie)
      .send({ loginId: 'blocked', email: 'blocked@example.com', password: 'Secure@123', role: 'ACCOUNTANT' })
      .expect(403);

    await request(app).get('/api/admin/health').set('Cookie', cookie).expect(403);
    await request(app).get('/api/contact/portal').set('Cookie', cookie).expect(200);
  });

  test('admin sees all accounts, accountant sees self and users, contact sees only self', async () => {
    await addUser(db, 'ADMIN');
    await addUser(db, 'ACCOUNTANT', { id: 'accountant-1', loginId: 'accountant' });
    await addUser(db, 'CONTACT', { id: 'customer-1', loginId: 'customer', accountType: 'CUSTOMER' });
    const adminCookie = await login('admin');
    const accountantCookie = await login('accountant');
    const customerCookie = await login('customer');

    await request(app)
      .get('/api/users')
      .set('Cookie', adminCookie)
      .expect(200)
      .expect(({ body }) => expect(body.users).toHaveLength(3));

    await request(app)
      .get('/api/users')
      .set('Cookie', accountantCookie)
      .expect(200)
      .expect(({ body }) => expect(body.users.map((user) => user.loginId).sort()).toEqual(['accountant', 'customer']));

    await request(app)
      .get('/api/users')
      .set('Cookie', customerCookie)
      .expect(200)
      .expect(({ body }) => expect(body.users).toHaveLength(1));
  });

  test('pending accountant signup requires admin approval before login', async () => {
    await addUser(db, 'ADMIN');

    const signup = await request(app)
      .post('/api/auth/signup')
      .send({
        loginId: 'pending-accountant',
        email: 'pending@example.com',
        accountType: 'ACCOUNTANT',
        password: 'Secure@123',
        confirmPassword: 'Secure@123',
      })
      .expect(201);

    expect(signup.body.pendingApproval).toBe(true);
    expect(signup.body.user.isActive).toBe(false);

    await request(app)
      .post('/api/auth/login')
      .send({ loginId: 'pending-accountant', password: 'Secure@123' })
      .expect(403)
      .expect(({ body }) => expect(body.message).toContain('pending admin approval'));

    const adminCookie = await login('admin');
    await request(app)
      .post(`/api/users/${signup.body.user.id}/approve-accountant`)
      .set('Cookie', adminCookie)
      .expect(200)
      .expect(({ body }) => expect(body.user.approvalStatus).toBe('APPROVED'));

    await request(app)
      .post('/api/auth/login')
      .send({ loginId: 'pending-accountant', password: 'Secure@123' })
      .expect(200);
  });

  test('unauthenticated access, me, and logout work', async () => {
    await addUser(db, 'CONTACT', { loginId: 'contact' });
    const cookie = await login('contact');

    await request(app).get('/api/auth/me').expect(401);
    await request(app).get('/api/auth/me').set('Cookie', cookie).expect(200);
    await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookie)
      .expect(200)
      .expect(({ headers }) => expect(headers['set-cookie'][0]).toContain('access_token=;'));
  });
});
