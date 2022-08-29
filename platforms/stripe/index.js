const getGeneratorInput = () => ({
  baseURL: `https://api.stripe.com`,
  config: {
    platform: "stripe",
    type: "js-request-function",
    envVars: {
      BUILDABLE_STRIPE_SECRET_KEY: {
        development: "",
        production: "",
        in: "header",
        // name: "password",
        headerName: "authorization"
      }
    },
    fee: 0,
    category: "payments",
    accessType: "open",
    language: "javascript",
    price: "free",
    tags: ["payments", "accounts"],
    stateType: "stateless",
    __version: "1.0.0",
    connections: [
      {
        id: "627aceaf971c67182d1d76ca",
        type: "integration"
      }
    ]
  },
  pathOrURL: "./openapi-specs/stripe-merged.json",
  isURL: false,
  getTitle(openApi, path, method) {
    let summary = openApi.paths[path][method].summary || openApi.paths[path][method].description || kebabCase(openApi.paths[path][method].operationId).replace(/-/g, " ") || `${method.toUpperCase()} ${path}`
    summary = summary.replace(/<[^>]*>?/gm, ''); // clear any html tags
    const periodIndex = summary.indexOf(".")
    const endIndex = periodIndex === -1 ? 100 : periodIndex
    const title = titleCase(summary).substring(0, endIndex)

    return title
  },
  getDescription(openApi, path, method) {
    let summary = openApi.paths[path][method].summary || openApi.paths[path][method].description || kebabCase(openApi.paths[path][method].operationId).replace(/-/g, " ") || `${method.toUpperCase()} ${path}`
    summary = summary.replace(/<[^>]*>?/gm, ''); // clear any html tags
    summary = summary.replace(/\n/g, "") // remove any new line character insertions in the text
    summary = summary.replace(/\.(?=[A-Za-z])/g, ". ") // add a space after each period and non space character
    const description = sentenceCase(summary).endsWith(".") ? sentenceCase(summary).slice(0, -1) : sentenceCase(summary)

    return description
  },
  getConfigName({ openApi, path, method }) {
    return camelize(openApi.paths[path][method].summary || openApi.paths[path][method].operationId) + "Result"
  },
  getDirName({ openApi, path, method }) {
    return kebabCase(openApi.paths[path][method].summary || openApi.paths[path][method].operationId)
  }
})

module.exports = {
  getGeneratorInput
}