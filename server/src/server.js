const { createApp } = require('./app');
const { config } = require('./config');

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`Urban Furniture Accounting Server running on http://localhost:${config.port}/api`);
});

module.exports = { app, server };
