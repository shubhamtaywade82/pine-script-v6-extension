import { parseProgram } from './src/parser/treeParser';
import * as fs from 'fs';

const source = fs.readFileSync('src/test/fixtures/workspace/v6-udt-enum-method.pine', 'utf8');
try {
  parseProgram(source);
  console.log("Success");
} catch(e) {
  console.error("Fail:", e);
}
