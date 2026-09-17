"use strict";

/**
 * Oxlint jsPlugins: Style — project lint rules (imports, destructuring, JSX).
 */

const patternSpansMultipleLines = node => {
  if (node == null || node.loc == null) {
    return false;
  }

  return node.loc.start.line !== node.loc.end.line;
};

const isDestructuringPattern = node => {
  return node.type === "ObjectPattern" || node.type === "ArrayPattern";
};

const reportMultilineDestructuring = (context, patternNode) => {
  if (!isDestructuringPattern(patternNode)) {
    return;
  }

  // TypeScript `({ a }: Props) =>` / `const { a }: Type = x` — the annotation spans
  // extra lines; enforcing "single-line pattern" there fights normal TS style (e.g. shadcn).
  if (patternNode.typeAnnotation != null) {
    return;
  }

  if (!patternSpansMultipleLines(patternNode)) {
    return;
  }

  context.report({ node: patternNode, messageId: "multilineDestructuring" });
};

const checkParam = (context, param) => {
  if (param.type === "AssignmentPattern") {
    reportMultilineDestructuring(context, param.left);

    return;
  }

  reportMultilineDestructuring(context, param);
};

const checkFunctionParams = (context, node) => {
  for (const param of node.params) {
    checkParam(context, param);
  }
};

const isInsideJsx = node => {
  for (let current = node.parent; current != null; current = current.parent) {
    if (current.type === "JSXExpressionContainer") {
      return true;
    }
  }

  return false;
};

const isExemptFunctionExpression = node => {
  if (node.generator) {
    return true;
  }

  const parent = node.parent;

  if (parent == null) {
    return false;
  }

  if (parent.type === "MethodDefinition" || parent.type === "Property") {
    return (
      parent.kind === "constructor" ||
      parent.kind === "get" ||
      parent.kind === "set"
    );
  }

  return false;
};

module.exports = {
  meta: { name: "style", version: "2.0.0" },
  rules: {
    "no-multiline-import": {
      meta: {
        type: "layout",
        docs: {
          description:
            "Disallow import declarations that span multiple lines; keep one import per line or split into separate import statements."
        },
        schema: [],
        messages: {
          multiline:
            "Import must be a single line. Either put the whole import on one line or split into multiple import statements from the same module."
        }
      },
      create: context => {
        return {
          ImportDeclaration: node => {
            const start = node.loc?.start?.line;
            const end = node.loc?.end?.line;

            if (start == null || end == null) {
              return;
            }

            if (start === end) {
              return;
            }

            context.report({ node, messageId: "multiline" });
          }
        };
      }
    },
    "no-multiline-destructuring": {
      meta: {
        type: "layout",
        docs: {
          description:
            "Disallow object/array destructuring patterns that span multiple lines; use one line or several separate destructuring assignments. Patterns with a TypeScript type annotation (e.g. `({ a }: Props) =>`) are skipped so param typing stays idiomatic."
        },
        schema: [],
        messages: {
          multilineDestructuring:
            "Destructuring pattern must be a single line. Either put the whole pattern on one line or split into multiple destructuring statements."
        }
      },
      create: context => {
        return {
          VariableDeclarator: node => {
            reportMultilineDestructuring(context, node.id);
          },
          AssignmentExpression: node => {
            if (node.operator !== "=") {
              return;
            }

            reportMultilineDestructuring(context, node.left);
          },
          FunctionDeclaration: node => {
            checkFunctionParams(context, node);
          },
          FunctionExpression: node => {
            checkFunctionParams(context, node);
          },
          ArrowFunctionExpression: node => {
            checkFunctionParams(context, node);
          },
          CatchClause: node => {
            if (node.param) {
              checkParam(context, node.param);
            }
          },
          ForInStatement: node => {
            if (node.left.type === "VariableDeclaration") {
              return;
            }

            reportMultilineDestructuring(context, node.left);
          },
          ForOfStatement: node => {
            if (node.left.type === "VariableDeclaration") {
              return;
            }

            reportMultilineDestructuring(context, node.left);
          }
        };
      }
    },
    "no-multiline-ternary": {
      meta: {
        type: "layout",
        docs: {
          description:
            "Disallow ternary expressions that span multiple lines; use if/else when a conditional needs more than one line."
        },
        schema: [],
        messages: {
          multilineTernary:
            "Ternary expression must be a single line. Use if/else when the conditional needs multiple lines."
        }
      },
      create: context => {
        return {
          ConditionalExpression: node => {
            if (isInsideJsx(node)) {
              return;
            }

            const start = node.loc?.start?.line;
            const end = node.loc?.end?.line;

            if (start == null || end == null) {
              return;
            }

            if (start === end) {
              return;
            }

            context.report({ node, messageId: "multilineTernary" });
          }
        };
      }
    },
    "no-logical-and-in-jsx": {
      meta: {
        type: "suggestion",
        docs: {
          description:
            "Disallow && in JSX expression containers (except patterns allowed in JSX attributes)."
        },
        schema: [],
        messages: {
          restrictedSyntax: "{{message}}"
        }
      },
      create: context => {
        const selector =
          "JSXExpressionContainer > LogicalExpression[operator='&&']:not(JSXAttribute > JSXExpressionContainer > LogicalExpression[operator='&&'])";
        const message =
          "The && operator is not allowed in JSX. Use explicit conditionals instead.";

        return {
          [selector]: node => {
            context.report({
              node,
              messageId: "restrictedSyntax",
              data: { message }
            });
          }
        };
      }
    },
    "prefer-arrow-functions": {
      meta: {
        type: "suggestion",
        docs: {
          description:
            "Require arrow functions instead of function declarations, function expressions, and method shorthand. Class constructors, getters, setters and generators are exempt."
        },
        schema: [],
        messages: {
          preferArrow:
            "Use an arrow function instead of a function declaration or function expression."
        }
      },
      create: context => {
        return {
          FunctionDeclaration: node => {
            if (node.generator) {
              return;
            }

            context.report({ node, messageId: "preferArrow" });
          },
          FunctionExpression: node => {
            if (isExemptFunctionExpression(node)) {
              return;
            }

            context.report({ node, messageId: "preferArrow" });
          }
        };
      }
    }
  }
};

module.exports.rules["blank-lines"] = {
  meta: {
    type: "layout",
    fixable: "whitespace",
    schema: [],
    messages: { spacing: "Leave a blank line between logical blocks." }
  },
  create: context => {
    const source = context.sourceCode;

    const category = statement => {
      const node = statement.declaration || statement;

      if (node.type === "VariableDeclaration") {
        const value = node.declarations[0]?.init;

        if (
          value?.type === "ArrowFunctionExpression" ||
          value?.type === "FunctionExpression"
        ) {
          return "function";
        }

        return "variable";
      }

      if (node.type === "ImportDeclaration") {
        return "import";
      }

      if (node.type === "FunctionDeclaration") {
        return "function";
      }

      if (node.type === "ReturnStatement") {
        return "return";
      }

      if (
        [
          "IfStatement",
          "TryStatement",
          "ForOfStatement",
          "ForStatement",
          "WhileStatement",
          "SwitchStatement"
        ].includes(node.type)
      ) {
        return "control";
      }

      return "statement";
    };

    const check = node => {
      for (let index = 1; index < node.body.length; index++) {
        const previous = node.body[index - 1];
        const current = node.body[index];
        const before = category(previous);
        const after = category(current);

        if (before === "import" && after === "import") {
          continue;
        }

        const boundary =
          before !== after || before === "function" || before === "control";

        if (!boundary) {
          continue;
        }

        const between = source.text.slice(previous.range[1], current.range[0]);

        if (/\n[\t ]*\n/.test(between)) {
          continue;
        }

        context.report({
          node: current,
          messageId: "spacing",
          fix: fixer => {
            return fixer.insertTextAfter(previous, "\n");
          }
        });
      }
    };

    return { Program: check, BlockStatement: check };
  }
};
