import { tryCatch } from '../../lib/prelude.js';
import { isOperationDefinitionNode } from '../lib/graphql.js';
import { parse } from 'graphql';
import { print } from 'graphql';
/**
 * helpers
 */
const extractOperationName = (document) => {
    let operationName = undefined;
    const defs = document.definitions.filter(isOperationDefinitionNode);
    if (defs.length === 1) {
        operationName = defs[0].name?.value;
    }
    return operationName;
};
const extractIsMutation = (document) => {
    let isMutation = false;
    const defs = document.definitions.filter(isOperationDefinitionNode);
    if (defs.length === 1) {
        /* eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison --
         * graphql@15's `OperationTypeNode` is a type, but graphql@16's `OperationTypeNode` is a native TypeScript enum
         * Therefore, we cannot use `OperationTypeNode.MUTATION` here because it wouldn't work with graphql@15
         **/
        isMutation = defs[0].operation === `mutation`;
    }
    return isMutation;
};
export const analyzeDocument = (document, excludeOperationName) => {
    const expression = typeof document === `string` ? document : print(document);
    let isMutation = false;
    let operationName = undefined;
    if (excludeOperationName) {
        return { expression, isMutation, operationName };
    }
    const docNode = tryCatch(() => (typeof document === `string` ? parse(document) : document));
    if (docNode instanceof Error) {
        return { expression, isMutation, operationName };
    }
    operationName = extractOperationName(docNode);
    isMutation = extractIsMutation(docNode);
    return { expression, operationName, isMutation };
};
//# sourceMappingURL=analyzeDocument.js.map