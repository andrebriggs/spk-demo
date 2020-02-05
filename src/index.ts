import * as GitInterfaces from "azure-devops-node-api/interfaces/GitInterfaces";
import { GitRepository } from "azure-devops-node-api/interfaces/TfvcInterfaces";

import chalk from "chalk";
import child_process from "child_process";
import clear from "clear";
import cli from "clui";
import fs from "fs-extra";
import inquirer from "inquirer";
import os from "os";
import path from "path";
import simplegit, { SimpleGit, StatusResult  } from "simple-git/promise";

import { initialize as hldInitialize} from "../../spk/src/commands/hld/init";
import {
  ICommandOptions as IHldToManifestPipelineValues,
  installHldToManifestPipeline
} from "../../spk/src/commands/hld/pipeline";
import { BUILD_SCRIPT_URL } from "../../spk/src/lib/constants";
import { getRepositoryName } from "../../spk/src/lib/gitutils";
import { removeDir } from "../../spk/src/lib/ioUtil";
import { exec } from "../../spk/src/lib/shell";

import { hasValue } from "../../spk/src/lib/validator";
import { logger } from "../../spk/src/logger";
import * as azOps from "./az_utils";
import * as constants from "./constant_values";

const spawn = child_process.spawn;
const Spinner = cli.Spinner;
let hldUrl: string = "";
let manifestUrl: string = "";

const init = async () => {
  clear();
  console.log(
    chalk.blueBright("Welcome SPK Quick Start!")
  );
};

const installHelper = (
  command: string,
  onSuccess: { (): void; (): void },
  spinner: cli.Spinner
) => {
  return new Promise((resolve, reject) => {
    const process = spawn(command, { shell: true });
    spinner.start();
    process.on('exit', () => {
      spinner.stop();
      onSuccess();
      resolve();
    });
  });
};

const installPromiseHelper = (
  delegate: Promise<void>,
  onSuccess: { (): void; (): void },
  spinner: cli.Spinner
) => {
  return new Promise(async (resolve, reject) => {
    spinner.start();
    await delegate.then(() => {
      spinner.stop();
      onSuccess();
      resolve();
    });
  });
};

const installSpinner = async (installSubject: string) => {
  const spinner = new Spinner(`Installing ${installSubject}`);
  return installHelper(
    // 'yarn add -D prettier',
    "sleep 5",
    () => console.log(chalk.green(`Done installing ${installSubject}`)),
    spinner
  );
};

const installPromiseSpinner = async (
  installSubject: string,
  delegate: Promise<void>
) => {
  const spinner = new Spinner(`Installing ${installSubject}`);
  return installPromiseHelper(
    // 'yarn add -D prettier',
    delegate,
    () => console.log(chalk.green("Done installing "+installSubject)),
    spinner
  );
};

// const askIfJsorTs = () => {
//   const questions = [{
//     name: 'ENV',
//     type: 'list',
//     choices: ['.Typescript', '.Javascript'],
//     message: 'Please, select if this is a JavaScript or Typescript project',
//     filter: function(val: string) {
//       return val === '.Typescript' ? 'ts' : 'js'
//     },
//   }];
//   return inquirer.prompt(questions)
// }

// const requireLetterAndNumber = value => {
//     if (/\w/.test(value) && /\d/.test(value)) {
//       return true;
//     }

const askOrganization = () => {
  const questions = [{
    message: 'Enter {organization name}\n',
    name: 'azdo_org_name',
    type: 'input',
    validate: (value: string) => {
      const pass = value.match(
        /^\S*$/ // No Spaces
      );
      if (pass) {
        return true;
      }
      return 'Organization names must start with a letter or number, followed by letters, numbers or hyphens, and must end with a letter or number.';
    }
  }, {
    message: 'Enter {project name}\n',
    name: 'azdo_project_name',
    type: 'input',
    // validate: function(value: string) {
    //     var pass = value.match(
    //         /[^A-Za-z0-9-]+/ //See https://www.regextester.com
    //     );
    //     if (pass) {
    //       return true;
    //     }
    //     //TODO: If the project name has spaces use %20
    //     return 'Project names must start with a letter or number, followed by letters, percent, numbers or hyphens, and must end with a letter or number.';
    //   }
  }, {
    mask: '*',
    message: 'Enter your AzDO personal access token',
    name: 'azdo_pat',
    type: 'password',
    validate: (value: string) => {
      if (!hasValue(value)) {
        return 'Must enter a personal access token with read/write/manage permissions';
      }
      return true;
    }
  }];

  return inquirer.prompt(questions);
};

export const pushBranch = async (branchName: string): Promise<void> => {
  try {
    await exec("git", ["push", "-u", "origin", `${branchName}`]);
  } catch (err) {
    throw Error(`Unable to push git branch ${branchName}: ` + err);
  }
};

// let manifestRepoFiles: string[] = ["README.md"];
// let hldRepoFiles: string[] = ["README.md"];
// let appRepoFiles: string[] = ["README.md"];

const logCurrentDirectory = () => {
  logger.info(`Current directory: ${process.cwd()}`);
};

const createDirectory = (dirName: string) => {
  fs.mkdirpSync(dirName);
};

const moveToRelativePath = (relativePath: string) => {
  process.chdir(relativePath);
};

const moveToAbsPath = (absPath: string) => {
  process.chdir(absPath);
};

const homedir = os.homedir();
const WORKSPACE_DIR = path.resolve(path.join(homedir, constants.WORKSPACE));

const createRepoInAzureOrg = async (
  azureOrgUrl: string,
  accessToken: string,
  repoName: string,
  projectName: string
): Promise<GitRepository> => {
  const vstsCollectionLevel = await azOps.getWebApi(azureOrgUrl,accessToken); // org url
  const gitApi = await vstsCollectionLevel.getGitApi();
  const createOptions = {
    name: repoName,
    project: projectName
  } as GitInterfaces.GitRepositoryCreateOptions;
  return await gitApi.createRepository(createOptions, projectName);
};

const logGitInformation = (gitStatus: StatusResult) => {
  logger.info("Files in local Git:");
  gitStatus.files.forEach(f => logger.info("\t" + f.path));

  logger.info("Files added to Git:");
  gitStatus.created.forEach(f => logger.info("\t" + f));

  logger.info(chalk.yellow("Files not added to Git:"));
  gitStatus.not_added.forEach(f => logger.info("\t" + f));
};

const commitAndPushToRemote = async (
  git: SimpleGit,
  azureOrgName: string,
  azureProjectName: string,
  accessToken: string,
  repoName: string
) => {
  // Commit and check the local git log
  await git.commit(`Initial commit for ${repoName} repo`);

  const resultLog = await git.log();
  logger.info("Log Messages from Git:");
  resultLog.all.forEach(f => logger.info("\t" + f.date + " --> " + f.message));

  // TOFIX: We know AzDO url style so hack it for now instead of discovering via API
  const remoteURL =
    `dev.azure.com/${azureOrgName}/${azureProjectName}/_git/${repoName}`;

  const remote = `https://${constants.USER}:${accessToken}@${remoteURL}`;

  // Push to remote
  await git.addRemote('origin', remote);
  await git.push('origin', 'master');

  logger.info(`Finished pushing ${repoName} repo!`);
};

const scaffoldManifestRepo = async () => {
  // Set up Manifest Repo
  try {
    const currentRepo = constants.MANIFEST_REPO;
    const azureOrgUrl = constants.AZDO_ORG_URL;
    const azureOrgName = constants.AZDO_ORG;
    const azureProjectName = constants.AZDO_PROJECT;
    const accessToken = constants.ACCESS_TOKEN;

    moveToAbsPath(WORKSPACE_DIR);
    createDirectory(currentRepo);
    moveToRelativePath(currentRepo);

    const gitRepo = await azOps.findRepoInAzureOrg(azureOrgUrl, accessToken, currentRepo);

    if (gitRepo.id) {
      await azOps.deleteRepoInAzureOrg(azureOrgUrl, accessToken, gitRepo, azureProjectName);
    }
    const resultRepo = await createRepoInAzureOrg(azureOrgUrl, accessToken, currentRepo, azureProjectName);
    logger.info("Result repo: " + resultRepo.remoteUrl);
    manifestUrl = resultRepo.remoteUrl!.replace(`${constants.AZDO_ORG}@`, "");

    logCurrentDirectory();
    const git = simplegit();
    if (!await git.checkIsRepo()) {
      await git.init();
      logger.info(`Git init called in ${process.cwd()}`);
    }

    // Create and add files
    fs.createFileSync("README.md");
    await git.add("./README.md");

    await commitAndPushToRemote(git, azureOrgName, azureProjectName, accessToken, currentRepo);
  } catch (err) {
    // TODO err displays access token
    logger.error(`An error occured: ${err}`);
  }
};

const scaffoldHLDRepo = async () => {
  // Set up HLD Repo
  try {
    const currentRepo = constants.HLD_REPO;
    const azureOrgUrl = constants.AZDO_ORG_URL;
    const azureOrgName = constants.AZDO_ORG;
    const azureProjectName = constants.AZDO_PROJECT;
    const accessToken = constants.ACCESS_TOKEN;

    moveToAbsPath(WORKSPACE_DIR);
    createDirectory(currentRepo);
    moveToRelativePath(currentRepo);

    const gitRepo = await azOps.findRepoInAzureOrg(azureOrgUrl, accessToken, currentRepo);

    if (gitRepo.id) {
      await azOps.deleteRepoInAzureOrg(azureOrgUrl, accessToken, gitRepo, azureProjectName);
    }

    const resultRepo = await createRepoInAzureOrg(azureOrgUrl, accessToken, currentRepo, azureProjectName);
    logger.info("Result repo: " + resultRepo.remoteUrl);
    hldUrl = resultRepo.remoteUrl!.replace(`${constants.AZDO_ORG}@`, "");

    logCurrentDirectory();
    const git = simplegit();
    if (!await git.checkIsRepo()) {
      await git.init();
      logger.info(`Git init called in ${process.cwd()}`);
    }

    // Create and add files
    await hldInitialize(".", false);
    await git.add("./*");
    logGitInformation(await git.status());

    await commitAndPushToRemote(git, azureOrgName, azureProjectName, accessToken, currentRepo);
  } catch (err) {
    // TODO err displays access token
    logger.error(`An error occured: ${err}`);
  }
};

const createHLDtoManifestPipeline = async () => {
  const pipelineName = `${constants.HLD_REPO}-to-${constants.MANIFEST_REPO}`;

  try {
    const pipeline = await azOps.getPipeline(
      constants.AZDO_ORG_URL,
      constants.ACCESS_TOKEN,
      constants.AZDO_PROJECT,
      pipelineName
    );
    if (pipeline) {
      console.log(`${pipelineName} is found, deleting it`);
      await azOps.deletePipeline(
        constants.AZDO_ORG_URL,
        constants.ACCESS_TOKEN,
        constants.AZDO_PROJECT,
        pipelineName,
        pipeline.id!);
    }
    const vals: IHldToManifestPipelineValues = {
      buildScriptUrl: BUILD_SCRIPT_URL,
      devopsProject: constants.AZDO_PROJECT,
      hldName: getRepositoryName(hldUrl),
      hldUrl,
      manifestUrl,
      orgName: constants.AZDO_ORG,
      personalAccessToken: constants.ACCESS_TOKEN,
      pipelineName,
    };
    await installHldToManifestPipeline(vals);
  } catch (err) {
    logger.error(`An error occured in create HLD to Manifest Pipeline`);
    throw err;
  }
};

(async () => {
  // Silent the SPK logger for CLI and File outputs
  // logger.transports.forEach((t) => (t.silent = true));

  // Silence dedault logger
  // console.log = function() {}

  init();
  const answer = await askOrganization();
  console.log("Org Name:\t" + answer.azdo_org_name);
  console.log("Project Name:\t" + answer.azdo_project_name);
  console.log("https://dev.azure.com/" + answer.azdo_org_name + "/" + answer.azdo_project_name);
  // TODO: link the inputs

  logger.info(`The WORKSPACE_DIR is ${WORKSPACE_DIR}`);
  if (fs.existsSync(WORKSPACE_DIR)) {
    removeDir(WORKSPACE_DIR);
  }
  createDirectory(WORKSPACE_DIR);
  await installPromiseSpinner("manifest repo", scaffoldManifestRepo());
  await installPromiseSpinner("hld repo", scaffoldHLDRepo());
  await installPromiseSpinner("hld -> repo pipeline", createHLDtoManifestPipeline());

  // createDirectory(constants.APP_REPO)

  // logCurrentDirectory()

  // const answer = await askIfJsorTs()

  // answer.then(answers => {
  //     console.log("Org Name:\t"+answers.azdo_org_name);
  //     console.log("Project Name:\t"+answers.azdo_project_name);
  //     console.log("https://dev.azure.com/"+answers.azdo_org_name+"/"+answers.azdo_project_name)
  // });

  // console.log(chalk.yellow("You chose wisely 🧙‍♂️"))

  // await installSpinner('Manifest repository')
  // await installSpinner('HLD repository')
  // await installSpinner('Application repository')
})();





