// Pure logic for the policy judge app. No DOM here, so Node tests can load it.
// The code lives in logic/, one file per job. This file joins the parts into the one API the page (window.PolicyLogic),
// the local helper and the tests use. In the page, index.html loads the parts in this order: logic/caps.js (in <head>), the format
// files (formats/*.js), logic/format.js, logic/round.js,
// logic/audio.js, logic/flow.js, logic/files.js, logic/pairing.js, logic/rules.js, logic/decide.js, logic/prompts.js, logic/shell.js, logic/account.js, logic/flags.js,
// logic/limits.js, logic/hosted.js, logic/demo.js, then this file.
// In Node, require('./logic.js') loads the parts itself. A part only uses parts that load before it.
(function (root) {
  'use strict';
  const part = (name) => (typeof module !== 'undefined' && module.exports ? require('./logic/' + name + '.js') : root.PolicyLogicParts[name]);
  const { FORMAT_FILES, FORMAT_IDS, DEFAULT_FORMAT_ID, OLD_ROUND, getFormat, formatOf, formatKnown, formatFields,
    formatFromSearch, speechOf, columnOf, speakerOf, speechSpeakers, sideLabel, isCoinFlip, speakersOn, speakerTag, speakerName,
    prepClocks, fullPrep, formatCopy } = part('format');
  const { SPEECHES, FLOW_COLUMNS, DEFAULT_FLOWS, sheetLabel, SHEET_PAGES, sheetPage, DEFAULT_PREP_SECONDS, SPEAKERS,
    PARADIGMS, BALLOT_HEADER, LOG_COLUMNS, formatClock, sheetSafe, csvCell, toCSV, toTSV, ballotRow, checkBallot,
    parseDecision, parseRfd, PARADIGM_LABELS, paradigmText, hashText, lensKey, MAP_SPEECHES, BALLOT_FIELDS,
    speechesSoFar, DEFAULT_PTS_RANGE, ptsRange, rangeError, ballotFields } = part('round');
  const { TRANSCRIBE_HINT, buildTranscribePrompt, isHintEcho, appendChunk, AUDIO_MODES, micConstraints, levelInfo,
    micTestVerdict, stallWarning, recStatus, REC_PROBLEM_WORD, encodeWav, rms, mergeOverlap } = part('audio');
  const { speechColumn, FLOW_LEVELS, partText, aiFlowCell, flowCellText, editIsBehind, mergeMap, applyLiveFlow,
    FLOW_MARK_KINDS, flowMarkTokens, flowMarkHtml, flowLinesChanged, AI_FLOW_EMPTY, emptyFlowHtml } = part('flow');
  const { buildBackup, parseBackup, backupSummary, DOC_SIDES, DOC_NOTE, DOC_FLOW_NOTE, docSpeech, docsForSpeech,
    parseSpeechDropCode, speechDropFiles, guessSpeech, speechSide, anonymize, deanonymize, isRoundEmpty, orderInUse,
    buildRoundFile, parseRoundFile, roundFileName, docTitle, buildDocBlocks, buildUserContent } = part('files');
  const { parseRoundPaste, roundPasteChanges, swapSides } = part('pairing');
  const { FLAGS, FLAG_GROUP, flagOn } = part('flags');
  const { OVER_LIMIT, leftAt, restoreRun, restorePrep, restoreClocks, beepDecision, storageErrorKind, clockUnitIsNewer,
    shortSpeech, viewingLabel, toastMs, leftPaneMode, needsRecNotice, recStripState, beepedElsewhere, NO_AI,
    shouldShowWelcome, classifyAIError, AI_ERROR_TEXT, aiErrorText, AI_ERROR_PREFIX, removeAt,
    restoreAt, askInputState, resolveRememberKeys, splitRestoreKeys, restoreKeysLine, restoreTabKeys,
    undoSheetDelete, autoEvalDefault, liveFlowDefault, d2Reset, needsD2Note, escTop, toastPlan, TOAST_MAX,
    askFirstFocus, trapNext, insightsMode, resolveTheme, TIP_DELAY_MS, SHEET_TIP_DELAY_MS, tipDelay, tipPlace,
    flowMarks, tipAddsWords, pressStep, ESC_FOCUS_QUIET_MS, tipOnFocus } = part('rules');
  const { PTS_FIELDS, DRAFT_GROUPS, ptsFields, draftGroups, fieldLabel, fieldValue, fieldState, markFields, ballotSnapshot, roundHasContent, insightsReady,
    draftPanelState, feedbackLines, outOfRangePoints, draftValue, wordDiff, reviewFromDraft, staleReviewCards,
    reviewInsertFields, applyReview, autoRefillPlan, speechEndedSince, ranksSet, moveRank, stepPoints,
    savedBallotEntry, savedBallotRow, savedBallotView, historyTable, historyColumns, decisionText, tournamentBlocks, printModel, printSheet, prepUsed,
    keyMoments, issueTally, andList, outOfDateText, runVerb, readingFor, decideTab } = part('decide');
  const { JUDGE_SYSTEM, POINTS_GUIDE, parseFeedback, buildJudgePrompt, ANALYSIS_SYSTEM, MAP_SCHEMA, MAP_TASK,
    IMPACT_SCHEMA, IMPACT_TASK, LENS_SCHEMA, LENS_TASK, buildAnalysisPrompt, buildMermaid, layoutMap, READING_LEVELS,
    readingLevels, readingGuide, BALLOT_SCHEMA, BALLOT_TASK, buildBallotPrompt, applyBallotDraft, nextSpeech, EVAL_SYSTEM,
    EVAL_SCHEMA, buildEvalPrompt, LIVE_FLOW_SCHEMA, LIVE_FLOW_SYSTEM, buildLiveFlowPrompt, promptsFor, NARROW_TOOL } = part('prompts');
  const { chipText, chipTip, CHIP_NAME_MS, chipNameDue, NET_TIP, netNote, speechLine, clockStatus, prepPausesLine,
    stepSpeechState, studyOn, studyMark, studyResult } = part('shell');
  const { FEATURE_KEYS, APP_FEATURES, STORE_KEYS, capsRequest, parseCaps, capsOutcome, gateFor, canUse, payerOf, setupAllowed,
    showSetupFor, offTokens, visibleTourSteps, keyNoticeDue, KEY_NOTICE } = part('caps');
  const { PROFILE_URL, MAX_PARADIGM, parseProfile, profileOutcome, profileGet, profilePut, cleanParadigm, paradigmError,
    activeParadigm, shouldOfferParadigmCopy, judgingOptions, judgingFor, judgingLocked, hostedAiBody } = part('account');
  const { limitsRequest, parseRound, parseLimits, limitsLines, roundLine, roundBlocks, resumedRound, roundAfterRefusal,
    roundMode, consentStep, consentAsk, roundsLeftText, consentLine } = part('limits');
  const { BUY_URL, accountUrl, plansUrl, HOSTED_TASKS, HOSTED_TEXT, hostedOn, useHosted, hostedAny, selfPays, selfPaidHosted, hasHostedPlan, hostedState, hostedRequest, readSse, sseStep, hostedError } = part('hosted');
  const { DEMO_CTA, demoSample, demoParamFor, demoCtaButtons, demoSeed, demoSteps, demoReply, transcriptChunks, demoTranscript } = part('demo');

  const api = {
    NARROW_TOOL, // the narrow-tool line that every own-key system text carries (AI-POLICY §9)
    SPEECHES, FLOW_COLUMNS, DEFAULT_FLOWS, sheetLabel, SHEET_PAGES, sheetPage, DEFAULT_PREP_SECONDS, SPEAKERS, PARADIGMS,
    BALLOT_HEADER, JUDGE_SYSTEM, POINTS_GUIDE,
    LOG_COLUMNS,
    formatClock, sheetSafe, csvCell, toCSV, toTSV, ballotRow, checkBallot, parseDecision, parseRfd, parseFeedback, buildJudgePrompt,
    TRANSCRIBE_HINT, buildTranscribePrompt, isHintEcho, appendChunk, AUDIO_MODES, micConstraints, levelInfo, micTestVerdict, stallWarning, recStatus, REC_PROBLEM_WORD, encodeWav, rms, mergeOverlap,
    PARADIGM_LABELS, paradigmText, hashText, lensKey,
    ANALYSIS_SYSTEM, MAP_SPEECHES, MAP_SCHEMA, MAP_TASK, IMPACT_SCHEMA, IMPACT_TASK, LENS_SCHEMA, LENS_TASK, buildAnalysisPrompt, buildMermaid, layoutMap,
    buildBackup, parseBackup, backupSummary,
    READING_LEVELS, readingGuide, BALLOT_SCHEMA, BALLOT_TASK, BALLOT_FIELDS, buildBallotPrompt, applyBallotDraft,
    speechesSoFar, nextSpeech, EVAL_SYSTEM, EVAL_SCHEMA, buildEvalPrompt,
    DOC_SIDES, DOC_NOTE, DOC_FLOW_NOTE, docSpeech, docsForSpeech, parseSpeechDropCode, speechDropFiles, guessSpeech, speechSide, anonymize, deanonymize, isRoundEmpty, orderInUse, buildRoundFile, parseRoundFile, roundFileName, docTitle, buildDocBlocks, buildUserContent,
    speechColumn, FLOW_LEVELS, partText, aiFlowCell, flowCellText, editIsBehind, mergeMap, applyLiveFlow, LIVE_FLOW_SCHEMA, LIVE_FLOW_SYSTEM, buildLiveFlowPrompt,
    // Slice 1: round safety
    OVER_LIMIT, leftAt, restoreRun, restorePrep, restoreClocks, beepDecision, storageErrorKind, clockUnitIsNewer, shortSpeech, viewingLabel, toastMs, leftPaneMode, needsRecNotice, recStripState, beepedElsewhere,
    // Slice 2: copy and dialogs
    NO_AI, hasHostedPlan, shouldShowWelcome, classifyAIError, AI_ERROR_TEXT, aiErrorText, AI_ERROR_PREFIX, removeAt, restoreAt, askInputState,
    resolveRememberKeys, splitRestoreKeys, restoreKeysLine, restoreTabKeys, undoSheetDelete, autoEvalDefault, liveFlowDefault, d2Reset, needsD2Note,
    // Slice 0: shared UI rules
    escTop, toastPlan, TOAST_MAX, askFirstFocus, trapNext,
    // Slice 3: visual system and Flow look
    insightsMode, resolveTheme, TIP_DELAY_MS, SHEET_TIP_DELAY_MS, tipDelay, tipPlace, flowMarks, tipAddsWords, pressStep, ESC_FOCUS_QUIET_MS, tipOnFocus,
    // Slice 4: Decide and ballot
    DEFAULT_PTS_RANGE, ptsRange, rangeError, PTS_FIELDS, DRAFT_GROUPS, fieldLabel, fieldValue, fieldState, markFields, ballotSnapshot,
    roundHasContent, insightsReady, draftPanelState, feedbackLines, outOfRangePoints, draftValue, wordDiff, reviewFromDraft, staleReviewCards, reviewInsertFields, applyReview, autoRefillPlan,
    speechEndedSince, ranksSet, moveRank, stepPoints, savedBallotEntry, savedBallotRow, savedBallotView, historyTable, historyColumns, decisionText, tournamentBlocks, printModel, printSheet,
    prepUsed, keyMoments, issueTally, andList, outOfDateText, runVerb, readingFor, decideTab,
    // Slice 4, Option B (Q-8): flow mark shading
    FLOW_MARK_KINDS, flowMarkTokens, flowMarkHtml, flowLinesChanged, AI_FLOW_EMPTY, emptyFlowHtml,
    // Slice 5: shell and reach
    chipText, chipTip, CHIP_NAME_MS, chipNameDue, NET_TIP, netNote, speechLine, clockStatus, prepPausesLine,
    stepSpeechState, studyOn, studyMark, studyResult,
    // Roles plan step 3: the account paradigm and "Judging for"
    PROFILE_URL, MAX_PARADIGM, parseProfile, profileOutcome, profileGet, profilePut, cleanParadigm, paradigmError,
    activeParadigm, shouldOfferParadigmCopy, judgingOptions, judgingFor, judgingLocked, hostedAiBody,
    // Platform phase 1B: the AI gate
    FEATURE_KEYS, APP_FEATURES, STORE_KEYS, capsRequest, parseCaps, capsOutcome, gateFor, canUse, payerOf, setupAllowed,
    showSetupFor, offTokens, visibleTourSteps, keyNoticeDue, KEY_NOTICE,
    // Formats as data (ARCHITECTURE.md §9): the format files, a round's format, and the format-keyed lists and prompts
    FORMAT_FILES, FORMAT_IDS, DEFAULT_FORMAT_ID, OLD_ROUND, getFormat, formatOf, formatKnown, formatFields, formatFromSearch,
    speechOf, columnOf, speakerOf, speechSpeakers, sideLabel, isCoinFlip, speakersOn, speakerTag, speakerName,
    prepClocks, fullPrep, formatCopy, ballotFields, ptsFields,
    draftGroups, promptsFor, readingLevels,
    // Round import by paste (docs/research/TABROOM.md, Option D)
    parseRoundPaste, roundPasteChanges, swapSides,
    // Feature flags (logic/flags.js)
    FLAGS, FLAG_GROUP, flagOn,
    // Hosted AI calls (tabula-cloud docs/APP-CLIENT-PROPOSAL.md §3) and their round limits (Terms §6.4)
    limitsRequest, parseRound, parseLimits, limitsLines, roundLine, roundBlocks, resumedRound, roundAfterRefusal,
    roundMode, consentStep, consentAsk, roundsLeftText, consentLine,
    BUY_URL, accountUrl, plansUrl, HOSTED_TASKS, HOSTED_TEXT, hostedOn, useHosted, hostedAny, selfPays, selfPaidHosted, hostedState, hostedRequest, readSse, sseStep, hostedError,
    // The staged demo of the AI features (?demo=policy or ?demo=ld; js/demo.js, demo/*.js)
    DEMO_CTA, demoSample, demoParamFor, demoCtaButtons, demoSeed, demoSteps, demoReply, transcriptChunks, demoTranscript,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PolicyLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
