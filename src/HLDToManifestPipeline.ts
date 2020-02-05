import { Build } from "azure-devops-node-api/interfaces/BuildInterfaces";
import {
  ICommandOptions as IHldToManifestPipelineValues,
  installHldToManifestPipeline
} from "../../spk/src/commands/hld/pipeline";
import { BUILD_SCRIPT_URL } from "../../spk/src/lib/constants";
import { getRepositoryName } from "../../spk/src/lib/gitutils";
import { logger } from "../../spk/src/logger";
import * as azOps from "./az_utils";
import * as constants from "./constant_values";

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
  if (status === 0) {
    return "None";
  }
  if (status === 1) {
    return "In Progress";
  }
  if (status === 2) {
    return "Completed";
  }
  if (status === 4) {
    return "Cancelling";
  }
  if (status === 8) {
    return "Postponed";
  }
  if (status === 32) {
    return "Not Started";
  }

  return "Unknown";
};

const getBuildResultString = (status: number | undefined) => {
  if (status === undefined) {
    return "Unknown";
  }
  if (status === 0) {
    return "None";
  }
  if (status === 2) {
    return "Succeeded";
  }
  if (status === 4) {
    return "Partially Succeeded";
  }
  if (status === 8) {
    return "Failed";
  }
  if (status === 32) {
    return "canceled";
  }

  return "Unknown";
};

const pollForPipelineStatus = async (pipelineName: string) => {
  const oPipeline = await azOps.getPipelineByName(
    constants.AZDO_ORG_URL,
    constants.ACCESS_TOKEN,
    constants.AZDO_PROJECT,
    pipelineName
  );
  if (!oPipeline) {
    throw new Error(`${pipelineName} is not found`);
  }

  let build: Build;
  do {
    await sleep(15);

    build = await azOps.getPipelineBuild(
      constants.AZDO_ORG_URL,
      constants.ACCESS_TOKEN,
      constants.AZDO_PROJECT,
      pipelineName);
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
    const pipeline = await azOps.getPipelineByName(
      constants.AZDO_ORG_URL,
      constants.ACCESS_TOKEN,
      constants.AZDO_PROJECT,
      pipelineName
    );
    if (pipeline) {
      logger.info(`${pipelineName} is found, deleting it`);
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
    await pollForPipelineStatus(pipelineName);
  } catch (err) {
    logger.error(`An error occured in create HLD to Manifest Pipeline`);
    throw err;
  }
};
