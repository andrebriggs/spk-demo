# Typescript Stuff



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
