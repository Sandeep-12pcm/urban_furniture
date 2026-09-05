module.exports = async function globalTeardown() {
  // Leave the test database in place for local debugging after a run;
  // globalSetup always drops and recreates it fresh next time.
};
