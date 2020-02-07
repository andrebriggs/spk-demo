import chalk from "chalk";
import child_process from "child_process";
import clear from "clear";
import cli from "clui";
import fs from "fs-extra";
import inquirer from "inquirer";
import open from "open";
import os from "os";
import path from "path";
import simplegit, { SimpleGit, StatusResult  } from "simple-git/promise";
import { initialize as hldInitialize} from "../../spk/src/commands/hld/init";
import { create as createVariableGroup} from "../../spk/src/commands/project/create-variable-group";
import { initialize as projectInitialize} from "../../spk/src/commands/project/init";
import { createService, ICommandValues } from "../../spk/src/commands/service/create";
import { IAzureDevOpsOpts } from "../../spk/src/lib/git";
import { removeDir } from "../../spk/src/lib/ioUtil";
import { exec } from "../../spk/src/lib/shell";
import { logger } from "../../spk/src/logger";
import * as azOps from "./az_utils";
import * as constants from "./constant_values";
import { createHLDtoManifestPipeline,createLifecyclePipeline } from "./HLDToManifestPipeline";
import { ask as askQuestions, userInfo } from "./prompts";
import {
  getDevOpsPath,
  getOrganizationName,
  getPersonalAccessToken,
  getProject
} from "./SPKConfigBuilder";

const spawn = child_process.spawn;
const Spinner = cli.Spinner;
let hldUrl: string = "";
let manifestUrl: string = "";

const init = async () => {
  clear();
  console.log(
    chalk.bold.whiteBright("Welcome SPK Quick Start!")
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

// const installSpinner = async (installSubject: string) => {
//   const spinner = new Spinner(`Installing ${installSubject}`);
//   return installHelper(
//     // 'yarn add -D prettier',
//     "sleep 5",
//     () => console.log(chalk.green(`Done installing ${installSubject}`)),
//     spinner
//   );
// };

const installPromiseSpinner = async (
  installSubject: string,
  delegate: Promise<void>
) => {
  const spinner = new Spinner(`Installing ${installSubject}`);
  return installPromiseHelper(
    delegate,
    () => console.log(chalk.green(`Done installing ${installSubject} 👍`)),
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

const askToInstallAppRepo= (firstName: string) => {
  const questions = [{
    choices: ['.Yes', '.No'],
    filter: (val: string) => {
      return val === '.Yes';
    },
    message: `${firstName}, would you like use a sample application repository?`,
    name: 'is_app_repo',
    type: 'list'
  }];
  return inquirer.prompt(questions);
};

const askToSeePipelines= (firstName: string) => {
  const questions = [{
    choices: ['.Yes', '.No'],
    filter: (val: string) => {
      return val === ".Yes";
    },
    message: `${firstName}, would you like see your GitOps pipelines?`,
    name: 'go_to_pipelines',
    type: 'list'
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

const logCurrentDirectory = () => {
  logger.info(`Current directory: ${process.cwd()}`);
};

const createDirectory = (dirName: string, removeIfExist = false) => {
  if (removeIfExist && fs.existsSync(dirName)) {
    removeDir(dirName);
  }
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
    const azureOrgName = getOrganizationName();
    const azureProjectName = getProject();
    const accessToken = getPersonalAccessToken();

    moveToAbsPath(WORKSPACE_DIR);
    createDirectory(currentRepo);
    moveToRelativePath(currentRepo);

    const gitRepo = await azOps.findRepoInAzureOrg(currentRepo);
    if (gitRepo && gitRepo.id) {
        await azOps.deleteRepoInAzureOrg(gitRepo, azureProjectName);
    }

    const resultRepo = await azOps.createRepoInAzureOrg(currentRepo, azureProjectName);
    logger.info("Result repo: " + resultRepo.remoteUrl);
    manifestUrl = resultRepo.remoteUrl!.replace(`${getOrganizationName()}@`, "");

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
    const azureOrgName = getOrganizationName();
    const azureProjectName = getProject();
    const accessToken = getPersonalAccessToken();

    moveToAbsPath(WORKSPACE_DIR);
    createDirectory(currentRepo);
    moveToRelativePath(currentRepo);

    const gitRepo = await azOps.findRepoInAzureOrg(currentRepo);
    if (gitRepo && gitRepo.id) {
        await azOps.deleteRepoInAzureOrg(gitRepo, azureProjectName);
    }

    const resultRepo = await azOps.createRepoInAzureOrg(currentRepo, azureProjectName);
    logger.info("Result repo: " + resultRepo.remoteUrl);
    hldUrl = resultRepo.remoteUrl!.replace(`${getOrganizationName()}@`, "");
    // console.log("HLD URL: "+hldUrl)
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

const scaffoldAppRepo = async () => {
  try {
    const currentRepo = constants.APP_REPO;
    const azureOrgName = getOrganizationName();
    const azureProjectName = getProject();
    const accessToken = getPersonalAccessToken();

    moveToAbsPath(WORKSPACE_DIR);
    createDirectory(currentRepo);
    moveToRelativePath(currentRepo);

    const gitRepo = await azOps.findRepoInAzureOrg(currentRepo);
    if (gitRepo && gitRepo.id) {
      await azOps.deleteRepoInAzureOrg(gitRepo, azureProjectName);
    }

    const resultRepo = await azOps.createRepoInAzureOrg(currentRepo, azureProjectName);
    logger.info("Result repo: " + resultRepo.remoteUrl);

    logCurrentDirectory();
    const git = simplegit();
    if (!await git.checkIsRepo()) {
      await git.init();
      logger.info(`Git init called in ${process.cwd()}`);
    }

    // Create and add files
    await projectInitialize(".");
    await git.add("./*");
    logGitInformation(await git.status());
    await commitAndPushToRemote(git, azureOrgName, azureProjectName, accessToken, currentRepo);

    const accessOpts: IAzureDevOpsOpts = {
      orgName: azureOrgName,
      personalAccessToken: accessToken,
      project: azureProjectName
    };

    const variableGroupName = "quick-start-vg";
    const resultVariableGroup = await createVariableGroup(variableGroupName, undefined, hldUrl, undefined, undefined, undefined, accessOpts);

    // TODO make sure result is not undefined

    const commandOpts: ICommandValues = {
      displayName: currentRepo,
      gitPush: false,
      helmChartChart: "",
      helmChartRepository: "",
      helmConfigBranch: "",
      helmConfigGit: "",
      helmConfigPath: "",
      k8sBackend: "",
      k8sBackendPort: "",
      k8sPort: 0,
      maintainerEmail: "",
      maintainerName: "",
      middlewares: "",
      middlewaresArray: [],
      packagesDir: "",
      pathPrefix: "",
      pathPrefixMajorVersion: "",
      ringNames: [],
      variableGroups: []
    };

    await createService(".", currentRepo, commandOpts);

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

(async () => {
  // Silent the SPK logger for CLI and File outputs
  logger.transports.forEach((t) => (t.silent = true));

  // Silence dedault logger
  // console.log = function() {}

  init();
  // comment out the liner below if you already have spk config.yaml setup
  await askQuestions();
  const user = await userInfo();

  logger.info(`The WORKSPACE_DIR is ${WORKSPACE_DIR}`);
  createDirectory(WORKSPACE_DIR, true);

  await installPromiseSpinner("manifest repo", scaffoldManifestRepo());
  await installPromiseSpinner("hld repo", scaffoldHLDRepo());
  await installPromiseSpinner("hld -> repo pipeline", createHLDtoManifestPipeline(manifestUrl, hldUrl));

  const pipelineUrl= `${getDevOpsPath()}/_build`;
  const installAppRepo = await askToInstallAppRepo(user.firstName);

  if (installAppRepo.is_app_repo){
    // TODO: Install here
    await installPromiseSpinner("app repo", scaffoldAppRepo());
    await installPromiseSpinner("app lifecycle pipeline", createLifecyclePipeline());
  }

  const goToPipelines = await askToSeePipelines(user.firstName);
  if (goToPipelines.go_to_pipelines) {
    open(pipelineUrl);
  }
  console.log(chalk.bold.whiteBright(`\nGitOps pipelines at ${pipelineUrl}`));

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





