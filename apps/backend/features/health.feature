Feature: Backend availability
  As an operator
  I want to check the backend health
  So that I know the API is available

  Scenario: The backend responds to a root request
    When I request the backend root endpoint
    Then the response status is 200
    And the response body contains the greeting
