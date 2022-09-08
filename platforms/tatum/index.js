const getGeneratorInput = () => ({
  baseURL: "{BUILDABLE_TATUM_API_URL}", // can be hardcoded string (i.e https://my-api.com) and/or contain envVar replacement values (i.e https://{SOME_API_URL}/api)
  config: {
    envVars: {
      BUILDABLE_TATUM_API_URL: {
        development: "https://api-us-west1.tatum.io",
        production: "https://api-us-west1.tatum.io",
        in: "path"
      },
      BUILDABLE_TATUM_API_KEY: {
        development: "",
        production: "",
        in: "header",
        name: "x-api-key"
      },
    },
    type: "js-request-function",
    fee: 0,
    category: "web3",
    accessType: "open",
    language: "javascript",
    price: "free",
    platform: "tatum",
    tags: ["blockchain", "crypto", "nft"],
    stateType: "stateless",
    __version: "1.0.0",
    connections: [
      { 
        id: "62d868570bd36f737a23f634",
        type: "integration"
      }
    ]
  },
})

module.exports = {
  getGeneratorInput
}