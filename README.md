# Demonstration of "Quick Start" for SPK

## Problem

* Setting up SPK takes too much
* When someone visits a GitHub project page they will want to get up and going extremely fast
* Currently we have many entry points and don't do enough to guide users down a pat
* I want users to _get_ GitOps in less than 5 minutes.

## What to accomplish in this prototype

* Develop a way to help users quickly and interactively build up their configuration  
* Supercharge our scaffolding by doing what we do in the integration tests

## Current Requirements

Current this prototype assuming the repo for this project is a sibling to a the `spk` repo. The sibling `spk` must be named `spk`.  

## Current Ability
* There is a prototype of creating Manifest and HLD repos.

------
## TypeScript Links

Install Typescript globally
`npm install -g typescript`

Install webpack
`npm install --save-dev webpack webpack-cli`
yarn add webpack webpack-cli --dev

> Both of these dependencies will let TypeScript and webpack play well together. ts-loader helps Webpack compile your TypeScript code using the TypeScript’s standard configuration file named tsconfig.json. source-map-loader uses any sourcemap outputs from TypeScript to inform webpack when generating its own sourcemaps. This will allow you to debug your final output file as if you were debugging your original TypeScript source code.

`npm install --save-dev typescript ts-loader source-map-loader`
yarn add ts-loader typescript source-map-loader pkg --dev
yarn add ts-loader  --dev
yarn add @types/clui --dev

Initialize a package.json interactively
`yarn init`

Add dependencies
`yarn add chalk figlet inquirer shelljs ts-node clear`
`yarn add ts-node`

## Great Links

- https://www.typescriptlang.org/docs/handbook/react-&-webpack.html (Covers project layout)
- https://github.com/SBoudrias/Inquirer.js/tree/master/packages/inquirer/examples (Inqurier examples)
