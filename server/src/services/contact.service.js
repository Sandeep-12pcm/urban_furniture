const { prisma } = require('../config/db');

async function getAllContacts(query = {}) {
  const { type, search, isActive, page = 1, limit = 50 } = query;
  const where = {};

  if (type) {
    where.type = type;
  }

  if (isActive !== undefined) {
    where.isActive = isActive === 'true' || isActive === true;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { taxId: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const takeNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * takeNum;

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      skip,
      take: takeNum,
      orderBy: { name: 'asc' },
    }),
    prisma.contact.count({ where }),
  ]);

  return {
    contacts,
    pagination: {
      total,
      page: pageNum,
      limit: takeNum,
      totalPages: Math.ceil(total / takeNum),
    },
  };
}

async function getContactById(id) {
  const contact = await prisma.contact.findUnique({
    where: { id },
  });

  if (!contact) {
    const error = new Error(`Contact with ID '${id}' not found.`);
    error.statusCode = 404;
    throw error;
  }

  return contact;
}

async function createContact(data) {
  if (data.email && data.email.trim()) {
    const existing = await prisma.contact.findFirst({
      where: { email: { equals: data.email.trim(), mode: 'insensitive' } },
    });
    if (existing) {
      const error = new Error(`A contact with email '${data.email}' already exists.`);
      error.statusCode = 409;
      throw error;
    }
  }

  const contact = await prisma.contact.create({
    data: {
      name: data.name.trim(),
      type: data.type || 'CUSTOMER',
      email: data.email ? data.email.trim().toLowerCase() : null,
      phone: data.phone ? data.phone.trim() : null,
      taxId: data.taxId ? data.taxId.trim() : null,
      street: data.street ? data.street.trim() : null,
      city: data.city ? data.city.trim() : null,
      state: data.state ? data.state.trim() : null,
      zip: data.zip ? data.zip.trim() : null,
      country: data.country ? data.country.trim() : 'India',
      isCompany: data.isCompany !== undefined ? Boolean(data.isCompany) : false,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    },
  });

  return contact;
}

async function updateContact(id, data) {
  await getContactById(id);

  if (data.email && data.email.trim()) {
    const existing = await prisma.contact.findFirst({
      where: {
        email: { equals: data.email.trim(), mode: 'insensitive' },
        NOT: { id },
      },
    });
    if (existing) {
      const error = new Error(`A contact with email '${data.email}' already exists.`);
      error.statusCode = 409;
      throw error;
    }
  }

  const updatePayload = {};
  if (data.name !== undefined) updatePayload.name = data.name.trim();
  if (data.type !== undefined) updatePayload.type = data.type;
  if (data.email !== undefined) updatePayload.email = data.email ? data.email.trim().toLowerCase() : null;
  if (data.phone !== undefined) updatePayload.phone = data.phone ? data.phone.trim() : null;
  if (data.taxId !== undefined) updatePayload.taxId = data.taxId ? data.taxId.trim() : null;
  if (data.street !== undefined) updatePayload.street = data.street ? data.street.trim() : null;
  if (data.city !== undefined) updatePayload.city = data.city ? data.city.trim() : null;
  if (data.state !== undefined) updatePayload.state = data.state ? data.state.trim() : null;
  if (data.zip !== undefined) updatePayload.zip = data.zip ? data.zip.trim() : null;
  if (data.country !== undefined) updatePayload.country = data.country ? data.country.trim() : null;
  if (data.isCompany !== undefined) updatePayload.isCompany = Boolean(data.isCompany);
  if (data.isActive !== undefined) updatePayload.isActive = Boolean(data.isActive);

  const contact = await prisma.contact.update({
    where: { id },
    data: updatePayload,
  });

  return contact;
}

async function deleteContact(id) {
  await getContactById(id);

  // Check if contact is referenced by transactions
  const [invoicesCount, billsCount, ordersCount] = await Promise.all([
    prisma.customerInvoice.count({ where: { customerId: id } }),
    prisma.vendorBill.count({ where: { vendorId: id } }),
    prisma.salesOrder.count({ where: { customerId: id } }),
  ]);

  if (invoicesCount > 0 || billsCount > 0 || ordersCount > 0) {
    // Soft-delete / Archive
    const archived = await prisma.contact.update({
      where: { id },
      data: { isActive: false },
    });
    return { contact: archived, archived: true, message: 'Contact has active transactions and was archived.' };
  }

  const deleted = await prisma.contact.delete({
    where: { id },
  });

  return { contact: deleted, archived: false, message: 'Contact deleted successfully.' };
}

module.exports = {
  getAllContacts,
  getContactById,
  createContact,
  updateContact,
  deleteContact,
};
