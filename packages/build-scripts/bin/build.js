#!/usr/bin/env node

/*
 * @Author: xiaotian.zy
 * @Descriptions: build 子命令执行逻辑
 * @TodoList: 无
 * @Date: 2022-08-17 16:25:46
 * @Last Modified by: xiaotian.zy
 * @Last Modified time: 2022-08-17 16:28:31
 */

const parse = require('yargs-parser');
const build = require('../lib/commands/build');
const log = require('../lib/utils/log');

module.exports = async () => {
  process.env.NODE_ENV = 'production';

  // 命令行参数解析
  const rawArgv = parse(process.argv.slice(2), {
    configuration: { 'strip-dashed': true },
  });
  // ignore _ in rawArgv
  delete rawArgv._;

  // 传入参数，执行 build 逻辑
  try {
    await build({
      args: { ...rawArgv },
    });
  } catch (err) {
    log.error(err.message);
    console.error(err);
    process.exit(1);
  }
};
