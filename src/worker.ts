import * as esbuild from 'esbuild-wasm';

let initialized = false;

function resolveUrl(baseUrl: string, path: string) {
    const base = new URL(baseUrl);
    if (path.startsWith('./') || path.startsWith('../')) {
      // 对于相对路径，保留基础 URL 的完整路径
      return new URL(path, base.href + '/').href;
    } else {
      // 对于其他路径，只使用基础 URL 的 origin
      return new URL(path, base.origin + '/').href;
    }
  }

async function initializeEsbuild() {
  if (!initialized) {
    await esbuild.initialize({
      wasmURL: '/esbuild.wasm',
    });
    initialized = true;
    console.log('esbuild initialized in worker');
  }
}

self.onmessage = async (event: MessageEvent) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'INITIALIZE':
      console.log('pre initializeEsbuild');
      await initializeEsbuild();
      console.log('initialized');
      self.postMessage({ type: 'INITIALIZED' });
      break;
    case 'COMPILE':
      await compile(payload);
      break;
  }
};

async function compile(data: any) {
  const { files, currentEditingFile, options } = data;

  console.log(data);
  try {
    const result = await esbuild.build({
      entryPoints: [currentEditingFile],
      bundle: true, // 始终打包以处理依赖
      minify: options.minify,
      sourcemap: options.sourcemap,
      treeShaking:true,
      target: options.target.toLowerCase(),
      format: 'iife', // 使用立即执行函数表达式格式
      globalName: 'compiledModule', // 为编译后的代码提供一个全局名称
      write: false,
      outdir: 'out',
      plugins: [{
        name: 'virtual-fs',
        setup(build) {
            build.onResolve({ filter: /(^main\.js$)/ }, (args: any) => {
				return { path: 'main.js',namespace:"virtual-fs" }
			})
          // 处理所有文件路径
          build.onResolve({ filter: /.*/ }, async (args) => {
            console.log('Resolving:', args);
            
            // 这里我们可以直接使用 args 中的信息
            const { path, importer, namespace, resolveDir, kind } = args;

            // 根据 kind 判断导入类型
            if (kind === 'import-statement') {
              // 处理 ES6 模块导入
              if (path === 'lodash-es') {
                // 对 lodash-es 的处理
                return {
                  path: `https://unpkg.com/lodash-es@4.17.21/lodash.js`,
                  namespace: 'cdn-import',
                };
              } else if (path.startsWith('lodash-es/')) {
                // 处理 lodash-es 的部分导入
                return {
                  path: `https://unpkg.com/lodash-es@4.17.21/${path.slice('lodash-es/'.length)}.js`,
                  namespace: 'cdn-import',
                };
              }
            }

            // 处理其他类型的导入或者本地文件
            if (path.startsWith('./') || path.startsWith('../')) {
              return {
                path: new URL(path, 'file:///' + importer).pathname,
                namespace: 'virtual-fs'
              };
            }
            
            // 处理其他外部模块
            return {
              path: `https://unpkg.com/${path}`,
              namespace: 'cdn-import',
            };
          });

          // 加载文件内容
          build.onLoad({ filter: /.*/, namespace: 'virtual-fs' }, args => {
            console.log('local', args);
            const filename = args.path.split('/').pop() || '';
            if (files[filename]) {
              return {
                contents: files[filename],
                loader: options.loader.toLowerCase() as esbuild.Loader,
              };
            }
            return { errors: [{ text: `File not found: ${filename}` }] };
          });

          // 从CDN加载模块
          build.onLoad({ filter: /.*/, namespace: 'cdn-import' }, async (args) => {
            console.log('cdn', args);
            const response = await fetch(args.path);
            if (!response.ok) {
              throw new Error(`Failed to fetch ${args.path}: ${response.statusText}`);
            }
            let contents = await response.text();
            
            // 如果是部分导入，我们可以进行额外的处理
            if (args.path.includes('lodash-es/')) {
              // 对于 lodash-es 的部分导入，我们可以只保留需要的导出
              contents = `export { default } from '${args.path}';`;
            }
            
            return {
              contents,
              loader: 'js',
            };
          });
        },
      }],
    });

    self.postMessage({ type: 'COMPILE_RESULT', payload: result });
  } catch (error) {
    self.postMessage({ type: 'COMPILE_ERROR', payload: (error as Error).message });
  }
}

// 移除 parseImport 函数，因为我们不再需要它

// ... 其他代码保持不变 ...