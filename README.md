![Header](https://assets.buildable.dev/catalog/graphics/one-api-100-integrations.png)

[![Buildable](https://assets.buildable.dev/buildable-logos/powered-by-buildable.svg)](https://buildable.dev) [![GitHub stars](https://img.shields.io/github/stars/buildable/templates)](https://github.com/buildable/templates/stargazers) ![GitHub contributors](https://img.shields.io/github/contributors/buildable/templates) ![GitHub pull requests](https://img.shields.io/github/issues-pr-raw/buildable/templates) ![GitHub commit activity](https://img.shields.io/github/commit-activity/m/buildable/templates) [![GitHub issues](https://img.shields.io/github/issues/buildable/templates)](https://github.com/buildable/templates/issues) ![GitHub closed issues](https://img.shields.io/github/issues-closed/buildable/templates) ![GitHub release (latest by date)](https://img.shields.io/github/v/release/buildable/templates) [![GitHub license](https://img.shields.io/github/license/buildable/templates)](https://github.com/buildable/templates) [![Twitter Follow](https://img.shields.io/twitter/follow/BuildableHQ?style=social)](https://twitter.com/BuildableHQ)

---

# Buildable Actions

## OpenAPI Generated Actions

<br/>

### Getting Started

`npm install`

`npm run generate PLATFORM_NAME`

Replace PLATFORM_NAME with one of the platforms available under the `platforms` folder

See generated actions in the `generated` folder :)

<br/>

### Adding a new platform

- create a new folder under `platforms` (you can copy over one of the existing ones)
- edit the `getGeneratorInput` function with required data (see See [schemas/generatorInput.json](schemas/generatorInput.json))
- To use a local spec instead of a remote one (e.g the remote needs updating), add it as `openapi.json` under the platform folder (see the `circleci` folder as an example)



