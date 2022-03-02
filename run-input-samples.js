const tatum = {
  baseURL: "{TATUM_API_URL}", // can be hardcoded string (i.e https://my-api.com) and/or contain envVar replacement values (i.e https://{SOME_API_URL}/api)
  config: {
    envVars: {
      TATUM_API_URL: {
        development: "https://api-us-west1.tatum.io",
        production: "https://api-us-west1.tatum.io",
        in: "path"
      },
      TATUM_API_KEY: {
        development: "",
        production: "",
        in: "header",
        headerName: "x-api-key"
      },
    },
    type: "js-request-function",
    fee: 0,
    category: "blockchain",
    accessType: "open",
    language: "javascript",
    price: "free",
    platform: "tatum",
    tags: ["blockchain", "cryptocurrency", "web3"],
    stateType: "stateless",
    __version: "1.0.0",
  },
  pathOrURL: "../../Desktop/tatum-openapi.json",
  isURL: false,
  getDocs: (openApi, path, method) => {
    return `https://tatum.io/apidoc.php#operation/${openApi.paths[path][method].operationId}`
  }
}

const twitter = {
  // baseURL: "{TATUM_API_URL}", // can be hardcoded string (i.e https://my-api.com) and/or contain envVar replacement values (i.e https://{SOME_API_URL}/api)
  config: {
    type: "js-request-function",
    envVars: {
      TWITTER_BEARER_TOKEN: {
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
    tags: ["twitter", "social"],
    stateType: "stateless",
    __version: "1.0.0",
  },
  pathOrURL: "https://api.twitter.com/2/openapi.json",
  isURL: true,
  getDocs: (openApi, path, method) => {
    return `https://developer.twitter.com/en/docs/api-reference-index#twitter-api-v2`
  },
  getRunFile: ({
    openApi, 
    path, 
    method,
    title,
    description,
    docs,
    input,
    axiosCall,
    verifyInput,
    verifyErrors,
    verifyChecks,
  }) => `
  /**
   * ----------------------------------------------------------------------------------------------------
   * ${title} [Run]
   *
   * @description - ${description}
   *
   * @author    Buildable Technologies Inc.
   * @access    open
   * @license   MIT
   * @docs      ${docs}
   *
   * ----------------------------------------------------------------------------------------------------
   */
  
  const axios = require("axios");
  const qs = require("qs");
  
  /**
   * The Node’s executable function
   *
   * @param {Run} input - Data passed to your Node from the input function
   */
  const run = async (input) => {
    const { ${input} } = input;
  
    verifyInput(input);
  
    try {
      const { data } = await axios({
        ${axiosCall}
      });
  
      return data;
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
  `
}

const github = {
  baseURL: "https://api.github.com", // can be hardcoded string (i.e https://my-api.com) and/or contain envVar replacement values (i.e https://{SOME_API_URL}/api)
  config: {
    platform: "github",
    envVars: {
      GITHUB_API_TOKEN: {
        development: "",
        production: "",
        in: "auth",
        name: "password"
      },
      GITHUB_API_USERNAME: {
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
    tags: ["git", "github"],
    stateType: "stateless",
    __version: "1.0.0",
  },
  pathOrURL: "../play/openapi-github.json",
  isURL: false,
}

const twilio = {
  // baseURL: "https://api.github.com", // can be hardcoded string (i.e https://my-api.com) and/or contain envVar replacement values (i.e https://{SOME_API_URL}/api)
  config: {
    platform: "twilio",
    envVars: {
      TWILIO_ACCOUNT_SID: {
        development: "",
        production: "",
        in: "auth",
        name: "username"
      },
      TWILIO_AUTH_TOKEN: {
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
    tags: ["twilio", "communication", "sms"],
    stateType: "stateless",
    __version: "1.0.0",
  },
  pathOrURL: "../play/twilio-openapi.json",
  isURL: false,
  getDocs: () => {
    return `https://www.twilio.com/docs`
  },
  getTitle: (openApi, path, method) => {
    return titleCase(kebabCase(openApi.paths[path][method].operationId).replace(/-/g, " "))
  },
  getDescription: (openApi, path, method) => {
    return sentenceCase(openApi.paths[path][method].description)
  },
}

const notion = {
  baseURL: "https://api.notion.com", // can be hardcoded string (i.e https://my-api.com) and/or contain envVar replacement values (i.e https://{SOME_API_URL}/api)
  config: {
    platform: "notion",
    envVars: {
      NOTION_API_TOKEN: {
        development: "",
        production: "",
        in: "header",
        // name: "password",
        headerName: "authorization"
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
  },
  pathOrURL: "/Users/mike.gindin/Downloads/openapi.json",
  isURL: false,
}