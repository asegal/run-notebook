"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const glob = __importStar(require("glob"));
function run() {
    return __awaiter(this, void 0, void 0, function* () {
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
            yield exec.exec('pip install --upgrade setuptools');
            if (fs.existsSync(requirementsFile)) {
                yield exec.exec(`python3 -m pip install -r ${requirementsFile}`);
            }
            //await exec.exec('python3 -m pip install papermill ipykernel nbformat');
            yield exec.exec('python3 -m pip install nbconvert[webpdf] ipykernel');
            yield exec.exec('python3 -m ipykernel install --user');
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
            yield exec.exec(`jupyter nbconvert --execute --to webpdf --allow-chromium-download --output "${emptyNotebookFile}" "${emptyNotebookFile}"`);
            const noInput = isReport ? '--no-input' : '';
            // Execute notebooks
            yield Promise.all(notebookFiles.map((notebookFile) => __awaiter(this, void 0, void 0, function* () {
                const parsedNotebookFile = path.join(outputDir, path.basename(notebookFile, '.ipynb'));
                exec.exec(`jupyter nbconvert --execute ${noInput}--to webpdf --output "${parsedNotebookFile}" "${notebookFile}"`);
            }))).catch((error) => {
                core.setFailed(error.message);
            });
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
