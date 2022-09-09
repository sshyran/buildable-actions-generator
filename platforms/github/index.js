const getGeneratorInput = () => ({
  baseURL: "https://api.github.com",
  config: {
    platform: "github",
    type: "js-request-function",
    envVars: {
      BUILDABLE_GITHUB_ACCESS_TOKEN: {
        development: "",
        production: "",
        in: "auth",
        name: "password"
      },
      BUILDABLE_GITHUB_ACCOUNT_USERNAME: {
        development: "",
        production: "",
        in: "auth",
        name: "username"
      },
    },
    fee: 0,
    category: "git",
    accessType: "open",
    language: "javascript",
    price: "free",
    tags: ["git", "code"],
    stateType: "stateless",
    __version: "1.0.0",
    connections: [
      {
        id: "62dace890bd36f737a23f655",
        type: "integration"
      }
    ]
  },
  url: "https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/ghes-3.6/ghes-3.6.json",
})

module.exports = {
  getGeneratorInput
}