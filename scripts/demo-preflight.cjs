#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const root = path.resolve(__dirname, '..');
process.chdir(root);
let failures = 0;
const ok = (message) => console.log(`PASS ${message}`);
const warn = (message) => console.log(`WARN ${message}`);
const fail = (message) => { failures += 1; console.error(`FAIL ${message}`); };
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const has = (file) => fs.existsSync(path.join(root, file));
const [major, minor] = process.versions.node.split('.').map(Number);
console.log(`Node ${process.version} (${process.execPath})`);
if (major > 22 || (major === 22 && minor >= 13)) ok('Node supported');
else fail('Node must be 22.13+; check PATH and restart VS Code terminal');

let pkg;
try {
  pkg = readJson('package.json');
  ok('package.json parsed');
} catch (error) { fail(`package.json missing/invalid: ${error.message}`); }
if (pkg) {
  const expo = pkg.dependencies?.expo;
  console.log(`Expo dependency: ${expo || '(missing)'}`);
  for (const dep of ['expo-location', 'expo-notifications', '@react-native-async-storage/async-storage']) {
    if (pkg.dependencies?.[dep]) ok(`${dep} declared (${pkg.dependencies[dep]})`);
    else fail(`${dep} not declared`);
  }
  if (pkg.scripts?.check) ok('npm run check available');
  else fail('npm run check is missing');
}

const original = ['src/data/catalog.json', 'catalog.json'].find(has);
if (!original) fail('catalog.json missing; medicines will not appear; put the supplier file in src/data/catalog.json');
else {
  try {
    const data = readJson(original);
    const fields = ['id','name','salt','price','maxQty','rx'];
    if (!Array.isArray(data) || data.length !== 15 || new Set(data.map(item => item.id)).size !== 15 ||
      data.some(item => !fields.every(f => Object.prototype.hasOwnProperty.call(item,f)) ||
        typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.salt !== 'string' ||
        typeof item.price !== 'number' || !Number.isInteger(item.maxQty) || item.maxQty < 1 || typeof item.rx !== 'boolean')) {
      fail(`${original}: schema or count invalid (expected 15 medicines)`);
    } else ok(`${original}: valid 15-medicine array`);
  } catch(error) { fail(`${original}: invalid JSON: ${error.message}`); }
}

if (has('eas.json')) {
 try {
  const eas=readJson('eas.json');
  if (eas.build?.debug?.android?.gradleCommand === ':app:assembleDebug') ok('true Android debug profile configured');
  else warn('debug EAS profile is not configured for :app:assembleDebug');
  if (eas.build?.preview?.android?.buildType === 'apk') ok('standalone preview APK profile configured');
  else warn('preview APK profile not configured');
 } catch(error){fail(`Invalid eas.json: ${error.message}`);}
} else warn('eas.json missing');

for (const command of [{cmd:'adb', args:['devices']}, {cmd:'git', args:['status','--short']}]) {
 try {
  const result=cp.execFileSync(command.cmd, command.args, {encoding:'utf8',timeout:3500,stdio:['ignore','pipe','ignore']}).trim();
  console.log(`${command.cmd} ${command.args.join(' ')}:\n${result || '(no output)'}`);
 } catch(error) { warn(`${command.cmd} unavailable or failed (${error.message.split('\n')[0]})`); }
}
console.log('\nThis checks static configuration only, NOT the installed Android native binary.');
console.log('Run `npm run check` and install a custom EAS APK for actual runtime verification.');
process.exitCode = failures ? 1 : 0;
