const axios = require("axios");

(async () => {
  await axios({
    method: 'post',
    url: 'https://api.github.com/repos/buildable-dev/test/pulls',
    // auth: {
    //   password: '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',
    //   username: 'buildable-dev'
    // },
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer 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`
    },
    data: { head: 'development', base: 'main' }
  })

})()