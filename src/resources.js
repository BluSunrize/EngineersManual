export const SUPPORTED_BRANCHES = [
    // TODO this one needs to be removed!
    'feature-datagen-models',
    '1.18.2',
    '1.18.1',
    '1.18',
    '1.16.5',
    '1.15',
    '1.14',
];

export const DEFAULT_BRANCH = SUPPORTED_BRANCHES[0];

export const MOD_ID = 'immersiveengineering';

// TODO change back to main repo
const REPO_BASE = 'https://raw.githubusercontent.com/malte0811/ImmersiveEngineering';

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
