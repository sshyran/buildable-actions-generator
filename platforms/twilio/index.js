const {
  getParameters,
  getTemplateString,
} = require("../../utils");

const getGeneratorInput = () => ({
  config: {
    platform: "twilio",
    envVars: {
      BUILDABLE_TWILIO_ACCOUNT_SID: {
        development: "",
        production: "",
        in: "auth",
        name: "username"
      },
      BUILDABLE_TWILIO_AUTH_TOKEN: {
        development: "",
        production: "",
        in: "auth",
        name: "password"
      },
    },
    fee: 0,
    category: "communication",
    accessType: "open",
    language: "javascript",
    price: "free",
    tags: ["marketing", "messages", "text"],
    stateType: "stateless",
    __version: "1.0.0",
    type: "js-request-function",
    connections: [
      {
        id: "62d8691d0bd36f737a23f635",
        type: "integration"
      }
    ],
  },
  url: "https://raw.githubusercontent.com/twilio/twilio-oai/main/spec/json/twilio_api_v2010.json",
  getParams: (openApi, path, method) => {
    return getParameters(openApi, path, method).filter(p => p.name !== "AccountSid")
  },
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
  }) => `  
  ${imports || axiosParams.length > 0 ? `const axios = require("axios");\nconst qs = require("qs");` : `const axios = require("axios");`}

  const run = async (input) => {
    const { ${input} } = input;
  
    verifyInput(input);
  
    try {
      const { ${input.includes("data") ? "data: _data" : "data"} } = await axios({
        method: ${getTemplateString(method)},
        url: ${getTemplateString(url.replace(/\{AccountSid}/g, "${BUILDABLE_TWILIO_ACCOUNT_SID}"))},
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
  };
  `,
})

module.exports = {
  getGeneratorInput
}