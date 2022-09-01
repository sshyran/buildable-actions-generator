const getGeneratorInput = () => ({
  baseURL: `https://circleci.com/api/v2`,
  config: {
    platform: "circleci",
    type: "js-request-function",
    envVars: {
      BUILDABLE_CIRCLECI_PERSONAL_API_KEY: {
        development: "",
        production: "",
        in: "auth",
        name: "username"
      }
    },
    fee: 0,
    category: "devops",
    accessType: "open",
    language: "javascript",
    price: "free",
    tags: ["ci", "cicd"],
    stateType: "stateless",
    __version: "1.0.0",
    connections: [
      {
        id: "62f403ceaf5b59234588c878",
        type: "integration"
      }
    ]
  },
})

module.exports = {
  getGeneratorInput
}