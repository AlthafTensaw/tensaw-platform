/**
 * no-raw-phi — denial-tool ESLint rule.
 *
 * PR-8: exports as proper ESLint plugin shape:
 *   module.exports = { rules: { 'no-raw-phi': { meta, create } } }
 * so plugin loader finds it under `plugin.rules['no-raw-phi']`.
 */
'use strict';

const PHI_FIELDS = [
  'patient_name',
  'mrn',
  'reason_text',
  'subscriber_id',
  'member_id',
  'subscriber_name',
];

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: "Disallow rendering raw PHI fields without <PrivacyField> wrapper.",
    },
    schema: [],
    messages: {
      rawPhi: 'PHI field "{{field}}" must be wrapped in <PrivacyField value={...}>.',
    },
  },
  create(context) {
    let privacyFieldAttrDepth = 0;
    return {
      'JSXAttribute[name.name="value"]'(node) {
        const parent = node.parent;
        if (parent && parent.type === 'JSXOpeningElement' &&
            parent.name && parent.name.type === 'JSXIdentifier' &&
            parent.name.name === 'PrivacyField') {
          privacyFieldAttrDepth += 1;
        }
      },
      'JSXAttribute[name.name="value"]:exit'(node) {
        const parent = node.parent;
        if (parent && parent.type === 'JSXOpeningElement' &&
            parent.name && parent.name.type === 'JSXIdentifier' &&
            parent.name.name === 'PrivacyField') {
          privacyFieldAttrDepth -= 1;
        }
      },
      MemberExpression(node) {
        if (privacyFieldAttrDepth > 0) return;
        if (node.property && node.property.type === 'Identifier' &&
            PHI_FIELDS.includes(node.property.name)) {
          let p = node.parent;
          let inJsx = false;
          while (p) {
            if (p.type === 'JSXExpressionContainer' || p.type === 'JSXElement') {
              inJsx = true;
              break;
            }
            p = p.parent;
          }
          if (inJsx) {
            context.report({
              node,
              messageId: 'rawPhi',
              data: { field: node.property.name },
            });
          }
        }
      },
    };
  },
};

module.exports = {
  rules: {
    'no-raw-phi': rule,
  },
};
