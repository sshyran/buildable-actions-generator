const getGeneratorInput = () => ({
  baseURL: `https://slack.com/api`,
  config: {
    platform: "slack",
    type: "js-request-function",
    envVars: {
      BUILDABLE_SLACK_ACCESS_TOKEN: {
        development: "",
        production: "",
        in: "header",
        // name: "password",
        headerName: "authorization"
      }
    },
    fee: 0,
    category: "communication",
    accessType: "open",
    language: "javascript",
    price: "free",
    tags: ["business", "messaging", "chat"],
    stateType: "stateless",
    __version: "1.0.0",
    connections: [
      {
        id: "62d863cd0bd36f737a23f631",
        type: "integration"
      }
    ]
  },
  // url: "https://raw.githubusercontent.com/slackapi/slack-api-specs/master/web-api/slack_web_openapi_v2.json"
})

module.exports = {
  getGeneratorInput
}