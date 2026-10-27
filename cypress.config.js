// cypress.config.js – Cypress configuration for RecoverAI
const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    // Adjust the baseUrl to match Vite dev server port (default 5173)
    baseUrl: 'http://localhost:5173',
    setupNodeEvents(on, config) {
      // implement node event listeners if needed
      return config;
    },
  },
});
