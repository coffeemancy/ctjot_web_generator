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

const tabTypes = ['power', 'magic', 'speed'];
const charIdentities = ['Crono', 'Marle', 'Lucca', 'Robo', 'Frog', 'Ayla', 'Magus'];
const charModels = ['0', '1', '2', '3', '4', '5', '6'];

const optionToggleIds = ['boss_rando', 'bucket_list', 'char_rando', 'mystery_seed'];

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

/*
 * Creates a slider with linked text.
 * Slider element will update text when slider is moved, and update slider when text is entered.
 */
function createSlider(id, {min, max}={min: 0, max: 100}) {
  const slider = document.getElementById('id_' + id);
  const text = document.getElementById('id_' + id + '_text');

  // update text value when slider is changed
  const updateText = () => text.value = slider.value;
  for (const ev of ['change', 'input']) { slider.addEventListener(ev, updateText) }

  // update slider to value when text is changed if text can be parsed as non-negative integer
  const updateSlider = (() => {
    const value = parseInt(text.value);
    // clamp value to (min, max) range
    if(Number.isInteger(value) && value >= 0) { slider.value = Math.min(max, Math.max(min, value)) }
  });
  for (const ev of ['change', 'input']) { text.addEventListener(ev, updateSlider) }

  // when text element loses focus, if it's not an integer, or out of range, coerce back to slider value
  text.addEventListener('blur', (() => {
    const value = parseInt(text.value);
    if(!Number.isInteger(value) || value < min || value > max) { text.value = slider.value }
  }));

  updateText();
  return [slider, text];
}

/*
 * Creates a pair of "min" and "max" sliders with linked text.
 * Slider element will update text when slider is moved, and update slider when text is entered.
 * If min slider value goes above max slider, max slider gets increased.
 * If max slider value goes below min slider, min slider gets decreased.
 */

function createMinMaxSlidersPair(id_min, id_max, {min, max}={min: 0, max: 100}) {
  const kwargs = {min: min, max: max};
  const [minSlider, minText] = createSlider(id_min, kwargs);
  const [maxSlider, maxText] = createSlider(id_max, kwargs);

  // decrease min value if max value goes below it
  const adjustMin = (() => {
    if (maxSlider.value < minSlider.value) {
      minSlider.value = maxSlider.value;
      minText.value = maxSlider.value;
    }
  });

  // increase max value if min value goes above it
  const adjustMax = (() => {
    if (minSlider.value > maxSlider.value) {
      maxSlider.value = minSlider.value;
      maxText.value = minSlider.value;
    }
  });

  for (const ev of ['change', 'input']) { minSlider.addEventListener(ev, adjustMax) }
  for (const ev of ['change', 'input']) { minText.addEventListener(ev, adjustMax) }
  for (const ev of ['change', 'input']) { maxSlider.addEventListener(ev, adjustMin) }
  for (const ev of ['change', 'input']) { maxText.addEventListener(ev, adjustMin) }

  adjustMax();
  adjustMin();
  return [[minSlider, minText], [maxSlider, maxText]];
}

/*
 * Adjust whether bucket list objective elements are disabled based on number of objectives..
 */
function adjustObjectiveEntries() {
  const numObjsSlider = document.getElementById('id_bucket_num_objs');
  for (const index of [...Array(8).keys()]) {
    const id = 'id_obhint_entry' + (index + 1);
    document.getElementById(id).disabled = (index > numObjsSlider.value - 1);
  }
}



/*
 * Set slider and linked text to value.
 */
function setSlider(id, value) {
  const slider = document.getElementById('id_' + id);
  const text = document.getElementById('id_' + id + '_text');
  slider.value = value;
  text.value = value;
}

/*
 * Apply preset values to all form inputs.
 * TODO: move handling of type-/boundary-checking of preset prior to passing to this function
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
    const missing = settingsDefaults[key];
    if(!preset.settings[key]) { return missing; }
    return preset.settings[key] ?? missing;
  });

  $('#id_game_mode').val(gameOption('game_mode')).change();
  $('#id_enemy_difficulty').val(gameOption('enemy_difficulty')).change();
  $('#id_item_difficulty').val(gameOption('item_difficulty')).change();
  $('#id_tech_rando').val(gameOption('techorder')).change();
  $('#id_shop_prices').val(gameOption('shopprices')).change();

  // Flags
  const hasFlag = ((flag) => {
    const missing = settingsDefaults.gameflags.includes(flag);
    if(!preset.settings.gameflags) { return missing; }
    return preset.settings.gameflags.includes(flag);
  });

  for (const [id, flag] of Object.entries(enumsMap.gameflags)) {
    $('#id_' + id).prop('checked', hasFlag(flag)).change();
  }

  // Tabs options
  const tabSetting = ((key) => {
    const missing = settingsDefaults.tab_settings[key];
    if(!preset.settings.tab_settings) { return missing; }
    return parseInt(preset.settings.tab_settings[key]) || missing;
  });

  for (const tab of tabTypes) {
    const max = tabSetting(tab + '_max');
    const min = Math.min(tabSetting(tab + '_min'), max);
    setSlider(tab + '_tab_max', max);
    setSlider(tab + '_tab_min', min);
  }
  // TODO: missing tab scheme, binom_success

  // Character Rando options
  // check character choice boxes based on preset
  // if someone passed in a non-array in preset, just use defaults
  // TODO: this could be handled by validation prior to applyPreset
  const hasChoices =
    preset.settings.char_settings &&
    preset.settings.char_settings.choices &&
    Object.prototype.toString.call(preset.settings.char_settings.choices) == '[object Array]';

  if(hasChoices) {
    const char_choices = preset.settings.char_settings.choices;

    rcUncheckAll();

    for (const [pc_index, choices] of char_choices.entries()) {
      let models = [];

      // choices is string, coerce to list
      if (Object.prototype.toString.call(choices) === "[object String]") {
        const splits = choices.split(" ");
        if(splits[0] == "any") { models = charModels }
        else {
          const modelChoices = splits.map((choice) => {
            return charIdentities.findIndex((identity) => identity.toLowerCase() == choice.toLowerCase());
          }).filter((index) => index > -1).map((index) => charModels[index]);

          if (splits[0] == "not") { models = charModels.filter((model) => !modelChoices.includes(model)) }
          else { models = modelChoices }
        }
      } else { models = choices }

      const identity = charIdentities[pc_index];
      for (const model of models) { $('#rc_' + identity + model).prop('checked', true) }
    }

    // make character assignments matrix visible if the preset had some
    $('#character_selection_matrix').collapse('show');
  } else {
    rcCheckAll();
  }

  // Boss Rando options
  const hasROFlag = ((flag) => {
    const missing = settingsDefaults.ro_settings.flags.includes(flag);
    if(!preset.settings.ro_settings) { return missing; }
    if(!preset.settings.ro_settings.flags) { return missing; }
    return preset.settings.ro_settings.flags.includes(flag);
  });

  for (const [id, flag] of Object.entries(enumsMap.roflags)) {
    $('#id_' + id).prop('checked', hasROFlag(flag)).change();
  }

  // Mystery Seed options
  const mysterySetting = ((field, key) => {
    const missing = settingsDefaults.mystery_settings[field][key];
    if(!preset.settings.mystery_settings) { return [null, missing]; }
    if(!preset.settings.mystery_settings[field]) { return [null, missing]; }
    return [preset.settings.mystery_settings[field][key], missing];
  });

  for (const [id, [field, key]] of Object.entries(mysterySliders)) {
    const [value, missing] = mysterySetting(field, key);
    setSlider(id, parseInt(value) || missing);
  }
  for (const [id, key] of Object.entries(mysteryFlagSliders)) {
    const [value, missing] = mysterySetting('flag_prob_dict', enumsMap.gameflags[key]);
    setSlider(id, 100 * (parseFloat(value) || missing));
  }

  // Bucket Settings
  const bucketSetting = ((key) => {
    const missing = settingsDefaults.bucket_settings[key]
    if(!preset.settings.bucket_settings) { return missing; }
    const lookup = preset.settings.bucket_settings[key] ?? missing;

    // if wrong type (like a string for num objectives), use default
    // TODO: this could be handled by validation prior to applyPreset
    return (typeof(lookup) == typeof(missing)) ? lookup : missing;
  });
  const maxObjs = 8;
  const numObjs = Math.max(1, Math.min(bucketSetting('num_objectives'), maxObjs));
  setSlider('bucket_num_objs', numObjs);
  setSlider('bucket_num_objs_req', Math.max(1, Math.min(bucketSetting('num_objectives_needed'), numObjs)));
  $('#id_bucket_disable_go_modes').prop('checked', bucketSetting('disable_other_go_modes')).change();
  $('#id_bucket_obj_win_game').prop('checked', bucketSetting('objectives_win')).change();
  adjustObjectiveEntries();

  // read objective hints from preset
  const hints = bucketSetting('hints') || [];
  for (const index of [...Array(8).keys()]) {
    $('#id_obhint_entry' + (index + 1)).val(hints[index] ?? '').change();
  }

  // reset spoiler log and differential preset flags whenever a preset is applied (or "reset all" run)
  $('#id_spoiler_log').prop('checked', true).change();
  $('#id_diff_preset').prop('checked', true).change();
}

/*
 * Import preset from uploaded preset JSON.
 */
function importPreset() {
  const errElem = document.getElementById('id_invalid_preset_file');

  const reader = new FileReader();
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

    applyPreset(preset);
  };
  reader.onerror = () => { errElem.innerHTML = reader.error; }

  const preset_file = document.getElementById('id_preset_file').files[0];
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
  for (const identity of charIdentities) {
    for (const model of charModels) { $('#rc_' + identity + model).prop('checked', true) }
  }
}

/*
 * Uncheck all of the character rando assignment boxes.
 */
function rcUncheckAll() {
  for (const identity of charIdentities) {
    for (const model of charModels) { $('#rc_' + identity + model).prop('checked', false) }
  }
}

/*
 * Validate that the user's choices for character rando are valid.
 * Each character identity needs to have at least one character model they can turn into.
 * Unless duplicate characters is used, also ensure that each model has at
 * least one character identity they can use.
 */
function validateCharRandoChoices() {
  // ensure each character identity has at least one character model associated
  const modelMissing = charIdentities.some(identity => {
    return !charModels.some(model => $('#rc_' + identity + model).prop('checked'));
  });
  if (modelMissing) {
    $('#character_selection_error').html("Each identity (row) must have at least one model (column) selected.");
    $('a[href="#options-rc"]').tab('show');
    $('#character_selection_matrix').collapse('show');
    return false;
  }

  const duplicateCharsChecked = $('#id_duplicate_characters').prop('checked');
  if (!duplicateCharsChecked) {
    // ensure each character model has at least one character identity associated
    const identityMissing = charModels.some(model => {
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

function toggleFlagsRelated(id) {
  const flag = enumsMap.gameflags[id];
  const toggleOn = $('#id_' + id).prop('checked');

  let forcedOn = [];
  let forcedOff = forcedFlagsMap.forced_off[flag] ?? [];

  if(toggleOn) {
    // flag is on, clear any restricted flags from "forced on"
    forcedOn = forcedFlagsMap.forced_on[flag] ?? [];
    for (const flag of forcedOn) {
      unrestrictFlag(flag);
      let elem = $('#id_' + invEnumsMap.gameflags[flag]);
      if(!elem.prop('checked')) { elem.prop('checked', true).change() }
    }

    // restrict all from "forced off"
    for (const flag of forcedOff) { restrictFlag(flag) }
  } else {
    // flag is off, clear any restricted flags from "forced off"
    forcedOff = forcedFlagsMap.forced_off[flag] ?? [];
    for (const flag of forcedOff) { unrestrictFlag(flag) }
  }

  return [forcedOn, forcedOff];
}

function toggleModeRelated() {
  const selectedMode = document.getElementById('id_game_mode').value;
  const selectedGameMode = selectedMode;

  // clear all restricted flags from all non-selected games modes "forced off"
  const otherModes = enumsMap.game_mode.filter((mode) => mode != selectedMode);
  for (const gameMode of otherModes) {
    const forcedOff = forcedFlagsMap.forced_off[gameMode] ?? [];
    for (const flag of forcedOff) { unrestrictFlag(flag) }
  }

  // set "forced on" flags for this game mode
  const forcedOn = forcedFlagsMap.forced_on[selectedGameMode] ?? [];
  for (const flag of forcedOn) {
    unrestrictFlag(flag);
    $('#id_' + invEnumsMap.gameflags[flag]).prop('checked', true).change();
  }

  // restrict all flags from "forced off" for this game mode
  const forcedOff = forcedFlagsMap.forced_off[selectedGameMode] ?? [];
  for (const flag of forcedOff) { restrictFlag(flag) }

  return [forcedOn, forcedOff];
}

/*
 * Pre-submit preparation for the form.
 *   - Validate character rando choices, logic tweaks, and objectives.
 *   - Populate the hidden field with all settings exported as preset JSON.
 */
function prepareForm() {
  if (!validateCharRandoChoices() || !validateLogicTweaks() || !validateAllObjectives()) {
    return false;
  }

  // Encode preset data into hidden JSON field.
  const presetDataElem = document.getElementById('id_preset');
  presetDataElem.value = JSON.stringify(exportPreset(!$('#id_diff_preset').prop('checked')));
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
    const collectType = collectParts[2];
    if (collectType == 'rocks'){
        if (collectParts.length != 3){return false}
        const numRocks = Number(collectParts[1])
        if (!Number.isInteger(numRocks) || numRocks < 1){return false}
    } else if (collectType == 'fragments'){
        if (collectParts.length != 4){return false}

        const fragsNeeded = Number(collectParts[1])
        const extraFrags = Number(collectParts[3])

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
    let cleanedObjective = objective.toLowerCase()
    for(let key in obhintMap){
        if (Object.keys(obhintMap).includes(key) && key.toLowerCase() == cleanedObjective){
            return {isValid: true, result: obhintMap[key]}
        }
    }

    // Otherwise, parse the objective
    cleanedObjective = objective.replace(/\s/g,'')

    if (cleanedObjective == ''){
        // Do something to display an error on the page for an empty objective string
        return {isValid: false, result: "Empty objective string."}
    }

    const objectiveParts = cleanedObjective.split(',')
    for (let i = 0; i < objectiveParts.length; i++){
        let objectivePart = objectiveParts[i]
        // split into weight:objective if possible
        const weightSplit = objectivePart.split(':')
        if (weightSplit.length > 2){
            // Some error message about unexpected ':'
            return {
                isValid: false,
                result: "Too many ':' in "+objectivePart+". Format is 'weight1:obj_text1, weight2:obj_text2, ..."
            }
        } else if (weightSplit.length == 2) {
            // If there was a weight, verify it's an integer
            const weight = weightSplit[0]
            if (!isInteger(weight) || Number(weight) < 0){
                return {isValid: false, result: "Weight '"+weight+"' is not a positive integer"}
            }
            // Overwrite objectivePart with just the objective, not the weight
            objectivePart = weightSplit[1]
        }

        const splitObjective = objectivePart.split('_');
        const objectiveType = splitObjective[0];
        let ret;

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
 * Get the objectives from the entries, parse them, and check they are valid.
 */
function validateAllObjectives(){
  const bucketList = $('#id_bucket_list').prop('checked');
  if (!bucketList){ return true }

  const numObjs = $('#id_bucket_num_objs').val();
  const parseResults = [...Array(numObjs).keys()].map((index) => {
    document.getElementById('objError' + (index + 1)).innerHTML = '';
    return validateObjective($('#id_obhint_entry' + (index + 1)).val());
  });

  const invalidResults = parseResults.filter((result) => !result.isValid);

  if(invalidResults.length == 0) { return true }

  for (const [index, parse] of invalidResults.entries()) {
    document.getElementById('objError' + (index + 1)).innerHTML = parse.result;
  }

  $('a[href="#options-bucket"]').tab('show');
  return false;
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
    let allowedExtras = 1;
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
 * Export form inputs as preset to be encoded into JSON.
 * If strict is false (default), always sets general options, but otherwise only non-default options are exported.
 * When strict is true, export all settings.
 * Only exports some settings when appropriate flags are enabled:
 *   - char_settings: only when Char Rando enabled
 *   - ro_settings: currently not implemented (gameflags alone seems to handle currently-supported Boss Rando options?)
 *   - mystery_settings: only when Mystery enabled
 *   - bucket_settings: only when Bucket List enabled
 */
function exportPreset(strict=false) {
  let settings = {}

  // metadata?

  // General options
  settings['game_mode'] = $('#id_game_mode').val();
  settings['enemy_difficulty'] = $('#id_enemy_difficulty').val();
  settings['item_difficulty'] = $('#id_item_difficulty').val();
  settings['techorder'] = $('#id_tech_rando').val();
  settings['shopprices'] = $('#id_shop_prices').val();

  // Flags
  const getCheckedFlags = ((map) => {
    return Object.entries(map).filter(([id, ]) => $('#id_' + id).prop('checked')).map(([, flag]) => flag);
  });
  const flags = getCheckedFlags(enumsMap.gameflags);
  if(strict || flags.length > 0) { settings['gameflags'] = flags; }

  // Tabs options
  let tabSettings = {};
  for (const tab of tabTypes) {
    const max = parseInt($('#id_' + tab + '_tab_max').val());
    const min = parseInt($('#id_' + tab + '_tab_min').val());
    if(strict || max != settingsDefaults.tab_settings[tab + '_max']) { tabSettings[tab + '_max'] = max }
    if(strict || min != settingsDefaults.tab_settings[tab + '_min']) { tabSettings[tab + '_min'] = min }
  }
  // TODO: missing tab scheme, binom_success
  if(strict || Object.keys(tabSettings).length > 0) { settings['tab_settings'] = tabSettings }

  // Character Rando options
  if(strict || settings.gameflags.includes('GameFlags.CHAR_RANDO')) {
    const choices = charIdentities.map((identity) => {
      const checkedModels = charModels.filter((model) => $('#rc_' + identity + model).prop('checked'));
      return checkedModels.map((model) => parseInt(model));
    });
    if(strict || JSON.stringify(choices) != JSON.stringify(settingsDefaults.char_settings.choices)) {
      settings['char_settings'] = {'choices': choices};
    }
  }

  // Boss Rando options
  if(strict || settings.gameflags.includes('GameFlags.BOSS_RANDO')) {
    const roFlags = getCheckedFlags(enumsMap.roflags);
    if(strict || roFlags.length > 0) { settings['ro_settings'] = {'flags': roFlags} }
  }

  // Mystery Seed options
  if(strict || settings.gameflags.includes('GameFlags.MYSTERY')) {
    let mysterySettings = {};
    const setMysterySetting = ((field, key, value) => {
      if(strict || value != settingsDefaults.mystery_settings[field][key]) {
        if(!mysterySettings[field]) { mysterySettings[field] = {} }
        mysterySettings[field][key] = value;
      }
    });
    for (const [id, [field, key]] of Object.entries(mysterySliders)) {
      setMysterySetting(field, key, parseInt($('#id_' + id).val()));
    }
    for (const [id, key] of Object.entries(mysteryFlagSliders)) {
      const value = parseFloat($('#id_' + id).val()) / 100;
      const flag = enumsMap.gameflags[key];
      setMysterySetting('flag_prob_dict', flag, value);
    }
    if(strict || Object.keys(mysterySettings).length > 0) { settings['mystery_settings'] = mysterySettings }
  }

  // Bucket settings
  if(strict || settings.gameflags.includes('GameFlags.BUCKET_LIST')) {
    let bucketSettings = {};
    Object.entries({
      'num_objectives': parseInt($('#id_bucket_num_objs').val()),
      'num_objectives_needed': parseInt($('#id_bucket_num_objs_req').val()),
      'disable_other_go_modes': $('#id_bucket_disable_go_modes').prop('checked'),
      'objectives_win': $('#id_bucket_obj_win_game').prop('checked'),
    }).forEach(([key, value]) => {
      if(strict || value != settingsDefaults.bucket_settings[key]) { bucketSettings[key] = value }
    });
    const hints = [...Array(8).keys()].map((index) => $('#id_obhint_entry' + (index + 1)).val());
    if(strict || hints.length > 0) { bucketSettings['hints'] = hints }
    if(strict || Object.keys(bucketSettings).length > 0) { settings['bucket_settings'] = bucketSettings }
  }

  return {'settings': settings}
}

/*
 * Initialize the sliders and linked text elements for tab settings.
 */
function initTabSliders() {
  for (const tab of tabTypes) {
    createMinMaxSlidersPair(tab + '_tab_min', tab + '_tab_max', {min: 1, max: 9});
  }
}

/*
 * Initialize sliders and text for mystery settings.
 */
function initMysterySliders() {
  for (const id of Object.keys(mysterySliders)) { createSlider(id) }
  for (const id of Object.keys(mysteryFlagSliders)) { createSlider(id) }
}

/*
 * Initialize the sliders and linked text elements for bucket settings.
 */
function initBucketSliders() {
  const [
    [reqObjsSlider, reqObjsText],
    [numObjsSlider, numObjsText]
  ] = createMinMaxSlidersPair('bucket_num_objs_req', 'bucket_num_objs', {min: 1, max: 8});

  for (const ev of ['change', 'input']) { reqObjsSlider.addEventListener(ev, adjustObjectiveEntries) }
  for (const ev of ['change', 'input']) { reqObjsText.addEventListener(ev, adjustObjectiveEntries) }
  for (const ev of ['change', 'input']) { numObjsSlider.addEventListener(ev, adjustObjectiveEntries) }
  for (const ev of ['change', 'input']) { numObjsText.addEventListener(ev, adjustObjectiveEntries) }

  adjustObjectiveEntries();
}

/*
 * Initialize listeners for UI bottons / options.
 */
function initButtonsListeners() {
  const presets  = ['race', 'new_player', 'lost_worlds', 'hard', 'legacy_of_cyrus'];
  for (const preset of presets) {
    $('#id_preset_btn_' + preset).on('click', () => applyPreset(presetsMap[preset]));
  }
  $('#id_reset_all_btn').on('click', () => resetAll());
  $('#id_load_preset_btn').on('click', () => loadSelectedPreset());
  $('#id_preset_file').on('change', () => loadSelectedPreset());

  // char rando tab
  $('#id_rc_check_all').on('click', () => rcCheckAll());
  $('#id_rc_uncheck_all').on('click', () => rcUncheckAll());
}

/*
 * Initialize listeners for general options and flag toggles.
 */
function initFlagsListeners() {
  $('#id_game_mode').on('change', toggleModeRelated);

  // find all flags that with a "forced on" or "forced off" relationship (which isn't zero/empty)
  let restrictedFlagIds = new Set();
  const allFlagIds = Object.keys(enumsMap.gameflags);
  const allFlags = Object.keys(forcedFlagsMap.forced_on).concat(Object.keys(forcedFlagsMap.forced_off));
  allFlags.map((flag) => invEnumsMap.gameflags[flag]).filter((id) => {
    return id && allFlagIds.includes(id);
  }).forEach((id) => restrictedFlagIds.add(id));

  // add listeners for toggling of all flags that have restrictions ("forced on" or "forced off" relationships)
  for (const id of restrictedFlagIds) { $('#id_' + id).on('change', () => toggleFlagsRelated(id)) }

  // add additional listeners to enable/disable options
  for (const id of optionToggleIds) { $('#id_' + id).on('change', () => toggleOptions(id)) }

  // disable duplicate techs when duplicate characters is disabled
  $('#id_duplicate_characters').on('change', disableDuplicateTechs);
}

/*
 * Initialize form listener to validate, prepare, and submit.
 */
function initFormListeners() {
  const gameOptionsForm = document.getElementById('game_options_form');

  gameOptionsForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    gameOptionsForm.action = '/generate-rom/';

    if(prepareForm()) { gameOptionsForm.submit() }
  });

  $('#id_download_preset_btn').on('click', () => {
    if(prepareForm()) {
      gameOptionsForm.action = '/download/preset/';
      gameOptionsForm.submit();
    }
  });
}

/*
 * Intended-to-be-idempotent (re-)initialization of page state.
 */
function initAll() {
  toggleModeRelated();
  for (const option of optionToggleIds) { toggleOptions(option) }
  for (const flag of Object.keys(enumsMap.gameflags)) { toggleFlagsRelated(flag) }
  disableDuplicateTechs();
  $('#id_disable_glitches').prop('checked', true).change();
  $('#id_fast_tabs').prop('checked', true).change();
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
 * Initialize some UI settings when page (re-)loaded.
 */
function initOnce() {
  // only add listeners once, on page load; don't add again when resetAll called
  initTabSliders();
  initMysterySliders();
  initBucketSliders();

  initButtonsListeners();
  initFlagsListeners();

  initFormListeners();

  // preform intended-to-be-idempotent (re-)initialization
  initAll();
}
$(document).ready(initOnce);
