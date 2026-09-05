const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../config/db');
const { config } = require('../config');

function createToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      id: user.id,
      loginId: user.loginId,
      email: user.email,
      role: user.role,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );
}

function toSafeUser(user) {
  const safe = { ...user };
  delete safe.passwordHash;
  return safe;
}

async function loginUser({ identifier, password }) {
  const trimmed = identifier.trim();
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { loginId: { equals: trimmed, mode: 'insensitive' } },
        { email: { equals: trimmed, mode: 'insensitive' } },
      ],
    },
    include: {
      contact: true,
    },
  });

  if (!user) {
    const error = new Error('Invalid Login ID or Password.');
    error.statusCode = 401;
    throw error;
  }

  if (!user.isActive) {
    const error = new Error('Your account is inactive. Please contact administrator.');
    error.statusCode = 403;
    throw error;
  }

  if (user.approvalStatus === 'PENDING') {
    const error = new Error('Your account is pending admin approval.');
    error.statusCode = 403;
    throw error;
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    const error = new Error('Invalid Login ID or Password.');
    error.statusCode = 401;
    throw error;
  }

  // Update last login
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
    include: { contact: true },
  });

  const safeUser = toSafeUser(updatedUser);
  const token = createToken(safeUser);

  return { user: safeUser, token };
}

async function getUserProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { contact: true },
  });

  if (!user) {
    const error = new Error('User not found.');
    error.statusCode = 404;
    throw error;
  }

  return toSafeUser(user);
}

module.exports = {
  loginUser,
  getUserProfile,
  createToken,
  toSafeUser,
};
