/**
 * @fileoverview Tests for TypeScript-specific constructs
 * @author Nicholas C. Zakas
 * @author James Henry <https://github.com/JamesHenry>
 * @copyright jQuery Foundation and other contributors, https://jquery.org/
 * MIT License
 */

'use strict';

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const path = require('path'),
  shelljs = require('shelljs'),
  testUtils = require('../../tools/test-utils'),
  ts = require('typescript');

//------------------------------------------------------------------------------
// Setup
//------------------------------------------------------------------------------

const FIXTURES_DIR = './tests/fixtures/semanticInfo';

const testFiles = shelljs
  .find(FIXTURES_DIR)
  .filter(filename => filename.indexOf('.src.ts') > -1)
  // strip off ".src.ts"
  .map(filename =>
    filename.substring(FIXTURES_DIR.length - 1, filename.length - 7)
  );

function createOptions(fileName) {
  return {
    loc: true,
    range: true,
    tokens: true,
    ecmaFeatures: {},
    errorOnUnknownASTType: true,
    filePath: fileName,
    cwd: path.join(process.cwd(), FIXTURES_DIR),
    project: './tsconfig.json'
  };
}

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe('semanticInfo', () => {
  // test all AST snapshots
  testFiles.forEach(filename => {
    // Uncomment and fill in filename to focus on a single file
    // var filename = "jsx/invalid-matching-placeholder-in-closing-tag";
    const fullFileName = `${path.resolve(FIXTURES_DIR, filename)}.src.ts`;
    const code = shelljs.cat(fullFileName);
    test(
      `fixtures/${filename}.src`,
      testUtils.createSnapshotTestBlock(code, createOptions(fullFileName))
    );
  });

  // case-specific tests
  test('isolated-file tests', () => {
    const fileName = path.resolve(FIXTURES_DIR, 'isolated-file.src.ts');
    const parseResult = testUtils.parseCode(
      shelljs.cat(fileName),
      createOptions(fileName)
    );

    // get type checker
    expect(parseResult).toHaveProperty('services.program.getTypeChecker');
    const checker = parseResult.services.program.getTypeChecker();

    // get number node (ast shape validated by snapshot)
    const arrayMember =
      parseResult.ast.body[0].declarations[0].init.elements[0];
    expect(parseResult).toHaveProperty('services.esTreeNodeToTSNodeMap');

    // get corresponding TS node
    const tsArrayMember = parseResult.services.esTreeNodeToTSNodeMap.get(
      arrayMember
    );
    expect(tsArrayMember).toBeDefined();
    expect(tsArrayMember.kind).toBe(ts.SyntaxKind.NumericLiteral);
    expect(tsArrayMember.text).toBe('3');

    // get type of TS node
    const arrayMemberType = checker.getTypeAtLocation(tsArrayMember);
    expect(arrayMemberType.flags).toBe(ts.TypeFlags.NumberLiteral);
    expect(arrayMemberType.value).toBe(3);

    // make sure it maps back to original ESTree node
    expect(parseResult).toHaveProperty('services.tsNodeToESTreeNodeMap');
    expect(parseResult.services.tsNodeToESTreeNodeMap.get(tsArrayMember)).toBe(
      arrayMember
    );

    // get bound name
    const boundName = parseResult.ast.body[0].declarations[0].id;
    expect(boundName.name).toBe('x');

    const tsBoundName = parseResult.services.esTreeNodeToTSNodeMap.get(
      boundName
    );
    expect(tsBoundName).toBeDefined();

    checkNumberArrayType(checker, tsBoundName);

    expect(parseResult.services.tsNodeToESTreeNodeMap.get(tsBoundName)).toBe(
      boundName
    );
  });

  test('imported-file tests', () => {
    const fileName = path.resolve(FIXTURES_DIR, 'import-file.src.ts');
    const parseResult = testUtils.parseCode(
      shelljs.cat(fileName),
      createOptions(fileName)
    );

    // get type checker
    expect(parseResult).toHaveProperty('services.program.getTypeChecker');
    const checker = parseResult.services.program.getTypeChecker();

    // get array node (ast shape validated by snapshot)
    // node is defined in other file than the parsed one
    const arrayBoundName = parseResult.ast.body[1].expression.callee.object;
    expect(arrayBoundName.name).toBe('arr');

    expect(parseResult).toHaveProperty('services.esTreeNodeToTSNodeMap');
    const tsArrayBoundName = parseResult.services.esTreeNodeToTSNodeMap.get(
      arrayBoundName
    );
    expect(tsArrayBoundName).toBeDefined();
    checkNumberArrayType(checker, tsArrayBoundName);

    expect(
      parseResult.services.tsNodeToESTreeNodeMap.get(tsArrayBoundName)
    ).toBe(arrayBoundName);
  });

  test('non-existent project file', () => {
    const fileName = path.resolve(FIXTURES_DIR, 'isolated-file.src.ts');
    const badConfig = createOptions(fileName);
    badConfig.project = './tsconfigs.json';
    expect(() =>
      testUtils.parseCode(shelljs.cat(fileName), badConfig)
    ).toThrowErrorMatchingSnapshot();
  });

  test('fail to read project file', () => {
    const fileName = path.resolve(FIXTURES_DIR, 'isolated-file.src.ts');
    const badConfig = createOptions(fileName);
    badConfig.project = '.';
    expect(() =>
      testUtils.parseCode(shelljs.cat(fileName), badConfig)
    ).toThrowErrorMatchingSnapshot();
  });

  test('malformed project file', () => {
    const fileName = path.resolve(FIXTURES_DIR, 'isolated-file.src.ts');
    const badConfig = createOptions(fileName);
    badConfig.project = './badTSConfig/tsconfig.json';
    expect(() =>
      testUtils.parseCode(shelljs.cat(fileName), badConfig)
    ).toThrowErrorMatchingSnapshot();
  });
});

/**
 * Verifies that the type of a TS node is number[] as expected
 * @param {ts.TypeChecker} checker
 * @param {ts.Node} tsNode
 */
function checkNumberArrayType(checker, tsNode) {
  const nodeType = /** @type {ts.ObjectType & ts.TypeReference} */ (checker.getTypeAtLocation(
    tsNode
  ));
  expect(nodeType.flags).toBe(ts.TypeFlags.Object);
  expect(nodeType.objectFlags).toBe(ts.ObjectFlags.Reference);
  expect(nodeType.typeArguments).toHaveLength(1);
  expect(nodeType.typeArguments[0].flags).toBe(ts.TypeFlags.Number);
}
