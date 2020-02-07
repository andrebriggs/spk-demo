import {
  Build,
  BuildResult,
  BuildStatus
} from "azure-devops-node-api/interfaces/BuildInterfaces";
import {
  ICommandOptions as IHldToManifestPipelineValues,
  installHldToManifestPipeline
} from "../../spk/src/commands/hld/pipeline";
import {ICommandOptions, installLifecyclePipeline} from "../../spk/src/commands/Project/pipeline";
import { BUILD_SCRIPT_URL } from "../../spk/src/lib/constants";
import { getRepositoryName } from "../../spk/src/lib/gitutils";
import { logger } from "../../spk/src/logger";
import * as azOps from "./az_utils";
import * as constants from "./constant_values";
import {
  getOrganizationName,
  getPersonalAccessToken,
  getProject
} from "./SPKConfigBuilder";

const sleep = (timeInSecond: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, timeInSecond * 1000);
  });
};

const getBuildStatusString = (status: number | undefined) => {
  if (status === undefined) {
    return "Unknown";
  }
  if (status === BuildStatus.None) {
    return "None";
  }
  if (status === BuildStatus.InProgress) {
    return "In Progress";
  }
  if (status === BuildStatus.Completed) {
    return "Completed";
  }
  if (status === BuildStatus.Cancelling) {
    return "Cancelling";
  }
  if (status === BuildStatus.Postponed) {
    return "Postponed";
  }
  if (status === BuildStatus.NotStarted) {
    return "Not Started";
  }

  return "Unknown";
};

const getBuildResultString = (result: number | undefined) => {
  if (result === undefined) {
    return "Unknown";
  }
  if (result === BuildResult.None) {
    return "None";
  }
  if (result === BuildResult.Succeeded) {
    return "Succeeded";
  }
  if (result === BuildResult.PartiallySucceeded) {
    return "Partially Succeeded";
  }
  if (result === BuildResult.Failed) {
    return "Failed";
  }
  if (result === BuildResult.Canceled) {
    return "canceled";
  }

  return "Unknown";
};

const pollForPipelineStatus = async (pipelineName: string) => {
  const oPipeline = await azOps.getPipelineByName(pipelineName);
  if (!oPipeline) {
    throw new Error(`${pipelineName} is not found`);
  }

  let build: Build;
  do {
    await sleep(15);
    build = await azOps.getPipelineBuild(pipelineName);
    logger.info(`Status build of ${pipelineName}: ${getBuildStatusString(build?.status)}`);
  } while (!build || build.result === 0);

  logger.info(`Result build of ${pipelineName}: ${getBuildResultString(build.result)}`);
};


export const createHLDtoManifestPipeline = async (
  manifestUrl: string,
  hldUrl: string
) => {
  const pipelineName = `${constants.HLD_REPO}-to-${constants.MANIFEST_REPO}`;

  try {
    const pipeline = await azOps.getPipelineByName(pipelineName);
    if (pipeline) {
      logger.info(`${pipelineName} is found, deleting it`);
      await azOps.deletePipeline(pipelineName, pipeline.id!);
    }
    const vals: IHldToManifestPipelineValues = {
      buildScriptUrl: BUILD_SCRIPT_URL,
      devopsProject: getProject(),
      hldName: getRepositoryName(hldUrl),
      hldUrl,
      manifestUrl,
      orgName: getOrganizationName(),
      personalAccessToken: getPersonalAccessToken(),
      pipelineName,
    };
    await installHldToManifestPipeline(vals);
    await pollForPipelineStatus(pipelineName);
  } catch (err) {
    logger.error(`An error occured in create HLD to Manifest Pipeline`);
    throw err;
  }
};

export const createLifecyclePipeline = async () => {
  const pipelineName = constants.APP_REPO_LIFECYCLE;

  try {
    const pipeline = await azOps.getPipelineByName(pipelineName);
    if (pipeline) {
      logger.info(`${pipelineName} is found, deleting it`);
      await azOps.deletePipeline(pipelineName, pipeline.id!);
    }

    // HACK
    const appUrl = `https://dev.azure.com/${getOrganizationName()}/${getProject()}/_git/${constants.APP_REPO}`;

    const vals: ICommandOptions = {
      buildScriptUrl: BUILD_SCRIPT_URL,
      devopsProject: getProject(),
      orgName: getOrganizationName(),
      personalAccessToken: getPersonalAccessToken(),
      pipelineName,
      repoName: constants.APP_REPO,
      repoUrl: appUrl
    };
    await installLifecyclePipeline(vals);
    await pollForPipelineStatus(pipelineName);
  } catch (err) {
    logger.error(`An error occured in create HLD to Manifest Pipeline`);
    throw err;
  }
};
