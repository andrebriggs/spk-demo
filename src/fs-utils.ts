import chalk from "chalk";
import fs from "fs-extra";
import simplegit, { SimpleGit, StatusResult  } from "simple-git/promise";
import { removeDir } from "../../spk/src/lib/ioUtil";
import { logger } from "../../spk/src/logger";
import * as constants from "./constant-values";

export const logCurrentDirectory = () => {
    logger.info(`Current directory: ${process.cwd()}`);
  };

  export const createDirectory = (dirName: string, removeIfExist = false) => {
    if (removeIfExist && fs.existsSync(dirName)) {
      removeDir(dirName);
    }
    fs.mkdirpSync(dirName);
  };

  export const moveToRelativePath = (relativePath: string) => {
    process.chdir(relativePath);
  };

  export const moveToAbsPath = (absPath: string) => {
    process.chdir(absPath);
  };

  export const logGitInformation = (gitStatus: StatusResult) => {
    logger.info("Files in local Git:");
    gitStatus.files.forEach(f => logger.info("\t" + f.path));

    logger.info("Files added to Git:");
    gitStatus.created.forEach(f => logger.info("\t" + f));

    logger.info(chalk.yellow("Files not added to Git:"));
    gitStatus.not_added.forEach(f => logger.info("\t" + f));
  };

  export const commitAndPushToRemote = async (
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
    if((await git.getRemotes(false)).length === 0){
      await git.addRemote('origin', remote);
    }
    await git.push('origin', 'master');

    logger.info(`Finished pushing ${repoName} repo!`);
  };