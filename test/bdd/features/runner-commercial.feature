@BDD @US5 @runner-commercial-browser
Feature: Runner is included in the existing plans
  @FR-020 @BDD-US5-FR020
  Scenario: Pro setup includes Runner without another purchase
    Given a visitor is viewing Clipify's public pricing
    When they open the Pro setup dialog
    Then Runner is described as included and no standalone Runner purchase is offered

  @FR-020 @BDD-US5-OPT065
  Scenario: Retired Runner checkout links return to included access
    Given a visitor is viewing Clipify's public pricing
    When they follow an old Runner purchase link
    Then they return to pricing without a Runner checkout intent

  @FR-020 @BDD-US5-OPT064
  Scenario: Public pricing groups included Runner benefits
    Given a visitor is viewing Clipify's public pricing
    Then public pricing explains included Runner limits without an add-on offer

  @FR-020 @BDD-US5-OPT066
  Scenario: Billing controls include Runner without selling an add-on
    Given a visitor is viewing Clipify's public pricing
    When a Free creator opens their billing controls
    Then billing offers no new Runner purchase and explains included access

  @FR-020 @BDD-US5-OPT067
  Scenario: A Free creator can create a Runner without a purchase
    Given a visitor is viewing Clipify's public pricing
    When a Free creator opens Runner onboarding
    Then Runner onboarding explains included access and creates a Runner without checkout

  @FR-020 @FR-023 @BDD-US5-DEC013
  Scenario: Public and machine-readable guidance agree on included Runner
    Given a visitor is viewing Clipify's public pricing
    Then pricing, features and served reference documents agree on the two included Runner plans
