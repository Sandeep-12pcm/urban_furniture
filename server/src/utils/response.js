function successResponse(res, data = null, message = 'Success', statusCode = 200, extra = {}) {
  return res.status(statusCode).json({
    success: true,
    data,
    message,
    ...extra,
  });
}

function errorResponse(res, message = 'An error occurred', errors = [], statusCode = 400) {
  return res.status(statusCode).json({
    success: false,
    message,
    errors: Array.isArray(errors) ? errors : [errors],
  });
}

module.exports = {
  successResponse,
  errorResponse,
};
