import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from "fs";
import * as path from "path";
import * as glob from "glob";

async function run() {
  try {
    const workspace = core.getInput('workspace');
    const isReport = core.getInput('isReport');

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
    await exec.exec('python3 -m pip install nbconvert[webpdf] ipykernel');
    await exec.exec('python3 -m ipykernel install --user');

    //Write out an empty notebook and convert it, in order to trigger installation of pypetteer
    //Otherwise, there is a race condition which causes multiple installs leading to fatal error
    //when nbconvert is run via Promise.all.
    const emptyNotebook = `
      {
         "cells": [
          {
           "cell_type": "code",
           "execution_count": null,
           "metadata": {},
           "outputs": [],
           "source": []
          }
         ],
         "metadata": {
          "kernelspec": {
           "display_name": "Python 3",
           "language": "python",
           "name": "python3"
          },
          "language_info": {
           "codemirror_mode": {
            "name": "ipython",
            "version": 3
           },
           "file_extension": ".py",
           "mimetype": "text/x-python",
           "name": "python",
           "nbconvert_exporter": "python",
           "pygments_lexer": "ipython3",
           "version": "3.7.9"
          }
         },
         "nbformat": 4,
         "nbformat_minor": 4
      }
    `;
    const emptyNotebookFile = path.join(scriptsDir, 'empty.ipynb');
    fs.writeFileSync(emptyNotebookFile, emptyNotebook);
    await exec.exec(`jupyter nbconvert --execute --to webpdf --allow-chromium-download --output "${emptyNotebookFile}" "${emptyNotebookFile}"`);

    const noInput = isReport ? '--no-input' : '';
    // Execute notebooks
    await Promise.all(notebookFiles.map(async (notebookFile: string) => {
      const parsedNotebookFile = path.join(outputDir, path.basename(notebookFile, '.ipynb'));
      exec.exec(`jupyter nbconvert --execute ${noInput}--to webpdf --output "${parsedNotebookFile}" "${notebookFile}"`);
    })).catch((error) => {
      core.setFailed(error.message);
    });

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
