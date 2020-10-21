import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from "fs";
import * as path from "path";
import * as glob from "glob";

async function run() {
  try {
    const workspace = core.getInput('workspace');

    const requirements = 'requirements.txt';
    const requirementsFile = path.join(workspace, requirements);

    const temp_dir = core.getInput('temp_dir');
    const outputDir = path.join(temp_dir, "nb-runner");
    const scriptsDir = path.join(temp_dir, "nb-runner-scripts");

    const notebookFilesPattern = core.getInput('notebooks');
    const notebookFiles = glob.sync(path.join(workspace, notebookFilesPattern));

    //const isReport = core.getInput('isReport');

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    if (!fs.existsSync(scriptsDir)) {
      fs.mkdirSync(scriptsDir);
    }

    // Install dependencies
    await exec.exec('pip install --upgrade setuptools');
    if (fs.existsSync(requirementsFile)){
      await exec.exec(`python3 -m pip install -r ${requirementsFile}`)
    }
    //await exec.exec('python3 -m pip install papermill ipykernel nbformat');
    await exec.exec('python3 -m pip install pyppeteer nbconvert[webpdf] ipykernel');
    await exec.exec('python3 -m ipykernel install --user');

    //const noInput = isReport ? '--no-input' : '';

    // Execute notebooks
    await Promise.all(notebookFiles.map(async (notebookFile: string) => {
      const parsedNotebookFile = path.join(outputDir, path.basename(notebookFile, '.ipynb'));
      await exec.exec(`jupyter nbconvert --execute --no-input --to webpdf --output "${parsedNotebookFile}" "${notebookFile}"`);
    })).catch((error) => {
      core.setFailed(error.message);
    });

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
