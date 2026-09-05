const roles = Object.freeze({
  ADMIN: 'ADMIN',
  ACCOUNTANT: 'ACCOUNTANT',
  CONTACT: 'CONTACT',
});

const permissions = Object.freeze({
  MANAGE_USERS: 'manage users',
  MANAGE_MASTER_DATA: 'manage master data',
  RECORD_TRANSACTIONS: 'record transactions',
  VIEW_REPORTS: 'view reports',
  VIEW_OWN_INVOICES: 'view own invoices',
  VIEW_OWN_BILLS: 'view own bills',
  VIEW_OWN_PAYMENT_STATUS: 'view own payment status',
  MAKE_PAYMENTS: 'make payments',
});

const rolePermissions = Object.freeze({
  ADMIN: [
    permissions.MANAGE_USERS,
    permissions.MANAGE_MASTER_DATA,
    permissions.RECORD_TRANSACTIONS,
    permissions.VIEW_REPORTS,
  ],
  ACCOUNTANT: [
    permissions.MANAGE_MASTER_DATA,
    permissions.RECORD_TRANSACTIONS,
    permissions.VIEW_REPORTS,
  ],
  CONTACT: [
    permissions.VIEW_OWN_INVOICES,
    permissions.VIEW_OWN_BILLS,
    permissions.VIEW_OWN_PAYMENT_STATUS,
    permissions.MAKE_PAYMENTS,
  ],
});

module.exports = { roles, permissions, rolePermissions };
