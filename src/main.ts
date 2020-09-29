import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from "fs";
import * as path from "path";

interface IRunnerContext {
  os: string;
  tool_cache: string;
  temp: string;
  workspace: string;
}

interface IGithubContext {
  workspace: string;
}

// These are added run actions using "env:"
let runner: IRunnerContext = JSON.parse(process.env.RUNNER || "");
let secrets: any = JSON.parse(process.env.SECRETS || "");
let github: IGithubContext = JSON.parse(process.env.GITHUB || "");

const condaEnv = "nb-runner";
const envrionmentFileName = "environment.yml";
const outputDir = path.join(runner.temp, "nb-runner");
const scriptsDir = path.join(runner.temp, "nb-runner-scripts");
const executeScriptPath = path.join(scriptsDir, "nb-runner.py");
const secretsPath = path.join(runner.temp, "secrets.json");
const papermillOutput = path.join(github.workspace, "papermill-nb-runner.out");
const condaEnvironmentFile = path.join(github.workspace, envrionmentFileName);

async function run() {
  try {
    const notebookFile = core.getInput('notebook');
    const paramsFile = core.getInput('params');
    const isReport = core.getInput('isReport');
    const poll = core.getInput('poll');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    if (!fs.existsSync(scriptsDir)) {
      fs.mkdirSync(scriptsDir);
    }

    fs.writeFileSync(secretsPath, JSON.stringify(secrets));

    const parsedNotebookFile = path.join(outputDir, path.basename(notebookFile));
    if (fs.existsSync(condaEnvironmentFile)){
      await exec.exec(`conda env create -n ${condaEnv} --file ${condaEnvironmentFile}`)
    }
    // Install dependencies
    await exec.exec('python3 -m pip install papermill ipykernel nbformat');
    await exec.exec('python3 -m ipykernel install --user');

    // Execute notebook
    const pythonCode = `
import papermill as pm
import os
import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from time import sleep

conda env list
conda env export --from-history

params = {}
paramsPath = '${paramsFile}'
extraParams = dict({ "secretsPath": '${secretsPath}' })
if paramsPath:
  with open(paramsPath, 'r') as paramsFile:
    params = json.loads(paramsFile.read())

isDone = False
def watch():
    global isDone
    while not isDone:
      sleep(15)
      os.system('echo "***Polling latest output status result***"')
      os.system('tail -n 15 ${papermillOutput}')
      os.system('echo "***End of polling latest output status result***"')

def run():
  global isDone
  try:
    pm.execute_notebook(
      input_path='${notebookFile}',
      output_path='${parsedNotebookFile}',
      parameters=dict(extraParams, **params),
      log_output=True,
      report_mode=${!!isReport ? "True" : "False"}
    )
  finally:
    isDone = True

results = []
with ThreadPoolExecutor() as executor:
  results.append(executor.submit(run))
  if ${!!poll ? "True" : "False"}:
    results.append(executor.submit(watch))

for task in as_completed(results):
  try:
    task.result()
  except Exception as e:
    print(e, file=sys.stderr)
    sys.exit(1)
`;

    fs.writeFileSync(executeScriptPath, pythonCode);

    await exec.exec(`cat ${executeScriptPath}`)
    //await exec.exec(`python3 ${executeScriptPath}`);
    await exec.exec(`conda run -n ${condaEnv} python3 ${executeScriptPath}`)

    // Convert to HTML
    //await exec.exec(`jupyter nbconvert "${parsedNotebookFile}" --to html`);

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
