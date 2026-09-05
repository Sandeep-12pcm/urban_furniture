const { prisma } = require('../config/db');

async function getAllProducts(query = {}) {
  const { search, type, isActive, page = 1, limit = 50 } = query;
  const where = {};

  if (type) {
    where.type = type;
  }

  if (isActive !== undefined) {
    where.isActive = isActive === 'true' || isActive === true;
  }

  if (search) {
    where.OR = [
      { code: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const takeNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * takeNum;

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: takeNum,
      include: {
        salesAccount: { select: { id: true, code: true, name: true } },
        expenseAccount: { select: { id: true, code: true, name: true } },
      },
      orderBy: { code: 'asc' },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products,
    pagination: {
      total,
      page: pageNum,
      limit: takeNum,
      totalPages: Math.ceil(total / takeNum),
    },
  };
}

async function getProductById(id) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      salesAccount: true,
      expenseAccount: true,
    },
  });

  if (!product) {
    const error = new Error(`Product with ID '${id}' not found.`);
    error.statusCode = 404;
    throw error;
  }

  return product;
}

async function createProduct(data) {
  const code = data.code.trim().toUpperCase();

  const existing = await prisma.product.findUnique({
    where: { code },
  });

  if (existing) {
    const error = new Error(`A product with code '${code}' already exists.`);
    error.statusCode = 409;
    throw error;
  }

  // Validate accounts if provided
  if (data.salesAccountId) {
    const acc = await prisma.account.findUnique({ where: { id: data.salesAccountId } });
    if (!acc) {
      const error = new Error(`Sales account with ID '${data.salesAccountId}' does not exist.`);
      error.statusCode = 400;
      throw error;
    }
  }

  if (data.expenseAccountId) {
    const acc = await prisma.account.findUnique({ where: { id: data.expenseAccountId } });
    if (!acc) {
      const error = new Error(`Expense account with ID '${data.expenseAccountId}' does not exist.`);
      error.statusCode = 400;
      throw error;
    }
  }

  const product = await prisma.product.create({
    data: {
      code,
      name: data.name.trim(),
      description: data.description ? data.description.trim() : null,
      salesPrice: data.salesPrice !== undefined ? Number(data.salesPrice) : 0.00,
      costPrice: data.costPrice !== undefined ? Number(data.costPrice) : 0.00,
      type: data.type || 'STORABLE',
      uom: data.uom ? data.uom.trim() : 'Units',
      salesAccountId: data.salesAccountId || null,
      expenseAccountId: data.expenseAccountId || null,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    },
    include: {
      salesAccount: true,
      expenseAccount: true,
    },
  });

  return product;
}

async function updateProduct(id, data) {
  await getProductById(id);

  if (data.code) {
    const code = data.code.trim().toUpperCase();
    const existing = await prisma.product.findFirst({
      where: {
        code,
        NOT: { id },
      },
    });
    if (existing) {
      const error = new Error(`A product with code '${code}' already exists.`);
      error.statusCode = 409;
      throw error;
    }
  }

  if (data.salesAccountId) {
    const acc = await prisma.account.findUnique({ where: { id: data.salesAccountId } });
    if (!acc) {
      const error = new Error(`Sales account with ID '${data.salesAccountId}' does not exist.`);
      error.statusCode = 400;
      throw error;
    }
  }

  if (data.expenseAccountId) {
    const acc = await prisma.account.findUnique({ where: { id: data.expenseAccountId } });
    if (!acc) {
      const error = new Error(`Expense account with ID '${data.expenseAccountId}' does not exist.`);
      error.statusCode = 400;
      throw error;
    }
  }

  const updatePayload = {};
  if (data.code !== undefined) updatePayload.code = data.code.trim().toUpperCase();
  if (data.name !== undefined) updatePayload.name = data.name.trim();
  if (data.description !== undefined) updatePayload.description = data.description ? data.description.trim() : null;
  if (data.salesPrice !== undefined) updatePayload.salesPrice = Number(data.salesPrice);
  if (data.costPrice !== undefined) updatePayload.costPrice = Number(data.costPrice);
  if (data.type !== undefined) updatePayload.type = data.type;
  if (data.uom !== undefined) updatePayload.uom = data.uom ? data.uom.trim() : 'Units';
  if (data.salesAccountId !== undefined) updatePayload.salesAccountId = data.salesAccountId || null;
  if (data.expenseAccountId !== undefined) updatePayload.expenseAccountId = data.expenseAccountId || null;
  if (data.isActive !== undefined) updatePayload.isActive = Boolean(data.isActive);

  const product = await prisma.product.update({
    where: { id },
    data: updatePayload,
    include: {
      salesAccount: true,
      expenseAccount: true,
    },
  });

  return product;
}

async function deleteProduct(id) {
  await getProductById(id);

  // Check if product is referenced in any order/invoice/bill items
  const [poCount, soCount, invCount, billCount] = await Promise.all([
    prisma.purchaseOrderItem.count({ where: { productId: id } }),
    prisma.salesOrderItem.count({ where: { productId: id } }),
    prisma.customerInvoiceItem.count({ where: { productId: id } }),
    prisma.vendorBillItem.count({ where: { productId: id } }),
  ]);

  if (poCount > 0 || soCount > 0 || invCount > 0 || billCount > 0) {
    const archived = await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
    return { product: archived, archived: true, message: 'Product is used in transactions and was archived.' };
  }

  const deleted = await prisma.product.delete({
    where: { id },
  });

  return { product: deleted, archived: false, message: 'Product deleted successfully.' };
}

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
