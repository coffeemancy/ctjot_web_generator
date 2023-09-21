/*
 * This file contains the javascript functions for working with
 * the game options, including preset and validation functions.
 */

/*
 * Parse content from json-script data into object.
 */
function getJsonScriptData(jsonScript) {
  return JSON.parse(document.getElementById(jsonScript).textContent);
}
const enumsMap = getJsonScriptData('enums-map');
const forcedFlagsMap = getJsonScriptData('forced-flags-map');
const invEnumsMap = getJsonScriptData('inv-enums-map');
const obhintMap = getJsonScriptData('obhint-map');
const presetsMap = getJsonScriptData('presets-map');
const settingsDefaults = getJsonScriptData('settings-defaults');

const charIdentities = ['Crono', 'Marle', 'Lucca', 'Robo', 'Frog', 'Ayla', 'Magus'];
const charModels = ['0', '1', '2', '3', '4', '5', '6'];

/* Mystery Settings sliders mapping of DOM id to MysterySettings field and key */
const mysterySliders = {
  // game modes
  'mystery_game_mode_standard': ['game_mode_freqs', 'Standard'],
  'mystery_game_mode_lw': ['game_mode_freqs', 'Lost worlds'],
  'mystery_game_mode_loc': ['game_mode_freqs', 'Legacy of cyrus'],
  'mystery_game_mode_ia': ['game_mode_freqs', 'Ice age'],
  'mystery_game_mode_vr': ['game_mode_freqs', 'Vanilla rando'],
  // item difficulty
  'mystery_item_difficulty_easy': ['item_difficulty_freqs', 'Easy'],
  'mystery_item_difficulty_normal': ['item_difficulty_freqs', 'Normal'],
  'mystery_item_difficulty_hard': ['item_difficulty_freqs', 'Hard'],
  // enemy difficulty
  'mystery_enemy_difficulty_normal': ['enemy_difficulty_freqs', 'Normal'],
  'mystery_enemy_difficulty_hard': ['enemy_difficulty_freqs', 'Hard'],
  // tech order
  'mystery_tech_order_normal': ['tech_order_freqs', 'Normal'],
  'mystery_tech_order_full_random': ['tech_order_freqs', 'Full random'],
  'mystery_tech_order_balanced_random': ['tech_order_freqs', 'Balanced random'],
  // shop prices
  'mystery_shop_prices_normal': ['shop_price_freqs', 'Normal'],
  'mystery_shop_prices_random': ['shop_price_freqs', 'Fully random'],
  'mystery_shop_prices_mostly_random': ['shop_price_freqs', 'Mostly random'],
  'mystery_shop_prices_free': ['shop_price_freqs', 'Free']
}

/* Mystery Settings flags sliders mapping of DOM id to MysterySettings key (in flag_prob_dict field) */
const mysteryFlagSliders = {
  'mystery_tab_treasures': 'tab_treasures',
  'mystery_unlock_magic': 'unlocked_magic',
  'mystery_bucket_list': 'bucket_list',
  'mystery_chronosanity': 'chronosanity',
  'mystery_boss_rando': 'boss_rando',
  'mystery_boss_scale': 'boss_scaling',
  'mystery_locked_characters': 'locked_chars',
  'mystery_char_rando': 'char_rando',
  'mystery_duplicate_characters': 'duplicate_characters',
  'mystery_epoch_fail': 'epoch_fail',
  'mystery_gear_rando': 'gear_rando',
  'mystery_heal_rando': 'healing_item_rando'
}

/* last loaded preset, just for console debugging */
var lastPreset = {};

/*
 * Creates a slider with linked text.
 * Slider element will update text when slider is moved, and update slider when text is entered.
 * Adds optional suffix to text.
 */
function createSlider(id, suffix='') {
  let slider = document.getElementById('id_' + id);
  let text = document.getElementById('id_' + id + '_text');
  text.value = slider.value.toString() + suffix;

  const updateText = () => text.value = slider.value.toString() + suffix;
  ['change', 'input'].forEach((ev) => slider.addEventListener(ev, updateText));

  const updateSlider = () => slider.value = text.value.toString().replace(suffix, '');
  ['change', 'input'].forEach((ev) => text.addEventListener(ev, updateSlider));

  return [slider, text];
}

/*
 * Creates a pair of "min" and "max" sliders with linked text.
 * Slider element will update text when slider is moved, and update slider when text is entered.
 * If min slider value goes above max slider, max slider gets increased.
 * If max slider value goes below min slider, min slider gets decreased.
 */

function createMinMaxSlidersPair(id_min, id_max, suffix='') {
  let [minSlider, minText] = createSlider(id_min, suffix);
  let [maxSlider, maxText] = createSlider(id_max, suffix);

  // decrease min value if max value goes below it
  const adjustMin = (() => {
    if (maxSlider.value < minSlider.value) {
      minSlider.value = maxSlider.value;
      minText.value = maxText.value;
    }
  });

  // increase max value if min value goes above it
  const adjustMax = (() => {
    if (minSlider.value > maxSlider.value) {
      maxSlider.value = minSlider.value;
      maxText.value = minText.value;
    }
  });

  ['change', 'input'].forEach((ev) => minSlider.addEventListener(ev, adjustMax));
  ['change', 'input'].forEach((ev) => minText.addEventListener(ev, adjustMax));
  ['change', 'input'].forEach((ev) => maxSlider.addEventListener(ev, adjustMin));
  ['change', 'input'].forEach((ev) => maxText.addEventListener(ev, adjustMin));

  return [[minSlider, minText], [maxSlider, maxText]];
}

function createBucketSliders() {
  let [
    [reqObjsSlider, reqObjsText],
    [numObjsSlider, numObjsText]
  ] = createMinMaxSlidersPair('bucket_num_objs_req', 'bucket_num_objs');

  const adjustObjectiveEntries = (() => {
    [...Array(8).keys()].forEach((index) => {
      let id = 'id_obhint_entry' + (index + 1);
      document.getElementById(id).disabled = (index > numObjsSlider.value - 1);
    });
  });

  ['change', 'input'].forEach((ev) => reqObjsSlider.addEventListener(ev, adjustObjectiveEntries));
  ['change', 'input'].forEach((ev) => reqObjsText.addEventListener(ev, adjustObjectiveEntries));
  ['change', 'input'].forEach((ev) => numObjsSlider.addEventListener(ev, adjustObjectiveEntries));
  ['change', 'input'].forEach((ev) => numObjsText.addEventListener(ev, adjustObjectiveEntries));

  return [[reqObjsSlider, reqObjsText], [numObjsSlider, numObjsText]];
}

/*
 * Set slider and linked text to value.
 */
function setSlider(id, value, suffix='') {
  let slider = document.getElementById('id_' + id);
  let text = document.getElementById('id_' + id + '_text');
  slider.value = value;
  text.value = value.toString() + suffix;
}

/*
 * Intended-to-be-idempotent (re-)initialization of page state.
 */
function initAll() {
  let options = ['char_rando', 'boss_rando', 'mystery_seed', 'bucket_list'];
  options.forEach((option) => toggleOptions(option));
  restrictFlags();
  disableDuplicateTechs();
  $('#id_disable_glitches').prop('checked', true).change();
  $('#id_fast_tabs').prop('checked', true).change();
}

/*
 * Initialize some UI settings when page (re-)loaded.
 */
function initOnce() {
  // only add listeners once, on page load; don't add again when resetAll called
  Object.entries(mysterySliders).forEach(([id, _]) => createSlider(id));
  Object.entries(mysteryFlagSliders).forEach(([id, _]) => createSlider(id, '%'));
  ['power', 'magic', 'speed'].forEach((tab) => createMinMaxSlidersPair(tab + '_tab_min', tab + '_tab_max'));
  createBucketSliders();

  // preform intended-to-be-idempotent (re-)initialization
  initAll();
}
$(document).ready(initOnce);

/*
 * Apply preset values to all form inputs.
 */
function applyPreset(preset) {
  // metadata
  let metadata = "";
  if (preset.metadata) {
    if (preset.metadata.desc) { metadata += "<p>" + preset.metadata.desc + "</p>"; }
    else { metadata += "<p>" + preset.metadata.name + "</p>"; }
  }
  document.getElementById('id_preset_metadata').innerHTML = metadata;

  // General options
  const gameOption = ((key) => {
    let missing = invEnumsMap[key][settingsDefaults[key]];
    if(!preset.settings[key]) { return missing; }
    return invEnumsMap[key][preset.settings[key]];
  });
  $('#id_game_mode').val(gameOption('game_mode')).change();
  $('#id_enemy_difficulty').val(gameOption('enemy_difficulty')).change();
  $('#id_item_difficulty').val(gameOption('item_difficulty')).change();
  $('#id_tech_rando').val(gameOption('techorder')).change();
  $('#id_shop_prices').val(gameOption('shopprices')).change();

  // Flags
  const hasFlag = ((flag) => {
    let missing = settingsDefaults.gameflags.includes(flag);
    if(!preset.settings.gameflags) { return missing; }
    return preset.settings.gameflags.includes(flag);
  });
  Object.entries(enumsMap.gameflags).forEach(([id, flag]) => {
    $('#id_' + id).prop('checked', hasFlag(flag)).change();
  });

  $('#id_lost_worlds').prop('checked', false).change();
  $('#id_spoiler_log').prop('checked', true).change();

  // Tabs options
  const tabSetting = ((key) => {
    let missing = settingsDefaults.tab_settings[key];
    if(!preset.settings.tab_settings) { return missing; }
    return preset.settings.tab_settings[key] ?? missing;
  });

  ['power', 'magic', 'speed'].forEach((tab) => {
    setSlider(tab + '_tab_max', tabSetting(tab + '_max'));
    setSlider(tab + '_tab_min', tabSetting(tab + '_min'));
  });
  // TODO: missing tab scheme, binom_success

  // Character Rando options
  if (!hasFlag('GameFlags.DUPLICATE_CHARS')) {
    $('#id_duplicate_duals').prop('checked', false).change();
    $('#id_duplicate_duals').addClass('disabled');
    $('#id_duplicate_duals').prop('disabled', true).change();
  }

  // check character choice boxes based on preset
  if(preset.settings.char_settings && preset.settings.char_settings.choices) {
    char_choices = preset.settings.char_settings.choices;
    rcUncheckAll();
    char_choices.forEach((choices, pc_index) => {
      let models = [];

      // choices is string, coerce to list
      if (Object.prototype.toString.call(choices) === "[object String]") {
        let splits = choices.split(" ");
        if(splits[0] == "any") { models = charModels }
        else {
          let modelChoices = splits.map((choice) => {
            return charIdentities.findIndex((identity) => identity.toLowerCase() == choice.toLowerCase());
          }).filter((index) => index > -1).map((index) => charModels[index]);

          if (splits[0] == "not") { models = charModels.filter((model) => !modelChoices.includes(model)) }
          else { models = modelChoices }
        }
      } else { models = choices }

      let identity = charIdentities[pc_index];
      models.forEach((model) => $('#rc_' + identity + model).prop('checked', true));
    });

    // make character assignments matrix visible if the preset had some
    $('#character_selection_matrix').collapse('show');
  } else {
    rcCheckAll();
  }

  // Boss Rando options
  $('#id_legacy_boss_placement').prop('checked', false).change();

  // Mystery Seed options
  const mysterySetting = ((field, key) => {
    let missing = settingsDefaults.mystery_settings[field][key];
    if(!preset.settings.mystery_settings) { return missing; }
    if(!preset.settings.mystery_settings[field]) { return missing; }
    return preset.settings.mystery_settings[field][key] ?? missing;
  });

  Object.entries(mysterySliders).forEach(([id, [field, key]]) => setSlider(id, mysterySetting(field, key)));
  Object.entries(mysteryFlagSliders).forEach(([id, key]) => {
    let value = 100 * mysterySetting('flag_prob_dict', enumsMap.gameflags[key]);
    setSlider(id, value, '%');
  });

  // Bucket Settings
  const bucketSetting = ((key) => {
    let missing = settingsDefaults.bucket_settings[key]
    if(!preset.settings.bucket_settings) { return missing; }
    return preset.settings.bucket_settings[key] ?? missing;
  });
  setSlider('bucket_num_objs', bucketSetting('num_objectives'));
  setSlider('bucket_num_objs_req', bucketSetting('num_objectives_needed'));
  $('#id_bucket_disable_go_modes').prop('checked', bucketSetting('disable_other_go_modes')).change();
  $('#id_bucket_obj_win_game').prop('checked', bucketSetting('objectives_win')).change();

  // read objective hints from preset
  let hints = bucketSetting('hints') ?? [];
  [...Array(8).keys()].forEach((index) => $('#id_obhint_entry' + (index + 1)).val(hints[index] ?? '').change());
}

/*
 * Reset all form inputs to default values.
 */
function resetAll() {
  // direct focus back to General tab
  $('a[href="#options-general"]').tab('show');
  initAll();
  applyPreset({'settings': {}});
  $('.custom-preset-collapse').collapse('hide');
  document.getElementById('id_load_preset_btn').textContent = 'Upload Preset';
}

/*
 * Import preset from uploaded preset JSON.
 */
function importPreset() {
  let errElem = document.getElementById('id_invalid_preset_file');

  let reader = new FileReader();
  reader.onload = (event) => {
    let preset = {};

    try { preset = JSON.parse(event.target.result); }
    catch (e) {
      errElem.innerHTML = "<p>Could not parse preset file as JSON:</p>" + e.toString();
      return;
    }

    // validate preset file
    if(!preset.settings) {
      errElem.innerHTML = "<p>Preset file missing a 'settings' section.</p>";
      return;
    }
    else { errElem.innerHTML = ""; }

    // set lastPreset, just for console debugging, not otherwise used
    lastPreset = preset;
    applyPreset(preset);
  };
  reader.onerror = () => { errElem.innerHTML = reader.error; }

  let preset_file = document.getElementById('id_preset_file').files[0];
  reader.readAsText(preset_file);
}

/*
 * Load preset based on selected value in preset dropdown list.
 */
function loadSelectedPreset() {
  // show the "Upload custom preset" collapse when it is selected
  $('.custom-preset-collapse').collapse('show');
  if (document.getElementById('id_preset_file').files[0]) {
    importPreset();
  }
  document.getElementById('id_load_preset_btn').textContent = 'Load Preset';
}

/*
 * Check all of the character rando assignment boxes.
 */
function rcCheckAll() {
  charIdentities.forEach((identity) => {
    charModels.forEach((model) => $('#rc_' + identity + model).prop('checked', true));
  });
}

/*
 * Uncheck all of the character rando assignment boxes.
 */
function rcUncheckAll() {
  charIdentities.forEach((identity) => {
    charModels.forEach((model) => $('#rc_' + identity + model).prop('checked', false));
  });
}

/*
 * Encode the character choices into the hidden form field.
 * Each character is represented by a 2 digit hex string where the
 * bit index represents the character ID. ie:
 *   0x17 - The character can become:
 *      Crono, Marle, Lucca, or Frog.
 */
function encodeCharRandoChoices() {
  var encodedString = "";
  charIdentities.forEach((identity) => {
    let currentCharValue = 0;
    charModels.forEach((model, i) => {
      if ($('#rc_' + identity + model).prop('checked')) {
        currentCharValue = currentCharValue + (1 << i);
      }
    });

    if ((currentCharValue & 0xFF) < 0x10) {
      // Pad the string with a zero if needed so that the
      // final string is 14 characters.
      encodedString += "0";
    }
    encodedString += (currentCharValue & 0xFF).toString(16);
  });
  $('#id_char_rando_assignments').val(encodedString);
}

/*
 * Validate that the user's choices for character rando are valid.
 * Each character identity needs to have at least one character model they can turn into.
 * Unless duplicate characters is used, also ensure that each model has at
 * least one character identity they can use.
 */
function validateCharRandoChoices() {
  // ensure each character identity has at least one character model associated
  modelMissing = charIdentities.some(identity => {
    return !charModels.some(model => $('#rc_' + identity + model).prop('checked'));
  });
  if (modelMissing) {
    $('#character_selection_error').html("Each identity (row) must have at least one model (column) selected.");
    $('a[href="#options-rc"]').tab('show');
    $('#character_selection_matrix').collapse('show');
    return false;
  }

  let duplicateCharsChecked = $('#id_duplicate_characters').prop('checked');
  if (!duplicateCharsChecked) {
    // ensure each character model has at least one character identity associated
    identityMissing = charModels.some(model => {
      return !charIdentities.some(identity => $('#rc_' + identity + model).prop('checked'));
    });
    if (identityMissing) {
      $('#character_selection_error').html("Each model (column) must have at least one identity (row) selected.");
      $('a[href="#options-rc"]').tab('show');
      $('#character_selection_matrix').collapse('show');
      return false;
    }
  }
  $('#character_selection_error').html("");
  return true;
}

/*
 * Disable duplicate techs if duplicate characters is disabled.
 */
function disableDuplicateTechs() {
  if ($('#id_duplicate_characters').prop('checked')) { unrestrictFlag(enumsMap.gameflags['duplicate_duals']) }
  else { restrictFlag(enumsMap.gameflags['duplicate_duals']) }
}

function restrictFlag(flag) {
  let toggle = $('#id_' + invEnumsMap.gameflags[flag]);
  toggle.parent().addClass('btn-light off disabled');
  toggle.parent().removeClass('btn-primary');
  toggle.prop('disabled', true);
  if(toggle.prop('checked')) { toggle.prop('checked', false).change() }
}

function unrestrictFlag(flag) {
  let toggle = $('#id_' + invEnumsMap.gameflags[flag]);
  toggle.parent().removeClass('disabled');
  toggle.prop('disabled', false);
}

/*
 * Toggle flags related to Rocksanity when rocksanity is toggled.
 *
 * Provides visual clues to users for things that fix_flag_conflicts in randomizer
 * already does (enable Unlocked Skyways, effectively Remove Black Omen spot
 * when using Ice Age or Legacy of Cyrus).
 */
var priorUnlockedSkyways = $('#id_unlocked_skyways').prop('checked');
var priorRemoveBlackOmenSpot = $('#id_remove_black_omen_spot').prop('checked');
function toggleRocksanityRelated() {
  let game_mode = $('#id_game_mode').val();

  if ($('#id_rocksanity').prop('checked')) {
    priorUnlockedSkyways = $('#id_unlocked_skyways').prop('checked');
    priorRemoveBlackOmenSpot = $('#id_remove_black_omen_spot').prop('checked');
    $('#id_unlocked_skyways').prop('checked', true).change();

    // visually indicate that some modes effectively remove black omen spot
    if ((game_mode == 'ice_age') || (game_mode == 'legacy_of_cyrus')) {
      $('#id_remove_black_omen_spot').prop('checked', true).change();
    }
  } else {
    // check to prevent infinite recursion
    if ($('#id_unlocked_skyways').prop('checked') != priorUnlockedSkyways) {
      $('#id_unlocked_skyways').prop('checked', priorUnlockedSkyways).change();
    }
  }
}

/*
 * Toggle flags related to Unlocked Skyways when it is toggled.
 *
 * Provides visual cluse to users for related/dependencies when Unlocked
 * Skyways is toggled (e.g. turn off Rocksanity if Unlocked Skyways is removed).
 */
function toggleUnlockedSkywaysRelated() {
  if (!$('#id_unlocked_skyways').prop('checked')) {
    // check to prevent infinite recursion
    if ($('#id_rocksanity').prop('checked')) {
      priorUnlockedSkyways = false;
      $('#id_rocksanity').prop('checked', false).change();
    }
  }
}

/*
 * Pre-submit preparation for the form.
 *   - Validate character rando choices
 *   - Populate the hidden field with character rando information
 */
function prepareForm() {
  if (!validateCharRandoChoices()) {
    return false;
  }
  encodeCharRandoChoices();

  if (!validateLogicTweaks())
      return false;

  if (!validateAndUpdateObjectives()){return false;}
  return true;
}

/*
 * Set the visibility of an options section.
 */
function toggleOptions(option) {
  let optionSelected = $('#id_' + option).prop('checked');
  let optionNav = $('#id_' + option + '_nav');

  if (optionSelected) {
    optionNav.removeClass('disabled');
    optionNav.prop('disabled', false);
  } else {
    optionNav.addClass('disabled');
    optionNav.prop('disabled', true);

    // if currently on that nav tab, boot user back to General
    if (optionNav.prop('id') == $('.nav .active').attr('id')) {
      $('a[href="#options-general"]').tab('show');
    }
  }
}

// All quest name tags allowed by the parser.
const allowedQuestTags = [
    'free', 'gated', 'late', 'go',
    'repairmasamune', 'masamune', 'masa', 'forge',
    'chargemoon', 'moon', 'moonstone',
    'arris',
    'jerky',
    'deathpeak', 'death',
    'denadoro',
    'epoch', 'flight', 'epochflight',
    'factory', 'factoryruins',
    'geno', 'genodome',
    'claw', 'giantsclaw',
    'heckran', 'heckranscave', 'heckrancave',
    'kingstrial', 'shard', 'shardtrial', 'prismshard',
    'cathedral', 'cath', 'manoria',
    'woe', 'mtwoe',
    'ocean', 'oceanpalace',
    'ozzie', 'fort', 'ozziefort', 'ozziesfort',
    'pendant', 'pendanttrial',
    'reptite', 'reptitelair',
    'sunpalace', 'sun',
    'desert', 'sunkendesert',
    'zealthrone', 'zealpalace', 'golemspot',
    'zenan', 'bridge', 'zenanbridge',
    'tyrano', 'blacktyrano', 'azala',
    'tyranomid', 'nizbel2spot',
    'magus', 'maguscastle',
    'omengiga', 'gigamutant', 'gigaspot',
    'omenterra', 'terramutant', 'terraspot',
    'flea', 'magusflea',
    'slash', 'magusslash',
    'omenelder', 'elderspawn', 'elderspot',
    'twinboss', 'twingolem', 'twinspot',
    'cyrus', 'nr', 'northernruins',
    'johnny', 'johnnyrace',
    'fairrace', 'fairbet',
    'soda', 'drink',
]

/*
 * Helper function to parse a quest objective.
 * param questParts, Array: An objective (e.g. 'Quest_ZenanBridge') has been cleaned and turned into
 * the array ['quest', 'zenanbridge'] which is passed in as questParts.
 */
function validateQuestObjective(questParts){

    if (questParts.length != 2){
        return false
    }
    if (!allowedQuestTags.includes(questParts[1])){
        return false
    }

    return true
}

/*
 * Helper function to parse a boss objective.
 * param bossParts, Array: An objective (e.g. 'Boss_MotherBrain') has been
 * cleaned and turned into the array ['boss', 'motherbrain'] which is passed
 * in as bossParts.
 */
const allowedBossNames = [
    'any', 'go', 'nogo',
    'atropos', 'atroposxr', 'dalton', 'daltonplus', 'dalton+',
    'dragontank', 'dtank', 'elderspawn', 'elder', 'flea', 'fleaplus', 'flea+',
    'gigagaia', 'gg', 'gigamutant', 'golem', 'bossgolem', 'golemboss',
    'guardian', 'heckran', 'lavosspawn', 'magusnc', 'ncmagus', 'masamune', 'masa&mune',
    'megamutant', 'motherbrain', 'mudimp', 'nizbel', 'nizbel2', 'nizbelii',
    'rseries', 'retinite', 'rusty', 'rusttyrano', 'slash', 'sos', 'sonofsun',
    'superslash', 'terramutant', // 'twinboss', handled in quests
    'yakra', 'yakraxiii', 'yakra13', 'zombor'
]

function validateBossObjective(bossParts){
    if (bossParts.length != 2){
        return false
    }

    return allowedBossNames.includes(bossParts[1])
}

const allowedRecruitNames = [
    'any', 'gated',
    'crono', 'marle', 'lucca', 'robo', 'frog', 'ayla', 'magus',
    'castle', 'dactyl', 'proto', 'burrow',
    '1', '2', '3', '4', '5'
]

/*
 * Helper function to parse a recruit objective.
 * param recruitParts, Array: An objective (e.g. 'Recruit_Crono') has been
 * cleaned and split into an array (['recruit', 'crono']) which is passed
 * in as recruitParts.
 */
 function validateRecruitObjective(recruitParts){
    if (recruitParts.length != 2){return false}

    return allowedRecruitNames.includes(recruitParts[1])
 }

/*
 * function which determines whether the given string is actually an integer
 * which is strictly greater than some threshold (param greaterThan)
 */
function isInteger(string){
    const num = Number(string)
    return Number.isInteger(num)
}

/*
 * Helper function to parse a recruit objective.
 * param collectParts, Array: An objective (e.g. 'Collect_5_Fragments_5') has
 * been cleaned and split into an array (['collect', '5', 'fragments', '5'])
 * which is passed in as recruitParts.
 */
function validateCollectObjective(collectParts){
    if (collectParts.length < 2){
        return false
    }
    collectType = collectParts[2]
    if (collectType == 'rocks'){
        if (collectParts.length != 3){return false}
        numRocks = Number(collectParts[1])
        if (!Number.isInteger(numRocks) || numRocks < 1){return false}
    } else if (collectType == 'fragments'){
        if (collectParts.length != 4){return false}

        fragsNeeded = Number(collectParts[1])
        extraFrags = Number(collectParts[3])

        if (!Number.isInteger(fragsNeeded) || fragsNeeded < 0){return false}
        if (!Number.isInteger(extraFrags) || extraFrags < 0){return false}
    } else {
        // Unrecognized collection type
        return false
    }
    return true
}

/*
 * Validate a single objective hint.
 */
function validateObjective(objective){
    // If the user used a preset in the entry box, then use the dict above to resolve it.
    cleanedObjective = objective.toLowerCase()
    for(let key in obhintMap){
        if (obhintMap.hasOwnProperty(key) && key.toLowerCase() == cleanedObjective){
            return {isValid: true, result: obhintMap[key]}
        }
    }

    // Otherwise, parse the objective
    cleanedObjective = objective.replace(/\s/g,'')

    if (cleanedObjective == ''){
        // Do something to display an error on the page for an empty objective string
        return {isValid: false, result: "Empty objective string."}
    }

    objectiveParts = cleanedObjective.split(',')
    for (let i = 0; i < objectiveParts.length; i++){
        objectivePart = objectiveParts[i]
        // split into weight:objective if possible
        weightSplit = objectivePart.split(':')
        if (weightSplit.length > 2){
            // Some error message about unexpected ':'
            return {
                isValid: false,
                result: "Too many ':' in "+objectivePart+". Format is 'weight1:obj_text1, weight2:obj_text2, ..."
            }
        } else if (weightSplit.length == 2) {
            // If there was a weight, verify it's an integer
            weight = weightSplit[0]
            if (!isInteger(weight) || Number(weight) < 0){
                return {isValid: false, result: "Weight '"+weight+"' is not a positive integer"}
            }
            // Overwrite objectivePart with just the objective, not the weight
            objectivePart = weightSplit[1]
        }

        splitObjective = objectivePart.split('_')
        objectiveType = splitObjective[0]

        if (objectiveType == 'quest'){
            ret = validateQuestObjective(splitObjective)
        } else if (objectiveType == 'boss'){
            ret = validateBossObjective(splitObjective)
        } else if (objectiveType == 'recruit'){
            ret = validateRecruitObjective(splitObjective)
        } else if (objectiveType == 'collect'){
            ret = validateCollectObjective(splitObjective)
        } else {
            // invalid objective type
            return {isValid: false, result: "Invalid objective type: "+objectiveType}
        }
        if (!ret){
            return {
                isValid: false,
                result: "Could not resolve "+objectivePart
            }
        }
    }

    return {isValid: true, result: cleanedObjective}
}

/*
 * Get the objectives from the entries, parse them, and put them in the actual
 * form fields.
 */
function validateAndUpdateObjectives(){
    let bucketList = document.getElementById("id_bucket_list").checked
    if (!bucketList){return true}

    let numObjs = document.getElementById("id_bucket_num_objs").value

    let retFalse = false
    for(let i = 0; i<Number(numObjs); i++){
        let elementId = 'id_obhint_entry'+(i+1)
        let objective = document.getElementById(elementId).value
        const parse = validateObjective(objective)
        const isValid = parse.isValid
        const result = parse.result

        if (isValid){
            const formElementId = 'id_bucket_objective'+(i+1)
            document.getElementById(formElementId).value = result

            const errorElementId = 'objError'+(i+1)
            document.getElementById(errorElementId).innerHTML = ""
        }
        else{
            const errorElementId = 'objError'+(i+1)
            document.getElementById(errorElementId).innerHTML = result
            $('a[href="#options-bucket"]').tab('show');
            retFalse = true
        }

    }

    if (retFalse){
        return false
    }

    for(let i=Number(numObjs); i<8; i++){
        formElementId = 'id_bucket_objective'+(i+1)
        document.getElementById(formElementId).value = 'None'
    }
    return true
}

/*
 * Ensure that there are enough KI Spots to support added KIs
 */
function validateLogicTweaks(){
    // chronosanity always has enough spots
    if ($('#id_chronosanity').prop('checked')) {
      return true;
    }

    const addKiNames = ['restore_johnny_race', 'restore_tools', 'epoch_fail'];
    const addSpotNames = ['add_bekkler_spot', 'add_ozzie_spot',
                          'add_racelog_spot', 'vanilla_robo_ribbon',
                          'add_cyrus_spot'];
    let game_mode = $('#id_game_mode').val();

    let numKIs = addKiNames.filter((ki) => $('#id_' + ki).prop('checked')).length;

    let numSpots = addSpotNames.filter((spot) => $('#id_' + spot).prop('checked')).length;

    // Rocksanity adds 5 KIs, 4-5 spots depending on mode
    if ($('#id_rocksanity').prop('checked')) {
      numKIs += 5;
      let inaccessible = game_mode == 'ice_age' || game_mode == 'legacy_of_cyrus';
      if (inaccessible || $('#id_remove_black_omen_spot').prop('checked')) { numSpots += 4; }
      else { numSpots += 5; }
    }

    // some modes have extra spots
    if (game_mode == 'legacy_of_cyrus') { numSpots++; }
    else if (game_mode == 'ice_age') { numSpots += 2; }

    // there can be more KI than spots because can erase Jerky
    // and fix_flag_conflicts can add Robo Ribbon or remove Epoch Fail
    allowedExtras = 1;
    if (!$('#id_vanilla_robo_ribbon').prop('checked')) { allowedExtras++; }
    if ($('#id_epoch_fail').prop('checked')) { allowedExtras++; }

    if (numKIs > numSpots + allowedExtras){
      let err =
        "Add additional Key Item spots or remove Key Items." +
        " (" + numKIs + " KIs > " + (numSpots + allowedExtras) + " spots)";
      document.getElementById("logicTweakError").innerHTML = err;
      $('a[href="#options-extra"]').tab('show');
      return false;
    }

    document.getElementById("logicTweakError").innerHTML = "";
    return true;

}

/*
 * Unset and disable flags based on the chosen game mode. Restore them if the mode permits.
 */
function restrictFlags() {
  const mode = document.getElementById('id_game_mode').value;
  const key = enumsMap.game_mode[mode];
  const forcedOff = forcedFlagsMap.forced_off[key] ?? [];

  Object.entries(enumsMap.gameflags).forEach(([_, flag]) => {
    if(forcedOff.includes(flag)) { restrictFlag(flag) }
    else{ unrestrictFlag(flag) }
  });
}
