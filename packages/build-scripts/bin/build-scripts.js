#!/usr/bin/env node

/*
 * @Author: xiaotian.zy
 * @Descriptions: 命令行主文件，用于 build、start、test 三个子命令注册
 * @TodoList: 无
 * @Date: 2022-08-17 16:22:11
 * @Last Modified by: xiaotian.zy
 * @Last Modified time: 2022-08-17 16:25:22
 */

const program = require('commander');
const packageInfo = require('../package.json');
const checkNodeVersion = require('../lib/utils/checkNodeVersion');
const build = require('./build');
const start = require('./start');
const test = require('./test');

(async () => {
  console.log(packageInfo.name, packageInfo.version);
  // finish check before run command
  checkNodeVersion(packageInfo.engines.node);

  program.version(packageInfo.version).usage('<command> [options]');

  /**
   * 命令注册
   */

  program
    .command('build')
    .description('build project')
    .allowUnknownOption()
    .option('--config <config>', 'use custom config')
    .action(build);

  program
    .command('start')
    .description('start server')
    .allowUnknownOption()
    .option('--config <config>', 'use custom config')
    .option('--inspect', 'enable the Node.js inspector')
    .option('-h, --host <host>', 'dev server host', '0.0.0.0')
    .option('-p, --port <port>', 'dev server port')
    .action(start);

  program
    .command('test')
    .description('run tests with jest')
    .allowUnknownOption() // allow jest config
    .option('--config <config>', 'use custom config')
    .action(test);

  program.parse(process.argv);

  /**
   * 判断是否有存在运行的命令，如果有则退出已执行命令
   */

  const proc = program.runningCommand;

  if (proc) {
    proc.on('close', process.exit.bind(process));
    proc.on('error', () => {
      process.exit(1);
    });
  }

  /**
   * 如果无子命令，展示 help 信息
   */
  const subCmd = program.args[0];
  if (!subCmd) {
    program.help();
  }
})();
