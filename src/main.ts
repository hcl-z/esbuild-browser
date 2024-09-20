import './style.css'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="container">
    <h1>在线esbuild打包工具</h1>
    <div class="main-content">
      <div class="left-panel">
        <section id="files">
          <h2>文件列表</h2>
          <button id="add-file" class="btn">添加文件</button>
          <div id="file-list"></div>
        </section>
        <section id="options">
          <h2>编译选项</h2>
          <div class="option-group">
            <label for="target">
              目标:
              <select id="target" class="select">
                <option selected>ESNext</option>
                <option>ES2021</option>
                <option>ES2019</option>
                <option>ES2018</option>
                <option>ES2017</option>
                <option>ES2016</option>
                <option>ES2015</option>
                <option>ES5</option>
                <option>Chrome70</option>
                <option>Chrome71</option>
                <option>Chrome72</option>
                <option>Chrome73</option>
                <option>Chrome74</option>
                <option>Chrome75</option>
                <option>Chrome76</option>
                <option>Chrome77</option>
                <option>Chrome78</option>
                <option>Chrome79</option>
                <option>Chrome80</option>
                <option>Chrome81</option>
                <option>Chrome82</option>
                <option>Chrome83</option>
                <option>Chrome84</option>
                <option>Chrome85</option>
                <option>Chrome86</option>
                <option>Chrome87</option>
                <option>Chrome88</option>
                <option>Chrome89</option>
              </select>
            </label>
            <label for="loader">
              加载器:
              <select id="loader" class="select">
                <option selected>JS</option>
                <option>JSX</option>
                <option>TS</option>
                <option>TSX</option>
                <option>CSS</option>
                <option>JSON</option>
                <option>Text</option>
                <option>Base64</option>
                <option>DataURL</option>
                <option>Binary</option>
              </select>
            </label>
            <label for="format">
              格式:
              <select id="format" class="select">
                <option selected>Preserve</option>
                <option>IIFE</option>
                <option>CJS</option>
                <option>ESM</option>
              </select>
            </label>
          </div>
          <div class="checkbox-group">
            <label><input id="bundle" type="checkbox" /> 打包</label>
            <label><input id="minify" type="checkbox" /> 压缩</label>
            <label><input id="sourcemap" type="checkbox" /> 生成 sourcemap</label>
          </div>
          <button id="compile" class="btn">编译</button>
        </section>
      </div>
      <div class="right-panel">
        <section id="editor">
          <h2>编辑器</h2>
          <div id="file-tabs"></div>
          <textarea id="code-editor" placeholder="在这里输入代码..."></textarea>
        </section>
        <section id="output">
          <h2>输出</h2>
          <div class="button-group">
            <button id="compile-button" class="btn">编译</button>
            <button id="execute-button" class="btn">执行编译后的代码</button>
          </div>
          <div class="output-container"></div>
        </section>
      </div>
    </div>
  </div>
`;


// 文件列表
const files: { [filename: string]: string } = {
  'main.js': `// 这是默认的入口文件\nconsole.log("Hello, World!");
import a from "lodash"
import c from 'https://esm.sh/jquery'
`
};

// 添加文件按钮
const addFileButton = document.querySelector<HTMLButtonElement>("#add-file")!;
addFileButton.onclick = addNewFile;

const codeEditor = document.querySelector<HTMLTextAreaElement>("#code-editor")!;
const fileTabs = document.querySelector<HTMLDivElement>("#file-tabs")!;
const compileButton = document.querySelector<HTMLButtonElement>("#compile-button")!;
const executeButton = document.querySelector<HTMLButtonElement>("#execute-button")!;

let currentEditingFile: string = 'main.js';

// 创建 Web Worker
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

worker.onmessage = (event) => {
  const { type, payload } = event.data;
  switch (type) {
    case 'COMPILE_RESULT':
      handleCompileResult(payload);
      break;
    case 'COMPILE_ERROR':
      handleCompileError(payload);
      break;
  }
};

// 初始化 worker
worker.postMessage({ type: 'INITIALIZE' });

// 初始化函数
function initialize() {
  updateFileList();
  switchToFile('main.js');
}

function updateFileTabs() {
  fileTabs.innerHTML = "";
  for (const filename in files) {
    const tabButton = document.createElement("button");
    tabButton.textContent = filename;
    tabButton.classList.add("file-tab");
    if (filename === currentEditingFile) {
      tabButton.classList.add("active");
    }
    tabButton.onclick = () => switchToFile(filename);
    fileTabs.appendChild(tabButton);
  }
}

function switchToFile(filename: string) {
  currentEditingFile = filename;
  codeEditor.value = files[filename];
  updateFileTabs();
}

function addNewFile() {
  const filename = prompt("请输入文件名:");
  if (filename && !files[filename]) {
    files[filename] = "";
    switchToFile(filename);
    updateFileList();
  } else if (filename && files[filename]) {
    alert("文件名已存在,请选择其他名称。");
  }
}

function updateFileList() {
  const fileList = document.querySelector<HTMLDivElement>("#file-list")!;
  fileList.innerHTML = "";
  
  for (const filename in files) {
    const fileDiv = document.createElement("div");
    fileDiv.innerHTML = `
      <span>${filename}</span>
      ${filename !== 'main.js' ? '<button class="delete-file">删除</button>' : ''}
    `;
    fileList.appendChild(fileDiv);

    if (filename !== 'main.js') {
      fileDiv.querySelector(".delete-file")!.addEventListener("click", () => deleteFile(filename));
    }
  }
  updateFileTabs();
}

function deleteFile(filename: string) {
  if (filename === 'main.js') {
    alert("不能删除主入口文件");
    return;
  }
  if (confirm(`确定要删除文件 ${filename} 吗?`)) {
    delete files[filename];
    if (currentEditingFile === filename) {
      switchToFile('main.js');
    }
    updateFileList();
  }
}

let compiledCode = '';

compileButton.onclick = compile;
executeButton.onclick = () => {
  if (compiledCode) {
    executeCompiledCode(compiledCode);
  } else {
    alert("请先编译代码");
  }
};

function compile() {
  if (!currentEditingFile) {
    alert("请先选择或创建一个文件");
    return;
  }

  const target = (document.querySelector<HTMLSelectElement>("#target")!).value;
  const loader = (document.querySelector<HTMLSelectElement>("#loader")!).value;
  const format = (document.querySelector<HTMLSelectElement>("#format")!).value;
  const bundle = true; // 始终打包
  const minify = (document.querySelector<HTMLInputElement>("#minify")!).checked;
  const sourcemap = (document.querySelector<HTMLInputElement>("#sourcemap")!).checked;

  worker.postMessage({
    type: 'COMPILE',
    payload: {
      files,
      currentEditingFile,
      options: {
        target,
        loader,
        format,
        bundle,
        minify,
        sourcemap
      }
    }
  });
}

function handleCompileResult(result: any) {
  const output = document.querySelector<HTMLDivElement>(".output-container")!;
  if (result.outputFiles && result.outputFiles.length > 0) {
    compiledCode = result.outputFiles[0].text;
    output.textContent = "编译成功:\n\n" + compiledCode;
    
    if (result.metafile) {
      output.textContent += "\n\n依赖关系:\n" + JSON.stringify(result.metafile.inputs, null, 2);
    }
  } else {
    output.textContent = "编译成功,但没有输出文件。";
    compiledCode = '';
  }
  
  console.log('Compile result:', result);
  if (result.metafile) {
    console.log('Metafile:', result.metafile);
  }
}

function handleCompileError(error: string) {
  const output = document.querySelector<HTMLDivElement>(".output-container")!;
  output.textContent = `编译错误: ${error}`;
  compiledCode = '';
}

function executeCompiledCode(code: string) {
  try {
    // 使用 Function 构造器创建一个新的函数并执行
    new Function(code)();
  } catch (error) {
    console.error('执行编译后的代码时出错:', error);
    alert(`执行编译后的代码时出错: ${error}`);
  }
}

codeEditor.addEventListener('input', () => {
  if (currentEditingFile) {
    files[currentEditingFile] = codeEditor.value;
  }
});

// 在文档加载完成后初始化
document.addEventListener('DOMContentLoaded', initialize);
