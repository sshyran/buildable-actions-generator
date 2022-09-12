![Header](https://assets.buildable.dev/catalog/graphics/one-api-100-integrations.png)

[![Buildable](https://assets.buildable.dev/buildable-logos/powered-by-buildable.svg)](https://buildable.dev) [![GitHub stars](https://img.shields.io/github/stars/buildable/actions-generator)](https://github.com/buildable/actions-generator/stargazers) ![GitHub contributors](https://img.shields.io/github/contributors/buildable/actions-generator) ![GitHub pull requests](https://img.shields.io/github/issues-pr-raw/buildable/actions-generator) ![GitHub commit activity](https://img.shields.io/github/commit-activity/m/buildable/actions-generator) [![GitHub issues](https://img.shields.io/github/issues/buildable/actions-generator)](https://github.com/buildable/actions-generator/issues) ![GitHub closed issues](https://img.shields.io/github/issues-closed/buildable/actions-generator) ![GitHub release (latest by date)](https://img.shields.io/github/v/release/buildable/actions-generator) [![GitHub license](https://img.shields.io/github/license/buildable/actions-generator)](https://github.com/buildable/actions-generator) [![Twitter Follow](https://img.shields.io/twitter/follow/BuildableHQ?style=social)](https://twitter.com/BuildableHQ)

---

# Buildable Action Generator

Action Templates are open-source functions that save developers hundreds of hours when integrating databases, apps and other complicated logic. They work natively with [Buildable Workflows](https://docs.buildable.dev/workflows/building-workflows), which means you can build, test, deploy any integration using Templates in a matter of minutes.

## OpenAPI Generated Actions

### Getting Started

`> npm install`

`> npm run generate PLATFORM_NAME`

Replace `PLATFORM_NAME` with one of the platforms available under the `platforms` folder

See generated actions-generator in the `generated` folder :)

### Adding a new platform

- Create a new folder under `platforms` (you can copy over one of the existing ones)
- Edit the `getGeneratorInput` function with required data (See [schemas/generatorInput.json](schemas/generatorInput.json))
- To use a local spec instead of a remote one (e.g the remote needs updating), add it as `openapi.json` under the platform folder (see the `circleci` folder as an example)

<hr />

### Contributors

Supported by a network of early advocates, contributors, and champions!

<a href="https://github.com/buildable/actions-generator/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=buildable/actions-generator" />
</a>

### License

© 2022, Buildable Technologies Inc. - Released under the MIT License
