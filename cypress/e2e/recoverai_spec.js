// cypress/e2e/recoverai_spec.js – basic end‑to‑end test for RecoverAI

describe('RecoverAI App', () => {
  it('loads the homepage and displays the title', () => {
    // Visit the Vite dev server URL (adjust if you run on a different port)
    cy.visit('/')
    // Expect the page title to contain "RecoverAI" (assuming the <title> element is set)
    cy.title().should('include', 'RecoverAI')
    // Check that the root element rendered by React exists
    cy.get('#root').should('exist')
  })
})
