const getGeneratorInput = () => ({
  config: {
    platform: "pagerduty",
    type: "js-request-function",
    envVars: {
      BUILDABLE_PAGERDUTY_API_KEY: {
        development: "",
        production: "",
        in: "header",
        headerName: "authorization",
        value: "Token token= ${BUILDABLE_PAGERDUTY_API_KEY}"
      }
    },
    fee: 0,
    category: "alerts",
    accessType: "open",
    language: "javascript",
    price: "free",
    tags: ["alerts"],
    stateType: "stateless",
    __version: "1.0.0",
    connections: [
      {
        id: "627aceaf971c67182d1d76ca",
        type: "integration"
      }
    ]
  },
  url: "https://raw.githubusercontent.com/PagerDuty/api-schema/main/reference/REST/openapiv3.json"
})

module.exports = {
  getGeneratorInput
}