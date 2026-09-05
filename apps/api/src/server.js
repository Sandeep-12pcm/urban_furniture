const { createApp } = require('./app');
const { config } = require('./config');

const app = createApp();

app.listen(config.port, () => {
  console.log(`API running on http://localhost:${config.port}/api`);
  console.log(`Swagger docs on http://localhost:${config.port}/api/docs`);
});
