import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parse } from 'yaml';
import { hasWritePermission } from './workflow-policy.mjs';

const WORKFLOW_DIRECTORY = path.join(process.cwd(), '.github', 'workflows');
const EXPECTED_NODE_VERSION = (await readFile(path.join(process.cwd(), '.node-version'), 'utf8')).trim();
const NVM_NODE_VERSION = (await readFile(path.join(process.cwd(), '.nvmrc'), 'utf8')).trim();
const packageJson = JSON.parse(await readFile(path.join(process.cwd(), 'package.json'), 'utf8'));
const EXPECTED_NPM_VERSION = packageJson.packageManager?.match(/^npm@(\d+\.\d+\.\d+)$/)?.[1];

function collectActionReferences(value, references = []) {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectActionReferences(entry, references));
    return references;
  }

  if (!value || typeof value !== 'object') {
    return references;
  }

  if (typeof value.uses === 'string') {
    references.push(value.uses);
  }

  Object.values(value).forEach((entry) => collectActionReferences(entry, references));
  return references;
}

function validateWorkflow(fileName, workflow) {
  const errors = [];
  const triggers = workflow?.on;
  const workflowNodeVersion = workflow?.env?.NODE_VERSION;
  const workflowNpmVersion = workflow?.env?.NPM_VERSION;

  if (workflowNodeVersion !== EXPECTED_NODE_VERSION) {
    errors.push(
      `${fileName}: env.NODE_VERSION must exactly match .node-version (${EXPECTED_NODE_VERSION}).`,
    );
  }

  if (!EXPECTED_NPM_VERSION || workflowNpmVersion !== EXPECTED_NPM_VERSION) {
    errors.push(
      `${fileName}: env.NPM_VERSION must exactly match packageManager (${EXPECTED_NPM_VERSION || 'invalid'}).`,
    );
  }

  if (triggers && typeof triggers === 'object' && 'pull_request_target' in triggers) {
    errors.push(
      `${fileName}: pull_request_target is forbidden because it can expose write tokens to untrusted pull-request code.`,
    );
  }

  for (const reference of collectActionReferences(workflow)) {
    const actionName = reference.split('@')[0];

    if (actionName === 'github/codeql-action' || actionName.startsWith('github/codeql-action/')) {
      errors.push(
        `${fileName}: ${reference} is unsupported while this user-owned repository is private and GitHub Code Security is unavailable.`,
      );
      continue;
    }

    if (!reference.startsWith('./') && !/@[0-9a-f]{40}$/i.test(reference)) {
      errors.push(`${fileName}: ${reference} must be pinned to a full commit SHA.`);
    }
  }

  for (const [jobName, job] of Object.entries(workflow?.jobs || {})) {
    const permissions = job?.permissions || workflow?.permissions || {};
    if (permissions === 'write-all') {
      errors.push(`${fileName}:${jobName}: permissions: write-all is forbidden.`);
    }
    const jobHasWritePermission = hasWritePermission(permissions);
    const steps = Array.isArray(job?.steps) ? job.steps : [];

    for (const [stepIndex, step] of steps.entries()) {
      if (step?.uses?.startsWith('actions/checkout@')
        && step?.with?.['persist-credentials'] !== false) {
        errors.push(`${fileName}:${jobName}: checkout must set persist-credentials: false.`);
      }

      if (step?.uses?.startsWith('actions/setup-node@')
        && step?.with?.['node-version'] !== '${{ env.NODE_VERSION }}') {
        errors.push(
          `${fileName}:${jobName}: setup-node must use the repository's exact env.NODE_VERSION.`,
        );
      }

      if (typeof step?.run === 'string' && /\bnpm ci\b/.test(step.run)) {
        const pinnedNpmStep = steps
          .slice(0, stepIndex)
          .some((candidate) => typeof candidate?.run === 'string'
            && candidate.run.includes('npm install --global npm@$NPM_VERSION'));
        if (!pinnedNpmStep) {
          errors.push(
            `${fileName}:${jobName}: npm ci must be preceded by installation of env.NPM_VERSION.`,
          );
        }
      }
    }

    if (jobHasWritePermission) {
      const unsafeStep = steps.find((step) => typeof step?.run === 'string'
        || step?.uses?.startsWith('actions/setup-node@'));
      if (unsafeStep) {
        errors.push(
          `${fileName}:${jobName}: jobs with write permissions must not run shell commands or install the Node.js toolchain.`,
        );
      }
    }
  }

  return errors;
}

const workflowFiles = (await readdir(WORKFLOW_DIRECTORY))
  .filter((fileName) => /\.ya?ml$/i.test(fileName))
  .sort();

const errors = [];
if (NVM_NODE_VERSION !== EXPECTED_NODE_VERSION) {
  errors.push(
    `.nvmrc (${NVM_NODE_VERSION}) must match .node-version (${EXPECTED_NODE_VERSION}).`,
  );
}
for (const fileName of workflowFiles) {
  const source = await readFile(path.join(WORKFLOW_DIRECTORY, fileName), 'utf8');
  let workflow;

  try {
    workflow = parse(source);
  } catch (error) {
    errors.push(`${fileName}: invalid YAML: ${error instanceof Error ? error.message : String(error)}`);
    continue;
  }

  errors.push(...validateWorkflow(fileName, workflow));
}

if (errors.length > 0) {
  console.error('GitHub workflow verification failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`GitHub workflow verification passed: ${workflowFiles.length} workflow files checked.`);
}
