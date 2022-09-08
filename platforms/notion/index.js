const getGeneratorInput = () => ({
  config: {
    platform: "notion",
    type: "js-request-function",
    envVars: {
      BUILDABLE_NOTION_API_TOKEN: {
        development: "",
        production: "",
        in: "header",
        name: "Authorization"
      }
    },
    fee: 0,
    category: "cms",
    accessType: "open",
    language: "javascript",
    price: "free",
    tags: ["notes", "database", "website"],
    stateType: "stateless",
    __version: "1.0.0",
    connections: [
      {
        id: "62d8577d0bd36f737a23f62c",
        type: "integration"
      }
    ]
  },
  // url: "https://www.postman.com/notionhq/workspace/notion-s-api-workspace/overview" // converted to openapi from a postman collection
})

module.exports = {
  getGeneratorInput
}