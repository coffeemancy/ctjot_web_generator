# Python types
from __future__ import annotations
import io
import json
import os.path
import random
import re
import sys
import datetime

from collections import OrderedDict
from typing import Any, Dict, List, Optional, Union

# Web types
from .forms import GenerateForm, RomForm
from django.conf import settings as conf

# Add the randomizer to the system path here.  This code assumes that the
# randomizer has been added at the site base path.
sys.path.append(os.path.join(conf.BASE_DIR, 'jetsoftime', 'sourcefiles'))

# Randomizer types
import bossrandotypes as rotypes
import jotjson
import logicwriters as logicwriter
import objectivehints as obhint
import randoconfig
import randomizer
import randosettings as rset
import validators as vld
from randosettings import GameFlags as GF


# string representations of randosettings enums used in options.js
enums_map: Dict[str, Union[List[str], Dict[str, str]]] = {
    "game_mode": [str(k) for k in list(rset.GameMode)],
    "shopprices": [str(k) for k in list(rset.ShopPrices)],
    "item_difficulty": [str(k) for k in list(rset.Difficulty)],
    "enemy_difficulty": [str(rset.Difficulty.NORMAL), str(rset.Difficulty.HARD)],
    "techorder": [str(k) for k in list(rset.TechOrder)],
    "gameflags": {
        # Main
        'disable_glitches': str(GF.FIX_GLITCH),
        'boss_rando': str(GF.BOSS_RANDO),
        'boss_scaling': str(GF.BOSS_SCALE),
        'zeal': str(GF.ZEAL_END),
        'early_pendant': str(GF.FAST_PENDANT),
        'locked_chars': str(GF.LOCKED_CHARS),
        'unlocked_magic': str(GF.UNLOCKED_MAGIC),
        'tab_treasures': str(GF.TAB_TREASURES),
        'chronosanity': str(GF.CHRONOSANITY),
        'char_rando': str(GF.CHAR_RANDO),
        'healing_item_rando': str(GF.HEALING_ITEM_RANDO),
        'gear_rando': str(GF.GEAR_RANDO),
        'mystery_seed': str(GF.MYSTERY),
        'epoch_fail': str(GF.EPOCH_FAIL),
        'duplicate_characters': str(GF.DUPLICATE_CHARS),
        'duplicate_duals': str(GF.DUPLICATE_TECHS),
        # Extra
        'unlocked_skyways': str(GF.UNLOCKED_SKYGATES),
        'add_sunkeep_spot': str(GF.ADD_SUNKEEP_SPOT),
        'add_bekkler_spot': str(GF.ADD_BEKKLER_SPOT),
        'add_cyrus_spot': str(GF.ADD_CYRUS_SPOT),
        'restore_tools': str(GF.RESTORE_TOOLS),
        'add_ozzie_spot': str(GF.ADD_OZZIE_SPOT),
        'restore_johnny_race': str(GF.RESTORE_JOHNNY_RACE),
        'add_racelog_spot': str(GF.ADD_RACELOG_SPOT),
        'remove_black_omen_spot': str(GF.REMOVE_BLACK_OMEN_SPOT),
        'split_arris_dome': str(GF.SPLIT_ARRIS_DOME),
        'vanilla_robo_ribbon': str(GF.VANILLA_ROBO_RIBBON),
        'vanilla_desert': str(GF.VANILLA_DESERT),
        'use_antilife': str(GF.USE_ANTILIFE),
        'tackle_effects': str(GF.TACKLE_EFFECTS_ON),
        'starters_sufficient': str(GF.STARTERS_SUFFICIENT),
        'bucket_list': str(GF.BUCKET_LIST),
        'rocksanity': str(GF.ROCKSANITY),
        'tech_damage_rando': str(GF.TECH_DAMAGE_RANDO),
        # QoL
        'sightscope_always_on': str(GF.VISIBLE_HEALTH),
        'boss_sightscope': str(GF.BOSS_SIGHTSCOPE),
        'fast_tabs': str(GF.FAST_TABS),
        'free_menu_glitch': str(GF.FREE_MENU_GLITCH),
    },
    'roflags': {
        'boss_spot_hp': str(rset.ROFlags.BOSS_SPOT_HP),
        'legacy_boss_placement': str(rset.ROFlags.PRESERVE_PARTS),
    }
}


class InvalidSettingsException(Exception):
    pass


class RandomizerInterface:
    """
    RandomizerInterface acts as an interface between the web application
    and the Jets of Time randomizer code.

    All calls to the randomizer or its data are handled through this class.  It contains
    the appropriate methods for creating randomizer settings/config objects and querying
    them for information needed on the web generator.
    """
    def __init__(self, rom_data: bytearray):
        """
        Constructor for the RandomizerInterface class.

        :param rom_data: bytearray containing vanilla ROM data used to construct a randomizer object
        """
        self.randomizer = randomizer.Randomizer(rom_data, is_vanilla=True)

    def configure_seed_from_form(self, form: GenerateForm) -> str:
        """
        Generate a RandoConfig from the provided GenerateForm.
        This will convert the form data into the appropriate randomizer settings and config
        objects and then tell the randomizer to generate a seed.

        :param form: GenerateForm with the user's settings

        :return: string of a nonce, if any, that was used to obfuscate the seed
        """
        self.randomizer.settings = self.__convert_form_to_settings(form)
        nonce = ''
        # If this is a race seed, modify the seed value  before sending it through
        # the randomizer.  This will ensure that race ROMs and non-race ROMs with the same
        # seed value are not identical.
        if form.cleaned_data['spoiler_log']:
            self.randomizer.set_random_config()
        else:
            # Use the current timestamp's number of microseconds as an arbitrary nonce value
            nonce = str(datetime.datetime.now().microsecond)
            seed = self.randomizer.settings.seed
            self.randomizer.settings.seed = seed + nonce
            self.randomizer.set_random_config()
            self.randomizer.settings.seed = seed
        return nonce

    def configure_seed_from_settings(self, settings: rset.Settings, is_race_seed: bool) -> str:
        """
        Generate a RandoConfig from the provided Settings object.
        This will create a new game based on existing settings.

        This method will fail if the given settings object is for a mystery seed.

        :param settings: Settings object to copy for this new game
        :param is_race_seed: Whether or not this is a race seed

        :return: string of a nonce, if any, that was used to obfuscate the seed
        """

        if rset.GameFlags.MYSTERY in settings.gameflags:
            raise InvalidSettingsException("Mystery seeds cannot be cloned.")

        self.randomizer.settings = settings
        # get a random seed value to replace the existing one
        seed = settings.seed
        new_seed = seed
        while seed == new_seed:
            new_seed = self.get_random_seed()
        settings.seed = new_seed
        nonce = ''

        # If this is a race seed, modify the seed value  before sending it through
        # the randomizer.  This will ensure that race ROMs and non-race ROMs with the same
        # seed value are not identical.
        if is_race_seed:
            nonce = str(datetime.datetime.now().microsecond)
            self.randomizer.settings.seed = new_seed + nonce
            self.randomizer.set_random_config()
            self.randomizer.settings.seed = new_seed
        else:
            self.randomizer.set_random_config()
        return nonce

    def generate_rom(self) -> bytearray:
        """
        Create a ROM from the settings and config objects previously generated or set.

        :return: bytearray object with the modified ROM data
        """
        self.randomizer.generate_rom()
        return self.randomizer.get_generated_rom()

    def get_seed_hash(self) -> bytes:
        if not self.randomizer.has_generated:
            self.generate_rom()
        return self.randomizer.hash_string_bytes

    def set_seed_hash(self, hash_bytes: bytes):
        if not self.randomizer.has_generated:
            self.randomizer.hash_string_bytes = hash_bytes

    def set_settings_and_config(
        self, settings: rset.Settings, config: randoconfig.RandoConfig, form: Optional[RomForm]
    ):
        """
        Populate the randomizer with a pre-populated RandoSettings object and a
        preconfigured RandoSettings object.

        :param settings: RandoSettings object
        :param config: RandoConfig object
        :param form: RomForm with cosmetic settings, or None
        """
        # Cosmetic settings
        cos_flag_dict: dict[str, rset.CosmeticFlags] = {
            'reduce_flashes': rset.CosmeticFlags.REDUCE_FLASH,
            'zenan_alt_battle_music': rset.CosmeticFlags.ZENAN_ALT_MUSIC,
            'death_peak_alt_music': rset.CosmeticFlags.DEATH_PEAK_ALT_MUSIC,
            'quiet_mode': rset.CosmeticFlags.QUIET_MODE,
            'auto_run': rset.CosmeticFlags.AUTORUN
        }

        if form is not None:
            cos_flags = rset.CosmeticFlags(False)
            for name, flag in cos_flag_dict.items():
                if form.cleaned_data[name]:
                    cos_flags |= flag

            settings.cosmetic_flags = cos_flags

            # Character/Epoch renames
            settings.char_settings.names[0] = self.get_character_name(form.cleaned_data['crono_name'], 'Crono')
            settings.char_settings.names[1] = self.get_character_name(form.cleaned_data['marle_name'], 'Marle')
            settings.char_settings.names[2] = self.get_character_name(form.cleaned_data['lucca_name'], 'Lucca')
            settings.char_settings.names[3] = self.get_character_name(form.cleaned_data['robo_name'], 'Robo')
            settings.char_settings.names[4] = self.get_character_name(form.cleaned_data['frog_name'], 'Frog')
            settings.char_settings.names[5] = self.get_character_name(form.cleaned_data['ayla_name'], 'Ayla')
            settings.char_settings.names[6] = self.get_character_name(form.cleaned_data['magus_name'], 'Magus')
            settings.char_settings.names[7] = self.get_character_name(form.cleaned_data['epoch_name'], 'Epoch')

            # In-game options
            # Boolean options
            if form.cleaned_data['stereo_audio'] is not None:
                settings.ctoptions.stereo_audio = form.cleaned_data['stereo_audio']

            if form.cleaned_data['save_menu_cursor'] is not None:
                settings.ctoptions.save_menu_cursor = form.cleaned_data['save_menu_cursor']

            if form.cleaned_data['save_battle_cursor'] is not None:
                settings.ctoptions.save_battle_cursor = form.cleaned_data['save_battle_cursor']

            if form.cleaned_data['skill_item_info'] is not None:
                settings.ctoptions.skill_item_info = form.cleaned_data['skill_item_info']

            if form.cleaned_data['consistent_paging'] is not None:
                settings.ctoptions.consistent_paging = form.cleaned_data['consistent_paging']

            # Integer options
            if form.cleaned_data['battle_speed']:
                settings.ctoptions.battle_speed = \
                    self.clamp((form.cleaned_data['battle_speed'] - 1), 0, 7)

            if form.cleaned_data['background_selection']:
                settings.ctoptions.menu_background = \
                    self.clamp((form.cleaned_data['background_selection'] - 1), 0, 7)

            if form.cleaned_data['battle_message_speed']:
                settings.ctoptions.battle_msg_speed = \
                    self.clamp((form.cleaned_data['battle_message_speed'] - 1), 0, 7)

            if form.cleaned_data['battle_gauge_style'] is not None:
                settings.ctoptions.battle_gauge_style = \
                    self.clamp((form.cleaned_data['battle_gauge_style']), 0, 2)

        self.randomizer.settings = settings
        self.randomizer.config = config

    def get_settings(self) -> rset.Settings:
        """
        Get the settings object used to generate the seed.

        :return: RandoSettings object used to generate the seed
        """
        return self.randomizer.settings

    def get_config(self) -> randoconfig.RandoConfig:
        """
        Get the config object used to generate the the seed.

        :return: RandoConfig object used to generate the seed
        """
        return self.randomizer.config

    def get_rom_name(self, share_id: str) -> str:
        """
        Get the ROM name for this seed

        :param share_id: Share ID os the seed in question
        :return: String containing the name of the ROM for this seed
        """
        if rset.GameFlags.MYSTERY in self.randomizer.settings.gameflags:
            return "ctjot_mystery_" + share_id + ".sfc"
        else:
            return "ctjot_" + self.randomizer.settings.get_flag_string() + "_" + share_id + ".sfc"

    @classmethod
    def __convert_form_to_settings(cls, form: GenerateForm) -> rset.Settings:
        """
        Convert flag/settings data from the web form into a RandoSettings object.

        :param form: GenerateForm object from the web interface
        :return: RandoSettings object with flags/settings from the form applied
        """
        # preset data is passed as JSON in hidden CharField
        settings = rset.Settings.from_preset_data(form.cleaned_data['preset'])

        # Seed
        if form.cleaned_data['seed'] == "":
            # get a random seed
            settings.seed = cls.get_random_seed()
        else:
            settings.seed = form.cleaned_data['seed']

        return settings
    # End __convert_form_to_settings

    @classmethod
    def get_spoiler_log(
        cls, config: randoconfig.RandoConfig, settings: rset.Settings, hash_bytes: Optional[bytes]
    ) -> io.StringIO:
        """
        Get a spoiler log file-like object.

        :param config: RandoConfig object describing the seed
        :param settings: RandoSettings object describing the seed
        :return: File-like object with spoiler log data for the given seed data
        """
        spoiler_log = io.StringIO()
        rando = randomizer.Randomizer(cls.get_base_rom(), is_vanilla=True, settings=settings, config=config)
        if hash_bytes is not None:
            rando.hash_string_bytes = hash_bytes

        # The Randomizer.write_spoiler_log method writes directly to a file,
        # but it works if we pass a StringIO instead.
        rando.write_spoiler_log(spoiler_log)

        return spoiler_log

    @classmethod
    def get_json_spoiler_log(
        cls, config: randoconfig.RandoConfig, settings: rset.Settings, hash_bytes: Optional[bytes]
    ) -> io.StringIO:
        """
        Get a spoiler log file-like object.

        :param config: RandoConfig object describing the seed
        :param settings: RandoSettings object describing the seed
        :return: File-like object with spoiler log data for the given seed data
        """
        spoiler_log = io.StringIO()
        rando = randomizer.Randomizer(cls.get_base_rom(), is_vanilla=True, settings=settings, config=config)
        if hash_bytes is not None:
            rando.hash_string_bytes = hash_bytes

        # The Randomizer.write_spoiler_log method writes directly to a file,
        # but it works if we pass a StringIO instead.
        rando.write_json_spoiler_log(spoiler_log)

        return spoiler_log

    @staticmethod
    def get_web_spoiler_log(
            settings: rset.Settings,
            config: randoconfig.RandoConfig
    ) -> Dict[str, List[Dict[str, str]]]:
        """
        Get a dictionary representing the spoiler log data for the given seed.

        :param config: RandoConfig object describing the seed
        :return: Dictionary of spoiler data
        """
        spoiler_log: Dict[str, List[Dict[str, str]]] = {
            'characters': [],
            'key_items': [],
            'bosses': [],
            'objectives': [],
            'spheres': []
        }

        if rset.GameFlags.BUCKET_LIST in settings.gameflags:
            num_objs = settings.bucket_settings.num_objectives

            for ind, objective in enumerate(config.objectives):
                if ind >= num_objs:
                    break

                spoiler_log['objectives'].append(
                    {'name': str(f"Objective {ind+1}"),
                     'desc': objective.desc}
                )

        # Character data
        for recruit_spot in config.char_assign_dict.keys():
            held_char = config.char_assign_dict[recruit_spot].held_char
            reassign_char = config.pcstats.get_character_assignment(held_char)
            char_data = {'location': str(f"{recruit_spot}"),
                         'character': str(f"{held_char}"),
                         'reassign': str(f"{reassign_char}")}
            spoiler_log['characters'].append(char_data)

        # Key item data
        for location in config.key_item_locations:
            spoiler_log['key_items'].append(
                {'location': str(f"{location.getName()}"), 'key': str(location.getKeyItem())})

        # Boss data
        for location in config.boss_assign_dict.keys():
            if config.boss_assign_dict[location] == rotypes.BossID.TWIN_BOSS:
                twin_type = config.boss_data_dict[rotypes.BossID.TWIN_BOSS].parts[0].enemy_id
                twin_name = config.enemy_dict[twin_type].name
                boss_str = "Twin " + str(twin_name)
            else:
                boss_str = str(config.boss_assign_dict[location])
            spoiler_log['bosses'].append({'location': str(location), 'boss': boss_str})

        # Sphere data
        spheres = logicwriter.get_proof_string_from_settings_config(settings, config)
        rgx = re.compile(r'((?P<sphere>GO|(\d?)):\s*)?(?P<desc>.+)')
        for line in spheres.splitlines():
            if match := rgx.search(line):
                spoiler_log['spheres'].append(match.groupdict())

        return spoiler_log
    # End get_web_spoiler_log

    @staticmethod
    def _jotjson_encode(data: Dict[str, Any]) -> str:
        """Encode data into compact JSON using jotjson encoder.

        This is used to convert randosettings objects (Settings, etc.) into JSON to pass to options.js.

        :return: JSON string representation of data encoded via jotjson encoder
        """
        return json.dumps(data, cls=jotjson.JOTJSONEncoder, indent=None, separators=(',', ':'))

    @classmethod
    def get_enums_map(cls) -> Dict[str, Union[List[str], Dict[str, str]]]:
        """
        Get mappings of values used in options.js to string repr of randosettings enums to encode to JSON.

        This mapping is used in options.js to covert to/from presets, translating the form values used in JS
        into string representations of the enums (e.g. for general options like mode, item/enemy difficulty,
        shop prices, tech orders, etc., as well as game flags). The string representations can be loaded
        into randosettings objects via corresponding .from_jot_json. Django converts this map to JSON during
        templating.

        :return: mappings of values used in options.js to randosettings enum string representations
        """
        return enums_map

    @classmethod
    def get_forced_flags_json(cls) -> str:
        """
        Get forced flags mapping encoded as compact JSON.

        This mapping has modes/flags mapped to gameflags (under 'forced_off' or 'forced_on').
        In the web GUI, 'forced_off' flags get forced off and disabled, instead of just relying
        on fix_flag_conflicts to turn them off (as happens in the CLI).

        :return: ForcedFlags mapping object encoded as JSON.
        """
        return cls._jotjson_encode(rset.ForcedFlags)

    @classmethod
    def get_inv_enums_map(cls) -> Dict[str, Dict[str, str]]:
        """
        Get inverted flags map, with mappings of string repr of randosettings flag enums mapped to options.js values.

        This is the flags from enums_map, but each dictionary is inverted, so the values and keys are swapped.
        This is used in options.js to do lookups for string representations of randosettings enums based
        on the values of selections or toggles in the web UI.

        :return: mappings of andosettings enum string representations to values used in options.js
        """
        return {
            key: {str(v): k for k, v in mapping.items()}
            for key, mapping in enums_map.items() if isinstance(mapping, Dict)
        }

    @staticmethod
    def get_obhint_map() -> OrderedDict[str, str]:
        """
        Get ordered dict of objective hints aliases mapped to objective hint strings.

        :return: OrderedDict of obhint alias strings mapped to obhint strings.
        """
        return obhint.get_objective_hint_aliases()

    @staticmethod
    def get_presets_map() -> OrderedDict[str, Dict[str, Any]]:
        """
        Get preset ids mapped to their compact JSON contents.

        This builds a mapping of preset 'id' keys mapped to metadata and compact JSON
        contents. The keys are used for values in the preset selection dropdown, with
        descriptions pulled from metadata. Those same keys are used by options.js
        to load the appropriate preset data from the 'contents', which are rendered
        into the 'presets-map' JSON script.

        :return: OrderedDict of sorted preset id mapped to metadata and compact JSON contents
        """
        presets = [path for path in rset.PRESETS_PATH.rglob('*.preset.json')]
        preset_map: Dict[str, Dict[str, Any]] = {}
        for preset in presets:
            contents = ' '.join(preset.read_text().split())
            data = json.loads(preset.read_text(), cls=jotjson.JOTJSONDecoder)
            preset_id = data['metadata']['name'].lower().replace(' ', '_')
            preset_map[preset_id] = {
                'metadata': data['metadata'], 'contents': contents
            }
        return OrderedDict(sorted(preset_map.items()))

    @classmethod
    def get_settings_defaults_json(cls) -> str:
        """
        Get the default settings object encoded as compact JSON.

        This turns on fast tab and disables glitches by default as well.
        Even though those are not the defaults in Settings, they are used
        as "defaults" in the web GUI for improved UX, especially for new
        players.

        :return: default RandoSettings object encoded as JSON.
        """
        settings = rset.Settings()

        # turn on fast tabs and disable glitches by default
        settings.gameflags |= (
            rset.GameFlags.FIX_GLITCH | rset.GameFlags.FAST_TABS
        )

        return cls._jotjson_encode(settings)

    @staticmethod
    def get_random_seed() -> str:
        """
        Get a random seed string for a ROM.
        This seed string is built up from a list of names bundled with the randomizer.  This method
        expects the names.txt file to be accessible in the web app's root directory.

        :return: Random seed string.
        """
        names = randomizer.read_names()
        return "".join(random.choice(names) for i in range(2))

    @staticmethod
    def get_base_rom() -> bytearray:
        """
        Read in the server's vanilla ROM as a bytearray.
        This data is used to create a RandoConfig object to generate a seed.  It should not
        be used when applying the config and sending the seed to a user.  The user's ROM will
        be used for that process instead.

        The unheadered, vanilla Chrono Trigger ROM must be located in the web app's BASE_DIR
        and must be named ct.sfc.

        :return: bytearray containing the vanilla Chrono Trigger ROM data
        """
        with open(str("ct.sfc"), 'rb') as infile:
            rom = bytearray(infile.read())
        return rom

    @classmethod
    def get_share_details(
        cls, config: randoconfig.RandoConfig, settings: rset.Settings, hash_bytes: Optional[bytes]
    ) -> io.StringIO:
        """
        Get details about a seed for display on the seed share page.  If this is a mystery seed then
        just display "Mystery seed!".


        :param config: RandoConfig object describing this seed
        :param settings: RandoSettings object describing this seed
        :return: File-like object with seed share details
        """
        buffer = io.StringIO()
        rando = randomizer.Randomizer(cls.get_base_rom(), is_vanilla=True, settings=settings, config=config)
        if hash_bytes is not None:
            rando.hash_string_bytes = hash_bytes

        if rset.GameFlags.MYSTERY in settings.gameflags:
            # TODO - Get weights and non-mystery flags
            # NOTE - The randomizer overwrites the settings object when it is a mystery seed and wipes
            #        out the seed value and most of the probability data.  Either the "before" version
            #        of this object will need to be stored or the randomizer will need to be modified
            #        to preserve this information if we want more information here.
            buffer.write("Mystery seed!\n")
        else:
            # For now just use the settings spoiler output for the share link display.
            # TODO - Make this more comprehensive.
            buffer.write("Seed: " + settings.seed + "\n")
            rando.write_settings_spoilers(buffer)

        return buffer

    @staticmethod
    def get_character_name(name: str, default_name: str):
        """
        Given a character name and a default, validate the name and return either the
        validated name or the default value if the name is invalid.

        Valid names are five characters or less, alphanumeric characters only.

        :param name: Name selected by the user
        :param default_name: Default name of the character
        :return: Either the user's selected name or a default if the name is invalid.
        """
        if name is None or name == "" or len(name) > 5 or not name.isalnum():
            return default_name
        return name

    @staticmethod
    def clamp(value, min_val, max_val):
        return max(min_val, min(value, max_val))
