import glob from 'glob';
import path from 'path';
import jsxKnownIssues from '../jsx-known-issues';
import { ParserOptions as BabelParserOptions } from '@babel/parser';
import { ParserOptions } from '../../src/temp-types-based-on-js-source';

interface Fixture {
  filename: string;
  config?: {
    babelParserOptions?: BabelParserOptions;
    typeScriptESTreeOptions?: ParserOptions;
  };
}

interface FixturePatternConfig {
  pattern: string;
  config?: {
    babelParserOptions?: BabelParserOptions;
    typeScriptESTreeOptions?: ParserOptions;
  };
}

interface CreateFixturePatternConfig {
  ignore?: string[];
  fileType?: string;
  parseWithSourceTypeModule?: string[];
}

/**
 * JSX fixtures which have known issues for typescript-estree
 */
const jsxFilesWithKnownIssues = jsxKnownIssues.map(f => f.replace('jsx/', ''));

/**
 * Current random error difference on jsx/invalid-no-tag-name.src.js
 * TSEP - SyntaxError
 * Babylon - RangeError
 *
 * Reported here: https://github.com/babel/babylon/issues/674
 */
jsxFilesWithKnownIssues.push('invalid-no-tag-name');

/**
 * Globally track which fixtures need to be parsed with sourceType: "module"
 * so that they can be added with the correct FixturePatternConfig
 */
let fixturesRequiringSourceTypeModule: FixturePatternConfig[] = [];

/**
 * Utility to generate a FixturePatternConfig object containing the glob pattern for specific subsections of the fixtures/ directory,
 * including the capability to ignore specific nested patterns.
 *
 * @param {string} fixturesSubPath the sub-path within the fixtures/ directory
 * @param {CreateFixturePatternConfig?} config an optional configuration object with optional sub-paths to ignore and/or parse with sourceType: module
 * @returns {FixturePatternConfig} an object containing the glob pattern and optional additional config
 */
function createFixturePatternConfigFor(
  fixturesSubPath: string,
  config?: CreateFixturePatternConfig
): FixturePatternConfig {
  if (!fixturesSubPath) {
    throw new Error(
      'fixtureSubPath was not provided for the current fixture pattern'
    );
  }
  config = config || ({} as CreateFixturePatternConfig);
  config.ignore = config.ignore || [];
  config.fileType = config.fileType || 'js';
  config.parseWithSourceTypeModule = config.parseWithSourceTypeModule || [];
  /**
   * The TypeScript compiler gives us the "externalModuleIndicator" to allow typescript-estree do dynamically detect the "sourceType".
   * Babylon does not have an equivalent feature (although perhaps it might come in the future https://github.com/babel/babylon/issues/440),
   * so we have to specify the "sourceType" we want to use.
   *
   * By default we have configured babylon to use "script", but for any fixtures specified in the parseWithSourceTypeModule array we need "module".
   *
   * First merge the fixtures which need to be parsed with sourceType: "module" into the
   * ignore list, and then add their full config into the global array.
   */
  if (config.parseWithSourceTypeModule.length) {
    config.ignore = ([] as string[]).concat(
      config.ignore,
      config.parseWithSourceTypeModule
    );
    for (const fixture of config.parseWithSourceTypeModule) {
      fixturesRequiringSourceTypeModule.push({
        // It needs to be the full path from within fixtures/ for the pattern
        pattern: `${fixturesSubPath}/${fixture}.src.${config.fileType}`,
        config: {
          babelParserOptions: {
            sourceType: 'module'
          }
        }
      });
    }
  }
  return {
    pattern: `${fixturesSubPath}/!(${config.ignore.join('|')}).src.${
      config.fileType
    }`
  };
}

/**
 * An array of FixturePatternConfigs
 */
let fixturePatternConfigsToTest = [
  createFixturePatternConfigFor('basics'),

  createFixturePatternConfigFor('comments', {
    ignore: [
      'export-default-anonymous-class', // needs to be parsed with `sourceType: "module"`
      /**
       * Template strings seem to also be affected by the difference in opinion between different parsers in:
       * https://github.com/babel/babylon/issues/673
       */
      'no-comment-template', // Purely AST diffs
      'template-string-block' // Purely AST diffs
    ]
  }),

  createFixturePatternConfigFor('javascript/templateStrings', {
    ignore: ['**/*']
  }),

  createFixturePatternConfigFor('javascript/experimentalObjectRestSpread', {
    ignore: [
      /**
       * Trailing comma is not permitted after a "RestElement" in Babylon
       */
      'invalid-rest-trailing-comma'
    ]
  }),

  createFixturePatternConfigFor('javascript/arrowFunctions', {
    ignore: [
      /**
       * Expected babylon parse errors - all of these files below produce parse errors in espree
       * as well, but the TypeScript compiler is so forgiving during parsing that typescript-estree
       * does not actually error on them and will produce an AST.
       */
      'error-dup-params', // babylon parse errors
      'error-dup-params', // babylon parse errors
      'error-strict-dup-params', // babylon parse errors
      'error-strict-octal', // babylon parse errors
      'error-two-lines' // babylon parse errors
    ]
  }),

  createFixturePatternConfigFor('javascript/bigIntLiterals'),
  createFixturePatternConfigFor('javascript/binaryLiterals'),
  createFixturePatternConfigFor('javascript/blockBindings'),

  createFixturePatternConfigFor('javascript/classes', {
    ignore: [
      /**
       * super() is being used outside of constructor. Other parsers (e.g. espree, acorn) do not error on this.
       */
      'class-one-method-super', // babylon parse errors
      /**
       * Expected babylon parse errors - all of these files below produce parse errors in espree
       * as well, but the TypeScript compiler is so forgiving during parsing that typescript-estree
       * does not actually error on them and will produce an AST.
       */
      'invalid-class-declaration', // babylon parse errors
      'invalid-class-setter-declaration' // babylon parse errors
    ]
  }),

  createFixturePatternConfigFor('javascript/defaultParams'),

  createFixturePatternConfigFor('javascript/destructuring', {
    ignore: [
      /**
       * Expected babylon parse errors - all of these files below produce parse errors in espree
       * as well, but the TypeScript compiler is so forgiving during parsing that typescript-estree
       * does not actually error on them and will produce an AST.
       */
      'invalid-defaults-object-assign' // babylon parse errors
    ]
  }),

  createFixturePatternConfigFor('javascript/destructuring-and-arrowFunctions'),
  createFixturePatternConfigFor('javascript/destructuring-and-blockBindings'),
  createFixturePatternConfigFor('javascript/destructuring-and-defaultParams'),
  createFixturePatternConfigFor('javascript/destructuring-and-forOf'),

  createFixturePatternConfigFor('javascript/destructuring-and-spread', {
    ignore: [
      /**
       * Expected babylon parse errors - all of these files below produce parse errors in espree
       * as well, but the TypeScript compiler is so forgiving during parsing that typescript-estree
       * does not actually error on them and will produce an AST.
       */
      'error-complex-destructured-spread-first' // babylon parse errors
    ]
  }),

  createFixturePatternConfigFor('javascript/experimentalAsyncIteration'),
  createFixturePatternConfigFor('javascript/experimentalDynamicImport'),
  createFixturePatternConfigFor('javascript/exponentiationOperators'),

  createFixturePatternConfigFor('javascript/forOf', {
    ignore: [
      /**
       * TypeScript, espree and acorn parse this fine - esprima, flow and babylon do not...
       */
      'for-of-with-function-initializer' // babylon parse errors
    ]
  }),

  createFixturePatternConfigFor('javascript/generators'),
  createFixturePatternConfigFor('javascript/globalReturn'),

  createFixturePatternConfigFor('javascript/modules', {
    ignore: [
      /**
       * TypeScript, flow and babylon parse this fine - esprima, espree and acorn do not...
       */
      'invalid-export-default', // typescript-estree parse errors
      /**
       * Expected babylon parse errors - all of these files below produce parse errors in espree
       * as well, but the TypeScript compiler is so forgiving during parsing that typescript-estree
       * does not actually error on them and will produce an AST.
       */
      'invalid-export-named-default', // babylon parse errors
      'invalid-import-default-module-specifier', // babylon parse errors
      'invalid-import-module-specifier', // babylon parse errors
      /**
       * Deleting local variable in strict mode
       */
      'error-delete', // babylon parse errors
      /**
       * 'with' in strict mode
       */
      'error-strict' // babylon parse errors
    ],
    parseWithSourceTypeModule: [
      'export-default-array',
      'export-default-class',
      'export-default-expression',
      'export-default-function',
      'export-default-named-class',
      'export-default-named-function',
      'export-default-number',
      'export-default-object',
      'export-default-value',
      'export-from-batch',
      'export-from-default',
      'export-from-named-as-default',
      'export-from-named-as-specifier',
      'export-from-named-as-specifiers',
      'export-from-specifier',
      'export-from-specifiers',
      'export-function',
      'export-named-as-default',
      'export-named-as-specifier',
      'export-named-as-specifiers',
      'export-named-class',
      'export-named-empty',
      'export-named-specifier',
      'export-named-specifiers-comma',
      'export-named-specifiers',
      'export-var-anonymous-function',
      'export-var-number',
      'export-var',
      'import-default-and-named-specifiers',
      'import-default-and-namespace-specifiers',
      'import-default-as',
      'import-default',
      'import-jquery',
      'import-module',
      'import-named-as-specifier',
      'import-named-as-specifiers',
      'import-named-empty',
      'import-named-specifier',
      'import-named-specifiers-comma',
      'import-named-specifiers',
      'import-namespace-specifier',
      'import-null-as-nil',
      'invalid-await',
      'invalid-class'
    ]
  }),

  createFixturePatternConfigFor('javascript/newTarget', {
    ignore: [
      /**
       * Expected babylon parse errors - all of these files below produce parse errors in espree
       * as well, but the TypeScript compiler is so forgiving during parsing that typescript-estree
       * does not actually error on them and will produce an AST.
       */
      'invalid-new-target', // babylon parse errors
      'invalid-unknown-property' // babylon parse errors
    ]
  }),

  createFixturePatternConfigFor('javascript/objectLiteralComputedProperties'),

  createFixturePatternConfigFor('javascript/objectLiteralDuplicateProperties', {
    ignore: [
      /**
       * Expected babylon parse errors - all of these files below produce parse errors in espree
       * as well, but the TypeScript compiler is so forgiving during parsing that typescript-estree
       * does not actually error on them and will produce an AST.
       */
      'error-proto-property', // babylon parse errors
      'error-proto-string-property' // babylon parse errors
    ]
  }),

  createFixturePatternConfigFor('javascript/objectLiteralShorthandMethods'),
  createFixturePatternConfigFor('javascript/objectLiteralShorthandProperties'),
  createFixturePatternConfigFor('javascript/octalLiterals'),
  createFixturePatternConfigFor('javascript/regex'),
  createFixturePatternConfigFor('javascript/regexUFlag'),
  createFixturePatternConfigFor('javascript/regexYFlag'),

  createFixturePatternConfigFor('javascript/restParams', {
    ignore: [
      /**
       * Expected babylon parse errors - all of these files below produce parse errors in espree
       * as well, but the TypeScript compiler is so forgiving during parsing that typescript-estree
       * does not actually error on them and will produce an AST.
       */
      'error-no-default', // babylon parse errors
      'error-not-last' // babylon parse errors
    ]
  }),

  createFixturePatternConfigFor('javascript/spread'),
  createFixturePatternConfigFor('javascript/unicodeCodePointEscapes'),
  createFixturePatternConfigFor('jsx', { ignore: jsxFilesWithKnownIssues }),
  createFixturePatternConfigFor('jsx-useJSXTextNode'),

  /* ================================================== */

  /**
   * TSX-SPECIFIC FILES
   */

  createFixturePatternConfigFor('tsx', {
    fileType: 'tsx',
    ignore: [
      /**
       * AST difference
       */
      'react-typed-props',
      /**
       * currently babylon not supported
       */
      'generic-jsx-element'
    ]
  }),

  /* ================================================== */

  /**
   * TYPESCRIPT-SPECIFIC FILES
   */

  createFixturePatternConfigFor('typescript/babylon-convergence', {
    fileType: 'ts'
  }),

  createFixturePatternConfigFor('typescript/basics', {
    fileType: 'ts',
    ignore: [
      /**
       * Other babylon parse errors relating to invalid syntax.
       */
      'abstract-class-with-abstract-constructor', // babylon parse errors
      'class-with-export-parameter-properties', // babylon parse errors
      'class-with-optional-methods', // babylon parse errors
      'class-with-static-parameter-properties', // babylon parse errors
      'interface-with-all-property-types', // babylon parse errors
      'interface-with-construct-signature-with-parameter-accessibility', // babylon parse errors
      'class-with-implements-and-extends', // babylon parse errors
      /**
       * typescript-estree erroring, but babylon not.
       */
      'arrow-function-with-type-parameters', // typescript-estree parse errors
      /**
       * Babylon: ClassDeclaration + abstract: true
       * tsep: TSAbstractClassDeclaration
       */
      'abstract-class-with-abstract-properties',
      /**
       * Babylon: ClassProperty + abstract: true
       * tsep: TSAbstractClassProperty
       */
      'abstract-class-with-abstract-readonly-property',
      /**
       * Babylon: TSExpressionWithTypeArguments
       * tsep: ClassImplements
       */
      'class-with-implements-generic-multiple',
      'class-with-implements-generic',
      'class-with-implements',
      'class-with-extends-and-implements',
      /**
       * Other major AST differences (e.g. fundamentally different node types)
       */
      'class-with-mixin',
      'function-with-types-assignation',
      'interface-extends-multiple',
      'interface-extends',
      'interface-type-parameters',
      'interface-with-extends-type-parameters',
      'interface-with-generic',
      'interface-with-jsdoc',
      'interface-with-optional-properties',
      'interface-without-type-annotation',
      'typed-this',
      'export-type-function-declaration',
      'abstract-interface',
      'keyof-operator',
      /**
       * tsep bug - Program.body[0].expression.left.properties[0].value.right is currently showing up
       * as `ArrayPattern`, babylon, acorn and espree say it should be `ArrayExpression`
       * TODO: Fix this
       */
      'destructuring-assignment',
      /**
       * Babylon bug for optional or abstract methods?
       */
      'abstract-class-with-abstract-method', // babylon parse errors
      'abstract-class-with-optional-method', // babylon parse errors
      'declare-class-with-optional-method', // babylon parse errors
      /**
       * Awaiting feedback on Babylon issue https://github.com/babel/babylon/issues/700
       */
      'class-with-private-parameter-properties',
      'class-with-protected-parameter-properties',
      'class-with-public-parameter-properties',
      'class-with-readonly-parameter-properties',
      /**
       * Not yet supported in Babylon https://github.com/babel/babel/issues/7749
       */
      'import-type',
      'import-type-with-type-parameters-in-type-reference'
    ],
    parseWithSourceTypeModule: [
      'export-named-enum',
      'export-assignment',
      'export-type-alias-declaration',
      'export-type-class-declaration',
      'export-default-class-with-generic',
      'export-default-class-with-multiple-generics',
      'export-named-class-with-generic',
      'export-named-class-with-multiple-generics'
    ]
  }),

  createFixturePatternConfigFor('typescript/decorators/accessor-decorators', {
    fileType: 'ts'
  }),
  createFixturePatternConfigFor('typescript/decorators/class-decorators', {
    fileType: 'ts'
  }),
  createFixturePatternConfigFor('typescript/decorators/method-decorators', {
    fileType: 'ts'
  }),
  createFixturePatternConfigFor('typescript/decorators/parameter-decorators', {
    fileType: 'ts'
  }),
  createFixturePatternConfigFor('typescript/decorators/property-decorators', {
    fileType: 'ts'
  }),

  createFixturePatternConfigFor('typescript/expressions', {
    fileType: 'ts',
    ignore: [
      /**
       * there is difference in range between babel and tsep
       */
      'tagged-template-expression-type-arguments'
    ]
  }),

  createFixturePatternConfigFor('typescript/errorRecovery', {
    fileType: 'ts',
    ignore: [
      /**
       * AST difference
       */
      'interface-empty-extends',
      /**
       * TypeScript-specific tests taken from "errorRecovery". Babylon is not being as forgiving as the TypeScript compiler here.
       */
      'class-empty-extends-implements', // babylon parse errors
      'class-empty-extends', // babylon parse errors
      'decorator-on-enum-declaration', // babylon parse errors
      'decorator-on-interface-declaration', // babylon parse errors
      'interface-property-modifiers', // babylon parse errors
      'enum-with-keywords' // babylon parse errors
    ]
  }),

  createFixturePatternConfigFor('typescript/declare', {
    fileType: 'ts',
    ignore: [
      /**
       * AST difference
       * tsep: TSAbstractClassDeclaration
       * babel: ClassDeclaration[abstract=true]
       */
      'interface',
      /**
       * AST difference
       * tsep: heritage = []
       * babel: heritage = undefined
       */
      'abstract-class'
    ]
  }),

  createFixturePatternConfigFor('typescript/namespaces-and-modules', {
    fileType: 'ts',
    ignore: [
      /**
       * Minor AST difference
       */
      'nested-internal-module',
      /**
       * Babylon: TSDeclareFunction
       * tsep: TSNamespaceFunctionDeclaration
       */
      'declare-namespace-with-exported-function'
    ]
  })
];

/**
 * Add in all the fixtures which need to be parsed with sourceType: "module"
 */
fixturePatternConfigsToTest = ([] as FixturePatternConfig[]).concat(
  fixturePatternConfigsToTest,
  fixturesRequiringSourceTypeModule
);

const fixturesToTest: Fixture[] = [];
const fixturesDirPath = path.join(__dirname, '../fixtures');

/**
 * Resolve the glob patterns into actual Fixture files that we can run assertions for...
 */
fixturePatternConfigsToTest.forEach(fixturePatternConfig => {
  /**
   * Find the fixture files which match the given pattern
   */
  const matchingFixtures = glob.sync(
    `${fixturesDirPath}/${fixturePatternConfig.pattern}`,
    {}
  );
  matchingFixtures.forEach(filename => {
    fixturesToTest.push({
      filename,
      config: fixturePatternConfig.config
    });
  });
});

export { fixturesToTest };
