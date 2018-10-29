/**
 * @fileoverview Parser that converts TypeScript into ESTree format.
 * @author Nicholas C. Zakas
 * @author James Henry <https://github.com/JamesHenry>
 * @copyright jQuery Foundation and other contributors, https://jquery.org/
 * MIT License
 */

'use strict';

const astNodeTypes = require('./lib/ast-node-types'),
  ts = require('typescript'),
  convert = require('./lib/ast-converter'),
  semver = require('semver'),
  calculateProjectParserOptions = require('./lib/tsconfig-parser');

const SUPPORTED_TYPESCRIPT_VERSIONS = require('./package.json').devDependencies
  .typescript;
const ACTIVE_TYPESCRIPT_VERSION = ts.version;
const isRunningSupportedTypeScriptVersion = semver.satisfies(
  ACTIVE_TYPESCRIPT_VERSION,
  SUPPORTED_TYPESCRIPT_VERSIONS
);

let extra;
let warnedAboutTSVersion = false;

/**
 * Resets the extra config object
 * @returns {void}
 */
function resetExtra() {
  extra = {
    tokens: null,
    range: false,
    loc: false,
    comment: false,
    comments: [],
    tolerant: false,
    errors: [],
    strict: false,
    ecmaFeatures: {},
    useJSXTextNode: false,
    log: console.log,
    project: []
  };
}

//------------------------------------------------------------------------------
// Parser
//------------------------------------------------------------------------------

/**
 * Parses the given source code to produce a valid AST
 * @param {mixed} code    TypeScript code
 * @param {Object} options configuration object for the parser
 * @returns {Object}         the AST
 */
function generateAST(code, options) {
  const toString = String;

  if (typeof code !== 'string' && !(code instanceof String)) {
    code = toString(code);
  }

  resetExtra();

  if (typeof options !== 'undefined') {
    extra.range = typeof options.range === 'boolean' && options.range;
    extra.loc = typeof options.loc === 'boolean' && options.loc;

    if (extra.loc && options.source !== null && options.source !== undefined) {
      extra.source = toString(options.source);
    }

    if (typeof options.tokens === 'boolean' && options.tokens) {
      extra.tokens = [];
    }
    if (typeof options.comment === 'boolean' && options.comment) {
      extra.comment = true;
      extra.comments = [];
    }
    if (typeof options.tolerant === 'boolean' && options.tolerant) {
      extra.errors = [];
    }

    if (options.ecmaFeatures && typeof options.ecmaFeatures === 'object') {
      // pass through jsx option
      extra.ecmaFeatures.jsx = options.ecmaFeatures.jsx;
    }

    /**
     * Allow the user to cause the parser to error if it encounters an unknown AST Node Type
     * (used in testing).
     */
    if (options.errorOnUnknownASTType) {
      extra.errorOnUnknownASTType = true;
    }

    if (typeof options.useJSXTextNode === 'boolean' && options.useJSXTextNode) {
      extra.useJSXTextNode = true;
    }

    /**
     * Allow the user to override the function used for logging
     */
    if (typeof options.loggerFn === 'function') {
      extra.log = options.loggerFn;
    } else if (options.loggerFn === false) {
      extra.log = Function.prototype;
    }

    if (typeof options.project === 'string') {
      extra.project = [options.project];
    } else if (
      Array.isArray(options.project) &&
      options.project.every(projectPath => typeof projectPath === 'string')
    ) {
      extra.project = options.project;
    }
  }

  if (!isRunningSupportedTypeScriptVersion && !warnedAboutTSVersion) {
    const border = '=============';
    const versionWarning = [
      border,
      'WARNING: You are currently running a version of TypeScript which is not officially supported by typescript-estree.',
      'You may find that it works just fine, or you may not.',
      `SUPPORTED TYPESCRIPT VERSIONS: ${SUPPORTED_TYPESCRIPT_VERSIONS}`,
      `YOUR TYPESCRIPT VERSION: ${ACTIVE_TYPESCRIPT_VERSION}`,
      'Please only submit bug reports when using the officially supported version.',
      border
    ];
    extra.log(versionWarning.join('\n\n'));
    warnedAboutTSVersion = true;
  }

  let relevantProgram = undefined;
  let ast = undefined;
  const shouldProvideParserServices = extra.project && extra.project.length > 0;

  if (shouldProvideParserServices) {
    const FILENAME = options.filePath;
    const programs = calculateProjectParserOptions(
      code,
      options,
      extra.project
    );
    for (const program of programs) {
      ast = program.getSourceFile(FILENAME);

      if (ast !== undefined) {
        relevantProgram = program;
        break;
      }
    }
  }

  if (ast === undefined) {
    // Even if jsx option is set in typescript compiler, filename still has to
    // contain .tsx file extension
    const FILENAME = extra.ecmaFeatures.jsx ? 'estree.tsx' : 'estree.ts';

    const compilerHost = {
      fileExists() {
        return true;
      },
      getCanonicalFileName() {
        return FILENAME;
      },
      getCurrentDirectory() {
        return '';
      },
      getDirectories() {
        return [];
      },
      getDefaultLibFileName() {
        return 'lib.d.ts';
      },

      // TODO: Support Windows CRLF
      getNewLine() {
        return '\n';
      },
      getSourceFile(filename) {
        return ts.createSourceFile(
          filename,
          code,
          ts.ScriptTarget.Latest,
          true
        );
      },
      readFile() {
        return undefined;
      },
      useCaseSensitiveFileNames() {
        return true;
      },
      writeFile() {
        return null;
      }
    };

    relevantProgram = ts.createProgram(
      [FILENAME],
      {
        noResolve: true,
        target: ts.ScriptTarget.Latest,
        jsx: extra.ecmaFeatures.jsx ? ts.JsxEmit.Preserve : undefined
      },
      compilerHost
    );

    ast = relevantProgram.getSourceFile(FILENAME);
  }

  extra.code = code;
  const { estree, astMaps } = convert(ast, extra);
  return {
    estree,
    program: shouldProvideParserServices ? relevantProgram : undefined,
    astMaps: shouldProvideParserServices
      ? astMaps
      : { esTreeNodeToTSNodeMap: undefined, tsNodeToESTreeNodeMap: undefined }
  };
}

//------------------------------------------------------------------------------
// Public
//------------------------------------------------------------------------------

exports.version = require('./package.json').version;

exports.parse = function parse(code, options) {
  const result = generateAST(code, options);
  return {
    ast: result.estree,
    services: {
      program: result.program,
      esTreeNodeToTSNodeMap: result.astMaps.esTreeNodeToTSNodeMap,
      tsNodeToESTreeNodeMap: result.astMaps.tsNodeToESTreeNodeMap
    }
  };
};

exports.AST_NODE_TYPES = astNodeTypes;
