// Pure logic for the policy judge app. No DOM here, so Node tests can load it.
// The code lives in logic/, one file per job. This file joins the parts into the one API the page (window.PolicyLogic),
// the local helper and the tests use. In the page, index.html loads the parts in this order: logic/caps.js (in <head>), the format
// files (formats/*.js), logic/format.js, logic/round.js,
// logic/audio.js, logic/flow.js, logic/files.js, logic/rules.js, logic/decide.js, logic/prompts.js, logic/shell.js, logic/account.js, then this file.
// In Node, require('./logic.js') loads the parts itself. A part only uses parts that load before it.
(function (root) {
  'use strict';
  const part = (name) => (typeof module !== 'undefined' && module.exports ? require('./logic/' + name + '.js') : root.PolicyLogicParts[name]);
  const { FORMAT_FILES, FORMAT_IDS, DEFAULT_FORMAT_ID, OLD_ROUND, getFormat, formatOf, formatKnown, formatFields,
    formatFromSearch, speechOf, columnOf, speakerOf, speakersOn, speakerTag, speakerName, prepClocks, fullPrep } = part('format');
  const { SPEECHES, FLOW_COLUMNS, DEFAULT_FLOWS, sheetLabel, SHEET_PAGES, sheetPage, DEFAULT_PREP_SECONDS, SPEAKERS,
    PARADIGMS, BALLOT_HEADER, LOG_COLUMNS, formatClock, sheetSafe, csvCell, toCSV, toTSV, ballotRow, checkBallot,
    parseDecision, parseRfd, PARADIGM_LABELS, paradigmText, hashText, lensKey, MAP_SPEECHES, BALLOT_FIELDS,
    speechesSoFar, DEFAULT_PTS_RANGE, ptsRange, rangeError, ballotFields } = part('round');
  const { TRANSCRIBE_HINT, buildTranscribePrompt, appendChunk, AUDIO_MODES, micConstraints, levelInfo,
    micTestVerdict, stallWarning, recStatus, REC_PROBLEM_WORD, encodeWav, rms, mergeOverlap } = part('audio');
  const { speechColumn, FLOW_LEVELS, partText, aiFlowCell, flowCellText, editIsBehind, mergeMap, applyLiveFlow,
    FLOW_MARK_KINDS, flowMarkTokens, flowMarkHtml, flowLinesChanged } = part('flow');
  const { buildBackup, parseBackup, backupSummary, DOC_SIDES, DOC_NOTE, DOC_FLOW_NOTE, docSpeech, docsForSpeech,
    parseSpeechDropCode, speechDropFiles, guessSpeech, speechSide, anonymize, deanonymize, isRoundEmpty,
    buildRoundFile, parseRoundFile, roundFileName, docTitle, buildDocBlocks, buildUserContent } = part('files');
  const { OVER_LIMIT, restoreRun, restorePrep, restoreClocks, beepDecision, storageErrorKind, clockUnitIsNewer,
    shortSpeech, viewingLabel, toastMs, leftPaneMode, needsRecNotice, recStripState, beepedElsewhere, NO_AI,
    hasHostedPlan, shouldShowWelcome, classifyAIError, AI_ERROR_TEXT, aiErrorText, AI_ERROR_PREFIX, removeAt,
    restoreAt, askInputState, resolveRememberKeys, splitRestoreKeys, restoreKeysLine, restoreTabKeys,
    undoSheetDelete, autoEvalDefault, liveFlowDefault, d2Reset, needsD2Note, escTop, toastPlan, TOAST_MAX,
    askFirstFocus, trapNext, insightsMode, resolveTheme, TIP_DELAY_MS, SHEET_TIP_DELAY_MS, tipDelay, tipPlace,
    flowMarks, tipAddsWords, pressStep, ESC_FOCUS_QUIET_MS, tipOnFocus } = part('rules');
  const { PTS_FIELDS, DRAFT_GROUPS, ptsFields, draftGroups, fieldLabel, fieldValue, fieldState, markFields, ballotSnapshot, roundHasContent, insightsReady,
    draftPanelState, feedbackLines, outOfRangePoints, draftValue, wordDiff, reviewFromDraft, staleReviewCards,
    reviewInsertFields, applyReview, autoRefillPlan, speechEndedSince, ranksSet, moveRank, stepPoints,
    savedBallotEntry, savedBallotRow, savedBallotView, decisionText, tournamentBlocks, printModel, prepUsed,
    keyMoments, issueTally, andList, outOfDateText, runVerb, readingFor, decideTab } = part('decide');
  const { JUDGE_SYSTEM, POINTS_GUIDE, parseFeedback, buildJudgePrompt, ANALYSIS_SYSTEM, MAP_SCHEMA, MAP_TASK,
    IMPACT_SCHEMA, IMPACT_TASK, LENS_SCHEMA, LENS_TASK, buildAnalysisPrompt, buildMermaid, layoutMap, READING_LEVELS,
    readingGuide, BALLOT_SCHEMA, BALLOT_TASK, buildBallotPrompt, applyBallotDraft, nextSpeech, EVAL_SYSTEM,
    EVAL_SCHEMA, buildEvalPrompt, LIVE_FLOW_SCHEMA, LIVE_FLOW_SYSTEM, buildLiveFlowPrompt, promptsFor } = part('prompts');
  const { chipText, chipTip, CHIP_NAME_MS, chipNameDue, NET_TIP, netNote, speechLine, clockStatus, prepPausesLine,
    stepSpeechState, studyOn, studyMark, studyResult } = part('shell');
  const { FEATURE_KEYS, APP_FEATURES, STORE_KEYS, capsRequest, parseCaps, capsOutcome, gateFor, canUse, payerOf, setupAllowed,
    showSetupFor, offTokens, visibleTourSteps, keyNoticeDue, KEY_NOTICE } = part('caps');
  const { PROFILE_URL, MAX_PARADIGM, parseProfile, profileOutcome, profileGet, profilePut, cleanParadigm, paradigmError,
    activeParadigm, shouldOfferParadigmCopy, judgingOptions, judgingFor, judgingLocked, hostedAiBody } = part('account');

  const api = {
    SPEECHES, FLOW_COLUMNS, DEFAULT_FLOWS, sheetLabel, SHEET_PAGES, sheetPage, DEFAULT_PREP_SECONDS, SPEAKERS, PARADIGMS,
    BALLOT_HEADER, JUDGE_SYSTEM, POINTS_GUIDE,
    LOG_COLUMNS,
    formatClock, sheetSafe, csvCell, toCSV, toTSV, ballotRow, checkBallot, parseDecision, parseRfd, parseFeedback, buildJudgePrompt,
    TRANSCRIBE_HINT, buildTranscribePrompt, appendChunk, AUDIO_MODES, micConstraints, levelInfo, micTestVerdict, stallWarning, recStatus, REC_PROBLEM_WORD, encodeWav, rms, mergeOverlap,
    PARADIGM_LABELS, paradigmText, hashText, lensKey,
    ANALYSIS_SYSTEM, MAP_SPEECHES, MAP_SCHEMA, MAP_TASK, IMPACT_SCHEMA, IMPACT_TASK, LENS_SCHEMA, LENS_TASK, buildAnalysisPrompt, buildMermaid, layoutMap,
    buildBackup, parseBackup, backupSummary,
    READING_LEVELS, readingGuide, BALLOT_SCHEMA, BALLOT_TASK, BALLOT_FIELDS, buildBallotPrompt, applyBallotDraft,
    speechesSoFar, nextSpeech, EVAL_SYSTEM, EVAL_SCHEMA, buildEvalPrompt,
    DOC_SIDES, DOC_NOTE, DOC_FLOW_NOTE, docSpeech, docsForSpeech, parseSpeechDropCode, speechDropFiles, guessSpeech, speechSide, anonymize, deanonymize, isRoundEmpty, buildRoundFile, parseRoundFile, roundFileName, docTitle, buildDocBlocks, buildUserContent,
    speechColumn, FLOW_LEVELS, partText, aiFlowCell, flowCellText, editIsBehind, mergeMap, applyLiveFlow, LIVE_FLOW_SCHEMA, LIVE_FLOW_SYSTEM, buildLiveFlowPrompt,
    // Slice 1: round safety
    OVER_LIMIT, restoreRun, restorePrep, restoreClocks, beepDecision, storageErrorKind, clockUnitIsNewer, shortSpeech, viewingLabel, toastMs, leftPaneMode, needsRecNotice, recStripState, beepedElsewhere,
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
    speechEndedSince, ranksSet, moveRank, stepPoints, savedBallotEntry, savedBallotRow, savedBallotView, decisionText, tournamentBlocks, printModel,
    prepUsed, keyMoments, issueTally, andList, outOfDateText, runVerb, readingFor, decideTab,
    // Slice 4, Option B (Q-8): flow mark shading
    FLOW_MARK_KINDS, flowMarkTokens, flowMarkHtml, flowLinesChanged,
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
    speechOf, columnOf, speakerOf, speakersOn, speakerTag, speakerName, prepClocks, fullPrep, ballotFields, ptsFields,
    draftGroups, promptsFor,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PolicyLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
