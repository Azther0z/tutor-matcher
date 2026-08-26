Feature: Backend health
  As an operator
  I want to check the backend health
  So that I know the API is available

  Scenario: The backend reports that it is healthy
    When I request the health endpoint
    Then the response status is 200
    And the response body reports an ok status
