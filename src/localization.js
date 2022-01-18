import {MOD_ID} from "./resources";

const re_args = /%(\d+\$)?([A-Za-z%]|$)/g;
const re_snake_case = /(?:^|_)([\w\d])/g;

export const SUPPORTED_LANGUAGES = [
    'en_us',
    'de_de',
    'es_es',
    'ja_jp',
    'ko_kr',
    'pt_br',
    'ru_ru',
    'zh_cn',
];

export const DEFAULT_LANGUAGE = SUPPORTED_LANGUAGES[0];

export let translation = {
    'tooltip.config.boolean': 'This behavior is controlled by the config parameter "%1$s". Click to toggle this value.',
    'tooltip.config.int': 'This value can be changed via the config option "%1$s"',
    'tooltip.config.array': 'These values can be changed via the config option "%1$s"'
};

export function translate(key, ...args) {
    if (translation[key]) {
        let i = 0;
        return translation[key].replaceAll(re_args, () => args[i++]);
    }
    return key;
}

export function translateIEItem(name) {
    // try item name first
    let nameU = `item.${MOD_ID}.${name}`;
    let nameT = translate(nameU);
    if (nameU !== nameT)
        return nameT;
    // try block name
    nameU = `block.${MOD_ID}.${name}`;
    nameT = translate(nameU);
    if (nameU !== nameT)
        return nameT;
    // fallback
    return name;
}

export function addTranslation(key, value) {
    translation[key] = value;
}

export function addTranslationMultiple(dict) {
    for (let key in dict)
        translation[key] = dict[key];
}

export function hasTranslation(key) {
    return key in translation;
}

export function hasAllTranslations(keyArray) {
    return keyArray.reduce(
        (key, acc) => acc && hasTranslation(key),
        true
    );
}

export function translationChecksum() {
    const keyJoin = Object.keys(translation).join();
    let chk = 0x12345678;
    for (let i = 0; i < keyJoin.length; i++)
        chk += (keyJoin.charCodeAt(i) * (i + 1));
    return (chk & 0xffffffff).toString(16);
}

export function upperCaseName(name) {
    return name.replaceAll(re_snake_case, (a, b) => ' ' + b.toUpperCase()).trim();
}

export function prefixManual(key) {
    return `manual.${MOD_ID}.${key}`;
}