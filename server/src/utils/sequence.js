function generateSequenceNumber(prefix) {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${year}-${timestamp}${random}`;
}

module.exports = {
  generateSequenceNumber,
};
