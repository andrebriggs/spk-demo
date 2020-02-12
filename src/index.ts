import chalk from "chalk";
import child_process from "child_process";
import clear from "clear";
import cli from "clui";
import inquirer from "inquirer";
import open from "open";
import os from "os";
import path from "path";
import {scaffoldManifestRepo,scaffoldHelmRepo,scaffoldHLDRepo,scaffoldAppRepo} from "./scaffolding";
import {createDirectory} from "./fs-utils";
import {getAzureRepoUrl} from "./az-utils";
import { exec } from "../../spk/src/lib/shell";
import { logger } from "../../spk/src/logger";
import * as constants from "./constant-values";
import { createBuildPipeline,createHLDtoManifestPipeline,createLifecyclePipeline } from "./pipeline-management";
import { askContainerRegistry, askToInstallAppRepo, ask as askQuestions, userInfo } from "./prompts";
import { getDevOpsPath } from "./SPKConfigBuilder";

const spawn = child_process.spawn;
const Spinner = cli.Spinner;
const hldUrl = getAzureRepoUrl(constants.HLD_REPO)
const manifestUrl = getAzureRepoUrl(constants.MANIFEST_REPO)

const init = async () => {
  clear();
  console.log(
    chalk.bold.whiteBright("Welcome SPK Quick Start!")
  );
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
const homedir = os.homedir();
const WORKSPACE_DIR = path.resolve(path.join(homedir, constants.WORKSPACE));

(async () => {
  // Silent the SPK logger for CLI and File outputs
  logger.transports.forEach((t) => (t.silent = true));

  // Silence dedault logger
  // console.log = function() {}

  init();
  // comment out the liner below if you already have spk config.yaml setup
  await askQuestions(); //TODO is config file exists with necessary fields, skip this
  const user = await userInfo();

  logger.info(`The WORKSPACE_DIR is ${WORKSPACE_DIR}`);
  createDirectory(WORKSPACE_DIR, true);

  await installPromiseSpinner("manifest repo", scaffoldManifestRepo(WORKSPACE_DIR));
  await installPromiseSpinner("hld repo", scaffoldHLDRepo(WORKSPACE_DIR));
  await installPromiseSpinner("hld -> manifest pipeline", createHLDtoManifestPipeline(manifestUrl, hldUrl));

  const pipelineUrl= `${getDevOpsPath()}/_build`;
  const installAppRepo = await askToInstallAppRepo(user.firstName);

  if (installAppRepo.is_app_repo){
    const answer = await askContainerRegistry()
    const acrName = answer.az_acr_name as string;

    await installPromiseSpinner("helm repo", scaffoldHelmRepo(WORKSPACE_DIR,acrName));
    await installPromiseSpinner("app repo", scaffoldAppRepo(WORKSPACE_DIR,acrName,hldUrl));
    await installPromiseSpinner("app lifecycle pipeline", createLifecyclePipeline());
    await installPromiseSpinner("app build pipeline", createBuildPipeline());
  }

  const goToPipelines = await askToSeePipelines(user.firstName);
  if (goToPipelines.go_to_pipelines) {
    open(pipelineUrl);
  }
  console.log(chalk.bold.whiteBright(`\nGitOps pipelines at ${pipelineUrl}`));
})();





