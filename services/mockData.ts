// DEPRECATED - REPLACED BY solanaApi.ts
// Keeping file to prevent build errors if imports linger, but exporting empty functions.

import { Token } from '../types';

export const generateNewToken = (): Token => {
    return {} as Token;
};

export const evolveToken = (token: Token): Token => {
    return token;
};

export const generateMockTokens = (): Token[] => {
    return [];
};