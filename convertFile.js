const babylon = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const types = require('@babel/types');
const template = require('@babel/template').default;
const generate = require("@babel/generator").default;
const _ = require('lodash');
const fs = require('fs-extra');
const path = require('path');
const { resolve } = path;
const t = types;

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
}

function readAST(code) {
  return babylon.parse(
    code,
    {
      sourceType: 'module',
      plugins: [
        'jsx',
        "asyncGenerators",
        "bigInt",
        "classProperties",
        "classPrivateProperties",
        "classPrivateMethods",
        ["decorators", { decoratorsBeforeExport: true }], // e.g. beforeExport: `@dec export class
                                                          // C {}` afterExport: `export @dec class
                                                          // C {}`
        "doExpressions",
        "dynamicImport",
        "exportDefaultFrom",
        "exportNamespaceFrom",
        "functionBind",
        "functionSent",
        "importMeta",
        "logicalAssignment",
        "nullishCoalescingOperator",
        "numericSeparator",
        "objectRestSpread",
        "optionalCatchBinding",
        "optionalChaining",
        "partialApplication",
        ["pipelineOperator", { proposal: 'minimal' }],
        "throwExpressions",
      ],
    },
  );
}

module.exports = function(filePath, srcPath, outputPath) {
  return new Promise((resolve, reject) => {
    // 读取js源码
    const code = fs.readFileSync(filePath, { encoding: 'utf8' });
    const ast = readAST(code);

    // 记录文件中所有import标识符
    const allImportSpecifiers = [];
    // 记录文件中import dva/router的标识符
    const routerSpecifiers = [];
    const dvaSpecifiers = [];

    // 以import声明为起点，收集allImportSpecifiers和specifiers
    const importVisitor = {
      ImportDeclaration(path) {
        allImportSpecifiers.push(path);

        let moduleName = path.node.source.value;
        if (/dva\/router/.test(moduleName)) {
          path.traverse(
            specifierVisitor,
            {
              specifiers: routerSpecifiers,
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
      },
    }
    traverse(ast, importVisitor);
    if (!routerSpecifiers.length) {
      return resolve();
    }
    console.log('ΩΩΩ   ' + filePath);

    // 转换完后，将ast编译回js代码
    try {

      // 以入口访问者创建上下文
      // 将 import { xxx } from 'dva/router' 替换为 import { router } from 'dva'; const { xxx } =
      // router; const 语句的声明位置放在 文件中import部分之后 移除原import语句
      traverse(ast, {
        Program(path) {
          if (!routerSpecifiers.length) return path.skip();

          const replaceImportNames = [];

          if (dvaSpecifiers.length) {
            dvaSpecifiers.forEach(item => {
              if (item.name !== 'router')
                replaceImportNames.push(item.name);
            })
          }
          replaceImportNames.push('router');

          routerSpecifiers[0].path.parentPath.insertBefore(
            template(`import {${replaceImportNames.join(',')}} from %%SOURCE%%;`)({
              SOURCE: types.stringLiteral('dva'),
            }),
          )
          allImportSpecifiers.slice(-1)[0].insertAfter(
            template.smart(`const {${[
              ...new Set(routerSpecifiers.map(a => a.name)),
            ].join(',')}} = router;`)(),
          );
          routerSpecifiers.concat(dvaSpecifiers).forEach(a => !a.path.parentPath.removed && a.path.parentPath.remove())
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
          })
        });
      } else {
        fs.writeFile(outPath, output.code, { flag: 'w+' }, (err) => {
          if (err) {
            console.log('save err', err);
            reject(err);
          }
          resolve();
        })
      }
      //    console.log('-----code start')
      //    console.log(output.code.substr(0, 100))
      //    console.log('-----code end')

    } catch (err) {
      console.log('err', err);
    }

  });
}


