
import fs from "fs-extra";
import path from "path";
import simplegit from "simple-git/promise";
import { initialize as hldInitialize} from "../../spk/src/commands/hld/init";
import { create as createVariableGroup,setVariableGroupInBedrockFile, updateLifeCyclePipeline} from "../../spk/src/commands/project/create-variable-group";
import { initialize as projectInitialize} from "../../spk/src/commands/project/init";
import { createService, ICommandValues } from "../../spk/src/commands/service/create";
import { IAzureDevOpsOpts } from "../../spk/src/lib/git";
import { logger } from "../../spk/src/logger";
import * as azOps from "./az-utils";
import * as constants from "./constant-values";
import {commitAndPushToRemote,createDirectory,logCurrentDirectory,logGitInformation,moveToAbsPath, moveToRelativePath} from "./fs-utils";
import * as helmTemplates from "./helm-templates";
import {
    getDevOpsPath,
    getOrganizationName,
    getPersonalAccessToken,
    getProject,
    getServiceProviderId,
    getServiceProviderSecret,
    getTenantId
  } from "./SPKConfigBuilder";

export const scaffoldManifestRepo = async (workspaceDir: string) => {
    // Set up Manifest Repo
    try {
      const currentRepo = constants.MANIFEST_REPO;
      const azureOrgName = getOrganizationName();
      const azureProjectName = getProject();
      const accessToken = getPersonalAccessToken();

      moveToAbsPath(workspaceDir);
      createDirectory(currentRepo);
      moveToRelativePath(currentRepo);

      const gitRepo = await azOps.findRepoInAzureOrg(currentRepo);
      if (gitRepo && gitRepo.id) {
          await azOps.deleteRepoInAzureOrg(gitRepo, azureProjectName);
      }

      const resultRepo = await azOps.createRepoInAzureOrg(currentRepo, azureProjectName);
      logger.info("Result repo: " + resultRepo.remoteUrl);
      const manifestUrl = resultRepo.remoteUrl!.replace(`${getOrganizationName()}@`, "");

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

  export const scaffoldHLDRepo = async (workspaceDir: string) =>  {
    // Set up HLD Repo
    try {
      const currentRepo = constants.HLD_REPO;
      const azureOrgName = getOrganizationName();
      const azureProjectName = getProject();
      const accessToken = getPersonalAccessToken();

      moveToAbsPath(workspaceDir);
      createDirectory(currentRepo);
      moveToRelativePath(currentRepo);

      const gitRepo = await azOps.findRepoInAzureOrg(currentRepo);
      if (gitRepo && gitRepo.id) {
          await azOps.deleteRepoInAzureOrg(gitRepo, azureProjectName);
      }

      const resultRepo = await azOps.createRepoInAzureOrg(currentRepo, azureProjectName);
      logger.info("Result repo: " + resultRepo.remoteUrl);
      const hldUrl = resultRepo.remoteUrl!.replace(`${getOrganizationName()}@`, "");
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

  export const scaffoldHelmRepo = async (workspaceDir: string,acrName: string) => {
    const currentRepo = constants.HELM_REPO;
    const azureOrgName = getOrganizationName();
    const azureProjectName = getProject();
    const accessToken = getPersonalAccessToken();

    moveToAbsPath(workspaceDir);
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

    // Create chart directory and add helm chart files
    createDirectory(constants.APP_REPO);
    moveToRelativePath(constants.APP_REPO);
    createDirectory("chart");
    moveToRelativePath("chart");

    let values = helmTemplates.chartTemplate.replace('@@CHART_APP_NAME@@', constants.APP_REPO);
    let targetFile = path.join(process.cwd(), "Chart.yaml");
    fs.writeFileSync(targetFile, values);

    values = helmTemplates.valuesTemplate.replace('@@CHART_APP_NAME@@', constants.APP_REPO).replace('@@ACR_NAME@@',acrName);
    targetFile = path.join(process.cwd(), "values.yaml");
    fs.writeFileSync(targetFile, values);

    createDirectory("templates");
    moveToRelativePath("templates");

    targetFile = path.join(process.cwd(), "all-in-one.yaml");
    fs.writeFileSync(targetFile, helmTemplates.mainTemplate);

    moveToAbsPath(workspaceDir);
    moveToRelativePath(currentRepo);

    await git.add("./*");
    logGitInformation(await git.status());
    await commitAndPushToRemote(git, azureOrgName, azureProjectName, accessToken, currentRepo);

  };

  export const scaffoldAppRepo = async (workspaceDir: string,acrName: string, hldUrl: string) => {
    try {
      const currentRepo = constants.APP_REPO;
      const azureOrgName = getOrganizationName();
      const azureProjectName = getProject();
      const accessToken = getPersonalAccessToken();

      moveToAbsPath(workspaceDir);
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
      await azOps.deleteVariableGroup(variableGroupName);
      await createVariableGroup(variableGroupName, acrName, hldUrl, getServiceProviderId(), getServiceProviderSecret(), getTenantId(), accessOpts);

      await setVariableGroupInBedrockFile(".",variableGroupName);
      await updateLifeCyclePipeline(".");

      // TODO make sure result is not undefined
      const helmRepoUrl = azOps.getAzureRepoUrl(constants.HELM_REPO);

      const commandOpts: ICommandValues = {
        displayName: currentRepo,
        gitPush: false,
        helmChartChart: "",
        helmChartRepository: "",
        helmConfigBranch: "master",
        helmConfigGit: helmRepoUrl,
        helmConfigPath: `${currentRepo}/chart`,
        k8sBackend: "",
        k8sBackendPort: "80",
        k8sPort: 0,
        maintainerEmail: "",
        maintainerName: "",
        middlewares: "",
        middlewaresArray: [],
        packagesDir: "",
        pathPrefix: "",
        pathPrefixMajorVersion: "",
        ringNames: ["master"],
        variableGroups: [variableGroupName]
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