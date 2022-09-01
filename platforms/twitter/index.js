const {
  getTemplateString,
} = require("../../utils");

const getGeneratorInput = () => ({
  // baseURL: "{TATUM_API_URL}", // can be hardcoded string (i.e https://my-api.com) and/or contain envVar replacement values (i.e https://{SOME_API_URL}/api)
  config: {
    type: "js-request-function",
    envVars: {
      BUILDABLE_TWITTER_BEARER_TOKEN: {
        development: "",
        production: "",
        in: "header",
        headerName: "authorization"
      },
    },
    fee: 0,
    category: "social",
    accessType: "open",
    language: "javascript",
    price: "free",
    platform: "twitter",
    tags: ["news", "tweet"],
    stateType: "stateless",
    __version: "1.0.0",
    connections: [
      {
        id: "62d86a790bd36f737a23f636",
        type: "integration"
      }
    ],
  },
  url: "https://api.twitter.com/2/openapi.json",
  getRunFile: ({
    title,
    description,
    docs,
    imports,
    input,
    url,
    method,
    axiosHeaders,
    axiosAuth,
    axiosParams,
    axiosData,
    verifyInput,
    verifyErrors,
    verifyChecks,
  }) => {
    return `
    const axios = require("axios");${axiosParams.length > 0 ? `\nconst qs = require("qs");` : ""}

    const run = async (input) => {
      const { ${input} } = input;
    
      verifyInput(input);
    
      try {
        const { ${input.includes("data") ? "data: _data" : "data"} } = await axios({
          method: ${getTemplateString(method)},
          url: ${getTemplateString(url)},
          ${[
            axiosHeaders, 
            axiosAuth, 
            axiosParams, 
            axiosParams.length > 0 ? `paramsSerializer: (params) => { return qs.stringify(params, { arrayFormat: "comma" }); }` : "", 
            axiosData].filter(i => !!i.trim()).join(",\n")}
        });
    
        return ${input.includes("data") ? "_data" : "data"};
      } catch (error) {
        return {
          failed: true,
          message: error.message,
          data: error.response.data,
        };
      }
    };
    
    /**
     * Verifies the input parameters
     */
    const verifyInput = ({ ${verifyInput} }) => {
      const ERRORS = {
        ${verifyErrors}
      };
    
      ${verifyChecks}
    };`
    
  },
})

module.exports = {
  getGeneratorInput
}