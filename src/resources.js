export const SUPPORTED_BRANCHES = [
    '1.18.1',
    '1.18',
    '1.16.5',
    '1.15',
    '1.14',
];

export const DEFAULT_BRANCH = SUPPORTED_BRANCHES[0];

export const MOD_ID = 'immersiveengineering';

export const getAssetPath = (branch) => `https://raw.githubusercontent.com/BluSunrize/ImmersiveEngineering/${branch}/src/main/resources/assets/immersiveengineering/`;

export const getManualPath = (branch) => getAssetPath(branch)+'manual/';

export const getRecipePath = (branch) => `https://raw.githubusercontent.com/BluSunrize/ImmersiveEngineering/${branch}/src/generated/resources/data/immersiveengineering/recipes/`

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