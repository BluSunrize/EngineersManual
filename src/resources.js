export const EXCLUDED_VERSION_BRANCHES = new Set([
    "1.7.10", "1.8.9", "1.9.4", "1.10.2", "1.11.2", "1.13pre", "1.13"
]);

export const MOD_ID = 'immersiveengineering';

export const REPO_OWNER = 'BluSunrize';
export const REPO_NAME = 'ImmersiveEngineering';

const REPO_BASE = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}`;

export const getAssetPath = (branch) => `${REPO_BASE}/${branch}/src/main/resources/assets/immersiveengineering/`;

export const getManualPath = (branch) => getAssetPath(branch)+'manual/';

export const getRecipePath = (branch) => `${REPO_BASE}/${branch}/src/generated/resources/data/immersiveengineering/recipes/`

export const getDataExportPath = (branch) => `${REPO_BASE}/manual-data/${branch}/`

export const getIconPath = (branch) => getDataExportPath(branch)+'icons/'

export const getTagPath = (branch) => getDataExportPath(branch)+'tags'

/** This is super hacky and probably a bad idea, but it's holding so far! */
export function reactSetStateWrapper(element, state, mountKeyword = 'loaded') {
    // If element is mounted, use setState
    if (element.state[mountKeyword])
        element.setState(state);
    // Otherwise do direct assignment
    else
        for (let key in state)
            element.state[key] = state[key];
}

export function elementHasClass(element, css_class){
    if(!element)
        return false;
    if(!element.classList)
        return false;
    return element.classList.contains(css_class);
}
