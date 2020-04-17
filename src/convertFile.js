const babylon = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const types = require('@babel/types');
const template = require('@babel/template').default;
const generate = require('@babel/generator').default;
const fs = require('fs-extra');
const path = require('path');

const specifierVisitor = {
  ImportSpecifier(_path) {
    // e.g.  import { exportX, exportY } from 'moduleA'
    //    console.debug('ImportSpecifier:', this.specifiers, _path.node)
    this.specifiers.push({
      type: 'COMMON',
      path: _path,
      sourceName: this.moduleName,
      name: _path.node.local.name,
      importedName: _path.node.imported ? _path.node.imported.name : void 0,
    });
  },
  ImportDefaultSpecifier(_path) {
    // e.g.  import A_Default from 'moduleA'
    //    console.debug('ImportDefaultSpecifier:', this.specifiers, _path.node)
    this.specifiers.push({
      type: 'DEFAULT',
      path: _path,
      sourceName: this.moduleName,
      name: _path.node.local.name,
    });
  },
  ImportNamespaceSpecifier(_path) {
    // e.g.  import * as A from 'moduleA'
    //    console.debug('ImportNamespaceSpecifier:', this.specifiers, _path.node)
    this.specifiers.push({
      type: 'NAMESPACE',
      path: _path,
      sourceName: this.moduleName,
      name: _path.node.local.name,
      importedName: _path.node.imported ? _path.node.imported.name : void 0,
    });
  },
};

function readAST(code) {
  return babylon.parse(
    code,
    {
      sourceType: 'module',
      plugins: [
        'jsx',
        'asyncGenerators',
        'bigInt',
        'classProperties',
        'classPrivateProperties',
        'classPrivateMethods',
        [
          'decorators',
          { decoratorsBeforeExport: true },
        ],
        'doExpressions',
        'dynamicImport',
        'exportDefaultFrom',
        'exportNamespaceFrom',
        'functionBind',
        'functionSent',
        'importMeta',
        'logicalAssignment',
        'nullishCoalescingOperator',
        'numericSeparator',
        'objectRestSpread',
        'optionalCatchBinding',
        'optionalChaining',
        'partialApplication',
        [
          'pipelineOperator',
          { proposal: 'minimal' },
        ],
        'throwExpressions',
      ],
    },
  );
}

module.exports = function(filePath, srcPath, outputPath) {
  return new Promise((resolve, reject) => {
    // 读取js源码
    const code = fs.readFileSync(filePath, { encoding: 'utf8' });
    const ast = readAST(code);

    // 记录文件中所有import标识符，定位稍后const 语句插入的位置
    const allImportSpecifiers = [];
    // 记录文件中import dva/XXX的标识符
    const routerSpecifiers = [];
    const dvaNamespaces = [];

    // 记录格式正确的import-from dva语法
    const dvaSpecifiers = [];

    // 以import声明为起点，收集allImportSpecifiers和specifiers
    const importVisitor = {
      ImportDeclaration(path) {
        let moduleName = path.node.source.value;
        if (/dva\/([^\/]*)$/.test(moduleName)) {
          const namespace = RegExp.$1;
          if (!dvaNamespaces.includes(namespace))
            dvaNamespaces.push(namespace);
          path.traverse(
            specifierVisitor,
            {
              specifiers: routerSpecifiers,
              moduleName: namespace,
            },
          );
        }
        if (moduleName === 'dva') {
          path.traverse(
            specifierVisitor,
            {
              specifiers: dvaSpecifiers,
            },
          );
        }
        path.traverse(
          specifierVisitor,
          {
            specifiers: allImportSpecifiers,
          },
        );
      },
    };
    traverse(ast, importVisitor);

    if (!routerSpecifiers.length) {
      return resolve();
    }
    console.log('ΩΩΩ   ' + filePath);

    const dvaCommonSpecifiers = dvaSpecifiers.filter(b => b.type === 'COMMON');

    // 转换完后，将ast编译回js代码
    try {
      // 以入口访问者创建上下文
      // 将 import { xxx } from 'dva/router' 替换为 import { router } from 'dva'; const { xxx } =
      // router; const 语句的声明位置放在 文件中import部分之后 移除原import语句
      traverse(ast, {
        Program(path) {
          if (!routerSpecifiers.length) return path.skip();
          const namespaces = new Set();
          routerSpecifiers.forEach(a => {
            const { sourceName } = a;
            const undefindSourceName = !dvaCommonSpecifiers.some(b => b.importedName === sourceName);
            if (undefindSourceName) {
              let nextName = sourceName;
              let i = 0;
              const sameSourceNames = allImportSpecifiers.filter(b => b.name === sourceName).map(a=>a.name);
              while (sameSourceNames.includes(nextName)) {
                nextName = `${nextName}${++i}`;
              }
              if(sourceName === nextName) {
                namespaces.add(sourceName);
              } else {
                namespaces.add(`${sourceName} as ${nextName}`);
                // 注意这一句，sourceName因为与现有命名冲突，所以被重新赋为带后缀的名字
                a.sourceName = nextName;
              }
            }
          });
          if (namespaces.size) {
            let positionPath = routerSpecifiers[0].path.parentPath;
            positionPath.insertBefore(
              template(`import {${[...namespaces].join(', ')}} from %%SOURCE%%;`)({
                SOURCE: types.stringLiteral('dva'),
              }),
            );
          }


          const routerSpecifierMap = {};
          routerSpecifiers.forEach(a => {
            const { sourceName } = a;
            if (!routerSpecifierMap[sourceName]) {
              routerSpecifierMap[sourceName] = [];
            }
            routerSpecifierMap[sourceName].push(a);
          });
          const constLiteral = Object.keys(routerSpecifierMap).map(k => {
            const v = routerSpecifierMap[k].map(a => {
              const { name, importedName } = a;
              return name === importedName
                ? name
                : `${importedName}: ${name}`;
            });
            return `const {${[
              ...new Set(v),
            ].join(', ')}} = ${k};`;
          });

          if (constLiteral.length) {
            allImportSpecifiers[allImportSpecifiers.length - 1].path.parentPath.insertAfter(
              template.smart(`\r\n\r\n${constLiteral.join('\r\n')}`)(),
            );
            routerSpecifiers.forEach(a => !a.path.parentPath.removed && a.path.parentPath.remove());
          }
        },
      });

      const output = generate(ast, {
        quotes: 'single',
      }, code);

      // 保存
      const outPath = filePath.replace(srcPath, outputPath);
      const dirPath = path.dirname(outPath);

      if (!fs.existsSync(dirPath)) {
        fs.mkdirp(dirPath, { recursive: true }, (err) => {
          if (err) return;
          fs.writeFile(outPath, output.code, { flag: 'w+' }, (err) => {
            if (err) {
              console.log('save err', err);
              reject(err);
            }
            resolve();
          });
        });
      } else {
        fs.writeFile(outPath, output.code, { flag: 'w+' }, (err) => {
          if (err) {
            console.log('save err', err);
            reject(err);
          }
          resolve();
        });
      }
      //    console.log('-----code start')
      //    console.log(output.code.substr(0, 100))
      //    console.log('-----code end')

    } catch (err) {
      console.log('err', err);
    }

  });
};


