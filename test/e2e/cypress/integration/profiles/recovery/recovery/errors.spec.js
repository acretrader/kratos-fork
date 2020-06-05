import { APP_URL, gen, parseHtml } from '../../../../helpers'

context('Recovery', () => {
  describe('error flow', () => {
    let identity

    before(() => {
      cy.deleteMail()
    })

    beforeEach(() => {
      cy.visit(APP_URL + '/recovery')
    })

    it('should receive a stub email when recovering a non-existent account', () => {
      const email = gen.email()
      cy.get('#recovery-token input[name="email"]').type(email)
      cy.get('button[type="submit"]').click()

      cy.location('pathname').should('eq', '/recovery')
      cy.get('.form-messages.global .info').should(
        'have.text',
        'An email containing a recovery link has been sent to the email address you provided.'
      )
      cy.get('#recovery-token input[name="email"]').should('have.value', email)

      cy.getMail().should((message) => {
        expect(message.subject.trim()).to.equal('Account access attempted')
        expect(message.fromAddress.trim()).to.equal('no-reply@ory.kratos.sh')
        expect(message.toAddresses).to.have.length(1)
        expect(message.toAddresses[0].trim()).to.equal(email)

        const link = parseHtml(message.body).querySelector('a')
        expect(link).to.be.null
      })
    })

    it('should cause form errors', () => {
      cy.get('button[type="submit"]').click()
      cy.get('.form-errors .message').should(
        'contain.text',
        'missing properties: email'
      )
    })

    it('is unable to recover the email address if the code is expired', () => {
      identity = gen.identity()
      cy.register(identity)
      cy.visit(APP_URL + '/recovery')

      cy.get('#recovery-token input[name="email"]').type(identity.email)
      cy.get('button[type="submit"]').click()

      cy.recoverEmailButExpired({ expect: { email: identity.email } })

      cy.get('.form-messages.global .error').should(
        'have.text',
        'The recovery token is invalid or has already been used. Please retry the flow.'
      )

      cy.noSession()
    })

    it('is unable to recover the account if the code is incorrect', () => {
      identity = gen.identity()
      cy.register(identity)
      cy.visit(APP_URL + '/recovery')

      cy.get('#recovery-token input[name="email"]').type(identity.email)
      cy.get('button[type="submit"]').click()

      cy.getMail().then((mail) => {
        const link = parseHtml(mail.body).querySelector('a')
        cy.visit(link.href + '-not') // add random stuff to the confirm challenge
        cy.get('.form-messages.global .error').should(
          'have.text',
          'The recovery token is invalid or has already been used. Please retry the flow.'
        )
        cy.noSession()
      })
    })

    it('is unable to recover the account using the token twice', () => {
      identity = gen.identity()
      cy.register(identity)
      cy.visit(APP_URL + '/recovery')

      cy.get('#recovery-token input[name="email"]').type(identity.email)
      cy.get('button[type="submit"]').click()

      cy.getMail().then((mail) => {
        const link = parseHtml(mail.body).querySelector('a')

        cy.visit(link.href) // add random stuff to the confirm challenge
        cy.session()
        cy.logout()

        cy.visit(link.href)
        cy.get('.form-messages.global .error').should(
          'have.text',
          'The recovery token is invalid or has already been used. Please retry the flow.'
        )
        cy.noSession()
      })
    })
  })
})
