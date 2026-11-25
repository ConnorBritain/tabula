// AI provider layer for Tabula Debate. The provider help, model picks, request building and reply reading are shared
// code in core/ai.js (an ES module: the page runs it before this file; Node requires it). This file adds
// debate's output caps by kind of call and keeps the window.Providers name the page code uses.
(function (root) {
  'use strict';
  const AI = typeof module !== 'undefined' && module.exports ? require('./core/ai.js') : root.TabulaCore.ai;

  // Output cap per kind of call, so one runaway reply cannot bill tens of thousands of tokens.
  // Thinking counts toward the cap. 'flow' is above the plan's 4k because thinking stays on until step B3.
  const OUTPUT_CAP = { flow: 6000, routine: 8000, ballot: 8000, decision: 8000 };
  const outputCap = (kind) => AI.outputCap(kind, OUTPUT_CAP);

  const api = { PROVIDERS: AI.PROVIDERS, SUBSCRIPTIONS: AI.SUBSCRIPTIONS, detectProvider: AI.detectProvider, pickModel: AI.pickModel,
    chatModels: AI.chatModels, isPremium: AI.isPremium, isDeprecated: AI.isDeprecated, cleanSavedModels: AI.cleanSavedModels, outputCap,
    claudeParams: AI.claudeParams, retryOnce404: AI.retryOnce404, modelsRequest: AI.modelsRequest, modelIds: AI.modelIds,
    docsAsText: AI.docsAsText, buildAIRequest: AI.buildAIRequest, parseAIResponse: AI.parseAIResponse, extractJson: AI.extractJson,
    engineOptions: AI.engineOptions };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Providers = api;
})(typeof window !== 'undefined' ? window : globalThis);
