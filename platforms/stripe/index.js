const {titleCase} = require("title-case")
const kebabCase = require("lodash/kebabCase")
const {
  camelize,
  sentenceCase,
} = require("../../utils");

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
        name: "Authorization"
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
  url: "https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json", //merged with postman collection https://raw.githubusercontent.com/stripe/stripe-postman/master/StripeAPICollection.json https://www.postman.com/stripedev/workspace/stripe-developers/overview
  getTitle(openapi, path, method) {
    let summary = openapi.paths[path][method].summary || openapi.paths[path][method].description || kebabCase(openapi.paths[path][method].operationId).replace(/-/g, " ") || `${method.toUpperCase()} ${path}`
    summary = summary.replace(/<[^>]*>?/gm, ''); // clear any html tags
    const periodIndex = summary.indexOf(".")
    const endIndex = periodIndex === -1 ? 100 : periodIndex
    const title = titleCase(summary).substring(0, endIndex)

    return title
  },
  getDescription(openapi, path, method) {
    let summary = openapi.paths[path][method].summary || openapi.paths[path][method].description || kebabCase(openapi.paths[path][method].operationId).replace(/-/g, " ") || `${method.toUpperCase()} ${path}`
    summary = summary.replace(/<[^>]*>?/gm, ''); // clear any html tags
    summary = summary.replace(/\n/g, "") // remove any new line character insertions in the text
    summary = summary.replace(/\.(?=[A-Za-z])/g, ". ") // add a space after each period and non space character
    const description = sentenceCase(summary).endsWith(".") ? sentenceCase(summary).slice(0, -1) : sentenceCase(summary)

    return description
  },
  getConfigName({ openapi, path, method }) {
    return camelize(openapi.paths[path][method].summary || openapi.paths[path][method].operationId) + "Result"
  },
  getDirName({ openapi, path, method }) {
    return kebabCase(openapi.paths[path][method].summary || openapi.paths[path][method].operationId)
  }
})

module.exports = {
  getGeneratorInput
}